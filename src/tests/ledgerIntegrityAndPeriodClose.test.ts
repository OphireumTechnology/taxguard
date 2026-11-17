import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookkeepingRouter } from '../server/routes/bookkeeping.routes';
import { db } from '../server/db';
import { BookkeepingEngine, globalBookkeepingEngine } from '../server/taxguard/bookkeeping/bookkeeping.engine';
import type { JournalEntryLine } from '../server/taxguard/bookkeeping/types';

// Synthetic tenants, clients and amounts only.
const T = 'ledger-tenant', A = 'ledger-client-a', B = 'ledger-client-b';
function setup(engine = new BookkeepingEngine()) {
  const accountsA = engine.ensureDefaultChartOfAccounts(T, A, '1040_SCHED_C', 'fixture');
  const accountsB = engine.ensureDefaultChartOfAccounts(T, B, '1040_SCHED_C', 'fixture');
  const q1 = engine.ensurePeriod(T, A, 2025, '2025-Q1', '2025-01-01', '2025-03-31');
  const q2 = engine.ensurePeriod(T, A, 2025, '2025-Q2', '2025-04-01', '2025-06-30');
  return { engine, accountsA, accountsB, q1, q2 };
}
const lines = (debitAccount: string, creditAccount: string, amount = 125.5): JournalEntryLine[] =>
  [{ id: 'l1', accountId: debitAccount, debit: amount, credit: 0 }, { id: 'l2', accountId: creditAccount, debit: 0, credit: amount }];
const post = (f: ReturnType<typeof setup>, over: Record<string, unknown> = {}) => f.engine.createJournalEntry({
  tenantId: T, clientId: A, taxYear: 2025, periodId: f.q1.id, postingDate: '2025-02-10', transactionDate: '2025-02-10',
  description: 'Synthetic entry', source: 'MANUAL', lines: lines(f.accountsA[0].id, f.accountsA[1].id), creatorUid: 'maker', ...over } as any);

