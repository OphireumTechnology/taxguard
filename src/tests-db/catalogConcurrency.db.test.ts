import { afterAll, beforeAll, expect, it } from 'vitest';
import { BillingStore } from '../server/taxguard/billing/billingStore';
import { pgRpc, startDatabase, type TestDatabase } from './harness';

let db: TestDatabase;
const input = (serviceCode: string, fee: string, reason?: string) => ({ serviceCode, name: 'Synthetic concurrent catalog service',
  category: 'ADVISORY', billingMethod: 'FLAT_FEE', baseFee: fee, ...(reason ? { reason } : {}) });
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('catalog-a','Synthetic'),('catalog-b','Foreign synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('catalog-a','manager-a','admin','active'),
      ('catalog-a','staff-a','accountant','active'),('catalog-a','revoked-a','admin','active'),('catalog-b','manager-b','admin','active');
    CREATE FUNCTION catalog_fixture_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.service_code LIKE 'RACE%' THEN PERFORM pg_advisory_xact_lock(443221,7781); END IF; RETURN NEW; END $$;
    CREATE TRIGGER catalog_fixture_barrier BEFORE INSERT ON taxguard_service_catalog FOR EACH ROW EXECUTE FUNCTION catalog_fixture_barrier();`);
});
afterAll(async () => { await db?.stop(); });

// Hold all first submissions after their initial lookup but before insertion in the old path.
// With coordination enabled, one caller reaches insertion and the others wait on the catalog key.
async function race(code: string, reason?: string, sameFee = false) {
  const holder = await db.connect(), connections = await Promise.all(Array.from({ length: 6 }, () => db.connect()));
  const pids = await Promise.all(connections.map(async c => (await c.query('SELECT pg_backend_pid() pid')).rows[0].pid as number));
  let calls: Array<Promise<any>> = [];
  let outcomes: Promise<PromiseSettledResult<any>[]> | undefined;
  try {
    await holder.query('BEGIN'); await holder.query('SELECT pg_advisory_xact_lock(443221,7781)');
    calls = connections.map((c, n) => new BillingStore(pgRpc(c)).upsertService('catalog-a', 'manager-a', input(code, `${sameFee ? 100 : 100 + n}.00`, reason)));
    outcomes = Promise.allSettled(calls);
    // Observe bounded database state rather than relying on a timing-only sleep/barrier.
    let blocked = false;
    for (let n = 0; n < 50; n++) {
      const count = (await db.pool.query(`SELECT count(*)::int n FROM pg_stat_activity WHERE pid=ANY($1::int[]) AND wait_event='advisory'`, [pids])).rows[0].n;
      if (count === connections.length) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(blocked).toBe(true);
    await holder.query('ROLLBACK');
    return await outcomes;
  } finally {
    await holder.query('ROLLBACK'); await outcomes;
    await Promise.all([holder.end(), ...connections.map(c => c.end())]);
  }
}

it('requires a reason for every price change after the one concurrent initial creation', async () => {
  const results = await race('RACE_NO_REASON');
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  for (const r of results) if (r.status === 'rejected') expect(r.reason).toMatchObject({ code: 'PRICE_CHANGE_REASON_REQUIRED', status: 400 });
  const rows = (await db.pool.query(`SELECT previous_fee::text previous,new_fee::text fee FROM taxguard_service_price_history WHERE tenant_id='catalog-a' AND service_code='RACE_NO_REASON'`)).rows;
  expect(rows).toHaveLength(1); expect(rows[0].previous).toBeNull();
});

it('records a correct prior/new price chain for reasoned concurrent changes', async () => {
  const reason = 'Synthetic manager-authorized price change';
  const results = await race('RACE_WITH_REASON', reason);
  expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  const history = (await db.pool.query(`SELECT previous_fee::text previous,new_fee::text fee,reason FROM taxguard_service_price_history
    WHERE tenant_id='catalog-a' AND service_code='RACE_WITH_REASON'`)).rows;
  expect(history).toHaveLength(6);
  const roots = history.filter(h => h.previous === null); expect(roots).toHaveLength(1);
  let fee = roots[0].fee, visited = 1;
  while (visited < history.length) {
    const next = history.filter(h => h.previous === fee); expect(next).toHaveLength(1);
    expect(next[0].reason).toBe(reason); fee = next[0].fee; visited++;
  }
  expect((await db.pool.query(`SELECT base_fee::text fee FROM taxguard_service_catalog WHERE tenant_id='catalog-a' AND service_code='RACE_WITH_REASON'`)).rows[0].fee).toBe(fee);
  expect(history.filter(h => h.previous !== null)).toHaveLength(5);
});

it('keeps identical concurrent price upserts at one price-history row', async () => {
  const results = await race('RACE_SAME_FEE', undefined, true);
  expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_service_price_history WHERE tenant_id='catalog-a' AND service_code='RACE_SAME_FEE'`)).rows[0].n).toBe(1);
});

