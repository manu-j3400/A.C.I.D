"""
Byzantine-Resilient Federated Learning Aggregation Server
==========================================================

Architecture
------------
  Workers (N nodes) ──[gRPC]──► ByzantineResilientAggregator
                                        │
                                  buffer until quorum
                                        │
                                   Multi-Krum filter
                                        │
                                  ◄── aggregated gradient

Transport is gRPC (compile proto/aggregator.proto before use):

    python -m grpc_tools.protoc \
        -I proto \
        --python_out=. \
        --grpc_python_out=. \
        proto/aggregator.proto

The aggregation core (ByzantineResilientAggregator) is decoupled from gRPC
and can be tested independently or embedded in custom transports.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Dict, FrozenSet, List, Optional, Set

import torch

from .multikrum import multi_krum

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Round state
# ---------------------------------------------------------------------------

@dataclass
class FederatedRound:
    """
    Holds all mutable state for a single aggregation round.

    Thread-safety: `lock` guards `received`. Once `event` is set the round
    is complete and `aggregated` / `accepted_ids` are immutable.
    """
    round_id:     int
    received:     Dict[str, torch.Tensor]  = field(default_factory=dict)
    lock:         threading.Lock           = field(default_factory=threading.Lock)
    event:        threading.Event          = field(default_factory=threading.Event)
    aggregated:   Optional[torch.Tensor]   = field(default=None, init=False)
    accepted_ids: FrozenSet[str]           = field(default=frozenset(), init=False)
    rejected_ids: FrozenSet[str]           = field(default=frozenset(), init=False)


# ---------------------------------------------------------------------------
# Aggregation core
# ---------------------------------------------------------------------------

class ByzantineResilientAggregator:
    """
    Thread-safe coordinator for one federated round at a time.

    Multiple gRPC worker threads call `submit_gradient()` concurrently.
    The Nth submission (completing a quorum) triggers Multi-Krum aggregation
    on the calling thread, then unblocks all waiting threads simultaneously.

    Parameters
    ----------
    n_workers : int
        Total number of expected workers per round.
    f : int
        Maximum Byzantine workers tolerated (requires n_workers ≥ 2f + 3).
    m : int | None
        Number of gradients to select; defaults to n_workers − f.
    quorum : int | None
        Minimum submissions before aggregation fires.
        Defaults to n_workers (full quorum). Set < n_workers to handle
        stragglers (must still satisfy quorum ≥ 2f + 3).
    device : str
        Torch device for aggregation ('cuda' preferred for N > 20).
    round_timeout_s : float
        How long submit_gradient() waits for a round to complete before
        raising TimeoutError.
    """

    def __init__(
        self,
        n_workers:       int,
        f:               int,
        m:               Optional[int]   = None,
        quorum:          Optional[int]   = None,
        device:          str             = "cuda" if torch.cuda.is_available() else "cpu",
        round_timeout_s: float           = 300.0,
    ) -> None:
        self._quorum = quorum if quorum is not None else n_workers
        if self._quorum < 2 * f + 3:
            raise ValueError(
                f"quorum={self._quorum} is too small to tolerate f={f} Byzantine workers "
                f"(need quorum ≥ 2f+3 = {2*f+3})."
            )

        self.n_workers       = n_workers
        self.f               = f
        self.m               = m
        self.device          = torch.device(device)
        self.timeout_s       = round_timeout_s

        self._round_lock:    threading.Lock          = threading.Lock()
        self._current_round: Optional[FederatedRound] = None
        self._round_id:      int                     = 0

        logger.info(
            "ByzantineResilientAggregator ready | "
            "n_workers=%d  f=%d  m=%s  quorum=%d  device=%s",
            n_workers, f, m or f"n−f={n_workers - f}", self._quorum, device,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def submit_gradient(
        self,
        worker_id:     str,
        flat_gradient: torch.Tensor,
    ) -> Optional[torch.Tensor]:
        """
        Submit a flat gradient from `worker_id` for the current round.

        Blocks until the round completes (quorum reached + Multi-Krum done).

        Returns
        -------
        torch.Tensor
            The aggregated gradient if this worker was *accepted* by Multi-Krum.
        None
            If this worker's gradient was identified as a Byzantine outlier.

        Raises
        ------
        TimeoutError
            If the round does not complete within `round_timeout_s` seconds.
        """
        round_ = self._get_or_create_round()
        trigger = False

        with round_.lock:
            if worker_id in round_.received:
                logger.warning(
                    "Round %d: duplicate submission from worker '%s' — ignored.",
                    round_.round_id, worker_id,
                )
                return None

            round_.received[worker_id] = flat_gradient.to(self.device)
            n_received = len(round_.received)
            logger.debug(
                "Round %d: received gradient from '%s' (%d/%d submissions)",
                round_.round_id, worker_id, n_received, self._quorum,
            )

            if n_received >= self._quorum:
                trigger = True

        if trigger:
            self._run_aggregation(round_)

        # Block until the round resolves (another thread may have triggered it).
        if not round_.event.wait(timeout=self.timeout_s):
            raise TimeoutError(
                f"Round {round_.round_id} timed out after {self.timeout_s}s "
                f"waiting for a quorum of {self._quorum} workers."
            )

        if worker_id in round_.accepted_ids:
            return round_.aggregated
        return None     # this worker was filtered as Byzantine

    def get_round_stats(self) -> dict:
        """Return a snapshot of the most recently completed round's metadata."""
        round_ = self._current_round
        if round_ is None or not round_.event.is_set():
            return {"status": "no_completed_round"}
        return {
            "round_id":     round_.round_id,
            "accepted":     sorted(round_.accepted_ids),
            "rejected":     sorted(round_.rejected_ids),
            "grad_norm":    round_.aggregated.norm().item()
                            if round_.aggregated is not None else None,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_or_create_round(self) -> FederatedRound:
        with self._round_lock:
            if self._current_round is None or self._current_round.event.is_set():
                self._round_id += 1
                self._current_round = FederatedRound(round_id=self._round_id)
                logger.info("Starting federated round %d.", self._round_id)
            return self._current_round

    def _run_aggregation(self, round_: FederatedRound) -> None:
        """
        Execute Multi-Krum on all received gradients and populate round_ results.

        Called exactly once per round (the thread that tips the quorum counter).
        All other threads are blocked in round_.event.wait() and will be
        unblocked by round_.event.set() at the end of this method.
        """
        t0 = time.perf_counter()

        with round_.lock:
            worker_ids: List[str]        = list(round_.received.keys())
            grads:      List[torch.Tensor] = [round_.received[w] for w in worker_ids]
        n_submitted = len(grads)

        logger.info(
            "Round %d: running Multi-Krum on %d gradients (f=%d, m=%s)...",
            round_.round_id, n_submitted, self.f,
            self.m or f"n−f={n_submitted - self.f}",
        )

        aggregated, selected_indices = multi_krum(
            grads,
            f=self.f,
            m=self.m,
        )

        accepted: Set[str] = {worker_ids[i] for i in selected_indices}
        rejected: Set[str] = set(worker_ids) - accepted

        round_.aggregated   = aggregated
        round_.accepted_ids = frozenset(accepted)
        round_.rejected_ids = frozenset(rejected)

        elapsed_ms = (time.perf_counter() - t0) * 1000

        if rejected:
            logger.warning(
                "Round %d: REJECTED %d suspected Byzantine workers: %s",
                round_.round_id, len(rejected), sorted(rejected),
            )

        logger.info(
            "Round %d complete in %.1f ms | "
            "accepted=%d/%d | grad_norm=%.6f",
            round_.round_id,
            elapsed_ms,
            len(accepted),
            n_submitted,
            aggregated.norm().item(),
        )

        # Unblock all waiting worker threads simultaneously.
        round_.event.set()


# ---------------------------------------------------------------------------
# gRPC Servicer
# ---------------------------------------------------------------------------

def _gradient_to_tensor(gradient_bytes: bytes, gradient_dim: int, device: torch.device) -> torch.Tensor:
    """Deserialize IEEE 754 little-endian float32 bytes → torch.Tensor."""
    import struct
    if len(gradient_bytes) != gradient_dim * 4:
        raise ValueError(
            f"gradient_bytes length {len(gradient_bytes)} != gradient_dim * 4 = {gradient_dim * 4}"
        )
    floats = struct.unpack_from(f"<{gradient_dim}f", gradient_bytes)
    return torch.tensor(floats, dtype=torch.float32, device=device)


def _tensor_to_bytes(t: torch.Tensor) -> bytes:
    """Serialize a float32 tensor → IEEE 754 little-endian bytes."""
    import struct
    floats = t.cpu().numpy().tolist()
    return struct.pack(f"<{len(floats)}f", *floats)


class AggregationServicer:
    """
    gRPC servicer that bridges the protobuf transport layer to
    ByzantineResilientAggregator.

    Instantiate after compiling aggregator.proto:
        bash engines/ai/proto/compile.sh

    Then register with a grpc.Server:
        from aggregator import aggregator_pb2_grpc
        aggregator_pb2_grpc.add_AggregationServiceServicer_to_server(
            AggregationServicer(aggregator), server
        )
    """

    def __init__(self, aggregator: ByzantineResilientAggregator) -> None:
        self._agg = aggregator

    def SubmitGradient(self, request, context):
        """Blocking unary RPC — returns after the round completes."""
        try:
            from . import aggregator_pb2  # generated stubs
        except ImportError:
            context.abort(
                context.StatusCode.UNIMPLEMENTED if hasattr(context, "StatusCode") else 12,
                "gRPC stubs not generated. Run: bash engines/ai/proto/compile.sh",
            )
            return

        t0 = time.perf_counter()

        try:
            grad = _gradient_to_tensor(
                request.gradient_bytes,
                request.gradient_dim,
                self._agg.device,
            )
        except (ValueError, struct.error) as e:
            context.abort(3, f"Invalid gradient encoding: {e}")  # INVALID_ARGUMENT
            return

        try:
            result = self._agg.submit_gradient(request.worker_id, grad)
        except TimeoutError as e:
            context.abort(4, str(e))  # DEADLINE_EXCEEDED
            return
        except ValueError as e:
            context.abort(3, str(e))
            return

        round_ = self._agg._current_round
        accepted = result is not None

        resp = aggregator_pb2.AggregationResponse(
            accepted                  = accepted,
            aggregated_gradient_bytes = _tensor_to_bytes(result) if accepted else b"",
            gradient_dim              = request.gradient_dim,
            round_id                  = round_.round_id if round_ else 0,
            workers_accepted          = len(round_.accepted_ids) if round_ else 0,
            workers_rejected          = len(round_.rejected_ids) if round_ else 0,
            aggregated_grad_norm      = result.norm().item() if accepted else 0.0,
        )
        logger.info(
            "SubmitGradient RPC: worker=%s accepted=%s round=%d elapsed_ms=%.1f",
            request.worker_id, accepted,
            resp.round_id,
            (time.perf_counter() - t0) * 1000,
        )
        return resp

    def SubmitGradientStream(self, request, context):
        """Server-streaming RPC — emits status updates then the final result."""
        try:
            from . import aggregator_pb2
        except ImportError:
            return

        RoundUpdate = aggregator_pb2.RoundUpdate
        round_ = self._agg._get_or_create_round()

        yield RoundUpdate(
            status               = RoundUpdate.WAITING_FOR_QUORUM,
            round_id             = round_.round_id,
            submissions_received = len(round_.received),
            quorum_required      = self._agg._quorum,
            message              = "Waiting for quorum",
        )

        # Delegate to the blocking unary path and wrap result in a stream.
        final = self.SubmitGradient(request, context)
        if final is not None:
            yield RoundUpdate(
                status   = RoundUpdate.COMPLETE,
                round_id = final.round_id,
                result   = final,
                message  = "Round complete",
            )

    def GetRoundStats(self, request, context):
        try:
            from . import aggregator_pb2
        except ImportError:
            return
        stats = self._agg.get_round_stats()
        return aggregator_pb2.RoundStatsResponse(
            round_id             = stats.get("round_id", 0),
            workers_accepted     = len(stats.get("accepted", [])),
            workers_rejected     = len(stats.get("rejected", [])),
            accepted_worker_ids  = stats.get("accepted", []),
            rejected_worker_ids  = stats.get("rejected", []),
            aggregated_grad_norm = stats.get("grad_norm") or 0.0,
        )

    def HealthCheck(self, request, context):
        try:
            from . import aggregator_pb2
        except ImportError:
            return
        return aggregator_pb2.HealthResponse(
            status               = aggregator_pb2.HealthResponse.SERVING,
            current_round        = self._agg._round_id,
            workers_configured   = self._agg.n_workers,
            f_byzantine_tolerance = self._agg.f,
            device               = str(self._agg.device),
        )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """
    Launch the gRPC aggregation server.

    Prerequisites:
        bash engines/ai/proto/compile.sh   # generate Python stubs
        pip install grpcio
    """
    import argparse
    import concurrent.futures
    import grpc

    try:
        from . import aggregator_pb2_grpc
    except ImportError:
        print(
            "ERROR: gRPC stubs not found.\n"
            "Run:  bash engines/ai/proto/compile.sh\n"
            "Then: pip install grpcio"
        )
        return

    parser = argparse.ArgumentParser(description="Byzantine-resilient FL aggregation server")
    parser.add_argument("--port",        type=int,   default=50051)
    parser.add_argument("--workers",     type=int,   default=10)
    parser.add_argument("--f",           type=int,   default=2)
    parser.add_argument("--quorum",      type=int,   default=None)
    parser.add_argument("--device",      type=str,   default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--threads",     type=int,   default=20)
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    aggregator = ByzantineResilientAggregator(
        n_workers = args.workers,
        f         = args.f,
        quorum    = args.quorum,
        device    = args.device,
    )

    server = grpc.server(
        concurrent.futures.ThreadPoolExecutor(max_workers=args.threads),
        options=[
            ("grpc.max_receive_message_length", 512 * 1024 * 1024),  # 512 MB (large gradients)
            ("grpc.max_send_message_length",    512 * 1024 * 1024),
            ("grpc.keepalive_time_ms",          30_000),
            ("grpc.keepalive_timeout_ms",       10_000),
        ],
    )
    aggregator_pb2_grpc.add_AggregationServiceServicer_to_server(
        AggregationServicer(aggregator), server
    )
    server.add_insecure_port(f"[::]:{args.port}")
    server.start()

    logger.info(
        "Aggregation server listening on port %d | workers=%d f=%d device=%s",
        args.port, args.workers, args.f, args.device,
    )

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        server.stop(grace=5)


if __name__ == "__main__":
    main()
