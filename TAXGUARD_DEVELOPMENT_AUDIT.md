# TaxGuard local development audit — 2026-09-28

## Scope and repository status

Branch: `taxguard-m17-ai-tax-preparation-agent`; inspected status and ten latest commits before edits. Initial HEAD: `9179ede`. Baseline independently reproduced: **50 files, 710 tests passing**. No commit, push, deployment, migration, filing, or live AI request was performed.

Pre-existing package.json/package-lock.json changes and the three untracked development/inventory files were preserved. The package change adds OpenAI; the lockfile also contains substantial pre-existing dependency changes. Those changes were not attributed to this milestone. No AGENTS.md was found by the repository inventory search.

This is a repository implementation audit, not an attestation of operational readiness or legal accuracy. Inventory covered src/server and frontend architecture; targeted implementation reads and regression tests covered the requested governance subsystems. External services, professional credentials, source authority currency, and deployed configuration were not independently verified.

## Architecture discovered

- React 19/Vite frontend: public site, client/staff portals, separate demo application, and TaxGuard workspaces. Numerous screens consume synthetic records or local services.
- Express `server.ts` mounts authentication, intake, documents, accounting, calendar, payments, integrations, TaxGuard, AI, and live-workflow routes. Vite middleware serves development; production serves dist.
- `src/server/auth.ts` implements session authentication against the in-memory db, PBKDF2 password hashing, roles, tenant/client checks, and practitioner/maker-checker middleware. Firebase Admin is separately integrated. This is not one uniformly durable identity/authorization system.
- `src/server/db.ts` uses maps and seed records. `LiveWorkflowRepository` uses Firestore and transactions for stages 1–3. Its stage-three transition explicitly leaves stage 4+ to a later milestone.
- `AIReasoningGateway` already supplies `AiReasoningProvider`, validates evidence packages, copies bindings, and forces `REVIEW_REQUIRED`/proposed-only output. The Gemini proposal HTTP route is a separate existing advisory route. `aiExtraction.ts` also calls Gemini; browser `TaxGuardAssistantService` uses a built-in knowledge base.
- Decimal-based deterministic federal calculations, tax-year registries, income/AGI/remaining calculations, and federal preparation/version/review modules exist. State modules implement fact validation, federal dependencies, rule packs, definitions, and preparation contracts; these are not proof of comprehensive verified state coverage.
- Authority/rule registries, applicability and conflict engines, citation binding, evidence packages, professional exception review, provenance integrity, human-review bridge, decision approval orchestrator, and append-only trace API contain substantive validation logic. Much of their storage is process-local. Browser audit storage is localStorage; the new AI audit retains the existing in-memory sink.

## Eighteen-stage implementation matrix

Stage names follow the actual 18-stage sequence in `src/demo/lifecycleMockData.ts:491`, rather than the separate ten-state return-review sequence. COMPLETE would require an integrated, durable end-to-end implementation; none was established by this audit. PARTIAL means real logic exists, with missing integration or operational controls. LIVE-INTEGRATION-REQUIRED identifies an external-service gate, not a claim that all local prerequisites are complete.

