"""
kafka_pipeline — Kafka streaming pipeline for SymbAPT telemetry ingestion.

Consumes security events from a Kafka topic, normalises them into GraphEvent
objects, feeds them to the APTHunter, and publishes detections to an output
topic.

If kafka-python is not installed the module falls back to a mock consumer
that reads from an in-memory queue, enabling local testing without a broker.
"""

from __future__ import annotations

import json
import logging
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from .neural_engine import EdgeType, GraphEvent

logger = logging.getLogger(__name__)

try:
    from kafka import KafkaConsumer, KafkaProducer  # type: ignore
    _KAFKA_AVAILABLE = True
except ImportError:
    _KAFKA_AVAILABLE = False
    logger.warning("kafka-python not installed — using mock consumer/producer")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass
class KafkaConfig:
    """Kafka connection and topic settings."""
    bootstrap_servers:  str   = "localhost:9092"
    input_topic:        str   = "soteria.telemetry"
    output_topic:       str   = "soteria.detections"
    group_id:           str   = "symbapt-consumer"
    auto_offset_reset:  str   = "latest"
    max_poll_records:   int   = 100
    commit_interval_ms: int   = 5000

    @classmethod
    def from_dict(cls, d: Dict) -> "KafkaConfig":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


# ---------------------------------------------------------------------------
# Telemetry primitives
# ---------------------------------------------------------------------------

@dataclass
class TelemetryEvent:
    """Normalised security telemetry event."""
    event_id:    str
    timestamp:   float
    source_host: str
    event_type:  str        # e.g. "process_create", "network_connect"
    raw_data:    Dict       = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Normaliser
# ---------------------------------------------------------------------------

class TelemetryNormalizer:
    """
    Maps heterogeneous log formats to TelemetryEvent / GraphEvent.

    Supports:
    - Windows Security Event Log (EventID in raw_data)
    - Syslog (facility/severity in raw_data)
    - CEF (deviceEventClassId in raw_data)
    """

    _WINEV_TO_ETYPE: Dict[int, str] = {
        4624: "authentication",
        4625: "auth_failure",
        4688: "process_create",
        4663: "file_access",
        5156: "network_connect",
        7045: "service_install",
    }

    def normalize(self, raw: Dict) -> TelemetryEvent:
        """Parse a raw dict (any supported format) into a TelemetryEvent."""
        ts = float(raw.get("timestamp", time.time()))
        host = str(raw.get("host", raw.get("source_host", raw.get("agent_name", "unknown"))))

        # Windows Event Log
        if "EventID" in raw or "event_id" in raw:
            eid    = int(raw.get("EventID", raw.get("event_id", 0)))
            etype  = self._WINEV_TO_ETYPE.get(eid, f"win_event_{eid}")
        # CEF
        elif "deviceEventClassId" in raw:
            etype = str(raw["deviceEventClassId"])
        # Syslog
        elif "facility" in raw:
            sev = raw.get("severity", 6)
            etype = f"syslog_sev{sev}"
        else:
            etype = str(raw.get("event_type", raw.get("type", "unknown")))

        return TelemetryEvent(
            event_id    = str(raw.get("id", uuid.uuid4().hex)),
            timestamp   = ts,
            source_host = host,
            event_type  = etype,
            raw_data    = raw,
        )

    def to_graph_event(self, event: TelemetryEvent) -> Optional[GraphEvent]:
        """
        Map a TelemetryEvent to a GraphEvent (src_node → dst_node via edge).
        Returns None if the event cannot be represented as a directed edge.
        """
        raw = event.raw_data
        etype = event.event_type

        if etype == "process_create":
            return GraphEvent(
                timestamp   = event.timestamp,
                src_node_id = f"proc_{raw.get('ParentProcessId', raw.get('ppid', 'unknown'))}",
                dst_node_id = f"proc_{raw.get('ProcessId', raw.get('pid', uuid.uuid4().hex[:6]))}",
                edge_type   = EdgeType.EXECUTED,
                features    = {"cmd": raw.get("CommandLine", ""), "host": event.source_host},
            )
        elif etype in ("network_connect", "5156"):
            return GraphEvent(
                timestamp   = event.timestamp,
                src_node_id = f"proc_{raw.get('ProcessId', 'unknown')}",
                dst_node_id = f"net_{raw.get('DestAddress', raw.get('dest_ip', 'unknown'))}_"
                              f"{raw.get('DestPort', raw.get('dest_port', '0'))}",
                edge_type   = EdgeType.CONNECTED_TO,
                features    = {"proto": raw.get("Protocol", "tcp")},
            )
        elif etype == "file_access":
            return GraphEvent(
                timestamp   = event.timestamp,
                src_node_id = f"proc_{raw.get('ProcessId', 'unknown')}",
                dst_node_id = f"file_{raw.get('ObjectName', uuid.uuid4().hex[:8])}",
                edge_type   = EdgeType.READ,
                features    = {},
            )
        elif etype in ("authentication", "auth_failure"):
            return GraphEvent(
                timestamp   = event.timestamp,
                src_node_id = f"user_{raw.get('SubjectUserName', raw.get('user', 'unknown'))}",
                dst_node_id = f"host_{event.source_host}",
                edge_type   = EdgeType.AUTHENTICATED,
                features    = {"success": etype == "authentication"},
            )
        return None


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

