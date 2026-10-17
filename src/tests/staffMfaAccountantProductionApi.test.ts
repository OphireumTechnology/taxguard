import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Step 1: production-compatible Accountant API and mandatory staff MFA (AAL2).
 * Drives the real production app (createProductionApp) with durable sessions read from an
 * in-memory stand-in for the Supabase query builder. Synthetic identities, tenants and cases only.
 */
vi.mock('../server/supabase', async importOriginal => ({ ...(await importOriginal<typeof import('../server/supabase')>()), isSupabaseServerConfigured: () => true }));
import { setSupabaseAdmin } from '../server/supabase';
import { createProductionApp } from '../server/productionApp';
import { SupabaseDurableSessions } from '../server/supabase-db';
import { requiresStaffMfa, staffMfaDenial, verifiedTokenAssuranceLevel } from '../server/staffMfa';
import { FEDERAL_FORMS } from '../taxForms/federalForms';

type Row = Record<string, any>;
function fakeSupabase(tables: Record<string, Row[]>, failing: Set<string> = new Set(), failingInserts: Set<string> = new Set()) {
  return {
    auth: { admin: { mfa: { listFactors: async () => ({ data: { factors: [] }, error: null }) } } },
    rpc: async (name: string, input: Row) => {
      if (name !== 'taxguard_create_session') return { data:null,error:{code:'42883'} };
      if (failingInserts.has('taxguard_sessions') || failingInserts.has('taxguard_audit_log')) return { data:null,error:{code:'08006'} };
      const member = tables.taxguard_members.find(row=>row.tenant_id===input.p_tenant && row.uid===input.p_uid && row.status==='active');
      const identity = tables.taxguard_identities.find(row=>row.tenant_id===input.p_tenant && row.uid===input.p_uid);
      if (!member || !identity || identity.user_data.role!==member.role || identity.user_data.status!=='active') return { data:null,error:{code:'P0001',message:'SESSION_AUTHORITY_DENIED'} };
      tables.taxguard_sessions.push({tenant_id:input.p_tenant,uid:input.p_uid,session_token_hash:input.p_token_hash,auth_time:input.p_auth_time,expires_at:input.p_expires_at,aal:input.p_aal,revoked:false});
      tables.taxguard_audit_log.push({tenant_id:input.p_tenant,actor_uid:input.p_uid,actor_role:member.role,action:'SESSION_CREATED'});
      return {data:{created:true},error:null};
    },
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let patch: Row | null = null;
      const rows = () => (tables[table] ??= []).filter(r => filters.every(f => f(r)));
      const err = () => (failing.has(table) ? { message: 'synthetic read failure' } : null);
      const builder: any = {
        select: () => builder,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return builder; },
        in: (k: string, vs: unknown[]) => { filters.push(r => vs.includes(r[k])); return builder; },
        maybeSingle: async () => (err() ? { data: null, error: err() } : { data: rows()[0] ? { ...rows()[0] } : null, error: null }),
        update: (p: Row) => { patch = p; return builder; },
        insert: async (r: Row) => {
          if (failingInserts.has(table)) return { data: null, error: { message: 'synthetic write failure' } };
          (tables[table] ??= []).push(r); return { data: null, error: null };
        },
        then: (resolve: any, reject: any) => {
          if (patch) { for (const r of rows()) Object.assign(r, patch); return Promise.resolve({ data: null, error: null }).then(resolve, reject); }
          return Promise.resolve(err() ? { data: null, error: err() } : { data: rows().map(r => ({ ...r })), error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  } as any;
}

const TENANT = 'tenant-step1';
const OTHER = 'tenant-step1-other';
const past = new Date(Date.now() - 86_400_000).toISOString();
const hash = (t: string) => createHash('sha256').update(t).digest('hex');
let tables: Record<string, Row[]>;
let failing: Set<string>;
let server: Server, origin: string;

function person(uid: string, role: string, opts: { tenant?: string; status?: string; userDataRole?: string } = {}) {
  const tenant = opts.tenant ?? TENANT;
  tables.taxguard_identities.push({ uid, tenant_id: tenant, user_data: { id: uid, email: `${uid}@example.invalid`, name: uid, role: opts.userDataRole ?? role, status: 'active' } });
  tables.taxguard_members.push({ tenant_id: tenant, uid, role, status: opts.status ?? 'active', client_id: '' });
}
function sessionFor(uid: string, aal: 'aal1' | 'aal2' | undefined, tenant = TENANT) {
  const token = 'tg_live_' + randomBytes(32).toString('hex');
  tables.taxguard_sessions.push({ session_token_hash: hash(token), uid, tenant_id: tenant, revoked: false, expires_at: Date.now() + 3_600_000, auth_time: 1, ...(aal ? { aal } : {}) });
  return token;
}
function grant(uid: string, clientId: string, tenant = TENANT) {
  tables.taxguard_staff_assignments.push({ tenant_id: tenant, client_id: clientId, user_id: uid, status: 'ACTIVE', engagement_id: null, tax_year: null, effective_from: past, effective_to: null });
}
function caseRow(clientId: string, preparer: string, opts: { tenant?: string; year?: number; stage?: number } = {}) {
  const tenant = opts.tenant ?? TENANT;
  tables.taxguard_cases.push({ case_id: `case-${clientId}-${opts.year ?? 2025}`, tenant_id: tenant, client_id: clientId, engagement_id: `eng-${clientId}`, tax_year: opts.year ?? 2025, status: 'ACTIVE', active_stage: opts.stage ?? 4, preparer_uid: preparer, open_exceptions: 0 });
  tables.taxguard_clients.push({ tenant_id: tenant, client_id: clientId, name: `Synthetic ${clientId}` });
  tables.taxguard_engagements.push({ tenant_id: tenant, client_id: clientId, engagement_id: `eng-${clientId}`, title: 'Synthetic individual return' });
}
const get = async (path: string, token?: string, extraHeaders: Record<string, string> = {}) => {
  const r = await fetch(origin + path, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders } });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('TAXGUARD_TENANT_ID', TENANT);
  server = createServer(createProductionApp());
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); vi.unstubAllEnvs(); });
beforeEach(() => {
  failing = new Set();
  tables = { taxguard_sessions: [], taxguard_identities: [], taxguard_members: [], taxguard_staff_assignments: [], taxguard_cases: [], taxguard_clients: [], taxguard_engagements: [], taxguard_audit_log: [] };
  setSupabaseAdmin(fakeSupabase(tables, failing));
});

