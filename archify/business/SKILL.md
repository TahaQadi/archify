---
name: business-operating-model
summary: Extend Archify with POLISM, RACI, access design, controls and business process governance.
---

# Business Operating Model authoring skill

Use this skill for mapping business operations, not source-code architecture.

1. Identify the value proposition and one end-to-end process.
2. Declare reusable roles, staff (when appropriately authorized), locations, information assets, systems, suppliers, capabilities and management systems.
3. Break the process into up to six macro phases. Write granular activities in `steps`, with executor role, location, system and information references.
4. Define main and exception flows; do not invent exception triggers. Every step requires one A and at least one R in RACI.
5. Capture permission design separately from responsibility. Distinguish action, resource, scope, system, approval path and status.
6. Add controls, records required as evidence, KPIs, decision rights, risks, requirements and acceptance criteria.
7. Mark the decision status of every claim: `confirmed`, `proposed`, `client-decision`, `assumed-for-workshop` or `new`. Do not promote a proposed permission or approval to confirmed without evidence.
8. Validate before generating diagrams and reports. Explain significant findings rather than silently correcting them.
9. Generate the offline report and compatible Archify workflow IR with `node archify/business/cli.mjs build <model.json> <output-dir>`.
10. Run the upstream Archify workflow renderer on the IR separately. Report browser/render verification honestly; a valid business model does not guarantee a visually passing workflow render.

Reference: `business.schema.json`, `README.md`, `../../docs/BUSINESS-MODEL-DESIGN.md`, and the generic distribution sample.