| # | Stage | Classification | Verified implementation and remaining work |
|---|---|---|---|
| 1 | Onboard | PARTIAL | Onboarding services, UI, authentication and server gate exist; unify durable identity, engagement and consent records. |
| 2 | Collect | PARTIAL | Collection, requests, security checks and server gate exist; scanner hooks and some file payloads are simulated. Connect real malware scanning and managed durable encryption/storage. |
| 3 | Validate | PARTIAL | Deterministic validation, evidence/review/exception modules and server gate exist; connect authoritative durable evidence, reviews and assignments. |
| 4 | Record | PARTIAL | Intake/accounting staging and journal interfaces exist; implement durable posted records and server stage transition. |
| 5 | Reconcile | PARTIAL | Reconciliation models and accountant workflows exist; validate real bank/ledger imports and authoritative completion. |
| 6 | Review | PARTIAL | HumanReviewBridge, approval orchestrator and exception review exist; persist independent reviewer assignment, credentials and decisions. |
| 7 | Report | SIMULATED | Demo financial/report/export screens exist; bind delivered reports to approved durable records and versions. |
| 8 | Plan | PARTIAL | Strategy UI, built-in assistant and scenario logic exist; professional verification, current authority, evidence and durable approval remain. |
| 9 | Prepare Taxes | PARTIAL | Federal 1040 decimal calculations, registry/preparation and state contracts exist; integrate supported forms, verified rule packs and persistent case preparation. |
| 10 | Approve | PARTIAL | Maker-checker, professional/final internal approval and provenance checks exist; remove remaining trust in caller-supplied identity/preparer fields and persist approvals. |
| 11 | Sign | LIVE-INTEGRATION-REQUIRED | Internal consent/version/signature controls exist; no verified live signature workflow established. |
| 12 | File | LIVE-INTEGRATION-REQUIRED | External submission remains disabled; certified transmitter integration and authorization required. |
| 13 | Government Feedback | LIVE-INTEGRATION-REQUIRED | Synthetic acknowledgements and simulator capabilities exist; authenticated agency acknowledgements and idempotent processing required. |
| 14 | Resolve | PARTIAL | Internal exception/conflict resolution exists; government-notice workflow is demo-oriented and needs durable evidence and professional handling. |
| 15 | Monitor | SIMULATED | Demo compliance/payment/refund monitoring records exist; connect authoritative status feeds, scheduling and alerts. |
| 16 | Archive | SIMULATED | Vault/archive UI exists; enforce retention, immutable storage, legal hold, access review and restore testing. |
| 17 | Renew | SIMULATED | Lifecycle/demo renewal records exist; durable next-year engagement/consent/billing workflow required. |
| 18 | Repeat | SIMULATED | Demo cycle-reset representation exists; implement server-governed new-year rollover and prior-year linkage. |

## Bugs fixed and features implemented

1. Added server-only OpenAI provider implementing the existing provider interface; no duplicate calculation or approval architecture.
2. Added strict Responses JSON schema and independent runtime validation, refusal/incomplete handling, safe typed error codes, explicit model selection, 30-second deadline, and zero automatic retries. Rate limits fail safely; no provider fallback silently retransmits a request.
3. Privacy by construction: only an allowlisted purpose, tax year, and artifact counts leave the OpenAI adapter. All IDs, source documents, free text, names, bank data, tokens and taxpayer values are omitted. `store:false`; no prompt/body logging. This intentionally supports review checklists only, not case-specific tax advice or authority verification.
4. Server service connects AIReasoningGateway to HumanReviewBridge, DecisionTraceLedger and audit metadata. Active assigned professional required; administrative override is not accepted. Review/provenance failures prevent a successful proposal response.
5. Gemini advisory route now restricts roles, rejects inactive accounts, records the authenticated actor, and sanitizes returned errors. Shared policy validates runtime field shapes, risk enum, aggregate size and common sensitive identifiers/secrets. Gemini direct provider calls now apply that policy too. Regex protection is not a universal free-text PII detector.
6. Shared reasoning gateway rejects invalid confidence values and malformed advisory arrays.
7. Removed XOR masking mislabeled as AES-GCM. Encryption now uses non-extractable Web Crypto keys; missing crypto, authentication failure, wrong document binding and malformed metadata fail closed. Keys remain development-ephemeral; this is not production KMS. Old simulated ciphertext is not migrated or silently accepted.
8. Blocked serving `.cjs` and `.map` artifacts from production dist, including encoded/case variants. The build currently colocates the server bundle and public assets.

## OpenAI activation status and stopping gate

The local provider/service integration is implemented and tested with mocked SDK transport. Set server-side `OPENAI_API_KEY` and explicitly select `OPENAI_MODEL` for an approved model. Supported purposes: `REVIEW_EVIDENCE_COMPLETENESS`, `IDENTIFY_REVIEW_QUESTIONS`. No browser environment key was added. Implementation follows [OpenAI structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs) and the installed SDK's timeout/retry API.

