import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';

// Durable Stage 01 onboarding (proposal 20261018030000) on a real PostgreSQL server with independent
// connections. The consent version used here is SYNTHETIC test data inserted as the database owner; no
// real consent wording is approved by this suite. Synthetic data only.
const T = 'tenantOnb', OTHER = 'tenantOnbOther';
let db: TestDatabase; let C = ''; let C2 = '';
const call = async (fn: string, args: Record<string, unknown>) => {
  const r = await pgRpc(db.pool).rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
  return r.data as any;
};
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e.code);
// The stored onboarding row keeps only the TIN type and last four. Checked field by field: the full TIN (either form)
// appears in no value, and the rejected last four (6789) appears in no value other than timestamps, whose microseconds
// can contain any digits.
const expectOnlyMaskedTin = (row: Record<string, unknown>) => {
  expect(row.tin_type).toBe('SSN');
  expect(row.tin_last4).toBe('4321');
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    expect(text, key).not.toMatch(/123456789|123-45-6789/);
    if (!key.endsWith('_at')) expect(text, key).not.toMatch(/6789/);
  }
};
const get = (client: string, actor: string, tenant = T) => call('taxguard_onb_get', { p_tenant: tenant, p_client: client, p_actor: actor });
const save = (client: string, actor: string, revision: number, fields: Record<string, unknown>) =>
  call('taxguard_onb_save', { p_tenant: T, p_client: client, p_actor: actor, p_revision: revision, p_fields: fields });
const submit = (client: string, actor: string, revision: number, version = 'SYNTHETIC-TEST-1', signer = 'Synthetic Signer') =>
  call('taxguard_onb_submit', { p_tenant: T, p_client: client, p_actor: actor, p_revision: revision, p_consent_version: version, p_signer: signer });
const decide = (client: string, actor: string, revision: number, decision: string, reason: string | null = null, note: string | null = null, override = false) =>
  call('taxguard_onb_decide', { p_tenant: T, p_client: client, p_actor: actor, p_revision: revision, p_decision: decision, p_client_reason: reason, p_internal_note: note, p_duplicate_override: override });
const ready = (client: string, tenant = T) => call('taxguard_onb_client_ready', { p_tenant: tenant, p_client: client });
const audit = async (action: string) => (await db.pool.query('SELECT actor_uid, metadata FROM taxguard_audit_log WHERE tenant_id = $1 AND action = $2 ORDER BY "timestamp"', [T, action])).rows;
const identityDoc = (client: string, status: string, id: string) => db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, version, hash, mime_type, status, category, created_by)
  VALUES ($1, $2, $3, 'onb-engagement', 2025, 1, repeat('a', 64), 'application/pdf', $4, 'identity', 'onb-seed')`, [id, T, client, status]);
const COMPLETE = { taxpayerType: 'individual', legalName: 'Synthetic Onboarding Person', street: '1 Synthetic Way', city: 'Columbia', state: 'SC', postalCode: '29201', tinType: 'SSN', tinLast4: '4321' };

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic onboarding practice'), ('${OTHER}', 'Other synthetic practice');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'onb-mgr', 'practice_manager', 'active'), ('${T}', 'onb-mgr2', 'admin', 'active'),
      ('${T}', 'onb-acct', 'accountant', 'active'), ('${OTHER}', 'onb-foreign', 'practice_manager', 'active');`);
  for (const uid of ['onb-client', 'onb-client2']) {
    const r = await pgRpc(db.pool).rpc('taxguard_provision_client_identity', { p_tenant: T, p_uid: uid, p_email: `${uid}@example.test`, p_name: 'Synthetic Client' });
    expect(r.error).toBeNull();
    if (uid === 'onb-client') C = r.data.clientId; else C2 = r.data.clientId;
  }
});
afterAll(async () => { await db?.stop(); });

describe('reading onboarding', () => {
  it('the client sees a blank draft with server-derived requirements and no staff fields; others are refused', async () => {
    const v = await get(C, 'onb-client');
    expect(v).toMatchObject({ clientId: C, status: 'DRAFT', revision: 0, consent: null,
      requirements: { profile: false, tin: false, address: false, representative: false, identityDocument: false, consentAvailable: false } });
    for (const key of ['ownerUid', 'decidedBy', 'internalNote', 'possibleDuplicates', 'duplicateDecision']) expect(v).not.toHaveProperty(key);
    expect(await code(get(C, 'onb-client2'))).toBe('PRACTICE_ACCESS_DENIED');
    expect(await code(get(C, 'onb-acct'))).toBe('CLIENT_NOT_FOUND');
    expect(await code(get(C, 'onb-foreign', OTHER))).toBe('CLIENT_NOT_FOUND');
    expect(await code(get(C, 'onb-foreign'))).toBe('PRACTICE_ACCESS_DENIED');
    expect(await get(C, 'onb-mgr')).toMatchObject({ clientId: C, ownerUid: 'onb-client', possibleDuplicates: [] });
    expect(await ready(C)).toBe(false);
  });
});

