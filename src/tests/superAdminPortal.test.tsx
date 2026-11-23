/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Secure Super Administrator Portal Tests
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_ROUTES,
  normalizeLegacyUrl,
  resolveCanonicalPageRoute,
  isProtectedAdminPageRoute,
  isSuperAdministratorRole
} from '../config/canonicalRouting';
import { sanitizeAndValidateRecoveryUrl } from '../config/authRecoveryPolicy';
import { restoredSessionPortal } from '../context/AppContext';
import type { User } from '../types';

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockSetCurrentPage = vi.fn();
let mockAppState: {
  currentUser: User | null;
  currentRole: string;
  currentPage: string;
  authLifecycleState: string;
};

vi.mock('../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({
      currentUser: mockAppState.currentUser,
      currentRole: mockAppState.currentRole,
      currentPage: mockAppState.currentPage,
      authLifecycleState: mockAppState.authLifecycleState,
      login: mockLogin,
      logout: mockLogout,
      setCurrentPage: mockSetCurrentPage
    })
  };
});

vi.mock('../supabase/config', () => ({
  isSupabaseConfigured: () => true,
  isStaffIdentityDevelopmentConfigured: () => false,
  supabase: null
}));

vi.mock('../context/localServerLogin', () => ({
  isLocalServerLoginBuild: () => false
}));

vi.mock('../hooks/useAdminProviderReadiness', () => ({
  useAdminProviderReadiness: () => ({
    allowed: true,
    status: 'ready',
    providers: [
      {
        provider: 'supabase_auth',
        status: 'configured',
        description: 'Identity provider configured',
        lastChecked: '2026-11-22T00:15:00.000Z'
      }
    ]
  })
}));

vi.mock('../components/admin/StaffAccessManagementPanel', () => ({
  StaffAccessManagementPanel: () => (
    <div data-testid="mock-staff-access-panel">Authoritative Staff Access Panel</div>
  )
}));

vi.mock('../components/admin/StaffSessionsPanel', () => ({
  StaffSessionsPanel: () => (
    <div data-testid="mock-staff-sessions-panel">Durable Staff Sessions Panel</div>
  )
}));

vi.mock('../components/admin/AuditCenterPanel', () => ({
  AuditCenterPanel: ({ securityOnly }: { securityOnly?: boolean }) => (
    <div data-testid={securityOnly ? 'mock-security-audit-panel' : 'mock-full-audit-panel'}>
      {securityOnly ? 'Read-Only Security Audit Panel' : 'Read-Only Immutable Audit Center'}
    </div>
  )
}));

vi.mock('../components/admin/AiControlCenterPanel', () => ({
  AiControlCenterPanel: () => (
    <div data-testid="mock-ai-control-panel">AI Control Center &amp; 61-Agent Matrix</div>
  )
}));

vi.mock('../components/admin/AiEmergencyStopPanel', () => ({
  AiEmergencyStopPanel: () => (
    <div data-testid="mock-ai-emergency-stop-panel">AI Emergency Stop Panel</div>
  )
}));

vi.mock('../components/admin/AdminJobQueuePanel', () => ({
  AdminJobQueuePanel: () => <div data-testid="mock-job-queue-panel">Durable Job Queue Panel</div>
}));

vi.mock('../components/admin/AdminWorkloadPanel', () => ({
  AdminWorkloadPanel: () => <div data-testid="mock-workload-panel">Admin Workload Panel</div>
}));

import { AdminLoginPage } from '../components/auth/admin-portal/AdminLoginPage';
import {
  SuperAdminCommandCenter,
  ADMIN_COMMAND_MODULES,
  moduleForAdminPage
} from '../components/admin/SuperAdminCommandCenter';
import { AdminAccessDeniedView } from '../components/admin/AdminAccessDeniedView';

const ACTIVE_SUPER_ADMIN: User = {
  id: 'sa-1',
  name: 'Executive Administrator',
  email: 'exec@destriataxservices.com',
  role: 'super_admin',
  status: 'active',
  tenantId: 'tenant-destria',
  isVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z'
};

