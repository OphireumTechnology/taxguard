# TaxGuard AI Gate AI-6 - Durable Execution / Audit Ledger

Status: PASS WITH RESTRICTIONS. Production agents/providers remain disabled. No source history is replaced.

## Implementation and changed files

Added:

- supabase/migrations/20261008050000_taxguard_ai_execution_ledger.sql
- src/server/ai/ledger/ExecutionLedgerService.ts
- src/tests/aiExecutionLedger.test.ts
- docs/taxguard-ai-agent-gate-ai-6.md

Modified:

- src/server/ai/governance/contracts.ts
- src/server/ai/governance/GovernanceControlPlane.ts
- src/server/ai/governance/SqlGovernanceStore.ts
- src/server/ai/gateway/ModelPromptResolver.ts
- src/server/ai/gateway/SqlGatewayStore.ts
- src/server/ai/capabilities/GovernedCapabilityExecutor.ts
- src/tests/stageTwoStorageAndAssignmentGovernance.test.ts
- src/tests/supabaseProductionInfrastructure.test.ts

The last two changes extend the existing chronological migration inventories. All existing security assertions are retained. AI-7 review/checkpoint documentation is listed separately; no specialized agent is implemented in this gate.

## Correlation and immutable history

The additive migration creates ai_execution_links, ai_run_transitions, ai_execution_recovery and ai_usage_reconciliations. All four tables ENABLE/FORCE RLS, revoke PUBLIC/anon/authenticated access, and reject updates/deletes. Foreign keys and integrity triggers bind records to existing tenants, actors, cases, runs, agent versions and original scoped histories. AI foundation table count is now 35.

security_invoker views ai_execution_history and ai_execution_correlated_history unify original governance, root/orchestration, gateway admission/attempt/outcome, capability events, run transitions, evidence references, recovery and reconciliation. They expose stable source UUIDs and exact decision/root/child/run/attempt/invocation relationships where evidence exists. Unrooted or ambiguous historical decisions are not assigned invented roots. Original rows, model usage and evidence remain intact.

ModelPromptResolver records fresh parent/child decision links; the capability executor records its additional capability decisions. Session identity is freshly verified, and SQL validates actual root/child/case/actor correspondence. Correlation is never a permit. Forged correlation is still rejected by original admission boundaries with preserved denial semantics. If required correlation persistence fails, dispatch fails closed.

## Run transitions and truthful failure

New runs must begin QUEUED. Every actual status change appends an immutable ordered transition in the same database transaction. Skipped transitions and fabricated predecessor records are rejected. APPROVED requires an existing completed independent human approval; no service in AI-6 performs that approval. Existing runs are backfilled only as their current recorded snapshots, without inventing intermediate events.

Attempts, bounded retry outcomes, cancellation, timeout, denial, discard and ambiguous transport states continue to come from the original immutable AI-3 through AI-5 histories. Same-state run updates do not manufacture additional transitions. Failure to append transitions rolls back the associated state change. AI-6 does not turn a failed/unknown run into success.

## Recovery, fencing and restart behavior

Recovery claims use server-generated lease-owner UUIDs, bounded 1-300 second expiry, database advisory locking and monotonic fencing. Concurrent claims have one owner. Expired claims are explicitly recorded; stale owners or altered expiry cannot close a newer lease. Recovery state persists independently of service instances.

Recovery close records REVIEW_REQUIRED and explicitly returns redispatched=false. It does not invoke a provider/handler, reopen terminal work, overwrite original outcomes or change tax/workflow authority. Unknown completion is an investigation requirement, not permission to retry. This gate has no autonomous recovery worker that dispatches operations. Tests prove restart between service instances against durable SQL records; they do not claim live PostgreSQL failover or physical production-process recovery certification.

## Usage reconciliation

Unknown original usage/cost remain NULL and UNKNOWN. Reconciliation requires a trusted server-owned UsageAuthority receipt verifier; no production verifier is commissioned, and isolated-test injection is runtime-guarded. Caller/model counts or pricing are not accepted as authority.

