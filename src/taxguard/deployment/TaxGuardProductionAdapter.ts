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
