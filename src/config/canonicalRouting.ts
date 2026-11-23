/**
 * DESTRIA TAX SERVICES, LLC - Canonical Production URL Routing Authority
 * 
 * Enforces clean pathname-based production routing:
 * - /portal (Client Portal canonical entry)
 * - /portal/login (Client login)
 * - /staff (Staff Portal canonical entry)
 * - /staff/login (Staff login)
 * 
 * Normalizes legacy hash URLs safely without redirect loops.
 * Protects staff workspaces with server-authoritative role verification.
 */

import { PageRoute } from '../context/AppContext';

export const CANONICAL_ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  SERVICES: '/services',
  INDUSTRIES: '/industries',
  TAX_STRATEGIES: '/tax-strategies',
  BOOK_CONSULTATION: '/book-consultation',
  PORTAL: '/portal',
  PORTAL_LOGIN: '/portal/login',
  PORTAL_REGISTER: '/portal/register',
  PORTAL_DASHBOARD: '/portal/dashboard',
  PORTAL_DOCUMENTS: '/portal/documents',
  PORTAL_COLLECTION:'/portal/collection',
  PORTAL_REQUESTS: '/portal/requests',
  PORTAL_APPOINTMENTS: '/portal/appointments',
  PORTAL_PROFILE: '/portal/profile',
  STAFF: '/staff',
  STAFF_LOGIN: '/staff/login',
  STAFF_WORKSPACE: '/staff/workspace',
  SUPER_ADMIN_CONSOLE: '/staff/super-admin',
  AI_COMMAND_CENTER: '/admin/master/ai',
  ADMIN_LOGIN: '/admin/login',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_USERS: '/admin/users',
  ADMIN_SECURITY: '/admin/security',
  ADMIN_AUDIT: '/admin/audit',
  ADMIN_AI_CONTROL: '/admin/ai-control',
  ADMIN_SETTINGS: '/admin/settings',
  TAX_FORMS_LIBRARY: '/staff/forms',
  STAFF_ACCOUNT_SECURITY: '/staff/account-security',
  PORTALS_DIRECTORY: '/portals'
} as const;

export const ADMIN_PROTECTED_PAGE_ROUTES = new Set<PageRoute>([
  'admin_command_center',
  'admin_users',
  'admin_security',
  'admin_audit',
  'admin_ai_control',
  'admin_settings'
]);

export function isProtectedAdminPageRoute(page: PageRoute | string | null | undefined): boolean {
  return Boolean(page && ADMIN_PROTECTED_PAGE_ROUTES.has(page as PageRoute));
}

export function isSuperAdministratorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === 'super_admin' || normalized === 'super_administrator';
}

export const AUTHORIZED_STAFF_ROLES = new Set([
  'practice_manager',
  'bookkeeper',
  'accountant',
  'preparer',
  'reviewer',
  'senior_reviewer',
  'admin',
  'super_admin',
  'operations'
]);

/**
 * Checks if a given role is an authorized staff role.
 * Role determination must always come from server-authoritative session state, never URL.
 */
export function canAccessStaffWorkspace(role: string | null | undefined): boolean {
  if (!role) return false;
  return AUTHORIZED_STAFF_ROLES.has(role.toLowerCase().trim());
}

/**
 * Determines the authoritative workspace for an authenticated staff member.
 */
export function resolveAuthoritativeStaffWorkspace(
  role: string | null | undefined
): 'admin_dashboard' | 'reviewer_workspace' | 'accountant_workspace' | 'bookkeeper_workspace' | 'practice_manager_workspace' | 'operations_workspace' | null {
  if (!role || !canAccessStaffWorkspace(role)) return null;
  const normalized = role.toLowerCase().trim();
  if (normalized === 'operations') return 'operations_workspace';
  if (normalized === 'practice_manager') return 'practice_manager_workspace';
  if (normalized === 'bookkeeper') return 'bookkeeper_workspace';
  if (normalized === 'admin' || normalized === 'super_admin') {
    return 'admin_dashboard';
  }
  if (normalized === 'reviewer' || normalized === 'senior_reviewer') {
    return 'reviewer_workspace';
  }
  if (normalized === 'accountant' || normalized === 'preparer') return 'accountant_workspace';
  return null;
}

/**
 * Normalizes legacy bookmarks/hash URLs safely to clean canonical pathnames.
 * Returns null if the URL is already canonical or not a legacy pattern.
 */
