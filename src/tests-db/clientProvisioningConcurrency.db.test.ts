import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';

// Client self-provisioning races and counter initialization on a database that already issued client IDs
// (proposal 20261018020000 with 20261012060000), on a real PostgreSQL server with independent connections.
// Synthetic data only.
const A = 'tenantRaceA', B = 'tenantRaceB';
const PROPOSAL = fs.readFileSync('docs/proposed-migrations/20261018020000_taxguard_client_id_sequence_initialize.sql', 'utf8');
let db: TestDatabase;
const provision = (tenant: string, uid: string) =>
  pgRpc(db.pool).rpc('taxguard_provision_client_identity', { p_tenant: tenant, p_uid: uid, p_email: `${uid}@example.test`, p_name: 'Synthetic Client' });
const counter = async () => (await db.pool.query("SELECT current_sequence::text AS v FROM taxguard_client_id_sequence WHERE id = 'primary'")).rows[0]?.v;
const rowsFor = async (uid: string) => (await db.pool.query(
  `SELECT (SELECT count(*) FROM taxguard_identities WHERE uid = $1)::int AS identities, (SELECT count(*) FROM taxguard_members WHERE uid = $1)::int AS members,
          (SELECT count(*) FROM taxguard_clients WHERE owner_uid = $1)::int AS clients`, [uid])).rows[0];

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${A}', 'Synthetic race practice A'), ('${B}', 'Synthetic race practice B')`);
});
afterAll(async () => { await db?.stop(); });

describe('concurrent first-time provisioning', () => {
  it('simultaneous first sign-ins of one identity create exactly one client; replay returns it; no other tenant sees it', async () => {
    const attempts = await Promise.all(Array.from({ length: 8 }, () => provision(A, 'race-same')));
    for (const r of attempts) expect(r.error).toBeNull();
    expect(new Set(attempts.map(r => r.data.clientId)).size).toBe(1);
    expect(attempts.filter(r => r.data.resumed === false)).toHaveLength(1);
    const clientId = attempts[0].data.clientId;
    expect(await rowsFor('race-same')).toEqual({ identities: 1, members: 1, clients: 1 });
    expect((await provision(A, 'race-same')).data).toMatchObject({ clientId, resumed: true });
    // The same identity cannot be provisioned in another tenant, even concurrently with its own replay.
    const [other, replay] = await Promise.all([provision(B, 'race-same'), provision(A, 'race-same')]);
    expect(other.error).toMatchObject({ message: 'CLIENT_IDENTITY_CONFLICT' });
    expect(replay.data).toMatchObject({ clientId, resumed: true });
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_clients WHERE tenant_id = '${B}'`)).rows[0].n).toBe(0);
  });

  it('simultaneous registrations of different people, with the proposal replayed mid-flight, never share an ID', async () => {
    const jobs: Array<Promise<any>> = [];
    for (let i = 0; i < 24; i++) {
      jobs.push(provision(i % 2 ? A : B, `race-${i}`));
      if (i % 6 === 0) jobs.push(db.pool.query(PROPOSAL).then(() => null));
    }
    const results = (await Promise.all(jobs)).filter(Boolean);
    for (const r of results) expect(r.error).toBeNull();
    const ids = results.map(r => r.data.clientId);
    expect(new Set(ids).size).toBe(24);
    const issued = (await db.pool.query("SELECT client_id FROM taxguard_clients WHERE client_id ~ '^[0-9]+$'")).rows.map(r => r.client_id);
    expect(new Set(issued).size).toBe(issued.length);
    expect(Number(await counter())).toBe(Math.max(...issued.map(Number)));
  });
});

describe('initialization on a database that already issued client IDs', () => {
  it('with the counter row absent, it resumes after the highest issued ID, keeps existing clients and replays safely', async () => {
    // A previously issued client (consistent identity, membership and client rows) and no counter row.
    await db.pool.query(`DELETE FROM taxguard_client_id_sequence;
      INSERT INTO taxguard_identities(uid, tenant_id, user_data) VALUES ('legacy-client', '${A}', jsonb_build_object('id', 'legacy-client', 'tenantId', '${A}',
        'email', 'legacy-client@example.test', 'name', 'Synthetic Legacy Client', 'role', 'client', 'status', 'active', 'isVerified', true,
        'onboardingStatus', 'COMPLETED', 'onboardingCompletedAt', NULL, 'clientId', '640'));
      INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${A}', 'legacy-client', 'client', 'active', '640');
      INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name, email, status) VALUES ('${A}', '640', 'legacy-client', 'Synthetic Legacy Client', 'legacy-client@example.test', 'active');`);
    expect(await counter()).toBeUndefined();
    expect((await provision(A, 'before-init')).error).toMatchObject({ message: 'CLIENT_COUNTER_CORRUPT' });
    await db.pool.query(PROPOSAL);
    expect(await counter()).toBe('640');
    await db.pool.query(PROPOSAL);
    expect(await counter()).toBe('640');
    expect((await provision(A, 'legacy-client')).data).toMatchObject({ clientId: '640', resumed: true });
    expect((await provision(A, 'after-init')).data).toMatchObject({ clientId: '641', resumed: false });
    expect(await counter()).toBe('641');
    await db.pool.query(PROPOSAL);
    expect(await counter()).toBe('641');
    expect((await db.pool.query("SELECT count(*)::int AS n FROM taxguard_clients WHERE client_id IN ('640', '641')")).rows[0].n).toBe(2);
  });
});
