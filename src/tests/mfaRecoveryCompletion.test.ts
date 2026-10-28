import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createStaffAccessRouter } from '../server/routes/staff-access.routes';
import { attachSessionAssuranceLevel } from '../server/staffMfa';
import { StaffAccessRateLimit } from '../server/staffAccessRateLimit';
import { runMfaResetJob } from '../server/mfaRecoveryCompletion';
import { factorHash, MfaProviderError, type MfaFactorProvider, type ProviderFactor } from '../server/mfaResetProvider';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Staff MFA recovery end to end (proposals 010/011 + 034, PGlite, synthetic): recent-sign-in
// enforcement, fenced reset jobs against a synthetic provider adapter, verified re-enrolment and
// independent reactivation. No real provider, factor or person is involved.
const T = 'tenantA';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let bearer: string | undefined; let identity: any;
const tokenOf = (c: string) => 'tg_live_' + c.repeat(64);
const hashOf = (t: string) => createHash('sha256').update(t).digest('hex');
const nowS = () => Math.floor(Date.now() / 1000);
class SyntheticProvider implements MfaFactorProvider {
  name = 'synthetic'; factors = new Map<string, ProviderFactor[]>(); failNext: MfaProviderError | null = null; stubborn = false; calls: string[] = [];
  async listFactors(uid: string) { this.calls.push('list'); if (this.failNext) { const e = this.failNext; this.failNext = null; throw e; } return [...(this.factors.get(uid) ?? [])]; }
  async deleteFactor(uid: string, id: string) { this.calls.push('delete'); if (!this.stubborn) this.factors.set(uid, (this.factors.get(uid) ?? []).filter(f => f.id !== id)); }
}
const provider = new SyntheticProvider();
const rpc = pgliteRpc(() => fixture.pg);
const as = (id: string, token: string, role = 'admin') => { user = { id, role, tenantId: T, status: 'active' }; attachSessionAssuranceLevel(user, 'aal2'); bearer = token; };
const send = (path: string, body?: unknown) => fetch(origin + '/staff' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })
  .then(async r => ({ status: r.status, body: await r.json() as any }));
const list = () => fetch(origin + '/staff/mfa-recoveries').then(async r => ({ status: r.status, body: await r.json() as any }));
const q = async <R = any>(sql: string, params: unknown[] = []) => (await fixture.pg.query<R>(sql, params)).rows;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const audits = async (action: string) => (await q<{ metadata: any }>(`SELECT metadata FROM taxguard_audit_log WHERE action=$1 ORDER BY id`, [action])).map(r => r.metadata);

