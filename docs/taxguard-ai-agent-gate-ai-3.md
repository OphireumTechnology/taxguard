# TaxGuard AI - Gate AI-3 report

Date: 2026-10-08

**Status: PASS WITH RESTRICTIONS.** Scope is governed orchestration infrastructure, not production agent commissioning. A00-A60 deployment registrations remain DRAFT. No live provider, approval, signature, filing, autonomous contact or authoritative tax/accounting action is enabled.

## A. Objective implemented

A server-only A00 coordinator resolves durable session/assigned case scope and the actual persisted workflow stage, assesses its own narrowly defined coordination capability, selects a documented canonical route, and independently governs each child. Production-default construction has no executable handler. Explicit isolated test handlers prove orchestration without pretending that A34 or another specialized agent is built.

## B. A00 orchestration architecture

`A00Orchestrator` accepts a bounded request containing an operation request ID, exact scope, supported task identifiers and evidence source IDs. It rejects additional identity, prompt, document-text, stage, permission and approval inputs. Scope resolution uses the existing SQL governance store; caller IDs are selectors, never authority. There is no memory fallback or system-event identity impersonation. Uncommissioned system events have no separate execution path; an authoritative session is required.

The server-only `evaluateCoordinator` path permits A00 only for COORDINATE_REVIEW, advisory intent, workflow.read/READ and INTERNAL metadata. It retains lifecycle, model/prompt, budgets, role, assignment, case/year/stage, evidence, kill-switch and human policy checks. Ordinary assessment still rejects supervisor access. A00 cannot confer child permissions, and administrative roles do not receive an override.

## C. Canonical routing

IDENTIFY_REVIEW_QUESTIONS and REVIEW_EVIDENCE_COMPLETENESS route to A34 using the mapping already approved in AI-2. Every lookup uses `src/ai/registry.ts`. Unknown tasks/agents and other uncommissioned capabilities are refused rather than receiving invented mappings. Exactly 61 deployment identities remain unchanged and inert.

## D. Child-operation architecture

Each child has a server-generated UUID, root linkage, exact inherited scope, fixed task purpose and attempt number. Retry attempts reuse that child identity; governance assessments use distinct server-generated request IDs. Parent and child checks are fresh for every attempt. Child context contains scoped metadata/evidence selectors only: no session token, database handle, raw document, prompt or arbitrary tool access. Context and nested scope/evidence arrays are frozen.

Authorization is recorded before an attempt is reserved. Governance is rechecked after pre-dispatch audit I/O and after output production; changed evidence, assignment, stage, capability or kill-switch state invalidates dispatch/acceptance. Structured results remain ADVISORY with human_review_required=true and action_executed=false. COMPLETED is only a successfully recorded isolated test orchestration, never tax completion or approval.

## E. Files changed

Added:

- `src/server/ai/orchestration/A00Orchestrator.ts`
- `src/server/ai/orchestration/canonicalRouting.ts`
- `src/server/ai/orchestration/contracts.ts`
- `src/server/ai/orchestration/SqlOrchestrationLedger.ts`
- `supabase/migrations/20261008020000_taxguard_ai_orchestration_history.sql`
- `src/tests/aiA00Orchestration.test.ts`
- `docs/taxguard-ai-agent-gate-ai-3.md`

Modified:

- `src/server/ai/governance/GovernanceControlPlane.ts` - narrow supervisor assessment, scoped stage/limit resolution and audited resolution denials.
- `src/tests/stageTwoStorageAndAssignmentGovernance.test.ts` - append the ninth migration to the exact existing inventory.
- `src/tests/supabaseProductionInfrastructure.test.ts` - append the ninth migration to the exact existing inventory.
- `docs/taxguard-ai-legacy-mapping.md` - document AI-3 compatibility and remaining cutover.

Other dirty dashboard/AI-1/AI-2 files predate this gate and are preserved.

## F. Database/schema impact

One additive transactional migration creates `ai_orchestration_roots` and `ai_orchestration_events`, bringing the AI table total to 25. These are coordination/test history, not a replacement ai_run ledger. Composite actor/tenant/root linkage, persisted case validation, canonical IDs, governance-decision references, controlled purpose/status/attempt/hash constraints, decision scope validation, immutable-history triggers and indexes are enforced in PostgreSQL.

