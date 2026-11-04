export interface BookkeeperSnapshot {
  totalClients: number;
  unreconciledTransactionsCount: number;
  pendingPeriodCloses: number;
  activeFeedsCount: number;
  clients: Array<{
    id: string;
    name: string;
    companyName: string;
    syncStatus: string;
    unreconciledCount: number;
    lastSyncedAt: string;
  }>;
}
