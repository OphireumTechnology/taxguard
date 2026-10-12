import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { bookkeepingService, BookkeepingRequestError, type JournalEntryItem } from '../services/bookkeepingService';
import { LedgerControlsPanel, ledgerActions, ledgerMessage } from '../components/workspace/LedgerControlsPanel';

const transport = vi.fn();
const entry = (over: Partial<JournalEntryItem> = {}): JournalEntryItem => ({ id: 'je-1', entryNumber: 'JE-000001', postingDate: '2025-02-10', transactionDate: '2025-02-10',
  description: 'Synthetic entry', source: 'MANUAL', isAdjusting: false, totalDebit: 125.5, totalCredit: 125.5, status: 'POSTED', creatorUid: 'maker', lines: [], ...over });
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ entry: entry() }), { status: 201 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('bookkeeping service ledger methods', () => {
  it('sends the shared session token, the client scope and encoded IDs to the configured API host', async () => {
    await bookkeepingService.reverseJournalEntry('client-a', 2025, 'je/1', '2025-03-01', 'Synthetic correction');
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/bookkeeping/journal-entries/je%2F1/reverse');
    expect(options.headers.Authorization).toBe('Bearer synthetic-session');
    expect(JSON.parse(options.body)).toEqual({ clientId: 'client-a', taxYear: 2025, postingDate: '2025-03-01', reason: 'Synthetic correction' });
    await bookkeepingService.categorizeTransaction('client-a', 2025, 'txn-1', 'acct-1', 'note');
    expect(JSON.parse(transport.mock.calls[1][1].body)).toMatchObject({ clientId: 'client-a', taxYear: 2025, assignedAccountId: 'acct-1' });
  });
  it('surfaces the server refusal code', async () => {
    transport.mockImplementation(async () => new Response(JSON.stringify({ error: 'PERIOD_HAS_UNAPPROVED_ENTRIES: 1 prepared entry', code: 'PERIOD_HAS_UNAPPROVED_ENTRIES' }), { status: 400 }));
    await expect(bookkeepingService.closePeriod('client-a', 2025, 'p1', 'HARD_CLOSED')).rejects.toMatchObject({ status: 400, code: 'PERIOD_HAS_UNAPPROVED_ENTRIES' });
  });
});

describe('ledger controls model', () => {
  it('offers approval only for prepared entries and reversal only for unreversed posted originals', () => {
    expect(ledgerActions(entry({ status: 'PREPARED' }))).toEqual({ approve: true, reverse: false });
    expect(ledgerActions(entry())).toEqual({ approve: false, reverse: true });
    expect(ledgerActions(entry({ reversedByEntryId: 'je-2' })).reverse).toBe(false);
    expect(ledgerActions(entry({ reversalOfEntryId: 'je-0' })).reverse).toBe(false);
  });
  it('maps refusals to specific guidance without echoing server detail', () => {
    expect(ledgerMessage(new BookkeepingRequestError('x', 403, 'MAKER_CHECKER_VIOLATION'))).toMatch(/independent reviewer/);
    expect(ledgerMessage(new BookkeepingRequestError('x', 403))).toMatch(/not authorized/);
    expect(ledgerMessage(new BookkeepingRequestError('x', 404, 'ENTRY_NOT_FOUND'))).toMatch(/not found/);
    expect(ledgerMessage(new BookkeepingRequestError('internal detail', 400, 'UNKNOWN_CODE'))).not.toContain('internal detail');
  });
  it('renders review and correction lists from the entries supplied', () => {
    const html = renderToStaticMarkup(<LedgerControlsPanel clientId="client-a" taxYear={2025} onChanged={() => {}}
      entries={[entry({ id: 'p', entryNumber: 'JE-PREP', status: 'PREPARED' }), entry({ id: 'q', entryNumber: 'JE-POST' }), entry({ id: 'r', entryNumber: 'JE-DONE', reversedByEntryId: 'x' })]} />);
    expect(html).toContain('Awaiting independent review (1)');
    expect(html).toContain('Approve JE-PREP');
    expect(html).toContain('<option value="q">');
    expect(html).not.toContain('<option value="r">');
    expect(html).toContain('Loading periods');
  });
});
