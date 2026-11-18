from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.ai.framework_runtime import enrich_run_with_framework
from app.core.config import APP_NAME, APP_VERSION, AUDIT_LOG
from app.data.repository import get_inventory_record, get_route_records, get_scenarios, get_supplier_records, read_csv
from app.engine.orchestrator import get_audit_tail, list_runs, read_run, run_scenario

app = FastAPI(title=APP_NAME, version=APP_VERSION, description="Blackboard-driven multi-agent supply-chain disruption simulator.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    scenario_id: str = Field(min_length=3, max_length=40)
    required_qty: int | None = Field(default=None, ge=1, le=100000)
    use_local_ai: bool = False


def _public_inventory() -> list[dict[str, Any]]:
    return [get_inventory_record(row["sku_id"]) for row in read_csv("inventory.csv")]


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "operational",
        "service": APP_NAME,
        "version": APP_VERSION,
        "agent_framework_installed": importlib.util.find_spec("agent_framework") is not None,
        "ollama_connector_installed": importlib.util.find_spec("agent_framework.ollama") is not None if importlib.util.find_spec("agent_framework") else False,
        "audit_log": AUDIT_LOG.name,
        "mode": "DETERMINISTIC + OPTIONAL LOCAL AI",
    }


@app.get("/api/scenarios")
def scenarios() -> list[dict[str, Any]]:
    return get_scenarios()


@app.get("/api/overview")
def overview() -> dict[str, Any]:
    inventory = _public_inventory()
    suppliers = get_supplier_records()
    routes = get_route_records()
    runs = list_runs(10)
    latest = read_run(runs[0]["run_id"]) if runs else None
    stock_value = sum(row["current_stock"] * row["unit_cost_inr"] for row in inventory)
    at_risk = sum(1 for row in inventory if row["current_stock"] < row["safety_stock"])
    active_suppliers = [row for row in suppliers if row["status"].upper() == "ACTIVE"]
    avg_reliability = round(sum(row["reliability_pct"] for row in active_suppliers) / max(1, len(active_suppliers)), 1)
    return {
        "metrics": {
            "inventory_skus": len(inventory),
            "at_risk_skus": at_risk,
            "active_suppliers": len(active_suppliers),
            "supplier_reliability": avg_reliability,
            "open_routes": sum(1 for row in routes if row["status"].upper() == "OPEN"),
            "inventory_value_inr": round(stock_value, 2),
            "total_runs": len(runs),
        },
        "inventory": inventory,
        "runs": runs,
        "latest_run": latest,
        "stock_health": [
            {"warehouse": row["warehouse"], "stock": row["current_stock"], "safety": row["safety_stock"], "sku_id": row["sku_id"]}
            for row in inventory
        ],
    }


@app.get("/api/network")
def network() -> dict[str, Any]:
    return {
        "suppliers": get_supplier_records(),
        "routes": get_route_records(),
        "inventory": _public_inventory(),
    }


@app.post("/api/run")
async def run(request: RunRequest) -> dict[str, Any]:
    choices = {item["scenario_id"]: item for item in get_scenarios()}
    scenario = choices.get(request.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Unknown scenario_id")
    scenario = dict(scenario)
    if request.required_qty is not None:
        scenario["required_qty"] = request.required_qty
        scenario["description"] += f" Requested quantity adjusted to {request.required_qty:,} units for this simulation."
    try:
        result = run_scenario(scenario)
    except (ValueError, RuntimeError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if request.use_local_ai:
        try:
            annotations = await enrich_run_with_framework(result)
            result["ai_annotations"] = annotations
            result["ai_mode"] = "MICROSOFT_AGENT_FRAMEWORK + OLLAMA"
            from app.engine.orchestrator import persist_run
            persist_run(result, append_audit=False)
        except Exception as exc:  # Deterministic result remains valid if optional local AI is unavailable.
            result["ai_warning"] = f"Local AI annotations were skipped: {type(exc).__name__}: {exc}"
            result["ai_mode"] = "DETERMINISTIC FALLBACK"
            from app.engine.orchestrator import persist_run
            persist_run(result, append_audit=False)
    else:
        result["ai_mode"] = "DETERMINISTIC"
    return result


@app.get("/api/runs")
def runs() -> list[dict[str, Any]]:
    return list_runs(50)


@app.get("/api/runs/{run_id}")
def run_detail(run_id: str) -> dict[str, Any]:
    result = read_run(run_id)
    if not result:
        raise HTTPException(status_code=404, detail="Run not found")
    return result


@app.get("/api/audit")
def audit() -> list[dict[str, Any]]:
    return get_audit_tail(100)
