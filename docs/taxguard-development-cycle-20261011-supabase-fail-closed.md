# TaxGuard development cycle — 2026-10-11 — Supabase configuration fail-closed

Production recommendation: **NO-GO** (unchanged). This cycle is a bounded authentication-configuration repair, not a readiness certification.

## 1. Baseline (verified this session)

| Item | Result |
| --- | --- |
| Branch | `integration/taxguard-drive-d-20261010-123950` |
| Merge state | Unfinished merge (`MERGE_HEAD` present, "All conflicts fixed but you are still merging"). **Preserved; not concluded, aborted or committed.** |
| Working tree | ~169 staged/modified entries from prior work, preserved untouched |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd test` (before changes) | 178 files / 3,293 tests PASS, 80.2s |
| Prior audit artifacts | Re-used rather than regenerated: [traceability matrix](taxguard-master-traceability.md), [remaining decisions H01–H09 / E01–E08](taxguard-master-remaining-decisions.md), [remaining-work inventory](taxguard-remaining-work-inventory-20261009.md), [release readiness](taxguard-release-readiness-20261010.md), [security gaps](taxguard-master-security-gaps.md) |

The existing matrix and inventory remain the authoritative requirement-to-implementation record. Prior reports state that no currently identified unblocked implementation item remained; this cycle found and fixed a new one in the configuration contract named by the master instruction.

## 2. Defects found and fixed

| ID | Severity | Defect | Fix |
| --- | --- | --- | --- |
| CFG-01 | P1 security | `src/supabase/config.ts`: with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` missing, the browser created a live client pointed at `https://placeholder.supabase.co`. Sign-in/sign-up/reset requests — **including typed passwords** — would be transmitted to an external, uncontrolled host. | Unconfigured client now uses the reserved `.invalid` TLD **and** a blocking `fetch` that rejects locally; session persistence, refresh and URL session detection disabled; PostgREST retries disabled. Zero network I/O verified by test. |
| CFG-02 | P2 | Configuration validity only checked non-empty strings; `http://` remote URLs, malformed URLs and template placeholders were accepted. | New pure `resolveSupabaseBrowserConfig()` returns issue codes (`URL_MISSING`, `ANON_KEY_MISSING`, `URL_INVALID`, `URL_INSECURE`, `PLACEHOLDER_VALUE`). `http` allowed only for loopback hosts. Never echoes values. |
| CFG-03 | P2 | Missing configuration surfaced as generic "service temporarily unavailable". | New controlled code `AUTH_NOT_CONFIGURED` with an administrator-directed message; internal identifiers not echoed. |
| CFG-04 | P2 | Password reset reported neutral *success* ("email sent if account exists") even when authentication was unconfigured. | Returns failure for the configuration case only. Configuration state is not account-specific, so account-enumeration resistance is preserved; all other errors keep the neutral response. |
| CFG-06 | P2 UX/security | Staff (`/staff/login`) and client (`/portal/login`) sign-in forms accepted credentials with no indication that authentication was unconfigured. | `AuthConfigurationNotice` (role="alert") shown before credential entry; both sign-in submit buttons disabled while unconfigured. No configuration values or issue codes shown to users. Staff invitation acceptance (server API) unchanged. |
| CFG-05 | P2 | `src/server/supabase.ts`: outside `NODE_ENV=production`, missing server configuration silently created a client for `http://127.0.0.1:54321` with an invented key `dev-service-role-key` (and, if only the URL was set, sent that invented key to the real URL). | Replaced with a fail-closed client that rejects locally with `SUPABASE_CONFIG_MISSING`; no invented credentials or assumed endpoint. Production behaviour (throw) unchanged. |

### Configuration contract (exact)

