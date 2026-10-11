import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AccountantCase, DASHBOARD_KPIS, daysUntil, kpiValue, sortCases, stageCounts, upcomingDeadlines,
} from '../components/workspace/accountantDashboardModel';
import { ACCOUNTANT_NAV_SECTIONS, AccountantNavigation } from '../components/workspace/AccountantNavigation';

/** Accountant dashboard redesign: honest metrics, sorting, deadlines, sidebar and inspection rendering. Synthetic data. */
const session = vi.hoisted(() => ({ user: { id: 'staff', role: 'accountant', status: 'active', tenantId: 'tenant-a', name: 'Synthetic Preparer' } as any, auth: 'AUTHENTICATED' }));
vi.mock('../context/AppContext', () => ({ useApp: () => ({ currentUser: session.user, authLifecycleState: session.auth, logout: vi.fn(), notifications: [] }) }));
import { AccountantDashboard } from '../components/workspace/AccountantDashboard';
import { DashboardInspectionProvider } from '../components/layout/dashboardInspection';

const base: AccountantCase = { id: 'c', tenantId: 't', clientId: 'cl', authorityClientId: 'a', engagementId: 'e', taxYear: 2025, clientName: 'Synthetic', status: 'in_preparation', priority: 'medium', serviceTitle: 'x', documents: [] };
const row = (over: Partial<AccountantCase>): AccountantCase => ({ ...base, ...over });
const TODAY = '2026-10-12';
afterEach(() => { session.user = { ...session.user, role: 'accountant' }; });

describe('KPI values never present unavailable data as zero', () => {
  it('lists exactly the requested cards', () => {
    expect(DASHBOARD_KPIS.map(k => k.label)).toEqual(['Assigned Cases', 'Due Today', 'Overdue', 'Waiting on Client', 'Ready for Review', 'Client Approval', 'Ready to File']);
  });
  it.each(['inspection', 'error'] as const)('%s state: every card is unavailable', state => {
    for (const k of DASHBOARD_KPIS) expect(kpiValue(k.label, [row({})], TODAY, state).state).toBe('unavailable');
  });
  it('loading state is reported as loading, not zero', () => {
    expect(kpiValue('Assigned Cases', [], TODAY, 'loading')).toEqual({ state: 'loading' });
  });
  it('Ready to File is unavailable (no verified filing-readiness record)', () => {
    expect(kpiValue('Ready to File', [row({})], TODAY, 'ready')).toMatchObject({ state: 'unavailable' });
  });
  it('Client Approval is unavailable while any case lacks a verified stage, and counted when all are verified', () => {
    expect(kpiValue('Client Approval', [row({ activeStage: 10 }), row({ id: 'd' })], TODAY, 'ready')).toMatchObject({ state: 'unavailable' });
    expect(kpiValue('Client Approval', [row({ activeStage: 10 }), row({ id: 'd', activeStage: 3 })], TODAY, 'ready')).toEqual({ state: 'value', count: 1 });
  });
  it('due-date metrics are unavailable when the durable store does not record due dates', () => {
    const rows = [row({ id: '1', dueDate: TODAY })];
    expect(kpiValue('Due Today', rows, TODAY, 'ready', ['dueDate', 'priority'])).toMatchObject({ state: 'unavailable', reason: 'Due dates are not recorded in the case store' });
    expect(kpiValue('Overdue', rows, TODAY, 'ready', ['dueDate'])).toMatchObject({ state: 'unavailable' });
    expect(kpiValue('Assigned Cases', rows, TODAY, 'ready', ['dueDate'])).toEqual({ state: 'value', count: 1 });
  });
  it('real zero is a value, distinct from unavailable', () => {
    expect(kpiValue('Overdue', [row({ dueDate: '2026-12-01' })], TODAY, 'ready')).toEqual({ state: 'value', count: 0 });
    expect(kpiValue('Assigned Cases', [], TODAY, 'ready')).toEqual({ state: 'value', count: 0 });
  });
  it('counts from recorded fields only', () => {
    const rows = [row({ id: '1', dueDate: TODAY }), row({ id: '2', dueDate: '2026-10-01' }), row({ id: '3', dueDate: '2026-10-01', status: 'filed' }), row({ id: '4', status: 'awaiting_client' }), row({ id: '5', status: 'review_needed' })];
    expect(kpiValue('Due Today', rows, TODAY, 'ready')).toEqual({ state: 'value', count: 1 });
    expect(kpiValue('Overdue', rows, TODAY, 'ready')).toEqual({ state: 'value', count: 1 });
    expect(kpiValue('Waiting on Client', rows, TODAY, 'ready')).toEqual({ state: 'value', count: 1 });
    expect(kpiValue('Ready for Review', rows, TODAY, 'ready')).toEqual({ state: 'value', count: 1 });
  });
});

