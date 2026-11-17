import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { SqlCaseReadPreparation } from '../server/taxguard/SqlCaseReadPreparation';
import type { TransactionalSql } from '../server/ai/governance/SqlGovernanceStore';
let f: Awaited<ReturnType<typeof capabilityFixture>>;
let verify = vi.fn();
const identity = { uid: 'reviewer', tenant_id: 'tenantA' };
beforeAll(async () => {
  f = await capabilityFixture();
  await f.pg.exec(`INSERT INTO taxguard_engagements(tenant_id,client_id,engagement_id) VALUES('tenantA','clientA','engA'),('tenantA','clientB','engB');
    INSERT INTO taxguard_tax_years(tenant_id,client_id,engagement_id,tax_year) VALUES('tenantA','clientA','engA',2025),('tenantA','clientB','engB',2024);
    INSERT INTO taxguard_cases(case_id,tenant_id,client_id,engagement_id,tax_year,client_uid,preparer_uid,reviewer_uid,created_by,updated_by)
      VALUES('caseB','tenantA','clientB','engB',2024,'other','preparer','other','test','test');
    INSERT INTO taxguard_case_assignments(case_id,tenant_id,uid,role) VALUES('caseA','tenantA','reviewer','reviewer'),('caseB','tenantA','reviewer','reviewer');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,engagement_id,tax_year,role,user_id,assigned_by)
      VALUES('revA','tenantA','clientA','engA',2025,'reviewer','reviewer','test'),('revB','tenantA','clientB','engB',2024,'reviewer','reviewer','test');`);
}, 30000);
beforeEach(async () => {
  verify = vi.fn().mockResolvedValue(identity);
  await f.pg.exec(`UPDATE taxguard_members SET role='reviewer',status='active' WHERE uid='reviewer';
    UPDATE taxguard_cases SET reviewer_uid=CASE WHEN case_id='caseA' THEN 'reviewer' ELSE 'other' END,revision=1;
    UPDATE taxguard_case_assignments SET active=true,assigned_at=now() WHERE uid='reviewer';
    UPDATE taxguard_staff_assignments SET status='ACTIVE',effective_from=now(),effective_to=null WHERE user_id='reviewer';
    UPDATE taxguard_staff_assignments SET tax_year=2025 WHERE id='revA';
    UPDATE taxguard_clients SET status='active'; UPDATE taxguard_engagements SET status='active'; UPDATE taxguard_tax_years SET status='active';`);
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { await f?.pg.close(); });
const service = (db: TransactionalSql = f.db) => new SqlCaseReadPreparation({ verify }, db, 'SYNTHETIC');
it('discovers only independently reviewer-assigned metadata and records bounded audit', async () => {
  const result = await service().reviewerQueue('synthetic_token', 'tenantA');
  expect(result).toEqual({ has_more: false, items: [{ tenant_id: 'tenantA', client_id: 'clientA', tax_case_id: 'caseA', tax_year: 2025, engagement_id: 'engA', active_stage: 3, revision: 1, status: 'ACTIVE', open_exceptions: 0 }] });
  expect(JSON.stringify(result)).not.toMatch(/proposal|decisionAllowed|notes|synthetic_token/);
  const audit = await f.pg.query("SELECT metadata FROM taxguard_audit_log WHERE action='SYNTHETIC_REVIEWER_QUEUE_READ'");
  expect(audit.rows.length).toBeGreaterThan(0); expect(JSON.stringify(audit.rows)).not.toContain('synthetic_token');
});
it('bounds discovery and signals more assigned cases without leaking unselected facts', async () => {
  await f.pg.exec("UPDATE taxguard_cases SET reviewer_uid='reviewer' WHERE case_id='caseB'");
  const result = await service().reviewerQueue('synthetic', 'tenantA', 1);
  expect(result.has_more).toBe(true); expect(result.items.map(item => item.tax_case_id)).toEqual(['caseA']);
});
it.each(['administrator', 'accountant', 'client'])('denies %s membership without relying on visible UI', async role => {
  await f.pg.query("UPDATE taxguard_members SET role=$1 WHERE uid='reviewer'", [role]);
  await expect(service().reviewerQueue('synthetic', 'tenantA')).rejects.toThrow('CASE_READ_SCOPE_DENIED');
});
it('denies cross-tenant discovery and expired sessions', async () => {
  await expect(service().reviewerQueue('synthetic', 'tenantB')).rejects.toThrow('CASE_READ_SCOPE_DENIED');
  verify.mockResolvedValue(null);
  await expect(service().reviewerQueue('synthetic', 'tenantA')).rejects.toThrow('CASE_READ_AUTH_REQUIRED');
});
it.each([
  "UPDATE taxguard_case_assignments SET active=false WHERE uid='reviewer'",
  "UPDATE taxguard_case_assignments SET assigned_at=now()+interval '1 day' WHERE uid='reviewer'",
  "UPDATE taxguard_staff_assignments SET effective_to=now()-interval '1 day' WHERE user_id='reviewer'",
  "UPDATE taxguard_staff_assignments SET tax_year=2024 WHERE id='revA'",
  "UPDATE taxguard_clients SET status='inactive' WHERE client_id='clientA'",
  "UPDATE taxguard_engagements SET status='inactive' WHERE engagement_id='engA'",
  "UPDATE taxguard_tax_years SET status='inactive' WHERE engagement_id='engA'",
])('excludes unavailable or mismatched scope without a memory fallback: %s', async sql => {
  await f.pg.exec(sql); expect(await service().reviewerQueue('synthetic', 'tenantA')).toEqual({ items: [], has_more: false });
});
it.each([0, -1, 101, NaN, 1.5])('denies invalid result bound %j before session/SQL calls', async limit => {
  await expect(service().reviewerQueue('synthetic', 'tenantA', limit)).rejects.toThrow('CASE_READ_INVALID_SCOPE');
  expect(verify).not.toHaveBeenCalled();
});
it('remains disabled by default and explicitly rejects production', async () => {
  await expect(new SqlCaseReadPreparation({ verify }, f.db).reviewerQueue('synthetic', 'tenantA')).rejects.toThrow('DURABLE_CASE_READ_CUTOVER_REQUIRED');
  vi.stubEnv('NODE_ENV', 'production');
  await expect(service().reviewerQueue('synthetic', 'tenantA')).rejects.toThrow('DURABLE_CASE_READ_CUTOVER_REQUIRED');
  expect(verify).not.toHaveBeenCalled();
});
it('rolls back audit and suppresses all results if an assignment is revoked after read', async () => {
  const before = (await f.pg.query('SELECT id FROM taxguard_audit_log')).rows;
  const db: TransactionalSql = { transaction: work => f.db.transaction(sql => work({ query: async <T>(query: string, params?: unknown[]) => {
    const result = await sql.query<T>(query, params);
    if (query.includes('SYNTHETIC_REVIEWER_QUEUE_READ')) await sql.query("UPDATE taxguard_case_assignments SET active=false WHERE uid='reviewer'");
    return result;
  } })) };
  await expect(service(db).reviewerQueue('synthetic', 'tenantA')).rejects.toThrow('CASE_READ_SCOPE_DENIED');
  expect((await f.pg.query('SELECT id FROM taxguard_audit_log')).rows).toEqual(before);
});
it('fails closed and sanitizes unavailable audit persistence', async () => {
  const db: TransactionalSql = { transaction: work => f.db.transaction(sql => work({ query: async <T>(query: string, params?: unknown[]) => {
    if (query.includes('SYNTHETIC_REVIEWER_QUEUE_READ')) throw new Error('private_database_details');
    return sql.query<T>(query, params);
  } })) };
  await expect(service(db).reviewerQueue('synthetic', 'tenantA')).rejects.toThrow('CASE_READ_UNAVAILABLE');
});
it('retains the existing senior-reviewer metadata scope without creating decision authority', async () => {
  await f.pg.exec("UPDATE taxguard_members SET role='senior_reviewer' WHERE uid='reviewer'");
  const result = await service().reviewerQueue('synthetic', 'tenantA');
  expect(result.items.map(item => item.tax_case_id)).toEqual(['caseA']);
  expect(JSON.stringify(result)).not.toContain('decisionAllowed');
});
it('rolls back queue audit when the final session check is revoked', async () => {
  const before = (await f.pg.query('SELECT id FROM taxguard_audit_log')).rows;
  verify.mockResolvedValueOnce(identity).mockResolvedValueOnce(identity).mockResolvedValueOnce(identity).mockResolvedValueOnce(null);
  await expect(service().reviewerQueue('synthetic', 'tenantA')).rejects.toThrow('CASE_READ_AUTH_REQUIRED');
  expect((await f.pg.query('SELECT id FROM taxguard_audit_log')).rows).toEqual(before);
});
it('suppresses changed case revisions and rolls back queue history', async () => {
  const before = (await f.pg.query('SELECT id FROM taxguard_audit_log')).rows;
  const db: TransactionalSql = { transaction: work => f.db.transaction(sql => work({ query: async <T>(query: string, params?: unknown[]) => {
    const result = await sql.query<T>(query, params);
    if (query.includes('SYNTHETIC_REVIEWER_QUEUE_READ')) await sql.query("UPDATE taxguard_cases SET revision=revision+1 WHERE case_id='caseA'");
    return result;
  } })) };
  await expect(service(db).reviewerQueue('synthetic', 'tenantA')).rejects.toThrow('CASE_READ_AUTHORITY_CHANGED');
  expect((await f.pg.query('SELECT id FROM taxguard_audit_log')).rows).toEqual(before);
});
it('does not expose a stale has_more hint when the extra bounded scope is revoked', async () => {
  await f.pg.exec("UPDATE taxguard_cases SET reviewer_uid='reviewer' WHERE case_id='caseB'");
  const before = (await f.pg.query('SELECT id FROM taxguard_audit_log')).rows;
  const db: TransactionalSql = { transaction: work => f.db.transaction(sql => work({ query: async <T>(query: string, params?: unknown[]) => {
    const result = await sql.query<T>(query, params);
    if (query.includes('SYNTHETIC_REVIEWER_QUEUE_READ')) await sql.query("UPDATE taxguard_case_assignments SET active=false WHERE case_id='caseB' AND uid='reviewer'");
    return result;
  } })) };
  await expect(service(db).reviewerQueue('synthetic', 'tenantA', 1)).rejects.toThrow('CASE_READ_SCOPE_DENIED');
  expect((await f.pg.query('SELECT id FROM taxguard_audit_log')).rows).toEqual(before);
});
