# TaxGuard AI - Gate AI-4 report

Date: 2026-10-08

## A. Status

**PASS WITH RESTRICTIONS.** Implemented the server-only governed gateway infrastructure and isolated transport integration. Deployment A00-A60 registrations remain DRAFT. No production provider, agent activation, migration installation, taxpayer data transmission or authoritative action is enabled.

## B. Complete changed-file inventory

Added:

- `src/server/ai/gateway/GovernedAIGateway.ts`
- `src/server/ai/gateway/ModelPromptResolver.ts`
- `src/server/ai/gateway/contracts.ts`
- `src/server/ai/gateway/structuredOutput.ts`
- `src/server/ai/gateway/usage.ts`
- `src/server/ai/gateway/SqlGatewayStore.ts`
- `src/server/ai/gateway/OpenAIProviderAdapter.ts`
- `src/server/ai/gateway/a00GatewayBoundary.ts`
- `supabase/migrations/20261008030000_taxguard_ai_gateway_admission.sql`
- `src/tests/aiGovernedGateway.test.ts`
- `docs/taxguard-ai-agent-gate-ai-4.md`

Modified:

- `src/server/ai/governance/GovernanceControlPlane.ts` - server-only fresh execution inspection returns trusted identity, audited decision and authorized registry snapshot; existing assessment responses are preserved.
- `src/server/ai/OpenAIReasoningProvider.ts` - adds isolated governed transport compatibility method; preserves legacy reason() behavior and restrictions.
- `src/ai/types.ts` - run usage/cost support NULL for unknown accounting.
- `src/tests/stageTwoStorageAndAssignmentGovernance.test.ts` - appends the tenth migration without removing prior inventory assertions.
- `src/tests/supabaseProductionInfrastructure.test.ts` - appends the tenth migration without removing prior inventory assertions.
- `docs/taxguard-ai-legacy-mapping.md` - records gateway compatibility and remaining cutover.

Other dirty dashboard/AI-1/AI-2/AI-3 files predate this gate and remain preserved.

## C. Gateway architecture

`GovernedAIGateway` independently resolves current authorization/configuration, admits a durable run and budget reservation, records an attempt, revalidates before invocation, validates provider output/accounting, revalidates before acceptance, and persists the outcome before returning advisory success. There is no browser execution endpoint, live factory or production adapter registration. Default construction has no transport. Adapter injection requires NODE_ENV=test, and dispatch rechecks that boundary.

Only the two previously mapped A34 review purposes are supported. The provider request contains purpose, tax year and evidence count. It contains no tenant/client/case/user IDs, document identifiers/content, tools, endpoint or credential. This gate is infrastructure, not a completed specialist ecosystem or a new calculation/workflow authority.

## D. Model/prompt governance

`ModelPromptResolver` obtains authoritative identity and fresh AI-2 policy assessments, including the narrow A00 coordinator assessment and independent A34 child assessment. Agent/version/model/prompt bindings, lifecycle, purpose, effective date, budgets and data permissions remain controlling. Input cannot override model, prompt, instructions, endpoint, scope authority, permissions or tools.

Resolved provenance includes exact agent/model/prompt versions and binding/input/prompt/schema hashes. The binding covers scope, purpose, stage and exact evidence version/hash. Caller context is copied before asynchronous work; subsequent caller mutation cannot change the admitted request. Prompt requirements outside the three minimized input keys are rejected. A trusted enforced advisory boundary is appended to versioned instructions and included in the effective prompt hash.

Existing version-in-use protection freezes model/prompt/agent versions once a run references them. Production configuration is not seeded or modified.

## E. Provider adapter architecture

`ProviderAdapter` has a bounded request, AbortSignal, explicit completion/refusal/incomplete state, text and nullable transport usage. It has no tool or database capability. Test registrations accept only TEST and OPENAI provider identities.

`OpenAIProviderAdapter` uses the existing provider's new governed method with an injected SDK double, trusted request model/instructions/schema, store=false, max_output_tokens and maxRetries=0. No API key is read/created by this governed method and no SDK/client dependency is upgraded. Unexpected tool output is treated as incomplete, not executed. Provider errors are sanitized.

The legacy environment-selected model and hardcoded legacy prompt remain unchanged inside the existing restricted legacy method. They are not the governed model/prompt authority. The compatibility transport follows the installed SDK types and [official OpenAI Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses); local validation is still mandatory.

## F. A00 integration

`createA00GatewayHandler` keeps the initiating token in a trusted server closure. Children receive metadata only, never the token. The gateway reauthorizes regardless of the parent assessment or supplied correlation IDs. Its returned finding codes are the actual validated advisory codes, not fabricated verified findings or manufactured numerical confidence.

Gateway failures are not A00 RetryableAdvisoryError, preventing outer retries from multiplying provider attempts. The existing production-default A00 remains without handlers; the integration is exercised solely through explicit isolated test handlers.

## G. Authorization enforcement

Fresh durable-session authority, current membership/role, effective assignment, tenant/client/case/year intersection, persisted stage, agent lifecycle, exact advisory capabilities, data/evidence policies, human requirements and kill switches are checked at admission and execution/acceptance boundaries. A00 receives only its existing coordination capability and cannot grant child access.

