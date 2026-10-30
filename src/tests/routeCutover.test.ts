import express from 'express';
import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createProductionApp } from '../server/productionApp';
import { mountCutoverRoutes, OWNER_APPROVED_PROPOSALS, planCutover, ROUTE_CUTOVER_CATALOG } from '../server/routeCutover';

// Production cutover of the development-only durable routers fails closed: nothing is reachable unless requested,
// every required proposal is owner-approved, and the connected schema is verified.
const listen = async (app: express.Express) => {
  const server: Server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return { server, origin: 'http://127.0.0.1:' + (server.address() as AddressInfo).port };
};
const fake = () => { const r = express.Router(); r.get('/ping', (_req, res) => res.json({ reached: true })); return r; };

describe('cutover plan', () => {
  it('no review-only proposal is owner-approved, so nothing is eligible even when every route is requested', () => {
    expect(OWNER_APPROVED_PROPOSALS).toEqual([]);
    const plan = planCutover(ROUTE_CUTOVER_CATALOG.map(r => r.key).join(','));
    expect(plan.eligible).toEqual([]);
    expect(plan.refused.every(r => r.reason === 'PROPOSAL_NOT_APPROVED' && r.missingProposals!.length > 0)).toBe(true);
  });
  it('refuses unrequested and unknown routes; an approved, requested route becomes eligible', () => {
    const cases = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'cases')!;
    const plan = planCutover('cases, nonsense', cases.proposals);
    expect(plan.eligible.map(r => r.key)).toEqual(['cases']);
    expect(plan.refused).toContainEqual({ key: 'nonsense', reason: 'UNKNOWN_ROUTE' });
    expect(plan.refused).toContainEqual({ key: 'billing', reason: 'NOT_REQUESTED' });
    expect(planCutover(undefined).eligible).toEqual([]);
    expect(planCutover('cases', cases.proposals.slice(1)).refused).toContainEqual({ key: 'cases', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: [cases.proposals[0]] });
  });
  it('every catalogued proposal is in the execution order and defines the route\'s sentinel RPCs', () => {
    const order = JSON.parse(fs.readFileSync('docs/development/migration-execution-order.json', 'utf8'));
    const files: string[] = (order.order ?? order.files ?? order.migrations ?? order.entries).map((e: any) => e.file ?? e);
    for (const route of ROUTE_CUTOVER_CATALOG) {
      const own = route.proposals.map(v => files.find(f => f.includes('/' + v + '_')));
      expect(own.every(Boolean), route.key).toBe(true);
      const text = own.map(f => fs.readFileSync(f!, 'utf8')).join('\n');
      for (const rpc of route.sentinelRpcs) expect(text, `${route.key}: ${rpc}`).toContain(`FUNCTION public.${rpc}(`);
    }
  });
});

describe('cutover mounting', () => {
  const cases = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'cases')!;
  const run = async (probe: ((rpc: string) => Promise<boolean>) | null, requested = 'cases', approved = cases.proposals) => {
    const app = express();
    const gate = mountCutoverRoutes(app, planCutover(requested, approved), { cases: fake }, probe);
    app.use('/api', (_req, res) => res.status(404).json({ code: 'API_ROUTE_NOT_FOUND' }));
    const { server, origin } = await listen(app);
    try {
      const r = await fetch(origin + '/api/cases/ping');
      return { status: r.status, body: await r.json(), gate: gate.status() };
    } finally { await new Promise(resolve => server.close(resolve)); }
  };
  it('a verified route reaches its router', async () => {
    const out = await run(async () => true);
    expect(out).toMatchObject({ status: 200, body: { reached: true } });
    expect(out.gate.find(s => s.key === 'cases')).toMatchObject({ state: 'VERIFIED' });
  });
  it('a missing sentinel, a failing probe or no probe keeps the route at 503 without reaching the router', async () => {
    for (const probe of [async (rpc: string) => rpc !== 'taxguard_case_restaff', async () => { throw new Error('probe down'); }, null]) {
      const out = await run(probe as any);
      expect(out).toMatchObject({ status: 503, body: { code: 'ROUTE_CUTOVER_SCHEMA_UNVERIFIED' } });
      expect(out.gate.find(s => s.key === 'cases')!.state).toBe('SCHEMA_UNVERIFIED');
    }
  });
  it('a route that is not eligible is not mounted at all', async () => {
    expect(await run(async () => true, '', cases.proposals)).toMatchObject({ status: 404, body: { code: 'API_ROUTE_NOT_FOUND' } });
    expect(await run(async () => true, 'cases', [])).toMatchObject({ status: 404 });
  });
});

