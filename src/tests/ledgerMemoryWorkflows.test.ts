import { describe, expect, it } from 'vitest';
import { BookkeepingEngine } from '../server/taxguard/bookkeeping/bookkeeping.engine';
import { financialStatements, generalLedger, trialBalanceReport, type TrialBalanceRow } from '../server/taxguard/bookkeeping/ledgerReports';

const T = 'mem-tenant', A = 'mem-a', B = 'mem-b';
function setup() {
  const engine = new BookkeepingEngine();
  const accounts = engine.ensureDefaultChartOfAccounts(T, A, '1040_SCHED_C', 'fixture');
  const id = (n: string) => accounts.find(a => a.accountNumber === n)!.id;
  const prepare = () => engine.createJournalEntry({ tenantId: T, clientId: A, taxYear: 2025, periodId: 'none', postingDate: '2025-02-01', transactionDate: '2025-02-01',
    description: 'Synthetic accrual', source: 'ADJUSTING', isAdjusting: true, creatorUid: 'maker',
    lines: [{ id: 'a', accountId: id('6070'), debit: 10, credit: 0 }, { id: 'b', accountId: id('2010'), debit: 0, credit: 10 }] });
  return { engine, id, prepare };
}

describe('memory engine review outcomes and replacements', () => {
  it('returns an entry for correction with a recorded note and accepts exactly one replacement', () => {
    const { engine, id, prepare } = setup();
    const entry = prepare();
    expect(() => engine.reviewJournalEntryOutcome(entry.id, 'maker', 'CORRECTION_REQUIRED', 'Wrong account')).toThrow('MAKER_CHECKER_VIOLATION');
    expect(() => engine.reviewJournalEntryOutcome(entry.id, 'checker', 'CORRECTION_REQUIRED', 'no')).toThrow('LEDGER_INPUT_INVALID');
    expect(() => engine.reviewJournalEntryOutcome(entry.id, 'checker', 'CORRECTION_REQUIRED', 'Wrong account', { tenantId: T, clientId: B })).toThrow('ENTRY_NOT_FOUND');
    const returned = engine.reviewJournalEntryOutcome(entry.id, 'checker', 'CORRECTION_REQUIRED', ' Wrong account ');
    expect(returned).toMatchObject({ status: 'CORRECTION_REQUIRED', reviewNote: 'Wrong account', reviewerUid: 'checker' });
    const base = { tenantId: T, clientId: A, taxYear: 2025, periodId: 'none', postingDate: '2025-02-01', transactionDate: '2025-02-01', description: 'Corrected', source: 'ADJUSTING' as const,
      creatorUid: 'maker', lines: [{ id: 'a', accountId: id('6070'), debit: 9, credit: 0 }, { id: 'b', accountId: id('2010'), debit: 0, credit: 9 }] };
    const replacement = engine.prepareReplacementEntry(entry.id, base);
    expect(replacement).toMatchObject({ status: 'PREPARED', replacesEntryId: entry.id });
    expect(() => engine.prepareReplacementEntry(entry.id, base)).toThrow('ENTRY_ALREADY_CORRECTED');
    expect(() => engine.prepareReplacementEntry(prepare().id, base)).toThrow('ENTRY_NOT_CORRECTABLE');
    expect(() => engine.reviewJournalEntryOutcome(entry.id, 'checker', 'REJECTED', 'Already returned')).toThrow('ENTRY_NOT_PENDING_REVIEW');
  });
  it('rejects an entry so it never posts', () => {
    const { engine, prepare } = setup();
    const entry = prepare();
    engine.reviewJournalEntryOutcome(entry.id, 'checker', 'REJECTED', 'Not supported by evidence');
    expect(() => engine.reviewAndApproveJournalEntry(entry.id, 'checker')).toThrow('ENTRY_NOT_PENDING_REVIEW');
    expect(engine.generateTrialBalance(T, A, 2025).totalPeriodDebit).toBe(0);
  });
  it('deactivates accounts in scope only, and inactive accounts cannot be posted to', () => {
    const { engine, id } = setup();
    expect(() => engine.setAccountActive(id('6070'), false, { tenantId: T, clientId: B })).toThrow('ACCOUNT_NOT_FOUND');
    engine.setAccountActive(id('6070'), false, { tenantId: T, clientId: A });
    expect(() => engine.createJournalEntry({ tenantId: T, clientId: A, taxYear: 2025, periodId: 'none', postingDate: '2025-02-01', transactionDate: '2025-02-01', description: 'x',
      source: 'MANUAL', creatorUid: 'maker', lines: [{ id: 'a', accountId: id('6070'), debit: 1, credit: 0 }, { id: 'b', accountId: id('1010'), debit: 0, credit: 1 }] })).toThrow('ACCOUNT_NOT_IN_CHART');
  });
});

