# TaxGuard AI Gate AI-5 — Governed Tool & Data Capability Layer

## A. Status

PASS WITH RESTRICTIONS. Infrastructure only; production capability execution, provider commissioning and agent activation remain disabled. All deployment registrations remain DRAFT. AI-6 has not begun.

## B. Complete changed-file inventory

Added:

- src/server/ai/capabilities/contracts.ts
- src/server/ai/capabilities/CapabilityRegistry.ts
- src/server/ai/capabilities/capabilityValidation.ts
- src/server/ai/capabilities/ScopedReadRepository.ts
- src/server/ai/capabilities/GovernedCapabilityExecutor.ts
- src/server/ai/capabilities/SqlCapabilityStore.ts
- src/server/ai/capabilities/a00CapabilityBoundary.ts
- src/tests/aiCapabilities.fixture.ts
- src/tests/aiGovernedCapabilities.test.ts
- src/tests/aiGovernedCapabilitiesPersistence.test.ts
- supabase/migrations/20261008040000_taxguard_ai_capability_execution.sql
- docs/taxguard-ai-agent-gate-ai-5.md

Modified narrowly:

- src/tests/stageTwoStorageAndAssignmentGovernance.test.ts
- src/tests/supabaseProductionInfrastructure.test.ts

The two existing tests now require the additional migration in chronological order. Their existing security assertions are preserved. Other dashboard and AI-1 through AI-4 work is preserved.

## C–E. Architecture, registry and server-owned handlers

GovernedCapabilityExecutor accepts an untrusted structured proposal and resolves it through immutable server-owned definitions. IDs reuse the canonical ai_tools namespace. Version 1 binds strict input/output schemas, READ action, INTERNAL metadata classification, row/byte limits and a timeout. Executable binding is a fixed switch in ScopedReadRepository; no handler, function, dynamic import, endpoint or database query is selected by the caller or model.

Exactly two read projections are implemented:

- workflow.read: one exact authorized case's LEGACY_18_V1 stage and existing status. No workflow advancement.
- document.read: one to ten explicitly selected authorized evidence-source metadata records: source/document UUIDs, version, hash, release status and CLEAN quarantine state. No content, filename, source-reference text, storage path or signed URL.

All other IDs, including the registry's generic database.read, are unavailable. A READ permission cannot grant arbitrary SQL or taxpayer-data export. Empty selection and missing SQL evidence fail closed instead of generating metadata. Successful execution is runtime-restricted to isolated tests; no production factory or public capability endpoint is added.

## F–G. Authorization and scope

The executor uses ModelPromptResolver for independent current A00 and child eligibility, then GovernanceControlPlane.inspectForExecution for the specific capability. The capability does not inherit workflow.read authorization or a parent's decision. The current approved routing remains the two existing A34 review purposes; no additional specialist is claimed implemented.

Each assessment uses authoritative session identity, persisted membership/current role, case and client/engagement/year assignments, scope, lifecycle, stage, capability/data permissions, evidence, human policy and applicable kill switches. The same AI-2 policy evaluator is reused inside the read transaction. Fixed parameterized SQL enforces exact scope and returns bounded projections. No memory-backed authority fallback exists.

Root, child, prior decision and optional gateway IDs are checked only for correlation. They confer no authorization. Correlation/admission/event I/O is followed by fresh governance checks. Registry/configuration/evidence changes invalidate the captured binding. All accepted results remain advisory, human-review-required and non-authoritative. Existing preparer/reviewer separation and PREPARER → REVIEWER → CPA/EA policies remain controlling.

## H–I. Evidence, provenance and validation

Exact source ownership, case relationship, document UUID/version/hash, RELEASED or VERIFIED status and CLEAN quarantine state are checked. Non-document or insufficiently verified authority remains unavailable under existing governance. Metadata provenance does not establish tax correctness or professional approval.

