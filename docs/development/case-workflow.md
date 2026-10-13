# Durable tax case management and the canonical 18-stage workflow (Module 4)

**PRODUCTION STATUS: NO-GO.** Proposal 026 is **not applied**. `/api/cases` is development-only (same gate as `/api/practice`; absent from `createProductionApp`). No tax return is prepared, approved, signed or filed. Synthetic data only.

## Model

Existing tables `taxguard_cases`, `taxguard_case_assignments`, `taxguard_stage_states` are reused; stage identities stay **LEGACY_18_V1** (01 Onboard … 18 Repeat, unchanged). Added: `return_family`, `hold_reason`, `UNIQUE(tenant_id, case_id)`, append-only `taxguard_case_stage_events`, and `case_id` on engagement notes.

A case is created for an **active** engagement year from its ACTIVE preparer and reviewer assignments (proposal 025); preparer ≠ reviewer; one case per (client, engagement, tax year); creation by a practice manager or the assigned preparer; the case ID is derived from the idempotency key.

## Stage evidence policy (single SQL function `taxguard_case_stage_policy`)

| Stages | Evidence | Who | Checks |
| --- | --- | --- | --- |
| 01 Onboard | SYSTEM_VERIFIED | preparer, reviewer or manager | client, engagement and tax year active; assigned preparer and reviewer; independent reviewer |
| 02 Collect, 03 Validate, 07 Report, 08 Plan | HUMAN_ATTESTED | **case reviewer only** | stage checklist fully confirmed + statement (10–1000 chars) |
| 04 Record | SYSTEM_VERIFIED | as 01 | ≥ 1 posted ledger entry in the year, none awaiting review, posted debits = credits |
| 05 Reconcile | SYSTEM_VERIFIED | as 01 | ≥ 1 closed reconciliation, none in progress, every bank transaction of the year posted, none awaiting review |
| 06 Review | HUMAN_ATTESTED | case reviewer only | checklist + no ledger entry awaiting review |
| 09 Prepare Taxes | **BLOCKED** | — | verified tax engine required (H07) |
| 10–18 | **BLOCKED** | — | 11 e-signature integration (E04); 12 filing not authorized; others upstream |

The caller never supplies a pass/fail decision: system checks are computed in SQL; attestations are compared with the fixed checklist. Gate failures return `STAGE_GATE_NOT_MET` with the failed check names.

**Owner decision required:** which stages may be human-attested, and their checklists, is a firm policy choice. The defaults above are conservative (independent reviewer only, nothing at or after tax preparation) and are recorded as an open decision; changing them is a one-function edit.

## Transitions

Sequential only (`fromStage` must equal the active stage), optimistic `version`, refused while ON_HOLD. **Return** (rejection path): the case reviewer or a manager — never the preparer — returns to any earlier stage with a reason (≥ 10 chars); the target reopens and later stages lock. **Hold / resume** with a reason. Every transition writes `taxguard_case_stage_events` (immutable) and `taxguard_audit_log` (`CASE_*`). Unassigned staff and other tenants receive `CASE_NOT_FOUND`.

## Work queues and reporting

`GET /api/cases?role=preparer|reviewer&stage=&status=&taxYear=&cursor=` (managers see all tenant cases; others their own), `GET /api/cases/report` (counts by stage and status), case detail with stages, current gate checks, history, tasks, deadlines and notes. Tasks and deadlines link to a case through proposal 025 (case ID validated against the client).

## UI

Practice Manager → *Case Workflow*: queue with next action (system gate, reviewer attestation, or named blocker), case detail with 18-stage list, live gate checks, attestation checklist, return / hold, history.

## Tests

`caseWorkflowHttp.test.ts` (5): creation prerequisites and idempotency; stages 1–8 with real ledger evidence (posted, reviewed, reconciled) and reviewer attestations; failed-check reporting; stage 9 blocked; immutable history; reviewer-only returns; versions; hold; unassigned / cross-tenant refusal; queue filters; report. Mutation-checked: blocked-stage rule, reviewer-only attestation, sequential order. `caseWorkflowPanel.test.tsx` (4).

## Limitations / integration dependencies

- **Codex overlap:** the Codex handoff plans to "materialize canonical 18-stage case only with actual independent active preparer/reviewer and real engagement/year" from intake proposal 007. This proposal implements that materialization from proposal 025 team assignments; the two must be reconciled before either is applied (single case-creation path).
- Existing server stage gates (`stage*ServerGate.ts`) and the legacy live-workflow repository are not yet wired to the durable case; they evaluate snapshot evidence that is not durable today.
- Stage dwell time, SLA policy and capacity are not computed.
- Multi-connection concurrency unverified; browser NOT VERIFIED.
