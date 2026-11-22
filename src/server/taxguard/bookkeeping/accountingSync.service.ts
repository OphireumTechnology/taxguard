export const globalAccountingSyncService = {
  getSyncState(provider: string, tenantId: string, clientId: string) {
    return {
      provider,
      tenantId,
      clientId,
      status: 'NOT_CONFIGURED',
      writeAuthorized: false,
    };
  },
  async executeReadOnlySync(..._args: unknown[]): Promise<any> {
    throw new Error('ACCOUNTING_SYNC_NOT_CONFIGURED');
  },
  authorizeWriteByClient(..._args: unknown[]): any {
    throw new Error('ACCOUNTING_SYNC_NOT_CONFIGURED');
  },
  prepareWriteByAccountant(..._args: unknown[]): any {
    throw new Error('ACCOUNTING_SYNC_NOT_CONFIGURED');
  },
  approveWriteByReviewer(..._args: unknown[]): any {
    throw new Error('ACCOUNTING_SYNC_NOT_CONFIGURED');
  },
  confirmWriteExplicitly(..._args: unknown[]): any {
    throw new Error('ACCOUNTING_SYNC_NOT_CONFIGURED');
  },
  async executeWriteBack(..._args: unknown[]): Promise<any> {
    throw new Error('ACCOUNTING_SYNC_NOT_CONFIGURED');
  },
};
