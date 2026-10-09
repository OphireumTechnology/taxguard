import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { capabilityFixture, scope } from './aiCapabilities.fixture';
import { SqlCaseReadPreparation } from '../server/taxguard/SqlCaseReadPreparation';
import type { TransactionalSql } from '../server/ai/governance/SqlGovernanceStore';
let f: Awaited<ReturnType<typeof capabilityFixture>>;
const readScope = { ...scope, engagement_id: 'engA' };
const identity = { uid: 'preparer', tenant_id: 'tenantA' };
let verify = vi.fn();
beforeAll(async () => {
  f = await capabilityFixture();
  await f.pg.exec(`INSERT INTO taxguard_engagements(tenant_id,client_id,engagement_id) VALUES('tenantA','clientA','engA');
    INSERT INTO taxguard_tax_years(tenant_id,client_id,engagement_id,tax_year) VALUES('tenantA','clientA','engA',2025);`);
}, 30000);
beforeEach(async () => {
  verify = vi.fn().mockResolvedValue(identity);
  await f.pg.exec(`UPDATE taxguard_members SET status='active',role='accountant' WHERE uid='preparer';
    UPDATE taxguard_clients SET status='active'; UPDATE taxguard_engagements SET status='active'; UPDATE taxguard_tax_years SET status='active';
    UPDATE taxguard_cases SET revision=1,preparer_uid='preparer';
    UPDATE taxguard_case_assignments SET active=true,assigned_at=now(),role='preparer';
    UPDATE taxguard_staff_assignments SET status='ACTIVE',tax_year=2025,effective_from=now(),effective_to=null;`);
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { await f?.pg.close(); });
const service = (db: TransactionalSql = f.db) => new SqlCaseReadPreparation({ verify }, db, 'SYNTHETIC');
it('reads exact scoped minimized metadata from disposable SQL and records bounded audit', async () => {
  const result = await service().read('synthetic_token', readScope);
  expect(result).toEqual({ ...readScope, active_stage: 3, revision: 1, status: 'ACTIVE', open_exceptions: 0 });
  const audit = (await f.pg.query<{ metadata: unknown }>("SELECT metadata FROM taxguard_audit_log WHERE action='SYNTHETIC_CASE_METADATA_READ' ORDER BY timestamp DESC LIMIT 1")).rows[0];
  expect(audit.metadata).toEqual({ engagement_id: 'engA', tax_year: 2025, revision: 1 });
  expect(JSON.stringify(audit)).not.toContain('synthetic_token');
});
it('defaults disabled and rejects production even when explicitly selected', async () => {
  await expect(new SqlCaseReadPreparation({ verify }, f.db).read('synthetic', readScope)).rejects.toThrow('DURABLE_CASE_READ_CUTOVER_REQUIRED');
  vi.stubEnv('NODE_ENV', 'production'); await expect(service().read('synthetic', readScope)).rejects.toThrow('DURABLE_CASE_READ_CUTOVER_REQUIRED');
  expect(verify).not.toHaveBeenCalled();
});
it.each([{ tenant_id: 'tenantB' }, { client_id: 'clientB' }, { tax_case_id: 'other' }, { engagement_id: 'other' }, { tax_year: 2024 }])('denies wrong scope %j', async patch => {
  await expect(service().read('synthetic', { ...readScope, ...patch })).rejects.toThrow('CASE_READ_SCOPE_DENIED');
});
it.each([
  "UPDATE taxguard_members SET status='suspended'", "UPDATE taxguard_members SET role='admin'",
  "UPDATE taxguard_cases SET preparer_uid='other'", "UPDATE taxguard_case_assignments SET active=false",
  "UPDATE taxguard_case_assignments SET assigned_at=now()+interval '1 day'",
  "UPDATE taxguard_staff_assignments SET effective_to=now()-interval '1 day'",
  "UPDATE taxguard_staff_assignments SET tax_year=2024", "UPDATE taxguard_clients SET status='inactive'",
  "UPDATE taxguard_engagements SET status='inactive'", "UPDATE taxguard_tax_years SET status='inactive'",
])('denies revoked or mismatched durable authority: %s', async sql => {
  await f.pg.exec(sql); await expect(service().read('synthetic', readScope)).rejects.toThrow('CASE_READ_SCOPE_DENIED');
});
it('denies session revocation after scoped reads without committing audit', async () => {
  const before = await f.pg.query('SELECT id FROM taxguard_audit_log');
  verify.mockResolvedValueOnce(identity).mockResolvedValueOnce(identity).mockResolvedValueOnce(null);
  await expect(service().read('synthetic', readScope)).rejects.toThrow('CASE_READ_AUTH_REQUIRED');
  expect((await f.pg.query('SELECT id FROM taxguard_audit_log')).rows).toEqual(before.rows);
});
it('rechecks assignment revocation within the read transaction', async () => {
  let reads = 0;
  const db: TransactionalSql = { transaction: work => f.db.transaction(sql => work({ query: async <T>(query: string, params?: unknown[]) => {
    const result = await sql.query<T>(query, params);
    if (query.includes('SELECT c.tenant_id') && ++reads === 1) await sql.query('UPDATE taxguard_case_assignments SET active=false');
    return result;
  } })) };
  await expect(service(db).read('synthetic', readScope)).rejects.toThrow('CASE_READ_SCOPE_DENIED');
});
it('fails closed and sanitizes audit persistence failure', async () => {
  const db: TransactionalSql = { transaction: work => f.db.transaction(sql => work({ query: async <T>(query: string, params?: unknown[]) => {
    if (query.includes('INSERT INTO taxguard_audit_log')) throw new Error('PRIVATE_DATABASE_CONNECTION');
    return sql.query<T>(query, params);
  } })) };
  await expect(service(db).read('synthetic', readScope)).rejects.toThrow('CASE_READ_UNAVAILABLE');
});
it('retries only a rolled-back serialization failure and rechecks identity', async () => {
  const transaction = vi.fn().mockRejectedValueOnce(Object.assign(new Error('private'), { code: '40001' })).mockImplementation(f.db.transaction);
  expect((await service({ transaction }).read('synthetic', readScope)).revision).toBe(1); expect(transaction).toHaveBeenCalledTimes(2);
});
it('does not retry unknown database errors', async () => {
  const transaction = vi.fn().mockRejectedValue(new Error('private'));
  await expect(service({ transaction }).read('synthetic', readScope)).rejects.toThrow('CASE_READ_UNAVAILABLE'); expect(transaction).toHaveBeenCalledTimes(1);
});
it('rejects browser role and scope injection before accessing SQL', async () => {
  await expect(service().read('synthetic', { ...readScope, role: 'admin' })).rejects.toThrow('CASE_READ_INVALID_SCOPE'); expect(verify).not.toHaveBeenCalled();
});
