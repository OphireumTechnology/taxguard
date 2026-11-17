import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => ({ user: {} as any, auth: 'AUTHENTICATED' }));
vi.mock('../context/AppContext', () => ({ useApp: () => ({ currentUser: session.user, authLifecycleState: session.auth }) }));
import { DashboardApplicationShell } from '../components/layout/DashboardApplicationShell';
const render = (workspace: any = 'accountant') => DashboardApplicationShell({ workspace, navigation: <button>Scoped navigation</button>, children: <p>Scoped content</p> });
beforeEach(() => { session.auth = 'AUTHENTICATED'; session.user = { id: 'synthetic-a', tenantId: 'tenant-a', clientId: 'client-a', role: 'accountant', status: 'active', authorizedClientIds: ['client-a'] }; });
it.each([{ id: 'other' }, { tenantId: 'other' }, { clientId: 'other' }, { role: 'reviewer' }, { status: 'suspended' }, { lastLoginAt: 'new-session' }, { updatedAt: 'changed' }, { authorizedClientIds: ['other'] }])('remounts dialog/navigation state on authority change %j', patch => {
  const before = render().key; Object.assign(session.user, patch); expect(render().key).not.toBe(before);
});
it('remounts immediately on session expiry and recovery even for the same user', () => {
  const authenticated = render().key; session.auth = 'EXPIRED'; const expired = render().key;
  expect(expired).not.toBe(authenticated); session.auth = 'AUTHENTICATED'; expect(render().key).not.toBe(expired);
});
it('remounts when the requested role workspace changes', () => expect(render('reviewer').key).not.toBe(render().key));
it('preserves state across harmless authorized-client ordering changes', () => {
  session.user.authorizedClientIds = ['a', 'b']; const before = render().key;
  session.user.authorizedClientIds = ['b', 'a']; expect(render().key).toBe(before);
});
