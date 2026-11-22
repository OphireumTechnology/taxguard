export class SqlLedgerStore {
  constructor(_client?: any, _tenantId?: string) {}
  async read(..._args: any[]): Promise<any> {
    return { accounts: [], periods: [], transactions: [], journals: [], reconciliations: [] };
  }
  async listClients() {
    return [];
  }
  async listWorkQueue() {
    return [];
  }
  async getSnapshot(_clientId?: string) {
    return { assignedClients: [], workQueue: [], reconciliations: [], exceptions: [] };
  }
}
