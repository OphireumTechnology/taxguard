export class BookkeepingEngine {
  getPeriods(_tenantId: string, _clientId: string, _taxYear: number): any[] {
    return [];
  }

  getChartOfAccounts(_tenantId: string, _clientId: string): any[] {
    return [];
  }

  getJournalEntries(_tenantId: string, _clientId: string, _taxYear: number): any[] {
    return [];
  }

  getTransactions(_tenantId: string, _clientId: string): any[] {
    return [];
  }

  getReconciliations(_tenantId: string, _clientId: string, _taxYear: number): any[] {
    return [];
  }

  [key: string]: any;
}
