import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function write(relativePath, content) {
  const target =
    path.join(
      root,
      relativePath
    );

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

/*
 * ============================================================
 * TAXGUARD PRODUCTION INTEGRATION
 * CONSOLIDATED BUILDER
 * ============================================================
 *
 * M1-M15 remain frozen.
 *
 * This builder creates the production integration/go-live
 * verification layer only.
 *
 * It must NOT mark live infrastructure as verified merely
 * because local unit tests pass.
 *
 * External tax filing remains disabled.
 * ============================================================
 */


/*
 * ============================================================
 * FILE 1
 * ProductionIntegration.ts
 * ============================================================
 */

write(
  'src/taxguard/go-live/ProductionIntegration.ts',
  String.raw`
export type TaxGuardProductionIntegrationStatus =
  | 'NOT_CHECKED'
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED';

export type TaxGuardProductionRuntime =
  | 'STATIC_FRONTEND'
  | 'NODE_API'
  | 'FIREBASE'
  | 'DATABASE'
  | 'DOCUMENT_INTELLIGENCE'
  | 'UNKNOWN';

export type TaxGuardProductionHttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS';

export interface TaxGuardProductionEndpoint {
  endpointId: string;
  name: string;
  url: string;

  method:
    TaxGuardProductionHttpMethod;

  expectedRuntime:
    TaxGuardProductionRuntime;

  expectedStatusCodes:
    readonly number[];

  authenticationRequired:
    boolean;
}

export interface TaxGuardProductionProbeResult {
  endpointId: string;
  url: string;

  method:
    TaxGuardProductionHttpMethod;

  expectedRuntime:
    TaxGuardProductionRuntime;

  observedRuntime:
    TaxGuardProductionRuntime;

  statusCode: number;

  status:
    TaxGuardProductionIntegrationStatus;

  checkedAt: string;

  evidence:
    readonly string[];
}

function requireText(
  value: string,
  errorCode: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}

function requireHttpUrl(
  value: string,
  errorCode: string
): URL {

  let parsed: URL;

  try {
    parsed =
      new URL(
        value.trim()
      );
  } catch {
    throw new Error(
      errorCode
    );
  }

  if (
    parsed.protocol !== 'https:' &&
    parsed.protocol !== 'http:'
  ) {
    throw new Error(
      errorCode
    );
  }

  return parsed;
}

export class TaxGuardProductionEndpointGuard {

  static validate(
    endpoint:
      TaxGuardProductionEndpoint
  ):
    Readonly<TaxGuardProductionEndpoint> {

    requireText(
      endpoint.endpointId,
      'TG_GO_LIVE_ENDPOINT_ID_REQUIRED'
    );

    requireText(
      endpoint.name,
      'TG_GO_LIVE_ENDPOINT_NAME_REQUIRED'
    );

    requireHttpUrl(
      endpoint.url,
      'TG_GO_LIVE_ENDPOINT_URL_INVALID'
    );

    if (
      endpoint.expectedStatusCodes
        .length === 0
    ) {
      throw new Error(
        'TG_GO_LIVE_EXPECTED_STATUS_REQUIRED'
      );
    }

    for (
      const code
      of endpoint.expectedStatusCodes
    ) {
      if (
        !Number.isInteger(code) ||
        code < 100 ||
        code > 599
      ) {
        throw new Error(
          'TG_GO_LIVE_EXPECTED_STATUS_INVALID'
        );
      }
    }

    return Object.freeze({
      ...endpoint,

      expectedStatusCodes:
        Object.freeze([
          ...endpoint.expectedStatusCodes
        ])
    });
  }
}

export class TaxGuardProductionProbeGuard {

  static validate(
    endpoint:
      TaxGuardProductionEndpoint,

    result:
      TaxGuardProductionProbeResult
  ):
    Readonly<TaxGuardProductionProbeResult> {

    TaxGuardProductionEndpointGuard
      .validate(
        endpoint
      );

    if (
      result.endpointId !==
        endpoint.endpointId
    ) {
      throw new Error(
        'TG_GO_LIVE_ENDPOINT_RESULT_MISMATCH'
      );
    }

    if (
      result.method !==
        endpoint.method
    ) {
      throw new Error(
        'TG_GO_LIVE_METHOD_MISMATCH'
      );
    }

    if (
      result.url !==
        endpoint.url
    ) {
      throw new Error(
        'TG_GO_LIVE_URL_MISMATCH'
      );
    }

    if (
      result.expectedRuntime !==
        endpoint.expectedRuntime
    ) {
      throw new Error(
        'TG_GO_LIVE_EXPECTED_RUNTIME_MISMATCH'
      );
    }

    if (
      !Number.isInteger(
        result.statusCode
      ) ||
      result.statusCode < 100 ||
      result.statusCode > 599
    ) {
      throw new Error(
        'TG_GO_LIVE_RESPONSE_STATUS_INVALID'
      );
    }

    if (
      result.status === 'PASS'
    ) {
      if (
        !endpoint.expectedStatusCodes
          .includes(
            result.statusCode
          )
      ) {
        throw new Error(
          'TG_GO_LIVE_RESPONSE_STATUS_MISMATCH'
        );
      }

      if (
        result.observedRuntime !==
          endpoint.expectedRuntime
      ) {
        throw new Error(
          'TG_GO_LIVE_RUNTIME_MISMATCH'
        );
      }
    }

    if (
      !Number.isFinite(
        Date.parse(
          result.checkedAt
        )
      )
    ) {
      throw new Error(
        'TG_GO_LIVE_CHECK_TIMESTAMP_INVALID'
      );
    }

    return Object.freeze({
      ...result,

      evidence:
        Object.freeze([
          ...result.evidence
        ])
    });
  }
}

export interface TaxGuardProductionTopology {
  frontendOrigin: string;
  apiOrigin: string;

  frontendRuntime:
    'STATIC_FRONTEND';

  apiRuntime:
    'NODE_API';

  authenticationRuntime:
    'NODE_API';

  databaseRuntime:
    'DATABASE';

  externalTaxFilingEnabled:
    false;
}

export class TaxGuardProductionTopologyGuard {

  static validate(
    topology:
      TaxGuardProductionTopology
  ):
    Readonly<TaxGuardProductionTopology> {

    const frontend =
      requireHttpUrl(
        topology.frontendOrigin,
        'TG_GO_LIVE_FRONTEND_URL_INVALID'
      );

    const api =
      requireHttpUrl(
        topology.apiOrigin,
        'TG_GO_LIVE_API_URL_INVALID'
      );

    if (
      frontend.protocol !== 'https:'
    ) {
      throw new Error(
        'TG_GO_LIVE_FRONTEND_HTTPS_REQUIRED'
      );
    }

    if (
      api.protocol !== 'https:'
    ) {
      throw new Error(
        'TG_GO_LIVE_API_HTTPS_REQUIRED'
      );
    }

    if (
      topology.frontendRuntime !==
        'STATIC_FRONTEND'
    ) {
      throw new Error(
        'TG_GO_LIVE_FRONTEND_RUNTIME_INVALID'
      );
    }

    if (
      topology.apiRuntime !==
        'NODE_API'
    ) {
      throw new Error(
        'TG_GO_LIVE_API_RUNTIME_INVALID'
      );
    }

    if (
      topology.authenticationRuntime !==
        'NODE_API'
    ) {
      throw new Error(
        'TG_GO_LIVE_AUTH_RUNTIME_INVALID'
      );
    }

    if (
      topology.databaseRuntime !==
        'DATABASE'
    ) {
      throw new Error(
        'TG_GO_LIVE_DATABASE_RUNTIME_INVALID'
      );
    }

    if (
      topology.externalTaxFilingEnabled
    ) {
      throw new Error(
        'TG_GO_LIVE_EXTERNAL_FILING_DISABLED'
      );
    }

    return Object.freeze({
      ...topology
    });
  }
}

export interface TaxGuardProductionRouteContract {
  routeId: string;

  method:
    TaxGuardProductionHttpMethod;

  path: string;

  runtime:
    TaxGuardProductionRuntime;

  authenticationRequired:
    boolean;

  staticHostingAllowed:
    boolean;
}

export class TaxGuardProductionRouteRegistry {

  private readonly routes =
    new Map<
      string,
      Readonly<TaxGuardProductionRouteContract>
    >();

  register(
    route:
      TaxGuardProductionRouteContract
  ):
    Readonly<TaxGuardProductionRouteContract> {

    requireText(
      route.routeId,
      'TG_GO_LIVE_ROUTE_ID_REQUIRED'
    );

    if (
      !route.path.startsWith('/')
    ) {
      throw new Error(
        'TG_GO_LIVE_ROUTE_PATH_INVALID'
      );
    }

    if (
      this.routes.has(
        route.routeId
      )
    ) {
      throw new Error(
        'TG_GO_LIVE_DUPLICATE_ROUTE'
      );
    }

    if (
      route.runtime ===
        'NODE_API' &&
      route.staticHostingAllowed
    ) {
      throw new Error(
        'TG_GO_LIVE_API_STATIC_HOSTING_BLOCKED'
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

    return stored;
  }

  get(
    routeId: string
  ):
    Readonly<TaxGuardProductionRouteContract> |
    undefined {

    return this.routes.get(
      routeId
    );
  }

  list():
    readonly Readonly<TaxGuardProductionRouteContract>[] {

    return Object.freeze(
      [
        ...this.routes.values()
      ]
    );
  }
}

export interface TaxGuardHttp405Evidence {
  method:
    TaxGuardProductionHttpMethod;

  url: string;

  statusCode: number;

  expectedRuntime:
    TaxGuardProductionRuntime;

  observedRuntime:
    TaxGuardProductionRuntime;

  responseAllowHeader?:
    string;

  responseServerHeader?:
    string;
}

export interface TaxGuardHttp405Assessment {
  is405: boolean;
  runtimeMismatch: boolean;
  authenticationBlocked: boolean;
  productionReleaseBlocked: boolean;

  reasons:
    readonly string[];
}

export class TaxGuardProduction405Analyzer {

  static analyze(
    evidence:
      TaxGuardHttp405Evidence
  ):
    Readonly<TaxGuardHttp405Assessment> {

    requireHttpUrl(
      evidence.url,
      'TG_GO_LIVE_405_URL_INVALID'
    );

    const reasons:
      string[] = [];

    const is405 =
      evidence.statusCode === 405;

    const runtimeMismatch =
      evidence.expectedRuntime !==
        evidence.observedRuntime;

    if (is405) {
      reasons.push(
        'HTTP_405_METHOD_NOT_ALLOWED'
      );
    }

    if (runtimeMismatch) {
      reasons.push(
        'EXPECTED_RUNTIME_NOT_REACHED'
      );
    }

    if (
      evidence.expectedRuntime ===
        'NODE_API' &&
      evidence.observedRuntime ===
        'STATIC_FRONTEND'
    ) {
      reasons.push(
        'API_REQUEST_REACHED_STATIC_FRONTEND'
      );
    }

    if (
      evidence.responseAllowHeader
    ) {
      reasons.push(
        'ALLOW_HEADER_PRESENT'
      );
    }

    const authenticationBlocked =
      is405 &&
      evidence.expectedRuntime ===
        'NODE_API';

    return Object.freeze({
      is405,
      runtimeMismatch,
      authenticationBlocked,

      productionReleaseBlocked:
        is405 ||
        runtimeMismatch,

      reasons:
        Object.freeze([
          ...reasons
        ])
    });
  }

  static assertProductionSafe(
    assessment:
      TaxGuardHttp405Assessment
  ): true {

    if (
      assessment.productionReleaseBlocked
    ) {
      throw new Error(
        'TG_GO_LIVE_405_RELEASE_BLOCKED'
      );
    }

    return true;
  }
}

export interface TaxGuardProductionIntegrationGateInput {
  frontendVerified: boolean;
  apiHealthVerified: boolean;
  authenticationVerified: boolean;
  sessionVerified: boolean;
  databaseVerified: boolean;
  tenantIsolationVerified: boolean;
  auditVerified: boolean;
  documentIntelligenceVerified: boolean;
  monitoringVerified: boolean;
  backupRestoreVerified: boolean;
  regressionPassed: boolean;
  buildPassed: boolean;
  typecheckPassed: boolean;

  externalTaxFilingEnabled:
    false;
}

export interface TaxGuardProductionIntegrationDecision {
  releaseAllowed: boolean;

  blockers:
    readonly string[];
}

export class TaxGuardProductionIntegrationGate {

  static evaluate(
    input:
      TaxGuardProductionIntegrationGateInput
  ):
    Readonly<TaxGuardProductionIntegrationDecision> {

    const blockers:
      string[] = [];

    const checks:
      readonly [
        keyof TaxGuardProductionIntegrationGateInput,
        string
      ][] = [
        [
          'frontendVerified',
          'FRONTEND_NOT_VERIFIED'
        ],
        [
          'apiHealthVerified',
          'API_HEALTH_NOT_VERIFIED'
        ],
        [
          'authenticationVerified',
          'AUTHENTICATION_NOT_VERIFIED'
        ],
        [
          'sessionVerified',
          'SESSION_NOT_VERIFIED'
        ],
        [
          'databaseVerified',
          'DATABASE_NOT_VERIFIED'
        ],
        [
          'tenantIsolationVerified',
          'TENANT_ISOLATION_NOT_VERIFIED'
        ],
        [
          'auditVerified',
          'AUDIT_NOT_VERIFIED'
        ],
        [
          'documentIntelligenceVerified',
          'DOCUMENT_INTELLIGENCE_NOT_VERIFIED'
        ],
        [
          'monitoringVerified',
          'MONITORING_NOT_VERIFIED'
        ],
        [
          'backupRestoreVerified',
          'BACKUP_RESTORE_NOT_VERIFIED'
        ],
        [
          'regressionPassed',
          'REGRESSION_NOT_PASSED'
        ],
        [
          'buildPassed',
          'BUILD_NOT_PASSED'
        ],
        [
          'typecheckPassed',
          'TYPECHECK_NOT_PASSED'
        ]
      ];

    for (
      const [
        key,
        blocker
      ]
      of checks
    ) {
      if (
        input[key] !== true
      ) {
        blockers.push(
          blocker
        );
      }
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

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}
`
);


/*
 * ============================================================
 * FILE 2
 * ProductionAuthentication.ts
 * ============================================================
 */

write(
  'src/taxguard/go-live/ProductionAuthentication.ts',
  String.raw`
export type TaxGuardAuthenticationCheckStatus =
  | 'NOT_CHECKED'
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED';

export type TaxGuardAuthenticationFailure =
  | 'NONE'
  | 'FRONTEND_UNREACHABLE'
  | 'API_UNREACHABLE'
  | 'HTTP_405'
  | 'HTTP_404'
  | 'CORS_BLOCKED'
  | 'TOKEN_MISSING'
  | 'TOKEN_INVALID'
  | 'SESSION_NOT_CREATED'
  | 'SESSION_COOKIE_INVALID'
  | 'USER_PROFILE_NOT_FOUND'
  | 'TENANT_MISMATCH'
  | 'CLIENT_MISMATCH'
  | 'ROLE_UNAUTHORIZED'
  | 'UNKNOWN';

export interface TaxGuardAuthenticationProbe {
  probeId: string;
  frontendOrigin: string;
  apiOrigin: string;
  sessionPath: string;

  method:
    'POST';

  firebaseTokenPresent:
    boolean;

  statusCode:
    number;

  responseReceived:
    boolean;

  corsAccepted:
    boolean;

  sessionCreated:
    boolean;

  authenticatedUserId?:
    string;

  clientId?:
    string;

  tenantId?:
    string;

  checkedAt:
    string;
}

export interface TaxGuardAuthenticationAssessment {
  status:
    TaxGuardAuthenticationCheckStatus;

  failure:
    TaxGuardAuthenticationFailure;

  releaseBlocked:
    boolean;

  reasons:
    readonly string[];
}

function requireAuthText(
  value: string,
  errorCode: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}

function requireAuthUrl(
  value: string,
  errorCode: string
): URL {

  let parsed: URL;

  try {
    parsed =
      new URL(
        value.trim()
      );
  } catch {
    throw new Error(
      errorCode
    );
  }

  if (
    parsed.protocol !== 'https:' &&
    parsed.protocol !== 'http:'
  ) {
    throw new Error(
      errorCode
    );
  }

  return parsed;
}

export class TaxGuardAuthenticationProbeGuard {

  static validate(
    probe:
      TaxGuardAuthenticationProbe
  ):
    Readonly<TaxGuardAuthenticationProbe> {

    requireAuthText(
      probe.probeId,
      'TG_AUTH_PROBE_ID_REQUIRED'
    );

    requireAuthUrl(
      probe.frontendOrigin,
      'TG_AUTH_FRONTEND_URL_INVALID'
    );

    requireAuthUrl(
      probe.apiOrigin,
      'TG_AUTH_API_URL_INVALID'
    );

    if (
      !probe.sessionPath.startsWith('/')
    ) {
      throw new Error(
        'TG_AUTH_SESSION_PATH_INVALID'
      );
    }

    if (
      probe.method !== 'POST'
    ) {
      throw new Error(
        'TG_AUTH_SESSION_POST_REQUIRED'
      );
    }

    if (
      !Number.isInteger(
        probe.statusCode
      ) ||
      probe.statusCode < 0 ||
      probe.statusCode > 599
    ) {
      throw new Error(
        'TG_AUTH_STATUS_INVALID'
      );
    }

    if (
      !Number.isFinite(
        Date.parse(
          probe.checkedAt
        )
      )
    ) {
      throw new Error(
        'TG_AUTH_TIMESTAMP_INVALID'
      );
    }

    return Object.freeze({
      ...probe
    });
  }
}

export class TaxGuardAuthenticationAnalyzer {

  static analyze(
    probe:
      TaxGuardAuthenticationProbe
  ):
    Readonly<TaxGuardAuthenticationAssessment> {

    TaxGuardAuthenticationProbeGuard
      .validate(
        probe
      );

    const reasons:
      string[] = [];

    let failure:
      TaxGuardAuthenticationFailure =
        'NONE';

    if (
      !probe.responseReceived
    ) {
      failure =
        'API_UNREACHABLE';

      reasons.push(
        'AUTH_API_DID_NOT_RESPOND'
      );
    } else if (
      probe.statusCode === 405
    ) {
      failure =
        'HTTP_405';

      reasons.push(
        'AUTH_POST_METHOD_NOT_ALLOWED'
      );
    } else if (
      probe.statusCode === 404
    ) {
      failure =
        'HTTP_404';

      reasons.push(
        'AUTH_SESSION_ROUTE_NOT_FOUND'
      );
    } else if (
      !probe.corsAccepted
    ) {
      failure =
        'CORS_BLOCKED';

      reasons.push(
        'AUTH_CORS_REJECTED'
      );
    } else if (
      !probe.firebaseTokenPresent
    ) {
      failure =
        'TOKEN_MISSING';

      reasons.push(
        'FIREBASE_ID_TOKEN_REQUIRED'
      );
    } else if (
      probe.statusCode === 401
    ) {
      failure =
        'TOKEN_INVALID';

      reasons.push(
        'AUTH_TOKEN_REJECTED'
      );
    } else if (
      probe.statusCode === 403
    ) {
      failure =
        'ROLE_UNAUTHORIZED';

      reasons.push(
        'AUTHORIZATION_REJECTED'
      );
    } else if (
      !probe.sessionCreated
    ) {
      failure =
        'SESSION_NOT_CREATED';

      reasons.push(
        'SERVER_SESSION_NOT_CREATED'
      );
    }

    const pass =
      failure === 'NONE' &&
      probe.responseReceived &&
      probe.corsAccepted &&
      probe.firebaseTokenPresent &&
      probe.sessionCreated &&
      probe.statusCode >= 200 &&
      probe.statusCode < 300;

    return Object.freeze({
      status:
        pass
          ? 'PASS'
          : 'FAIL',

      failure:
        pass
          ? 'NONE'
          : failure === 'NONE'
            ? 'UNKNOWN'
            : failure,

      releaseBlocked:
        !pass,

      reasons:
        Object.freeze([
          ...reasons
        ])
    });
  }
}

export interface TaxGuardSessionIdentity {
  userId: string;
  clientId: string;
  tenantId: string;

  roles:
    readonly string[];

  issuedAt: string;
  expiresAt: string;
}

export class TaxGuardSessionIdentityGuard {

  static validate(
    identity:
      TaxGuardSessionIdentity
  ):
    Readonly<TaxGuardSessionIdentity> {

    requireAuthText(
      identity.userId,
      'TG_SESSION_USER_REQUIRED'
    );

    requireAuthText(
      identity.clientId,
      'TG_SESSION_CLIENT_REQUIRED'
    );

    requireAuthText(
      identity.tenantId,
      'TG_SESSION_TENANT_REQUIRED'
    );

    if (
      identity.roles.length === 0
    ) {
      throw new Error(
        'TG_SESSION_ROLE_REQUIRED'
      );
    }

    const issued =
      Date.parse(
        identity.issuedAt
      );

    const expires =
      Date.parse(
        identity.expiresAt
      );

    if (
      !Number.isFinite(issued) ||
      !Number.isFinite(expires) ||
      expires <= issued
    ) {
      throw new Error(
        'TG_SESSION_LIFETIME_INVALID'
      );
    }

    return Object.freeze({
      ...identity,

      roles:
        Object.freeze([
          ...identity.roles
        ])
    });
  }

  static assertClientAccess(
    identity:
      TaxGuardSessionIdentity,

    requestedClientId:
      string,

    requestedTenantId:
      string
  ): true {

    this.validate(
      identity
    );

    if (
      identity.clientId !==
        requestedClientId
    ) {
      throw new Error(
        'TG_SESSION_CROSS_CLIENT_BLOCKED'
      );
    }

    if (
      identity.tenantId !==
        requestedTenantId
    ) {
      throw new Error(
        'TG_SESSION_CROSS_TENANT_BLOCKED'
      );
    }

    return true;
  }
}

export interface TaxGuardApiRuntimeBinding {
  frontendOrigin: string;
  apiOrigin: string;
  sessionEndpoint: string;
  healthEndpoint: string;

  apiRuntime:
    'NODE_API';

  staticFrontendMayHandleApi:
    false;
}

export class TaxGuardApiRuntimeBindingGuard {

  static validate(
    binding:
      TaxGuardApiRuntimeBinding
  ):
    Readonly<TaxGuardApiRuntimeBinding> {

    const frontend =
      requireAuthUrl(
        binding.frontendOrigin,
        'TG_BINDING_FRONTEND_INVALID'
      );

    const api =
      requireAuthUrl(
        binding.apiOrigin,
        'TG_BINDING_API_INVALID'
      );

    if (
      frontend.protocol !== 'https:' ||
      api.protocol !== 'https:'
    ) {
      throw new Error(
        'TG_BINDING_HTTPS_REQUIRED'
      );
    }

    if (
      !binding.sessionEndpoint
        .startsWith('/')
    ) {
      throw new Error(
        'TG_BINDING_SESSION_ROUTE_INVALID'
      );
    }

    if (
      !binding.healthEndpoint
        .startsWith('/')
    ) {
      throw new Error(
        'TG_BINDING_HEALTH_ROUTE_INVALID'
      );
    }

    if (
      binding.apiRuntime !==
        'NODE_API'
    ) {
      throw new Error(
        'TG_BINDING_NODE_API_REQUIRED'
      );
    }

    if (
      binding.staticFrontendMayHandleApi
    ) {
      throw new Error(
        'TG_BINDING_STATIC_API_BLOCKED'
      );
    }

    return Object.freeze({
      ...binding
    });
  }
}

export interface TaxGuardProductionRouteObservation {
  route: string;

  method:
    'GET' |
    'POST' |
    'OPTIONS';

  statusCode:
    number;

  contentType?:
    string;

  responseLooksLikeHtml:
    boolean;

  responseLooksLikeJson:
    boolean;

  allowHeader?:
    string;
}

export interface TaxGuardProductionRouteDiagnosis {
  correctRuntimeLikely:
    boolean;

  staticFrontendLikely:
    boolean;

  methodRejected:
    boolean;

  routeMissing:
    boolean;

  releaseBlocked:
    boolean;

  reasons:
    readonly string[];
}

export class TaxGuardProductionRouteDiagnoser {

  static diagnose(
    observation:
      TaxGuardProductionRouteObservation
  ):
    Readonly<TaxGuardProductionRouteDiagnosis> {

    if (
      !observation.route
        .startsWith('/')
    ) {
      throw new Error(
        'TG_ROUTE_DIAGNOSIS_PATH_INVALID'
      );
    }

    const reasons:
      string[] = [];

    const methodRejected =
      observation.statusCode === 405;

    const routeMissing =
      observation.statusCode === 404;

    const staticFrontendLikely =
      observation.responseLooksLikeHtml &&
      !observation.responseLooksLikeJson;

    const correctRuntimeLikely =
      observation.responseLooksLikeJson &&
      !staticFrontendLikely &&
      !methodRejected &&
      !routeMissing;

    if (methodRejected) {
      reasons.push(
        'METHOD_NOT_ALLOWED'
      );
    }

    if (routeMissing) {
      reasons.push(
        'ROUTE_NOT_FOUND'
      );
    }

    if (staticFrontendLikely) {
      reasons.push(
        'HTML_RESPONSE_FROM_API_ROUTE'
      );
    }

    if (
      observation.allowHeader
    ) {
      reasons.push(
        'ALLOW_HEADER_OBSERVED'
      );
    }

    return Object.freeze({
      correctRuntimeLikely,
      staticFrontendLikely,
      methodRejected,
      routeMissing,

      releaseBlocked:
        !correctRuntimeLikely,

      reasons:
        Object.freeze([
          ...reasons
        ])
    });
  }
}
`
);

///////////// Consolidated Section 2 of 4

/*
 * ============================================================
 * FILE 3
 * ProductionReadiness.ts
 * ============================================================
 */

write(
  'src/taxguard/go-live/ProductionReadiness.ts',
  String.raw`
export type TaxGuardReadinessStatus =
  | 'NOT_CHECKED'
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED';

export type TaxGuardReadinessArea =
  | 'FRONTEND'
  | 'API'
  | 'AUTHENTICATION'
  | 'SESSION'
  | 'DATABASE'
  | 'TENANT_ISOLATION'
  | 'DOCUMENT_INTELLIGENCE'
  | 'AUDIT'
  | 'MONITORING'
  | 'BACKUP_RESTORE'
  | 'SECURITY'
  | 'REGRESSION'
  | 'BUILD'
  | 'TYPECHECK';

export interface TaxGuardReadinessCheck {
  checkId: string;
  area: TaxGuardReadinessArea;
  name: string;
  required: boolean;
  status: TaxGuardReadinessStatus;
  checkedAt?: string;
  evidence: readonly string[];
  blockerReason?: string;
}

export interface TaxGuardReadinessSummary {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  notChecked: number;
  requiredIncomplete: number;
  releaseAllowed: boolean;
  blockers: readonly string[];
}

function requireReadinessText(
  value: string,
  errorCode: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}

export class TaxGuardReadinessRegistry {

  private readonly checks =
    new Map<
      string,
      Readonly<TaxGuardReadinessCheck>
    >();

  register(
    check:
      TaxGuardReadinessCheck
  ):
    Readonly<TaxGuardReadinessCheck> {

    requireReadinessText(
      check.checkId,
      'TG_READINESS_CHECK_ID_REQUIRED'
    );

    requireReadinessText(
      check.name,
      'TG_READINESS_CHECK_NAME_REQUIRED'
    );

    if (
      this.checks.has(
        check.checkId
      )
    ) {
      throw new Error(
        'TG_READINESS_DUPLICATE_CHECK'
      );
    }

    if (
      check.status === 'PASS' &&
      check.evidence.length === 0
    ) {
      throw new Error(
        'TG_READINESS_PASS_REQUIRES_EVIDENCE'
      );
    }

    if (
      check.checkedAt &&
      !Number.isFinite(
        Date.parse(
          check.checkedAt
        )
      )
    ) {
      throw new Error(
        'TG_READINESS_TIMESTAMP_INVALID'
      );
    }

    if (
      (
        check.status === 'FAIL' ||
        check.status === 'BLOCKED'
      ) &&
      !check.blockerReason
    ) {
      throw new Error(
        'TG_READINESS_BLOCKER_REASON_REQUIRED'
      );
    }

    const stored =
      Object.freeze({
        ...check,

        evidence:
          Object.freeze([
            ...check.evidence
          ])
      });

    this.checks.set(
      check.checkId,
      stored
    );

    return stored;
  }

  get(
    checkId: string
  ):
    Readonly<TaxGuardReadinessCheck> |
    undefined {

    return this.checks.get(
      checkId
    );
  }

  list():
    readonly Readonly<TaxGuardReadinessCheck>[] {

    return Object.freeze(
      [
        ...this.checks.values()
      ]
    );
  }

  summarize():
    Readonly<TaxGuardReadinessSummary> {

    const checks =
      this.list();

    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let notChecked = 0;
    let requiredIncomplete = 0;

    const blockers:
      string[] = [];

    for (
      const check
      of checks
    ) {
      if (
        check.status === 'PASS'
      ) {
        passed += 1;
      }

      if (
        check.status === 'FAIL'
      ) {
        failed += 1;
      }

      if (
        check.status === 'BLOCKED'
      ) {
        blocked += 1;
      }

      if (
        check.status === 'NOT_CHECKED'
      ) {
        notChecked += 1;
      }

      if (
        check.required &&
        check.status !== 'PASS'
      ) {
        requiredIncomplete += 1;

        blockers.push(
          check.blockerReason ??
          (
            check.checkId +
            '_NOT_PASSED'
          )
        );
      }
    }

    return Object.freeze({
      total:
        checks.length,

      passed,
      failed,
      blocked,
      notChecked,
      requiredIncomplete,

      releaseAllowed:
        requiredIncomplete === 0,

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}

export interface TaxGuardGoLiveAcceptance {
  acceptanceId: string;

  environment:
    'PRODUCTION';

  frontendVerified:
    boolean;

  apiVerified:
    boolean;

  authenticationVerified:
    boolean;

  sessionVerified:
    boolean;

  databaseVerified:
    boolean;

  tenantIsolationVerified:
    boolean;

  documentIntelligenceVerified:
    boolean;

  auditVerified:
    boolean;

  monitoringVerified:
    boolean;

  backupRestoreVerified:
    boolean;

  securityVerified:
    boolean;

  regressionPassed:
    boolean;

  buildPassed:
    boolean;

  typecheckPassed:
    boolean;

  externalTaxFilingEnabled:
    false;

  acceptedBy?:
    string;

  acceptedAt?:
    string;
}

export interface TaxGuardGoLiveAcceptanceDecision {
  accepted: boolean;
  blockers: readonly string[];
}

export class TaxGuardGoLiveAcceptanceGate {

  static evaluate(
    acceptance:
      TaxGuardGoLiveAcceptance
  ):
    Readonly<TaxGuardGoLiveAcceptanceDecision> {

    requireReadinessText(
      acceptance.acceptanceId,
      'TG_GO_LIVE_ACCEPTANCE_ID_REQUIRED'
    );

    if (
      acceptance.environment !==
        'PRODUCTION'
    ) {
      throw new Error(
        'TG_GO_LIVE_PRODUCTION_ENVIRONMENT_REQUIRED'
      );
    }

    const blockers:
      string[] = [];

    const requiredChecks:
      readonly [
        keyof TaxGuardGoLiveAcceptance,
        string
      ][] = [
        [
          'frontendVerified',
          'FRONTEND_NOT_VERIFIED'
        ],
        [
          'apiVerified',
          'API_NOT_VERIFIED'
        ],
        [
          'authenticationVerified',
          'AUTHENTICATION_NOT_VERIFIED'
        ],
        [
          'sessionVerified',
          'SESSION_NOT_VERIFIED'
        ],
        [
          'databaseVerified',
          'DATABASE_NOT_VERIFIED'
        ],
        [
          'tenantIsolationVerified',
          'TENANT_ISOLATION_NOT_VERIFIED'
        ],
        [
          'documentIntelligenceVerified',
          'DOCUMENT_INTELLIGENCE_NOT_VERIFIED'
        ],
        [
          'auditVerified',
          'AUDIT_NOT_VERIFIED'
        ],
        [
          'monitoringVerified',
          'MONITORING_NOT_VERIFIED'
        ],
        [
          'backupRestoreVerified',
          'BACKUP_RESTORE_NOT_VERIFIED'
        ],
        [
          'securityVerified',
          'SECURITY_NOT_VERIFIED'
        ],
        [
          'regressionPassed',
          'REGRESSION_NOT_PASSED'
        ],
        [
          'buildPassed',
          'BUILD_NOT_PASSED'
        ],
        [
          'typecheckPassed',
          'TYPECHECK_NOT_PASSED'
        ]
      ];

    for (
      const [
        key,
        reason
      ]
      of requiredChecks
    ) {
      if (
        acceptance[key] !== true
      ) {
        blockers.push(
          reason
        );
      }
    }

    if (
      acceptance.externalTaxFilingEnabled
    ) {
      blockers.push(
        'EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED'
      );
    }

    if (
      acceptance.acceptedAt &&
      !Number.isFinite(
        Date.parse(
          acceptance.acceptedAt
        )
      )
    ) {
      throw new Error(
        'TG_GO_LIVE_ACCEPTED_AT_INVALID'
      );
    }

    if (
      blockers.length === 0 &&
      !acceptance.acceptedBy
    ) {
      blockers.push(
        'AUTHORIZED_ACCEPTANCE_REQUIRED'
      );
    }

    return Object.freeze({
      accepted:
        blockers.length === 0,

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}

export interface TaxGuardProductionVerificationEvidence {
  evidenceId: string;
  checkId: string;
  source: string;
  capturedAt: string;
  description: string;
  verifiedBy: string;
  immutable: true;
}

export class TaxGuardProductionVerificationEvidenceRegistry {

  private readonly evidence =
    new Map<
      string,
      Readonly<TaxGuardProductionVerificationEvidence>
    >();

  register(
    record:
      TaxGuardProductionVerificationEvidence
  ):
    Readonly<TaxGuardProductionVerificationEvidence> {

    requireReadinessText(
      record.evidenceId,
      'TG_PRODUCTION_EVIDENCE_ID_REQUIRED'
    );

    requireReadinessText(
      record.checkId,
      'TG_PRODUCTION_EVIDENCE_CHECK_ID_REQUIRED'
    );

    requireReadinessText(
      record.source,
      'TG_PRODUCTION_EVIDENCE_SOURCE_REQUIRED'
    );

    requireReadinessText(
      record.description,
      'TG_PRODUCTION_EVIDENCE_DESCRIPTION_REQUIRED'
    );

    requireReadinessText(
      record.verifiedBy,
      'TG_PRODUCTION_EVIDENCE_VERIFIER_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          record.capturedAt
        )
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_EVIDENCE_TIMESTAMP_INVALID'
      );
    }

    if (
      record.immutable !== true
    ) {
      throw new Error(
        'TG_PRODUCTION_EVIDENCE_MUST_BE_IMMUTABLE'
      );
    }

    if (
      this.evidence.has(
        record.evidenceId
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_EVIDENCE_DUPLICATE'
      );
    }

    const stored =
      Object.freeze({
        ...record
      });

    this.evidence.set(
      record.evidenceId,
      stored
    );

    return stored;
  }

  get(
    evidenceId: string
  ):
    Readonly<TaxGuardProductionVerificationEvidence> |
    undefined {

    return this.evidence.get(
      evidenceId
    );
  }

  list():
    readonly Readonly<TaxGuardProductionVerificationEvidence>[] {

    return Object.freeze(
      [
        ...this.evidence.values()
      ]
    );
  }
}
`
);


/*
 * ============================================================
 * FILE 4
 * ProductionOperations.ts
 * ============================================================
 */

write(
  'src/taxguard/go-live/ProductionOperations.ts',
  String.raw`
export type TaxGuardProductionDependency =
  | 'FRONTEND'
  | 'API'
  | 'AUTHENTICATION'
  | 'FIREBASE'
  | 'DATABASE'
  | 'DOCUMENT_INTELLIGENCE'
  | 'MONITORING'
  | 'BACKUP';

export type TaxGuardProductionDependencyStatus =
  | 'UNKNOWN'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'BLOCKED';

export interface TaxGuardProductionDependencyHealth {
  dependency:
    TaxGuardProductionDependency;

  status:
    TaxGuardProductionDependencyStatus;

  checkedAt:
    string;

  latencyMs?:
    number;

  evidence:
    readonly string[];
}

export interface TaxGuardProductionHealthSummary {
  healthy:
    boolean;

  degraded:
    boolean;

  unavailable:
    readonly TaxGuardProductionDependency[];

  blocked:
    readonly TaxGuardProductionDependency[];
}

function requireOperationsText(
  value: string,
  errorCode: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}

export class TaxGuardProductionHealthMonitor {

  static summarize(
    checks:
      readonly TaxGuardProductionDependencyHealth[]
  ):
    Readonly<TaxGuardProductionHealthSummary> {

    const unavailable:
      TaxGuardProductionDependency[] = [];

    const blocked:
      TaxGuardProductionDependency[] = [];

    let degraded =
      false;

    for (
      const check
      of checks
    ) {
      if (
        !Number.isFinite(
          Date.parse(
            check.checkedAt
          )
        )
      ) {
        throw new Error(
          'TG_PRODUCTION_HEALTH_TIMESTAMP_INVALID'
        );
      }

      if (
        check.latencyMs !== undefined &&
        (
          !Number.isFinite(
            check.latencyMs
          ) ||
          check.latencyMs < 0
        )
      ) {
        throw new Error(
          'TG_PRODUCTION_HEALTH_LATENCY_INVALID'
        );
      }

      if (
        check.status === 'DEGRADED'
      ) {
        degraded =
          true;
      }

      if (
        check.status === 'UNAVAILABLE'
      ) {
        unavailable.push(
          check.dependency
        );
      }

      if (
        check.status === 'BLOCKED' ||
        check.status === 'UNKNOWN'
      ) {
        blocked.push(
          check.dependency
        );
      }
    }

    return Object.freeze({
      healthy:
        unavailable.length === 0 &&
        blocked.length === 0 &&
        !degraded,

      degraded,

      unavailable:
        Object.freeze([
          ...unavailable
        ]),

      blocked:
        Object.freeze([
          ...blocked
        ])
    });
  }
}

export type TaxGuardProductionIncidentSeverity =
  | 'INFO'
  | 'WARNING'
  | 'MATERIAL'
  | 'CRITICAL';

export type TaxGuardProductionIncidentStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'MITIGATING'
  | 'RESOLVED';

export interface TaxGuardProductionIncident {
  incidentId: string;

  severity:
    TaxGuardProductionIncidentSeverity;

  status:
    TaxGuardProductionIncidentStatus;

  component:
    TaxGuardProductionDependency;

  summary: string;

  detectedAt: string;

  acknowledgedBy?:
    string;

  resolvedAt?:
    string;

  evidence:
    readonly string[];
}

export class TaxGuardProductionIncidentRegistry {

  private readonly incidents =
    new Map<
      string,
      Readonly<TaxGuardProductionIncident>
    >();

  register(
    incident:
      TaxGuardProductionIncident
  ):
    Readonly<TaxGuardProductionIncident> {

    requireOperationsText(
      incident.incidentId,
      'TG_PRODUCTION_INCIDENT_ID_REQUIRED'
    );

    requireOperationsText(
      incident.summary,
      'TG_PRODUCTION_INCIDENT_SUMMARY_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          incident.detectedAt
        )
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_INCIDENT_TIMESTAMP_INVALID'
      );
    }

    if (
      incident.resolvedAt &&
      !Number.isFinite(
        Date.parse(
          incident.resolvedAt
        )
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_INCIDENT_RESOLVED_TIMESTAMP_INVALID'
      );
    }

    if (
      incident.status === 'RESOLVED' &&
      !incident.resolvedAt
    ) {
      throw new Error(
        'TG_PRODUCTION_INCIDENT_RESOLUTION_REQUIRED'
      );
    }

    if (
      this.incidents.has(
        incident.incidentId
      )
    ) {
      throw new Error(
        'TG_PRODUCTION_INCIDENT_DUPLICATE'
      );
    }

    const stored =
      Object.freeze({
        ...incident,

        evidence:
          Object.freeze([
            ...incident.evidence
          ])
      });

    this.incidents.set(
      incident.incidentId,
      stored
    );

    return stored;
  }

  get(
    incidentId: string
  ):
    Readonly<TaxGuardProductionIncident> |
    undefined {

    return this.incidents.get(
      incidentId
    );
  }

  listOpen():
    readonly Readonly<TaxGuardProductionIncident>[] {

    return Object.freeze(
      [
        ...this.incidents
          .values()
      ].filter(
        incident =>
          incident.status !==
            'RESOLVED'
      )
    );
  }

  hasCriticalOpenIncident():
    boolean {

    return this.listOpen()
      .some(
        incident =>
          incident.severity ===
            'CRITICAL'
      );
  }
}

export interface TaxGuardBackupVerification {
  verificationId: string;
  backupCreated: boolean;
  backupEncrypted: boolean;
  backupIntegrityVerified: boolean;
  restoreTestPerformed: boolean;
  restoreTestPassed: boolean;
  tenantIsolationPreserved: boolean;
  verifiedAt: string;
  verifiedBy: string;
}

export interface TaxGuardBackupDecision {
  productionReady: boolean;
  blockers: readonly string[];
}

export class TaxGuardBackupRecoveryGate {

  static evaluate(
    verification:
      TaxGuardBackupVerification
  ):
    Readonly<TaxGuardBackupDecision> {

    requireOperationsText(
      verification.verificationId,
      'TG_BACKUP_VERIFICATION_ID_REQUIRED'
    );

    requireOperationsText(
      verification.verifiedBy,
      'TG_BACKUP_VERIFIER_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          verification.verifiedAt
        )
      )
    ) {
      throw new Error(
        'TG_BACKUP_VERIFICATION_TIMESTAMP_INVALID'
      );
    }

    const blockers:
      string[] = [];

    if (
      !verification.backupCreated
    ) {
      blockers.push(
        'BACKUP_NOT_CREATED'
      );
    }

    if (
      !verification.backupEncrypted
    ) {
      blockers.push(
        'BACKUP_NOT_ENCRYPTED'
      );
    }

    if (
      !verification.backupIntegrityVerified
    ) {
      blockers.push(
        'BACKUP_INTEGRITY_NOT_VERIFIED'
      );
    }

    if (
      !verification.restoreTestPerformed
    ) {
      blockers.push(
        'RESTORE_TEST_NOT_PERFORMED'
      );
    }

    if (
      !verification.restoreTestPassed
    ) {
      blockers.push(
        'RESTORE_TEST_NOT_PASSED'
      );
    }

    if (
      !verification.tenantIsolationPreserved
    ) {
      blockers.push(
        'RESTORE_TENANT_ISOLATION_NOT_VERIFIED'
      );
    }

    return Object.freeze({
      productionReady:
        blockers.length === 0,

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}

export interface TaxGuardOperationalAlert {
  alertId: string;

  severity:
    TaxGuardProductionIncidentSeverity;

  source:
    TaxGuardProductionDependency;

  message:
    string;

  createdAt:
    string;

  requiresHumanResponse:
    boolean;
}

export class TaxGuardOperationalAlertGuard {

  static validate(
    alert:
      TaxGuardOperationalAlert
  ):
    Readonly<TaxGuardOperationalAlert> {

    requireOperationsText(
      alert.alertId,
      'TG_OPERATIONAL_ALERT_ID_REQUIRED'
    );

    requireOperationsText(
      alert.message,
      'TG_OPERATIONAL_ALERT_MESSAGE_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          alert.createdAt
        )
      )
    ) {
      throw new Error(
        'TG_OPERATIONAL_ALERT_TIMESTAMP_INVALID'
      );
    }

    if (
      (
        alert.severity === 'MATERIAL' ||
        alert.severity === 'CRITICAL'
      ) &&
      !alert.requiresHumanResponse
    ) {
      throw new Error(
        'TG_OPERATIONAL_ALERT_HUMAN_RESPONSE_REQUIRED'
      );
    }

    return Object.freeze({
      ...alert
    });
  }
}

export interface TaxGuardProductionReleaseSnapshot {
  snapshotId: string;
  releaseVersion: string;
  commitId: string;
  createdAt: string;

  regressionPassed:
    boolean;

  buildPassed:
    boolean;

  typecheckPassed:
    boolean;

  productionEndpointVerified:
    boolean;

  authenticationVerified:
    boolean;

  databaseVerified:
    boolean;

  documentIntelligenceVerified:
    boolean;

  monitoringVerified:
    boolean;

  backupRestoreVerified:
    boolean;

  criticalIncidentsOpen:
    number;

  externalTaxFilingEnabled:
    false;
}

export interface TaxGuardProductionReleaseDecision {
  releasable: boolean;
  blockers: readonly string[];
}

export class TaxGuardProductionReleaseGate {

  static evaluate(
    snapshot:
      TaxGuardProductionReleaseSnapshot
  ):
    Readonly<TaxGuardProductionReleaseDecision> {

    requireOperationsText(
      snapshot.snapshotId,
      'TG_RELEASE_SNAPSHOT_ID_REQUIRED'
    );

    requireOperationsText(
      snapshot.releaseVersion,
      'TG_RELEASE_VERSION_REQUIRED'
    );

    requireOperationsText(
      snapshot.commitId,
      'TG_RELEASE_COMMIT_REQUIRED'
    );

    if (
      !Number.isFinite(
        Date.parse(
          snapshot.createdAt
        )
      )
    ) {
      throw new Error(
        'TG_RELEASE_TIMESTAMP_INVALID'
      );
    }

    if (
      !Number.isInteger(
        snapshot.criticalIncidentsOpen
      ) ||
      snapshot.criticalIncidentsOpen < 0
    ) {
      throw new Error(
        'TG_RELEASE_INCIDENT_COUNT_INVALID'
      );
    }

    const blockers:
      string[] = [];

    const checks:
      readonly [
        keyof TaxGuardProductionReleaseSnapshot,
        string
      ][] = [
        [
          'regressionPassed',
          'REGRESSION_NOT_PASSED'
        ],
        [
          'buildPassed',
          'BUILD_NOT_PASSED'
        ],
        [
          'typecheckPassed',
          'TYPECHECK_NOT_PASSED'
        ],
        [
          'productionEndpointVerified',
          'PRODUCTION_ENDPOINT_NOT_VERIFIED'
        ],
        [
          'authenticationVerified',
          'PRODUCTION_AUTH_NOT_VERIFIED'
        ],
        [
          'databaseVerified',
          'PRODUCTION_DATABASE_NOT_VERIFIED'
        ],
        [
          'documentIntelligenceVerified',
          'DOCUMENT_INTELLIGENCE_NOT_VERIFIED'
        ],
        [
          'monitoringVerified',
          'MONITORING_NOT_VERIFIED'
        ],
        [
          'backupRestoreVerified',
          'BACKUP_RESTORE_NOT_VERIFIED'
        ]
      ];

    for (
      const [
        key,
        reason
      ]
      of checks
    ) {
      if (
        snapshot[key] !== true
      ) {
        blockers.push(
          reason
        );
      }
    }

    if (
      snapshot.criticalIncidentsOpen > 0
    ) {
      blockers.push(
        'CRITICAL_PRODUCTION_INCIDENT_OPEN'
      );
    }

    if (
      snapshot.externalTaxFilingEnabled
    ) {
      blockers.push(
        'EXTERNAL_TAX_FILING_MUST_REMAIN_DISABLED'
      );
    }

    return Object.freeze({
      releasable:
        blockers.length === 0,

      blockers:
        Object.freeze([
          ...blockers
        ])
    });
  }
}
`
);

/*
 * ============================================================
 * FILE 5
 * go-live/index.ts
 * ============================================================
 */

write(
  'src/taxguard/go-live/index.ts',
  String.raw`
export * from './ProductionIntegration';
export * from './ProductionAuthentication';
export * from './ProductionReadiness';
export * from './ProductionOperations';
`
);


/*
 * ============================================================
 * FILE 6
 * taxGuardProductionIntegration.test.ts
 * ============================================================
 */

write(
  'src/tests/taxGuardProductionIntegration.test.ts',
  String.raw`
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardProductionEndpointGuard,
  TaxGuardProductionProbeGuard,
  TaxGuardProductionTopologyGuard,
  TaxGuardProductionRouteRegistry,
  TaxGuardProduction405Analyzer,
  TaxGuardProductionIntegrationGate
} from '../taxguard/go-live/ProductionIntegration';

import {
  TaxGuardAuthenticationAnalyzer,
  TaxGuardSessionIdentityGuard,
  TaxGuardApiRuntimeBindingGuard,
  TaxGuardProductionRouteDiagnoser
} from '../taxguard/go-live/ProductionAuthentication';

import {
  TaxGuardReadinessRegistry,
  TaxGuardGoLiveAcceptanceGate,
  TaxGuardProductionVerificationEvidenceRegistry
} from '../taxguard/go-live/ProductionReadiness';

import {
  TaxGuardProductionHealthMonitor,
  TaxGuardProductionIncidentRegistry,
  TaxGuardBackupRecoveryGate,
  TaxGuardOperationalAlertGuard,
  TaxGuardProductionReleaseGate
} from '../taxguard/go-live/ProductionOperations';


describe(
  'TaxGuard Production Integration and Go-Live',
  () => {

    it(
      'P1 validates a production API endpoint contract',
      () => {

        const endpoint =
          TaxGuardProductionEndpointGuard
            .validate({
              endpointId:
                'AUTH_SESSION',

              name:
                'Firebase Session',

              url:
                'https://api.example.com/api/auth/firebase-session',

              method:
                'POST',

              expectedRuntime:
                'NODE_API',

              expectedStatusCodes:
                [200],

              authenticationRequired:
                false
            });

        expect(
          endpoint.expectedRuntime
        ).toBe(
          'NODE_API'
        );

        expect(
          endpoint.method
        ).toBe(
          'POST'
        );
      }
    );


    it(
      'P1 rejects invalid production endpoint URL',
      () => {

        expect(
          () =>
            TaxGuardProductionEndpointGuard
              .validate({
                endpointId:
                  'BAD',

                name:
                  'Bad Endpoint',

                url:
                  'not-a-url',

                method:
                  'POST',

                expectedRuntime:
                  'NODE_API',

                expectedStatusCodes:
                  [200],

                authenticationRequired:
                  false
              })
        ).toThrow(
          'TG_GO_LIVE_ENDPOINT_URL_INVALID'
        );
      }
    );


    it(
      'P1 verifies matching API probe evidence',
      () => {

        const endpoint = {
          endpointId:
            'API_HEALTH',

          name:
            'API Health',

          url:
            'https://api.example.com/api/health',

          method:
            'GET' as const,

          expectedRuntime:
            'NODE_API' as const,

          expectedStatusCodes:
            [200],

          authenticationRequired:
            false
        };

        const result =
          TaxGuardProductionProbeGuard
            .validate(
              endpoint,
              {
                endpointId:
                  'API_HEALTH',

                url:
                  'https://api.example.com/api/health',

                method:
                  'GET',

                expectedRuntime:
                  'NODE_API',

                observedRuntime:
                  'NODE_API',

                statusCode:
                  200,

                status:
                  'PASS',

                checkedAt:
                  '2026-09-24T00:00:00.000Z',

                evidence:
                  [
                    'HTTP 200',
                    'JSON health response'
                  ]
              }
            );

        expect(
          result.status
        ).toBe(
          'PASS'
        );
      }
    );


    it(
      'P1 blocks static frontend from pretending to be Node API',
      () => {

        const registry =
          new TaxGuardProductionRouteRegistry();

        expect(
          () =>
            registry.register({
              routeId:
                'AUTH',

              method:
                'POST',

              path:
                '/api/auth/firebase-session',

              runtime:
                'NODE_API',

              authenticationRequired:
                false,

              staticHostingAllowed:
                true
            })
        ).toThrow(
          'TG_GO_LIVE_API_STATIC_HOSTING_BLOCKED'
        );
      }
    );


    it(
      'P1 validates separated HTTPS frontend and API topology',
      () => {

        const topology =
          TaxGuardProductionTopologyGuard
            .validate({
              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              frontendRuntime:
                'STATIC_FRONTEND',

              apiRuntime:
                'NODE_API',

              authenticationRuntime:
                'NODE_API',

              databaseRuntime:
                'DATABASE',

              externalTaxFilingEnabled:
                false
            });

        expect(
          topology.apiRuntime
        ).toBe(
          'NODE_API'
        );

        expect(
          topology.externalTaxFilingEnabled
        ).toBe(
          false
        );
      }
    );


    it(
      'P1 identifies HTTP 405 as a production release blocker',
      () => {

        const assessment =
          TaxGuardProduction405Analyzer
            .analyze({
              method:
                'POST',

              url:
                'https://app.example.com/api/auth/firebase-session',

              statusCode:
                405,

              expectedRuntime:
                'NODE_API',

              observedRuntime:
                'STATIC_FRONTEND',

              responseAllowHeader:
                'GET, HEAD'
            });

        expect(
          assessment.is405
        ).toBe(
          true
        );

        expect(
          assessment.runtimeMismatch
        ).toBe(
          true
        );

        expect(
          assessment.productionReleaseBlocked
        ).toBe(
          true
        );

        expect(
          () =>
            TaxGuardProduction405Analyzer
              .assertProductionSafe(
                assessment
              )
        ).toThrow(
          'TG_GO_LIVE_405_RELEASE_BLOCKED'
        );
      }
    );


    it(
      'P2 accepts successful production authentication probe',
      () => {

        const result =
          TaxGuardAuthenticationAnalyzer
            .analyze({
              probeId:
                'AUTH-001',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              sessionPath:
                '/api/auth/firebase-session',

              method:
                'POST',

              firebaseTokenPresent:
                true,

              statusCode:
                200,

              responseReceived:
                true,

              corsAccepted:
                true,

              sessionCreated:
                true,

              authenticatedUserId:
                'USER-001',

              clientId:
                'CLIENT-001',

              tenantId:
                'TENANT-001',

              checkedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.status
        ).toBe(
          'PASS'
        );

        expect(
          result.releaseBlocked
        ).toBe(
          false
        );
      }
    );


    it(
      'P2 diagnoses HTTP 405 authentication failure',
      () => {

        const result =
          TaxGuardAuthenticationAnalyzer
            .analyze({
              probeId:
                'AUTH-405',

              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://app.example.com',

              sessionPath:
                '/api/auth/firebase-session',

              method:
                'POST',

              firebaseTokenPresent:
                true,

              statusCode:
                405,

              responseReceived:
                true,

              corsAccepted:
                true,

              sessionCreated:
                false,

              checkedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.failure
        ).toBe(
          'HTTP_405'
        );

        expect(
          result.releaseBlocked
        ).toBe(
          true
        );
      }
    );


    it(
      'P2 blocks cross-client and cross-tenant session access',
      () => {

        const identity = {
          userId:
            'USER-001',

          clientId:
            'CLIENT-001',

          tenantId:
            'TENANT-001',

          roles:
            ['CLIENT'],

          issuedAt:
            '2026-09-24T00:00:00.000Z',

          expiresAt:
            '2026-09-24T01:00:00.000Z'
        };

        expect(
          () =>
            TaxGuardSessionIdentityGuard
              .assertClientAccess(
                identity,
                'CLIENT-999',
                'TENANT-001'
              )
        ).toThrow(
          'TG_SESSION_CROSS_CLIENT_BLOCKED'
        );

        expect(
          () =>
            TaxGuardSessionIdentityGuard
              .assertClientAccess(
                identity,
                'CLIENT-001',
                'TENANT-999'
              )
        ).toThrow(
          'TG_SESSION_CROSS_TENANT_BLOCKED'
        );
      }
    );


    it(
      'P2 validates API runtime binding',
      () => {

        const binding =
          TaxGuardApiRuntimeBindingGuard
            .validate({
              frontendOrigin:
                'https://app.example.com',

              apiOrigin:
                'https://api.example.com',

              sessionEndpoint:
                '/api/auth/firebase-session',

              healthEndpoint:
                '/api/health',

              apiRuntime:
                'NODE_API',

              staticFrontendMayHandleApi:
                false
            });

        expect(
          binding.staticFrontendMayHandleApi
        ).toBe(
          false
        );
      }
    );


    it(
      'P2 detects HTML returned from an API route',
      () => {

        const diagnosis =
          TaxGuardProductionRouteDiagnoser
            .diagnose({
              route:
                '/api/auth/firebase-session',

              method:
                'POST',

              statusCode:
                200,

              contentType:
                'text/html',

              responseLooksLikeHtml:
                true,

              responseLooksLikeJson:
                false
            });

        expect(
          diagnosis.staticFrontendLikely
        ).toBe(
          true
        );

        expect(
          diagnosis.releaseBlocked
        ).toBe(
          true
        );
      }
    );


    it(
      'P3 requires evidence before readiness check can pass',
      () => {

        const registry =
          new TaxGuardReadinessRegistry();

        expect(
          () =>
            registry.register({
              checkId:
                'DATABASE',

              area:
                'DATABASE',

              name:
                'Production database',

              required:
                true,

              status:
                'PASS',

              checkedAt:
                '2026-09-24T00:00:00.000Z',

              evidence:
                []
            })
        ).toThrow(
          'TG_READINESS_PASS_REQUIRES_EVIDENCE'
        );
      }
    );


    it(
      'P3 summarizes incomplete production readiness fail closed',
      () => {

        const registry =
          new TaxGuardReadinessRegistry();

        registry.register({
          checkId:
            'FRONTEND',

          area:
            'FRONTEND',

          name:
            'Frontend',

          required:
            true,

          status:
            'PASS',

          checkedAt:
            '2026-09-24T00:00:00.000Z',

          evidence:
            ['HTTPS page loaded']
        });

        registry.register({
          checkId:
            'API',

          area:
            'API',

          name:
            'API',

          required:
            true,

          status:
            'BLOCKED',

          checkedAt:
            '2026-09-24T00:00:00.000Z',

          evidence:
            ['HTTP 405 observed'],

          blockerReason:
            'API_RUNTIME_NOT_VERIFIED'
        });

        const summary =
          registry.summarize();

        expect(
          summary.releaseAllowed
        ).toBe(
          false
        );

        expect(
          summary.requiredIncomplete
        ).toBe(
          1
        );
      }
    );


    it(
      'P3 stores immutable production verification evidence',
      () => {

        const registry =
          new TaxGuardProductionVerificationEvidenceRegistry();

        const evidence =
          registry.register({
            evidenceId:
              'EVIDENCE-001',

            checkId:
              'API',

            source:
              'production-probe',

            capturedAt:
              '2026-09-24T00:00:00.000Z',

            description:
              'API health endpoint returned expected response.',

            verifiedBy:
              'authorized-reviewer',

            immutable:
              true
          });

        expect(
          Object.isFrozen(
            evidence
          )
        ).toBe(
          true
        );
      }
    );


    it(
      'P4 detects unavailable production dependencies',
      () => {

        const summary =
          TaxGuardProductionHealthMonitor
            .summarize([
              {
                dependency:
                  'FRONTEND',

                status:
                  'HEALTHY',

                checkedAt:
                  '2026-09-24T00:00:00.000Z',

                latencyMs:
                  50,

                evidence:
                  ['HTTP 200']
              },
              {
                dependency:
                  'API',

                status:
                  'UNAVAILABLE',

                checkedAt:
                  '2026-09-24T00:00:00.000Z',

                evidence:
                  ['Connection failed']
              }
            ]);

        expect(
          summary.healthy
        ).toBe(
          false
        );

        expect(
          summary.unavailable
        ).toContain(
          'API'
        );
      }
    );


    it(
      'P5 requires encrypted backup and successful restore test',
      () => {

        const result =
          TaxGuardBackupRecoveryGate
            .evaluate({
              verificationId:
                'BACKUP-001',

              backupCreated:
                true,

              backupEncrypted:
                true,

              backupIntegrityVerified:
                true,

              restoreTestPerformed:
                true,

              restoreTestPassed:
                true,

              tenantIsolationPreserved:
                true,

              verifiedAt:
                '2026-09-24T00:00:00.000Z',

              verifiedBy:
                'authorized-reviewer'
            });

        expect(
          result.productionReady
        ).toBe(
          true
        );
      }
    );


    it(
      'P5 requires human response for critical operational alerts',
      () => {

        expect(
          () =>
            TaxGuardOperationalAlertGuard
              .validate({
                alertId:
                  'ALERT-001',

                severity:
                  'CRITICAL',

                source:
                  'DATABASE',

                message:
                  'Production database unavailable.',

                createdAt:
                  '2026-09-24T00:00:00.000Z',

                requiresHumanResponse:
                  false
              })
        ).toThrow(
          'TG_OPERATIONAL_ALERT_HUMAN_RESPONSE_REQUIRED'
        );
      }
    );


    it(
      'P5 detects open critical production incidents',
      () => {

        const registry =
          new TaxGuardProductionIncidentRegistry();

        registry.register({
          incidentId:
            'INCIDENT-001',

          severity:
            'CRITICAL',

          status:
            'OPEN',

          component:
            'API',

          summary:
            'Production API unavailable.',

          detectedAt:
            '2026-09-24T00:00:00.000Z',

          evidence:
            ['Health probe failed']
        });

        expect(
          registry.hasCriticalOpenIncident()
        ).toBe(
          true
        );
      }
    );


    it(
      'P6 production integration gate fails closed',
      () => {

        const result =
          TaxGuardProductionIntegrationGate
            .evaluate({
              frontendVerified:
                true,

              apiHealthVerified:
                false,

              authenticationVerified:
                false,

              sessionVerified:
                false,

              databaseVerified:
                true,

              tenantIsolationVerified:
                true,

              auditVerified:
                true,

              documentIntelligenceVerified:
                false,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          result.releaseAllowed
        ).toBe(
          false
        );

        expect(
          result.blockers
        ).toContain(
          'API_HEALTH_NOT_VERIFIED'
        );
      }
    );


    it(
      'P6 release gate blocks unresolved production requirements',
      () => {

        const decision =
          TaxGuardProductionReleaseGate
            .evaluate({
              snapshotId:
                'RELEASE-001',

              releaseVersion:
                'production-candidate',

              commitId:
                'local-test-commit',

              createdAt:
                '2026-09-24T00:00:00.000Z',

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              productionEndpointVerified:
                false,

              authenticationVerified:
                false,

              databaseVerified:
                true,

              documentIntelligenceVerified:
                false,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              criticalIncidentsOpen:
                0,

              externalTaxFilingEnabled:
                false
            });

        expect(
          decision.releasable
        ).toBe(
          false
        );

        expect(
          decision.blockers
        ).toContain(
          'PRODUCTION_ENDPOINT_NOT_VERIFIED'
        );
      }
    );


    it(
      'P7 requires authorized acceptance before go-live',
      () => {

        const result =
          TaxGuardGoLiveAcceptanceGate
            .evaluate({
              acceptanceId:
                'ACCEPTANCE-001',

              environment:
                'PRODUCTION',

              frontendVerified:
                true,

              apiVerified:
                true,

              authenticationVerified:
                true,

              sessionVerified:
                true,

              databaseVerified:
                true,

              tenantIsolationVerified:
                true,

              documentIntelligenceVerified:
                true,

              auditVerified:
                true,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              securityVerified:
                true,

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              externalTaxFilingEnabled:
                false
            });

        expect(
          result.accepted
        ).toBe(
          false
        );

        expect(
          result.blockers
        ).toContain(
          'AUTHORIZED_ACCEPTANCE_REQUIRED'
        );
      }
    );


    it(
      'P7 permits acceptance only after every production gate passes',
      () => {

        const result =
          TaxGuardGoLiveAcceptanceGate
            .evaluate({
              acceptanceId:
                'ACCEPTANCE-002',

              environment:
                'PRODUCTION',

              frontendVerified:
                true,

              apiVerified:
                true,

              authenticationVerified:
                true,

              sessionVerified:
                true,

              databaseVerified:
                true,

              tenantIsolationVerified:
                true,

              documentIntelligenceVerified:
                true,

              auditVerified:
                true,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              securityVerified:
                true,

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              externalTaxFilingEnabled:
                false,

              acceptedBy:
                'authorized-production-reviewer',

              acceptedAt:
                '2026-09-24T00:00:00.000Z'
            });

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          result.blockers
        ).toHaveLength(
          0
        );
      }
    );


    it(
      'P7 keeps external tax submission disabled',
      () => {

        const release =
          TaxGuardProductionReleaseGate
            .evaluate({
              snapshotId:
                'RELEASE-002',

              releaseVersion:
                'production-candidate',

              commitId:
                'local-test-commit',

              createdAt:
                '2026-09-24T00:00:00.000Z',

              regressionPassed:
                true,

              buildPassed:
                true,

              typecheckPassed:
                true,

              productionEndpointVerified:
                true,

              authenticationVerified:
                true,

              databaseVerified:
                true,

              documentIntelligenceVerified:
                true,

              monitoringVerified:
                true,

              backupRestoreVerified:
                true,

              criticalIncidentsOpen:
                0,

              externalTaxFilingEnabled:
                false
            });

        expect(
          release.releasable
        ).toBe(
          true
        );
      }
    );
  }
);
`
);


/*
 * ============================================================
 * TAXGUARD PRODUCTION INTEGRATION BUILDER
 * FINALIZATION
 * ============================================================
 *
 * Production Integration phases:
 *
 * P1 - Production API and Routing
 * P2 - Authentication and Session
 * P3 - Database / Tenant / Readiness
 * P4 - Production Health Monitoring
 * P5 - Backup / Recovery / Incident Operations
 * P6 - Security / Release Gate
 * P7 - Go-Live Acceptance
 *
 * IMPORTANT:
 * This builder creates production integration architecture.
 * It does NOT claim that any external production service,
 * endpoint, database, OCR provider, backup service, or deployment
 * has been successfully verified merely because this builder runs.
 *
 * External tax filing remains disabled.
 * ============================================================
 */

const requiredFiles = [
  'src/taxguard/go-live/ProductionIntegration.ts',
  'src/taxguard/go-live/ProductionAuthentication.ts',
  'src/taxguard/go-live/ProductionReadiness.ts',
  'src/taxguard/go-live/ProductionOperations.ts',
  'src/taxguard/go-live/index.ts',
  'src/tests/taxGuardProductionIntegration.test.ts'
];

console.log('');
console.log('============================================================');
console.log('TaxGuard Production Integration builder completed.');
console.log('============================================================');
console.log('');

let missingFiles = 0;

for (const relativePath of requiredFiles) {
  const target =
    path.join(
      root,
      relativePath
    );

  if (
    fs.existsSync(
      target
    )
  ) {
    console.log(
      'Verified:',
      relativePath
    );
  } else {
    missingFiles += 1;

    console.error(
      'MISSING:',
      relativePath
    );
  }
}

console.log('');

if (
  missingFiles > 0
) {
  console.error(
    'Production Integration builder verification FAILED.'
  );

  console.error(
    'Missing generated files:',
    missingFiles
  );

  process.exitCode = 1;
} else {
  console.log(
    'Production Integration source generation PASSED.'
  );

  console.log('');
  console.log(
    'Next validation gates:'
  );

  console.log(
    '1. TypeScript compilation'
  );

  console.log(
    '2. Production Integration targeted tests'
  );

  console.log(
    '3. Full regression suite'
  );

  console.log(
    '4. Production build'
  );

  console.log(
    '5. Final TypeScript validation'
  );

  console.log(
    '6. Git review'
  );

  console.log('');
  console.log(
    'Production status is NOT automatically marked LIVE.'
  );

  console.log(
    'Real production endpoints must be verified independently.'
  );

  console.log(
    'HTTP 405 remains a release blocker if observed.'
  );

  console.log(
    'External tax submission remains disabled.'
  );
}

console.log('');
console.log('============================================================');