Root coordination decisions must match A00, actor, tenant, case and stage. Event decisions must match the child agent and root scope. Request uniqueness prevents repeated root execution; unique attempt reservations and terminal/result indexes prevent duplicate writes. Operation identity cannot be reused for another root/agent/purpose. Both tables ENABLE/FORCE RLS, revoke end-user privileges and have no permissive policies or authoritative-writing triggers.

All nine repository migrations were applied only to disposable PGlite databases with synthetic auth roles/sessions/domain records. No local persistent Supabase or production migration was applied. No production data was queried or changed.

## G. A00-A60 registry integration

No canonical metadata, seed permissions, prompts, model approvals or lifecycle states were altered. Synthetic ACTIVE A00/A34 and model/prompt configurations exist only in isolated test databases. Test handlers require NODE_ENV=test at construction and dispatch; ordinary construction contains none. No new public dispatch endpoint is mounted.

## H. Authorization/scope enforcement

The original durable-session verifier and current SQL membership/assignment remain authoritative. Tenant/client/case/year intersection and persisted stage are checked; parent eligibility does not authorize a child. Wrong roles, ambiguous/missing durable scope, suspended/expired assignments, draft agents, absent capabilities and evidence deny without handler invocation. Known-member scope denials create governance records against the trusted tenant; unauthenticated failures cannot fabricate an audit identity.

## I. Human-review/maker-checker enforcement

Both coordination and child assessments retain the existing PREPARER -> REVIEWER -> CPA_EA path. Same preparer/reviewer identity is denied. The orchestrator never records human approval, signs, files or changes authoritative records. Actual human decision services and authoritative commits remain AI-15/AI-16 work; the directive's gate references are not permissions for numbered agents A15/A16.

## J. Evidence/provenance enforcement

AI-2 exact source/case/year, document UUID/version/hash, released/verified and CLEAN-quarantine checks are reused and rechecked before accepting results. Returned evidence IDs must be a nonempty subset of the authorized input references. Missing, fabricated, changed or foreign references are denied. Independent legal-authority/calculation semantic verification remains unavailable and cannot be bypassed.

## K. Prompt-injection boundaries

No untrusted document text, email, OCR instructions, custom prompt or authority flag is accepted by the orchestration contract. Metadata-only handlers cannot receive tools or secrets through input. Output has an exact field set and bounded finding-code vocabulary; approval/action flags, invented evidence and instruction-like output are rejected. This is a structural boundary, not a claim that semantic LLM injection defense is fully commissioned; gateway defense/evaluations remain later work.

## L. Kill-switch behavior

Each parent/child assessment reloads GLOBAL, AGENT, MODEL, TOOL and LEGACY_18_V1 WORKFLOW switches. Changes during pre-dispatch audit or handler work prevent dispatch/acceptance and downstream work. No kill-switch mutation endpoint or production provider cancellation capability is added.

## M. Replay/idempotency behavior

The durable ledger claims the tenant/actor/hashed-request key under a PostgreSQL transaction/advisory lock. Identical replay returns AI_REPLAY_DENIED; changed input returns AI_REPLAY_MISMATCH. A completed or failed root cannot be resumed through replay. A process crash leaves preserved reservations, not automatic re-execution. Retry/recovery commissioning and multi-instance live PostgreSQL behavior require later validation; PGlite is not proof of production failover.

## N. Timeout/retry/failure behavior

Only explicit transient errors from isolated read-only/idempotent test handlers are retryable. Limits are bounded by test policy and persisted agent limits (maximum two retries). Every retry rechecks governance. Timeout and cancellation abort the handler signal, reject output and are never retried because execution may be ambiguous. Late output is not accepted. A handler ignoring AbortSignal cannot be forcibly terminated; no such handler is commissioned for production.

Unknown dependency errors are sanitized. Audit failure prevents invocation or successful return, depending on the failure point. No synthetic successful fallback exists. PostgreSQL access retains existing transaction/time limits.

## O. Audit/execution history

Root and child purposes, attempts, scoped actor correlation, assessment references, output hashes and truthful statuses are append-only. RUNNING records an attempt reservation before invocation, not proof of completed work. Accepted-result events link the final revalidated child decision. Governance retains its independent immutable assessment history; full provider ai_run transitions, token/cost accounting and complete gateway execution correlation remain AI-4/AI-6 prerequisites.