describe('client draft and submission', () => {
  it('stores only the TIN type and last four, refuses browser flags, unknown fields and stale revisions', async () => {
    expect(await code(save(C, 'onb-client', 0, { tinLast4: '123456789' }))).toBe('ONBOARDING_FULL_TIN_REFUSED');
    expect(await code(save(C, 'onb-client', 0, { tinLast4: '123-45-6789' }))).toBe('ONBOARDING_FULL_TIN_REFUSED');
    expect(await code(save(C, 'onb-client', 0, { tinLast4: '0000' }))).toBe('ONBOARDING_INPUT_INVALID');
    for (const forged of [{ identityComplete: true }, { tinValid: true }, { consentComplete: true }, { status: 'APPROVED' }, { supportingDocumentsComplete: true }])
      expect(await code(save(C, 'onb-client', 0, forged))).toBe('ONBOARDING_INPUT_INVALID');
    expect(await code(save(C, 'onb-mgr', 0, { legalName: 'Staff edit' }))).toBe('ONBOARDING_CLIENT_REQUIRED');
    expect(await code(save(C, 'onb-client2', 0, { legalName: 'Other client edit' }))).toBe('ONBOARDING_CLIENT_REQUIRED');
    const first = await save(C, 'onb-client', 0, { taxpayerType: 'individual', legalName: 'Synthetic Onboarding Person' });
    expect(first).toMatchObject({ revision: 1, status: 'DRAFT', requirements: { profile: true, tin: false } });
    expect(await code(save(C, 'onb-client', 0, { city: 'Columbia' }))).toBe('ONBOARDING_VERSION_CONFLICT');
    const second = await save(C, 'onb-client', 1, { street: '1 Synthetic Way', city: 'Columbia', state: 'sc', postalCode: '29201', tinType: 'SSN', tinLast4: '4321' });
    expect(second).toMatchObject({ revision: 2, tinMasked: '***-**-4321', address: { state: 'SC' }, requirements: { profile: true, tin: true, address: true, representative: true } });
    const stored = (await db.pool.query('SELECT row_to_json(o) AS r FROM taxguard_client_onboarding o WHERE client_id = $1', [C])).rows[0].r;
    expectOnlyMaskedTin(stored);
  });

  it('checks the stored row precisely: an unrelated timestamp containing 6789 is not a TIN leak', async () => {
    // The whole-row regex this replaced failed on CI when a microsecond timestamp happened to contain 6789.
    await db.pool.query(`UPDATE taxguard_client_onboarding SET updated_at = '2026-01-01 12:00:00.456789+00' WHERE client_id = $1`, [C]);
    const stored = (await db.pool.query('SELECT row_to_json(o) AS r FROM taxguard_client_onboarding o WHERE client_id = $1', [C])).rows[0].r;
    expect(JSON.stringify(stored)).toMatch(/6789/);
    expectOnlyMaskedTin(stored);
    // And a genuine leak in any field is still caught.
    expect(() => expectOnlyMaskedTin({ ...stored, internal_note: 'TIN 123-45-6789' })).toThrow();
    expect(() => expectOnlyMaskedTin({ ...stored, legal_name: 'Person 123456789' })).toThrow();
    expect(() => expectOnlyMaskedTin({ ...stored, tin_last4: '6789' })).toThrow();
  });

  it('cannot submit without an approved consent version (the state of this proposal) or with missing fields', async () => {
    expect(await code(submit(C, 'onb-client', 2))).toBe('ONBOARDING_CONSENT_NOT_APPROVED');
    expect(await code(submit(C2, 'onb-client2', 0))).toBe('ONBOARDING_VERSION_CONFLICT');
    await save(C2, 'onb-client2', 0, { taxpayerType: 'entity', legalName: 'Synthetic Onboarding Person' });
    // An entity needs a representative before it can be submitted.
    await db.pool.query(`INSERT INTO taxguard_onb_consent_versions(tenant_id, version, consent_text, approved_by, approved_at, status) VALUES
      ('${T}', 'SYNTHETIC-TEST-1', repeat('Synthetic test consent wording only, not legal text. ', 3), 'Synthetic test fixture', now(), 'APPROVED')`);
    expect(await code(submit(C2, 'onb-client2', 1))).toBe('ONBOARDING_INCOMPLETE');
    expect(await code(submit(C, 'onb-client', 2, 'NOT-A-VERSION'))).toBe('ONBOARDING_CONSENT_NOT_APPROVED');
    expect(await code(submit(C, 'onb-client', 2, 'SYNTHETIC-TEST-1', 'ab'))).toBe('ONBOARDING_INPUT_INVALID');
    expect(await code(submit(C, 'onb-mgr', 2))).toBe('ONBOARDING_CLIENT_REQUIRED');
  });

  it('submits against the approved version, records the consent fingerprint and locks editing', async () => {
    const v = await submit(C, 'onb-client', 2);
    expect(v).toMatchObject({ status: 'SUBMITTED', revision: 3, consentVersion: 'SYNTHETIC-TEST-1', consentSigner: 'Synthetic Signer' });
    expect((await get(C, 'onb-mgr')).consentTextSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await code(save(C, 'onb-client', 3, { city: 'Charleston' }))).toBe('ONBOARDING_NOT_EDITABLE');
    expect(await audit('ONBOARDING_SUBMITTED')).toEqual([expect.objectContaining({ actor_uid: 'onb-client' })]);
    expect(await ready(C)).toBe(false);
  });
});

