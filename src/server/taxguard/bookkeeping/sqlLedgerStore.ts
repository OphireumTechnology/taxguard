export class SqlLedgerStore {
  constructor(private readonly _client?: any) {}

  async listAccounts(_tenantId: string, _clientId: string): Promise<any[]> {
    return [];
  }

  async listPeriods(_tenantId: string, _clientId: string, _taxYear: number): Promise<any[]> {
    return [];
  }

  async listJournalEntries(_tenantId: string, _clientId: string, _taxYear: number): Promise<any[]> {
    return [];
  }

  async listTransactions(_tenantId: string, _clientId: string): Promise<any[]> {
    return [];
  }

  async listReconciliations(_tenantId: string, _clientId: string, _taxYear: number): Promise<any[]> {
    return [];
  }

  [key: string]: any;
}
