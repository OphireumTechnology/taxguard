import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Phase 12B component checks (static rendering; interactive behaviour is covered by
// src/tests-e2e/14-phase12b-frontend.e2e.test.ts on the real server).
vi.mock('../context/AppContext', () => ({ useApp: () => ({ currentUser: { id: 'u1', role: 'admin', status: 'active', tenantId: 't1' }, authLifecycleState: 'AUTHENTICATED', setCurrentPage: () => {} }) }));
vi.mock('../hooks/useAdminProviderReadiness', () => ({ useAdminProviderReadiness: () => ({ allowed: true, status: 'ready', providers: [{ provider: 'AI', status: 'NOT_CONFIGURED', description: 'No model provider is configured.', lastChecked: '2026-10-15T00:00:00Z' }] }) }));

import { ClientDashboardNavigation, CLIENT_NAV_ITEMS } from '../components/portal/dashboard/ClientDashboardNavigation';
import { navFromHash, RESTORABLE_CLIENT_VIEWS } from '../components/portal/AuthenticatedClientDashboard';
import { PlanRequestDialog } from '../components/public/PlanRequestDialog';
import { AiCommissioningView } from '../components/admin/AiCommissioningView';
import { ClientNotificationsPanel } from '../components/portal/dashboard/ClientNotificationsPanel';
import { CLAIM_LIMITS, REPLY_LIMITS } from '../components/collection/DurableClientCollectionWorkspace';

describe('client navigation', () => {
  it('is a labelled landmark of typed buttons with notifications and truthful labels', () => {
    const html = renderToStaticMarkup(<ClientDashboardNavigation active="notifications" collapsed={false} onNavigate={() => {}} onToggle={() => {}} />);
    expect(html).toContain('<nav aria-label="Client portal"');
    expect(html).toMatch(/aria-label="Notifications" aria-current="page"/);
    expect(html).not.toMatch(/<button(?![^>]*type="button")/);
    expect(html).toContain('aria-expanded="true"');
    expect(CLIENT_NAV_ITEMS.map(i => i.label)).not.toContain('Payments');
    expect(html).not.toContain('(2022+)');
  });
  it('every navigation item can be restored after a refresh', () => {
    for (const item of CLIENT_NAV_ITEMS) expect(RESTORABLE_CLIENT_VIEWS.has(item.id), item.id).toBe(true);
  });
});

describe('view restoration from the URL hash', () => {
  it.each([['#nav=notifications', 'notifications'], ['#NAV=Documents', 'documents'], ['#nav=stage_12', 'stage_12'], ['#nav=stage_18', 'stage_18']])('restores %s', (hash, nav) => {
    expect(navFromHash(hash)).toBe(nav);
  });
  it.each(['#nav=admin', '#nav=stage_19', '#nav=stage_00', '#nav=documents&x=1', '#nav=<script>', '#documents', '', '#nav='])('ignores %s', hash => {
    expect(navFromHash(hash)).toBeNull();
  });
});

describe('plan request dialog', () => {
  it('collects nothing and states that no payment is taken', () => {
    const html = renderToStaticMarkup(<PlanRequestDialog plan={{ id: 'p', name: 'Synthetic Plan', price: 100, billingPeriod: 'one_time', features: [] } as any} onClose={() => {}} onRequestConsultation={() => {}} />);
    expect(html).toContain('role="dialog"'); expect(html).toContain('aria-modal="true"'); expect(html).toContain('aria-labelledby="plan-request-title"');
    expect(html).toContain('Online payment is not available');
    expect(html).not.toMatch(/<input|card number|4242|Payment Confirmed/i);
  });
  it('the pricing and contact pages no longer simulate checkout or delivery', () => {
    const pricing = readFileSync('src/components/public/PricingPage.tsx', 'utf8'), contact = readFileSync('src/components/public/ContactPage.tsx', 'utf8');
    for (const s of [pricing, contact]) expect(s).not.toMatch(/setTimeout\(res|Payment Confirmed|Message Transmitted|Michael Perotti|type="file"/);
  });
});

describe('AI commissioning view', () => {
  it('reports nothing operational and keeps AI-16 blocked', () => {
    const html = renderToStaticMarkup(<AiCommissioningView />);
    expect(html).toContain('No agent is operational');
    expect(html).toMatch(/Production commissioned<\/dt><dd[^>]*>0 \/ 61/);
    expect(html).toMatch(/Provider configured<\/dt><dd[^>]*>0 \/ 61/);
    expect(html).toContain('NOT CONFIGURED — No model provider is configured.');
    expect(html).toContain('AI-16 material-action approval');
    // Only controls: a view filter. No start, enable, approve or run control exists.
    expect(html).not.toMatch(/>(Enable|Activate|Approve|Run|Start|Commission)\b/);
  });
});

describe('client notifications and collection forms', () => {
  it('notifications start in a loading state with no fabricated items', () => {
    const html = renderToStaticMarkup(<ClientNotificationsPanel clientId="c1" />);
    expect(html).toContain('Loading notifications');
    expect(html).toContain('E-mail and text delivery are not offered here');
  });
  it('collection forms use the server limits and no native prompts', () => {
    expect(CLAIM_LIMITS).toEqual({ min: 5, max: 500 });
    expect(REPLY_LIMITS).toEqual({ min: 2, max: 4000 });
    const src = readFileSync('src/components/collection/DurableClientCollectionWorkspace.tsx', 'utf8');
    expect(src).not.toMatch(/window\.(prompt|alert|confirm)/);
    expect(src).toContain('if (getStoredToken() !== sessionToken) return;');
    // Both limits match the proposals.
    expect(readFileSync('docs/proposed-migrations/20261015020000_taxguard_collection_questionnaires.sql', 'utf8')).toContain('BETWEEN 5 AND 500');
    expect(readFileSync('docs/proposed-migrations/20261015030000_taxguard_collection_requests.sql', 'utf8')).toContain('BETWEEN 2 AND 4000');
  });
  it('the client workflow router passes server authority through unchanged', () => {
    const src = readFileSync('src/components/workflow/LiveClientWorkflowRouter.tsx', 'utf8');
    expect(src).not.toMatch(/stage2:\s*true/);
    expect(src).not.toMatch(/status: 'IN_PROGRESS'/);
  });
});
