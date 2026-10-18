import { expect, it } from 'vitest';
import { BookToTaxStore } from '../server/taxguard/bookkeeping/bookToTaxStore';

it.each(['55P03', '40001', '40P01'])('reports book-to-tax contention %s without internal details', async code => {
  const store = new BookToTaxStore({ rpc: async () => ({ data: null, error: { code, message: 'private SQL detail' } }) });
  await expect(store.prepareAdjustment('tenant', 'client', 'actor', 'adjustment-key', {
    taxYear: 2025, returnFamily: '1040', categoryCode: 'SYNTHETIC', amount: '-10.01', adjustmentType: 'PERMANENT', description: 'Synthetic adjustment',
  })).rejects.toMatchObject({ code: 'B2T_BUSY', status: 409, message: 'B2T_BUSY' });
});
