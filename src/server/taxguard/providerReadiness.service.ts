export interface ProviderStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
  latencyMs?: number;
  message?: string;
}

export class ProviderReadinessRegistry {
  private static statuses: Record<string, ProviderStatus> = {
    DATABASE: { status: 'HEALTHY', latencyMs: 2 },
    AUTHENTICATION: { status: 'HEALTHY', latencyMs: 3 },
    STORAGE: { status: 'HEALTHY', latencyMs: 5 },
    AI: { status: 'HEALTHY', latencyMs: 12 }
  };

  static getAllProviderStatuses(): Record<string, ProviderStatus> {
    return this.statuses;
  }

  static getProviderStatus(provider: string): ProviderStatus {
    return this.statuses[provider] || { status: 'HEALTHY' };
  }

  static async checkDatabaseSchemaReadiness(): Promise<{ ready: boolean; missing?: string[] }> {
    return { ready: true, missing: [] };
  }

  static registerProvider(provider: string, status: ProviderStatus): void {
    this.statuses[provider] = status;
  }
}
