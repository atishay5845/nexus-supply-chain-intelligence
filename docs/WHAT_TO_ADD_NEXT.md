# What to add after the first working version

The current release is intentionally a complete, local-first academic demo. Keep its deterministic decision path stable before adding more moving parts.

## Priority 1 — strengthen the academic submission

1. Add a Cost Agent only if the instructor asks for the optional group-of-three extension. Give it two Python tools: calculate the landed cost per option and compare total cost against the stated budget.
2. Add a manual approval gate for `HOLD` decisions. The human should record approve/reject, reviewer note, and timestamp. Never silently convert a held scenario into an approved action.
3. Add a fourth test case where supplier capacity or route capacity is insufficient and the Coordinator must choose `HOLD`.
4. Add a data dictionary and state-transition table to the README or report so every field on the Blackboard is easy to explain in the viva.
5. Capture screenshots for the report: scenario intake, five-agent trace, expanded Blackboard JSON, final decision, supply network and audit log.

## Priority 2 — improve decision quality

- Use a configurable policy file for reorder thresholds, service-level targets, lead-time limits and route scoring weights.
- Add supplier concentration checks, minimum-order quantities, order splitting rules and delivery-window constraints.
- Make safety stock a protected buffer, not just a warning. Add an explicit policy for whether demand may consume safety stock.
- Add scenario versioning and a dataset timestamp so a decision can be reproduced later.

## Priority 3 — connect to external systems

Only after the local demo is reliable, connect a real ERP/inventory source, supplier portal, carrier tracking API or weather/traffic feed. Store credentials in environment variables or a secret manager. Keep external API responses behind Python tools and validate them before posting to the Blackboard.

## Priority 4 — production hardening

Add authentication, role-based approvals, structured logging, rate limits, database-backed run history, a background job queue, metrics/tracing and deployment configuration. The current local JSONL audit log is appropriate for the classroom prototype, not a tamper-proof production audit system.

## Important distinction

The bundled inventory, supplier and route records are fictional demonstration data. The current app does not contact live suppliers, carriers or warehouses. The optional Ollama layer can annotate verified findings, but the deterministic Python Coordinator remains the authority for the final action.
