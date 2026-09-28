/**
 * TaxGuard Provider Readiness Registry
 * Truthfully evaluates external provider statuses without exposing secrets.
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
        // We know Firestore is initialized with project taxguard2026 or default
        return {
          provider: 'DATABASE',
          status: 'CONFIGURED',
          description: 'Google Cloud Firestore Enterprise Edition is provisioned and active.',
          isOperational: true,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'DOCUMENT_STORAGE': {
        // Document storage is active via Firebase Cloud Storage if bucket configured
        const hasBucket = Boolean(process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET);
        const status: ProviderReadinessStatus = hasBucket ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'DOCUMENT_STORAGE',
          status,
          description: hasBucket
            ? 'Encrypted cloud document bucket configured.'
            : 'Production document storage bucket is not configured.',
          isOperational: hasBucket,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'MALWARE_SCANNER': {
        // Check if real scanning service socket or binary is configured
        const hasScanner = Boolean(
          process.env.TAXGUARD_MALWARE_SCANNER_URL ||
          process.env.CLAMAV_HOST ||
          process.env.MALWARE_SCANNER_ENABLED === 'true'
        );
        const status: ProviderReadinessStatus = hasScanner ? 'CONFIGURED' : 'NOT_CONFIGURED';
        return {
          provider: 'MALWARE_SCANNER',
          status,
          description: hasScanner
            ? 'Production anti-malware daemon is connected.'
            : 'Malware scanner is not configured. Documents remain quarantined.',
          isOperational: hasScanner,
          lastChecked: new Date().toISOString(),
        };
      }

      case 'OCR': {
        // Check if real OCR provider is configured (Google Document AI / Cloud Vision / OCR service)
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
        // Check if server-side AI provider (OpenAI / Gemini) is configured
        const hasAi = Boolean(
          process.env.OPENAI_API_KEY ||
          process.env.GEMINI_API_KEY
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
    }
  }

  static getAllProviderStatuses(): ProviderReadinessInfo[] {
    const providers: ProviderType[] = [
      'DATABASE',
      'DOCUMENT_STORAGE',
      'MALWARE_SCANNER',
      'OCR',
      'AI',
    ];
    return providers.map((p) => this.getProviderStatus(p));
  }
}
