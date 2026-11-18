"""Optional Microsoft Agent Framework + Ollama narrative layer.

The deterministic Python agents remain the source of truth. This optional layer
creates one Microsoft Agent Framework Agent per role and asks each to annotate
its verified post. It never has permission to change inventory, supplier, route,
or final-decision fields.
"""
from __future__ import annotations

import json
import os
from typing import Any

from app.data.repository import get_inventory_record, get_route_records, get_supplier_records
from app.agents.inventory_agent import evaluate_stock_cover
from app.agents.route_agent import evaluate_route_options, find_alternative_routes
from app.agents.supplier_agent import estimate_supplier_coverage, find_alternative_suppliers


def _as_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _build_agents() -> dict[str, Any]:
    # Imports are intentionally lazy: the app works without the optional AI packages.
    from agent_framework import Agent, tool
    from agent_framework.ollama import OllamaChatClient

    os.environ.setdefault("OLLAMA_MODEL", os.getenv("NEXUS_OLLAMA_MODEL", "qwen3:4b"))
    client = OllamaChatClient()

    # Monitor tools
    @tool(approval_mode="never_require")
    def lookup_item(sku_id: str) -> str:
        """Look up the affected product in the bundled inventory dataset."""
        return _as_json(get_inventory_record(sku_id))

    @tool(approval_mode="never_require")
    def validate_disruption(disruption_type: str, delay_days: int) -> str:
        """Validate the disruption category and return its operational label."""
        allowed = {"supplier_delay", "route_block", "stockout"}
        return "VALID" if disruption_type in allowed and delay_days >= 0 else "INVALID"

    # Inventory tools
    @tool(approval_mode="never_require")
    def lookup_stock(sku_id: str) -> str:
        """Read current and safety stock from the inventory dataset."""
        return _as_json(get_inventory_record(sku_id))

    @tool(approval_mode="never_require")
    def calculate_stock_gap(current_stock: int, safety_stock: int, required_qty: int) -> str:
        """Calculate demand cover and safety-stock exposure."""
        return _as_json(evaluate_stock_cover(current_stock, safety_stock, required_qty))

    # Supplier tools
    @tool(approval_mode="never_require")
    def list_supplier_options(sku_id: str, primary_supplier_id: str) -> str:
        """Find active alternative suppliers for one SKU."""
        return _as_json(find_alternative_suppliers(sku_id, primary_supplier_id))

    @tool(approval_mode="never_require")
    def calculate_supplier_coverage(sku_id: str, primary_supplier_id: str, shortage_qty: int) -> str:
        """Calculate how available alternatives cover the shortage."""
        options = find_alternative_suppliers(sku_id, primary_supplier_id)
        return _as_json(estimate_supplier_coverage(options, shortage_qty))

    # Route tools
    @tool(approval_mode="never_require")
    def list_open_routes(destination: str, blocked_route_id: str) -> str:
        """Find open routes into a destination, excluding a blocked route."""
        return _as_json(find_alternative_routes(destination, blocked_route_id))

    @tool(approval_mode="never_require")
    def score_route_capacity(destination: str, blocked_route_id: str, required_qty: int) -> str:
        """Filter route options by capacity and rank viable routes."""
        options = find_alternative_routes(destination, blocked_route_id)
        return _as_json(evaluate_route_options(options, required_qty))

    # Coordinator tools: they compare structured, already-verified evidence.
    @tool(approval_mode="never_require")
    def validate_decision_inputs(snapshot_json: str) -> str:
        """Check whether the four worker evidence posts are present."""
        try:
            snapshot = json.loads(snapshot_json)
            required = {"Monitor Agent", "Inventory Agent", "Supplier Agent", "Route Agent"}
            return _as_json({"complete": required.issubset(set(snapshot.get("post_agents", [])))})
        except json.JSONDecodeError:
            return _as_json({"complete": False, "reason": "invalid snapshot JSON"})

    @tool(approval_mode="never_require")
    def explain_decision_guardrails(action: str, stock_covers_demand: bool, route_available: bool, suppliers_cover_gap: bool) -> str:
        """Return the deterministic guardrails that a coordinator must respect."""
        if action == "REORDER":
            valid = suppliers_cover_gap and route_available
        elif action == "REROUTE":
            valid = stock_covers_demand and route_available
        else:
            valid = not (route_available and (stock_covers_demand or suppliers_cover_gap))
        return _as_json({"guardrail_passed": valid, "action": action})

    return {
        "Monitor Agent": Agent(client=client, name="Monitor Agent", instructions="You are the disruption monitor. Use your two tools to verify the SKU and disruption type. Write one concise, factual operational observation. Never invent data.", tools=[lookup_item, validate_disruption]),
        "Inventory Agent": Agent(client=client, name="Inventory Agent", instructions="You are the inventory specialist. Use both tools to verify stock cover and safety-stock exposure. Explain only the verified quantities.", tools=[lookup_stock, calculate_stock_gap]),
        "Supplier Agent": Agent(client=client, name="Supplier Agent", instructions="You are the supplier specialist. Use both tools to inspect alternatives and calculate coverage. Do not promise capacity beyond the tool output.", tools=[list_supplier_options, calculate_supplier_coverage]),
        "Route Agent": Agent(client=client, name="Route Agent", instructions="You are the logistics route specialist. Use both tools to find open routes and validate capacity. Do not use blocked or infeasible routes.", tools=[list_open_routes, score_route_capacity]),
        "Coordinator Agent": Agent(client=client, name="Coordinator Agent", instructions="You are the control-room coordinator. Use both tools to validate evidence and decision guardrails. You may explain the selected rule-based decision but must never change it.", tools=[validate_decision_inputs, explain_decision_guardrails]),
    }


async def enrich_run_with_framework(result: dict[str, Any]) -> dict[str, str]:
    """Run the five optional MAF agents over verified posts and return short annotations."""
    agents = _build_agents()
    annotations: dict[str, str] = {}
    for role, agent in agents.items():
        post = next((item for item in result.get("posts", []) if item["agent"] == role), None)
        if not post:
            continue
        prompt = (
            "Review this verified blackboard post. Use your available Python tools to cross-check the relevant dataset. "
            "Return at most two concise sentences. Do not make a new decision and do not alter any quantities.\n\n"
            + _as_json(post["payload"])
        )
        response = await agent.run(prompt)
        annotations[role] = str(response).strip()
    return annotations
