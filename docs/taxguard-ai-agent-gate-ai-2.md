# TaxGuard AI — Gate AI-2 report

Date: 2026-10-08

**Status: PASS WITH RESTRICTIONS.** The server-side Governance Control Plane is implemented and tested as a policy assessment/enforcement boundary. Agents remain DRAFT in canonical/deployment metadata. No A00 dispatch, autonomous agent execution, provider activation, tax approval, authoritative mutation, signing, filing or production cutover occurred. AI-3 has not begun.

## A. Objective implemented

A governed server layer now validates agent identity and lifecycle, actor membership and assignment, exact tenant/client/case/year scope, current workflow stage, model/prompt eligibility, explicit tool/action/data/stage permissions, evidence release/provenance, approval requirements and kill switches. It fails closed on missing data, missing migrations, disabled configuration, rejected policy, replay, persistence failure or unknown policy conditions.

The available operation is a governance assessment. ADVISORY_ALLOWED means eligible for advisory work under that evaluated snapshot, not that AI has run. REVIEW_REQUIRED identifies the mandatory human path. PROPOSED_ACTION classifies the requested intent; it does not claim an ai_proposals row or a human review queue item was created. Every result says human_review_required=true, action_executed=false and external_submission_allowed=false. Approved/executed intents are rejected; there is no transferable execution permit.

## B. Architecture added/changed

- `GovernanceControlPlane`: bounded input parsing, trusted session verification, canonical identity lookup, pure fail-closed policy evaluation and transactionally audited decisions.
- `SqlGovernanceStore`: parameterized PostgreSQL loading of existing domain and AI-1 records, client/case/engagement/year assignment intersection, minimum document metadata and immutable audit snapshots.
- `PgGovernanceDatabase`: SERIALIZABLE transactions, operation advisory locks, bounded statement/connection timeouts, commit/rollback/release and no memory fallback.
- Production factory: disabled by default; requires production runtime, explicitly commissioned governance flag, DATABASE_URL, server Supabase credentials and the authoritative tenant configuration. No values or credentials are exposed. PostgreSQL transport requires verified TLS. No environment/configuration file was edited.
- Authenticated POST `/api/ai-governance/evaluate` is mounted in the existing dev and production applications. It assesses policy only; no configure/approve/execute/kill-switch mutation endpoint is provided.
- Controlled legacy adapter classifies existing counts-only advisory purposes as A34 and keeps actual dispatch blocked pending durable cutover.

There is no parallel workflow engine, calculation engine, accounting authority, agent registry or dashboard shell.

## C. Files changed in AI-2

Added:

- `src/server/ai/governance/contracts.ts`
- `src/server/ai/governance/GovernanceControlPlane.ts`
- `src/server/ai/governance/SqlGovernanceStore.ts`
- `src/server/ai/governance/productionGovernance.ts`
- `src/server/ai/governance/legacyCompatibility.ts`
- `src/server/routes/ai-governance.routes.ts`
- `supabase/migrations/20261008010000_taxguard_ai_governance_decisions.sql`
- `src/tests/aiGovernanceControlPlane.test.ts`
- `src/tests/aiGovernanceHttpAndLegacy.test.ts`
- `docs/taxguard-ai-agent-gate-ai-2.md`

Modified:

- `src/ai/types.ts` — shared governance audit row contract.
- `src/server/routes/case-authority.routes.ts` — legacy AI HTTP adapter and sanitized governance error codes.
- `src/server/productionApp.ts` and `server.ts` — protected assessment route mounting.
- `src/tests/stageTwoStorageAndAssignmentGovernance.test.ts` and `src/tests/supabaseProductionInfrastructure.test.ts` — preserve all previous migration inventory assertions and append the new eighth migration.
- `docs/taxguard-ai-legacy-mapping.md` — append AI-2 compatibility/cutover restrictions.

Existing dashboard and AI-1 changes remain preserved. Git diff against HEAD also includes earlier gates; those changes must not be mistaken for AI-2 edits.

## D. Database/schema impact

One additive transaction-driven migration creates `ai_governance_decisions`, bringing the new AI table total to 23 (22 from AI-1 plus this ledger). It has controlled decision/action states, hashed request/input/policy identities, structured policy snapshots, canonical agent/member/case references, exact scoped case validation, unique initial request keys, same-tenant/actor/request replay references, indexes and immutable UPDATE/DELETE rejection.

The ledger enforces action_executed=false and human_review_required=true. Successful assessments require canonical agent, case and policy hash. ENABLE/FORCE RLS and privilege revocation deny all anon/authenticated access, with no permissive policy. No existing RLS is weakened and no authoritative-record-writing trigger exists.

Migration files are unapplied to local Supabase and production. Tests execute all eight migrations solely in disposable PGlite PostgreSQL to validate real constraints, foreign keys, transactions and RLS. No production data query/write or paid provider call was used. A separate authorization is required for installation/cutover.

## E. A00–A60 integration

