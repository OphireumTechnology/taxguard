import { expect, it } from 'vitest';
import { beginProviderOnlyIdentityFlow, providerOnlyIdentityFlowActive } from '../context/providerOnlyIdentityFlow';
it('keeps overlapping invitation sessions isolated until all flows end', () => {
  expect(providerOnlyIdentityFlowActive()).toBe(false);
  const first=beginProviderOnlyIdentityFlow(), second=beginProviderOnlyIdentityFlow();
  expect(providerOnlyIdentityFlowActive()).toBe(true); first(); first();
  expect(providerOnlyIdentityFlowActive()).toBe(true); second();
  expect(providerOnlyIdentityFlowActive()).toBe(false);
});
