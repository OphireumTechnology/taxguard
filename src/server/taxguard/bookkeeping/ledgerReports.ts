/**
 * Cent-exact ledger reports computed from posted activity. Amounts are integers (cents) until
 * the final conversion to dollars for the existing API contracts.
 */
import type { AccountType, FinancialStatements, TrialBalanceItem, TrialBalanceReport } from './types';

export interface TrialBalanceRow {
  accountId: string; accountNumber: string; accountName: string; accountType: AccountType;
  beginningDebitCents: number; beginningCreditCents: number; periodDebitCents: number; periodCreditCents: number;
}
const NORMAL_DEBIT: AccountType[] = ['ASSET', 'EXPENSE', 'COGS', 'OTHER_EXPENSE'];
const INCOME_STATEMENT: AccountType[] = ['REVENUE', 'COGS', 'EXPENSE', 'OTHER_INCOME', 'OTHER_EXPENSE'];
const dollars = (cents: number) => cents / 100;
/** Splits a signed debit-minus-credit balance into the account's debit / credit columns. */
function sides(type: AccountType, debitMinusCredit: number): { debit: number; credit: number } {
  if (NORMAL_DEBIT.includes(type)) return debitMinusCredit >= 0 ? { debit: debitMinusCredit, credit: 0 } : { debit: 0, credit: -debitMinusCredit };
  return debitMinusCredit <= 0 ? { debit: 0, credit: -debitMinusCredit } : { debit: debitMinusCredit, credit: 0 };
}

export function trialBalanceReport(tenantId: string, clientId: string, taxYear: number, rows: TrialBalanceRow[], generatedAt = new Date().toISOString()): TrialBalanceReport {
  const totals = { bd: 0, bc: 0, pd: 0, pc: 0, ed: 0, ec: 0 };
  const items: TrialBalanceItem[] = rows.map(row => {
    const beginning = sides(row.accountType, row.beginningDebitCents - row.beginningCreditCents);
    const ending = sides(row.accountType, row.beginningDebitCents - row.beginningCreditCents + row.periodDebitCents - row.periodCreditCents);
    totals.bd += beginning.debit; totals.bc += beginning.credit; totals.pd += row.periodDebitCents; totals.pc += row.periodCreditCents;
    totals.ed += ending.debit; totals.ec += ending.credit;
    return { accountId: row.accountId, accountNumber: row.accountNumber, accountName: row.accountName, accountType: row.accountType,
      beginningDebit: dollars(beginning.debit), beginningCredit: dollars(beginning.credit), periodDebit: dollars(row.periodDebitCents),
      periodCredit: dollars(row.periodCreditCents), endingDebit: dollars(ending.debit), endingCredit: dollars(ending.credit) };
  });
  return { tenantId, clientId, taxYear, generatedAt, items,
    totalBeginningDebit: dollars(totals.bd), totalBeginningCredit: dollars(totals.bc), totalPeriodDebit: dollars(totals.pd), totalPeriodCredit: dollars(totals.pc),
    totalEndingDebit: dollars(totals.ed), totalEndingCredit: dollars(totals.ec), isBalanced: totals.ed === totals.ec && totals.pd === totals.pc };
}

/**
 * Profit and loss uses tax-year activity only. The balance sheet uses cumulative balances;
 * income-statement activity of earlier years that has not been closed to equity is shown as
 * "Retained earnings (prior years, unclosed)" so the statement balances without a closing entry.
 */
