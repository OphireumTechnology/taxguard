# TaxGuard development cycle — 2026-10-12 (j) — super administrator sign-in troubleshooting

**PRODUCTION STATUS: NO-GO.**

**OPEN ISSUE: the owner's personal local super administrator sign-in is UNVERIFIED.** Synthetic accounts sign in correctly; that does not establish that the owner's account works.

- Operator guide: [taxguard-super-admin-local-access.md](taxguard-super-admin-local-access.md) §5.
- Completion matrix: [taxguard-master-development-completion-matrix.md](taxguard-master-development-completion-matrix.md) row P1-14.

## 1. Defects found and fixed

| ID | Severity | Defect | Fix |
| --- | --- | --- | --- |
| J-1 | High (local) | The provisioning prompt read raw-mode input per chunk. A paste or fast typing could store Enter, newline or backspace characters inside the password hash, which a browser can never send | `scripts/lib/hiddenInput.mjs`: per-character parser (Enter ends input, backspace works, escape sequences and control characters dropped); policy rejects control characters |
| J-2 | Medium | The sign-in page reported every local server error as "Invalid email or password", hiding unrelated failures | `src/context/localLoginErrors.ts`: maps by server code; only `INVALID_CREDENTIALS` reads as a credential problem |
| J-3 | Low | Ctrl+C at the rotation prompt left the new secret on screen | Rotation script clears the screen on every exit path |

## 2. Utilities added (local, interactive, offline)

| Script | Purpose |
| --- | --- |
| `scripts/rotate-super-admin-totp.mjs` | Rotate only the authenticator secret; writes after a verified code; atomic write |
| `scripts/super-admin-password.mjs` | `--check` (offline comparison, detects J-1 hashes) and `--reset` (replaces only the hash line) |
| `src/server/localAuthDiagnostics.ts` | Opt-in (`TAXGUARD_LOCAL_AUTH_DIAGNOSTICS=true`), never in production; one category line per password login on the server console; no e-mail, password, hash, token or secret; responses and decisions unchanged |

## 3. Owner sign-in investigation (state at the time of writing)

| Evidence | Result |
| --- | --- |
| Account provisioned at server start from `.env.superadmin.local` | Yes (startup log) |
| Offline password check | MATCH (reported by owner) |
| Browser request path (synthetic) | `/api/auth/local-login-status` then `/api/auth/login`; no Supabase call; Supabase variables absent in project, user and system environment |
| Synthetic valid account (browser, Compliance Admin selected, mixed-case e-mail with trailing space) | Reaches the authenticator step |
| Owner's latest attempt with diagnostics enabled | **No diagnostic line**: the request did not reach the local server's login route. Cause not yet identified; the remaining candidates are an attempt made before the diagnostic server started, or a browser on a different address |

### Update (04:14): local attempt reached the server

| Evidence | Result |
| --- | --- |
| Owner attempt diagnostic | `password_mismatch` for the provisioned account; no whitespace, non-ASCII or Unicode-form hints |
| Environment file changed after server start? | No (file 01:38, server 02:07) |
| Offline check vs server algorithm | Identical (pbkdf2-sha512, 10,000 iterations, 64-byte key, hex salt) |
| Conclusion so far | The string the browser submits differs from the string typed into the offline check, unless the server holds another hash. Diagnostics now add `serverHashMatchesEnvironmentFile` and a request ID (`X-TaxGuard-Request-Id` header) to settle this; the staff sign-in page gained a Show / Hide password control |

### Public site (artaxserv.com) — separate system

| Item | Finding |
| --- | --- |
| Hosting | GitHub Pages (static); last deployed 2026-10-07 |
| Deployment | Manual `deploy-pages.yml`, `main` only. Pushes to the sync branch never deploy |
| Authentication | Browser Supabase sign-in (a configured Supabase project) plus `api.artaxserv.com`; no local server login in the bundle |
| Owner's local administrator account | Exists only in the local, git-ignored environment file; not provisioned in Supabase. Public sign-in failure message is the Supabase rejection text |

### Update (04:45): staff sign-in form defects found and fixed

Reproduced in the browser before fixing:

| ID | Severity | Defect | Effect seen by the user | Fix |
| --- | --- | --- | --- | --- |
| J-4 | **High** | Enter while the Staff Accountant / Compliance Admin button (or Show / Hide) had focus re-activated that button; no form submission | **No request sent, and the previous "Invalid email or password" stayed on screen**: indistinguishable from a new refusal, with no server record | Enter on those buttons submits the form (`requestSubmit`) |
| J-5 | High | Error messages persisted while the form was edited | An old error looked like the result of the next attempt | Editing any field, switching mode or changing the label clears the previous error |
| J-6 | Medium | In a local build, a failed status check fell through to the (unconfigured) Supabase branch | No request to the local server; misleading "not configured" message | `src/context/localServerLogin.ts`: local builds never use Supabase; an unreachable server is reported as such ("nothing was sent") |
| J-7 | Medium | The authenticator field's digit filter was `/D/g` (removed the letter D) | A pasted code with a space was truncated by the length limit and blocked by the 6-digit pattern, with only a tooltip | `/D/g`, then the first six digits |
| J-8 | Low | A page loaded while the server restarted kept the button disabled | Enter did nothing | The button stays enabled in local builds; status is re-checked on focus and on submit |
| J-9 | Low | Rapid repeated Enter could send duplicate requests | — | Single in-flight submission guard |

Also: the workspace label states that it does not set access (the server decides the role); the request carries only e-mail, password and (when present) the authenticator code; a refused attempt shows a `Reference` matching the server's `requestId` when diagnostics are enabled.

Browser verification against a synthetic account (separate server on port 3001): wrong password refused with matching reference and server line (`serverHashMatchesEnvironmentFile: true`); edit cleared the error; correct password + Compliance Admin focused + Enter twice sent exactly one request and reached the authenticator step; wrong code refused; code typed with a space accepted; console opened; dashboards switched; reviewer-only and client-only APIs 403; logout revoked the token; unreachable-server simulation sent nothing and said so; only `localhost` (and the existing Google Fonts stylesheet) contacted.

**Owner's personal sign-in remains UNVERIFIED** until the owner completes it.

## 4. Verification

New tests: `superAdminLocalLoginInput.test.ts` (24; mutation-checked against the old parser: 12 fail) `localAuthDiagnostics.test.ts` (10) and `localLoginFlow.test.ts` (12). Full validation is recorded in the commit series for this cycle.