Runtime identities come from `src/ai/registry.ts`; unknown IDs and incorrect persisted category/version bindings are denied. Persisted agent and version must both be ACTIVE for eligibility, with an eligible model/prompt and nonzero budgets. The canonical seed remains entirely DRAFT with DENY permissions and no activated model/prompt. Synthetic ACTIVE configurations exist only inside disposable tests to prove authorized paths.

A00 remains inactive and cannot gain access by presenting its supervisor ID. Exact specialized names/architecture permission values remain restricted by the missing approved multipage architecture. No registry entry is claimed to be a built agent.

## F. Authorization and scope enforcement

The HTTP middleware authenticates first; the control plane independently verifies the durable session token. It does not trust body uid, role, actor, token, User object, status, approval flags, prompts or permission overrides. Actual member role/status is loaded from PostgreSQL. Clients, administrators and super administrators do not receive an implicit taxpayer-agent override.

Existing case assignment and active/effective staff assignment must both authorize the actor, exact client, engagement and tax year. Preparer/reviewer UID must match the case where those roles apply. Scope selectors must resolve to a persisted case in the session tenant. Suspended membership, inactive/future/expired assignment, wrong client/case/year, ambiguous legacy case selectors, inactive client or wrong authoritative stage denies access. Unauthorized assignments do not load private source evidence. Queries are parameterized and load no document contents or taxpayer names.

Per-role category ceilings remain conservative: preparer tax/document/accounting/advisory work; reviewer document/tax/QC support; bookkeeper document/accounting; operations client-service/practice operations; practice manager practice operations. These ceilings do not replace explicit permissions or assignment. Existing operational role capability restrictions in authentication remain intact.

Only explicitly supported advisory tool/action pairs can be assessed. UPDATE, DELETE, APPROVE, EXPORT and TRANSMIT are not authorized even with an ALLOW permission. Unknown tools/conditions, absent grants, disabled tools, disallowed data and unsupported stages deny. SYSTEM_SECRET and AUTHENTICATION_DATA are always blocked. Capability conditions support trusted role/year restrictions; caller-provided confidence/amount cannot satisfy an authorization condition.

## G. Human approval / maker-checker

All accepted assessments remain proposed/advisory and require humans. Effective risk cannot fall below agent/version/prompt/tool/permission policy or server-required approval flags. Material intent, financial context and uncertain confidence require a matching active approval policy; confidence and financial thresholds can tighten review, never grant final authority. Missing/mismatched policies deny.

Required human chain remains PREPARER → REVIEWER → CPA_EA. Cases with the same preparer/reviewer identity are rejected. The service never creates human approval or impersonates a reviewer. Existing AI-1 independent-review and credential constraints remain unchanged and pass regression. Actual human decision capture, full configurable hierarchy, identity/credential rechecking at commit and authoritative action execution remain AI-15/AI-16 work. No AI-2 result authorizes approval, signature, filing or a tax/accounting record update.

## H. Evidence / audit implementation

Evidence source IDs are selectors, not proof. Source must resolve in the exact case/year and reference a matching existing document UUID/version/hash, released/verified status and CLEAN quarantine state. Missing, changed, quarantined or cross-scope sources fail. Non-document rule/authority/calculation sources remain unverified for execution eligibility until a later verifier can validate their semantics.

No raw document, extracted financial value, source URL/reference, session token, system prompt or credential is put into the new ledger or returned by the assessment endpoint. Auditing stores hashes, scoped internal IDs and registry/policy/evidence metadata; prompt instructions and output schema are hashed. Policy snapshots are retained immutably so mutable eligibility configuration does not rewrite historical decisions.

Known-member policy denials and successful assessments commit actual ledger entries. Cross-tenant/unauthorized-scope attempts are recorded against the trusted actor tenant with no untrusted client/case claim. Missing/invalid sessions and malformed input are rejected before scoped ledger access; no audit tenant or actor is fabricated. Existing authentication security logging remains controlling for those failures. If the ledger cannot commit, no success is returned.

These records describe governance decisions, not completed AI runs. No ai_run, provider output, generated tax form, human approval, filing or executed action is fabricated.

## I. Kill-switch behavior

Each assessment freshly loads enabled persisted switches; no cached policy decision is reused. GLOBAL blocks all agents in its owning tenant; AGENT, MODEL/version, TOOL and LEGACY_18_V1 WORKFLOW/stage scopes block their matching target. Another tenant's switch does not cross tenant boundaries. No UI/configuration mutation is exposed in AI-2; activation actor/reason/state use the AI-1 foundation. Uncommissioned governance is globally unavailable through the deployment flag, without changing agent lifecycle.

In-flight provider cancellation is not claimed: no provider dispatch exists here. AI-3 must recheck governance before each future dispatch/tool operation; previous assessment IDs are not authorization tokens.

## J. Legacy compatibility

The old case AI HTTP route no longer bypasses canonical governance. Existing internal provider/helper logic and tests are retained rather than rewritten. Supported counts-only purposes classify as A34. Memory IDs cannot be treated as durable evidence IDs, and even a passing policy assessment cannot dispatch through the uncut-over memory-backed helper. Unavailable configuration/schema, missing evidence mapping and pending cutover have explicit controlled error codes.

