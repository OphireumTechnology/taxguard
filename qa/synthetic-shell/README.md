# Isolated synthetic shell acceptance fixture

Current project commands: `npm run qa:browser:setup` (local dependency + workspace-cached Chromium + fixture build + fixed suite), `npm run qa:fixture:build`, and `npm run qa:browser` (guarded prerequisites). Installation is currently ENOTCACHED / only-if-cached blocked; the standard fixture command failed once before compilation with spawn EPERM. No emitted artifact or actual browser result exists. Operator plan preview: `node scripts/setup-local-browser.mjs --plan`. Do not rerun blocked operations here or treat preflight success as browser acceptance.

Operator-only browser assertions now exist in `qa/browser/synthetic-shell.spec.mjs` with `qa/playwright.synthetic.config.mjs`. After separately permitted build and reviewed Playwright/Chromium provisioning, run `node node_modules/@playwright/test/cli.js test --config qa/playwright.synthetic.config.mjs`. These shared-chrome tests were syntax-checked only; neither the package nor artifact exists here. They do not certify the 29 full product journeys. The current [gate report](../../docs/taxguard-staging-verification-20261010.md) records every scenario as NOT VERIFIED.

The [current operator acceptance plan](../../docs/taxguard-staging-acceptance-20261010.md) and `node scripts/run-synthetic-acceptance.mjs --plan` provide the reproducible validation command and 29 full staging scenarios. Actual browser execution remains NOT VERIFIED; no known-blocked fixture build retry was performed.

This fixture is separate from the release entrypoint and production builds. It imports the real shared shell, presentation CSS and access guard with a substituted synthetic context. No real sessions, application APIs, providers, secrets or taxpayer data are used. Role selection simulates fixture state only and grants no application privilege. Build-time module isolation and browser CSP deny live dependencies/network requests. No external libraries were installed.

Preparation command: `node node_modules/vite/bin/vite.js build --config qa/synthetic-shell/vite.config.ts`. In the current sandbox this failed before compilation with esbuild `spawn EPERM`; no elevated retry or alternate execution path was attempted. No browser interaction or screenshot verification is claimed.

Typecheck: `npm.cmd run typecheck -- --project qa/synthetic-shell/tsconfig.json`. Synthetic dependency-negative tests run in the standard permitted full suite. After a separately permitted build, `node scripts/serve-synthetic-shell.mjs` serves only the generated fixture on `127.0.0.1:4179`, with no backend/API routes or environment loading. The server was not launched in this run because its build is blocked.

Acceptance scenarios still awaiting browser evidence:

1. Each established role sees only its matching shell; mismatch, inactive membership and unauthenticated fixture states conceal workspace content.
2. Open navigation at mobile/tablet widths; background controls are inert, first drawer control receives focus, Tab/Shift-Tab wrap, Escape closes and focus returns.
3. Search lists only rendered authorized navigation; selecting a result closes the dialog and changes the synthetic module.
4. Profile/help dialog has an accessible name, traps focus through native dialog behavior and returns focus; no credential or health evidence is asserted.
5. Sign out removes visible content; restoring the fixture is a new synthetic session, not a persisted live login.
6. Real viewport widths at 390/768/desktop sizes have no unintended page overflow; zoom/keyboard/screen-reader checks pass.

The fixture width selectors add fixture-only responsive styles and do not substitute for real viewport/device acceptance. This fixture tests shared chrome behavior, not full provider-backed role workflows, tax forms or deployed authentication/RLS.
