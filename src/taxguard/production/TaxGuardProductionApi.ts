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
