"""
PPOAgent — Proximal Policy Optimisation actor-critic agent.

Implements the clipped surrogate objective from Schulman et al. (2017)
with Generalised Advantage Estimation (GAE-Lambda). The architecture uses
two separate MLPs for the actor and critic heads, sharing no weights to
avoid value-function interference with the policy gradient.

References:
  Schulman et al., "Proximal Policy Optimization Algorithms," arXiv:1707.06347.
  Schulman et al., "High-Dimensional Continuous Control Using GAE," arXiv:1506.02438.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.distributions import Categorical


def _mlp(in_dim: int, hidden: List[int], out_dim: int, activation=nn.Tanh) -> nn.Sequential:
    """Build a simple MLP with the given hidden layer widths."""
    layers: List[nn.Module] = []
    prev = in_dim
    for h in hidden:
        layers += [nn.Linear(prev, h), activation()]
        prev = h
    layers.append(nn.Linear(prev, out_dim))
    return nn.Sequential(*layers)


class _Actor(nn.Module):
    def __init__(self, obs_dim: int, n_actions: int) -> None:
        super().__init__()
        self.net = _mlp(obs_dim, [128, 64], n_actions)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return torch.softmax(self.net(x), dim=-1)


class _Critic(nn.Module):
    def __init__(self, obs_dim: int) -> None:
        super().__init__()
        self.net = _mlp(obs_dim, [128, 64], 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


class PPOAgent:
    """
    Proximal Policy Optimisation agent for discrete action spaces.

    Hyper-parameters:
        clip_eps     -- PPO clipping threshold (epsilon in paper)
        gamma        -- discount factor
        gae_lambda   -- GAE smoothing parameter
        entropy_coef -- weight on entropy bonus to encourage exploration
    """

    def __init__(
        self,
        obs_dim: int,
        n_actions: int,
        lr: float = 3e-4,
        device: str = "cpu",
        clip_eps: float = 0.2,
        gamma: float = 0.99,
        gae_lambda: float = 0.95,
        entropy_coef: float = 0.01,
    ) -> None:
        self.obs_dim = obs_dim
        self.n_actions = n_actions
        self.device = torch.device(device)
        self.clip_eps = clip_eps
        self.gamma = gamma
        self.gae_lambda = gae_lambda
        self.entropy_coef = entropy_coef

        self.actor = _Actor(obs_dim, n_actions).to(self.device)
        self.critic = _Critic(obs_dim).to(self.device)
        self.optimizer = optim.Adam(
            list(self.actor.parameters()) + list(self.critic.parameters()), lr=lr
        )

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def select_action(self, obs: np.ndarray) -> Tuple[int, float, float]:
        """
        Sample an action from the current policy.

        Args:
            obs: observation vector of shape (obs_dim,)

        Returns:
            action:   sampled action index
            log_prob: log probability of selected action (for PPO ratio)
            value:    critic estimate V(s)
        """
        obs_t = torch.as_tensor(obs, dtype=torch.float32, device=self.device)
        with torch.no_grad():
            probs = self.actor(obs_t)
            value = self.critic(obs_t).item()
        dist = Categorical(probs)
        action = dist.sample()
        log_prob = dist.log_prob(action).item()
        return int(action.item()), log_prob, value

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def update(self, rollout: List[Dict]) -> Dict[str, float]:
        """
        Run one PPO update epoch over the provided rollout buffer.

        Each element of rollout must contain:
            obs, action, log_prob, reward, value, done

        Returns a dict with loss scalars for logging.
        """
        # ---- Unpack rollout ----
        obs      = torch.tensor([t["obs"]      for t in rollout], dtype=torch.float32, device=self.device)
        actions  = torch.tensor([t["action"]   for t in rollout], dtype=torch.long,    device=self.device)
        old_lps  = torch.tensor([t["log_prob"] for t in rollout], dtype=torch.float32, device=self.device)
        rewards  = [t["reward"] for t in rollout]
        values   = [t["value"]  for t in rollout]
        dones    = [t["done"]   for t in rollout]

        # ---- GAE advantage estimation ----
        advantages, returns = self._compute_gae(rewards, values, dones)
        adv_t = torch.tensor(advantages, dtype=torch.float32, device=self.device)
        ret_t = torch.tensor(returns,    dtype=torch.float32, device=self.device)
        # Normalise advantages
        adv_t = (adv_t - adv_t.mean()) / (adv_t.std() + 1e-8)

        # ---- PPO surrogate loss ----
        probs    = self.actor(obs)
        dist     = Categorical(probs)
        new_lps  = dist.log_prob(actions)
        entropy  = dist.entropy().mean()

        ratio    = torch.exp(new_lps - old_lps)
        clipped  = torch.clamp(ratio, 1.0 - self.clip_eps, 1.0 + self.clip_eps)
        policy_loss = -torch.min(ratio * adv_t, clipped * adv_t).mean()

        # ---- Value loss ----
        new_values  = self.critic(obs)
        value_loss  = nn.functional.mse_loss(new_values, ret_t)

        # ---- Combined loss ----
        loss = policy_loss + 0.5 * value_loss - self.entropy_coef * entropy

        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(
            list(self.actor.parameters()) + list(self.critic.parameters()), max_norm=0.5
        )
        self.optimizer.step()

        return {
            "policy_loss": policy_loss.item(),
            "value_loss":  value_loss.item(),
            "entropy":     entropy.item(),
            "total_loss":  loss.item(),
        }

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: str) -> None:
        torch.save(
            {
                "actor":  self.actor.state_dict(),
                "critic": self.critic.state_dict(),
                "optim":  self.optimizer.state_dict(),
            },
            path,
        )

    def load(self, path: str) -> None:
        ckpt = torch.load(path, map_location=self.device, weights_only=True)
        self.actor.load_state_dict(ckpt["actor"])
        self.critic.load_state_dict(ckpt["critic"])
        self.optimizer.load_state_dict(ckpt["optim"])

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _compute_gae(
        self,
        rewards: List[float],
        values: List[float],
        dones: List[bool],
    ) -> Tuple[List[float], List[float]]:
        """Compute GAE advantages and discounted returns."""
        n = len(rewards)
        advantages = [0.0] * n
        returns    = [0.0] * n
        gae        = 0.0
        next_val   = 0.0  # bootstrap with 0 at episode end

        for t in reversed(range(n)):
            mask    = 0.0 if dones[t] else 1.0
            delta   = rewards[t] + self.gamma * next_val * mask - values[t]
            gae     = delta + self.gamma * self.gae_lambda * mask * gae
            advantages[t] = gae
            returns[t]    = gae + values[t]
            next_val      = values[t]

        return advantages, returns
