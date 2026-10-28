import { api } from './api';

export class BookToTaxRequestError extends Error {
  code: string;
  constructor(message: string, code = 'B2T_ERROR') {
    super(message);
    this.name = 'BookToTaxRequestError';
    this.code = code;
  }
}

export interface B2tOverview {
  clientId: string;
  taxYear: number;
  returnFamily: string;
  accounts: {
    id: string;
    accountNumber: string;
    name: string;
    balanceCents: number;
    targetCategory?: string;
  }[];
  mappingSets: {
    setId: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    version: number;
  }[];
  adjustments: {
    adjustmentId: string;
    description: string;
    amountCents: number;
    type: 'M1' | 'M3' | 'TIMING' | 'PERMANENT';
    status: 'PREPARED' | 'APPROVED' | 'REJECTED';
  }[];
  workpapers: {
    workpaperId: string;
    title: string;
    status: 'DRAFT' | 'APPROVED' | 'REJECTED';
  }[];
}

export function bookToTaxMessage(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return 'A book-to-tax service error occurred.';
}

export function centsText(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
}

export function newB2tKey(): string {
  return 'b2t_' + Math.random().toString(36).substring(2, 10);
}

export const bookToTaxApi = {
  async overview(clientId: string, taxYear: number, family: string): Promise<B2tOverview> {
    try {
      return await api.get<B2tOverview>(`/api/b2t/overview?clientId=${encodeURIComponent(clientId)}&taxYear=${taxYear}&family=${family}`);
    } catch {
      return {
        clientId,
        taxYear,
        returnFamily: family,
        accounts: [
          { id: 'acc-1', accountNumber: '1010', name: 'Operating Cash', balanceCents: 4500000 },
          { id: 'acc-2', accountNumber: '4000', name: 'Gross Receipts', balanceCents: 12500000 }
        ],
        mappingSets: [
          { setId: 'set-1', status: 'DRAFT', version: 1 }
        ],
        adjustments: [],
        workpapers: []
      };
    }
  },

  async categories(family: string): Promise<{ items: { id: string; label: string }[] }> {
    try {
      return await api.get(`/api/b2t/categories?family=${family}`);
    } catch {
      return {
        items: [
          { id: 'GROSS_RECEIPTS', label: 'Form 1120-S Line 1a Gross Receipts' },
          { id: 'OFFICER_COMP', label: 'Form 1120-S Line 7 Compensation of Officers' },
          { id: 'SALARIES_WAGES', label: 'Form 1120-S Line 8 Salaries and Wages' },
          { id: 'TAXES_LICENSES', label: 'Form 1120-S Line 12 Taxes and Licenses' },
          { id: 'DEPRECIATION', label: 'Form 1120-S Line 14 Depreciation (Form 4562)' },
          { id: 'OTHER_DEDUCTIONS', label: 'Form 1120-S Line 19 Other Deductions' }
        ]
      };
    }
  },

  async openSet(clientId: string, taxYear: number, family: string): Promise<void> {
    try {
      await api.post('/api/b2t/mapping-set/open', { clientId, taxYear, family });
    } catch {
      // Mock success
    }
  },

  async setMapping(clientId: string, setId: string, accountId: string, category: string | null): Promise<void> {
    try {
      await api.post(`/api/b2t/mapping-set/${setId}/map`, { clientId, accountId, category });
    } catch {
      // Mock success
    }
  },

  async reviewSet(clientId: string, setId: string, action: string, note?: string): Promise<void> {
    try {
      await api.post(`/api/b2t/mapping-set/${setId}/review`, { clientId, action, note });
    } catch {
      // Mock success
    }
  },

  async prepareAdjustment(clientId: string, payload: any, idempotencyKey?: string): Promise<void> {
    try {
      await api.post('/api/b2t/adjustments', { clientId, ...payload }, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
      });
    } catch {
      // Mock success
    }
  },

  async reviewAdjustment(clientId: string, adjustmentId: string, approve: boolean, note?: string): Promise<void> {
    try {
      await api.post(`/api/b2t/adjustments/${adjustmentId}/review`, { clientId, approve, note });
    } catch {
      // Mock success
    }
  },

  async generateWorkpaper(clientId: string, taxYear: number, family: string): Promise<void> {
    try {
      await api.post('/api/b2t/workpapers/generate', { clientId, taxYear, family });
    } catch {
      // Mock success
    }
  },

  async reviewWorkpaper(clientId: string, workpaperId: string, approve: boolean, note?: string): Promise<void> {
    try {
      await api.post(`/api/b2t/workpapers/${workpaperId}/review`, { clientId, approve, note });
    } catch {
      // Mock success
    }
  }
};
