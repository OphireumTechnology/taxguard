export type TaxGuardRuntimeMode =
  | 'DEVELOPMENT'
  | 'STAGING'
  | 'PRODUCTION';

export interface TaxGuardProductionRuntimeEnvironment {
  mode: TaxGuardRuntimeMode;

  frontendOrigin: string;
  apiOrigin: string;

  port: number;

  firebaseProjectIdPresent: boolean;
  firebaseAdminCredentialPresent: boolean;
  firestoreDatabaseIdPresent: boolean;

  sessionSecretPresent: boolean;

  documentIntelligenceConfigured: boolean;

  monitoringConfigured: boolean;

  externalTaxFilingEnabled: false;
}

export interface TaxGuardRuntimeValidationResult {
  valid: boolean;
  blockers: readonly string[];
  warnings: readonly string[];
}

function hasText(
  value: string
): boolean {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
}

function validHttpsOrigin(
  value: string
): boolean {
  try {
    const url =
      new URL(value);

    return (
      url.protocol === 'https:' &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export class TaxGuardProductionRuntimeGuard {

  static validate(
    runtime:
      TaxGuardProductionRuntimeEnvironment
  ):
    Readonly<TaxGuardRuntimeValidationResult> {

    const blockers:
      string[] = [];

    const warnings:
      string[] = [];

    if (
      runtime.mode === 'PRODUCTION'
    ) {
      if (
        !validHttpsOrigin(
          runtime.frontendOrigin
        )
      ) {
        blockers.push(
          'PRODUCTION_FRONTEND_ORIGIN_INVALID'
        );
      }

      if (
        !validHttpsOrigin(
          runtime.apiOrigin
        )
      ) {
        blockers.push(
          'PRODUCTION_API_ORIGIN_INVALID'
        );
      }

      if (
        runtime.frontendOrigin ===
          runtime.apiOrigin
      ) {
        warnings.push(
          'FRONTEND_AND_API_SHARE_ORIGIN_VERIFY_REVERSE_PROXY'
        );
      }

      if (
        !runtime.firebaseProjectIdPresent
      ) {
        blockers.push(
          'FIREBASE_PROJECT_ID_REQUIRED'
        );
      }

      if (
        !runtime.firebaseAdminCredentialPresent
      ) {
        blockers.push(
          'FIREBASE_ADMIN_CREDENTIAL_REQUIRED'
        );
      }

      if (
        !runtime.firestoreDatabaseIdPresent
      ) {
        blockers.push(
          'FIRESTORE_DATABASE_ID_REQUIRED'
        );
      }

      if (
        !runtime.sessionSecretPresent
      ) {
        blockers.push(
          'SESSION_SECRET_REQUIRED'
        );
      }

      if (
        !runtime.documentIntelligenceConfigured
      ) {
        blockers.push(
          'DOCUMENT_INTELLIGENCE_NOT_CONFIGURED'
        );
      }

      if (
        !runtime.monitoringConfigured
      ) {
        blockers.push(
          'PRODUCTION_MONITORING_NOT_CONFIGURED'
        );
      }
    }

    if (
      !Number.isInteger(
        runtime.port
      ) ||
      runtime.port < 1 ||
      runtime.port > 65535
    ) {
      blockers.push(
        'SERVER_PORT_INVALID'
      );
    }

    if (
      runtime.externalTaxFilingEnabled !==
        false
    ) {
      blockers.push(
        'EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED'
      );
    }

    return Object.freeze({
      valid:
        blockers.length === 0,

      blockers:
        Object.freeze([
          ...blockers
        ]),

      warnings:
        Object.freeze([
          ...warnings
        ])
    });
  }
}


// ============================================================
// 3. STRICT PRODUCTION CORS POLICY
// ============================================================

export interface TaxGuardCorsPolicy {
  allowedOrigins:
    readonly string[];

  allowedMethods:
    readonly string[];

  allowedHeaders:
    readonly string[];

  credentials:
    boolean;

  allowWildcardOrigin:
    false;
}

export interface TaxGuardCorsDecision {
  allowed: boolean;
  reason:
    | 'ALLOWED'
    | 'ORIGIN_REQUIRED'
    | 'ORIGIN_NOT_ALLOWED'
    | 'METHOD_NOT_ALLOWED'
    | 'HEADER_NOT_ALLOWED';
}

function normalizeOrigin(
  value: string
): string {
  return value
    .trim()
    .replace(
      /\/+$/,
      ''
    );
}

export class TaxGuardProductionCorsPolicy {

  static create(
    frontendOrigins:
      readonly string[]
  ):
    Readonly<TaxGuardCorsPolicy> {

    if (
      frontendOrigins.length === 0
    ) {
      throw new Error(
        'TG_CORS_ALLOWED_ORIGIN_REQUIRED'
      );
    }

    const normalized =
      frontendOrigins.map(
        normalizeOrigin
      );

    if (
      normalized.some(
        origin =>
          origin === '*' ||
          !origin.startsWith(
            'https://'
          )
      )
    ) {
      throw new Error(
        'TG_CORS_PRODUCTION_ORIGIN_INVALID'
      );
    }

    if (
      new Set(
        normalized
      ).size !==
        normalized.length
    ) {
      throw new Error(
        'TG_CORS_DUPLICATE_ORIGIN'
      );
    }

    return Object.freeze({
      allowedOrigins:
        Object.freeze([
          ...normalized
        ]),

      allowedMethods:
        Object.freeze([
          'GET',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
          'OPTIONS'
        ]),

      allowedHeaders:
        Object.freeze([
          'Content-Type',
          'Authorization',
          'X-Requested-With'
        ]),

      credentials:
        true,

      allowWildcardOrigin:
        false
    });
  }

  static evaluate(
    policy:
      TaxGuardCorsPolicy,

    origin:
      string | undefined,

    method:
      string,

    requestedHeaders:
      readonly string[] = []
  ):
    Readonly<TaxGuardCorsDecision> {

    if (
      !origin
    ) {
      return Object.freeze({
        allowed:
          false,

        reason:
          'ORIGIN_REQUIRED'
      });
    }

    const normalizedOrigin =
      normalizeOrigin(
        origin
      );

    if (
      !policy.allowedOrigins
        .includes(
          normalizedOrigin
        )
    ) {
      return Object.freeze({
        allowed:
          false,

        reason:
          'ORIGIN_NOT_ALLOWED'
      });
    }

    const normalizedMethod =
      method
        .trim()
        .toUpperCase();

    if (
      !policy.allowedMethods
        .includes(
          normalizedMethod
        )
    ) {
      return Object.freeze({
        allowed:
          false,

        reason:
          'METHOD_NOT_ALLOWED'
      });
    }

    const allowedHeaders =
      new Set(
        policy.allowedHeaders
          .map(
            header =>
              header.toLowerCase()
          )
      );

    for (
      const header
      of requestedHeaders
    ) {
      if (
        !allowedHeaders.has(
          header
            .trim()
            .toLowerCase()
        )
      ) {
        return Object.freeze({
          allowed:
            false,

          reason:
            'HEADER_NOT_ALLOWED'
        });
      }
    }

    return Object.freeze({
      allowed:
        true,

      reason:
        'ALLOWED'
    });
  }
}


// ============================================================
// 4. API / STATIC FRONTEND BOUNDARY
// ============================================================

export interface TaxGuardRuntimeRoute {
  path: string;

  runtime:
    'STATIC_FRONTEND' |
    'NODE_API';

  spaFallbackAllowed:
    boolean;
}

export class TaxGuardRuntimeRouteGuard {

  static validate(
    route:
      TaxGuardRuntimeRoute
  ):
    Readonly<TaxGuardRuntimeRoute> {

    if (
      !route.path.startsWith('/')
    ) {
      throw new Error(
        'TG_RUNTIME_ROUTE_PATH_INVALID'
      );
    }

    if (
      route.path.startsWith('/api/') &&
      route.runtime !== 'NODE_API'
    ) {
      throw new Error(
        'TG_API_ROUTE_REQUIRES_NODE_RUNTIME'
      );
    }

    if (
      route.path.startsWith('/api/') &&
      route.spaFallbackAllowed
    ) {
      throw new Error(
        'TG_API_ROUTE_SPA_FALLBACK_BLOCKED'
      );
    }

    return Object.freeze({
      ...route
    });
  }
}

export const TAXGUARD_PRODUCTION_ROUTE_BOUNDARY =
  Object.freeze([
    Object.freeze({
      path:
        '/api/health',

      runtime:
        'NODE_API' as const,

      spaFallbackAllowed:
        false
    }),

    Object.freeze({
      path:
        '/api/auth/firebase-session',

      runtime:
        'NODE_API' as const,

      spaFallbackAllowed:
        false
    }),

    Object.freeze({
      path:
        '/api/auth/me',

      runtime:
        'NODE_API' as const,

      spaFallbackAllowed:
        false
    }),

    Object.freeze({
      path:
        '/*',

      runtime:
        'STATIC_FRONTEND' as const,

      spaFallbackAllowed:
        true
    })
  ]);


// ============================================================
// 5. PRODUCTION HEALTH CONTRACT
// ============================================================

export type TaxGuardHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNHEALTHY';

export interface TaxGuardHealthComponent {
  component:
    | 'API'
    | 'FIREBASE_ADMIN'
    | 'DATABASE'
    | 'DOCUMENT_INTELLIGENCE'
    | 'MONITORING';

  healthy:
    boolean;

  required:
    boolean;

  checkedAt:
    string;

  reason?:
    string;
}

export interface TaxGuardProductionHealth {
  status:
    TaxGuardHealthStatus;

  ready:
    boolean;

  components:
    readonly TaxGuardHealthComponent[];

  blockers:
    readonly string[];
}

export class TaxGuardProductionHealthEvaluator {

  static evaluate(
    components:
      readonly TaxGuardHealthComponent[]
  ):
    Readonly<TaxGuardProductionHealth> {

    const blockers:
      string[] = [];

    if (
      components.length === 0
    ) {
      blockers.push(
        'HEALTH_COMPONENTS_REQUIRED'
      );
    }

    for (
      const component
      of components
    ) {
      if (
        !Number.isFinite(
          Date.parse(
            component.checkedAt
          )
        )
      ) {
        blockers.push(
          component.component +
          '_HEALTH_TIMESTAMP_INVALID'
        );
      }

      if (
        component.required &&
        !component.healthy
      ) {
        blockers.push(
          component.component +
          '_UNHEALTHY'
        );
      }
    }

    const unhealthyCount =
      components.filter(
        component =>
          !component.healthy
      ).length;

    const requiredFailure =
      components.some(
        component =>
          component.required &&
          !component.healthy
      );

    const status:
      TaxGuardHealthStatus =
        requiredFailure
          ? 'UNHEALTHY'
          : unhealthyCount > 0
            ? 'DEGRADED'
            : 'HEALTHY';

    return Object.freeze({
      status,

      ready:
        blockers.length === 0,

      components:
        Object.freeze(
          components.map(
            component =>
              Object.freeze({
                ...component
              })
          )
        ),

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}


// ============================================================
// 6. DEPLOYMENT MANIFEST
// ============================================================

export interface TaxGuardProductionDeploymentManifest {
  application:
    'TaxGuard';

  frontendArtifact:
    'dist';

  backendArtifact:
    'dist/server.cjs';

  backendRuntime:
    'NODE';

  apiPrefix:
    '/api';

  spaFallbackExcludesApi:
    true;

  firebaseAuthentication:
    true;

  firebaseAdminServerOnly:
    true;

  externalTaxFilingEnabled:
    false;
}

export const TAXGUARD_PRODUCTION_DEPLOYMENT_MANIFEST:
  Readonly<TaxGuardProductionDeploymentManifest> =
    Object.freeze({
      application:
        'TaxGuard',

      frontendArtifact:
        'dist',

      backendArtifact:
        'dist/server.cjs',

      backendRuntime:
        'NODE',

      apiPrefix:
        '/api',

      spaFallbackExcludesApi:
        true,

      firebaseAuthentication:
        true,

      firebaseAdminServerOnly:
        true,

      externalTaxFilingEnabled:
        false
    });


// ============================================================
// 7. ENVIRONMENT VARIABLE CONTRACT
// ============================================================

export type TaxGuardProductionEnvironmentKey =
  | 'NODE_ENV'
  | 'PORT'
  | 'TAXGUARD_FRONTEND_ORIGIN'
  | 'TAXGUARD_API_ORIGIN'
  | 'FIREBASE_FIRESTORE_DATABASE_ID'
  | 'GOOGLE_APPLICATION_CREDENTIALS'
  | 'TAXGUARD_SESSION_SECRET';

export interface TaxGuardEnvironmentVariableCheck {
  key:
    TaxGuardProductionEnvironmentKey;

  present:
    boolean;

  secret:
    boolean;
}

export interface TaxGuardEnvironmentAssessment {
  ready:
    boolean;

  missing:
    readonly TaxGuardProductionEnvironmentKey[];
}

export class TaxGuardProductionEnvironmentGuard {

  static evaluate(
    checks:
      readonly TaxGuardEnvironmentVariableCheck[]
  ):
    Readonly<TaxGuardEnvironmentAssessment> {

    const required:
      readonly TaxGuardProductionEnvironmentKey[] = [
        'NODE_ENV',
        'PORT',
        'TAXGUARD_FRONTEND_ORIGIN',
        'TAXGUARD_API_ORIGIN',
        'FIREBASE_FIRESTORE_DATABASE_ID',
        'GOOGLE_APPLICATION_CREDENTIALS',
        'TAXGUARD_SESSION_SECRET'
      ];

    const checkMap =
      new Map(
        checks.map(
          check =>
            [
              check.key,
              check
            ] as const
        )
      );

    const missing:
      TaxGuardProductionEnvironmentKey[] = [];

    for (
      const key
      of required
    ) {
      if (
        checkMap.get(key)
          ?.present !== true
      ) {
        missing.push(
          key
        );
      }
    }

    return Object.freeze({
      ready:
        missing.length === 0,

      missing:
        Object.freeze([
          ...missing
        ])
    });
  }
}


// ============================================================
// 8. SECRET-SAFETY POLICY
// ============================================================

export interface TaxGuardSecretSafetyPolicy {
  serviceAccountPrivateKeyInRepository:
    false;

  sessionSecretInRepository:
    false;

  productionSecretsInFrontendBundle:
    false;

  serverCredentialsServerOnly:
    true;
}

export const TAXGUARD_SECRET_SAFETY_POLICY:
  Readonly<TaxGuardSecretSafetyPolicy> =
    Object.freeze({
      serviceAccountPrivateKeyInRepository:
        false,

      sessionSecretInRepository:
        false,

      productionSecretsInFrontendBundle:
        false,

      serverCredentialsServerOnly:
        true
    });
