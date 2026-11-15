export interface BookkeeperTransaction {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  classification: string;
  reconciliation: 'RECONCILED' | 'UNRECONCILED' | string;
  duplicate: 'NOT_DUPLICATE' | 'POSSIBLE_DUPLICATE' | 'CONFIRMED_DUPLICATE' | string;
  accountCode?: string;
  [key: string]: any;
}

export interface BookkeeperReconciliation {
  id: string;
  accountName: string;
  period: string;
  status: string;
  exceptions: Array<{
    id: string;
    description?: string;
    type?: string;
    amount?: number;
    status: 'OPEN' | 'RESOLVED' | string;
    notes?: string;
    resolution?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface BookkeeperSnapshot {
  scope: {
    tenantId: string;
    clientId: string;
    taxYear: number;
    periodId?: string;
  };
  periods: Array<{ id: string; label: string; status: string; [key: string]: any }>;
  transactions: BookkeeperTransaction[];
  reconciliations: BookkeeperReconciliation[];
  accounts: Array<{ code: string; name: string; type: string; balanceCents?: number; [key: string]: any }>;
  journals: Array<{ id: string; date: string; memo: string; status: string; [key: string]: any }>;
  [key: string]: any;
}
