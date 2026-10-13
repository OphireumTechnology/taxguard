# TaxGuard development cycle — 2026-10-12 (i) — real super administrator sign-in and dashboard inspection

**PRODUCTION STATUS: NO-GO.**

- Completion matrix: [taxguard-master-development-completion-matrix.md](taxguard-master-development-completion-matrix.md), rows P1-14, P1-15 and P1-16, and §6.
- Operator guide: [taxguard-super-admin-local-access.md](taxguard-super-admin-local-access.md).
- Cycle (h) changes are still uncommitted in the same working tree, awaiting approval.

## 1. Inspection findings (before changes)

| ID | Severity | Finding |
| --- | --- | --- |
| I-1 | **High** | `requireRole` gave `super_admin` a **universal override**: every role-gated route accepted it, including client-only and reviewer-only routes |
| I-2 | **High** | Five `super_admin` exemptions in `accountant.routes.ts` bypassed maker-checker and locked periods: self-review of tasks, editing locked reconciliation periods, self sign-off, editing approved journal entries, self-approval of journal entries |
| I-3 | **High (dev / staging)** | `initSeedPasswords` fell back to **hard-coded passwords** for all seeded accounts, including the seeded super administrator |
| I-4 | Medium | The staff sign-in page called only Supabase, which is not configured locally, so no browser sign-in was possible. The page also passed the cosmetic role toggle (`'accountant'` / `'admin'`) as the MFA code argument |
| I-5 | Medium | Sessions slid indefinitely; there was no absolute lifetime |
| I-6 | Info | Supabase is not configured locally (`.env` defines no Supabase variables). Production auth could not be exercised; nothing was connected to a Supabase project |

## 2. Changes

| Area | Change |
| --- | --- |
| Role checks | Super administrator = administrator superset in `requireRole`; no universal override (I-1). Exemptions removed (I-2). `super_admin` added to `GOVERNANCE_OPERATOR_ROLES` (administrator superset) |
| Credentials | No default seed passwords; the seeded super administrator is never seeded (I-3) |
| Provisioning | `scripts/provision-super-admin.mjs`: hidden password input with a strength check, pbkdf2 hash, 160-bit TOTP secret, git-ignored env file, one-time `otpauth` URI |
| Bootstrap | `superAdminBootstrap.ts`: env-only, refuses production, plaintext, missing MFA or tenant, and existing accounts; audited |
| MFA | `totp.ts`: RFC 6238 (SHA-1, 30 s, 6 digits, ±1 step), replay protection, secrets never on user objects. Login verifies TOTP for enrolled users, counts failures toward lockout, and always requires a second factor for super administrators |
| Sessions | Super administrators: 30 min idle and 8 h absolute. All roles: 12 h absolute, enforced at the expiry check (I-5) |
| Browser sign-in | Non-production builds without Supabase use the real server login (`/api/auth/local-login-status`), with an authenticator-code step. Errors are mapped by server code (I-4) |
| Console | `/staff/super-admin`: overview of the 10 required areas from real server data; selector over 10 dashboards plus the console (URL + local persistence); `/api/super-admin/*` (super administrator only) records each view in the audit log |
| Inspection mode | `dashboardInspection.tsx` context: active only for a real active super administrator inside the console. It renders Accountant, Reviewer, Bookkeeper, Practice Manager and Client Service layouts. Their data hooks still require their own roles, so no role data is requested |

## 3. Verification

| Check | Result |
| --- | --- |
| New tests | `superAdminAccess.test.ts`: 35 tests (server, real middleware). `superAdminConsole.test.tsx`: 24 tests (UI) |
| Mutation check | Re-adding the universal override and the journal self-approval exemption makes 2 tests fail; files restored |
| Live browser (localhost, synthetic account generated this session) | Confirmed: unauthenticated `/staff/super-admin` → staff login, API 401; wrong password → refused, no token; correct password → authenticator step, no session; wrong code → refused; valid code → console with real server data; all ten views switched with only `/api/super-admin/dashboard-views` and provider-readiness requests (**no role-data request**); selection survives reload; `/me` stays `super_admin`; reviewer-only and client-only APIs 403; sign-out revokes the token (old token 401) |
| Typecheck / lint / suite / build / traceability | See the validation table below |

## 4. Dashboard status (honest)

| # | Dashboard | Status |
| --- | --- | --- |
| 1 | Client / Taxpayer | Implemented; restricted to the client's own session (not rendered for administrators) |
| 2–6 | Accountant, Reviewer, Bookkeeper, Practice Manager, Client Service | Implemented; mostly read-only. Inspection shows layout only. Mutations limited as documented in each dashboard |
| 7 | Billing / Finance | **Not implemented** (H06, E04) |
| 8 | Administrator | Implemented; real data for the super administrator |
| 9 | Security / Compliance | **No dedicated dashboard**; capabilities exist in the consoles (H06) |
| 10 | Executive / Owner | **Not implemented** (H06) |

## 5. Not verified / blocked

- **Supabase super administrator sign-in:** not verified (E03). AAL2 enforcement is pending (H06 / H09).
- **Durability:** sessions and audit logs are in memory locally (E01).
- **Production wiring:** in production, `/api/*` is served by the separate production API; the console routes are not wired there.
- **Tenant data in seeds:** the seeded demo users have no `tenantId`, so a tenant-scoped console sees only accounts provisioned for that tenant.
- **Pre-existing taxpayer-record access:** administrators can read their own tenant's taxpayer records through legacy routes (H06). This is not changed here.

## 6. Validation

| Check | Result |
| --- | --- |
| Typecheck / lint (`tsc --noEmit`) | PASS / PASS |
| Full suite | **197 files / 3,779 tests PASS** (includes the uncommitted cycle (h) work; +2 files, +59 tests vs. 3,720) |
| Traceability | Regenerated (160 requirements, 61 agents, 18 stages, 84 inventoried documents); integrity tests PASS; no git-ignored paths referenced |
| Build / `git diff --check` | PASS / PASS |
| Secrets / taxpayer data | None in tracked or new files. The synthetic end-to-end account lives only in git-ignored `.env.superadmin.e2e.local` |
