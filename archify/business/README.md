# Business Operating Model Studio — Archify extension

A semantic layer for Archify 3.1.x. **This is an add-on, not a replacement for the upstream diagram engine.** It introduces one governed business operating model and produces (a) compatible Archify workflow JSON diagrams and (b) an offline HTML operating model report.

## Capabilities in this prototype

- **POLISM:** Processes, Organisation, Locations, Information, Suppliers, Management systems, linked through IDs instead of duplicated free text.
- **Process hierarchy:** processes, phases (up to six per single Archify workflow), operational steps, flow paths, decision and exception branches, named executors and location/system assignments.
- **People & accountability:** employees, role assignments, organizational units, named process owners, RACI per step (exactly one A; at least one R).
- **Permissions:** modeled role/resource/action/scope/system permissions, explicit approval dependencies, warnings when steps reference permissions not granted to their responsible role.
- **Controls & decisions:** control owners, evidence requirements, affected activities, approver/proposer/backup roles.
- **Operating model foundations:** capability reference, KPIs, input/output information lineage, supplier dependencies and management routines.
- **Governance:** all model statuses retain their meaning (`confirmed`, `proposed`, `client-decision`, `assumed-for-workshop`, `new`); validate references; fail closed on incomplete RACI and incorrect main paths.
- **Editable native viewer (opt-in `--studio`):** the original Archify workflow SVG, semantic selection, relationship passport, camera and exports remain active. Selecting an SVG activity opens a side inspector for steps, role assignments, RACI, locations, systems, permissions and transitions. Explore a linked, navigable relationship neighborhood without duplicating entity definitions. The inspector supports JSON import/export, undo/redo, add/remove with referential-integrity checks, and a live review tab.
- **Visuals:** portable HTML business report with six POLISM cards, operational steps, RACI, permissions, controls, decisions and findings; compatible workflow JSON for Archify's interactive HTML engine.

## How to use (from repository root)

```bash
node archify/business/cli.mjs validate archify/examples/business/distribution-fulfillment.json
node archify/business/cli.mjs build archify/examples/business/distribution-fulfillment.json business-out --studio
node archify/bin/archify.mjs finalize workflow business-out/order_to_delivery.workflow.json business-out/order_to_delivery.html --quality standard --json
node --test test/business-model.test.mjs
```

`build` creates `business-operating-model.html`, `order_to_delivery.workflow.json` and `validation.json`. With `--studio`, it also invokes the original Archify workflow renderer and creates `order_to_delivery.html` with a self-contained edit inspector. Without `--studio`, the CLI preserves the prior read-only build behavior and you may render/finalize workflow diagrams separately using Archify. A Studio edit is **draft JSON only**: export the updated source model, rebuild the SVG/HTML with `--studio`, and inspect its new geometry before publication. Do not expect visual node positions or paths to update until recompilation.

## Source-of-truth structure

`entities` defines reusable people, roles, units, locations, suppliers, systems, information assets, management systems and capabilities. `assignments` joins people to roles, units and sites. `processes[].steps` refers to reusable IDs, while `raci[]` gives responsibility per step. `permissions[]` records the *designed* resource/action rights, not active ERP permissions. Controls and decisions link back to processes and steps. Each modeled fact should declare a requirement status.

### Important limitations

1. **No live ERPNext integration or security provisioning.** `permissions[]` is design documentation, not a real Frappe Role Permission Manager or User Permissions write. Deployment requires explicit mappings, reviews and staging tests.
2. **Archify schema limitations remain.** Its workflow renderer supports up to six columns. Group complicated E2E value streams into six phases or create multiple level-of-detail processes. The compiler preserves steps, branches and named executors, but Archify remains a diagram renderer rather than an executable BPMN engine.
3. **Browser edits are local drafts.** The business report remains read-only; the optional native-viewer Studio is editable. The viewer keeps its original interactions; the editor is injected only into the Studio output, not the shared viewer template. The editor does not write files automatically, modify GitHub or ERP, synchronize across processes, re-layout SVG live, provide collaboration, implement approval signatures, or persist server-side. Use Export JSON and rebuild; there is a browser warning on exit while unsaved. If edited and then switched to another generated diagram, the edits will not follow automatically.
4. **Status is not evidence.** An item marked `confirmed` is only user-authored. Review the source and obtain management sign-off before adopting a model as governed truth.
5. **Sample is illustrative.** Warehouse release approval, role grants, and permission scopes are proposals/client decisions, not established policy.
6. **Arabic is report-ready with RTL layout, not a complete Archify viewer translation.** Additional authored translations would be needed for full Arabic reader controls.

## Proposed next increments

- Typed JSON Schema and migrations, cross-process value-stream maps, decision registers linked to change requests.
- Deeper interactive editing: multi-process shared drafts, revision comparison, approval signatures, effective dates, formal change traceability, and live diagram re-layout without server-side renderer.
- Frappe/ERPNext import/export adapter (doctype mappings, role permissions, workflow transitions, audit-only dry run).
- Simulation for handoffs, cycle time, bottlenecks and resource utilization using measured data and declared assumptions.
- Versioned SOP/PDF exports, control-testing evidence, and BPMN 2.0 import/export (preserving semantics).

## Licensing

Archify is MIT licensed. Retain the original `LICENSE` and notices when applying the extension to a fork. The extension is also offered under the same MIT terms.

## Export files

The `build` command also exports `raci.csv`, `permissions.csv`, and `steps.csv` for review in spreadsheets. CSV fields are quoted and values beginning with spreadsheet formula prefixes are neutralized before export. These exports contain draft design data, not approved ERP security configuration.
