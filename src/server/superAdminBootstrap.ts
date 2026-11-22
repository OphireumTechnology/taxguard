/**
 * Local super administrator bootstrap (non-production only).
 *
 * The account is provisioned from the operator's own environment, never from source code:
 *   TAXGUARD_SUPER_ADMIN_EMAIL          account e-mail
 *   TAXGUARD_SUPER_ADMIN_PASSWORD_HASH  pbkdf2 "salt:hash" produced by scripts/provision-super-admin.mjs
 *   TAXGUARD_SUPER_ADMIN_TOTP_SECRET    base32 TOTP secret (MFA is mandatory for this role)
 *   TAXGUARD_SUPER_ADMIN_TENANT_ID      tenant the account administers (falls back to TAXGUARD_TENANT_ID)
 *   TAXGUARD_SUPER_ADMIN_NAME           optional display name
 *
 * No plaintext password is ever read, stored or logged here. Production identity is
 * Supabase; this bootstrap refuses to run when NODE_ENV=production.
 */
import { createHash } from 'crypto';
import { db } from './db';
import { registerTotpSecret, base32Decode } from './totp';
import type { User } from '../types';

export type SuperAdminBootstrapResult =
  | { status: 'provisioned'; userId: string; email: string }
  | { status: 'not_configured' }
  | { status: 'disabled_in_production' }
  | { status: 'rejected'; reason: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HASH_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{128}$/;

export function superAdminUserId(email: string): string {
  return `user_sa_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16)}`;
}

function reject(reason: string): SuperAdminBootstrapResult {
  db.logSecurityEvent({
    eventType: 'SUPER_ADMIN_BOOTSTRAP_REJECTED',
    ipAddress: 'local',
    details: `Super administrator bootstrap refused: ${reason}`,
    severity: 'warning'
  });
  return { status: 'rejected', reason };
}

export function bootstrapSuperAdministrator(env: NodeJS.ProcessEnv = process.env): SuperAdminBootstrapResult {
  if (env.NODE_ENV === 'production') return { status: 'disabled_in_production' };
  const email = (env.TAXGUARD_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const passwordHash = (env.TAXGUARD_SUPER_ADMIN_PASSWORD_HASH || '').trim();
  const totpSecret = (env.TAXGUARD_SUPER_ADMIN_TOTP_SECRET || '').trim();
  const tenantId = (env.TAXGUARD_SUPER_ADMIN_TENANT_ID || env.TAXGUARD_TENANT_ID || '').trim();
  if (!email && !passwordHash && !totpSecret) return { status: 'not_configured' };

  if (!EMAIL_PATTERN.test(email)) return reject('TAXGUARD_SUPER_ADMIN_EMAIL is missing or invalid.');
  if (!HASH_PATTERN.test(passwordHash)) {
    return reject('TAXGUARD_SUPER_ADMIN_PASSWORD_HASH must be the salt:hash value printed by scripts/provision-super-admin.mjs (plaintext passwords are not accepted).');
  }
  if (!totpSecret) return reject('TAXGUARD_SUPER_ADMIN_TOTP_SECRET is required: MFA is mandatory for super administrators.');
  try {
    if (base32Decode(totpSecret).length < 16) return reject('TAXGUARD_SUPER_ADMIN_TOTP_SECRET must be at least 128 bits.');
  } catch {
    return reject('TAXGUARD_SUPER_ADMIN_TOTP_SECRET must be base32.');
  }
  if (!tenantId) return reject('TAXGUARD_SUPER_ADMIN_TENANT_ID (or TAXGUARD_TENANT_ID) is required so the account is tenant-scoped.');

  // Never silently elevate an existing account: an e-mail already used by another role is refused.
  const existing = Array.from(db.users.values()).find(u => (u.email || '').toLowerCase() === email);
  const userId = superAdminUserId(email);
  if (existing && existing.id !== userId) {
    return reject(`the e-mail address already belongs to an existing ${existing.role} account; choose a dedicated address.`);
  }

  const now = new Date().toISOString();
  const user: User = {
    ...(existing || {}),
    id: userId,
    email,
    name: (env.TAXGUARD_SUPER_ADMIN_NAME || '').trim() || 'Super Administrator',
    role: 'super_admin',
    title: 'Super Administrator',
    tenantId,
    mfaEnabled: true,
    status: 'active',
    isVerified: true,
    createdAt: existing?.createdAt || now
  } as User;

  db.users.set(userId, user);
  db.userPasswords.set(email, passwordHash);
  registerTotpSecret(userId, totpSecret);

  db.logAudit({
    userId,
    userName: user.name,
    userRole: 'super_admin',
    action: 'SUPER_ADMIN_BOOTSTRAPPED',
    resource: 'Identity Provisioning',
    details: `Local super administrator ${email} provisioned from operator environment for tenant ${tenantId} (MFA required).`,
    ipAddress: 'local',
    severity: 'warning'
  });
  return { status: 'provisioned', userId, email };
}