**No OpenAI case HTTP route is activated.** The existing `/api/taxguard-ai/propose` route remains Gemini. EvidencePackageBuilder creates artifacts but has no trusted durable server repository to load them by authorized assignment. The new service accepts only trusted server-loaded actor/package/assignment inputs; passing HTTP bodies directly would be unsafe. Its human review and ledger integration are process-local. Health reports for the existing route still describe Gemini.

Next material architecture decision: connect these existing contracts to Firestore-backed evidence, assignment, review and trace repositories, with transactional/idempotent writes and access-control tests. Do not fabricate evidence packages, accept browser-supplied source IDs as verified authority, or call the new service directly from an untrusted request. This gate prevents claiming production readiness.

## Security findings still open

- Existing practitioner middleware uses a denylist; generic role middleware includes a super-admin override. Maker-checker defaults can take preparer identity from a request. Audit all approval endpoints against stored preparer identity and independently verified professional credentials.
- Durable audit and review are missing for much of the domain layer; process-local maps and localStorage are not tamper-resistant audit storage.
- `aiExtraction.ts` remains a separate Gemini extraction path and needs its own PII/data-consent and malformed-output audit. The new OpenAI adapter never calls it.
- Malware scanning and some integrity/file-data paths are simulated. Development encryption keys are lost across process/page lifetime. No production key migration or KMS integration was attempted.
- Model text remains unverified advisory content even when schema-valid. No fabricated citation can become a registered verified authority through this new service, but human review must still assess the prose.
- Distribution/CDN configuration must independently exclude server artifacts if dist is hosted outside Express.

## Dependencies and validation

Installed OpenAI SDK: 7.23.0; TypeScript 5.8.3; Vite 6.4.3; Vitest 5.0.0. No dependency files were changed by this milestone. `npm ls --depth=0` reported extraneous `@emnapi/runtime` and `@img/sharp-wasm32`; they were preserved. Offline npm audit reported zero cached findings; this is not a fresh online vulnerability assessment. The lockfile includes deprecated optional uuid dependency metadata.

PowerShell execution policy blocks npm.ps1; checks use the equivalent `npm.cmd` executable. Final quality gates: **53 test files, 765 tests passing (55 added)**; `npm.cmd run lint` (TypeScript noEmit) passed; `npm.cmd test -- --run` passed; `npm.cmd run build` passed; `git diff --check` passed; final status inspected. Diff and security review completed for this milestone. Frontend asset search found no `OPENAI_API_KEY` or `api.openai.com` references. Build retains an existing oversized main frontend chunk warning (~2.33 MB minified); correctness work took priority over splitting it.

New tests cover provider payload minimization/configuration/schema/refusal/incomplete/error behavior, authorization and assignment, review/trace binding, failure-safe review escalation, shared policy shapes/secrets/size, authenticated encryption tamper/document binding, and protected static artifacts.

## Changed files

- `src/server/ai/OpenAIReasoningProvider.ts` (new)
- `src/server/ai/TaxGuardOpenAIService.ts` (new)
- `src/server/ai/TaxGuardAiAudit.ts`
- `src/server/ai/TaxGuardAiPolicy.ts`
- `src/server/ai/TaxGuardGeminiGateway.ts`
- `src/server/ai/index.ts`
- `src/server/routes/taxguard-ai.routes.ts`
- `src/taxguard/intelligence/ai/AIReasoningGateway.ts`
- `src/services/stageTwoIntakeSecurityService.ts`
- `src/server/staticAssetPolicy.ts` (new)
- `server.ts`
- `src/tests/taxGuardOpenAIIntegration.test.ts` (new)
- `src/tests/documentEncryptionFailureSafety.test.ts` (new)
- `src/tests/staticAssetPolicy.test.ts` (new)
- This audit document (new)

## Recommended next milestone

Durable server-authoritative evidence and professional review: extend the existing Firestore architecture, load package and assignment together, verify authority/rule bindings, persist proposal/review/trace atomically with idempotency and quotas, and then enable an authenticated OpenAI case route. Add emulator tests for cross-client denial, stale versions, partial failures and reviewer independence. Follow with stage 4 server orchestration. External filings remain disabled.
