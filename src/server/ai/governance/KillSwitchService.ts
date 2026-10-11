import { createHash } from 'node:crypto';
import { findCanonicalAgent } from '../../../ai/registry';
import type { AIKillSwitch } from '../../../ai/types';
import { GovernanceError, type SessionAuthority, type VerifiedIdentity } from './contracts';
import type { SqlConnection, TransactionalSql } from './SqlGovernanceStore';
import { GOVERNANCE_OPERATOR_ROLES, governanceOperator as authorizedMember, verifyGovernanceIdentity } from './governanceOperator';

/**
 * Emergency AI stop (AI Control Center "Emergency Kill Switch").
 *
 * Activation only. Engaging a switch can only restrict AI execution; enforcement is
 * performed independently by GovernanceControlPlane and HumanProposalReviewService,
 * which reload enabled switches from ai_kill_switches on every assessment.
 * Deactivation (re-enabling AI) is deliberately not exposed: who may lift a stop,
 * and under what dual control, is an unresolved governance decision.
 */
export const KILL_SWITCH_ROLES = GOVERNANCE_OPERATOR_ROLES;

export type KillSwitchActivationRequest =
  | { scope: 'GLOBAL'; reason: string }
  | { scope: 'AGENT'; agent_id: string; reason: string };

export interface KillSwitchActivationResult {
  switch_id: string; scope: 'GLOBAL' | 'AGENT'; target: string; enabled: true;
  already_active: boolean; activated_by: string; activated_at: string;
}

export type KillSwitchView = Pick<AIKillSwitch, 'switch_id' | 'scope' | 'target' | 'enabled' | 'reason' | 'activated_by' | 'activated_at' | 'deactivated_by' | 'deactivated_at'>;

// eslint-disable-next-line no-control-regex
const controlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const deny = (code: string, status = 403): never => { throw new GovernanceError(code, status); };

export function parseKillSwitchActivation(raw: unknown): KillSwitchActivationRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) deny('AI_KILL_SWITCH_INVALID_REQUEST', 400);
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r).sort().join(',');
  if (typeof r.reason !== 'string') deny('AI_KILL_SWITCH_INVALID_REQUEST', 400);
  const reason = (r.reason as string).trim();
  if (reason.length < 10 || reason.length > 500 || controlChars.test(reason)) deny('AI_KILL_SWITCH_REASON_INVALID', 400);
  if (r.scope === 'GLOBAL' && keys === 'reason,scope') return { scope: 'GLOBAL', reason };
  if (r.scope === 'AGENT' && keys === 'agent_id,reason,scope' && typeof r.agent_id === 'string') {
    try { findCanonicalAgent(r.agent_id); } catch { deny('AI_KILL_SWITCH_UNKNOWN_AGENT', 400); }
    return { scope: 'AGENT', agent_id: r.agent_id as string, reason };
  }
  // MODEL / TOOL / WORKFLOW scopes and any extra keys (tenant, actor, enabled flags) are refused.
  return deny('AI_KILL_SWITCH_INVALID_REQUEST', 400);
}

async function securityEvent(sql: SqlConnection, identity: VerifiedIdentity, memberExists: boolean, type: 'KILL_SWITCH' | 'AUTHORIZATION_DENIAL', agentId: string | null, details: Record<string, unknown>) {
  await sql.query(
    'INSERT INTO ai_security_events(tenant_id,agent_id,event_type,actor_uid,severity,details)VALUES($1,$2,$3,$4,$5,$6::jsonb)',
    // actor_uid is FK-bound to members; unknown actors are recorded by hashed uid in details only.
    [identity.tenant_id, agentId, type, memberExists ? identity.uid : null, type === 'KILL_SWITCH' ? 'CRITICAL' : 'HIGH',
      JSON.stringify(memberExists ? details : { ...details, actor_uid_sha256: createHash('sha256').update(identity.uid).digest('hex') })]);
}

export class KillSwitchService {
  constructor(private readonly sessions: SessionAuthority, private readonly db: TransactionalSql) {}

  private verifyIdentity(token: string): Promise<VerifiedIdentity> { return verifyGovernanceIdentity(this.sessions, token); }

