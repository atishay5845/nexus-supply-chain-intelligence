from __future__ import annotations

from app.data.repository import get_scenarios
from app.engine.orchestrator import run_scenario


def scenario_by_type(disruption_type: str):
    return next(item for item in get_scenarios() if item["disruption_type"] == disruption_type)


def test_supplier_delay_recommends_reorder():
    result = run_scenario(dict(scenario_by_type("supplier_delay")))
    assert result["decision"]["action"] == "REORDER"
    assert result["decision"]["evidence"]["shortage_qty"] == 380
    assert result["decision"]["selected_supplier_plan"]
    assert result["posts"][-1]["agent"] == "Coordinator Agent"


def test_route_block_recommends_reroute():
    result = run_scenario(dict(scenario_by_type("route_block")))
    assert result["decision"]["action"] == "REROUTE"
    assert result["decision"]["selected_route"]["route_id"] != "RT-W-01"
    assert result["decision"]["evidence"]["stock_on_hand"] >= result["decision"]["evidence"]["required_qty"]


def test_stockout_recommends_supplier_reorder():
    result = run_scenario(dict(scenario_by_type("stockout")))
    assert result["decision"]["action"] == "REORDER"
    assert result["decision"]["evidence"]["shortage_qty"] == 520
    assert result["decision"]["evidence"]["supplier_capacity_qty"] >= 520


def test_all_five_agents_post_to_shared_blackboard():
    result = run_scenario(dict(scenario_by_type("supplier_delay")))
    agent_names = {post["agent"] for post in result["posts"]}
    assert agent_names == {
        "Monitor Agent", "Inventory Agent", "Supplier Agent", "Route Agent", "Coordinator Agent"
    }


def test_insufficient_supply_and_route_capacity_forces_hold():
    scenario = dict(scenario_by_type("supplier_delay"))
    scenario["required_qty"] = 2000
    result = run_scenario(scenario)
    assert result["decision"]["action"] == "HOLD"
    assert result["decision"]["status"] == "HOLD_FOR_REVIEW"
    assert result["decision"]["evidence"]["supplier_capacity_qty"] < 1880
    assert result["decision"]["selected_route"] is None
