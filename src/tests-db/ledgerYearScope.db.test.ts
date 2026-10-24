import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';

// Tax-year scope of the durable ledger and book-to-tax at the database boundary (owner decision 2026-10-19): a staff
// member assigned for one tax year reaches that client's ledger for that year only, unless independently authorized
// (client-wide assignment, practice manager or administrator). Synthetic data only.
const T = 'tenantLedgerYear', T2 = 'tenantLedgerYearOther', C = 'lyClient';
const S = { tenantId: T, clientId: C };
let db: TestDatabase; let ledger: SqlLedgerStore;
const acct = { cash: '00000000-0000-4000-8000-00000000a010', equity: '00000000-0000-4000-8000-00000000a030' };
const period: Record<number, string> = {}; const entry: Record<number, string> = {}; const txn: Record<number, string> = {}; const recon: Record<number, string> = {};
const set: Record<number, string> = {};
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? e?.message ?? String(e));
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await pgRpc(db.pool).rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
  return r.data as any;
};
const b2t = (fn: string, actor: string, extra: Record<string, unknown>) => rpc(fn, { p_tenant: T, p_client: C, p_actor: actor, ...extra });

beforeAll(async () => {
  db = await startDatabase();
  ledger = new SqlLedgerStore(pgRpc(db.pool));
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic ledger-year practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'ly-client', 'Synthetic Ledger Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'ly-admin', 'admin', 'active'), ('${T}', 'ly-mgr', 'practice_manager', 'active'),
      ('${T}', 'ly-bk', 'bookkeeper', 'active'), ('${T}', 'ly-rev', 'reviewer', 'active'), ('${T}', 'ly-wbk', 'bookkeeper', 'active'), ('${T}', 'ly-wrev', 'reviewer', 'active'),
      ('${T}', 'ly-stale', 'bookkeeper', 'active'), ('${T}', 'ly-revoked', 'bookkeeper', 'active'), ('${T}', 'ly-bk24', 'bookkeeper', 'active'), ('${T2}', 'ly-foreign', 'admin', 'active');`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const eng = (await practice.createEngagement(T, C, 'ly-mgr', 'ly-engagement', { title: 'Synthetic multi-year', type: 'bookkeeping', taxYears: [2025, 2024] })).engagementId;
  await practice.setEngagementStatus(T, C, 'ly-mgr', eng, 'active', 1);
  for (const [role, userId] of [['bookkeeper', 'ly-bk'], ['reviewer', 'ly-rev'], ['case_owner', 'ly-mgr']])
    await practice.assign(T, C, 'ly-mgr', `ly-assign-${userId}`, { engagementId: eng, taxYear: 2025, role, userId, reason: 'Synthetic staffing' });
  // One ACTIVE assignment per client, engagement, year and role: client-wide rows use roles not taken client-wide yet.
  await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from, effective_to) VALUES
    ('ly-wide-bk', '${T}', '${C}', NULL, NULL, 'bookkeeper', 'ly-wbk', 'ly-mgr', 'ACTIVE', now() - interval '1 day', NULL),
    ('ly-wide-rev', '${T}', '${C}', NULL, NULL, 'reviewer', 'ly-wrev', 'ly-mgr', 'ACTIVE', now() - interval '1 day', NULL),
    ('ly-stale-1', '${T}', '${C}', '${eng}', 2025, 'preparer_assistant', 'ly-stale', 'ly-mgr', 'ACTIVE', now() - interval '10 days', now() - interval '1 day'),
    ('ly-revoked-1', '${T}', '${C}', '${eng}', 2025, 'bookkeeper_assistant', 'ly-revoked', 'ly-mgr', 'REVOKED', now() - interval '10 days', NULL),
    ('ly-bk24-1', '${T}', '${C}', '${eng}', 2024, 'bookkeeper', 'ly-bk24', 'ly-mgr', 'ACTIVE', now() - interval '1 day', NULL);`);
  await ledger.createAccounts(S, 'ly-admin', [{ id: acct.cash, accountNumber: '1010', accountName: 'Cash', accountType: 'ASSET', accountSubtype: 'BANK' } as any,
    { id: acct.equity, accountNumber: '3010', accountName: 'Owner equity', accountType: 'EQUITY', accountSubtype: 'EQUITY' } as any]);
  for (const year of [2025, 2024]) {
    period[year] = (await ledger.openPeriod(S, 'ly-admin', year, `${year}-Q1`, `${year}-01-01`, `${year}-03-31`)).periodId;
    entry[year] = (await ledger.postEntry(S, 'ly-wbk', { idempotencyKey: `ly-entry-${year}`, taxYear: year, periodId: period[year], postingDate: `${year}-02-01`,
      description: `Synthetic owner contribution ${year}`, lines: [{ accountId: acct.cash, debit: 100 }, { accountId: acct.equity, credit: 100 }] } as any)).id;
    await ledger.ingestTransactions(S, 'ly-admin', acct.cash, 'MANUAL_ENTRY', `ly-batch-${year}`, [{ transactionDate: `${year}-03-20`, description: `Synthetic supplies ${year}`, amount: -10, externalTransactionId: `ly-txn-${year}` }]);
    txn[year] = (await ledger.read(S, 'ly-admin', year)).transactions.find(t => t.description === `Synthetic supplies ${year}`)!.id;
    recon[year] = await ledger.startReconciliation(S, 'ly-admin', { accountId: acct.cash, taxYear: year, statementStart: `${year}-03-01`, statementEnd: `${year}-03-31`, beginningBalance: 0, endingBalance: -10 });
    set[year] = (await b2t('taxguard_b2t_open_set', 'ly-wbk', { p_year: year, p_family: '1040' })).setId;
  }
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('a staff member assigned for one tax year reaches only that year of the ledger', () => {
  it('reads, trial balance and work queue: the assigned year only', async () => {
    expect((await ledger.read(S, 'ly-bk', 2025)).entries.map(e => e.id)).toEqual([entry[2025]]);
    for (const who of ['ly-bk', 'ly-rev']) {
      expect(await code(ledger.read(S, who, 2024)), who).toBe('LEDGER_ACCESS_DENIED');
      expect(await code(ledger.trialBalance(S, who, 2024)), who).toBe('LEDGER_ACCESS_DENIED');
      expect(await code(ledger.workQueue(S, who, 2024)), who).toBe('LEDGER_ACCESS_DENIED');
    }
  });

  it('reviews entries, manages periods and reconciles only in the assigned year', async () => {
    const pending = (year: number) => ledger.read(S, 'ly-admin', year).then(r => r.entries.find(e => e.id === entry[year])!);
    // A record addressed by id whose own year is out of scope is refused as if it did not exist.
    expect(await code(ledger.reviewEntry(S, 'ly-rev', entry[2024], 'approve', (await pending(2024)).version))).toBe('ENTRY_NOT_FOUND');
    expect((await pending(2024)).status).toBe('PREPARED');
    expect(await code(ledger.reviewEntry(S, 'ly-rev', entry[2025], 'approve', (await pending(2025)).version))).toBe('OK');
    expect(await code(ledger.openPeriod(S, 'ly-bk', 2024, '2024-Q2', '2024-04-01', '2024-06-30'))).toBe('LEDGER_ACCESS_DENIED');
    expect(await code(ledger.closePeriod(S, 'ly-rev', period[2024], 'SOFT_CLOSED'))).toBe('PERIOD_NOT_FOUND');
    expect(await code(ledger.reopenPeriod(S, 'ly-rev', period[2024], 'Synthetic reopen attempt'))).toBe('PERIOD_NOT_FOUND');
    expect(await code(ledger.startReconciliation(S, 'ly-bk', { accountId: acct.cash, taxYear: 2024, statementStart: '2024-04-01', statementEnd: '2024-04-30', beginningBalance: 0, endingBalance: 0 }))).toBe('LEDGER_ACCESS_DENIED');
    expect(await code(ledger.setCleared(S, 'ly-bk', recon[2024], txn[2024], true))).toBe('RECONCILIATION_NOT_FOUND');
    expect(await code(ledger.finalizeReconciliation(S, 'ly-bk', recon[2024]))).toBe('RECONCILIATION_NOT_FOUND');
    expect(await code(ledger.setCleared(S, 'ly-bk', recon[2025], txn[2025], true))).toBe('OK');
  });

  it('categorizes only when both the transaction date and the entry year are in scope', async () => {
    expect(await code(ledger.categorizeTransaction(S, 'ly-bk', txn[2024], acct.equity, 2025, period[2025]))).toBe('TRANSACTION_NOT_FOUND');
    expect(await code(ledger.categorizeTransaction(S, 'ly-bk', txn[2025], acct.equity, 2024, period[2024]))).toBe('LEDGER_ACCESS_DENIED');
    expect(await code(ledger.categorizeTransaction(S, 'ly-bk', txn[2025], acct.equity, 2025, period[2025]))).toBe('OK');
  });

  it('every new journal entry and adjustment is checked against its own year, whichever function writes it', async () => {
    const before = (await ledger.read(S, 'ly-admin', 2024)).entries.length;
    expect(await code(ledger.postEntry(S, 'ly-bk', { idempotencyKey: 'ly-entry-2024-scoped', taxYear: 2024, periodId: period[2024], postingDate: '2024-02-15',
      description: 'Synthetic out-of-scope entry', lines: [{ accountId: acct.cash, debit: 5 }, { accountId: acct.equity, credit: 5 }] } as any))).toBe('LEDGER_ACCESS_DENIED');
    expect((await ledger.read(S, 'ly-admin', 2024)).entries.length).toBe(before);
    expect(await code(ledger.postEntry(S, 'ly-bk', { idempotencyKey: 'ly-entry-2025-scoped', taxYear: 2025, periodId: period[2025], postingDate: '2025-02-15',
      description: 'Synthetic in-scope entry', lines: [{ accountId: acct.cash, debit: 5 }, { accountId: acct.equity, credit: 5 }] } as any))).toBe('OK');
    // A posted 2024 entry (approved by an administrator) cannot be reversed by the 2025 bookkeeper.
    await ledger.reviewEntry(S, 'ly-admin', entry[2024], 'approve', (await ledger.read(S, 'ly-admin', 2024)).entries.find(e => e.id === entry[2024])!.version);
    expect(await code(ledger.reverseEntry(S, 'ly-bk', { idempotencyKey: 'ly-reverse-2024', entryId: entry[2024], postingDate: '2024-03-01',
      reason: 'Synthetic reversal attempt', periodId: period[2024] }))).toBe('LEDGER_ACCESS_DENIED');
    await db.pool.query(`INSERT INTO taxguard_b2t_categories(tenant_id, return_family, category_code, label, created_by) VALUES ('${T}', '1040', 'LY_SUPPLIES', 'Synthetic supplies', 'ly-admin')
      ON CONFLICT DO NOTHING`);
    const adjust = (who: string, year: number) => b2t('taxguard_b2t_prepare_adjustment', who, { p_key: `ly-adjust-${who}-${year}`, p_body: { returnFamily: '1040', taxYear: year,
      categoryCode: 'LY_SUPPLIES', amountCents: 500, adjustmentType: 'PERMANENT', description: 'Synthetic adjustment' } });
    expect(await code(adjust('ly-bk', 2024))).toBe('LEDGER_ACCESS_DENIED');
    expect(await code(adjust('ly-bk', 2025))).toBe('OK');
    expect(await code(adjust('ly-wbk', 2024))).toBe('OK');
  });

  it('book-to-tax: overview, mapping sets and their review in the assigned year only', async () => {
    for (const who of ['ly-bk', 'ly-rev']) {
      expect(await code(b2t('taxguard_b2t_overview', who, { p_year: 2024, p_family: '1040' })), who).toBe('LEDGER_ACCESS_DENIED');
      expect(await code(b2t('taxguard_b2t_open_set', who, { p_year: 2024, p_family: '1040' })), who).toBe('LEDGER_ACCESS_DENIED');
      expect(await code(b2t('taxguard_b2t_generate_workpaper', who, { p_year: 2024, p_family: '1040', p_case: null })), who).toBe('LEDGER_ACCESS_DENIED');
    }
    expect(await code(b2t('taxguard_b2t_set_mapping', 'ly-bk', { p_set: set[2024], p_account: acct.cash, p_category: 'LY_SUPPLIES' }))).toBe('MAPPING_SET_NOT_FOUND');
    expect(await code(b2t('taxguard_b2t_review_set', 'ly-rev', { p_set: set[2024], p_action: 'approve', p_note: null }))).toBe('MAPPING_SET_NOT_FOUND');
    const adj2024 = (await b2t('taxguard_b2t_overview', 'ly-admin', { p_year: 2024, p_family: '1040' })).adjustments[0].adjustmentId;
    expect(await code(b2t('taxguard_b2t_review_adjustment', 'ly-rev', { p_adjustment: adj2024, p_approve: true, p_note: null }))).toBe('ADJUSTMENT_NOT_FOUND');
    expect(await code(b2t('taxguard_b2t_overview', 'ly-bk', { p_year: 2025, p_family: '1040' }))).toBe('OK');
  });

  it('history shows a year-scoped member only events of records in its year', async () => {
    const refs = (h: any) => [h.metadata?.entryId, h.metadata?.periodId, h.metadata?.reconciliationId].filter(Boolean);
    const of2024 = new Set([entry[2024], period[2024], recon[2024]]), of2025 = new Set([entry[2025], period[2025], recon[2025]]);
    const all = await ledger.history(S, 'ly-admin', 200);
    expect(all.some(h => refs(h).some(r => of2024.has(r)))).toBe(true);
    expect(all.some(h => h.action === 'LEDGER_ACCOUNTS_CREATED')).toBe(true);
    const mine = await ledger.history(S, 'ly-bk', 200);
    expect(mine.some(h => refs(h).some(r => of2025.has(r)))).toBe(true);
    expect(mine.every(h => refs(h).length > 0 && !refs(h).some(r => of2024.has(r)))).toBe(true);
    expect((await ledger.history(S, 'ly-wbk', 200)).length).toBe(all.length);
  });

  it('a trial balance "as of" date must fall inside the requested tax year, so later years are never summed in', async () => {
    // entry[2025] was approved (POSTED) above; a 2024-only member asking for 2024 "as of" a 2025 date would receive it.
    expect((await ledger.read(S, 'ly-admin', 2025)).entries.find(e => e.id === entry[2025])!.status).toBe('POSTED');
    expect(await code(ledger.trialBalance(S, 'ly-bk24', 2025))).toBe('LEDGER_ACCESS_DENIED');
    expect(await code(ledger.trialBalance(S, 'ly-bk24', 2024, '2025-12-31'))).toBe('LEDGER_INPUT_INVALID');
    expect(await code(ledger.trialBalance(S, 'ly-bk24', 2024, '2023-12-31'))).toBe('LEDGER_INPUT_INVALID');
    expect(await code(ledger.trialBalance(S, 'ly-admin', 2024, '2025-12-31'))).toBe('LEDGER_INPUT_INVALID');
    expect(await code(ledger.trialBalance(S, 'ly-bk24', 2024, '2024-06-30'))).toBe('OK');
    expect(await code(ledger.trialBalance(S, 'ly-bk24', 2024))).toBe('OK');
    // Boundaries: the first and last day of the year are inside it; the days either side are not, for every role.
    for (const who of ['ly-bk24', 'ly-mgr', 'ly-admin', 'ly-wbk']) {
      expect(await code(ledger.trialBalance(S, who, 2024, '2024-01-01')), who).toBe('OK');
      expect(await code(ledger.trialBalance(S, who, 2024, '2024-12-31')), who).toBe('OK');
      expect(await code(ledger.trialBalance(S, who, 2024, '2023-12-31')), who).toBe('LEDGER_INPUT_INVALID');
      expect(await code(ledger.trialBalance(S, who, 2024, '2025-01-01')), who).toBe('LEDGER_INPUT_INVALID');
    }
    // Within the year the period holds only that year's postings: the 2025 posting never appears in a 2024 report.
    const posted = async (from: string, to: string) => Number((await db.pool.query(`SELECT COALESCE(sum(l.debit_cents), 0) AS d FROM taxguard_ledger_lines l
      JOIN taxguard_ledger_entries e ON e.tenant_id = l.tenant_id AND e.client_id = l.client_id AND e.entry_id = l.entry_id
      WHERE e.tenant_id = $1 AND e.client_id = $2 AND e.status = 'POSTED' AND e.posting_date BETWEEN $3 AND $4`, [T, C, from, to])).rows[0].d);
    const periodDebits = async (who: string, asOf: string) => ((await b2t('taxguard_ledger_trial_balance', who, { p_tax_year: 2024, p_as_of: asOf })) as any[])
      .reduce((n, r) => n + Number(r.periodDebitCents), 0);
    expect(await posted('2025-01-01', '2025-12-31')).toBeGreaterThan(0);
    for (const who of ['ly-bk24', 'ly-wbk']) expect(await periodDebits(who, '2024-12-31'), who).toBe(await posted('2024-01-01', '2024-12-31'));
    // Managers, administrators and client-wide staff keep every year; the 2024-only member still cannot ask for 2025.
    for (const who of ['ly-mgr', 'ly-admin', 'ly-wbk']) expect(await code(ledger.trialBalance(S, who, 2025, '2025-12-31')), who).toBe('OK');
    expect(await code(ledger.trialBalance(S, 'ly-bk24', 2025, '2025-12-31'))).toBe('LEDGER_ACCESS_DENIED');
  });
});

describe('independent authorization is preserved and everything else fails closed', () => {
  it('managers, administrators and client-wide staff reach every year', async () => {
    for (const who of ['ly-mgr', 'ly-admin', 'ly-wbk', 'ly-wrev']) {
      expect(await code(ledger.read(S, who, 2024)), who).toBe('OK');
      expect(await code(b2t('taxguard_b2t_overview', who, { p_year: 2024, p_family: '1040' })), who).toBe('OK');
    }
  });
  it('stale, revoked and other-tenant actors are refused; revoking the assignment ends access at once', async () => {
    for (const who of ['ly-stale', 'ly-revoked']) expect(await code(ledger.read(S, who, 2025)), who).toBe('LEDGER_ACCESS_DENIED');
    expect(await code(ledger.read({ tenantId: T2, clientId: C }, 'ly-foreign', 2025))).not.toBe('OK');
    expect(await code(ledger.read(S, 'ly-foreign', 2025))).not.toBe('OK');
    expect(await code(ledger.read(S, 'ly-bk', 2025))).toBe('OK');
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED', effective_to = now() WHERE tenant_id = '${T}' AND user_id = 'ly-bk'`);
    expect(await code(ledger.read(S, 'ly-bk', 2025))).toBe('LEDGER_ACCESS_DENIED');
  });
});