describe('staff MFA policy (unit)', () => {
  const jwt = (claims: object) => ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');
  it('treats every non-client role as staff', () => {
    for (const role of ['accountant', 'reviewer', 'bookkeeper', 'admin', 'super_admin', 'operations']) expect(requiresStaffMfa(role)).toBe(true);
    for (const role of ['client', 'prospective_client', undefined]) expect(requiresStaffMfa(role as any)).toBe(false);
  });
  it('reads the assurance level only from a verified token payload, defaulting to aal1', () => {
    expect(verifiedTokenAssuranceLevel(jwt({ aal: 'aal2' }))).toBe('aal2');
    expect(verifiedTokenAssuranceLevel(jwt({ aal: 'aal1' }))).toBe('aal1');
    for (const bad of ['', 'not-a-jwt', 'a.%%%.c', jwt({ aal: 'AAL2' })]) expect(verifiedTokenAssuranceLevel(bad)).toBe('aal1');
  });
  it('requires an enrolled factor and AAL2 for staff, nothing for clients', () => {
    expect(staffMfaDenial('accountant', { aal: 'aal2', verifiedFactorCount: 0 })).toBe('STAFF_MFA_ENROLLMENT_REQUIRED');
    expect(staffMfaDenial('accountant', { aal: 'aal1', verifiedFactorCount: 1 })).toBe('STAFF_MFA_REQUIRED');
    expect(staffMfaDenial('accountant', { aal: 'aal2', verifiedFactorCount: 1 })).toBeNull();
    expect(staffMfaDenial('client', { aal: 'aal1', verifiedFactorCount: 0 })).toBeNull();
  });
});

