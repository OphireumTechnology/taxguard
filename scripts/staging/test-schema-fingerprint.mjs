// In-process SQL regression runner: no child processes, sockets or hosted database targets.
// node --experimental-strip-types scripts/staging/test-schema-fingerprint.mjs
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { schemaFingerprint } from './schema-fingerprint.ts';
import { schemaFingerprintScenarios, setupFingerprintFixture } from '../../src/tests/helpers/schemaFingerprintScenarios.ts';

test('schema recovery fingerprint (in-process PGlite; not standalone PostgreSQL acceptance)', async t => {
  const db = new PGlite();
  try {
    await setupFingerprintFixture(db);
    for (const [name, scenario] of Object.entries(schemaFingerprintScenarios)) {
      await t.test(name, async () => {
        const before = await schemaFingerprint(db);
        await db.exec('BEGIN');
        try { await scenario(db); } finally { await db.exec('ROLLBACK'); }
        assert.equal((await schemaFingerprint(db)).sha256, before.sha256, 'rollback must restore the exact fingerprint');
      });
    }
  } finally { await db.close(); }
});
