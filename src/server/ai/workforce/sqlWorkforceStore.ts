import type { AgentId } from '../../../ai/types';
import type { TransactionalSql } from '../governance/SqlGovernanceStore';
import {
  WorkforceError,
  type WorkforceAdvisoryOutput,
  type WorkforceHumanDecisionRecord,
  type WorkforceJobRecord,
  type WorkforceJobStatus,
  type WorkforceStore,
} from './contracts';

/**
 * Parameterized PostgreSQL transactional store for TaxGuard's 61-agent workforce.
 * Backed by migration 20261122120000_ai_workforce_jobs_and_decisions.sql:
 *   - ai_workforce_jobs
 *   - ai_workforce_advisories
 *   - ai_workforce_decisions
 *
 * Guarantees:
 * - Tenant-scoped queries on every read/write.
 * - Idempotent job creation via (tenant_id, agent_id, idempotency_key).
 * - Atomic row-locked concurrent-decision conflict prevention (`SELECT ... FOR UPDATE` +
 *   unique constraint on advisory_id).
 */
export class SqlWorkforceStore implements WorkforceStore {
  constructor(private readonly db: TransactionalSql) {}

  async createOrGetJob(
    job: Omit<WorkforceJobRecord, 'created_at' | 'updated_at'>,
  ): Promise<{ job: WorkforceJobRecord; created: boolean }> {
    return this.db.transaction(async sql => {
      const existing = (
        await sql.query<WorkforceJobRecord>(
          `SELECT job_id, idempotency_key, tenant_id, client_id, tax_case_id, tax_year, case_record_id,
                  agent_id, workflow_stage, requested_by, evidence_source_ids, metadata_payload,
                  status, advisory_id, error_code, created_at, updated_at
           FROM ai_workforce_jobs
           WHERE tenant_id = $1 AND agent_id = $2 AND idempotency_key = $3
           LIMIT 1`,
          [job.tenant_id, job.agent_id, job.idempotency_key],
        )
      ).rows[0];

      if (existing) {
        return { job: existing, created: false };
      }

      const inserted = (
        await sql.query<WorkforceJobRecord>(
          `INSERT INTO ai_workforce_jobs (
             job_id, idempotency_key, tenant_id, client_id, tax_case_id, tax_year, case_record_id,
             agent_id, workflow_stage, requested_by, evidence_source_ids, metadata_payload,
             status, advisory_id, error_code
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)
           RETURNING job_id, idempotency_key, tenant_id, client_id, tax_case_id, tax_year, case_record_id,
                     agent_id, workflow_stage, requested_by, evidence_source_ids, metadata_payload,
                     status, advisory_id, error_code, created_at, updated_at`,
          [
            job.job_id,
            job.idempotency_key,
            job.tenant_id,
            job.client_id,
            job.tax_case_id,
            job.tax_year,
            job.case_record_id,
            job.agent_id,
            job.workflow_stage,
            job.requested_by,
            JSON.stringify(job.evidence_source_ids),
            JSON.stringify(job.metadata_payload),
            job.status,
            job.advisory_id,
            job.error_code,
          ],
        )
      ).rows[0];

      return { job: inserted, created: true };
    });
  }

  async getJob(tenantId: string, jobId: string): Promise<WorkforceJobRecord | null> {
    return this.db.transaction(async sql => {
      const rows = (
        await sql.query<WorkforceJobRecord>(
          `SELECT job_id, idempotency_key, tenant_id, client_id, tax_case_id, tax_year, case_record_id,
                  agent_id, workflow_stage, requested_by, evidence_source_ids, metadata_payload,
                  status, advisory_id, error_code, created_at, updated_at
           FROM ai_workforce_jobs
           WHERE tenant_id = $1 AND job_id = $2
           LIMIT 1`,
          [tenantId, jobId],
        )
      ).rows;
      return rows[0] ?? null;
    });
  }

