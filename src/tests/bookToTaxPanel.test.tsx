import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { BookToTaxRequestError, bookToTaxApi, bookToTaxMessage, centsText } from '../services/bookToTaxService';
import { BookToTaxPanel } from '../components/workspace/BookToTaxPanel';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('book-to-tax browser client', () => {
  it('sends adjustments with an idempotency key and signed amounts as entered', async () => {
    await bookToTaxApi.prepareAdjustment('c/1', { taxYear: 2025, returnFamily: '1040', categoryCode: 'MEALS', amount: '-200.00', adjustmentType: 'PERMANENT', description: 'Firm review' }, 'b2t-key-1');
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/book-to-tax/clients/c%2F1/adjustments');
    expect(JSON.parse(options.body)).toMatchObject({ amount: '-200.00', categoryCode: 'MEALS' });
    expect(options.headers['Idempotency-Key']).toBe('b2t-key-1');
  });
  it('formats cents exactly and explains refusals', () => {
    expect(centsText(-20000)).toBe('-$200.00'); expect(centsText(25055)).toBe('$250.55');
    expect(bookToTaxMessage(new BookToTaxRequestError(409, 'WORKPAPER_NOT_RECONCILED'))).toMatch(/Map every account/);
  });
  it('states that no tax is computed', () => {
    const html = renderToStaticMarkup(<BookToTaxPanel clientId="c1" taxYear={2025} accounts={[]} />);
    expect(html).toContain('TaxGuard computes no tax'); expect(html).toContain('Loading workpapers');
  });
});
