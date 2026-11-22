export function practiceStoreConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.TAXGUARD_TENANT_ID
  );
}
