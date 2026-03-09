"""
Engine 3: SNN Micro-Temporal Profiler — LIF Spiking Neural Network
===================================================================

Implements a multi-layer Leaky Integrate-and-Fire (LIF) network using snnTorch.

Biological LIF model (continuous time):
    τ_m · dV/dt = −(V − V_rest) + R · I(t)

Discretized (Euler method, dt/τ_m = 1 − β):
    V[t+1] = β · V[t] + I[t]      (V_rest = 0 absorbed into β)
    spike[t+1] = 1 if V[t+1] ≥ V_thresh else 0
    V[t+1] ← V[t+1] − spike[t+1] · V_thresh   (reset-by-subtraction)

In snnTorch:
    lif = snntorch.Leaky(beta=β, spike_grad=surrogate.fast_sigmoid())
    spk, mem = lif(input_current, mem)

β ≈ exp(−dt / τ_m). For τ_m = 10ms and dt = 0.1ms: β = 0.99.
For faster dynamics (τ_m = 1ms, dt = 0.1ms): β = 0.905.

Surrogate gradient
------------------
The Heaviside step function H(V − θ) has zero gradient everywhere except at
V = θ where it is undefined. Surrogate gradient methods substitute a smooth
function during the backward pass only:

    fast_sigmoid derivative:  σ'(x) = 1 / (k|x| + 1)²   (k = slope)

Network architecture:
    Input (T, N=8) → FC(8→256) → LIF₁ → FC(256→128) → LIF₂ → FC(128→1) → sigmoid
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import torch
import torch.nn as nn
from torch import Tensor
import snntorch as snn
from snntorch import surrogate


# ---------------------------------------------------------------------------
# LIF Network
# ---------------------------------------------------------------------------

class LIFNetwork(nn.Module):
    """
    Two-layer spiking neural network for temporal execution profiling.

    The network processes a spike train time-step by time-step, accumulating
    membrane potential and emitting output spikes when the potential exceeds
    the threshold.

    Parameters
    ----------
    n_inputs    Number of input features (spike encoding channels, default 8).
    hidden_1    Width of first hidden layer (default 256).
    hidden_2    Width of second hidden layer (default 128).
    beta_1      Decay rate of first LIF layer. β ≈ exp(−dt/τ_m).
                Higher β = slower integration = longer memory.
    beta_2      Decay rate of second LIF layer.
    threshold   Firing threshold V_thresh (snnTorch normalizes to 1.0 internally).
    surrogate_slope  Slope of the fast_sigmoid surrogate gradient (steeper = harder threshold).
    dropout          Dropout rate between layers (regularization).
    """

    def __init__(
        self,
        n_inputs:        int   = 8,
        hidden_1:        int   = 256,
        hidden_2:        int   = 128,
        beta_1:          float = 0.95,
        beta_2:          float = 0.90,
        threshold:       float = 1.0,
        surrogate_slope: int   = 25,
        dropout:         float = 0.2,
    ) -> None:
        super().__init__()

        # Surrogate gradient function (shared across both LIF layers)
        spike_grad = surrogate.fast_sigmoid(slope=surrogate_slope)

        # Layer 1: fully-connected + LIF
        self.fc1  = nn.Linear(n_inputs, hidden_1, bias=False)
        self.lif1 = snn.Leaky(
            beta        = beta_1,
            threshold   = threshold,
            spike_grad  = spike_grad,
            init_hidden = False,   # we manage state manually for explicit control
            reset_mechanism = "subtract",   # V ← V − θ (soft reset, preserves sub-threshold charge)
        )
        self.drop1 = nn.Dropout(p=dropout)

        # Layer 2: fully-connected + LIF
        self.fc2  = nn.Linear(hidden_1, hidden_2, bias=False)
        self.lif2 = snn.Leaky(
            beta        = beta_2,
            threshold   = threshold,
            spike_grad  = spike_grad,
            init_hidden = False,
            reset_mechanism = "subtract",
        )

        # Readout: linear projection → sigmoid anomaly probability
        self.fc_out = nn.Linear(hidden_2, 1, bias=True)

    def forward(
        self,
        spike_input: Tensor,             # (T, B, n_inputs)
        mem1_init:   Optional[Tensor] = None,
        mem2_init:   Optional[Tensor] = None,
    ) -> Tuple[Tensor, Tensor, Tensor]:
        """
        Forward pass through time.

        Parameters
        ----------
        spike_input  (T, B, n_inputs) — spike train, one time step per row.
        mem1_init    Optional initial membrane potential for LIF₁. Zeros if None.
        mem2_init    Optional initial membrane potential for LIF₂. Zeros if None.

        Returns
        -------
        spk_record   (T, B, hidden_2) — output spikes from LIF₂ at each timestep.
        mem_record   (T, B, hidden_2) — membrane potentials from LIF₂.
        anomaly_prob (B,) — sigmoid anomaly score aggregated over time.
        """
        T, B = spike_input.shape[:2]
        device = spike_input.device

        mem1 = mem1_init if mem1_init is not None else self.lif1.init_leaky()
        mem2 = mem2_init if mem2_init is not None else self.lif2.init_leaky()

        # Expand scalar initial states to match batch size if needed
        if isinstance(mem1, Tensor) and mem1.dim() == 0:
            mem1 = torch.zeros(B, self.fc1.out_features, device=device)
        if isinstance(mem2, Tensor) and mem2.dim() == 0:
            mem2 = torch.zeros(B, self.fc2.out_features, device=device)

        spk_record = []
        mem_record = []

        for t in range(T):
            x = spike_input[t]               # (B, n_inputs)

            # Layer 1
            cur1       = self.fc1(x)         # (B, hidden_1)
            spk1, mem1 = self.lif1(cur1, mem1)
            spk1       = self.drop1(spk1)

            # Layer 2
            cur2       = self.fc2(spk1)      # (B, hidden_2)
            spk2, mem2 = self.lif2(cur2, mem2)

            spk_record.append(spk2)
            mem_record.append(mem2)

        spk_stack = torch.stack(spk_record)  # (T, B, hidden_2)
        mem_stack = torch.stack(mem_record)  # (T, B, hidden_2)

        # Aggregate output spikes across time → anomaly probability
        # Mean firing rate over time, then linear readout + sigmoid
        mean_firing = spk_stack.mean(dim=0)          # (B, hidden_2)
        anomaly_prob = torch.sigmoid(self.fc_out(mean_firing)).squeeze(-1)  # (B,)

        return spk_stack, mem_stack, anomaly_prob


# ---------------------------------------------------------------------------
# Loss
# ---------------------------------------------------------------------------

class TemporalAnomalyLoss(nn.Module):
    """
    Binary cross-entropy loss for temporal anomaly detection.

    Labels:  0.0 = clean execution rhythm (baseline)
             1.0 = anomalous execution rhythm (obfuscated payload)

    Optionally adds a firing-rate regularization term to prevent silent neurons
    (all membrane potentials below threshold throughout training).
    """

    def __init__(
        self,
        firing_rate_target: float = 0.2,   # target mean firing rate
        fr_lambda:          float = 0.1,   # weight for firing-rate regularization
    ) -> None:
        super().__init__()
        self.fr_target = firing_rate_target
        self.fr_lambda = fr_lambda
        self.bce = nn.BCELoss()

    def forward(
        self,
        anomaly_prob: Tensor,   # (B,) predicted probability
        labels:       Tensor,   # (B,) ground truth {0, 1}
        spk_record:   Tensor,   # (T, B, hidden_2) output spikes
    ) -> Tensor:
        # Primary loss
        bce_loss = self.bce(anomaly_prob, labels)

        # Firing-rate regularization: penalize mean rate deviating from target
        mean_rate = spk_record.mean()
        fr_loss   = (mean_rate - self.fr_target).pow(2)

        return bce_loss + self.fr_lambda * fr_loss


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass
class LIFConfig:
    """Hyperparameters for the LIF network and training."""
    n_inputs:        int   = 8
    hidden_1:        int   = 256
    hidden_2:        int   = 128
    beta_1:          float = 0.95    # τ_m ≈ 20 bins (fast integration)
    beta_2:          float = 0.90    # τ_m ≈ 10 bins (sharper temporal selectivity)
    threshold:       float = 1.0
    surrogate_slope: int   = 25
    dropout:         float = 0.2
    n_timesteps:     int   = 512     # T: number of time bins per sample
    device:          str   = "cuda" if torch.cuda.is_available() else "cpu"
