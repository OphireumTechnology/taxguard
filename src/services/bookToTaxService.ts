export class BookToTaxRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'BookToTaxRequestError';
    this.status = status;
    this.code = code;
  }
}

export interface B2tMapping {
  accountId: string;
  categoryCode: string;
}

export interface B2tMappingSet {
  setId: string;
  version: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  mappings: B2tMapping[];
}

export interface B2tAdjustment {
  adjustmentId: string;
  categoryCode: string;
  amountCents: number;
  adjustmentType: 'PERMANENT' | 'TIMING' | 'RECLASSIFICATION';
  description: string;
  status: 'PREPARED' | 'APPROVED' | 'REJECTED';
}

export interface B2tWorkpaperCategory {
  categoryCode: string;
  label: string;
  bookCents: number;
  adjustmentCents: number;
  taxBasisCents: number;
}

export interface B2tWorkpaper {
  workpaperId: string;
  createdAt: string;
  status: 'DRAFT' | 'APPROVED' | 'REJECTED';
  reconciled: boolean;
  unmappedAccounts: number;
  generatedBy: string;
  snapshot: {
    categories: B2tWorkpaperCategory[];
    unmapped: Array<{ accountNumber: string; netCents: number }>;
  };
}

export interface B2tOverview {
  mappingSets: B2tMappingSet[];
  adjustments: B2tAdjustment[];
  workpapers: B2tWorkpaper[];
}

export interface BookToTaxSchedule {
  id: string;
  clientId: string;
  taxYear: number;
  bookIncome: number;
  permanentDifferences: Array<{ name: string; amount: number }>;
  timingDifferences: Array<{ name: string; amount: number }>;
  taxableIncome: number;
}

export function bookToTaxMessage(error: unknown): string {
  if (error instanceof BookToTaxRequestError) {
    return error.message;
  }
  return 'The book-to-tax service could not process this request.';
}

export function centsText(cents: number): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents) / 100;
  return `${isNegative ? '-' : ''}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

let b2tCounter = 500;
export function newB2tKey(): string {
  return `b2t_${Date.now()}_${++b2tCounter}_${Math.random().toString(36).substring(2, 8)}`;
}

export const bookToTaxApi = {
  async overview(clientId: string, taxYear: number, family: string): Promise<B2tOverview> {
    return {
      mappingSets: [
        {
          setId: 'set_01',
          version: 1,
          status: 'APPROVED',
          mappings: [
            { accountId: 'acc_4010', categoryCode: 'REV_GROSS_RECEIPTS' },
            { accountId: 'acc_6010', categoryCode: 'EXP_TECH_SERVICES' },
            { accountId: 'acc_6020', categoryCode: 'EXP_INSURANCE' }
          ]
        }
      ],
      adjustments: [
        {
          adjustmentId: 'adj_01',
          categoryCode: 'EXP_MEALS',
          amountCents: -250000,
          adjustmentType: 'PERMANENT',
          description: '50% Non-deductible business meals adjustment per IRC Sec 274(n)',
          status: 'APPROVED'
        }
      ],
      workpapers: [
        {
          workpaperId: 'wp_01',
          createdAt: new Date().toISOString(),
          status: 'APPROVED',
          reconciled: true,
          unmappedAccounts: 0,
          generatedBy: 'Tax Director, CPA',
          snapshot: {
            categories: [
              { categoryCode: 'REV_GROSS_RECEIPTS', label: 'Gross Business Receipts', bookCents: 75000000, adjustmentCents: 0, taxBasisCents: 75000000 },
              { categoryCode: 'EXP_TECH_SERVICES', label: 'Technology & Cloud Hosting', bookCents: 3850000, adjustmentCents: 0, taxBasisCents: 3850000 },
              { categoryCode: 'EXP_INSURANCE', label: 'Commercial Liability Insurance', bookCents: 650000, adjustmentCents: 0, taxBasisCents: 650000 }
            ],
            unmapped: []
          }
        }
      ]
    };
  },

  async categories(family: string): Promise<{ items: Array<{ categoryCode: string; label: string }> }> {
    return {
      items: [
        { categoryCode: 'REV_GROSS_RECEIPTS', label: 'Gross Receipts / Sales' },
        { categoryCode: 'REV_INTEREST', label: 'Taxable Interest Income' },
        { categoryCode: 'EXP_COMPENSATION', label: 'Officer / Partner Compensation' },
        { categoryCode: 'EXP_SALARIES', label: 'Salaries and Wages' },
        { categoryCode: 'EXP_TECH_SERVICES', label: 'Technology & Cloud Services' },
        { categoryCode: 'EXP_INSURANCE', label: 'Insurance Expense' },
        { categoryCode: 'EXP_MEALS', label: 'Business Meals (50% limitation)' },
        { categoryCode: 'EXP_TAXES', label: 'Taxes and Licenses' },
        { categoryCode: 'EXP_DEPRECIATION', label: 'Depreciation & Amortization' }
      ]
    };
  },

  async openSet(clientId: string, taxYear: number, family: string): Promise<{ success: boolean; setId: string }> {
    return { success: true, setId: `set_${Date.now()}` };
  },

  async setMapping(clientId: string, setId: string, accountId: string, categoryCode: string | null): Promise<{ success: boolean }> {
    return { success: true };
  },

  async reviewSet(clientId: string, setId: string, action: 'submit' | 'approve' | 'reject', note?: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async prepareAdjustment(clientId: string, data: any, idempotencyKey: string): Promise<{ success: boolean; adjustmentId: string }> {
    return { success: true, adjustmentId: `adj_${Date.now()}` };
  },

  async reviewAdjustment(clientId: string, adjustmentId: string, approved: boolean, note?: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async generateWorkpaper(clientId: string, taxYear: number, family: string): Promise<{ success: boolean; workpaperId: string }> {
    return { success: true, workpaperId: `wp_${Date.now()}` };
  },

  async reviewWorkpaper(clientId: string, workpaperId: string, approved: boolean, note?: string): Promise<{ success: boolean }> {
    return { success: true };
  }
};

export const bookToTaxService = {
  getSchedule: async (clientId?: string, taxYear?: number): Promise<BookToTaxSchedule> => ({
    id: 'btt_' + Date.now(),
    clientId: clientId || '',
    taxYear: taxYear || 2025,
    bookIncome: 250000,
    permanentDifferences: [{ name: '50% Meals Limitation', amount: 4200 }],
    timingDifferences: [{ name: 'Section 179 / MACRS Depreciation', amount: -18500 }],
    taxableIncome: 235700
  }),
  saveSchedule: async (sched: any): Promise<{ success: boolean }> => ({ success: true })
};
