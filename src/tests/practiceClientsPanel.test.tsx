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
  it('adds tax years and deadlines and resolves deadlines with only the fields the server needs', async () => {
    await practiceService.addTaxYear('client/1', 'eng/1', 2026);
    expect(transport.mock.calls[0][0]).toBe('http://127.0.0.1:3000/api/practice/clients/client%2F1/engagements/eng%2F1/tax-years');
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ taxYear: 2026 });
    await practiceService.addDeadline('client/1', { title: 'Synthetic filing deadline', category: 'filing', dueDate: '2026-04-15T00:00:00.000Z', authorityType: 'STATUTORY',
      sourceCitation: 'Synthetic citation 1', taxYear: 2025 }, 'pm-ddl-1');
    expect(transport.mock.calls[1][0]).toBe('http://127.0.0.1:3000/api/practice/clients/client%2F1/deadlines');
    expect(transport.mock.calls[1][1].headers['Idempotency-Key']).toBe('pm-ddl-1');
    await practiceService.resolveDeadline('client/1', 'ddl/1', 'MET');
    expect(transport.mock.calls[2][0]).toBe('http://127.0.0.1:3000/api/practice/clients/client%2F1/deadlines/ddl%2F1/resolve');
    expect(JSON.parse(transport.mock.calls[2][1].body)).toEqual({ status: 'MET' });
    await practiceService.resolveDeadline('client/1', 'ddl/1', 'WAIVED', 'Synthetic waiver reason');
    expect(JSON.parse(transport.mock.calls[3][1].body)).toEqual({ status: 'WAIVED', reason: 'Synthetic waiver reason' });
  });
  it('explains tax-year and deadline refusals', () => {
    expect(practiceMessage(new PracticeRequestError(409, 'TAX_YEAR_EXISTS'))).toMatch(/already part of the engagement/);
    expect(practiceMessage(new PracticeRequestError(403, 'DEADLINE_WAIVER_NOT_AUTHORIZED'))).toMatch(/statutory deadlines cannot be waived/);
    expect(practiceMessage(new PracticeRequestError(409, 'DEADLINE_ALREADY_RESOLVED'))).toMatch(/already met or waived/);
    expect(practiceMessage(new PracticeRequestError(400, 'PRACTICE_INPUT_INVALID'))).toMatch(/source citation/);
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
