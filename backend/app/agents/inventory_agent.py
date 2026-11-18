from __future__ import annotations

from typing import Any

from app.data.repository import get_inventory_record
from app.engine.blackboard import Blackboard


# Tool 1: retrieve current stock, safety stock and item economics from CSV.
def get_stock_level(sku_id: str) -> dict[str, Any]:
    record = get_inventory_record(sku_id)
    if not record:
        raise ValueError(f"No inventory record for {sku_id}")
    return record


# Tool 2: calculate the shortfall and whether current stock protects the requested demand.
def evaluate_stock_cover(current_stock: int, safety_stock: int, required_qty: int) -> dict[str, Any]:
    shortage = max(0, required_qty - current_stock)
    usable_after_demand = current_stock - required_qty
    return {
        "shortage_qty": shortage,
        "demand_covered": shortage == 0,
        "below_safety_stock": current_stock < safety_stock,
        "safety_stock_gap": max(0, safety_stock - current_stock),
        "remaining_after_demand": usable_after_demand,
        "cover_pct": round(min(100, (current_stock / required_qty) * 100), 1) if required_qty else 100.0,
    }


class InventoryAgent:
    name = "Inventory Agent"

    def run(self, board: Blackboard) -> None:
        monitor = board.read("Monitor Agent")
        if not monitor:
            raise RuntimeError("Monitor Agent must post before Inventory Agent")
        sku_id = monitor["disruption"]["sku_id"]
        required_qty = monitor["disruption"]["required_qty"]
        stock = get_stock_level(sku_id)
        cover = evaluate_stock_cover(stock["current_stock"], stock["safety_stock"], required_qty)
        payload = {"sku_id": sku_id, "stock": stock, "cover": cover}
        kind = "warning" if cover["shortage_qty"] or cover["below_safety_stock"] else "success"
        board.post(
            self.name,
            payload,
            f"Stock check: {stock['current_stock']:,} on hand against {required_qty:,} required; {cover['shortage_qty']:,} unit gap.",
        )
        if kind == "warning":
            board.event(self.name, "Safety-stock exposure detected.", "warning", {"safety_stock_gap": cover["safety_stock_gap"]})
