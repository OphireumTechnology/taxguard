import { ChartOfAccount } from './types';

export function generateStandardChartOfAccounts(
  tenantId: string,
  clientId: string,
  entityType: '1040_SCHED_C' | '1065' | '1120S' | '1120' = '1040_SCHED_C',
  creatorUid = 'system'
): ChartOfAccount[] {
  const now = new Date().toISOString();
  const rawAccounts: Array<{
    num: string;
    name: string;
    type: ChartOfAccount['accountType'];
    subtype: ChartOfAccount['accountSubtype'];
    taxCode: string;
    taxDesc: string;
    isSubjectToLimitation?: boolean;
    limitationPercentage?: number;
  }> = [
    // 1000 - Assets
    { num: '1010', name: 'Operating Checking Account', type: 'ASSET', subtype: 'CASH_AND_EQUIVALENTS', taxCode: 'CASH', taxDesc: 'Cash on Hand and in Banks' },
    { num: '1020', name: 'Business Savings / Money Market', type: 'ASSET', subtype: 'CASH_AND_EQUIVALENTS', taxCode: 'CASH', taxDesc: 'Savings and Deposits' },
    { num: '1200', name: 'Accounts Receivable', type: 'ASSET', subtype: 'ACCOUNTS_RECEIVABLE', taxCode: 'AR', taxDesc: 'Trade Accounts Receivable' },
    { num: '1300', name: 'Prepaid Expenses', type: 'ASSET', subtype: 'PREPAID_EXPENSES', taxCode: 'PREPAID', taxDesc: 'Prepaid Expenses' },
    { num: '1500', name: 'Machinery & Equipment', type: 'ASSET', subtype: 'FIXED_ASSETS', taxCode: 'FIXED_ASSET', taxDesc: 'Depreciable Business Property' },
    { num: '1590', name: 'Accumulated Depreciation', type: 'ASSET', subtype: 'ACCUMULATED_DEPRECIATION', taxCode: 'ACCUM_DEP', taxDesc: 'Accumulated Depreciation Allowance' },

    // 2000 - Liabilities
    { num: '2010', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'ACCOUNTS_PAYABLE', taxCode: 'AP', taxDesc: 'Trade Accounts Payable' },
    { num: '2050', name: 'Business Credit Card', type: 'LIABILITY', subtype: 'CREDIT_CARD', taxCode: 'CREDIT_CARD', taxDesc: 'Credit Card Payables' },
    { num: '2100', name: 'Payroll Tax Liabilities', type: 'LIABILITY', subtype: 'PAYROLL_LIABILITIES', taxCode: 'PAYROLL_TAX_LIAB', taxDesc: 'Accrued Payroll Taxes' },
    { num: '2500', name: 'Bank Term Loan Payable', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITIES', taxCode: 'NOTES_PAYABLE', taxDesc: 'Mortgages, Notes, Bonds Payable' },

    // 3000 - Equity
    { num: '3010', name: "Owner's Capital / Member Contributions", type: 'EQUITY', subtype: 'OWNERS_CAPITAL', taxCode: 'CAPITAL', taxDesc: "Owner's Capital Contribution" },
    { num: '3020', name: "Owner's Draws / Distributions", type: 'EQUITY', subtype: 'OWNERS_DISTRIBUTION', taxCode: 'DISTRIBUTIONS', taxDesc: "Owner's Non-Dividend Draws" },
    { num: '3900', name: 'Retained Earnings', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', taxCode: 'RETAINED_EARNINGS', taxDesc: 'Accumulated Retained Earnings' },

    // 4000 - Revenue
    { num: '4010', name: 'Gross Professional Fees / Receipts', type: 'REVENUE', subtype: 'SERVICE_REVENUE', taxCode: 'GROSS_RECEIPTS', taxDesc: 'Gross Receipts or Sales' },
    { num: '4020', name: 'Product Sales', type: 'REVENUE', subtype: 'OPERATING_REVENUE', taxCode: 'PRODUCT_SALES', taxDesc: 'Gross Product Sales' },
    { num: '4090', name: 'Returns & Allowances', type: 'REVENUE', subtype: 'OPERATING_REVENUE', taxCode: 'RETURNS_ALLOWANCES', taxDesc: 'Returns and Allowances' },

    // 5000 - Cost of Goods Sold
    { num: '5010', name: 'Cost of Goods Sold - Direct Labor', type: 'COGS', subtype: 'COST_OF_GOODS_SOLD', taxCode: 'COGS_LABOR', taxDesc: 'Direct Cost of Labor' },
    { num: '5020', name: 'Cost of Goods Sold - Materials & Supplies', type: 'COGS', subtype: 'COST_OF_GOODS_SOLD', taxCode: 'COGS_MATERIALS', taxDesc: 'Materials and Supplies Purchased' },

    // 6000 - Operating Expenses
    { num: '6010', name: 'Advertising & Marketing', type: 'EXPENSE', subtype: 'ADVERTISING_EXPENSES', taxCode: 'EXP_ADVERTISING', taxDesc: 'Advertising and Promotion' },
    { num: '6020', name: 'Wages & Compensation', type: 'EXPENSE', subtype: 'PAYROLL_EXPENSES', taxCode: 'EXP_WAGES', taxDesc: 'Employee Wages and Salaries' },
    { num: '6030', name: 'Rent on Business Property', type: 'EXPENSE', subtype: 'RENT_EXPENSES', taxCode: 'EXP_RENT', taxDesc: 'Rent on Machinery, Equipment, and Real Estate' },
    { num: '6040', name: 'Utilities & Internet', type: 'EXPENSE', subtype: 'UTILITIES_EXPENSES', taxCode: 'EXP_UTILITIES', taxDesc: 'Commercial Utilities' },
    { num: '6050', name: 'Legal & Professional Services', type: 'EXPENSE', subtype: 'PROFESSIONAL_LEGAL_EXPENSES', taxCode: 'EXP_LEGAL_PROF', taxDesc: 'Legal and Accounting Fees' },
    { num: '6060', name: 'Business Insurance', type: 'EXPENSE', subtype: 'INSURANCE_EXPENSES', taxCode: 'EXP_INSURANCE', taxDesc: 'Commercial Liability and Property Insurance' },
    { num: '6070', name: 'Office Supplies & Software', type: 'EXPENSE', subtype: 'OFFICE_SUPPLIES', taxCode: 'EXP_OFFICE', taxDesc: 'Office Expenses and SaaS Subscriptions' },
    {
      num: '6080',
      name: 'Business Meals (50% Subject to Limitation)',
      type: 'EXPENSE',
      subtype: 'TRAVEL_MEALS_EXPENSES',
      taxCode: 'EXP_MEALS_50',
      taxDesc: 'Client Business Meals (IRC Sec. 274(n) 50% Limitation)',
      isSubjectToLimitation: true,
      limitationPercentage: 50,
    },
    { num: '6090', name: 'Depreciation Expense', type: 'EXPENSE', subtype: 'DEPRECIATION_EXPENSE', taxCode: 'EXP_DEPRECIATION', taxDesc: 'Depreciation and Section 179 Expense' },
    { num: '6100', name: 'Interest on Business Indebtedness', type: 'EXPENSE', subtype: 'INTEREST_EXPENSE', taxCode: 'EXP_INTEREST', taxDesc: 'Mortgage and Business Loan Interest' },
    { num: '6190', name: 'Miscellaneous Operating Expenses', type: 'EXPENSE', subtype: 'OTHER_OPERATING_EXPENSE', taxCode: 'EXP_OTHER', taxDesc: 'Other Miscellaneous Allowable Expenses' },

    // 7000 / 8000 - Other Income & Expense
    { num: '7010', name: 'Interest & Dividend Income', type: 'OTHER_INCOME', subtype: 'INTEREST_INCOME', taxCode: 'OTHER_INC_INTEREST', taxDesc: 'Taxable Interest and Dividends' },
    { num: '8010', name: 'Non-Deductible Penalties & Fines', type: 'OTHER_EXPENSE', subtype: 'OTHER_OPERATING_EXPENSE', taxCode: 'NON_DEDUCTIBLE_PENALTIES', taxDesc: 'Government Fines and Non-Deductible Penalties', isSubjectToLimitation: true, limitationPercentage: 0 },
  ];

  return rawAccounts.map((a, idx) => ({
    id: `coa_${tenantId}_${clientId}_${a.num}`,
    tenantId,
    clientId,
    accountNumber: a.num,
    accountName: a.name,
    accountType: a.type,
    accountSubtype: a.subtype,
    currency: 'USD',
    isActive: true,
    taxMapping: {
      formTarget: entityType,
      taxLineCode: a.taxCode,
      taxLineDescription: a.taxDesc,
      isSubjectToLimitation: a.isSubjectToLimitation,
      limitationPercentage: a.limitationPercentage,
    },
    createdAt: now,
    updatedAt: now,
    provenance: {
      source: 'SYSTEM_BOOTSTRAP',
      creatorUid,
    },
  }));
}
