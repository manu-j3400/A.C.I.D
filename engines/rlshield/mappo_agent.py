"""
engines/rlshield/mappo_agent.py

Multi-Agent Proximal Policy Optimization (MAPPO) for the RLShield SOC
orchestrator.

Architecture
------------
* Decentralised actors  — one small MLP per SOC analyst role.
  Input: per-role observation (obs_dim=24)
  Hidden: 64 → 32
  Output: softmax over role-specific action space (4 actions each)

* Centralised critic — single MLP that sees the concatenation of ALL
  agents' observations at once (96 dims for 4 agents).
  Hidden: 128 → 64
  Output: scalar state value V(s)

This follows the CTDE (Centralized Training, Decentralized Execution)
paradigm: during inference only the actor for the relevant role is used.
"""

import logging
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.distributions import Categorical

from .config import RLShieldConfig

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Network definitions
# --------------------------------------------------------------------------- #

class Actor(nn.Module):
    """Decentralised policy network for a single SOC analyst role."""

    def __init__(self, obs_dim: int, n_actions: int) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, n_actions),
        )

    def forward(self, obs: torch.Tensor) -> torch.Tensor:
        """Return action logits."""
        return self.net(obs)

    def get_dist(self, obs: torch.Tensor) -> Categorical:
        return Categorical(logits=self.forward(obs))


class CentralCritic(nn.Module):
    """Centralised value network — sees all agents' observations concatenated."""

    def __init__(self, joint_obs_dim: int) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(joint_obs_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
        )

    def forward(self, joint_obs: torch.Tensor) -> torch.Tensor:
        """Return scalar value estimate V(s)."""
        return self.net(joint_obs).squeeze(-1)


# --------------------------------------------------------------------------- #
# MAPPO agent
# --------------------------------------------------------------------------- #