describe('ledger integrity (engine)', () => {
  it('sums in cents so classic floating point totals balance exactly', () => {
    const f = setup();
    const entry = post(f, { lines: [{ id: 'a', accountId: f.accountsA[0].id, debit: 0.1, credit: 0 }, { id: 'b', accountId: f.accountsA[0].id, debit: 0.2, credit: 0 },
      { id: 'c', accountId: f.accountsA[1].id, debit: 0, credit: 0.3 }] });
    expect(entry.totalDebit).toBe(0.3); expect(entry.totalCredit).toBe(0.3);
  });
  it.each([
    ['fractional cents', 10.005, 'INVALID_AMOUNT'], ['NaN', Number.NaN, 'INVALID_AMOUNT'], ['Infinity', Number.POSITIVE_INFINITY, 'INVALID_AMOUNT'], ['zero line', 0, 'ZERO_LINE'],
  ])('rejects %s amounts', (_label, amount, code) => {
    const f = setup();
    expect(() => post(f, { lines: lines(f.accountsA[0].id, f.accountsA[1].id, amount as number) })).toThrow(code as string);
  });
  it('rejects lines naming another client\'s, unknown or inactive accounts', () => {
    const f = setup();
    expect(() => post(f, { lines: lines(f.accountsA[0].id, f.accountsB[1].id) })).toThrow('ACCOUNT_NOT_IN_CHART');
    expect(() => post(f, { lines: lines(f.accountsA[0].id, 'acct_missing') })).toThrow('ACCOUNT_NOT_IN_CHART');
    f.engine.getAccount(f.accountsA[1].id)!.isActive = false;
    expect(() => post(f)).toThrow('ACCOUNT_NOT_IN_CHART');
  });
  it('rejects a posting date outside the named period or an invalid date', () => {
    const f = setup();
    expect(() => post(f, { postingDate: '2025-05-01' })).toThrow('PERIOD_MISMATCH');
    expect(() => post(f, { postingDate: '2025-02-30' })).toThrow('INVALID_POSTING_DATE');
    expect(() => post(f, { periodId: f.engine.ensurePeriod(T, B, 2025, 'B-Q1', '2025-01-01', '2025-03-31').id })).toThrow('PERIOD_MISMATCH');
  });
  it('enforces a hard close by posting date even when the caller names a fabricated period', () => {
    const f = setup();
    f.engine.closePeriod(f.q1.id, 'HARD_CLOSED', 'closer');
    expect(() => post(f, { periodId: 'period_made_up' })).toThrow('PERIOD_HARD_CLOSED');
    expect(() => post(f, { periodId: 'period_made_up', isAdjusting: true })).toThrow('PERIOD_HARD_CLOSED');
    expect(post(f, { periodId: f.q2.id, postingDate: '2025-04-02' }).status).toBe('POSTED');
  });
  it('lets a soft-closed period accept only reviewed adjusting entries', () => {
    const f = setup();
    f.engine.closePeriod(f.q1.id, 'SOFT_CLOSED', 'closer');
    expect(() => post(f)).toThrow('PERIOD_SOFT_CLOSED');
    const adjusting = post(f, { isAdjusting: true, source: 'ADJUSTING' });
    expect(adjusting.status).toBe('PREPARED'); expect(adjusting.postedAt).toBeUndefined();
  });
  it('approves only prepared entries, once, by an independent reviewer, and not into a hard-closed period', () => {
    const f = setup();
    const adjusting = post(f, { isAdjusting: true, source: 'ADJUSTING' });
    expect(() => f.engine.reviewAndApproveJournalEntry(adjusting.id, 'maker')).toThrow('MAKER_CHECKER_VIOLATION');
    expect(() => f.engine.reviewAndApproveJournalEntry(adjusting.id, 'checker', { tenantId: T, clientId: B })).toThrow('ENTRY_NOT_FOUND');
    const approved = f.engine.reviewAndApproveJournalEntry(adjusting.id, 'checker', { tenantId: T, clientId: A });
    expect(approved.status).toBe('POSTED'); expect(approved.postedAt).toBeDefined();
    expect(() => f.engine.reviewAndApproveJournalEntry(adjusting.id, 'checker')).toThrow('ENTRY_NOT_PENDING_REVIEW');
    expect(() => f.engine.reviewAndApproveJournalEntry(post(f).id, 'checker')).toThrow('ENTRY_NOT_PENDING_REVIEW');
  });
  it('refuses to post the same bank transaction twice', () => {
    const f = setup();
    const bank = f.accountsA.find(a => a.accountNumber === '1010') || f.accountsA[0];
    const expense = f.accountsA.find(a => a.accountType === 'EXPENSE')!;
    const { ingested } = f.engine.ingestTransactions(T, A, bank.id, 'fixture', 'CSV_UPLOAD', [{ transactionDate: '2025-02-01', description: 'Synthetic supplies', amount: -40 }] as any);
    f.engine.categorizeAndPostTransaction({ transactionId: ingested[0].id, assignedAccountId: expense.id, accountantUid: 'maker', periodId: f.q1.id, taxYear: 2025 });
    expect(() => f.engine.categorizeAndPostTransaction({ transactionId: ingested[0].id, assignedAccountId: expense.id, accountantUid: 'maker', periodId: f.q1.id, taxYear: 2025 })).toThrow('TRANSACTION_ALREADY_POSTED');
    expect(() => f.engine.categorizeAndPostTransaction({ transactionId: ingested[0].id, assignedAccountId: expense.id, accountantUid: 'maker', periodId: f.q1.id, taxYear: 2025, scope: { tenantId: T, clientId: B } })).toThrow('TRANSACTION_NOT_FOUND');
  });
});