Verified receipts append exact usage, evidence hash and authority reference, using the run's original immutable pricing. Invalid, missing or failed receipts remain unavailable/unverified. Reconciliation is unique per run and cannot rewrite the original gateway outcome or terminal ai_run snapshot. Gateway budget admission uses effective reconciled accounting while preserving original history; unresolved UNKNOWN still blocks admission. Receipt recovery is not proof of successful reasoning or approval.

## Scoped monitoring and authorization

ExecutionLedgerService validates current authoritative session and effective assignments through existing governance scope authority. Reads are constrained to the actor's own exact authorized case, with limits of 1-200 metadata rows and no document/prompt/PII payload. Current assignment/role is rechecked inside SQL and after monitoring reads. A disabled agent can still have its own authorized audit history inspected; this does not authorize that agent to execute.

Recovery/reconciliation enforce the original requester and exact case scope, and SQL checks current effective assignment before writes. No admin role implies tenant-wide audit access. No public API, arbitrary SQL, network, filesystem or shell capability is introduced. Human review/maker-checker, private documents, original LEGACY_18_V1 numbering, kill switches and DRAFT deployment metadata remain intact.

## Tests and validation

43 new tests cover correlation, durable run transitions, initial state and approval boundaries, actor/tenant/client/case/year restrictions, role rejection, revoked assignments, post-read revocation, bounded monitoring, disabled-agent audit access, lease restart/concurrency/expiry/fencing, forged recovery, unknown usage, verified reconciliation, receipt failure/malformed data/replay, RLS, immutable deletion and audit outage.

All twelve migrations are exercised only in disposable PGlite databases. No persistent/local Supabase or production migration is applied; no live provider is contacted. Existing AI-1 through AI-5 tests are preserved.

Final validation:

- Complete regression: PASS, 125 files / 2,371 tests, including 43 new AI-6 tests. Command: npm.cmd test -- --maxWorkers=2. No test is filtered, removed or disabled; two workers reduce filesystem contention.
- npm.cmd run typecheck: PASS.
- npm.cmd run lint: PASS; configured lint is tsc --noEmit.
- npm.cmd run build: PASS for frontend and server. Existing large-chunk and mixed static/dynamic calendar-import warnings remain.
- git diff --check: PASS.
- Targeted ledger/production-authority tests: PASS, 49 tests.
- Existing registry and gateway tests: PASS.

One initial full-suite run passed 2,371 tests but exposed a new test-wrapper generic typing error; it was corrected without changing assertions. A subsequent run hit an existing filesystem-scanning production-authority test timeout; the unchanged test passed in isolation. The final complete suite passed with bounded worker concurrency. No security assertion or timeout limit was weakened.

## Restrictions

All A00-A60 deployment registrations remain DRAFT. Production dispatch, provider commissioning, production migrations, deployment, tax/accounting mutations, autonomous approvals/signatures/filing/payments/communications and arbitrary resource access remain blocked.

Live PostgreSQL distributed concurrency, failover, deployed least-privilege grants and complete dispatch fencing are still commissioning prerequisites. Audit-write outages can leave an unresolved original execution admission; recovery records uncertainty and never invents missing provider facts. Production reconciliation needs an approved authenticated receipt transport. Broader monitoring roles and cross-staff audit access need explicit policy.

## Git and next gate

Branch feature/taxguard-ai-agents. Fetch confirmed origin/main...HEAD = 0 0. Existing uncommitted dashboard and AI-1 through AI-5 work is preserved. No commit, push, merge, rebase, deployment, secrets change or protected-backup inspection/modification occurred.

Next legitimate gate is AI-7, Client Services A01-A04. Continuous authorization supersedes the earlier per-gate approval stops. However, the canonical registry and approved baseline explicitly leave these four responsibilities/permissions unmapped pending the missing Architecture Overview. The available architecture PNG does not supply that matrix. Implementing per-agent authority without the missing approved mapping would invent security-sensitive requirements. See taxguard-ai-agent-gate-ai-7-pre-review.md and taxguard-autonomous-development-checkpoint.md for the exact required input and resume point.
