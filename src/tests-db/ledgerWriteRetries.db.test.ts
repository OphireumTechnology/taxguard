import { afterAll, beforeAll, expect, it } from 'vitest';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { generateStandardChartOfAccounts } from '../server/taxguard/bookkeeping/defaultAccounts';
import { pgRpc, startDatabase, type TestDatabase } from './harness';

let db: TestDatabase;
const scope = { tenantId: 'retry-ledger', clientId: 'client-a' };
let accounts: Record<string, string>;
const store = () => new SqlLedgerStore(pgRpc(db.pool));
const entry = (key: string, amount = 10.01) => ({ idempotencyKey: key, taxYear: 2025, postingDate: '2025-03-10', description: 'Synthetic ledger retry',
  lines: [{ accountId: accounts['1010'], debit: amount, credit: 0 }, { accountId: accounts['4010'], debit: 0, credit: amount }] });
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('retry-ledger','Synthetic'),('retry-foreign','Foreign synthetic');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('retry-ledger','client-a','owner-a','Synthetic'),
      ('retry-ledger','client-b','owner-b','Other synthetic'),('retry-foreign','client-a','owner-c','Foreign synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('retry-ledger','maker-a','admin','active'),('retry-ledger','checker-a','admin','active'),
      ('retry-ledger','revoked-a','admin','active'),('retry-foreign','maker-b','admin','active');`);
  const chart = generateStandardChartOfAccounts(scope.tenantId, scope.clientId, '1040_SCHED_C', 'maker-a');
  await store().createAccounts(scope, 'maker-a', chart.map(a => ({ ...a, source: 'SYSTEM_BOOTSTRAP' })));
  accounts = Object.fromEntries(chart.map(a => [a.accountNumber, a.id]));
});
afterAll(async () => { await db?.stop(); });

it('returns one entry to every simultaneous identical posting caller', async () => {
  const connections = await Promise.all(Array.from({ length: 8 }, () => db.connect()));
  try {
    const results = await Promise.all(connections.map(c => new SqlLedgerStore(pgRpc(c)).postEntry(scope, 'maker-a', entry('ledger-post-retry-key'))));
    expect(new Set(results.map(r => r.id)).size).toBe(1);
    const counts = (await db.pool.query(`SELECT
      (SELECT count(*)::int FROM taxguard_ledger_entries WHERE tenant_id=$1 AND idempotency_key='ledger-post-retry-key') entries,
      (SELECT count(*)::int FROM taxguard_audit_log WHERE action='LEDGER_ENTRY_CREATED' AND metadata->>'entryId'=$2) audits`, [scope.tenantId, results[0].id])).rows[0];
    expect(counts).toEqual({ entries: 1, audits: 1 });
  } finally { await Promise.all(connections.map(c => c.end())); }
});

it('returns one prepared reversal to every simultaneous identical reversal caller', async () => {
  const original = await store().postEntry(scope, 'maker-a', entry('ledger-reversal-original'));
  const connections = await Promise.all(Array.from({ length: 8 }, () => db.connect()));
  try {
    const input = { idempotencyKey: 'ledger-reversal-retry-key', entryId: original.id, postingDate: '2025-04-01', reason: 'Synthetic correction reversal' };
    const results = await Promise.all(connections.map(c => new SqlLedgerStore(pgRpc(c)).reverseEntry(scope, 'maker-a', input)));
    expect(new Set(results.map(r => r.id)).size).toBe(1);
    expect(results.every(r => r.status === 'PREPARED')).toBe(true);
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_audit_log WHERE action='LEDGER_ENTRY_REVERSAL_PREPARED' AND metadata->>'entryId'=$1`, [results[0].id])).rows[0].n).toBe(1);
  } finally { await Promise.all(connections.map(c => c.end())); }
});

it('returns one winner and an explicit hash conflict for concurrent different postings', async () => {
  const connections = await Promise.all([db.connect(), db.connect()]);
  try {
    const results = await Promise.allSettled(connections.map((c, n) => new SqlLedgerStore(pgRpc(c)).postEntry(scope, 'maker-a', entry('ledger-conflict-key', n ? 20.02 : 10.01))));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'LEDGER_IDEMPOTENCY_CONFLICT', status: 409 });
  } finally { await Promise.all(connections.map(c => c.end())); }
});