| Side | Variables | Notes |
| --- | --- | --- |
| Browser (Vite, public) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Anon/publishable key only. `https` required except `localhost`/`127.0.0.1`/`[::1]`. |
| Server (never bundled) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`) | Production throws if missing. Build output verified to contain neither `placeholder.supabase.co` nor `SUPABASE_SERVICE_ROLE_KEY`. |

Values must point at an **authorized non-production** project for local development. None were supplied or accessed in this session; the connected "TaxGuard Production Project" was not contacted.

## 3. Files changed

| File | Change |
| --- | --- |
| `src/supabase/config.ts` | Config resolver, fail-closed unconfigured client, issue reporting |
| `src/supabase/auth.ts` | `AUTH_NOT_CONFIGURED` code + mapping; password-reset configuration case |
| `src/server/supabase.ts` | Fail-closed non-production fallback |
| `src/tests/supabaseConfigFailClosed.test.ts` | **New** — 11 regression tests |
| `src/components/auth/AuthConfigurationNotice.tsx` | **New** — pre-credential notice |
| `src/components/auth/AuthPages.tsx` | Notice on client/staff sign-in; submit disabled when unconfigured (file was staged by the merge; edit is unstaged on top) |
| `src/tests/authConfigurationNotice.test.tsx` | **New** — 4 render regressions |
| `docs/taxguard-master-traceability.json` | Regenerated with `node scripts/build-local-traceability.mjs`; delta = `AuthPages.tsx` hash + this report's inventory entry only (pre-existing worktree version backed up) |
| `docs/checkpoints/20261011-supabase-fail-closed-preedit/` | **New** — pre-edit copies of the four source files (from the index) and the traceability JSON/MD worktree versions |

All edits are unstaged working-tree changes, separable from the pre-existing staged merge content via `git diff` (index → worktree).

## 4. Validation

| Check | Result |
| --- | --- |
| New + existing Supabase auth/infrastructure tests | 3 files / 43 tests PASS |
| `npm.cmd run typecheck` (= `lint`, which is `tsc --noEmit`) | PASS |
| `npm.cmd test` full suite | **180 files / 3,308 tests PASS** (+2 files, +15 tests vs. baseline). An intermediate run failed 2 `traceabilityEvidenceIntegrity` checks (`TRACEABILITY_EVIDENCE_DRIFT`) because `AuthPages.tsx` changed; resolved by regenerating evidence with the project script, not by altering the test |
| Auth page render tests (new + label associations + routing) | 4 files / 83 tests PASS |
| `npm.cmd run build` | PASS (Vite 6.9s; esbuild server bundle). Existing 819.7 kB `LiveClientWorkflowRouter` chunk unchanged |
| `git diff --check` on changed files | PASS |
| Real browser sign-in against configured Supabase | **NOT VERIFIED** — no authorized non-production project credentials (E03) |

## 5. Security findings this session

| ID | Finding | Status |
| --- | --- | --- |
| SEC-ENV-01 | `.env` contains a single line with a bare OpenAI project key (`sk-proj-…`) and no `NAME=` assignment — malformed, so it is not loaded as any variable. Git-ignored, not tracked, not in history, not staged. A truncated prefix of the key appeared in this session's tool output while variable names were being enumerated. | **Owner action required:** rotate/revoke the key in the OpenAI console; if still needed, store it as `OPENAI_API_KEY=` via a secrets manager. Not modified here. |
| SEC-ENV-02 | `.env` contains no Supabase variables, confirming the diagnostic that local Supabase configuration is missing. | App-side handling fixed (above); environment provisioning is E03. |
| SEC-CFG-06 | `isSupabaseServerConfigured()` treats `SUPABASE_ANON_KEY` as sufficient for the "admin" client. Under RLS this fails toward less privilege, but server code may then assume privileged reads succeed. | Open, P3 — needs owner decision on whether anon-key server mode is a supported configuration. |

## 6. Remaining work (delta only — full register unchanged)

| Priority | Item | Dependency | Acceptance criteria |
| --- | --- | --- | --- |
| P1 | Rotate the exposed OpenAI key (SEC-ENV-01) | Account owner | Old key revoked; new key only in a secret store |
| P1 | Provision authorized non-production Supabase project + vars | E01/E03 | Staff and client sign-in succeed against non-production; production untouched |
| P2 | Real-browser check of the CFG-06 notice and disabled state | Browser fixture (E06) | Observed on both login routes with and without configuration |
| P3 | Apply the same notice to client registration and password-reset forms | None (UI) | Notice + disabled submit; render test |
| P3 | Decide SEC-CFG-06 | Owner | Documented decision; test pinning it |
| — | H01–H09, E01–E08 | As recorded | Unchanged |

## 7. Next authorized cycle — exact steps

1. Rotate the OpenAI key; remove the malformed `.env` line yourself.
2. Supply non-production `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in `.env` (never production).
3. `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`.
4. `npm.cmd run dev`; verify sign-in at `http://127.0.0.1:3000/staff/login` and `/portal/login` with synthetic accounts.
5. Decide whether to conclude the unfinished merge (requires explicit authorization).
