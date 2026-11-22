import type { ChartOfAccount } from './types';

export function generateStandardChartOfAccounts(
  tenantId: string,
  clientId: string,
  _entityType?: string,
  _createdBy?: string
): ChartOfAccount[] {
  const now = new Date().toISOString();
  const defs: Array<{ accountNumber: string; name: string; accountType: ChartOfAccount['accountType']; normalBalance: 'DEBIT' | 'CREDIT' }> = [
    { accountNumber: '1000', name: 'Operating Cash', accountType: 'ASSET', normalBalance: 'DEBIT' },
    { accountNumber: '1200', name: 'Accounts Receivable', accountType: 'ASSET', normalBalance: 'DEBIT' },
    { accountNumber: '1500', name: 'Fixed Assets', accountType: 'ASSET', normalBalance: 'DEBIT' },
    { accountNumber: '2000', name: 'Accounts Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT' },
    { accountNumber: '2100', name: 'Payroll Liabilities', accountType: 'LIABILITY', normalBalance: 'CREDIT' },
    { accountNumber: '3000', name: 'Owner Equity / Retained Earnings', accountType: 'EQUITY', normalBalance: 'CREDIT' },
    { accountNumber: '4000', name: 'Service Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT' },
    { accountNumber: '5000', name: 'Cost of Goods Sold', accountType: 'COGS', normalBalance: 'DEBIT' },
    { accountNumber: '6000', name: 'Operating Expenses', accountType: 'EXPENSE', normalBalance: 'DEBIT' },
    { accountNumber: '6100', name: 'Meals & Entertainment', accountType: 'EXPENSE', normalBalance: 'DEBIT' },
    { accountNumber: '6200', name: 'Depreciation Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT' },
  ];
  return defs.map((def) => ({
    id: `coa_${clientId}_${def.accountNumber}`,
    tenantId,
    clientId,
    accountNumber: def.accountNumber,
    name: def.name,
    accountName: def.name,
    accountType: def.accountType,
    normalBalance: def.normalBalance,
    currency: 'USD',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
}
