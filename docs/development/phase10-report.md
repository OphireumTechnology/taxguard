# Phase 10 development report — 2026-10-14

Branch: `codex/taxguard-phase10-staging-readiness`. Baseline: Phase 9 merge `49369c3`.
Local development evidence only. No staging deployment, external migrations, production Supabase,
real customer records, live payments/filing/transmission or autonomous material AI actions.

## Implementation

- Canonical manifest inventories all 49 core/proposed files, canonical-LF SHA-256 values, conservative
  dependencies, static object references, superseded function names, grants and rollback notes.
  The disposable PostgreSQL harness verifies and follows this manifest. Historical invalid
  timestamp prefixes are flagged; core history is unchanged. No new official migration was added.
- Proposal 028 now creates a narrowly allow-listed client projection in PostgreSQL for reads
  and payment responses. Raw billing tables are denied to browser and service roles; RPCs remain
  service-only. Staff notes, reviewer/preparer identities, credit reasons/deciders and provider
  metadata stay private. Unissued void drafts are hidden; payment replay first loads the scoped
  invoice and binds the complete payload and actor. HTTP projection remains defense in depth.
- Proposal 046 adds service-only bounded, categorized security ingestion into the existing audit
  log, tenant/actor validation, UUID replay checks, a tenant-minute limit and immutable SECURITY
  events. The optional non-production bridge captures legacy denials and HTTP 401/403 refusals
  without raw request details. Counters report failures/drops; pending events remain volatile.
  Existing material administrative actions retain their transactional audit architecture.
- Replaced legacy document/engagement/appointment/payment/message/legal and administrator-list
  contracts return 410 in durable/retired mode. Unfinished workflows and their controls remain.
- A scanner adapter authenticates byte-bound requests and verdicts, rejects replay/tampering,
  bounds timeouts and aborts transport. Fake transport only; no external scanner is installed.
  Proposal 027 adds insertion ordering for new audit rows so timestamp ties cannot reorder
  document history. Backfilled sequence values do not establish historical causal order.
- Offline staging validation now centrally blocks protected destinations, mixed projects, key
  reuse, browser secrets, legacy enablement and live-action flags. Synthetic seeding and guarded
  MFA tooling are preserved. A local backup/restore rehearsal and operational/rollback runbook
  are added. The A00–A60 matrix confirms DRAFT metadata, no models/budgets/commissioning,
  material denial and blocked tax stages 9–18.
- Traceability covers Phase 10 controls. A scoped high-confidence secret scanner reports file,
  line and pattern only; it never prints credentials. Mutation coverage verifies that a leaking
  SQL projection is caught, then rolls back the mutant.

## Validation evidence

| Gate | Current local result |
|---|---|
| `npm.cmd ci` (installation scripts enabled) | PASS; 244 packages installed, zero reported vulnerabilities |
| Full unit/security suite | PASS; 301 files, 5,314 tests, exit 0, 185.91 seconds |
| Disposable real PostgreSQL | PASS; nine files, 30 tests, exit 0, 99.67 seconds; includes composition/reapply, all-public-table RLS, service grants, confidentiality, bounds and concurrency |
| Default browser E2E | PASS; 11 files, 56 tests, exit 0, 368.52 seconds |
| Provider-emulator browser E2E | PASS; one file, eight tests, exit 0, 199.20 seconds |
| Final document/billing browser rerun | PASS; one file, five tests, exit 0, 9.98 seconds; final SQL including audit insertion sequence |
| Typecheck / repository lint | PASS; both invoke `tsc --noEmit`; ESLint is not installed or configured, so no ESLint PASS is claimed |
| Staging-script TypeScript validation | PASS; backup, AI matrix and offline configuration scripts |
| Frontend/backend production build | PASS; no deployment |
| Offline synthetic staging configuration | PASS; 24 template fields checked, zero issues, `releaseAuthorized=false` |
| Canonical migration manifest | PASS; 49 files, 23 invalid historical timestamp prefixes flagged, 12 NOT VALID declarations; canonical LF portability tested |
| AI matrix | PASS; 61 DRAFT agents, zero commissioned, no material actions |
| Traceability | PASS; 197 requirements, 61 agents, 18 stages; does not certify independent acceptance |
| Secret scan | PASS; 1,291 text files, 108 binary files excluded; no high-confidence credential findings, including service-role JWTs |
| Git diff formatting | PASS |
| Backup/restore execution | BLOCKED; utilities absent, explicit `BACKUP_TOOLS_REQUIRED` refusal; script typechecked, no external operation |

