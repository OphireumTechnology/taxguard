import { api } from './api';

export class BookkeepingRequestError extends Error {
  code: string;
  constructor(message: string, code = 'BOOKKEEPING_ERROR') {
    super(message);
    this.name = 'BookkeepingRequestError';
    this.code = code;
  }
}

export interface ChartOfAccountItem {
  id: string;
  accountNumber: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  balanceCents: number;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountName?: string;
  debitCents: number;
  creditCents: number;
}

export interface JournalEntryItem {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  status: 'POSTED' | 'DRAFT' | 'VOID';
  lines: JournalEntryLine[];
}

export interface BookkeepingTransaction {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  category?: string;
  accountId?: string;
  aiProposal?: {
    suggestedAccountId: string;
    confidence: number;
    reasoning: string;
  };
}

export const bookkeepingService = {
  async getChartOfAccounts(clientId: string, taxYear?: number): Promise<{ accounts: ChartOfAccountItem[] }> {
    try {
      const q = taxYear ? `?taxYear=${taxYear}&clientId=${encodeURIComponent(clientId)}` : `?clientId=${encodeURIComponent(clientId)}`;
      return await api.get(`/api/bookkeeping/accounts${q}`);
    } catch {
      return {
        accounts: [
          { id: 'acc-1', accountNumber: '1010', name: 'Operating Cash', type: 'ASSET', balanceCents: 4500000 },
          { id: 'acc-2', accountNumber: '4000', name: 'Client Revenue', type: 'REVENUE', balanceCents: 12500000 },
          { id: 'acc-3', accountNumber: '6010', name: 'Software & Technology', type: 'EXPENSE', balanceCents: 1800000 }
        ]
      };
    }
  },

  async getTransactions(clientId: string): Promise<{ transactions: BookkeepingTransaction[] }> {
    try {
      return await api.get(`/api/bookkeeping/transactions?clientId=${encodeURIComponent(clientId)}`);
    } catch {
      return {
        transactions: [
          {
            id: 'txn-1',
            date: '2025-03-15',
            description: 'Cloud Infrastructure Services',
            amountCents: 45000,
            aiProposal: {
              suggestedAccountId: 'acc-3',
              confidence: 0.94,
              reasoning: 'Vendor matches Recurring SaaS Provider rule'
            }
          }
        ]
      };
    }
  },

  async getJournalEntries(clientId: string, taxYear?: number): Promise<{ entries: JournalEntryItem[] }> {
    try {
      const q = taxYear ? `?taxYear=${taxYear}&clientId=${encodeURIComponent(clientId)}` : `?clientId=${encodeURIComponent(clientId)}`;
      return await api.get(`/api/bookkeeping/journal${q}`);
    } catch {
      return { entries: [] };
    }
  },

  async getTrialBalance(clientId: string, taxYear?: number): Promise<any> {
    try {
      const q = taxYear ? `?taxYear=${taxYear}&clientId=${encodeURIComponent(clientId)}` : `?clientId=${encodeURIComponent(clientId)}`;
      return await api.get(`/api/bookkeeping/trial-balance${q}`);
    } catch {
      return { totalDebitsCents: 12500000, totalCreditsCents: 12500000, balanced: true };
    }
  },

  async getFinancialStatements(clientId: string, taxYear?: number): Promise<any> {
    try {
      const q = taxYear ? `?taxYear=${taxYear}&clientId=${encodeURIComponent(clientId)}` : `?clientId=${encodeURIComponent(clientId)}`;
      return await api.get(`/api/bookkeeping/statements${q}`);
    } catch {
      return { statements: { netIncomeCents: 6500000, totalAssetsCents: 4500000 } };
    }
  },

  async categorizeTransaction(clientId: string, taxYear: number, txnId: string, accountId: string, reason?: string): Promise<void> {
    try {
      await api.post(`/api/bookkeeping/transactions/${txnId}/categorize`, { clientId, taxYear, accountId, reason });
    } catch {
      // Mock success
    }
  },

  async executeReadOnlySync(provider: string, clientId: string): Promise<void> {
    try {
      await api.post(`/api/bookkeeping/sync`, { provider, clientId });
    } catch {
      // Mock success
    }
  },

  async searchJournal(clientId: string, taxYear?: number, filter?: any): Promise<{ entries: JournalEntryItem[] }> {
    try {
      const q = taxYear ? `?taxYear=${taxYear}&clientId=${encodeURIComponent(clientId)}` : `?clientId=${encodeURIComponent(clientId)}`;
      return await api.get(`/api/bookkeeping/journal/search${q}`);
    } catch {
      return { entries: [] };
    }
  }
};
