import {
  getEnvironmentConfig,
  type AppEnvironment,
  type EnvironmentBehaviorConfig,
} from '../../config/environmentConfig';

export class ProductionEnvironmentGuard {
  public static getEnvironment(): AppEnvironment {
    return getEnvironmentConfig().environment;
  }

  public static getConfig(): EnvironmentBehaviorConfig {
    return getEnvironmentConfig();
  }

  public static isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  public static isDemo(): boolean {
    return this.getConfig().isDemo;
  }

  public static assertProduction(operation: string): void {
    if (!this.isProduction()) {
      throw new Error(
        `${operation} is available only through the TaxGuard production authority.`
      );
    }
  }

  public static assertLiveWriteAllowed(operation: string): void {
    const config = this.getConfig();

    if (config.isDemo || config.fictionalDataOnly) {
      throw new Error(
        `${operation} cannot write to production services from a demonstration environment.`
      );
    }
  }

  public static assertLiveFilingAllowed(): void {
    const config = this.getConfig();

    if (!config.allowLiveFilings) {
      throw new Error(
        'Live electronic filing is disabled by the TaxGuard environment policy.'
      );
    }
  }
}