Root/operation/assessment IDs are validated for trusted actor, scope, stage, canonical child and existing reserved orchestration operation. They are correlation selectors, never reusable authorization permits. Forged IDs, missing grants and unknown configuration fail with zero provider/tool calls. Denied budget/correlation admissions also record safe policy events; audit failure prevents success.

## H. Evidence/provenance

Reuse AI-2 exact scoped source/document UUID, version/hash, release and CLEAN-quarantine checks. A run references actual authorized sources through ai_run_evidence foreign keys, without copying extracted values or document text. Sources are checked again before accepting output; changed or cross-scope evidence blocks continuation.

Provider output cannot supply evidence, taxpayer facts or tax/legal authorities. Independent verification of AUTHORITY/CALCULATION/RULE sources remains unavailable and denied. Provenance source IDs are server-supplied links, not claims that the model examined document contents.

## I. Structured-output behavior

This gate supports one explicit counts-review schema profile, resolved from the trusted versioned prompt: ADVISORY status, UNVERIFIED confidence and bounded REVIEW_REQUIRED/EVIDENCE_REQUIRED codes. Other schemas are unavailable, not interpreted loosely. Local validation rejects extra fields, malformed/truncated JSON, numerical confidence, invented authorities/evidence, approval, filing, payment, signature and tool instructions. NO_FINDING is deliberately unsupported for counts-only evidence.

This is a narrow gateway integration contract, not a general JSON Schema engine or legacy prose-to-verified-finding converter. No verified confidence score or successful quality check is manufactured. Untrusted document/OCR/email text is never accepted in this gateway profile; prompt-injection tests verify structural isolation rather than claiming complete semantic LLM protection.

## J. Usage/budget controls

Versioned `ai_model_pricing` records contain approved currency, per-token integer USD nanodollar rates, bounds, authority reference, effective date and status. No real pricing is invented or seeded; all active rates used in validation are explicitly synthetic isolated-test rates. Pricing becomes immutable after use.

Admission reserves configured worst-case input/output tokens and cost under a tenant budget transaction/advisory lock. Both tenant/agent-version and tenant/model-version aggregate limits include outstanding reservations and measured terminal consumption. A conservative input byte guard and provider output cap bound requests; actual returned usage is independently checked for consistency/limits. These are not a commissioned production tokenizer/context guarantee.

Transport usage is distinct from model-generated text. Cost uses exact BigInt arithmetic and the approved CONFIGURED_UPPER_BOUND rates, not claimed final provider billing or a payment. The legacy numeric run cost is conservatively rounded upward to eight decimals; the gateway outcome retains exact nanodollars and pricing provenance. Cache/provider discount reconciliation is not claimed.

Missing/inconsistent usage produces UNKNOWN with NULL input/output/total/cost. Unknown terminal outcomes retain the reservation and block further admissions to that tenant/model-version budget. Definitely not-sent attempts may record known zero consumption; ambiguous failures never receive zero. Outstanding admissions without final accounting retain their full reservations and cannot be replayed; reconciliation/recovery is later work.

## K. Retry/replay/idempotency

One gateway admission is permitted per child operation. Existing A00 root replay rejection is preserved. Attempts have distinct UUIDs and ordered bounded attempt numbers; SQL requires a preceding nonterminal NOT_SENT outcome before retry. Only the adapter's explicit conclusively-not-sent error is retryable. Timeout, cancellation, generic transport failure, rate/connection ambiguity and invalid output are not retried automatically. A00 cannot create a second transport run using an outer retry.

Configured model fallback is not automatically selected, even after provider failure. Future fallback commissioning must independently authorize the model/prompt/data/budget path. Provider idempotency is never assumed.

## L. Kill switches

GLOBAL, AGENT, MODEL, TOOL and LEGACY_18_V1 WORKFLOW switches are freshly assessed before admission, invocation, retries and output acceptance. Changes during admission or transport block subsequent work. AbortSignal is propagated and late output is rejected; cancellation cannot reverse information already transmitted and cannot force a noncooperative provider to terminate. No kill-switch management UI/API is introduced.

## M. Database/schema changes

One additive transactional migration adds four tables: ai_model_pricing, ai_gateway_admissions, ai_gateway_attempts and ai_gateway_outcomes. AI tables total 29. These are minimum pricing/reservation/transport records, not the complete AI-6 ledger.

Existing ai_runs is used for durable QUEUED admission before transport, RUNNING attempt projection and REVIEW_REQUIRED/FAILED/CANCELLED terminal gateway projection. Unknown token_usage/estimated_cost are now nullable and have no zero default; existing recorded values are unchanged. The shared run contract is updated accordingly. No schema change weakens identity, scope, human-review or authoritative-action controls.

Composite foreign keys and triggers validate root/run/actor/scope/stage/decision/pricing linkage, reserved amounts, ordered attempts, terminal history, and unknown/known accounting shape. New histories are append-only. All four tables ENABLE/FORCE RLS and revoke PUBLIC/anon/authenticated privileges, with no permissive policy. No triggers write authoritative tax/accounting records.

