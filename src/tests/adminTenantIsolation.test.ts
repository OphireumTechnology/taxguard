import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../server/db';

const state = vi.hoisted(() => ({ users: new Map<string, any>() }));

vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return {
    ...actual,
    authenticateToken: (req: any, res: any, next: any) => {
      const user = state.users.get(req.get('x-test-admin'));
      if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      req.user = user;
      next();
    }
  };
});

import { adminRouter } from '../server/routes/admin.routes';

let server: Server;
let origin: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', adminRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

beforeEach(() => {
  for (const id of ['admin-tenant-a', 'staff-tenant-a', 'client-tenant-a', 'admin-tenant-b', 'staff-tenant-b', 'client-tenant-b']) {
    db.users.delete(id);
  }
  for (const id of ['engagement-tenant-a', 'engagement-tenant-b']) db.engagements.delete(id);
  for (const id of ['document-tenant-a', 'document-tenant-b']) db.documents.delete(id);
  state.users.clear();

  for (const user of [
    { id: 'admin-tenant-a', tenantId: 'tenant-a', role: 'admin', status: 'active' },
    { id: 'staff-tenant-a', tenantId: 'tenant-a', role: 'accountant', status: 'active' },
    { id: 'client-tenant-a', tenantId: 'tenant-a', role: 'client', status: 'active' },
    { id: 'admin-tenant-b', tenantId: 'tenant-b', role: 'admin', status: 'active' },
    { id: 'staff-tenant-b', tenantId: 'tenant-b', role: 'accountant', status: 'active' },
    { id: 'client-tenant-b', tenantId: 'tenant-b', role: 'client', status: 'active' }
  ]) {
    db.users.set(user.id, user as any);
  }
  state.users.set('tenant-a-admin', db.users.get('admin-tenant-a'));
});

const get = (path: string) => fetch(`${origin}/api${path}`, { headers: { 'x-test-admin': 'tenant-a-admin' } });

it('limits user, health, engagement, and document summaries to the admin tenant', async () => {
  db.engagements.set('engagement-tenant-a', { id: 'engagement-tenant-a', clientId: 'client-tenant-a', status: 'active' } as any);
  db.engagements.set('engagement-tenant-b', { id: 'engagement-tenant-b', clientId: 'client-tenant-b', status: 'active' } as any);
  db.documents.set('document-tenant-a', { id: 'document-tenant-a', clientId: 'client-tenant-a' } as any);
  db.documents.set('document-tenant-b', { id: 'document-tenant-b', clientId: 'client-tenant-b' } as any);

  const usersResponse = await get('/users');
  expect(usersResponse.status).toBe(200);
  const users = await usersResponse.json();
  expect(users.users.map((user: any) => user.id)).toEqual(['admin-tenant-a', 'staff-tenant-a', 'client-tenant-a']);

  const healthResponse = await get('/system-health');
  expect(healthResponse.status).toBe(200);
  const health = await healthResponse.json();
  expect(health.metrics.totalClients).toBe(1);
  expect(health.metrics.activeEngagements).toBe(1);
  expect(health.metrics.totalDocumentsSecured).toBe(1);
});

it('denies cross-tenant user status and client reassignment changes', async () => {
  const status = await fetch(`${origin}/api/users/staff-tenant-b/status`, {
    method: 'PATCH',
    headers: { 'x-test-admin': 'tenant-a-admin', 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'disabled', reason: 'security action', confirmation: true })
  });
  expect(status.status).toBe(404);
  expect(db.users.get('staff-tenant-b')?.status).toBe('active');

  const reassignment = await fetch(`${origin}/api/users/client-tenant-b/reassign`, {
    method: 'PATCH',
    headers: { 'x-test-admin': 'tenant-a-admin', 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignedAccountantId: 'staff-tenant-a', reason: 'authorized reassignment' })
  });
  expect(reassignment.status).toBe(404);
  expect(db.users.get('client-tenant-b')?.assignedAccountantId).toBeUndefined();
});
