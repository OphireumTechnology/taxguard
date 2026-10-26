import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { ReviewerLedgerReviewPanel, parseLedgerScope } from '../components/workspace/ReviewerLedgerReviewPanel';

describe('reviewer ledger review panel', () => {
  it('accepts only a well-formed client identifier and a tax year from 2022', () => {
    expect(parseLedgerScope(' client-1 ', '2025')).toEqual({ clientId: 'client-1', taxYear: 2025 });
    for (const [c, y] of [['', '2025'], ['client 1', '2025'], ['client-1', '2021'], ['client-1', '20x5'], ['client-1', ''], ['a'.repeat(129), '2025']])
      expect(parseLedgerScope(c, y), `${c}/${y}`).toBeNull();
  });
  it('asks for a client and year before loading anything, and states the maker-checker rule', () => {
    const html = renderToStaticMarkup(<ReviewerLedgerReviewPanel />);
    expect(html).toContain('Ledger review');
    expect(html).toContain('You cannot approve your own work.');
    expect(html).toContain('Client identifier');
    expect(html).toContain('Ledger tax year');
    expect(html).not.toContain('Loading the ledger');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Open ledger<\/button>/);
  });
});
