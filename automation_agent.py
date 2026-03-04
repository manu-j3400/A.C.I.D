"""
Soteria Dual-Loop Autonomous Agent
===================================
Two distinct autonomous workflows for continuous codebase improvement:

1. Reactive Healing Loop  — triggered by Render deploy failure webhooks
2. Proactive Improvement Loop — triggered by cron/GET to work through ROADMAP.md

Both loops enqueue tasks that Cursor executes autonomously on check-in.
No LLM API calls are made here — Cursor is the execution engine.
"""
import os
import re
import time
import hashlib
import threading
from pathlib import Path
from datetime import datetime, timezone

from auto_improver import add_task, get_pending_tasks, queue_summary

ROOT = Path(__file__).resolve().parent
ROADMAP_PATH = ROOT / "ROADMAP.md"


# ══════════════════════════════════════════════════════════════════════════════
# CIRCUIT BREAKER
# Prevents infinite healing loops and token drain.
# Max N triggers per hour per unique error signature.
# ══════════════════════════════════════════════════════════════════════════════

class CircuitBreaker:
    def __init__(self, max_triggers: int = 2, window_seconds: int = 3600):
        self.max_triggers = max_triggers
        self.window_seconds = window_seconds
        self._events: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _error_key(self, error_text: str) -> str:
        """Hash error to a stable key (ignores timestamps/line numbers)."""
        cleaned = re.sub(r'\d+', '', error_text.strip().lower())[:500]
        return hashlib.sha256(cleaned.encode()).hexdigest()[:16]

    def allow(self, error_text: str) -> bool:
        """Return True if this error is allowed to trigger a healing attempt."""
        key = self._error_key(error_text)
        now = time.time()
        with self._lock:
            timestamps = self._events.get(key, [])
            timestamps = [t for t in timestamps if now - t < self.window_seconds]
            if len(timestamps) >= self.max_triggers:
                return False
            timestamps.append(now)
            self._events[key] = timestamps
            return True

    def status(self) -> dict:
        """Return current circuit breaker state for diagnostics."""
        now = time.time()
        with self._lock:
            active = {}
            for key, timestamps in self._events.items():
                recent = [t for t in timestamps if now - t < self.window_seconds]
                if recent:
                    active[key] = {
                        "triggers": len(recent),
                        "max": self.max_triggers,
                        "blocked": len(recent) >= self.max_triggers,
                        "resets_in_seconds": int(self.window_seconds - (now - min(recent)))
                    }
            return active


circuit_breaker = CircuitBreaker(max_triggers=2, window_seconds=3600)


# ══════════════════════════════════════════════════════════════════════════════
# LOOP 1: REACTIVE HEALING
# Listens for Render deploy failure webhooks. Extracts error logs and enqueues
# a healing task for Cursor to fix the build, run tests, and open a draft PR.
# ══════════════════════════════════════════════════════════════════════════════

def handle_render_failure(payload: dict) -> dict:
    """
    Process a Render deploy failure webhook payload.
    Returns a structured response dict with status and task info.

    Expected Render webhook payload shape:
    {
        "type": "deploy",
        "event": "deploy_failed",
        "deploy": {
            "id": "...",
            "status": "build_failed" | "update_failed",
            "commit": {"id": "...", "message": "..."},
            "createdAt": "..."
        },
        "service": {"name": "...", "id": "..."},
        "logs": "...build error output..."   # may need to be fetched separately
    }
    """
    event_type = payload.get("event", "")
    deploy = payload.get("deploy", {})
    service = payload.get("service", {})
    logs = payload.get("logs", "")

    deploy_status = deploy.get("status", "unknown")
    commit_info = deploy.get("commit", {})
    commit_id = commit_info.get("id", "unknown")[:8]
    commit_msg = commit_info.get("message", "unknown")[:120]
    service_name = service.get("name", "unknown")

    if not logs:
        logs = f"Deploy {deploy.get('id', 'unknown')} failed with status: {deploy_status}"

    if not circuit_breaker.allow(logs):
        return {
            "status": "circuit_breaker_open",
            "notification_summary": f"[BLOCKED] Healing suppressed for {service_name} — circuit breaker open (error repeated too often)",
            "message": f"Healing blocked: error seen too many times in the last hour.",
            "error_key": circuit_breaker._error_key(logs),
            "breaker_status": circuit_breaker.status()
        }

    error_excerpt = logs[:2000]

    instruction = (
        f"REACTIVE HEALING TASK — Render deploy failed.\n\n"
        f"Service: {service_name}\n"
        f"Deploy status: {deploy_status}\n"
        f"Failing commit: {commit_id} — {commit_msg}\n\n"
        f"Error logs:\n```\n{error_excerpt}\n```\n\n"
        f"Instructions:\n"
        f"1. Analyze the error logs and identify the root cause.\n"
        f"2. Find and fix the bug in the codebase.\n"
        f"3. Run any available tests to verify the fix.\n"
        f"4. Open a DRAFT Pull Request with the fix. Do NOT auto-merge.\n"
        f"5. Include the original error log excerpt in the PR description."
    )

    task = add_task(
        task_type="reactive_healing",
        scope={"trigger": "render_deploy_failure", "service": service_name},
        quality_gates={"require_tests_pass": True, "allow_only_draft_pr": True},
        metadata={
            "deploy_id": deploy.get("id"),
            "deploy_status": deploy_status,
            "commit": commit_id,
            "event": event_type
        },
        instruction=instruction
    )

    qs = queue_summary()
    return {
        "status": "healing_task_enqueued",
        "notification_summary": (
            f"[HEALING] {service_name} deploy failed ({deploy_status}, commit {commit_id}) "
            f"— task enqueued — {qs.get('pending', 0)} pending, {qs.get('in_progress', 0)} in progress"
        ),
        "task_id": task["id"],
        "service": service_name,
        "deploy_status": deploy_status,
        "commit": commit_id,
        "message": "Cursor will analyze and fix on next check-in.",
        "queue_summary": qs
    }