describe('reconciliation scope (engine)', () => {
  it('clears only transactions of the reconciled account of the same client', () => {
    const f = setup();
    const [bankA, otherA] = [f.accountsA[0], f.accountsA[1]];
    const recon = f.engine.startReconciliation({ tenantId: T, clientId: A, accountId: bankA.id, taxYear: 2025, statementBeginningBalance: 0, statementEndingBalance: -10 });
    const own = f.engine.ingestTransactions(T, A, bankA.id, 'fixture', 'CSV_UPLOAD', [{ transactionDate: '2025-02-01', description: 'Synthetic fee', amount: -10 }] as any).ingested[0];
    const otherAccount = f.engine.ingestTransactions(T, A, otherA.id, 'fixture', 'CSV_UPLOAD', [{ transactionDate: '2025-02-02', description: 'Other account', amount: -10 }] as any).ingested[0];
    const otherClient = f.engine.ingestTransactions(T, B, f.accountsB[0].id, 'fixture', 'CSV_UPLOAD', [{ transactionDate: '2025-02-03', description: 'Client B', amount: -10 }] as any).ingested[0];
    expect(() => f.engine.clearTransaction(recon.id, otherAccount.id, true)).toThrow('TRANSACTION_NOT_FOUND');
    expect(() => f.engine.clearTransaction(recon.id, otherClient.id, true)).toThrow('TRANSACTION_NOT_FOUND');
    expect(f.engine.getTransactions(T, B)[0].reconciliationStatus).not.toBe('CLEARED');
    expect(f.engine.clearTransaction(recon.id, own.id, true).status).toBe('BALANCED');
    expect(() => f.engine.clearTransaction(recon.id, own.id, true, { tenantId: T, clientId: B })).toThrow('RECONCILIATION_NOT_FOUND');
  });
});

describe('reversing entries', () => {
  it('prepares a mirror entry for independent approval and the trial balance nets to zero only after approval', () => {
    const f = setup();
    const original = post(f);
    const before = f.engine.generateTrialBalance(T, A, 2025);
    const reversal = f.engine.reverseJournalEntry({ entryId: original.id, postingDate: '2025-03-01', reason: 'Posted to the wrong client', preparerUid: 'maker' });
    expect(reversal.status).toBe('PREPARED'); expect(reversal.reversalOfEntryId).toBe(original.id);
    expect(reversal.lines.map(l => [l.accountId, l.debit, l.credit])).toEqual(original.lines.map(l => [l.accountId, l.credit, l.debit]));
    expect(f.engine.generateTrialBalance(T, A, 2025).items).toEqual(before.items);
    expect(() => f.engine.reviewAndApproveJournalEntry(reversal.id, 'maker')).toThrow('MAKER_CHECKER_VIOLATION');
    f.engine.reviewAndApproveJournalEntry(reversal.id, 'checker');
    const after = f.engine.generateTrialBalance(T, A, 2025);
    const touched = after.items.filter(i => original.lines.some(l => l.accountId === i.accountId));
    expect(touched.every(i => i.periodDebit === i.periodCredit)).toBe(true);
  });
  it.each([
    ['a second reversal', (f: ReturnType<typeof setup>, id: string) => { f.engine.reverseJournalEntry({ entryId: id, postingDate: '2025-03-01', reason: 'First correction', preparerUid: 'maker' }); return f.engine.reverseJournalEntry({ entryId: id, postingDate: '2025-03-01', reason: 'Second attempt', preparerUid: 'maker' }); }, 'ENTRY_ALREADY_REVERSED'],
    ['a reversal of a reversal', (f: ReturnType<typeof setup>, id: string) => { const r = f.engine.reverseJournalEntry({ entryId: id, postingDate: '2025-03-01', reason: 'First correction', preparerUid: 'maker' }); f.engine.reviewAndApproveJournalEntry(r.id, 'checker'); return f.engine.reverseJournalEntry({ entryId: r.id, postingDate: '2025-03-02', reason: 'Undo the undo', preparerUid: 'maker' }); }, 'REVERSAL_NOT_REVERSIBLE'],
    ['a missing reason', (f: ReturnType<typeof setup>, id: string) => f.engine.reverseJournalEntry({ entryId: id, postingDate: '2025-03-01', reason: ' no ', preparerUid: 'maker' }), 'REVERSAL_REASON_REQUIRED'],
    ['a back-dated reversal', (f: ReturnType<typeof setup>, id: string) => f.engine.reverseJournalEntry({ entryId: id, postingDate: '2025-01-01', reason: 'Too early date', preparerUid: 'maker' }), 'INVALID_POSTING_DATE'],
    ['another client\'s scope', (f: ReturnType<typeof setup>, id: string) => f.engine.reverseJournalEntry({ entryId: id, postingDate: '2025-03-01', reason: 'Cross-client attempt', preparerUid: 'maker', scope: { tenantId: T, clientId: B } }), 'ENTRY_NOT_FOUND'],
    ['a hard-closed reversal date', (f: ReturnType<typeof setup>, id: string) => { f.engine.closePeriod(f.q2.id, 'HARD_CLOSED', 'closer'); return f.engine.reverseJournalEntry({ entryId: id, postingDate: '2025-04-15', periodId: f.q2.id, reason: 'Into a locked quarter', preparerUid: 'maker' }); }, 'PERIOD_HARD_CLOSED'],
  ])('refuses %s', (_label, run, code) => {
    const f = setup();
    expect(() => run(f, post(f).id)).toThrow(code);
  });
  it('refuses to reverse an entry that is still awaiting review', () => {
    const f = setup();
    const prepared = post(f, { isAdjusting: true, source: 'ADJUSTING' });
    expect(() => f.engine.reverseJournalEntry({ entryId: prepared.id, postingDate: '2025-03-01', reason: 'Not yet posted', preparerUid: 'maker' })).toThrow('ENTRY_NOT_POSTED');
  });
});

