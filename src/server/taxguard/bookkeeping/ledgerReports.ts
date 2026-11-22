import type { FinancialStatements, TrialBalanceItem, TrialBalanceReport } from './types';
import { reportDollars } from './reportMoney';

export interface TrialBalanceRow {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  beginningDebitCents: bigint;
  beginningCreditCents: bigint;
  periodDebitCents: bigint;
  periodCreditCents: bigint;
}

export interface GeneralLedgerAccount {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  endingBalance: number;
  totalLineCount: number;
  detailTruncated: boolean;
  lines: Array<{
    entryId: string;
    entryNumber?: string;
    postingDate: string;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
}

export function trialBalanceReport(
  tenantId: string,
  clientId: string,
  taxYear: number,
  rows: TrialBalanceRow[]
): TrialBalanceReport {
  let totalDebitCents = 0n;
  let totalCreditCents = 0n;
  const items: TrialBalanceItem[] = rows.map((row) => {
    const endDr = row.beginningDebitCents + row.periodDebitCents;
    const endCr = row.beginningCreditCents + row.periodCreditCents;
    const net = endDr - endCr;
    const endingDebitCents = net > 0n ? net : 0n;
    const endingCreditCents = net < 0n ? -net : 0n;
    totalDebitCents += endingDebitCents;
    totalCreditCents += endingCreditCents;
    return {
      accountId: row.accountId,
      accountNumber: row.accountNumber,
      accountName: row.accountName,
      accountType: row.accountType,
      beginningDebit: reportDollars(row.beginningDebitCents),
      beginningCredit: reportDollars(row.beginningCreditCents),
      periodDebit: reportDollars(row.periodDebitCents),
      periodCredit: reportDollars(row.periodCreditCents),
      endingDebit: reportDollars(endingDebitCents),
      endingCredit: reportDollars(endingCreditCents),
      netBalance: reportDollars(net),
    };
  });

  return {
    tenantId,
    clientId,
    taxYear,
    items,
    totalDebit: reportDollars(totalDebitCents),
    totalCredit: reportDollars(totalCreditCents),
    isBalanced: totalDebitCents === totalCreditCents,
    generatedAt: new Date().toISOString(),
  };
}

export function financialStatements(rows: TrialBalanceRow[]): FinancialStatements {
  let revenueCents = 0n;
  let cogsCents = 0n;
  let expenseCents = 0n;
  let otherIncomeCents = 0n;
  let otherExpenseCents = 0n;
  let assetCents = 0n;
  let liabilityCents = 0n;
  let equityCents = 0n;

  const incomeLines: FinancialStatements['incomeStatement']['lines'] = [];
  const balanceLines: FinancialStatements['balanceSheet']['lines'] = [];

  for (const row of rows) {
    const netDr = row.beginningDebitCents + row.periodDebitCents - (row.beginningCreditCents + row.periodCreditCents);
    const t = String(row.accountType).toUpperCase();
    if (t === 'REVENUE') {
      const bal = -netDr;
      revenueCents += bal;
      incomeLines.push({ accountId: row.accountId, accountNumber: row.accountNumber, accountName: row.accountName, accountType: t, balance: reportDollars(bal) });
    } else if (t === 'COGS') {
      cogsCents += netDr;
      incomeLines.push({ accountId: row.accountId, accountNumber: row.accountNumber, accountName: row.accountName, accountType: t, balance: reportDollars(netDr) });
    } else if (t === 'EXPENSE') {
      expenseCents += netDr;
      incomeLines.push({ accountId: row.accountId, accountNumber: row.accountNumber, accountName: row.accountName, accountType: t, balance: reportDollars(netDr) });
    } else if (t === 'OTHER_INCOME') {
      const bal = -netDr;
      otherIncomeCents += bal;
      incomeLines.push({ accountId: row.accountId, accountNumber: row.accountNumber, accountName: row.accountName, accountType: t, balance: reportDollars(bal) });
    } else if (t === 'OTHER_EXPENSE') {
      otherExpenseCents += netDr;
      incomeLines.push({ accountId: row.accountId, accountNumber: row.accountNumber, accountName: row.accountName, accountType: t, balance: reportDollars(netDr) });
    } else if (t === 'ASSET') {
      assetCents += netDr;
      balanceLines.push({ accountId: row.accountId, accountNumber: row.accountNumber, accountName: row.accountName, accountType: t, balance: reportDollars(netDr) });
    } else if (t === 'LIABILITY') {
      const bal = -netDr;
      liabilityCents += bal;
      balanceLines.push({ accountId: row.accountId, accountNumber: row.accountNumber, accountName: row.accountName, accountType: t, balance: reportDollars(bal) });
    } else if (t === 'EQUITY') {
      const bal = -netDr;
      equityCents += bal;
      balanceLines.push({ accountId: row.accountId, accountNumber: row.accountNumber, accountName: row.accountName, accountType: t, balance: reportDollars(bal) });
    }
  }

  const grossProfitCents = revenueCents - cogsCents;
  const netIncomeCents = grossProfitCents - expenseCents + otherIncomeCents - otherExpenseCents;
  const totalLiabAndEq = liabilityCents + equityCents + netIncomeCents;

  return {
    incomeStatement: {
      revenue: reportDollars(revenueCents),
      cogs: reportDollars(cogsCents),
      grossProfit: reportDollars(grossProfitCents),
      operatingExpenses: reportDollars(expenseCents),
      otherIncome: reportDollars(otherIncomeCents),
      otherExpenses: reportDollars(otherExpenseCents),
      netIncome: reportDollars(netIncomeCents),
      lines: incomeLines,
    },
    balanceSheet: {
      assets: reportDollars(assetCents),
      liabilities: reportDollars(liabilityCents),
      equity: reportDollars(equityCents),
      retainedEarnings: reportDollars(netIncomeCents),
      totalLiabilitiesAndEquity: reportDollars(totalLiabAndEq),
      isBalanced: assetCents === totalLiabAndEq,
      lines: balanceLines,
    },
    generatedAt: new Date().toISOString(),
  };
}
