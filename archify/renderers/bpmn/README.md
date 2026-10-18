# Native BPMN renderer for Archify — experimental

Native BPMN 2.0 shapes inside **Archify's existing HTML viewer**, not a separate diagram website. Imports source BPMN XML without executing a workflow or changing the original files. The generated IR remains reviewable JSON with original source identity, process IDs, DI coordinates, call references and a ledger for unsupported nested elements.

## Import and render

```bash
python3 archify/renderers/bpmn/import-bpmn.py models/factory.bpmn ./build/bpmn
node archify/renderers/bpmn/render-bpmn.mjs ./build/bpmn/factory_bpmn-Proc_Example.bpmn.json ./build/view.html
node archify/bin/archify.mjs render bpmn ./build/bpmn/factory_bpmn-Proc_Example.bpmn.json ./build/view.html
node --test test/bpmn-native.test.mjs
```

The importer requires Python 3.9+ (stdlib); rendering requires Node 18+ and the existing Archify source tree. One native Archify document is generated per BPMN `process` in a `definitions` file. XML remains the source of record. The importer refuses DTD/ENTITY declarations and inputs above 8 MB, validates every sequence-flow endpoint, verifies call activities resolve to processes in that BPMN file, preserves BPMN element IDs, lane assignment, DI positions, waypoints and source SHA-256, and returns machine-readable process counts.

## Supported shapes

- Events: start, end, intermediate catch/throw, interrupting and non-interrupting boundary; visible markers for timer, message, signal, error, escalation, conditional, link, terminate, compensation and cancellation.
- Activities: ordinary task, user, service, script, manual, send, receive and business-rule task, expanded/collapsed sub-process, transaction and call activity.
- Gateways: exclusive/XOR, inclusive/OR, parallel/AND, event-based and complex.
- Artifacts: data object, data store, text annotation. BPMN participants and lanes use frames when Diagram Interchange bounds are available; deterministic fallback bounds are used otherwise.
- Lines: sequence flow (filled arrow), message flow (dashed line, open arrow, source circle), association/data association (dotted, excluded from native route-reachability graph).

The new renderer puts stable node and directed edge identities into canonical SVG for Archify's shared Finder, focus, route/reach, semantic lens, presentation and export controls. It does not add a new JavaScript viewer, storage surface, authentication feature, or live ERP configuration.

## Important fidelity limitations

- Graph views are **not** executable BPMN. A call activity links to a sibling process view, not an executed process. The source XML is authoritative.
- Nested sub-process contents and cross-view message links need separate drill-down diagrams; importer records `unmapped` IDs and reasons instead of claiming full fidelity. Association is intentionally excluded from process-reachability traversal.
- XML read is semantic and DI-aware but *not* a full BPMN 2.0 XSD or BPMN executable-process conformance validator. Full BPMN import/export round-trip is not provided.
- Diagram Interchange coordinates from source can be crowded; the renderer preserves them, while missing geometry receives deterministic fallback positioning. No enterprise-grade automatic layout optimization is claimed.
- The original interactive Archify viewer is re-used, but browser-based export/focus regression in the **complete upstream template** must pass CI before production use. Unit and standalone Chromium SVG tests are separate evidence.
- Arabic text is escaped and supported as label data; polished RTL typesetting and complete native viewer translation remain follow-up work.
- Generated business records are `unreviewed` by default. A legacy BPMN diagram, including example approval limits, is not an approved QCMC/Raheq company policy.

## Security

Safe XML parsing refuses DTD/entities; all values become XML-escaped SVG text and attributes, IDs are validated, invalid geometry/unknown node kinds are rejected, and generated artifacts retain source digests. The importer never provisions ERP permissions or updates business data.