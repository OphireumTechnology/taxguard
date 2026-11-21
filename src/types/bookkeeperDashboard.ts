export interface BookkeeperTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountCode?: string;
  accountName?: string;
  classification: string;
  reconciliation: string;
  duplicate: string;
  clientId?: string;
  clientName?: string;
  [key: string]: any;
}

export interface BookkeeperReconciliationException {
  id: string;
  status: string;
  reason?: string;
  amount?: number;
  [key: string]: any;
}

export interface BookkeeperReconciliation {
  id: string;
  accountName?: string;
  period?: string;
  status: string;
  exceptions: BookkeeperReconciliationException[];
  [key: string]: any;
}

export interface BookkeeperSnapshot {
  tenantId?: string;
  transactions: BookkeeperTransaction[];
  reconciliations: BookkeeperReconciliation[];
  accounts: Array<{
    id: string;
    code?: string;
    number?: string;
    name: string;
    type: string;
    active?: boolean;
    balance?: number;
    [key: string]: any;
  }>;
  journals?: Array<{
    id: string;
    number?: string;
    date?: string;
    description?: string;
    debit?: number;
    credit?: number;
    status?: string;
    source?: string;
    adjusting?: boolean;
    creator?: string;
    reviewer?: string;
    documentCount?: number;
    [key: string]: any;
  }>;
  auditTrail?: Array<{ id: string; action: string; timestamp: string; actor?: string; [key: string]: any }>;
  clients?: Array<{ id: string; name: string; [key: string]: any }>;
  [key: string]: any;
}
