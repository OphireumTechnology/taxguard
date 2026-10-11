import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';

/** Controlled reversing-entry workflow for posted staging records. Synthetic data only. */
const state = vi.hoisted(() => ({ users: new Map<string, any>() }));
vi.mock('../server/auth', async original => ({
  ...await original<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => {
    const user = state.users.get(req.get('x-test-user'));
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = user; next();
  },
}));
import { stagingRouter } from '../server/routes/staging.routes';

let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/staging', stagingRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const past = new Date(Date.now() - 86_400_000).toISOString();
const u = (id: string, role: string, tenantId: string, extra: Record<string, unknown> = {}) => ({ id, name: id, role, status: 'active', tenantId, ...extra });
const people = {
  accountant: u('rv-accountant', 'accountant', 'tenant-rv-a'),
  senior: u('rv-senior', 'senior_reviewer', 'tenant-rv-a'),
  seniorUnassigned: u('rv-senior-unassigned', 'senior_reviewer', 'tenant-rv-a'),
  adminA: u('rv-admin-a', 'administrator', 'tenant-rv-a'),
  adminB: u('rv-admin-b', 'administrator', 'tenant-rv-b'),
  client: u('rv-client', 'client', 'tenant-rv-a', { clientId: 'rv-client' }),
};
type Who = keyof typeof people;
const post = async (path: string, who: Who, body: unknown = {}) => {
  const r = await fetch(`${origin}/api/staging${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': people[who].id }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const assign = (id: string) => db.clientAccountantAssignments.set(`rv-asg-${id}`, { id: `rv-asg-${id}`, clientId: 'rv-client', clientName: 'c', accountantId: id, accountantName: id, assignmentType: 'primary', status: 'active', accessScope: [], assignedBy: 'x', assignedByName: 'x', assignedAt: past, effectiveDate: past } as any);
const reason = 'Posted to the wrong expense account (synthetic)';
const txFor = () => Array.from(db.bookkeepingTransactions.values()).filter(t => t.clientId === 'rv-client');
const signed = (t: any) => (t.type === 'debit' ? t.amount : -t.amount);

/** Approves and posts the staging record, returning the created ledger transaction id. */
async function postRecord(): Promise<string> {
  expect((await post('/records/rv-rec/approve', 'accountant')).status).toBe(200);
  const r = await post('/records/rv-rec/post', 'accountant');
  expect(r.status).toBe(200);
  return r.body.transactionId;
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const p of Object.values(people)) { state.users.set(p.id, p); db.users.set(p.id, { ...p } as any); }
  assign('rv-accountant'); assign('rv-senior');
  db.accountingStagingRecords.set('rv-rec', { id: 'rv-rec', clientId: 'rv-client', clientName: 'Client', status: 'needs_review', recordType: 'expense', date: '2025-12-15', period: '2025-12',
    description: 'Synthetic office supplies', amount: 125.5, debitAmount: 125.5, creditAmount: 0, suggestedAccountCode: '6000', suggestedAccountName: 'Office', confidenceScore: 90,
    aiModelVersion: 'synthetic', sourceDocumentId: 'doc', sourceDocumentName: 'synthetic.pdf', sourcePageNumber: 1, isDuplicateFlag: false, auditTrail: [] } as any);
});
afterEach(() => {
  vi.unstubAllEnvs(); state.users.clear();
  for (const p of Object.values(people)) db.users.delete(p.id);
  for (const id of Array.from(db.clientAccountantAssignments.keys())) if (id.startsWith('rv-asg-')) db.clientAccountantAssignments.delete(id);
  db.accountingStagingRecords.delete('rv-rec');
  for (const t of txFor()) db.bookkeepingTransactions.delete(t.id);
});

describe('happy path', () => {
  it('request then independent approval creates an offsetting entry and preserves the original', async () => {
    const txId = await postRecord();
    expect(db.accountingStagingRecords.get('rv-rec')?.postedTransactionId).toBe(txId);
    const originalBefore = { ...db.bookkeepingTransactions.get(txId)! };

    const req = await post('/records/rv-rec/reversal/request', 'accountant', { reason });
    expect(req.status).toBe(202);
    expect(db.accountingStagingRecords.get('rv-rec')?.status).toBe('posted');

    const approve = await post('/records/rv-rec/reversal/approve', 'senior');
    expect(approve.status).toBe(200);
    const reversing = db.bookkeepingTransactions.get(approve.body.reversingTransactionId)!;
    expect(reversing).toMatchObject({ amount: originalBefore.amount, type: 'credit', reversesTransactionId: txId, status: 'confirmed' });

    // Original ledger history preserved: amount, type, date, status, description unchanged; only a link added.
    const originalAfter = db.bookkeepingTransactions.get(txId)!;
    const { reversedByTransactionId, ...rest } = originalAfter as any;
    expect(rest).toEqual(originalBefore);
    expect(reversedByTransactionId).toBe(reversing.id);
    expect(txFor().reduce((sum, t) => sum + signed(t), 0)).toBeCloseTo(0, 8);

    const record = db.accountingStagingRecords.get('rv-rec')!;
    expect(record).toMatchObject({ status: 'needs_review', postedTransactionId: undefined, reversalRequest: undefined });
    expect(record.reversals).toEqual([expect.objectContaining({ originalTransactionId: txId, reversingTransactionId: reversing.id, requestedBy: 'rv-accountant', approvedBy: 'rv-senior', reason })]);
    expect(record.auditTrail.map(e => e.action)).toEqual(expect.arrayContaining(['POSTED_TO_LEDGER', 'REVERSAL_REQUESTED', 'REVERSAL_APPROVED']));
  });

  it('the corrected record can be re-posted and reversed again, each reversal tied to its own posting', async () => {
    const first = await postRecord();
    await post('/records/rv-rec/reversal/request', 'accountant', { reason });
    await post('/records/rv-rec/reversal/approve', 'senior');
    const second = await postRecord();
    expect(second).not.toBe(first);
    await post('/records/rv-rec/reversal/request', 'accountant', { reason });
    expect((await post('/records/rv-rec/reversal/approve', 'adminA')).status).toBe(200);
    expect(db.accountingStagingRecords.get('rv-rec')?.reversals?.map(r => r.originalTransactionId)).toEqual([first, second]);
    expect(txFor().reduce((sum, t) => sum + signed(t), 0)).toBeCloseTo(0, 8);
  });

  it('rejection clears the request and leaves the posting untouched', async () => {
    const txId = await postRecord();
    await post('/records/rv-rec/reversal/request', 'accountant', { reason });
    expect((await post('/records/rv-rec/reversal/reject', 'senior', { notes: 'Not needed' })).status).toBe(200);
    expect(db.accountingStagingRecords.get('rv-rec')).toMatchObject({ status: 'posted', postedTransactionId: txId, reversalRequest: undefined });
    expect(txFor()).toHaveLength(1);
  });

  it('resolves the original transaction for legacy records posted before the explicit link existed', async () => {
    const txId = await postRecord();
    delete db.accountingStagingRecords.get('rv-rec')!.postedTransactionId;
    expect((await post('/records/rv-rec/reversal/request', 'accountant', { reason })).body.reversalRequest.originalTransactionId).toBe(txId);
  });
});

describe('human authorization controls', () => {
  it('the requester cannot approve or reject their own request (maker-checker)', async () => {
    await postRecord();
    await post('/records/rv-rec/reversal/request', 'adminA', { reason });
    for (const action of ['approve', 'reject']) {
      const r = await post(`/records/rv-rec/reversal/${action}`, 'adminA');
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('MAKER_CHECKER_VIOLATION');
    }
    expect(txFor()).toHaveLength(1);
  });
  it.each(['accountant', 'client'] as const)('%s cannot approve (role)', async who => {
    await postRecord();
    await post('/records/rv-rec/reversal/request', 'accountant', { reason });
    expect((await post('/records/rv-rec/reversal/approve', who)).status).toBe(403);
    expect(txFor()).toHaveLength(1);
  });
  it.each(['seniorUnassigned', 'adminB'] as const)('%s (unassigned / other tenant) cannot approve', async who => {
    await postRecord();
    await post('/records/rv-rec/reversal/request', 'accountant', { reason });
    expect((await post('/records/rv-rec/reversal/approve', who)).status).toBe(404);
    expect(db.accountingStagingRecords.get('rv-rec')?.reversalRequest).toBeDefined();
  });
  it.each([['client', 403], ['adminB', 404]] as const)('%s cannot request a reversal', async (who, status) => {
    await postRecord();
    expect((await post('/records/rv-rec/reversal/request', who, { reason })).status).toBe(status);
    expect(db.accountingStagingRecords.get('rv-rec')?.reversalRequest).toBeUndefined();
  });
});

describe('state and input guards', () => {
  it.each([[{}], [{ reason: 'short' }], [{ reason: 'x'.repeat(1001) }], [{ reason: 42 }]])('rejects invalid reason %j', async body => {
    await postRecord();
    expect((await post('/records/rv-rec/reversal/request', 'accountant', body)).status).toBe(400);
  });
  it('rejects a second pending request', async () => {
    await postRecord();
    await post('/records/rv-rec/reversal/request', 'accountant', { reason });
    expect((await post('/records/rv-rec/reversal/request', 'accountant', { reason })).body.code).toBe('REVERSAL_ALREADY_PENDING');
  });
  it.each([['needs_review', 409, 'NOT_POSTED'], ['locked', 400, 'PERIOD_LOCKED'], ['reconciled', 409, 'RECONCILED_RECORD']] as const)('refuses records in %s', async (status, http, code) => {
    db.accountingStagingRecords.get('rv-rec')!.status = status as any;
    const r = await post('/records/rv-rec/reversal/request', 'accountant', { reason });
    expect(r.status).toBe(http);
    expect(r.body.code).toBe(code);
  });
  it('re-checks state at approval: a period locked after the request blocks the reversal', async () => {
    await postRecord();
    await post('/records/rv-rec/reversal/request', 'accountant', { reason });
    db.accountingStagingRecords.get('rv-rec')!.status = 'locked';
    expect((await post('/records/rv-rec/reversal/approve', 'senior')).body.code).toBe('PERIOD_LOCKED');
    expect(txFor()).toHaveLength(1);
  });
  it('refuses when the original transaction cannot be identified', async () => {
    await postRecord();
    const rec = db.accountingStagingRecords.get('rv-rec')!;
    delete rec.postedTransactionId; rec.auditTrail = [];
    expect((await post('/records/rv-rec/reversal/request', 'accountant', { reason })).body.code).toBe('ORIGINAL_TRANSACTION_UNRESOLVED');
  });
  it('approval without a pending request is refused', async () => {
    await postRecord();
    expect((await post('/records/rv-rec/reversal/approve', 'senior')).body.code).toBe('NO_PENDING_REVERSAL');
  });
  it('plain rollback of a posted record still points to the reversal workflow', async () => {
    await postRecord();
    const r = await post('/records/rv-rec/rollback', 'accountant');
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/reversal\/request/);
  });
});