describe('Super Administrator Portal — Routing, Security Policy, RBAC & UI Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState = {
      currentUser: null,
      currentRole: 'guest',
      currentPage: 'admin_login',
      authLifecycleState: 'UNAUTHENTICATED'
    };
  });

  it('resolves all /admin/* canonical routes while preserving existing staff, client, and master AI routes', () => {
    expect(CANONICAL_ROUTES.ADMIN_LOGIN).toBe('/admin/login');
    expect(CANONICAL_ROUTES.ADMIN_DASHBOARD).toBe('/admin/dashboard');
    expect(CANONICAL_ROUTES.ADMIN_USERS).toBe('/admin/users');
    expect(CANONICAL_ROUTES.ADMIN_SECURITY).toBe('/admin/security');
    expect(CANONICAL_ROUTES.ADMIN_AUDIT).toBe('/admin/audit');
    expect(CANONICAL_ROUTES.ADMIN_AI_CONTROL).toBe('/admin/ai-control');
    expect(CANONICAL_ROUTES.ADMIN_SETTINGS).toBe('/admin/settings');

    expect(resolveCanonicalPageRoute('/admin/login')).toBe('admin_login');
    expect(resolveCanonicalPageRoute('/admin/dashboard')).toBe('admin_command_center');
    expect(resolveCanonicalPageRoute('/admin/users')).toBe('admin_users');
    expect(resolveCanonicalPageRoute('/admin/security')).toBe('admin_security');
    expect(resolveCanonicalPageRoute('/admin/audit')).toBe('admin_audit');
    expect(resolveCanonicalPageRoute('/admin/ai-control')).toBe('admin_ai_control');
    expect(resolveCanonicalPageRoute('/admin/settings')).toBe('admin_settings');

    // Existing routes must remain fully preserved
    expect(resolveCanonicalPageRoute('/staff/login')).toBe('staff_login');
    expect(resolveCanonicalPageRoute('/staff/super-admin')).toBe('super_admin_console');
    expect(resolveCanonicalPageRoute('/admin/master/ai')).toBe('ai_command_center');
    expect(resolveCanonicalPageRoute('/portal/login')).toBe('client_login');

    // Legacy hash routes normalize cleanly
    expect(normalizeLegacyUrl('#/admin/login')).toEqual({
      canonicalPath: '/admin/login',
      page: 'admin_login'
    });
    expect(normalizeLegacyUrl('#/admin/dashboard')).toEqual({
      canonicalPath: '/admin/dashboard',
      page: 'admin_command_center'
    });
    expect(normalizeLegacyUrl('#/admin/audit')).toEqual({
      canonicalPath: '/admin/audit',
      page: 'admin_audit'
    });
  });

  it('enforces protected admin route checks, strict super-admin RBAC, and safe session restoration', () => {
    expect(isProtectedAdminPageRoute('admin_command_center')).toBe(true);
    expect(isProtectedAdminPageRoute('admin_users')).toBe(true);
    expect(isProtectedAdminPageRoute('admin_security')).toBe(true);
    expect(isProtectedAdminPageRoute('admin_audit')).toBe(true);
    expect(isProtectedAdminPageRoute('admin_ai_control')).toBe(true);
    expect(isProtectedAdminPageRoute('admin_settings')).toBe(true);
    expect(isProtectedAdminPageRoute('admin_login')).toBe(false);
    expect(isProtectedAdminPageRoute('home')).toBe(false);

    expect(isSuperAdministratorRole('super_admin')).toBe(true);
    expect(isSuperAdministratorRole('super_administrator')).toBe(true);
    expect(isSuperAdministratorRole('admin')).toBe(false);
    expect(isSuperAdministratorRole('accountant')).toBe(false);
    expect(isSuperAdministratorRole('reviewer')).toBe(false);
    expect(isSuperAdministratorRole('client')).toBe(false);

    expect(moduleForAdminPage('admin_command_center')).toBe('overview');
    expect(moduleForAdminPage('admin_users')).toBe('users');
    expect(moduleForAdminPage('admin_security')).toBe('security');
    expect(moduleForAdminPage('admin_audit')).toBe('audit');
    expect(moduleForAdminPage('admin_ai_control')).toBe('ai_control');
    expect(moduleForAdminPage('admin_settings')).toBe('settings');

    // Session restoration on /admin/* uses staff intent (never auto-provisions a client)
    expect(restoredSessionPortal('/admin/login')).toBe('staff');
    expect(restoredSessionPortal('/admin/dashboard')).toBe('staff');
    expect(restoredSessionPortal('/admin/audit')).toBe('staff');
    expect(restoredSessionPortal('/staff/login')).toBe('staff');
    expect(restoredSessionPortal('/portal')).toBeUndefined();

    // Recovery URL policy permits /admin/login on official host and blocks untrusted hosts
    expect(sanitizeAndValidateRecoveryUrl('https://destriataxservices.com/admin/login')).toBe(
      'https://destriataxservices.com/admin/login'
    );
    expect(() => sanitizeAndValidateRecoveryUrl('https://evil.example.com/admin/login')).toThrow();
  });

  it('renders /admin/login with official branding, required headings/fields, zero self-registration, and MFA notice', () => {
    const html = renderToStaticMarkup(<AdminLoginPage />);

    expect(html).toContain('data-testid="admin-portal-login-layout"');
    expect(html).toContain('data-testid="admin-login-card"');
    expect(html).toContain('DESTRIA SECURE ADMINISTRATION');
    expect(html).toContain('Intelligent Governance.');
    expect(html).toContain('Verified Access.');
    expect(html).toContain('Transparent Operations.');
    expect(html).toContain('Destria Super Administrator');
    expect(html).toContain('Authorized Executive &amp; System Administration Access');
    expect(html).toContain('Administrator work email');
    expect(html).toContain('Password');
    expect(html).toContain('Continue securely');
    expect(html).toContain('Return to Staff Portal');
    expect(html).toContain('Account Recovery');
    expect(html).toContain('Public administrator registration is disabled');

    // No public registration or client-controlled role elevation UI
    expect(html).not.toMatch(/Register New Admin|Create Administrator Account|Sign Up/i);
    expect(html).not.toContain('demo_session');
  });

  it('blocks non-super-administrator roles inside SuperAdminCommandCenter with explicit 403 Access Denied and zero data leakage', () => {
    const deniedRoles: Array<User['role']> = ['client', 'accountant', 'reviewer', 'admin'];

    for (const role of deniedRoles) {
      mockAppState = {
        currentUser: {
          id: `u-${role}`,
          name: `${role} user`,
          email: `${role}@destriataxservices.com`,
          role,
          status: 'active',
          tenantId: 'tenant-destria',
          isVerified: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          ...(role === 'client' ? { clientId: 'cli-1' } : {})
        },
        currentRole: role,
        currentPage: 'admin_command_center',
        authLifecycleState: 'AUTHENTICATED'
      };

      const html = renderToStaticMarkup(<SuperAdminCommandCenter />);
      expect(html).toContain('data-testid="admin-access-denied"');
      expect(html).toContain('403 · Access Denied');
      expect(html).toContain('Super Administrator Authorization Required');
      expect(html).not.toContain('data-testid="super-admin-command-center"');
      expect(html).not.toContain('data-testid="admin-module-overview"');
    }
  });

  it('renders all 8 governance modules and route-specific panels for an active Super Administrator with immutable audit posture', () => {
    mockAppState = {
      currentUser: ACTIVE_SUPER_ADMIN,
      currentRole: 'super_admin',
      currentPage: 'admin_command_center',
      authLifecycleState: 'AUTHENTICATED'
    };

    expect(ADMIN_COMMAND_MODULES).toHaveLength(8);
    const overviewHtml = renderToStaticMarkup(<SuperAdminCommandCenter initialModule="overview" />);
    expect(overviewHtml).toContain('data-testid="super-admin-command-center"');
    expect(overviewHtml).toContain('data-testid="admin-module-overview"');
    for (const mod of ADMIN_COMMAND_MODULES) {
      expect(overviewHtml).toContain(`data-testid="admin-nav-${mod.id}"`);
    }
    expect(overviewHtml).toContain('Taxpayer Data Isolation');
    expect(overviewHtml).toContain('Immutable Audit Trails');

    // Module 02 — Staff & Access Management (/admin/users)
    mockAppState.currentPage = 'admin_users';
    const usersHtml = renderToStaticMarkup(<SuperAdminCommandCenter initialModule="users" />);
    expect(usersHtml).toContain('data-testid="admin-module-users"');
    expect(usersHtml).toContain('data-testid="mock-staff-access-panel"');

    // Module 03 — Security Command Center (/admin/security)
    mockAppState.currentPage = 'admin_security';
    const securityHtml = renderToStaticMarkup(<SuperAdminCommandCenter initialModule="security" />);
    expect(securityHtml).toContain('data-testid="admin-module-security"');
    expect(securityHtml).toContain('data-testid="mock-staff-sessions-panel"');
    expect(securityHtml).toContain('data-testid="mock-security-audit-panel"');

    // Module 04 — Compliance Administration
    const complianceHtml = renderToStaticMarkup(<SuperAdminCommandCenter initialModule="compliance" />);
    expect(complianceHtml).toContain('data-testid="admin-module-compliance"');
    expect(complianceHtml).toContain('IRC §7216');

    // Module 06 — System Configuration (/admin/settings)
    mockAppState.currentPage = 'admin_settings';
    const settingsHtml = renderToStaticMarkup(<SuperAdminCommandCenter initialModule="settings" />);
    expect(settingsHtml).toContain('data-testid="admin-module-settings"');
    expect(settingsHtml).toContain('High-Risk Configuration Governance Gate');

    // Module 07 — Audit & Accountability (/admin/audit) — strictly immutable, no delete/purge controls
    mockAppState.currentPage = 'admin_audit';
    const auditHtml = renderToStaticMarkup(<SuperAdminCommandCenter initialModule="audit" />);
    expect(auditHtml).toContain('data-testid="admin-module-audit"');
    expect(auditHtml).toContain('data-testid="mock-full-audit-panel"');
    expect(auditHtml).not.toMatch(/Delete Audit|Purge Audit|Clear Audit Log/i);

    // Module 08 — Deployment & Integration Readiness
    const readinessHtml = renderToStaticMarkup(<SuperAdminCommandCenter initialModule="readiness" />);
    expect(readinessHtml).toContain('data-testid="admin-module-readiness"');
    expect(readinessHtml).toContain('data-testid="mock-job-queue-panel"');
  });

  it('AdminAccessDeniedView renders role-appropriate return guidance without exposing admin controls', () => {
    mockAppState = {
      currentUser: {
        id: 'u-client',
        name: 'Client User',
        email: 'client@example.com',
        role: 'client',
        status: 'active',
        clientId: 'cli-1',
        isVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      currentRole: 'client',
      currentPage: 'admin_command_center',
      authLifecycleState: 'AUTHENTICATED'
    };
    const clientHtml = renderToStaticMarkup(<AdminAccessDeniedView />);
    expect(clientHtml).toContain('Return to Client Portal');

    mockAppState.currentUser = {
      id: 'u-acct',
      name: 'Accountant',
      email: 'acct@destriataxservices.com',
      role: 'accountant',
      status: 'active',
      isVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    mockAppState.currentRole = 'accountant';
    const staffHtml = renderToStaticMarkup(<AdminAccessDeniedView />);
    expect(staffHtml).toContain('Return to Staff Workspace');
  });

  it('static security contract: AdminLoginPage and SuperAdminCommandCenter contain no credential logging, raw HTML injection, or hardcoded secrets', () => {
    const filesToAudit = [
      'src/components/auth/admin-portal/AdminLoginPage.tsx',
      'src/components/auth/admin-portal/AdminPortalLoginLayout.tsx',
      'src/components/auth/admin-portal/AdminPortalTechnologyHero.tsx',
      'src/components/admin/SuperAdminCommandCenter.tsx',
      'src/components/admin/AdminAccessDeniedView.tsx'
    ];

    for (const rel of filesToAudit) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      expect(content).not.toContain('dangerouslySetInnerHTML');
      expect(content).not.toMatch(/console\.(log|info|debug)\s*\(/);
      expect(content).not.toMatch(/eval\s*\(|new Function\s*\(/);
      expect(content).toContain('OPHIREUM-IP');
    }
  });
});
