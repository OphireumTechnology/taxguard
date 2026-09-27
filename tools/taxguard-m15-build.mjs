///////////// Ophireum Multimedia Productions
//////////// M15 Part 1 of 4 


import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function write(relativePath, content) {
  const target =
    path.join(root, relativePath);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true }
  );

  fs.writeFileSync(
    target,
    content.trimStart(),
    'utf8'
  );

  console.log(
    'Created:',
    relativePath
  );
}

write(
  'src/taxguard/production/TaxGuardProductionEnvironment.ts',
  String.raw`
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
`
);

write(
  'src/taxguard/production/TaxGuardProductionSecurity.ts',
  String.raw`
export type TaxGuardProductionRole =
  | 'CLIENT'
  | 'PREPARER'
  | 'REVIEWER'
  | 'CPA'
  | 'EA'
  | 'SEC_OPS'
  | 'ADMIN';

export interface TaxGuardAuthenticatedPrincipal {
  userId: string;

  clientId?: string;

  tenantId: string;

  roles:
    readonly TaxGuardProductionRole[];

  authenticated: true;

  sessionId: string;

  issuedAt: string;

  expiresAt: string;
}

export interface TaxGuardResourceScope {
  tenantId: string;

  clientId?: string;

  ownerUserId?: string;
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

export class TaxGuardAuthenticationGuard {

  static validatePrincipal(
    principal:
      TaxGuardAuthenticatedPrincipal,

    now =
      new Date()
  ): true {

    requireText(
      principal.userId,
      'TG_AUTH_USER_ID_REQUIRED'
    );

    requireText(
      principal.tenantId,
      'TG_AUTH_TENANT_ID_REQUIRED'
    );

    requireText(
      principal.sessionId,
      'TG_AUTH_SESSION_ID_REQUIRED'
    );

    if (
      principal.roles.length === 0
    ) {
      throw new Error(
        'TG_AUTH_ROLE_REQUIRED'
      );
    }

    const issuedAt =
      Date.parse(
        principal.issuedAt
      );

    const expiresAt =
      Date.parse(
        principal.expiresAt
      );

    if (
      !Number.isFinite(
        issuedAt
      ) ||
      !Number.isFinite(
        expiresAt
      )
    ) {
      throw new Error(
        'TG_AUTH_SESSION_TIME_INVALID'
      );
    }

    if (
      expiresAt <=
        now.getTime()
    ) {
      throw new Error(
        'TG_AUTH_SESSION_EXPIRED'
      );
    }

    if (
      issuedAt >
        now.getTime()
    ) {
      throw new Error(
        'TG_AUTH_SESSION_ISSUED_IN_FUTURE'
      );
    }

    return true;
  }
}

export class TaxGuardRoleAuthorizationGuard {

  static requireAnyRole(
    principal:
      TaxGuardAuthenticatedPrincipal,

    allowedRoles:
      readonly TaxGuardProductionRole[]
  ): true {

    TaxGuardAuthenticationGuard
      .validatePrincipal(
        principal
      );

    const authorized =
      principal.roles.some(
        role =>
          allowedRoles.includes(
            role
          )
      );

    if (!authorized) {
      throw new Error(
        'TG_AUTH_ROLE_FORBIDDEN'
      );
    }

    return true;
  }
}

export class TaxGuardTenantIsolationGuard {

  static assertAccess(
    principal:
      TaxGuardAuthenticatedPrincipal,

    resource:
      TaxGuardResourceScope
  ): true {

    TaxGuardAuthenticationGuard
      .validatePrincipal(
        principal
      );

    if (
      principal.tenantId !==
        resource.tenantId
    ) {
      throw new Error(
        'TG_TENANT_CROSS_TENANT_ACCESS_BLOCKED'
      );
    }

    if (
      principal.roles.includes(
        'CLIENT'
      )
    ) {
      if (
        !principal.clientId
      ) {
        throw new Error(
          'TG_TENANT_CLIENT_ID_REQUIRED'
        );
      }

      if (
        resource.clientId &&
        principal.clientId !==
          resource.clientId
      ) {
        throw new Error(
          'TG_TENANT_CROSS_CLIENT_ACCESS_BLOCKED'
        );
      }

      if (
        resource.ownerUserId &&
        principal.userId !==
          resource.ownerUserId
      ) {
        throw new Error(
          'TG_TENANT_RESOURCE_OWNER_MISMATCH'
        );
      }
    }

    return true;
  }
}

export interface TaxGuardSessionCookiePolicy {
  httpOnly: true;

  secure: true;

  sameSite:
    'strict' | 'lax';

  path: '/';

  maxAgeSeconds: number;
}

export class TaxGuardProductionSessionPolicy {

  static create(
    maxAgeSeconds:
      number
  ):
    TaxGuardSessionCookiePolicy {

    if (
      !Number.isInteger(
        maxAgeSeconds
      ) ||
      maxAgeSeconds <= 0 ||
      maxAgeSeconds >
        86400
    ) {
      throw new Error(
        'TG_AUTH_SESSION_MAX_AGE_INVALID'
      );
    }

    return Object.freeze({
      httpOnly:
        true,

      secure:
        true,

      sameSite:
        'lax',

      path:
        '/',

      maxAgeSeconds
    });
  }
}

export class TaxGuardAuthenticationBoundary {

  static browserCreatePrivilegedSession():
    never {

    throw new Error(
      'TG_AUTH_BROWSER_PRIVILEGED_SESSION_BLOCKED'
    );
  }

  static clientAssignOwnRole():
    never {

    throw new Error(
      'TG_AUTH_CLIENT_ROLE_ASSIGNMENT_BLOCKED'
    );
  }

  static bypassTenantIsolation():
    never {

    throw new Error(
      'TG_TENANT_ISOLATION_BYPASS_BLOCKED'
    );
  }
}
`
);

