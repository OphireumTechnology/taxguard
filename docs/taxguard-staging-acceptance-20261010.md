# Synthetic staging acceptance and operator evidence plan

Current normal project setup command is `npm run qa:browser:setup`; use `npm run qa:browser` after prerequisites are installed/built. Setup and execution use only workspace-local package/browser caches and the fixed localhost target. Current installation is blocked by ENOTCACHED / only-if-cached mode, and the standard fixture build is blocked by spawn EPERM. Do not rerun setup here or override cache/sandbox policy. The [latest handover section](taxguard-staging-verification-20261010.md) records exact outcomes and 29 NOT VERIFIED product scenarios; prior direct CLI instructions below are historical preparation.

Latest actual execution evidence: [final staging verification report](taxguard-staging-verification-20261010.md). All 29 product browser scenarios remain NOT VERIFIED. The new operator-only shared-shell suite has syntax-checked configuration/specs; Playwright and the built artifact are absent. Exact future command: `node node_modules/@playwright/test/cli.js test --config qa/playwright.synthetic.config.mjs`. This suite is distinct from full provider-backed product acceptance and was not executed here.

Current status: all actual browser journeys **NOT VERIFIED**. This plan grants no shared environment, production connection, migration, provider delivery or protected action permission.

## Reproducible preparation command

From the workspace, a separately permitted staging operator runs:

```powershell
node scripts/run-synthetic-acceptance.mjs --execute --with-browser-fixture
```

This fixed command runs the full synthetic suite, root TypeScript, lint, frontend/backend build, fixture TypeScript, diff integrity, read-only traceability hash verification and optional isolated fixture build. It does not install packages, load dotenv, start the application server, create accounts, provision infrastructure or contact a staging/production API. It records unique JSON evidence under `qa/acceptance-results` without overwriting prior evidence. A failed command is never retried automatically; independent checks continue. Each command has a bounded timeout and spawned process-tree cleanup. Browser status and release recommendation remain NOT VERIFIED / NO-GO even if every command passes.

`node scripts/run-synthetic-acceptance.mjs --plan` previews the fixed commands and all 29 scenarios without running them. The execute/fixture mode was not run in this directive because the separate fixture build is a known sandbox blocker; individual permitted validations ran directly. The runner's orchestration is tested with injected outcomes; that is not an actual spawned staging run.

After a separately permitted successful fixture build, `node scripts/serve-synthetic-shell.mjs` serves only the synthetic artifact on `127.0.0.1:4179`. No backend/session/provider code is bundled. Browser CSP blocks network connections. The fixture verifies shared chrome only, not complete provider-backed workflows. Do not point it at production or use it to create trusted evidence.

## Full isolated staging prerequisites

Obtain explicit isolated environment authorization and synthetic operator accounts before actual application acceptance. Provision through approved infrastructure procedures outside this session. Use two tenants, two clients per tenant, two years, independent preparer/reviewer, active/suspended/expired/revoked sessions, missing/revoked consent, clean released/quarantined/missing documents and failing dependencies. Do not seed real taxpayer facts or copy production data.

Review `assessStagingConfiguration` before connecting anything: production Node boundary is required for the released API; credentials/tenant must be server-only; uncommissioned features must remain disabled; VITE secrets and material-action enabling flags denied. This assessor is an offline interface and does not load an operator's environment or grant release approval. The documentation template remains nonloaded and blank. Staging origin/TLS/cookie/provider policies require independent review; current origin rules must not be weakened for convenience.

Follow `qa/staging-acceptance-plan.mjs` for every established role and all 18 persisted stages. At `/portal/login`, `/portal/dashboard`, `/portal/profile` and `/staff/workspace`, verify actual role/session state and corresponding HTTP outcomes. Avoid successful external/regulated operations until separately authorized proof exists; verify controlled unavailability and denial instead. New local simulations never represent commissioning.

## Evidence and acceptance criteria

For each scenario retain approved target/environment, artifact/configuration hashes, actual browser engine/version, viewport/device/zoom, operator identity/time, actions, observed UI/HTTP status, redacted screenshot/log reference and independent reviewer. Do not store credentials, access tokens, SSNs, tax documents, private URLs or raw sensitive request bodies in evidence. A planned scenario, mock response, SSR render or asserted role label is not PASS.

Actual required checks: network failures and session expiry remove stale views immediately; auth/session recovery refetches exact scope; assignment and year changes cannot reveal prior records; quarantine/unknown consent never releases protected data; unknown roles and material writes remain denied. Mobile navigation and native dialogs require actual Tab/Shift-Tab/Escape/focus restoration, inert background, accessible names/status announcements, real 390/768/1280px viewports, zoom/overflow and screen-reader checks. Fixture width controls do not substitute for real viewport evidence.

Use PASS only with recorded actual results, FAIL with a reproducible observed defect, and NOT VERIFIED when the environment/authority/provider is unavailable. All protected action, service commissioning and independent security/governance signoffs remain distinct release gates.

## Synthetic-shell browser defect repair - 2026-10-10

The completed pre-repair Chromium run is preserved at `qa/acceptance-results/browser-2a266923-cee4-4a7f-8961-e51aef299734/results.json`: 36 tests, 12 PASS, 24 FAIL, zero skipped/flaky, 746.352 seconds. Tests ran at 390, 768 and 1280 pixels, one worker. Per-failure screenshots, traces and error-context files remain in their original evidence directories. Inspected role trace/screenshot show a rendered Overview and controls, but `getByLabel('Fixture role', { exact: true }).selectOption(...)` waits until the 30-second timeout. No console exception was found in the inspected trace. The enclosing label includes select option text; exact label matching fails before role selection. This is a fixture-label defect, not evidence of a product authorization defect.

