import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { schemaFingerprint } from '../../scripts/staging/schema-fingerprint';
import { schemaFingerprintScenarios, setupFingerprintFixture } from './helpers/schemaFingerprintScenarios';

let db: PGlite;
beforeAll(async () => { db = new PGlite(); await setupFingerprintFixture(db); });
afterAll(async () => { await db?.close(); });
it.each(Object.entries(schemaFingerprintScenarios))('%s', async (_name, scenario) => {
  const before = await schemaFingerprint(db);
  await db.exec('BEGIN');
  try { await scenario(db); } finally { await db.exec('ROLLBACK'); }
  expect((await schemaFingerprint(db)).sha256).toBe(before.sha256);
});
