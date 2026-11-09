export interface BookkeeperTransaction {
  id: string;
  date?: string;
  description?: string;
  amount?: number;
  classification: 'ACCOUNTANT_APPROVED' | 'POSTED' | 'REJECTED' | string;
  reconciliation: 'RECONCILED' | 'UNRECONCILED' | string;
  duplicate: 'NOT_DUPLICATE' | string;
  account?: string;
  category?: string;
}

export interface BookkeeperReconciliationException {
  id: string;
  status: 'RESOLVED' | string;
  description?: string;
}

export interface BookkeeperReconciliation {
  id: string;
  period?: string;
  exceptions: BookkeeperReconciliationException[];
  status?: string;
}

export interface BookkeeperSnapshot {
  transactions: BookkeeperTransaction[];
  reconciliations: BookkeeperReconciliation[];
}