export function normalizeLegacyUrl(
  hashOrUrl: string | undefined | null,
  pathname?: string | undefined | null
): { canonicalPath: string; page: PageRoute } | null {
  if (!hashOrUrl && !pathname) return null;

  let rawHash = hashOrUrl || '';
  let rawPath = pathname || '';

  // If a full URL or compound path was provided in hashOrUrl
  if (rawHash.includes('#')) {
    const parts = rawHash.split('#');
    if (!rawPath) rawPath = parts[0];
    rawHash = parts[1] || '';
  } else if (!rawPath && (rawHash.startsWith('/') || rawHash.includes('/'))) {
    // If no explicit pathname was passed and hashOrUrl looks like a pathname
    rawPath = rawHash;
    rawHash = '';
  }

  const cleanHash = rawHash
    .split('?')[0]
    .replace(/^#\/?/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
    .trim();

  const cleanPath = rawPath
    .split('?')[0]
    .split('#')[0]
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
    .trim();

  // Legacy client authentication hash routes
  if (
    cleanHash === 'client/login' ||
    cleanHash === 'login' ||
    cleanHash === 'client_login' ||
    cleanHash === 'client-login' ||
    cleanHash === 'client/reset-password' ||
    cleanHash === 'client-reset-password'
  ) {
    return { canonicalPath: CANONICAL_ROUTES.PORTAL_LOGIN, page: 'client_login' };
  }

  if (
    cleanHash === 'client/register' ||
    cleanHash === 'register' ||
    cleanHash === 'client_register' ||
    cleanHash === 'client-register'
  ) {
    return { canonicalPath: CANONICAL_ROUTES.PORTAL_REGISTER, page: 'client_register' };
  }

  // Legacy staff authentication hash routes
  if (
    cleanHash === 'accountant/login' ||
    cleanHash === 'staff/login' ||
    cleanHash === 'staff_login' ||
    cleanHash === 'staff-login' ||
    cleanHash === 'reviewer/login' ||
    cleanHash === 'cpa/login'
  ) {
    return { canonicalPath: CANONICAL_ROUTES.STAFF_LOGIN, page: 'staff_login' };
  }

  // Dedicated Super Administrator portal hash routes
  if (
    cleanHash === 'admin/login' ||
    cleanHash === 'admin_login' ||
    cleanHash === 'admin-login'
  ) {
    return { canonicalPath: CANONICAL_ROUTES.ADMIN_LOGIN, page: 'admin_login' };
  }

  if (
    cleanHash === 'admin/dashboard' ||
    cleanHash === 'admin-dashboard' ||
    cleanHash === 'admin_command_center'
  ) {
    return { canonicalPath: CANONICAL_ROUTES.ADMIN_DASHBOARD, page: 'admin_command_center' };
  }

  if (cleanHash === 'admin/users' || cleanHash === 'admin_users') {
    return { canonicalPath: CANONICAL_ROUTES.ADMIN_USERS, page: 'admin_users' };
  }
  if (cleanHash === 'admin/security' || cleanHash === 'admin_security') {
    return { canonicalPath: CANONICAL_ROUTES.ADMIN_SECURITY, page: 'admin_security' };
  }
  if (cleanHash === 'admin/audit' || cleanHash === 'admin_audit') {
    return { canonicalPath: CANONICAL_ROUTES.ADMIN_AUDIT, page: 'admin_audit' };
  }
  if (cleanHash === 'admin/ai-control' || cleanHash === 'admin_ai_control') {
    return { canonicalPath: CANONICAL_ROUTES.ADMIN_AI_CONTROL, page: 'admin_ai_control' };
  }
  if (cleanHash === 'admin/settings' || cleanHash === 'admin_settings') {
    return { canonicalPath: CANONICAL_ROUTES.ADMIN_SETTINGS, page: 'admin_settings' };
  }

  // Legacy public portal directory routes
  if (
    cleanHash === 'public-v2/portals' ||
    cleanHash === 'public-v2/portal' ||
    cleanHash === 'portals' ||
    cleanHash === 'portal'
  ) {
    return { canonicalPath: CANONICAL_ROUTES.PORTAL, page: 'portal' };
  }

  // Legacy client dashboard routes
  if (
    cleanHash === 'client/dashboard' ||
    cleanHash === 'client-portal' ||
    cleanHash === 'client_portal' ||
    cleanHash === 'stage_one_onboard' ||
    cleanHash === 'stage-one-onboard' ||
    cleanHash === 'onboarding' ||
    cleanHash === 'client_onboarding' ||
    cleanHash === 'client-onboarding'
  ) {
    return { canonicalPath: CANONICAL_ROUTES.PORTAL, page: 'portal' };
  }

  // Legacy staff dashboard routes
  if (
    cleanHash === 'accountant/dashboard' ||
    cleanHash === 'accountant-workspace' ||
    cleanHash === 'reviewer/dashboard' ||
    cleanHash === 'reviewer-workspace' ||
    cleanHash === 'reviewer-portal' ||
    cleanHash === 'admin-portal' ||
    cleanHash === 'staff-portal' ||
    cleanHash === 'staff'
  ) {
    return { canonicalPath: CANONICAL_ROUTES.STAFF, page: 'staff' };
  }

  // Pathname legacy compatibility (e.g. /client/login requested directly)
  if (cleanPath === 'client/login' || cleanPath === 'login') {
    return { canonicalPath: CANONICAL_ROUTES.PORTAL_LOGIN, page: 'client_login' };
  }
  if (cleanPath === 'client/register' || cleanPath === 'register') {
    return { canonicalPath: CANONICAL_ROUTES.PORTAL_REGISTER, page: 'client_register' };
  }
  if (cleanPath === 'accountant/login') {
    return { canonicalPath: CANONICAL_ROUTES.STAFF_LOGIN, page: 'staff_login' };
  }
  if (cleanPath === 'public-v2/portals' || cleanPath === 'portals') {
    return { canonicalPath: CANONICAL_ROUTES.PORTAL, page: 'portal' };
  }

  return null;
}

/**
 * Resolves browser pathname/hash into the canonical application PageRoute.
 */
export function resolveCanonicalPageRoute(
  pathname: string,
  hash?: string
): PageRoute {
  // First normalize any legacy bookmark hash
  const legacy = normalizeLegacyUrl(hash, pathname);
  if (legacy) return legacy.page;

  const clean = (pathname || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
    .trim();

  if (!clean || clean === 'index.html') return 'home';

  // Canonical public routes
  if (clean === 'about') return 'about';
  if (clean === 'founder') return 'founder';
  if (clean === 'services') return 'services';
  if (clean === 'pricing') return 'pricing';
  if (clean === 'industries') return 'industries';
  if (clean === 'tax-strategies' || clean === 'tax_strategies') return 'tax_strategies';
  if (clean === 'book-consultation' || clean === 'book_consultation' || clean === 'consultation') return 'book_consultation';
  if (clean === 'resources' || clean === 'faq') return 'resources';
  if (clean === 'careers') return 'careers';
  if (clean === 'contact') return 'contact';
  if (clean === 'privacy' || clean === 'privacy-policy' || clean === 'privacy_policy') return 'privacy';
  if (clean === 'terms' || clean === 'terms-of-service' || clean === 'terms_of_service') return 'terms';
  if (clean === 'accessibility' || clean === 'accessibility-statement' || clean === 'accessibility_statement') return 'accessibility';
  if (clean === 'security' || clean === 'security-compliance' || clean === 'security_compliance' || clean === 'security-data-handling' || clean === 'security_data_handling') return 'security';
  if (clean === 'disclaimers' || clean === 'circular-230' || clean === 'circular_230' || clean === 'professional-disclaimers' || clean === 'professional_disclaimers') return 'disclaimers';
  if (clean === 'cookies') return 'cookies';

  // Canonical paths
  if (clean === 'portal') return 'portal';
  if (clean === 'portal/login') return 'client_login';
  if (clean === 'portal/register') return 'client_register';
  if (
    clean === 'portal/dashboard' ||
    clean === 'portal/documents' ||
    clean === 'portal/collection' ||
    clean === 'portal/requests' ||
    clean === 'portal/appointments' ||
    clean === 'portal/profile'
  ) {
    return 'portal';
  }
  if (clean === 'staff') return 'staff';
  if (clean === 'staff/login') return 'staff_login';
  if (clean === 'staff/workspace') return 'staff';
  if (clean === 'staff/super-admin') return 'super_admin_console';
  if (clean === 'admin/master/ai') return 'ai_command_center';
  if (clean === 'admin/login') return 'admin_login';
  if (clean === 'admin/dashboard' || clean === 'admin') return 'admin_command_center';
  if (clean === 'admin/users') return 'admin_users';
  if (clean === 'admin/security') return 'admin_security';
  if (clean === 'admin/audit') return 'admin_audit';
  if (clean === 'admin/ai-control') return 'admin_ai_control';
  if (clean === 'admin/settings') return 'admin_settings';
  if (clean === 'staff/forms') return 'tax_forms_library';
  if (clean === 'staff/account-security') return 'staff_account_security';

  return 'not_found';
}

/**
 * Safely replaces the browser URL state with the clean canonical pathname.
 * Avoids infinite loops by comparing current location against target.
 */
export function applyCanonicalUrl(targetPath: string, page?: PageRoute): void {
  if (typeof window === 'undefined') return;

  const currentPath = window.location.pathname;
  const currentHash = window.location.hash;

  // Only apply replaceState if the URL actually differs or contains an obsolete hash
  if (currentPath !== targetPath || (currentHash && currentHash.length > 0)) {
    try {
      window.history.replaceState({ page: page || 'portal' }, '', targetPath);
    } catch {
      // Browser environment fallback
    }
  }
}
