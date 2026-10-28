import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';

// Client ID counter initialization (proposal 20261018020000) on a real, fully composed PostgreSQL database.
// Before it, a freshly migrated database had no 'primary' counter row and the first self-registered client
// was refused (CLIENT_COUNTER_CORRUPT). Synthetic data only.
const T = 'tenantSeq';
const PROPOSAL = fs.readFileSync('docs/proposed-migrations/20261018020000_taxguard_client_id_sequence_initialize.sql', 'utf8');
let db: TestDatabase;
const provision = (uid: string) => pgRpc(db.pool).rpc('taxguard_provision_client_identity', { p_tenant: T, p_uid: uid, p_email: `${uid}@example.test`, p_name: 'Synthetic Client' });
const counter = async () => (await db.pool.query("SELECT current_sequence::text AS v FROM taxguard_client_id_sequence WHERE id = 'primary'")).rows[0]?.v;

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic sequence practice')`);
});
afterAll(async () => { await db?.stop(); });

describe('client ID counter on a freshly migrated database', () => {
  it('exists after migration, so the first self-registered client is provisioned', async () => {
    expect(await counter()).toBe('0');
    const first = await provision('seq-client-1');
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ clientId: '001', resumed: false });
    expect((await provision('seq-client-1')).data).toMatchObject({ clientId: '001', resumed: true });
    expect((await provision('seq-client-2')).data).toMatchObject({ clientId: '002', resumed: false });
    expect(await counter()).toBe('2');
  });

  it('re-applying only moves the counter forward to the highest issued numeric ID', async () => {
    // A client issued outside this counter (for example restored data) must never be reissued.
    await db.pool.query(`INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '417', 'seq-restored', 'Synthetic Restored Client'),
      ('${T}', 'E2EXYZ1', 'seq-seeded', 'Synthetic non-numeric ID')`);
    await db.pool.query(PROPOSAL);
    expect(await counter()).toBe('417');
    expect((await provision('seq-client-3')).data).toMatchObject({ clientId: '418' });
    await db.pool.query("UPDATE taxguard_client_id_sequence SET current_sequence = 900 WHERE id = 'primary'");
    await db.pool.query(PROPOSAL);
    expect(await counter()).toBe('900');
  });

  it('leaves a corrupt counter corrupt, so provisioning still fails closed', async () => {
    await db.pool.query("UPDATE taxguard_client_id_sequence SET current_sequence = -1 WHERE id = 'primary'");
    await db.pool.query(PROPOSAL);
    expect(await counter()).toBe('-1');
    expect((await provision('seq-client-4')).error).toMatchObject({ code: 'P0001', message: 'CLIENT_COUNTER_CORRUPT' });
    await db.pool.query("DELETE FROM taxguard_client_id_sequence WHERE id = 'primary'");
    expect((await provision('seq-client-5')).error).toMatchObject({ message: 'CLIENT_COUNTER_CORRUPT' });
  });
});
