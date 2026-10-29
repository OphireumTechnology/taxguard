# Blocks 69-72: verification, diagnostics, risk and independent QC on the draft return (design)

Status: **design only.** Each block starts after the previous one is merged with green CI. All database changes are
review-only proposals; nothing is applied to a hosted database. Synthetic data only. Owner decisions are **[OWNER]**.

All four blocks operate on the Block 68 **return version** (immutable, assembled from current Block 67 mappings) and
add records that refer to it; none changes a value. Each result is persisted with the inputs it was computed from,
so a changed return makes it stale (the pattern of Blocks 65-68).

## Block 69: independent calculation verification of a return version

| | |
|---|---|
| Reuses | Deterministic engine and pinned runs (033), source-cited verification cases (036) and coverage (038), run lineage (20261018190000) |
| Adds | `taxguard_tax_return_verifications`: per return version, an independent re-execution of every calculation run behind every mapped value, with the same pinned rule-set hash and engine version, comparing outputs; cross-checks that each mapped value equals the conclusion amount or run output it cites; rounding check (MONEY to cents, INTEGER whole) |
| Results | `VERIFIED`, or `DISCREPANCY` with per-line reasons: `RECALCULATION_MISMATCH`, `ENGINE_VERSION_CHANGED`, `RULE_SET_SUPERSEDED`, `VALUE_SOURCE_MISMATCH`, `ROUNDING` |
| Gate | A return version cannot be approved at Stage 09 without a current `VERIFIED` result (added to Block 68 approval) |
| Tests | PostgreSQL: verified case; each discrepancy reason (mutated stored output, superseded rule set, changed engine version); staleness when the return is re-prepared; isolation; no table privileges. Mutation: skip the re-execution -> tests fail |
| [OWNER] | Prior-year variance thresholds (out of scope until a policy exists) |

## Block 70: return diagnostics

| | |
|---|---|
| Reuses | Diagnostics rule table, runs, OPEN/ACKNOWLEDGED/CLEARED life cycle and gate (20261018160000) |
| Adds | Return-level rules in the governed rule table (reviewed database change), evaluated against a return version: `RETURN_REQUIRED_FORM_MISSING`, `RETURN_MAPPING_STALE`, `RETURN_VERIFICATION_DISCREPANCY` (Block 69), `RETURN_OPTIONAL_FORM_UNMAPPED` (INFO), `RETURN_JURISDICTION_UNSUPPORTED`, `RETURN_EVIDENCE_UNREVIEWED`, cross-form consistency rules declared in the template (`same value on form A line x and form B line y`) |
| Gate | BLOCKING and ERROR findings block Stage 09 approval (Block 68 already refuses blocking case diagnostics) |
| Tests | Each rule triggers and clears; acknowledgement only for INFO/WARNING; severity cannot be set by a caller; history immutable |
| [OWNER] | Severity of each return rule; filing-status combination rules need verified content |

## Block 71: risk and materiality on the return

| | |
|---|---|
| Reuses | Versioned, maker-checker materiality policies and deterministic assessments (20261018170000); none is seeded |
| Adds | Assessment of a return version: amounts at stake from mapped values, unsupported or AI-inference-only research positions, open WARNING diagnostics, verification status; outcome `BLOCKED` / `HUMAN_REVIEW_REQUIRED` / `CONTINUE` with reason codes; escalation to the case reviewer queue |
| Rule | With no approved policy every assessment is `HUMAN_REVIEW_REQUIRED`; `CONTINUE` never skips human review of a return (owner decision OV-09: always human review) |
| Tests | Each reason code; policy versioning; immutable assessments; no AI confidence can lower the outcome |
| [OWNER] | Materiality thresholds and the position-risk taxonomy |

