import { beforeAll, afterAll, expect, it } from 'vitest';
import { startDatabase, pgRpc, type TestDatabase } from './harness';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';

let db: TestDatabase;
let store: SqlLedgerStore;
const reversible: Array<{ id: string; version: number }> = [];
const scope = { tenantId: 'precision-tenant', clientId: 'precision-client' };
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('precision-tenant','Synthetic precision');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('precision-tenant','precision-client','owner');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('precision-tenant','precision-admin','admin','active'),('precision-tenant','precision-reviewer','reviewer','active');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by)
      VALUES('precision-review','precision-tenant','precision-client','reviewer','precision-reviewer','test');`);
  store = new SqlLedgerStore(pgRpc(db.pool));
  await store.createAccounts(scope, 'precision-admin', [
    { id: 'precision-cash', accountNumber: '1010', accountName: 'Cash', accountType: 'ASSET', accountSubtype: 'CASH_AND_EQUIVALENTS' },
    { id: 'precision-income', accountNumber: '4010', accountName: 'Income', accountType: 'REVENUE', accountSubtype: 'SERVICE_REVENUE' },
  ]);
  for (let n = 0; n < 92; n++) {
    const amount = n === 91 ? 0.01 : 1e12;
    const entry = await store.postEntry(scope, 'precision-admin', { idempotencyKey: `precision-entry-${n}`, taxYear: 2025,
      postingDate: '2025-01-01', description: 'Synthetic aggregate precision',
      lines: [{ accountId: 'precision-cash', debit: amount, credit: 0 }, { accountId: 'precision-income', debit: 0, credit: amount }] });
    if (n < 21) reversible.push(entry);
  }
  const result = await db.pool.query(`SELECT sum(debit_cents-credit_cents)::text AS cents FROM taxguard_ledger_lines
    WHERE tenant_id='precision-tenant' AND client_id='precision-client' AND account_id='precision-cash'`);
  expect(result.rows[0].cents).toBe('9100000000000001');
  console.log(JSON.stringify({ exactSqlCents: result.rows[0].cents, entries: 92 }));
});

it('transports both signed balances and trial-balance aggregates as exact JSON strings', async () => {
  const result = await db.pool.query(`SELECT taxguard_ledger_general_ledger_exact('precision-tenant','precision-client','precision-admin',2025,NULL,'{"toDate":"2025-01-31"}') AS gl,
    taxguard_ledger_trial_balance_exact('precision-tenant','precision-client','precision-admin',2025,'2025-01-31') AS tb`);
  expect(result.rows[0].gl.map((r: any) => r.endingCents)).toEqual(['9100000000000001', '-9100000000000001']);
  expect(result.rows[0].tb[0].periodDebitCents).toBe('9100000000000001');
  expect(result.rows[0].gl[0].lines.at(-1).runningCents).toBe('9100000000000001');
  await expect(store.generalLedger(scope, 'nobody', 2025)).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED' });
  const grants = await db.pool.query(`SELECT proname, has_function_privilege('service_role',oid,'EXECUTE') AS service,
    has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE') AS client
    FROM pg_proc WHERE proname IN ('taxguard_ledger_general_ledger_exact','taxguard_ledger_trial_balance_exact')`);
  expect(grants.rows).toHaveLength(2);
  expect(grants.rows.every(r => r.service && !r.client)).toBe(true);
});

it('recovers safe exact balances after approved reversals while historical reports remain refused', async () => {
  for (const [index, entry] of reversible.entries()) {
    const reversal = await store.reverseEntry(scope, 'precision-admin', { idempotencyKey: `precision-reversal-${index}`, entryId: entry.id,
      postingDate: '2025-02-01', reason: 'Synthetic precision reversal' });
    await store.reviewEntry(scope, 'precision-reviewer', reversal.id, 'approve', reversal.version);
  }
  const limited = (await store.generalLedger(scope, 'precision-admin', 2025, 'precision-cash', { limit: 1 }))[0];
  expect(JSON.stringify(limited.endingBalance)).toBe('70000000000000.01');
  expect(limited.lines[0].runningBalance).toBe(limited.endingBalance);
  await expect(store.generalLedger(scope, 'precision-admin', 2025, 'precision-cash', { toDate: '2025-01-31', limit: 1 }))
    .rejects.toMatchObject({ code: 'LEDGER_REPORT_AMOUNT_OUT_OF_RANGE' });
  // The same-year gross turnover remains too large even though its closing net is safe.
  await expect(store.trialBalance(scope, 'precision-admin', 2025)).rejects.toMatchObject({ code: 'LEDGER_REPORT_AMOUNT_OUT_OF_RANGE' });
  const nextYear = await store.trialBalance(scope, 'precision-admin', 2026);
  expect(nextYear.isBalanced).toBe(true);
  expect(JSON.stringify(nextYear.totalBeginningDebit)).toBe('70000000000000.01');
  const statements = await store.financialStatements(scope, 'precision-admin', 2026);
  expect(statements.balanceSheet.isBalanced).toBe(true);
  expect(JSON.stringify(statements.balanceSheet.assets.totalAssets)).toBe('70000000000000.01');
});
afterAll(async () => { await db?.stop(); });

it.each(['generalLedger', 'trialBalance', 'financialStatements'] as const)('refuses %s instead of returning rounded aggregate money', async method => {
  const report = method === 'generalLedger' ? store.generalLedger(scope, 'precision-admin', 2025, undefined, { toDate: '2025-01-31' })
    : store[method](scope, 'precision-admin', 2025, '2025-01-31');
  const result = await report.then(() => 'RESOLVED_UNSAFE', error => error.code);
  expect(result).toBe('LEDGER_REPORT_AMOUNT_OUT_OF_RANGE');
});
