from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from app.core.config import CSV_DIR


def read_csv(name: str) -> list[dict[str, Any]]:
    """Read one of the bundled demo datasets. Values remain strings at this boundary."""
    safe_name = Path(name).name
    path = CSV_DIR / safe_name
    if path.suffix.lower() != ".csv" or not path.exists():
        raise FileNotFoundError(f"Dataset not found: {safe_name}")
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def as_bool(value: Any) -> bool:
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def get_inventory_record(sku_id: str) -> dict[str, Any] | None:
    for row in read_csv("inventory.csv"):
        if row["sku_id"].upper() == sku_id.upper():
            return {
                **row,
                "current_stock": as_int(row["current_stock"]),
                "safety_stock": as_int(row["safety_stock"]),
                "unit_cost_inr": as_float(row["unit_cost_inr"]),
            }
    return None


def get_supplier_records(sku_id: str | None = None) -> list[dict[str, Any]]:
    rows = read_csv("suppliers.csv")
    if sku_id:
        rows = [row for row in rows if row["sku_id"].upper() == sku_id.upper()]
    return [
        {
            **row,
            "available_qty": as_int(row["available_qty"]),
            "lead_time_days": as_int(row["lead_time_days"]),
            "unit_price_inr": as_float(row["unit_price_inr"]),
            "reliability_pct": as_float(row["reliability_pct"]),
            "is_primary": as_bool(row["is_primary"]),
        }
        for row in rows
    ]


def get_route_records(destination: str | None = None) -> list[dict[str, Any]]:
    rows = read_csv("routes.csv")
    if destination:
        rows = [row for row in rows if row["destination"].lower() == destination.lower()]
    return [
        {
            **row,
            "transit_days": as_float(row["transit_days"]),
            "freight_cost_inr": as_float(row["freight_cost_inr"]),
            "reliability_pct": as_float(row["reliability_pct"]),
            "capacity_units": as_int(row["capacity_units"]),
        }
        for row in rows
    ]


def get_scenarios() -> list[dict[str, Any]]:
    path = CSV_DIR / "scenarios.json"
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)