write(
  'src/taxguard/production/TaxGuardProductionApi.ts',
  String.raw`
export type TaxGuardApiMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE';

export interface TaxGuardApiRouteContract {
  routeId: string;

  method:
    TaxGuardApiMethod;

  path: string;

  authenticationRequired:
    boolean;

  csrfProtected:
    boolean;

  productionEnabled:
    boolean;
}

export interface TaxGuardApiRequestContext {
  method:
    TaxGuardApiMethod;

  path: string;

  origin?: string;

  authenticated:
    boolean;

  csrfValid:
    boolean;
}

export interface TaxGuardCorsPolicy {
  allowedOrigins:
    readonly string[];

  allowCredentials:
    true;

  allowedMethods:
    readonly TaxGuardApiMethod[];
}

function normalizeOrigin(
  value: string
): string {

  let parsed: URL;

  try {
    parsed =
      new URL(
        value.trim()
      );
  } catch {
    throw new Error(
      'TG_API_ORIGIN_INVALID'
    );
  }

  if (
    parsed.protocol !==
      'https:' &&
    parsed.protocol !==
      'http:'
  ) {
    throw new Error(
      'TG_API_ORIGIN_PROTOCOL_INVALID'
    );
  }

  return parsed.origin;
}

export class TaxGuardCorsGuard {

  static createPolicy(
    origins:
      readonly string[]
  ):
    TaxGuardCorsPolicy {

    const normalized =
      [
        ...new Set(
          origins.map(
            normalizeOrigin
          )
        )
      ];

    if (
      normalized.length === 0
    ) {
      throw new Error(
        'TG_API_ALLOWED_ORIGIN_REQUIRED'
      );
    }

    if (
      normalized.includes('*')
    ) {
      throw new Error(
        'TG_API_WILDCARD_ORIGIN_BLOCKED'
      );
    }

    const allowedMethods:
      readonly TaxGuardApiMethod[] = [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE'
      ];

    return Object.freeze({
      allowedOrigins:
        normalized,

      allowCredentials:
        true,

      allowedMethods
    });
  }

  static assertOrigin(
    policy:
      TaxGuardCorsPolicy,

    origin:
      string
  ): true {

    const normalized =
      normalizeOrigin(
        origin
      );

    if (
      !policy.allowedOrigins
        .includes(
          normalized
        )
    ) {
      throw new Error(
        'TG_API_ORIGIN_FORBIDDEN'
      );
    }

    return true;
  }
}

export class TaxGuardApiRouteRegistry {

  private readonly routes =
    new Map<
      string,
      TaxGuardApiRouteContract
    >();

  register(
    route:
      TaxGuardApiRouteContract
  ):
    TaxGuardApiRouteContract {

    if (
      !route.routeId.trim()
    ) {
      throw new Error(
        'TG_API_ROUTE_ID_REQUIRED'
      );
    }

    if (
      !route.path.startsWith(
        '/'
      )
    ) {
      throw new Error(
        'TG_API_ROUTE_PATH_INVALID'
      );
    }

    if (
      this.routes.has(
        route.routeId
      )
    ) {
      throw new Error(
        'TG_API_ROUTE_DUPLICATE'
      );
    }

    const duplicateRoute =
      [
        ...this.routes.values()
      ].some(
        existing =>
          existing.method ===
            route.method &&
          existing.path ===
            route.path
      );

    if (duplicateRoute) {
      throw new Error(
        'TG_API_METHOD_PATH_DUPLICATE'
      );
    }

    const stored =
      Object.freeze({
        ...route
      });

    this.routes.set(
      route.routeId,
      stored
    );

    return {
      ...stored
    };
  }

  get(
    routeId: string
  ):
    TaxGuardApiRouteContract {

    const route =
      this.routes.get(
        routeId
      );

    if (!route) {
      throw new Error(
        'TG_API_ROUTE_NOT_FOUND'
      );
    }

    return {
      ...route
    };
  }
}

export class TaxGuardApiRequestGuard {

  static assertAllowed(
    route:
      TaxGuardApiRouteContract,

    request:
      TaxGuardApiRequestContext
  ): true {

    if (
      !route.productionEnabled
    ) {
      throw new Error(
        'TG_API_ROUTE_DISABLED'
      );
    }

    if (
      request.method !==
        route.method
    ) {
      throw new Error(
        'TG_API_METHOD_NOT_ALLOWED'
      );
    }

    if (
      request.path !==
        route.path
    ) {
      throw new Error(
        'TG_API_PATH_MISMATCH'
      );
    }

    if (
      route.authenticationRequired &&
      !request.authenticated
    ) {
      throw new Error(
        'TG_API_AUTHENTICATION_REQUIRED'
      );
    }

    if (
      route.csrfProtected &&
      !request.csrfValid
    ) {
      throw new Error(
        'TG_API_CSRF_REQUIRED'
      );
    }

    return true;
  }
}

export interface TaxGuardFrontendApiBinding {
  frontendOrigin: string;

  apiBaseUrl: string;

  authSessionPath: string;

  healthPath: string;

  productionReady: boolean;
}

export class TaxGuardFrontendApiBindingValidator {

  static validate(
    binding:
      TaxGuardFrontendApiBinding
  ):
    TaxGuardFrontendApiBinding {

    const frontend =
      normalizeOrigin(
        binding.frontendOrigin
      );

    let api: URL;

    try {
      api =
        new URL(
          binding.apiBaseUrl
        );
    } catch {
      throw new Error(
        'TG_API_BASE_URL_INVALID'
      );
    }

    if (
      api.protocol !==
        'https:'
    ) {
      throw new Error(
        'TG_API_PRODUCTION_HTTPS_REQUIRED'
      );
    }

    if (
      !binding.authSessionPath
        .startsWith('/')
    ) {
      throw new Error(
        'TG_API_AUTH_SESSION_PATH_INVALID'
      );
    }

    if (
      !binding.healthPath
        .startsWith('/')
    ) {
      throw new Error(
        'TG_API_HEALTH_PATH_INVALID'
      );
    }

    if (
      !binding.productionReady
    ) {
      throw new Error(
        'TG_API_BINDING_NOT_PRODUCTION_READY'
      );
    }

    return Object.freeze({
      ...binding,

      frontendOrigin:
        frontend,

      apiBaseUrl:
        api.toString()
          .replace(
            /\/$/,
            ''
          )
    });
  }
}

export class TaxGuardProductionRoutingBoundary {

  static staticHostingAsApiBackend():
    never {

    throw new Error(
      'TG_API_STATIC_HOSTING_BACKEND_BLOCKED'
    );
  }

  static silentApiFallback():
    never {

    throw new Error(
      'TG_API_SILENT_FALLBACK_BLOCKED'
    );
  }

  static externalTaxSubmission():
    never {

    throw new Error(
      'TG_EXTERNAL_TAX_SUBMISSION_DISABLED'
    );
  }
}
`
);



//////////  M15 Part 2 of 4 — Security, Audit, Rate Limiting, Health & Recovery

