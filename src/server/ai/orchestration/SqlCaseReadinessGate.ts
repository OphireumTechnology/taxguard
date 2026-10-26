import type { TransactionalSql } from '../governance/SqlGovernanceStore';
import type { CaseReadinessGate } from './contracts';

/**
 * Reads taxguard_case_diagnostics_gate (review-only proposal 20261018160000) for A00. Read only. Where the proposal is
 * not applied the call fails and A00 reports the readiness as UNAVAILABLE.
 */
export class SqlCaseReadinessGate implements CaseReadinessGate {
  constructor(private readonly db: TransactionalSql) {}
  async read(tenantId: string, taxCaseId: string) {
    return this.db.transaction(async sql => (await sql.query<{ g: unknown }>('SELECT public.taxguard_case_diagnostics_gate($1,$2) AS g', [tenantId, taxCaseId])).rows[0]?.g);
  }
}
