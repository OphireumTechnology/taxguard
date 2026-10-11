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

## 4. Verification

New tests: `superAdminLocalLoginInput.test.ts` (24; mutation-checked against the old parser: 12 fail) and `localAuthDiagnostics.test.ts` (8). Full validation is recorded in the commit series for this cycle.
