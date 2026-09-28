import { expect, it } from 'vitest';
import { bootstrapFirstAdmin } from '../../functions/src/roles';
it.each([
  {},
  { auth: { uid: 'first-user', token: {} }, data: {} },
  { auth: { uid: 'caller', token: { role: 'administrator' } }, data: { bootstrapKey: 'supplied-key' } },
])('never grants administrator access through public bootstrap', async request => {
  await expect(bootstrapFirstAdmin.run(request as any)).rejects.toMatchObject({ code: 'failed-precondition' });
});
