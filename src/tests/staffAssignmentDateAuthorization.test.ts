import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../server/db';

const FIXED_NOW = Date.parse('2026-10-04T06:00:00.000Z');
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

import { engagementsRouter } from '../server/routes/engagements.routes';
import { practiceOperationsRouter } from '../server/routes/practice-operations.routes';
import { globalOperationalSearchService } from '../server/taxguard/operations/operationalSearch.service';

let server: Server;
let origin: string;
let searchSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/engagements', engagementsRouter);
  app.use('/api/practice', practiceOperationsRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const addClient = (id: string, tenantId = 'assign-tenant-a') => {
  db.users.set(id, { id, clientId: id, tenantId, role: 'client', name: id } as any);
};

const addAssignment = (id: string, clientId: string, fields: Record<string, unknown> = {}) => {
  db.clientAccountantAssignments.set(id, {
    id,
    clientId,
    clientName: clientId,
    accountantId: 'assign-staff',
    accountantName: 'Assigned Staff',
    assignmentType: 'primary',
    status: 'active',
    accessScope: [],
    assignedBy: 'assign-admin',
    assignedByName: 'Admin',
    assignedAt: new Date(FIXED_NOW).toISOString(),
    effectiveDate: new Date(FIXED_NOW - 1).toISOString(),
    ...fields
  } as any);
};

const get = async (path: string, userId: string) => {
  const response = await fetch(`${origin}${path}`, { headers: { 'x-test-user': userId } });
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('TAXGUARD_TENANT_ID', 'assign-tenant-a');
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  addClient('assign-client-a');
  addClient('assign-client-b');
  addClient('assign-client-other', 'assign-tenant-b');
  state.users.set('assign-staff', {
    id: 'assign-staff', role: 'accountant', tenantId: 'assign-tenant-a', name: 'Assigned Staff'
  });
  state.users.set('assign-admin-a', {
    id: 'assign-admin-a', role: 'admin', tenantId: 'assign-tenant-a', name: 'Tenant A Admin'
  });
  state.users.set('assign-admin-b', {
    id: 'assign-admin-b', role: 'admin', tenantId: 'assign-tenant-b', name: 'Tenant B Admin'
  });
  for (const [id, clientId, tenantId, status] of [
    ['assign-eng-a', 'assign-client-a', 'assign-tenant-a', 'active'],
    ['assign-eng-b', 'assign-client-b', 'assign-tenant-a', 'active'],
    ['assign-eng-other', 'assign-client-other', 'assign-tenant-b', 'active']
  ]) {
    db.engagements.set(id, {
      id,
      clientId,
      clientName: clientId,
      tenantId,
      taxYear: 2025,
      status,
      reviewerId: 'assign-staff'
    } as any);
  }
  searchSpy = vi.spyOn(globalOperationalSearchService, 'search').mockImplementation(() => ({
    query: 'case',
    totalMatches: 3,
    matches: [
      { entityType: 'case', id: 'case-a', title: 'Case A', subtitle: 'Client A', clientId: 'assign-client-a', status: 'active', matchedField: 'title' },
      { entityType: 'case', id: 'case-b', title: 'Case B', subtitle: 'Client B', clientId: 'assign-client-b', status: 'active', matchedField: 'title' },
      { entityType: 'case', id: 'case-other', title: 'Other Tenant', subtitle: 'Other', clientId: 'assign-client-other', status: 'active', matchedField: 'title' }
    ]
  }));
});

afterEach(() => {
  for (const id of ['assign-client-a', 'assign-client-b', 'assign-client-other', 'assign-staff', 'assign-admin-a', 'assign-admin-b']) {
    db.users.delete(id);
    state.users.delete(id);
  }
  for (const id of ['assign-eng-a', 'assign-eng-b', 'assign-eng-other']) db.engagements.delete(id);
  for (const id of Array.from(db.clientAccountantAssignments.keys())) {
    if (id.startsWith('assignment-test-')) db.clientAccountantAssignments.delete(id);
  }
  searchSpy.mockRestore();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it.each([
  ['current', { effectiveDate: new Date(FIXED_NOW - 1).toISOString() }, true],
  ['future', { effectiveDate: new Date(FIXED_NOW + 1).toISOString() }, false],
  ['expired', { expirationDate: new Date(FIXED_NOW).toISOString() }, false],
  ['inactive', { status: 'INACTIVE' }, false],
  ['revoked', { status: 'REVOKED' }, false],
  ['malformed-start', { effectiveDate: 'not-a-date' }, false],
  ['malformed-end', { expirationDate: 'not-a-date' }, false],
  ['wrong-case', { caseId: 'case-not-in-search-scope' }, false]
])('filters staff search for %s assignment', async (_name, assignmentFields, allowed) => {
  addAssignment(`assignment-test-${_name}`, 'assign-client-a', assignmentFields);
  const result = await get('/api/practice/search?q=case', 'assign-staff');
  expect(result.status).toBe(200);
  const clientIds = result.body.matches.map((match: any) => match.clientId);
  expect(clientIds.includes('assign-client-a')).toBe(allowed);
  expect(clientIds).not.toContain('assign-client-other');
});

it.each([
  ['current', { effectiveDate: new Date(FIXED_NOW - 1).toISOString() }, true],
  ['future', { effectiveDate: new Date(FIXED_NOW + 1).toISOString() }, false],
  ['expired', { expirationDate: new Date(FIXED_NOW).toISOString() }, false],
  ['inactive', { status: 'INACTIVE' }, false],
  ['revoked', { status: 'REVOKED' }, false],
  ['wrong-engagement', { engagementId: 'assign-eng-b' }, false],
  ['wrong-tax-year', { taxYear: 2024 }, false],
  ['wrong-case', { caseId: 'case-not-in-engagement-scope' }, false]
])('filters engagement list for %s assignment', async (_name, assignmentFields, allowed) => {
  addAssignment(`assignment-test-${_name}`, 'assign-client-a', assignmentFields);
  const result = await get('/api/engagements', 'assign-staff');
  expect(result.status).toBe(200);
  const ids = result.body.engagements.map((engagement: any) => engagement.id);
  expect(ids.includes('assign-eng-a')).toBe(allowed);
  expect(ids).not.toContain('assign-eng-other');
});

it('denies staff search and engagement listing without any current assignment', async () => {
  const search = await get('/api/practice/search?q=case', 'assign-staff');
  const engagements = await get('/api/engagements', 'assign-staff');
  expect(search.body.matches).toEqual([]);
  expect(engagements.body.engagements).toEqual([]);
});

it('preserves administrator access within the authenticated tenant only', async () => {
  const adminA = await get('/api/practice/search?q=case', 'assign-admin-a');
  expect(adminA.body.matches.map((match: any) => match.clientId).sort())
    .toEqual(['assign-client-a', 'assign-client-b']);
  const adminAEngagements = await get('/api/engagements', 'assign-admin-a');
  expect(adminAEngagements.body.engagements.map((engagement: any) => engagement.clientId).sort())
    .toEqual(['assign-client-a', 'assign-client-b']);

  const adminB = await get('/api/practice/search?q=case', 'assign-admin-b');
  expect(searchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ tenantId: 'assign-tenant-b' }));
  expect(adminB.body.matches.map((match: any) => match.clientId)).toEqual(['assign-client-other']);
  const adminBEngagements = await get('/api/engagements', 'assign-admin-b');
  expect(adminBEngagements.body.engagements.map((engagement: any) => engagement.clientId))
    .toEqual(['assign-client-other']);
});
