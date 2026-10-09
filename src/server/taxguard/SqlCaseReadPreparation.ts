import type { AICaseScope } from '../../ai/types';
import { GovernanceError, type SessionAuthority, type VerifiedIdentity } from '../ai/governance/contracts';
import type { SqlConnection, TransactionalSql } from '../ai/governance/SqlGovernanceStore';

export interface DurableCaseReadScope extends AICaseScope { engagement_id: string }
export interface CaseReadMetadata {
  tenant_id: string; client_id: string; tax_case_id: string; tax_year: number; engagement_id: string;
  active_stage: number; revision: number; status: string; open_exceptions: number;
}
function validateScope(raw: unknown): asserts raw is DurableCaseReadScope {
  const s = raw as DurableCaseReadScope;
  if (!s || typeof s !== 'object' || Array.isArray(s) ||
      Object.keys(s).sort().join(',') !== 'client_id,engagement_id,tax_case_id,tax_year,tenant_id' ||
      ![s.tenant_id, s.client_id, s.tax_case_id, s.engagement_id].every(v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)) ||
      !Number.isInteger(s.tax_year) || s.tax_year < 2000 || s.tax_year > 2200) throw new GovernanceError('CASE_READ_INVALID_SCOPE', 400);
}

/** SQL adapter preparation only; no production factory, activation environment flag or HTTP route. */
export class SqlCaseReadPreparation {
  constructor(private readonly sessions: SessionAuthority, private readonly db: TransactionalSql,
    private readonly mode: 'DISABLED' | 'SYNTHETIC' = 'DISABLED') {}

  private async identity(token: string, scope: Pick<DurableCaseReadScope, 'tenant_id'>, previous?: VerifiedIdentity) {
    let identity;
    try { identity = await this.sessions.verify(token); } catch { throw new GovernanceError('CASE_READ_AUTH_UNAVAILABLE', 503); }
    if (!identity) throw new GovernanceError('CASE_READ_AUTH_REQUIRED', 401);
    if (identity.tenant_id !== scope.tenant_id || previous && (identity.uid !== previous.uid || identity.tenant_id !== previous.tenant_id)) {
      throw new GovernanceError('CASE_READ_SCOPE_DENIED');
    }
    return identity;
  }

  private async load(sql: SqlConnection, identity: VerifiedIdentity, s: DurableCaseReadScope) {
    // Reuse the canonical existing accountant/preparer and reviewer assignment semantics.
    // No administrator bypass or inferred engagement/year link is introduced.
    const result = await sql.query<CaseReadMetadata & { actor_role: string }>(`
      SELECT c.tenant_id,c.client_id,c.case_id AS tax_case_id,c.tax_year,c.engagement_id,
             c.active_stage,c.revision,c.status,c.open_exceptions,m.role AS actor_role
      FROM taxguard_cases c
      JOIN taxguard_members m ON m.tenant_id=c.tenant_id AND m.uid=$6 AND m.status='active'
      JOIN taxguard_clients cl ON cl.tenant_id=c.tenant_id AND cl.client_id=c.client_id AND cl.status='active'
      JOIN taxguard_engagements e ON e.tenant_id=c.tenant_id AND e.client_id=c.client_id AND e.engagement_id=c.engagement_id AND e.status='active'
      JOIN taxguard_tax_years y ON y.tenant_id=c.tenant_id AND y.client_id=c.client_id AND y.engagement_id=c.engagement_id AND y.tax_year=c.tax_year AND y.status='active'
      WHERE c.tenant_id=$1 AND c.client_id=$2 AND c.case_id=$3 AND c.tax_year=$4 AND c.engagement_id=$5
      AND ((m.role='accountant' AND c.preparer_uid=m.uid) OR (m.role IN ('reviewer','senior_reviewer') AND c.reviewer_uid=m.uid))
      AND EXISTS (SELECT 1 FROM taxguard_case_assignments a JOIN taxguard_staff_assignments s
        ON s.tenant_id=a.tenant_id AND s.user_id=a.uid
        WHERE a.tenant_id=c.tenant_id AND a.case_id=c.case_id AND a.uid=m.uid AND a.active AND a.assigned_at<=now()
        AND a.role=CASE WHEN m.role='accountant' THEN 'preparer' ELSE 'reviewer' END
        AND s.client_id=c.client_id AND s.engagement_id=c.engagement_id AND s.tax_year=c.tax_year
        AND s.role IN (a.role,m.role) AND s.status='ACTIVE' AND s.effective_from<=now() AND (s.effective_to IS NULL OR s.effective_to>now()))
      FOR SHARE OF c,m,cl,e,y`, [s.tenant_id, s.client_id, s.tax_case_id, s.tax_year, s.engagement_id, identity.uid]);
    if (result.rows.length !== 1) throw new GovernanceError('CASE_READ_SCOPE_DENIED');
    return result.rows[0];
  }

