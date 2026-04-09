"""
RLShield server — CLI entry point and REST API.

Modes
-----
daemon    : Live Wazuh integration + continuous ticking.  Flask REST API on --port.
simulate  : Run MAPPO training simulation for --iterations episodes, then exit.
status    : Print current orchestrator status and exit.

Usage
-----
python -m engines.rlshield.server --mode daemon --port 7402
python -m engines.rlshield.server --mode simulate --iterations 200
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

logger = logging.getLogger("rlshield.server")


def _build_orchestrator(args):
    from .config import RLShieldConfig
    from .soc_orchestrator import SOCOrchestrator

    config = RLShieldConfig()
    if args.config and Path(args.config).exists():
        with open(args.config) as f:
            d = json.load(f)
        for k, v in d.items():
            if hasattr(config, k):
                setattr(config, k, v)

    wazuh = None
    if getattr(args, "wazuh", False):
        try:
            from .wazuh_connector import WazuhConnector
            wazuh = WazuhConnector(
                host     = config.wazuh_host,
                port     = config.wazuh_port,
                username = config.wazuh_username,
                password = config.wazuh_password,
                verify_ssl=config.wazuh_verify_ssl,
            )
            if not wazuh.connect():
                logger.warning("Could not connect to Wazuh — continuing without it")
                wazuh = None
        except Exception as exc:
            logger.warning("Wazuh connector failed: %s — continuing without it", exc)

    orch = SOCOrchestrator(config, wazuh=wazuh)

    if args.checkpoint and Path(args.checkpoint).exists():
        try:
            orch.load(args.checkpoint)
            logger.info("Loaded checkpoint from %s", args.checkpoint)
        except Exception as exc:
            logger.warning("Could not load checkpoint: %s", exc)

    return orch


def _run_daemon(args) -> None:
    orch = _build_orchestrator(args)

    try:
        from flask import Flask, jsonify, request as flask_request
        app = Flask("rlshield")
        _recent_responses = []
        _metrics = {"total_alerts": 0, "auto_executed": 0}

        @app.route("/alert", methods=["POST"])
        def ingest_alert():
            alert = flask_request.get_json(force=True) or {}
            response = orch.process_alert(alert)
            _recent_responses.append(response)
            if len(_recent_responses) > 200:
                _recent_responses.pop(0)
            _metrics["total_alerts"] += 1
            if response.get("auto_execute"):
                _metrics["auto_executed"] += 1
            return jsonify(response)

        @app.route("/status", methods=["GET"])
        def status():
            return jsonify({
                "mode":    "daemon",
                "metrics": _metrics,
                "n_agents": orch.config.n_agents,
            })

        @app.route("/metrics", methods=["GET"])
        def metrics():
            return jsonify(_metrics)

        @app.route("/action", methods=["POST"])
        def manual_action():
            """Manually trigger a response for testing."""
            payload = flask_request.get_json(force=True) or {}
            alert   = payload.get("alert", {})
            result  = orch.process_alert(alert)
            return jsonify(result)

        logger.info("RLShield daemon starting on port %d", args.port)
        app.run(host="0.0.0.0", port=args.port, use_reloader=False)

    except ImportError:
        logger.warning("Flask not available — headless mode")
        logger.info("RLShield daemon running. POST alerts via Wazuh integration only.")
        while True:
            time.sleep(60)


def _run_simulate(args) -> None:
    from .config import RLShieldConfig
    from .soc_env import SOCEnvironment
    from .mappo import MAPPOAgent as NewMAPPOAgent, MAPPOTrainer, MAPPOConfig

    config = RLShieldConfig()
    env    = SOCEnvironment(n_agents=config.n_agents)

    mappo_cfg = MAPPOConfig()
    agents    = [
        NewMAPPOAgent(i, env.OBS_DIM, env.N_ACTIONS, mappo_cfg)
        for i in range(config.n_agents)
    ]
    trainer   = MAPPOTrainer(agents, mappo_cfg)

    n_iter    = getattr(args, "iterations", 100)
    n_steps   = 128

    logger.info("Starting MAPPO simulation: %d iterations × %d steps/iter", n_iter, n_steps)
    metrics = trainer.train(env, n_iterations=n_iter, n_steps_per_iter=n_steps)

    # Save checkpoint
    if args.checkpoint:
        trainer.save(args.checkpoint)
        logger.info("Checkpoint saved to %s", args.checkpoint)

    # Print summary
    last = metrics[-1] if metrics else {}
    print(json.dumps({
        "iterations_completed": len(metrics),
        "final_losses": {
            k: round(v, 5) if isinstance(v, float) else v
            for k, v in last.items()
        },
    }, indent=2))


def _run_status(args) -> None:
    orch = _build_orchestrator(args)
    print(json.dumps({
        "engine":     "RLShield",
        "n_agents":   orch.config.n_agents,
        "checkpoint": orch.config.checkpoint_path,
        "device":     orch.config.device,
    }, indent=2))


def main() -> None:
    logging.basicConfig(
        level   = logging.INFO,
        format  = "%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt = "%Y-%m-%dT%H:%M:%S",
    )

    parser = argparse.ArgumentParser(
        prog        = "rlshield",
        description = "RLShield multi-agent MAPPO SOC response orchestrator",
    )
    parser.add_argument(
        "--mode", choices=["daemon", "simulate", "status"],
        default="simulate",
        help="Operating mode (default: simulate)",
    )
    parser.add_argument("--config",     default=None,  help="JSON config path")
    parser.add_argument("--checkpoint", default=None,  help="Checkpoint directory path")
    parser.add_argument("--port",       type=int, default=7402, help="REST API port")
    parser.add_argument("--iterations", type=int, default=100,  help="Simulation iterations")
    parser.add_argument("--wazuh",      action="store_true",    help="Enable Wazuh integration")
    args = parser.parse_args()

    dispatch = {
        "daemon":   _run_daemon,
        "simulate": _run_simulate,
        "status":   _run_status,
    }
    dispatch[args.mode](args)


if __name__ == "__main__":
    main()
