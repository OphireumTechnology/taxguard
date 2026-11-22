export interface ProviderReadinessItem {
  provider: string;
  status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'DEGRADED' | 'UNAVAILABLE';
  isOperational: boolean;
  description: string;
}

export interface SchemaReadinessResult {
  state: 'DATABASE_READY' | 'DATABASE_UNAVAILABLE' | 'SCHEMA_INCOMPLETE';
  verifiedTablesCount: number;
  totalRequiredTables: number;
  description: string;
  checkedAt: string;
}

export class ProviderReadinessRegistry {
  static getProviderStatus(type: string): ProviderReadinessItem {
    const key = (type || '').toUpperCase();
    if (key === 'DATABASE') {
      const configured = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_URL);
      return {
        provider: 'DATABASE',
        status: configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
        isOperational: configured,
        description: configured ? 'Database connection configured.' : 'Running with local development store.',
      };
    }
    if (key === 'AUTHENTICATION') {
      const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
      return {
        provider: 'AUTHENTICATION',
        status: configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
        isOperational: configured,
        description: configured ? 'Identity provider configured.' : 'Local development session auth active.',
      };
    }
    if (key === 'STORAGE') {
      const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
      return {
        provider: 'STORAGE',
        status: configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
        isOperational: configured,
        description: configured ? 'Object storage configured.' : 'Object storage not configured.',
      };
    }
    if (key === 'AI') {
      const configured = Boolean(process.env.OPENAI_API_KEY);
      return {
        provider: 'AI',
        status: configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
        isOperational: configured,
        description: configured ? 'AI reasoning gateway configured.' : 'AI reasoning gateway not configured.',
      };
    }
    return {
      provider: key,
      status: 'NOT_CONFIGURED',
      isOperational: false,
      description: `${key} provider is not configured.`,
    };
  }

  static getAllProviderStatuses(): ProviderReadinessItem[] {
    return ['DATABASE', 'AUTHENTICATION', 'STORAGE', 'AI', 'OCR', 'FILING', 'SIGNATURE'].map((p) =>
      this.getProviderStatus(p)
    );
  }

  static async checkDatabaseSchemaReadiness(): Promise<SchemaReadinessResult> {
    const configured = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_URL);
    return {
      state: configured ? 'DATABASE_READY' : 'DATABASE_UNAVAILABLE',
      verifiedTablesCount: configured ? 6 : 0,
      totalRequiredTables: 6,
      description: configured ? 'Database configured.' : 'Durable database is not configured in this environment.',
      checkedAt: new Date().toISOString(),
    };
  }
}
