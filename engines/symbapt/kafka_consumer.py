"""
Engine 11: SymbAPT — Kafka Event Consumer
==========================================

Wraps kafka-python's KafkaConsumer to feed real-time SOC event JSON into the
APTHunter detection pipeline.  The dependency is optional: if kafka-python is
not installed the class can still be imported and instantiated, but calling
start() or start_async() raises an ImportError with install instructions.

Typical deployment
------------------
  from engines.symbapt import KafkaEventConsumer, APTHunter, MitreRuleEngine, SymbAPTConfig

  config  = SymbAPTConfig(kafka_bootstrap=["broker:9092"], kafka_topic="soc-events")
  engine  = MitreRuleEngine(config.event_feature_dim, config.rule_hidden_dim, config.device)
  hunter  = APTHunter(engine, config)
  hunter.load()                          # restore trained weights

  consumer = KafkaEventConsumer(config.kafka_bootstrap, config.kafka_topic)
  thread   = consumer.start_async(hunter, callback=print)
  ...
  consumer.stop()
  thread.join()
"""

from __future__ import annotations

import json
import logging
import threading
from typing import Callable, List, Optional

logger = logging.getLogger(__name__)

# Attempt to import kafka-python at module load time.  We capture the error
# rather than raising immediately so the module can be imported in environments
# where Kafka is not needed (e.g. unit test runners, offline analysis).
try:
    from kafka import KafkaConsumer as _KafkaConsumer
    from kafka.errors import KafkaError as _KafkaError
    _KAFKA_AVAILABLE = True
except ImportError:
    _KAFKA_AVAILABLE = False
    _KafkaConsumer = None  # type: ignore[assignment,misc]
    _KafkaError = Exception  # type: ignore[assignment,misc]

_KAFKA_INSTALL_MSG = (
    "kafka-python is required for KafkaEventConsumer.\n"
    "Install it with:  pip install kafka-python\n"
    "Or add it to requirements.txt and re-run pip install -r requirements.txt"
)


class KafkaEventConsumer:
    """
    Consume SOC events from a Kafka topic and feed them to an APTHunter.

    Parameters
    ----------
    bootstrap_servers : list[str]
        Kafka broker addresses, e.g. ["localhost:9092", "broker2:9092"].
    topic : str
        Kafka topic name carrying raw SOC event JSON.
    group_id : str
        Consumer group ID.  Changing this causes Kafka to replay all
        committed offsets from scratch — useful for back-testing.
    auto_offset_reset : str
        "latest" (default) skips historical messages; "earliest" replays.
    poll_timeout_ms : int
        How long poll() blocks waiting for messages before checking the
        stop flag.  Lower values → faster shutdown, more CPU overhead.
    """

    def __init__(
        self,
        bootstrap_servers: List[str],
        topic: str,
        group_id: str = "symbapt",
        auto_offset_reset: str = "latest",
        poll_timeout_ms: int = 1000,
    ) -> None:
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self.group_id = group_id
        self.auto_offset_reset = auto_offset_reset
        self.poll_timeout_ms = poll_timeout_ms

        self._consumer: Optional[object] = None
        self._stop_event = threading.Event()

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def start(
        self,
        hunter,  # APTHunter — avoid circular import by not type-hinting
        callback: Optional[Callable[[dict], None]] = None,
    ) -> None:
        """
        Block and consume events from Kafka until stop() is called.

        For each message:
          1. Deserialise JSON payload.
          2. Call hunter.ingest_event(event) to run SymbAPT inference.
          3. Invoke callback(result) if provided.
          4. Log APT detections at WARNING level.

        Parameters
        ----------
        hunter : APTHunter
            Fully initialised (and ideally loaded from checkpoint) hunter.
        callback : callable, optional
            Called with the result dict after every processed message.
            Useful for forwarding detections to SIEM / alerting systems.

        Raises
        ------
        ImportError
            If kafka-python is not installed.
        """
        self._require_kafka()
        self._stop_event.clear()

        logger.info(
            "SymbAPT KafkaEventConsumer starting — topic=%s brokers=%s group=%s",
            self.topic,
            self.bootstrap_servers,
            self.group_id,
        )

        self._consumer = _KafkaConsumer(
            self.topic,
            bootstrap_servers=self.bootstrap_servers,
            group_id=self.group_id,
            auto_offset_reset=self.auto_offset_reset,
            value_deserializer=lambda b: b,  # raw bytes; we decode in _process_message
            consumer_timeout_ms=self.poll_timeout_ms,
        )

        try:
            while not self._stop_event.is_set():
                try:
                    # consumer_timeout_ms makes the for-loop non-blocking per batch.
                    for msg in self._consumer:
                        if self._stop_event.is_set():
                            break
                        result = self._process_message(msg, hunter)
                        if result is not None and callback is not None:
                            callback(result)
                        if result and result.get("is_apt"):
                            logger.warning(
                                "APT DETECTED — score=%.3f technique=%s offset=%d",
                                result["apt_score"],
                                result.get("top_technique", "?"),
                                msg.offset,
                            )
                except StopIteration:
                    # consumer_timeout_ms elapsed with no messages; loop again.
                    pass
                except _KafkaError as exc:
                    logger.error("Kafka error: %s — retrying next poll", exc)
        finally:
            self._consumer.close()
            logger.info("SymbAPT KafkaEventConsumer stopped.")

    def start_async(
        self,
        hunter,
        callback: Optional[Callable[[dict], None]] = None,
    ) -> threading.Thread:
        """
        Launch the consume loop in a background daemon thread.

        Returns the Thread object so the caller can join() or check is_alive().

        Parameters
        ----------
        hunter : APTHunter
        callback : callable, optional

        Returns
        -------
        threading.Thread — already started.
        """
        self._require_kafka()
        thread = threading.Thread(
            target=self.start,
            args=(hunter, callback),
            name="symbapt-kafka-consumer",
            daemon=True,
        )
        thread.start()
        logger.info("SymbAPT consumer thread started (daemon=True).")
        return thread

    def stop(self) -> None:
        """
        Signal the consume loop to exit after the current poll completes.
        Does not block — call thread.join() after stop() if you need to wait.
        """
        self._stop_event.set()
        logger.info("SymbAPT KafkaEventConsumer stop requested.")

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    def _process_message(self, msg, hunter) -> Optional[dict]:
        """
        Decode a Kafka message and run APTHunter inference.

        Malformed JSON is logged and skipped (returns None).

        Parameters
        ----------
        msg : kafka.consumer.fetcher.ConsumerRecord
        hunter : APTHunter

        Returns
        -------
        dict — ingest_event result enriched with Kafka metadata, or None on error.
        """
        try:
            raw = msg.value
            event: dict = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.warning(
                "Skipping malformed message at partition=%d offset=%d: %s",
                msg.partition,
                msg.offset,
                exc,
            )
            return None

        result = hunter.ingest_event(event)

        # Enrich with Kafka provenance so downstream consumers know where the
        # detection originated.
        result["_kafka"] = {
            "topic":     msg.topic,
            "partition": msg.partition,
            "offset":    msg.offset,
        }
        return result

    @staticmethod
    def _require_kafka() -> None:
        """Raise a helpful ImportError if kafka-python is absent."""
        if not _KAFKA_AVAILABLE:
            raise ImportError(_KAFKA_INSTALL_MSG)
