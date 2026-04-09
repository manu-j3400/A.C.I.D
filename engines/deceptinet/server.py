"""
DeceptiNet server — CLI daemon and REST API.

Modes
-----
daemon  : Continuous tick loop.  Exposes a Flask REST API on --port.
once    : Single tick from a JSON observations file, then exit.
status  : Print current status and exit.

Usage
-----
python -m engines.deceptinet.server --mode daemon --port 7400
python -m engines.deceptinet.server --mode once --observations /tmp/obs.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger("deceptinet.server")


def _load_config(path: Optional[str]):
    from .honeypot_orchestrator import OrchestratorConfig
    if path and Path(path).exists():
        with open(path) as f:
            return OrchestratorConfig.from_dict(json.load(f))
    return OrchestratorConfig()


def _run_daemon(args) -> None:
    from .honeypot_orchestrator import HoneypotOrchestrator
    config = _load_config(args.config)
    config.tick_interval_s = getattr(args, "tick_interval", 5.0)
    orch = HoneypotOrchestrator(config)

    if args.checkpoint and Path(args.checkpoint).exists():
        orch.load_checkpoint(args.checkpoint)

    orch.start()

    try:
        from flask import Flask, jsonify, request as flask_request
        app = Flask("deceptinet")

        @app.route("/ingest", methods=["POST"])
        def ingest():
            alert = flask_request.get_json(force=True) or {}
            orch.ingest_alert(alert)
            return jsonify({"queued": True})

        @app.route("/tick", methods=["POST"])
        def tick():
            result = orch.tick()
            return jsonify({
                "tick_id":       result.tick_id,
                "action":        result.chosen_action,
                "reward":        result.reward,
                "belief":        result.belief_summary,
                "env":           result.env_render,
            })

        @app.route("/status", methods=["GET"])
        def status():
            return jsonify(orch.status())

        import threading
        def _tick_loop():
            while True:
                try:
                    orch.tick()
                except Exception as exc:
                    logger.error("Tick error: %s", exc)
                time.sleep(config.tick_interval_s)

        t = threading.Thread(target=_tick_loop, daemon=True)
        t.start()
        logger.info("DeceptiNet daemon starting on port %d", args.port)
        app.run(host="0.0.0.0", port=args.port, use_reloader=False)

    except ImportError:
        logger.warning("Flask not available — running headless tick loop")
        while True:
            try:
                orch.tick()
            except KeyboardInterrupt:
                break
            except Exception as exc:
                logger.error("Tick error: %s", exc)
            time.sleep(config.tick_interval_s)


def _run_once(args) -> None:
    from .honeypot_orchestrator import HoneypotOrchestrator
    config = _load_config(args.config)
    orch   = HoneypotOrchestrator(config)

    if args.checkpoint and Path(args.checkpoint).exists():
        orch.load_checkpoint(args.checkpoint)

    orch.start()

    if args.observations and Path(args.observations).exists():
        with open(args.observations) as f:
            for alert in json.load(f):
                orch.ingest_alert(alert)

    result = orch.tick()
    print(json.dumps({
        "tick_id":  result.tick_id,
        "action":   result.chosen_action,
        "reward":   result.reward,
        "belief":   result.belief_summary,
        "env":      result.env_render,
    }, indent=2))


def _run_status(args) -> None:
    from .honeypot_orchestrator import HoneypotOrchestrator
    config = _load_config(args.config)
    orch   = HoneypotOrchestrator(config)
    orch.start()
    print(json.dumps(orch.status(), indent=2))


def main() -> None:
    logging.basicConfig(
        level   = logging.INFO,
        format  = "%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt = "%Y-%m-%dT%H:%M:%S",
    )

    parser = argparse.ArgumentParser(
        prog        = "deceptinet",
        description = "DeceptiNet adaptive honeypot orchestrator",
    )
    parser.add_argument(
        "--mode", choices=["daemon", "once", "status"],
        default="daemon",
        help="Operating mode (default: daemon)",
    )
    parser.add_argument("--config",      default=None, help="Path to JSON config file")
    parser.add_argument("--checkpoint",  default=None, help="Path to PPO checkpoint")
    parser.add_argument("--port",        type=int, default=7400, help="REST API port")
    parser.add_argument("--observations",default=None, help="JSON observations file (once mode)")
    args = parser.parse_args()

    if args.mode == "daemon":
        _run_daemon(args)
    elif args.mode == "once":
        _run_once(args)
    elif args.mode == "status":
        _run_status(args)


if __name__ == "__main__":
    main()