describe('cent-exact reports', () => {
  const rows: TrialBalanceRow[] = [
    { accountId: 'cash', accountNumber: '1010', accountName: 'Cash', accountType: 'ASSET', beginningDebitCents: 100000, beginningCreditCents: 0, periodDebitCents: 30, periodCreditCents: 10 },
    { accountId: 'cap', accountNumber: '3010', accountName: 'Capital', accountType: 'EQUITY', beginningDebitCents: 0, beginningCreditCents: 80000, periodDebitCents: 0, periodCreditCents: 0 },
    { accountId: 'rev', accountNumber: '4010', accountName: 'Revenue', accountType: 'REVENUE', beginningDebitCents: 0, beginningCreditCents: 20000, periodDebitCents: 0, periodCreditCents: 30 },
    { accountId: 'exp', accountNumber: '6070', accountName: 'Supplies', accountType: 'EXPENSE', beginningDebitCents: 0, beginningCreditCents: 0, periodDebitCents: 10, periodCreditCents: 0 },
  ];
  it('carries beginning balances and stays exact for small amounts', () => {
    const tb = trialBalanceReport(T, A, 2025, rows, '2025-12-31T00:00:00.000Z');
    expect(tb.items.find(i => i.accountId === 'cash')).toMatchObject({ beginningDebit: 1000, periodDebit: 0.3, periodCredit: 0.1, endingDebit: 1000.2 });
    expect(tb.isBalanced).toBe(true);
  });
  it('reports only tax-year activity in profit and loss and balances the balance sheet with prior unclosed earnings', () => {
    const fs = financialStatements(rows);
    expect(fs.profitAndLoss).toMatchObject({ grossRevenue: 0.3, totalOperatingExpenses: 0.1, netIncome: 0.2 });
    expect(fs.balanceSheet.equity.items).toEqual(expect.arrayContaining([{ accountName: 'Retained earnings (prior years, unclosed)', amount: 200 }]));
    expect(fs.balanceSheet.isBalanced).toBe(true);
  });
  it('builds a running general ledger from posted entries only', () => {
    const gl = generalLedger([{ accountId: 'cash', accountNumber: '1010', accountName: 'Cash', accountType: 'ASSET' }], [
      { entryId: 'e2', entryNumber: 'JE-2', postingDate: '2025-01-05', description: 'out', status: 'POSTED', lines: [{ accountId: 'cash', debitCents: 0, creditCents: 25 }] },
      { entryId: 'e1', entryNumber: 'JE-1', postingDate: '2025-01-01', description: 'in', status: 'POSTED', lines: [{ accountId: 'cash', debitCents: 100, creditCents: 0 }] },
      { entryId: 'e3', entryNumber: 'JE-3', postingDate: '2025-01-02', description: 'pending', status: 'PREPARED', lines: [{ accountId: 'cash', debitCents: 999, creditCents: 0 }] }]);
    expect(gl[0].lines.map(l => [l.entryNumber, l.runningBalance])).toEqual([['JE-1', 1], ['JE-2', 0.75]]);
  });
});