describe('staff decision', () => {
  it('only a manager or administrator decides; approval needs a staff-verified identity document', async () => {
    expect(await code(decide(C, 'onb-acct', 3, 'approve'))).toBe('CLIENT_NOT_FOUND');
    expect(await code(decide(C, 'onb-client', 3, 'approve'))).toBe('PRACTICE_ACCESS_DENIED');
    expect(await code(decide(C, 'onb-foreign', 3, 'approve'))).toBe('PRACTICE_ACCESS_DENIED');
    expect(await code(decide(C, 'onb-mgr', 3, 'approve'))).toBe('ONBOARDING_IDENTITY_DOCUMENT_REQUIRED');
    await identityDoc(C, 'PENDING_REVIEW', 'onb-id-pending'); // uploaded and scanned, but not yet verified by staff
    expect(await code(decide(C, 'onb-mgr', 3, 'approve'))).toBe('ONBOARDING_IDENTITY_DOCUMENT_REQUIRED');
  });

  it('a change request returns it to the client with a client-safe reason and no internal note', async () => {
    expect(await code(decide(C, 'onb-mgr', 3, 'request_changes'))).toBe('ONBOARDING_REASON_REQUIRED');
    const staffView = await decide(C, 'onb-mgr', 3, 'request_changes', 'Please confirm the street address.', 'ONB-PRIVATE address looked inconsistent');
    expect(staffView).toMatchObject({ status: 'CHANGES_REQUESTED', internalNote: 'ONB-PRIVATE address looked inconsistent', decidedBy: 'onb-mgr' });
    const clientView = await get(C, 'onb-client');
    expect(clientView).toMatchObject({ status: 'CHANGES_REQUESTED', clientReason: 'Please confirm the street address.' });
    expect(JSON.stringify(clientView)).not.toMatch(/ONB-PRIVATE|onb-mgr|internalNote|decidedBy/);
    const notices = (await db.pool.query('SELECT kind, title, request_id FROM taxguard_client_notifications WHERE tenant_id = $1 AND client_id = $2', [T, C])).rows;
    expect(notices).toEqual([{ kind: 'ONBOARDING_CHANGES_REQUESTED', title: 'Your onboarding needs changes', request_id: null }]);
    const edited = await save(C, 'onb-client', 4, { street: '2 Synthetic Way' });
    expect(edited.status).toBe('CHANGES_REQUESTED');
    expect((await submit(C, 'onb-client', 5)).status).toBe('SUBMITTED');
    expect((await get(C, 'onb-client')).clientReason).toBeNull();
  });

  it('approval with a verified identity document completes onboarding and unlocks Stage 02 for that client only', async () => {
    await identityDoc(C, 'VERIFIED', 'onb-id-verified');
    const [a, b] = await Promise.all([decide(C, 'onb-mgr', 6, 'approve').then(v => v, e => e), decide(C, 'onb-mgr2', 6, 'approve').then(v => v, e => e)]);
    const outcomes = [a, b].map(x => x instanceof Error ? (x as any).code : x.status).sort();
    expect(outcomes).toEqual(['APPROVED', 'ONBOARDING_VERSION_CONFLICT']);
    expect(await get(C, 'onb-client')).toMatchObject({ status: 'APPROVED', revision: 7 });
    const identity = (await db.pool.query("SELECT user_data FROM taxguard_identities WHERE uid = 'onb-client'")).rows[0].user_data;
    expect(identity.onboardingStatus).toBe('COMPLETED');
    expect(identity.onboardingCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    expect(await ready(C)).toBe(true);
    expect(await ready(C2)).toBe(false);
    expect(await ready(C, OTHER)).toBe(false);
    // The provisioning contract still accepts the identity after approval (the client can sign in again).
    const again = await pgRpc(db.pool).rpc('taxguard_provision_client_identity', { p_tenant: T, p_uid: 'onb-client', p_email: 'onb-client@example.test', p_name: 'Synthetic Client' });
    expect(again.error).toBeNull();
    expect(again.data).toMatchObject({ clientId: C, resumed: true, user: { onboardingStatus: 'COMPLETED' } });
    expect(await code(decide(C, 'onb-mgr', 7, 'approve'))).toBe('ONBOARDING_NOT_SUBMITTED');
    expect(await audit('ONBOARDING_APPROVED')).toHaveLength(1);
    // One approval notice for this client only; the losing concurrent decision wrote nothing.
    expect((await db.pool.query("SELECT kind, title FROM taxguard_client_notifications WHERE tenant_id = $1 AND client_id = $2 AND kind = 'ONBOARDING_APPROVED'", [T, C])).rows)
      .toEqual([{ kind: 'ONBOARDING_APPROVED', title: 'Your onboarding was approved' }]);
    expect((await db.pool.query('SELECT count(*)::int AS n FROM taxguard_client_notifications WHERE client_id = $1', [C2])).rows[0].n).toBe(0);
    // The widened kind list still holds every earlier kind and refuses unknown ones.
    expect(await code(db.pool.query(`INSERT INTO taxguard_client_notifications(tenant_id, client_id, kind, title, created_by) VALUES ('${T}', '${C}', 'NOT_A_KIND', 'x', 'onb-seed')`).then(() => {}, e => { throw Object.assign(e, { code: 'CHECK' }); }))).toBe('CHECK');
  });

  it('a possible duplicate needs an explicit, reasoned override; a retired consent version blocks approval', async () => {
    await save(C2, 'onb-client2', 1, { street: '9 Synthetic Road', city: 'Columbia', state: 'SC', postalCode: '29201', repName: 'Synthetic Officer', repTitle: 'President', tinType: 'EIN', tinLast4: '4321' });
    expect((await submit(C2, 'onb-client2', 2)).status).toBe('SUBMITTED');
    await identityDoc(C2, 'VERIFIED', 'onb-id-c2');
    const staff = await get(C2, 'onb-mgr');
    expect(staff.possibleDuplicates).toEqual([C]);
    expect((await call('taxguard_onb_queue', { p_tenant: T, p_actor: 'onb-mgr' }))).toEqual([expect.objectContaining({ clientId: C2, possibleDuplicates: 1, identityDocument: true })]);
    expect(await code(call('taxguard_onb_queue', { p_tenant: T, p_actor: 'onb-acct' }))).toBe('PRACTICE_MANAGER_REQUIRED');
    expect(await code(decide(C2, 'onb-mgr', 3, 'approve'))).toBe('ONBOARDING_DUPLICATE_REVIEW_REQUIRED');
    expect(await code(decide(C2, 'onb-mgr', 3, 'approve', null, 'same', true))).toBe('ONBOARDING_DUPLICATE_REVIEW_REQUIRED');
    await db.pool.query(`UPDATE taxguard_onb_consent_versions SET status = 'RETIRED' WHERE tenant_id = '${T}'`);
    expect(await code(decide(C2, 'onb-mgr', 3, 'approve', null, 'Different entity; confirmed by phone.', true))).toBe('ONBOARDING_CONSENT_NOT_APPROVED');
    await db.pool.query(`UPDATE taxguard_onb_consent_versions SET status = 'APPROVED' WHERE tenant_id = '${T}'`);
    const approved = await decide(C2, 'onb-mgr', 3, 'approve', null, 'Different entity; confirmed by phone.', true);
    expect(approved).toMatchObject({ status: 'APPROVED', duplicateDecision: 'OVERRIDE_APPROVED' });
    expect(await ready(C2)).toBe(true);
  });

  it('simultaneous saves with the same revision: exactly one wins', async () => {
    const r = await pgRpc(db.pool).rpc('taxguard_provision_client_identity', { p_tenant: T, p_uid: 'onb-client3', p_email: 'onb-client3@example.test', p_name: 'Synthetic Client' });
    const c3 = r.data.clientId;
    const results = await Promise.all(['Alpha Person', 'Beta Person', 'Gamma Person'].map(n => code(save(c3, 'onb-client3', 0, { legalName: n }))));
    expect(results.sort()).toEqual(['OK', 'ONBOARDING_VERSION_CONFLICT', 'ONBOARDING_VERSION_CONFLICT']);
    expect((await get(c3, 'onb-client3')).revision).toBe(1);
  });

  it('application roles cannot write consent versions or onboarding rows directly', async () => {
    for (const table of ['taxguard_onb_consent_versions', 'taxguard_client_onboarding'])
      for (const role of ['anon', 'authenticated', 'service_role'])
        expect((await db.pool.query(`SELECT has_table_privilege($1, $2, 'INSERT,UPDATE,DELETE') AS w, has_table_privilege($1, $2, 'SELECT') AS r`, [role, `public.${table}`])).rows[0], `${role} ${table}`)
          .toEqual({ w: false, r: false });
  });
});
