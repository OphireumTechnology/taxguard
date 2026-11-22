import type { AICaseScope } from '../../../ai/types';
import { PgGovernanceDatabase, type TransactionalSql } from '../governance/SqlGovernanceStore';
import { Pool } from 'pg';
import { SqlWorkforceStore } from './sqlWorkforceStore';
import {
  WorkforceError,
  type AuthorizedDocumentEvidence,
  type KillSwitchState,
  type OcrProviderConfig,
  type SyntheticStagingPermissionConfig,
  type WorkforceActor,
  type WorkforceCaseRecord,
  type WorkforceEnvironment,
  type WorkforceStaffRole,
  type WorkforceStore,
} from './contracts';

const VALID_ROLES = new Set<WorkforceStaffRole>([
  'accountant',
  'bookkeeper',
  'reviewer',
  'senior_reviewer',
  'cpa',
  'ea',
  'operations',
  'practice_manager',
  'compliance',
  'admin',
  'super_admin',
]);

let sharedPool: Pool | null = null;
function getConfiguredPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new WorkforceError('WORKFORCE_DATABASE_UNAVAILABLE', 503);
  }
  if (!sharedPool) {
    sharedPool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  }
  return sharedPool;
}

/**
 * Production PostgreSQL-backed WorkforceEnvironment.
 * Fails closed with 503 WORKFORCE_DATABASE_UNAVAILABLE when DATABASE_URL is not configured.
 * Never returns mock data, never enables A10 live decision recording unless explicitly configured
 * in non-production staging with TAXGUARD_ALLOW_A10_SYNTHETIC_STAGING_DECISIONS=true.
 */
export class PgWorkforceEnvironment implements WorkforceEnvironment {
  constructor(
    private readonly db: TransactionalSql,
    private readonly resolveSession: (token: string) => Promise<{ uid: string; tenant_id: string } | null>,
  ) {}

  async verifyActor(token: string): Promise<WorkforceActor | null> {
    if (!token || !token.trim()) return null;
    const identity = await this.resolveSession(token);
    if (!identity) return null;
    return this.db.transaction(async sql => {
      const row = (
        await sql.query<{
          uid: string;
          tenant_id: string;
          role: string;
          status: string;
          credential_verified: boolean;
        }>(
          `SELECT uid, tenant_id, role, status, credential_verified
           FROM taxguard_members
           WHERE tenant_id = $1 AND uid = $2
           LIMIT 1`,
          [identity.tenant_id, identity.uid],
        )
      ).rows[0];
      if (!row || !VALID_ROLES.has(row.role as WorkforceStaffRole)) return null;
      return {
        uid: row.uid,
        tenant_id: row.tenant_id,
        role: row.role as WorkforceStaffRole,
        status: row.status === 'active' ? 'active' : 'inactive',
        credential_verified: row.credential_verified === true,
      };
    });
  }

  async loadCase(tenantId: string, scope: AICaseScope): Promise<WorkforceCaseRecord | null> {
    return this.db.transaction(async sql => {
      const row = (
        await sql.query<any>(
          `SELECT id AS case_record_id, tenant_id, client_id, case_id AS tax_case_id,
                  tax_year, engagement_id, active_stage, status, preparer_uid, reviewer_uid, client_uid
           FROM taxguard_cases
           WHERE tenant_id = $1 AND client_id = $2 AND case_id = $3 AND tax_year = $4
           LIMIT 1`,
          [tenantId, scope.client_id, scope.tax_case_id, scope.tax_year],
        )
      ).rows[0];
      return row ?? null;
    });
  }

  async isStaffAssigned(actor: WorkforceActor, caseRecord: WorkforceCaseRecord): Promise<boolean> {
    return this.db.transaction(async sql => {
      const caseRole =
        actor.role === 'accountant'
          ? 'preparer'
          : actor.role === 'reviewer' || actor.role === 'senior_reviewer'
            ? 'reviewer'
            : actor.role;
      const rows = (
        await sql.query<{ id: string }>(
          `SELECT a.id
           FROM taxguard_case_assignments a
           JOIN taxguard_staff_assignments s
             ON s.tenant_id = a.tenant_id AND s.user_id = a.uid
           JOIN taxguard_clients cl
             ON cl.tenant_id = s.tenant_id AND cl.client_id = s.client_id
           WHERE a.tenant_id = $1 AND a.case_id = $2 AND a.uid = $3 AND a.active AND a.assigned_at <= now()
             AND s.client_id = $4 AND s.engagement_id = $5 AND s.tax_year = $6
             AND s.role IN ($7, $8) AND s.status = 'ACTIVE'
             AND s.effective_from <= now() AND (s.effective_to IS NULL OR s.effective_to > now())
             AND cl.status = 'active'
           LIMIT 1`,
          [
            actor.tenant_id,
            caseRecord.tax_case_id,
            actor.uid,
            caseRecord.client_id,
            caseRecord.engagement_id,
            caseRecord.tax_year,
            caseRole,
            actor.role,
          ],
        )
      ).rows;
      return rows.length > 0;
    });
  }

