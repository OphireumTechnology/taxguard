export function practiceStoreConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    (env.SUPABASE_URL || '').trim() &&
      (env.SUPABASE_SERVICE_ROLE_KEY || '').trim() &&
      (env.TAXGUARD_TENANT_ID || '').trim()
  );
}
