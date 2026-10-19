# Staging readiness and implementation plan (updated 2026-10-18, Phase 14)

Phase 11 reconciles the independently merged Phase 10 PR #16 (`origin/main` 5f1553c) while preserving the unmerged Codex Phase 10 commit f0549ef and PR #15. The canonical execution DAG/checksum manifest is `staging-migration-manifest.json`; the catalog audit is a derived analysis artifact. New proposals 051–058 avoid the merged 047–050 identifiers; 057/058 preserve inherited corrections additively, and all 56 approved SQL artifacts match pinned main. The executable review packet covers 61 files. See `phase11-release-operations.md`, `phase11-owner-decisions.md`, `phase11-remaining-work.json`, `phase11-ai-readiness.json` and the final report. Current code remains locally validated only. No external action is authorized.

**Status: NOT READY for staging — staging GO / NO-GO: NO-GO.** Nothing has been deployed and no migration has been applied
anywhere. Production remains NO-GO. The protected production project `cvrlhixxczerytiocxid` is never
accessed, inspected, deployed to or migrated; tooling refuses it. No non-production project is
assumed to exist. Staging is deployed only with explicit owner approval.

## Current state

| Area | State | Blocking items |
|---|---|---|
| Isolated non-production Supabase project | none configured | owner provisions a separate project |
| Synthetic-only data | all suites use generated synthetic records; durable deployments load no demonstration seed | staging seed script (synthetic tenant, staff, clients) |
| Migration review and ordering | 13 core migrations + 40 proposals (000–011, 023–050) + the separate audit proposal; canonical manifest and readiness report (Phase 10); Supabase default privileges reproduced; Data API exposure found and closed by proposal 049 | human review / approval of each proposal in manifest order; 049 approved separately; NOT VALID constraints validated after data review |
| Staff authentication and MFA | AAL2, 15-minute recent sign-in, invitations, recovery — verified against the loopback emulator; real-provider runner requires a confirmed project ref and a different production ref (`--readiness`: BLOCKED) | real-provider validation once a project exists; rate-limit policy decision |
| Client authentication | local password + TOTP and provider paths | client provider configuration in staging |
| Client self-registration (Phase 14) | provider sign-in provisions a client identity; a fresh database had no client-ID counter row, so every self-registration was refused, fixed by proposal 20261018020000 (review only) | approve 20261018020000; confirm whether the staging database already holds the counter row |
| Stage 01 identity onboarding (Phase 14) | durable store proposed (20261018030000, review only): masked TIN, staff-verified identity document, duplicate review, staff approval, audited; Stage 02 requires server-recorded completion; consent-gated with no approved version, so nobody can submit | counsel/practitioner approval of the IRC § 7216 consent wording (purposes, recipients, duration, revocation); owner records the approved version; proposal review and approval |
| Engagement and tax-year scoped staff access (Phase 14) | a staff member assigned to one engagement and year reaches only that engagement and year at the database boundary: documents and Stage 02 (20261018060000), ledger, book-to-tax and work queue (20261018070000), document requests (20261018080000), case access following the live preparer and reviewer assignment (20261018090000), all review only; managers, administrators and client-wide assignments unchanged | Codex review and owner approval of the four proposals (see phase14-proposal-review-dossier.md); Codex carries the year check into its Phase 15 ledger functions (`phase14-phase15-billing-overlap.md`) |
| Tenant and environment isolation | enforced in every proposal function; negative tests in unit, DB and E2E | one `TAXGUARD_TENANT_ID` per environment; separate keys per environment |
| Private document storage | private bucket, write-once objects, signed URLs, scan-required release | staging bucket |
| Malware scanner | asynchronous boundary (proposal 050): durable requests, HMAC-authenticated single-use verdict callback, outage-safe quarantine; local fake scanner only | choose a provider; implement its adapter; approve the callback secret handling |
| Billing sandbox | sandbox-only payments, maker-checker approvals | none for staging (no live payments by design) |
| AI provider commissioning | gateway, kill switches, budgets; no provider | provider decision, keys, budget approval, AI-16 decision |
| Audit monitoring | audit rows for every material change; administrator audit center (041) with durable, bounded security events (048); liveness / readiness / administrator diagnostics; alert conditions documented (`observability-and-alerts.md`) | log shipping / alerting; apply the append-only audit proposal |
| Backup / restore, rollback | runbook (`backup-restore-runbook.md`); logical backup / restore / verification and rollback of 047, 048, 050 rehearsed on disposable local PostgreSQL | provider backups / PITR, bucket copy, RPO / RTO approval, rehearsal on staging |
| Staging application hosting | GitHub Pages deploy is manual on `main`; the API server has no staging host | separate staging workflow, environment and API host |
| Secret management | `.env` never committed; secret scan on every checkpoint | staging secrets in a managed store (GitHub environment secrets / host secret manager) |
| Remaining in-memory workflows | six superseded legacy routes retired (410); retained routes listed with reasons in `phase10-reviews.md`; stage two / three questionnaire and requests when the database is not configured | migrate the legacy documents consumers to the vault; owner decision on unreachable components |

