# TaxGuard AI Agent Baseline — Gate AI-0

Date: 2026-10-08

**Gate result: PASS WITH RESTRICTIONS (baseline audit only).** The complete A00–A60 operating system is not implemented and is not certified production-ready. AI-1 has not begun.

## Scope and safety

This is a source-level audit against the supplied master directive and the available architecture image. The only intended change in AI-0 is this document. Existing dashboard Gates 2–8, source changes, tests and untracked assets are preserved. No implementation, migration execution, external AI call, production database query, credential inspection, deployment or Git integration was performed. The hardening backup directory was excluded from searches and was not opened or changed.

Current branch: `feature/dashboard-masterplan`. HEAD: `8e4735fb9319362c4ff3a5bfd49b9fc5a81ca6dc`. Origin: `https://github.com/OphireumTechnology/taxguard.git`. The working tree already contains substantial modified and untracked dashboard work. Local comparisons `main...origin/main` and `origin/main...HEAD` both return `0 0`; these are cached refs, not a fresh upstream verification. No fetch or branch mutation was performed during this read-only audit. Before implementation, fetch and verify upstream, preserve the existing work, and establish `feature/taxguard-ai-agents` through a safe branch strategy. Never discard, automatically stash, reset, merge or rebase the existing work.

Reference inspected visually: `design-reference/architecture-workflow.png`. It defines the shared shell, case workspace, domain services, PostgreSQL authority and the Onboard → Repeat 18-stage model. The four dashboard PNGs are available. A separately named multipage **TaxGuard AI Architecture Overview**, including page 9's exact agent permission matrix and page 10's control-center layout, was not located in the scoped repository artifact inventory. Consequently exact A01–A60 names and page-specific permission values cannot be verified. The directive's functional groupings are recorded below without inventing missing architecture details.

Search coverage included application `src`, Supabase migrations, relevant docs, development-agent configuration and reference assets. Searches for canonical A00/A60, numbered agent identifiers, agent registry, AI Control Center, `ai_agents`, `ai_runs` and kill-switch definitions did not identify the requested ecosystem. A missing optional `tools/taxguard-agent/config` directory was reported by rg; this does not affect application-source coverage. Development automation under `tools/taxguard-agent*` is not a taxpayer-serving A00 runtime.

## Executive assessment

| Area | Classification | Finding |
| --- | --- | --- |
| Server OpenAI advisory integration | Real, narrow, partially integrated | Uses the Responses SDK with minimized counts-only input, strict JSON schema, timeout, no ambiguous replay, sanitized errors and mandatory review. Not a 61-agent gateway. |
| Case-scoped proposal lifecycle | Real repository logic; durability incomplete | Authorization, evidence binding, request-start recording, proposal/review/trace writes and transaction revision controls exist, but the live global authority uses an in-memory database. |
| Intelligence governance and evidence | Real reusable domain components | Scope/reference checks, deterministic rule dependencies and proposed-only invariants exist. They are not a universal control plane enforced on every AI path. |
| Workflow and human control | Real existing authority | Stage gates, separate preparer/reviewer identities, credential checks and approval controls exist. Stage numbering conflicts with the supplied architecture. |
| Document security and OCR | Real boundaries; commissioned integration incomplete | Private storage, quarantine, scoped access and production fallback prohibition exist. Live OCR transport exists but requires commissioning and hardening. |
| Deterministic tax/accounting | Real limited modules | Calculation contracts, federal/state calculation components, bookkeeping and reconciliation exist. They do not establish comprehensive tax-law coverage or specialized-agent execution. |
| Legacy extraction | Template/mock behavior outside explicit demo folder | Fixed W-2/1099 financial values and confidence are returned based on filename/category. Must not be used as real extraction. |
| Gemini advisory route | Disabled provider boundary | Gateway always reports unconfigured and throws; not a functioning alternative provider. |
| Demo AI | Explicit simulation | `src/demo/services/DemoAIService.ts` returns deterministic simulated assistance. Not production agent execution. |
| A00–A60 registry/runtime | Missing | No canonical 61-agent registry, governed specialized execution or A00 dispatch service found. |
| AI Control Center | Missing requested functionality | Existing administrative/dashboard views are not a functional governed AI control center backed by run metrics and protected kill switches. |
| Durable AI ledger/control tables | Missing | Existing business migrations do not define the required AI registry, run, evidence, policy, review and control tables. |

