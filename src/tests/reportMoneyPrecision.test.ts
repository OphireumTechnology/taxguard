import { expect, it } from 'vitest';
import { exactReportCents, reportDollars, ReportAmountError } from '../server/taxguard/bookkeeping/reportMoney';
import { financialStatements, trialBalanceReport, type TrialBalanceRow } from '../server/taxguard/bookkeeping/ledgerReports';

it.each(['0', '1', '-1', '10', '101', '-101', '9007199254740990', '-9007199254740990'])('preserves every serialized cent for %s', cents => {
  const value = reportDollars(cents);
  const text = JSON.parse(JSON.stringify({ value })).value.toString();
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const roundTrip = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * (text.startsWith('-') ? -1n : 1n);
  expect(roundTrip).toBe(BigInt(cents));
});
it.each(['9007199254740991', '-9007199254740991', '9007199254740992', '-9007199254740992', '9100000000000001', '-9100000000000001'])(
  'refuses %s when the number API cannot preserve the amount', cents => expect(() => reportDollars(cents)).toThrow(ReportAmountError));
it.each([NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '', '1.01', '1e3', ' 1', '01', null])('rejects malformed or unsafe cent input %s', value => {
  expect(() => exactReportCents(value as any)).toThrow(ReportAmountError);
});
const row = (over: Partial<TrialBalanceRow> = {}): TrialBalanceRow => ({ accountId: 'cash', accountNumber: '1010', accountName: 'Cash', accountType: 'ASSET',
  beginningDebitCents: '0', beginningCreditCents: '0', periodDebitCents: '0', periodCreditCents: '0', ...over });
it('calculates large cancellation exactly before converting a safe financial-statement result', () => {
  const statement = financialStatements([row({ periodDebitCents: '9100000000000001', periodCreditCents: '9100000000000000' })]);
  expect(statement.balanceSheet.assets.totalAssets).toBe(0.01);
});
it('refuses trial-balance gross totals even when netting would hide their unsafe size', () => {
  expect(() => trialBalanceReport('t', 'c', 2025, [row({ periodDebitCents: '9100000000000001', periodCreditCents: '9100000000000000' })])).toThrow(ReportAmountError);
});
it('sums across accounts exactly and refuses an unrepresentable combined total', () => {
  const rows = [row({ accountId: 'a', periodDebitCents: '4503599627370495' }), row({ accountId: 'b', periodDebitCents: '4503599627370495' }), row({ accountId: 'c', periodDebitCents: '1' })];
  expect(() => financialStatements(rows)).toThrow(ReportAmountError);
  expect(() => trialBalanceReport('t', 'c', 2025, rows)).toThrow(ReportAmountError);
});
