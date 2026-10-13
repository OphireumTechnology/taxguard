# Staging readiness and implementation plan (updated 2026-10-14)

**Status: NOT READY for staging.** Nothing has been deployed and no migration has been applied
anywhere. Production remains NO-GO. The protected production project `cvrlhixxczerytiocxid` is never
accessed, inspected, deployed to or migrated; tooling refuses it. No non-production project is
assumed to exist. Staging is deployed only with explicit owner approval.

## Current state

| Area | State | Blocking items |
|---|---|---|
| Isolated non-production Supabase project | none configured | owner provisions a separate project |
| Synthetic-only data | all suites use generated synthetic records; durable deployments load no demonstration seed | staging seed script (synthetic tenant, staff, clients) |
| Migration review and ordering | 13 core migrations + 32 proposals (000–011, 023–042); composition, idempotent re-apply and security invariants verified on PGlite and real PostgreSQL | human review / approval of each proposal; NOT VALID constraints validated after data review |
| Staff authentication and MFA | AAL2, 15-minute recent sign-in, invitations, recovery — verified against the loopback emulator | real-provider validation (`scripts/provider-validation/mfa-admin-validation.ts`); rate-limit policy decision |
| Client authentication | local password + TOTP and provider paths | client provider configuration in staging |
| Tenant and environment isolation | enforced in every proposal function; negative tests in unit, DB and E2E | one `TAXGUARD_TENANT_ID` per environment; separate keys per environment |
| Private document storage | private bucket, write-once objects, signed URLs, scan-required release | staging bucket |
| Malware scanner | none installed; documents stay quarantined | choose and wire a scanner transport |
| Billing sandbox | sandbox-only payments, maker-checker approvals | none for staging (no live payments by design) |
| AI provider commissioning | gateway, kill switches, budgets; no provider | provider decision, keys, budget approval, AI-16 decision |
| Audit monitoring | audit rows for every material change; administrator audit center (041) | log shipping / alerting; apply the append-only audit proposal |
| Backup / restore, rollback | rollback notes per proposal | tested runbook on the staging database |
| Staging application hosting | GitHub Pages deploy is manual on `main`; the API server has no staging host | separate staging workflow, environment and API host |
| Secret management | `.env` never committed; secret scan on every checkpoint | staging secrets in a managed store (GitHub environment secrets / host secret manager) |
| Remaining in-memory workflows | public prospect booking, administrator users / security events, integrations, legacy `AppContext` loads | make durable or disable before staging |

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