describe('durable session creation enforces staff MFA', () => {
  const verified = (over: object = {}) => ({ uid: 'acct-1', email: 'acct-1@example.invalid', displayName: 'Synthetic', authTime: Math.floor(Date.now() / 1000), ...over });
  it.each([
    ['no enrolled factor', { aal: 'aal2', verifiedFactorCount: 0 }, 'STAFF_MFA_ENROLLMENT_REQUIRED'],
    ['password only (AAL1)', { aal: 'aal1', verifiedFactorCount: 1 }, 'STAFF_MFA_REQUIRED'],
    ['assurance level missing', {}, 'STAFF_MFA_ENROLLMENT_REQUIRED'],
  ])('refuses a staff session with %s and writes no session row', async (_label, over, code) => {
    person('acct-1', 'accountant');
    await expect(new SupabaseDurableSessions(fakeSupabase(tables), TENANT).create(verified(over) as any)).rejects.toMatchObject({ code });
    expect(tables.taxguard_sessions).toHaveLength(0);
    expect(tables.taxguard_audit_log.map(a => a.action)).toContain(code);
  });
  it('records AAL2 on the session row of an MFA-verified staff sign-in', async () => {
    person('acct-1', 'accountant');
    const s = await new SupabaseDurableSessions(fakeSupabase(tables), TENANT).create(verified({ aal: 'aal2', verifiedFactorCount: 1 }) as any);
    expect(s.token).toMatch(/^tg_live_[0-9a-f]{64}$/);
    expect(tables.taxguard_sessions[0]).toMatchObject({ uid: 'acct-1', aal: 'aal2' });
  });
  it('does not report a session as created when the session row cannot be stored', async () => {
    person('acct-1', 'accountant');
    const client = fakeSupabase(tables, new Set(), new Set(['taxguard_sessions']));
    await expect(new SupabaseDurableSessions(client, TENANT).create(verified({ aal: 'aal2', verifiedFactorCount: 1 }) as any)).rejects.toMatchObject({ code: 'SESSION_STORE_UNAVAILABLE' });
  });
});

describe('every staff API request requires an AAL2 session', () => {
  it.each([['aal1', 'aal1'], ['missing (pre-migration row)', undefined]] as const)('rejects an accountant session whose level is %s', async (_l, aal) => {
    person('acct-1', 'accountant'); grant('acct-1', 'c-1'); caseRow('c-1', 'acct-1');
    for (const path of ['/api/accountant/dashboard', '/api/tax-forms']) {
      const r = await get(path, sessionFor('acct-1', aal as any));
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('STAFF_MFA_REQUIRED');
      expect(JSON.stringify(r.body)).not.toContain('Synthetic c-1');
    }
  });
  it('does not require MFA from clients (role checks still apply)', async () => {
    person('client-1', 'client');
    tables.taxguard_clients.push({ tenant_id: TENANT, client_id: 'client-1', owner_uid: 'client-1', name: 'Synthetic client' });
    const r = await get('/api/accountant/dashboard', sessionFor('client-1', 'aal1'));
    expect(r.status).toBe(403);
    expect(r.body.code).not.toBe('STAFF_MFA_REQUIRED');
  });
});

