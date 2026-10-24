import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, closeBrowser, control, dumpOnFailure, durableSession, liveSessionWithToken, newSession, ORIGIN, providerControl, providerToken, realErrors, sees, type Session } from '../helpers';

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
const PREPARER = 'd0000000-0000-4000-8000-0000000000a6', REVIEWER = 'd0000000-0000-4000-8000-0000000000a5', BOOKKEEPER = 'd0000000-0000-4000-8000-0000000000a7';
let preparerToken = ''; let reviewerToken = ''; let bookkeeperToken = ''; let caseId = ''; let caseVersion = 0;
const tokenOf = (s: Session) => s.page.evaluate(() => localStorage.getItem('artax_session_token'));
const findClient = async () => (await api(managerToken, 'GET', `/api/practice/clients?q=${encodeURIComponent(EMAIL)}`)).body.items;

beforeAll(async () => {
  expect((await providerControl('/e2e/provider-user', { uid: NEW_UID, email: EMAIL, password: PASSWORD, withFactor: false })).status).toBe(200);
  expect((await providerControl('/e2e/provider-user', { uid: MANAGER, email: `${MANAGER}@example.test`, password: 'Synthetic-durable-manager-1!', withFactor: true })).status).toBe(200);
  const m = await durableSession(await providerToken(MANAGER));
  expect(m.status, m.body?.code).toBe(200);
  managerToken = m.body.token;
  for (const [uid, set] of [[PREPARER, (t: string) => { preparerToken = t; }], [REVIEWER, (t: string) => { reviewerToken = t; }], [BOOKKEEPER, (t: string) => { bookkeeperToken = t; }]] as const) {
    expect((await providerControl('/e2e/provider-user', { uid, email: `${uid}@example.test`, password: 'Synthetic-durable-staff-1!', withFactor: true })).status).toBe(200);
    const s = await durableSession(await providerToken(uid));
    expect(s.status, s.body?.code).toBe(200);
    set(s.body.token);
  }
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

  it('Stage 01 runs only on the durable store: forged legacy gate fields change nothing and the browser keeps no dossier', async () => {
    // The legacy, browser-trusting Stage 01 route stays closed on durable deployments.
    const workflow = await api(clientToken, 'GET', '/api/case-authority/client-onboarding/workflow?taxYear=2025');
    expect([workflow.status, workflow.body.code]).toEqual([503, 'DURABLE_ONBOARDING_PROVIDER_REQUIRED']);
    const forged = await api(clientToken, 'POST', '/api/case-authority/client-onboarding/stage-1', { taxYear: 2025, completeStage: true,
      snapshot: { hardExitGatePassed: true, identityComplete: true, taxProfileComplete: true, tinValid: true, addressComplete: true, representativeComplete: true,
        supportingDocumentsComplete: true, duplicateResolutionComplete: true, consentComplete: true, reviewComplete: true } });
    expect([forged.status, forged.body.code]).toEqual([503, 'DURABLE_ONBOARDING_PROVIDER_REQUIRED']);
    expect((await api(clientToken, 'GET', '/api/auth/me')).body.user.onboardingStatus).toBe('NOT_STARTED');
    expect((await api(clientToken, 'GET', '/api/stage-one/me')).body).toMatchObject({ clientId, status: 'DRAFT', revision: 0, consent: null });
    // Stage 02 is closed on the server, not only in the portal.
    const stageTwo = await api(clientToken, 'GET', '/api/stage-two-three/questionnaire/2025');
    expect([stageTwo.status, stageTwo.body.code]).toEqual([403, 'STAGE_01_NOT_APPROVED']);

    const s = await liveSessionWithToken(clientToken, '/portal/collection');
    await s.page.getByRole('heading', { name: 'Stage 01 onboarding' }).waitFor();
    await sees(s.page, "consent wording is awaiting approval");
    expect(await s.page.getByRole('button', { name: 'Submit for practice review' }).count()).toBe(0);
    expect(await s.page.getByText('Identity Verification Wizard').count()).toBe(0);
    expect(await s.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('artax_stage_one_dossier_')))).toEqual([]);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();

    // Without the durable store the portal says onboarding is unavailable and offers no form.
    const off = await newSession();
    await off.context.route('**/api/stage-one/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'ONBOARDING_STORE_UNAVAILABLE' }) }));
    await off.context.addInitScript(t => { localStorage.setItem('artax_session_token', t); localStorage.setItem('token', t); localStorage.setItem('taxguard_environment', 'live'); }, clientToken);
    await off.page.goto(ORIGIN + '/portal/collection', { waitUntil: 'domcontentloaded' });
    const notice = off.page.getByRole('status').filter({ has: off.page.getByRole('heading', { name: 'Online identity onboarding is not available yet' }) });
    await notice.waitFor();
    expect(await notice.innerText()).toContain(`Client ID: ${clientId}`);
    expect(await off.page.locator('input').count()).toBe(0);
    await off.context.close();
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

describe('journey B: durable Stage 01 onboarding to Stage 02', () => {
  const engagementId = async () => (await api(managerToken, 'GET', `/api/practice/clients/${clientId}`)).body.engagements[0].engagementId as string;
  const signAndSubmit = async (s: Session) => {
    const consent = s.page.getByRole('region', { name: 'IRC § 7216 consent' }).or(s.page.locator('section[aria-labelledby="stage-one-consent"]'));
    await consent.getByText('SYNTHETIC TEST CONSENT', { exact: false }).waitFor();
    await consent.getByRole('checkbox').check();
    await consent.getByLabel('Full name of the person signing').fill('Synthetic New Client');
    await consent.getByRole('button', { name: 'Submit for practice review' }).click();
    await sees(s.page, 'Submitted for practice review.');
  };

  it('the client completes the onboarding form in the browser; only the last four digits are accepted', async () => {
    expect((await api(clientToken, 'POST', '/api/stage-one/me', { revision: 0, fields: { tinLast4: '123456789' } })).body.code).toBe('ONBOARDING_FULL_TIN_REFUSED');
    expect((await api(clientToken, 'POST', '/api/stage-one/me', { revision: 0, fields: { identityComplete: true, consentComplete: true } })).body.code).toBe('ONBOARDING_INPUT_INVALID');
    const s = await liveSessionWithToken(clientToken, '/portal/collection');
    const form = s.page.getByRole('form', { name: 'Onboarding details' });
    await form.getByLabel('Taxpayer type').selectOption('individual');
    await form.getByLabel('Legal name').fill('Synthetic New Client');
    await form.getByLabel('Identification number type').selectOption('SSN');
    const last4 = form.getByLabel('Last four digits');
    expect(await last4.getAttribute('maxlength')).toBe('4');
    await last4.fill('4321');
    await form.getByLabel('Street address').fill('1 Synthetic Way');
    await form.getByLabel('City').fill('Columbia');
    await form.getByLabel('State').fill('SC');
    await form.getByLabel('ZIP code').fill('29201');
    await form.getByRole('button', { name: 'Save details' }).click();
    await sees(s.page, 'Your onboarding details were saved.');
    const saved = (await api(clientToken, 'GET', '/api/stage-one/me')).body;
    expect(saved).toMatchObject({ status: 'DRAFT', tinMasked: '***-**-4321', requirements: { profile: true, tin: true, address: true, representative: true, identityDocument: false, consentAvailable: false } });
    // No approved consent wording exists yet, so the server refuses submission.
    expect((await api(clientToken, 'POST', '/api/stage-one/me/submit', { revision: saved.revision, consentVersion: 'SYNTHETIC-E2E-1', signer: 'Synthetic New Client' })).body.code)
      .toBe('ONBOARDING_CONSENT_NOT_APPROVED');
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('with (synthetic) approved consent wording the client signs and submits; the practice requests a change without exposing its note', async () => {
    const c = control();
    expect((await fetch(c.origin + '/e2e/synthetic-consent-version', { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' }, body: '{}' })).status).toBe(200);
    const s = await liveSessionWithToken(clientToken, '/portal/collection');
    await signAndSubmit(s);
    await sees(s.page, 'Submitted. The practice is reviewing your onboarding.');
    expect((await api(clientToken, 'GET', '/api/stage-two-three/questionnaire/2025')).body.code).toBe('STAGE_01_NOT_APPROVED');

    const m = await liveSessionWithToken(managerToken, '/staff');
    await m.page.getByRole('button', { name: 'Onboarding Review' }).first().click();
    const row = m.page.getByRole('row', { name: new RegExp(clientId) });
    await row.waitFor();
    expect(await row.innerText()).toContain('Not verified');
    await row.getByRole('button', { name: `Review onboarding for client ${clientId}` }).click();
    await m.page.getByRole('button', { name: 'Approve onboarding' }).click();
    await sees(m.page, 'An identification document must be verified by the practice before approval.');
    await m.page.getByLabel('Reason shown to the client (required to request changes)').fill('Please confirm the ZIP code.');
    await m.page.getByLabel('Internal note (staff only)').fill('B-PRIVATE zip looked unusual');
    await m.page.getByRole('button', { name: 'Request changes' }).click();
    await sees(m.page, `Changes requested from ${clientId}.`);
    await m.context.close();

    await s.page.reload();
    await sees(s.page, 'Practice note: Please confirm the ZIP code.');
    const clientView = JSON.stringify((await api(clientToken, 'GET', '/api/stage-one/me')).body);
    expect(clientView).not.toMatch(/B-PRIVATE|internalNote|decidedBy|d0000000-0000-4000-8000-0000000000d1/);
    // The client is told in the portal, without the reason or any staff detail in the notice itself.
    const notices = JSON.stringify((await api(clientToken, 'GET', `/api/vault/clients/${clientId}/notifications`)).body);
    expect(notices).toContain('"kind":"ONBOARDING_CHANGES_REQUESTED"');
    expect(notices).toContain('Your onboarding needs changes');
    expect(notices).not.toMatch(/ZIP code|B-PRIVATE|d0000000-0000-4000-8000-0000000000d1|createdBy/);
    expect(await s.page.locator('body').innerText()).not.toContain('B-PRIVATE');
    const form = s.page.getByRole('form', { name: 'Onboarding details' });
    await form.getByLabel('ZIP code').fill('29205');
    await form.getByRole('button', { name: 'Save details' }).click();
    await sees(s.page, 'Your onboarding details were saved.');
    await signAndSubmit(s);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('before onboarding is approved, a fully staffed case cannot leave its Onboard stage', async () => {
    const eng = await engagementId();
    for (const [role, userId] of [['preparer', PREPARER], ['reviewer', REVIEWER], ['bookkeeper', BOOKKEEPER]]) {
      const r = await api(managerToken, 'POST', `/api/practice/clients/${clientId}/engagements/${eng}/team`, { taxYear: 2025, role, userId, reason: 'Synthetic staffing for journey B' }, `journey-b-${role}`);
      expect(r.status, r.body?.code).toBeLessThan(300);
    }
    const created = await api(managerToken, 'POST', '/api/cases', { clientId, engagementId: eng, taxYear: 2025, returnFamily: '1040' }, 'journey-b-case-1');
    expect(created.status, created.body?.code).toBe(201);
    caseId = created.body.caseId;
    caseVersion = (await api(managerToken, 'GET', `/api/cases/${caseId}`)).body.case.version;
    const blocked = await api(preparerToken, 'POST', `/api/cases/${caseId}/advance`, { fromStage: 1, version: caseVersion });
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ code: 'STAGE_GATE_NOT_MET', failedChecks: ['clientOnboardingCompleted'] });
    expect((await api(managerToken, 'GET', `/api/cases/${caseId}`)).body.case.activeStage).toBe(1);
  });

  it('after the practice verifies an identification document and a manager approves, Stage 02 opens on the server', async () => {
    const eng = await engagementId();
    const query = new URLSearchParams({ engagementId: eng, taxYear: '2025', category: 'identity', fileName: 'synthetic-id.pdf' });
    const uploaded = await fetch(ORIGIN + `/api/vault/clients/${clientId}/documents?` + query, { method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/pdf', 'Idempotency-Key': 'journey-b-identity-upload' },
      body: '%PDF-1.4\nSynthetic identification document for E2E only\n%%EOF' });
    expect(uploaded.status).toBe(201);
    const documentId = (await uploaded.json()).documentId;
    const c = control();
    expect((await fetch(c.origin + '/e2e/scan', { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'tenantE2E', client: clientId, documentId, version: 1, result: 'CLEAN' }) })).status).toBe(200);
    const doc = (await api(managerToken, 'GET', `/api/vault/clients/${clientId}/documents/${documentId}`)).body.versions[0];
    expect((await api(managerToken, 'POST', `/api/vault/clients/${clientId}/documents/${documentId}/versions/1/review`, { decision: 'approve', rowVersion: doc.rowVersion })).status).toBe(200);

    const m = await liveSessionWithToken(managerToken, '/staff');
    await m.page.getByRole('button', { name: 'Onboarding Review' }).first().click();
    const row = m.page.getByRole('row', { name: new RegExp(clientId) });
    await row.waitFor();
    expect(await row.innerText()).toContain('Verified');
    await row.getByRole('button', { name: `Review onboarding for client ${clientId}` }).click();
    await m.page.getByRole('button', { name: 'Approve onboarding' }).click();
    await sees(m.page, `Onboarding for ${clientId} approved. Stage 02 is open for the client.`);
    await sees(m.page, 'No onboarding is awaiting review.');
    expect(realErrors(m)).toEqual([]);
    await m.context.close();

    expect((await api(clientToken, 'GET', '/api/auth/me')).body.user.onboardingStatus).toBe('COMPLETED');
    expect((await api(clientToken, 'GET', '/api/stage-one/me')).body).toMatchObject({ status: 'APPROVED', clientReason: null });
    const stageTwo = await api(clientToken, 'GET', `/api/stage-two-three/questionnaire/2025?engagementId=${encodeURIComponent(eng)}`);
    expect(stageTwo.status, stageTwo.body?.code).toBe(200);
    // The client cannot decide its own onboarding or reach another client's record.
    expect((await api(clientToken, 'POST', `/api/stage-one/clients/${clientId}/decision`, { decision: 'approve', revision: 1 })).status).toBe(403);
    expect((await api(clientToken, 'GET', '/api/stage-one/clients/E2EMFAC1')).status).toBe(403);
    const s = await liveSessionWithToken(clientToken, '/portal/collection');
    await s.page.waitForLoadState('networkidle');
    expect(await s.page.getByRole('heading', { name: 'Stage 01 onboarding' }).count()).toBe(0);
    // The approval notice appears in the portal's notifications, described in plain language.
    await s.page.goto(ORIGIN + '/portal/dashboard#nav=notifications');
    const list = s.page.getByRole('list', { name: 'Notifications' });
    await list.getByText('Your onboarding was approved').waitFor();
    await list.getByText('Onboarding approved — Your practice approved your Stage 01 onboarding. Document collection is open.').waitFor();
    expect(await list.getByText('Your onboarding needs changes').count()).toBe(1);
    await s.context.close();
  });

  it('after approval the case continues: Onboard completes, the client collects in Stage 02, and Stage 03 validation is reached', async () => {
    const attest = (confirmed: string[]) => ({ confirmed, statement: 'Synthetic reviewer attestation for E2E testing only.' });
    const advance = async (token: string, fromStage: number, attestation?: unknown) => {
      const r = await api(token, 'POST', `/api/cases/${caseId}/advance`, { fromStage, version: caseVersion, attestation });
      if (r.status === 200) caseVersion = r.body.version;
      return r;
    };
    const onboard = await advance(preparerToken, 1);
    expect(onboard.status, JSON.stringify(onboard.body)).toBe(200);
    expect(onboard.body.activeStage).toBe(2);

    // Stage 02 collection in the browser, on the durable collection workspace.
    const s = await liveSessionWithToken(clientToken, '/portal/collection');
    await sees(s.page, 'Document collection · 2025');
    await s.page.getByRole('button', { name: 'Start questionnaire draft', exact: true }).click();
    const dialog = s.page.getByRole('dialog');
    await dialog.getByLabel('State of Primary Residency').fill('SC');
    await dialog.getByText('Earned wages reported on Form W-2', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Save & Update Checklist', exact: true }).click();
    await sees(s.page, 'Edit questionnaire draft');
    const eng = await engagementId();
    const stored = await api(clientToken, 'GET', `/api/stage-two-three/questionnaire/2025?engagementId=${encodeURIComponent(eng)}`);
    expect(stored.status).toBe(200);
    expect(stored.body.questionnaire).toMatchObject({ version: 1 });
    expect(realErrors(s)).toEqual([]);
    await s.context.close();

    // Collection needs an independent reviewer's attestation; the preparer cannot give it.
    expect((await advance(preparerToken, 2, attest(['documents_received_or_waived', 'documents_in_private_storage']))).status).toBeGreaterThanOrEqual(400);
    expect((await advance(reviewerToken, 2, attest(['documents_received_or_waived', 'documents_in_private_storage']))).body.activeStage).toBe(3);
    const validated = await advance(reviewerToken, 3, attest(['documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved']));
    expect(validated.status, JSON.stringify(validated.body)).toBe(200);
    expect(validated.body.activeStage).toBe(4);
    const detail = (await api(managerToken, 'GET', `/api/cases/${caseId}`)).body;
    expect(detail.stages.filter((x: any) => x.status === 'COMPLETED').map((x: any) => x.stage ?? x.stageNumber)).toEqual([1, 2, 3]);
  });

  it('stages 04-08: entries post after independent review, a reconciliation closes, an approved workpaper backs Review, and Stage 09 stays blocked', async () => {
    const Y = 2025;
    const ledger = (token: string, method: string, path: string, body: Record<string, unknown> = {}) => method === 'GET'
      ? api(token, 'GET', `/api/bookkeeping${path}${path.includes('?') ? '&' : '?'}clientId=${clientId}&taxYear=${Y}`)
      : api(token, 'POST', `/api/bookkeeping${path}`, { clientId, taxYear: Y, ...body });
    const approveAllPrepared = async () => {
      const prepared = (await ledger(reviewerToken, 'GET', '/journal-entries?status=PREPARED')).body.entries;
      for (const e of prepared) expect((await ledger(reviewerToken, 'POST', `/journal-entries/${e.id}/approve`, { version: e.version })).body.entry.status).toBe('POSTED');
      return prepared.length;
    };
    const attest = (confirmed: string[]) => ({ confirmed, statement: 'Synthetic reviewer attestation for E2E testing only.' });
    const advance = async (token: string, fromStage: number, attestation?: unknown) => {
      const r = await api(token, 'POST', `/api/cases/${caseId}/advance`, { fromStage, version: caseVersion, attestation });
      if (r.status === 200) caseVersion = r.body.version;
      return r;
    };
    const blockedOn = async (token: string, stage: number, attestation?: unknown) => {
      const r = await advance(token, stage, attestation);
      expect(r.status, JSON.stringify(r.body)).toBe(409);
      return r.body.failedChecks as string[];
    };

    // Stage 04 (Record) is system-verified from the ledger: nothing posted yet.
    expect(await blockedOn(preparerToken, 4)).toContain('postedEntries');
    const chart = await ledger(bookkeeperToken, 'POST', '/chart-of-accounts/standard');
    expect(chart.status, JSON.stringify(chart.body)).toBeLessThan(300);
    const acct: Record<string, string> = Object.fromEntries(chart.body.accounts.map((a: any) => [a.accountNumber, a.id]));
    const bk = await liveSessionWithToken(bookkeeperToken, '/staff');
    const { page } = bk;
    const openLedger = async () => {
      await page.getByRole('button', { name: 'Ledger Workspace', exact: true }).first().click();
      await page.getByLabel('Authorized client').selectOption(clientId);
      await page.getByLabel('Tax year (2022+)').fill(String(Y));
      await sees(page, `Ledger workspace — ${clientId} / ${Y}`);
    };
    await openLedger();
    const form = page.locator('form', { has: page.getByRole('button', { name: 'Submit entry for review' }) });
    await form.getByLabel('Posting date').fill(`${Y}-03-15`);
    await form.getByLabel('Description').fill('Synthetic owner contribution');
    const lines = form.locator('fieldset');
    await selectAccount(lines.nth(0).getByLabel('Account'), '1010');
    await lines.nth(0).getByLabel('Debit', { exact: true }).fill('1000');
    await selectAccount(lines.nth(1).getByLabel('Account'), '3010');
    await lines.nth(1).getByLabel('Credit', { exact: true }).fill('1000');
    await form.getByRole('button', { name: 'Submit entry for review' }).click();
    await sees(page, 'Entry submitted for review.');
    // A prepared entry is not evidence: Record waits for the independent reviewer; the bookkeeper cannot approve.
    expect(await blockedOn(preparerToken, 4)).toEqual(expect.arrayContaining(['postedEntries', 'noEntriesAwaitingReview']));
    const pending = (await ledger(reviewerToken, 'GET', '/journal-entries?status=PREPARED')).body.entries[0];
    expect((await ledger(bookkeeperToken, 'POST', `/journal-entries/${pending.id}/approve`, { version: pending.version })).status).toBe(403);
    expect(await approveAllPrepared()).toBe(1);
    expect((await advance(preparerToken, 4)).body.activeStage).toBe(5);

    // Stage 05 (Reconcile): a categorized bank transaction and a closed, zero-variance reconciliation.
    expect(await blockedOn(preparerToken, 5)).toContain('closedReconciliation');
    await ledger(bookkeeperToken, 'POST', '/transactions/ingest', { accountId: acct['1010'], rawTransactions: [{ transactionDate: `${Y}-03-20`, description: 'Synthetic office supplies', amount: -42.5, externalTransactionId: 'journey-b-txn-1' }] });
    await page.reload(); await openLedger();
    await selectAccount(page.getByLabel('Account for Synthetic office supplies'), '6070');
    await page.getByRole('row', { name: /Synthetic office supplies/ }).getByRole('button', { name: 'Submit' }).click();
    await sees(page, 'Categorization submitted for review.');
    expect(await approveAllPrepared()).toBe(1);
    const recon = page.locator('form', { has: page.getByRole('button', { name: 'Start reconciliation' }) });
    await selectAccount(recon.getByLabel('Account'), '1010');
    await recon.getByLabel('Statement start').fill(`${Y}-03-01`);
    await recon.getByLabel('Statement end').fill(`${Y}-03-31`);
    await recon.getByLabel('Beginning balance').fill('0');
    await recon.getByLabel('Ending balance').fill('-42.50');
    await recon.getByRole('button', { name: 'Start reconciliation' }).click();
    await sees(page, 'Reconciliation started.');
    expect(await blockedOn(preparerToken, 5)).toEqual(expect.arrayContaining(['closedReconciliation', 'noReconciliationInProgress']));
    const r = (await ledger(bookkeeperToken, 'GET', '/reconciliations')).body.reconciliations.find((x: any) => x.status !== 'CLOSED');
    const txn = (await ledger(bookkeeperToken, 'GET', '/transactions')).body.transactions.find((t: any) => t.description === 'Synthetic office supplies');
    expect((await ledger(bookkeeperToken, 'POST', `/reconciliations/${r.id}/clear`, { transactionId: txn.id, isCleared: true })).status).toBeLessThan(300);
    await page.reload(); await openLedger();
    await page.getByRole('button', { name: 'Finalize' }).click();
    await sees(page, 'Reconciliation finalized.');
    expect(realErrors(bk)).toEqual([]);
    await bk.context.close();
    expect((await advance(preparerToken, 5)).body.activeStage).toBe(6);

    // Stage 06 (Review): the reviewer's attestation needs an approved book-to-tax workpaper.
    const review = attest(['workpapers_reviewed', 'no_unresolved_blocking_exceptions']);
    expect(await blockedOn(reviewerToken, 6, review)).toEqual(['approvedWorkpaperRecorded']);
    const b2t = (token: string, method: string, path: string, body?: unknown) => api(token, method, '/api/book-to-tax' + path, body);
    // Firm-wide tax categories are configured by an administrator (as in suite 03); managers are not given that route.
    const ADMIN = 'd0000000-0000-4000-8000-00000000000c';
    expect((await providerControl('/e2e/provider-user', { uid: ADMIN, email: `${ADMIN}@example.test`, password: 'Synthetic-durable-admin-1!', withFactor: true })).status).toBe(200);
    const admin = await durableSession(await providerToken(ADMIN));
    expect(admin.status, admin.body?.code).toBe(200);
    expect((await b2t(managerToken, 'POST', '/categories', { returnFamily: '1040', categoryCode: 'CASH', label: 'Cash (synthetic)' })).body.code).toBe('PRACTICE_MANAGER_CAPABILITY_DENIED');
    for (const [code, label] of [['CASH', 'Cash (synthetic)'], ['OWNER_EQUITY', 'Owner equity (synthetic)'], ['SUPPLIES', 'Supplies (synthetic)']])
      expect((await b2t(admin.body.token, 'POST', '/categories', { returnFamily: '1040', categoryCode: code, label })).status).toBe(200);
    const set = (await b2t(preparerToken, 'POST', `/clients/${clientId}/${Y}/1040/mapping-sets`)).body;
    for (const [num, cat] of [['1010', 'CASH'], ['3010', 'OWNER_EQUITY'], ['6070', 'SUPPLIES']])
      expect((await b2t(preparerToken, 'POST', `/clients/${clientId}/mapping-sets/${set.setId}/mappings`, { accountId: acct[num], categoryCode: cat })).status).toBeLessThan(300);
    await b2t(preparerToken, 'POST', `/clients/${clientId}/mapping-sets/${set.setId}/submit`);
    expect((await b2t(reviewerToken, 'POST', `/clients/${clientId}/mapping-sets/${set.setId}/approve`)).status).toBe(200);
    const wp = await b2t(preparerToken, 'POST', `/clients/${clientId}/${Y}/1040/workpapers`);
    expect(wp.body).toMatchObject({ reconciled: true });
    // A draft workpaper is not enough; its own maker-checker approval is.
    expect(await blockedOn(reviewerToken, 6, review)).toEqual(['approvedWorkpaperRecorded']);
    expect((await b2t(preparerToken, 'POST', `/clients/${clientId}/workpapers/${wp.body.workpaperId}/approve`)).status).toBeGreaterThanOrEqual(400);
    expect((await b2t(reviewerToken, 'POST', `/clients/${clientId}/workpapers/${wp.body.workpaperId}/approve`)).body.status).toBe('APPROVED');
    expect((await advance(reviewerToken, 6, review)).body.activeStage).toBe(7);

    // Stages 07 (Report) and 08 (Plan): attestations by the independent reviewer only.
    expect((await advance(preparerToken, 7, attest(['reports_reviewed_for_release']))).body.code).toBe('STAGE_ATTESTATION_REQUIRES_REVIEWER');
    expect(await blockedOn(reviewerToken, 7, attest([]))).toEqual(['reports_reviewed_for_release']);
    expect((await advance(reviewerToken, 7, attest(['reports_reviewed_for_release']))).body.activeStage).toBe(8);
    expect((await advance(reviewerToken, 8, attest(['planning_considerations_documented']))).body.activeStage).toBe(9);
    // Stage 09 stays blocked until a verified tax engine exists.
    const nine = await advance(reviewerToken, 9, attest([]));
    expect([nine.status, nine.body.code]).toEqual([409, 'STAGE_BLOCKED_VERIFIED_TAX_ENGINE_REQUIRED']);

    const detail = (await api(managerToken, 'GET', `/api/cases/${caseId}`)).body;
    expect(detail.stages.filter((x: any) => x.status === 'COMPLETED').map((x: any) => x.stage ?? x.stageNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // The client sees stage progress with counts only: no figures, no staff identities, no attestation text.
    const portal = await api(clientToken, 'GET', `/api/client-portal/clients/${clientId}/case-stages?engagementId=${encodeURIComponent(await engagementId())}&taxYear=${Y}`);
    expect(portal.status, JSON.stringify(portal.body)).toBe(200);
    expect(portal.body).toMatchObject({ caseExists: true, activeStage: 9 });
    // Timestamps are masked first: their fractional seconds can contain "1000" and are not figures.
    const portalText = JSON.stringify(portal.body).replace(/"\d{4}-\d{2}-\d{2}T[^"]*"/g, '"<time>"');
    expect(portalText).not.toMatch(/"\d{4}-\d{2}-\d{2}T/);
    const leak = /1000|42\.5|d0000000-0000-4000-8000-0000000000a[5-7]|Synthetic reviewer attestation/.exec(portalText);
    expect(leak ? portalText.slice(Math.max(0, leak.index - 80), leak.index + 80) : null).toBeNull();
  });

  it('the manager moves the case reviewer from the case workflow; a refused change keeps what was entered', async () => {
    const NEW_REVIEWER = 'd0000000-0000-4000-8000-0000000000a8';
    const eng = await engagementId();
    const team = async () => (await api(managerToken, 'GET', `/api/practice/clients/${clientId}`)).body.team as Array<{ assignmentId: string; role: string; userId: string }>;
    const revoke = async (userId: string) => {
      const row = (await team()).find(t => t.role === 'reviewer' && t.userId === userId)!;
      const r = await api(managerToken, 'POST', `/api/practice/clients/${clientId}/team/${row.assignmentId}/revoke`, { reason: 'Synthetic reviewer change for journey B' });
      expect(r.status, r.body?.code).toBeLessThan(300);
    };
    const assign = async (key: string) => {
      const r = await api(managerToken, 'POST', `/api/practice/clients/${clientId}/engagements/${eng}/team`, { taxYear: 2025, role: 'reviewer', userId: NEW_REVIEWER, reason: 'Synthetic reviewer change for journey B' }, key);
      expect(r.status, r.body?.code).toBeLessThan(300);
    };
    const m = await liveSessionWithToken(managerToken, '/staff');
    const { page } = m;
    await page.getByRole('button', { name: 'Case Workflow' }).first().click();
    await page.getByRole('button', { name: caseId.slice(0, 16) }).click();
    const form = page.getByRole('form', { name: 'Case team' });
    await form.waitFor();
    expect(await form.innerText()).toContain('tax year 2025');
    await sees(page, 'No one else holds the reviewer assignment');
    // The engagement's reviewer assignment moves to the new reviewer; the case still records the old one.
    await revoke(REVIEWER);
    await assign('journey-b-reviewer-a8');
    await form.getByRole('button', { name: 'Refresh team' }).click();
    await form.getByLabel('New reviewer').selectOption(NEW_REVIEWER);
    await page.getByLabel('Reason (recorded)').fill('Synthetic reassignment after a staffing change');
    // The assignment is withdrawn before submitting: the server refuses and the entries stay as they were.
    await revoke(NEW_REVIEWER);
    await form.getByRole('button', { name: 'Change case team' }).click();
    await sees(page, 'no longer holds this role');
    expect(await form.getByLabel('New reviewer').inputValue()).toBe(NEW_REVIEWER);
    expect(await page.getByLabel('Reason (recorded)').inputValue()).toBe('Synthetic reassignment after a staffing change');
    expect((await api(managerToken, 'GET', `/api/cases/${caseId}`)).body.case.reviewerUid).toBe(REVIEWER);
    // With the assignment restored, the same entries succeed.
    await assign('journey-b-reviewer-a8-again');
    await form.getByRole('button', { name: 'Change case team' }).click();
    await sees(page, 'Case team updated.');
    await sees(page, `Reviewer ${NEW_REVIEWER}`);
    expect((await api(managerToken, 'GET', `/api/cases/${caseId}`)).body.case.reviewerUid).toBe(NEW_REVIEWER);
    // The former reviewer no longer reaches the case; a non-manager cannot restaff.
    expect((await api(reviewerToken, 'GET', `/api/cases/${caseId}`)).status).toBe(404);
    const version = (await api(managerToken, 'GET', `/api/cases/${caseId}`)).body.case.version;
    expect((await api(preparerToken, 'POST', `/api/cases/${caseId}/team`, { role: 'reviewer', userId: REVIEWER, version, reason: 'Synthetic attempt by the preparer' })).status).toBe(403);
    expect(realErrors(m)).toEqual([]);
    await m.context.close();
  });

  it('the manager adds a tax year and records, meets and waives deadlines from the client view', async () => {
    const m = await liveSessionWithToken(managerToken, '/staff');
    const { page } = m;
    await page.getByRole('button', { name: 'Clients & Engagements' }).first().click();
    await page.getByRole('button', { name: new RegExp(NEW_UID) }).click();
    const year = page.getByRole('form', { name: `Add tax year to ${ENGAGEMENT}` });
    await year.getByLabel('Add tax year').fill('2026');
    await year.getByRole('button', { name: 'Add year' }).click();
    await sees(page, 'Tax year added.');
    await sees(page, /tax years 2025, 2026/);
    // A statutory deadline needs its citation before it can be recorded.
    const add = page.getByRole('form', { name: 'Add a deadline' });
    await add.getByLabel('Deadline').fill('Synthetic statutory filing deadline');
    await add.getByLabel('Category').selectOption('filing');
    await add.getByLabel('Due date').fill('2026-04-15');
    await add.getByLabel('Authority').selectOption('STATUTORY');
    await add.getByLabel('Tax year (optional)').fill('2025');
    expect(await add.getByRole('button', { name: 'Add deadline' }).isDisabled()).toBe(true);
    await add.getByLabel(/Source citation/).fill('Synthetic statutory citation 1');
    await add.getByRole('button', { name: 'Add deadline' }).click();
    await sees(page, 'Deadline recorded.');
    await add.getByLabel('Deadline').fill('Synthetic internal review checkpoint');
    await add.getByLabel('Category').selectOption('review');
    await add.getByLabel('Due date').fill('2026-03-01');
    await add.getByRole('button', { name: 'Add deadline' }).click();
    await sees(page, 'Deadline recorded.');
    const deadlines = page.getByRole('table', { name: 'Client deadlines' });
    const statutory = deadlines.getByRole('row', { name: /Synthetic statutory filing deadline/ });
    const internal = deadlines.getByRole('row', { name: /Synthetic internal review checkpoint/ });
    expect(await statutory.innerText()).toMatch(/statutory · Synthetic statutory citation 1/);
    // Statutory deadlines are never waivable; the internal one is waived with a recorded reason.
    expect(await statutory.getByRole('button', { name: 'Waive' }).count()).toBe(0);
    const internalId = (await api(managerToken, 'GET', `/api/practice/clients/${clientId}`)).body.deadlines.find((x: any) => x.title === 'Synthetic internal review checkpoint').deadlineId;
    expect((await api(preparerToken, 'POST', `/api/practice/clients/${clientId}/deadlines/${internalId}/resolve`, { status: 'WAIVED', reason: 'Synthetic preparer waiver' })).status).toBeGreaterThanOrEqual(400);
    await page.getByLabel(/Reason for waiving a deadline/).fill('Synthetic checkpoint no longer needed');
    await internal.getByRole('button', { name: 'Waive' }).click();
    await sees(page, 'Deadline waived.');
    await statutory.getByRole('button', { name: 'Mark met' }).click();
    await sees(page, 'Deadline marked met.');
    const after = (await api(managerToken, 'GET', `/api/practice/clients/${clientId}`)).body.deadlines;
    expect(after.filter((x: any) => x.title.startsWith('Synthetic ')).map((x: any) => [x.title, x.status]).sort())
      .toEqual([['Synthetic internal review checkpoint', 'WAIVED'], ['Synthetic statutory filing deadline', 'MET']]);
    expect(realErrors(m)).toEqual([]);
    await m.context.close();
  });
});

/** Selects the option whose text contains the account number (the ledger account pickers show "1010 · Cash"). */
async function selectAccount(select: import('playwright-core').Locator, number: string) {
  const value = await select.evaluate((el, n) => [...(el as HTMLSelectElement).options].find(o => o.textContent?.includes(n))?.value ?? '', number);
  await select.selectOption(value);
}
