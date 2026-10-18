import { expect, it } from 'vitest';
import { BillingStore } from '../server/taxguard/billing/billingStore';

it.each(['55P03', '40001', '40P01'])('reports retryable PostgreSQL contention %s explicitly', async code => {
  const store = new BillingStore({ rpc: async () => ({ data: null, error: { code, message: 'private SQL detail' } }) });
  await expect(store.createInvoice('tenant', 'client', 'actor', 'invoice-key', { dueDate: '2026-11-01' }))
    .rejects.toMatchObject({ code: 'BILLING_BUSY', status: 409, message: 'BILLING_BUSY' });
});

it('does not turn arbitrary database failures into retryable conflicts or leak SQL details', async () => {
  const store = new BillingStore({ rpc: async () => ({ data: null, error: { code: 'XX000', message: 'private SQL detail' } }) });
  await expect(store.createInvoice('tenant', 'client', 'actor', 'invoice-key', { dueDate: '2026-11-01' }))
    .rejects.toMatchObject({ code: 'BILLING_STORE_UNAVAILABLE', status: 503, message: 'BILLING_STORE_UNAVAILABLE' });
});