## Implementation plan (each step needs the owner's go-ahead)

1. **Provision** a dedicated non-production Supabase project (separate organisation or clearly named
   project), MFA (TOTP) enabled, no real users. Record its URL in a staging environment only.
2. **Secrets**: create a GitHub `staging` environment (required reviewer) holding the staging URL,
   anon key and service-role key; never reuse production values; rotate on any exposure.
3. **Migrations**: review the explicit dependency execution manifest; apply approved files to
   staging only, inside a transaction per file; run `src/tests-db` composition checks against a
   restored copy first; validate NOT VALID constraints after inspection.
4. **Synthetic data**: seed one synthetic tenant, staff (UUID IDs), clients and engagements with a
   script that refuses any non-staging URL (reuse `providerValidationTarget` guard pattern).
5. **MFA provider validation**: run `mfa-admin-validation.ts` with the staging values; record the JSON
   report; only then enable `TAXGUARD_MFA_RESET_PROVIDER=supabase-admin` in staging.
6. **Isolation checks**: run the E2E suites against the staging API with synthetic users; confirm
   cross-tenant refusals with a second synthetic tenant.
7. **Storage and scanning**: private staging bucket; integrate a malware scanner; confirm infected
   samples (EICAR) stay quarantined.
8. **Billing**: sandbox keys only; confirm no live charge path exists.
9. **AI**: only after a provider decision — commission through the gateway with budgets and kill
   switches; AI-16 stays blocked.
10. **Monitoring**: ship server logs, alert on 5xx / refused-access spikes; review the audit center.
11. **Backup / restore and rollback**: take and restore a backup; rehearse rollback of the latest
    proposal using its rollback notes.
12. **Hosting**: separate staging host for the API and a staging static deployment, never the
    production Pages environment; deploy only on explicit approval.

## Phase 14 assessment (2026-10-18, local and offline only)

