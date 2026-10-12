# Browser end-to-end and non-production database tests (Phases 1 and 2)

**PRODUCTION STATUS: NO-GO.** Both suites are development-only and opt-in. They never read a
`.env` file, never use a Supabase project, and never leave the loopback interface. All users,
clients, documents, amounts and credentials are synthetic and generated per run.

## How to run

```
npm run test:db    # real PostgreSQL 17 (embedded-postgres), multi-connection
npm run test:e2e   # real server + Microsoft Edge (playwright-core), 25 browser tests
```

Neither suite is reached by `npm test` / `vitest run` (their files live in `src/tests-db` and
`src/tests-e2e`, outside the default include list), so CI is unchanged. Set
`TAXGUARD_DB_TEST_DIR` (or `TEMP`) to a drive with space; data directories are deleted after each
run. `E2E_KEEP_LOG=1` keeps the server log and failure screenshots; `E2E_HEADED=1` shows Edge.

## Phase 2 — database (`src/tests-db`, 15 tests)

`harness.ts` starts a throw-away PostgreSQL server bound to 127.0.0.1 on a random port with a random
password, applies the Supabase role/`auth` shims, every `supabase/migrations` file and every proposal
in name order, and refuses to run if a Supabase URL is present in the environment.

| Area | Test |
| --- | --- |
| Migration composition and ordering on a real server; idempotent re-apply; `search_path` pinned on every SECURITY DEFINER function; no Claude-proposal function executable by `anon`/`authenticated` | `composition.db.test.ts` |
| 12 simultaneous postings on separate connections → unique, gap-free entry numbers, balanced totals | `concurrency.db.test.ts` (mutation-checked: a racy counter fails it) |
| Same idempotency key on 12 connections → exactly one entry; losers get a retryable 409 and a retry replays the winner | 〃 |
| Two reviewers deciding one prepared entry at once → exactly one wins | 〃 |
| Postings racing a hard close → nothing posts after the close commits | 〃 |
| Caller rollback leaves no entry, line or audit row; a failing step aborts the whole entry | 〃 |
| 12 invoices approved simultaneously → consecutive numbers 1..12 | 〃 |
| One payment key replayed on 12 connections → one payment; concurrent distinct payments never overpay | 〃 |
| Two reviewers deciding one document version at once → one decision, one audit row | 〃 |
| Own / other / administrator session revocations racing → converge, revoked sessions cannot act | 〃 |
| Foreign-tenant manager reaches nothing through any store over real connections | 〃 |

## Phase 1 — browser (`src/tests-e2e`, 25 tests, Edge)

`scripts/e2e/run-e2e.mjs` generates synthetic users (random passwords and TOTP secrets, written to
a private temp file, never printed), starts `scripts/e2e/e2e-server.ts` on 127.0.0.1 and runs the
suite. The E2E server boots the **real `server.ts`** (routers, Vite-served UI, local password + TOTP
sign-in) after:

- starting the database harness and seeding synthetic tenants (`tenantE2E`, `tenantE2EOther`),
  clients and members;
- serving a keyed loopback stand-in for the project endpoints the durable stores call: taxguard RPCs
  (PostgREST semantics), a **private** storage bucket held in memory, and the malware scanner's
  verdict (recorded through `taxguard_doc_record_scan`, exactly as a scanner integration would).
  Anything else is 404 so unexpected provider calls fail closed;
- enrolling the synthetic users and their authenticators in the local identity store.

| File | Covers |
| --- | --- |
| `01-auth` | wrong password (no session), MFA required after password, wrong code refused, sign-in with TOTP, identity without secrets, replayed code refused, sign-out revokes server-side, anonymous refusal on every durable API, account security page; durable session management refuses local sessions |
| `02-practice-documents-billing` | manager creates/activates an engagement and staffs preparer, reviewer, bookkeeper in the UI; client uploads in the portal → quarantined, not downloadable, not queued → scanner verdict → manager accepts in Document Review → client download; accountant drafts, manager approves in the Billing UI → `INV-YYYY-000001`; client pays with the sandbox test card in the portal, settled once |
| `03-ledger-b2t-cases` | bookkeeper prepares a balanced entry in the Ledger Workspace (held for review; bookkeeper cannot approve; reviewer approves; trial balance shown); categorizes a bank transaction, starts and finalizes a zero-variance reconciliation; book-to-tax mapping set and workpaper approved by a different reviewer; case created and advanced 1→9 with system-verified and reviewer-attested evidence, stage 9 refused (`STAGE_BLOCKED_VERIFIED_TAX_ENGINE_REQUIRED`), shown in the manager's Case Workflow |
| `04-dashboards-isolation` | administrator, practice manager, bookkeeper, accountant and reviewer each land on their own workspace without other roles' modules; client portal; recruiter reaches no tax data; foreign-tenant manager sees only their tenant and is refused (403/404) on every module; this tenant's manager cannot reach the foreign client; client-to-client, unassigned staff and ungranted bookkeeper refusals |

## Defects found by these suites and fixed

1. **`npm run dev` crashed at start-up** — server code imports `src/supabase/config.ts`, which read
   `import.meta.env` (undefined under tsx). It now defaults to an empty environment, i.e. the browser
   client stays unconfigured (fail-closed), exactly as the production esbuild `--define` makes it.
2. **Client document page crashed in the browser** (`process is not defined`) —
   `stageTwoDocumentIntelligenceService.ts` read `process.env` in shared code; production bundles
   would crash too. Server variables are now read defensively and a production Vite build still
   selects `CLOUD` mode (verified in the built bundle).
3. **Practice Manager durable modules were unusable** — the global manager capability list allowed
   only the manager dashboard, so Clients & Engagements, Case Workflow, Document Review and Billing
   returned 403 in the real server (HTTP tests had injected authentication). The list now admits an
   explicit endpoint set **only while the development-only durable routers are configured** (never in
   production, never the protected project); ledger, administration, e-file and card payment stay
   closed; routers and the database still enforce manager authority. `practiceManagerDurableAccess.test.ts`.
   *Review requested (decision HC4).*
4. The Case Workflow UI requests `/api/cases/` (trailing slash); the manager list admits it.

Supporting changes: `server.ts` binds 127.0.0.1 when `TAXGUARD_LISTEN_HOST=127.0.0.1` (non-production
only); `practiceStoreConfigured` moved to `taxguard/practice/practiceStoreConfig.ts` (no import cycle).

## Limitations (not verified here)

- Sign-in uses the **local** identity path (password + TOTP verified by this server). Supabase
  sign-in, provider MFA enrolment/recovery and durable (provider) session management are Codex-owned
  and require a non-production Supabase project; they are not exercised in the browser.
- The malware scanner and storage are local stand-ins; no real scanner, OCR or storage provider.
- Legacy dashboard panels that call non-durable endpoints show their existing "unavailable" states.
- Only Microsoft Edge (Chromium) is exercised; no Firefox / WebKit, no mobile viewport pass.
