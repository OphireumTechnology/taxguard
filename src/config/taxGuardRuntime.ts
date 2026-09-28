export type TaxGuardRuntimeEnvironment =
  | 'development'
  | 'staging'
  | 'production';

export interface TaxGuardRuntimeConfig {
  environment: TaxGuardRuntimeEnvironment;
  apiBaseUrl: string;
  production: boolean;
}

const normalizeBaseUrl = (value: string): string =>
  value.replace(/\/+$/, '');

export const getTaxGuardRuntimeConfig =
  (): TaxGuardRuntimeConfig => {
    const environment =
      (import.meta.env.VITE_APP_ENV as
        | TaxGuardRuntimeEnvironment
        | undefined) ?? 'production';

    const configuredApi =
      import.meta.env.VITE_API_BASE_URL?.trim();

    if (!configuredApi) {
      throw new Error(
        'TAXGUARD_CONFIGURATION_ERROR: VITE_API_BASE_URL is required.'
      );
    }

    if (
      environment === 'production' &&
      !configuredApi.startsWith('https://')
    ) {
      throw new Error(
        'TAXGUARD_CONFIGURATION_ERROR: production API must use HTTPS.'
      );
    }

    return {
      environment,
      apiBaseUrl: normalizeBaseUrl(configuredApi),
      production: environment === 'production',
    };
  };

export const assertProductionRuntime = (): void => {
  const config = getTaxGuardRuntimeConfig();

  if (!config.production) {
    throw new Error(
      `TAXGUARD_RUNTIME_ERROR: expected production runtime; received ${config.environment}.`
    );
  }
};