Staging **NO-GO**, production **NO-GO**. Verified locally on the Phase 14 branch (PR #22, draft); nothing was
deployed, applied or accessed externally. What is ready to review:
- **Migrations:** 79 manifest entries; release-candidate check passes on disposable loopback PostgreSQL
  (review only, owner approval required); composition and replay pass. The 13 NOT VALID constraints have a
  review sheet (`not-valid-constraint-review.md`) and each needs an owner decision on its validation window.
  The audit append-only proposal is listed for review and not in the plan.
- **Configuration:** `check-staging-config.ts` validates a candidate configuration offline. It refuses the
  production project, live payment keys, uncommissioned integrations, reused secrets and every development
  shortcut, including the local AI-governance database added in Phase 14.

Still needed before any staging step, each requiring authorization:
1. An isolated non-production Supabase project, API host and secret store.
2. Real-provider MFA validation (`provider-mfa-validation.md`).
3. A storage bucket and a chosen malware scanner with its adapter.
4. Physical backup and restore: `pg_dump` and `pg_restore` are not installed here, and provider backups,
   PITR and RPO/RTO are unapproved.
5. Hosted monitoring and audit custody: log shipping, alerting, and the append-only audit decision.
6. Tax-professional approval of rule sets. Stages 09–18 stay blocked.
7. AI governance approval. All 61 agents stay uncommissioned; AI-16 stays blocked.
8. The durable Stage 01 onboarding policy above.

## Phase 9 preparation artifacts (local, offline)

| Artifact | Purpose | Verified |
|---|---|---|
| `docs/development/staging.env.template` | variable names only for the staging secret store | n/a |
| `scripts/staging/check-staging-config.ts` | offline check using `assessStagingConfiguration`; refuses the protected project; prints field codes only | run locally (refusal of the protected project confirmed) |
| `scripts/staging/build-synthetic-seed.mjs` | offline synthetic tenant / staff / client seed (example.test only) | applied after every migration and proposal on real PostgreSQL (`stagingSeed.db.test.ts`) |
| `scripts/provider-validation/mfa-admin-validation.ts` | real-provider MFA validation (Phase 6) | blocked: no project |

## Phase 10 artifacts (local, offline)

| Artifact | Purpose | Verified |
|---|---|---|
| `scripts/migrations/migration-audit.mjs`, `build-migration-manifest.mjs` | canonical manifest, catalog diff per file, idempotency, hazards, client-role exposure | `migrationReadinessAudit.test.ts` (manifest must be current) |
| `src/server/config/stagingEnvironmentValidator.ts`, `check-staging-config.ts --config-file` | 15-area staging validation; protected-project and overlap refusal; codes only | `stagingEnvironmentValidator.test.ts` (43, including the CLI) |
| `scripts/backup/logical-backup.mjs`, `docs/proposed-migrations/rollback/` | restore and rollback rehearsal (loopback, disposable only) | `backupRestore.db.test.ts` (real PostgreSQL) |
| `/api/health/live`, `/ready`, `/diagnostics` | liveness, readiness, administrator diagnostics without disclosure | `healthEndpoints.test.ts` |
| `scripts/mutation/phase10-mutations.mjs` | proves the new protections are tested | 19 / 19 mutants killed |

## Phase 13A contract completion (local, offline)

Proposals `20261016000000`–`20261016050000` add the C1, C3, C4, C5, C6 and C8 database contracts.
C7 reads existing governance tables; C2 reads the identity provider only. All six proposals are in
the execution DAG, the staging manifest, the review bundle and the composition-security test. None
is applied anywhere. Per-contract status, blockers and owner decisions:
`phase13a-contract-register.md`. Staging and production remain NO-GO. Local tests do not establish
staging or production readiness, and no full WCAG review has been performed.

## Release checklist (staging; every step needs owner approval)

1. Non-production project provisioned; URL and keys only in the staging secret store.
2. `check-staging-config.ts` reports `READY_FOR_OWNER_REVIEW` for the staging values, and the three MANUAL areas (storage, monitoring, backup) are confirmed by the owner.
3. Proposals reviewed and approved in name order; applied to a restored copy first; composition
   tests run against it; then applied to staging.
4. Synthetic seed generated, reviewed and applied; provider accounts created for the seeded staff IDs.
5. MFA provider validation report recorded.
6. E2E suites run against the staging API with synthetic users only.
7. Malware scanner connected or uploads kept quarantined; billing in sandbox only.
8. Backup taken and restored; rollback of the latest proposal rehearsed.
9. Monitoring and alerting live; audit center security view reviewed.
10. Separate staging host; production Pages workflow untouched; deployment only on explicit approval.
