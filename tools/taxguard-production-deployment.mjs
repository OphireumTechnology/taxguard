// ============================================================
// TAXGUARD PRODUCTION DEPLOYMENT BUILDER
// Section 1 of 4
//
// Production Deployment & Runtime Foundation
//
// IMPORTANT:
// - M1-M15 remain frozen.
// - External tax filing remains DISABLED.
// - Real production endpoints must be verified before GO-LIVE.
// - HTTP 405 is a RELEASE BLOCKER.
// - Static hosting must never impersonate the API backend.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function write(relativePath, content) {
  const target = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.trimStart(), 'utf8');
  console.log(`Created: ${relativePath}`);
}

// ============================================================
// 1. PRODUCTION DEPLOYMENT CONTRACT
// ============================================================

write(
  'src/taxguard/deployment/TaxGuardProductionDeployment.ts',
  String.raw`
export type TaxGuardDeploymentEnvironment =
  | 'development'
  | 'test'
  | 'staging'
  | 'production';

export type TaxGuardDeploymentStatus =
  | 'NOT_VALIDATED'
  | 'BLOCKED'
  | 'READY_FOR_VERIFICATION'
  | 'VERIFIED'
  | 'FAILED';

export type TaxGuardDeploymentComponent =
  | 'FRONTEND'
  | 'API'
  | 'AUTHENTICATION'
  | 'DATABASE'
  | 'DOCUMENT_INTELLIGENCE'
  | 'MONITORING'
  | 'BACKUP'
  | 'SECURITY'
  | 'EXTERNAL_TAX_FILING';

export interface TaxGuardDeploymentEndpoint {
  id: string;
  component: TaxGuardDeploymentComponent;
  path: string;
  requiredMethod: string;
  expectedStatusCodes: readonly number[];
  productionRequired: boolean;
  verified: boolean;
  verifiedAt?: string;
}

export interface TaxGuardProductionDeploymentContext {
  environment: TaxGuardDeploymentEnvironment;

  frontendOrigin: string;
  apiOrigin: string;

  httpsRequired: true;
  externalTaxFilingEnabled: false;

  firebaseAuthenticationRequired: true;
  firebaseAdminRequired: true;
  persistentDatabaseRequired: true;

  staticHostingMayServeApi: false;

  deploymentId: string;
  correlationId: string;

  createdAt: string;
}

export interface TaxGuardDeploymentValidationResult {
  valid: boolean;
  status: TaxGuardDeploymentStatus;
  blockers: readonly string[];
  warnings: readonly string[];
}

function nonEmpty(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export class TaxGuardProductionDeploymentGuard {
  static validate(
    context: TaxGuardProductionDeploymentContext
  ): TaxGuardDeploymentValidationResult {
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!nonEmpty(context.deploymentId)) {
      blockers.push('DEPLOYMENT_ID_REQUIRED');
    }

    if (!nonEmpty(context.correlationId)) {
      blockers.push('CORRELATION_ID_REQUIRED');
    }

    if (!nonEmpty(context.frontendOrigin)) {
      blockers.push('FRONTEND_ORIGIN_REQUIRED');
    }

    if (!nonEmpty(context.apiOrigin)) {
      blockers.push('API_ORIGIN_REQUIRED');
    }

    if (
      context.environment === 'production' &&
      !isHttps(context.frontendOrigin)
    ) {
      blockers.push('PRODUCTION_FRONTEND_REQUIRES_HTTPS');
    }

    if (
      context.environment === 'production' &&
      !isHttps(context.apiOrigin)
    ) {
      blockers.push('PRODUCTION_API_REQUIRES_HTTPS');
    }

    if (context.httpsRequired !== true) {
      blockers.push('HTTPS_MUST_REMAIN_REQUIRED');
    }

    if (context.firebaseAuthenticationRequired !== true) {
      blockers.push('FIREBASE_AUTHENTICATION_REQUIRED');
    }

    if (context.firebaseAdminRequired !== true) {
      blockers.push('FIREBASE_ADMIN_REQUIRED');
    }

    if (context.persistentDatabaseRequired !== true) {
      blockers.push('PERSISTENT_DATABASE_REQUIRED');
    }

    if (context.staticHostingMayServeApi !== false) {
      blockers.push('STATIC_HOSTING_CANNOT_SERVE_PROTECTED_API');
    }

    if (context.externalTaxFilingEnabled !== false) {
      blockers.push('EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED');
    }

    return Object.freeze({
      valid: blockers.length === 0,
      status:
        blockers.length === 0
          ? 'READY_FOR_VERIFICATION'
          : 'BLOCKED',
      blockers: Object.freeze([...blockers]),
      warnings: Object.freeze([...warnings])
    });
  }
}

// ============================================================
// REQUIRED PRODUCTION ENDPOINTS
// ============================================================

export const TAXGUARD_REQUIRED_PRODUCTION_ENDPOINTS:
  readonly TaxGuardDeploymentEndpoint[] = Object.freeze([
    Object.freeze({
      id: 'HEALTH',
      component: 'API',
      path: '/api/health',
      requiredMethod: 'GET',
      expectedStatusCodes: Object.freeze([200]),
      productionRequired: true,
      verified: false
    }),

    Object.freeze({
      id: 'FIREBASE_SESSION',
      component: 'AUTHENTICATION',
      path: '/api/auth/firebase-session',
      requiredMethod: 'POST',
      expectedStatusCodes: Object.freeze([
        200,
        400,
        401,
        403,
        503
      ]),
      productionRequired: true,
      verified: false
    }),

    Object.freeze({
      id: 'AUTH_ME',
      component: 'AUTHENTICATION',
      path: '/api/auth/me',
      requiredMethod: 'GET',
      expectedStatusCodes: Object.freeze([
        200,
        401,
        403
      ]),
      productionRequired: true,
      verified: false
    })
  ]);

// ============================================================
// HTTP 405 RELEASE BLOCKER
// ============================================================

export interface TaxGuardEndpointProbe {
  path: string;
  method: string;
  status: number;
  contentType?: string;
  responseSource?: 'API' | 'STATIC_FRONTEND' | 'UNKNOWN';
}

export interface TaxGuardEndpointProbeResult {
  passed: boolean;
  releaseBlocked: boolean;
  reasons: readonly string[];
}

export class TaxGuardProductionEndpointGuard {
  static evaluate(
    probe: TaxGuardEndpointProbe
  ): TaxGuardEndpointProbeResult {
    const reasons: string[] = [];

    if (!nonEmpty(probe.path)) {
      reasons.push('ENDPOINT_PATH_REQUIRED');
    }

    if (!nonEmpty(probe.method)) {
      reasons.push('HTTP_METHOD_REQUIRED');
    }

    if (probe.status === 405) {
      reasons.push('HTTP_405_PRODUCTION_RELEASE_BLOCKER');
    }

    if (
      probe.path.startsWith('/api/') &&
      probe.responseSource === 'STATIC_FRONTEND'
    ) {
      reasons.push('API_REQUEST_ROUTED_TO_STATIC_FRONTEND');
    }

    if (
      probe.path.startsWith('/api/') &&
      probe.contentType?.toLowerCase().includes('text/html')
    ) {
      reasons.push('API_RETURNED_HTML_INSTEAD_OF_API_RESPONSE');
    }

    return Object.freeze({
      passed: reasons.length === 0,
      releaseBlocked: reasons.length > 0,
      reasons: Object.freeze([...reasons])
    });
  }
}

// ============================================================
// PRODUCTION ROUTING POLICY
// ============================================================

export interface TaxGuardProductionRoutingPolicy {
  frontendOrigin: string;
  apiOrigin: string;

  apiPrefix: '/api';

  allowStaticFrontendFallbackForApi: false;

  requireHttps: true;

  allowedMethods: readonly string[];

  externalTaxFilingEnabled: false;
}

export function createTaxGuardProductionRoutingPolicy(
  frontendOrigin: string,
  apiOrigin: string
): Readonly<TaxGuardProductionRoutingPolicy> {
  if (!nonEmpty(frontendOrigin)) {
    throw new Error('FRONTEND_ORIGIN_REQUIRED');
  }

  if (!nonEmpty(apiOrigin)) {
    throw new Error('API_ORIGIN_REQUIRED');
  }

  return Object.freeze({
    frontendOrigin,
    apiOrigin,

    apiPrefix: '/api',

    allowStaticFrontendFallbackForApi: false,

    requireHttps: true,

    allowedMethods: Object.freeze([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ]),

    externalTaxFilingEnabled: false
  });
}

// ============================================================
// GO-LIVE GATE
// ============================================================

export interface TaxGuardGoLiveEvidence {
  localTypecheckPassed: boolean;
  localTestsPassed: boolean;
  productionBuildPassed: boolean;

  productionHealthVerified: boolean;
  productionApiVerified: boolean;
  productionAuthenticationVerified: boolean;
  productionDatabaseVerified: boolean;

  http405Resolved: boolean;

  monitoringVerified: boolean;
  backupRestoreVerified: boolean;

  externalTaxFilingEnabled: false;
}

export interface TaxGuardGoLiveDecision {
  approved: boolean;
  status: 'BLOCKED' | 'READY';
  blockers: readonly string[];
}

export class TaxGuardGoLiveGate {
  static evaluate(
    evidence: TaxGuardGoLiveEvidence
  ): TaxGuardGoLiveDecision {
    const blockers: string[] = [];

    if (!evidence.localTypecheckPassed) {
      blockers.push('TYPECHECK_NOT_VERIFIED');
    }

    if (!evidence.localTestsPassed) {
      blockers.push('TEST_REGRESSION_NOT_VERIFIED');
    }

    if (!evidence.productionBuildPassed) {
      blockers.push('PRODUCTION_BUILD_NOT_VERIFIED');
    }

    if (!evidence.productionHealthVerified) {
      blockers.push('PRODUCTION_HEALTH_NOT_VERIFIED');
    }

    if (!evidence.productionApiVerified) {
      blockers.push('PRODUCTION_API_NOT_VERIFIED');
    }

    if (!evidence.productionAuthenticationVerified) {
      blockers.push('PRODUCTION_AUTHENTICATION_NOT_VERIFIED');
    }

    if (!evidence.productionDatabaseVerified) {
      blockers.push('PRODUCTION_DATABASE_NOT_VERIFIED');
    }

    if (!evidence.http405Resolved) {
      blockers.push('HTTP_405_NOT_RESOLVED');
    }

    if (!evidence.monitoringVerified) {
      blockers.push('PRODUCTION_MONITORING_NOT_VERIFIED');
    }

    if (!evidence.backupRestoreVerified) {
      blockers.push('BACKUP_RESTORE_NOT_VERIFIED');
    }

    if (evidence.externalTaxFilingEnabled !== false) {
      blockers.push('EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED');
    }

    return Object.freeze({
      approved: blockers.length === 0,
      status: blockers.length === 0 ? 'READY' : 'BLOCKED',
      blockers: Object.freeze([...blockers])
    });
  }
}
`
);

