export interface BookkeeperTransaction {
  id: string;
  date?: string;
  description?: string;
  amountCents?: number;
  classification: string;
  reconciliation: string;
  duplicate: string;
  accountId?: string;
  [key: string]: any;
}

export interface BookkeeperReconciliation {
  id: string;
  accountName?: string;
  period?: string;
  status?: string;
  exceptions: Array<{ id: string; status: string; description?: string; [key: string]: any }>;
  [key: string]: any;
}

export interface BookkeeperSnapshot {
  transactions: BookkeeperTransaction[];
  reconciliations: BookkeeperReconciliation[];
  accounts?: Array<Record<string, any>>;
  reports?: Array<Record<string, any>>;
  auditTrail?: Array<Record<string, any>>;
  [key: string]: any;
}
