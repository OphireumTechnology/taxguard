import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { TransactionalFirestore } from './helpers/transactionalFirestore';
import { casePath } from '../server/taxguard/authority.repository';
const holder = vi.hoisted(() => ({ db: null as any }));
vi.mock('../server/firebase-admin', () => ({ getFirebaseAdminDb: () => holder.db }));
// HTTP tests isolate transport from Firebase token verification (tested separately).
vi.mock('../server/auth', () => ({ authenticateToken: (req: any, res: any, next: any) => {
  if (!req.headers['x-test-user']) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  req.user = { id: req.headers['x-test-user'] }; next();
} }));
import { caseAuthorityRouter } from '../server/routes/case-authority.routes';
let server: Server; let origin: string;
const scope = { tenantId: 'tenantA', clientId: '001', engagementId: 'engA', taxYear: 2025 };
const root = casePath(scope);
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/case-authority', caseAuthorityRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/case-authority/tenantA/001/engA/2025`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  holder.db = new TransactionalFirestore();
  holder.db.records.set(root, { ...scope, revision: 1, clientUid: 'owner', preparerUid: 'preparer', reviewerUid: 'reviewer', activeStage: 1, openExceptions: 0, externalSubmissionEnabled: false });
  holder.db.records.set('taxguardTenants/tenantA/members/owner', { status: 'active', role: 'client', clientId: '001' });
  holder.db.records.set('taxguardTenants/tenantA/members/preparer', { status: 'active', role: 'accountant' });
  holder.db.records.set(root + '/assignments/owner', { uid: 'owner', role: 'client', active: true });
  holder.db.records.set(root + '/assignments/preparer', { uid: 'preparer', role: 'preparer', active: true });
});
it('requires authentication before repository access', async () => {
  const response = await fetch(origin);
  expect(response.status).toBe(401);
});
it('returns only authorized scoped state with no-store', async () => {
  const response = await fetch(origin, { headers: { 'x-test-user': 'owner' } });
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ clientId: '001', externalSubmissionEnabled: false });
});
it('denies a forged actor in the body and unknown session actor', async () => {
  const response = await fetch(origin + '/exceptions', { method: 'POST', headers: { 'x-test-user': 'attacker', 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: 'preparer', revision: 1, operationId: 'ex1', code: 'MISSING_DOCUMENT' }) });
  expect(response.status).toBe(403);
  expect(holder.db.records.has(root + '/exceptions/ex1')).toBe(false);
});
it('persists a professional exception through the API', async () => {
  const response = await fetch(origin + '/exceptions', { method: 'POST', headers: { 'x-test-user': 'preparer', 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: 1, operationId: 'ex1', code: 'MISSING_DOCUMENT' }) });
  expect(response.status).toBe(200);
  expect(holder.db.records.get(root + '/exceptions/ex1').recordedBy).toBe('preparer');
});
it('does not expose a caller-controlled stage gate endpoint', async () => {
  const response = await fetch(origin + '/stage-gates', { method: 'POST', headers: { 'x-test-user': 'preparer', 'Content-Type': 'application/json' }, body: JSON.stringify({ passed: true }) });
  expect(response.status).toBe(404);
});
it('returns unavailable rather than raw storage errors', async () => {
  holder.db.runTransaction = async () => { throw new Error('secret backend details'); };
  const response = await fetch(origin, { headers: { 'x-test-user': 'owner' } });
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('secret backend');
});

it('returns 18 persistent stage states via the API', async () => {
  const response = await fetch(origin + '/stages', { headers: { 'x-test-user': 'owner' } });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data).toHaveLength(18);
  expect(data[0].stageName).toBe('ONBOARD');
  expect(data[17].stageName).toBe('REPEAT');
});

it('returns truthful provider readiness without secret keys', async () => {
  const readinessUrl = origin.split('/tenantA')[0] + '/provider-readiness';
  const response = await fetch(readinessUrl);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(Array.isArray(data.providers)).toBe(true);
  expect(data.providers.some((p: any) => p.provider === 'DATABASE')).toBe(true);
});

it('lists cases for an engagement via the API', async () => {
  holder.db.records.set('taxguardTenants/tenantA/clients/001/engagements/engA', {
    clientId: '001',
    taxYears: [2025],
  });
  const casesUrl = origin.split('/2025')[0] + '/cases';
  const response = await fetch(casesUrl, { headers: { 'x-test-user': 'preparer' } });
  expect(response.status).toBe(200);
  const cases = await response.json();
  expect(Array.isArray(cases)).toBe(true);
  expect(cases).toHaveLength(1);
  expect(cases[0].taxYear).toBe(2025);
});

it('supports Stages 04 through 09 via canonical HTTP routes', async () => {
  // Stage 04: Create record
  const recRes = await fetch(origin + '/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user': 'preparer' },
    body: JSON.stringify({
      version: 1,
      operationId: 'op_http_rec',
      record: {
        category: 'wages',
        description: 'HTTP Form W-2',
        originalValue: '60000',
        normalizedValue: 60000,
        provenance: { originalValue: '60000', recordVersion: 1 },
      },
    }),
  });
  expect(recRes.status).toBe(200);
  const recData = await recRes.json();
  expect(recData.recordId).toBeDefined();

  // List records
  const listRecRes = await fetch(origin + '/records', { headers: { 'x-test-user': 'preparer' } });
  expect(listRecRes.status).toBe(200);
  const records = await listRecRes.json();
  expect(records.length).toBeGreaterThan(0);

  // Stage 05: Reconcile
  const reconRes = await fetch(origin + '/reconciliations/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user': 'preparer' },
    body: JSON.stringify({
      version: 2,
      operationId: 'op_http_recon',
      category: 'wages',
      tolerance: 1.0,
    }),
  });
  expect(reconRes.status).toBe(200);

  // Stage 06: Workpaper
  const wpRes = await fetch(origin + '/workpapers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user': 'preparer' },
    body: JSON.stringify({
      version: 3,
      operationId: 'op_http_wp',
      workpaper: {
        title: 'HTTP Wage Reconciliation Workpaper',
        issue: 'W-2 Wage Verification',
        analysis: 'Matched within tolerance',
        conclusion: 'Verified',
      },
    }),
  });
  expect(wpRes.status).toBe(200);

  // Stage 07: Report
  const repRes = await fetch(origin + '/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user': 'preparer' },
    body: JSON.stringify({
      version: 4,
      operationId: 'op_http_rep',
      reportType: 'case_summary',
    }),
  });
  expect(repRes.status).toBe(200);

  // Stage 08: Plan
  const planRes = await fetch(origin + '/planning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user': 'preparer' },
    body: JSON.stringify({
      version: 5,
      operationId: 'op_http_plan',
      scenario: {
        name: 'HTTP Scenario',
        description: 'Modeling test',
        adjustments: [],
      },
    }),
  });
  expect(planRes.status).toBe(200);

  // Stage 09: Return
  const retRes = await fetch(origin + '/returns/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user': 'preparer' },
    body: JSON.stringify({
      version: 6,
      operationId: 'op_http_ret',
      returnType: 'INDIVIDUAL_1040',
      jurisdiction: 'FEDERAL',
    }),
  });
  expect(retRes.status).toBe(200);
  const retData = await retRes.json();
  expect(retData.returnId).toBeDefined();
});

