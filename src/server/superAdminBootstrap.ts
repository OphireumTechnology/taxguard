export function bootstrapSuperAdministrator(): {
  status: 'skipped' | 'provisioned' | 'rejected';
  reason?: string;
} {
  const email = (process.env.TAXGUARD_SUPER_ADMIN_EMAIL || '').trim();
  const hash = (process.env.TAXGUARD_SUPER_ADMIN_PASSWORD_HASH || '').trim();
  if (!email || !hash) {
    return { status: 'skipped' };
  }
  return { status: 'provisioned' };
}
