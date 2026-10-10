# Cycle 5 development report: Bookkeeper session isolation

Date: 2026-10-09. Branch: feature/taxguard-ai-agents.
Status: PENDING EXTERNAL TEST VALIDATION. Cycle 5 is not complete; checkpoint unchanged.

## Selected increment

Inspected Git status/branch, canonical architecture, autonomous checkpoint, prior development reports, dashboard Gates 6 and 8, and AI-16 pre-review. No applicable AGENTS.md was found. Cycles 1 through 4 were not repeated. AI-16 remains BLOCKED by missing authoritative material-action and attestation policy; no material-write authorization was changed.

Selected one bounded improvement: session isolation for the Bookkeeper snapshot and client-grant hooks. Their cache keys omitted the session token, and the grant hook omitted account status and returned cached client IDs without an allowed-session guard. A token replacement could retain prior-session data; suspension could retain grant IDs.

Updated src/hooks/useBookkeeperDashboardData.ts to include the stored token and account status in both read keys, include client-assignment context in the grant key, clear caches when reads are ineligible, and hide grant IDs immediately when access is denied. Existing effect cleanup aborts replaced requests; late success and failure handlers continue to honor the aborted signal. Existing tenant/client/year/period response checks and server authorization remain controlling. No token is logged or displayed.

Added src/tests/bookkeeperDashboardSessionIsolation.test.ts with 14 regression cases across the two actual hooks: token replacement, interrupted authentication, suspended/wrong-role denial and recovery, late old-session success/failure, and changed client assignments. The minimal state/effect harness follows the existing client-session test pattern. Fixtures are synthetic; no production taxpayer records or browser verification are involved.

## Validation attempted

- Targeted command: `npx.cmd vitest run src/tests/bookkeeperDashboardSessionIsolation.test.ts src/tests/bookkeeperDashboardHttp.test.ts src/tests/bookkeeperDashboardAuthority.test.ts src/tests/bookkeeperDashboardReadStates.test.tsx`. Exit 1 before tests ran: Vite config loading failed when esbuild attempted subprocess startup (`Error: spawn EPERM`, errno -4048). No retry, permission change, sandbox change, test configuration change or assertion weakening.
- `npm.cmd test`: reached the Vitest RUN banner but produced no test results during bounded observation. Interrupted the stalled invocation; exit 1. Cause of the stall is unconfirmed. Full validation is incomplete.
- `npx.cmd tsc --noEmit`: PASS, exit 0.
- `npm.cmd run build`: PASS, exit 0; frontend and server artifacts generated. Existing mixed calendar import and bundle-size warnings remain.
- `git diff --check`: PASS, exit 0; repeated after report creation. Explicit whitespace checks also cover the three untracked increment files.

Tests have not passed in this cycle. Rerun the exact targeted command and full suite in an environment supporting normal test subprocess execution. Update the checkpoint only after every required validation passes. No browser QA or deployed RBAC/RLS validation is claimed.

## Preservation and remaining work

Only the existing untracked Bookkeeper hook, new regression file and this report were edited for this increment. Prior uncommitted work and protected backup were preserved. No commit, push, deployment, migration, production access, taxpayer seed, grant, workflow transition or AI execution occurred. The authoritative 18-stage workflow, advisory-only AI, immutable records and server security boundaries are unchanged.

Durable accounting providers and authenticated browser QA remain unfinished. This cache-isolation improvement does not release production accounting reads or mutations, establish client authorization, or complete a dashboard/AI gate. AI-16 remains BLOCKED and untouched.