  /** Tenant comes only from the verified identity; request bodies cannot target another tenant. */
  async activate(token: string, raw: unknown): Promise<KillSwitchActivationResult> {
    const identity = await this.verifyIdentity(token);
    const request = parseKillSwitchActivation(raw);
    const target = request.scope === 'GLOBAL' ? 'GLOBAL' : request.agent_id;
    const agentId = request.scope === 'AGENT' ? request.agent_id : null;
    const reasonHash = createHash('sha256').update(request.reason).digest('hex');
    let outcome: { result: KillSwitchActivationResult | null; failure: GovernanceError | null };
    try {
      outcome = await this.db.transaction(async sql => {
        const member = await authorizedMember(sql, identity);
        if (!member.allowed) {
          // Denials are recorded and committed; no switch state is touched.
          await securityEvent(sql, identity, member.exists, 'AUTHORIZATION_DENIAL', agentId, { operation: 'KILL_SWITCH_ACTIVATE', scope: request.scope, target });
          return { result: null, failure: new GovernanceError('AI_KILL_SWITCH_ROLE_DENIED') };
        }
        const existing = (await sql.query<{ switch_id: string; enabled: boolean; activated_by: string; activated_at: string; deactivated_by: string | null; deactivated_at: string | null }>(
          'SELECT switch_id,enabled,activated_by,activated_at,deactivated_by,deactivated_at FROM ai_kill_switches WHERE tenant_id=$1 AND scope=$2 AND target=$3 FOR UPDATE',
          [identity.tenant_id, request.scope, target])).rows[0];
        let row: { switch_id: string; activated_by: string; activated_at: string };
        let alreadyActive = false;
        if (existing?.enabled) {
          row = existing; alreadyActive = true;
        } else if (existing) {
          row = (await sql.query<typeof row>(
            'UPDATE ai_kill_switches SET enabled=true,reason=$2,activated_by=$3,activated_at=now(),deactivated_by=null,deactivated_at=null WHERE switch_id=$1 RETURNING switch_id,activated_by,activated_at',
            [existing.switch_id, request.reason, identity.uid])).rows[0];
        } else {
          row = (await sql.query<typeof row>(
            'INSERT INTO ai_kill_switches(tenant_id,scope,target,agent_id,reason,activated_by)VALUES($1,$2,$3,$4,$5,$6) RETURNING switch_id,activated_by,activated_at',
            [identity.tenant_id, request.scope, target, agentId, request.reason, identity.uid])).rows[0];
        }
        await securityEvent(sql, identity, true, 'KILL_SWITCH', agentId, {
          operation: alreadyActive ? 'ACTIVATE_ALREADY_ACTIVE' : existing ? 'REACTIVATE' : 'ACTIVATE',
          scope: request.scope, target, switch_id: row.switch_id, reason_sha256: reasonHash,
          // Re-activation overwrites the row; the prior lifecycle is preserved here.
          ...(existing && !existing.enabled ? { prior: { activated_by: existing.activated_by, activated_at: existing.activated_at, deactivated_by: existing.deactivated_by, deactivated_at: existing.deactivated_at } } : {})
        });
        return { result: { switch_id: row.switch_id, scope: request.scope, target, enabled: true, already_active: alreadyActive,
          activated_by: row.activated_by, activated_at: new Date(row.activated_at).toISOString() }, failure: null };
      });
    } catch (error) {
      if (error instanceof GovernanceError) throw error;
      return deny('AI_KILL_SWITCH_UNAVAILABLE', 503);
    }
    if (outcome.failure) throw outcome.failure;
    return outcome.result!;
  }

  async list(token: string): Promise<KillSwitchView[]> {
    const identity = await this.verifyIdentity(token);
    try {
      const result = await this.db.transaction(async sql => {
        const member = await authorizedMember(sql, identity);
        if (!member.allowed) return null;
        return (await sql.query<KillSwitchView>(
          'SELECT switch_id,scope,target,enabled,reason,activated_by,activated_at,deactivated_by,deactivated_at FROM ai_kill_switches WHERE tenant_id=$1 ORDER BY activated_at DESC',
          [identity.tenant_id])).rows;
      });
      if (!result) deny('AI_KILL_SWITCH_ROLE_DENIED');
      return result!;
    } catch (error) {
      if (error instanceof GovernanceError) throw error;
      return deny('AI_KILL_SWITCH_UNAVAILABLE', 503);
    }
  }
}
