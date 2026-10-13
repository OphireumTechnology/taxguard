import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { ENGAGEMENT_TRANSITIONS, PracticeRequestError, practiceMessage, practiceService } from '../services/practiceService';
import { PracticeClientsPanel } from '../components/workspace/PracticeClientsPanel';
import { MANAGER_MODULES } from '../components/workspace/practiceManagerModel';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('practice service client', () => {
  it('encodes client paths, sends idempotency keys for created records and never caches', async () => {
    transport.mockImplementation(async () => new Response(JSON.stringify({ engagementId: 'eng_1' }), { status: 201 }));
    await practiceService.createEngagement('client/1', { title: 'Synthetic', type: 'tax_preparation', taxYears: [2025] }, 'pm-key-1');
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/practice/clients/client%2F1/engagements');
    expect(options.headers['Idempotency-Key']).toBe('pm-key-1'); expect(options.cache).toBe('no-store'); expect(options.credentials).toBe('omit');
    expect(options.headers.Authorization).toBe('Bearer synthetic-session');
  });
  it('refuses without a session and discards responses from a changed session', async () => {
    clearStoredToken();
    await expect(practiceService.listClients()).rejects.toMatchObject({ status: 401 });
    setStoredToken('a');
    transport.mockImplementation(async () => { setStoredToken('b'); return new Response('{"items":[]}', { status: 200 }); });
    await expect(practiceService.listClients()).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  });
  it('maps refusal codes to guidance and keeps unknown failures generic', () => {
    expect(practiceMessage(new PracticeRequestError(409, 'ASSIGNMENT_SEGREGATION_OF_DUTIES'))).toMatch(/preparer and reviewer/);
    expect(practiceMessage(new PracticeRequestError(500, 'SOMETHING_INTERNAL'))).toBe('The practice service did not confirm this action. Refresh and try again.');
    expect(ENGAGEMENT_TRANSITIONS.completed).toBeUndefined();
  });
});

describe('practice manager navigation and panel', () => {
  it('adds the module and renders the directory search with labelled controls', () => {
    expect(MANAGER_MODULES).toContain('Clients & Engagements');
    const html = renderToStaticMarkup(<PracticeClientsPanel />);
    expect(html).toContain('Clients &amp; Engagements'); expect(html).toContain('Search clients'); expect(html).toContain('Loading clients');
  });
});
