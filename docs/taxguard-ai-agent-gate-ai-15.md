# AI-15 human-only proposal correction/rejection

Status: PASS WITH RESTRICTIONS for human correction/rejection. Final approval chain and production cutover remain unavailable.

## Implemented boundary

HumanProposalReviewService uses a trusted server SessionAuthority, strict bounded requests and the existing durable SQL foundation. It independently verifies current reviewer/senior-reviewer membership, effective case plus client/engagement/year assignment, exact tenant/client/case/year, independent preparer/requester, current stage and released CLEAN evidence version/hash. Authority records are locked during the transaction; identity is freshly reverified before recording a decision. Applicable kill switches remain controlling.

Only existing bounded A34 advisory proposals in REVIEW_REQUIRED are supported. Proposal schema/hash must match the run; no numerical confidence or model result grants approval. A human can RETURN or REJECT with a meaningful bounded reason. Immutable ai_human_reviews records retain actor/reason/scope and run linkage. Rejection appends a terminal run transition atomically; returning preserves review-required state. Server-derived correlated review identities reject replay and concurrent duplicates.

No tax/accounting record, client communication, signature, filing, payment or workflow stage is changed. APPROVED explicitly fails AI_HUMAN_APPROVAL_CHAIN_UNAVAILABLE. Production mutations explicitly fail AI_HUMAN_REVIEW_CUTOVER_UNAVAILABLE; no public endpoint/factory is released. Human historical review is not an inactive agent execution permit.

## Files

- Added src/server/ai/review/HumanProposalReviewService.ts.
- Added src/tests/aiHumanProposalReview.test.ts (32 tests).
- Lifecycle repair: src/tests/aiCapabilities.fixture.ts, new src/tests/aiFixtureLifecycle.test.ts, vitest.config.ts; see dedicated lifecycle diagnosis.
- Added this report; checkpoint/architecture reports updated.

No migration: existing ai_human_reviews, ai_proposals, ai_runs, evidence and immutable transition constraints suffice for correction/rejection. Disposable SQL only; no production/persistent data changed.

## Restrictions and next architectural boundary

This does not implement complete PREPARER -> REVIEWER -> CPA/EA approval. The current review table permits reviewer/senior/CPA/EA roles, but not a preparer attestation step, and its guard ties the decision actor to the case's one reviewer_uid. Neither run.requested_by nor CPA credential metadata proves completion of a required multi-person approval chain. Final approval must not be inferred.

Before AI-16 can execute a material authoritative action, its exact action profile and required independently auditable human chain must be established. No generic tax/accounting mutation or arbitrary operation should be introduced to bypass that missing authority. Optional unsupported actions remain denied; a real material action service must not be represented as built by an always-denied placeholder.

## Validation

The focused human-review suite passed 32 tests and terminated normally; the lifecycle failure-cleanup test also passed. Related governance/A00/gateway/capability/persistence/ledger suites exited code 0 without residual Vitest processes. Complete configured npm.cmd test: 129 files / 2,524 tests PASS in approximately 62 seconds. Typecheck PASS; lint PASS; frontend/server build PASS with existing warnings; diff/new-file checks PASS. The diagnosis report distinguishes the confirmed fixture cleanup defect from the unreproduced historical stall. No production migration, data mutation, commit, push, merge or deploy; protected backup untouched.