  async read(token: string, raw: unknown): Promise<CaseReadMetadata> {
    // Even a caller explicitly selecting SYNTHETIC cannot commission this reader in production.
    if (this.mode !== 'SYNTHETIC' || process.env.NODE_ENV !== 'test') throw new GovernanceError('DURABLE_CASE_READ_CUTOVER_REQUIRED', 503);
    validateScope(raw); const s = structuredClone(raw); const identity = await this.identity(token, s);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.db.transaction(async sql => {
          await this.identity(token, s, identity);
          // Lock assignments before checking their effectiveness; same-transaction revocations are rechecked below.
          await sql.query('SELECT id FROM taxguard_case_assignments WHERE tenant_id=$1 AND case_id=$2 AND uid=$3 FOR SHARE', [s.tenant_id, s.tax_case_id, identity.uid]);
          await sql.query('SELECT id FROM taxguard_staff_assignments WHERE tenant_id=$1 AND client_id=$2 AND engagement_id=$3 AND tax_year=$4 AND user_id=$5 FOR SHARE', [s.tenant_id, s.client_id, s.engagement_id, s.tax_year, identity.uid]);
          const first = await this.load(sql, identity, s);
          await this.identity(token, s, identity);
          const current = await this.load(sql, identity, s);
          if (first.revision !== current.revision) throw new GovernanceError('CASE_READ_AUTHORITY_CHANGED');
          // Counts/identifiers only; no token, notes, raw document, taxpayer facts or success attestation.
          await sql.query(`INSERT INTO taxguard_audit_log(tenant_id,case_id,action,actor_uid,actor_role,metadata)
            VALUES($1,$2,'SYNTHETIC_CASE_METADATA_READ',$3,$4,$5::jsonb)`,
          [s.tenant_id, s.tax_case_id, identity.uid, current.actor_role, JSON.stringify({ engagement_id: s.engagement_id, tax_year: s.tax_year, revision: current.revision })]);
          await this.identity(token, s, identity);
          const { actor_role, ...metadata } = current;
          return metadata;
        });
      } catch (error) {
        if (error instanceof GovernanceError) throw error;
        // Retry a known rolled-back serialization failure once, with fresh authority. Never retry unknown delivery/commit errors.
        if (attempt === 0 && (error as { code?: string })?.code === '40001') continue;
        throw new GovernanceError('CASE_READ_UNAVAILABLE', 503);
      }
    }
    throw new GovernanceError('CASE_READ_UNAVAILABLE', 503);
  }

  /** Bounded reviewer metadata discovery only; no drafts, approval grants or production cutover. */
  async reviewerQueue(token: string, tenantId: string, limit = 50): Promise<{ items: CaseReadMetadata[]; has_more: boolean }> {
    if (this.mode !== 'SYNTHETIC' || process.env.NODE_ENV !== 'test') throw new GovernanceError('DURABLE_CASE_READ_CUTOVER_REQUIRED', 503);
    if (typeof tenantId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(tenantId) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new GovernanceError('CASE_READ_INVALID_SCOPE', 400);
    }
    const tenant = { tenant_id: tenantId }; const identity = await this.identity(token, tenant);
    try {
      return await this.db.transaction(async sql => {
        await this.identity(token, tenant, identity);
        const members = await sql.query<{ role: string }>(
          "SELECT role FROM taxguard_members WHERE tenant_id=$1 AND uid=$2 AND status='active' AND role IN ('reviewer','senior_reviewer') FOR SHARE", [tenantId, identity.uid]);
        if (members.rows.length !== 1) throw new GovernanceError('CASE_READ_SCOPE_DENIED');
        const scopes = await sql.query<DurableCaseReadScope>(`
          SELECT c.tenant_id,c.client_id,c.case_id AS tax_case_id,c.tax_year,c.engagement_id
          FROM taxguard_cases c
          JOIN taxguard_clients cl ON cl.tenant_id=c.tenant_id AND cl.client_id=c.client_id AND cl.status='active'
          JOIN taxguard_engagements e ON e.tenant_id=c.tenant_id AND e.client_id=c.client_id AND e.engagement_id=c.engagement_id AND e.status='active'
          JOIN taxguard_tax_years y ON y.tenant_id=c.tenant_id AND y.client_id=c.client_id AND y.engagement_id=c.engagement_id AND y.tax_year=c.tax_year AND y.status='active'
          WHERE c.tenant_id=$1 AND c.reviewer_uid=$2
          AND EXISTS (SELECT 1 FROM taxguard_case_assignments a JOIN taxguard_staff_assignments s
            ON s.tenant_id=a.tenant_id AND s.user_id=a.uid
            WHERE a.tenant_id=c.tenant_id AND a.case_id=c.case_id AND a.uid=$2 AND a.role='reviewer' AND a.active AND a.assigned_at<=now()
            AND s.client_id=c.client_id AND s.engagement_id=c.engagement_id AND s.tax_year=c.tax_year
            AND s.role IN ('reviewer','senior_reviewer') AND s.status='ACTIVE' AND s.effective_from<=now() AND (s.effective_to IS NULL OR s.effective_to>now()))
          ORDER BY c.client_id,c.tax_year,c.case_id LIMIT $3 FOR SHARE OF c,cl,e,y`, [tenantId, identity.uid, limit + 1]);
        const items: CaseReadMetadata[] = [];
        // The extra bounded row also establishes a scoped has_more hint; authorize and audit it too.
        const selected = scopes.rows;
        for (const scope of selected) {
          validateScope(scope);
          await sql.query('SELECT id FROM taxguard_case_assignments WHERE tenant_id=$1 AND case_id=$2 AND uid=$3 FOR SHARE', [tenantId, scope.tax_case_id, identity.uid]);
          await sql.query('SELECT id FROM taxguard_staff_assignments WHERE tenant_id=$1 AND client_id=$2 AND engagement_id=$3 AND tax_year=$4 AND user_id=$5 FOR SHARE', [tenantId, scope.client_id, scope.engagement_id, scope.tax_year, identity.uid]);
          await this.identity(token, scope, identity);
          const { actor_role, ...metadata } = await this.load(sql, identity, scope);
          if (!['reviewer', 'senior_reviewer'].includes(actor_role)) throw new GovernanceError('CASE_READ_SCOPE_DENIED');
          await sql.query(`INSERT INTO taxguard_audit_log(tenant_id,case_id,action,actor_uid,actor_role,metadata)
            VALUES($1,$2,'SYNTHETIC_REVIEWER_QUEUE_READ',$3,$4,$5::jsonb)`, [tenantId, scope.tax_case_id, identity.uid, actor_role,
            JSON.stringify({ engagement_id: scope.engagement_id, tax_year: scope.tax_year, revision: metadata.revision })]);
          items.push(metadata);
        }
        // Recheck every returned scope after audit; any revocation suppresses the entire result and rolls back history.
        for (const [index, scope] of selected.entries()) {
          const current = await this.load(sql, identity, scope);
          if (!['reviewer', 'senior_reviewer'].includes(current.actor_role) || current.revision !== items[index].revision) throw new GovernanceError('CASE_READ_AUTHORITY_CHANGED');
        }
        const currentMember = await sql.query<{ role: string }>(
          "SELECT role FROM taxguard_members WHERE tenant_id=$1 AND uid=$2 AND status='active' AND role IN ('reviewer','senior_reviewer')", [tenantId, identity.uid]);
        if (currentMember.rows.length !== 1) throw new GovernanceError('CASE_READ_SCOPE_DENIED');
        await this.identity(token, tenant, identity);
        return { items: items.slice(0, limit), has_more: scopes.rows.length > limit };
      });
    } catch (error) {
      if (error instanceof GovernanceError) throw error;
      throw new GovernanceError('CASE_READ_UNAVAILABLE', 503);
    }
  }
}
