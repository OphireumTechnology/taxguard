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
