import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../server/db';

const state = vi.hoisted(() => ({
  users: {
    'client-a': { id: 'uid-a', role: 'client', clientId: 'client-a', tenantId: 'tenantA', name: 'Client A' },
    'client-b': { id: 'uid-b', role: 'client', clientId: 'client-b', tenantId: 'tenantA', name: 'Client B' }
  } as Record<string, any>
}));

vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return {
    ...actual,
    authenticateToken: (req: any, res: any, next: any) => {
      const user = state.users[req.get('x-test-user')];
      if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      req.user = user;
      next();
    }
  };
});

import { documentsRouter } from '../server/routes/documents.routes';
import { engagementsRouter } from '../server/routes/engagements.routes';

let server: Server;
let origin: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/documents', documentsRouter);
  app.use('/api/engagements', engagementsRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

beforeEach(() => {
  db.documents.set('isolation-doc-a', {
    id: 'isolation-doc-a',
    clientId: 'client-a',
    clientName: 'Client A',
    fileName: 'a.pdf',
    fileSize: '1 KB',
    fileType: 'application/pdf',
    category: 'tax_return',
    taxYear: 2025,
    status: 'verified',
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'uid-a',
    version: 1,
    description: 'Client A document',
    isEncrypted: true
  } as any);
  db.documents.set('isolation-doc-b', {
    id: 'isolation-doc-b',
    clientId: 'client-b',
    clientName: 'Client B',
    fileName: 'b.pdf',
    fileSize: '1 KB',
    fileType: 'application/pdf',
    category: 'tax_return',
    taxYear: 2025,
    status: 'verified',
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'uid-b',
    version: 1,
    description: 'Client B document',
    isEncrypted: true
  } as any);
  db.engagements.set('isolation-eng-a', {
    id: 'isolation-eng-a', clientId: 'client-a', clientName: 'Client A', status: 'active'
  } as any);
  db.engagements.set('isolation-eng-b', {
    id: 'isolation-eng-b', clientId: 'client-b', clientName: 'Client B', status: 'active'
  } as any);
});

const asClientA = { headers: { 'x-test-user': 'client-a' } };

it('SEC-CLIENT-003: denies direct document detail and signed-URL access to Client B documents', async () => {
  const detail = await fetch(`${origin}/api/documents/isolation-doc-b`, asClientA);
  expect(detail.status).toBe(403);
  expect(await detail.text()).not.toContain('Client B');

  const signedUrl = await fetch(`${origin}/api/documents/isolation-doc-b/signed-url`, {
    ...asClientA,
    method: 'POST'
  });
  expect(signedUrl.status).toBe(403);
  expect(await signedUrl.text()).not.toContain('Client B');
});

it('SEC-CLIENT-004: denies direct engagement detail and list selection for Client B', async () => {
  const detail = await fetch(`${origin}/api/engagements/isolation-eng-b`, asClientA);
  expect(detail.status).toBe(403);
  expect(await detail.text()).not.toContain('Client B');

  const list = await fetch(`${origin}/api/engagements?clientId=client-b`, asClientA);
  expect(list.status).toBe(403);
  expect(await list.text()).not.toContain('Client B');
});

it('returns only Client A records from unmodified document and engagement list requests', async () => {
  const documents = await fetch(`${origin}/api/documents`, asClientA);
  expect(documents.status).toBe(200);
  const documentBody = await documents.json();
  expect(documentBody.documents.map((item: any) => item.id)).toContain('isolation-doc-a');
  expect(documentBody.documents.map((item: any) => item.id)).not.toContain('isolation-doc-b');

  const engagements = await fetch(`${origin}/api/engagements`, asClientA);
  expect(engagements.status).toBe(200);
  const engagementBody = await engagements.json();
  expect(engagementBody.engagements.map((item: any) => item.id)).toContain('isolation-eng-a');
  expect(engagementBody.engagements.map((item: any) => item.id)).not.toContain('isolation-eng-b');
});
