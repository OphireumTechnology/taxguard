import { afterAll, beforeAll, expect, it } from 'vitest';
import { BookToTaxStore } from '../server/taxguard/bookkeeping/bookToTaxStore';
import { pgRpc, startDatabase, type TestDatabase } from './harness';

let db: TestDatabase;
const store = () => new BookToTaxStore(pgRpc(db.pool));
const body = { taxYear: 2025, returnFamily: '1040', categoryCode: 'SYNTHETIC', amount: '-10.01',
  adjustmentType: 'PERMANENT', description: 'Synthetic firm-reviewed adjustment' };
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('adj-a','Synthetic A'),('adj-b','Synthetic B');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES
      ('adj-a','client-a','owner-a','Synthetic A'),('adj-a','client-b','owner-b','Synthetic B'),('adj-b','client-a','owner-c','Synthetic C');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES
      ('adj-a','admin-a','admin','active'),('adj-a','admin-other','admin','active'),('adj-b','admin-b','admin','active');`);
  for (const [tenant, actor] of [['adj-a', 'admin-a'], ['adj-b', 'admin-b']]) await store().saveCategory(tenant, actor,
    { returnFamily: '1040', categoryCode: 'SYNTHETIC', label: 'Synthetic firm category' });
});
afterAll(async () => { await db?.stop(); });

it('rejects changed monetary payload under an existing adjustment key', async () => {
  await store().prepareAdjustment('adj-a', 'client-a', 'admin-a', 'adjustment-conflict-key', body);
  await expect(store().prepareAdjustment('adj-a', 'client-a', 'admin-a', 'adjustment-conflict-key', { ...body, amount: '-20.02' }))
    .rejects.toMatchObject({ code: 'B2T_IDEMPOTENCY_CONFLICT', status: 409 });
});

it('creates one adjustment and one audit across eight simultaneous identical requests', async () => {
  const connections = await Promise.all(Array.from({ length: 8 }, () => db.connect()));
  try {
    const results = await Promise.all(connections.map(c => new BookToTaxStore(pgRpc(c)).prepareAdjustment(
      'adj-a', 'client-a', 'admin-a', 'adjustment-concurrent-key', body)));
    expect(new Set(results.map(r => r.adjustmentId)).size).toBe(1);
    expect(results.filter(r => !r.replayed)).toHaveLength(1);
    const totals = (await db.pool.query(`SELECT
      (SELECT count(*)::int FROM taxguard_b2t_adjustments WHERE idempotency_key='adjustment-concurrent-key') adjustments,
      (SELECT count(*)::int FROM taxguard_audit_log WHERE action='B2T_ADJUSTMENT_PREPARED' AND metadata->>'adjustmentId'=$1) audits`, [results[0].adjustmentId])).rows[0];
    expect(totals).toEqual({ adjustments: 1, audits: 1 });
  } finally { await Promise.all(connections.map(c => c.end())); }
});

it('binds every material field and the preparer, preserving exact integer cents', async () => {
  const original = await store().prepareAdjustment('adj-a', 'client-a', 'admin-a', 'adjustment-fields-key', body);
  for (const changed of [{ taxYear: 2024 }, { returnFamily: '1120' }, { categoryCode: 'OTHER' }, { adjustmentType: 'TIMING' },
    { description: 'Different synthetic justification' }, { evidenceDocumentId: 'different-document' }])
    await expect(store().prepareAdjustment('adj-a', 'client-a', 'admin-a', 'adjustment-fields-key', { ...body, ...changed }))
      .rejects.toMatchObject({ code: 'B2T_IDEMPOTENCY_CONFLICT', status: 409 });
  await expect(store().prepareAdjustment('adj-a', 'client-a', 'admin-other', 'adjustment-fields-key', body))
    .rejects.toMatchObject({ code: 'B2T_IDEMPOTENCY_CONFLICT' });
  const row = (await db.pool.query(`SELECT amount_cents::text cents,status FROM taxguard_b2t_adjustments WHERE adjustment_id=$1`, [original.adjustmentId])).rows[0];
  expect(row).toEqual({ cents: '-1001', status: 'PREPARED' });
});

it('allows one winner for simultaneous conflicting amounts', async () => {
  const connections = await Promise.all([db.connect(), db.connect()]);
  try {
    const results = await Promise.allSettled(connections.map((c, n) => new BookToTaxStore(pgRpc(c)).prepareAdjustment(
      'adj-a', 'client-a', 'admin-a', 'adjustment-race-key', { ...body, amount: n ? '-20.02' : '-10.01' })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason)
      .toMatchObject({ code: 'B2T_IDEMPOTENCY_CONFLICT', status: 409 });
  } finally { await Promise.all(connections.map(c => c.end())); }
});

it('isolates the same key across tenants and clients and denies foreign actors', async () => {
  const key = 'adjustment-scoped-key';
  const ids = await Promise.all([
    store().prepareAdjustment('adj-a', 'client-a', 'admin-a', key, body),
    store().prepareAdjustment('adj-a', 'client-b', 'admin-a', key, body),
    store().prepareAdjustment('adj-b', 'client-a', 'admin-b', key, body),
  ]);
  expect(new Set(ids.map(r => r.adjustmentId)).size).toBe(3);
  await expect(store().prepareAdjustment('adj-a', 'client-a', 'admin-b', key, body)).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED', status: 403 });
});

it('rolls back adjustment and audit together and recovers the key', async () => {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const created = await new BookToTaxStore(pgRpc(c)).prepareAdjustment('adj-a', 'client-a', 'admin-a', 'adjustment-rollback-key', body);
    await c.query('ROLLBACK');
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_b2t_adjustments WHERE adjustment_id=$1`, [created.adjustmentId])).rows[0].n).toBe(0);
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_audit_log WHERE metadata->>'adjustmentId'=$1`, [created.adjustmentId])).rows[0].n).toBe(0);
  } finally { await c.query('ROLLBACK'); await c.end(); }
  const recovered = await store().prepareAdjustment('adj-a', 'client-a', 'admin-a', 'adjustment-rollback-key', body);
  expect(recovered.replayed).toBe(false);
  expect(await store().prepareAdjustment('adj-a', 'client-a', 'admin-a', 'adjustment-rollback-key', body))
    .toEqual({ adjustmentId: recovered.adjustmentId, replayed: true });
});

it('keeps independent approval intact and replays creation without changing the approved record', async () => {
  const created = await store().prepareAdjustment('adj-a', 'client-a', 'admin-a', 'adjustment-approved-key', body);
  await expect(store().reviewAdjustment('adj-a', 'client-a', 'admin-a', created.adjustmentId, true))
    .rejects.toMatchObject({ code: 'MAKER_CHECKER_VIOLATION', status: 403 });
  await store().reviewAdjustment('adj-a', 'client-a', 'admin-other', created.adjustmentId, true);
  expect((await store().prepareAdjustment('adj-a', 'client-a', 'admin-a', 'adjustment-approved-key', body)).replayed).toBe(true);
  expect((await db.pool.query(`SELECT status,reviewed_by FROM taxguard_b2t_adjustments WHERE adjustment_id=$1`, [created.adjustmentId])).rows[0])
    .toEqual({ status: 'APPROVED', reviewed_by: 'admin-other' });
  const events = (await db.pool.query(`SELECT action,tenant_id,actor_uid,metadata->>'clientId' client FROM taxguard_audit_log
    WHERE metadata->>'adjustmentId'=$1 ORDER BY event_sequence`, [created.adjustmentId])).rows;
  expect(events).toEqual([
    { action: 'B2T_ADJUSTMENT_PREPARED', tenant_id: 'adj-a', actor_uid: 'admin-a', client: 'client-a' },
    { action: 'B2T_ADJUSTMENT_APPROVED', tenant_id: 'adj-a', actor_uid: 'admin-other', client: 'client-a' },
  ]);
});

it('refuses retries after access revocation and exposes no client-role SQL entry point', async () => {
  await store().prepareAdjustment('adj-a', 'client-a', 'admin-other', 'adjustment-revoked-key', body);
  await db.pool.query(`UPDATE taxguard_members SET status='suspended' WHERE tenant_id='adj-a' AND uid='admin-other'`);
  await expect(store().prepareAdjustment('adj-a', 'client-a', 'admin-other', 'adjustment-revoked-key', body))
    .rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED', status: 403 });
  const privileges = (await db.pool.query(`SELECT has_function_privilege('anon',$1,'EXECUTE') anon,
    has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service`,
    ['taxguard_b2t_prepare_adjustment(text,text,text,text,jsonb)'])).rows[0];
  expect(privileges).toEqual({ anon: false, authenticated: false, service: true });
});
