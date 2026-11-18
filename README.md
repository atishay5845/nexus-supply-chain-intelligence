# NEXUS — Supply Chain Disruption Response Coordinator

**CSE476 · Agentic AI and Intelligent Automation · Q6**

A local-first supply-chain disruption simulator using the assignment's **blackboard architecture**. Five specialist agents post structured evidence to one shared state. The Coordinator compares the evidence and outputs `REORDER`, `REROUTE` or `HOLD`, with a rationale and notification plan.

> **Demo-data notice:** all inventory, supplier and route records are fictional. The application does not connect to live warehouses, suppliers or carriers.

## Deliverables included

- Five separate agent modules, each calling two ordinary Python tools.
- Shared Blackboard, append-only event trace and Coordinator evidence gate.
- FastAPI backend and React + Vite command-centre UI.
- Scenario intake, agent pipeline, structured Blackboard viewer, decision brief, network registry, run history and audit feed.
- CSV/JSON demo datasets, JSON run snapshots and append-only JSONL log.
- Five pytest checks covering supplier delay, route blockage, stockout, insufficient capacity and five-agent participation.
- Runnable `backend/NEXUS_Demo.ipynb` plus architecture diagram (`docs/architecture.png`, `.svg`, `.mmd`).
- Optional Microsoft Agent Framework + Ollama local-model mode. See `docs/LOCAL_AI_SETUP.md`.

## Run locally

**Requirements:** Python 3.11+ and Node.js 20+.

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API: `http://localhost:8000` · Interactive API docs: `http://localhost:8000/docs`

### Frontend (second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### Tests and notebook

From `backend/`:

```bash
pip install pytest
python -m pytest -q
python scripts_run_demo.py
```

Open `backend/NEXUS_Demo.ipynb` in Jupyter to inspect all three scenario traces. Snapshots are stored in `backend/runtime/runs/`; the append-only trace is `backend/runtime/append_only_run_log.jsonl`.

## Agent roster and tools

| Agent | Tool 1 | Tool 2 | Blackboard output |
|---|---|---|---|
| Monitor | `parse_disruption` | `identify_affected_item` | Normalised disruption + affected SKU/site |
| Inventory | `get_stock_level` | `evaluate_stock_cover` | On-hand, safety stock + shortage |
| Supplier | `find_alternative_suppliers` | `estimate_supplier_coverage` | Alternatives, quantities, lead times + cost |
| Route | `find_alternative_routes` | `evaluate_route_options` | Open routes, transit time + capacity |
| Coordinator | `compare_mitigation_options` | `generate_notification_plan` | Decision, rationale + parties to notify |

## Architecture and viva notes

`Disruption report → Monitor → Inventory → Supplier → Route → Coordinator → mitigation + notifications`

Every worker posts to the common Blackboard. The Coordinator waits for all four specialist posts and makes its decision only from those posts. Stock, supplier capacity, lead time, route capacity and cost are computed by deterministic Python tools; the optional language model cannot alter the decision.

- **Why blackboard?** Independent specialists contribute partial evidence to one shared state before a manager makes the decision.
- **Why deterministic tools?** Numeric supply-chain checks should be repeatable, testable and explainable, not guessed by a language model.
- **Where is Microsoft Agent Framework used?** In local-AI mode, five framework `Agent` instances have role-specific instructions and Python tools. They annotate verified posts through Ollama; the Python Coordinator remains authoritative.
- **What happens when the evidence is insufficient?** The Coordinator returns `HOLD` if supplier or route capacity cannot cover the gap.

For the extension roadmap, see `docs/WHAT_TO_ADD_NEXT.md`.
