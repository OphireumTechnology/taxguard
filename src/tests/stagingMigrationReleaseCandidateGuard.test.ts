import { describe, expect, it } from 'vitest';
import { assertMigrationCandidateInvocation } from '../../scripts/staging/migration-release-candidate-guard';

describe('migration release-candidate command safety boundary', () => {
  it('allows the no-argument invocation without external connection configuration', () => {
    expect(() => assertMigrationCandidateInvocation(['node', 'runner.ts'], { CI: 'true' })).not.toThrow();
  });

  it('refuses caller-supplied arguments that could alter candidate behavior', () => {
    expect(() => assertMigrationCandidateInvocation(['node', 'runner.ts', '--target'], {}))
      .toThrow('MIGRATION_CANDIDATE_ARGUMENTS_REFUSED');
  });

  it.each(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'DATABASE_URL', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGPASSWORD', 'TAXGUARD_DB_TEST_DIR'])(
    'refuses inherited %s configuration', name => {
      expect(() => assertMigrationCandidateInvocation(['node', 'runner.ts'], { [name]: 'configured' }))
        .toThrow('MIGRATION_CANDIDATE_EXTERNAL_ENVIRONMENT_REFUSED');
    },
  );
});
