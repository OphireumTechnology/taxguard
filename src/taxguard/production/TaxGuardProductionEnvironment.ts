export type TaxGuardEnvironment =
  | 'development'
  | 'test'
  | 'staging'
  | 'production';

export type TaxGuardDeploymentComponent =
  | 'FRONTEND'
  | 'API'
  | 'DATABASE'
  | 'AUTH'
  | 'DOCUMENT_INTELLIGENCE';

export interface TaxGuardProductionEnvironmentInput {
  environment: TaxGuardEnvironment;

  frontendOrigin: string;

  apiBaseUrl: string;

  firebaseProjectId: string;

  firestoreDatabaseId: string;

  sessionCookieName: string;

  trustProxy: boolean;

  externalTaxFilingEnabled: boolean;
}

export interface TaxGuardProductionEnvironmentRecord
  extends TaxGuardProductionEnvironmentInput {

  validatedAt: string;

  productionValidated: boolean;

  immutable: true;
}

function requireText(
  value: string,
  code: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

function parseUrl(
  value: string,
  code: string
): URL {

  try {
    return new URL(
      requireText(
        value,
        code
      )
    );
  } catch {
    throw new Error(code);
  }
}

export class TaxGuardProductionEnvironmentValidator {

  static validate(
    input:
      TaxGuardProductionEnvironmentInput
  ):
    TaxGuardProductionEnvironmentRecord {

    requireText(
      input.firebaseProjectId,
      'TG_PROD_FIREBASE_PROJECT_REQUIRED'
    );

    requireText(
      input.firestoreDatabaseId,
      'TG_PROD_FIRESTORE_DATABASE_REQUIRED'
    );

    requireText(
      input.sessionCookieName,
      'TG_PROD_SESSION_COOKIE_REQUIRED'
    );

    const frontend =
      parseUrl(
        input.frontendOrigin,
        'TG_PROD_FRONTEND_ORIGIN_INVALID'
      );

    const api =
      parseUrl(
        input.apiBaseUrl,
        'TG_PROD_API_URL_INVALID'
      );

    if (
      input.environment ===
        'production'
    ) {
      if (
        frontend.protocol !==
          'https:'
      ) {
        throw new Error(
          'TG_PROD_FRONTEND_HTTPS_REQUIRED'
        );
      }

      if (
        api.protocol !==
          'https:'
      ) {
        throw new Error(
          'TG_PROD_API_HTTPS_REQUIRED'
        );
      }

      if (
        !input.trustProxy
      ) {
        throw new Error(
          'TG_PROD_TRUST_PROXY_REQUIRED'
        );
      }

      if (
        input.externalTaxFilingEnabled
      ) {
        throw new Error(
          'TG_PROD_EXTERNAL_TAX_FILING_DISABLED'
        );
      }
    }

    return Object.freeze({
      ...input,

      frontendOrigin:
        frontend.origin,

      apiBaseUrl:
        api.toString()
          .replace(
            /\/$/,
            ''
          ),

      validatedAt:
        new Date()
          .toISOString(),

      productionValidated:
        input.environment ===
          'production',

      immutable:
        true
    });
  }
}

export interface TaxGuardSecretRequirement {
  name: string;

  requiredIn:
    readonly TaxGuardEnvironment[];

  sensitive: true;
}

export interface TaxGuardSecretValidationResult {
  environment:
    TaxGuardEnvironment;

  checkedSecretNames:
    readonly string[];

  missingSecretNames:
    readonly string[];

  valid: boolean;

  checkedAt: string;

  secretValuesExposed: false;
}

export class TaxGuardProductionSecretGuard {

  static readonly requirements:
    readonly TaxGuardSecretRequirement[] =
    Object.freeze([
      {
        name:
          'GOOGLE_APPLICATION_CREDENTIALS',

        requiredIn: [
          'staging',
          'production'
        ],

        sensitive:
          true
      },

      {
        name:
          'FIREBASE_FIRESTORE_DATABASE_ID',

        requiredIn: [
          'staging',
          'production'
        ],

        sensitive:
          true
      },

      {
        name:
          'SESSION_SECRET',

        requiredIn: [
          'staging',
          'production'
        ],

        sensitive:
          true
      }
    ]);

  static validate(
    environment:
      TaxGuardEnvironment,

    values:
      Readonly<
        Record<
          string,
          string | undefined
        >
      >
  ):
    TaxGuardSecretValidationResult {

    const applicable =
      this.requirements.filter(
        requirement =>
          requirement.requiredIn
            .includes(
              environment
            )
      );

    const missing =
      applicable
        .filter(
          requirement =>
            !values[
              requirement.name
            ]?.trim()
        )
        .map(
          requirement =>
            requirement.name
        );

    return {
      environment,

      checkedSecretNames:
        applicable.map(
          requirement =>
            requirement.name
        ),

      missingSecretNames:
        missing,

      valid:
        missing.length === 0,

      checkedAt:
        new Date()
          .toISOString(),

      secretValuesExposed:
        false
    };
  }

  static assertValid(
    result:
      TaxGuardSecretValidationResult
  ): true {

    if (!result.valid) {
      throw new Error(
        'TG_PROD_REQUIRED_SECRETS_MISSING:' +
        result.missingSecretNames
          .join(',')
      );
    }

    return true;
  }

  static exposeSecret():
    never {

    throw new Error(
      'TG_PROD_SECRET_EXPOSURE_BLOCKED'
    );
  }
}
