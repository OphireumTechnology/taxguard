import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { SqlLedgerStore, type LedgerScope } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { generateStandardChartOfAccounts } from '../server/taxguard/bookkeeping/defaultAccounts';
import { BillingStore } from '../server/taxguard/billing/billingStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { DocumentVaultStore } from '../server/taxguard/documents/documentVaultStore';
import type { MalwareScanner, VaultStorage } from '../server/taxguard/documents/vaultIntegrations';
import { withBoundedSessionRevocationRetry } from '../server/sessionRevocationRetry';

// Multiple simultaneous backend sessions against a real PostgreSQL server: every concurrent call
// below runs on its own dedicated connection, so row locks, unique indexes, counters and
// transactions are exercised as they would be in a deployed database. Synthetic data only.
let db: TestDatabase;
let conns: pg.Client[] = [];
const N = 12;
/** Runs fn(i) for i in 0..n-1, each on its own connection, released together. */
async function parallel<T>(n: number, fn: (rpc: ReturnType<typeof pgRpc>, i: number) => Promise<T>) {
  return Promise.allSettled(Array.from({ length: n }, (_, i) => fn(pgRpc(conns[i % conns.length]), i)));
}
const ok = <T>(r: PromiseSettledResult<T>[]) => r.filter((x): x is PromiseFulfilledResult<T> => x.status === 'fulfilled').map(x => x.value);
const failed = (r: PromiseSettledResult<unknown>[]) => r.filter((x): x is PromiseRejectedResult => x.status === 'rejected').map(x => x.reason?.code ?? String(x.reason));
const one = async <T = any>(sql: string, params: unknown[] = []) => (await db.pool.query(sql, params)).rows[0] as T;

const A: LedgerScope = { tenantId: 'tenantA', clientId: 'dbLedger' };
let accounts: Record<string, string> = {};
const ledger = () => new SqlLedgerStore(pgRpc(db.pool));
const entry = (key: string, over: Record<string, unknown> = {}) => ({ idempotencyKey: key, taxYear: 2025, postingDate: '2025-03-10', description: 'Synthetic concurrent posting',
  lines: [{ accountId: accounts['1010'], debit: 10.01, credit: 0 }, { accountId: accounts['4010'], debit: 0, credit: 10.01 }], ...over }) as any;

