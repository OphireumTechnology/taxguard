export interface BookkeeperTransaction {
  id: string;
  date?: string;
  description?: string;
  amount?: number;
  classification: string;
  reconciliation: string;
  duplicate?: string;
  [key: string]: any;
}

export interface BookkeeperException {
  id?: string;
  status: string;
  description?: string;
  [key: string]: any;
}

export interface BookkeeperReconciliation {
  id?: string;
  status?: string;
  exceptions: BookkeeperException[];
  [key: string]: any;
}

export interface BookkeeperSnapshot {
  tenantId?: string;
  transactions: BookkeeperTransaction[];
  reconciliations: BookkeeperReconciliation[];
  [key: string]: any;
}