console.log('');
console.log('============================================================');
console.log('Production Deployment Section 1 registered.');
console.log('Deployment contract and routing gates created.');
console.log('HTTP 405 remains a release blocker until actually resolved.');
console.log('External tax filing remains DISABLED.');
console.log('============================================================');

// ============================================================
// SECTION 2
// PRODUCTION RUNTIME, CORS, HEALTH & DEPLOYMENT MANIFEST
// ============================================================


// ============================================================
// 2. PRODUCTION RUNTIME CONFIGURATION
// ============================================================

write(
  'src/taxguard/deployment/TaxGuardProductionRuntime.ts',
  String.raw`
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
`
);

console.log('');
console.log('============================================================');
console.log('Production Deployment Section 2 registered.');
console.log('Runtime, CORS, health and deployment boundaries added.');
console.log('API routes are explicitly separated from SPA fallback.');
console.log('Production secrets remain server-only.');
console.log('External tax filing remains DISABLED.');
console.log('============================================================');


// ============================================================
// SECTION 3
// PRODUCTION ADAPTER, AUTH READINESS & VERIFICATION
// ============================================================

write(
  'src/taxguard/deployment/TaxGuardProductionAdapter.ts',
  String.raw`
export type TaxGuardRequestRuntime =
  | 'NODE_API'
  | 'STATIC_FRONTEND'
  | 'REJECT';

export interface TaxGuardProductionRequest {
  path: string;
  method: string;
  origin?: string;
}

export interface TaxGuardProductionRequestDecision {
  runtime: TaxGuardRequestRuntime;
  allowed: boolean;
  spaFallbackAllowed: boolean;
  reason: string;
}

export class TaxGuardProductionRequestRouter {

  static route(
    request: TaxGuardProductionRequest
  ): Readonly<TaxGuardProductionRequestDecision> {

    const path =
      request.path.trim();

    const method =
      request.method
        .trim()
        .toUpperCase();

    if (
      !path.startsWith('/')
    ) {
      return Object.freeze({
        runtime: 'REJECT',
        allowed: false,
        spaFallbackAllowed: false,
        reason: 'INVALID_REQUEST_PATH'
      });
    }

    if (
      !method
    ) {
      return Object.freeze({
        runtime: 'REJECT',
        allowed: false,
        spaFallbackAllowed: false,
        reason: 'HTTP_METHOD_REQUIRED'
      });
    }

    if (
      path === '/api' ||
      path.startsWith('/api/')
    ) {
      return Object.freeze({
        runtime: 'NODE_API',
        allowed: true,
        spaFallbackAllowed: false,
        reason: 'API_REQUEST_REQUIRES_NODE_RUNTIME'
      });
    }

    return Object.freeze({
      runtime: 'STATIC_FRONTEND',
      allowed: true,
      spaFallbackAllowed: true,
      reason: 'FRONTEND_REQUEST'
    });
  }
}


// ============================================================
// AUTHENTICATION / SESSION READINESS
// ============================================================

export interface TaxGuardAuthenticationReadiness {
  firebaseClientConfigured: boolean;
  firebaseAdminConfigured: boolean;
  firebaseTokenVerificationAvailable: boolean;
  firebaseSessionRouteAvailable: boolean;
  applicationSessionCreationAvailable: boolean;
  userProfilePersistenceAvailable: boolean;
  tenantIsolationAvailable: boolean;
  clientIsolationAvailable: boolean;
}

export interface TaxGuardAuthenticationReadinessResult {
  ready: boolean;
  blockers: readonly string[];
}

export class TaxGuardAuthenticationReadinessGate {

  static evaluate(
    input: TaxGuardAuthenticationReadiness
  ): Readonly<TaxGuardAuthenticationReadinessResult> {

    const blockers: string[] = [];

    if (!input.firebaseClientConfigured) {
      blockers.push(
        'FIREBASE_CLIENT_NOT_CONFIGURED'
      );
    }

    if (!input.firebaseAdminConfigured) {
      blockers.push(
        'FIREBASE_ADMIN_NOT_CONFIGURED'
      );
    }

    if (!input.firebaseTokenVerificationAvailable) {
      blockers.push(
        'FIREBASE_TOKEN_VERIFICATION_UNAVAILABLE'
      );
    }

    if (!input.firebaseSessionRouteAvailable) {
      blockers.push(
        'FIREBASE_SESSION_ROUTE_UNAVAILABLE'
      );
    }

    if (!input.applicationSessionCreationAvailable) {
      blockers.push(
        'APPLICATION_SESSION_CREATION_UNAVAILABLE'
      );
    }

    if (!input.userProfilePersistenceAvailable) {
      blockers.push(
        'USER_PROFILE_PERSISTENCE_UNAVAILABLE'
      );
    }

    if (!input.tenantIsolationAvailable) {
      blockers.push(
        'TENANT_ISOLATION_UNAVAILABLE'
      );
    }

    if (!input.clientIsolationAvailable) {
      blockers.push(
        'CLIENT_ISOLATION_UNAVAILABLE'
      );
    }

    return Object.freeze({
      ready: blockers.length === 0,
      blockers: Object.freeze([
        ...blockers
      ])
    });
  }
}


// ============================================================
// PRODUCTION SESSION VERIFICATION
// ============================================================

export interface TaxGuardProductionSessionVerification {
  verificationId: string;

  firebaseAuthenticationPassed: boolean;
  idTokenObtained: boolean;
  idTokenAcceptedByServer: boolean;

  firebaseSessionPostReachedNodeApi: boolean;

  applicationSessionCreated: boolean;

  authenticatedUserResolved: boolean;
  permanentClientIdResolved: boolean;

  tenantBoundaryVerified: boolean;
  clientBoundaryVerified: boolean;

  statusCode: number;

  verifiedAt: string;

  verifiedBy: string;
}

export interface TaxGuardProductionSessionDecision {
  passed: boolean;
  blockers: readonly string[];
}

function requiredText(
  value: string,
  error: string
): void {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw new Error(error);
  }
}

export class TaxGuardProductionSessionGate {

  static evaluate(
    verification:
      TaxGuardProductionSessionVerification
  ): Readonly<TaxGuardProductionSessionDecision> {

    requiredText(
      verification.verificationId,
      'TG_PROD_SESSION_VERIFICATION_ID_REQUIRED'
    );

    requiredText(
      verification.verifiedBy,
      'TG_PROD_SESSION_VERIFIER_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          verification.verifiedAt
        )
      )
    ) {
      throw new Error(
        'TG_PROD_SESSION_TIMESTAMP_INVALID'
      );
    }

    const blockers: string[] = [];

    if (!verification.firebaseAuthenticationPassed) {
      blockers.push(
        'FIREBASE_AUTHENTICATION_NOT_PASSED'
      );
    }

    if (!verification.idTokenObtained) {
      blockers.push(
        'FIREBASE_ID_TOKEN_NOT_OBTAINED'
      );
    }

    if (!verification.idTokenAcceptedByServer) {
      blockers.push(
        'FIREBASE_ID_TOKEN_NOT_ACCEPTED'
      );
    }

    if (!verification.firebaseSessionPostReachedNodeApi) {
      blockers.push(
        'SESSION_POST_DID_NOT_REACH_NODE_API'
      );
    }

    if (!verification.applicationSessionCreated) {
      blockers.push(
        'APPLICATION_SESSION_NOT_CREATED'
      );
    }

    if (!verification.authenticatedUserResolved) {
      blockers.push(
        'AUTHENTICATED_USER_NOT_RESOLVED'
      );
    }

    if (!verification.permanentClientIdResolved) {
      blockers.push(
        'PERMANENT_CLIENT_ID_NOT_RESOLVED'
      );
    }

    if (!verification.tenantBoundaryVerified) {
      blockers.push(
        'TENANT_BOUNDARY_NOT_VERIFIED'
      );
    }

    if (!verification.clientBoundaryVerified) {
      blockers.push(
        'CLIENT_BOUNDARY_NOT_VERIFIED'
      );
    }

    if (
      verification.statusCode === 405
    ) {
      blockers.push(
        'HTTP_405_RELEASE_BLOCKER'
      );
    }

    if (
      verification.statusCode < 200 ||
      verification.statusCode >= 300
    ) {
      blockers.push(
        'SESSION_HTTP_SUCCESS_NOT_VERIFIED'
      );
    }

    return Object.freeze({
      passed: blockers.length === 0,

      blockers: Object.freeze([
        ...blockers
      ])
    });
  }
}


// ============================================================
// PRODUCTION DATABASE VERIFICATION
// ============================================================

export interface TaxGuardProductionDatabaseVerification {
  connected: boolean;
  authenticated: boolean;

  readPassed: boolean;
  writePassed: boolean;

  auditWritePassed: boolean;

  permanentClientIdPersistencePassed: boolean;

  tenantIsolationPassed: boolean;
  clientIsolationPassed: boolean;
}

export class TaxGuardProductionDatabaseGate {

  static evaluate(
    input:
      TaxGuardProductionDatabaseVerification
  ): Readonly<{
    passed: boolean;
    blockers: readonly string[];
  }> {

    const blockers: string[] = [];

    if (!input.connected) {
      blockers.push(
        'PRODUCTION_DATABASE_NOT_CONNECTED'
      );
    }

    if (!input.authenticated) {
      blockers.push(
        'PRODUCTION_DATABASE_NOT_AUTHENTICATED'
      );
    }

    if (!input.readPassed) {
      blockers.push(
        'PRODUCTION_DATABASE_READ_NOT_VERIFIED'
      );
    }

    if (!input.writePassed) {
      blockers.push(
        'PRODUCTION_DATABASE_WRITE_NOT_VERIFIED'
      );
    }

    if (!input.auditWritePassed) {
      blockers.push(
        'PRODUCTION_AUDIT_WRITE_NOT_VERIFIED'
      );
    }

    if (!input.permanentClientIdPersistencePassed) {
      blockers.push(
        'PERMANENT_CLIENT_ID_PERSISTENCE_NOT_VERIFIED'
      );
    }

    if (!input.tenantIsolationPassed) {
      blockers.push(
        'PRODUCTION_TENANT_ISOLATION_NOT_VERIFIED'
      );
    }

    if (!input.clientIsolationPassed) {
      blockers.push(
        'PRODUCTION_CLIENT_ISOLATION_NOT_VERIFIED'
      );
    }

    return Object.freeze({
      passed: blockers.length === 0,

      blockers: Object.freeze([
        ...blockers
      ])
    });
  }
}


// ============================================================
// DEPLOYMENT VERIFICATION RECORD
// ============================================================

export type TaxGuardProductionVerificationType =
  | 'HEALTH'
  | 'API_ROUTING'
  | 'CORS'
  | 'AUTHENTICATION'
  | 'SESSION'
  | 'DATABASE'
  | 'TENANT_ISOLATION'
  | 'DOCUMENT_INTELLIGENCE'
  | 'AUDIT'
  | 'MONITORING'
  | 'BACKUP_RESTORE'
  | 'SECURITY'
  | 'END_TO_END';

export interface TaxGuardProductionVerificationRecord {
  verificationId: string;

  type:
    TaxGuardProductionVerificationType;

  passed:
    boolean;

  evidence:
    readonly string[];

  verifiedAt:
    string;

  verifiedBy:
    string;

  immutable:
    true;
}

export class TaxGuardProductionVerificationRegistry {

  private readonly records =
    new Map<
      string,
      Readonly<TaxGuardProductionVerificationRecord>
    >();

  register(
    record:
      TaxGuardProductionVerificationRecord
  ):
    Readonly<TaxGuardProductionVerificationRecord> {

    requiredText(
      record.verificationId,
      'TG_PROD_VERIFICATION_ID_REQUIRED'
    );

    requiredText(
      record.verifiedBy,
      'TG_PROD_VERIFIER_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          record.verifiedAt
        )
      )
    ) {
      throw new Error(
        'TG_PROD_VERIFICATION_TIMESTAMP_INVALID'
      );
    }

    if (
      record.passed &&
      record.evidence.length === 0
    ) {
      throw new Error(
        'TG_PROD_PASS_REQUIRES_EVIDENCE'
      );
    }

    if (
      record.immutable !== true
    ) {
      throw new Error(
        'TG_PROD_VERIFICATION_MUST_BE_IMMUTABLE'
      );
    }

    if (
      this.records.has(
        record.verificationId
      )
    ) {
      throw new Error(
        'TG_PROD_VERIFICATION_DUPLICATE'
      );
    }

    const stored =
      Object.freeze({
        ...record,

        evidence:
          Object.freeze([
            ...record.evidence
          ])
      });

    this.records.set(
      record.verificationId,
      stored
    );

    return stored;
  }

  list():
    readonly Readonly<TaxGuardProductionVerificationRecord>[] {

    return Object.freeze([
      ...this.records.values()
    ]);
  }

  hasPassed(
    type:
      TaxGuardProductionVerificationType
  ): boolean {

    return this.list()
      .some(
        record =>
          record.type === type &&
          record.passed
      );
  }
}


// ============================================================
// REQUIRED PRODUCTION VERIFICATION MATRIX
// ============================================================

export const TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS:
  readonly TaxGuardProductionVerificationType[] =
    Object.freeze([
      'HEALTH',
      'API_ROUTING',
      'CORS',
      'AUTHENTICATION',
      'SESSION',
      'DATABASE',
      'TENANT_ISOLATION',
      'DOCUMENT_INTELLIGENCE',
      'AUDIT',
      'MONITORING',
      'BACKUP_RESTORE',
      'SECURITY',
      'END_TO_END'
    ]);


// ============================================================
// FINAL DEPLOYMENT ACCEPTANCE
// ============================================================

export interface TaxGuardProductionAcceptanceInput {
  requiredVerifications:
    readonly TaxGuardProductionVerificationRecord[];

  typecheckPassed: boolean;
  regressionPassed: boolean;
  buildPassed: boolean;

  http405Resolved: boolean;

  authorizedHumanApproval: boolean;

  externalTaxFilingEnabled: false;
}

export interface TaxGuardProductionAcceptanceDecision {
  accepted: boolean;
  blockers: readonly string[];
}

export class TaxGuardProductionAcceptanceGate {

  static evaluate(
    input:
      TaxGuardProductionAcceptanceInput
  ): Readonly<TaxGuardProductionAcceptanceDecision> {

    const blockers: string[] = [];

    for (
      const requiredType
      of TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS
    ) {
      const passed =
        input.requiredVerifications
          .some(
            record =>
              record.type ===
                requiredType &&
              record.passed
          );

      if (!passed) {
        blockers.push(
          requiredType +
          '_NOT_VERIFIED'
        );
      }
    }

    if (!input.typecheckPassed) {
      blockers.push(
        'TYPECHECK_NOT_PASSED'
      );
    }

    if (!input.regressionPassed) {
      blockers.push(
        'REGRESSION_NOT_PASSED'
      );
    }

    if (!input.buildPassed) {
      blockers.push(
        'BUILD_NOT_PASSED'
      );
    }

    if (!input.http405Resolved) {
      blockers.push(
        'HTTP_405_NOT_RESOLVED'
      );
    }

    if (!input.authorizedHumanApproval) {
      blockers.push(
        'AUTHORIZED_HUMAN_APPROVAL_REQUIRED'
      );
    }

    if (
      input.externalTaxFilingEnabled !==
        false
    ) {
      blockers.push(
        'EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED'
      );
    }

    return Object.freeze({
      accepted:
        blockers.length === 0,

      blockers:
        Object.freeze([
          ...new Set(
            blockers
          )
        ])
    });
  }
}
`
);


