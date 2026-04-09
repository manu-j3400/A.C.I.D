"""
SymbAPT server — CLI entry point and REST API.

Modes
-----
stream   : Start Kafka consumer loop.  Exposes Flask REST API on --port.
analyze  : One-shot analysis of a JSON events file, then exit.
status   : Print engine status and exit.

Usage
-----
python -m engines.symbapt.server --mode stream --port 7401
python -m engines.symbapt.server --mode analyze --events /tmp/events.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

logger = logging.getLogger("symbapt.server")


def _build_hunter(args):
    from .config import SymbAPTConfig
    from .mitre_rules import MitreRuleEngine
    from .apt_hunter import APTHunter

    config = SymbAPTConfig()
    if args.config and Path(args.config).exists():
        with open(args.config) as f:
            config = SymbAPTConfig.from_dict(json.load(f))

    engine = MitreRuleEngine(
        feature_dim=config.event_feature_dim,
        hidden_dim=config.rule_hidden_dim,
        device=config.device,
    )
    hunter = APTHunter(rule_engine=engine, config=config)

    if args.checkpoint and Path(args.checkpoint).exists():
        hunter.load(args.checkpoint)
        logger.info("Loaded checkpoint from %s", args.checkpoint)

    return hunter


def _run_stream(args) -> None:
    hunter = _build_hunter(args)

    from .kafka_consumer import KafkaEventConsumer
    from .config import SymbAPTConfig

    config = SymbAPTConfig()
    if args.config and Path(args.config).exists():
        with open(args.config) as f:
            config = SymbAPTConfig.from_dict(json.load(f))

    try:
        from flask import Flask, jsonify, request as flask_request
        app = Flask("symbapt")
        _detections = []

        @app.route("/ingest", methods=["POST"])
        def ingest():
            event = flask_request.get_json(force=True) or {}
            result = hunter.ingest_event(event)
            if result.get("is_apt"):
                _detections.append(result)
            return jsonify(result)

        @app.route("/detections", methods=["GET"])
        def detections():
            return jsonify({"detections": _detections[-100:]})

        @app.route("/status", methods=["GET"])
        def status():
            return jsonify({
                "mode":       "stream",
                "n_detections": len(_detections),
                "threshold":  config.apt_score_threshold,
            })

        import threading

        def _kafka_thread():
            consumer = KafkaEventConsumer(
                bootstrap_servers=config.kafka_bootstrap,
                topic=config.kafka_topic,
                group_id=config.kafka_group_id,
            )
            try:
                consumer.start(hunter, callback=lambda r: _detections.append(r) if r and r.get("is_apt") else None)
            except ImportError as e:
                logger.warning("Kafka not available: %s — REST-only mode", e)

        t = threading.Thread(target=_kafka_thread, daemon=True)
        t.start()
        logger.info("SymbAPT stream mode starting on port %d", args.port)
        app.run(host="0.0.0.0", port=args.port, use_reloader=False)

    except ImportError:
        logger.warning("Flask not available — Kafka-only mode")
        from .kafka_consumer import KafkaEventConsumer
        consumer = KafkaEventConsumer(
            bootstrap_servers=config.kafka_bootstrap,
            topic=config.kafka_topic,
        )
        consumer.start(hunter, callback=lambda r: logger.info("Detection: %s", r))


def _run_analyze(args) -> None:
    hunter = _build_hunter(args)

    events = []
    if args.events and Path(args.events).exists():
        with open(args.events) as f:
            events = json.load(f)
    elif args.events:
        logger.error("Events file not found: %s", args.events)
        sys.exit(1)

    results = [hunter.ingest_event(e) for e in events]
    apts    = [r for r in results if r.get("is_apt")]

    print(json.dumps({
        "total_events": len(events),
        "apt_detections": len(apts),
        "detections": apts,
    }, indent=2))


def _run_status(args) -> None:
    hunter = _build_hunter(args)
    print(json.dumps({
        "engine":    "SymbAPT",
        "threshold": hunter.config.apt_score_threshold,
        "device":    hunter.config.device,
        "checkpoint": hunter.config.checkpoint_path,
    }, indent=2))


def main() -> None:
    logging.basicConfig(
        level   = logging.INFO,
        format  = "%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt = "%Y-%m-%dT%H:%M:%S",
    )

    parser = argparse.ArgumentParser(
        prog        = "symbapt",
        description = "SymbAPT neurosymbolic APT hunter",
    )
    parser.add_argument(
        "--mode", choices=["stream", "analyze", "status"],
        default="stream",
        help="Operating mode (default: stream)",
    )
    parser.add_argument("--config",     default=None, help="JSON config path")
    parser.add_argument("--checkpoint", default=None, help="Model checkpoint path")
    parser.add_argument("--events",     default=None, help="JSON events file (analyze mode)")
    parser.add_argument("--port",       type=int, default=7401, help="REST API port")
    args = parser.parse_args()

    dispatch = {
        "stream":  _run_stream,
        "analyze": _run_analyze,
        "status":  _run_status,
    }
    dispatch[args.mode](args)


if __name__ == "__main__":
    main()