it('conflicts on changed reversal intent while preserving one reversal for competing distinct keys', async () => {
  const original = await store().postEntry(scope, 'maker-a', entry('ledger-reverse-conflict-original'));
  const input = { idempotencyKey: 'ledger-reverse-conflict-key', entryId: original.id, postingDate: '2025-04-01', reason: 'Synthetic correction reversal' };
  await store().reverseEntry(scope, 'maker-a', input);
  await expect(store().reverseEntry(scope, 'maker-a', { ...input, postingDate: '2025-04-02' })).rejects.toMatchObject({ code: 'LEDGER_IDEMPOTENCY_CONFLICT' });
  await expect(store().reverseEntry(scope, 'maker-a', { ...input, reason: 'Different synthetic correction' })).rejects.toMatchObject({ code: 'LEDGER_IDEMPOTENCY_CONFLICT' });
  await expect(store().reverseEntry(scope, 'maker-a', { ...input, idempotencyKey: 'ledger-another-reversal' })).rejects.toMatchObject({ code: 'ENTRY_ALREADY_REVERSED' });
});

it('preserves independent reversal approval, exact cents and historical posting dates on retry', async () => {
  const original = await store().postEntry(scope, 'maker-a', entry('ledger-approved-original'));
  const input = { idempotencyKey: 'ledger-approved-reversal', entryId: original.id, postingDate: '2025-04-01', reason: 'Synthetic approved reversal' };
  const reversal = await store().reverseEntry(scope, 'maker-a', input);
  await expect(store().reviewEntry(scope, 'maker-a', reversal.id, 'approve', reversal.version)).rejects.toMatchObject({ code: 'MAKER_CHECKER_VIOLATION' });
  await store().reviewEntry(scope, 'checker-a', reversal.id, 'approve', reversal.version);
  expect((await store().reverseEntry(scope, 'maker-a', input)).id).toBe(reversal.id);
  for (const [cutoff, expected] of [['2025-03-31', '1001'], ['2025-04-30', '0']]) {
    const totals = (await db.pool.query(`SELECT sum(l.debit_cents-l.credit_cents)::text net FROM taxguard_ledger_entries e JOIN taxguard_ledger_lines l
      ON (l.tenant_id,l.client_id,l.entry_id)=(e.tenant_id,e.client_id,e.entry_id)
      WHERE e.entry_id IN($1,$2) AND e.status='POSTED' AND e.posting_date<=$3::date AND l.account_id=$4`, [original.id, reversal.id, cutoff, accounts['1010']])).rows[0];
    expect(totals.net).toBe(expected);
  }
  expect((await db.pool.query(`SELECT reversed_by_entry_id::text id FROM taxguard_ledger_entries WHERE entry_id=$1`, [original.id])).rows[0].id).toBe(reversal.id);
});

it('retries a correction replacement once while retaining review and posted-balance invariants', async () => {
  const original = await store().postEntry(scope, 'maker-a', { ...entry('ledger-correction-original'), isAdjusting: true, source: 'ADJUSTING' });
  await store().reviewEntry(scope, 'checker-a', original.id, 'request_correction', original.version, 'Synthetic correction required');
  const input = { ...entry('ledger-correction-replacement'), isAdjusting: true, source: 'ADJUSTING' as const, replacesEntryId: original.id };
  const connections = await Promise.all(Array.from({ length: 4 }, () => db.connect()));
  let replacement;
  try {
    const results = await Promise.all(connections.map(c => new SqlLedgerStore(pgRpc(c)).postEntry(scope, 'maker-a', input)));
    expect(new Set(results.map(r => r.id)).size).toBe(1); replacement = results[0];
  } finally { await Promise.all(connections.map(c => c.end())); }
  await store().reviewEntry(scope, 'checker-a', replacement!.id, 'approve', replacement!.version);
  const totals = (await db.pool.query(`SELECT sum(l.debit_cents)::text debits,sum(l.credit_cents)::text credits FROM taxguard_ledger_entries e JOIN taxguard_ledger_lines l
    ON (l.tenant_id,l.client_id,l.entry_id)=(e.tenant_id,e.client_id,e.entry_id) WHERE e.entry_id IN($1,$2) AND e.status='POSTED'`, [original.id, replacement!.id])).rows[0];
  expect(totals).toEqual({ debits: '1001', credits: '1001' });
});

it('rolls back reversal entry and audit together and permits recovery with the same key', async () => {
  const original = await store().postEntry(scope, 'maker-a', entry('ledger-rollback-original'));
  const input = { idempotencyKey: 'ledger-rollback-reversal', entryId: original.id, postingDate: '2025-04-01', reason: 'Synthetic rolled-back reversal' };
  const c = await db.connect();
  try {
    await c.query('BEGIN'); const created = await new SqlLedgerStore(pgRpc(c)).reverseEntry(scope, 'maker-a', input); await c.query('ROLLBACK');
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_ledger_entries WHERE entry_id=$1`, [created.id])).rows[0].n).toBe(0);
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_audit_log WHERE metadata->>'entryId'=$1`, [created.id])).rows[0].n).toBe(0);
  } finally { await c.query('ROLLBACK'); await c.end(); }
  const recovered = await store().reverseEntry(scope, 'maker-a', input);
  expect((await store().reverseEntry(scope, 'maker-a', input)).id).toBe(recovered.id);
});

