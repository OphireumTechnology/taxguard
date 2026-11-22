export async function ensureCanonicalTenantBootstrap(): Promise<void> {
  // No-op in local/preview runtime when external database bootstrap is not configured.
}
