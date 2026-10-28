import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';

// Practice client detail and its write paths at the database boundary (owner decision 2026-10-19): a staff member
// assigned to one engagement and tax year sees and changes that client's practice records for that engagement and
// year only. Client-wide staff, practice managers and administrators see everything. Synthetic data only.
const T = 'tenantClientDetail', T2 = 'tenantClientDetailOther', C = 'pdClient', C2 = 'pdClient2';
let db: TestDatabase; let practice: PracticeStore; let cases: CaseStore; let ledger: SqlLedgerStore;
let E1 = '', E2 = ''; const caseIds: Record<string, string> = {}; const entries: Record<number, string> = {}; const deadlines: Record<string, string> = {};
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));
const detail = async (actor: string, client = C, tenant = T) => practice.clientDetail(tenant, client, actor) as Promise<any>;
const text = async (actor: string) => JSON.stringify(await detail(actor));
const acct = { cash: '00000000-0000-4000-8000-00000000c010', equity: '00000000-0000-4000-8000-00000000c030' };
// Every marker is unique, so its presence in the serialized detail proves disclosure.
const outOfScope = ['NOTE-E2', 'NOTE-CLIENT', 'TASK-E1-2024', 'TASK-E2-2025', 'TASK-CLIENT', 'DDL-2024', 'DDL-CASE-E2'];
const inScope = ['NOTE-E1', 'TASK-E1-2025', 'TASK-MINE', 'DDL-2025'];

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic client detail practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'pd-client', 'Synthetic Detail Client'), ('${T}', '${C2}', 'pd-client2', 'Other Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'pd-mgr', 'practice_manager', 'active'), ('${T}', 'pd-admin', 'admin', 'active'),
      ('${T}', 'pd-prep', 'accountant', 'active'), ('${T}', 'pd-rev', 'reviewer', 'active'), ('${T}', 'pd-prep2', 'accountant', 'active'), ('${T}', 'pd-rev2', 'reviewer', 'active'),
      ('${T}', 'pd-prep24', 'accountant', 'active'), ('${T}', 'pd-wide', 'reviewer', 'active'), ('${T}', 'pd-other', 'accountant', 'active'),
      ('${T2}', 'pd-foreign', 'practice_manager', 'active');`);
  practice = new PracticeStore(pgRpc(db.pool)); cases = new CaseStore(pgRpc(db.pool)); ledger = new SqlLedgerStore(pgRpc(db.pool));
  const engagement = async (client: string, key: string, years: number[]) => {
    const id = (await practice.createEngagement(T, client, 'pd-mgr', key, { title: 'Synthetic ' + key, type: 'tax_preparation', taxYears: years })).engagementId;
    await practice.setEngagementStatus(T, client, 'pd-mgr', id, 'active', 1);
    return id;
  };
  E1 = await engagement(C, 'pd-engagement-1', [2025, 2024]); E2 = await engagement(C, 'pd-engagement-2', [2025]);
  const e3 = await engagement(C2, 'pd-engagement-c2', [2025]);
  const staff: Array<[string, number, string, string]> = [[E1, 2025, 'preparer', 'pd-prep'], [E1, 2025, 'reviewer', 'pd-rev'], [E2, 2025, 'preparer', 'pd-prep2'],
    [E2, 2025, 'reviewer', 'pd-rev2'], [E1, 2024, 'preparer', 'pd-prep24']];
  for (const [engagementId, taxYear, role, userId] of staff)
    await practice.assign(T, C, 'pd-mgr', `pd-assign-${userId}-${role}`, { engagementId, taxYear, role, userId, reason: 'Synthetic staffing' });
  await practice.assign(T, C2, 'pd-mgr', 'pd-assign-other', { engagementId: e3, taxYear: 2025, role: 'preparer', userId: 'pd-other', reason: 'Synthetic staffing' });
  await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from)
    VALUES ('pd-wide-1', '${T}', '${C}', NULL, NULL, 'reviewer', 'pd-wide', 'pd-mgr', 'ACTIVE', now() - interval '1 day')`);
  caseIds.E1 = (await cases.create(T, C, 'pd-mgr', 'pd-case-key-e1', { engagementId: E1, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  caseIds.E2 = (await cases.create(T, C, 'pd-mgr', 'pd-case-key-e2', { engagementId: E2, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  await practice.addNote(T, C, 'pd-mgr', 'NOTE-E1 synthetic engagement note', E1);
  await practice.addNote(T, C, 'pd-mgr', 'NOTE-E2 synthetic engagement note', E2);
  await practice.addNote(T, C, 'pd-mgr', 'NOTE-CLIENT synthetic client note');
  const task = (key: string, title: string, body: Record<string, unknown>) => practice.createTask(T, C, 'pd-mgr', key, { title, ...body });
  await task('pd-task-e1-2025', 'TASK-E1-2025 synthetic', { engagementId: E1, taxYear: 2025 });
  await task('pd-task-e1-2024', 'TASK-E1-2024 synthetic', { engagementId: E1, taxYear: 2024 });
  await task('pd-task-e2-2025', 'TASK-E2-2025 synthetic', { engagementId: E2, taxYear: 2025 });
  await task('pd-task-client', 'TASK-CLIENT synthetic', {});
  await task('pd-task-mine', 'TASK-MINE synthetic', { assignedUserId: 'pd-prep' });
  const deadline = async (key: string, title: string, body: Record<string, unknown>) =>
    (deadlines[title] = ((await practice.addDeadline(T, C, 'pd-mgr', key, { title, category: 'internal_prep', dueDate: '2026-04-15T00:00:00Z', ...body })) as any).deadlineId);
  await deadline('pd-ddl-2025', 'DDL-2025', { taxYear: 2025 });
  await deadline('pd-ddl-2024', 'DDL-2024', { taxYear: 2024 });
  await deadline('pd-ddl-case-e2', 'DDL-CASE-E2', { taxYear: 2025, caseId: caseIds.E2 });
  await ledger.createAccounts({ tenantId: T, clientId: C }, 'pd-admin', [{ id: acct.cash, accountNumber: '1010', accountName: 'Cash', accountType: 'ASSET', accountSubtype: 'BANK' } as any,
    { id: acct.equity, accountNumber: '3010', accountName: 'Owner equity', accountType: 'EQUITY', accountSubtype: 'EQUITY' } as any]);
  for (const year of [2025, 2024]) {
    const periodId = (await ledger.openPeriod({ tenantId: T, clientId: C }, 'pd-admin', year, `${year}-Q1`, `${year}-01-01`, `${year}-03-31`)).periodId;
    entries[year] = (await ledger.postEntry({ tenantId: T, clientId: C }, 'pd-admin', { idempotencyKey: `pd-entry-${year}`, taxYear: year, periodId, postingDate: `${year}-02-01`,
      description: `Synthetic contribution ${year}`, lines: [{ accountId: acct.cash, debit: 100 }, { accountId: acct.equity, credit: 100 }] } as any)).id;
  }
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('practice client detail: an engagement-year assignee sees only its engagement and year', () => {
  it('notes, tasks and deadlines of other engagements, other years and the whole client are not disclosed', async () => {
    const t = await text('pd-prep');
    for (const marker of inScope) expect(t, marker).toContain(marker);
    for (const marker of outOfScope) expect(t, marker).not.toContain(marker);
  });

  it('engagements, years and team are limited to its scope; assignment history is withheld', async () => {
    const d = await detail('pd-prep');
    expect(d.engagements.map((e: any) => [e.engagementId, e.taxYears.map((y: any) => y.taxYear)])).toEqual([[E1, [2025]]]);
    expect([...new Set(d.team.map((m: any) => m.userId))].sort()).toEqual(['pd-prep', 'pd-rev']);
    expect(d.assignmentHistory).toEqual([]);
  });

  it('activity omits ledger events of other years and case events of other engagements', async () => {
    // Case audit rows carry the case's engagement and year in their metadata (the case id is a separate column).
    const caseEngagements = (activity: any[]) => activity.filter(a => a.action.startsWith('CASE_')).map(a => a.metadata.engagementId).filter(Boolean).sort();
    const all = (await detail('pd-mgr')).activity;
    for (const ref of [entries[2024], entries[2025]]) expect(JSON.stringify(all), ref).toContain(ref);
    expect(caseEngagements(all)).toEqual([E1, E2].sort());
    const mine = (await detail('pd-prep')).activity;
    expect(JSON.stringify(mine)).toContain(entries[2025]);
    expect(JSON.stringify(mine)).not.toContain(entries[2024]);
    expect(caseEngagements(mine)).toEqual([E1]);
    expect(JSON.stringify(mine)).not.toContain(E2);
  });

  it('client-wide staff, managers and administrators see everything', async () => {
    const reference = await detail('pd-mgr');
    for (const who of ['pd-wide', 'pd-admin']) {
      const d = await detail(who);
      for (const marker of [...inScope, ...outOfScope]) expect(JSON.stringify(d), `${who} ${marker}`).toContain(marker);
      expect(d.engagements).toHaveLength(reference.engagements.length);
      expect(d.team).toHaveLength(reference.team.length);
      expect(d.assignmentHistory.length).toBe(reference.assignmentHistory.length);
    }
  });
});

describe('practice writes: an engagement-year assignee changes only its engagement and year', () => {
  it('adds notes, tasks and deadlines only in scope', async () => {
    expect(await code(practice.addNote(T, C, 'pd-prep', 'Synthetic out-of-scope note', E2))).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await code(practice.addNote(T, C, 'pd-prep', 'Synthetic client-level note'))).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await code(practice.addNote(T, C, 'pd-prep', 'Synthetic in-scope note', E1))).toBe('OK');
    const task = (key: string, body: Record<string, unknown>) => code(practice.createTask(T, C, 'pd-prep', key, { title: 'Synthetic scoped task', ...body }));
    expect(await task('pd-prep-task-e2', { engagementId: E2, taxYear: 2025 })).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await task('pd-prep-task-2024', { engagementId: E1, taxYear: 2024 })).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await task('pd-prep-task-client', {})).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await task('pd-prep-task-case-e2', { caseId: caseIds.E2 })).toBe('CASE_NOT_FOUND');
    expect(await task('pd-prep-task-ok', { engagementId: E1, taxYear: 2025 })).toBe('OK');
    const ddl = (key: string, body: Record<string, unknown>) => code(practice.addDeadline(T, C, 'pd-prep', key, { title: 'Synthetic scoped deadline', category: 'internal_prep',
      dueDate: '2026-04-15T00:00:00Z', ...body }));
    expect(await ddl('pd-prep-ddl-2024', { taxYear: 2024 })).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await ddl('pd-prep-ddl-none', {})).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await ddl('pd-prep-ddl-case-e2', { taxYear: 2025, caseId: caseIds.E2 })).toBe('CASE_NOT_FOUND');
    expect(await ddl('pd-prep-ddl-ok', { taxYear: 2025, caseId: caseIds.E1 })).toBe('OK');
  });

  it('refused writes create no records and no audit entries, and never confirm an existing record', async () => {
    const counts = async () => (await db.pool.query(`SELECT
        (SELECT count(*) FROM taxguard_audit_log WHERE tenant_id = $1 AND actor_uid = 'pd-prep')::int AS audit,
        (SELECT count(*) FROM taxguard_engagement_notes WHERE tenant_id = $1 AND client_id = $2)::int AS notes,
        (SELECT count(*) FROM taxguard_practice_tasks WHERE tenant_id = $1 AND client_id = $2)::int AS tasks,
        (SELECT count(*) FROM taxguard_deadlines WHERE tenant_id = $1 AND client_id = $2)::int AS deadlines`, [T, C])).rows[0];
    const before = await counts();
    expect(await code(practice.addNote(T, C, 'pd-prep', 'Synthetic refused note', E2))).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await code(practice.createTask(T, C, 'pd-prep', 'pd-refused-task', { title: 'Synthetic refused task', engagementId: E2, taxYear: 2025 }))).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await code(practice.addDeadline(T, C, 'pd-prep', 'pd-refused-ddl', { title: 'Synthetic refused deadline', category: 'internal_prep',
      dueDate: '2026-04-15T00:00:00Z', taxYear: 2024 }))).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await code(practice.resolveDeadline(T, C, 'pd-prep', deadlines['DDL-CASE-E2'], 'MET'))).toBe('DEADLINE_NOT_FOUND');
    // Replaying a manager's out-of-scope task key and title must not reveal that the task exists.
    expect(await code(practice.createTask(T, C, 'pd-prep', 'pd-task-e2-2025', { title: 'TASK-E2-2025 synthetic', engagementId: E2, taxYear: 2025 }))).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await code(practice.createTask(T, C, 'pd-prep', 'pd-task-e2-2025', { title: 'TASK-E2-2025 synthetic', engagementId: E1, taxYear: 2025 }))).toBe('ENGAGEMENT_NOT_FOUND');
    expect(await code(practice.resolveDeadline(T, C, 'pd-prep', 'ddl_does_not_exist_0000', 'MET'))).toBe('DEADLINE_NOT_FOUND');
    expect(await counts()).toEqual(before);
  });

  it('resolves only deadlines in scope, with the same answer as a missing deadline', async () => {
    expect(await code(practice.resolveDeadline(T, C, 'pd-prep', deadlines['DDL-2024'], 'MET'))).toBe('DEADLINE_NOT_FOUND');
    expect(await code(practice.resolveDeadline(T, C, 'pd-prep', deadlines['DDL-CASE-E2'], 'MET'))).toBe('DEADLINE_NOT_FOUND');
    expect((await db.pool.query(`SELECT status FROM taxguard_deadlines WHERE id = $1`, [deadlines['DDL-2024']])).rows[0].status).toBe('PENDING');
    expect(await code(practice.resolveDeadline(T, C, 'pd-prep', deadlines['DDL-2025'], 'MET'))).toBe('OK');
    expect(await code(practice.resolveDeadline(T, C, 'pd-wide', deadlines['DDL-2024'], 'MET'))).toBe('OK');
  });

  it('other-client and other-tenant staff are refused; revocation ends access at once', async () => {
    expect(await code(detail('pd-other'))).toBe('CLIENT_NOT_FOUND');
    expect(await code(detail('pd-foreign', C, T2))).not.toBe('OK');
    expect(await code(detail('pd-foreign'))).not.toBe('OK');
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED', effective_to = now() WHERE tenant_id = $1 AND user_id = 'pd-prep24'`, [T]);
    expect(await code(detail('pd-prep24'))).toBe('CLIENT_NOT_FOUND');
  });
});