No ai_runs, generated forms, human decisions, external submissions or authoritative action records are fabricated. Output content is not persisted in this new ledger; no taxpayer text, provider error detail, credential or session token is logged.

## P. Legacy compatibility/cutover status

Legacy providers/helpers are preserved unchanged. The AI-2 public adapter continues to refuse execution with the documented unavailable/mapping/cutover errors. Memory-only case/evidence records are not copied or relabeled. Gemini remains disabled; fixed-sample extraction remains excluded from the production release boundary. LEGACY_18_V1 is retained without renumbering or changing business transitions.

## Q. Security tests added

83 new tests cover canonical routing, coordinator impersonation/escalation, inactive agents, role and tenant/client/case/year boundaries, effective assignment, independent child permissions, maker-checker and human policy, evidence, all five kill-switch scopes and changes during work, strict input/output contracts, retries/timeouts/cancellation, replay/concurrent duplicates, SQL attempt reservations, audit outages, trusted denial scope, immutable history, orphan/foreign linkage, RLS and preserved legacy/DRAFT release boundaries. Denied pre-dispatch operations explicitly assert zero handler calls. Existing tests remain intact.

## R. Total regression results

Final `npm.cmd test`: **121 files / 2,064 tests passed**, including all 83 AI-3 tests and the final audit-purpose/correlation refinements. Existing tests were preserved. Fixture constraints and TypeScript query-result types were repaired before final validation.

## S. Typecheck result

Final `npm.cmd run typecheck`: PASS.

## T. Lint result

Final `npm.cmd run lint`: PASS. Configured lint is TypeScript tsc --noEmit; no separate style/security linter is configured.

## U. Production build result

Final `npm.cmd run build`: PASS for Vite frontend and esbuild server. Existing main-chunk size and mixed static/dynamic LiveCalendarModule import warnings remain. No deployment occurred.

## V. git diff --check result

Final `git diff --check`: PASS. New untracked files also receive explicit whitespace checks because git diff does not inspect untracked contents.

## W. Git status

Branch remains feature/taxguard-ai-agents. Fetch before implementation confirmed origin/main...HEAD = 0 0. Working tree remains intentionally dirty with prior gates and AI-3 files. No commit, stage, push, merge, rebase or deployment. Protected hardening backup contents were never inspected or modified.

## X. Remaining restrictions

- Production agents, model/prompt/tool permissions and provider/action dispatch remain inactive. The new layer has no released execution endpoint or production handlers.
- Live migration installation, TLS/grants/Supabase alignment, durable case/evidence cutover, exact architecture mappings and legacy stage semantics remain separately authorized work.
- Only the two previously mapped review tasks are routable; registry membership alone does not implement a capability. No complete specialist, OCR, tax advice, calculation, reconciliation or filing integration is claimed.
- Semantic evidence verification, material human decisions, authoritative actions, provider usage enforcement and full execution transition ledger remain later gates.
- Policy assessments are snapshots, not reusable permits. Atomic admission against concurrent policy changes, crash recovery and distributed dispatch fencing must be proven before any production handler is commissioned. Production remains disabled while those prerequisites are absent.
- Timeout signals and test-only retry mechanics are infrastructure validation, not production provider readiness. No customer notification, schedule/billing mutation or external call is performed.

## Y. Exact recommended scope for AI-4

Build the server-only AI Gateway and governed model/prompt registry access around existing provider interfaces. Enforce approved identity/version/use case/data classes, immutable prompt version, structured output, timeout, bounded retry, token/cost measurement and safe failure without opening legacy bypasses. Require durable run-before-provider recording through an explicitly reviewed ledger dependency; do not bypass AI-6 requirements to enable a gateway.

Keep production A00-A60 DRAFT and dispatch disabled. Validate the gateway with isolated provider doubles, outages, invalid outputs, injection attempts, budgets and governance/kill-switch changes. Report unresolved execution-ledger, durable evidence and commissioning prerequisites. Do not build human approval/action execution, signing or filing in AI-4.

**STOP AFTER AI-3. AI-4 requires explicit authorization.**