Strict request validation rejects unexpected fields, identity/permission/handler overrides, arbitrary URLs, SQL, paths, shell requests, malformed UUIDs, duplicate or excessive selections and evidence outside the context. Trusted output validation enforces byte/row bounds, exact field sets and equality with authorized facts. Fabricated evidence, unauthorized status and extra approval fields are rejected. Text in source references is never interpreted as instructions or returned to the model.

Records bind root/child/actor/scope, agent version, capability version, definition/schema/input/output hashes, evidence hash and governance decisions. Optional AI run/attempt references must correspond to an accepted gateway outcome for the same actor/root/child. Absent model runs remain NULL; no fake execution history is seeded.

## J–K. A00 and gateway integration

a00CapabilityBoundary holds the session token in a trusted server closure. A00 invokes the executor and receives only the established advisory envelope; capability data is not added to provider context. Independent child checks remain intact.

Gateway integration uses validated correlation to actual accepted AI-4 run/attempt records. Once a child has a gateway admission, omitting correlation is also denied; a failed/refused/unaccepted provider attempt cannot authorize capability continuation. Runtime checks and the admission trigger both enforce this boundary. The provider adapter contract and counts-only schema remain unchanged: no model-native tools or capability proposals are enabled by the gateway. Internal read eligibility is explicitly separate from provider export eligibility; provider_export_allowed is always false.

## L. Kill switches

GLOBAL, AGENT, MODEL, TOOL and WORKFLOW switches are independently rechecked around admission, execution and acceptance. A switch or assignment/evidence revocation during pre-dispatch admission/audit/correlation I/O prevents handler invocation. Revocation after dispatch discards output and records that the handler ran. No claim is made that cancellation reverses reads or information already transmitted by an earlier provider operation.

## M. Replay/idempotency

Durable uniqueness binds tenant, actor, child operation and capability ID. An advisory transaction lock serializes admission; the unique constraint provides a second duplicate barrier. Repeated logical invocations are refused; altered input hashes yield replay mismatch. A second capability needs its own admission and fresh authorization. Existing A00/gateway replay rules are unchanged.

No capability automatic retries are implemented. Failures are not RetryableAdvisoryError, so A00 cannot multiply capability retries. Timeout, cancellation, audit outage and ambiguous completion never cause automatic redispatch.

## N. Audit/history and failure behavior

Admission and ADMITTED event commit before execution. EXECUTING is persisted before the handler; fresh assessment follows this I/O. EXECUTED records validated output; DENIED, FAILED, TIMED_OUT, CANCELLED or DISCARDED preserve truthful failure state. A post-persistence revocation can append DISCARDED after EXECUTED; successful read completion is not permission for downstream use.

Governance denials retain AI-2 immutable decision history. Correlation/replay admission refusals record sanitized existing ai_policy_events using verified actor/tenant identity, without adopting untrusted case claims. Unauthenticated/unparseable requests do not invent a tenant or scoped audit identity. Required audit failure blocks dispatch or successful return. A result-write outage leaves the earlier execution admission as unresolved evidence rather than manufacturing success; recovery is AI-6 work.

Handler errors are sanitized. Local timeout/cancellation signals bound handler waiting and acceptance; late results cannot authorize continuation. Database queries retain the existing server transaction statement timeout. Cancellation is cooperative and does not claim to abort every database query immediately.

## O–P. Database and disposable validation

One additive migration creates ai_capability_admissions and ai_capability_events, raising the AI table total from 29 to 31. It adds scoped foreign keys, canonical agent/version/tool/stage references, definition/provenance hashes, optional run/attempt correlation, immutable-history triggers, phase constraints and duplicate barriers. Both tables ENABLE/FORCE RLS, revoke PUBLIC/anon/authenticated access and have no permissive policies. No trigger promotes a proposal or read result into authoritative tax/accounting records.

All eleven repository migrations are applied only to disposable PGlite instances with synthetic identities, cases, documents and registry approvals. Tests exercise actual parameterized SQL projections and schema/RLS/constraint behavior. No persistent local Supabase or production database is migrated. PGlite tests do not establish live PostgreSQL failover, distributed fencing or deployment grants.

## Q–R. Tests added

