import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ durable: true, create: vi.fn(), update: vi.fn(), provision: vi.fn() }));
vi.mock('../server/supabase', async importOriginal => ({ ...await importOriginal<typeof import('../server/supabase')>(), verifySupabaseAccessToken: async () => ({ uid: 'verified-client', email: 'client@example.invalid', emailVerified: true, authTime: 1 }) }));
vi.mock('../server/supabase-db', () => ({ SupabaseDurableSessions: class {
  get usesDurableAuthority() { return boundary.durable; }
  create = boundary.create; updateUser = boundary.update;
} }));
vi.mock('../server/taxguard/clientOnboardingProvisioner', () => ({ provisionOrResolveClientOnboarding: boundary.provision }));
import { authRouter } from '../server/routes/auth.routes';
let server: Server; let origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/auth', authRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  boundary.durable = true; boundary.create.mockReset(); boundary.update.mockReset(); boundary.provision.mockReset();
  boundary.create.mockResolvedValue({ token: 'synthetic-session', tenantId: 'tenantA', clientId: '001', user: { id: 'verified-client', tenantId: 'tenantA', clientId: '001', role: 'client', status: 'active', onboardingStatus: 'NOT_STARTED', onboardingCompletedAt: null } });
  boundary.provision.mockRejectedValue(new Error('volatile adapter must not run'));
});
const request = () => fetch(origin + '/auth/supabase-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: 'synthetic-provider-proof', onboardingStatus: 'COMPLETED', caseId: 'forged-case' }) });
it('returns durable identity without fabricating a process-local case or completion', async () => {
  const response = await request(); expect(response.status).toBe(200); const data = await response.json();
  expect(data.user.onboardingStatus).toBe('NOT_STARTED'); expect(data.user.onboardingCompletedAt).toBeNull();
  expect(data.onboardingAvailability).toEqual({ status: 'unavailable', code: 'DURABLE_ONBOARDING_PROVIDER_REQUIRED' });
  for (const field of ['caseId','engagementId','workflow','stageStates','activeStage','eligibility']) expect(data).not.toHaveProperty(field);
  expect(boundary.provision).not.toHaveBeenCalled(); expect(boundary.update).not.toHaveBeenCalled();
});
it('does not initialize client onboarding for staff sessions', async () => {
  boundary.create.mockResolvedValue({ token: 'synthetic-session', tenantId: 'tenantA', clientId: '', user: { id: 'verified-staff', role: 'accountant', status: 'active' } });
  const response = await request(); expect(response.status).toBe(200); expect(await response.json()).not.toHaveProperty('onboardingAvailability');
  expect(boundary.provision).not.toHaveBeenCalled();
});
it('preserves the explicitly isolated demonstration onboarding path', async () => {
  boundary.durable = false;
  boundary.provision.mockResolvedValue({ tenant: { tenantId: 'tenantA' }, client: { clientId: '001' }, engagement: { engagementId: 'demo-engagement' }, taxYearRecord: { taxYear: 2025 }, taxCase: { caseId: 'demo-case', activeStage: 1 }, stageStates: {}, resumed: false, workflow: { stage1: { status: 'NOT_STARTED' } }, eligibility: {} });
  const response = await request(); expect(response.status).toBe(200); const data = await response.json(); expect(data.caseId).toBe('demo-case'); expect(data).not.toHaveProperty('onboardingAvailability');
  expect(boundary.provision).toHaveBeenCalledOnce(); expect(boundary.update).not.toHaveBeenCalled();
});
