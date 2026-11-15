/**
 * A/R Tax Services, LLC - Automated Test Suite
 * Canonical Production URL Routing & Working Staff Portal Verification
 *
 * Verifies the 18 user-visible routing requirements:
 * 1.  /portal canonical entry
 * 2.  /portal/login canonical client auth
 * 3.  /staff canonical staff entry
 * 4.  /staff/login canonical staff auth
 * 5.  Client Portal header href
 * 6.  Staff Portal header href
 * 7.  Staff Portal click/navigation
 * 8.  legacy /#/client/login normalization
 * 9.  legacy /#/accountant/login normalization
 * 10. legacy /#/public-v2/portals normalization
 * 11. direct navigation SPA history fallback
 * 12. refresh-safe routing
 * 13. unauthenticated staff routing
 * 14. client denial from staff workspace
 * 15. authoritative staff role routing
 * 16. redirect-loop prevention
 * 17. desktop navigation audit
 * 18. mobile navigation audit
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  CANONICAL_ROUTES,
  AUTHORIZED_STAFF_ROLES,
  canAccessStaffWorkspace,
  resolveAuthoritativeStaffWorkspace,
  normalizeLegacyUrl,
  resolveCanonicalPageRoute,
  applyCanonicalUrl
} from '../config/canonicalRouting';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('Canonical Production URL Routing & Working Staff Portal Suite', () => {
  const topUtilityBarSource = readSource('src/components/common/TopUtilityBar.tsx');
  const navbarSource = readSource('src/components/common/Navbar.tsx');
  const appSource = readSource('src/App.tsx');
  const appContextSource = readSource('src/context/AppContext.tsx');
  const serverSource = readSource('server.ts');
  const indexHtmlSource = readSource('index.html');
  const notFoundHtmlSource = readSource('public/404.html');

  // 1. /portal
  describe('1. /portal Canonical Route', () => {
    it('defines /portal as the canonical client portal route constant', () => {
      expect(CANONICAL_ROUTES.PORTAL).toBe('/portal');
    });

    it('resolves /portal directly into the portal PageRoute', () => {
      expect(resolveCanonicalPageRoute('/portal')).toBe('portal');
      expect(resolveCanonicalPageRoute('portal')).toBe('portal');
    });

    it('AppContext contains canonical /portal mapping without hash fragment', () => {
      expect(appContextSource).toContain("if (clean === 'portal') return 'portal';");
      expect(appContextSource).toContain("targetPath = '/portal';");
    });
  });

  // 2. /portal/login
  describe('2. /portal/login Canonical Route', () => {
    it('defines /portal/login as the canonical client login route constant', () => {
      expect(CANONICAL_ROUTES.PORTAL_LOGIN).toBe('/portal/login');
    });

    it('resolves /portal/login into the client_login PageRoute', () => {
      expect(resolveCanonicalPageRoute('/portal/login')).toBe('client_login');
      expect(resolveCanonicalPageRoute('portal/login')).toBe('client_login');
    });

    it('AppContext maps client_login to /portal/login', () => {
      expect(appContextSource).toContain("targetPath = '/portal/login';");
    });
  });

  // 3. /staff
  describe('3. /staff Canonical Route', () => {
    it('defines /staff as the canonical staff portal route constant', () => {
      expect(CANONICAL_ROUTES.STAFF).toBe('/staff');
    });

    it('resolves /staff directly into the staff PageRoute', () => {
      expect(resolveCanonicalPageRoute('/staff')).toBe('staff');
      expect(resolveCanonicalPageRoute('staff')).toBe('staff');
    });

    it('AppContext maps staff to clean /staff pathname', () => {
      expect(appContextSource).toContain("if (clean === 'staff') return 'staff';");
      expect(appContextSource).toContain("targetPath = '/staff';");
    });
  });

  // 4. /staff/login
  describe('4. /staff/login Canonical Route', () => {
    it('defines /staff/login as the canonical staff login route constant', () => {
      expect(CANONICAL_ROUTES.STAFF_LOGIN).toBe('/staff/login');
    });

    it('resolves /staff/login into the staff_login PageRoute', () => {
      expect(resolveCanonicalPageRoute('/staff/login')).toBe('staff_login');
      expect(resolveCanonicalPageRoute('staff/login')).toBe('staff_login');
    });

    it('AppContext maps staff_login to /staff/login', () => {
      expect(appContextSource).toContain("targetPath = '/staff/login';");
    });
  });

  // 5. Client Portal header href
  describe('5. Client Portal Header href Audit', () => {
    it('uses canonical href="/portal" in TopUtilityBar', () => {
      expect(topUtilityBarSource).toMatch(/href="\/portal"/);
      expect(topUtilityBarSource).not.toMatch(/href="#\/client\/login"/);
      expect(topUtilityBarSource).not.toMatch(/href="#\/portal"/);
    });

    it('uses canonical href="/portal" in Navbar desktop actions', () => {
      expect(navbarSource).toMatch(/href="\/portal"/);
      expect(navbarSource).toContain('aria-label="Client Portal"');
    });

    it('uses real anchor tags with role="link" rather than javascript: fake links', () => {
      expect(topUtilityBarSource).toContain('<a\n              href="/portal"');
      expect(topUtilityBarSource).not.toContain('href="javascript:');
      expect(navbarSource).not.toContain('href="javascript:');
    });
  });

  // 6. Staff Portal header href
  describe('6. Staff Portal Header href Audit', () => {
    it('uses canonical href="/staff" in TopUtilityBar', () => {
      expect(topUtilityBarSource).toMatch(/href="\/staff"/);
      expect(topUtilityBarSource).not.toMatch(/href="#\/accountant\/login"/);
      expect(topUtilityBarSource).not.toMatch(/href="#\/staff"/);
    });

    it('uses canonical href="/staff" in Navbar desktop actions', () => {
      expect(navbarSource).toMatch(/href="\/staff"/);
      expect(navbarSource).toContain('aria-label="Staff Portal"');
    });

    it('uses canonical href="/staff" in Navbar mobile drawer', () => {
      expect(navbarSource).toContain('href="/staff"');
      expect(navbarSource).toContain('aria-label="Staff Portal"');
    });
  });

  // 7. Staff Portal click/navigation
  describe('7. Staff Portal Click & Navigation Logic', () => {
    it('TopUtilityBar handleStaffPortalClick calls setCurrentPage("staff")', () => {
      expect(topUtilityBarSource).toContain("setCurrentPage('staff');");
      expect(topUtilityBarSource).toContain("handleStaffPortalClick");
    });

    it('Navbar handleStaffAction calls setCurrentPage("staff")', () => {
      expect(navbarSource).toContain("setCurrentPage('staff');");
      expect(navbarSource).toContain("handleStaffAction");
    });

    it('supports keyboard and modifier key bypass (Cmd/Ctrl click opens in new tab)', () => {
      expect(topUtilityBarSource).toContain('e.metaKey || e.ctrlKey || e.shiftKey || e.altKey');
      expect(navbarSource).toContain('e.metaKey || e.ctrlKey || e.shiftKey || e.altKey');
    });
  });

  // 8. legacy /#/client/login normalization
  describe('8. Legacy /#/client/login Normalization', () => {
    it('normalizes /#/client/login safely to /portal/login', () => {
      const result = normalizeLegacyUrl('#/client/login');
      expect(result).not.toBeNull();
      expect(result?.canonicalPath).toBe('/portal/login');
      expect(result?.page).toBe('client_login');
    });

    it('normalizes full URL https://artaxserv.com/#/client/login', () => {
      const result = normalizeLegacyUrl('https://artaxserv.com/#/client/login');
      expect(result).not.toBeNull();
      expect(result?.canonicalPath).toBe('/portal/login');
      expect(result?.page).toBe('client_login');
    });

    it('normalizes variations like #client/login or #/client-login', () => {
      expect(normalizeLegacyUrl('#client/login')?.canonicalPath).toBe('/portal/login');
      expect(normalizeLegacyUrl('#/client-login')?.canonicalPath).toBe('/portal/login');
    });
  });

  // 9. legacy /#/accountant/login normalization
  describe('9. Legacy /#/accountant/login Normalization', () => {
    it('normalizes /#/accountant/login safely to /staff/login', () => {
      const result = normalizeLegacyUrl('#/accountant/login');
      expect(result).not.toBeNull();
      expect(result?.canonicalPath).toBe('/staff/login');
      expect(result?.page).toBe('staff_login');
    });

    it('normalizes full URL https://artaxserv.com/#/accountant/login', () => {
      const result = normalizeLegacyUrl('https://artaxserv.com/#/accountant/login');
      expect(result).not.toBeNull();
      expect(result?.canonicalPath).toBe('/staff/login');
      expect(result?.page).toBe('staff_login');
    });

    it('normalizes variations like #accountant/login or #/reviewer/login or #/admin/login', () => {
      expect(normalizeLegacyUrl('#accountant/login')?.canonicalPath).toBe('/staff/login');
      expect(normalizeLegacyUrl('#/reviewer/login')?.canonicalPath).toBe('/staff/login');
      expect(normalizeLegacyUrl('#/admin/login')?.canonicalPath).toBe('/staff/login');
    });
  });

  // 10. legacy /#/public-v2/portals normalization
  describe('10. Legacy /#/public-v2/portals Normalization', () => {
    it('normalizes /#/public-v2/portals safely to /portal', () => {
      const result = normalizeLegacyUrl('#/public-v2/portals');
      expect(result).not.toBeNull();
      expect(result?.canonicalPath).toBe('/portal');
      expect(result?.page).toBe('portal');
    });

    it('normalizes legacy pathname /public-v2/portals to /portal', () => {
      const result = normalizeLegacyUrl(null, '/public-v2/portals');
      expect(result).not.toBeNull();
      expect(result?.canonicalPath).toBe('/portal');
      expect(result?.page).toBe('portal');
    });

    it('normalizes legacy #/portals and #/public-v2/portal to /portal', () => {
      expect(normalizeLegacyUrl('#/portals')?.canonicalPath).toBe('/portal');
      expect(normalizeLegacyUrl('#/public-v2/portal')?.canonicalPath).toBe('/portal');
    });
  });

  // 11. direct navigation
  describe('11. Direct Navigation & SPA History Fallback', () => {
    it('server.ts provides SPA wildcard route fallback for direct navigation', () => {
      expect(serverSource).toContain("app.get(");
      expect(serverSource).toContain("'*'");
      expect(serverSource).toContain("index.html");
    });

    it('public/404.html contains SPA history redirection script for static hosting', () => {
      expect(notFoundHtmlSource).toContain('Single Page Apps for GitHub Pages');
      expect(notFoundHtmlSource).toContain('var pathSegmentsToKeep = 0;');
    });

    it('index.html contains SPA path restoration script', () => {
      expect(indexHtmlSource).toContain('Single Page Apps for GitHub Pages - Path Restoration');
      expect(indexHtmlSource).toContain('window.history.replaceState');
    });
  });

  // 12. refresh-safe routing
  describe('12. Refresh-Safe Routing', () => {
    it('resolves canonical pathnames correctly on browser refresh', () => {
      expect(resolveCanonicalPageRoute('/portal')).toBe('portal');
      expect(resolveCanonicalPageRoute('/portal/login')).toBe('client_login');
      expect(resolveCanonicalPageRoute('/staff')).toBe('staff');
      expect(resolveCanonicalPageRoute('/staff/login')).toBe('staff_login');
    });

    it('AppContext getPageFromUrl inspects pathname first and synchronizes on popstate', () => {
      expect(appContextSource).toContain('window.addEventListener(\'popstate\', handleLocationChange);');
      expect(appContextSource).toContain('const pathname = window.location.pathname || \'\';');
    });
  });

  // 13. unauthenticated staff routing
  describe('13. Unauthenticated Staff Routing', () => {
    it('App.tsx route guarding routes unauthenticated staff requests to staff_login', () => {
      expect(appSource).toContain("if (!currentUser) {\n        setCurrentPage('staff_login');");
      expect(appSource).toContain("if (!currentUser) return <StaffLoginPage />;");
    });

    it('StaffLoginPage replaces browser URL with /staff/login', () => {
      const authPagesSource = readSource('src/components/auth/AuthPages.tsx');
      expect(authPagesSource).toContain("window.history.replaceState(null, '', '/staff/login');");
    });
  });

  // 14. client denial from staff workspace
  describe('14. Client Denial from Staff Workspace', () => {
    it('canAccessStaffWorkspace returns false for client and prospective_client', () => {
      expect(canAccessStaffWorkspace('client')).toBe(false);
      expect(canAccessStaffWorkspace('prospective_client')).toBe(false);
      expect(canAccessStaffWorkspace('guest')).toBe(false);
      expect(canAccessStaffWorkspace(null)).toBe(false);
      expect(canAccessStaffWorkspace(undefined)).toBe(false);
    });

    it('App.tsx strictly redirects client role away from staff workspace to /portal', () => {
      expect(appSource).toContain("if (currentUser.role === 'client' || currentUser.role === 'prospective_client') {\n        setCurrentPage('portal');");
    });

    it('renderPage in App.tsx enforces client quarantine from staff components', () => {
      expect(appSource).toContain("// SECURITY: Client is strictly denied from staff workspaces");
      expect(appSource).toContain("if (currentUser.role === 'client' || currentUser.role === 'prospective_client')");
    });
  });

  // 15. authoritative staff role routing
  describe('15. Authoritative Staff Role Routing', () => {
    it('routes accountant and preparer to accountant_workspace', () => {
      expect(resolveAuthoritativeStaffWorkspace('accountant')).toBe('accountant_workspace');
      expect(resolveAuthoritativeStaffWorkspace('preparer')).toBe('accountant_workspace');
    });

    it('routes reviewer and senior_reviewer to reviewer_workspace', () => {
      expect(resolveAuthoritativeStaffWorkspace('reviewer')).toBe('reviewer_workspace');
      expect(resolveAuthoritativeStaffWorkspace('senior_reviewer')).toBe('reviewer_workspace');
    });

    it('routes admin and super_admin to admin_dashboard', () => {
      expect(resolveAuthoritativeStaffWorkspace('admin')).toBe('admin_dashboard');
      expect(resolveAuthoritativeStaffWorkspace('super_admin')).toBe('admin_dashboard');
    });

    it('returns null for unauthorized roles', () => {
      expect(resolveAuthoritativeStaffWorkspace('client')).toBeNull();
      expect(resolveAuthoritativeStaffWorkspace('guest')).toBeNull();
      expect(resolveAuthoritativeStaffWorkspace('')).toBeNull();
      expect(resolveAuthoritativeStaffWorkspace('unknown_role')).toBeNull();
    });

    it('AUTHORIZED_STAFF_ROLES set contains all designated practice staff categories', () => {
      expect(AUTHORIZED_STAFF_ROLES.has('accountant')).toBe(true);
      expect(AUTHORIZED_STAFF_ROLES.has('reviewer')).toBe(true);
      expect(AUTHORIZED_STAFF_ROLES.has('admin')).toBe(true);
      expect(AUTHORIZED_STAFF_ROLES.has('client')).toBe(false);
    });
  });

  // 16. redirect-loop prevention
  describe('16. Redirect-Loop Prevention', () => {
    it('returns null when URL is already canonical, preventing loop cycles', () => {
      expect(normalizeLegacyUrl(null, '/portal')).toBeNull();
      expect(normalizeLegacyUrl(null, '/portal/login')).toBeNull();
      expect(normalizeLegacyUrl(null, '/staff')).toBeNull();
      expect(normalizeLegacyUrl(null, '/staff/login')).toBeNull();
    });

    it('applyCanonicalUrl checks current path and hash before triggering history update', () => {
      const routingSource = readSource('src/config/canonicalRouting.ts');
      expect(routingSource).toContain('if (currentPath !== targetPath || (currentHash && currentHash.length > 0))');
      expect(routingSource).toContain('window.history.replaceState');
    });
  });

  // 17. desktop navigation
  describe('17. Desktop Navigation Audit', () => {
    it('TopUtilityBar renders both Client Portal and Staff Portal links on desktop', () => {
      expect(topUtilityBarSource).toContain('Client Portal');
      expect(topUtilityBarSource).toContain('Staff Portal');
      expect(topUtilityBarSource).toContain('focus-visible:ring-[#C99A3D]');
    });

    it('Navbar desktop utility actions renders both Client Portal and Staff Portal buttons', () => {
      expect(navbarSource).toContain('Client </span>Portal');
      expect(navbarSource).toContain('Staff </span>Portal');
      expect(navbarSource).toContain('Book Consultation');
    });
  });

  // 18. mobile navigation
  describe('18. Mobile Navigation Audit', () => {
    it('Navbar tablet/mobile quick actions renders clickable portal action', () => {
      expect(navbarSource).toContain('TABLET / MOBILE QUICK ACTIONS');
      expect(navbarSource).toContain('aria-label="Client Portal"');
    });

    it('Navbar mobile slide-down drawer includes both Client Portal and Staff Portal actions with >=44px touch target', () => {
      expect(navbarSource).toContain('min-h-[44px]');
      expect(navbarSource).toContain('Staff Practice Portal');
      expect(navbarSource).toContain('<span>Staff Portal</span>');
      expect(navbarSource).toContain('<span>{getPortalButtonLabel()}</span>');
    });
  });
});