  async updateJobStatus(
    tenantId: string,
    jobId: string,
    status: WorkforceJobStatus,
    patch?: { advisory_id?: string | null; error_code?: string | null },
  ): Promise<WorkforceJobRecord> {
    return this.db.transaction(async sql => {
      const rows = (
        await sql.query<WorkforceJobRecord>(
          `UPDATE ai_workforce_jobs
           SET status = $3,
               advisory_id = COALESCE($4, advisory_id),
               error_code = $5,
               updated_at = now()
           WHERE tenant_id = $1 AND job_id = $2
           RETURNING job_id, idempotency_key, tenant_id, client_id, tax_case_id, tax_year, case_record_id,
                     agent_id, workflow_stage, requested_by, evidence_source_ids, metadata_payload,
                     status, advisory_id, error_code, created_at, updated_at`,
          [tenantId, jobId, status, patch?.advisory_id ?? null, patch?.error_code ?? null],
        )
      ).rows;
      if (!rows[0]) throw new WorkforceError('WORKFORCE_JOB_NOT_FOUND', 404);
      return rows[0];
    });
  }

  async saveAdvisory(advisory: WorkforceAdvisoryOutput): Promise<WorkforceAdvisoryOutput> {
    return this.db.transaction(async sql => {
      await sql.query(
        `INSERT INTO ai_workforce_advisories (
           advisory_id, job_id, tenant_id, client_id, tax_case_id, tax_year,
           agent_id, agent_name, batch_id, workflow_stage, status, summary,
           findings, structured_data, evidence_pins, evidence_fingerprint,
           authority_citations, required_reviewer_role, permitted_decisions,
           output_audience, human_review_required, authoritative_mutation,
           external_submission_allowed, requested_by, created_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
           $13::jsonb,$14::jsonb,$15::jsonb,$16,$17::jsonb,$18,$19::jsonb,
           $20,true,false,false,$21,$22
         )`,
        [
          advisory.advisory_id,
          advisory.job_id,
          advisory.scope.tenant_id,
          advisory.scope.client_id,
          advisory.scope.tax_case_id,
          advisory.scope.tax_year,
          advisory.agent_id,
          advisory.agent_name,
          advisory.batch_id,
          advisory.workflow_stage,
          advisory.status,
          advisory.summary,
          JSON.stringify(advisory.findings),
          JSON.stringify(advisory.structured_data),
          JSON.stringify(advisory.evidence_pins),
          advisory.evidence_fingerprint,
          JSON.stringify(advisory.authority_citations),
          advisory.required_reviewer_role,
          JSON.stringify(advisory.permitted_decisions),
          advisory.output_audience,
          advisory.requested_by,
          advisory.created_at,
        ],
      );
      return advisory;
    });
  }

  async getAdvisory(tenantId: string, advisoryId: string): Promise<WorkforceAdvisoryOutput | null> {
    return this.db.transaction(async sql => {
      const rows = (
        await sql.query<any>(
          `SELECT * FROM ai_workforce_advisories WHERE tenant_id = $1 AND advisory_id = $2 LIMIT 1`,
          [tenantId, advisoryId],
        )
      ).rows;
      return rows[0] ? mapAdvisoryRow(rows[0]) : null;
    });
  }

  async listCaseAdvisories(
    tenantId: string,
    taxCaseId: string,
    agentId?: AgentId,
  ): Promise<readonly WorkforceAdvisoryOutput[]> {
    return this.db.transaction(async sql => {
      const params: unknown[] = [tenantId, taxCaseId];
      const filter = agentId ? (params.push(agentId), ` AND agent_id = $3`) : '';
      const rows = (
        await sql.query<any>(
          `SELECT * FROM ai_workforce_advisories
           WHERE tenant_id = $1 AND tax_case_id = $2${filter}
           ORDER BY created_at DESC LIMIT 100`,
          params,
        )
      ).rows;
      return rows.map(mapAdvisoryRow);
    });
  }