// ============================================================
// BARREL EXPORT
// ============================================================

write(
  'src/taxguard/deployment/index.ts',
  String.raw`
export * from './TaxGuardProductionDeployment';
export * from './TaxGuardProductionRuntime';
export * from './TaxGuardProductionAdapter';
`
);


// ============================================================
// PRODUCTION DEPLOYMENT DOCUMENTATION
// ============================================================

write(
  'docs/production/PRODUCTION-DEPLOYMENT-ARCHITECTURE.md',
  String.raw`
# TaxGuard Production Deployment Architecture

## Required runtime boundary

TaxGuard production uses two runtime responsibilities.

### Frontend

The React/Vite application serves the user interface.

Frontend routes may use SPA fallback.

### API

All /api routes must execute on the TaxGuard Node/Express backend.

API routes must never fall through to the static frontend or index.html.

## Authentication flow

1. User authenticates through Firebase Authentication.
2. Browser obtains the Firebase ID token.
3. Browser POSTs the token to the TaxGuard firebase-session endpoint.
4. The request must reach the Node API runtime.
5. Firebase Admin verifies the token.
6. TaxGuard resolves the application user and permanent Client ID.
7. The server establishes the TaxGuard application session.
8. Authorization and client/tenant boundaries are enforced.

HTTP 405 on the session POST is a production release blocker.

## Production security

Production CORS must use explicit approved HTTPS origins.

Wildcard production origins are prohibited.

Server credentials and service-account private keys must remain server-side.

Secrets must not be committed to the repository or bundled into the frontend.

## Verification

Local unit tests do not prove that production infrastructure works.

Production must independently verify:

- health
- API routing
- CORS
- Firebase authentication
- application session
- database persistence
- tenant isolation
- document intelligence
- audit
- monitoring
- backup and restore
- security
- end-to-end workflow

## Tax filing

External electronic tax submission remains disabled until a separately authorized and validated filing integration is implemented.
`
);