class APTKafkaPipeline:
    """
    Consumes telemetry from Kafka, runs APTHunter, publishes detections.

    Parameters
    ----------
    config  : KafkaConfig
    hunter  : APTHunter instance (imported at call-time to avoid circular imports)
    """

    def __init__(self, config: KafkaConfig, hunter) -> None:
        self._cfg        = config
        self._hunter     = hunter
        self._normalizer = TelemetryNormalizer()
        self._running    = False
        self._thread: Optional[threading.Thread] = None
        self._mock_queue: queue.Queue = queue.Queue()

    def start(self) -> None:
        """Begin consuming in a background thread."""
        self._running = True
        self._thread  = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info("APTKafkaPipeline started (kafka=%s)", _KAFKA_AVAILABLE)

    def stop(self) -> None:
        """Signal the consumer thread to stop."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("APTKafkaPipeline stopped")

    def enqueue_mock(self, raw: Dict) -> None:
        """Enqueue a raw event dict for the mock consumer (testing only)."""
        self._mock_queue.put(raw)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _run(self) -> None:
        if _KAFKA_AVAILABLE:
            self._run_kafka()
        else:
            self._run_mock()

    def _run_kafka(self) -> None:
        consumer = KafkaConsumer(
            self._cfg.input_topic,
            bootstrap_servers = self._cfg.bootstrap_servers,
            group_id          = self._cfg.group_id,
            auto_offset_reset = self._cfg.auto_offset_reset,
            enable_auto_commit= True,
            max_poll_records  = self._cfg.max_poll_records,
            value_deserializer= lambda v: json.loads(v.decode("utf-8")),
        )
        producer = KafkaProducer(
            bootstrap_servers  = self._cfg.bootstrap_servers,
            value_serializer   = lambda v: json.dumps(v).encode("utf-8"),
        )
        try:
            while self._running:
                records = consumer.poll(timeout_ms=1000)
                batch: List[Dict] = [
                    msg.value
                    for msgs in records.values()
                    for msg in msgs
                ]
                if batch:
                    detections = self._process_batch(batch)
                    self._publish_detections(detections, producer)
        finally:
            consumer.close()
            producer.close()

    def _run_mock(self) -> None:
        """Fallback consumer reading from in-memory queue."""
        while self._running:
            batch: List[Dict] = []
            try:
                while len(batch) < self._cfg.max_poll_records:
                    batch.append(self._mock_queue.get_nowait())
            except queue.Empty:
                pass
            if batch:
                detections = self._process_batch(batch)
                for d in detections:
                    logger.info("MOCK detection: %s", d)
            time.sleep(0.5)

    def _process_batch(self, messages: List[Dict]) -> List:
        """Normalise messages, feed to hunter, return detections."""
        detections = []
        for raw in messages:
            try:
                tev = self._normalizer.normalize(raw)
                gev = self._normalizer.to_graph_event(tev)
                if gev is not None:
                    self._hunter.ingest_event(gev)
            except Exception as exc:
                logger.warning("Failed to process message: %s", exc)

        try:
            detections = self._hunter.analyze()
        except Exception as exc:
            logger.error("Hunter analysis failed: %s", exc)

        return detections

    def _publish_detections(self, detections: List, producer=None) -> None:
        if not detections or producer is None:
            return
        for det in detections:
            try:
                payload = {
                    "detection_id":  det.detection_id,
                    "confidence":    det.confidence,
                    "kill_chain":    det.kill_chain_stage,
                    "rules_fired":   det.triggered_rules,
                    "timestamp":     det.timestamp,
                }
                producer.send(self._cfg.output_topic, value=payload)
            except Exception as exc:
                logger.error("Failed to publish detection: %s", exc)
