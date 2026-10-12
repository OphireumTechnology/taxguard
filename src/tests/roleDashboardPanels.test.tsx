import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { practiceService } from '../services/practiceService';
import { DurableMyWorkPanel } from '../components/workspace/DurableMyWorkPanel';
import { PracticeSummaryPanel } from '../components/workspace/PracticeSummaryPanel';
import { ClientStatusSummary } from '../components/portal/ClientStatusSummary';
import { practiceManagerRequestAllowed } from '../server/practiceManagerAccess';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('durable role dashboard panels', () => {
  it('requests the actor\'s work queue and the manager summary without caching', async () => {
    await practiceService.myWork(); await practiceService.summary(2025); await practiceService.summary();
    expect(transport.mock.calls.map(([u, init]) => [new URL(u).pathname + new URL(u).search, init.cache])).toEqual([
      ['/api/practice/my-work', 'no-store'], ['/api/practice/summary?taxYear=2025', 'no-store'], ['/api/practice/summary', 'no-store']]);
  });
  it('render loading states first and never placeholder figures', () => {
    const work = renderToStaticMarkup(<DurableMyWorkPanel />);
    expect(work).toContain('Loading your work queue'); expect(work).not.toMatch(/<strong>\d/);
    const summary = renderToStaticMarkup(<PracticeSummaryPanel taxYear={2025} />);
    expect(summary).toContain('Durable practice summary — 2025'); expect(summary).toContain('Loading recorded practice figures');
    expect(renderToStaticMarkup(<ClientStatusSummary clientId="client-a" />)).toBe(''); // nothing until real figures arrive
  });
  it('opens my-work and summary to managers only with the durable store configured', () => {
    expect(practiceManagerRequestAllowed('practice_manager', 'GET', '/api/practice/summary')).toBe(false);
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable'); vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    expect(practiceManagerRequestAllowed('practice_manager', 'GET', '/api/practice/summary?taxYear=2025')).toBe(true);
    expect(practiceManagerRequestAllowed('practice_manager', 'GET', '/api/practice/my-work')).toBe(true);
    expect(practiceManagerRequestAllowed('practice_manager', 'POST', '/api/practice/summary')).toBe(false);
  });
});
