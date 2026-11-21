# TaxGuard 18-stage gate requirement matrix (LEGACY_18_V1)

**Status: reference compilation, 2026-11-22 (Issue #65, Block 3).** This document invents no requirement. Every entry
restates an existing, version-controlled source (listed per stage), or is marked **OWNER DECISION** where the sources
leave the policy open. Proposals in `docs/proposed-migrations` are REVIEW ONLY and are not applied to any hosted
database. Where a function has several definitions, the current one is the last in
`docs/development/migration-execution-order.json`.

## The authoritative engine

Stage moves are decided by PostgreSQL, never by the browser.

**Path.** `POST /api/cases/:caseId/advance` → `CaseStore.advance` → `taxguard_case_advance`.
- **Defined in:** proposal 026, `20261012260000_taxguard_case_workflow.sql`, its only definition.
- **Function properties:** `SECURITY DEFINER`, executed by the service role only.

**What the browser may send:** the stage it believes is active, the case version it read, and, for human-attested stages
only, the reviewer's checklist confirmations and a statement of 10–1000 characters. Any other field in the request
(`passed`, `requirementsMet`, `checks`, `gateResult`, …) is ignored. Every check is computed or verified inside the
function's transaction.

**Common rules, enforced inside one transaction for every stage:**
1. **Actor.** An active human member of the case's tenant and team (`taxguard_case_actor`, current definition 20261018090000, case assignment liveness). AI actors cannot call these functions.
2. **Locking and order.** The case row is locked (`FOR UPDATE`). Then:
   - the version must match, otherwise `CASE_VERSION_CONFLICT`;
   - the case must be `ACTIVE`, otherwise `CASE_NOT_ACTIVE` (a hold blocks);
   - `fromStage` must equal the active stage, otherwise `STAGE_SEQUENCE_INVALID` (no skipping, no replay).
3. **Stage policy** (`taxguard_case_stage_policy`, the single policy table):
   - **SYSTEM_VERIFIED:** computed by `taxguard_case_system_checks`. The actor must be the case's preparer or reviewer, or a manager or administrator.
   - **HUMAN_ATTESTED:** only the case's reviewer, who must not be the preparer, otherwise `STAGE_ATTESTATION_REQUIRES_REVIEWER`. Each checklist item must be confirmed, and `taxguard_case_evidence_checks` adds computed evidence.
   - **BLOCKED:** refused with `STAGE_BLOCKED_<dependency>` for everyone.
4. **Gate failure.** Any failed check raises `STAGE_GATE_NOT_MET` and lists the failed checks. Nothing is written.
5. **On success, in the same transaction:**
   - the stage becomes `COMPLETED`, with `approved_by` and `gate_evidence` (type, checks, statement);
   - the next stage becomes `IN_PROGRESS`;
   - the case version is incremented;
   - an `ADVANCED` row is added to the append-only `taxguard_case_stage_events`;
   - `CASE_STAGE_ADVANCED` is written to `taxguard_audit_log`.
6. **Rejection and hold** (`taxguard_case_return`, `taxguard_case_set_hold`):
   - only the reviewer or a manager may return a case, and never its preparer, otherwise `STAGE_RETURN_REQUIRES_REVIEWER`;
   - a return needs a reason and an earlier target stage; the stages from the target onward reopen;
   - holds and returns are versioned and recorded the same way.

**Retired paths (D1).** These accepted, or acted on, browser-supplied verdicts, and now answer 410 in every environment:
- `POST /api/case-authority/.../stages/:stage/evaluate` and `.../transition`;
- `POST /api/practice-console/gate-approval`;
- `POST /api/stage-two-three/gates/stage-{2,3}/evaluate`.

`POST /api/live-workflow/complete-stage` refuses with 409 `STAGE_GATE_REQUIRED`. The process-local case-authority adapter
and its snapshot-based gate functions (`stage*ServerGate.ts`) remain for unit tests only. No route lets a request supply
their input.

**Approved policy source:** the stage evidence policy in proposal 026 and its follow-ups (031, 20261018030000,
20261018050000, 20261018180000), recorded in the master traceability matrix as STAGE-01-GATE … STAGE-18-GATE. Proposal
026 states that the policy needs owner confirmation (decision register); that confirmation is still listed as open in
`docs/development/phase11-owner-decisions.md`.

## Stage matrix

Every stage shares these rules, so the per-stage tables omit them:
- **Exit** means the requirements met and `taxguard_case_advance` succeeding.
- **Audit** always records the stage event and the audit log entry described above.
- **Failure** always includes `CASE_VERSION_CONFLICT`, `CASE_NOT_ACTIVE` and `STAGE_SEQUENCE_INVALID`.

### 01 Onboard (SYSTEM_VERIFIED)

| Field | Requirement |
|---|---|
| Purpose | Establish the client, engagement, tax year and an independent case team. |
| Required records | <ul><li>An active `taxguard_clients` row</li><li>An active `taxguard_engagements` row</li><li>An active `taxguard_tax_years` row for the case's engagement and year</li><li>`taxguard_staff_assignments` (status `ACTIVE`) naming the case's preparer as `preparer` and its reviewer as `reviewer`</li><li>A completed and approved client onboarding (`taxguard_onb_client_ready`, proposal 20261018030000)</li></ul> |
| Supporting documents | None checked by this gate. |
| Evidence / validation | `clientActive`, `engagementActive`, `taxYearActive`, `preparerAssigned`, `reviewerAssigned`, `independentReviewer` (preparer ≠ reviewer), `clientOnboardingCompleted` |
| Authorized roles | Case preparer or reviewer, practice manager, administrator. |
| Reviewer approval | None at the gate. Onboarding approval is a separate staff decision (durable onboarding store). |
| Entry | Case created (`taxguard_case_create`); stage 01 `IN_PROGRESS`. |
| Failure | `STAGE_GATE_NOT_MET` with the failed checks; `STAGE_ACTION_NOT_AUTHORIZED`. |
| External dependencies | None. |
| Open | **OWNER DECISION:** consent sufficiency (IRC § 7216 wording) and identity verification are not part of this gate (STAGE-01-PRODUCT). |

### 02 Collect (HUMAN_ATTESTED)

| Field | Requirement |
|---|---|
| Purpose | Collect the documents the case needs, in private storage. |
| Required records | <ul><li>No required `taxguard_doc_requests` row `OPEN` or `SUBMITTED` for the client, engagement and year</li><li>No `taxguard_documents` row `UPLOAD_PENDING` or `SCAN_PENDING`</li></ul> |
| Supporting documents | The documents named by required document requests (resolved or waived). |
| Evidence | Reviewer confirms `documents_received_or_waived` and `documents_in_private_storage`; computed: `requiredDocumentRequestsResolved`, `noDocumentsAwaitingScan` |
| Authorized roles | The case's reviewer only; never the preparer, a manager or an administrator. |
| Reviewer approval | The attestation is the approval. |
| Entry | Stage 01 completed. |
| Failure | `STAGE_ATTESTATION_REQUIRES_REVIEWER`, `STAGE_ATTESTATION_INCOMPLETE`, `STAGE_GATE_NOT_MET` |
| External dependencies | Malware scanning provider (scan status); private document storage. |
| Open | **OWNER DECISION:** professional certification adapter for Stage 02/03 (phase11-owner-decisions). Verified private vault and clean malware transport are not commissioned (STAGE-02-PRODUCT). |

### 03 Validate (HUMAN_ATTESTED)

| Field | Requirement |
|---|---|
| Purpose | Review collected documents for completeness and settle machine-proposed values. |
| Required records | <ul><li>Stage 02 conditions still hold</li><li>No document `PENDING_REVIEW`</li><li>No current document with an outstanding `REPLACEMENT_REQUESTED`</li><li>No undecided `taxguard_extracted_data` proposal on the current version of a usable document (20261018180000)</li></ul> |
| Supporting documents | The reviewed (`VERIFIED`) documents of the case. |
| Evidence | Reviewer confirms `documents_reviewed_for_completeness` and `discrepancies_recorded_or_resolved`; computed: `requiredDocumentRequestsResolved`, `noDocumentsAwaitingReview`, `noDocumentsAwaitingScan`, `noOutstandingReplacementRequests`, `noUndecidedExtractionProposals` |
| Authorized roles | The case's reviewer only. |
| Reviewer approval | The attestation is the approval. Extraction decisions are separate staff decisions. |
| Entry | Stage 02 completed. |
| Failure | As stage 02. |
| External dependencies | OCR provider (proposals only, never values). |
| Open | **OWNER DECISION:** proposal 20261018180000 asks the owner to confirm that undecided extraction proposals block Validate rather than Collect. Verified OCR transport is not commissioned (STAGE-03-PRODUCT). |

### 04 Record (SYSTEM_VERIFIED)

| Field | Requirement |
|---|---|
| Purpose | Record the year's transactions in the ledger. |
| Required records | At least one `POSTED` `taxguard_ledger_entries` row dated in the tax year. |
| Supporting documents | None checked by this gate. |
| Evidence / validation | `postedEntries`, `noEntriesAwaitingReview` (no `PREPARED` entry), `ledgerBalanced` (posted debits = credits in cents) |
| Authorized roles | As stage 01. |
| Reviewer approval | Each journal entry is approved under ledger maker-checker (proposal 024), not at the gate. |
| Entry | Stage 03 completed. |
| Failure | `STAGE_GATE_NOT_MET` (failed checks listed); `STAGE_ACTION_NOT_AUTHORIZED` |
| External dependencies | None (the accounting sync providers are not commissioned and are not required). |
| Open | Reviewed-fact adapter and lineage are not built (STAGE-04-PRODUCT). |

### 05 Reconcile (SYSTEM_VERIFIED)

| Field | Requirement |
|---|---|
| Purpose | Reconcile bank activity with the ledger. |
| Required records | <ul><li>At least one `CLOSED` `taxguard_ledger_reconciliations` row for the year</li><li>None `IN_PROGRESS`</li><li>Every `taxguard_ledger_bank_transactions` row of the year linked to a journal entry</li></ul> |
| Supporting documents | Bank statements, as recorded by the reconciliation. |
| Evidence / validation | `closedReconciliation`, `noReconciliationInProgress`, `allBankTransactionsPosted`, `noEntriesAwaitingReview` |
| Authorized roles | As stage 01. |
| Reviewer approval | Reconciliation finalization rules (proposal 024). |
| Entry | Stage 04 completed. |
| Failure | As stage 04. |
| External dependencies | None required. |
| Open | Independent human reconciliation controls (STAGE-05-PRODUCT). |

### 06 Review (HUMAN_ATTESTED)

| Field | Requirement |
|---|---|
| Purpose | Independent review of workpapers. |
| Required records | <ul><li>An `APPROVED` `taxguard_b2t_workpapers` row for the client, tax year and return family (approved under book-to-tax maker-checker, proposal 029)</li><li>No `PREPARED` ledger entry in the year</li></ul> |
| Supporting documents | The approved workpaper. |
| Evidence | Reviewer confirms `workpapers_reviewed` and `no_unresolved_blocking_exceptions`; computed: `noEntriesAwaitingReview`, `approvedWorkpaperRecorded` |
| Authorized roles | The case's reviewer only. |
| Reviewer approval | The attestation, plus the workpaper's own approval. |
| Entry | Stage 05 completed. |
| Failure | As stage 02. |
| External dependencies | None. |
| Open | Durable professional decisions and form lineage (STAGE-06-PRODUCT). |

### 07 Report (HUMAN_ATTESTED)

| Field | Requirement |
|---|---|
| Purpose | Reports reviewed for release. |
| Required records | None computed beyond the attestation. |
| Supporting documents | Not specified by the sources. |
| Evidence | Reviewer confirms `reports_reviewed_for_release`. |
| Authorized roles | The case's reviewer only. |
| Reviewer approval | The attestation. |
| Entry | Stage 06 completed. |
| Failure | As stage 02. |
| External dependencies | None. |
| Open | **OWNER DECISION:** which recorded report artefacts must exist before attestation. The sources name none, so none is invented (STAGE-07-PRODUCT). |

### 08 Plan (HUMAN_ATTESTED)

| Field | Requirement |
|---|---|
| Purpose | Planning considerations documented. |
| Required records | None computed beyond the attestation. |
| Supporting documents | Not specified by the sources. |
| Evidence | Reviewer confirms `planning_considerations_documented`. |
| Authorized roles | The case's reviewer only. |
| Reviewer approval | The attestation. |
| Entry | Stage 07 completed. |
| Failure | As stage 02. |
| External dependencies | None. |
| Open | **OWNER DECISION:** recorded planning artefacts and the commissioned advisory policy (STAGE-08-PRODUCT). |

### 09 Prepare Taxes (BLOCKED: `VERIFIED_TAX_ENGINE_REQUIRED`)

| Field | Requirement |
|---|---|
| Purpose | Prepare the return from approved conclusions. |
| Built, governed modules (none can advance the stage) | <ul><li>Tax sources and rule sets (033), verified and approved by a second person and pinned by hash</li><li>Calculation runs with reviewer-only approval</li><li>Tax conclusions (Block 66), preparer drafts, independent reviewer decides</li><li>Deterministic form mapping (Block 67)</li><li>Return versions and verifications</li><li>Return diagnostics (Block 70)</li><li>Risk assessment (Block 71)</li><li>Quality control by a third person (Block 72)</li></ul> |
| Authorized roles | Refused for everyone (`STAGE_BLOCKED_VERIFIED_TAX_ENGINE_REQUIRED`). |
| External dependencies | An approved, licensed federal/state rule pack. TaxGuard ships no tax rules. |
| Open | **OWNER / QUALIFIED TAX PROFESSIONAL DECISION** (phase11-owner-decisions): approved tax sources, independent professional review per rule set. Until then, real calculations and stages 9–18 stay blocked. |

### 10 Approve (BLOCKED: `UPSTREAM_STAGES_BLOCKED`)

| Field | Requirement |
|---|---|
| Purpose | Final professional authorization of a return version. |
| Built module | Stage 10 final authorization (Block 73): <ul><li>authority `RETURN_FINAL_AUTHORIZATION`, whose policy must require verified eligibility, a designation and the case assignment;</li><li>an authorizer independent of the preparer, the reviewer, QC and the assigning managers;</li><li>a recent AAL2 session;</li><li>no policy is seeded, so every authorization is refused.</li></ul> |
| Authorized roles | Refused at the case gate for everyone. |
| Open | **OWNER DECISION:** the PREPARER → independent REVIEWER → authorized CPA/EA attestation chain (STAGE-10-PRODUCT; phase11-owner-decisions, AI-16). |

### 11 Sign (BLOCKED: `E_SIGNATURE_INTEGRATION_REQUIRED`)

| Field | Requirement |
|---|---|
| Purpose | Taxpayer signature. |
| Built module | Signature package preparation without signing (Block 74): <ul><li>authority `RETURN_SIGNATURE_RELEASE`;</li><li>the releaser is not the preparer;</li><li>a recent AAL2 session;</li><li>the owner's approved consent text;</li><li>none of these is seeded, so every release is refused.</li></ul> |
| External dependencies | An e-signature provider (not commissioned). No wet-sign substitute is inferred. |
| Open | **OWNER DECISION:** signature consent text and the provider. |

### 12 File (BLOCKED: `FILING_NOT_AUTHORIZED`)

| Field | Requirement |
|---|---|
| Purpose | Transmission to the tax authority. |
| External dependencies | Authorized transmitter credentials and an approved package. |
| Open | **OWNER DECISION:** filing is not authorized. Production filing must not be activated. |

### 13–18 Government Feedback, Resolve, Monitor, Archive, Renew, Repeat (BLOCKED: `UPSTREAM_STAGES_BLOCKED`)

| Stage | Purpose | Open dependency (master matrix) |
|---|---|---|
| 13 Government Feedback | Receipt handling | Verified receipt transport and durable association (external infrastructure). |
| 14 Resolve | Notices and responses | Authoritative notice evidence and an independent professional response. |
| 15 Monitor | Status, deadlines, SLAs | Verified status, deadline and SLA providers. |
| 16 Archive | Retention | Archive verification, approved retention and legal-hold policy (**OWNER DECISION**), storage commissioning. |
| 17 Renew | Engagement renewal | Scoped engagement and consent renewal by an authorized human. |
| 18 Repeat | Annual rollover | Rollover contract; no prior-year facts or expired consent promoted. The case cannot advance past 18 (`STAGE_SEQUENCE_INVALID`). |

## Verification

| Check | Where |
|---|---|
| Fabricated verdicts, missing evidence, unauthorized preparer, cross-tenant and cross-client access, reviewer bypass, stale revisions, duplicate and concurrent transitions, suspended membership, blocked stages 9–17, API-role manual override, append-only history, transaction rollback, hold | `src/tests-db/stageGateEngineSecurity.db.test.ts` (PostgreSQL) |
| Missing provider configuration and session order | `src/tests/casesProviderConfiguration.test.ts` |
| Retired verdict routes | `src/tests/stageGateEvaluationSecurity.test.ts`, `src/tests/practiceConsoleGateApprovalRetirement.test.ts`, `src/tests/stageGateSnapshotRetirement.test.ts`, `src/tests/caseAuthorityProductionDurability.test.ts` |
| Stage-specific evidence | `caseOnboardingGate.db.test.ts` (01), `caseValidateExtractionEvidence.db.test.ts` (03), `caseWorkpaperEvidence.db.test.ts` (06), `caseWorkflowHttp.test.ts` (HTTP workflow) |

## Owner decisions this matrix depends on (not decided here)

1. Confirmation of the proposal 026 stage evidence policy (decision register).
2. Stage 02/03 professional certification adapter, and the stage at which extraction proposals must be decided.
3. Artefacts required before the Stage 07 and 08 attestations.
4. Approved tax sources and rule packs (stages 9–18), reviewed by a qualified tax professional.
5. The Stage 10 attestation chain and the eligibility, designation and assignment policy.
6. Signature consent text and the e-signature provider (stage 11); filing authorization (stage 12).
7. Retention and legal-hold policy (stage 16); IRC § 7216 consent wording (stage 01).
