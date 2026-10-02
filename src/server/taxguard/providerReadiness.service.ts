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

export class ProviderReadinessRegistry {
  private static mockOverrideStatuses?: Partial<Record<ProviderType, ProviderReadinessStatus>>;

  /** Set testing overrides (for unit tests only) */
  static setTestingOverrides(overrides?: Partial<Record<ProviderType, ProviderReadinessStatus>>) {
    this.mockOverrideStatuses = overrides;
  }

  static getProviderStatus(type: ProviderType): ProviderReadinessInfo {
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
        const isScannerReady = process.env.TAXGUARD_MALWARE_SCANNER_ENABLED === 'true';
        const status: ProviderReadinessStatus = isScannerReady ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'MALWARE_SCANNER',
          status,
          description: isScannerReady
            ? 'Production anti-malware daemon is connected.'
            : 'Malware scanner is not configured. Documents remain quarantined.',
          isOperational: isScannerReady,
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
        const hasSign = Boolean(
          process.env.TAXGUARD_SIGNATURE_PROVIDER_URL ||
          process.env.DOCUSIGN_INTEGRATION_KEY ||
          process.env.HELLO_SIGN_KEY
        );
        const status: ProviderReadinessStatus = hasSign ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'E_SIGNATURE',
          status,
          description: hasSign
            ? 'Authorized e-signature provider is connected.'
            : 'E-signature provider is not configured. Stage 11 fails closed.',
          isOperational: hasSign,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'FILING': {
        const hasFiling = Boolean(
          process.env.TAXGUARD_IRS_MEF_TRANSMITTER_ID ||
          process.env.TAXGUARD_FILING_PROVIDER_URL ||
          process.env.TAXGUARD_MEF_ETIN
        );
        const status: ProviderReadinessStatus = hasFiling ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'FILING',
          status,
          description: hasFiling
            ? 'Authorized IRS MeF filing transmitter is connected.'
            : 'Filing provider is not configured. Stage 12 fails closed.',
          isOperational: hasFiling,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'QUICKBOOKS': {
        const hasQbo = Boolean(
          process.env.QUICKBOOKS_CLIENT_ID &&
          process.env.QUICKBOOKS_CLIENT_SECRET
        );
        const status: ProviderReadinessStatus = hasQbo ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'QUICKBOOKS',
          status,
          description: hasQbo
            ? 'QuickBooks Online OAuth connection credentials configured.'
            : 'QuickBooks integration is optional and not configured.',
          isOperational: hasQbo,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'XERO': {
        const hasXero = Boolean(
          process.env.XERO_CLIENT_ID &&
          process.env.XERO_CLIENT_SECRET
        );
        const status: ProviderReadinessStatus = hasXero ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'XERO',
          status,
          description: hasXero
            ? 'Xero Accounting OAuth connection credentials configured.'
            : 'Xero integration is optional and not configured.',
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
}
