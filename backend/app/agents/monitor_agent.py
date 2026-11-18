from __future__ import annotations

from typing import Any

from app.data.repository import get_inventory_record
from app.engine.blackboard import Blackboard


# Tool 1: normalise and validate the disruption report.
def parse_disruption(raw: dict[str, Any]) -> dict[str, Any]:
    allowed = {"supplier_delay", "route_block", "stockout"}
    disruption_type = str(raw.get("disruption_type", "")).strip().lower()
    if disruption_type not in allowed:
        raise ValueError(f"Unsupported disruption_type: {disruption_type}")
    required_qty = int(raw.get("required_qty", 0))
    if required_qty < 1:
        raise ValueError("required_qty must be at least 1")
    return {
        **raw,
        "disruption_type": disruption_type,
        "sku_id": str(raw.get("sku_id", "")).upper(),
        "required_qty": required_qty,
        "delay_days": int(raw.get("delay_days", 0)),
        "destination": str(raw.get("destination", "")).strip(),
        "blocked_route_id": str(raw.get("blocked_route_id", "")).strip(),
    }


# Tool 2: resolve the reported SKU to a real row in the bundled inventory dataset.
def identify_affected_item(sku_id: str) -> dict[str, Any]:
    item = get_inventory_record(sku_id)
    if not item:
        raise ValueError(f"Unknown SKU: {sku_id}")
    return item


class MonitorAgent:
    name = "Monitor Agent"

    def run(self, board: Blackboard) -> None:
        scenario = parse_disruption(board.scenario)
        item = identify_affected_item(scenario["sku_id"])
        payload = {
            "disruption": scenario,
            "affected_item": item,
            "severity": scenario.get("severity", "HIGH"),
        }
        board.post(
            self.name,
            payload,
            f"Classified {scenario['disruption_type'].replace('_', ' ')} affecting {item['product_name']} at {scenario['destination']}.",
        )
