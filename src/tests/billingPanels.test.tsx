import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { setStoredToken, clearStoredToken } from '../services/api';
import { BillingRequestError, billingApi, billingMessage } from '../services/billingApiService';
import { BillingWorkspacePanel } from '../components/billing/BillingWorkspacePanel';
import { ClientInvoicesPanel } from '../components/billing/ClientInvoicesPanel';
import { MANAGER_MODULES } from '../components/workspace/practiceManagerModel';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('billing browser client', () => {
  it('walks bounded invoice pages without silently truncating balances',async()=>{
    transport.mockResolvedValueOnce(new Response(JSON.stringify({items:[{invoiceId:'one'}],nextCursor:'cursor-one'}))).mockResolvedValueOnce(new Response(JSON.stringify({items:[{invoiceId:'two'}],nextCursor:null})));
    expect((await billingApi.invoices('client')).items.map(i=>i.invoiceId)).toEqual(['one','two']);
    expect(transport.mock.calls[1][0]).toContain('cursor=cursor-one');
  });
  it('refuses duplicate pages and session replacement during a paginated read',async()=>{
    transport.mockResolvedValueOnce(new Response(JSON.stringify({items:[{invoiceId:'one'}],nextCursor:'again'}))).mockResolvedValueOnce(new Response(JSON.stringify({items:[{invoiceId:'one'}],nextCursor:null})));
    await expect(billingApi.invoices('client')).rejects.toThrow('BILLING_RESPONSE_INVALID');
    transport.mockImplementationOnce(async()=>{setStoredToken('replacement');return new Response(JSON.stringify({items:[],nextCursor:null}));});
    await expect(billingApi.invoices('client')).rejects.toThrow('SESSION_CHANGED');
  });
  it('sends money as entered text, encodes paths and attaches idempotency keys to payments', async () => {
    await billingApi.recordPayment('client/1', 'inv_1', '24.90', 'CHECK', 'bill-key-1');
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/billing/clients/client%2F1/invoices/inv_1/payments');
    expect(JSON.parse(options.body)).toEqual({ amount: '24.90', method: 'CHECK' });
    expect(options.headers['Idempotency-Key']).toBe('bill-key-1'); expect(options.cache).toBe('no-store');
  });
  it('explains refusals', () => {
    expect(billingMessage(new BillingRequestError(403, 'MAKER_CHECKER_VIOLATION'))).toMatch(/different manager/);
    expect(billingMessage(new BillingRequestError(400, 'SANDBOX_TEST_CARD_REQUIRED'))).toMatch(/No real card is ever charged/);
  });
  it('renders staff and client panels and exposes Billing to practice managers', () => {
    expect(renderToStaticMarkup(<BillingWorkspacePanel />)).toContain('Loading receivables');
    expect(renderToStaticMarkup(<ClientInvoicesPanel clientId="c1" />)).toContain('Loading invoices');
    expect(MANAGER_MODULES).toContain('Billing');
  });
});