No agent satisfies all the directive's definition-of-built criteria. Existing reusable services must not be relabeled as fully built numbered agents.

## Existing implementation and concrete evidence

### OpenAI and provider boundaries

`src/server/ai/OpenAIReasoningProvider.ts`:

- Supports only `REVIEW_EVIDENCE_COMPLETENESS` and `IDENTIFY_REVIEW_QUESTIONS`.
- Reads provider credentials and model from server environment; no credential values were inspected.
- Sends purpose, tax year and counts of sources/rules/findings; client identifiers and free-form taxpayer document text stay local on this path.
- Uses `store: false`, strict output schema, `max_output_tokens: 2048`, 30-second timeouts and zero SDK retries.
- Validates exact advisory output fields, lengths, confidence classifications and identifier-shaped output. Rejects incomplete/refused responses and normalizes provider failures.
- Model selection is an environment string, not an approved model registry. Instructions/schema are code constants, not governed prompt versions. Actual response token usage, provider model version, input/output hashes and cost are not captured in an `ai_run`.

`src/server/ai/TaxGuardOpenAIService.ts:16` provides `proposeDurableOpenAIReview`: loads authorized evidence, records request start before transport, prohibits replay of an already-started request, persists proposal/review provenance and records failure where possible. Its name does not prove deployed durability. The concrete repository instance determines durability. A concurrent revision change can prevent the failure write; the initial STARTED record remains unresolved.

The alternative `proposeOpenAIReview` helper checks active professional role and assigned identity, then uses static review/trace/audit services. It is an internal trusted-caller interface, not a tenant-authorized arbitrary HTTP evidence-package API.

`src/server/routes/case-authority.routes.ts:525` exposes case-scoped AI review only when `TAXGUARD_OPENAI_CASES_ENABLED` is true. `src/server/productionApp.ts` mounts case-authority routes. `server.ts:191` delegates production API requests to that app. The legacy `/api/taxguard-ai` route is mounted later in the development server but is absent from the production app's released route list; unknown production APIs fail closed.

`src/server/ai/TaxGuardGeminiGateway.ts` has `isConfigured() === false` and always throws `TAXGUARD_AI_NOT_CONFIGURED`. Its unused prompt-building code and model label are not a working provider. `taxguard-ai.routes.ts` accepts free-form body context behind a professional-role check, rather than server-loaded assigned-case context; preserve its disabled/nonreleased status until it is brought under the same governance.

### Governance, evidence and authoritative proposals

Reusable modules include:

- `src/taxguard/intelligence/ai/AIReasoningGateway.ts`: validates evidence identity, source/rule presence and provider fields; creates only `REVIEW_REQUIRED`, proposed-only advisory artifacts; cannot approve, certify, clear gates or modify deterministic results.
- `src/taxguard/intelligence/governance/IntelligenceGovernanceBoundary.ts`: rejects cross-client/engagement/year references, missing references, stale/rejected/superseded artifacts and violated AI-review invariants.
- `src/taxguard/intelligence/evidence/EvidencePackageBuilder.ts`, knowledge/rule registries, `src/taxguard/knowledge/TaxEvidenceCitationBinding.ts`: useful evidence and authority abstractions. Presence of reference IDs alone is not verification of the actual source content.
- `src/taxguard/intelligence/review/HumanReviewBridge.ts` and `src/taxguard/intelligence/trace/DecisionTraceLedger.ts`: reusable review/trace interfaces; the latter uses a static Map.
- `src/server/taxguard/authority.repository.ts:1467`: validates case identity and source/rule binding, writes `aiProposals`, `aiProviderProvenance`, `decisionTraces` and `reviewRequests` in a repository transaction.
- `authority.repository.ts:1522`: records `aiRequests` STARTED before dispatch and enforces a per-case 20/hour request limit. This is not the required queued-to-reviewed `ai_run` state machine.
- `src/server/ai/TaxGuardAiAudit.ts`: static process-memory event array with defensive reads/test clearing. Object freezing is not durable immutable audit storage.

These are substantial starting points, but no A00 dependency routing, independent verification dispatch, per-agent capabilities, governed retry policy, shared budgets, kill-switch enforcement or full execution-chain ledger exists.

### Database, authentication and authorization

Six migrations exist under `supabase/migrations`, covering core case/auth/document/audit structures, complete lifecycle, bookkeeping, practice operations, assignment governance and private-storage scope. RLS declarations and server-service policies are present. Latest private-storage migration `20261004000000_taxguard_private_storage_client_scope.sql` keeps the vault private and adds restrictive owner/tenant/client/case read policy.

