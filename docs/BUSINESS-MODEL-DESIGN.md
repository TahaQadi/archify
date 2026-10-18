# Business Operating Model Studio — Design and integration notes

## Intent

Preserve Archify as a portable, source-backed diagram engine. Add a business semantic model above its workflow IR, not an unrelated graphics editor or an operational ERP. A single model should answer who performs a step, where, in which system, with which authority, under what controls, and how the work adds value.

## The relationships that matter

| Business foundation | Canonical source | Links |
| --- | --- | --- |
| Value proposition | `valueProposition` | Processes, capabilities |
| POLISM — Processes | `processes[]` | Phases, steps, flows, RACI, metrics |
| POLISM — Organisation | `entities.roles`, `entities.people`, `assignments[]` | Process executor, approver, site and team |
| POLISM — Locations | `entities.locations[]` | Person assignments and activity locations |
| POLISM — Information | `entities.information`, `entities.systems` | Activity inputs, outputs and systems |
| POLISM — Suppliers | `entities.suppliers[]` | External relationships (detailed links planned) |
| POLISM — Management systems | `entities.managementSystems` | Decision rights, KPIs, controls |
| Permission design | `permissions[]` | Roles, systems, resources, actions, scopes and approver |
| RACI | `processes[].raci[]` | Step ID, A/R/C/I roles |
| Risk and implementation backlog | `risks[]`, `requirements[]` | Process, owner, treatment or acceptance criteria |

RACI responsibility is **not** authorization. Process ownership is **not** the same as approval authority. Being assigned to a warehouse does **not** automatically grant write access to that warehouse's stock ledger. These are separate relationships in the model and must remain separate in any ERPNext adapter.

## Current boundaries

`model.mjs` checks referential integrity, task RACI, flow main paths and several governance anomalies; `business.schema.json` documents authoring grammar. `compile.mjs` emits Archify workflow v2 objects using only supported mode schema fields. `report.mjs` creates a self-contained HTML operating-model reader with a six-part POLISM view, activity/role/phase matrix, role allocations, RACI matrix, permission matrix, decision rights, controls, KPI and risk registers. `cli.mjs` validates models and exports the report, JSON IR, CSV registers and diagnostics.

The generated workflow JSON is intentionally separate from the underlying business model. Never embed unregistered model-specific fields into Archify `workflow.schema.json`: doing so breaks its strict `additionalProperties: false` contract.

## Implementation order after the prototype

1. **Normalize and govern facts.** Persist stable IDs, status, evidence link, revision history, effectivity and approvals before encouraging wide adoption. Preserve proposed/unapproved rules rather than silently treating them as policy.
2. **Add interactive authoring.** Select a process step in the Archify viewer to inspect its role, warehouse/site, input/output documents, permission checks, control evidence and relevant RACI row. Editing must update the canonical model and regenerate derived views.
3. **Fit-gap and ERPNext mapping.** Create typed mappings to DocTypes, workflow states, Role Permissions, User Permissions and approval rules. Export a dry-run change plan, never grant ERP permissions merely because a visual model says so.
4. **Expand diagram levels.** Cross-functional value chain → detailed process → activity passport → SOP and implementation stories. Support BPMN import/export only with explicit notices for unsupported semantics.
5. **Add evidence and outcomes.** Track execution and handoff timestamps, exceptions, ownership conflicts, SLA targets, resource load and KPI actuals with provenance rather than invented benchmark numbers.

## Privacy and security

The included distribution sample is fictional. Real employee lists, commercial contracts, individual delivery sites, access roles and permission rules should be held in a private repository unless deliberately approved for publication. The HTML report escapes authored text and does not use external scripts or services. CSV exports guard against formula injection, but recipients still need correct sharing controls.

## Upstream relationship

Source project: `tt-a1i/archify`, version inspected: 3.1.0, MIT licensed. No upstream source file is replaced by this overlay. Follow the upstream contribution and test guidance if integrating the extension into the public project.
