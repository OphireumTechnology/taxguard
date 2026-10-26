import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { createTaxEngineRouter } from '../server/routes/taxEngine.routes';
import { TaxEngineStore } from '../server/taxguard/taxEngine/taxEngineStore';

// HTTP -> /api/tax-engine case diagnostics and risk -> TaxEngineStore -> proposals 20261018160000 and 20261018170000
// (review only) on real PostgreSQL. The route passes no AI confidence from a request: it may only come from a governed
// AI run. Synthetic data only.
const T = 'tenantCaseReadinessHttp', T2 = 'tenantCaseReadinessHttpOther', C = 'crhClient';
const roles: Record<string, string> = { 'crh-mgr': 'practice_manager', 'crh-prep': 'accountant', 'crh-rev': 'reviewer', 'crh-out': 'accountant', 'crh-bk': 'bookkeeper' };
let db: TestDatabase; let caseId = '';
let server: Server; let origin = ''; let user: any = null;
const as = (uid: string, tenantId = T) => { user = { id: uid, role: roles[uid] ?? 'practice_manager', tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const open = (result: any) => (result.diagnostics as any[]).map(d => `${d.severity}:${d.rule_code}`).sort();

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic readiness practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'crh-client', 'Synthetic Readiness Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) SELECT '${T}', k, v, 'active' FROM (VALUES ${Object.entries(roles).map(([k, v]) => `('${k}','${v}')`).join(',')}) x(k, v);
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T2}', 'crh-foreign', 'practice_manager', 'active');`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const e = (await practice.createEngagement(T, C, 'crh-mgr', 'crh-engagement-1', { title: 'Synthetic return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'crh-mgr', e, 'active', 1);
  await practice.assign(T, C, 'crh-mgr', 'crh-assign-preparer', { engagementId: e, taxYear: 2025, role: 'preparer', userId: 'crh-prep', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'crh-mgr', 'crh-assign-reviewer', { engagementId: e, taxYear: 2025, role: 'reviewer', userId: 'crh-rev', reason: 'Synthetic staffing' });
  caseId = (await new CaseStore(pgRpc(db.pool)).create(T, C, 'crh-mgr', 'crh-case-key-1', { engagementId: e, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgRpc(db.pool)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 240_000);
afterAll(async () => {
  server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r());
  await db?.stop();
});

describe('case diagnostics over HTTP', () => {
  it('runs and lists persisted findings for the case team; a new case is not ready and return use stays blocked', async () => {
    as('crh-prep');
    expect((await call('GET', `/cases/${caseId}/diagnostics`)).body).toMatchObject({ blocking: 0, errors: 0, diagnostics: [], diagnosedAt: null, ready: false, returnUse: 'BLOCKED' });
    const ran = await call('POST', `/cases/${caseId}/diagnostics/run`);
    expect(ran.status).toBe(200);
    expect(open(ran.body)).toEqual(['BLOCKING:CALC_NO_APPROVED_RUN', 'ERROR:B2T_NO_APPROVED_WORKPAPER']);
    expect(ran.body).toMatchObject({ blocking: 1, errors: 1, ready: false, returnUse: 'BLOCKED' });
    as('crh-rev');
    expect(open((await call('GET', `/cases/${caseId}/diagnostics`)).body)).toEqual(open(ran.body));
  });

  it('lets only the case reviewer or a manager acknowledge INFO and WARNING findings, with a note', async () => {
    as('crh-prep');
    expect((await call('POST', `/cases/${caseId}/research`, { question: 'Synthetic research question for readiness.' })).status).toBe(201);
    const ran = (await call('POST', `/cases/${caseId}/diagnostics/run`)).body;
    const info = ran.diagnostics.find((d: any) => d.rule_code === 'RESEARCH_DRAFT_OPEN');
    const blocking = ran.diagnostics.find((d: any) => d.severity === 'BLOCKING');
    const ack = (id: string, note = 'Synthetic acknowledgement with reasons.') => call('POST', `/diagnostics/${id}/acknowledge`, { note });
    expect((await ack(info.diagnostic_id)).body.code).toBe('DIAGNOSTIC_REVIEWER_REQUIRED');
    expect((await ack(info.diagnostic_id)).status).toBe(403);
    as('crh-rev');
    expect(await ack(blocking.diagnostic_id)).toMatchObject({ status: 409, body: { code: 'DIAGNOSTIC_NOT_WAIVABLE' } });
    expect(await ack(info.diagnostic_id, 'short')).toMatchObject({ status: 400, body: { code: 'DIAGNOSTIC_INPUT_INVALID' } });
    expect(await ack('not-a-uuid')).toMatchObject({ status: 404, body: { code: 'DIAGNOSTIC_NOT_FOUND' } });
    const done = await ack(info.diagnostic_id);
    expect(done.status).toBe(200);
    expect(done.body.diagnostics.find((d: any) => d.diagnostic_id === info.diagnostic_id)).toMatchObject({ status: 'ACKNOWLEDGED', acknowledged_by: 'crh-rev' });
    expect(done.body).toMatchObject({ ready: false, blocking: 1 });
    expect(await ack(info.diagnostic_id)).toMatchObject({ status: 409, body: { code: 'DIAGNOSTIC_NOT_OPEN' } });
  });
});

describe('case risk assessment over HTTP', () => {
  it('records an assessment from the stated amount; AI confidence in a request is ignored; a blocking finding blocks', async () => {
    as('crh-prep');
    const r = await call('POST', `/cases/${caseId}/risk`, { amountCents: 500, aiConfidence: 0.01, unsupportedPosition: false });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ outcome: 'BLOCKED', ai_confidence: null, amount_cents: 500, policy_version: null, assessed_by: 'crh-prep', returnUse: 'BLOCKED' });
    expect(r.body.reason_codes).toEqual(['DIAGNOSTIC_BLOCKING', 'DIAGNOSTIC_ERRORS', 'NO_APPROVED_MATERIALITY_POLICY']);
    const unsupported = await call('POST', `/cases/${caseId}/risk`, { amountCents: 0, unsupportedPosition: true });
    expect(unsupported.body.reason_codes).toContain('UNSUPPORTED_POSITION');
    const listed = await call('GET', `/cases/${caseId}/risk`);
    expect(listed.body).toMatchObject({ returnUse: 'BLOCKED' });
    expect(listed.body.items.map((a: any) => a.assessment_id)).toEqual([unsupported.body.assessment_id, r.body.assessment_id]);
  });

  it('refuses malformed input', async () => {
    as('crh-prep');
    for (const body of [{}, { amountCents: -1 }, { amountCents: 1.5 }, { amountCents: '100' }, { amountCents: 1, unsupportedPosition: 'yes' }])
      expect(await call('POST', `/cases/${caseId}/risk`, body), JSON.stringify(body)).toMatchObject({ status: 400, body: { code: 'RISK_INPUT_INVALID' } });
  });
});

