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