The disabled Gemini gateway remains disabled. Fixed-sample extraction remains excluded by the existing production release boundary and continues to pass boundary tests. No old workflow is renamed, no memory state is silently copied into PostgreSQL and no provider result is replaced with synthetic success.

## K. Security tests added

109 new tests across two files cover unauthenticated/missing sessions; persisted role and super-admin denial; tenant/client/case/year isolation; effective assignment; all inactive lifecycle states; canonical identity; stage/model/prompt/budget denial; capabilities and conditions; protected data; human policy/approval flags; maker-checker; all five kill switches; evidence release/hash/version; actual immutable decision snapshots; denial audit scope; identical/altered/concurrent replay; missing schema/audit outage; RLS; malformed/browser authority and injection attempts; HTTP identity/error boundaries; assigned reviewer advisory path; legacy mapping and blocked dispatch.

Tests use real isolated PostgreSQL constraints and transactions plus synthetic sessions. HTTP authentication transport is mocked only in the dedicated HTTP suite; direct governance tests independently validate session authority and persisted membership/assignment. Multi-instance live PostgreSQL failover/commissioning is not claimed from PGlite.

## L. Full regression

Final `npm.cmd test`: **120 files / 1,981 tests passed**, including all 109 new AI-2 tests. Existing tests were preserved. Migration inventory expectations were extended, not relaxed. Routine SQL generation/encoding and test fixture isolation failures were repaired before final validation.

## M. Typecheck

`npm.cmd run typecheck`: PASS.

## N. Lint

`npm.cmd run lint`: PASS. The configured command is TypeScript `tsc --noEmit`; no separate style/security linter is configured.

## O. Production build

`npm.cmd run build`: PASS for Vite frontend and esbuild server. Existing main-chunk size and mixed static/dynamic LiveCalendarModule import warnings remain. No deployment occurred.

## P. git diff --check

PASS at delivery; new untracked AI-2 files also receive explicit trailing-whitespace checks because ordinary git diff does not include untracked files.

## Q. Git status

Branch remains `feature/taxguard-ai-agents`. Initial fetch confirmed origin/main unchanged (`origin/main...HEAD` = `0 0`). Working tree remains dirty with preserved previous gates and the listed AI-2 files, intentionally uncommitted. No files staged, committed, pushed, merged or rebased. The protected hardening backup remains untracked and untouched.

## R. Remaining restrictions / gaps

- Neither AI-1 nor AI-2 migration is installed in a live application database. The default runtime correctly returns unavailable; no memory fallback substitutes for durable governance.
- Production connectivity, TLS trust, schema installation, least-privilege server grants, SQL/Supabase tenant alignment and multi-instance isolation require separately authorized commissioning. No credentials were changed here.
- Exact architecture names/permission matrix and legacy/image workflow numbering discrepancy remain unresolved; all stage checks use existing LEGACY_18_V1 authority.
- Legacy case/evidence memory-to-durable cutover is incomplete, so public legacy AI dispatch is intentionally blocked. Internal legacy helper interfaces must remain trusted-only until governed cutover.
- Eligibility budget checks do not measure provider tokens/cost; there is no provider dispatch in this gate. Gateway usage enforcement, evaluations/monitoring and full ai_run transition ledger belong to later gates.
- Document hash/release checks are implemented; independent legal authority/calculation verification, OCR/malware commissioning and rich evidence semantics remain later work.
- Human approval records and authoritative action commits are not performed by AI-2. Human review required is an enforced boundary, not a fabricated completed approval workflow.
- Request risk/confidence/financial context can tighten policy routing; it is not verified model output or final financial authority. No score can authorize an authoritative action or a conditional capability grant.
- Auth failures cannot produce tenant-scoped audit records without a trusted identity; existing security logging applies, and future observability must retain this distinction.

## S. Exact recommendation for AI-3

Implement A00 Supervisor / Orchestrator as a server-only dispatcher/planner consuming verified user/system events. Resolve persisted case/year/stage, construct minimum authorized context, choose canonical specialized identities, and call this control plane before every dependency or tool dispatch. Denied or unavailable governance must prevent dispatch. Do not accept a prior assessment ID as a permit. Use server-generated operation IDs, correlation, monitored failure/retry policy and durable run-before-provider recording through the later ledger/gateway boundaries; do not invent execution records or peer-to-peer agent communication.

Keep production agents DRAFT and provider/action dispatch disabled while exact architecture mapping, durable case/evidence cutover and commissioning remain unresolved. Test A00 routing and refusal with explicit isolated fixtures. Do not implement or activate final review, signing, filing, tax/accounting mutation or later agent groups as part of AI-3. Any necessary ledger/gateway prerequisite must be reported as a dependency rather than bypassed.

**STOP AFTER AI-2. AI-3 requires explicit authorization.**
