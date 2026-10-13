import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { bookkeepingService } from '../services/bookkeepingService';
import { BookkeeperLedgerWorkspace } from '../components/workspace/BookkeeperLedgerWorkspace';
import { BOOKKEEPER_MODULES } from '../components/workspace/bookkeeperDashboardModel';
import { bookkeeperRequestAllowed } from '../server/bookkeeperAccess';
import { setLedgerStoreForTesting } from '../server/taxguard/bookkeeping/ledgerBackend';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); setLedgerStoreForTesting(null); });

describe('bookkeeper ledger workspace', () => {
  it('requests the work queue for the selected client and year without caching', async () => {
    await bookkeepingService.getWorkQueue('client-a', 2025);
    const u = new URL(transport.mock.calls[0][0]);
    expect(u.pathname).toBe('/api/bookkeeping/work-queue'); expect(Object.fromEntries(u.searchParams)).toEqual({ clientId: 'client-a', taxYear: '2025' });
    expect(transport.mock.calls[0][1].cache).toBe('no-store');
  });
  it('is a Bookkeeper module and explains that postings are reviewed', () => {
    expect(BOOKKEEPER_MODULES).toContain('Ledger Workspace');
    const html = renderToStaticMarkup(<BookkeeperLedgerWorkspace clientId="client-a" taxYear={2025} />);
    expect(html).toContain('held for independent review'); expect(html).toContain('Loading work queue');
  });
  it('allows ledger work only on the durable store and never approvals, closes or sync', () => {
    expect(bookkeeperRequestAllowed('bookkeeper', 'GET', '/api/bookkeeping/work-queue?clientId=x')).toBe(false);
    setLedgerStoreForTesting({} as any);
    expect(bookkeeperRequestAllowed('bookkeeper', 'GET', '/api/bookkeeping/work-queue?clientId=x')).toBe(true);
    expect(bookkeeperRequestAllowed('bookkeeper', 'POST', '/api/bookkeeping/journal-entries')).toBe(true);
    expect(bookkeeperRequestAllowed('bookkeeper', 'POST', '/api/bookkeeping/transactions/t1/categorize')).toBe(true);
    for (const path of ['/api/bookkeeping/journal-entries/e1/approve', '/api/bookkeeping/journal-entries/e1/reject', '/api/bookkeeping/journal-entries/e1/request-correction',
      '/api/bookkeeping/periods/p1/close', '/api/bookkeeping/periods/p1/reopen', '/api/bookkeeping/chart-of-accounts/a1/status', '/api/bookkeeping/sync/write-commit',
      '/api/bookkeeping/book-to-tax', '/api/documents', '/api/accountant/dashboard']) expect(bookkeeperRequestAllowed('bookkeeper', 'POST', path), path).toBe(false);
    expect(bookkeeperRequestAllowed('accountant', 'POST', '/api/bookkeeping/journal-entries/e1/approve')).toBe(true);
  });
});
