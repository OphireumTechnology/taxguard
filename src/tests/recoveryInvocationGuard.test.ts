import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { expect, it } from 'vitest';
import { assertRecoveryInvocation } from '../../scripts/staging/recovery-invocation-guard';

const argv = ['node', 'rehearsal.ts'];
it('accepts only the owned local target and explicit backup utility paths', () => {
  expect(() => assertRecoveryInvocation(argv, {
    PATH: 'synthetic', TAXGUARD_PG_DUMP_BIN: '/tools/pg_dump',
    TAXGUARD_PG_RESTORE_BIN: '/tools/pg_restore', NODE_ENV: 'test',
  })).not.toThrow();
});
it('rejects target arguments without including their contents in the error', () => {
  expect(() => assertRecoveryInvocation([...argv, 'postgres://synthetic-secret@external.invalid/db'], {}))
    .toThrow(/^RECOVERY_TARGET_ARGUMENTS_REFUSED$/);
});
it.each(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'DATABASE_URL',
  'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSERVICE', 'PGSERVICEFILE',
  'PGOPTIONS', 'PGPASSFILE', 'TAXGUARD_DB_TEST_DIR', 'pgHost', 'taxguard_db_test_dir'])
('refuses inherited %s even when empty', name => {
  expect(() => assertRecoveryInvocation(argv, { [name]: '' }))
    .toThrow(/^RECOVERY_EXTERNAL_ENVIRONMENT_REFUSED$/);
});

const run = promisify(execFile);
it.each(['backup-rehearsal.ts', 'logical-recovery-rehearsal.ts'])
('refuses %s before harness/tool startup and does not print credentials', async script => {
  const environment = { ...process.env };
  for (const name of Object.keys(environment))
    if (/^(SUPABASE|VITE_SUPABASE|DATABASE_URL|PG)/i.test(name) || /^TAXGUARD_DB_TEST_DIR$/i.test(name))
      delete environment[name];
  environment.PGSERVICEFILE = 'synthetic-secret-service-file';
  let failure: any;
  try {
    await run(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'),
      path.resolve('scripts/staging', script)], { env: environment, timeout: 15000, windowsHide: true });
  } catch (error) { failure = error; }
  expect(failure?.code).toBe(1);
  expect(failure.stderr).toContain('RECOVERY_EXTERNAL_ENVIRONMENT_REFUSED');
  expect(failure.stderr).not.toContain('synthetic-secret-service-file');
  expect(failure.stdout).toBe('');
}, 20000);
