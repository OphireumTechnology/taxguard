import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../server/db';

const FIXED_NOW = Date.parse('2026-10-04T05:00:00.000Z');
const state = vi.hoisted(() => ({
  users: new Map<string, any>()
}));

vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return {
    ...actual,
    authenticateToken: (req: any, res: any, next: any) => {
      const user = state.users.get(req.get('x-test-user'));
      if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      req.user = user;
      next();
    }
  };
});

import { documentsRouter } from '../server/routes/documents.routes';

let server: Server;
let origin: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/documents', documentsRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const addClient = (id: string, tenantId = 'tenant-list-a') => {
  db.users.set(id, {
    id,
    clientId: id,
    tenantId,
    role: 'client',
    name: id
  } as any);
};

const addDocument = (id: string, clientId: string, taxYear = 2025) => {
  db.documents.set(id, {
    id,
    clientId,
    clientName: clientId,
    fileName: `${id}.pdf`,
    fileSize: '1 KB',
    fileType: 'application/pdf',
    category: 'tax_return',
    taxYear,
    status: 'uploaded',
    uploadedAt: new Date(FIXED_NOW).toISOString(),
    uploadedBy: 'test',
    version: 1,
    isEncrypted: true
  } as any);
};

const addAssignment = (
  id: string,
  clientId: string,
  fields: Record<string, unknown> = {}
) => {
  db.clientAccountantAssignments.set(id, {
    id,
    clientId,
    clientName: clientId,
    accountantId: 'list-staff',
    accountantName: 'List Staff',
    assignmentType: 'primary',
    status: 'active',
    accessScope: [],
    assignedBy: 'list-admin',
    assignedByName: 'List Admin',
    assignedAt: new Date(FIXED_NOW).toISOString(),
    effectiveDate: new Date(FIXED_NOW - 1).toISOString(),
    ...fields
  } as any);
};

const list = async (userId: string, query = '') => {
  const response = await fetch(`${origin}/api/documents${query}`, {
    headers: { 'x-test-user': userId }
  });
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('TAXGUARD_TENANT_ID', 'tenant-list-a');
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  addClient('list-client-a');
  addClient('list-client-b');
  addClient('list-client-other', 'tenant-list-b');
  addDocument('list-doc-a', 'list-client-a');
  addDocument('list-doc-b', 'list-client-b');
  addDocument('list-doc-other', 'list-client-other');
  state.users.set('list-staff', {
    id: 'list-staff',
    role: 'accountant',
    tenantId: 'tenant-list-a',
    name: 'List Staff'
  });
  state.users.set('list-admin-a', {
    id: 'list-admin-a',
    role: 'admin',
    tenantId: 'tenant-list-a',
    name: 'Tenant A Admin'
  });
  state.users.set('list-admin-b', {
    id: 'list-admin-b',
    role: 'admin',
    tenantId: 'tenant-list-b',
    name: 'Tenant B Admin'
  });
});

afterEach(() => {
  for (const id of ['list-client-a', 'list-client-b', 'list-client-other']) db.users.delete(id);
  for (const id of ['list-doc-a', 'list-doc-b', 'list-doc-other']) db.documents.delete(id);
  for (const id of Array.from(db.clientAccountantAssignments.keys())) {
    if (id.startsWith('list-assignment-')) db.clientAccountantAssignments.delete(id);
  }
  for (const id of ['list-staff', 'list-admin-a', 'list-admin-b']) state.users.delete(id);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('lists documents for a current active assignment', async () => {
  addAssignment('list-assignment-current', 'list-client-a');
  const result = await list('list-staff', '?clientId=list-client-b');
  expect(result.status).toBe(200);
  expect(result.body.documents.map((doc: any) => doc.id)).toEqual(['list-doc-a']);
});

it('allows an assignment at its inclusive effective-start boundary', async () => {
  addAssignment('list-assignment-start-boundary', 'list-client-a', {
    effectiveDate: new Date(FIXED_NOW).toISOString()
  });
  const result = await list('list-staff');
  expect(result.body.documents.map((doc: any) => doc.id)).toEqual(['list-doc-a']);
});

it.each([
  ['future', { effectiveDate: new Date(FIXED_NOW + 1).toISOString() }],
  ['expired', { expirationDate: new Date(FIXED_NOW).toISOString() }],
  ['inactive', { status: 'INACTIVE' }],
  ['revoked', { status: 'REVOKED' }]
])('denies document listing for %s assignment', async (_name, fields) => {
  addAssignment(`list-assignment-${_name}`, 'list-client-a', fields);
  const result = await list('list-staff');
  expect(result.status).toBe(200);
  expect(result.body.documents).toEqual([]);
});

it('lists only the client actually covered by the assignment', async () => {
  addAssignment('list-assignment-wrong-client', 'list-client-b');
  const result = await list('list-staff');
  expect(result.body.documents.map((doc: any) => doc.id)).toEqual(['list-doc-b']);
  expect(result.body.documents.map((doc: any) => doc.id)).not.toContain('list-doc-a');
});

it('does not allow a cross-tenant client assignment to reveal that tenant documents', async () => {
  addAssignment('list-assignment-cross-tenant', 'list-client-other');
  const result = await list('list-staff');
  expect(result.body.documents).toEqual([]);
});

it('denies listing when no assignment exists', async () => {
  const result = await list('list-staff');
  expect(result.body.documents).toEqual([]);
});

it('does not use a case-scoped assignment for an unscoped document list', async () => {
  addAssignment('list-assignment-case', 'list-client-a', { caseId: 'case-other' });
  const result = await list('list-staff');
  expect(result.body.documents).toEqual([]);
});

it('preserves tenant-limited administrator access', async () => {
  const allowed = await list('list-admin-a');
  expect(allowed.status).toBe(200);
  expect(allowed.body.documents.map((doc: any) => doc.id).sort()).toEqual(['list-doc-a', 'list-doc-b']);

  const denied = await list('list-admin-a', '?clientId=list-client-other');
  expect(denied.body.documents).toEqual([]);
  const otherTenantAdmin = await list('list-admin-b');
  expect(otherTenantAdmin.body.documents.map((doc: any) => doc.id)).toEqual(['list-doc-other']);
});

it('fails closed for document listing in production while records are only in memory', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  addAssignment('list-assignment-prod', 'list-client-a');
  const result = await list('list-staff');
  expect(result.status).toBe(503);
  expect(result.body.documents).toBeUndefined();
});

it('blocks legacy single and batch uploads in production before accepting synthetic content', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const documentCount = db.documents.size;
  const single = await fetch(`${origin}/api/documents/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': 'list-staff' },
    body: JSON.stringify({
      fileName: 'synthetic.pdf',
      fileType: 'application/pdf',
      rawContentSample: 'fabricated taxpayer evidence'
    })
  });
  expect(single.status).toBe(503);
  expect((await single.json()).code).toBe('DOCUMENT_INTAKE_NOT_READY');
  expect(db.documents.size).toBe(documentCount);

  const batch = await fetch(`${origin}/api/documents/upload-batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': 'list-staff' },
    body: JSON.stringify({
      files: [{ fileName: 'synthetic.pdf', rawContentSample: 'fabricated taxpayer evidence' }]
    })
  });
  expect(batch.status).toBe(503);
  expect(db.documents.size).toBe(documentCount);
});
