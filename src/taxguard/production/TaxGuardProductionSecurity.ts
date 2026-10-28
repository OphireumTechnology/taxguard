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
