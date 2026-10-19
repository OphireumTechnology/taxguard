# AI workforce audit: definitions versus governed, executable agents (2026-10-19)

Read from `src/ai/registry.ts`, `src/ai/commissioningMatrix.ts`, `src/server/ai/{capabilities,gateway,governance,orchestration,review,documents}`
and the `src/tests/ai*` suites. **No agent was activated or commissioned.**

## What exists

| Layer | State | Evidence |
|---|---|---|
| Registry | 61 agents (A00–A60) in 9 categories: supervisor 1, client services 4, document intelligence 7, accounting 5, tax intelligence 15, risk and QC 4, sign, file and resolve 7, practice operations 8, governance, security and platform 10. **All DRAFT**, with no model, no prompt, and a token and cost budget of 0. | `src/ai/registry.ts`, `aiRegistryFoundation.test` |
| Named agents | 13 have specific names: A00 Supervisor / Orchestrator, A05 Document Intake, A06 Classification, A07 OCR / Extraction, A08 Extraction Validation, A10 Duplicate / Fraud Check, A11 Evidence, A18 Federal Tax Analysis, A19 State Tax Analysis, A28 Calculation Verification, A30 Form Mapping, A31 Diagnostics, A34 Reviewer Support. The other 48 are placeholders ("Exact specialized name requires the missing approved architecture mapping"). | registry descriptions; traceability scope ("absent per-ID page-9 mapping") |
| Governance plane | Control plane, kill switch (with an emergency-stop panel), SQL governance store, commissioning matrix and records, control-centre read service | `aiGovernanceControlPlane`, `aiKillSwitchActivation`, `aiCommissioningMatrix`, `aiCommissioningRecords`, `aiControlCenterRead` |
| Gateway | Governed gateway, model and prompt resolver, OpenAI adapter, structured output, usage accounting; SQL gateway store | `aiGovernedGateway` |
| Executable capabilities | **Two, both read-only and bounded:** `workflow.read` (one row, stage and status only) and `document.read` (up to 10 rows of evidence metadata). Each has a schema-validated output, a timeout, and row and byte limits. | `CapabilityRegistry.ts`, `aiGovernedCapabilities`, `aiGovernedCapabilitiesPersistence` |
| Orchestration | A00 orchestrator with a SQL orchestration ledger and canonical routing (bounded compatibility) | `aiA00Orchestration`, `aiExecutionLedger` |
| Human review | Human proposal review and material-action preparation: AI output becomes a proposal that a human decides on, re-checked against live case assignments and staff assignments under row locks | `aiHumanProposalReview`, `aiMaterialActionPreparation` |
| Advisory | Document duplicate advisory (metadata only) | `aiDocumentDuplicateAdvisory` |

## Classification

- **Functional and governed:** the governance plane, the gateway, the two read capabilities, A00 orchestration
  (bounded), human proposal review and the duplicate advisory. All are tested. None can write a material record,
  file, refund, transfer funds or disclose data outside the requester's scope.
- **Definitions only:** all 61 registry entries as executable agents. No agent has a model, prompt or budget, and
  DRAFT does not authorize execution.
- **Blocked:**
  - 48 placeholder agents need the approved architecture mapping (page-9 per-ID mapping, owner input) before they
    can be specified. Inventing names or responsibilities would not be faithful to the product.
  - 58 agents are classified "requires human policy or regulatory approval" in the traceability record.
  - No provider is commissioned, and no budget or kill-switch policy is approved for production.

## Bounded packages that are safe without new approvals

1. **Capability coverage tests per named agent.** Assert that each of the 13 named agents is denied every
   capability its commissioning-matrix row does not grant. Deny is the default; this adds regression protection,
   not authority.
2. **Prompt-injection regression.** Retrieved document text containing instructions must not change the
   capability, scope or output schema. Extend `aiGovernedCapabilities` with injected evidence content.
3. **Engagement and year scope for the capability reads.** `document.read` and `workflow.read` should follow the
   same engagement and year scope as the Phase 14 database functions (`taxguard_staff_scope`) for the requesting
   human. To be verified next, with a failing-first test if they do not.

Anything that gives an agent new write, external or financial authority is a protected gate.