As built (proposal 20261019160000, review only): `POST /api/tax-engine/returns/:id/risk` takes only `amountCents`; the
database reads staleness, the latest verification after submission, the case's and this version's open diagnostics
(and whether they were run since the version was prepared) and the case's research memos (unresolved, without an
authoritative citation, AI inference only). Materiality uses the latest approved materiality policy; none is seeded,
so `NO_APPROVED_MATERIALITY_POLICY`. No AI confidence is accepted. The outcome is `BLOCKED` (stale, verification
discrepancy, blocking finding) or `HUMAN_REVIEW_REQUIRED`; the table refuses `CONTINUE` and requires the
`RETURN_HUMAN_REVIEW_REQUIRED` reason (OV-09). Assessments are immutable and audited and change nothing about the return.
Not built: escalation into a reviewer queue (no queue exists yet; the assessment is listed on the version), and
deriving the amount at stake from mapped lines (the owner has not defined which lines count).

## Block 72: independent quality control

| | |
|---|---|
| Reuses | Reviewer queue and decisions; Block 68 independent draft review |
| Adds | A QC review of a return version separate from the Stage 09 reviewer: QC reviewer must differ from preparer and reviewer, hold a QC authority designated like template approvers (policy + designation, fail closed), and record checklist results; outcomes `QC_PASSED`, `QC_RETURNED` (with findings, routed back to the preparer) |
| Readiness | Final draft readiness = approved, current return version + current `VERIFIED` (69) + no blocking/error diagnostics (70) + current assessment not `BLOCKED` (71) + `QC_PASSED` (72). This becomes the input to Stage 10, where a separately authorized professional gives final authorization (not these blocks) |
| Tests | Three-person separation (preparer, reviewer, QC); QC authority fail-closed; readiness false when any input is stale; nothing marks a return filed or signed |
| [OWNER] | QC eligibility policy and checklist; whether QC is required for every return or by risk outcome |

As built (proposal 20261019170000, review only):

- **Assignment.** The authority proposal makes case assignment mandatory for `RETURN_QC_REVIEW`. The case has only
  preparer and reviewer slots, so QC uses an explicit per-version assignment instead.
  - A practice manager makes it with `POST /returns/:id/qc-assignment`, and revokes it with a reason.
  - The assignee must be an active staff member. They must not be the version's preparer or reviewer, the case's
    preparer or reviewer, or the manager making the assignment.
  - Independence is checked again when QC is recorded.
- **Recording.** `POST /returns/:id/qc` is for the live assignee only.
  - Order of checks: the version is approved and not stale; the QC authority (no policy: `NO_POLICY`); the owner's
    approved checklist (none seeded: `TAX_RETURN_QC_CHECKLIST_REQUIRED`).
  - The reviewer gives PASS or FAIL for every item. Any FAIL is `QC_RETURNED` and needs a note.
  - The approved version never changes: the preparer prepares a new one.
- **Readiness.** `GET /returns/:id/readiness` checks, in order:
  1. The version is approved and not stale.
  2. Its calculations are VERIFIED.
  3. Diagnostics were run after approval, with no open BLOCKING or ERROR finding.
  4. A risk assessment newer than approval and that run exists, and it is not BLOCKED.
  5. A `QC_PASSED` review newer than both exists, under the current checklist.
- **Scope of readiness.** QC is required for every return until the owner decides otherwise. Readiness reports
  `stage10: FINAL_AUTHORIZATION_REQUIRED` and `returnUse: BLOCKED`. Nothing signs, files or transmits.
- **QC queue.** QC reviewers have a queue panel on the reviewer dashboard.
- **Not built.** A maker-checker workflow for writing checklists, policies and designations; until one is approved,
  these change only by a reviewed database change.

## Common acceptance for each block

PostgreSQL acceptance cases over HTTP; mutation checks for each refusal; unit tests for store, routes, panel and
production refusal (cutover requires the block's proposal); a suite 07 browser journey with keyboard, live regions and
375 px; full matrix (unit, lint, typecheck, PostgreSQL, both browser profiles, build, release candidate, constraint
review, secrets, diff check, contamination); GitHub CI green on the PR; owner merge.
