"""
mappo — Multi-Agent Proximal Policy Optimization (MAPPO).

Each agent has its own actor network.  A centralised critic takes the
concatenated observations of all agents (CTDE paradigm: Centralised Training,
Decentralised Execution) to compute a global value estimate that reduces
variance and enables better coordination.

References
----------
Yu et al. (2022). "The Surprising Effectiveness of PPO in Cooperative
Multi-Agent Games." NeurIPS 2022.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import torch.optim as optim
    from torch.distributions import Categorical
    _TORCH = True
except ImportError:
    _TORCH = False


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class MAPPOConfig:
    """MAPPO hyperparameters."""
    lr_actor:      float = 5e-4
    lr_critic:     float = 1e-3
    clip_eps:      float = 0.2
    gamma:         float = 0.99
    lam:           float = 0.95       # GAE lambda
    entropy_coef:  float = 0.01
    value_coef:    float = 0.5
    n_epochs:      int   = 4
    batch_size:    int   = 32
    max_grad_norm: float = 10.0
    shared_critic: bool  = True       # centralised critic uses all agents' obs


# ---------------------------------------------------------------------------
# Neural networks
# ---------------------------------------------------------------------------

if _TORCH:
    class AgentActor(nn.Module):
        """Per-agent actor: obs → action logits + (optional) value."""

        def __init__(self, obs_dim: int, action_dim: int, hidden: int = 128) -> None:
            super().__init__()
            self.backbone = nn.Sequential(
                nn.Linear(obs_dim, hidden), nn.LayerNorm(hidden), nn.ReLU(),
                nn.Linear(hidden, hidden), nn.ReLU(),
            )
            self.actor_head = nn.Linear(hidden, action_dim)
            self.value_head = nn.Linear(hidden, 1)   # decentralised critic fallback

        def forward(self, obs: "torch.Tensor") -> Tuple["torch.Tensor", "torch.Tensor"]:
            h = self.backbone(obs)
            return self.actor_head(h), self.value_head(h).squeeze(-1)

        def act(
            self, obs: "torch.Tensor", action: Optional["torch.Tensor"] = None
        ) -> Tuple["torch.Tensor", "torch.Tensor", "torch.Tensor", "torch.Tensor"]:
            logits, value = self(obs)
            dist  = Categorical(logits=logits)
            if action is None:
                action = dist.sample()
            log_prob = dist.log_prob(action)
            entropy  = dist.entropy()
            return action, log_prob, entropy, value

    class CentralizedCritic(nn.Module):
        """
        Centralised critic: concatenated all-agent obs → global value.
        Used only during training (CTDE).
        """

        def __init__(self, total_obs_dim: int, hidden: int = 256) -> None:
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(total_obs_dim, hidden), nn.LayerNorm(hidden), nn.ReLU(),
                nn.Linear(hidden, hidden), nn.ReLU(),
                nn.Linear(hidden, 1),
            )

        def forward(self, global_obs: "torch.Tensor") -> "torch.Tensor":
            return self.net(global_obs).squeeze(-1)


# ---------------------------------------------------------------------------
# Rollout buffer
# ---------------------------------------------------------------------------

class SharedRolloutBuffer:
    """Stores multi-agent trajectories and computes per-agent GAE advantages."""

    def __init__(self, n_agents: int) -> None:
        self.n_agents = n_agents
        self._data: List[Dict] = []

    def add(
        self,
        obs:       List[np.ndarray],
        actions:   List[int],
        rewards:   List[float],
        log_probs: List[float],
        values:    List[float],
        global_obs: np.ndarray,
        dones:     bool,
    ) -> None:
        self._data.append({
            "obs":        obs,
            "actions":    actions,
            "rewards":    rewards,
            "log_probs":  log_probs,
            "values":     values,
            "global_obs": global_obs,
            "done":       dones,
        })

    def compute_gae(
        self,
        last_values: List[float],
        gamma: float,
        lam: float,
    ) -> Dict[str, np.ndarray]:
        """Returns per-agent advantages and returns as flat arrays."""
        n = len(self._data)
        all_advantages = np.zeros((n, self.n_agents), dtype=np.float32)
        last_gae = np.zeros(self.n_agents, dtype=np.float32)

        for t in reversed(range(n)):
            d = self._data[t]
            next_vals = np.array(last_values if t == n - 1 else self._data[t + 1]["values"])
            non_term  = 0.0 if d["done"] else 1.0
            delta     = (
                np.array(d["rewards"]) + gamma * next_vals * non_term
                - np.array(d["values"])
            )
            last_gae  = delta + gamma * lam * non_term * last_gae
            all_advantages[t] = last_gae

        values_arr = np.array([[d["values"][a] for d in self._data] for a in range(self.n_agents)], dtype=np.float32)
        returns    = all_advantages.T + values_arr  # (n_agents, n)

        return {
            "advantages": all_advantages,       # (n, n_agents)
            "returns":    returns.T,             # (n, n_agents)
        }

    def as_tensors(self) -> Dict:
        """Convert raw lists to numpy arrays."""
        obs_per_agent = [
            np.array([d["obs"][a] for d in self._data], dtype=np.float32)
            for a in range(self.n_agents)
        ]
        return {
            "obs":        obs_per_agent,
            "actions":    np.array([[d["actions"][a]  for d in self._data] for a in range(self.n_agents)]),
            "log_probs":  np.array([[d["log_probs"][a] for d in self._data] for a in range(self.n_agents)]),
            "global_obs": np.array([d["global_obs"] for d in self._data], dtype=np.float32),
        }

    def clear(self) -> None:
        self._data.clear()

    def __len__(self) -> int:
        return len(self._data)


# ---------------------------------------------------------------------------
# MAPPO Agent (per SOC analyst agent)
# ---------------------------------------------------------------------------

class MAPPOAgent:
    """One MAPPO actor for a single SOC analyst agent."""

    def __init__(
        self,
        agent_id:   int,
        obs_dim:    int,
        action_dim: int,
        config:     Optional[MAPPOConfig] = None,
    ) -> None:
        self.agent_id   = agent_id
        self.obs_dim    = obs_dim
        self.action_dim = action_dim
        self.config     = config or MAPPOConfig()
        self._rng       = np.random.default_rng()

        if _TORCH:
            self.actor = AgentActor(obs_dim, action_dim)
            self.optimizer = optim.Adam(self.actor.parameters(), lr=self.config.lr_actor)
        else:
            self.actor = None
            self.optimizer = None

    def select_action(
        self, obs: np.ndarray
    ) -> Tuple[int, float, float]:
        """Return (action_idx, log_prob, value)."""
        if not _TORCH or self.actor is None:
            a = int(self._rng.integers(0, self.action_dim))
            return a, -math.log(self.action_dim), 0.0
        self.actor.eval()
        with torch.no_grad():
            obs_t = torch.tensor(obs, dtype=torch.float32).unsqueeze(0)
            a_t, lp_t, _, v_t = self.actor.act(obs_t)
        return int(a_t.item()), float(lp_t.item()), float(v_t.item())

    def update(self, batch: Dict) -> Dict[str, float]:
        """PPO update step for this agent using pre-computed batch data."""
        if not _TORCH or self.actor is None:
            return {"policy_loss": 0.0, "value_loss": 0.0, "entropy": 0.0}

        obs_t    = torch.tensor(batch["obs"],       dtype=torch.float32)
        acts_t   = torch.tensor(batch["actions"],   dtype=torch.long)
        old_lp_t = torch.tensor(batch["log_probs"], dtype=torch.float32)
        adv_t    = torch.tensor(batch["advantages"],dtype=torch.float32)
        ret_t    = torch.tensor(batch["returns"],   dtype=torch.float32)

        adv_t = (adv_t - adv_t.mean()) / (adv_t.std() + 1e-8)

        p_losses, v_losses, entropies = [], [], []
        self.actor.train()
        for _ in range(self.config.n_epochs):
            n = obs_t.shape[0]
            idxs = torch.randperm(n)
            for start in range(0, n, self.config.batch_size):
                b = idxs[start : start + self.config.batch_size]
                _, new_lp, ent, new_val = self.actor.act(obs_t[b], acts_t[b])
                ratio   = torch.exp(new_lp - old_lp_t[b])
                adv_b   = adv_t[b]
                surr1   = ratio * adv_b
                surr2   = torch.clamp(ratio, 1 - self.config.clip_eps, 1 + self.config.clip_eps) * adv_b
                p_loss  = -torch.min(surr1, surr2).mean()
                v_loss  = 0.5 * (new_val - ret_t[b]).pow(2).mean()
                e_loss  = -ent.mean()
                loss    = p_loss + self.config.value_coef * v_loss + self.config.entropy_coef * e_loss

                self.optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(self.actor.parameters(), self.config.max_grad_norm)
                self.optimizer.step()

                p_losses.append(p_loss.item())
                v_losses.append(v_loss.item())
                entropies.append(-e_loss.item())

        return {
            "policy_loss": float(np.mean(p_losses)),
            "value_loss":  float(np.mean(v_losses)),
            "entropy":     float(np.mean(entropies)),
        }


# ---------------------------------------------------------------------------
# MAPPO Trainer
# ---------------------------------------------------------------------------

class MAPPOTrainer:
    """
    Coordinates all agents and the centralised critic.

    Parameters
    ----------
    agents  : list of MAPPOAgent (one per SOC analyst)
    critic  : CentralizedCritic (trained jointly)
    config  : MAPPOConfig
    """

    def __init__(
        self,
        agents: List[MAPPOAgent],
        config: Optional[MAPPOConfig] = None,
    ) -> None:
        self.agents  = agents
        self.config  = config or MAPPOConfig()
        self.n_agents = len(agents)
        self.buffer  = SharedRolloutBuffer(self.n_agents)

        if _TORCH and self.config.shared_critic:
            total_obs = agents[0].obs_dim * self.n_agents
            self.critic    = CentralizedCritic(total_obs)
            self.critic_opt = optim.Adam(self.critic.parameters(), lr=self.config.lr_critic)
        else:
            self.critic    = None
            self.critic_opt = None

    def collect_rollout(self, env, n_steps: int) -> None:
        """Run env for n_steps and store transitions in buffer."""
        obs_list, _ = env.reset()
        for _ in range(n_steps):
            actions, log_probs, values = [], [], []
            for a_id, agent in enumerate(self.agents):
                act, lp, v = agent.select_action(obs_list[a_id])
                actions.append(act)
                log_probs.append(lp)
                values.append(v)

            global_obs = np.concatenate(obs_list)
            next_obs, rewards, done, _ = env.step(actions)

            self.buffer.add(
                obs        = obs_list,
                actions    = actions,
                rewards    = rewards,
                log_probs  = log_probs,
                values     = values,
                global_obs = global_obs,
                dones      = done,
            )
            obs_list = next_obs
            if done:
                obs_list, _ = env.reset()

        # Compute last values for GAE bootstrap
        last_values = [
            self.agents[i].select_action(obs_list[i])[2]
            for i in range(self.n_agents)
        ]
        return last_values

    def update(self) -> Dict[str, float]:
        """Update all agents and critic from collected rollout."""
        if len(self.buffer) == 0:
            return {}

        last_values = [0.0] * self.n_agents
        gae = self.buffer.compute_gae(last_values, self.config.gamma, self.config.lam)
        tensors = self.buffer.as_tensors()
        all_losses = {}

        for a_id, agent in enumerate(self.agents):
            batch = {
                "obs":        tensors["obs"][a_id],
                "actions":    tensors["actions"][a_id],
                "log_probs":  tensors["log_probs"][a_id],
                "advantages": gae["advantages"][:, a_id],
                "returns":    gae["returns"][:, a_id],
            }
            losses = agent.update(batch)
            all_losses[f"agent_{a_id}"] = losses

        # Update centralised critic
        if _TORCH and self.critic is not None:
            global_obs_t = torch.tensor(tensors["global_obs"], dtype=torch.float32)
            returns_mean = torch.tensor(gae["returns"].mean(axis=1), dtype=torch.float32)
            for _ in range(self.config.n_epochs):
                pred    = self.critic(global_obs_t)
                c_loss  = F.mse_loss(pred, returns_mean)
                self.critic_opt.zero_grad()
                c_loss.backward()
                nn.utils.clip_grad_norm_(self.critic.parameters(), self.config.max_grad_norm)
                self.critic_opt.step()
            all_losses["critic_loss"] = float(c_loss.item())

        self.buffer.clear()
        return all_losses

    def train(
        self,
        env,
        n_iterations: int = 100,
        n_steps_per_iter: int = 128,
    ) -> List[Dict]:
        """Full training loop. Returns list of per-iteration loss dicts."""
        metrics = []
        for i in range(n_iterations):
            self.collect_rollout(env, n_steps_per_iter)
            losses = self.update()
            losses["iteration"] = i
            metrics.append(losses)
        return metrics

    def save(self, path: str) -> None:
        """Save all actor weights and critic to directory."""
        p = Path(path)
        p.mkdir(parents=True, exist_ok=True)
        if _TORCH:
            for agent in self.agents:
                torch.save(
                    agent.actor.state_dict(),
                    p / f"actor_{agent.agent_id}.pt",
                )
            if self.critic is not None:
                torch.save(self.critic.state_dict(), p / "critic.pt")

    def load(self, path: str) -> None:
        """Load actor weights and critic from directory."""
        if not _TORCH:
            return
        p = Path(path)
        for agent in self.agents:
            fpath = p / f"actor_{agent.agent_id}.pt"
            if fpath.exists():
                agent.actor.load_state_dict(torch.load(fpath, map_location="cpu"))
        if self.critic is not None:
            cpath = p / "critic.pt"
            if cpath.exists():
                self.critic.load_state_dict(torch.load(cpath, map_location="cpu"))
