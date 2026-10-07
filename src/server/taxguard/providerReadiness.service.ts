/**
 * TaxGuard Provider Readiness Registry
 * Truthfully evaluates external provider statuses without exposing secrets.
 *
 * Tracks all 10 canonical infrastructure and service providers:
 * DATABASE, AUTHENTICATION, STORAGE, MALWARE_SCANNER, OCR, AI,
 * E_SIGNATURE, FILING, QUICKBOOKS, XERO.
 */

import {
  ProviderType,
  ProviderReadinessInfo,
  ProviderReadinessStatus,
} from './persistence.types';

export type DatabaseSchemaReadinessState =
  | 'DATABASE_UNAVAILABLE'
  | 'DATABASE_REACHABLE'
  | 'DATABASE_SCHEMA_INCOMPLETE'
  | 'DATABASE_MIGRATION_REQUIRED'
  | 'DATABASE_READY';

export interface DatabaseSchemaReadinessResult {
  state: DatabaseSchemaReadinessState;
  verifiedTablesCount: number;
  totalRequiredTables: number;
  description: string;
  checkedAt: string;
}

export class ProviderReadinessRegistry {
  private static mockOverrideStatuses?: Partial<Record<ProviderType, ProviderReadinessStatus>>;
  private static mockSchemaReadinessOverride?: DatabaseSchemaReadinessResult;

  /** Set testing overrides (for unit tests only) */
  static setTestingOverrides(
    overrides?: Partial<Record<ProviderType, ProviderReadinessStatus>>,
    schemaOverride?: DatabaseSchemaReadinessResult
  ) {
    this.mockOverrideStatuses = overrides;
    this.mockSchemaReadinessOverride = schemaOverride;
  }

