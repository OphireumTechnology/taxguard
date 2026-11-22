export interface SuperAdminBootstrapResult {
  status: 'not_configured' | 'provisioned' | 'rejected';
  reason?: string;
}

export function bootstrapSuperAdministrator(): SuperAdminBootstrapResult {
  const email = (process.env.TAXGUARD_SUPER_ADMIN_EMAIL || '').trim();
  const hash = (process.env.TAXGUARD_SUPER_ADMIN_PASSWORD_HASH || '').trim();
  if (!email && !hash) {
    return { status: 'not_configured' };
  }
  if (!email || !hash) {
    return { status: 'rejected', reason: 'Incomplete super administrator bootstrap configuration.' };
  }
  return { status: 'provisioned' };
}
