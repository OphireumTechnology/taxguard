export interface BookkeeperSnapshot {
  assignedClients?: any[];
  workQueue?: any[];
  reconciliations?: any[];
  exceptions?: any[];
  summary?: Record<string, any>;
  generatedAt?: string;
  [key: string]: any;
}
