/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Staff Practice Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { StaffTechnologyBackground } from '../components/auth/staff-portal/StaffTechnologyBackground';
import { StaffPortalTechnologyHero } from '../components/auth/staff-portal/StaffPortalTechnologyHero';
import { StaffPortalLoginLayout } from '../components/auth/staff-portal/StaffPortalLoginLayout';

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    login: vi.fn(async () => ({ success: false, error: 'Invalid credentials' })),
    setCurrentPage: vi.fn(),
    currentPage: 'staff_login',
    currentRole: 'public',
    currentUser: null
  })
}));

vi.mock('../supabase/config', () => ({
  isSupabaseConfigured: () => true,
  isStaffIdentityDevelopmentConfigured: () => false
}));

import { StaffLoginPage } from '../components/auth/AuthPages';

describe('Staff Practice Portal modernization & auth preservation', () => {
  it('renders the enterprise two-column Staff Practice Portal with required headings, pillars, and controls', () => {
    const html = renderToStaticMarkup(<StaffLoginPage />);

    // Two-column layout wrapper & resilient decorative backdrop (lazy-loaded in browser, fallback in SSR)
    expect(html).toContain('data-testid="staff-portal-login-layout"');
    expect(html).toMatch(/data-testid="staff-technology-background(?:-fallback)?"/);

    // Left column technology presentation copy & minimalist operational pillars
    expect(html).toContain('SECURE INTELLIGENCE.');
    expect(html).toContain('TRANSPARENT OPERATIONS.');
    expect(html).toContain(
      'Access the Destria Tax Services professional workspace through a secure, technology-driven environment designed for accuracy, accountability, and operational excellence.'
    );
    expect(html).toContain('Secure Staff Access');
    expect(html).toContain('Verified Workflows');
    expect(html).toContain('Intelligent Tax Operations');

    // Right column Staff Authentication card controls & preserved labels
    expect(html).toContain('Staff Practice Portal');
    expect(html).toContain('Authorized Personnel Access');
    expect(html).toContain('Staff Sign In');
    expect(html).toContain('Accept Staff Invite');
    expect(html).toContain('Staff Accountant');
    expect(html).toContain('Compliance Admin');
    expect(html).toContain('This choice only changes the button label. Your access is set by your account on the server.');
    expect(html).toContain('Staff Work Email');
    expect(html).toContain('Staff Security Token / Password');
    expect(html).toContain('Show');
    expect(html).toContain('Enter Staff Workspace');
    expect(html).toContain('Authorized practitioners and compliance reviewers only.');
    expect(html).toContain(
      'Lost your security token or password? Contact firm IT or request an administrator invite re-issue.'
    );
  });

  it('pauses decorative motion when animate is false and simplifies SVG on minimal mobile complexity', () => {
    const pausedFull = renderToStaticMarkup(
      <StaffTechnologyBackground animate={false} complexity="full" />
    );
    expect(pausedFull).toContain('data-motion-state="paused"');
    expect(pausedFull).toContain('destria-motion-paused');
    expect(pausedFull).toContain('viewBox="0 0 1440 820"');

    const minimalMobile = renderToStaticMarkup(
      <StaffTechnologyBackground animate={false} complexity="minimal" />
    );
    expect(minimalMobile).toContain('data-motion-complexity="minimal"');
    expect(minimalMobile).toContain('viewBox="0 0 640 480"');
    expect(minimalMobile).not.toContain('staff-pulse-stream-cyan');
  });

  it('renders StaffPortalTechnologyHero without fabricated metrics or unverified certification claims', () => {
    const html = renderToStaticMarkup(
      <StaffPortalTechnologyHero animate={true} complexity="full" />
    );

    expect(html).toContain('role="img"');
    expect(html).not.toMatch(/SOC\s*2\s*Type\s*II|ISO\s*27001|99\.99%|blockchain-powered/i);
  });

  it('keeps StaffPortalLoginLayout strictly presentational and prioritizes login card order on mobile', () => {
    const html = renderToStaticMarkup(
      <StaffPortalLoginLayout>
        <div data-testid="auth-card-slot">Auth Card</div>
      </StaffPortalLoginLayout>
    );

    expect(html).toContain('order-1');
    expect(html).toContain('lg:order-2');
    expect(html).toContain('order-2 lg:order-1');
    expect(html).toContain('data-testid="auth-card-slot"');
  });

  it('preserves real server-side staff authentication contract and never logs credentials in AuthPages.tsx', () => {
    const authPagesSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/auth/AuthPages.tsx'),
      'utf8'
    );
    const staffSection = authPagesSource.slice(authPagesSource.indexOf('export const StaffLoginPage'));

    // Real portal-scoped login call preserved
    expect(staffSection).toContain("login(email, password, mfaStep ? mfaCode : undefined, { portal: 'staff' })");
    // MFA enrollment and MFA challenge flows preserved
    expect(staffSection).toContain('mfaEnrollmentRequired');
    expect(staffSection).toContain('TotpEnrollmentPanel');
    expect(staffSection).toContain('StaffInvitationFlow');
    expect(staffSection).toContain('StaffMfaRecoveryEnrollmentFlow');
    // Canonical /staff/login path normalization preserved
    expect(staffSection).toContain("window.history.replaceState(null, '', '/staff/login')");
    // Never logs passwords or credentials to browser console
    expect(staffSection).not.toMatch(/console\.(log|info|debug|warn|error)\(/);
  });

  it('defines reduced-motion and visibility-paused motion rules in index.css', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toContain('.staff-pulse-stream-cyan');
    expect(css).toContain('.staff-card-border-sheen');
    expect(css).toContain('.destria-motion-paused');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
