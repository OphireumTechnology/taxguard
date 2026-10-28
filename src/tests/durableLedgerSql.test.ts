import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';
import { SqlLedgerStore, type LedgerScope } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { generateStandardChartOfAccounts } from '../server/taxguard/bookkeeping/defaultAccounts';

// Proposal 024 composed with the actual core schema (synthetic tenants, clients and amounts).
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let store: SqlLedgerStore;
const A: LedgerScope = { tenantId: 'tenantA', clientId: 'ledgerA' };
const B: LedgerScope = { tenantId: 'tenantA', clientId: 'ledgerB' };
const X: LedgerScope = { tenantId: 'tenantB', clientId: 'ledgerX' };
let seq = 0;
const key = () => `test-key-${Date.now()}-${++seq}`;
let accounts: Record<string, string> = {};

async function seed(pg: PGlite) {
  await pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('tenantA','ledgerA','ownerA'),('tenantA','ledgerB','ownerB'),('tenantB','ledgerX','ownerX') ON CONFLICT DO NOTHING;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','led-acct','accountant','active'),('tenantA','led-rev','reviewer','active'),('tenantA','led-rev2','senior_reviewer','active'),
      ('tenantA','led-admin','admin','active'),('tenantA','led-client','client','active'),('tenantB','led-foreign','accountant','active') ON CONFLICT DO NOTHING;
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by,effective_from) VALUES
      ('led-1','tenantA','ledgerA','accountant','led-acct','admin',now()-interval '1 day'),('led-2','tenantA','ledgerA','reviewer','led-rev','admin',now()-interval '1 day'),
      ('led-3','tenantA','ledgerA','senior_reviewer','led-rev2','admin',now()-interval '1 day'),('led-4','tenantB','ledgerX','accountant','led-foreign','admin',now()-interval '1 day') ON CONFLICT DO NOTHING;`);
}
async function bootstrap(scope: LedgerScope, actor: string) {
  const chart = generateStandardChartOfAccounts(scope.tenantId, scope.clientId, '1040_SCHED_C', actor);
  await store.createAccounts(scope, actor, chart.map(a => ({ ...a, source: 'SYSTEM_BOOTSTRAP' })));
  return Object.fromEntries(chart.map(a => [a.accountNumber, a.id]));
}
const entry = (over: Record<string, unknown> = {}) => ({ idempotencyKey: key(), taxYear: 2025, postingDate: '2025-02-10', description: 'Synthetic consulting income',
  lines: [{ accountId: accounts['1010'], debit: 1250.25, credit: 0 }, { accountId: accounts['4010'], debit: 0, credit: 1250.25 }], ...over }) as any;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012240000_/);
  await seed(fixture.pg);
  store = new SqlLedgerStore(pgliteRpc(() => fixture.pg));
  accounts = await bootstrap(A, 'led-acct');
}, 60000);
afterAll(async () => { await fixture?.pg.close(); });

describe('durable ledger: journal integrity', () => {
  it('posts a balanced entry in exact cents and lists it with account names', async () => {
    const posted = await store.postEntry(A, 'led-acct', entry());
    expect(posted).toMatchObject({ status: 'POSTED', totalDebit: 1250.25, totalCredit: 1250.25, version: 1 });
    expect(posted.entryNumber).toMatch(/^JE-\d{6}$/);
    expect(posted.lines.map(l => [l.accountNumber, l.debit, l.credit])).toEqual([['1010', 1250.25, 0], ['4010', 0, 1250.25]]);
  });
  it.each([
    ['unbalanced', { lines: [{ accountId: 'x', debit: 10, credit: 0 }, { accountId: 'y', debit: 0, credit: 9.99 }] }, 'UNBALANCED_JOURNAL_ENTRY'],
    ['fractional cent', { lines: [{ accountId: 'x', debit: 10.001, credit: 0 }, { accountId: 'y', debit: 0, credit: 10.001 }] }, 'INVALID_AMOUNT'],
    ['single line', { lines: [{ accountId: 'x', debit: 10, credit: 0 }] }, 'LEDGER_INPUT_INVALID'],
  ])('rejects an %s entry', async (_l, over, code) => {
    const lines = (over as any).lines.map((l: any, i: number) => ({ ...l, accountId: i ? accounts['4010'] : accounts['1010'] }));
    await expect(store.postEntry(A, 'led-acct', entry({ lines }))).rejects.toMatchObject({ code });
  });
  it('rejects lines that reference another client\'s account (composite ownership)', async () => {
    const accountsB = await bootstrap(B, 'led-admin');
    await expect(store.postEntry(A, 'led-acct', entry({ lines: [{ accountId: accounts['1010'], debit: 5, credit: 0 }, { accountId: accountsB['4010'], debit: 0, credit: 5 }] })))
      .rejects.toMatchObject({ code: 'ACCOUNT_NOT_IN_CHART' });
  });
  it('enforces balance and immutability in the database even for direct service-role writes', async () => {
    const posted = await store.postEntry(A, 'led-acct', entry());
    await expect(fixture.pg.query("UPDATE taxguard_ledger_lines SET debit_cents = debit_cents + 1 WHERE entry_id = $1", [posted.id])).rejects.toThrow('LEDGER_ENTRY_IMMUTABLE');
    await expect(fixture.pg.query("DELETE FROM taxguard_ledger_entries WHERE entry_id = $1", [posted.id])).rejects.toThrow('LEDGER_ENTRY_IMMUTABLE');
    await expect(fixture.pg.query("UPDATE taxguard_ledger_entries SET description = 'edited' WHERE entry_id = $1", [posted.id])).rejects.toThrow('LEDGER_ENTRY_IMMUTABLE');
    await expect(fixture.pg.query("INSERT INTO taxguard_ledger_lines(tenant_id,client_id,entry_id,line_no,account_id,debit_cents) VALUES('tenantA','ledgerA',$1,9,$2,1)", [posted.id, accounts['1010']]))
      .rejects.toThrow('LEDGER_ENTRY_IMMUTABLE');
    await expect(fixture.pg.transaction(async tx => {
      await tx.query("INSERT INTO taxguard_ledger_entries(tenant_id,client_id,entry_number,tax_year,posting_date,transaction_date,description,source,status,total_cents,creator_uid,posted_at,idempotency_key,request_hash) VALUES('tenantA','ledgerA','JE-X1',2025,'2025-02-01','2025-02-01','raw','MANUAL','POSTED',100,'led-acct',now(),'raw-direct-1',repeat('a',64))");
      const id = (await tx.query<{ entry_id: string }>("SELECT entry_id FROM taxguard_ledger_entries WHERE entry_number='JE-X1'")).rows[0].entry_id;
      await tx.query("INSERT INTO taxguard_ledger_lines(tenant_id,client_id,entry_id,line_no,account_id,debit_cents) VALUES('tenantA','ledgerA',$1,1,$2,100)", [id, accounts['1010']]);
    })).rejects.toThrow('LEDGER_ENTRY_UNBALANCED');
  });
  it('replays an idempotent request and refuses a conflicting reuse of the key', async () => {
    const input = entry();
    const first = await store.postEntry(A, 'led-acct', input);
    const again = await store.postEntry(A, 'led-acct', input);
    expect(again.id).toBe(first.id); expect(again.replayed).toBe(true); expect(first.replayed).toBe(false);
    await expect(store.postEntry(A, 'led-acct', { ...input, description: 'Different body' })).rejects.toMatchObject({ code: 'LEDGER_IDEMPOTENCY_CONFLICT', status: 409 });
  });
});

describe('durable ledger: authority and isolation', () => {
  it.each([
    ['unassigned staff of the tenant', A, 'led-foreign'], ['a client member', A, 'led-client'], ['an assigned accountant acting on another client', B, 'led-acct'],
    ['a member of another tenant', X, 'led-acct'], ['an unknown user', A, 'nobody'],
  ])('refuses %s', async (_l, scope, actor) => {
    await expect(store.read(scope, actor, 2025)).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED', status: 403 });
  });
  it('lets an administrator act without an assignment and refuses revoked or expired assignments', async () => {
    expect((await store.read(A, 'led-admin', 2025)).accounts.length).toBeGreaterThan(5);
    await fixture.pg.exec("UPDATE taxguard_staff_assignments SET status='REVOKED' WHERE id='led-1'");
    try { await expect(store.read(A, 'led-acct', 2025)).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED' }); }
    finally { await fixture.pg.exec("UPDATE taxguard_staff_assignments SET status='ACTIVE' WHERE id='led-1'"); }
    await fixture.pg.exec("UPDATE taxguard_staff_assignments SET effective_to=now()-interval '1 second' WHERE id='led-1'");
    try { await expect(store.read(A, 'led-acct', 2025)).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED' }); }
    finally { await fixture.pg.exec("UPDATE taxguard_staff_assignments SET effective_to=NULL WHERE id='led-1'"); }
  });
  it('cannot address another client\'s entry even with its ID', async () => {
    const posted = await store.postEntry(A, 'led-acct', entry());
    await expect(store.reverseEntry(B, 'led-admin', { idempotencyKey: key(), entryId: posted.id, postingDate: '2025-03-01', reason: 'Cross client' })).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND', status: 404 });
  });
  it('is executable by the service role only', async () => {
    for (const role of ['anon', 'authenticated']) {
      await fixture.pg.exec('SET ROLE ' + role);
      try {
        await expect(fixture.pg.query("SELECT taxguard_ledger_read('tenantA','ledgerA','led-admin',2025,'{}'::jsonb)")).rejects.toThrow('permission denied');
        await expect(fixture.pg.query('SELECT * FROM taxguard_ledger_entries')).rejects.toThrow('permission denied');
      } finally { await fixture.pg.exec('RESET ROLE'); }
    }
    await fixture.pg.exec('SET ROLE service_role');
    try { await expect(fixture.pg.query("SELECT taxguard_ledger_actor('tenantA','ledgerA','led-admin')")).rejects.toThrow('permission denied'); }
    finally { await fixture.pg.exec('RESET ROLE'); }
  });
});

describe('durable ledger: review, reversal and corrections', () => {
  it('requires an independent reviewer, honours optimistic versions, and supports reject / correction', async () => {
    const prepared = await store.postEntry(A, 'led-acct', entry({ isAdjusting: true, adjustingType: 'ACCRUAL', source: 'ADJUSTING' }));
    expect(prepared.status).toBe('PREPARED');
    await expect(store.reviewEntry(A, 'led-acct', prepared.id, 'approve', prepared.version)).rejects.toMatchObject({ code: 'LEDGER_REVIEWER_REQUIRED' });
    await expect(store.reviewEntry(A, 'led-rev', prepared.id, 'approve', prepared.version + 1)).rejects.toMatchObject({ code: 'LEDGER_VERSION_CONFLICT', status: 409 });
    await expect(store.reviewEntry(A, 'led-rev', prepared.id, 'reject', prepared.version, 'no')).rejects.toMatchObject({ code: 'LEDGER_INPUT_INVALID' });
    const correction = await store.reviewEntry(A, 'led-rev', prepared.id, 'request_correction', prepared.version, 'Use the accrued liability account');
    expect(correction).toMatchObject({ status: 'CORRECTION_REQUIRED', reviewNote: 'Use the accrued liability account', version: 2 });
    const replacement = await store.postEntry(A, 'led-acct', entry({ isAdjusting: true, source: 'ADJUSTING', replacesEntryId: prepared.id }));
    expect(replacement).toMatchObject({ status: 'PREPARED', replacesEntryId: prepared.id });
    await expect(store.postEntry(A, 'led-acct', entry({ isAdjusting: true, source: 'ADJUSTING', replacesEntryId: prepared.id }))).rejects.toMatchObject({ code: 'ENTRY_ALREADY_CORRECTED' });
    expect((await store.reviewEntry(A, 'led-rev', replacement.id, 'approve', replacement.version)).status).toBe('POSTED');
    await expect(store.reviewEntry(A, 'led-rev', replacement.id, 'approve', 2)).rejects.toMatchObject({ code: 'ENTRY_NOT_PENDING_REVIEW' });
  });
  it('reverses through independent approval, nets the trial balance, and allows a retry after a rejected reversal', async () => {
    const tbBefore = await store.trialBalance(A, 'led-acct', 2025);
    const original = await store.postEntry(A, 'led-acct', entry({ lines: [{ accountId: accounts['6070'], debit: 77.7, credit: 0 }, { accountId: accounts['1010'], debit: 0, credit: 77.7 }] }));
    const reversal = await store.reverseEntry(A, 'led-acct', { idempotencyKey: key(), entryId: original.id, postingDate: '2025-02-11', reason: 'Duplicate of bank feed' });
    expect(reversal).toMatchObject({ status: 'PREPARED', reversalOfEntryId: original.id });
    await expect(store.reverseEntry(A, 'led-acct', { idempotencyKey: key(), entryId: original.id, postingDate: '2025-02-11', reason: 'Second attempt' })).rejects.toMatchObject({ code: 'ENTRY_ALREADY_REVERSED' });
    await store.reviewEntry(A, 'led-rev', reversal.id, 'reject', reversal.version, 'Reversal date should be in March');
    const retry = await store.reverseEntry(A, 'led-acct', { idempotencyKey: key(), entryId: original.id, postingDate: '2025-03-01', reason: 'Duplicate of bank feed' });
    await store.reviewEntry(A, 'led-rev', retry.id, 'approve', retry.version);
    const { entries } = await store.read(A, 'led-acct', 2025);
    expect(entries.find(e => e.id === original.id)!.reversedByEntryId).toBe(retry.id);
    const tbAfter = await store.trialBalance(A, 'led-acct', 2025);
    const ending = (tb: typeof tbAfter) => { const i = tb.items.find(x => x.accountNumber === '6070')!; return [i.endingDebit, i.endingCredit]; };
    expect(ending(tbAfter)).toEqual(ending(tbBefore));
    const gross = (tb: typeof tbAfter) => tb.items.find(x => x.accountNumber === '6070')!.periodDebit;
    expect(gross(tbAfter)).toBeCloseTo(gross(tbBefore) + 77.7, 2);
    await expect(store.reverseEntry(A, 'led-acct', { idempotencyKey: key(), entryId: retry.id, postingDate: '2025-03-02', reason: 'Undo the undo' })).rejects.toMatchObject({ code: 'REVERSAL_NOT_REVERSIBLE' });
  });
});

describe('durable ledger: periods', () => {
  it('locks by posting date, blocks close while entries await review, and needs an independent reopener', async () => {
    const q = await store.openPeriod(A, 'led-acct', 2025, '2025-Q2', '2025-04-01', '2025-06-30');
    expect(await store.openPeriod(A, 'led-acct', 2025, '2025-Q2', '2025-04-01', '2025-06-30')).toEqual({ periodId: q.periodId, created: false });
    await expect(store.openPeriod(A, 'led-acct', 2025, 'overlap', '2025-06-01', '2025-07-31')).rejects.toMatchObject({ code: 'PERIOD_CONFLICT' });
    await expect(store.openPeriod(A, 'led-acct', 2025, 'span', '2025-12-01', '2026-01-31')).rejects.toMatchObject({ code: 'PERIOD_INVALID' });
    const pending = await store.postEntry(A, 'led-acct', entry({ postingDate: '2025-05-05', periodId: q.periodId, isAdjusting: true, source: 'ADJUSTING' }));
    await expect(store.closePeriod(A, 'led-acct', q.periodId, 'HARD_CLOSED')).rejects.toMatchObject({ code: 'LEDGER_REVIEWER_REQUIRED' });
    await expect(store.closePeriod(A, 'led-rev', q.periodId, 'HARD_CLOSED')).rejects.toMatchObject({ code: 'PERIOD_HAS_UNAPPROVED_ENTRIES' });
    await store.reviewEntry(A, 'led-rev', pending.id, 'approve', pending.version);
    await store.closePeriod(A, 'led-rev', q.periodId, 'SOFT_CLOSED');
    await expect(store.postEntry(A, 'led-acct', entry({ postingDate: '2025-05-06' }))).rejects.toMatchObject({ code: 'PERIOD_SOFT_CLOSED' });
    expect((await store.postEntry(A, 'led-acct', entry({ postingDate: '2025-05-06', isAdjusting: true, source: 'ADJUSTING' }))).status).toBe('PREPARED');
    await expect(store.closePeriod(A, 'led-rev', q.periodId, 'HARD_CLOSED')).rejects.toMatchObject({ code: 'PERIOD_HAS_UNAPPROVED_ENTRIES' });
    const late = (await store.read(A, 'led-acct', 2025, { status: 'PREPARED', fromDate: '2025-05-06', toDate: '2025-05-06' })).entries[0];
    await store.reviewEntry(A, 'led-rev', late.id, 'reject', late.version, 'Not needed after review');
    await store.closePeriod(A, 'led-rev', q.periodId, 'HARD_CLOSED');
    await expect(store.postEntry(A, 'led-acct', entry({ postingDate: '2025-05-07', isAdjusting: true, source: 'ADJUSTING' }))).rejects.toMatchObject({ code: 'PERIOD_HARD_CLOSED' });
    await expect(fixture.pg.query("UPDATE taxguard_ledger_periods SET end_date='2025-05-01' WHERE period_id=$1", [q.periodId])).rejects.toThrow('PERIOD_IMMUTABLE');
    await expect(store.reopenPeriod(A, 'led-rev', q.periodId, 'Late synthetic invoice')).rejects.toMatchObject({ code: 'MAKER_CHECKER_VIOLATION' });
    await store.reopenPeriod(A, 'led-rev2', q.periodId, 'Late synthetic invoice');
    expect((await store.postEntry(A, 'led-acct', entry({ postingDate: '2025-05-07' }))).status).toBe('POSTED');
  });
});

describe('durable ledger: bank feed and reconciliation', () => {
  it('skips repeated external IDs, flags fingerprint duplicates, and posts each transaction once', async () => {
    const rows = [{ transactionDate: '2025-07-01', description: 'Synthetic SaaS', amount: -49.99, externalTransactionId: 'bank-1' },
      { transactionDate: '2025-07-02', description: 'Synthetic deposit', amount: 500 }];
    expect(await store.ingestTransactions(A, 'led-acct', accounts['1010'], 'CSV_UPLOAD', 'batch-1', rows)).toEqual({ inserted: 2, skippedExisting: 0, possibleDuplicates: 0 });
    expect(await store.ingestTransactions(A, 'led-acct', accounts['1010'], 'CSV_UPLOAD', 'batch-2', rows)).toEqual({ inserted: 1, skippedExisting: 1, possibleDuplicates: 1 });
    const txns = (await store.read(A, 'led-acct', 2025, { text: 'synthetic saas' })).transactions;
    expect(txns).toHaveLength(1);
    const posted = await store.categorizeTransaction(A, 'led-acct', txns[0].id, accounts['6070'], 2025);
    expect(posted.journalEntry.lines.map(l => [l.accountNumber, l.debit, l.credit])).toEqual([['6070', 49.99, 0], ['1010', 0, 49.99]]);
    await expect(store.categorizeTransaction(A, 'led-acct', txns[0].id, accounts['6070'], 2025)).rejects.toMatchObject({ code: 'TRANSACTION_ALREADY_POSTED' });
    await expect(store.ingestTransactions(A, 'led-acct', accounts['4010'], 'CSV_UPLOAD', 'batch-3', rows)).rejects.toMatchObject({ code: 'BANK_ACCOUNT_NOT_FOUND' });
  });
  it('reconciles in cents, refuses a variance, and freezes a closed reconciliation', async () => {
    await store.ingestTransactions(A, 'led-acct', accounts['1020'], 'CSV_UPLOAD', 'batch-r', [
      { transactionDate: '2025-08-01', description: 'Synthetic transfer in', amount: 1000.1 }, { transactionDate: '2025-08-02', description: 'Synthetic fee', amount: -0.1 }]);
    const txns = (await store.read(A, 'led-acct', 2025)).transactions.filter(t => t.accountId === accounts['1020']);
    const recon = await store.startReconciliation(A, 'led-acct', { accountId: accounts['1020'], taxYear: 2025, statementStart: '2025-08-01', statementEnd: '2025-08-31', beginningBalance: 0, endingBalance: 1000 });
    await store.setCleared(A, 'led-acct', recon, txns.find(t => t.amount > 0)!.id, true);
    await expect(store.finalizeReconciliation(A, 'led-acct', recon)).rejects.toMatchObject({ code: 'RECONCILIATION_VARIANCE_UNRESOLVED' });
    const balanced = await store.setCleared(A, 'led-acct', recon, txns.find(t => t.amount < 0)!.id, true);
    expect(balanced).toMatchObject({ variance: 0, status: 'BALANCED', clearedTransactionsCount: 2 });
    const closed = await store.finalizeReconciliation(A, 'led-acct', recon);
    expect(closed.status).toBe('CLOSED');
    await expect(store.setCleared(A, 'led-acct', recon, txns[0].id, false)).rejects.toMatchObject({ code: 'RECONCILIATION_ALREADY_CLOSED' });
    const other = await store.startReconciliation(A, 'led-acct', { accountId: accounts['1020'], taxYear: 2025, statementStart: '2025-08-01', statementEnd: '2025-08-31', beginningBalance: 0, endingBalance: 0 });
    await expect(store.setCleared(A, 'led-acct', other, txns[0].id, true)).rejects.toMatchObject({ code: 'TRANSACTION_ALREADY_RECONCILED' });
    await expect(store.setCleared(A, 'led-acct', other, (await store.read(A, 'led-acct', 2025)).transactions.find(t => t.accountId === accounts['1010'])!.id, true)).rejects.toMatchObject({ code: 'TRANSACTION_NOT_FOUND' });
  });
});

describe('durable ledger: reports and history', () => {
  it('produces a balanced trial balance, balanced statements, a general ledger and an audit history', async () => {
    const tb = await store.trialBalance(A, 'led-rev', 2025);
    expect(tb.isBalanced).toBe(true); expect(tb.totalEndingDebit).toBe(tb.totalEndingCredit);
    const fs = await store.financialStatements(A, 'led-rev', 2025);
    expect(fs.balanceSheet.isBalanced).toBe(true);
    expect(fs.profitAndLoss.grossRevenue).toBeGreaterThan(0);
    const gl = await store.generalLedger(A, 'led-rev', 2025, accounts['1010']);
    expect(gl).toHaveLength(1);
    expect(gl[0].endingBalance).toBe(tb.items.find(i => i.accountNumber === '1010')!.endingDebit - tb.items.find(i => i.accountNumber === '1010')!.endingCredit);
    const history = await store.history(A, 'led-rev', 200);
    expect(new Set(history.map(h => h.action))).toEqual(expect.objectContaining({}));
    expect(history.map(h => h.action)).toEqual(expect.arrayContaining(['LEDGER_ENTRY_CREATED', 'LEDGER_ENTRY_POSTED', 'LEDGER_PERIOD_CLOSED', 'LEDGER_RECONCILIATION_FINALIZED', 'LEDGER_ACCOUNTS_CREATED']));
    expect(history.every(h => !('clientId' in h.metadata))).toBe(true);
    expect((await store.history(B, 'led-admin', 200)).map(h => h.action)).not.toContain('LEDGER_ENTRY_POSTED');
  });
});

describe('durable ledger: survives a service restart', () => {
  let dir: string;
  beforeAll(() => { dir = mkdtempSync(path.join(tmpdir(), 'taxguard-ledger-')); });
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); });
  it('keeps posted entries, periods and audit after the database is closed and reopened', async () => {
    let pg = new PGlite(dir);
    const first = await capabilityFixture(() => pg);
    await applyProposals(first.pg, /^20261012240000_/);
    await seed(first.pg);
    let restartStore = new SqlLedgerStore(pgliteRpc(() => pg));
    const chart = generateStandardChartOfAccounts(A.tenantId, A.clientId, '1040_SCHED_C', 'led-acct');
    await restartStore.createAccounts(A, 'led-acct', chart);
    const ids = Object.fromEntries(chart.map(a => [a.accountNumber, a.id]));
    const posted = await restartStore.postEntry(A, 'led-acct', { idempotencyKey: 'restart-key-1', taxYear: 2025, postingDate: '2025-01-15', description: 'Before restart',
      lines: [{ accountId: ids['1010'], debit: 10, credit: 0 }, { accountId: ids['4010'], debit: 0, credit: 10 }] });
    await restartStore.openPeriod(A, 'led-acct', 2025, '2025-01', '2025-01-01', '2025-01-31');
    await pg.close();

    pg = new PGlite(dir);
    restartStore = new SqlLedgerStore(pgliteRpc(() => pg));
    try {
      const after = await restartStore.read(A, 'led-acct', 2025);
      expect(after.entries.map(e => [e.id, e.entryNumber, e.totalDebit])).toEqual([[posted.id, posted.entryNumber, 10]]);
      expect(after.periods.map(p => p.periodName)).toEqual(['2025-01']);
      const replay = await restartStore.postEntry(A, 'led-acct', { idempotencyKey: 'restart-key-1', taxYear: 2025, postingDate: '2025-01-15', description: 'Before restart',
        lines: [{ accountId: ids['1010'], debit: 10, credit: 0 }, { accountId: ids['4010'], debit: 0, credit: 10 }] });
      expect(replay).toMatchObject({ id: posted.id, replayed: true });
      expect((await restartStore.history(A, 'led-acct', 50)).map(h => h.action)).toContain('LEDGER_ENTRY_CREATED');
    } finally { await pg.close(); }
  }, 60000);
});
