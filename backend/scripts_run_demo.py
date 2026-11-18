from __future__ import annotations

import json

from app.data.repository import get_scenarios
from app.engine.orchestrator import run_scenario

if __name__ == "__main__":
    scenario = get_scenarios()[0]
    result = run_scenario(dict(scenario))
    print(f"\nNEXUS RUN {result['run_id']}")
    print("=" * 72)
    for event in result["events"]:
        print(f"[{event['agent']:<22}] {event['message']}")
    print("\nFINAL DECISION")
    print(json.dumps(result["decision"], indent=2))
