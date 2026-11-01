import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';

// Block 96: the practice summary's active-client count (proposal 20261019290000, review only) on real PostgreSQL with every
// proposal applied. SYNTHETIC data only.
const T = 'tenantSummaryClients', T2 = 'tenantSummaryClientsOther';
let db: TestDatabase; let practice: PracticeStore;
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic summary practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name, status) VALUES ('${T}', 'sc-2025', 'sc-o1', 'Client with 2025', 'active'),
      ('${T}', 'sc-2024', 'sc-o2', 'Client with 2024', 'active'), ('${T}', 'sc-none', 'sc-o3', 'Client without engagement', 'active'),
      ('${T}', 'sc-archived', 'sc-o4', 'Archived client', 'archived'), ('${T2}', 'sc-foreign', 'sc-o5', 'Foreign client', 'active');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'sc-mgr', 'practice_manager', 'active'), ('${T}', 'sc-acct', 'accountant', 'active'),
      ('${T2}', 'sc-mgr2', 'practice_manager', 'active');`);
  practice = new PracticeStore(pgRpc(db.pool));
  for (const [client, year] of [['sc-2025', 2025], ['sc-2024', 2024]] as const)
    await practice.createEngagement(T, client, 'sc-mgr', 'sc-eng-' + client, { title: 'Synthetic ' + client, type: 'tax_preparation', taxYears: [year] });
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('practice summary: active clients', () => {
  it('counts active clients of the tenant, and for a tax year those with an engagement covering it', async () => {
    const all = await practice.practiceSummary(T, 'sc-mgr') as any;
    expect(all.activeClients).toBe(3);
    expect(all.definitions.activeClients).toMatch(/status active/);
    expect((await practice.practiceSummary(T, 'sc-mgr', 2025) as any).activeClients).toBe(1);
    expect((await practice.practiceSummary(T, 'sc-mgr', 2024) as any).activeClients).toBe(1);
    expect((await practice.practiceSummary(T, 'sc-mgr', 2023) as any).activeClients).toBe(0);
    expect((await practice.practiceSummary(T2, 'sc-mgr2') as any).activeClients).toBe(1);
  });

  it('stays manager-only, and every earlier figure is still present', async () => {
    expect(await code(practice.practiceSummary(T, 'sc-acct'))).toBe('DASHBOARD_MANAGER_REQUIRED');
    const s = await practice.practiceSummary(T, 'sc-mgr') as any;
    expect(Object.keys(s).sort()).toEqual(['activeClients', 'asOf', 'casesByStage', 'deadlines', 'definitions', 'documentRequests', 'documentsAwaitingReview',
      'documentsAwaitingScan', 'receivables', 'staffCaseCounts', 'tasks', 'taxYear']);
  });
});
