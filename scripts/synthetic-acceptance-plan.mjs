// Fixed offline validation commands only. No deployment, application server or environment loading.
import { stagingAcceptancePlan } from '../qa/staging-acceptance-plan.mjs';
function normalizeOutcome(outcome) {
  const exitCode = Number.isSafeInteger(outcome?.exitCode) ? outcome.exitCode : null;
  const reason = outcome?.reason === 'COMMAND_TIMEOUT' ? 'COMMAND_TIMEOUT'
    : outcome?.reason || exitCode === null ? 'EXECUTION_UNAVAILABLE' : undefined;
  return { exitCode, reason, status: exitCode === 0 && !reason ? 'PASS' : 'FAIL' };
}
export function unverifiedBrowserScenarios() {
  return stagingAcceptancePlan.scenarios.map(scenario => ({ id: scenario.id, workflow: scenario.workflow,
    status: 'NOT VERIFIED', reason: 'BROWSER_EXECUTION_NOT_PERFORMED', evidence: null }));
}
export const validationCommands = Object.freeze([
  ['tests', 'npm.cmd test', 'npm', ['test']],
  ['typecheck', 'npm.cmd run typecheck', 'npm', ['run', 'typecheck']],
  ['lint', 'npm.cmd run lint', 'npm', ['run', 'lint']],
  ['build', 'npm.cmd run build', 'npm', ['run', 'build']],
  ['fixture-typecheck', 'npm.cmd run typecheck -- --project qa/synthetic-shell/tsconfig.json', 'npm', ['run', 'typecheck', '--', '--project', 'qa/synthetic-shell/tsconfig.json']],
  ['diff', 'git diff --check', 'git', ['diff', '--check']],
  ['traceability', 'node scripts/verify-local-traceability.mjs', 'node', ['scripts/verify-local-traceability.mjs']],
]);
export async function executeAcceptancePlan(run, includeFixture = false) {
  const checks = [];
  for (const [name, windowsCommand, command, args] of validationCommands) {
    const startedAt = new Date().toISOString();
    let outcome;
    try { outcome = await run({ windowsCommand, command, args }); }
    catch { outcome = { exitCode: null, reason: 'EXECUTION_UNAVAILABLE' }; }
    checks.push({ name, startedAt, finishedAt: new Date().toISOString(), ...normalizeOutcome(outcome) });
  }
  if (includeFixture) {
    const command = { windowsCommand: 'node node_modules/vite/bin/vite.js build --config qa/synthetic-shell/vite.config.ts', command: 'node', args: ['node_modules/vite/bin/vite.js', 'build', '--config', 'qa/synthetic-shell/vite.config.ts'] };
    const startedAt = new Date().toISOString();
    let outcome;
    try { outcome = await run(command); } catch { outcome = { exitCode: null }; }
    checks.push({ name: 'fixture-build', startedAt, finishedAt: new Date().toISOString(), ...normalizeOutcome(outcome) });
  }
  return { scope: 'LOCAL_SYNTHETIC_VALIDATION_ONLY', checks, browserAcceptance: 'NOT VERIFIED', browserScenarios: unverifiedBrowserScenarios(),
    externalCommissioning: 'NOT VERIFIED', governanceApproval: 'NOT VERIFIED', releaseRecommendation: 'NO-GO',
    success: checks.every(check => check.status === 'PASS') };
}
