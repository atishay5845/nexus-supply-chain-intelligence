from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.agents.coordinator_agent import CoordinatorAgent
from app.agents.inventory_agent import InventoryAgent
from app.agents.monitor_agent import MonitorAgent
from app.agents.route_agent import RouteAgent
from app.agents.supplier_agent import SupplierAgent
from app.core.config import AUDIT_LOG, RUNS_DIR
from app.engine.blackboard import Blackboard


AGENT_ORDER = [
    (MonitorAgent, "Monitor Agent"),
    (InventoryAgent, "Inventory Agent"),
    (SupplierAgent, "Supplier Agent"),
    (RouteAgent, "Route Agent"),
    (CoordinatorAgent, "Coordinator Agent"),
]


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def persist_run(result: dict[str, Any], append_audit: bool = True) -> None:
    """Persist a run snapshot and append its trace to the immutable JSONL audit log."""
    run_path = RUNS_DIR / f"{result['run_id']}.json"
    _write_json(run_path, result)
    if append_audit:
        with AUDIT_LOG.open("a", encoding="utf-8") as handle:
            for event in result.get("events", []):
                record = {"run_id": result["run_id"], **event}
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
            handle.write(json.dumps({
                "run_id": result["run_id"],
                "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                "agent": "Audit Recorder",
                "message": "Run snapshot committed; source events retained in append-only log.",
                "kind": "audit",
                "details": {"decision": (result.get("decision") or {}).get("action")},
            }, ensure_ascii=False) + "\n")


def run_scenario(scenario: dict[str, Any]) -> dict[str, Any]:
    board = Blackboard(scenario=scenario)
    board.event("System", "Disruption received. Initialising the shared Blackboard.", "info", {"scenario_id": scenario.get("scenario_id")})

    for agent_class, _agent_name in AGENT_ORDER:
        agent = agent_class()
        board.event(agent.name, "Worker started and reading shared state.", "active")
        agent.run(board)

    board.event("System", "All worker posts received. Blackboard state frozen for this decision.", "success")
    result = board.to_dict()
    result["agent_order"] = [name for _, name in AGENT_ORDER]
    result["summary"] = {
        "scenario_title": scenario.get("title", "Custom disruption"),
        "disruption_type": scenario.get("disruption_type"),
        "sku_id": scenario.get("sku_id"),
        "destination": scenario.get("destination"),
    }
    persist_run(result)
    return result


def list_runs(limit: int = 30) -> list[dict[str, Any]]:
    files = sorted(RUNS_DIR.glob("NX-*.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    output = []
    for path in files[:limit]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            output.append({
                "run_id": data["run_id"],
                "created_at": data.get("created_at"),
                "scenario": data.get("summary", {}).get("scenario_title", data.get("scenario", {}).get("title")),
                "action": (data.get("decision") or {}).get("action", "PENDING"),
                "status": (data.get("decision") or {}).get("status", "PENDING"),
                "sku_id": data.get("summary", {}).get("sku_id", ""),
            })
        except (OSError, json.JSONDecodeError, KeyError):
            continue
    return output


def read_run(run_id: str) -> dict[str, Any] | None:
    path = RUNS_DIR / f"{Path(run_id).name}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def get_audit_tail(limit: int = 80) -> list[dict[str, Any]]:
    if not AUDIT_LOG.exists():
        return []
    lines = AUDIT_LOG.read_text(encoding="utf-8").splitlines()[-limit:]
    output = []
    for line in lines:
        try:
            output.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return list(reversed(output))