async function seedSessions() {
  const live = Date.now() + 3_600_000;
  await fixture.pg.query(`DELETE FROM taxguard_sessions WHERE uid LIKE 'rc-%'`);
  for (const [uid, c, age] of [['rc-admin-a', 'a', 60], ['rc-admin-b', 'b', 60], ['rc-admin-c', 'c', 60], ['rc-admin-stale', 'd', 1800], ['rc-staff', 'e', 60]] as Array<[string, string, number]>)
    await fixture.pg.query(`INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal) VALUES($1,$2,$3,$4,$5,'aal2')`, [T, uid, hashOf(tokenOf(c)), nowS() - age, live]);
}
beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(0[0-9]|1[01])0000_|^20261012340000_|^20261012350000_|^20261017000000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES ('${T}','rc-admin-a','admin','active'),('${T}','rc-admin-b','admin','active'),
      ('${T}','rc-admin-c','admin','active'),('${T}','rc-admin-stale','admin','active'),('${T}','rc-staff','accountant','active'),('${T}','rc-staff-2','accountant','active');
    INSERT INTO taxguard_identities(tenant_id,uid,user_data) SELECT tenant_id,uid,jsonb_build_object('id',uid,'tenantId',tenant_id,'role',role,'status',status,'mfaEnabled',true,'name','Synthetic '||uid)
      FROM taxguard_members WHERE uid LIKE 'rc-%';`);
  await seedSessions();
  const app = express(); app.use(express.json({ limit: '32kb' }));
  app.use('/staff', createStaffAccessRouter({ client: () => rpc as any, tenantId: () => T, limiter: new StaffAccessRateLimit(10_000, 60_000, 100_000, () => 0),
    mfaProvider: () => provider, verifyIdentity: async () => identity,
    authenticate: (req: any, res, next) => { if (!user) return res.status(401).json({ code: 'AUTH_REQUIRED' }); req.user = user; req.token = bearer; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as any).port;
}, 90000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });
beforeEach(() => { provider.failNext = null; provider.stubborn = false; });

describe('privileged reauthentication', () => {
  it('refuses recovery and membership changes from an administrator whose sign-in is older than 15 minutes', async () => {
    as('rc-admin-stale', tokenOf('d'));
    expect((await send('/mfa-recoveries', { requestId: uuid(1), targetUid: 'rc-staff', reasonCategory: 'lost_authenticator', reason: 'Synthetic lost device' })).body.code).toBe('STAFF_RECENT_SIGN_IN_REQUIRED');
    expect((await send('/members/rc-staff-2/status', { action: 'suspend', reason: 'Synthetic suspension' })).body.code).toBe('STAFF_RECENT_SIGN_IN_REQUIRED');
    expect((await send('/invitations', { email: 'new@example.test', role: 'accountant', legalFirstName: 'Syn', legalLastName: 'Thetic' })).body.code).toBe('STAFF_RECENT_SIGN_IN_REQUIRED');
    expect((await q(`SELECT status FROM taxguard_members WHERE uid='rc-staff-2'`))[0].status).toBe('active');
    as('rc-admin-a', tokenOf('a'));
    expect((await send('/members/rc-staff-2/status', { action: 'suspend', reason: 'Synthetic suspension' })).body.status).toBe('suspended');
    // A local (non-durable) session can never pass the privileged check.
    as('rc-admin-a', 'local-token');
    expect((await send('/members/rc-staff-2/status', { action: 'reactivate', reason: 'Synthetic reactivation' })).status).toBe(401);
  });
  it('rejects a session that predates the actor\'s own status change', async () => {
    await fixture.pg.query(`UPDATE taxguard_members SET status_changed_at = now() WHERE uid='rc-admin-c'`);
    const priv = await rpc.rpc('taxguard_privileged_session', { p_tenant: T, p_actor: 'rc-admin-c', p_session_hash: hashOf(tokenOf('c')), p_roles: ['admin'] });
    expect(priv.error?.message).toBe('STAFF_FRESH_SIGN_IN_REQUIRED');
    await fixture.pg.query(`UPDATE taxguard_members SET status_changed_at = NULL WHERE uid='rc-admin-c'`);
  });
});

describe('MFA recovery from request to reactivation', () => {
  const requestId = uuid(10);
  it('requests and independently approves; the member is suspended, gated and signed out', async () => {
    as('rc-admin-a', tokenOf('a'));
    expect((await send('/mfa-recoveries', { requestId, targetUid: 'rc-staff', reasonCategory: 'lost_authenticator', reason: 'Synthetic lost device' })).status).toBe(201);
    expect((await send(`/mfa-recoveries/${requestId}/approve`)).body.code).toBe('INDEPENDENT_APPROVER_REQUIRED');
    as('rc-admin-b', tokenOf('b'));
    expect((await send(`/mfa-recoveries/${requestId}/approve`)).body).toMatchObject({ status: 'approved', jobId: requestId });
    expect((await q(`SELECT status, mfa_reenrollment_required g FROM taxguard_members WHERE uid='rc-staff'`))[0]).toEqual({ status: 'suspended', g: true });
    expect((await q(`SELECT count(*)::int n FROM taxguard_sessions WHERE uid='rc-staff' AND NOT revoked`))[0].n).toBe(0);
  });
  it('does not accept re-enrolment before the provider reset is verified', async () => {
    identity = { uid: 'rc-staff', email: 'x@example.test', authTime: nowS(), primaryAuthTime: nowS(), aal: 'aal2' };
    expect((await send('/mfa-recovery/enrollment', { providerAccessToken: 'synthetic.provider.token' })).body.code).toBe('MFA_RECOVERY_NOT_READY_FOR_ENROLLMENT');
  });
  it('retries transient provider failures with back-off and never reactivates', async () => {
    provider.factors.set('rc-staff', [{ id: 'factor-old-1', status: 'verified', factorType: 'totp', createdAt: new Date(Date.now() - 86_400_000).toISOString() },
      { id: 'factor-old-2', status: 'unverified', factorType: 'totp', createdAt: new Date(Date.now() - 3_600_000).toISOString() }]);
    provider.failNext = new MfaProviderError('PROVIDER_UNAVAILABLE', true);
    expect(await runMfaResetJob(rpc as any, T, provider, 'worker-1')).toMatchObject({ status: 'pending', attempts: 1, lastErrorCode: 'PROVIDER_UNAVAILABLE' });
    expect(await runMfaResetJob(rpc as any, T, provider, 'worker-1')).toBeNull(); // back-off: not runnable yet
    await fixture.pg.query(`UPDATE taxguard_mfa_reset_jobs SET next_attempt_at = now() WHERE job_id=$1`, [requestId]);
    provider.stubborn = true; // the provider accepts deletes but the factors remain
    expect(await runMfaResetJob(rpc as any, T, provider, 'worker-1')).toMatchObject({ status: 'pending', attempts: 2, lastErrorCode: 'PROVIDER_FACTORS_REMAIN' });
    expect((await q(`SELECT status FROM taxguard_members WHERE uid='rc-staff'`))[0].status).toBe('suspended');
  });
  it('fences leases: a worker whose lease expired cannot report over the new holder', async () => {
    await fixture.pg.query(`UPDATE taxguard_mfa_reset_jobs SET next_attempt_at = now() WHERE job_id=$1`, [requestId]);
    const first = (await rpc.rpc('taxguard_mfa_job_claim', { p_tenant: T, p_worker: 'worker-slow', p_lease_seconds: 30 })).data;
    await fixture.pg.query(`UPDATE taxguard_mfa_reset_jobs SET lease_expires_at = now() - interval '1 second' WHERE job_id=$1`, [requestId]);
    const second = (await rpc.rpc('taxguard_mfa_job_claim', { p_tenant: T, p_worker: 'worker-fast', p_lease_seconds: 30 })).data;
    expect(second.fence).toBe(first.fence + 1);
    const stale = await rpc.rpc('taxguard_mfa_job_report', { p_tenant: T, p_job: requestId, p_worker: 'worker-slow', p_fence: first.fence, p_outcome: { kind: 'reset_verified', remainingFactors: 0, removedFactorHashes: [] } });
    expect(stale.error?.message).toBe('MFA_JOB_FENCE_LOST');
    // The current holder gives up with a retryable failure so the normal worker can run it.
    await rpc.rpc('taxguard_mfa_job_report', { p_tenant: T, p_job: requestId, p_worker: 'worker-fast', p_fence: second.fence, p_outcome: { kind: 'failed', errorCode: 'WORKER_SHUTDOWN', retryable: true } });
    await fixture.pg.query(`UPDATE taxguard_mfa_reset_jobs SET next_attempt_at = now() WHERE job_id=$1`, [requestId]);
  });
  it('verifies the reset by a fresh inventory and stores only factor hashes', async () => {
    expect(await runMfaResetJob(rpc as any, T, provider, 'worker-1')).toMatchObject({ status: 'reset_verified' });
    expect(provider.factors.get('rc-staff')).toEqual([]);
    const job = (await q(`SELECT * FROM taxguard_mfa_reset_jobs WHERE job_id=$1`, [requestId]))[0];
    expect(job.removed_factor_hashes.sort()).toEqual([factorHash(T, 'rc-staff', 'factor-old-1'), factorHash(T, 'rc-staff', 'factor-old-2')].sort());
    const dump = JSON.stringify(await q(`SELECT * FROM taxguard_mfa_reset_jobs`)) + JSON.stringify(await q(`SELECT metadata FROM taxguard_audit_log WHERE action LIKE 'STAFF_MFA%'`));
    expect(dump).not.toMatch(/factor-old-/);
    expect((await audits('STAFF_MFA_FACTORS_RESET')).at(-1)).toMatchObject({ jobId: requestId, removedFactors: 2 });
  });
  it('accepts re-enrolment only with AAL2, a sign-in after the reset, and a genuinely new factor', async () => {
    // The reset happened a little earlier; the member then signs in again and enrols a new factor.
    await fixture.pg.query(`UPDATE taxguard_mfa_reset_jobs SET reset_at = reset_at - interval '10 seconds' WHERE job_id=$1`, [requestId]);
    const resetAt = Date.parse((await q(`SELECT reset_at FROM taxguard_mfa_reset_jobs WHERE job_id=$1`, [requestId]))[0].reset_at);
    const after = new Date(resetAt + 1000).toISOString();
    provider.factors.set('rc-staff', [{ id: 'factor-old-1', status: 'verified', factorType: 'totp', createdAt: after }]); // a removed factor reappearing
    identity = { uid: 'rc-staff', email: 'x@example.test', authTime: nowS(), primaryAuthTime: nowS() - 2, aal: 'aal2' };
    expect((await send('/mfa-recovery/enrollment', { providerAccessToken: 'synthetic' })).body.code).toBe('MFA_ENROLLMENT_NEW_FACTOR_REQUIRED');
    provider.factors.set('rc-staff', [{ id: 'factor-new-1', status: 'verified', factorType: 'totp', createdAt: after }]);
    identity = { ...identity, aal: 'aal1' };
    expect((await send('/mfa-recovery/enrollment', { providerAccessToken: 'synthetic' })).body.code).toBe('MFA_ENROLLMENT_AAL2_REQUIRED');
    identity = { ...identity, aal: 'aal2', primaryAuthTime: Math.floor(resetAt / 1000) - 60 };
    expect((await send('/mfa-recovery/enrollment', { providerAccessToken: 'synthetic' })).body.code).toBe('MFA_ENROLLMENT_FRESH_SIGN_IN_REQUIRED');
    identity = { ...identity, primaryAuthTime: nowS() - 2 };
    expect((await send('/mfa-recovery/enrollment', { providerAccessToken: 'synthetic' })).body).toMatchObject({ status: 'enrollment_verified', replayed: false });
    expect((await send('/mfa-recovery/enrollment', { providerAccessToken: 'synthetic' })).body.replayed).toBe(true);
    expect((await q(`SELECT status FROM taxguard_members WHERE uid='rc-staff'`))[0].status).toBe('suspended'); // still needs an administrator
  });
  it('is reactivated only by another administrator with a recent sign-in; every earlier proof becomes stale', async () => {
    as('rc-admin-stale', tokenOf('d'));
    expect((await send(`/mfa-recoveries/${requestId}/complete`)).body.code).toBe('STAFF_RECENT_SIGN_IN_REQUIRED');
    as('rc-admin-c', tokenOf('c'));
    expect((await send(`/mfa-recoveries/${requestId}/complete`)).body).toMatchObject({ status: 'completed', resumed: false });
    expect((await send(`/mfa-recoveries/${requestId}/complete`)).body.resumed).toBe(true);
    const m = (await q(`SELECT status, mfa_reenrollment_required g, status_changed_at FROM taxguard_members WHERE uid='rc-staff'`))[0];
    expect([m.status, m.g]).toEqual(['active', false]);
    expect((await q(`SELECT user_data->>'mfaEnabled' e FROM taxguard_identities WHERE uid='rc-staff'`))[0].e).toBe('true');
    // The re-enrolment sign-in happened before reactivation: it cannot be used to mint a session.
    expect(Date.parse(m.status_changed_at)).toBeGreaterThan((identity.primaryAuthTime) * 1000);
    expect((await audits('STAFF_MFA_RECOVERY_COMPLETED')).at(-1)).toMatchObject({ uid: 'rc-staff', status: 'active' });
    const page = (await list()).body;
    expect(page.items.find((r: any) => r.requestId === requestId)).toMatchObject({ status: 'completed', jobStatus: 'completed', completedBy: 'rc-admin-c', resetAvailability: 'verified' });
  });
  it('allows a later recovery for the same member, one open at a time, and cancellation before approval', async () => {
    as('rc-admin-a', tokenOf('a'));
    expect((await send('/mfa-recoveries', { requestId: uuid(11), targetUid: 'rc-staff', reasonCategory: 'device_replacement', reason: 'Synthetic new phone' })).status).toBe(201);
    expect((await send('/mfa-recoveries', { requestId: uuid(12), targetUid: 'rc-staff', reasonCategory: 'device_replacement', reason: 'Synthetic duplicate' })).body.code).toBe('MFA_RECOVERY_ALREADY_OUTSTANDING');
    expect((await send(`/mfa-recoveries/${uuid(11)}/cancel`, { reason: 'short' })).body.code).toBe('MFA_RECOVERY_INPUT_INVALID');
    expect((await send(`/mfa-recoveries/${uuid(11)}/cancel`, { reason: 'Device found by the synthetic user' })).body.status).toBe('cancelled');
    as('rc-admin-b', tokenOf('b'));
    expect((await send(`/mfa-recoveries/${uuid(11)}/approve`)).body.code).toBe('MFA_RECOVERY_STATE_CONFLICT');
    expect((await q(`SELECT status FROM taxguard_members WHERE uid='rc-staff'`))[0].status).toBe('active');
  });
  it('lets an administrator re-queue a terminally failed reset, which still never reactivates', async () => {
    as('rc-admin-a', tokenOf('a'));
    await send('/mfa-recoveries', { requestId: uuid(20), targetUid: 'rc-staff', reasonCategory: 'compromised_factor', reason: 'Synthetic compromise' });
    as('rc-admin-b', tokenOf('b')); await send(`/mfa-recoveries/${uuid(20)}/approve`);
    provider.failNext = new MfaProviderError('PROVIDER_NOT_AUTHORIZED', false);
    expect(await runMfaResetJob(rpc as any, T, provider, 'worker-1')).toMatchObject({ status: 'failed', lastErrorCode: 'PROVIDER_NOT_AUTHORIZED' });
    expect((await q(`SELECT status, mfa_reenrollment_required g FROM taxguard_members WHERE uid='rc-staff'`))[0]).toEqual({ status: 'suspended', g: true });
    as('rc-admin-c', tokenOf('c'));
    expect((await send(`/mfa-recoveries/${uuid(20)}/complete`)).body.code).toBe('MFA_RECOVERY_NOT_READY_FOR_COMPLETION');
    expect((await send(`/mfa-recoveries/${uuid(20)}/retry`)).body).toEqual({ jobId: uuid(20), status: 'pending' });
    await expect(runMfaResetJob(rpc as any, T, null, 'worker-1')).rejects.toMatchObject({ code: 'MFA_RESET_PROVIDER_UNAVAILABLE' });
  });
});

describe('database boundaries', () => {
  it('exposes the new functions to the service role only and keeps tables closed', async () => {
    const fns = ['taxguard_privileged_session', 'taxguard_mfa_job_claim', 'taxguard_mfa_job_report', 'taxguard_mfa_job_for_target', 'taxguard_mfa_job_enrollment_proof',
      'taxguard_complete_mfa_recovery', 'taxguard_cancel_mfa_recovery', 'taxguard_retry_mfa_reset_job'];
    const rows = await q<{ proname: string; svc: boolean; pub: boolean }>(`SELECT proname, has_function_privilege('service_role', oid, 'EXECUTE') svc,
      has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE') pub FROM pg_proc WHERE proname = ANY($1)`, [fns]);
    expect(rows.filter(r => r.pub)).toEqual([]); expect(rows.filter(r => r.svc).length).toBe(fns.length);
    for (const t of ['taxguard_mfa_reset_jobs', 'taxguard_mfa_recovery_requests'])
      expect((await q<{ ok: boolean }>(`SELECT has_table_privilege('service_role', 'public.${t}', 'UPDATE') ok`))[0].ok, t).toBe(false);
    await expect(fixture.pg.query(`UPDATE taxguard_mfa_reset_jobs SET status='completed' WHERE job_id=$1`, [uuid(20)])).rejects.toThrow(/chk_taxguard_mfa_reset_job_lifecycle/);
  });
});