`src/server/auth.ts`, `src/server/supabase-db.ts` and assignment authorization implement verified session identity, scoped client context and staff assignment checks. Dashboard roles have explicit server capability restrictions. `authority.repository.ts` independently validates scoped membership/assignment, preparer identity, reviewer separation and verified professional credentials. Role labels alone must not grant AI access to all tenant clients. Service-role database access requires server enforcement because it does not rely on end-user RLS as the sole boundary.

Critical durability evidence: `src/server/taxguard/transactionalDatabase.ts` uses `records = new Map()` and exports `globalAuthorityDatabase = new TransactionalDocumentDatabase()`. Atomic in-process snapshots do not survive process restart and do not provide distributed PostgreSQL transactions. Neither migration presence nor the term durable in tests/service names proves that this live repository is backed by PostgreSQL.

Required tables not found: `ai_agents`, `ai_agent_versions`, `ai_models`, `ai_prompts`, `ai_tools`, `ai_agent_permissions`, `ai_stage_permissions`, `ai_runs`, `ai_run_evidence`, `ai_proposals`, `ai_verifications`, `ai_human_reviews`, `ai_authoritative_actions`, `ai_security_events`, `ai_policy_events`, `ai_kill_switches`. Existing JSONB AI fields and document-style collections are not equivalent. AI-specific foreign keys, uniqueness/idempotency rules, immutable event constraints, RLS and assignment policies remain to be designed. Migration application and live database policies were not verified remotely.

### Documents and production readiness

`src/server/taxguard/ocrProvider.ts` contains local heuristic and Google Cloud Document AI providers. `ProductionOcrAdapter` rejects local/heuristic mode in production and fails when unconfigured. The cloud transport exists, but reads document content from a local filesystem path; authorized private-storage retrieval must be integrated and verified. It currently defaults missing/zero confidence to 0.95, lacks an explicit fetch timeout in that transport and permits broad processor configuration. These require scrutiny before confidence-based routing or production commissioning.

`src/server/taxguard/providerReadiness.service.ts` explicitly reports no verified production malware scanner transport and retains quarantine. Configuration/readiness labels must not be treated as completed execution or evidence of provider health.

`src/server/taxguard/accountingDocumentIntelligence.service.ts` implements classification/extraction envelopes, duplicate fingerprints, relationships, confidence routing and batch/review logic, but its stores are Maps. It is partial document-domain infrastructure, not durable A05–A11 execution.

**High-priority legacy hazard:** `src/server/aiExtraction.ts:70` generates fixed sample financial fields and confidence based on document filename/category rather than extracting verified content. `src/server/routes/documents.routes.ts:291` and `:457` call it. Those legacy document routes are not mounted in the released production app, but this remains application code outside `src/demo`; do not route production uploads through it. Advisory notices do not make fabricated values acceptable.

`src/demo/services/DemoAIService.ts` is intentionally simulated. Local heuristic OCR is development/test functionality. Accounting connector code includes nonproduction sample behavior and incomplete live connector implementations; provider flags do not prove real authorized retrieval.

### Deterministic engines and human control

Reuse `src/taxguard/calculation/TaxCalculationContract.ts`, `TaxYearCalculationRegistry.ts`, `Federal1040AgiCalculation.ts`, `Federal1040RemainingCalculations.ts`, state calculation architecture and server bookkeeping/reconciliation services. They provide deterministic logic and traceable contracts, not comprehensive verified jurisdiction/year coverage. Future tax agents must resolve supported rule packs and refuse unsupported facts/years instead of using LLM arithmetic or guessing authority.

Existing authority supports preparer certification, reviewer approval, credentials, exception controls and server stage gates. Reviewer dashboard mutations are production-restricted when no durable repository capability exists. Material AI output remains a proposal; confidence does not grant approval. The configurable preparer → reviewer → CPA/EA policy layer requested for all agents is not implemented universally. Signing/filing lifecycle entities and gates exist, but an authorized provider plus durable signatures, approval and immutable evidence are not demonstrated by this audit. No direct LLM submission path should be added.

## Workflow discrepancy requiring resolution