  static getProviderStatus(type: ProviderType): ProviderReadinessInfo {
    if (type === 'MALWARE_SCANNER' && process.env.NODE_ENV === 'production') {
      return {
        provider: type,
        status: 'NOT_CONFIGURED',
        description: 'No verified production malware scanner transport is installed. Documents remain quarantined.',
        isOperational: false,
        lastChecked: new Date().toISOString(),
      };
    }

    if (this.mockOverrideStatuses && this.mockOverrideStatuses[type]) {
      const status = this.mockOverrideStatuses[type]!;
      return {
        provider: type,
        status,
        description: `Provider state overridden for verification: ${status}`,
        isOperational: status === 'CONFIGURED',
        lastChecked: new Date().toISOString(),
      };
    }

    switch (type) {
      case 'DATABASE': {
        const hasSupabase = Boolean(
          process.env.SUPABASE_URL &&
          (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
        );
        const status: ProviderReadinessStatus = hasSupabase ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'DATABASE',
          status,
          description: hasSupabase
            ? 'PostgreSQL / Supabase production database is provisioned and active.'
            : 'Production relational database is not configured.',
          isOperational: hasSupabase,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'AUTHENTICATION': {
        const hasAuth = Boolean(
          process.env.SUPABASE_URL &&
          (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
        );
        const status: ProviderReadinessStatus = hasAuth ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'AUTHENTICATION',
          status,
          description: hasAuth
            ? 'Supabase Authentication & JWT Token Verification active.'
            : 'Production authentication provider is not configured.',
          isOperational: hasAuth,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'STORAGE':
      case 'DOCUMENT_STORAGE': {
        const hasStorage = Boolean(
          process.env.SUPABASE_URL &&
          (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
        );
        const status: ProviderReadinessStatus = hasStorage ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: type,
          status,
          description: hasStorage
            ? 'Encrypted Supabase Storage vault is active.'
            : 'Production document storage vault is not configured.',
          isOperational: hasStorage,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'MALWARE_SCANNER': {
        const status: ProviderReadinessStatus = 'NOT_CONFIGURED';
        return {
          provider: 'MALWARE_SCANNER',
          status,
          description: 'No verified malware scanner transport is installed. Documents remain quarantined.',
          isOperational: false,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'OCR': {
        const hasOcr = Boolean(
          process.env.TAXGUARD_OCR_ENABLED === 'true' ||
          process.env.DOCUMENT_AI_PROCESSOR_ID ||
          process.env.GOOGLE_CLOUD_VISION_KEY
        );
        const status: ProviderReadinessStatus = hasOcr ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'OCR',
          status,
          description: hasOcr
            ? 'High-precision document intelligence engine is active.'
            : 'Production OCR provider is not configured.',
          isOperational: hasOcr,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'AI': {
        const hasAi = Boolean(
          process.env.OPENAI_API_KEY
        );
        const status: ProviderReadinessStatus = hasAi ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'AI',
          status,
          description: hasAi
            ? 'Server-side reasoning model is available for advisory proposals.'
            : 'Server-side AI provider is not configured.',
          isOperational: hasAi,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'E_SIGNATURE': {
        const hasSign = false;
        const status: ProviderReadinessStatus = hasSign ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'E_SIGNATURE',
          status,
          description: hasSign
            ? 'Authorized e-signature provider is connected.'
            : 'No live e-signature transport is implemented. Stage 11 remains blocked even if vendor credentials are present.',
          isOperational: hasSign,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'FILING': {
        const hasFiling = false;
        const status: ProviderReadinessStatus = hasFiling ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'FILING',
          status,
          description: hasFiling
            ? 'Authorized IRS MeF filing transmitter is connected.'
            : 'No live filing transport is implemented. Stage 12 remains blocked even if transmitter credentials are present.',
          isOperational: hasFiling,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'QUICKBOOKS': {
        const hasQbo = false;
        const status: ProviderReadinessStatus = hasQbo ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'QUICKBOOKS',
          status,
          description: hasQbo
            ? 'QuickBooks Online OAuth connection credentials configured.'
            : 'No live QuickBooks transport is implemented; credentials alone do not enable synchronization.',
          isOperational: hasQbo,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'XERO': {
        const hasXero = false;
        const status: ProviderReadinessStatus = hasXero ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'XERO',
          status,
          description: hasXero
            ? 'Xero Accounting OAuth connection credentials configured.'
            : 'No live Xero transport is implemented; credentials alone do not enable synchronization.',
          isOperational: hasXero,
          lastChecked: new Date().toISOString(),
        };
      }
    }
  }

  static getAllProviderStatuses(): ProviderReadinessInfo[] {
    const providers: ProviderType[] = [
      'DATABASE',
      'AUTHENTICATION',
      'STORAGE',
      'MALWARE_SCANNER',
      'OCR',
      'AI',
      'E_SIGNATURE',
      'FILING',
      'QUICKBOOKS',
      'XERO',
    ];
    return providers.map((p) => this.getProviderStatus(p));
  }

  /**
   * Evaluates database schema readiness without leaking SQL, passwords, or connection URLs.
   * Distinguishes:
   * - DATABASE_UNAVAILABLE: Connection or transport failure / unconfigured
   * - DATABASE_REACHABLE: Database responded, evaluating table structure
   * - DATABASE_SCHEMA_INCOMPLETE: Core tables missing
   * - DATABASE_MIGRATION_REQUIRED: Migrations pending execution
   * - DATABASE_READY: All required relational tables present and queryable
   */
  static async checkDatabaseSchemaReadiness(clientInstance?: any): Promise<DatabaseSchemaReadinessResult> {
    if (this.mockSchemaReadinessOverride) {
      return this.mockSchemaReadinessOverride;
    }

    const now = new Date().toISOString();
    const hasSupabaseConfig = Boolean(
      process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
    );

    if (!hasSupabaseConfig && !clientInstance) {
      return {
        state: 'DATABASE_UNAVAILABLE',
        verifiedTablesCount: 0,
        totalRequiredTables: 6,
        description: 'Database connection parameters not configured in runtime environment.',
        checkedAt: now,
      };
    }

    const REQUIRED_CORE_TABLES = [
      'taxguard_tenants',
      'taxguard_cases',
      'taxguard_documents',
      'taxguard_durable_jobs',
      'taxguard_journal_entries',
      'taxguard_retention_policies',
    ];

    try {
      let client = clientInstance;
      if (!client) {
        const { getSupabaseAdmin, isSupabaseServerConfigured } = await import('../supabase');
        if (!isSupabaseServerConfigured()) {
          return {
            state: 'DATABASE_UNAVAILABLE',
            verifiedTablesCount: 0,
            totalRequiredTables: REQUIRED_CORE_TABLES.length,
            description: 'Supabase server credentials not configured.',
            checkedAt: now,
          };
        }
        client = getSupabaseAdmin();
      }

      let verifiedCount = 0;
      let missingTable = false;

      for (const table of REQUIRED_CORE_TABLES) {
        try {
          const { error } = await client
            .from(table)
            .select('*', { count: 'exact', head: true });

          if (error) {
            const errCode = (error.code || '').toUpperCase();
            const msg = (error.message || '').toLowerCase();
            if (errCode === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
              missingTable = true;
            } else if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('econnrefused')) {
              return {
                state: 'DATABASE_UNAVAILABLE',
                verifiedTablesCount: verifiedCount,
                totalRequiredTables: REQUIRED_CORE_TABLES.length,
                description: 'Database server is unreachable or offline.',
                checkedAt: now,
              };
            }
          } else {
            verifiedCount += 1;
          }
        } catch (tableErr: any) {
          const msg = (tableErr?.message || '').toLowerCase();
          if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnrefused')) {
            return {
              state: 'DATABASE_UNAVAILABLE',
              verifiedTablesCount: verifiedCount,
              totalRequiredTables: REQUIRED_CORE_TABLES.length,
              description: 'Database connection failed during schema verification.',
              checkedAt: now,
            };
          }
          missingTable = true;
        }
      }

      if (missingTable && verifiedCount === 0) {
        return {
          state: 'DATABASE_MIGRATION_REQUIRED',
          verifiedTablesCount: 0,
          totalRequiredTables: REQUIRED_CORE_TABLES.length,
          description: 'Database is reachable but schema migrations have not been applied.',
          checkedAt: now,
        };
      }

      if (missingTable || verifiedCount < REQUIRED_CORE_TABLES.length) {
        return {
          state: 'DATABASE_SCHEMA_INCOMPLETE',
          verifiedTablesCount: verifiedCount,
          totalRequiredTables: REQUIRED_CORE_TABLES.length,
          description: `Schema is incomplete. Verified ${verifiedCount} of ${REQUIRED_CORE_TABLES.length} core tables.`,
          checkedAt: now,
        };
      }

      return {
        state: 'DATABASE_READY',
        verifiedTablesCount: verifiedCount,
        totalRequiredTables: REQUIRED_CORE_TABLES.length,
        description: 'All core relational schema tables verified and ready.',
        checkedAt: now,
      };
    } catch {
      return {
        state: 'DATABASE_UNAVAILABLE',
        verifiedTablesCount: 0,
        totalRequiredTables: REQUIRED_CORE_TABLES.length,
        description: 'Database readiness check encountered an unexpected connectivity issue.',
        checkedAt: now,
      };
    }
  }
}