describe('Accountant dashboard API: role, tenant and assignment isolation', () => {
  it('returns only the accountant’s own, granted, same-tenant cases from the durable store', async () => {
    person('acct-1', 'accountant'); person('acct-2', 'accountant');
    grant('acct-1', 'c-1'); grant('acct-1', 'c-2');
    caseRow('c-1', 'acct-1', { stage: 9 });       // returned
    caseRow('c-2', 'acct-2');                       // granted client, but another preparer
    caseRow('c-3', 'acct-1');                       // own case, but no current grant
    caseRow('c-4', 'acct-1', { tenant: OTHER });    // other tenant
    caseRow('c-5', 'acct-1', { year: 2021 });       // before supported years
    const r = await get('/api/accountant/dashboard', sessionFor('acct-1', 'aal2'));
    expect(r.status).toBe(200);
    expect(r.body.source).toBe('durable');
    expect(r.body.unavailableFields).toEqual(['dueDate', 'priority', 'documents']);
    expect(r.body.cases.map((c: any) => c.clientId)).toEqual(['c-1']);
    expect(r.body.cases[0]).toMatchObject({ tenantId: TENANT, activeStage: 9, priority: '', documents: [], clientName: 'Synthetic c-1' });
    expect(r.body.cases[0]).not.toHaveProperty('dueDate');
  });
  it('ignores client-supplied tenant and role hints', async () => {
    person('acct-1', 'accountant'); grant('acct-1', 'c-1'); caseRow('c-1', 'acct-1'); caseRow('c-9', 'acct-1', { tenant: OTHER });
    const r = await get(`/api/accountant/dashboard?tenantId=${OTHER}&role=admin`, sessionFor('acct-1', 'aal2'), { 'x-tenant-id': OTHER, 'x-role': 'admin' });
    expect(r.body.cases.map((c: any) => c.clientId)).toEqual(['c-1']);
  });
  it('takes the role from the membership, not from stored profile data (no escalation)', async () => {
    person('acct-1', 'client', { userDataRole: 'accountant' });
    tables.taxguard_clients.push({ tenant_id: TENANT, client_id: 'acct-1-client', owner_uid: 'acct-1', name: 'Synthetic owner' });
    const r = await get('/api/accountant/dashboard', sessionFor('acct-1', 'aal2'));
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('ACCESS_DENIED');
  });
  it.each(['bookkeeper', 'reviewer', 'admin', 'super_admin'])('refuses the %s role even with AAL2', async role => {
    person('staff-x', role);
    expect((await get('/api/accountant/dashboard', sessionFor('staff-x', 'aal2'))).status).toBe(403);
  });
  it('rejects a session from another tenant and a suspended membership', async () => {
    person('acct-o', 'accountant', { tenant: OTHER });
    expect((await get('/api/accountant/dashboard', sessionFor('acct-o', 'aal2', OTHER))).status).toBe(401);
    person('acct-s', 'accountant', { status: 'suspended' });
    expect((await get('/api/accountant/dashboard', sessionFor('acct-s', 'aal2'))).status).toBe(401);
  });
  it('rejects unauthenticated and unknown tokens', async () => {
    expect((await get('/api/accountant/dashboard')).status).toBe(401);
    expect((await get('/api/accountant/dashboard', 'tg_live_' + '0'.repeat(64))).status).toBe(401);
  });
  it('returns no cases when the accountant has no current client grant', async () => {
    person('acct-1', 'accountant'); caseRow('c-1', 'acct-1');
    const r = await get('/api/accountant/dashboard', sessionFor('acct-1', 'aal2'));
    expect(r.status).toBe(200);
    expect(r.body.cases).toEqual([]);
  });
  it('fails closed (503) when the case store is unavailable, without fabricating cases', async () => {
    person('acct-1', 'accountant'); grant('acct-1', 'c-1');
    const token = sessionFor('acct-1', 'aal2');
    failing.add('taxguard_cases');
    const r = await get('/api/accountant/dashboard', token);
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ code: 'CASE_STORE_UNAVAILABLE' });
  });
  it('exposes no write endpoints', async () => {
    person('acct-1', 'accountant'); grant('acct-1', 'c-1');
    const token = sessionFor('acct-1', 'aal2');
    for (const method of ['POST', 'PATCH']) {
      const r = await fetch(origin + '/api/accountant/dashboard', { method, headers: { authorization: `Bearer ${token}` } });
      expect(r.ok).toBe(false);
      expect((await r.json()).code).toBe('API_NOT_RELEASED');
    }
  });
});

describe('production boundary', () => {
  it('serves the read-only Tax Forms Library to an MFA-verified accountant', async () => {
    person('acct-1', 'accountant');
    const r = await get('/api/tax-forms', sessionFor('acct-1', 'aal2'));
    expect(r.status).toBe(200);
    expect(r.body.federalForms).toHaveLength(FEDERAL_FORMS.length);
  });
  it('keeps the super administrator console and the local login endpoints unavailable', async () => {
    person('sa-1', 'super_admin');
    const token = sessionFor('sa-1', 'aal2');
    expect((await get('/api/super-admin/session', token)).body.code).toBe('API_NOT_RELEASED');
    expect((await get('/api/super-admin/dashboards', token)).status).toBe(503);
    expect((await get('/api/auth/local-login-status')).status).toBe(410);
    const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'x@example.invalid', password: 'Synthetic-1!' }) });
    expect(login.status).toBe(410);
  });
});