The inspected image expects 01 Onboard, 02 Collect, 03 Validate, 04 Record, 05 Categorize, 06 Reconcile, 07 Analyze, 08 Adjust, 09 Summarize, 10 Prepare, 11 Review, 12 Quality Check, 13 Approve, 14 Sign, 15 File, 16 Deliver, 17 Close, 18 Repeat.

Existing `src/server/taxguard/persistence.types.ts:29` defines 01 Onboard, 02 Collect, 03 Validate, 04 Record, 05 Reconcile, 06 Review, 07 Report, 08 Plan, 09 Prepare Taxes, 10 Approve, 11 Sign, 12 File, 13 Government Feedback, 14 Resolve, 15 Monitor, 16 Archive, 17 Renew, 18 Repeat.

Do not apply architecture stage numbers directly to existing permission checks. Do not silently rename persisted stages or create a second state machine. Before stage-permission implementation, document an approved compatibility mapping or separately authorized migration plan preserving gates, audit interpretation, existing dashboards and historical records.

## Agent group baseline

| Requested agents | Existing foundations | Missing before any agent is BUILT |
| --- | --- | --- |
| A00 | Case authorization, provider helper, server gates | Supervisor registry, dispatch, authorized context construction, dependency routing, monitored execution and governed failure/review chain |
| A01–A04 Client Services | Onboarding, requests, communication and appointment services | Exact architecture identities, scoped agent handlers, prompts, permissions, structured proposals and durable runs |
| A05–A11 Document Intelligence | Quarantine/private storage, OCR adapter, extraction envelopes, duplicate/evidence services | Governed ordered pipeline, durable evidence/run links, commissioned transports, injection regressions and human field validation integration |
| A12–A16 Accounting | Bookkeeping, journal/reconciliation, adjustments, book-to-tax contracts | Versioned agent execution around existing deterministic services; explicit proposal versus authorized mutation |
| A17–A31 Tax Intelligence | Authority/rule registries, federal/state calculation and draft/form structures | Full exact-agent mapping, governed research, supported rule packs, independent calculation verification, verified form mapping and diagnostics |
| A32–A35 Risk/QC | Exceptions, governance validation, reviewer queues | Independent governed verification agents, materiality policies and durable PASS/REVIEW/EVIDENCE/BLOCK/ESCALATE evidence |
| A36–A42 Sign/File/Resolve | Lifecycle records, signature/filing gates, government feedback/resolution | Governed readiness/coordinator agents and commissioned external provider; transmission remains blocked until all prerequisites are verified |
| A43–A50 Practice Operations | Request/task/communication/billing/deadline/report services and dashboards | Assigned-scope agents, durable execution, audited authorized actions; no autonomous client contact |
| A51–A60 Governance/Security/Platform | Security events, audit/retention/provider readiness, access restrictions | Independent monitoring agents and immutable policy/security events; no self-modifying monitored policy |

## Control-plane gap inventory

Missing canonical registries: agent versions and full metadata; model approval/version/use/data limits; prompt versions and schemas; tools/capabilities; explicit ALLOW/DENY/CONDITIONAL action matrix; per-agent data classes; stage eligibility; confidence/materiality/human-review policy; shared token and cost budgets; evaluations and deployment eligibility.

Missing operational controls: global/agent/model/tool/workflow kill switches with authenticated actor/reason/security event; active-run cancellation policy; structured orchestrated communication; enforced context minimization on every path; independent evidence verification; authoritative action service consuming approved immutable proposals; durable escalation/retry tracking; actual usage/cost/latency/approval metrics and permission-protected AI Control Center controls.

No supported live metrics justify showing 61 active/built agents, generated execution histories or successful agent statuses. Until durable data exists, the future control center must show NO DATA or unavailable states.

## Security risks and priorities

1. **Blocker: durability and audit authority.** Replace/integrate the live in-memory authority through an approved durable adapter before representing AI requests, approvals or financial changes as persistent. Do not remove existing fail-closed production restrictions.
2. **Blocker: absent per-agent governance.** New handlers must not reach providers, tools or authoritative mutation except through A00 and server-controlled policies.
3. **High: fabricated extraction outside demo.** Keep legacy template extraction unreachable from production; isolate/remove it in an authorized future gate and test fallback prohibition.
4. **High: workflow mismatch.** Resolve semantics before any AI stage policy or W-2 orchestration.
5. **High: evidence and prompt injection.** Existing OpenAI counts-only minimization is strong for its limited purpose. Regex secret filtering and advisory prompt text do not establish general injection resistance or proof of evidence. Uploaded content must never select tools, permissions, prompts or actions.
6. **High: mutable/process-local history.** Arrays/Maps and test clearing APIs do not establish immutable production history. Durable ledger must retain append-only transition/review evidence and preserve failed/ambiguous runs.
7. **High: provider readiness versus execution.** Configuration flags, OCR confidence defaults and transport scaffolds must not become successful task evidence. Require verified transport and authorized document retrieval.
8. **Required: role/service boundaries.** Retain backend assignment, tenant/client/case/year isolation and maker-checker controls for every tool and proposal application; verify legacy administrative overrides cannot bypass material-action policies.

