import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
vi.mock('../context/AppContext', () => ({ useApp: () => ({ currentUser: { id: 'client-user', clientId: 'client-a', tenantId: 'tenant-a', role: 'client', status: 'active' }, authLifecycleState: 'AUTHENTICATED' }) }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { documentRequestService, requestMessage, requestStatusText } from '../services/documentRequestService';
import { VaultRequestError } from '../services/vaultService';
import { ClientDocumentRequestsPanel } from '../components/documents/ClientDocumentRequestsPanel';
import { StaffDocumentRequestsPanel } from '../components/documents/StaffDocumentRequestsPanel';
import { MANAGER_MODULES } from '../components/workspace/practiceManagerModel';
import { practiceManagerRequestAllowed } from '../server/practiceManagerAccess';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('document request clients and panels', () => {
  it('addresses the vault request routes without caching and sends an idempotency key on create', async () => {
    await documentRequestService.list('client-a', 2025);
    await documentRequestService.create('client-a', { engagementId: 'e1', taxYear: 2025, title: 'Wage statements', category: 'income', required: true }, 'synthetic-key-123');
    await documentRequestService.missing(2025, true);
    await documentRequestService.markRead('client-a', '00000000-0000-4000-8000-000000000001');
    const calls = transport.mock.calls.map(([url, init]) => [new URL(url).pathname + new URL(url).search, init.method, init.cache, init.headers['Idempotency-Key']]);
    expect(calls).toEqual([['/api/vault/clients/client-a/requests?taxYear=2025', 'GET', 'no-store', undefined], ['/api/vault/clients/client-a/requests', 'POST', 'no-store', 'synthetic-key-123'],
      ['/api/vault/requests/missing?taxYear=2025&overdueOnly=true', 'GET', 'no-store', undefined],
      ['/api/vault/clients/client-a/notifications/00000000-0000-4000-8000-000000000001/read', 'POST', 'no-store', undefined]]);
  });
  it('explains statuses and refusals without leaking internals', () => {
    expect(requestStatusText('SUBMITTED')).toBe('Received — awaiting review');
    expect(requestMessage(new VaultRequestError(403, 'DOC_REQUEST_WAIVER_REQUIRES_REVIEWER'))).toMatch(/reviewer or a manager/);
    expect(requestMessage(new VaultRequestError(404, 'SOMETHING_ELSE'))).toBe('You are not authorized for this request.');
  });
  it('renders the client and staff panels, and Document Requests is a Practice Manager module', () => {
    const client = renderToStaticMarkup(<ClientDocumentRequestsPanel clientId="client-a" />);
    expect(client).toContain('Requested documents'); expect(client).toContain('e-mail and text delivery are not enabled');
    const staff = renderToStaticMarkup(<StaffDocumentRequestsPanel />);
    for (const t of ['Document Requests', 'Missing documents', 'Client requests', 'Firm checklists', 'contain no tax rules']) expect(staff).toContain(t);
    expect(MANAGER_MODULES).toContain('Document Requests');
  });
  it('opens the request endpoints to managers only with the durable store, never the client-only read receipt', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable'); vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    for (const [m, p] of [['GET', '/api/vault/requests/missing'], ['GET', '/api/vault/clients/c1/requests'], ['POST', '/api/vault/clients/c1/requests'], ['POST', '/api/vault/request-templates'],
      ['POST', '/api/vault/clients/c1/requests/apply-template'], ['POST', '/api/vault/clients/c1/requests/r1/waive'], ['POST', '/api/vault/clients/c1/requests/r1/remind']])
      expect(practiceManagerRequestAllowed('practice_manager', m, p), `${m} ${p}`).toBe(true);
    expect(practiceManagerRequestAllowed('practice_manager', 'POST', '/api/vault/clients/c1/notifications/n1/read')).toBe(false);
    vi.stubEnv('TAXGUARD_PRACTICE_STORE', '');
    expect(practiceManagerRequestAllowed('practice_manager', 'GET', '/api/vault/requests/missing')).toBe(false);
  });
});