write(
  'src/taxguard/production/TaxGuardProductionOperations.ts',
  String.raw`
export type TaxGuardProductionHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNHEALTHY';

export type TaxGuardDependencyName =
  | 'DATABASE'
  | 'AUTH'
  | 'DOCUMENT_INTELLIGENCE'
  | 'AUDIT_LEDGER';

export interface TaxGuardDependencyHealth {
  dependency:
    TaxGuardDependencyName;

  healthy:
    boolean;

  checkedAt:
    string;

  latencyMs?:
    number;

  reason?:
    string;
}

export interface TaxGuardReadinessResult {
  status:
    TaxGuardProductionHealthStatus;

  dependencies:
    readonly TaxGuardDependencyHealth[];

  ready:
    boolean;

  checkedAt:
    string;
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

export class TaxGuardProductionReadinessGate {

  static evaluate(
    dependencies:
      readonly TaxGuardDependencyHealth[]
  ):
    TaxGuardReadinessResult {

    if (
      dependencies.length === 0
    ) {
      throw new Error(
        'TG_PROD_HEALTH_DEPENDENCIES_REQUIRED'
      );
    }

    const required:
      readonly TaxGuardDependencyName[] = [
        'DATABASE',
        'AUTH',
        'AUDIT_LEDGER'
      ];

    for (
      const dependency
      of required
    ) {
      if (
        !dependencies.some(
          candidate =>
            candidate.dependency ===
              dependency
        )
      ) {
        throw new Error(
          'TG_PROD_HEALTH_REQUIRED_DEPENDENCY_MISSING:' +
          dependency
        );
      }
    }

    const unhealthy =
      dependencies.filter(
        dependency =>
          !dependency.healthy
      );

    const criticalUnhealthy =
      unhealthy.some(
        dependency =>
          required.includes(
            dependency.dependency
          )
      );

    const status:
      TaxGuardProductionHealthStatus =
        criticalUnhealthy
          ? 'UNHEALTHY'
          : unhealthy.length > 0
            ? 'DEGRADED'
            : 'HEALTHY';

    return {
      status,

      dependencies:
        dependencies.map(
          dependency => ({
            ...dependency
          })
        ),

      ready:
        status ===
          'HEALTHY',

      checkedAt:
        new Date()
          .toISOString()
    };
  }

  static assertReady(
    result:
      TaxGuardReadinessResult
  ): true {

    if (!result.ready) {
      throw new Error(
        'TG_PROD_NOT_READY:' +
        result.status
      );
    }

    return true;
  }
}

export interface TaxGuardRateLimitPolicy {
  policyId: string;

  windowSeconds: number;

  maximumRequests: number;

  blockSeconds: number;
}

export interface TaxGuardRateLimitObservation {
  principalKey: string;

  requestCount: number;

  windowStartedAt: string;
}

export class TaxGuardRateLimitGuard {

  static validatePolicy(
    policy:
      TaxGuardRateLimitPolicy
  ):
    TaxGuardRateLimitPolicy {

    requireText(
      policy.policyId,
      'TG_RATE_LIMIT_POLICY_ID_REQUIRED'
    );

    if (
      !Number.isInteger(
        policy.windowSeconds
      ) ||
      policy.windowSeconds <= 0
    ) {
      throw new Error(
        'TG_RATE_LIMIT_WINDOW_INVALID'
      );
    }

    if (
      !Number.isInteger(
        policy.maximumRequests
      ) ||
      policy.maximumRequests <= 0
    ) {
      throw new Error(
        'TG_RATE_LIMIT_MAX_REQUESTS_INVALID'
      );
    }

    if (
      !Number.isInteger(
        policy.blockSeconds
      ) ||
      policy.blockSeconds < 0
    ) {
      throw new Error(
        'TG_RATE_LIMIT_BLOCK_INVALID'
      );
    }

    return Object.freeze({
      ...policy
    });
  }

  static assertAllowed(
    policy:
      TaxGuardRateLimitPolicy,

    observation:
      TaxGuardRateLimitObservation
  ): true {

    requireText(
      observation.principalKey,
      'TG_RATE_LIMIT_PRINCIPAL_REQUIRED'
    );

    if (
      observation.requestCount >
        policy.maximumRequests
    ) {
      throw new Error(
        'TG_RATE_LIMIT_EXCEEDED'
      );
    }

    return true;
  }
}

export interface TaxGuardSecurityHeaderPolicy {
  contentTypeOptions:
    'nosniff';

  frameOptions:
    'DENY';

  referrerPolicy:
    'no-referrer';

  permissionsPolicy:
    string;

  strictTransportSecurity:
    string;

  contentSecurityPolicy:
    string;
}

export class TaxGuardSecurityHeaders {

  static production():
    TaxGuardSecurityHeaderPolicy {

    return Object.freeze({
      contentTypeOptions:
        'nosniff',

      frameOptions:
        'DENY',

      referrerPolicy:
        'no-referrer',

      permissionsPolicy:
        'camera=(), microphone=(), geolocation=()',

      strictTransportSecurity:
        'max-age=31536000; includeSubDomains',

      contentSecurityPolicy:
        "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    });
  }
}

export interface TaxGuardAuditIntegrityRecord {
  auditId: string;

  eventType: string;

  actorId: string;

  tenantId: string;

  correlationId: string;

  occurredAt: string;

  previousHash:
    string | null;

  payloadHash: string;

  recordHash: string;

  immutable: true;
}

export class TaxGuardAuditIntegrityGuard {

  static validate(
    record:
      TaxGuardAuditIntegrityRecord
  ): true {

    requireText(
      record.auditId,
      'TG_AUDIT_ID_REQUIRED'
    );

    requireText(
      record.eventType,
      'TG_AUDIT_EVENT_TYPE_REQUIRED'
    );

    requireText(
      record.actorId,
      'TG_AUDIT_ACTOR_REQUIRED'
    );

    requireText(
      record.tenantId,
      'TG_AUDIT_TENANT_REQUIRED'
    );

    requireText(
      record.correlationId,
      'TG_AUDIT_CORRELATION_REQUIRED'
    );

    if (
      !/^[a-f0-9]{64}$/i.test(
        record.payloadHash
      )
    ) {
      throw new Error(
        'TG_AUDIT_PAYLOAD_HASH_INVALID'
      );
    }

    if (
      !/^[a-f0-9]{64}$/i.test(
        record.recordHash
      )
    ) {
      throw new Error(
        'TG_AUDIT_RECORD_HASH_INVALID'
      );
    }

    if (
      record.previousHash !==
        null &&
      !/^[a-f0-9]{64}$/i.test(
        record.previousHash
      )
    ) {
      throw new Error(
        'TG_AUDIT_PREVIOUS_HASH_INVALID'
      );
    }

    if (
      !Number.isFinite(
        Date.parse(
          record.occurredAt
        )
      )
    ) {
      throw new Error(
        'TG_AUDIT_TIMESTAMP_INVALID'
      );
    }

    return true;
  }

  static mutateRecord():
    never {

    throw new Error(
      'TG_AUDIT_MUTATION_BLOCKED'
    );
  }

  static deleteRecord():
    never {

    throw new Error(
      'TG_AUDIT_DELETION_BLOCKED'
    );
  }
}

export interface TaxGuardBackupPolicy {
  policyId: string;

  encrypted:
    true;

  retentionDays:
    number;

  recoveryPointObjectiveMinutes:
    number;

  recoveryTimeObjectiveMinutes:
    number;

  restoreTestRequired:
    true;
}

export class TaxGuardBackupRecoveryGuard {

  static validatePolicy(
    policy:
      TaxGuardBackupPolicy
  ):
    TaxGuardBackupPolicy {

    requireText(
      policy.policyId,
      'TG_BACKUP_POLICY_ID_REQUIRED'
    );

    if (
      !policy.encrypted
    ) {
      throw new Error(
        'TG_BACKUP_ENCRYPTION_REQUIRED'
      );
    }

    if (
      !Number.isInteger(
        policy.retentionDays
      ) ||
      policy.retentionDays <= 0
    ) {
      throw new Error(
        'TG_BACKUP_RETENTION_INVALID'
      );
    }

    if (
      !Number.isInteger(
        policy.recoveryPointObjectiveMinutes
      ) ||
      policy.recoveryPointObjectiveMinutes <= 0
    ) {
      throw new Error(
        'TG_BACKUP_RPO_INVALID'
      );
    }

    if (
      !Number.isInteger(
        policy.recoveryTimeObjectiveMinutes
      ) ||
      policy.recoveryTimeObjectiveMinutes <= 0
    ) {
      throw new Error(
        'TG_BACKUP_RTO_INVALID'
      );
    }

    if (
      !policy.restoreTestRequired
    ) {
      throw new Error(
        'TG_BACKUP_RESTORE_TEST_REQUIRED'
      );
    }

    return Object.freeze({
      ...policy
    });
  }
}

export interface TaxGuardFailureEvent {
  failureId: string;

  component: string;

  severity:
    'ROUTINE' |
    'MATERIAL' |
    'CRITICAL';

  correlationId: string;

  detectedAt: string;

  failClosed:
    boolean;
}

export class TaxGuardBusinessContinuityGuard {

  static assertFailureSafe(
    event:
      TaxGuardFailureEvent
  ): true {

    requireText(
      event.failureId,
      'TG_BCP_FAILURE_ID_REQUIRED'
    );

    requireText(
      event.component,
      'TG_BCP_COMPONENT_REQUIRED'
    );

    requireText(
      event.correlationId,
      'TG_BCP_CORRELATION_REQUIRED'
    );

    if (
      event.severity ===
        'CRITICAL' &&
      !event.failClosed
    ) {
      throw new Error(
        'TG_BCP_CRITICAL_FAILURE_MUST_FAIL_CLOSED'
      );
    }

    return true;
  }
}
`
);

