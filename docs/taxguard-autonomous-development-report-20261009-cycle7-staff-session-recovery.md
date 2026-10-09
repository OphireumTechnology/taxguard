# Cycle 7: Staff dashboard session recovery

Date: 2026-10-09. Local implementation and validation complete.

After Cycle 6 passed, continued an independent read-only dashboard correction in the existing Practice Manager and Client Service hooks. Both suppressed visible data during denied access or invalid year but retained state. Restoring the same user/session/year could expose that old state before the new request completed.

Both hooks now clear their state when access or year is ineligible. Existing current-token keys, tenant/year response checks, request cancellation and late-response suppression remain controlling. Client Service selected-detail/search hooks, server roles and material mutation permissions were not changed.

Added 12 real-hook regressions across both dashboard hooks: authentication interruption, account suspension, role changes, invalid-year recovery and late interrupted-session success/failure. Fixtures are synthetic and the state/effect harness follows the existing session-isolation tests.

Targeted command: `npm.cmd test -- src/tests/staffDashboardSessionRecovery.test.ts src/tests/practiceManagerReadStates.test.tsx src/tests/clientServiceReadStates.test.tsx`. It failed before tests with sandbox esbuild `spawn EPERM`; no elevated retry was requested. Typecheck/build/diff checks and a full suite are in progress under existing permissions. No unexecuted test is claimed as passing.

Prior uncommitted work preserved. No protected-backup access, commit, push, merge, deploy, migration, production access or AI-16 material write. AI-16's action/attestation policy blocker and dependent AI gates remain unchanged. Browser QA and durable provider integrations remain unfinished.

Completion: `npm.cmd test` PASS, 133 files / 2,567 tests, exit 0, 64.14 seconds, including all 12 new regressions. `npm.cmd run typecheck`, `npm.cmd run build` and `git diff --check` PASS, exit 0. Existing build warnings remain. The targeted command was blocked, while these tests executed successfully within the full suite. No browser or deployed authorization validation is claimed.