describe('scope', () => {
  it('hides the case from members outside the case team and other tenants, and closes the area to bookkeepers', async () => {
    for (const [uid, tenant] of [['crh-out', T], ['crh-foreign', T2]] as const) {
      as(uid, tenant);
      expect(await call('GET', `/cases/${caseId}/diagnostics`)).toMatchObject({ status: 404, body: { code: 'CASE_NOT_FOUND' } });
      expect(await call('POST', `/cases/${caseId}/diagnostics/run`)).toMatchObject({ status: 404, body: { code: 'CASE_NOT_FOUND' } });
      expect(await call('POST', `/cases/${caseId}/risk`, { amountCents: 1 })).toMatchObject({ status: 404, body: { code: 'CASE_NOT_FOUND' } });
      expect(await call('GET', `/cases/${caseId}/risk`)).toMatchObject({ status: 404, body: { code: 'CASE_NOT_FOUND' } });
    }
    as('crh-out');
    const any = (await db.pool.query(`SELECT diagnostic_id FROM taxguard_case_diagnostics WHERE tenant_id = $1 AND severity = 'ERROR' LIMIT 1`, [T])).rows[0].diagnostic_id;
    expect(await call('POST', `/diagnostics/${any}/acknowledge`, { note: 'Synthetic acknowledgement with reasons.' })).toMatchObject({ status: 404, body: { code: 'DIAGNOSTIC_NOT_FOUND' } });
    as('crh-bk');
    expect(await call('GET', `/cases/${caseId}/diagnostics`)).toMatchObject({ status: 403, body: { code: 'TAX_ENGINE_ACCESS_DENIED' } });
  });

  it('lets a practice manager run diagnostics and assess, and audits each action', async () => {
    as('crh-mgr');
    expect((await call('POST', `/cases/${caseId}/diagnostics/run`)).status).toBe(200);
    expect((await call('POST', `/cases/${caseId}/risk`, { amountCents: 10 })).status).toBe(201);
    const audits = (await db.pool.query(`SELECT action, count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1
      AND action IN ('CASE_DIAGNOSTICS_RUN','CASE_DIAGNOSTIC_ACKNOWLEDGED','CASE_RISK_ASSESSED') GROUP BY action ORDER BY action`, [T])).rows;
    expect(audits).toEqual([{ action: 'CASE_DIAGNOSTIC_ACKNOWLEDGED', n: 1 }, { action: 'CASE_DIAGNOSTICS_RUN', n: 3 }, { action: 'CASE_RISK_ASSESSED', n: 3 }]);
  });
});