write(
  'src/taxguard/production/TaxGuardProductionRelease.ts',
  String.raw`
import type {
  TaxGuardProductionEnvironmentRecord,
  TaxGuardSecretValidationResult
} from './TaxGuardProductionEnvironment';

import type {
  TaxGuardReadinessResult
} from './TaxGuardProductionOperations';

export interface TaxGuardProductionDatabaseState {
  connected: boolean;

  tenantIsolationEnabled:
    boolean;

  encryptedInTransit:
    boolean;

  backupConfigured:
    boolean;

  migrationCurrent:
    boolean;
}

export interface TaxGuardDeploymentVerification {
  deploymentId: string;

  environment:
    'production';

  frontendReachable:
    boolean;

  apiReachable:
    boolean;

  authRouteReachable:
    boolean;

  healthRouteReachable:
    boolean;

  databaseReachable:
    boolean;

  corsValidated:
    boolean;

  sessionValidated:
    boolean;

  testedAt: string;
}

export interface TaxGuardProductionReleaseInput {
  environment:
    TaxGuardProductionEnvironmentRecord;

  secrets:
    TaxGuardSecretValidationResult;

  readiness:
    TaxGuardReadinessResult;

  database:
    TaxGuardProductionDatabaseState;

  deployment:
    TaxGuardDeploymentVerification;

  regressionPassed:
    boolean;

  buildPassed:
    boolean;

  typecheckPassed:
    boolean;

  securityRegressionPassed:
    boolean;

  externalTaxFilingEnabled:
    boolean;
}

export interface TaxGuardProductionReleaseDecision {
  releaseAllowed:
    boolean;

  blockers:
    readonly string[];

  evaluatedAt:
    string;

  externalTaxFilingEnabled:
    false;
}

export class TaxGuardProductionReleaseGate {

  static evaluate(
    input:
      TaxGuardProductionReleaseInput
  ):
    TaxGuardProductionReleaseDecision {

    const blockers:
      string[] = [];

    if (
      input.environment
        .environment !==
        'production' ||
      !input.environment
        .productionValidated
    ) {
      blockers.push(
        'PRODUCTION_ENVIRONMENT_NOT_VALIDATED'
      );
    }

    if (!input.secrets.valid) {
      blockers.push(
        'PRODUCTION_SECRETS_INVALID'
      );
    }

    if (!input.readiness.ready) {
      blockers.push(
        'PRODUCTION_NOT_READY'
      );
    }

    if (
      !input.database.connected
    ) {
      blockers.push(
        'DATABASE_NOT_CONNECTED'
      );
    }

    if (
      !input.database
        .tenantIsolationEnabled
    ) {
      blockers.push(
        'DATABASE_TENANT_ISOLATION_REQUIRED'
      );
    }

    if (
      !input.database
        .encryptedInTransit
    ) {
      blockers.push(
        'DATABASE_TRANSPORT_ENCRYPTION_REQUIRED'
      );
    }

    if (
      !input.database
        .backupConfigured
    ) {
      blockers.push(
        'DATABASE_BACKUP_REQUIRED'
      );
    }

    if (
      !input.database
        .migrationCurrent
    ) {
      blockers.push(
        'DATABASE_MIGRATION_NOT_CURRENT'
      );
    }

    const deploymentChecks = [
      input.deployment.frontendReachable,
      input.deployment.apiReachable,
      input.deployment.authRouteReachable,
      input.deployment.healthRouteReachable,
      input.deployment.databaseReachable,
      input.deployment.corsValidated,
      input.deployment.sessionValidated
    ];

    if (
      deploymentChecks.some(
        check => !check
      )
    ) {
      blockers.push(
        'DEPLOYMENT_VERIFICATION_FAILED'
      );
    }

    if (
      !input.regressionPassed
    ) {
      blockers.push(
        'REGRESSION_NOT_PASSED'
      );
    }

    if (
      !input.buildPassed
    ) {
      blockers.push(
        'BUILD_NOT_PASSED'
      );
    }

    if (
      !input.typecheckPassed
    ) {
      blockers.push(
        'TYPECHECK_NOT_PASSED'
      );
    }

    if (
      !input.securityRegressionPassed
    ) {
      blockers.push(
        'SECURITY_REGRESSION_NOT_PASSED'
      );
    }

    if (
      input.externalTaxFilingEnabled
    ) {
      blockers.push(
        'EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED'
      );
    }

    return Object.freeze({
      releaseAllowed:
        blockers.length === 0,

      blockers: [
        ...blockers
      ],

      evaluatedAt:
        new Date()
          .toISOString(),

      externalTaxFilingEnabled:
        false
    });
  }

  static assertReleaseAllowed(
    decision:
      TaxGuardProductionReleaseDecision
  ): true {

    if (
      !decision.releaseAllowed
    ) {
      throw new Error(
        'TG_PROD_RELEASE_BLOCKED:' +
        decision.blockers.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardProductionDeploymentBoundary {

  static deployWithoutRegression():
    never {

    throw new Error(
      'TG_PROD_DEPLOY_WITHOUT_REGRESSION_BLOCKED'
    );
  }

  static deployWithoutBackup():
    never {

    throw new Error(
      'TG_PROD_DEPLOY_WITHOUT_BACKUP_BLOCKED'
    );
  }

  static deployWithBrokenAuthentication():
    never {

    throw new Error(
      'TG_PROD_DEPLOY_WITH_BROKEN_AUTH_BLOCKED'
    );
  }

  static enableExternalTaxFiling():
    never {

    throw new Error(
      'TG_EXTERNAL_TAX_FILING_DISABLED'
    );
  }
}
`
);


//////// M15 Part 3 of 4 — Deployment Verification, 405 Protection, Monitoring & Exports

///////////// Ophireum Multimedia Productions

