export class BookkeepingEngine {
  static getClientSummary(_clientId: string) {
    return {
      accountsCount: 0,
      unreconciledCount: 0,
      openExceptionsCount: 0,
      lastReconciledAt: null,
    };
  }
  static listWorkQueue() {
    return [];
  }
  [key: string]: any;
}