  async recordDecisionAtomic(
    decision: WorkforceHumanDecisionRecord,
  ): Promise<WorkforceHumanDecisionRecord> {
    return this.db.transaction(async sql => {
      const advisoryRows = (
        await sql.query<{ advisory_id: string; evidence_fingerprint: string }>(
          `SELECT advisory_id, evidence_fingerprint
           FROM ai_workforce_advisories
           WHERE tenant_id = $1 AND advisory_id = $2
           FOR UPDATE`,
          [decision.tenant_id, decision.advisory_id],
        )
      ).rows;

      if (!advisoryRows[0]) {
        throw new WorkforceError('WORKFORCE_ADVISORY_NOT_FOUND', 404);
      }
      if (advisoryRows[0].evidence_fingerprint !== decision.bound_evidence_fingerprint) {
        throw new WorkforceError('STALE_EVIDENCE_CONFLICT', 409);
      }

      const existing = (
        await sql.query<{ decision_id: string }>(
          `SELECT decision_id FROM ai_workforce_decisions
           WHERE tenant_id = $1 AND advisory_id = $2 LIMIT 1`,
          [decision.tenant_id, decision.advisory_id],
        )
      ).rows;

      if (existing.length > 0) {
        throw new WorkforceError('CONCURRENT_DECISION_CONFLICT', 409);
      }

      await sql.query(
        `INSERT INTO ai_workforce_decisions (
           decision_id, advisory_id, tenant_id, client_id, tax_case_id, tax_year,
           agent_id, bound_evidence_fingerprint, bound_evidence_versions,
           reviewer_uid, reviewer_role, decision, rationale,
           synthetic_staging_gate_used, authoritative_mutation, recorded_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,false,$15)`,
        [
          decision.decision_id,
          decision.advisory_id,
          decision.tenant_id,
          decision.client_id,
          decision.tax_case_id,
          decision.tax_year,
          decision.agent_id,
          decision.bound_evidence_fingerprint,
          JSON.stringify(decision.bound_evidence_versions),
          decision.reviewer_uid,
          decision.reviewer_role,
          decision.decision,
          decision.rationale,
          decision.synthetic_staging_gate_used,
          decision.recorded_at,
        ],
      );

      return decision;
    });
  }

  async listAdvisoryDecisions(
    tenantId: string,
    advisoryId: string,
  ): Promise<readonly WorkforceHumanDecisionRecord[]> {
    return this.db.transaction(async sql => {
      const rows = (
        await sql.query<WorkforceHumanDecisionRecord>(
          `SELECT decision_id, advisory_id, tenant_id, client_id, tax_case_id, tax_year,
                  agent_id, bound_evidence_fingerprint, bound_evidence_versions,
                  reviewer_uid, reviewer_role, decision, rationale,
                  synthetic_staging_gate_used, authoritative_mutation, recorded_at
           FROM ai_workforce_decisions
           WHERE tenant_id = $1 AND advisory_id = $2
           ORDER BY recorded_at DESC`,
          [tenantId, advisoryId],
        )
      ).rows;
      return rows;
    });
  }
}

function mapAdvisoryRow(row: any): WorkforceAdvisoryOutput {
  return {
    advisory_id: row.advisory_id,
    job_id: row.job_id ?? null,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    batch_id: row.batch_id,
    workflow_stage: Number(row.workflow_stage),
    scope: {
      tenant_id: row.tenant_id,
      client_id: row.client_id,
      tax_case_id: row.tax_case_id,
      tax_year: Number(row.tax_year),
    },
    status: row.status,
    summary: row.summary,
    findings: row.findings ?? [],
    structured_data: row.structured_data ?? {},
    evidence_pins: row.evidence_pins ?? [],
    evidence_fingerprint: row.evidence_fingerprint,
    authority_citations: row.authority_citations ?? [],
    required_reviewer_role: row.required_reviewer_role,
    permitted_decisions: row.permitted_decisions ?? [],
    output_audience: row.output_audience,
    human_review_required: true,
    authoritative_mutation: false,
    external_submission_allowed: false,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
    requested_by: row.requested_by,
  };
}
