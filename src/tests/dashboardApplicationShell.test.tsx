import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  user: { id: 'staff-a', name: 'Test Staff', email: 'staff@example.test', role: 'accountant', status: 'active', clientId: 'client-a' },
  authState: 'AUTHENTICATED',
}));

vi.mock('../context/AppContext', () => ({ useApp: () => ({
  currentUser: session.user, authLifecycleState: session.authState, logout: vi.fn(),
  notifications: [], markNotificationRead: vi.fn(), clearAllNotifications: vi.fn(), setCurrentPage: vi.fn(),
}) }));

import { DashboardApplicationShell } from '../components/layout/DashboardApplicationShell';

describe('shared live application chrome', () => {
  beforeEach(() => { session.user.role = 'accountant'; session.user.status = 'active'; session.authState = 'AUTHENTICATED'; });

  it('renders one shared header and preserves module and toolbar slots', () => {
    const html = renderToStaticMarkup(<DashboardApplicationShell workspace="accountant"
      navigation={<button>Assigned Cases</button>} headerTools={<span>TY 2025</span>}>
      <main>Authorized case workspace</main>
    </DashboardApplicationShell>);
    expect(html.match(/<header\b/g)).toHaveLength(1);
    expect(html).toContain('TAXGUARD');
    expect(html).toContain('Assigned Cases');
    expect(html).toContain('TY 2025');
    expect(html).toContain('Authorized case workspace');
    expect(html).toContain('Skip to workspace');
    expect(html).toContain('Search authorized workspace navigation');
    expect(html).toContain('Help and support');
    expect(html).toContain('Sign Out');
    expect(html).toContain('--dashboard-workspace:#F0F5FA');
  });

  it('makes background controls inert only while mobile navigation is open', () => {
    const renderShell = (mobileOpen: boolean) => renderToStaticMarkup(
      <DashboardApplicationShell workspace="accountant" mobileOpen={mobileOpen}
        navigation={<button>Assigned Cases</button>}>
        <main><button>Open case</button></main>
      </DashboardApplicationShell>,
    );
    const open = renderShell(true);
    expect(open).toMatch(/<a[^>]*inert=""[^>]*class="tg-skip-link"/);
    expect(open).toContain('<header inert="" class="tg-shell-header">');
    expect(open).toContain('<div inert="" class="tg-shell-body">');
    expect(open).toContain('role="dialog" aria-modal="true"');
    // The drawer itself must remain operable, outside the inert background.
    expect(open).not.toMatch(/<div[^>]*inert[^>]*class="tg-shell-drawer"/);
    expect(open).toContain('aria-label="Close navigation"');
    const closed = renderShell(false);
    expect(closed).not.toContain('inert=');
    expect(closed).not.toContain('role="dialog"');
    expect(closed).toContain('Open case');
  });

  it('denies content and navigation to a client requesting staff chrome', () => {
    session.user.role = 'client';
    const html = renderToStaticMarkup(<DashboardApplicationShell workspace="accountant" navigation={<button>Staff-only module</button>}>
      <main>Restricted taxpayer record</main>
    </DashboardApplicationShell>);
    expect(html).toContain('authorized active session');
    expect(html).not.toContain('Staff-only module');
    expect(html).not.toContain('Restricted taxpayer record');
    expect(html).not.toContain('staff@example.test');
  });

  it('retains client-specific search and notification integration without staff search', () => {
    session.user.role = 'client';
    const html = renderToStaticMarkup(<DashboardApplicationShell workspace="client" navigation={<button>My Documents</button>}
      onSearch={() => {}} notifications={<button>Client notifications</button>}>
      <main>Client workspace</main>
    </DashboardApplicationShell>);
    expect(html).toContain('Search documents, messages, tax years');
    expect(html).toContain('Client notifications');
    expect(html).not.toContain('Search authorized workspace navigation');
    expect(html).not.toContain('Switch role');
  });

  it('fails closed when a staff session is suspended or initializing', () => {
    session.user.status = 'suspended';
    expect(renderToStaticMarkup(<DashboardApplicationShell workspace="accountant" navigation={null}>Sensitive data</DashboardApplicationShell>)).not.toContain('Sensitive data');
    session.user.status = 'active'; session.authState = 'INITIALIZING';
    expect(renderToStaticMarkup(<DashboardApplicationShell workspace="accountant" navigation={null}>Sensitive data</DashboardApplicationShell>)).not.toContain('Sensitive data');
  });
});