write(
  'src/taxguard/production/TaxGuardProductionDeployment.ts',
  String.raw`
export type TaxGuardDeploymentCheckStatus =
  | 'PASS'
  | 'FAIL'
  | 'NOT_CHECKED';

export interface TaxGuardEndpointCheck {
  checkId: string;

  name: string;

  url: string;

  expectedMethod:
    'GET' |
    'POST' |
    'PUT' |
    'PATCH' |
    'DELETE';

  expectedStatusCodes:
    readonly number[];

  actualStatusCode?:
    number;

  status:
    TaxGuardDeploymentCheckStatus;

  checkedAt?:
    string;
}

export interface TaxGuardDeploymentReport {
  deploymentId: string;

  frontend:
    TaxGuardEndpointCheck;

  apiHealth:
    TaxGuardEndpointCheck;

  authentication:
    TaxGuardEndpointCheck;

  allRequiredChecksPassed:
    boolean;

  generatedAt:
    string;
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

function requireHttpUrl(
  value: string,
  code: string
): URL {

  let parsed: URL;

  try {
    parsed =
      new URL(
        value.trim()
      );
  } catch {
    throw new Error(code);
  }

  if (
    parsed.protocol !== 'http:' &&
    parsed.protocol !== 'https:'
  ) {
    throw new Error(code);
  }

  return parsed;
}

export class TaxGuardDeploymentCheckGuard {

  static validate(
    check:
      TaxGuardEndpointCheck
  ):
    TaxGuardEndpointCheck {

    requireText(
      check.checkId,
      'TG_DEPLOY_CHECK_ID_REQUIRED'
    );

    requireText(
      check.name,
      'TG_DEPLOY_CHECK_NAME_REQUIRED'
    );

    requireHttpUrl(
      check.url,
      'TG_DEPLOY_CHECK_URL_INVALID'
    );

    if (
      check.expectedStatusCodes
        .length === 0
    ) {
      throw new Error(
        'TG_DEPLOY_EXPECTED_STATUS_REQUIRED'
      );
    }

    for (
      const status
      of check.expectedStatusCodes
    ) {
      if (
        !Number.isInteger(status) ||
        status < 100 ||
        status > 599
      ) {
        throw new Error(
          'TG_DEPLOY_EXPECTED_STATUS_INVALID'
        );
      }
    }

    if (
      check.status === 'PASS'
    ) {
      if (
        check.actualStatusCode ===
          undefined
      ) {
        throw new Error(
          'TG_DEPLOY_ACTUAL_STATUS_REQUIRED'
        );
      }

      if (
        !check.expectedStatusCodes
          .includes(
            check.actualStatusCode
          )
      ) {
        throw new Error(
          'TG_DEPLOY_STATUS_MISMATCH'
        );
      }
    }

    return Object.freeze({
      ...check,

      expectedStatusCodes: [
        ...check.expectedStatusCodes
      ]
    });
  }
}

export class TaxGuardDeploymentReportBuilder {

  static build(
    deploymentId:
      string,

    frontend:
      TaxGuardEndpointCheck,

    apiHealth:
      TaxGuardEndpointCheck,

    authentication:
      TaxGuardEndpointCheck
  ):
    TaxGuardDeploymentReport {

    requireText(
      deploymentId,
      'TG_DEPLOYMENT_ID_REQUIRED'
    );

    const validatedFrontend =
      TaxGuardDeploymentCheckGuard
        .validate(
          frontend
        );

    const validatedHealth =
      TaxGuardDeploymentCheckGuard
        .validate(
          apiHealth
        );

    const validatedAuth =
      TaxGuardDeploymentCheckGuard
        .validate(
          authentication
        );

    const allPassed =
      [
        validatedFrontend,
        validatedHealth,
        validatedAuth
      ].every(
        check =>
          check.status === 'PASS'
      );

    return Object.freeze({
      deploymentId,

      frontend:
        validatedFrontend,

      apiHealth:
        validatedHealth,

      authentication:
        validatedAuth,

      allRequiredChecksPassed:
        allPassed,

      generatedAt:
        new Date()
          .toISOString()
    });
  }
}

export interface TaxGuardAuthenticationRouteContract {
  method:
    'POST';

  path: string;

  acceptsFirebaseIdToken:
    true;

  createsServerSession:
    true;

  staticHostingRoute:
    false;
}

export class TaxGuardAuthenticationRouteGuard {

  static validate(
    route:
      TaxGuardAuthenticationRouteContract
  ):
    TaxGuardAuthenticationRouteContract {

    if (
      route.method !== 'POST'
    ) {
      throw new Error(
        'TG_AUTH_ROUTE_POST_REQUIRED'
      );
    }

    if (
      !route.path.startsWith('/')
    ) {
      throw new Error(
        'TG_AUTH_ROUTE_PATH_INVALID'
      );
    }

    if (
      !route.acceptsFirebaseIdToken
    ) {
      throw new Error(
        'TG_AUTH_FIREBASE_TOKEN_REQUIRED'
      );
    }

    if (
      !route.createsServerSession
    ) {
      throw new Error(
        'TG_AUTH_SERVER_SESSION_REQUIRED'
      );
    }

    if (
      route.staticHostingRoute
    ) {
      throw new Error(
        'TG_AUTH_STATIC_HOSTING_ROUTE_BLOCKED'
      );
    }

    return Object.freeze({
      ...route
    });
  }
}

export interface TaxGuardHttp405Diagnosis {
  requestedMethod: string;

  requestedUrl: string;

  responseStatus:
    number;

  backendExpected:
    boolean;

  staticHostingDetected:
    boolean;

  routeConfigured:
    boolean;
}

export interface TaxGuardHttp405DiagnosisResult {
  is405:
    boolean;

  probableRoutingFailure:
    boolean;

  productionBlocked:
    boolean;

  reasons:
    readonly string[];
}

export class TaxGuardHttp405Guard {

  static diagnose(
    input:
      TaxGuardHttp405Diagnosis
  ):
    TaxGuardHttp405DiagnosisResult {

    const reasons:
      string[] = [];

    const is405 =
      input.responseStatus === 405;

    if (is405) {
      reasons.push(
        'HTTP_METHOD_NOT_ALLOWED'
      );
    }

    if (
      input.backendExpected &&
      input.staticHostingDetected
    ) {
      reasons.push(
        'BACKEND_REQUEST_REACHED_STATIC_HOSTING'
      );
    }

    if (
      input.backendExpected &&
      !input.routeConfigured
    ) {
      reasons.push(
        'PRODUCTION_BACKEND_ROUTE_NOT_CONFIGURED'
      );
    }

    const probableRoutingFailure =
      is405 &&
      input.backendExpected &&
      (
        input.staticHostingDetected ||
        !input.routeConfigured
      );

    return Object.freeze({
      is405,

      probableRoutingFailure,

      productionBlocked:
        is405,

      reasons: [
        ...reasons
      ]
    });
  }

  static assertNo405(
    result:
      TaxGuardHttp405DiagnosisResult
  ): true {

    if (
      result.productionBlocked
    ) {
      throw new Error(
        'TG_PROD_HTTP_405_BLOCKS_RELEASE'
      );
    }

    return true;
  }
}

export interface TaxGuardRuntimeRouteProbe {
  method:
    'GET' |
    'POST';

  path: string;

  expectedRuntime:
    'STATIC_FRONTEND' |
    'NODE_API';

  observedRuntime:
    'STATIC_FRONTEND' |
    'NODE_API' |
    'UNKNOWN';
}

export class TaxGuardRuntimeRoutingGuard {

  static validate(
    probe:
      TaxGuardRuntimeRouteProbe
  ): true {

    if (
      !probe.path.startsWith('/')
    ) {
      throw new Error(
        'TG_RUNTIME_ROUTE_PATH_INVALID'
      );
    }

    if (
      probe.observedRuntime ===
        'UNKNOWN'
    ) {
      throw new Error(
        'TG_RUNTIME_ROUTE_UNRESOLVED'
      );
    }

    if (
      probe.expectedRuntime !==
        probe.observedRuntime
    ) {
      throw new Error(
        'TG_RUNTIME_ROUTE_MISMATCH'
      );
    }

    return true;
  }
}
`
);

