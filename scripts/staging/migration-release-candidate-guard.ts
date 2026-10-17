/** Pure safety gate for the local-only migration verifier. */
export function assertMigrationCandidateInvocation(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
) {
  if (argv.length !== 2) throw new Error('MIGRATION_CANDIDATE_ARGUMENTS_REFUSED');
  // The verifier gets explicit loopback credentials from its owned disposable server. Ambient
  // provider or libpq settings are unnecessary and must not silently widen its target boundary.
  if (Object.keys(environment).some(name => /^(SUPABASE|VITE_SUPABASE|DATABASE_URL|PG)/i.test(name) || name === 'TAXGUARD_DB_TEST_DIR'))
    throw new Error('MIGRATION_CANDIDATE_EXTERNAL_ENVIRONMENT_REFUSED');
}
