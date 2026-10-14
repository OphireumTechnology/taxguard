# Phase 11 engineering delivery

Date: 2026-10-14. Repository: OphireumTechnology/taxguard. Feature branch: `codex/taxguard-phase11-completion`. This report describes implemented code and local synthetic validation. Staging and production remain **NO-GO**. No external database, production project, deployment, real taxpayer record, live payment, tax transmission or autonomous material AI action was used.

## Git reconciliation

Initial main was `49369c393d6391c9de9e3ecd869bf79736c6990c`. During execution, PR #16 merged an independent Phase 10 implementation into main at `5f1553c7d73445081d51635310173a53373694bf`. This feature reconciles that baseline with the preserved Codex Phase 10 commit `f0549efc4ac67d97258402f51af589772bd0a412` and Phase 11 checkpoints `87a5d95` and `6cec579`.

[PR #15](https://github.com/OphireumTechnology/taxguard/pull/15) remains open/draft and unmerged; its branch and commits are preserved. The Phase 11 PR targets main and carries the combined corrections. Its integration does not authorize automatically merging or closing PR #15. Final delivery commit and PR are recorded at the delivery checkpoint below.

## Implemented changes

| Slice | Behavior and principal evidence |
|---|---|
| Migration integrity | Explicit dependency DAG, normalized SHA-256 hashes, complete coverage checks, cycle/path/dependency rejection, transactional failure reporting and schema fingerprints. The 61-file execution plan is distinct from the 62-file derived catalog analysis. A content-addressed review packet converts invalid historical proposal prefixes without changing source SQL. `scripts/staging/migration-order.mjs`, `migration-manifest.mjs`, `migration-review-bundle.mjs`, `schema-fingerprint.ts`; real composition/review-packet tests. |
| Historical preservation | All 56 SQL artifacts approved in pinned main, including rollbacks, match canonical hashes in `phase11-historical-migration-preservation.json`. Inherited changes to 027/028/046 are restored to approved content and carried additively through 057/058. Original Git commits remain ancestors. |
| Billing confidentiality | Database allowlists and raw-table/function privilege restrictions; client/tenant checks precede payment replay lookup, and immutable replay fields must match. Bounded keyset invoice pages preserve exact whole-scope balances, hide unissued void drafts and exclude preparer/reviewer identities and processor/financial internals. Browser traversal pins session identity and rejects duplicate/incomplete pages. `billingStore.ts`, `billing.routes.ts`, `billingApiService.ts`; direct database and browser tests. No live payment provider. |
| Security-event custody | Independent committed outbox handoff, immutable redacted envelopes, tenant-safe attribution, queue/rate caps, idempotent audit delivery, concurrent SKIP LOCKED dispatch, bounded retries and retained blocked events. Only awaited `recordDurably` guarantees committed acknowledgement; finish-hook observations remain best-effort before handoff. Outages reject durable acknowledgement and expose bounded failure/drop metrics. Restart recovery is tested; exactly-once transport is not claimed. `securityEventRecorder.ts`, proposals 051/057 and outbox tests. |
| Durable Stage 02/03 collection | Engagement/year-scoped drafts and immutable revisions, optimistic versioning/idempotency, requirement generation, waiver claims requiring practitioner review, clarification/amendment requests, immutable client replies and staff resolution. Drafts/claims never waive requirements, certify tax facts or advance stages. The client workspace and staff panel use authenticated durable APIs, controlled loading/errors and explicit ambiguous-engagement selection. Unsafe local waiver success is removed. Refresh and staff/client exchange are exercised in browser tests. |
| Vault/scanner boundary | Immutable upload copies; complete bounded CSV byte validation; private bucket checks per operation; scanner requests bound to document UUID/version/hash/path/provider; authenticated signed verdicts, bounded abortable submission and monotonic deadlines; one-use replay protection and consistent document/request locks. Forged, expired, mismatched, missing, competing or malicious verdicts retain quarantine/deny download. Existing 050 jobs are extended rather than duplicated. Fake adapters cannot release production documents. No real malware detection is claimed. |
| Runtime/legacy safety | Durable collection routes precede legacy routes; retired operational contracts return controlled errors and production remains fail-closed. Legitimate unfinished legacy components remain preserved and unmounted where no approved replacement exists. Active practice-manager reads/actions receive narrow access with database rechecks. Verified local TOTP assurance is attached to the individual session, avoiding shared-user contamination. |
| Observability | Public health exposes no provider details. Readiness/diagnostic probes and operational metrics require active tenant-scoped administrator AAL2 before probing. Bounded status/latency/abort counters exclude paths, query strings and payloads; outbox counts are tenant scoped. Proxy trust defaults to zero with strict supported values. |
| Recovery and release preparation | Repeatable-read logical export, hash/schema validation, atomic restore, foreign-key validation and identity/serial sequence restoration. Tool discovery and safe failure for physical utilities. Offline configuration guards, synthetic seeding preparation, validation-only CI workflows, rollback/incident/commissioning runbooks and an authoritative owner decision register. No deploy job or external migration application. |
| AI/tax audit | Source-backed 21-area requirements matrix and per-ID 61-agent readiness matrix. Existing scoped tools, review proposals, governance budgets/kill switches/audit and adversarial tests remain controlling. Exact-decimal deterministic tax infrastructure is retained without invented tax rules. AI-16 and stages 9–18 remain blocked. |

New canonical proposals are 051 security outbox, 052 invoice pages, 053 questionnaire drafts/claims, 054 collection requests/replies, 055 MFA grant/type canonicalization, 056 scanner bindings, 057 audit custody overlay and 058 billing access overlay. Execution follows dependencies rather than proposal number: 057 precedes 051, and 058 precedes 052. Proposal application was limited to disposable local PostgreSQL.

Important added artifacts include `docs/development/phase11-remaining-work.json`, `phase11-ai-readiness.json`, `phase11-owner-decisions.md`, `phase11-release-operations.md`, migration manifests/review mapping/history preservation, `DurableClientCollectionWorkspace.tsx`, `StaffCollectionRequestsPanel.tsx`, `collection-durable.routes.ts`, `collectionStore.ts`, authenticated scanner/operational helpers, and security/concurrency/browser regression suites. Traceability inventories the complete changed documentation and migrations.

## Validation evidence

| Gate | Result obtained |
|---|---|
| Clean npm ci | PASS; 244 packages added, 245 audited, zero reported vulnerabilities at execution |
| Full unit/security suite | PASS: 322 files / 5,482 tests |
| Real PostgreSQL suite | PASS: 14 files / 49 tests; disposable PostgreSQL 17, loopback only |
| Full default browser suite | PASS: 12 files / 58 tests |
| Provider-emulator browser suite | PASS: 1 file / 8 tests; emulator is not real-provider validation |
| Focused browser journeys | PASS: 3 files / 13 tests, including durable draft refresh and staff request/client reply/resolution |
| Security mutations | PASS: 21/21 killed, no survivors; passing baselines required and setup failures excluded |
| TypeScript / repository lint | PASS; repository lint runs TypeScript. Separate ESLint is not configured/installed and was not executed |
| Production frontend/backend build | PASS; this is an artifact build, not deployment |
| Supplementary script typecheck | PASS for recovery, readiness and E2E scripts |
| Migration composition/reapplication/drift | PASS in full PostgreSQL suite, including independently composed review packet |
| Canonical manifest and review mapping | PASS; 61 execution files, exact hashes and dependency order; external application false |
| Derived catalog manifest | PASS: MANIFEST_CURRENT; 62 analyzed files |
| Historical SQL preservation | PASS; 56 approved artifacts |
| Traceability | PASS: 208 requirements, 61 agents, 18 stages; does not certify release/browser acceptance |
| Secret scan | PASS: 1,377 text files scanned, 108 binary files skipped, no high-confidence findings |
| Git diff checks | PASS; final checkpoint repeated after documentation |
| Real-provider MFA | BLOCKED: offline readiness returns `CONFIRMATION_MISSING`; no provider contacted |
| Physical utility backup/restore | BLOCKED: `BACKUP_TOOLS_REQUIRED`; pg_dump/pg_restore absent. No system installation performed |
| Logical recovery rehearsal | PASS: two separate disposable fsync-on loopback servers; 141 tables / 7,181 synthetic/reference rows; export 334 ms, restore 1,474 ms; schema, row integrity and tenant isolation verified |
| Staging / production acceptance | NOT EXECUTED; no authorized infrastructure/commissioning |

The final full suites ran after mutation sources were restored. Earlier diagnostic failures were corrected: security-event category expectation, payment replay scope error expectation, first-application sequence ACL drift, dependency-order assumptions and Windows disposable-server cleanup. Overlapping diagnostic runs with mutation edits are not counted as final passing evidence. Security assertions were preserved or made more specific; failed/setup mutation baselines were not counted as kills.

## Remaining capabilities and commissioning

The web platform is partial as a complete professional product. Locally tested durable foundations cover practice management, identity controls, bookkeeping, billing, messaging, appointments, consultation requests, document quarantine and collection. This does not establish a complete intake-to-file journey. The 21-area matrix links each classification to source/tests and identifies missing authority adapters, approved policies, professional workflow completion and external integrations. Unfinished valid features are retained rather than erased.

All A00–A60 agents remain DRAFT, model unset, token/cost budgets zero and uncommissioned. A00/A10/A34 have bounded foundation handlers; the other 58 need approved specialist requirements and implementations. Registration confers no capability or authority. The supervised document advisory/review foundation remains synthetic and human controlled; provider operation and material approvals are blocked.

Tax infrastructure supports exact arithmetic, deterministic/versioned evaluations, provenance, evidence, review/approval and fail-closed incomplete rules. Real federal/state tax-year content, independent practitioner verification cases, authoritative fact/workpaper adapters, forms, signature authority and filing acknowledgements remain missing or unapproved. No synthetic rate is represented as approved tax law. Stages 9–18 and live filing remain disabled.

Staging preparation is implemented offline. No dedicated non-production Supabase project, API host/domain, secrets, real identity/storage/scanner/model provider or release authority was supplied. The current production-mode API boundary intentionally excludes development-only workflows; a reviewed staging runtime cutover remains required. GitHub Pages alone cannot host server APIs. The review packet requires Supabase CLI/version approval and constraint/data/maintenance-lock review before any future external application. No rollback grants insecure access or drops custody history.

Logical recovery is locally tested; physical utility restore, storage-version recovery, external identity/MFA recovery, independent audit custody and real RPO/RTO are not validated. Retention/redrive automation waits for owner policy, and process counters are not durable audit records.

## Owner decisions and next milestones

`phase11-owner-decisions.md` is authoritative for isolated project provisioning, hosting/domain/runtime cutover, migration application, retention, recovery objectives, audit custody, staff rate limits, proxy trust, reassignment independence, counsel authority, scanner/model provider and key custody, AI-16 actor/role/attestation/target chain, federal/state tax sources, signatures/filing provider, invoice delivery and Stage 02/03 practitioner authority. These decisions were not invented.

Recommended next milestones:

1. Human review of the reconciled feature and overlapping PR #15, without automatic merging.
2. Approve isolated staging project/host/secrets and production-mode runtime design; review the migration packet and NOT VALID constraint plan.
3. Supply approved PostgreSQL client utilities and rehearse database, vault and identity recovery against authorized synthetic staging.
4. Commission real MFA/private storage/scanning and observability; perform independent tenant/object isolation and complete browser acceptance.
5. Approve canonical practitioner collection/tax authority adapters and rule sources; implement verified year/jurisdiction packs incrementally.
6. Commission one supervised advisory AI workflow with approved models/prompts/evaluations. Preserve AI-16 denial until exact material-action authority and adapters are approved.

**Staging NO-GO; production NO-GO.** Implemented in code and locally tested are separate from staging validated and production commissioned; neither of the latter occurred.

## Delivery checkpoint

Final reconciliation commit, feature head, PR URL and observed GitHub CI status will be recorded after the local gates complete. No automatic PR merge or deployment.
