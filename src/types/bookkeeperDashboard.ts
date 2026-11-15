export interface BookkeeperPeriod {
  id: string;
  name: string;
  status: string;
  start?: string;
  end?: string;
  [key: string]: unknown;
}

export interface BookkeeperTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string | null;
  classification: string;
  source: string;
  reconciliation: string;
  documentCount: number;
  duplicate: string;
  journalEntryId?: string | null;
  ai?: {
    account: string;
    confidence: number;
    reasoning: string;
  } | null;
  [key: string]: unknown;
}

export interface BookkeeperReconciliationException {
  id: string;
  type: string;
  status: string;
  amount: number;
  notes?: string;
  resolution?: string;
  [key: string]: unknown;
}

export interface BookkeeperReconciliation {
  id: string;
  start: string;
  end: string;
  status: string;
  matched: number;
  variance: number;
  exceptions: BookkeeperReconciliationException[];
  [key: string]: unknown;
}

export interface BookkeeperAccount {
  id: string;
  number: string;
  name: string;
  type: string;
  active: boolean;
  [key: string]: unknown;
}

export interface BookkeeperJournalEntry {
  id: string;
  number: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  status: string;
  source: string;
  adjusting: boolean;
  creator: string;
  reviewer?: string | null;
  documentCount: number;
  [key: string]: unknown;
}

export interface BookkeeperSnapshot {
  scope: {
    tenantId: string;
    clientId: string;
    taxYear: number;
    periodId?: string | null;
  };
  periods: BookkeeperPeriod[];
  transactions: BookkeeperTransaction[];
  reconciliations: BookkeeperReconciliation[];
  accounts: BookkeeperAccount[];
  journals: BookkeeperJournalEntry[];
  [key: string]: unknown;
}