write(
  'src/taxguard/production/TaxGuardProductionMonitoring.ts',
  String.raw`
export type TaxGuardOperationalSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';

export interface TaxGuardOperationalEvent {
  eventId: string;

  component: string;

  eventType: string;

  severity:
    TaxGuardOperationalSeverity;

  correlationId: string;

  occurredAt: string;

  containsSensitiveData:
    false;

  message: string;
}

export interface TaxGuardOperationalAlert {
  alertId: string;

  sourceEventId: string;

  severity:
    'ERROR' |
    'CRITICAL';

  requiresHumanResponse:
    true;

  createdAt: string;
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

export class TaxGuardOperationalEventGuard {

  static validate(
    event:
      TaxGuardOperationalEvent
  ):
    TaxGuardOperationalEvent {

    requireText(
      event.eventId,
      'TG_MONITOR_EVENT_ID_REQUIRED'
    );

    requireText(
      event.component,
      'TG_MONITOR_COMPONENT_REQUIRED'
    );

    requireText(
      event.eventType,
      'TG_MONITOR_EVENT_TYPE_REQUIRED'
    );

    requireText(
      event.correlationId,
      'TG_MONITOR_CORRELATION_REQUIRED'
    );

    requireText(
      event.message,
      'TG_MONITOR_MESSAGE_REQUIRED'
    );

    if (
      event.containsSensitiveData
    ) {
      throw new Error(
        'TG_MONITOR_SENSITIVE_DATA_BLOCKED'
      );
    }

    if (
      !Number.isFinite(
        Date.parse(
          event.occurredAt
        )
      )
    ) {
      throw new Error(
        'TG_MONITOR_TIMESTAMP_INVALID'
      );
    }

    return Object.freeze({
      ...event
    });
  }
}

export class TaxGuardOperationalAlertEngine {

  static createAlert(
    event:
      TaxGuardOperationalEvent
  ):
    TaxGuardOperationalAlert | null {

    const validated =
      TaxGuardOperationalEventGuard
        .validate(
          event
        );

    if (
      validated.severity !==
        'ERROR' &&
      validated.severity !==
        'CRITICAL'
    ) {
      return null;
    }

    return Object.freeze({
      alertId:
        'alert-' +
        validated.eventId,

      sourceEventId:
        validated.eventId,

      severity:
        validated.severity,

      requiresHumanResponse:
        true,

      createdAt:
        new Date()
          .toISOString()
    });
  }
}

export interface TaxGuardProductionMetric {
  metricId: string;

  name: string;

  value: number;

  unit:
    'count' |
    'milliseconds' |
    'percent';

  recordedAt: string;
}

export class TaxGuardProductionMetricGuard {

  static validate(
    metric:
      TaxGuardProductionMetric
  ):
    TaxGuardProductionMetric {

    requireText(
      metric.metricId,
      'TG_METRIC_ID_REQUIRED'
    );

    requireText(
      metric.name,
      'TG_METRIC_NAME_REQUIRED'
    );

    if (
      !Number.isFinite(
        metric.value
      )
    ) {
      throw new Error(
        'TG_METRIC_VALUE_INVALID'
      );
    }

    if (
      metric.unit ===
        'percent' &&
      (
        metric.value < 0 ||
        metric.value > 100
      )
    ) {
      throw new Error(
        'TG_METRIC_PERCENT_INVALID'
      );
    }

    return Object.freeze({
      ...metric
    });
  }
}

export class TaxGuardProductionLoggingBoundary {

  static logPassword():
    never {

    throw new Error(
      'TG_LOG_PASSWORD_BLOCKED'
    );
  }

  static logSessionToken():
    never {

    throw new Error(
      'TG_LOG_SESSION_TOKEN_BLOCKED'
    );
  }

  static logPrivateKey():
    never {

    throw new Error(
      'TG_LOG_PRIVATE_KEY_BLOCKED'
    );
  }

  static logFullSsn():
    never {

    throw new Error(
      'TG_LOG_FULL_SSN_BLOCKED'
    );
  }
}
`
);

write(
  'src/taxguard/production/index.ts',
  String.raw`
export * from './TaxGuardProductionEnvironment';
export * from './TaxGuardProductionSecurity';
export * from './TaxGuardProductionApi';
export * from './TaxGuardProductionOperations';
export * from './TaxGuardProductionRelease';
export * from './TaxGuardProductionDeployment';
export * from './TaxGuardProductionMonitoring';
`
);

