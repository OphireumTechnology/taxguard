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
