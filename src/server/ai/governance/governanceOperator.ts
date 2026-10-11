import { GovernanceError, type SessionAuthority, type VerifiedIdentity } from './contracts';
import type { SqlConnection } from './SqlGovernanceStore';

/**
 * Roles permitted to operate AI governance (Control Center views and emergency stop),
 * per taxguardConfig canTriggerAiEmergencyDisable. Membership is always re-read from
 * taxguard_members inside the caller's transaction; role claims in requests are ignored.
 */
export const GOVERNANCE_OPERATOR_ROLES: readonly string[] = ['administrator', 'admin', 'compliance_officer', 'cpa'];

const uidPattern = /^[A-Za-z0-9_-]{1,128}$/;
export const governanceDeny = (code: string, status = 403): never => { throw new GovernanceError(code, status); };

export async function verifyGovernanceIdentity(sessions: SessionAuthority, token: string): Promise<VerifiedIdentity> {
  if (typeof token !== 'string' || !token.trim()) governanceDeny('AI_AUTH_REQUIRED', 401);
  let identity: VerifiedIdentity | null = null;
  try { identity = await sessions.verify(token); } catch { governanceDeny('AI_AUTH_UNAVAILABLE', 503); }
  if (!identity || !uidPattern.test(identity.uid) || !uidPattern.test(identity.tenant_id)) governanceDeny('AI_AUTH_REQUIRED', 401);
  return identity!;
}

export async function governanceOperator(sql: SqlConnection, identity: VerifiedIdentity) {
  const rows = (await sql.query<{ role: string; status: string }>(
    'SELECT role,status FROM taxguard_members WHERE tenant_id=$1 AND uid=$2', [identity.tenant_id, identity.uid])).rows;
  const member = rows[0] ?? null;
  return { exists: !!member, allowed: !!member && member.status === 'active' && GOVERNANCE_OPERATOR_ROLES.includes(member.role) };
}