export function financialStatements(rows: TrialBalanceRow[]): FinancialStatements {
  let revenue = 0, cogs = 0, opex = 0, other = 0, priorEarnings = 0;
  let currentAssets = 0, fixedAssets = 0, currentLiabilities = 0, longTermLiabilities = 0, equity = 0;
  const lists = { opex: [] as { accountName: string; amount: number }[], ca: [] as { accountName: string; amount: number }[], fa: [] as { accountName: string; amount: number }[],
    cl: [] as { accountName: string; amount: number }[], ll: [] as { accountName: string; amount: number }[], eq: [] as { accountName: string; amount: number }[] };
  for (const row of rows) {
    const periodDebitNet = row.periodDebitCents - row.periodCreditCents;
    const cumulativeDebitNet = row.beginningDebitCents - row.beginningCreditCents + periodDebitNet;
    if (INCOME_STATEMENT.includes(row.accountType)) priorEarnings -= row.beginningDebitCents - row.beginningCreditCents;
    switch (row.accountType) {
      case 'REVENUE': revenue -= periodDebitNet; break;
      case 'COGS': cogs += periodDebitNet; break;
      case 'EXPENSE': opex += periodDebitNet; lists.opex.push({ accountName: row.accountName, amount: dollars(periodDebitNet) }); break;
      case 'OTHER_INCOME': other -= periodDebitNet; break;
      case 'OTHER_EXPENSE': other -= periodDebitNet; break;
      case 'ASSET':
        if (row.accountNumber.startsWith('15')) { fixedAssets += cumulativeDebitNet; lists.fa.push({ accountName: row.accountName, amount: dollars(cumulativeDebitNet) }); }
        else { currentAssets += cumulativeDebitNet; lists.ca.push({ accountName: row.accountName, amount: dollars(cumulativeDebitNet) }); }
        break;
      case 'LIABILITY':
        if (row.accountNumber.startsWith('25')) { longTermLiabilities -= cumulativeDebitNet; lists.ll.push({ accountName: row.accountName, amount: dollars(-cumulativeDebitNet) }); }
        else { currentLiabilities -= cumulativeDebitNet; lists.cl.push({ accountName: row.accountName, amount: dollars(-cumulativeDebitNet) }); }
        break;
      case 'EQUITY': equity -= cumulativeDebitNet; lists.eq.push({ accountName: row.accountName, amount: dollars(-cumulativeDebitNet) }); break;
    }
  }
  if (priorEarnings !== 0) { lists.eq.push({ accountName: 'Retained earnings (prior years, unclosed)', amount: dollars(priorEarnings) }); equity += priorEarnings; }
  const grossProfit = revenue - cogs, operatingIncome = grossProfit - opex, netIncome = operatingIncome + other;
  const totalAssets = currentAssets + fixedAssets, totalLiabilities = currentLiabilities + longTermLiabilities, totalEquity = equity + netIncome;
  return {
    profitAndLoss: { grossRevenue: dollars(revenue), costOfGoodsSold: dollars(cogs), grossProfit: dollars(grossProfit), operatingExpenses: lists.opex,
      totalOperatingExpenses: dollars(opex), operatingIncome: dollars(operatingIncome), otherIncomeAndExpenses: dollars(other), netIncome: dollars(netIncome) },
    balanceSheet: {
      assets: { currentAssets: lists.ca, totalCurrentAssets: dollars(currentAssets), fixedAssets: lists.fa, totalFixedAssets: dollars(fixedAssets), totalAssets: dollars(totalAssets) },
      liabilities: { currentLiabilities: lists.cl, totalCurrentLiabilities: dollars(currentLiabilities), longTermLiabilities: lists.ll,
        totalLongTermLiabilities: dollars(longTermLiabilities), totalLiabilities: dollars(totalLiabilities) },
      equity: { items: lists.eq, netIncomeCurrentPeriod: dollars(netIncome), totalEquity: dollars(totalEquity) },
      isBalanced: totalAssets === totalLiabilities + totalEquity,
    },
  };
}

export interface GeneralLedgerLine { entryId: string; entryNumber: string; postingDate: string; description: string; debit: number; credit: number; runningBalance: number }
export interface GeneralLedgerAccount { accountId: string; accountNumber: string; accountName: string; accountType: AccountType; lines: GeneralLedgerLine[]; endingBalance: number;
  openingBalance?: number; totalLineCount?: number; detailTruncated?: boolean }
/** Posted lines grouped by account in posting order with a running balance on the account's normal side. */
export function generalLedger(accounts: Array<{ accountId: string; accountNumber: string; accountName: string; accountType: AccountType }>,
  entries: Array<{ entryId: string; entryNumber: string; postingDate: string; description: string; status: string; lines: Array<{ accountId: string; debitCents: number; creditCents: number }> }>,
  accountId?: string): GeneralLedgerAccount[] {
  const posted = entries.filter(e => e.status === 'POSTED').sort((a, b) => a.postingDate.localeCompare(b.postingDate) || a.entryNumber.localeCompare(b.entryNumber));
  return accounts.filter(a => !accountId || a.accountId === accountId).map(account => {
    const sign = NORMAL_DEBIT.includes(account.accountType) ? 1 : -1;
    let running = 0;
    const lines: GeneralLedgerLine[] = [];
    for (const entry of posted) for (const line of entry.lines) {
      if (line.accountId !== account.accountId) continue;
      running += sign * (line.debitCents - line.creditCents);
      lines.push({ entryId: entry.entryId, entryNumber: entry.entryNumber, postingDate: entry.postingDate, description: entry.description,
        debit: dollars(line.debitCents), credit: dollars(line.creditCents), runningBalance: dollars(running) });
    }
    return { accountId: account.accountId, accountNumber: account.accountNumber, accountName: account.accountName, accountType: account.accountType, lines, endingBalance: dollars(running) };
  }).filter(a => accountId || a.lines.length > 0);
}