describe('period close controls', () => {
  it('blocks closing while prepared entries are unreviewed, then allows OPEN -> SOFT -> HARD only', () => {
    const f = setup();
    const adjusting = post(f, { isAdjusting: true, source: 'ADJUSTING' });
    expect(() => f.engine.closePeriod(f.q1.id, 'SOFT_CLOSED', 'closer')).toThrow('PERIOD_HAS_UNAPPROVED_ENTRIES');
    f.engine.reviewAndApproveJournalEntry(adjusting.id, 'checker');
    f.engine.closePeriod(f.q1.id, 'SOFT_CLOSED', 'closer');
    expect(() => f.engine.closePeriod(f.q1.id, 'SOFT_CLOSED', 'closer')).toThrow('PERIOD_STATUS_TRANSITION_INVALID');
    f.engine.closePeriod(f.q1.id, 'HARD_CLOSED', 'closer');
    expect(() => f.engine.closePeriod(f.q1.id, 'SOFT_CLOSED', 'closer')).toThrow('PERIOD_STATUS_TRANSITION_INVALID');
  });
  it('requires an independent approver and a bounded justification to reopen a hard-closed period', () => {
    const f = setup();
    f.engine.closePeriod(f.q1.id, 'HARD_CLOSED', 'closer');
    expect(() => f.engine.reopenPeriod(f.q1.id, 'closer', 'Late synthetic 1099 received')).toThrow('MAKER_CHECKER_VIOLATION');
    expect(() => f.engine.reopenPeriod(f.q1.id, 'checker', 'x'.repeat(501))).toThrow('REOPEN_REASON_REQUIRED');
    expect(() => f.engine.reopenPeriod(f.q1.id, 'checker', 'Late synthetic 1099 received', { tenantId: T, clientId: B })).toThrow('PERIOD_NOT_FOUND');
    expect(f.engine.reopenPeriod(f.q1.id, 'checker', '  Late synthetic 1099 received  ').reopenReason).toBe('Late synthetic 1099 received');
    expect(() => f.engine.reopenPeriod(f.q1.id, 'checker', 'Already open now')).toThrow('PERIOD_STATUS_TRANSITION_INVALID');
  });
  it('validates new periods: inside the tax year, no overlap, idempotent for identical definitions', () => {
    const f = setup();
    const scope = { tenantId: T, clientId: A };
    expect(() => f.engine.openPeriod(scope, 2025, '2025-Q2b', '2025-06-01', '2025-07-31')).toThrow('PERIOD_CONFLICT');
    expect(() => f.engine.openPeriod(scope, 2025, '2025-X', '2024-12-01', '2025-01-31')).toThrow('PERIOD_INVALID');
    expect(() => f.engine.openPeriod(scope, 2025, 'bad name!', '2025-07-01', '2025-09-30')).toThrow('PERIOD_INVALID');
    const q3 = f.engine.openPeriod(scope, 2025, '2025-Q3', '2025-07-01', '2025-09-30');
    expect(f.engine.openPeriod(scope, 2025, '2025-Q3', '2025-07-01', '2025-09-30')).toEqual(q3);
    expect(() => f.engine.openPeriod(scope, 2025, '2025-Q3', '2025-07-01', '2025-09-29')).toThrow('PERIOD_CONFLICT');
  });
});