All ten repository migrations were executed solely in disposable PGlite databases with synthetic sessions/domain data. No local persistent Supabase or production migration was applied. No live provider or production data was used.

## N. Tests added

99 tests cover authentication/role/assignment and tenant/client/case/year/stage isolation; DRAFT/disabled agents; parent/child capabilities; human policy/maker-checker; exact evidence; caller model/prompt/endpoint/tool/identity overrides; forged correlation; injection/unsafe output; all five kill switches and boundary changes; pricing/budget admission and concurrent reservation; replay; safe/ambiguous retries; timeout/cancellation; refusal/incomplete output; unknown/inconsistent/over-limit usage; exact synthetic cost; immutability/RLS/orphans; audit failures; A00 integration; preserved legacy/DRAFT/default release boundaries; configured-fallback refusal; and OpenAI SDK-double compatibility. Execution denials assert zero provider/tool calls.

Existing AI-1/AI-2/AI-3 tests and legacy provider regressions are preserved. Targeted AI-1 through AI-4 validation passed before full regression; final full regression includes the last SQL/accounting/refusal refinements.

## O. Total regression results

Final npm.cmd test: **122 files / 2,163 tests passed**, including all 99 AI-4 tests. No existing test was removed or disabled. Initial test-fixture TypeScript mock/readonly typing issues were repaired without relaxing assertions.

## P. Typecheck/lint/build/diff results

- Typecheck: PASS.
- Configured lint: PASS; the configured command is tsc --noEmit, not a separate style/security linter.
- Frontend/server production build: PASS.
- git diff --check and explicit new-file whitespace checks: PASS.

Existing frontend chunk-size and mixed static/dynamic LiveCalendarModule import warnings are unrelated and remain documented. No deployment occurs.

## Q. Security guarantees preserved

Existing authentication, backend authorization, RBAC/RLS, private documents, tenant/client/case/year isolation, effective assignment, canonical namespace, human review and maker-checker controls remain intact. No browser-supplied identity is trusted. No API key/service-role credential, raw document, taxpayer identifier or provider error body is exposed through the gateway.

The authoritative Stage 01-18 engine and LEGACY_18_V1 numbering are unchanged. Gateway execution cannot advance stages, contact clients, approve, sign, file, authorize payments or mutate tax/accounting records. Audit records remain separate from human decisions and authoritative actions.

## R. Remaining restrictions/gaps

- No production gateway factory/handler/dispatch endpoint exists; successful execution is isolated-test-only. No agent is claimed built because the transport works.
- Live schema installation, least-privilege grants, TLS/tenant alignment and production provider credentials/model/prompt/pricing approvals require separate commissioning.
- Exact specialist architecture mappings, legacy stage-semantic discrepancy and memory-to-durable case/evidence cutover remain unresolved.
- Full AI-6 transition history, complete intermediate assessment correlation, recovery/lease management, usage reconciliation and monitoring are not implemented by this minimum gateway contract.
- Accepted results are advisory codes and hashes, not generated tax forms, a populated human review queue or authoritative proposals/actions. Human decision/action services remain AI-15/AI-16.
- Semantic evidence validation, production tokenizer/context support, broader output schemas, provider discount billing reconciliation, approved fallback execution and complete prompt-injection evaluation remain later work.
- Fresh assessments are snapshots. Atomic admission relative to concurrent policy changes, distributed dispatch fencing, live PostgreSQL concurrency/failover and crash recovery must be proven before production transport. PGlite tests do not establish those deployment guarantees.

## S. Exact production-blocked items

All A00-A60 activation; live provider calls; unrestricted tools/function calling; raw taxpayer-content transmission; legacy public dispatch/cutover; fixed-sample extraction release; autonomous communications; tax/accounting mutation; approval; signature; filing; payment authorization; workflow advancement; production migrations and deployment remain blocked.

## T. Git status

Branch: feature/taxguard-ai-agents. Pre-implementation fetch confirmed origin/main...HEAD = 0 0. Working tree remains intentionally dirty with preserved prior gates and AI-4 files, uncommitted and unstaged. No push, merge, rebase, deployment, secret change or production mutation. Protected hardening backup contents were neither inspected nor modified.

## U. Recommended Gate AI-5 scope

Build the explicit server-side tool/data capability boundary on existing permission schemas and this gateway: trusted scoped context loading, narrow handlers, bounded inputs/outputs, independent per-tool authorization, evidence/provenance, kill-switch checks and immutable denials. Keep mutations and external actions disabled. Resolve required execution-ledger dependencies explicitly rather than bypassing AI-6 or claiming commissioned production execution. Broader agent capabilities remain later gates.

## V. Agent lifecycle recommendation

**NO lifecycle change.** All deployment agents remain DRAFT. Synthetic ACTIVE agents/models/prompts and prices exist only in disposable tests. Infrastructure completion is not sufficient evidence to commission any specialist or production supervisor.

**STOP AFTER AI-4. AI-5 requires explicit authorization.**