class MAPPOAgent:
    """
    MAPPO controller managing four SOC analyst role-agents.

    Each role has its own Actor; a single CentralCritic is shared by all.
    """

    def __init__(self, config: RLShieldConfig) -> None:
        self.config = config
        self.device = torch.device(config.device)

        # Build one actor per role
        self.actors: Dict[str, Actor] = {}
        for role in config.role_names:
            n_act = config.n_actions(role)
            self.actors[role] = Actor(config.obs_dim, n_act).to(self.device)

        # Single centralised critic (joint obs = obs_dim * n_agents)
        joint_dim = config.obs_dim * config.n_agents
        self.critic = CentralCritic(joint_dim).to(self.device)

        # One optimiser per actor + one for critic
        self.actor_optims: Dict[str, optim.Adam] = {
            role: optim.Adam(self.actors[role].parameters(), lr=config.lr)
            for role in config.role_names
        }
        self.critic_optim = optim.Adam(self.critic.parameters(), lr=config.lr)

        logger.info(
            "MAPPOAgent initialised: %d roles, obs_dim=%d, device=%s",
            config.n_agents, config.obs_dim, config.device,
        )

    # ---------------------------------------------------------------------- #
    # Inference
    # ---------------------------------------------------------------------- #

    def select_actions(
        self, observations: Dict[str, np.ndarray]
    ) -> Dict[str, Tuple[int, float]]:
        """
        Sample one action per role from the decentralised actors.

        Parameters
        ----------
        observations : dict mapping role_name -> np.ndarray of shape (obs_dim,)

        Returns
        -------
        dict mapping role_name -> (action_index, log_prob)
        """
        results: Dict[str, Tuple[int, float]] = {}

        with torch.no_grad():
            for role in self.config.role_names:
                obs_t = torch.FloatTensor(observations[role]).unsqueeze(0).to(self.device)
                dist = self.actors[role].get_dist(obs_t)
                action = dist.sample()
                log_prob = dist.log_prob(action)
                results[role] = (int(action.item()), float(log_prob.item()))

        return results

    # ---------------------------------------------------------------------- #
    # Training
    # ---------------------------------------------------------------------- #

    def update(self, rollouts: List[Dict]) -> Dict:
        """
        Run PPO update over a collected rollout buffer.

        Parameters
        ----------
        rollouts : list of step dicts, each containing:
            - "observations"  : dict[role -> np.ndarray (obs_dim,)]
            - "actions"       : dict[role -> int]
            - "log_probs"     : dict[role -> float]
            - "rewards"       : dict[role -> float]
            - "dones"         : bool
            - "value"         : float (V(s) at this step)
            - "next_value"    : float (V(s') bootstrap, 0 at terminal)

        Returns
        -------
        dict with per-role actor_loss, critic_loss, entropy
        """
        if not rollouts:
            return {}

        T = len(rollouts)
        roles = self.config.role_names
        cfg = self.config

        # ------------------------------------------------------------------ #
        # 1. Build tensors from rollouts
        # ------------------------------------------------------------------ #
        obs_buf:      Dict[str, torch.Tensor] = {r: [] for r in roles}
        act_buf:      Dict[str, torch.Tensor] = {r: [] for r in roles}
        logp_old_buf: Dict[str, torch.Tensor] = {r: [] for r in roles}
        reward_buf:   Dict[str, list]          = {r: [] for r in roles}
        joint_obs_buf: List[torch.Tensor]      = []
        value_buf:    List[float]              = []
        done_buf:     List[bool]               = []

        for step in rollouts:
            obs_all = [step["observations"][r] for r in roles]
            joint_obs_buf.append(torch.FloatTensor(np.concatenate(obs_all)))
            value_buf.append(step["value"])
            done_buf.append(step["dones"])
            for r in roles:
                obs_buf[r].append(torch.FloatTensor(step["observations"][r]))
                act_buf[r].append(step["actions"][r])
                logp_old_buf[r].append(step["log_probs"][r])
                reward_buf[r].append(step["rewards"][r])

        joint_obs_t = torch.stack(joint_obs_buf).to(self.device)   # (T, joint_dim)
        values_t    = torch.FloatTensor(value_buf).to(self.device)  # (T,)

        # ------------------------------------------------------------------ #
        # 2. GAE advantage + returns (shared across agents — central critic)
        # ------------------------------------------------------------------ #
        advantages = torch.zeros(T, device=self.device)
        returns    = torch.zeros(T, device=self.device)
        gae        = 0.0
        next_val   = rollouts[-1].get("next_value", 0.0)

        for t in reversed(range(T)):
            mask    = 0.0 if done_buf[t] else 1.0
            nv      = (values_t[t + 1].item() if t + 1 < T else next_val)
            delta   = reward_buf[roles[0]][t] + cfg.gamma * nv * mask - values_t[t].item()
            gae     = delta + cfg.gamma * cfg.gae_lambda * mask * gae
            advantages[t] = gae
            returns[t]    = advantages[t] + values_t[t]

        advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)

        # ------------------------------------------------------------------ #
        # 3. PPO mini-batch updates
        # ------------------------------------------------------------------ #
        info: Dict = {}
        indices = np.arange(T)

        for _ in range(cfg.ppo_epochs):
            np.random.shuffle(indices)
            for start in range(0, T, cfg.mini_batch_size):
                mb = indices[start: start + cfg.mini_batch_size]
                mb_t = torch.LongTensor(mb).to(self.device)

                # Critic update
                self.critic_optim.zero_grad()
                v_pred = self.critic(joint_obs_t[mb_t])
                v_loss = cfg.value_coef * nn.functional.mse_loss(v_pred, returns[mb_t])
                v_loss.backward()
                self.critic_optim.step()

                # Actor update (per role)
                for role in roles:
                    obs_r   = torch.stack(obs_buf[role]).to(self.device)[mb_t]
                    act_r   = torch.LongTensor([act_buf[role][i] for i in mb]).to(self.device)
                    logp_r  = torch.FloatTensor([logp_old_buf[role][i] for i in mb]).to(self.device)
                    adv_r   = advantages[mb_t]

                    dist     = self.actors[role].get_dist(obs_r)
                    logp_new = dist.log_prob(act_r)
                    entropy  = dist.entropy().mean()

                    ratio      = torch.exp(logp_new - logp_r)
                    surr1      = ratio * adv_r
                    surr2      = torch.clamp(ratio, 1 - cfg.clip_eps, 1 + cfg.clip_eps) * adv_r
                    actor_loss = -torch.min(surr1, surr2).mean() - cfg.entropy_coef * entropy

                    self.actor_optims[role].zero_grad()
                    actor_loss.backward()
                    self.actor_optims[role].step()

                    info[role] = {
                        "actor_loss": float(actor_loss.item()),
                        "critic_loss": float(v_loss.item()),
                        "entropy": float(entropy.item()),
                    }

        return info

    # ---------------------------------------------------------------------- #
    # Persistence
    # ---------------------------------------------------------------------- #

    def save(self, path: str) -> None:
        """Serialise all actor weights, critic weights, and optimiser states."""
        payload = {
            "actors":       {r: self.actors[r].state_dict() for r in self.config.role_names},
            "critic":       self.critic.state_dict(),
            "actor_optims": {r: self.actor_optims[r].state_dict() for r in self.config.role_names},
            "critic_optim": self.critic_optim.state_dict(),
            "config":       self.config,
        }
        torch.save(payload, path)
        logger.info("MAPPOAgent checkpoint saved to %s", path)

    def load(self, path: str) -> None:
        """Restore weights from a checkpoint file (CPU-safe map_location)."""
        payload = torch.load(path, map_location=self.device, weights_only=True)
        for role in self.config.role_names:
            self.actors[role].load_state_dict(payload["actors"][role])
            self.actor_optims[role].load_state_dict(payload["actor_optims"][role])
        self.critic.load_state_dict(payload["critic"])
        self.critic_optim.load_state_dict(payload["critic_optim"])
        logger.info("MAPPOAgent checkpoint loaded from %s", path)