Earlier failures were diagnosed, not bypassed: missing Vitest required lockfile dependency
restoration; sandbox child processes produced `spawn EPERM` and were retried through normal host
approval; stale manifest/traceability hashes were regenerated after edits; the truncate test now
reaches the immutable guard using CASCADE instead of failing first on an FK dependency. One full
run caught timestamp-tie document history misordering; proposal 027 now uses an insertion sequence
and the regression forces tied timestamps. A PostgreSQL run caught two fixtures using a manifest
module version changed during execution; the frozen-source rerun passed with zero skipped tests.
Windows/Linux manifest portability was fixed before commit, with an explicit content-drift regression.

These browser results cover local synthetic application journeys and provider emulation. They do
not certify every canonical 18-stage journey, a real Supabase provider, independent security
acceptance, staging deployment or production commissioning. Global traceability retains that distinction.

## Added files and SQL changes

| Area | Added files |
|---|---|
| Runtime boundaries | `src/server/securityEventRecorder.ts`, `src/server/legacyRouteBoundary.ts`, `src/server/taxguard/documents/authenticatedScanner.ts` |
| Offline tooling | `scripts/staging/migration-manifest.mjs`, `ai-readiness.ts`, `backup-rehearsal.ts`, `scan-secrets.mjs` |
| Readiness artifacts | `docs/development/staging-migration-manifest.json`, `phase10-ai-readiness.json`, `phase10-operations.md`, this report |
| Unit regressions | `src/tests/stagingMigrationManifest.test.ts`, `securityEventRecorder.test.ts`, `authenticatedScanner.test.ts`, `legacyRouteBoundary.test.ts`, `phase10AiReadiness.test.ts` |
| PostgreSQL regressions | `src/tests-db/phase10Security.db.test.ts` |

Existing unapplied proposals **027, 028 and 046** were updated. No new official migration was
created, no core migration history was rewritten, and no proposal was applied externally. Existing
server wiring, configuration assessment, audit-center categories, composition harness, billing/vault
tests, environment template, readiness documentation and traceability were updated.

## External dependencies and owner decisions

- No isolated staging project/host exists in this session. Development-only durable APIs are still
  closed in production mode; their eventual staging runtime integration needs review.
- Supabase CLI is absent. Invalid proposal timestamp prefixes need reviewed conversion and
  final migration approval before external application. No SQL is applied externally.
- `pg_dump` and `pg_restore` are absent. The backup script refuses with `BACKUP_TOOLS_REQUIRED`.
  Local backup/restore execution, then storage/identity/secret-store recovery and RPO/RTO remain.
- Real MFA-provider validation, scanner transport/key custody, log shipping/alerts and independent
  audit custody are uncommissioned. Retention/legal holds and an ingestion outbox remain decisions.
- Existing consultation retention, reassignment reviewer/request-limit policy, legal referral
  approval, staff rate limits and staging proxy policy remain owner decisions.
- AI specialist mappings, provider/model/budget authority, material attestation and AI-16 remain
  blocked. No real tax rules, e-filing or signatures are activated.

## Phase 11 priorities

1. Independent security review and official migration conversion; revalidate restored composition.
2. Supply local backup utilities and complete the guarded rehearsal, then owner-approved staged
   storage/identity recovery and measured recovery objectives.
3. Review isolated staging runtime integration, provision only with owner approval, and run real
   MFA/scanner/observability acceptance on synthetic data.
4. Replace the volatile denial producer queue with a monitored durable outbox; approve retention
   and independent custody without relaxing audit immutability.
5. Continue legitimate workflow and specialist development from approved authority contracts;
   preserve AI-16 and tax-stage fail-closed controls.
