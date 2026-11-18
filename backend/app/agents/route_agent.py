from __future__ import annotations

from typing import Any

from app.data.repository import get_route_records
from app.engine.blackboard import Blackboard


# Tool 1: retrieve open route options for the destination, excluding any blocked route.
def find_alternative_routes(destination: str, blocked_route_id: str = "") -> list[dict[str, Any]]:
    rows = get_route_records(destination)
    return [
        row for row in rows
        if row["status"].upper() == "OPEN" and row["route_id"] != blocked_route_id
    ]


# Tool 2: score route feasibility using transit time, reliability and available capacity.
def evaluate_route_options(routes: list[dict[str, Any]], required_qty: int) -> list[dict[str, Any]]:
    evaluated = []
    for route in routes:
        feasible = route["capacity_units"] >= required_qty
        score = (route["transit_days"] * 0.45) + ((100 - route["reliability_pct"]) * 0.12) + (route["freight_cost_inr"] / 10000 * 0.15)
        evaluated.append({
            **route,
            "feasible": feasible,
            "route_score": round(score, 3),
        })
    return sorted(
        [row for row in evaluated if row["feasible"]],
        key=lambda row: (row["route_score"], row["freight_cost_inr"]),
    )


class RouteAgent:
    name = "Route Agent"

    def run(self, board: Blackboard) -> None:
        monitor = board.read("Monitor Agent")
        if not monitor:
            raise RuntimeError("Monitor Agent must post before Route Agent")
        disruption = monitor["disruption"]
        routes = find_alternative_routes(disruption["destination"], disruption["blocked_route_id"])
        evaluated = evaluate_route_options(routes, disruption["required_qty"])
        payload = {
            "destination": disruption["destination"],
            "blocked_route_id": disruption["blocked_route_id"],
            "alternatives": evaluated,
            "selected_route": evaluated[0] if evaluated else None,
        }
        board.post(
            self.name,
            payload,
            f"Evaluated {len(routes)} open routes; {len(evaluated)} can carry the required {disruption['required_qty']:,} units.",
        )
        if not evaluated:
            board.event(self.name, "No open route can carry the required quantity.", "warning")