# ══════════════════════════════════════════════════════════════════════════════
# LOOP 2: PROACTIVE IMPROVEMENT
# Reads ROADMAP.md, selects the highest-priority unassigned task, and enqueues
# it for Cursor to implement, test, and open a draft PR.
# ══════════════════════════════════════════════════════════════════════════════

def parse_roadmap() -> list[dict]:
    """
    Parse ROADMAP.md for actionable tasks.

    Expected format (each task is a checkbox line under a priority header):
        ## P0 — Critical
        - [ ] Task description here
        - [x] Already done task (skipped)

        ## P1 — High
        - [ ] Another task
        - [~] In progress task (skipped)
    """
    if not ROADMAP_PATH.exists():
        return []

    content = ROADMAP_PATH.read_text(encoding="utf-8")
    tasks = []
    current_priority = "P2"

    for line in content.splitlines():
        priority_match = re.match(r'^##\s+(P\d)', line, re.IGNORECASE)
        if priority_match:
            current_priority = priority_match.group(1).upper()
            continue

        task_match = re.match(r'^\s*-\s*\[\s*\]\s+(.+)$', line)
        if task_match:
            description = task_match.group(1).strip()
            tasks.append({
                "priority": current_priority,
                "description": description,
                "raw_line": line
            })

    return tasks


def select_next_task(roadmap_tasks: list[dict]) -> dict | None:
    """Select the highest-priority, unassigned task from the roadmap."""
    pending_instructions = {
        t.get("instruction", "")[:80]
        for t in get_pending_tasks()
        if t.get("task_type") == "proactive_improvement"
    }

    priority_order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    sorted_tasks = sorted(
        roadmap_tasks,
        key=lambda t: priority_order.get(t["priority"], 99)
    )

    for task in sorted_tasks:
        if task["description"][:80] not in pending_instructions:
            return task

    return None


def mark_roadmap_in_progress(task_description: str):
    """Update ROADMAP.md to mark a task as in-progress [~]."""
    if not ROADMAP_PATH.exists():
        return

    content = ROADMAP_PATH.read_text(encoding="utf-8")
    old_pattern = f"- [ ] {task_description}"
    new_pattern = f"- [~] {task_description}"
    if old_pattern in content:
        content = content.replace(old_pattern, new_pattern, 1)
        ROADMAP_PATH.write_text(content, encoding="utf-8")


def handle_proactive_improvement() -> dict:
    """
    Select next roadmap task and enqueue it for Cursor execution.
    Returns structured response dict.
    """
    roadmap_tasks = parse_roadmap()
    if not roadmap_tasks:
        return {
            "status": "no_tasks",
            "notification_summary": "No roadmap tasks found — ROADMAP.md is empty or missing",
            "message": "ROADMAP.md is empty or not found. Nothing to improve."
        }

    selected = select_next_task(roadmap_tasks)
    if not selected:
        qs = queue_summary()
        return {
            "status": "all_assigned",
            "notification_summary": (
                f"All roadmap tasks already assigned — "
                f"{qs.get('pending', 0)} pending, {qs.get('in_progress', 0)} in progress"
            ),
            "message": "All roadmap tasks are already assigned or in progress.",
            "queue_summary": qs
        }

    instruction = (
        f"PROACTIVE IMPROVEMENT TASK — from ROADMAP.md\n\n"
        f"Priority: {selected['priority']}\n"
        f"Task: {selected['description']}\n\n"
        f"Instructions:\n"
        f"1. Analyze the existing Soteria architecture and codebase.\n"
        f"2. Implement this feature/improvement.\n"
        f"3. Ensure it aligns with current codebase analysis standards.\n"
        f"4. Run available tests and fix any failures.\n"
        f"5. Open a DRAFT Pull Request. Do NOT auto-merge.\n"
        f"6. Include a clear description of what was changed and why."
    )

    task = add_task(
        task_type="proactive_improvement",
        scope={"source": "roadmap", "priority": selected["priority"]},
        quality_gates={"require_tests_pass": True, "require_lint_pass": True,
                       "allow_only_draft_pr": True},
        metadata={"roadmap_description": selected["description"]},
        instruction=instruction
    )

    mark_roadmap_in_progress(selected["description"])

    qs = queue_summary()
    return {
        "status": "improvement_task_enqueued",
        "notification_summary": (
            f"[{selected['priority']}] Enqueued: {selected['description'][:100]} "
            f"— {qs.get('pending', 0)} pending, {qs.get('in_progress', 0)} in progress"
        ),
        "task_id": task["id"],
        "priority": selected["priority"],
        "description": selected["description"],
        "message": "Cursor will implement on next check-in.",
        "queue_summary": qs
    }
