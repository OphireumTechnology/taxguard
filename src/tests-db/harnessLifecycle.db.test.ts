import { afterAll, beforeAll, expect, it } from 'vitest';
import { startDatabase, type TestDatabase } from './harness';

let owner: TestDatabase;
let independent: TestDatabase;
beforeAll(async () => {
  [owner, independent] = await Promise.all([startDatabase(), startDatabase()]);
}, 240000);
afterAll(async () => {
  await Promise.all([owner?.stop(), independent?.stop()]);
});

it('closes only the database owned by its handle and waits for checked-out clients', async () => {
  const ownerClient = await owner.connect();
  const independentClient = await independent.connect();
  await ownerClient.query('SELECT 1');
  await independentClient.query('SELECT 1');
  const ownerClosed = new Promise<void>(resolve => ownerClient.once('end', resolve));

  // The harness closes forgotten dedicated clients as part of the owning DB shutdown.
  await Promise.all([owner.stop(), owner.stop()]);
  await ownerClosed;
  expect((await independentClient.query<{ value: number }>('SELECT 17 AS value')).rows[0].value).toBe(17);
  await independentClient.end();
});