it('preserves manager authorization and independent natural identity across tenants', async () => {
  const store = new BillingStore(pgRpc(db.pool));
  await expect(store.upsertService('catalog-a', 'staff-a', input('SCOPE', '10.00'))).rejects.toMatchObject({ code: 'BILLING_MANAGER_REQUIRED', status: 403 });
  await expect(store.upsertService('catalog-a', 'manager-b', input('SCOPE', '10.00'))).rejects.toMatchObject({ code: 'PRACTICE_ACCESS_DENIED', status: 403 });
  await store.upsertService('catalog-a', 'manager-a', input('SCOPE', '10.00'));
  await store.upsertService('catalog-b', 'manager-b', input('SCOPE', '20.00'));
  expect((await db.pool.query(`SELECT tenant_id,base_fee::text fee FROM taxguard_service_catalog WHERE service_code='SCOPE' ORDER BY tenant_id`)).rows)
    .toEqual([{ tenant_id: 'catalog-a', fee: '10.00' }, { tenant_id: 'catalog-b', fee: '20.00' }]);
});

it('rechecks manager access after a catalog lock wait', async () => {
  const store = new BillingStore(pgRpc(db.pool));
  await store.upsertService('catalog-a', 'manager-a', input('ROLE_WAIT', '10.00'));
  const holder = await db.connect(), contender = await db.connect();
  let outcome: Promise<PromiseSettledResult<any>[]> | undefined;
  try {
    const pid = (await contender.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    await holder.query('BEGIN');
    await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended(jsonb_build_array('billing-catalog','catalog-a','ROLE_WAIT')::text,0))`);
    outcome = Promise.allSettled([new BillingStore(pgRpc(contender)).upsertService('catalog-a', 'revoked-a', input('ROLE_WAIT', '20.00', 'Synthetic change reason'))]);
    let blocked = false;
    for (let n = 0; n < 50; n++) {
      if ((await db.pool.query(`SELECT wait_event FROM pg_stat_activity WHERE pid=$1`, [pid])).rows[0]?.wait_event === 'advisory') { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(blocked).toBe(true);
    await db.pool.query(`UPDATE taxguard_members SET status='suspended' WHERE tenant_id='catalog-a' AND uid='revoked-a'`);
    await holder.query('ROLLBACK');
    const [result] = await outcome;
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'PRACTICE_ACCESS_DENIED', status: 403 });
    expect((await db.pool.query(`SELECT base_fee::text fee FROM taxguard_service_catalog WHERE tenant_id='catalog-a' AND service_code='ROLE_WAIT'`)).rows[0].fee).toBe('10.00');
  } finally { await holder.query('ROLLBACK'); await outcome; await Promise.all([holder.end(), contender.end()]); }
});

it('rolls back catalog and price history if audit creation fails, then recovers', async () => {
  const store = new BillingStore(pgRpc(db.pool));
  await db.pool.query(`CREATE FUNCTION catalog_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='BILLING_SERVICE_PRICED' THEN RAISE EXCEPTION 'Synthetic pricing audit failure' USING ERRCODE='XX000'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER catalog_fixture_failure BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION catalog_fixture_failure();`);
  try {
    await expect(store.upsertService('catalog-a', 'manager-a', input('FAIL_RECOVER', '10.00'))).rejects.toMatchObject({ code: 'BILLING_STORE_UNAVAILABLE', status: 503 });
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_service_catalog WHERE service_code='FAIL_RECOVER'`)).rows[0].n).toBe(0);
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_service_price_history WHERE service_code='FAIL_RECOVER'`)).rows[0].n).toBe(0);
  } finally { await db.pool.query('DROP TRIGGER catalog_fixture_failure ON taxguard_audit_log; DROP FUNCTION catalog_fixture_failure()'); }
  expect((await store.upsertService('catalog-a', 'manager-a', input('FAIL_RECOVER', '10.00'))).baseFee).toBe('10.00');
});

it('permits serialized service-role writes, denies bypasses and retains price-history mutation refusal', async () => {
  const c = await db.connect();
  try {
    await c.query('BEGIN'); await c.query('SET LOCAL ROLE service_role');
    expect((await new BillingStore(pgRpc(c)).upsertService('catalog-a', 'manager-a', input('SERVICE_ROLE', '10.00'))).baseFee).toBe('10.00');
    await c.query('COMMIT');
  } finally { await c.query('ROLLBACK'); await c.end(); }
  const grants = (await db.pool.query(`SELECT
    has_function_privilege('service_role','taxguard_bill_upsert_service(text,text,text,text,text,text,numeric,text)','EXECUTE') legacy,
    has_table_privilege('service_role','taxguard_service_catalog','UPDATE') raw,
    has_function_privilege('authenticated','taxguard_bill_upsert_service_serialized(text,text,text,text,text,text,numeric,text)','EXECUTE') client`)).rows[0];
  expect(grants).toEqual({ legacy: false, raw: false, client: false });
  await expect(db.pool.query(`UPDATE taxguard_service_price_history SET new_fee=1 WHERE service_code='SERVICE_ROLE'`)).rejects.toMatchObject({ message: 'BILLING_HISTORY_IMMUTABLE' });
  await expect(db.pool.query(`DELETE FROM taxguard_service_price_history WHERE service_code='SERVICE_ROLE'`)).rejects.toMatchObject({ message: 'BILLING_HISTORY_IMMUTABLE' });
});