These are source findings, not claims that production has been exploited or a complete penetration test has passed. No secrets were inspected or changed.

## Testing baseline and missing coverage

Existing suites include `taxGuardOpenAIIntegration.test.ts`, `intelligenceCoreAIReasoningGateway.test.ts`, `intelligenceCoreGovernanceBoundary.test.ts`, `taxAIKnowledgeBoundary.test.ts`, `intelligenceCoreHumanReviewBridge.test.ts`, `taxHumanReviewAuditIntegration.test.ts`, `durableAuthority.test.ts`, `caseAuthorityHttp.test.ts`, `accountingDocumentIntelligenceAgent.test.ts`, `productionDocumentIntelligence.test.ts`, calculation/state tests, storage/assignment/isolation tests and dashboard authorization suites.

The OpenAI suite injects mocked Responses transport and tests counts-only input, schema rejection, unavailable provider, sanitized failures, timeout, advisory output and role/assignment restrictions. This is meaningful contract/security coverage, not proof of a paid live provider integration. The durable-authority suite uses an in-memory transactional test database; persistence across repository instances is not persistence across process restart/PostgreSQL failover.

Missing ecosystem tests: all 61 IDs/versions; A00 routing/dependency chain; unknown/disabled agents; model/tool/workflow/global kill switches; per-agent tool/data/stage permissions; cross-tenant/client/case assignment denial through orchestration; prompt injection across documents/email; hallucinated/missing evidence; financial materiality and confidence review routing; self-approval; timeout/retry/token/cost exhaustion; durable run-before-provider recording and immutable transitions; restart/recovery; authoritative-action authorization; production fallback prohibition throughout; W-2 full chain with staff and human reviewer gates. Existing partial tests should be retained and extended, never replaced by registry-count assertions alone.

## W-2 integration status

No end-to-end A05 → A06 → A07 → A08 → A10 → A11 → staff review → A18/A19 → deterministic calculation → A28/A30/A31/A34 → human reviewer → authoritative record → audit-ledger integration was found. Existing intake, extraction, rules, evidence and review components provide reusable pieces. The fixed-value legacy W-2 template is not an acceptable reference integration. Future tests must use explicit synthetic test fixtures, private-source provenance, controlled provider transports, independently verified calculations and audited human authorization.

## Gate plan and readiness

AI-0 is complete as a restricted source baseline. AI-1–AI-20 remain unauthorized and unimplemented by this task. Follow the supplied sequential gates: database/registries; control plane; A00; gateway/model/prompts; permission tools/data; run ledger; each agent group; human authorization; authoritative actions; W-2; control center; adversarial tests; full validation. Each gate must stop for explicit authorization.

Before AI-1: safely establish the dedicated branch without losing dashboard work, fetch/verify upstream, confirm exact architecture agent names/permission matrix, and design durable registry/schema isolation. Do not execute production migrations. The workflow discrepancy must be resolved before stage policy or agent dispatch relies on its numbering.

## Validation and change report

- Source audit and architecture-image inspection completed; no application source or schema edits made for AI-0.
- Tests/typecheck/lint/build were not rerun during this read-only baseline. Prior gate results are not represented as fresh AI-0 validation, and no external provider or production database validation was performed.
- Configured commands: `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run build`. Lint currently aliases `tsc --noEmit`; it is not a separate stylistic/security linter. Build creates Vite frontend and bundled server artifacts.
- `git diff --check` passed during the audit. Final documentation/Git checks are reported with delivery.
- Existing working tree remains dirty with dashboard changes and untracked references/reports/components/tests. The additional AI-0 artifact is `docs/taxguard-ai-agent-baseline.md`.
- No commit, push, merge, rebase, reset, clean, deployment, production migration/data write, secret/configuration change or backup access.

**STOP: Gate AI-1 requires explicit authorization.**
