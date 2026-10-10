import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  user: { id: 'user-a', clientId: 'client-a', tenantId: 'tenant-a', name: 'AUTHORIZED-CLIENT-NAME', role: 'client', status: 'active', createdAt: '2021-01-01', email: 'authorized@example.test' },
  state: 'AUTHENTICATED',
}));
vi.mock('../context/AppContext', () => ({ useApp: () => ({ currentUser: session.user, authLifecycleState: session.state, notifications: [], logout: vi.fn() }) }));
vi.mock('../hooks/useLiveWorkflowAuthority', () => ({ useLiveWorkflowAuthority: () => ({ status: 'idle', workflow: null }) }));
import { AuthenticatedClientDashboard } from '../components/portal/AuthenticatedClientDashboard';

describe('authenticated client dashboard actual render boundary', () => {
  beforeEach(() => { session.user.role = 'client'; session.user.status = 'active'; session.state = 'AUTHENTICATED'; });
  const render = (clientId = 'client-a') => renderToStaticMarkup(<AuthenticatedClientDashboard clientId={clientId} selectedTaxYear={2024} />);
  it('renders the shared shell for the authorized client with controlled loading states', () => {
    const html = render(); expect(html).toContain('TAXGUARD'); expect(html).toContain('AUTHORIZED-CLIENT-NAME'); expect(html).toContain('Loading');
  });
  it('rejects a different client identity without rendering identity, shell or workspace contents', () => {
    const html = render('client-b'); expect(html).toContain('matching tax-year context'); expect(html).not.toContain('AUTHORIZED-CLIENT-NAME'); expect(html).not.toContain('TAXGUARD');
  });
  it('rejects staff roles and inactive/uninitialized sessions', () => {
    for (const role of ['accountant', 'reviewer', 'admin']) { session.user.role = role; expect(render()).not.toContain('AUTHORIZED-CLIENT-NAME'); }
    session.user.role = 'client'; session.user.status = 'suspended'; expect(render()).not.toContain('AUTHORIZED-CLIENT-NAME');
    session.user.status = 'active'; session.state = 'INITIALIZING'; expect(render()).not.toContain('AUTHORIZED-CLIENT-NAME');
  });
});