write(
  'src/tests/taxGuardProductionHardening.test.ts',
  String.raw`
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardProductionEnvironmentValidator,
  TaxGuardProductionSecretGuard,
  TaxGuardAuthenticationGuard,
  TaxGuardRoleAuthorizationGuard,
  TaxGuardTenantIsolationGuard,
  TaxGuardProductionSessionPolicy,
  TaxGuardCorsGuard,
  TaxGuardApiRouteRegistry,
  TaxGuardApiRequestGuard,
  TaxGuardFrontendApiBindingValidator,
  TaxGuardProductionRoutingBoundary,
  TaxGuardProductionReadinessGate,
  TaxGuardRateLimitGuard,
  TaxGuardSecurityHeaders,
  TaxGuardAuditIntegrityGuard,
  TaxGuardBackupRecoveryGuard,
  TaxGuardBusinessContinuityGuard,
  TaxGuardProductionReleaseGate,
  TaxGuardDeploymentCheckGuard,
  TaxGuardDeploymentReportBuilder,
  TaxGuardAuthenticationRouteGuard,
  TaxGuardHttp405Guard,
  TaxGuardRuntimeRoutingGuard,
  TaxGuardOperationalEventGuard,
  TaxGuardOperationalAlertEngine,
  TaxGuardProductionMetricGuard,
  TaxGuardProductionLoggingBoundary
} from '../taxguard/production';

describe(
  'TaxGuard M15 Production Hardening',
  () => {

    it(
      'M15.1 validates a production environment',
      () => {

        const result =
          TaxGuardProductionEnvironmentValidator
            .validate({
              environment:
                'production',

              frontendOrigin:
                'https://artaxserv.com',

              apiBaseUrl:
                'https://api.artaxserv.com',

              firebaseProjectId:
                'taxguard2026',

              firestoreDatabaseId:
                '(default)',

              sessionCookieName:
                'taxguard_session',

              trustProxy:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          result.productionValidated
        ).toBe(true);

        expect(
          result.immutable
        ).toBe(true);
      }
    );

    it(
      'M15.2 blocks production without HTTPS',
      () => {

        expect(
          () =>
            TaxGuardProductionEnvironmentValidator
              .validate({
                environment:
                  'production',

                frontendOrigin:
                  'http://artaxserv.com',

                apiBaseUrl:
                  'https://api.artaxserv.com',

                firebaseProjectId:
                  'taxguard2026',

                firestoreDatabaseId:
                  '(default)',

                sessionCookieName:
                  'taxguard_session',

                trustProxy:
                  true,

                externalTaxFilingEnabled:
                  false
              })
        ).toThrow(
          'TG_PROD_FRONTEND_HTTPS_REQUIRED'
        );
      }
    );

    it(
      'M15.3 detects missing production secrets without exposing values',
      () => {

        const result =
          TaxGuardProductionSecretGuard
            .validate(
              'production',
              {
                GOOGLE_APPLICATION_CREDENTIALS:
                  'configured',

                FIREBASE_FIRESTORE_DATABASE_ID:
                  '(default)'
              }
            );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.missingSecretNames
        ).toContain(
          'SESSION_SECRET'
        );

        expect(
          result.secretValuesExposed
        ).toBe(false);
      }
    );

    it(
      'M15.4 validates authenticated sessions',
      () => {

        expect(
          TaxGuardAuthenticationGuard
            .validatePrincipal({
              userId:
                'user-001',

              clientId:
                'client-001',

              tenantId:
                'tenant-001',

              roles: [
                'CLIENT'
              ],

              authenticated:
                true,

              sessionId:
                'session-001',

              issuedAt:
                '2026-09-24T00:00:00.000Z',

              expiresAt:
                '2099-09-24T00:00:00.000Z'
            })
        ).toBe(true);
      }
    );

    it(
      'M15.5 enforces role authorization',
      () => {

        const principal = {
          userId:
            'reviewer-001',

          tenantId:
            'tenant-001',

          roles: [
            'REVIEWER'
          ] as const,

          authenticated:
            true as const,

          sessionId:
            'session-002',

          issuedAt:
            '2026-09-24T00:00:00.000Z',

          expiresAt:
            '2099-09-24T00:00:00.000Z'
        };

        expect(
          TaxGuardRoleAuthorizationGuard
            .requireAnyRole(
              principal,
              [
                'REVIEWER',
                'CPA',
                'EA'
              ]
            )
        ).toBe(true);

        expect(
          () =>
            TaxGuardRoleAuthorizationGuard
              .requireAnyRole(
                principal,
                [
                  'ADMIN'
                ]
              )
        ).toThrow(
          'TG_AUTH_ROLE_FORBIDDEN'
        );
      }
    );

    it(
      'M15.6 blocks cross-tenant and cross-client access',
      () => {

        const principal = {
          userId:
            'user-001',

          clientId:
            'client-001',

          tenantId:
            'tenant-001',

          roles: [
            'CLIENT'
          ] as const,

          authenticated:
            true as const,

          sessionId:
            'session-003',

          issuedAt:
            '2026-09-24T00:00:00.000Z',

          expiresAt:
            '2099-09-24T00:00:00.000Z'
        };

        expect(
          () =>
            TaxGuardTenantIsolationGuard
              .assertAccess(
                principal,
                {
                  tenantId:
                    'tenant-002',

                  clientId:
                    'client-001'
                }
              )
        ).toThrow(
          'TG_TENANT_CROSS_TENANT_ACCESS_BLOCKED'
        );

        expect(
          () =>
            TaxGuardTenantIsolationGuard
              .assertAccess(
                principal,
                {
                  tenantId:
                    'tenant-001',

                  clientId:
                    'client-999'
                }
              )
        ).toThrow(
          'TG_TENANT_CROSS_CLIENT_ACCESS_BLOCKED'
        );
      }
    );

    it(
      'M15.7 creates hardened production session cookie policy',
      () => {

        const policy =
          TaxGuardProductionSessionPolicy
            .create(
              3600
            );

        expect(
          policy.httpOnly
        ).toBe(true);

        expect(
          policy.secure
        ).toBe(true);

        expect(
          policy.path
        ).toBe('/');
      }
    );

    it(
      'M15.8 enforces explicit CORS origins',
      () => {

        const policy =
          TaxGuardCorsGuard
            .createPolicy([
              'https://artaxserv.com'
            ]);

        expect(
          TaxGuardCorsGuard
            .assertOrigin(
              policy,
              'https://artaxserv.com'
            )
        ).toBe(true);

        expect(
          () =>
            TaxGuardCorsGuard
              .assertOrigin(
                policy,
                'https://attacker.example'
              )
        ).toThrow(
          'TG_API_ORIGIN_FORBIDDEN'
        );
      }
    );

    it(
      'M15.9 validates protected production API routes',
      () => {

        const registry =
          new TaxGuardApiRouteRegistry();

        const route =
          registry.register({
            routeId:
              'firebase-session',

            method:
              'POST',

            path:
              '/api/auth/firebase-session',

            authenticationRequired:
              false,

            csrfProtected:
              true,

            productionEnabled:
              true
          });

        expect(
          TaxGuardApiRequestGuard
            .assertAllowed(
              route,
              {
                method:
                  'POST',

                path:
                  '/api/auth/firebase-session',

                authenticated:
                  false,

                csrfValid:
                  true
              }
            )
        ).toBe(true);

        expect(
          () =>
            TaxGuardApiRequestGuard
              .assertAllowed(
                route,
                {
                  method:
                    'GET',

                  path:
                    '/api/auth/firebase-session',

                  authenticated:
                    false,

                  csrfValid:
                    true
                }
              )
        ).toThrow(
          'TG_API_METHOD_NOT_ALLOWED'
        );
      }
    );

    it(
      'M15.10 validates frontend to API production binding',
      () => {

        const binding =
          TaxGuardFrontendApiBindingValidator
            .validate({
              frontendOrigin:
                'https://artaxserv.com',

              apiBaseUrl:
                'https://api.artaxserv.com',

              authSessionPath:
                '/api/auth/firebase-session',

              healthPath:
                '/health',

              productionReady:
                true
            });

        expect(
          binding.apiBaseUrl
        ).toBe(
          'https://api.artaxserv.com'
        );
      }
    );

    it(
      'M15.11 blocks static hosting from pretending to be the API backend',
      () => {

        expect(
          () =>
            TaxGuardProductionRoutingBoundary
              .staticHostingAsApiBackend()
        ).toThrow(
          'TG_API_STATIC_HOSTING_BACKEND_BLOCKED'
        );
      }
    );

    it(
      'M15.12 requires critical dependencies before production readiness',
      () => {

        const readiness =
          TaxGuardProductionReadinessGate
            .evaluate([
              {
                dependency:
                  'DATABASE',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'AUTH',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'AUDIT_LEDGER',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'DOCUMENT_INTELLIGENCE',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              }
            ]);

        expect(
          readiness.ready
        ).toBe(true);

        expect(
          readiness.status
        ).toBe(
          'HEALTHY'
        );
      }
    );

    it(
      'M15.13 blocks requests exceeding configured rate limits',
      () => {

        const policy =
          TaxGuardRateLimitGuard
            .validatePolicy({
              policyId:
                'auth-login',

              windowSeconds:
                60,

              maximumRequests:
                10,

              blockSeconds:
                300
            });

        expect(
          () =>
            TaxGuardRateLimitGuard
              .assertAllowed(
                policy,
                {
                  principalKey:
                    'ip-hash-001',

                  requestCount:
                    11,

                  windowStartedAt:
                    '2026-09-24T00:00:00.000Z'
                }
              )
        ).toThrow(
          'TG_RATE_LIMIT_EXCEEDED'
        );
      }
    );

    it(
      'M15.14 creates hardened production security headers',
      () => {

        const headers =
          TaxGuardSecurityHeaders
            .production();

        expect(
          headers.contentTypeOptions
        ).toBe(
          'nosniff'
        );

        expect(
          headers.frameOptions
        ).toBe(
          'DENY'
        );

        expect(
          headers.strictTransportSecurity
        ).toContain(
          'max-age='
        );
      }
    );

    it(
      'M15.15 validates immutable audit integrity records',
      () => {

        const hash =
          'a'.repeat(64);

        expect(
          TaxGuardAuditIntegrityGuard
            .validate({
              auditId:
                'audit-001',

              eventType:
                'PRODUCTION_TEST',

              actorId:
                'reviewer-001',

              tenantId:
                'tenant-001',

              correlationId:
                'corr-001',

              occurredAt:
                '2026-09-24T00:00:00.000Z',

              previousHash:
                null,

              payloadHash:
                hash,

              recordHash:
                hash,

              immutable:
                true
            })
        ).toBe(true);

        expect(
          () =>
            TaxGuardAuditIntegrityGuard
              .mutateRecord()
        ).toThrow(
          'TG_AUDIT_MUTATION_BLOCKED'
        );
      }
    );

    it(
      'M15.16 requires encrypted backup and restore-test policy',
      () => {

        const policy =
          TaxGuardBackupRecoveryGuard
            .validatePolicy({
              policyId:
                'production-primary',

              encrypted:
                true,

              retentionDays:
                30,

              recoveryPointObjectiveMinutes:
                60,

              recoveryTimeObjectiveMinutes:
                240,

              restoreTestRequired:
                true
            });

        expect(
          policy.encrypted
        ).toBe(true);

        expect(
          policy.restoreTestRequired
        ).toBe(true);
      }
    );

    it(
      'M15.17 requires critical failures to fail closed',
      () => {

        expect(
          () =>
            TaxGuardBusinessContinuityGuard
              .assertFailureSafe({
                failureId:
                  'failure-001',

                component:
                  'AUTH',

                severity:
                  'CRITICAL',

                correlationId:
                  'corr-002',

                detectedAt:
                  '2026-09-24T00:00:00.000Z',

                failClosed:
                  false
              })
        ).toThrow(
          'TG_BCP_CRITICAL_FAILURE_MUST_FAIL_CLOSED'
        );
      }
    );

    it(
      'M15.18 blocks release when deployment verification fails',
      () => {

        const environment =
          TaxGuardProductionEnvironmentValidator
            .validate({
              environment:
                'production',

              frontendOrigin:
                'https://artaxserv.com',

              apiBaseUrl:
                'https://api.artaxserv.com',

              firebaseProjectId:
                'taxguard2026',

              firestoreDatabaseId:
                '(default)',

              sessionCookieName:
                'taxguard_session',

              trustProxy:
                true,

              externalTaxFilingEnabled:
                false
            });

        const secrets =
          TaxGuardProductionSecretGuard
            .validate(
              'production',
              {
                GOOGLE_APPLICATION_CREDENTIALS:
                  'configured',

                FIREBASE_FIRESTORE_DATABASE_ID:
                  '(default)',

                SESSION_SECRET:
                  'configured'
              }
            );

        const readiness =
          TaxGuardProductionReadinessGate
            .evaluate([
              {
                dependency:
                  'DATABASE',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'AUTH',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              {
                dependency:
                  'AUDIT_LEDGER',

                healthy:
                  true,

                checkedAt:
                  '2026-09-24T00:00:00.000Z'
              }
            ]);

        const decision =
          TaxGuardProductionReleaseGate
            .evaluate({
              environment,

              secrets,

              readiness,

              database: {
                connected:
                  true,

                tenantIsolationEnabled:
                  true,

                encryptedInTransit:
                  true,

                backupConfigured:
                  true,

                migrationCurrent:
                  true
              },

              deployment: {
                deploymentId:
                  'deployment-001',

                environment:
                  'production',

                frontendReachable:
                  true,

                apiReachable:
                  false,

                authRouteReachable:
                  false,

                healthRouteReachable:
                  false,

                databaseReachable:
                  true,

                corsValidated:
                  false,

                sessionValidated:
                  false,

                testedAt:
                  '2026-09-24T00:00:00.000Z'
              },

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              securityRegressionPassed:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          decision.releaseAllowed
        ).toBe(false);

        expect(
          decision.blockers
        ).toContain(
          'DEPLOYMENT_VERIFICATION_FAILED'
        );
      }
    );

    it(
      'M15.19 validates authentication as a server API route',
      () => {

        const route =
          TaxGuardAuthenticationRouteGuard
            .validate({
              method:
                'POST',

              path:
                '/api/auth/firebase-session',

              acceptsFirebaseIdToken:
                true,

              createsServerSession:
                true,

              staticHostingRoute:
                false
            });

        expect(
          route.createsServerSession
        ).toBe(true);
      }
    );

    it(
      'M15.20 detects HTTP 405 as a production release blocker',
      () => {

        const result =
          TaxGuardHttp405Guard
            .diagnose({
              requestedMethod:
                'POST',

              requestedUrl:
                'https://artaxserv.com/api/auth/firebase-session',

              responseStatus:
                405,

              backendExpected:
                true,

              staticHostingDetected:
                true,

              routeConfigured:
                false
            });

        expect(
          result.is405
        ).toBe(true);

        expect(
          result.probableRoutingFailure
        ).toBe(true);

        expect(
          result.productionBlocked
        ).toBe(true);

        expect(
          () =>
            TaxGuardHttp405Guard
              .assertNo405(
                result
              )
        ).toThrow(
          'TG_PROD_HTTP_405_BLOCKS_RELEASE'
        );
      }
    );

    it(
      'M15.21 detects frontend and backend runtime routing mismatch',
      () => {

        expect(
          () =>
            TaxGuardRuntimeRoutingGuard
              .validate({
                method:
                  'POST',

                path:
                  '/api/auth/firebase-session',

                expectedRuntime:
                  'NODE_API',

                observedRuntime:
                  'STATIC_FRONTEND'
              })
        ).toThrow(
          'TG_RUNTIME_ROUTE_MISMATCH'
        );
      }
    );

    it(
      'M15.22 validates deployment endpoint checks',
      () => {

        const result =
          TaxGuardDeploymentCheckGuard
            .validate({
              checkId:
                'health-001',

              name:
                'Production API health',

              url:
                'https://api.artaxserv.com/health',

              expectedMethod:
                'GET',

              expectedStatusCodes: [
                200
              ],

              actualStatusCode:
                200,

              status:
                'PASS',

              checkedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.status
        ).toBe(
          'PASS'
        );
      }
    );

    it(
      'M15.23 requires all deployment checks to pass',
      () => {

        const report =
          TaxGuardDeploymentReportBuilder
            .build(
              'deployment-002',

              {
                checkId:
                  'frontend',

                name:
                  'Frontend',

                url:
                  'https://artaxserv.com',

                expectedMethod:
                  'GET',

                expectedStatusCodes: [
                  200
                ],

                actualStatusCode:
                  200,

                status:
                  'PASS'
              },

              {
                checkId:
                  'health',

                name:
                  'API health',

                url:
                  'https://api.artaxserv.com/health',

                expectedMethod:
                  'GET',

                expectedStatusCodes: [
                  200
                ],

                actualStatusCode:
                  200,

                status:
                  'PASS'
              },

              {
                checkId:
                  'auth',

                name:
                  'Authentication',

                url:
                  'https://api.artaxserv.com/api/auth/firebase-session',

                expectedMethod:
                  'POST',

                expectedStatusCodes: [
                  200,
                  401
                ],

                actualStatusCode:
                  401,

                status:
                  'PASS'
              }
            );

        expect(
          report.allRequiredChecksPassed
        ).toBe(true);
      }
    );

    it(
      'M15.24 creates human-response alerts for production errors',
      () => {

        const event = {
          eventId:
            'event-001',

          component:
            'AUTH',

          eventType:
            'LOGIN_FAILURE_SPIKE',

          severity:
            'ERROR' as const,

          correlationId:
            'corr-003',

          occurredAt:
            '2026-09-24T00:00:00.000Z',

          containsSensitiveData:
            false as const,

          message:
            'Authentication failure threshold exceeded'
        };

        expect(
          TaxGuardOperationalEventGuard
            .validate(
              event
            ).eventId
        ).toBe(
          'event-001'
        );

        const alert =
          TaxGuardOperationalAlertEngine
            .createAlert(
              event
            );

        expect(
          alert?.requiresHumanResponse
        ).toBe(true);
      }
    );

    it(
      'M15.25 validates operational metrics',
      () => {

        const metric =
          TaxGuardProductionMetricGuard
            .validate({
              metricId:
                'metric-001',

              name:
                'api_latency',

              value:
                125,

              unit:
                'milliseconds',

              recordedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          metric.value
        ).toBe(125);
      }
    );

    it(
      'M15.26 blocks sensitive information from production logs',
      () => {

        expect(
          () =>
            TaxGuardProductionLoggingBoundary
              .logPassword()
        ).toThrow(
          'TG_LOG_PASSWORD_BLOCKED'
        );

        expect(
          () =>
            TaxGuardProductionLoggingBoundary
              .logPrivateKey()
        ).toThrow(
          'TG_LOG_PRIVATE_KEY_BLOCKED'
        );

        expect(
          () =>
            TaxGuardProductionLoggingBoundary
              .logFullSsn()
        ).toThrow(
          'TG_LOG_FULL_SSN_BLOCKED'
        );
      }
    );

    it(
      'M15.27 keeps external tax submission disabled',
      () => {

        expect(
          () =>
            TaxGuardProductionRoutingBoundary
              .externalTaxSubmission()
        ).toThrow(
          'TG_EXTERNAL_TAX_SUBMISSION_DISABLED'
        );
      }
    );
  }
);
`
);

console.log('');
console.log(
  '=============================================='
);

console.log(
  'TaxGuard M15 builder completed.'
);

console.log(
  'Production hardening files and tests generated.'
);

console.log(
  'External tax filing remains disabled.'
);

console.log(
  'Live production deployment still requires real endpoint verification.'
);

console.log(
  '=============================================='
);