Security tests cover independent authentication/roles/assignments, revocation, tenant/client/case/year/stage isolation, DRAFT/inactive agents, tool/data/stage permissions, maker-checker/human policy, exact evidence, override/injection/URL/SQL/filesystem/shell rejection, unknown IDs/version mismatch, kill-switch boundary changes, pre/post-dispatch audit failures, replay/concurrency, cancellation, timeout, malformed/oversized output, forged correlations and legacy refusals.

Pre-dispatch denials spy on the actual ScopedReadRepository.read method and require zero handler calls, zero provider calls and zero authoritative mutations. Post-dispatch cases assert discard and truthful invoked history. Successful read tests additionally compare persisted case records and assert proposal/review/authoritative-action tables remain untouched.

Functional tests cover single/multiple/maximum-ten evidence projections, empty/missing results, existing foreign-client records, provenance, durable admission phases, real A00 coordination, accepted gateway correlation and failed-provider continuation refusal. Persistence tests cover invalid/orphan/scope/version/hash records, immutable update/delete rejection and deny-by-default RLS.

## S–T. Final validation

Final complete validation after the timeout/correlation refinements:

- npm.cmd test: PASS, 124 test files / 2,328 tests; 165 new AI-5 tests (135 capability tests and 30 persistence tests). All existing tests are preserved.
- npm.cmd run typecheck: PASS.
- npm.cmd run lint: PASS. The configured lint command is tsc --noEmit, not a separate style/security linter.
- npm.cmd run build: PASS for Vite frontend and esbuild server.
- git diff --check: PASS.
- Explicit whitespace validation for all twelve new AI-5 files: PASS.
- Targeted AI-1 through AI-5/disposable SQL validation also passed before complete regression.

Existing frontend large-chunk and mixed static/dynamic LiveCalendarModule import warnings remain; no new build failure is introduced. No live provider call is used for validation.

## U. Remaining restrictions/gaps

- No production commissioning or public capability endpoint; all execution remains isolated-test-only.
- Only two bounded read capabilities and existing A34 review routing are supported. Additional capabilities/agent purposes require separately approved implementations and schemas.
- Atomic policy-to-dispatch fencing, distributed PostgreSQL concurrency/failover, crash recovery, leases and rate-limit commissioning remain unproven production prerequisites.
- Semantic legal/calculation authority and broader content classification/export policies are not established by metadata reads.
- Complete AI-6 execution ledger and recovery are not implemented.
- Legacy public dispatch remains refused; memory-to-durable authority cutover remains unresolved. Fixed-sample extraction and disabled Gemini remain excluded from production.

## V. Production-blocked capabilities

Agent activation, live provider commissioning, unrestricted tools, raw taxpayer-data export, tax/accounting mutations, workflow advancement, client/email/SMS communications, payments/refunds, signing, filing/government submission, administrative access, arbitrary network/filesystem/code/shell operations and production migrations remain blocked.

## W. Git/release status

Branch feature/taxguard-ai-agents. Pre-implementation fetch confirmed origin/main...HEAD = 0 0. Prior uncommitted dashboard/AI work is preserved. This gate adds unstaged/uncommitted files and two narrow migration-inventory updates. No commit, push, merge, rebase, deployment, production mutation, secret alteration or agent activation. Protected backup contents are not inspected or touched.

## X. Lifecycle

NO deployment lifecycle change. A00–A60 canonical/deployment metadata remains DRAFT. Synthetic ACTIVE agents/models/prompts/tools/permissions exist only in disposable test fixtures.

## Y. Exact recommended AI-6 scope

Implement the complete durable execution/audit ledger across existing governance, orchestration, gateway and capability histories: scoped correlation, validated transitions, attempts and terminal states, leases/recovery, audit-outage reconciliation, unknown usage/cost reconciliation, immutable evidence references and authorized monitoring. Preserve historical records and proposal/approval/action separation. Do not commission providers, activate agents or authorize material actions merely because the ledger is complete.

STOP AFTER AI-5. AI-6 requires explicit authorization.