console.log('');
console.log('============================================================');
console.log('Production Deployment Section 3 registered.');
console.log('Authentication/session/database verification gates added.');
console.log('Production verification registry added.');
console.log('Final production acceptance remains fail-closed.');
console.log('External tax filing remains DISABLED.');
console.log('============================================================');


// ============================================================
// SECTION 4
// TARGETED TESTS + BUILDER INTEGRITY
// ============================================================

write(
  'src/tests/taxGuardProductionDeployment.test.ts',
  String.raw`
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardProductionDeploymentGuard,
  TaxGuardProductionEndpointGuard,
  TaxGuardGoLiveGate,
  createTaxGuardProductionRoutingPolicy
} from '../taxguard/deployment/TaxGuardProductionDeployment';

import {
  TaxGuardProductionRuntimeGuard,
  TaxGuardProductionCorsPolicy,
  TaxGuardRuntimeRouteGuard,
  TaxGuardProductionHealthEvaluator,
  TaxGuardProductionEnvironmentGuard,
  TAXGUARD_PRODUCTION_DEPLOYMENT_MANIFEST,
  TAXGUARD_SECRET_SAFETY_POLICY
} from '../taxguard/deployment/TaxGuardProductionRuntime';

import {
  TaxGuardProductionRequestRouter,
  TaxGuardAuthenticationReadinessGate,
  TaxGuardProductionSessionGate,
  TaxGuardProductionDatabaseGate,
  TaxGuardProductionVerificationRegistry,
  TaxGuardProductionAcceptanceGate,
  TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS
} from '../taxguard/deployment/TaxGuardProductionAdapter';


describe(
  'TaxGuard Production Deployment',
  () => {

    it(
      'PD-01 validates production deployment context',
      () => {

        const result =
          TaxGuardProductionDeploymentGuard
            .validate({
              environment:
                'production',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              httpsRequired:
                true,

              externalTaxFilingEnabled:
                false,

              firebaseAuthenticationRequired:
                true,

              firebaseAdminRequired:
                true,

              persistentDatabaseRequired:
                true,

              staticHostingMayServeApi:
                false,

              deploymentId:
                'DEPLOY-001',

              correlationId:
                'CORR-001',

              createdAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.valid
        ).toBe(true);

        expect(
          result.status
        ).toBe(
          'READY_FOR_VERIFICATION'
        );
      }
    );


    it(
      'PD-02 blocks non-HTTPS production API',
      () => {

        const result =
          TaxGuardProductionDeploymentGuard
            .validate({
              environment:
                'production',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'http://api.example.com',

              httpsRequired:
                true,

              externalTaxFilingEnabled:
                false,

              firebaseAuthenticationRequired:
                true,

              firebaseAdminRequired:
                true,

              persistentDatabaseRequired:
                true,

              staticHostingMayServeApi:
                false,

              deploymentId:
                'DEPLOY-002',

              correlationId:
                'CORR-002',

              createdAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.blockers
        ).toContain(
          'PRODUCTION_API_REQUIRES_HTTPS'
        );
      }
    );


    it(
      'PD-03 treats HTTP 405 as release blocker',
      () => {

        const result =
          TaxGuardProductionEndpointGuard
            .evaluate({
              path:
                '/api/auth/firebase-session',

              method:
                'POST',

              status:
                405,

              contentType:
                'text/html',

              responseSource:
                'STATIC_FRONTEND'
            });

        expect(
          result.passed
        ).toBe(false);

        expect(
          result.releaseBlocked
        ).toBe(true);

        expect(
          result.reasons
        ).toContain(
          'HTTP_405_PRODUCTION_RELEASE_BLOCKER'
        );
      }
    );


    it(
      'PD-04 creates fail-closed production routing policy',
      () => {

        const policy =
          createTaxGuardProductionRoutingPolicy(
            'https://app.example.com',
            'https://api.example.com'
          );

        expect(
          policy.allowStaticFrontendFallbackForApi
        ).toBe(false);

        expect(
          policy.externalTaxFilingEnabled
        ).toBe(false);
      }
    );


    it(
      'PD-05 validates production runtime requirements',
      () => {

        const result =
          TaxGuardProductionRuntimeGuard
            .validate({
              mode:
                'PRODUCTION',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              port:
                8080,

              firebaseProjectIdPresent:
                true,

              firebaseAdminCredentialPresent:
                true,

              firestoreDatabaseIdPresent:
                true,

              sessionSecretPresent:
                true,

              documentIntelligenceConfigured:
                true,

              monitoringConfigured:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          result.valid
        ).toBe(true);
      }
    );


    it(
      'PD-06 blocks wildcard production CORS',
      () => {

        expect(
          () =>
            TaxGuardProductionCorsPolicy
              .create([
                '*'
              ])
        ).toThrow(
          'TG_CORS_PRODUCTION_ORIGIN_INVALID'
        );
      }
    );


    it(
      'PD-07 allows explicitly approved HTTPS origin',
      () => {

        const policy =
          TaxGuardProductionCorsPolicy
            .create([
              'https://app.example.com'
            ]);

        const decision =
          TaxGuardProductionCorsPolicy
            .evaluate(
              policy,
              'https://app.example.com',
              'POST',
              [
                'Content-Type',
                'Authorization'
              ]
            );

        expect(
          decision.allowed
        ).toBe(true);

        expect(
          decision.reason
        ).toBe(
          'ALLOWED'
        );
      }
    );


    it(
      'PD-08 forces API routes to Node runtime',
      () => {

        expect(
          () =>
            TaxGuardRuntimeRouteGuard
              .validate({
                path:
                  '/api/auth/firebase-session',

                runtime:
                  'STATIC_FRONTEND',

                spaFallbackAllowed:
                  false
              })
        ).toThrow(
          'TG_API_ROUTE_REQUIRES_NODE_RUNTIME'
        );
      }
    );


    it(
      'PD-09 blocks SPA fallback for API routes',
      () => {

        expect(
          () =>
            TaxGuardRuntimeRouteGuard
              .validate({
                path:
                  '/api/health',

                runtime:
                  'NODE_API',

                spaFallbackAllowed:
                  true
              })
        ).toThrow(
          'TG_API_ROUTE_SPA_FALLBACK_BLOCKED'
        );
      }
    );


    it(
      'PD-10 evaluates required production health',
      () => {

        const result =
          TaxGuardProductionHealthEvaluator
            .evaluate([
              {
                component:
                  'API',

                healthy:
                  true,

                required:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                component:
                  'FIREBASE_ADMIN',

                healthy:
                  true,

                required:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                component:
                  'DATABASE',

                healthy:
                  true,

                required:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              }
            ]);

        expect(
          result.ready
        ).toBe(true);

        expect(
          result.status
        ).toBe(
          'HEALTHY'
        );
      }
    );


    it(
      'PD-11 detects missing production environment values',
      () => {

        const result =
          TaxGuardProductionEnvironmentGuard
            .evaluate([
              {
                key:
                  'NODE_ENV',

                present:
                  true,

                secret:
                  false
              },

              {
                key:
                  'PORT',

                present:
                  true,

                secret:
                  false
              }
            ]);

        expect(
          result.ready
        ).toBe(false);

        expect(
          result.missing
        ).toContain(
          'TAXGUARD_API_ORIGIN'
        );

        expect(
          result.missing
        ).toContain(
          'TAXGUARD_SESSION_SECRET'
        );
      }
    );


    it(
      'PD-12 preserves deployment and secret-safety policy',
      () => {

        expect(
          TAXGUARD_PRODUCTION_DEPLOYMENT_MANIFEST
            .backendArtifact
        ).toBe(
          'dist/server.cjs'
        );

        expect(
          TAXGUARD_PRODUCTION_DEPLOYMENT_MANIFEST
            .spaFallbackExcludesApi
        ).toBe(true);

        expect(
          TAXGUARD_SECRET_SAFETY_POLICY
            .serviceAccountPrivateKeyInRepository
        ).toBe(false);

        expect(
          TAXGUARD_SECRET_SAFETY_POLICY
            .productionSecretsInFrontendBundle
        ).toBe(false);
      }
    );


    it(
      'PD-13 routes API requests to Node and frontend routes to SPA',
      () => {

        const api =
          TaxGuardProductionRequestRouter
            .route({
              path:
                '/api/auth/firebase-session',

              method:
                'POST'
            });

        const frontend =
          TaxGuardProductionRequestRouter
            .route({
              path:
                '/client/login',

              method:
                'GET'
            });

        expect(
          api.runtime
        ).toBe(
          'NODE_API'
        );

        expect(
          api.spaFallbackAllowed
        ).toBe(false);

        expect(
          frontend.runtime
        ).toBe(
          'STATIC_FRONTEND'
        );

        expect(
          frontend.spaFallbackAllowed
        ).toBe(true);
      }
    );


    it(
      'PD-14 authentication readiness fails closed',
      () => {

        const result =
          TaxGuardAuthenticationReadinessGate
            .evaluate({
              firebaseClientConfigured:
                true,

              firebaseAdminConfigured:
                true,

              firebaseTokenVerificationAvailable:
                true,

              firebaseSessionRouteAvailable:
                false,

              applicationSessionCreationAvailable:
                false,

              userProfilePersistenceAvailable:
                true,

              tenantIsolationAvailable:
                true,

              clientIsolationAvailable:
                true
            });

        expect(
          result.ready
        ).toBe(false);

        expect(
          result.blockers
        ).toContain(
          'FIREBASE_SESSION_ROUTE_UNAVAILABLE'
        );
      }
    );


    it(
      'PD-15 production session gate rejects 405',
      () => {

        const result =
          TaxGuardProductionSessionGate
            .evaluate({
              verificationId:
                'SESSION-001',

              firebaseAuthenticationPassed:
                true,

              idTokenObtained:
                true,

              idTokenAcceptedByServer:
                false,

              firebaseSessionPostReachedNodeApi:
                false,

              applicationSessionCreated:
                false,

              authenticatedUserResolved:
                false,

              permanentClientIdResolved:
                false,

              tenantBoundaryVerified:
                false,

              clientBoundaryVerified:
                false,

              statusCode:
                405,

              verifiedAt:
                '2026-09-24T00:00:00.000Z',

              verifiedBy:
                'authorized-reviewer'
            });

        expect(
          result.passed
        ).toBe(false);

        expect(
          result.blockers
        ).toContain(
          'HTTP_405_RELEASE_BLOCKER'
        );
      }
    );


    it(
      'PD-16 verifies complete server session path',
      () => {

        const result =
          TaxGuardProductionSessionGate
            .evaluate({
              verificationId:
                'SESSION-002',

              firebaseAuthenticationPassed:
                true,

              idTokenObtained:
                true,

              idTokenAcceptedByServer:
                true,

              firebaseSessionPostReachedNodeApi:
                true,

              applicationSessionCreated:
                true,

              authenticatedUserResolved:
                true,

              permanentClientIdResolved:
                true,

              tenantBoundaryVerified:
                true,

              clientBoundaryVerified:
                true,

              statusCode:
                200,

              verifiedAt:
                '2026-09-24T00:00:00.000Z',

              verifiedBy:
                'authorized-reviewer'
            });

        expect(
          result.passed
        ).toBe(true);
      }
    );


    it(
      'PD-17 verifies database isolation requirements',
      () => {

        const result =
          TaxGuardProductionDatabaseGate
            .evaluate({
              connected:
                true,

              authenticated:
                true,

              readPassed:
                true,

              writePassed:
                true,

              auditWritePassed:
                true,

              permanentClientIdPersistencePassed:
                true,

              tenantIsolationPassed:
                true,

              clientIsolationPassed:
                true
            });

        expect(
          result.passed
        ).toBe(true);
      }
    );


    it(
      'PD-18 requires evidence for passed production verification',
      () => {

        const registry =
          new TaxGuardProductionVerificationRegistry();

        expect(
          () =>
            registry.register({
              verificationId:
                'VERIFY-001',

              type:
                'API_ROUTING',

              passed:
                true,

              evidence:
                [],

              verifiedAt:
                '2026-09-24T00:00:00.000Z',

              verifiedBy:
                'authorized-reviewer',

              immutable:
                true
            })
        ).toThrow(
          'TG_PROD_PASS_REQUIRES_EVIDENCE'
        );
      }
    );


    it(
      'PD-19 stores immutable production verification',
      () => {

        const registry =
          new TaxGuardProductionVerificationRegistry();

        const record =
          registry.register({
            verificationId:
              'VERIFY-002',

            type:
              'HEALTH',

            passed:
              true,

            evidence:
              [
                'Production health endpoint HTTP 200'
              ],

            verifiedAt:
              '2026-09-24T00:00:00.000Z',

            verifiedBy:
              'authorized-reviewer',

            immutable:
              true
          });

        expect(
          Object.isFrozen(
            record
          )
        ).toBe(true);

        expect(
          registry.hasPassed(
            'HEALTH'
          )
        ).toBe(true);
      }
    );


    it(
      'PD-20 defines complete production verification matrix',
      () => {

        expect(
          TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS
        ).toContain(
          'API_ROUTING'
        );

        expect(
          TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS
        ).toContain(
          'AUTHENTICATION'
        );

        expect(
          TAXGUARD_REQUIRED_PRODUCTION_VERIFICATIONS
        ).toContain(
          'END_TO_END'
        );
      }
    );


    it(
      'PD-21 production acceptance fails closed',
      () => {

        const decision =
          TaxGuardProductionAcceptanceGate
            .evaluate({
              requiredVerifications:
                [],

              typecheckPassed:
                true,

              regressionPassed:
                true,

              buildPassed:
                true,

              http405Resolved:
                false,

              authorizedHumanApproval:
                false,

              externalTaxFilingEnabled:
                false
            });

        expect(
          decision.accepted
        ).toBe(false);

        expect(
          decision.blockers
        ).toContain(
          'HTTP_405_NOT_RESOLVED'
        );

        expect(
          decision.blockers
        ).toContain(
          'AUTHORIZED_HUMAN_APPROVAL_REQUIRED'
        );
      }
    );


    it(
      'PD-22 local success alone cannot authorize production',
      () => {

        const decision =
          TaxGuardGoLiveGate
            .evaluate({
              localTypecheckPassed:
                true,

              localTestsPassed:
                true,

              productionBuildPassed:
                true,

              productionHealthVerified:
                false,

              productionApiVerified:
                false,

              productionAuthenticationVerified:
                false,

              productionDatabaseVerified:
                false,

              http405Resolved:
                false,

              monitoringVerified:
                false,

              backupRestoreVerified:
                false,

              externalTaxFilingEnabled:
                false
            });

        expect(
          decision.approved
        ).toBe(false);

        expect(
          decision.status
        ).toBe(
          'BLOCKED'
        );
      }
    );
  }
);
`
);


