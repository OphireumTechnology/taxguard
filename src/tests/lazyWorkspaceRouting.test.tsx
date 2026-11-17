import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  context: {} as any,
  loaded: [] as string[],
}));
vi.mock('../context/AppContext', () => ({ AppProvider: ({ children }: any) => children, useApp: () => state.context }));
vi.mock('../components/layout/PublicLayout', () => ({ PublicLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('../components/layout/PortalLayout', () => ({ PortalLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('../components/auth/AuthPages', () => ({ ClientLoginPage: () => <div>synthetic-client-login</div>, ClientRegisterPage: () => <div>synthetic-register</div>, StaffLoginPage: () => <div>synthetic-staff-login</div> }));
vi.mock('../components/public/HomePage', () => ({ HomePage: () => <div>synthetic-public-home</div> }));
vi.mock('../components/calendar/LiveCalendarModule', () => ({ LiveCalendarModule: () => <div>synthetic-calendar</div> }));
vi.mock('../components/common/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: any) => children }));
vi.mock('../components/common/PageLoadingFallback', () => ({ PageLoadingFallback: () => <p role="status">Loading workspace</p> }));
vi.mock('../components/workspace/AccountantWorkspace', () => { state.loaded.push('accountant'); return { AccountantWorkspace: () => <div>synthetic-accountant-workspace</div> }; });
vi.mock('../components/workspace/ReviewerWorkspace', () => { state.loaded.push('reviewer'); return { ReviewerWorkspace: () => <div>synthetic-reviewer-workspace</div> }; });
vi.mock('../components/workspace/BookkeeperDashboard', () => { state.loaded.push('bookkeeper'); return { BookkeeperDashboard: () => <div>synthetic-bookkeeper-workspace</div> }; });
vi.mock('../components/workspace/PracticeManagerDashboard', () => { state.loaded.push('manager'); return { PracticeManagerDashboard: () => <div>synthetic-manager-workspace</div> }; });
vi.mock('../components/workspace/ClientServiceDashboard', () => { state.loaded.push('operations'); return { ClientServiceDashboard: () => <div>synthetic-operations-workspace</div> }; });
vi.mock('../components/admin/PracticeAdminWorkspace', () => { state.loaded.push('admin'); return { PracticeAdminWorkspace: () => <div>synthetic-admin-workspace</div> }; });
vi.mock('../components/workflow/LiveClientWorkflowRouter', () => { state.loaded.push('client'); return { LiveClientWorkflowRouter: ({ clientId }: any) => <div>synthetic-client-workspace:{clientId}</div> }; });
vi.mock('../public-v2/PublicV2Router', () => { state.loaded.push('public-v2'); return { PublicV2Router: () => <div>synthetic-public-v2</div> }; });
import App from '../App';

async function render() {
  return new Promise<string>((resolve, reject) => {
    const output = new PassThrough(); let html = '';
    output.on('data', chunk => { html += chunk.toString(); }); output.on('end', () => resolve(html)); output.on('error', reject);
    const stream = renderToPipeableStream(<App />, { onAllReady: () => stream.pipe(output), onError: reject });
  });
}
beforeEach(() => {
  state.context = { currentPage: 'staff', currentUser: null, authLifecycleState: 'UNAUTHENTICATED', isInitialized: true,
    isSyncingWithBackend: false, isLoadingData: false, setCurrentPage: vi.fn(), provisionedOnboarding: null };
  vi.stubGlobal('window', { location: { hash: '', pathname: '/staff' } });
});
afterEach(() => vi.unstubAllGlobals());
it('does not request any privileged lazy workspace for an unauthenticated staff URL', async () => {
  expect(await render()).toContain('synthetic-staff-login'); expect(state.loaded).toEqual([]);
});
it('keeps initializing sessions behind their loading state', async () => {
  state.context.authLifecycleState = 'INITIALIZING';
  expect(await render()).toContain('auth-initializing-screen'); expect(state.loaded).toEqual([]);
});
it.each([
  ['accountant', 'accountant'], ['reviewer', 'reviewer'], ['senior_reviewer', 'reviewer'], ['bookkeeper', 'bookkeeper'],
  ['practice_manager', 'manager'], ['operations', 'operations'], ['admin', 'admin'],
])('resolves %s authority before rendering only its %s workspace', async (role, expected) => {
  state.context.currentUser = { id: 'synthetic_staff', role, status: 'active', tenantId: 'synthetic_tenant' };
  state.context.authLifecycleState = 'AUTHENTICATED';
  const html = await render(); expect(html).toContain(`synthetic-${expected}-workspace`);
  for (const other of ['accountant', 'reviewer', 'bookkeeper', 'manager', 'operations', 'admin', 'client'].filter(value => value !== expected)) expect(html).not.toContain(`synthetic-${other}-workspace`);
});
it('routes a client opening a staff URL to its own scoped client workspace', async () => {
  state.context.currentUser = { id: 'synthetic_client_user', role: 'client', clientId: 'synthetic_client', status: 'active' };
  state.context.authLifecycleState = 'AUTHENTICATED';
  const html = (await render()).replace(/<!--.*?-->/g, ''); expect(html).toContain('synthetic-client-workspace:synthetic_client'); expect(html).not.toContain('synthetic-accountant-workspace');
});
it('does not render a client workspace without its permanent client identity', async () => {
  state.context.currentUser = { id: 'synthetic_client_user', role: 'client', status: 'active' }; state.context.authLifecycleState = 'AUTHENTICATED';
  expect(await render()).toContain('synthetic-client-login');
});
it('supports the independently suspended public-v2 route', async () => {
  vi.stubGlobal('window', { location: { hash: '', pathname: '/public-v2' } }); expect(await render()).toContain('synthetic-public-v2');
});
it.each(['UNAUTHENTICATED', 'EXPIRED', 'INVALID'])('does not render staff authority from a retained user during %s lifecycle', async lifecycle => {
  state.context.currentUser = { id: 'synthetic_staff', role: 'accountant', status: 'active' }; state.context.authLifecycleState = lifecycle;
  expect(await render()).toContain('synthetic-staff-login');
});
it.each(['suspended', 'pending', undefined])('does not render inactive or unrecorded staff status %s', async status => {
  state.context.currentUser = { id: 'synthetic_staff', role: 'accountant', status }; state.context.authLifecycleState = 'AUTHENTICATED';
  expect(await render()).toContain('synthetic-staff-login');
});
it('does not default an unknown authenticated role to the accountant workspace', async () => {
  state.context.currentUser = { id: 'synthetic_staff', role: 'unknown', status: 'active' }; state.context.authLifecycleState = 'AUTHENTICATED';
  expect(await render()).toContain('synthetic-staff-login');
});
