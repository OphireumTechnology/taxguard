# Staging readiness and implementation plan (updated 2026-10-14, Phase 10 preparation)

**Status: NOT READY for staging.** Nothing has been deployed and no migration has been applied
anywhere. Production remains NO-GO. The protected production project `cvrlhixxczerytiocxid` is never
accessed, inspected, deployed to or migrated; tooling refuses it. No non-production project is
assumed to exist. Staging is deployed only with explicit owner approval.

## Current state

| Area | State | Blocking items |
|---|---|---|
| Isolated non-production Supabase project | none configured | owner provisions a separate project |
| Synthetic-only data | all suites use generated synthetic records; durable deployments load no demonstration seed | staging seed script (synthetic tenant, staff, clients) |
| Migration review and ordering | 13 core migrations + 36 proposals (000–011, 023–046); canonical hashed dependency/execution manifest; disposable composition verifies effective privileges | reviewed CLI conversion of invalid historical proposal timestamps; owner approval; historical NOT VALID constraints |
| Staff authentication and MFA | AAL2, 15-minute recent sign-in, invitations, recovery — verified against the loopback emulator | real-provider validation (`scripts/provider-validation/mfa-admin-validation.ts`); rate-limit policy decision |
| Client authentication | local password + TOTP and provider paths | client provider configuration in staging |
| Tenant and environment isolation | enforced in every proposal function; negative tests in unit, DB and E2E | one `TAXGUARD_TENANT_ID` per environment; separate keys per environment |
| Private document storage | private bucket, write-once objects, signed URLs, scan-required release | staging bucket |
| Malware scanner | authenticated adapter tested with fake transport; no external transport installed; documents stay quarantined by default | choose, review and commission authenticated TLS transport and key custody |
| Billing sandbox | sandbox-only payments, maker-checker approvals | none for staging (no live payments by design) |
| AI provider commissioning | gateway, kill switches, budgets; no provider | provider decision, keys, budget approval, AI-16 decision |
| Audit monitoring | existing material-action audit; bounded durable denial ingestion prepared in 046; SECURITY rows immutable | proposal approval; failure/drop alerting; durable outbox, retention and independent custody; general audit guard |
| Backup / restore, rollback | guarded disposable-local rehearsal script and Phase 10 runbook | PostgreSQL pg_dump/pg_restore tools; real staging/storage/identity recovery evidence |
| Staging application hosting | GitHub Pages deploy is manual on `main`; the API server has no staging host | separate staging workflow, environment and API host |
| Secret management | `.env` never committed; secret scan on every checkpoint | staging secrets in a managed store (GitHub environment secrets / host secret manager) |
| Remaining in-memory workflows | replaced contracts return 410 in durable/retired mode; stage two/three and unfinished integrations retained | reviewed production-mode staging runtime integration; no external operational evidence |

## Implementation plan (each step needs the owner's go-ahead)

1. **Provision** a dedicated non-production Supabase project (separate organisation or clearly named
   project), MFA (TOTP) enabled, no real users. Record its URL in a staging environment only.
2. **Secrets**: create a GitHub `staging` environment (required reviewer) holding the staging URL,
   anon key and service-role key; never reuse production values; rotate on any exposure.
3. **Migrations**: review proposals in name order; apply core migrations then approved proposals to
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

## Phase 9 preparation artifacts (local, offline)

| Artifact | Purpose | Verified |
|---|---|---|
| `docs/development/staging.env.template` | variable names only for the staging secret store | n/a |
| `scripts/staging/check-staging-config.ts` | offline check using `assessStagingConfiguration`; refuses the protected project; prints field codes only | run locally (refusal of the protected project confirmed) |
| `scripts/staging/build-synthetic-seed.mjs` | offline synthetic tenant / staff / client seed (example.test only) | applied after every migration and proposal on real PostgreSQL (`stagingSeed.db.test.ts`) |
| `scripts/provider-validation/mfa-admin-validation.ts` | real-provider MFA validation (Phase 6) | blocked: no project |

## Release checklist (staging; every step needs owner approval)

1. Non-production project provisioned; URL and keys only in the staging secret store.
2. `check-staging-config.ts` reports no issues for the staging values.
3. Proposals reviewed and approved in name order; applied to a restored copy first; composition
   tests run against it; then applied to staging.
4. Synthetic seed generated, reviewed and applied; provider accounts created for the seeded staff IDs.
5. MFA provider validation report recorded.
6. E2E suites run against the staging API with synthetic users only.
7. Malware scanner connected or uploads kept quarantined; billing in sandbox only.
8. Backup taken and restored; rollback of the latest proposal rehearsed.
9. Monitoring and alerting live; audit center security view reviewed.
10. Separate staging host; production Pages workflow untouched; deployment only on explicit approval.