// ============================================================
// BUILDER INTEGRITY CHECK
// ============================================================

const REQUIRED_DEPLOYMENT_FILES = [
  'src/taxguard/deployment/TaxGuardProductionDeployment.ts',
  'src/taxguard/deployment/TaxGuardProductionRuntime.ts',
  'src/taxguard/deployment/TaxGuardProductionAdapter.ts',
  'src/taxguard/deployment/index.ts',
  'src/tests/taxGuardProductionDeployment.test.ts',
  'docs/production/PRODUCTION-DEPLOYMENT-ARCHITECTURE.md'
];

let missingDeploymentFiles = 0;

console.log('');
console.log('============================================================');
console.log('TAXGUARD PRODUCTION DEPLOYMENT BUILDER');
console.log('============================================================');

for (
  const relativePath
  of REQUIRED_DEPLOYMENT_FILES
) {
  const absolutePath =
    path.join(
      ROOT,
      relativePath
    );

  if (
    fs.existsSync(
      absolutePath
    )
  ) {
    console.log(
      'Verified:',
      relativePath
    );
  } else {
    missingDeploymentFiles += 1;

    console.error(
      'MISSING:',
      relativePath
    );
  }
}

console.log('');

if (
  missingDeploymentFiles > 0
) {
  console.error(
    'Production Deployment source generation FAILED.'
  );

  console.error(
    'Missing files:',
    missingDeploymentFiles
  );

  process.exitCode = 1;
} else {
  console.log(
    'Production Deployment source generation PASSED.'
  );

  console.log('');
  console.log(
    'Local validation is required next.'
  );

  console.log(
    'Local validation does NOT prove production deployment.'
  );

  console.log(
    'Real HTTP 405 verification remains required.'
  );

  console.log(
    'External tax filing remains DISABLED.'
  );
}

console.log('============================================================');






