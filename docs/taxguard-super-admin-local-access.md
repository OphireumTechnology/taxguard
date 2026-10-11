# Super administrator: local provisioning, sign-in and dashboard inspection

**PRODUCTION STATUS: NO-GO.** This guide covers the **local / non-production** server login. Production identity is Supabase; the local login returns 410 when `NODE_ENV=production`, and the bootstrap refuses to run there.

## 1. Provision the first super administrator (once)

There is no default account, no master password and no password in source code. Seeded demo accounts receive a password only if you set `SEED_CLIENT_PASSWORD` / `SEED_STAFF_PASSWORD` yourself. The seeded super administrator never receives one.

```bash
node scripts/provision-super-admin.mjs
```

The script:

- asks for a dedicated e-mail address, the tenant id (default `tenantA`) and a display name;
- reads the password twice with hidden input. It requires at least 14 characters, upper- and lower-case letters, a digit and a symbol, and must not contain the e-mail name;
- writes `.env.superadmin.local`, which is git-ignored and contains:
  - `TAXGUARD_SUPER_ADMIN_EMAIL`;
  - `TAXGUARD_SUPER_ADMIN_PASSWORD_HASH`: a pbkdf2-sha512 `salt:hash`. The plaintext password is never stored;
  - `TAXGUARD_SUPER_ADMIN_TOTP_SECRET`: a 160-bit base32 secret;
  - `TAXGUARD_SUPER_ADMIN_TENANT_ID`;
  - `TAXGUARD_SUPER_ADMIN_NAME`;
- prints the authenticator secret and an `otpauth://` URI **once**. Add it to an authenticator app (any RFC 6238 TOTP app) before closing the terminal.

Re-running it with `--force` replaces the file. That resets the password and the authenticator secret.

The bootstrap refuses, with a logged security event and no account created, when:

- the hash is missing or plaintext;
- the TOTP secret is missing or shorter than 128 bits;
- no tenant is given;
- the e-mail address already belongs to another account. Existing accounts are never elevated.

## 2. Start the server and sign in

```bash
npx tsx --env-file=.env.superadmin.local server.ts
```

The console prints only `[auth] Local super administrator provisioned from environment (MFA required).` It never prints the address, hash or secret.

1. Open **http://localhost:3000/staff/login**. A notice states that sign-in is verified by the local TaxGuard server. This local path is used only by non-production builds when Supabase is not configured.
2. Enter the e-mail and password. The server answers with an authenticator-code step; no session exists yet.
3. Enter the current 6-digit code. The server verifies it:
   - it accepts ±30 seconds of clock drift;
   - each code works once, so a replayed code is rejected;
   - invalid codes count toward lockout: 5 per IP and 15 per account.
4. You land on **http://localhost:3000/staff/super-admin**.

**Session:**

- 30-minute idle timeout, with an absolute limit of 8 hours that activity cannot extend.
- **Sign out** revokes the session on the server.
- Suspending the account ends its sessions on the next request.

## 3. Switch dashboards

Use the **Dashboard** selector in the console header. Each selection:

- is kept in the URL (`/staff/super-admin?dashboard=<id>`) and in this browser's local storage;
- is recorded in the audit log (`DASHBOARD_INSPECTION_VIEW`);
- never changes your role, tenant or session.

| # | Dashboard | URL | What you see |
| --- | --- | --- | --- |
| — | Super Administrator | `/staff/super-admin?dashboard=super_admin` | Real data: system overview, tenant, staff and roles, dashboard directory, audit and security events, workflow, AI Control Center and emergency stop, provider status, operational errors |
| 1 | Client / Taxpayer | `?dashboard=client` | Status card only. The client workflow exists but loads one taxpayer's own records; inspect it by signing in as a synthetic client |
| 2 | Accountant / Tax Preparer | `?dashboard=accountant` | Real dashboard, **inspection mode** (layout only) |
| 3 | Reviewer | `?dashboard=reviewer` | Real dashboard, inspection mode |
| 4 | Bookkeeper | `?dashboard=bookkeeper` | Real dashboard, inspection mode |
| 5 | Practice Manager | `?dashboard=practice_manager` | Real dashboard, inspection mode |
| 6 | Client Service / Operations | `?dashboard=client_service` | Real dashboard, inspection mode |
| 7 | Billing / Finance | `?dashboard=billing` | Not implemented (status card) |
| 8 | Administrator | `?dashboard=administrator` | Real Practice Administration Console with real data (you are authorized) |
| 9 | Security / Compliance | `?dashboard=security_compliance` | No dedicated dashboard (status card). Audit, security events and the AI stop are in the Super Administrator console and the Administrator dashboard (8) |
| 10 | Executive / Owner | `?dashboard=executive` | Not implemented (status card) |

All URLs are under `http://localhost:3000/staff/super-admin`.

**Inspection mode** renders the role's real component (navigation, forms, tables, KPI tiles, workflow strip) with **no data**:

- The dashboard's data hooks still require that role, so no case, taxpayer or ledger request is made and nothing is substituted. Figures show as unavailable.
- Buttons that would act still go to the server, which applies its normal role and object checks.
- Interactive work in a role requires a real account with that role. Impersonation remains disabled by policy.

## 4. What a super administrator can and cannot do

- **Can:**
  - everything an administrator can, within its own tenant;
  - this console;
  - AI governance operations (governance operator role).
- **Cannot:**
  - pass preparer-, reviewer- or client-only routes (there is no universal role override);
  - approve or sign off its own journal entries or reconciliations (maker-checker);
  - edit approved journal entries or locked reconciliation periods;
  - act on another tenant's records;
  - impersonate users.
- **Known limitation (owner decision H06):** administrators, and therefore super administrators, can read taxpayer records of their own tenant through legacy administrative routes. The console does not list them.

## 5. Not verified / blocked

- **Supabase (production) sign-in for a super administrator:** not verified. It needs a configured Supabase project with MFA (E03). The server does not yet enforce MFA assurance level (AAL2) on Supabase sessions (P1-09; decisions H06 / H09).
- **Durable sessions and audit logs:** the local server keeps sessions and audit logs in memory. A restart clears them.
- **Production routes:** in production, `/api/*` is served by the separate production API, so the console's routes are not wired there.