it('isolates client/tenant key collisions and rechecks foreign and revoked access', async () => {
  const first = await store().postEntry(scope, 'maker-a', entry('ledger-scoped-retry-key'));
  for (const [tenantId, clientId, actor] of [['retry-ledger', 'client-b', 'maker-a'], ['retry-foreign', 'client-a', 'maker-b']]) {
    const otherScope = { tenantId, clientId }, chart = generateStandardChartOfAccounts(tenantId, clientId, '1040_SCHED_C', actor);
    await store().createAccounts(otherScope, actor, chart.map(a => ({ ...a, source: 'SYSTEM_BOOTSTRAP' })));
    const ids = Object.fromEntries(chart.map(a => [a.accountNumber, a.id]));
    const posted = await store().postEntry(otherScope, actor, { ...entry('ledger-scoped-retry-key'), lines: [
      { accountId: ids['1010'], debit: 10.01, credit: 0 }, { accountId: ids['4010'], debit: 0, credit: 10.01 }] });
    expect(posted.id).not.toBe(first.id);
  }
  await expect(store().postEntry(scope, 'maker-b', entry('ledger-scoped-retry-key'))).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED' });
  await store().postEntry(scope, 'revoked-a', entry('ledger-revoked-retry-key'));
  await db.pool.query(`UPDATE taxguard_members SET status='suspended' WHERE tenant_id='retry-ledger' AND uid='revoked-a'`);
  await expect(store().postEntry(scope, 'revoked-a', entry('ledger-revoked-retry-key'))).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED' });
});

it('runs the coordinated service-role entry point while denying uncoordinated bypasses', async () => {
  const c = await db.connect();
  try {
    await c.query('BEGIN'); await c.query('SET LOCAL ROLE service_role');
    expect((await new SqlLedgerStore(pgRpc(c)).postEntry(scope, 'maker-a', entry('ledger-service-retry-key'))).status).toBe('POSTED');
    await c.query('COMMIT');
  } finally { await c.query('ROLLBACK'); await c.end(); }
  const grants = (await db.pool.query(`SELECT
    has_function_privilege('service_role','taxguard_ledger_post_entry(text,text,text,text,text,jsonb,uuid)','EXECUTE') post,
    has_function_privilege('service_role','taxguard_ledger_reverse_entry(text,text,text,text,text,uuid,date,text,text)','EXECUTE') reversal,
    has_function_privilege('service_role','taxguard_ledger_retry_lock(text,text,text,text)','EXECUTE') helper`)).rows[0];
  expect(grants).toEqual({ post: false, reversal: false, helper: false });
});

it('retains deferred rejection of unbalanced cents when COMMIT executes as the service role', async () => {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const row = (await c.query(`INSERT INTO taxguard_ledger_entries(tenant_id,client_id,entry_number,tax_year,posting_date,transaction_date,
      description,source,status,total_cents,creator_uid,idempotency_key,request_hash)
      VALUES('retry-ledger','client-a','FIXTURE-INVALID',2025,'2025-05-01','2025-05-01','Synthetic invalid fixture','MANUAL','PREPARED',1001,
      'maker-a','ledger-unbalanced-fixture',repeat('a',64)) RETURNING entry_id`)).rows[0];
    await c.query(`INSERT INTO taxguard_ledger_lines(tenant_id,client_id,entry_id,line_no,account_id,debit_cents,credit_cents)
      VALUES('retry-ledger','client-a',$1,1,$2,1001,0),('retry-ledger','client-a',$1,2,$3,0,1000)`, [row.entry_id, accounts['1010'], accounts['4010']]);
    await c.query('SET LOCAL ROLE service_role');
    await expect(c.query('COMMIT')).rejects.toMatchObject({ code: 'P0001', message: 'LEDGER_ENTRY_UNBALANCED' });
  } finally { await c.query('ROLLBACK'); await c.end(); }
  expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_ledger_entries WHERE idempotency_key='ledger-unbalanced-fixture'`)).rows[0].n).toBe(0);
  const guard = (await db.pool.query(`SELECT prosecdef,proconfig,has_function_privilege('service_role',oid,'EXECUTE') executable
    FROM pg_proc WHERE oid='taxguard_ledger_assert_balanced()'::regprocedure`)).rows[0];
  expect(guard.prosecdef).toBe(true); expect(guard.executable).toBe(false);
  expect(guard.proconfig).toContain('search_path=pg_catalog, public, pg_temp');
});