  async loadEvidence(
    tenantId: string,
    scope: AICaseScope,
    sourceIds: readonly string[],
  ): Promise<readonly AuthorizedDocumentEvidence[]> {
    if (sourceIds.length === 0) return [];
    return this.db.transaction(async sql => {
      const rows = (
        await sql.query<any>(
          `SELECT e.source_id, e.document_record_id, d.version AS document_version,
                  d.hash AS source_hash, d.status AS document_status, d.quarantine_status,
                  d.tenant_id, d.client_id, d.case_id AS tax_case_id, d.tax_year
           FROM ai_evidence_sources e
           JOIN taxguard_documents d ON d.id = e.document_record_id
           WHERE e.source_id = ANY($1::uuid[])
             AND e.tenant_id = $2 AND e.client_id = $3 AND e.tax_case_id = $4 AND e.tax_year = $5
             AND d.tenant_id = e.tenant_id AND d.client_id = e.client_id
             AND d.case_id = e.tax_case_id AND d.tax_year = e.tax_year
           ORDER BY e.source_id LIMIT 50`,
          [sourceIds, tenantId, scope.client_id, scope.tax_case_id, scope.tax_year],
        )
      ).rows;
      return rows;
    });
  }

  async getKillSwitches(tenantId: string): Promise<KillSwitchState> {
    return this.db.transaction(async sql => {
      const rows = (
        await sql.query<{ scope: string; agent_id: string | null; tool_id: string | null; workflow_stage: number | null }>(
          `SELECT scope, agent_id, tool_id, workflow_stage
           FROM ai_kill_switches
           WHERE tenant_id = $1 AND enabled = true`,
          [tenantId],
        )
      ).rows;
      return {
        global_stop: rows.some(r => r.scope === 'GLOBAL'),
        stopped_agents: rows.filter(r => r.scope === 'AGENT' && r.agent_id).map(r => r.agent_id as any),
        stopped_stages: rows.filter(r => r.scope === 'WORKFLOW' && r.workflow_stage !== null).map(r => Number(r.workflow_stage)),
        stopped_tools: rows.filter(r => r.scope === 'TOOL' && r.tool_id).map(r => String(r.tool_id)),
      };
    });
  }

  getOcrProviderConfig(): OcrProviderConfig {
    const providerId = process.env.TAXGUARD_APPROVED_OCR_PROVIDER_ID?.trim() || null;
    const lineageSigning = process.env.TAXGUARD_OCR_LINEAGE_SIGNING === 'true';
    return {
      configured: Boolean(providerId && lineageSigning),
      approved_provider_id: providerId,
      provider_version: process.env.TAXGUARD_APPROVED_OCR_PROVIDER_VERSION?.trim() || null,
      lineage_signing_enabled: lineageSigning,
    };
  }

  getSyntheticStagingConfig(): SyntheticStagingPermissionConfig {
    // Never allow synthetic staging override in production runtime.
    const allowed =
      process.env.NODE_ENV !== 'production' &&
      process.env.TAXGUARD_ALLOW_A10_SYNTHETIC_STAGING_DECISIONS === 'true';
    return {
      allow_a10_synthetic_staging_decisions: allowed,
    };
  }

  isLlmGatewayConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
  }
}

export function createProductionWorkforceRuntime(
  resolveSession: (token: string) => Promise<{ uid: string; tenant_id: string } | null>,
): { env: WorkforceEnvironment; store: WorkforceStore } {
  const db = new PgGovernanceDatabase(getConfiguredPool());
  return {
    env: new PgWorkforceEnvironment(db, resolveSession),
    store: new SqlWorkforceStore(db),
  };
}