| Synthetic-shell scenario | Pre-repair 390 / 768 / 1280 | Repaired-fixture browser result |
| --- | --- | --- |
| Client matching role | FAIL / FAIL / FAIL | NOT VERIFIED |
| Accountant matching role | FAIL / FAIL / FAIL | NOT VERIFIED |
| Reviewer matching role | FAIL / FAIL / FAIL | NOT VERIFIED |
| Bookkeeper matching role | FAIL / FAIL / FAIL | NOT VERIFIED |
| Practice Manager matching role | FAIL / FAIL / FAIL | NOT VERIFIED |
| Client Service (`operations`) matching role | FAIL / FAIL / FAIL | NOT VERIFIED |
| Admin matching role | FAIL / FAIL / FAIL | NOT VERIFIED |
| Role mismatch denial | FAIL / FAIL / FAIL | NOT VERIFIED |
| Inactive/session recovery/sign-out | PASS / PASS / PASS | NOT VERIFIED |
| Authorized navigation search | PASS / PASS / PASS | NOT VERIFIED |
| Mobile drawer focus/inert/Escape | PASS / PASS / PASS | NOT VERIFIED |
| Viewport overflow | PASS / PASS / PASS | NOT VERIFIED |

Repair: reusable `FixtureSelect` gives each select a unique ID and a separate text-only `label` with `htmlFor`. Applied to role, requested workspace and fixture width; preserved controlled values and callbacks. Added exact locator uniqueness and selected-value assertions to all seven role tests, without changing timeouts, removing assertions or skipping tests. Eight SSR regression tests cover both selectors for all seven roles and the width selector; these are automated markup checks, not browser acceptance.

Permitted validation: full Vitest PASS (exit 0, 167 files / 3,130 tests, 75.69 seconds); root TypeScript/lint and fixture TypeScript PASS (exit 0); browser-spec syntax PASS (exit 0). Fixture build and application build each exited 1 with sandbox `spawn EPERM` at Vite config loading, before compilation. The backend build was not reached. No repaired fixture was emitted and no post-repair browser was launched. No dependency reinstallation or execution-policy change occurred. User instructed no further Codex fixture/browser retries or outside-sandbox execution.

Run this single PowerShell command in the working Windows operator environment. It rebuilds the isolated fixture, runs the 24 affected role/mismatch tests first, and runs the complete 36-test suite only after they pass. No installation or application backend is invoked. Stop if an earlier browser run is still active.

```powershell
Set-Location 'D:\TaxGuardAutonomy\Workspace'; npm.cmd run qa:fixture:build; if ($LASTEXITCODE -eq 0) { $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location).Path '.cache\playwright'; node node_modules/@playwright/test/cli.js test --config qa/playwright.synthetic.config.mjs --grep 'matching synthetic|role mismatch'; if ($LASTEXITCODE -eq 0) { npm.cmd run qa:browser } }
```

Retain the new unique `qa/acceptance-results/browser-*/results.json` files and artifacts. Only actual new browser results can supersede the repaired-fixture NOT VERIFIED statuses. The separate 29 full-product staging scenarios remain NOT VERIFIED. External commissioning, independent security acceptance, migration approvals and governance remain unresolved; production recommendation remains NO-GO and AI-16 material writes remain blocked.

## Latest verified shared-shell evidence and real-product gates

Stored Windows operator report `qa/acceptance-results/browser-84c48932-d463-4549-ba1e-44d9a87bff17/results.json` verifies all 36 synthetic-shell tests PASS, zero failures/skips/flaky, duration 12.090 seconds. All 12 rows in the preceding scenario table now have repaired-fixture PASS at each of 390/768/1280 pixels. The historical 24 failures remain preserved. This report predates the application token-storage/workflow-hint fixes; the shared shell excludes the application API client and therefore cannot validate those application changes.

Full-product browser results remain NOT VERIFIED for each of CLIENT-AUTH, CLIENT-DOCUMENTS, BOOKKEEPER, ACCOUNTANT, REVIEWER, PRACTICE-MANAGER, CLIENT-SERVICE, ADMIN, CONSENT, SESSION and ACCESSIBILITY, and individually STAGE-01, STAGE-02, STAGE-03, STAGE-04, STAGE-05, STAGE-06, STAGE-07, STAGE-08, STAGE-09, STAGE-10, STAGE-11, STAGE-12, STAGE-13, STAGE-14, STAGE-15, STAGE-16, STAGE-17 and STAGE-18. No new real-product workflow was executed and no synthetic source/SSR check is treated as real-product PASS.

Infrastructure owner must supply an authorized isolated application, current identity provider and scoped durable fixtures; security reviewer must approve tenant/client/year, consent and failure evidence; practitioner/governance owners must supply missing regulated-action and stage authority. Complete per-scenario browser automation against those established product contracts rather than asserting a generic page heading or bypassing blocked integrations. Prepared inventory is not executable full-product acceptance coverage. H01-H09/E01-E08 in the remaining-decisions inventory specify exact unresolved decisions and dependencies. New application recovery behavior has ten automated regressions and full-suite evidence, but still requires real-product browser verification.

Latest preparation: `qa/product-browser/anonymous-boundaries.spec.mjs` adds six partial anonymous actual-product tests across 390/768/1280 viewports (18 total), for login labels, anonymous client/staff redirects, focus and overflow. No auth mocks or material writes; fixed localhost GET-only boundary and disabled mode. All 18 are NOT VERIFIED, and all 29 scenario statuses above remain NOT VERIFIED. They cannot validate authenticated roles, regulated transitions or durable recovery. Operator must supply a reviewed isolated synthetic actual application on 127.0.0.1:4180; the runner starts no server. Exact consolidated Windows command and prerequisites are in the latest release-readiness report. Full local automated validation: 174 files / 3,233 PASS; not browser evidence.
