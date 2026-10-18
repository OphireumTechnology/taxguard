import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, closeBrowser, dumpOnFailure, durableSession, liveSessionWithToken, newSession, ORIGIN, providerControl, providerToken, realErrors, sees, type Session } from '../helpers';

// Journey B on the approved durable contracts: a person with no invitation and no seeded record signs in to
// the client portal; the server provisions their client identity (taxguard_provision_client_identity); a
// durable practice manager finds that client and opens an engagement. Stage 01 identity onboarding has no
// durable provider yet, so the suite asserts that it stays explicitly unavailable, cannot be completed by
// forged gate fields, and that the portal does not collect identity data it cannot record. Synthetic data only.
const NEW_UID = 'd0000000-0000-4000-8000-0000000000b1';
const MANAGER = 'd0000000-0000-4000-8000-0000000000d1';
const EMAIL = `${NEW_UID}@example.test`;
const PASSWORD = 'Synthetic-new-client-1!';
const ENGAGEMENT = 'Synthetic new-client 2025 return';
let clientId = ''; let clientToken = ''; let managerToken = '';
const tokenOf = (s: Session) => s.page.evaluate(() => localStorage.getItem('artax_session_token'));
const findClient = async () => (await api(managerToken, 'GET', `/api/practice/clients?q=${encodeURIComponent(EMAIL)}`)).body.items;

beforeAll(async () => {
  expect((await providerControl('/e2e/provider-user', { uid: NEW_UID, email: EMAIL, password: PASSWORD, withFactor: false })).status).toBe(200);
  expect((await providerControl('/e2e/provider-user', { uid: MANAGER, email: `${MANAGER}@example.test`, password: 'Synthetic-durable-manager-1!', withFactor: true })).status).toBe(200);
  const m = await durableSession(await providerToken(MANAGER));
  expect(m.status, m.body?.code).toBe(200);
  managerToken = m.body.token;
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(closeBrowser);

describe('journey B: new client to engagement on durable contracts', () => {
  it('a first portal sign-in provisions exactly one client identity; a later sign-in resumes it', async () => {
    expect(await findClient()).toEqual([]);
    const s = await newSession();
    await s.page.goto(ORIGIN + '/portal/login');
    await s.page.locator('input[type=email]').fill(EMAIL);
    await s.page.locator('input[type=password]').fill(PASSWORD);
    await s.page.getByRole('button', { name: 'Sign In Securely', exact: true }).click();
    await s.page.waitForURL(u => u.pathname === '/portal' || u.pathname === '/portal/dashboard');
    clientToken = (await tokenOf(s))!;
    const me = (await api(clientToken, 'GET', '/api/auth/me')).body.user;
    expect(me).toMatchObject({ id: NEW_UID, role: 'client', tenantId: 'tenantE2E', email: EMAIL, status: 'active', onboardingStatus: 'NOT_STARTED' });
    clientId = me.clientId;
    // A permanent identifier issued by the server counter, not one of the seeded fixtures.
    expect(clientId).toMatch(/^\d{3,9}$/);
    const again = await durableSession(await providerToken(NEW_UID, { aal: 'aal1' }));
    expect(again.status).toBe(200);
    expect(again.body.user.clientId).toBe(clientId);
    expect(await findClient()).toEqual([expect.objectContaining({ clientId, email: EMAIL, status: 'active', engagements: 0, team: [] })]);
    // The new client cannot use practice management.
    expect((await api(clientToken, 'GET', '/api/practice/clients')).status).toBeGreaterThanOrEqual(403);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('Stage 01 onboarding stays unavailable: it cannot be completed by forged gate fields and the portal records nothing', async () => {
    const workflow = await api(clientToken, 'GET', '/api/case-authority/client-onboarding/workflow?taxYear=2025');
    expect([workflow.status, workflow.body.code]).toEqual([503, 'DURABLE_ONBOARDING_PROVIDER_REQUIRED']);
    const forged = await api(clientToken, 'POST', '/api/case-authority/client-onboarding/stage-1', { taxYear: 2025, completeStage: true,
      snapshot: { hardExitGatePassed: true, identityComplete: true, taxProfileComplete: true, tinValid: true, addressComplete: true, representativeComplete: true,
        supportingDocumentsComplete: true, duplicateResolutionComplete: true, consentComplete: true, reviewComplete: true } });
    expect([forged.status, forged.body.code]).toEqual([503, 'DURABLE_ONBOARDING_PROVIDER_REQUIRED']);
    expect((await api(clientToken, 'GET', '/api/auth/me')).body.user.onboardingStatus).toBe('NOT_STARTED');

    const s = await liveSessionWithToken(clientToken, '/portal/collection');
    const notice = s.page.getByRole('status').filter({ has: s.page.getByRole('heading', { name: 'Online identity onboarding is not available yet' }) });
    await notice.waitFor();
    expect(await notice.innerText()).toContain('nothing has been saved');
    expect(await notice.innerText()).toContain(`Client ID: ${clientId}`);
    expect(await s.page.getByText('Identity Verification Wizard').count()).toBe(0);
    expect(await s.page.locator('input').count()).toBe(0);
    const stored = await s.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('artax_stage_one_dossier_')));
    expect(stored).toEqual([]);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('a durable practice manager finds the new client and opens an engagement; the client cannot create one', async () => {
    expect((await api(clientToken, 'POST', `/api/practice/clients/${clientId}/engagements`, { title: 'Synthetic self-created', type: 'tax_preparation', taxYears: [2025] })).status).toBeGreaterThanOrEqual(403);
    const m = await liveSessionWithToken(managerToken, '/staff');
    const { page } = m;
    await page.getByRole('button', { name: 'Clients & Engagements' }).first().click();
    await page.getByRole('button', { name: new RegExp(NEW_UID) }).click();
    const create = page.locator('form', { has: page.getByRole('button', { name: 'Create engagement' }) });
    await create.getByLabel('Title').fill(ENGAGEMENT);
    await create.getByLabel('Type').selectOption('tax_preparation');
    await create.getByLabel('Tax year').fill('2025');
    await create.getByRole('button', { name: 'Create engagement' }).click();
    await sees(page, ENGAGEMENT);
    await page.getByRole('button', { name: 'Set active' }).first().click();
    await sees(page, /· active ·/);
    const detail = (await api(managerToken, 'GET', `/api/practice/clients/${clientId}`)).body;
    expect(detail.engagements.map((e: any) => [e.title, e.status])).toEqual([[ENGAGEMENT, 'active']]);
    expect((await findClient())[0]).toMatchObject({ clientId, engagements: 1 });
    // Another tenant's administrator cannot see the new client.
    const foreign = await durableSession(await providerToken('d0000000-0000-4000-8000-0000000000f1'));
    if (foreign.status === 200) expect((await api(foreign.body.token, 'GET', `/api/practice/clients/${clientId}`)).status).toBeGreaterThanOrEqual(403);
    else { expect(foreign.status).toBeGreaterThanOrEqual(400); expect(foreign.body?.token).toBeUndefined(); }
    expect(realErrors(m)).toEqual([]);
    await m.context.close();
  });
});
