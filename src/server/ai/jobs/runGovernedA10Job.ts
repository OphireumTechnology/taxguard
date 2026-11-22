import { randomUUID } from 'node:crypto';
import { DurableJobWorker } from '../../taxguard/operations/durableJobWorker';
import type { PracticeRpcClient } from '../../taxguard/practice/practiceStore';
import { evaluateGovernancePolicy } from '../governance/GovernanceControlPlane';
import { SqlGovernanceStore, type SqlConnection, type TransactionalSql } from '../governance/SqlGovernanceStore';
import { GovernanceError, type GovernanceRequest } from '../governance/contracts';
import type { EvidenceMetadata } from '../capabilities/contracts';
import { runA10AdvisoryJob, type ResolveA10Evidence } from './A10AdvisoryJob';

function jobRpc(sql: SqlConnection): PracticeRpcClient {
  return {
    async rpc(name, p) {
      const functions: Record<string, { sql: string; values: unknown[] }> = {
        taxguard_job_claim_ai: {
          sql: 'SELECT public.taxguard_job_claim_ai($1,$2,$3) AS result',
          values: [p.p_tenant, p.p_worker, p.p_lease_seconds],
        },
        taxguard_job_complete_ai: {
          sql: 'SELECT public.taxguard_job_complete_ai($1,$2,$3,$4,$5) AS result',
          values: [p.p_tenant, p.p_job, p.p_worker, p.p_lease_token, p.p_duplicate_group_count],
        },
        taxguard_job_fail: {
          sql: 'SELECT public.taxguard_job_fail($1,$2,$3,$4,$5,$6,$7) AS result',
          values: [p.p_tenant, p.p_job, p.p_worker, p.p_lease_token, p.p_error_code, p.p_error_message, p.p_permanent],
        },
      };
      const fn = functions[name];
      if (!fn || !Object.hasOwn(functions, name)) throw new Error('AI_JOB_RPC_UNSUPPORTED');
      const result = await sql.query<{ result: unknown }>(fn.sql, fn.values);
      return { data: result.rows[0].result, error: null };
    },
  };
}

function scopedEvidence(sql: SqlConnection): ResolveA10Evidence {
  const store = new SqlGovernanceStore({ transaction: work => work(sql) });
  return async job => {
    const cases = await sql.query<{ tax_year: number }>(
      'SELECT tax_year FROM public.taxguard_cases WHERE tenant_id=$1 AND client_id=$2 AND case_id=$3 LIMIT 2',
      [job.tenantId, job.clientId, job.caseId],
    );
    if (cases.rows.length !== 1 || !Number.isInteger(cases.rows[0].tax_year)) return null;

    // The actor comes from the durable enqueue record. No browser identity or saved bearer token is used.
    const identity = { tenant_id: job.tenantId, uid: job.actorId };
    const base: Omit<GovernanceRequest, 'request_id' | 'agent_id' | 'purpose' | 'capabilities'> = {
      scope: { tenant_id: job.tenantId, client_id: job.clientId, tax_case_id: job.caseId, tax_year: cases.rows[0].tax_year },
      workflow_stage: 3, intent: 'ADVISORY', data_classes: ['INTERNAL'], evidence_source_ids: [...job.sourceIds],
      confidence: 0, financial_amount: 0, risk_level: 'MATERIAL',
    };
    const coordinator: GovernanceRequest = { ...base, request_id: randomUUID(), agent_id: 'A00',
      purpose: 'COORDINATE_REVIEW', capabilities: [{ tool_id: 'workflow.read', action: 'READ' }] };
    const specialist: GovernanceRequest = { ...base, request_id: randomUUID(), agent_id: 'A10',
      purpose: 'DOCUMENT_DUPLICATE_CHECK', capabilities: [{ tool_id: 'document.read', action: 'READ' }] };

    return store.transaction(async tx => {
      try {
        evaluateGovernancePolicy(coordinator, await tx.load(identity, coordinator), Date.now(), true);
        const snapshot = await tx.load(identity, specialist);
        evaluateGovernancePolicy(specialist, snapshot, Date.now());
        return snapshot.evidence.map((row): EvidenceMetadata => ({
          source_id: row.source_id, document_record_id: row.document_record_id, document_version: row.document_version,
          source_hash: row.source_hash, document_status: row.document_status === 'VERIFIED' ? 'VERIFIED' : 'RELEASED',
          quarantine_status: 'CLEAN',
        }));
      } catch (error) {
        if (error instanceof GovernanceError && error.status === 403) return null;
        throw error;
      }
    });
  };
}

/** Disposable/isolated staging composition. Use PgGovernanceDatabase for SERIALIZABLE transactions. */
export function runGovernedA10Job(db: TransactionalSql, tenantId: string, workerId: string) {
  return db.transaction(sql => runA10AdvisoryJob(
    new DurableJobWorker(jobRpc(sql), tenantId, workerId),
    scopedEvidence(sql),
  ));
}