beforeAll(async () => {
  db = await startDatabase();
  conns = await Promise.all(Array.from({ length: N }, () => db.connect()));
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('tenantA','Synthetic A'),('tenantB','Synthetic B');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('tenantA','dbLedger','own-l','Synthetic Ledger'),('tenantA','dbBill','db-client','Synthetic Billing'),
      ('tenantA','dbDocs','db-doc-client','Synthetic Docs'),('tenantB','dbForeign','own-f','Foreign Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('tenantA','db-acct','accountant','active',NULL),('tenantA','db-rev','reviewer','active',NULL),
      ('tenantA','db-rev2','senior_reviewer','active',NULL),('tenantA','db-mgr','practice_manager','active',NULL),('tenantA','db-mgr2','admin','active',NULL),
      ('tenantA','db-client','client','active','dbBill'),('tenantA','db-doc-client','client','active','dbDocs'),('tenantB','db-foreign','practice_manager','active',NULL);
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by,effective_from) VALUES
      ('db-1','tenantA','dbLedger','accountant','db-acct','admin',now()-interval '1 day'),('db-2','tenantA','dbLedger','reviewer','db-rev','admin',now()-interval '1 day'),
      ('db-3','tenantA','dbLedger','senior_reviewer','db-rev2','admin',now()-interval '1 day');`);
  const chart = generateStandardChartOfAccounts(A.tenantId, A.clientId, '1040_SCHED_C', 'db-acct');
  await ledger().createAccounts(A, 'db-acct', chart.map(a => ({ ...a, source: 'SYSTEM_BOOTSTRAP' })));
  accounts = Object.fromEntries(chart.map(a => [a.accountNumber, a.id]));
});
afterAll(async () => { await Promise.all(conns.map(c => c.end().catch(() => undefined))); await db?.stop(); });

describe('concurrent ledger postings', () => {
  it('serializes simultaneous postings into unique, gap-free entry numbers with exact totals', async () => {
    const before = (await one<{ n: number }>(`SELECT count(*)::int n FROM taxguard_ledger_entries WHERE client_id='dbLedger'`)).n;
    const r = await parallel(N, (rpc, i) => new SqlLedgerStore(rpc).postEntry(A, 'db-acct', entry('db-post-' + i)));
    expect(failed(r)).toEqual([]);
    const numbers = ok(r).map(e => Number(e.entryNumber.slice(3))).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(N);
    expect(numbers[N - 1] - numbers[0]).toBe(N - 1);
    const t = await one<{ n: number; d: string; c: string }>(`SELECT count(*)::int n, sum(l.debit_cents)::text d, sum(l.credit_cents)::text c FROM taxguard_ledger_entries e
      JOIN taxguard_ledger_lines l ON l.tenant_id=e.tenant_id AND l.client_id=e.client_id AND l.entry_id=e.entry_id WHERE e.client_id='dbLedger' AND e.status='POSTED'`);
    expect(t.n).toBe((before + N) * 2);
    expect(t.d).toBe(t.c);
    expect((await ledger().trialBalance(A, 'db-rev', 2025)).isBalanced).toBe(true);
  });
  it('creates exactly one entry when the same idempotency key arrives on many connections at once', async () => {
    const r = await parallel(N, rpc => new SqlLedgerStore(rpc).postEntry(A, 'db-acct', entry('db-same-key')));
    const ids = new Set(ok(r).map(e => e.id));
    expect(ids.size).toBe(1);
    // Losers either replay the winner or are told to retry; none creates a second entry or fails opaquely.
    for (const code of failed(r)) expect(['LEDGER_BUSY', 'LEDGER_IDEMPOTENCY_CONFLICT', 'LEDGER_CONCURRENT_UPDATE']).toContain(code);
    expect((await one<{ n: number }>(`SELECT count(*)::int n FROM taxguard_ledger_entries WHERE client_id='dbLedger' AND idempotency_key='db-same-key'`)).n).toBe(1);
    // A loser that retries receives the winner's entry.
    expect((await ledger().postEntry(A, 'db-acct', entry('db-same-key'))).id).toBe([...ids][0]);
  });
  it('lets exactly one of two simultaneous reviewers decide a prepared entry', async () => {
    const prepared = await ledger().postEntry(A, 'db-acct', entry('db-review-race', { isAdjusting: true, source: 'ADJUSTING' }));
    expect(prepared.status).toBe('PREPARED');
    const r = await Promise.allSettled([
      new SqlLedgerStore(pgRpc(conns[0])).reviewEntry(A, 'db-rev', prepared.id, 'approve', prepared.version),
      new SqlLedgerStore(pgRpc(conns[1])).reviewEntry(A, 'db-rev2', prepared.id, 'reject', prepared.version, 'Synthetic competing rejection')]);
    expect(ok(r)).toHaveLength(1);
    expect(['LEDGER_VERSION_CONFLICT', 'ENTRY_NOT_PENDING_REVIEW', 'LEDGER_BUSY', 'LEDGER_CONCURRENT_UPDATE']).toContain(failed(r)[0]);
    const row = await one<{ status: string }>(`SELECT status FROM taxguard_ledger_entries WHERE entry_id::text=$1`, [prepared.id]);
    expect(['POSTED', 'REJECTED']).toContain(row.status);
  });
  it('never posts into a period after a concurrent hard close commits', async () => {
    const p = await ledger().openPeriod(A, 'db-acct', 2025, '2025-08', '2025-08-01', '2025-08-31');
    const r = await Promise.allSettled([
      ...Array.from({ length: N - 1 }, (_, i) => new SqlLedgerStore(pgRpc(conns[i])).postEntry(A, 'db-acct', entry('db-close-race-' + i, { postingDate: '2025-08-15', periodId: p.periodId }))),
      new SqlLedgerStore(pgRpc(conns[N - 1])).closePeriod(A, 'db-rev', p.periodId, 'HARD_CLOSED')]);
    const closed = r[N - 1].status === 'fulfilled';
    for (const code of failed(r)) expect(['PERIOD_HARD_CLOSED', 'PERIOD_HAS_UNAPPROVED_ENTRIES', 'LEDGER_BUSY', 'LEDGER_CONCURRENT_UPDATE']).toContain(code);
    const posted = ok(r.slice(0, N - 1) as PromiseSettledResult<any>[]).length;
    expect((await one<{ n: number }>(`SELECT count(*)::int n FROM taxguard_ledger_entries WHERE client_id='dbLedger' AND posting_date='2025-08-15'`)).n).toBe(posted);
    if (!closed) await ledger().closePeriod(A, 'db-rev', p.periodId, 'HARD_CLOSED');
    await expect(ledger().postEntry(A, 'db-acct', entry('db-after-close', { postingDate: '2025-08-20' }))).rejects.toMatchObject({ code: 'PERIOD_HARD_CLOSED' });
  });
});

describe('transactions roll back completely', () => {
  it('leaves no entry, line or audit row when the caller rolls back', async () => {
    const c = conns[0];
    const count = async () => one<{ e: number; a: number }>(`SELECT (SELECT count(*)::int FROM taxguard_ledger_entries WHERE client_id='dbLedger') e, (SELECT count(*)::int FROM taxguard_audit_log) a`);
    const before = await count();
    await c.query('BEGIN');
    const posted = await new SqlLedgerStore(pgRpc(c)).postEntry(A, 'db-acct', entry('db-rolled-back'));
    expect(posted.status).toBe('POSTED');
    await c.query('ROLLBACK');
    expect(await count()).toEqual(before);
    // The key is free again afterwards: a retry creates the entry once.
    const again = await ledger().postEntry(A, 'db-acct', entry('db-rolled-back'));
    expect(again.id).not.toBe(posted.id);
    expect((await ledger().postEntry(A, 'db-acct', entry('db-rolled-back'))).id).toBe(again.id);
    expect((await count()).e).toBe(before.e + 1);
  });
  it('aborts the whole statement when one step fails (no partial entry)', async () => {
    const before = await one<{ n: number }>(`SELECT count(*)::int n FROM taxguard_ledger_lines WHERE client_id='dbLedger'`);
    await expect(ledger().postEntry(A, 'db-acct', entry('db-bad-account', { lines: [{ accountId: accounts['1010'], debit: 5, credit: 0 }, { accountId: 'no-such-account', debit: 0, credit: 5 }] })))
      .rejects.toHaveProperty('code');
    expect((await one<{ n: number }>(`SELECT count(*)::int n FROM taxguard_ledger_lines WHERE client_id='dbLedger'`)).n).toBe(before.n);
  });
});

describe('invoice numbering and duplicate payments', () => {
  let invoices: Array<{ invoiceId: string; rowVersion: number }> = [];
  beforeAll(async () => {
    const practice = new PracticeStore(pgRpc(db.pool));
    const eng = (await practice.createEngagement('tenantA', 'dbBill', 'db-mgr', 'db-bill-eng', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus('tenantA', 'dbBill', 'db-mgr', eng, 'active', 1);
    await practice.assign('tenantA', 'dbBill', 'db-mgr', 'db-bill-asg', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'db-acct', reason: 'Synthetic staffing' });
    const bill = new BillingStore(pgRpc(db.pool));
    await bill.upsertService('tenantA', 'db-mgr', { serviceCode: 'SYN-1', name: 'Synthetic service', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '100.00' });
    for (let i = 0; i < N; i++) {
      const inv = await bill.createInvoice('tenantA', 'dbBill', 'db-acct', 'db-inv-' + i, { dueDate: '2026-06-30' });
      const lined = await bill.addLine('tenantA', 'dbBill', 'db-acct', inv.invoiceId, { serviceCode: 'SYN-1', quantity: '1' }, 'concurrency-line-' + i);
      invoices.push(await bill.transition('tenantA', 'dbBill', 'db-acct', inv.invoiceId, 'submit', lined.rowVersion));
    }
  });
  it('assigns unique consecutive numbers to invoices approved simultaneously', async () => {
    const r = await parallel(N, (rpc, i) => new BillingStore(rpc).transition('tenantA', 'dbBill', i % 2 ? 'db-mgr' : 'db-mgr2', invoices[i].invoiceId, 'approve', invoices[i].rowVersion));
    expect(failed(r)).toEqual([]);
    const numbers = ok(r).map((x: any) => x.invoiceNumber as string).sort();
    expect(new Set(numbers).size).toBe(N);
    const seqs = numbers.map(n => Number(n.split('-')[2]));
    expect(seqs).toEqual(Array.from({ length: N }, (_, i) => i + 1));
  });
  it('records one payment for a key replayed on many connections, and never overpays', async () => {
    const id = invoices[0].invoiceId;
    const same = await parallel(N, rpc => new BillingStore(rpc).recordManualPayment('tenantA', 'dbBill', 'db-mgr', id, { amount: '10.00', method: 'CHECK', idempotencyKey: 'db-pay-same' }));
    for (const code of failed(same)) expect(['BILLING_BUSY', 'DUPLICATE_PAYMENT', 'PAYMENT_IDEMPOTENCY_CONFLICT']).toContain(code);
    expect(new Set(ok(same).map((x: any) => x.paymentId)).size).toBe(1);
    const distinct = await parallel(N, (rpc, i) => new BillingStore(rpc).recordManualPayment('tenantA', 'dbBill', 'db-mgr', id, { amount: '25.00', method: 'CHECK', idempotencyKey: 'db-pay-' + i }));
    for (const code of failed(distinct)) expect(['PAYMENT_EXCEEDS_BALANCE', 'BILLING_BUSY', 'DUPLICATE_PAYMENT']).toContain(code);
    const t = await one<{ n: number; paid: string; total: string }>(`SELECT (SELECT count(*)::int FROM taxguard_invoice_payments WHERE invoice_id=$1) n,
      (SELECT sum(amount)::text FROM taxguard_invoice_payments WHERE invoice_id=$1) paid, (SELECT total::text FROM taxguard_invoices WHERE id=$1) total`, [id]);
    expect(t.n).toBe(1 + ok(distinct).length);
    expect(Number(t.paid)).toBeLessThanOrEqual(Number(t.total));
    expect(Number(t.paid)).toBe(10 + 25 * ok(distinct).length);
  });
});

describe('document review concurrency', () => {
  it('lets exactly one of two simultaneous reviewers decide a document version', async () => {
    const practice = new PracticeStore(pgRpc(db.pool));
    const eng = (await practice.createEngagement('tenantA', 'dbDocs', 'db-mgr', 'db-doc-eng', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus('tenantA', 'dbDocs', 'db-mgr', eng, 'active', 1);
    await practice.assign('tenantA', 'dbDocs', 'db-mgr', 'db-doc-asg-1', { engagementId: eng, taxYear: 2025, role: 'reviewer', userId: 'db-rev', reason: 'Synthetic staffing' });
    const objects = new Map<string, Buffer>();
    const storage: VaultStorage = { async put(p, b) { objects.set(p, b); }, async signedUrl(p) { return 'https://storage.invalid/' + encodeURIComponent(p); } };
    const scanner: MalwareScanner = { name: 'synthetic-clean', async scan() { return 'CLEAN'; } };
    const vault = (c: pg.Pool | pg.Client) => new DocumentVaultStore(pgRpc(c), storage, scanner);
    const up = await vault(db.pool).upload('tenantA', 'dbDocs', 'db-doc-client', { engagementId: eng, taxYear: 2025, category: 'income', fileName: 'synthetic.pdf',
      mimeType: 'application/pdf', idempotencyKey: 'db-doc-upload-1' } as any, Buffer.from('%PDF-1.4\nsynthetic\n%%EOF'));
    const detail = await vault(db.pool).detail('tenantA', 'dbDocs', 'db-rev', up.documentId);
    const rowVersion = (detail.versions ?? [detail]).find((v: any) => v.version === 1)?.rowVersion ?? detail.rowVersion;
    const r = await Promise.allSettled([
      vault(conns[0]).review('tenantA', 'dbDocs', 'db-rev', up.documentId, 1, 'approve', rowVersion),
      vault(conns[1]).review('tenantA', 'dbDocs', 'db-mgr', up.documentId, 1, 'reject', rowVersion, 'Synthetic competing rejection')]);
    expect(ok(r)).toHaveLength(1);
    expect(['DOCUMENT_VERSION_CONFLICT', 'DOCUMENT_ALREADY_REVIEWED', 'DOCUMENT_NOT_REVIEWABLE', 'DOCUMENT_BUSY']).toContain(failed(r)[0]);
    const audits = await one<{ n: number }>(`SELECT count(*)::int n FROM taxguard_audit_log WHERE action LIKE 'DOCUMENT_%' AND metadata->>'documentId'=$1 AND action IN ('DOCUMENT_VERIFIED','DOCUMENT_REJECTED')`, [up.documentId]);
    expect(audits.n).toBe(1);
  });
});

describe('session revocation under concurrency', () => {
  it('converges to every staff session revoked when own and administrator revocations race', async () => {
    const live = "(floor(extract(epoch FROM now())*1000)::bigint+3600000)", fresh = 'floor(extract(epoch FROM now()))::bigint';
    await db.pool.query(`INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','db-sess-staff','accountant','active'),('tenantA','db-sess-admin','admin','active');
      INSERT INTO taxguard_identities(tenant_id,uid,user_data) SELECT tenant_id,uid,jsonb_build_object('id',uid,'tenantId',tenant_id,'role',role,'status',status) FROM taxguard_members WHERE uid LIKE 'db-sess-%';
      INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal) SELECT 'tenantA','db-sess-staff',repeat(to_hex(g),64/length(to_hex(g)))||'',${fresh},${live},'aal2' FROM generate_series(1,8) g;
      INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal) VALUES('tenantA','db-sess-admin',repeat('d',64),${fresh},${live},'aal2');`);
    const ids = (await db.pool.query(`SELECT id, session_token_hash h FROM taxguard_sessions WHERE uid='db-sess-staff' ORDER BY h`)).rows;
    const current = ids[0].h;
    const retries: string[] = [];
    const retry = <T,>(operation: () => Promise<T>) => withBoundedSessionRevocationRetry(operation,
      { onRetry: code => retries.push(code) });
    const r = await Promise.allSettled([
      ...ids.slice(1, 6).map((s, i) => retry(() => conns[i].query('SELECT taxguard_revoke_own_session($1,$2,$3,$4) AS r', ['tenantA', 'db-sess-staff', current, s.id]))),
      retry(() => conns[6].query('SELECT taxguard_revoke_other_own_sessions($1,$2,$3) AS r', ['tenantA', 'db-sess-staff', current])),
      retry(() => conns[7].query('SELECT taxguard_admin_revoke_member_sessions($1,$2,$3,$4,$5) AS r', ['tenantA', 'db-sess-admin', 'd'.repeat(64), 'db-sess-staff', 'lost_or_stolen_device']))]);
    // Verify every attempt: NOWAIT conflicts abort the whole SQL transaction and its audit;
    // the shared bounded retry policy retries only those explicit transient SQLSTATEs.
    expect(retries.every(code => ['55P03', '40001', '40P01'].includes(code))).toBe(true);
    const administratorOutcome = r[r.length - 1];
    expect(administratorOutcome.status).toBe('fulfilled'); // administrator action must converge
    if (administratorOutcome.status === 'fulfilled') {
      expect(administratorOutcome.value.rows[0].r.revokedSessions).toBeGreaterThanOrEqual(0);
      expect(administratorOutcome.value.rows[0].r.revokedSessions).toBeLessThanOrEqual(ids.length);
    }
    for (const outcome of r.slice(0, -1)) if (outcome.status === 'rejected')
      expect(['P0001', 'SESSION_STORE_BUSY']).toContain((outcome.reason as any).code ?? (outcome.reason as any).message);
    const flags = (await db.pool.query(`SELECT revoked FROM taxguard_sessions WHERE uid='db-sess-staff'`)).rows.map(x => x.revoked);
    expect(flags.every(Boolean)).toBe(true);
    // Every state transition has one committed audit representation; failed NOWAIT attempts
    // roll back both the update and audit, and retries cannot double count already-revoked rows.
    const revokedCount = flags.filter(Boolean).length;
    const auditSessions = await one<{ n: number }>(`SELECT coalesce(sum(CASE
        WHEN action='SESSION_REVOKED_BY_OWNER' THEN 1
        ELSE coalesce((metadata->>'revokedSessions')::int,0) END),0)::int n
      FROM taxguard_audit_log WHERE action IN ('SESSION_REVOKED_BY_OWNER','SESSIONS_OTHER_REVOKED_BY_OWNER','STAFF_SESSIONS_REVOKED_BY_ADMIN')
        AND (actor_uid='db-sess-staff' OR metadata->>'targetUid'='db-sess-staff')`);
    expect(auditSessions.n).toBe(revokedCount);
    const committedAdminSuccesses = await one<{ n: number }>(`SELECT count(*)::int n FROM taxguard_audit_log
      WHERE action='STAFF_SESSIONS_REVOKED_BY_ADMIN' AND metadata->>'targetUid'='db-sess-staff'
        AND coalesce((metadata->>'revokedSessions')::int,0)>0`);
    expect(committedAdminSuccesses.n).toBe(1);
    // Every revoked token fails the authoritative session check, including after retry convergence.
    for (const session of ids)
      await expect(db.pool.query('SELECT taxguard_list_own_sessions($1,$2,$3) AS r', ['tenantA', 'db-sess-staff', session.h])).rejects.toThrow();
  });

  it('fails closed on exhausted lock retries, then revokes after a fresh transaction can acquire the lock', async () => {
    const live = '(floor(extract(epoch FROM now())*1000)::bigint+3600000)', fresh = 'floor(extract(epoch FROM now()))::bigint';
    await db.pool.query(`INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','db-sess-blocked','accountant','active');
      INSERT INTO taxguard_identities(tenant_id,uid,user_data) VALUES('tenantA','db-sess-blocked','{"id":"db-sess-blocked","tenantId":"tenantA","role":"accountant","status":"active"}'::jsonb);
      INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal)
      VALUES('tenantA','db-sess-blocked',repeat('e',64),${fresh},${live},'aal2');`);
    const lockHolder = conns[8];
    await lockHolder.query('BEGIN');
    try {
      await lockHolder.query("SELECT id FROM taxguard_sessions WHERE tenant_id='tenantA' AND uid='db-sess-blocked' FOR UPDATE");
      const retryCodes: string[] = [];
      let attempts = 0;
      const revoke = () => {
        attempts++;
        return conns[9].query('SELECT taxguard_admin_revoke_member_sessions($1,$2,$3,$4,$5) AS r',
          ['tenantA', 'db-sess-admin', 'd'.repeat(64), 'db-sess-blocked', 'administrative_review']);
      };
      await expect(withBoundedSessionRevocationRetry(revoke, { maxAttempts: 3, onRetry: code => retryCodes.push(code) }))
        .rejects.toMatchObject({ code: '55P03' });
      expect(attempts).toBe(3);
      expect(retryCodes).toEqual(['55P03', '55P03']);
      expect((await db.pool.query("SELECT revoked FROM taxguard_sessions WHERE uid='db-sess-blocked'")).rows[0].revoked).toBe(false);
      expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_audit_log
        WHERE action='STAFF_SESSIONS_REVOKED_BY_ADMIN' AND metadata->>'targetUid'='db-sess-blocked'`)).rows[0].n).toBe(0);
    } finally {
      await lockHolder.query('ROLLBACK');
    }

    const committed = await withBoundedSessionRevocationRetry(() => conns[9].query(
      'SELECT taxguard_admin_revoke_member_sessions($1,$2,$3,$4,$5) AS r',
      ['tenantA', 'db-sess-admin', 'd'.repeat(64), 'db-sess-blocked', 'administrative_review']));
    expect(committed.rows[0].r.revokedSessions).toBe(1);
    expect((await db.pool.query("SELECT revoked FROM taxguard_sessions WHERE uid='db-sess-blocked'")).rows[0].revoked).toBe(true);
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_audit_log
      WHERE action='STAFF_SESSIONS_REVOKED_BY_ADMIN' AND metadata->>'targetUid'='db-sess-blocked'
        AND (metadata->>'revokedSessions')::int=1`)).rows[0].n).toBe(1);
    await expect(db.pool.query('SELECT taxguard_list_own_sessions($1,$2,$3) AS r', ['tenantA', 'db-sess-blocked', 'e'.repeat(64)])).rejects.toThrow();
  });
});

describe('tenant isolation over real connections', () => {
  it('a foreign-tenant manager reaches none of tenant A through any store', async () => {
    const rpc = pgRpc(conns[0]);
    await expect(new SqlLedgerStore(rpc).read(A, 'db-foreign', 2025)).rejects.toHaveProperty('code');
    await expect(new BillingStore(rpc).list('tenantA', 'dbBill', 'db-foreign')).rejects.toHaveProperty('code');
    await expect(new PracticeStore(rpc).clientDetail('tenantA', 'dbBill', 'db-foreign')).rejects.toHaveProperty('code');
    await expect(new SqlLedgerStore(rpc).read({ tenantId: 'tenantB', clientId: 'dbLedger' }, 'db-foreign', 2025)).rejects.toHaveProperty('code');
  });
});