describe('pipeline, sorting and deadlines', () => {
  it('counts only verified authoritative stages and reports the rest separately', () => {
    const { counts, unverified } = stageCounts([row({ activeStage: 1 }), row({ activeStage: 18 }), row({ activeStage: 0 }), row({}), row({ activeStage: 19 })]);
    expect(counts).toHaveLength(18);
    expect(counts[0]).toBe(1); expect(counts[17]).toBe(1);
    expect(unverified).toBe(3);
  });
  it('sorts by priority and due date with missing values last in both directions', () => {
    const rows = [row({ id: 'a', priority: 'low', dueDate: '2026-11-01' }), row({ id: 'b', priority: 'urgent' }), row({ id: 'c', priority: '' as any, dueDate: '2026-10-20' }), row({ id: 'd', priority: 'high', dueDate: '2026-10-15' })];
    expect(sortCases(rows, 'priority', 'asc').map(r => r.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(sortCases(rows, 'dueDate', 'asc').map(r => r.id)).toEqual(['d', 'c', 'a', 'b']);
    expect(sortCases(rows, 'dueDate', 'desc').map(r => r.id)).toEqual(['a', 'c', 'd', 'b']);
  });
  it('upcoming deadlines are recorded, open and soonest first', () => {
    const rows = [row({ id: 'late', dueDate: '2026-10-01' }), row({ id: 'later', dueDate: '2026-10-20' }), row({ id: 'soon', dueDate: TODAY }), row({ id: 'closed', dueDate: '2026-10-13', status: 'filed' })];
    expect(upcomingDeadlines(rows, TODAY).map(r => r.id)).toEqual(['soon', 'later']);
    expect(daysUntil('2026-10-20', TODAY)).toBe(8);
  });
});

describe('sidebar', () => {
  const render = (iconOnly: boolean, expanded: Record<string, boolean> = {}) => renderToStaticMarkup(
    <AccountantNavigation idPrefix="t" iconOnly={iconOnly} expanded={expanded} activeLabel="Overdue" onToggleSection={() => {}} onSelect={() => {}} />);
  it('has independently expandable My Work, Clients, Tax Workflow, Tools and Reports sections', () => {
    expect(ACCOUNTANT_NAV_SECTIONS.map(s => s.label)).toEqual(['My Work', 'Clients', 'Tax Workflow', 'Tools', 'Reports']);
    const html = render(false, { tools: false });
    expect((html.match(/aria-expanded="true"/g) || []).length).toBe(4);
    expect(html).toContain('aria-controls="t-nav-tools"');
    expect(html).toMatch(/<ul id="t-nav-tools" hidden=""/);
  });
  it('icon-only mode gives every control an accessible name and tooltip', () => {
    const html = render(true);
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(m => m[0]);
    expect(buttons.length).toBe(1 + ACCOUNTANT_NAV_SECTIONS.reduce((n, s) => n + s.items.length, 0));
    for (const b of buttons) { expect(b).toMatch(/aria-label="[^"]+"/); expect(b).toMatch(/data-tooltip="[^"]+"/); }
  });
  it('marks the current view and explains disabled tools', () => {
    const html = render(false);
    expect(html).toMatch(/aria-current="page"[^>]*>.*?Overdue/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Not available yet: requires a verified integration"/);
  });
});

const metricsHtml = (html: string) => {
  // KPI cards and pipeline only (the workflow journey legitimately shows step numbers 1-9).
  const start = html.indexOf('aria-label="Key metrics"');
  const end = html.indexOf('My Work Queue');
  expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
};
describe('dashboard rendering', () => {
  it('a real accountant sees the work queue and a loading state, with no fabricated counts', () => {
    const html = renderToStaticMarkup(<AccountantDashboard />);
    expect(html).toContain('My Work Queue');
    expect(html).toContain('Loading authorized cases');
    expect(html).toContain('Upcoming Deadlines');
    expect(html).toContain('Quick Actions');
    expect(metricsHtml(html)).not.toMatch(/<strong>\d+<\/strong>/);
    expect(metricsHtml(html)).toContain('<strong>—</strong>');
  });
  it('super administrator inspection shows the layout with unavailable figures, not zeros', () => {
    session.user = { ...session.user, role: 'super_admin' };
    const html = renderToStaticMarkup(<DashboardInspectionProvider dashboard="accountant"><AccountantDashboard /></DashboardInspectionProvider>);
    expect(html).toContain('Inspection mode');
    expect(html).toContain('Inspection mode: no case data loaded');
    expect(metricsHtml(html)).not.toMatch(/<strong>\d+<\/strong>/);
    expect(metricsHtml(html)).toContain('<strong>—</strong>');
    expect(html).not.toContain('Loading authorized cases');
    expect(html).not.toContain('role="alert"');
  });
});
