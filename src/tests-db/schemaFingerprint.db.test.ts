import { afterAll, beforeAll, expect, it } from 'vitest';
import { schemaFingerprint } from '../../scripts/staging/schema-fingerprint';
import { startDatabase, type TestDatabase } from './harness';
import { schemaFingerprintScenarios, setupFingerprintFixture } from '../tests/helpers/schemaFingerprintScenarios';

let db: TestDatabase;
beforeAll(async () => {
  db = await startDatabase();
  await setupFingerprintFixture({ query: sql => db.pool.query(sql), exec: sql => db.pool.query(sql) });
});
afterAll(async () => { await db?.stop(); });
it.each(Object.entries(schemaFingerprintScenarios))('%s on disposable PostgreSQL', async (_name, scenario) => {
  const session = await db.connect();
  try {
    const before = await schemaFingerprint(session);
    await session.query('BEGIN');
    try { await scenario({ query: sql => session.query(sql), exec: sql => session.query(sql) }); }
    finally { await session.query('ROLLBACK'); }
    expect((await schemaFingerprint(session)).sha256).toBe(before.sha256);
  } finally { await session.end(); }
});
