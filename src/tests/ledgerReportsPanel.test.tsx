import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { bookkeepingService } from '../services/bookkeepingService';
import { LedgerReportsPanel, historyLabel } from '../components/workspace/LedgerReportsPanel';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ entries: [], accounts: [], events: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('ledger reports', () => {
  it('passes only populated filters and the client scope, without caching', async () => {
    await bookkeepingService.searchJournal('client-a', 2025, { q: 'accrued', status: '', fromDate: '2025-01-01' });
    const url = new URL(transport.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/bookkeeping/journal-entries');
    expect(Object.fromEntries(url.searchParams)).toEqual({ clientId: 'client-a', taxYear: '2025', q: 'accrued', fromDate: '2025-01-01' });
    expect(transport.mock.calls[0][1].cache).toBe('no-store');
    await bookkeepingService.getGeneralLedger('client-a', 2025, 'acct/1');
    expect(new URL(transport.mock.calls[1][0]).searchParams.get('accountId')).toBe('acct/1');
  });
  it('reports a missing durable store distinctly from an error', async () => {
    transport.mockImplementation(async () => new Response(JSON.stringify({ code: 'LEDGER_HISTORY_REQUIRES_DURABLE_STORE' }), { status: 503 }));
    await expect(bookkeepingService.getLedgerHistory('client-a', 2025)).rejects.toMatchObject({ status: 503, code: 'LEDGER_HISTORY_REQUIRES_DURABLE_STORE' });
  });
  it('labels audit actions readably and renders labelled controls for every account', () => {
    expect(historyLabel('LEDGER_ENTRY_CORRECTION_REQUIRED')).toBe('Entry correction required');
    const html = renderToStaticMarkup(<LedgerReportsPanel clientId="client-a" taxYear={2025} accounts={[{ id: 'a1', accountNumber: '1010', accountName: 'Operating Checking' } as any]} />);
    expect(html).toContain('Search journal'); expect(html).toContain('1010 · Operating Checking'); expect(html).toContain('Show financial audit history');
  });
});
