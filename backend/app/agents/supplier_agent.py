from __future__ import annotations

from typing import Any

from app.data.repository import get_supplier_records
from app.engine.blackboard import Blackboard


# Tool 1: find alternative suppliers for the affected SKU.
def find_alternative_suppliers(sku_id: str, primary_supplier_id: str) -> list[dict[str, Any]]:
    rows = get_supplier_records(sku_id)
    alternatives = [
        row for row in rows
        if row["supplier_id"] != primary_supplier_id
        and row["status"].upper() == "ACTIVE"
        and row["available_qty"] > 0
    ]
    return sorted(alternatives, key=lambda row: (-row["reliability_pct"], row["lead_time_days"], row["unit_price_inr"]))


# Tool 2: calculate how much of the shortage each supplier can cover.
def estimate_supplier_coverage(suppliers: list[dict[str, Any]], shortage_qty: int) -> dict[str, Any]:
    remaining = max(0, shortage_qty)
    plan: list[dict[str, Any]] = []
    for supplier in suppliers:
        if remaining <= 0:
            break
        allocated = min(remaining, supplier["available_qty"])
        if allocated <= 0:
            continue
        plan.append({
            "supplier_id": supplier["supplier_id"],
            "supplier_name": supplier["supplier_name"],
            "allocated_qty": allocated,
            "lead_time_days": supplier["lead_time_days"],
            "unit_price_inr": supplier["unit_price_inr"],
            "reliability_pct": supplier["reliability_pct"],
            "line_cost_inr": round(allocated * supplier["unit_price_inr"], 2),
        })
        remaining -= allocated
    return {
        "plan": plan,
        "covered_qty": shortage_qty - remaining,
        "uncovered_qty": remaining,
        "fully_covered": remaining == 0,
        "estimated_procurement_cost_inr": round(sum(row["line_cost_inr"] for row in plan), 2),
        "max_lead_time_days": max((row["lead_time_days"] for row in plan), default=0),
    }


class SupplierAgent:
    name = "Supplier Agent"

    def run(self, board: Blackboard) -> None:
        monitor = board.read("Monitor Agent")
        inventory = board.read("Inventory Agent")
        if not monitor or not inventory:
            raise RuntimeError("Monitor and Inventory agents must post before Supplier Agent")
        disruption = monitor["disruption"]
        shortage = inventory["cover"]["shortage_qty"]
        alternatives = find_alternative_suppliers(disruption["sku_id"], disruption["supplier_id"])
        coverage = estimate_supplier_coverage(alternatives, shortage)
        payload = {
            "primary_supplier_id": disruption["supplier_id"],
            "alternatives": alternatives,
            "coverage": coverage,
        }
        board.post(
            self.name,
            payload,
            f"Screened {len(alternatives)} active alternatives; {coverage['covered_qty']:,} of {shortage:,} required units can be covered.",
        )
        if not coverage["fully_covered"]:
            board.event(self.name, f"Supplier capacity leaves {coverage['uncovered_qty']:,} units uncovered.", "warning")
