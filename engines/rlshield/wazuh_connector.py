"""
engines/rlshield/wazuh_connector.py

Wazuh SIEM integration via the Wazuh REST API (v4.x).

All public methods degrade gracefully when `requests` is not installed or
when the Wazuh manager is unreachable — they log a warning and return
empty / failure results instead of raising, so the rest of the RLShield
pipeline can continue in a dry-run / simulation mode.

Wazuh API quick reference
--------------------------
POST  /security/user/authenticate   → JWT token (basic-auth)
GET   /alerts                        → paginated alert list
GET   /agents/{agent_id}             → agent metadata
PUT   /active-response               → trigger active-response command
"""

import logging
import time
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Soft-import requests so the module is importable without it installed.
try:
    import requests as _requests
    from requests.auth import HTTPBasicAuth as _BasicAuth
    _REQUESTS_AVAILABLE = True
except ImportError:  # pragma: no cover
    _requests = None          # type: ignore
    _BasicAuth = None         # type: ignore
    _REQUESTS_AVAILABLE = False
    logger.warning(
        "RLShield WazuhConnector: 'requests' package not found. "
        "Connector will operate in simulation mode."
    )


class WazuhConnector:
    """
    Thin HTTP client for the Wazuh REST API.

    Parameters
    ----------
    host        : Wazuh manager hostname / IP
    port        : API port (default 55000)
    username    : API username (default 'wazuh')
    password    : API password
    verify_ssl  : Whether to verify TLS certificates (default False for
                  self-signed lab deployments)
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 55000,
        username: str = "wazuh",
        password: str = "wazuh",
        verify_ssl: bool = False,
    ) -> None:
        self.base_url  = f"https://{host}:{port}"
        self.username  = username
        self.password  = password
        self.verify_ssl = verify_ssl
        self._token: Optional[str] = None
        self._connected: bool = False

    # ---------------------------------------------------------------------- #
    # Internal helpers
    # ---------------------------------------------------------------------- #

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    def _get(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        if not _REQUESTS_AVAILABLE or not self._connected:
            return None
        try:
            resp = _requests.get(
                f"{self.base_url}{endpoint}",
                headers=self._headers(),
                params=params,
                verify=self.verify_ssl,
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.warning("WazuhConnector GET %s failed: %s", endpoint, exc)
            return None

    def _put(self, endpoint: str, json_body: Dict) -> Optional[Dict]:
        if not _REQUESTS_AVAILABLE or not self._connected:
            return None
        try:
            resp = _requests.put(
                f"{self.base_url}{endpoint}",
                headers=self._headers(),
                json=json_body,
                verify=self.verify_ssl,
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.warning("WazuhConnector PUT %s failed: %s", endpoint, exc)
            return None

    # ---------------------------------------------------------------------- #
    # Public API
    # ---------------------------------------------------------------------- #

    def connect(self) -> bool:
        """
        Authenticate with the Wazuh manager and cache the JWT token.

        Returns
        -------
        True  : successfully authenticated
        False : requests unavailable, network error, or bad credentials
        """
        if not _REQUESTS_AVAILABLE:
            logger.warning("WazuhConnector.connect: requests not installed — simulation mode.")
            return False

        try:
            resp = _requests.post(
                f"{self.base_url}/security/user/authenticate",
                auth=_BasicAuth(self.username, self.password),
                verify=self.verify_ssl,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            self._token = data.get("data", {}).get("token")
            if self._token:
                self._connected = True
                logger.info("WazuhConnector: authenticated against %s", self.base_url)
                return True
            logger.warning("WazuhConnector: unexpected auth response: %s", data)
        except Exception as exc:
            logger.warning("WazuhConnector.connect failed: %s", exc)

        return False

    def get_alerts(
        self,
        limit: int = 100,
        severity_min: int = 7,
    ) -> List[Dict]:
        """
        Fetch the most recent alerts with rule.level >= severity_min.

        Returns an empty list when not connected or on any error.
        """
        params = {
            "limit": limit,
            "sort":  "-timestamp",
            "q":     f"rule.level>={severity_min}",
        }
        result = self._get("/alerts", params=params)
        if result is None:
            return []

        alerts: List[Dict] = result.get("data", {}).get("affected_items", [])
        logger.debug("WazuhConnector: retrieved %d alerts", len(alerts))
        return alerts

    def get_agent_info(self, agent_id: str) -> Dict[str, Any]:
        """
        Retrieve metadata for a specific Wazuh agent.

        Returns an empty dict on failure.
        """
        result = self._get(f"/agents/{agent_id}")
        if result is None:
            return {}
        items = result.get("data", {}).get("affected_items", [])
        return items[0] if items else {}

    def execute_active_response(
        self,
        agent_id: str,
        command: str,
        arguments: List[str],
    ) -> Dict[str, Any]:
        """
        Trigger a Wazuh active-response script on the specified agent.

        Parameters
        ----------
        agent_id  : target agent ID (e.g. "001")
        command   : active-response script name registered in ossec.conf
        arguments : list of string arguments passed to the script

        Returns
        -------
        Wazuh API response dict, or {"status": "error"} on failure.
        """
        body = {
            "command":   command,
            "arguments": arguments,
            "alert": {
                "data": {
                    "srcip": arguments[0] if arguments else "0.0.0.0"
                }
            },
        }
        params = {"agents_list": agent_id}
        if not _REQUESTS_AVAILABLE or not self._connected:
            logger.warning(
                "WazuhConnector.execute_active_response: not connected — "
                "dry-run (command=%s, agent=%s)", command, agent_id
            )
            return {"status": "dry_run", "command": command, "agent_id": agent_id}

        try:
            resp = _requests.put(
                f"{self.base_url}/active-response",
                headers=self._headers(),
                json=body,
                params=params,
                verify=self.verify_ssl,
                timeout=15,
            )
            resp.raise_for_status()
            logger.info(
                "WazuhConnector: active-response '%s' dispatched to agent %s",
                command, agent_id,
            )
            return resp.json()
        except Exception as exc:
            logger.warning("WazuhConnector.execute_active_response failed: %s", exc)
            return {"status": "error", "detail": str(exc)}

    def stream_alerts(
        self,
        callback: Callable[[Dict], None],
        poll_interval_s: float = 5.0,
    ) -> None:
        """
        Blocking poll loop that calls *callback* for every new alert.

        Intended to be run in a dedicated thread.  Stops when interrupted
        (KeyboardInterrupt) or when the connector is not available.

        Parameters
        ----------
        callback        : callable receiving a single alert dict per call
        poll_interval_s : seconds between consecutive /alerts polls
        """
        if not _REQUESTS_AVAILABLE:
            logger.warning("WazuhConnector.stream_alerts: requests unavailable — exiting.")
            return

        if not self._connected:
            logger.warning("WazuhConnector.stream_alerts: not connected — call connect() first.")
            return

        seen_ids: set = set()
        logger.info(
            "WazuhConnector: starting alert stream (poll=%.1fs)", poll_interval_s
        )

        try:
            while True:
                alerts = self.get_alerts(limit=50)
                for alert in alerts:
                    alert_id = alert.get("id") or alert.get("_id")
                    if alert_id and alert_id not in seen_ids:
                        seen_ids.add(alert_id)
                        try:
                            callback(alert)
                        except Exception as cb_exc:
                            logger.warning(
                                "WazuhConnector stream callback error: %s", cb_exc
                            )
                time.sleep(poll_interval_s)
        except KeyboardInterrupt:
            logger.info("WazuhConnector.stream_alerts: interrupted — stopping.")
