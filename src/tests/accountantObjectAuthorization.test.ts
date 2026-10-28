import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';

/**
 * Object-level authorization for accountant routes that load a record by ID.
 * Two synthetic tenants; assignments come from db.clientAccountantAssignments (non-production).
 */
const state = vi.hoisted(() => ({ users: new Map<string, any>() }));
vi.mock('../server/auth', async original => ({
  ...await original<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => {
    const user = state.users.get(req.get('x-test-user'));
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = user; next();
  },
}));
import { accountantRouter } from '../server/routes/accountant.routes';

let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/accountant', accountantRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const past = new Date(Date.now() - 86_400_000).toISOString();
const staff = (id: string, role: string, tenantId: string) => ({ id, name: id, role, status: 'active', tenantId });
const people = {
  preparer: staff('oa-preparer', 'accountant', 'tenant-oa'),          // assigned to oa-client-1, prepared the records
  unassigned: staff('oa-unassigned', 'accountant', 'tenant-oa'),      // same tenant, not assigned
  senior: staff('oa-senior', 'senior_reviewer', 'tenant-oa'),         // same tenant, assigned
  seniorOther: staff('ob-senior', 'senior_reviewer', 'tenant-ob'),    // other tenant, assigned to its own client
  adminOther: staff('ob-admin', 'admin', 'tenant-ob'),                // other tenant administrator
  adminSame: staff('oa-admin', 'admin', 'tenant-oa'),
};
const assign = (accountantId: string, clientId: string) => db.clientAccountantAssignments.set(`oa-asg-${accountantId}-${clientId}`, {
  id: `oa-asg-${accountantId}-${clientId}`, clientId, clientName: clientId, accountantId, accountantName: accountantId, assignmentType: 'primary',
  status: 'active', accessScope: [], assignedBy: 'admin', assignedByName: 'Admin', assignedAt: past, effectiveDate: past,
} as any);
const post = async (path: string, user: keyof typeof people, body: unknown = {}) => {
  const r = await fetch(`${origin}/api/accountant${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': people[user].id }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const p of Object.values(people)) state.users.set(p.id, p);
  db.users.set('oa-client-1', { id: 'oa-client-1', clientId: 'oa-client-1', name: 'Client 1', role: 'client', tenantId: 'tenant-oa' } as any);
  db.users.set('ob-client-1', { id: 'ob-client-1', clientId: 'ob-client-1', name: 'Client B', role: 'client', tenantId: 'tenant-ob' } as any);
  assign('oa-preparer', 'oa-client-1'); assign('oa-senior', 'oa-client-1'); assign('ob-senior', 'ob-client-1');
  db.accountingTasks.set('oa-task', { id: 'oa-task', clientId: 'oa-client-1', clientName: 'Client 1', title: 'Synthetic task', status: 'ready_for_review', assignedAccountantId: 'oa-preparer', approvalHistory: [], comments: [], updatedAt: past } as any);
  db.bankReconciliations.set('oa-rec', { id: 'oa-rec', clientId: 'oa-client-1', accountName: 'Operating', accountNumber: 'x0000', periodStart: past, periodEnd: past, variance: 0, status: 'ready_for_review', preparedBy: 'oa-preparer', isPeriodLocked: false } as any);
  db.journalEntries.set('oa-je', { id: 'oa-je', engagementId: 'oa-eng', clientId: 'oa-client-1', date: past, reference: 'JE-SYN-1', memo: 'Synthetic', lines: [], status: 'pending_review', preparedBy: 'oa-preparer', updatedAt: past } as any);
  db.journalEntries.set('oa-je-approved', { id: 'oa-je-approved', engagementId: 'oa-eng', clientId: 'oa-client-1', date: past, reference: 'JE-SYN-2', memo: 'Synthetic', lines: [], status: 'approved', preparedBy: 'oa-preparer', updatedAt: past } as any);
});
afterEach(() => {
  vi.unstubAllEnvs();
  state.users.clear();
  for (const id of ['oa-client-1', 'ob-client-1']) db.users.delete(id);
  for (const id of Array.from(db.clientAccountantAssignments.keys())) if (id.startsWith('oa-asg-')) db.clientAccountantAssignments.delete(id);
  db.accountingTasks.delete('oa-task'); db.bankReconciliations.delete('oa-rec'); db.journalEntries.delete('oa-je'); db.journalEntries.delete('oa-je-approved');
});

describe('POST /tasks/:taskId/review', () => {
  it.each(['unassigned', 'adminOther', 'seniorOther'] as const)('denies %s and leaves the task unchanged', async who => {
    const r = await post('/tasks/oa-task/review', who, { action: 'approved' });
    expect(r.status).toBe(403);
    expect(db.accountingTasks.get('oa-task')).toMatchObject({ status: 'ready_for_review', approvalHistory: [] });
  });
  it('allows an assigned independent reviewer', async () => {
    expect((await post('/tasks/oa-task/review', 'senior', { action: 'approved' })).status).toBe(200);
    expect(db.accountingTasks.get('oa-task')?.status).toBe('approved');
  });
  it('still blocks the preparer approving their own task (maker-checker)', async () => {
    expect((await post('/tasks/oa-task/review', 'preparer', { action: 'approved' })).status).toBe(403);
  });
  it.each([{}, { action: 'APPROVE_ALL' }, { action: 42 }])('rejects invalid action %j instead of crashing or defaulting', async body => {
    const r = await post('/tasks/oa-task/review', 'senior', body);
    expect(r.status).toBe(400);
    expect(db.accountingTasks.get('oa-task')?.status).toBe('ready_for_review');
  });
});

describe('POST /reconciliations/:id/sign-off and /lock', () => {
  it.each(['seniorOther', 'adminOther'] as const)('sign-off denied for %s', async who => {
    expect((await post('/reconciliations/oa-rec/sign-off', who)).status).toBe(403);
    expect(db.bankReconciliations.get('oa-rec')?.status).toBe('ready_for_review');
  });
  it('sign-off allowed for an assigned independent senior reviewer', async () => {
    expect((await post('/reconciliations/oa-rec/sign-off', 'senior')).status).toBe(200);
    expect(db.bankReconciliations.get('oa-rec')).toMatchObject({ status: 'signed_off', isPeriodLocked: true });
  });
  it.each(['unassigned', 'adminOther', 'seniorOther'] as const)('lock/unlock denied for %s (no client access)', async who => {
    db.bankReconciliations.get('oa-rec')!.isPeriodLocked = true;
    expect((await post('/reconciliations/oa-rec/lock', who, { isLocked: false })).status).toBe(403);
    expect(db.bankReconciliations.get('oa-rec')?.isPeriodLocked).toBe(true);
  });
  it('an assigned staff accountant cannot unlock a period (requires sign-off authority)', async () => {
    db.bankReconciliations.get('oa-rec')!.isPeriodLocked = true;
    expect((await post('/reconciliations/oa-rec/lock', 'preparer', { isLocked: false })).status).toBe(403);
    expect(db.bankReconciliations.get('oa-rec')?.isPeriodLocked).toBe(true);
  });
  it('an assigned senior reviewer may change the lock with an explicit boolean', async () => {
    expect((await post('/reconciliations/oa-rec/lock', 'senior', { isLocked: true })).status).toBe(200);
    expect(db.bankReconciliations.get('oa-rec')?.isPeriodLocked).toBe(true);
    expect((await post('/reconciliations/oa-rec/lock', 'senior', { isLocked: 'false' })).status).toBe(400);
    expect(db.bankReconciliations.get('oa-rec')?.isPeriodLocked).toBe(true);
  });
});

describe('POST /documents/upload-deliverable', () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('synthetic deliverable body')]).toString('base64');
  const deliverablesFor = (clientId: string) => Array.from(db.documents.values()).filter(d => d.clientId === clientId && d.id.startsWith('doc_deliv_'));
  afterEach(() => { for (const d of deliverablesFor('oa-client-1')) db.documents.delete(d.id); });
  const base = { clientId: 'oa-client-1', fileName: 'Engagement_Letter_2025.pdf', fileType: 'application/pdf', taxYear: 2025 };

  it('stores a validated deliverable with real byte size, pending review (not auto-verified)', async () => {
    const r = await post('/documents/upload-deliverable', 'preparer', { ...base, fileBase64: pdf });
    expect(r.status).toBe(201);
    expect(r.body.document).toMatchObject({ fileType: 'application/pdf', taxYear: 2025, status: 'pending_review', fileSize: '1 KB' });
    expect(r.body.document.url).toContain(encodeURIComponent('Engagement_Letter_2025.pdf'));
  });
  it.each([
    [{ ...base, fileBase64: Buffer.from('MZ\x90\x00not a pdf').toString('base64') }, 'FILE_SIGNATURE_MISMATCH'],
    [{ ...base, fileType: 'image/png', fileName: 'scan.png', fileBase64: pdf }, 'FILE_SIGNATURE_MISMATCH'],
    [{ ...base, fileBase64: 'not*base64!' }, 'FILE_CONTENT_INVALID'],
    [{ ...base, fileName: 'invoice.pdf.exe', fileSize: 10 }, 'FILE_SUSPICIOUS'],
    [{ ...base, fileType: undefined, fileSize: 10 }, 'FILE_TYPE_UNSUPPORTED'],
    [{ ...base }, 'FILE_SIZE_REQUIRED'],
    [{ ...base, fileSize: 10, taxYear: undefined }, 'TAX_YEAR_INVALID'],
  ])('rejects %#: %s, storing nothing', async (body, code) => {
    const r = await post('/documents/upload-deliverable', 'preparer', body);
    expect(r.status).toBe(400);
    expect(r.body.code).toBe(code);
    expect(deliverablesFor('oa-client-1')).toHaveLength(0);
  });
  it.each(['unassigned', 'adminOther', 'seniorOther'] as const)('denies %s (assignment / tenant) without storing', async who => {
    const r = await post('/documents/upload-deliverable', who, { ...base, fileBase64: pdf });
    expect(r.status).toBe(403);
    expect(deliverablesFor('oa-client-1')).toHaveLength(0);
  });
  it('in production, an unassigned caller is denied first, and an assigned one gets 503 (no durable vault)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await post('/documents/upload-deliverable', 'preparer', { ...base, fileBase64: pdf })).status).toBe(403);
    // Production also requires the session tenant to equal the deployment's pinned tenant.
    vi.stubEnv('TAXGUARD_TENANT_ID', 'tenant-oa');
    state.users.set(people.preparer.id, { ...people.preparer, authorizedClientIds: ['oa-client-1'] });
    const r = await post('/documents/upload-deliverable', 'preparer', { ...base, fileBase64: pdf });
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('DOCUMENT_INTAKE_NOT_READY');
    expect(deliverablesFor('oa-client-1')).toHaveLength(0);
  });
});

describe('POST /ai-tax-assistant', () => {
  it('returns an explicit unavailable response instead of a fabricated canned answer, and does not log the query text', async () => {
    const spy = vi.spyOn(db, 'logAudit');
    const r = await post('/ai-tax-assistant', 'preparer', { query: 'Synthetic client SSN 000-00-0000 question about home office' });
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('AI_TAX_ASSISTANT_UNAVAILABLE');
    expect(r.body).not.toHaveProperty('answer');
    expect(JSON.stringify(r.body)).not.toMatch(/IRC|§162|Rev\. Rul|S-Corporation/);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('home office');
    spy.mockRestore();
  });
  it('still validates the query', async () => {
    expect((await post('/ai-tax-assistant', 'preparer', {})).status).toBe(400);
  });
});

describe('POST /journal-entries/:id/review and /post', () => {
  it.each(['seniorOther', 'adminOther'] as const)('review denied for %s', async who => {
    expect((await post('/journal-entries/oa-je/review', who, { action: 'approve' })).status).toBe(403);
    expect(db.journalEntries.get('oa-je')?.status).toBe('pending_review');
  });
  it('review allowed for an assigned independent senior reviewer', async () => {
    expect((await post('/journal-entries/oa-je/review', 'senior', { action: 'approve' })).status).toBe(200);
  });
  it.each(['unassigned', 'adminOther', 'seniorOther'] as const)('posting to the ledger denied for %s', async who => {
    expect((await post('/journal-entries/oa-je-approved/post', who)).status).toBe(403);
    expect(db.journalEntries.get('oa-je-approved')?.status).toBe('approved');
  });
  it('posting allowed for assigned staff in the same tenant', async () => {
    expect((await post('/journal-entries/oa-je-approved/post', 'preparer')).status).toBe(200);
    expect(db.journalEntries.get('oa-je-approved')?.status).toBe('posted');
  });
});
