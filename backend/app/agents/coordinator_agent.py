from __future__ import annotations

from typing import Any

from app.engine.blackboard import Blackboard


# Tool 1: compare feasible mitigation choices using evidence already posted to the blackboard.
def compare_mitigation_options(board: Blackboard) -> dict[str, Any]:
    monitor = board.read("Monitor Agent")
    inventory = board.read("Inventory Agent")
    suppliers = board.read("Supplier Agent")
    routes = board.read("Route Agent")
    if not all((monitor, inventory, suppliers, routes)):
        raise RuntimeError("Coordinator requires all four worker posts")

    disruption = monitor["disruption"]
    stock = inventory["stock"]
    cover = inventory["cover"]
    coverage = suppliers["coverage"]
    selected_route = routes["selected_route"]
    route_available = selected_route is not None
    stock_covers_demand = stock["current_stock"] >= disruption["required_qty"]
    options: list[dict[str, Any]] = []

    if stock_covers_demand and route_available:
        options.append({
            "action": "REROUTE" if disruption["disruption_type"] == "route_block" else "HOLD",
            "feasible": True,
            "reason": "Current inventory covers the immediate requirement; an open delivery route is available." if disruption["disruption_type"] == "route_block" else "Current stock covers demand; avoid unnecessary procurement while the supplier disruption is monitored.",
            "estimated_cost_inr": selected_route["freight_cost_inr"] if disruption["disruption_type"] == "route_block" else 0,
        })

    if cover["shortage_qty"] > 0:
        reorder_feasible = coverage["fully_covered"] and route_available
        options.append({
            "action": "REORDER",
            "feasible": reorder_feasible,
            "reason": (
                f"Alternative suppliers can cover the {cover['shortage_qty']:,}-unit gap and an open route is available."
                if reorder_feasible else "Supplier capacity or route capacity is insufficient to close the inventory gap."
            ),
            "estimated_cost_inr": round(coverage["estimated_procurement_cost_inr"] + (selected_route["freight_cost_inr"] if selected_route else 0), 2),
        })

    if not options:
        options.append({
            "action": "HOLD",
            "feasible": False,
            "reason": "No mitigation path satisfies the supplier-capacity and route-capacity checks.",
            "estimated_cost_inr": None,
        })

    feasible = [option for option in options if option["feasible"]]
    disruption_type = disruption["disruption_type"]
    if not feasible:
        selected = {"action": "HOLD", "feasible": False, "reason": "No complete, evidence-backed mitigation is currently feasible.", "estimated_cost_inr": None}
    elif disruption_type == "route_block":
        selected = next((option for option in feasible if option["action"] == "REROUTE"), feasible[0])
    elif cover["shortage_qty"] > 0:
        selected = next((option for option in feasible if option["action"] == "REORDER"), feasible[0])
    else:
        selected = feasible[0]

    return {
        "options": options,
        "selected": selected,
        "route_available": route_available,
        "stock_covers_demand": stock_covers_demand,
        "shortage_qty": cover["shortage_qty"],
        "coverage": coverage,
        "selected_route": selected_route,
    }


# Tool 2: build a grounded notification list based on the selected action and posted parties.
def generate_notification_plan(board: Blackboard, comparison: dict[str, Any]) -> list[dict[str, str]]:
    monitor = board.read("Monitor Agent")
    supplier_post = board.read("Supplier Agent")
    if not monitor or not supplier_post:
        raise RuntimeError("Notification plan requires monitor and supplier findings")
    decision = comparison["selected"]["action"]
    disruption = monitor["disruption"]
    recipients = [
        {"party": "Warehouse operations", "reason": f"Confirm available stock and protect the {disruption['destination']} allocation."},
        {"party": "Supply planning", "reason": f"Execute the {decision.lower()} decision and update the replenishment plan."},
    ]
    if decision == "REORDER":
        recipients.append({"party": "Procurement", "reason": "Issue the alternative-supplier purchase order and confirm the promised quantity."})
        for row in supplier_post["coverage"]["plan"]:
            recipients.append({"party": row["supplier_name"], "reason": f"Confirm {row['allocated_qty']:,} units and the {row['lead_time_days']}-day lead time."})
    elif decision == "REROUTE":
        recipients.append({"party": "Logistics control", "reason": "Book the selected open route and avoid the blocked corridor."})
    else:
        recipients.append({"party": "Operations lead", "reason": "Approve a hold and review the uncovered supply risk."})
    return recipients


class CoordinatorAgent:
    name = "Coordinator Agent"

    def run(self, board: Blackboard) -> None:
        comparison = compare_mitigation_options(board)
        notifications = generate_notification_plan(board, comparison)
        monitor = board.read("Monitor Agent")
        inventory = board.read("Inventory Agent")
        supplier = board.read("Supplier Agent")
        routes = board.read("Route Agent")
        decision = comparison["selected"]
        selected_route = comparison["selected_route"]
        coverage = comparison["coverage"]

        if decision["action"] == "REORDER":
            supplier_names = ", ".join(row["supplier_name"] for row in coverage["plan"])
            rationale = (
                f"{inventory['stock']['current_stock']:,} units are on hand against {monitor['disruption']['required_qty']:,} required, "
                f"leaving a {comparison['shortage_qty']:,}-unit gap. {supplier_names} can cover the gap, "
                f"and {selected_route['route_id']} is an open route with capacity for the shipment."
            )
        elif decision["action"] == "REROUTE":
            rationale = (
                f"The primary route {monitor['disruption']['blocked_route_id']} is blocked, but current stock "
                f"({inventory['stock']['current_stock']:,}) covers the requirement ({monitor['disruption']['required_qty']:,}). "
                f"Use {selected_route['route_id']} to keep the shipment moving."
            )
        else:
            rationale = decision["reason"]

        estimated_recovery_days = 0
        if selected_route:
            estimated_recovery_days = selected_route["transit_days"]
        if decision["action"] == "REORDER":
            estimated_recovery_days += coverage["max_lead_time_days"]

        final = {
            "action": decision["action"],
            "status": "MITIGATION_READY" if decision["feasible"] else "HOLD_FOR_REVIEW",
            "rationale": rationale,
            "selected_supplier_plan": coverage["plan"] if decision["action"] == "REORDER" else [],
            "selected_route": selected_route,
            "estimated_recovery_days": round(estimated_recovery_days, 1),
            "estimated_total_cost_inr": decision["estimated_cost_inr"],
            "notifications": notifications,
            "options": comparison["options"],
            "evidence": {
                "stock_on_hand": inventory["stock"]["current_stock"],
                "required_qty": monitor["disruption"]["required_qty"],
                "shortage_qty": comparison["shortage_qty"],
                "supplier_capacity_qty": coverage["covered_qty"],
                "route_options_count": len(routes["alternatives"]),
            },
            "decision_mode": "DETERMINISTIC_RULES",
        }
        board.decision = final
        board.post(
            self.name,
            {"comparison": comparison, "decision": final},
            f"Decision: {final['action']} · {final['status'].replace('_', ' ').lower()}.",
        )
        board.event(self.name, "Mitigation decision recorded from Blackboard evidence.", "success" if decision["feasible"] else "warning", {"action": final["action"]})
