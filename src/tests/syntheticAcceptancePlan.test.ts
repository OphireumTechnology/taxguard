import { expect, it, vi } from 'vitest';
import { executeAcceptancePlan, validationCommands } from '../../scripts/synthetic-acceptance-plan.mjs';
it('records actual command outcomes without claiming browser or release acceptance', async () => {
  const run = vi.fn().mockResolvedValue({ exitCode: 0 });
  const report = await executeAcceptancePlan(run, true);
  expect(report.checks).toHaveLength(8); expect(report.success).toBe(true);
  expect(report.browserAcceptance).toBe('NOT VERIFIED'); expect(report.releaseRecommendation).toBe('NO-GO');
  expect(run).toHaveBeenCalledTimes(8);
});
it('continues independent checks after command failure without retrying it', async () => {
  const run = vi.fn().mockResolvedValue({ exitCode: 0 }).mockResolvedValueOnce({ exitCode: 1 });
  const report = await executeAcceptancePlan(run);
  expect(report.success).toBe(false); expect(report.checks[0]).toMatchObject({ status: 'FAIL', exitCode: 1 });
  expect(report.checks.slice(1).every(check => check.status === 'PASS')).toBe(true);
  expect(run).toHaveBeenCalledTimes(validationCommands.length);
});
it('sanitizes spawn errors and leaves browser unverified', async () => {
  const report = await executeAcceptancePlan(async () => { throw new Error('private_credentials'); });
  expect(report.success).toBe(false); expect(JSON.stringify(report)).not.toContain('private_credentials');
  expect(report.checks.every(check => check.status === 'FAIL' && check.exitCode === null)).toBe(true);
});
it('treats terminated processes as failures and fixture compilation as preparation only', async () => {
  const report = await executeAcceptancePlan(async () => ({ exitCode: null }), true);
  expect(report.success).toBe(false); expect(report.checks.at(-1).status).toBe('FAIL'); expect(report.browserAcceptance).toBe('NOT VERIFIED');
});
it.each([undefined, null, {}, { exitCode: '0' }, { exitCode: NaN }])('records malformed outcome %j as unavailable and continues independent checks', async outcome => {
  const run = vi.fn().mockResolvedValue({ exitCode: 0 }).mockResolvedValueOnce(outcome);
  const report = await executeAcceptancePlan(run);
  expect(report.checks[0]).toMatchObject({ status: 'FAIL', exitCode: null, reason: 'EXECUTION_UNAVAILABLE' });
  expect(report.success).toBe(false); expect(run).toHaveBeenCalledTimes(validationCommands.length);
});
it('retains timeout codes for normal commands and fixture build without leaking arbitrary reasons', async () => {
  const report = await executeAcceptancePlan(async () => ({ exitCode: null, reason: 'COMMAND_TIMEOUT' }), true);
  expect(report.checks.every(check => check.reason === 'COMMAND_TIMEOUT')).toBe(true);
  const sanitized = await executeAcceptancePlan(async () => ({ exitCode: 0, reason: 'private credentials' }));
  expect(sanitized.success).toBe(false); expect(JSON.stringify(sanitized)).not.toContain('private credentials');
});
it('records all 29 scenarios as unverified even after successful synthetic commands', async () => {
  const report = await executeAcceptancePlan(async () => ({ exitCode: 0 }), true);
  expect(report.browserScenarios).toHaveLength(29);
  expect(new Set(report.browserScenarios.map(scenario => scenario.id)).size).toBe(29);
  expect(report.browserScenarios.every(scenario => scenario.status === 'NOT VERIFIED' && scenario.evidence === null)).toBe(true);
});
