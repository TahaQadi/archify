# Research and integration contract — Archify for business operating models

Status: **RESEARCH / ARCHITECTURE BASELINE — not an implementation completion claim**  
Reviewed: 2026-10-18  
Targets: Al Qadi/QCMC and Raheq operating models, ERPNext implementation, and portable business-process documentation.  
Source revision: `TahaQadi/archify@b25142deac4b19b293e45b6bf6d69351d3c8f3b6` (upstream-aligned main at research start).  
Previous prototype: draft PR #1, `feature/business-operating-model-studio`, not production ready.

## Decision

Extend **Archify's native renderers and viewer**, not an independent business HTML report. Maintain a governed business knowledge graph with stable IDs, business-source references and explicit statuses. Project that graph into the relevant *existing* Archify JSON IR modes. For BPMN, preserve the original BPMN 2.0 XML as source-of-record; a native Archify workflow is a communicative projection, not a lossless BPMN replacement. A separate BPMN-compliant viewer may be used for exact BPMN semantics, but it must link to the same records and must not replace Archify's native viewer.

**Source inputs before example design**:
- Raheq BPMN library: [Drive folder](https://drive.google.com/drive/folders/1HIshV8H1S6J406Q6js5W8T_kM5LuCMlV) — end-to-end master, Bizagi overview, production routing, RM procurement, HR/Job Card, intercompany and finance.
- ERP configuration snapshot: [Drive folder](https://drive.google.com/drive/folders/1xcucJa9E9fl_Rjc2b2_YalRnFvp6ZJbs) — setup files, static configuration, source manifest and team confirmation workbook.
- [Configuration readme](https://drive.google.com/file/d/1vpO26m1sEYf8AMicmtKLz-y7lvSe_h7c/view): explicitly **existing design awaiting team confirmation**, not approved configuration.
- Additional current-state interviews and the October manufacturing discovery baseline must be reconciled *before* reclassifying any older BPMN policy as confirmed. Do not presume August design decisions supersede later client discovery.

## 1. Archify-native capabilities and business mapping

| Native component | Existing source or interface | Business application | Parity acceptance |
| --- | --- | --- | --- |
| Architecture | `archify/renderers/architecture` / `architecture.schema.json` | POLISM/value-delivery chain, organizational boundaries, sites, suppliers, business application/system dependencies | business identity, exact directed links, authored boundaries; no inferred relationships |
| Workflow v2 | `archify/renderers/workflow` / `workflow.schema.json` | human/ERP swimlanes, transactions, handoffs, exception routes | all projected steps/flows accounted for; main path and branch direction validated; no silent drop |
| Sequence | `archify/renderers/sequence` | customer–sales–warehouse–driver–supplier–ERP messages/handovers | message order, actors, synchronous/async meaning preserved |
| Dataflow | `archify/renderers/dataflow` | request, supplier PO, warehouse receipt, inventory, invoice and financial data lineage | every movement has a typed business information object and sensitivity/ownership |
| Lifecycle | `archify/renderers/lifecycle` | sales, purchasing, quality, production, carton and intercompany document states | transitions, gates, retry/reject/wait outcomes authored and checked |
| Tree | `archify/renderers/tree` | capabilities, org units, site hierarchy and decomposition of processes | exact single-parent containment; expandable hierarchy; no fictitious containment |
| ERD | `archify/renderers/erd` | actual ERPNext DocTypes, reference fields, document linkage and traceability | actual schema-backed fields/keys, no invented physical columns |
| Class/interface | `archify/renderers/class` | documented APIs, Frappe DocType interfaces, event contracts and extension points | interfaces and methods sourced from actual technical contracts, not RACI-as-classes |
| Timeline | `archify/renderers/timeline` | implementation milestones and **timestamped** operational incidents | event provenance and timing classification |
| Waterfall | `archify/renderers/waterfall` | work/wait durations from actual logs, delivery cycle-time breakdown | measured spans identified; hypothetical examples explicitly illustrative |

**Not every business model should force all ten views**: generate a mode only where the source graph contains the matching semantics. The system must report “unsupported / unmeasured / no source evidence” when appropriate.

### Existing viewer parity (must be reused, not rebuilt)

- Finder and stable-ID focus: `viewer/node-finder.js`, `viewer/focus.js`.
- Semantic Passport and authored adjacency: `viewer/focus.js`.
- Upstream/downstream closure: `viewer/focus.js`. Label this **graph reachability**, not real operational impact.
- Exact directed route probe: `viewer/route-probe.js`.
- One- and two-kind Semantic Lens: `viewer/semantic-lens.js`; business kinds need truthful authored semantics, not aliases such as “decision = security”.
- Radar/map and camera: `viewer/semantic-radar.js`, `viewer/viewer-camera.js`.
- Story/chapter guided views and deep links: `viewer/guided-views.js`; `meta.views` max 5 in current common schema.
- Expand/collapse: `viewer/tree-branches.js` on Tree diagrams.
- Bounded motion and presentation: `viewer/motion-governor.js`, main template.
- Canonical PNG/SVG/JPEG/WebP/WebM and route/reach share cards: `viewer/export.js`; transient focus/route state must not leak into canonical diagrams.
- Multi-theme, offline, accessibility, print: shared `viewer/template.source.html` and generated `archify/assets/template.html`.
- Validation, geometry reports, atomic write, browser evidence, last-good preview: `archify/bin/archify.mjs`, `renderers/shared`, `archify/bin/preview.mjs`.
- Source links: existing `repository-evidence.mjs` verifies **Git repository** paths/lines pinned to a commit. It does **not** by itself verify Google Drive policies or signatures. Business documents need their own source-manifest/evidence contract.
- Architecture Delta compares architecture snapshots; there is **no evidence** of an equivalent built-in business process revision comparer. Do not claim cross-mode delta parity until implemented.

## 2. Direct audit of the current draft extension

`archify/business/cli.mjs` currently writes a **separate** `business-operating-model.html` plus workflow JSON; it never calls Archify's `finalize` or builds interactive native artifacts itself. `compile.mjs` emits Workflow only, and uses engineering categories (e.g. decision => security), which mislabels business meaning. The workflow schema's six ranks are confused with a business model's allowed phase count. Cross-mode relation IDs, source evidence, visualization parity and cross-diagram navigation are not implemented. A sample process does not prove the existing QCMC/Raheq procedures.

The prototype’s six unit tests establish limited model-validation behavior, **not** native viewer parity, browser export correctness, full BPMN compatibility, or a real ERPNext fit-gap. PR #1 must remain **draft/unmerged** until this is repaired. Do not publish the old companion report as an implementation of Archify's full capabilities.

## 3. Grounded BPMN corpus and required lossless inventory

These are counts inspected directly from the files, not inferred topology:

| BPMN source | Processes | Lanes | Activities | Sequence flows | Special objects |
| --- | ---: | ---: | ---: | ---: | --- |
| `Raheq_E2E_Full_Collaboration.bpmn` | 9 | 20 | 47 | 74 | 8 Call Activities; 6 exclusive + 4 parallel gateways; 1 boundary event |
| `Raheq_Manufacturing_Process.bpmn` | 1 | 5 | 19 | 29 | 4 exclusive gateways; 1 boundary event |
| `06_F3_Production_Execution_Routing.bpmn` | 1 | 3 | 7 | 11 | parallel split/join |
| `03_RM_Sourcing_QCMC_Intercompany.bpmn` | 1 | 3 | 3 | 6 | supplier versus QCMC sourcing decision |
| `02_HR_Attendance_JobCard_WO.bpmn` | 1 | 2 | 3 | 4 | HRMS and ERPNext handoff |
| `Raheq_E2E_SinglePool_For_Bizagi.bpmn` | 1 | 1 | 6 | 9 | RM re-check loop |

The BPMN sources are older than the October discovery material. Their presence does not prove current/approved business policy. Store diagram source path, original BPMN ID and XML digest, capture date, model status, owner and review evidence separately.

### BPMN import rules

1. Use a standards-aware parser such as [bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) (MIT); do not parse production BPMN using regex or an ad hoc task-name split. Preserve untouched XML as the exact process source.
2. Read `definitions`, `process`, `collaboration`, `participant`, `laneSet`, `flowNodeRef`, events, task kinds, gateways, sequence/message flows, call references, `documentation`, conditional and boundary events.
3. Resolve `calledElement` in its definitions context; missing references are hard diagnostics. Message flows connect separate participants under BPMN semantics.
4. Preserve every original element ID in a source mapping table. Each projected native view must expose a manifest of represented IDs, omitted IDs and the **reason** a native Archify mode cannot represent something. No silently dropped nodes, gateways, or cycles.
5. A full semantic BPMN preview can use [bpmn-js](https://bpmn.io/toolkit/bpmn-js/) beside native Archify artifacts; the bpmn.io license requires an intact visible watermark. Do not treat the renderer as a standards-compliant workflow execution engine.
6. Archify workflows are six **logical columns** per single view: split by logical subprocess/value-chain level and link drill-down views. Never discard later stages to fit six columns. Loop, parallel fork/join and interrupts should be shown with documented abstractions, or with the exact BPMN viewer where fidelity is essential.

## 4. Canonical business model (one graph, multiple native projections)

Canonical entities: organization, company, department, role, person, assignment, location/site/warehouse, supplier/partner, business capability, value stream, process/subprocess, BPMN element, business event, activity, decision/rule, document/data object, ERPNext DocType, ERP application, permission grant, approval authority/delegation, control, risk, KPI, SOP, requirement, implementation test, and evidence/source.

Canonical relations are **typed**, e.g. `performs`, `accountableFor`, `consultedOn`, `locatedAt`, `usesSystem`, `createsRecord`, `readsRecord`, `approvesTransition`, `dependsOn`, `follows`, `providedBy`, `controlledBy`, `implementedBy`, `evidencedBy`. Generic `connectedTo` is not sufficient. Every relation has origin, optional confidence, explicit source and review status. IDs must remain stable across projected views and versions.

POLISM is an **operating-model organization around the value-delivery chain**, not six artificial diagram sections. It covers Processes, Organisation, Locations, Information, Suppliers and Management systems.

Distinct semantics, distinct fields:
- RACI describes accountability for an **activity**; not system authorization.
- ERPNext `Role Permission Manager`, `User Permissions`, field permission levels and document workflow transitions constrain **access**, not business accountability.
- Approval matrix records authority, threshold, conditions, document/state, delegate, segregation-of-duties and fallback; RACI A does not imply permission to approve.
- `CONFIRMED`, `PROPOSED`, `CLIENT DECISION`, `ASSUMED FOR WORKSHOP`, `NEW` must remain distinct. Document statuses and ERP workflow states use separate enumerations.
- Current, proposed, target, retired and superseded model versions are distinct from requirement-confirmation statuses; never overwrite the prior source of truth.
- ERPNext mapping is **dry run** before any target-system updates and must be verified against exact DocTypes, fields, roles and installed application versions.

## 5. Native viewer extension seam

Do **not** introduce a second UI/engine. Add a typed, optional Business Passport data sidecar and an explicit extension seam to the **existing** node-focus Passport: business entity ID, role, performer, RACI, location, source/provenance, effective status, document, permission, control, decision and owner, with click-through to related native maps. Use safe embedded JSON; never create untrusted HTML or executable bindings from imported business labels.

Keep `data-node-id` and `data-edge-from`/`data-edge-to` as the canonical traversal identity so Finder/Focus/Reach/Route continue to work. Distinguish a process-sequence edge from business-association edges so route traversal never conflates “reports to”, “has access to” and “then”. Add explicitly selected business-kind lenses only from authored kinds. Respect keyboard operation, RTL/Arabic, contrast, source identity and clean exports.

A workspace index is navigation, not an alternate dashboard: `Operating model → value stream → process → activity → role/location/ERPNext objects`. Each view is a normal `archify/bin/archify.mjs finalize` artifact with independent receipts, native deep links and correct provenance.

## 6. Verification matrix and acceptance gates

| Gate | Test/definition | Pass criterion |
| --- | --- | --- |
| Source fidelity | BPMN import corpus, element IDs, relationships, subprocess calls, branches and loops | zero silent loss; unsupported constructs explicitly reported |
| Business semantics | canonical graph references, POLISM, RACI, SoD, permissions, threshold approvals | no invented rights; contradictory/incomplete status visible and blocked when relevant |
| Native projection | each relevant native IR schema + `validate` + `finalize` | actual renderer-generated HTML and receipts, not only JSON |
| Viewer parity | Browser tests for Finder, Passport, Reach, Route, Lens, Radar, chapters, keyboard, export | same behavior as upstream on authored business nodes and edges |
| Source links | Drive-document manifest and Git-pinned code evidence, version/digest and review owner | provenance survives projection and is not misrepresented as cryptographic approval |
| Multi-view IDs | source entity -> projected node/edge -> detail page -> original source | repeatable links, stable IDs, no forked duplicates |
| Real QCMC example | Receiving/picking/dispatch warehouse process; people and places; approval and evidence status | no placeholders passed as approved facts |
| Raheq example | master BPMN + source split processes + intercompany decision | all call references, branches and status caveats accounted for |
| ERPNext adapters | role permission, User Permission, Workflow State/Transition, DocType/field mappings | read-only/validated dry-run; no privilege-granting writes |
| Localization | Arabic authoring and viewer controls, RTL and PDF/export consistency | browser-verified Arabic, not just translated labels |
| Temporal views | Timeline/Waterfall | backed by actual timestamps or explicitly hypothetical |
| Regression | existing Archify suite, `check:viewer`, generated validators, native export checks | no degradation of upstream modes or viewer contract |

### Implementation order (gated)

**A. Preserve/source.** Build source manifest, BPMN parser and canonical semantic graph with statuses and exact ID provenance. Confirm corpus parity before visual work.

**B. Native projectors.** Native Archify workflow, architecture, tree and lifecycle projections, then sequence, dataflow, ERD/class (when technical evidence exists), then timeline/waterfall (only with real timing). Each calls existing `finalize`; no second HTML renderer.

**C. Viewer integration.** Business Passport, typed relationship lenses, cross-view deep links, Arabic catalogs and reader/export regression tests against the shared Viewer.

**D. Governance/delta.** Versioned model comparison, source status, change register, approval and separation-of-duties reviews. Existing architecture-only delta must not be falsely advertised as a generic model differ.

**E. ERPNext implementation.** Map approved activities to DocTypes, actual permissions, workflows, documentation and automated tests. Generate staged configuration plans, not unreviewed live changes.

**F. Operational verification.** Pilot Issam's warehouse/purchasing/delivery workflow and Raheq's WO-to-batch and intercompany handoffs with named reviewers; capture acceptance receipts per view.

## 7. Research references

- Upstream: https://github.com/tt-a1i/archify ; `viewer/README.md`, `archify/references/viewer-runtime.md`, `archify/SKILL.md`, ten mode schemas and renderers.
- OMG BPMN 2.0.2: https://www.omg.org/spec/BPMN/
- OMG DMN 1.5: https://www.omg.org/spec/DMN/1.5/
- Open Group ArchiMate 3.2: https://www.opengroup.org/certifications/archimate ; mind specification licensing before copying model-language material.
- NIST RBAC and SoD: https://csrc.nist.gov/Projects/Role-Based-Access-Control/faqs
- ERPNext permissions: https://docs.frappe.io/erpnext/permissions
- ERPNext workflow transitions: https://docs.frappe.io/erpnext/workflows
- BPMN importer: https://github.com/bpmn-io/bpmn-moddle
- BPMN exact browser viewer license: https://github.com/bpmn-io/bpmn-js/blob/develop/LICENSE

## Explicit boundaries

Research uses the source copies accessible on 2026-10-18; a complete latest-document reconciliation, running upstream browser CI, live ERPNext state inspection, business signoff and cross-view implementation are **not yet completed**. This document specifies what the application must preserve; it is not evidence that PR #1 currently does it.