describe('bookkeeping HTTP scope enforcement (real local authentication)', () => {
  let server: Server; let origin: string;
  const users = { accountant: 'ledger-http-accountant', reviewer: 'ledger-http-reviewer', client: 'ledger-http-client' };
  let fixture: ReturnType<typeof setup>;
  beforeAll(async () => {
    const app = express(); app.use(express.json()); app.use('/api/bookkeeping', bookkeepingRouter);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    fixture = setup(globalBookkeepingEngine);
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    for (const [role, id] of Object.entries(users)) {
      db.users.set(id, { id, name: 'Synthetic ' + role, email: id + '@example.test', role: role as any, tenantId: T,
        authorizedClientIds: [A], ...(role === 'client' ? { clientId: A } : {}), status: 'active', createdAt: '2025-01-01', isVerified: true } as any);
      db.sessions.set(id + '-token', { userId: id, expiresAt: Date.now() + 60_000 } as any);
      if (role !== 'client') db.clientAccountantAssignments.set(`ledger-asg-${id}`, { id: `ledger-asg-${id}`, clientId: A, clientName: A, accountantId: id, accountantName: id,
        assignmentType: 'primary', status: 'active', accessScope: [], assignedBy: 'admin', assignedByName: 'Admin', assignedAt: '2025-01-01T00:00:00Z', effectiveDate: '2025-01-01T00:00:00Z' } as any);
    }
  });
  afterEach(() => { for (const id of Object.values(users)) { db.users.delete(id); db.sessions.delete(id + '-token'); db.clientAccountantAssignments.delete(`ledger-asg-${id}`); } vi.unstubAllEnvs(); });
  const call = (who: keyof typeof users, path: string, body: Record<string, unknown> = {}) => fetch(origin + '/api/bookkeeping' + path, {
    method: 'POST', headers: { Authorization: 'Bearer ' + users[who] + '-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: A, taxYear: 2025, ...body }) });

  it('a reviewer authorized for client A cannot approve client B\'s entry by ID', async () => {
    const foreign = globalBookkeepingEngine.createJournalEntry({ tenantId: T, clientId: B, taxYear: 2025, periodId: 'none', postingDate: '2025-02-01', transactionDate: '2025-02-01',
      description: 'Client B adjusting', source: 'ADJUSTING', isAdjusting: true, lines: lines(fixture.accountsB[0].id, fixture.accountsB[1].id), creatorUid: 'b-maker' });
    const response = await call('reviewer', `/journal-entries/${foreign.id}/approve`);
    expect(response.status).toBe(404);
    expect(globalBookkeepingEngine.getJournalEntries(T, B).find(e => e.id === foreign.id)!.status).toBe('PREPARED');
  });

  it('runs reversal and period close end to end with maker-checker and role checks', async () => {
    const created = await call('accountant', '/journal-entries', { periodId: fixture.q1.id, postingDate: '2025-03-05', transactionDate: '2025-03-05', description: 'HTTP synthetic entry',
      lines: lines(fixture.accountsA[0].id, fixture.accountsA[1].id, 300) });
    expect(created.status).toBe(201); const entry = (await created.json()).entry;
    const reversed = await call('accountant', `/journal-entries/${entry.id}/reverse`, { postingDate: '2025-03-06', reason: 'Duplicate of bank-feed entry' });
    expect(reversed.status).toBe(201); const reversal = (await reversed.json()).entry;
    expect((await call('client', `/journal-entries/${entry.id}/reverse`, { postingDate: '2025-03-06', reason: 'Client attempt' })).status).toBe(403);
    expect((await call('accountant', '/periods/' + fixture.q1.id + '/close', { status: 'SOFT_CLOSED' })).status).toBe(403);
    const blocked = await call('reviewer', '/periods/' + fixture.q1.id + '/close', { status: 'HARD_CLOSED' });
    expect(blocked.status).toBe(400); expect((await blocked.json()).code).toBe('PERIOD_HAS_UNAPPROVED_ENTRIES');
    expect((await call('reviewer', `/journal-entries/${reversal.id}/approve`)).status).toBe(200);
    expect((await call('reviewer', '/periods/' + fixture.q1.id + '/close', { status: 'HARD_CLOSED' })).status).toBe(200);
    const selfReopen = await call('reviewer', '/periods/' + fixture.q1.id + '/reopen', { reason: 'Reviewer reopening own close' });
    expect(selfReopen.status).toBe(403); expect((await selfReopen.json()).code).toBe('MAKER_CHECKER_VIOLATION');
    const locked = await call('accountant', '/journal-entries', { periodId: 'anything', postingDate: '2025-03-10', transactionDate: '2025-03-10', description: 'Into locked quarter',
      lines: lines(fixture.accountsA[0].id, fixture.accountsA[1].id, 5) });
    expect(locked.status).toBe(400); expect((await locked.json()).code).toBe('PERIOD_HARD_CLOSED');
    const actions = [...db.auditLogs.values()].map((a: any) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['JOURNAL_ENTRY_REVERSAL_PREPARED', 'ACCOUNTING_PERIOD_CLOSED']));
  });

  it('refuses client-role reconciliation clearing and cross-client reconciliation IDs', async () => {
    const reconB = globalBookkeepingEngine.startReconciliation({ tenantId: T, clientId: B, accountId: fixture.accountsB[0].id, taxYear: 2025, statementBeginningBalance: 0, statementEndingBalance: 0 });
    expect((await call('client', `/reconciliations/${reconB.id}/clear`, { transactionId: 'x', isCleared: true })).status).toBe(403);
    expect((await call('accountant', `/reconciliations/${reconB.id}/clear`, { transactionId: 'x', isCleared: true })).status).toBe(404);
    expect((await call('reviewer', `/reconciliations/${reconB.id}/finalize`)).status).toBe(404);
  });

  it('creates and lists periods only inside the authorized scope', async () => {
    const created = await call('accountant', '/periods', { periodName: '2025-Q4', startDate: '2025-10-01', endDate: '2025-12-31' });
    expect(created.status).toBe(201);
    const listed = await fetch(origin + `/api/bookkeeping/periods?clientId=${A}&taxYear=2025`, { headers: { Authorization: 'Bearer ' + users.accountant + '-token' } });
    expect((await listed.json()).periods.map((p: any) => p.periodName)).toContain('2025-Q4');
    const foreign = await fetch(origin + `/api/bookkeeping/periods?clientId=${B}&taxYear=2025`, { headers: { Authorization: 'Bearer ' + users.accountant + '-token' } });
    expect(foreign.status).toBe(403);
  });
});
