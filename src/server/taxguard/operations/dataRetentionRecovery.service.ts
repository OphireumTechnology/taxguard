class DataRetentionRecoveryService {
  private policies = new Map<string, any>();

  getRetentionPolicies(tenantId?: string): any[] {
    return Array.from(this.policies.values()).filter((p) => !tenantId || p.tenantId === tenantId);
  }

  setLegalHold(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_RETENTION_STORE_REQUIRED'), {
      code: 'DURABLE_RETENTION_STORE_REQUIRED',
      status: 503,
    });
  }

  verifyArchiveManifest(..._args: any[]): any {
    return {
      verified: false,
      status: 'UNAVAILABLE',
      reason: 'Durable archive verification store is not configured.',
    };
  }

  executeAnnualRollover(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_RETENTION_STORE_REQUIRED'), {
      code: 'DURABLE_RETENTION_STORE_REQUIRED',
      status: 503,
    });
  }
}

export const globalDataRetentionRecoveryService = new DataRetentionRecoveryService();
