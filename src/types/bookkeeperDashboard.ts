/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BookkeeperTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  classification: string;
  reconciliation: string;
  duplicate: string;
}

export interface BookkeeperReconciliationException {
  id: string;
  status: string;
  description?: string;
}

export interface BookkeeperReconciliation {
  id: string;
  accountName: string;
  period: string;
  exceptions: BookkeeperReconciliationException[];
}

export interface BookkeeperSnapshot {
  transactions: BookkeeperTransaction[];
  reconciliations: BookkeeperReconciliation[];
}
