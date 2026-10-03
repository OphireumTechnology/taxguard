/**
 * A/R Tax Services, LLC - Canonical Production URL Routing Authority
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
  PORTAL_REQUESTS: '/portal/requests',
  PORTAL_APPOINTMENTS: '/portal/appointments',
  PORTAL_PROFILE: '/portal/profile',
  STAFF: '/staff',
  STAFF_LOGIN: '/staff/login',
  STAFF_WORKSPACE: '/staff/workspace',
  PORTALS_DIRECTORY: '/portals'
} as const;

export const AUTHORIZED_STAFF_ROLES = new Set([
  'accountant',
  'preparer',
  'reviewer',
  'senior_reviewer',
  'admin',
  'super_admin',
  'billing',
  'compliance',
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
): 'admin_dashboard' | 'reviewer_workspace' | 'accountant_workspace' | null {
  if (!role || !canAccessStaffWorkspace(role)) return null;
  const normalized = role.toLowerCase().trim();
  if (normalized === 'admin' || normalized === 'super_admin') {
    return 'admin_dashboard';
  }
  if (normalized === 'reviewer' || normalized === 'senior_reviewer') {
    return 'reviewer_workspace';
  }
  return 'accountant_workspace';
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
    cleanHash === 'admin/login' ||
    cleanHash === 'cpa/login'
  ) {
    return { canonicalPath: CANONICAL_ROUTES.STAFF_LOGIN, page: 'staff_login' };
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
    cleanHash === 'admin/dashboard' ||
    cleanHash === 'admin-portal' ||
    cleanHash === 'admin-dashboard' ||
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
    clean === 'portal/requests' ||
    clean === 'portal/appointments' ||
    clean === 'portal/profile'
  ) {
    return 'portal';
  }
  if (clean === 'staff') return 'staff';
  if (clean === 'staff/login') return 'staff_login';
  if (clean === 'staff/workspace') return 'staff';

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
