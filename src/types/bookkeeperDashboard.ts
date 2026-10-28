export interface BookkeeperTransaction {
  id: string;
  classification: string;
  reconciliation: string;
  duplicate?: string;
  description?: string;
  amount?: number;
  date?: string;
}

export interface BookkeeperReconciliation {
  id: string;
  exceptions: Array<{ id: string; status: string }>;
}

export interface BookkeeperSnapshot {
  transactions: BookkeeperTransaction[];
  reconciliations: BookkeeperReconciliation[];
  accounts?: any[];
  reports?: any[];
}
