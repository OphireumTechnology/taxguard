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
