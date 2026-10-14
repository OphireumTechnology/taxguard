/** Refuse ambient targets before loading the disposable database harness or backup tools. */
export function assertRecoveryInvocation(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
) {
  if (argv.length !== 2) throw new Error('RECOVERY_TARGET_ARGUMENTS_REFUSED');
  if (Object.keys(environment).some(name =>
    /^(SUPABASE|VITE_SUPABASE|DATABASE_URL|PG)/i.test(name) ||
    /^TAXGUARD_DB_TEST_DIR$/i.test(name)))
    throw new Error('RECOVERY_EXTERNAL_ENVIRONMENT_REFUSED');
}
