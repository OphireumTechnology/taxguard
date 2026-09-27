/**
 * A/R Tax Services, LLC - Config-Driven Environment Management
 * Enforces demo safety: no live filings, fictional data only, strict role-based access.
 */

export type AppEnvironment = 'demo' | 'uat_staging' | 'production';

export interface EnvironmentBehaviorConfig {
  environment: AppEnvironment;
  isDemo: boolean;
  allowLiveFilings: boolean;
  fictionalDataOnly: boolean;
  maskSensitiveFields: boolean;
  duplicateCheckMode: 'strict_block' | 'detect_and_review' | 'simulate_match';
  requireHardExitGate: boolean;
  enableAuditLogging: boolean;
  simulatedLatencyMs: number;
  environmentLabel: string;
  description: string;
}

const ENVIRONMENT_CONFIGS: Record<AppEnvironment, EnvironmentBehaviorConfig> = {
  demo: {
    environment: 'demo',
    isDemo: true,
    allowLiveFilings: false,
    fictionalDataOnly: true,
    maskSensitiveFields: true,
    duplicateCheckMode: 'detect_and_review',
    requireHardExitGate: true,
    enableAuditLogging: true,
    simulatedLatencyMs: 250,
    environmentLabel: 'Demonstration Environment (Demo)',
    description: 'Isolated test environment with synthetic taxpayers, simulated e-file transmissions, and full 18-stage operating cycle.'
  },
  uat_staging: {
    environment: 'uat_staging',
    isDemo: true,
    allowLiveFilings: false,
    fictionalDataOnly: true,
    maskSensitiveFields: true,
    duplicateCheckMode: 'detect_and_review',
    requireHardExitGate: true,
    enableAuditLogging: true,
    simulatedLatencyMs: 400,
    environmentLabel: 'UAT Staging Environment (Pre-Prod)',
    description: 'User Acceptance Testing environment for practitioner review, client intake validation, and end-to-end rehearsals.'
  },
  production: {
    environment: 'production',
    isDemo: false,
    allowLiveFilings: false, // Locked until formal IRS MeF e-file window authorization
    fictionalDataOnly: false,
    maskSensitiveFields: true,
    duplicateCheckMode: 'strict_block',
    requireHardExitGate: true,
    enableAuditLogging: true,
    simulatedLatencyMs: 0,
    environmentLabel: 'Production Environment (Live)',
    description: 'IRS Circular 230 and NIST AI RMF compliant production tier with dual-key cryptographic validation.'
  }
};

const ENV_STORAGE_KEY = 'artax_active_environment';

export class EnvironmentConfigService {
  private static currentEnv: AppEnvironment = 'demo';

  public static getEnvironment(): AppEnvironment {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(ENV_STORAGE_KEY) as AppEnvironment;
        if (stored && (stored === 'demo' || stored === 'uat_staging' || stored === 'production')) {
          this.currentEnv = stored;
        }
      } catch {
        // Fallback
      }
    }
    return this.currentEnv;
  }

  public static setEnvironment(env: AppEnvironment): EnvironmentBehaviorConfig {
    this.currentEnv = env;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ENV_STORAGE_KEY, env);
      } catch {
        // Fallback
      }
    }
    return ENVIRONMENT_CONFIGS[env];
  }

  public static getConfig(): EnvironmentBehaviorConfig {
    return ENVIRONMENT_CONFIGS[this.getEnvironment()];
  }

  public static isLiveFilingsAllowed(): boolean {
    return this.getConfig().allowLiveFilings;
  }

  public static maskTIN(tin: string, type: 'ssn' | 'ein' = 'ein'): string {
    const cleaned = (tin || '').replace(/\D/g, '');
    if (type === 'ssn') {
      const last4 = cleaned.slice(-4).padStart(4, '0');
      return `***-**-${last4}`;
    }
    // EIN format: XX-XXX1234
    const last4 = cleaned.slice(-4).padStart(4, '0');
    return `XX-XXX${last4}`;
  }

  public static getAllEnvironments(): EnvironmentBehaviorConfig[] {
    return Object.values(ENVIRONMENT_CONFIGS);
  }
}