describe('production app', () => {
  const env = process.env.NODE_ENV, requested = process.env.TAXGUARD_PRODUCTION_ROUTE_CUTOVER;
  let server: Server; let origin = '';
  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.TAXGUARD_PRODUCTION_ROUTE_CUTOVER = ROUTE_CUTOVER_CATALOG.map(r => r.key).join(',');
    ({ server, origin } = await listen(createProductionApp() as any));
  });
  afterAll(async () => {
    process.env.NODE_ENV = env;
    if (requested === undefined) delete process.env.TAXGUARD_PRODUCTION_ROUTE_CUTOVER; else process.env.TAXGUARD_PRODUCTION_ROUTE_CUTOVER = requested;
    await new Promise(resolve => server.close(resolve));
  });
  it('even with every route requested, no durable router is reachable without owner-approved proposals', async () => {
    // Not mounted: the production /api boundary answers API_NOT_RELEASED and the router is never reached.
    for (const route of ROUTE_CUTOVER_CATALOG) {
      const r = await fetch(origin + route.path + '/anything', { headers: { Accept: 'application/json' } });
      expect({ status: r.status, body: await r.json() }, route.path).toEqual({ status: 503, body: { code: 'API_NOT_RELEASED', error: 'This service is not available for production use yet.' } });
    }
  });
  it('the Block 66 conclusion and trace routes are refused in production, never served from memory', async () => {
    for (const path of ['/api/tax-engine/cases/case-1/conclusions', '/api/tax-engine/conclusions/0123abcd-0000-4000-8000-000000000001/trace',
      '/api/tax-engine/cases/case-1/evidence-trace?ref=document:d1', '/api/tax-engine/cases/case-1/conclusions/readiness']) {
      const r = await fetch(origin + path, { headers: { Accept: 'application/json' } });
      expect({ status: r.status, body: await r.json() }, path).toEqual({ status: 503, body: { code: 'API_NOT_RELEASED', error: 'This service is not available for production use yet.' } });
    }
    const conclusions = await fetch(origin + '/api/tax-engine/cases/case-1/conclusions', { method: 'POST', headers: { Accept: 'application/json', 'content-type': 'application/json' }, body: '{}' });
    expect(conclusions.status).toBe(503);
  });
  it('the tax-engine cutover requires the research, diagnostics, risk, lineage and conclusion proposals', () => {
    const route = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'tax-engine')!;
    expect(route.proposals).toEqual(expect.arrayContaining(['20261018150000', '20261018160000', '20261018170000', '20261018190000', '20261019100000']));
    expect(planCutover('tax-engine', route.proposals.filter(v => v !== '20261019100000')).refused)
      .toContainEqual({ key: 'tax-engine', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: ['20261019100000'] });
  });
  it('the Block 67 form-mapping routes are refused in production and the cutover requires the form-mapping proposal', async () => {
    for (const path of ['/api/tax-engine/form-rules', '/api/tax-engine/cases/case-1/form-mappings', '/api/tax-engine/form-mappings/0123abcd-0000-4000-8000-000000000001']) {
      const r = await fetch(origin + path, { headers: { Accept: 'application/json' } });
      expect({ status: r.status, body: await r.json() }, path).toEqual({ status: 503, body: { code: 'API_NOT_RELEASED', error: 'This service is not available for production use yet.' } });
    }
    expect((await fetch(origin + '/api/tax-engine/cases/case-1/form-mappings', { method: 'POST', headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ ruleId: '0123abcd-0000-4000-8000-000000000001' }) })).status).toBe(503);
    const route = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'tax-engine')!;
    expect(route.proposals).toContain('20261019110000');
    expect(route.sentinelRpcs).toContain('taxguard_tax_form_mapping_list');
    expect(planCutover('tax-engine', route.proposals.filter(v => v !== '20261019110000')).refused)
      .toContainEqual({ key: 'tax-engine', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: ['20261019110000'] });
  });
  it('the Block 68 draft-return routes are refused in production and the cutover requires the return proposal', async () => {
    for (const path of ['/api/tax-engine/return-templates', '/api/tax-engine/cases/case-1/returns', '/api/tax-engine/cases/case-1/returns/stage-facts',
      '/api/tax-engine/returns/0123abcd-0000-4000-8000-000000000001']) {
      const r = await fetch(origin + path, { headers: { Accept: 'application/json' } });
      expect({ status: r.status, body: await r.json() }, path).toEqual({ status: 503, body: { code: 'API_NOT_RELEASED', error: 'This service is not available for production use yet.' } });
    }
    for (const [path, body] of [['/api/tax-engine/cases/case-1/returns', { templateRuleId: '0123abcd-0000-4000-8000-000000000001' }],
      ['/api/tax-engine/returns/0123abcd-0000-4000-8000-000000000001/approve', {}]] as const)
      expect((await fetch(origin + path, { method: 'POST', headers: { Accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) })).status, path).toBe(503);
    const route = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'tax-engine')!;
    expect(route.proposals).toContain('20261019120000');
    expect(route.sentinelRpcs).toContain('taxguard_tax_return_list');
    expect(planCutover('tax-engine', route.proposals.filter(v => v !== '20261019120000')).refused)
      .toContainEqual({ key: 'tax-engine', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: ['20261019120000'] });
  });
  it('the Block 69 verification routes are refused in production and the cutover requires the verification proposal', async () => {
    const id = '0123abcd-0000-4000-8000-000000000001';
    expect((await fetch(origin + `/api/tax-engine/returns/${id}/verifications`, { headers: { Accept: 'application/json' } })).status).toBe(503);
    expect((await fetch(origin + `/api/tax-engine/returns/${id}/verify`, { method: 'POST', headers: { Accept: 'application/json', 'content-type': 'application/json' }, body: '{}' })).status).toBe(503);
    const route = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'tax-engine')!;
    expect(route.proposals).toContain('20261019140000');
    expect(route.sentinelRpcs).toContain('taxguard_tax_return_verification_list');
    expect(planCutover('tax-engine', route.proposals.filter(v => v !== '20261019140000')).refused)
      .toContainEqual({ key: 'tax-engine', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: ['20261019140000'] });
  });
  it('the Block 71 return risk routes are refused in production and the cutover requires the risk proposal', async () => {
    const id = '0123abcd-0000-4000-8000-000000000001';
    expect((await fetch(origin + `/api/tax-engine/returns/${id}/risk`, { headers: { Accept: 'application/json' } })).status).toBe(503);
    expect((await fetch(origin + `/api/tax-engine/returns/${id}/risk`, { method: 'POST', headers: { Accept: 'application/json', 'content-type': 'application/json' }, body: '{"amountCents":1}' })).status).toBe(503);
    const route = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'tax-engine')!;
    expect(route.proposals).toContain('20261019160000');
    expect(route.sentinelRpcs).toContain('taxguard_tax_return_risk_list');
    expect(planCutover('tax-engine', route.proposals.filter(v => v !== '20261019160000')).refused)
      .toContainEqual({ key: 'tax-engine', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: ['20261019160000'] });
  });
  it('the Block 72 quality control routes are refused in production and the cutover requires the quality control proposal', async () => {
    const id = '0123abcd-0000-4000-8000-000000000001';
    for (const path of ['/api/tax-engine/qc/queue', `/api/tax-engine/returns/${id}/readiness`, `/api/tax-engine/returns/${id}/qc-context`, `/api/tax-engine/returns/${id}/qc-reviews`])
      expect((await fetch(origin + path, { headers: { Accept: 'application/json' } })).status, path).toBe(503);
    for (const path of [`/api/tax-engine/returns/${id}/qc`, `/api/tax-engine/returns/${id}/qc-assignment`])
      expect((await fetch(origin + path, { method: 'POST', headers: { Accept: 'application/json', 'content-type': 'application/json' }, body: '{}' })).status, path).toBe(503);
    const route = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'tax-engine')!;
    expect(route.proposals).toContain('20261019170000');
    expect(route.sentinelRpcs).toContain('taxguard_tax_return_final_readiness');
    expect(planCutover('tax-engine', route.proposals.filter(v => v !== '20261019170000')).refused)
      .toContainEqual({ key: 'tax-engine', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: ['20261019170000'] });
  });
  it('the Block 73 final authorization routes are refused in production and the cutover requires the final authorization proposal', async () => {
    const id = '0123abcd-0000-4000-8000-000000000001';
    for (const path of ['/api/tax-engine/final/queue', `/api/tax-engine/returns/${id}/final-context`, `/api/tax-engine/returns/${id}/final-authorizations`])
      expect((await fetch(origin + path, { headers: { Accept: 'application/json' } })).status, path).toBe(503);
    for (const path of [`/api/tax-engine/returns/${id}/final-authorization`, `/api/tax-engine/returns/${id}/final-assignment`, `/api/tax-engine/returns/${id}/final-assignment/revoke`])
      expect((await fetch(origin + path, { method: 'POST', headers: { Accept: 'application/json', 'content-type': 'application/json' }, body: '{}' })).status, path).toBe(503);
    const route = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'tax-engine')!;
    expect(route.proposals).toContain('20261019180000');
    expect(route.sentinelRpcs).toContain('taxguard_tax_return_final_list');
    expect(planCutover('tax-engine', route.proposals.filter(v => v !== '20261019180000')).refused)
      .toContainEqual({ key: 'tax-engine', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: ['20261019180000'] });
  });
  it('the Block 74 signature package routes are refused in production, and the client view has its own cutover', async () => {
    const id = '0123abcd-0000-4000-8000-000000000001';
    for (const path of [`/api/tax-engine/returns/${id}/signature-context`, `/api/tax-engine/returns/${id}/signature-packages`, '/api/client-signatures/clients/c1/signature-packages'])
      expect((await fetch(origin + path, { headers: { Accept: 'application/json' } })).status, path).toBe(503);
    for (const path of [`/api/tax-engine/returns/${id}/signature-package`, `/api/tax-engine/returns/${id}/signature-package/withdraw`])
      expect((await fetch(origin + path, { method: 'POST', headers: { Accept: 'application/json', 'content-type': 'application/json' }, body: '{}' })).status, path).toBe(503);
    const route = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'tax-engine')!;
    expect(route.proposals).toContain('20261019190000');
    expect(route.sentinelRpcs).toContain('taxguard_tax_return_signature_list');
    const client = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'client-signatures')!;
    expect(client).toMatchObject({ path: '/api/client-signatures', sentinelRpcs: ['taxguard_portal_signature_packages'] });
    expect(planCutover('client-signatures', client.proposals.filter(v => v !== '20261019190000')).refused)
      .toContainEqual({ key: 'client-signatures', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: ['20261019190000'] });
    // The existing portal reads do not wait for this proposal.
    expect(ROUTE_CUTOVER_CATALOG.find(r => r.key === 'client-portal')!.proposals).not.toContain('20261019190000');
  });
  it('the Block 75 return comparison is refused in production until its proposal is approved', async () => {
    const id = '0123abcd-0000-4000-8000-000000000001';
    expect((await fetch(origin + `/api/tax-engine/returns/${id}/comparison`, { headers: { Accept: 'application/json' } })).status).toBe(503);
    const route = ROUTE_CUTOVER_CATALOG.find(r => r.key === 'tax-engine')!;
    expect(route.sentinelRpcs).toContain('taxguard_tax_return_comparison');
    expect(planCutover('tax-engine', route.proposals.filter(v => v !== '20261019200000')).refused)
      .toContainEqual({ key: 'tax-engine', reason: 'PROPOSAL_NOT_APPROVED', missingProposals: ['20261019200000'] });
  });
  it('the cutover status report is for operational administrators only', async () => {
    expect((await fetch(origin + '/api/route-cutover')).status).toBe(401);
  });
});
