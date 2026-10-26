import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, closeBrowser, durableSession, liveSessionWithToken, providerControl, providerToken } from '../helpers';

// Journey N on the real server with the governance store composed on this run's loopback PostgreSQL
// (provider profile). The accountant is the assigned preparer of one synthetic case (seeded by the E2E
// server). No agent is commissioned, so every evaluation is refused by policy and recorded; nothing is
// ever executed or submitted. A permitted advisory run needs an ACTIVE agent version, grants and a human
// approval policy (commissioning); that path is covered with synthetic governance state in the unit
// suites and is deliberately not created here.
const ACCOUNTANT = 'd0000000-0000-4000-8000-000000000002', ADMIN = 'd0000000-0000-4000-8000-00000000000c';
const TENANT = 'tenantE2E';
const tokens: Record<string, string> = {};
const evaluate = (token: string | null, body: unknown) => fetch(ORIGIN + '/api/ai-governance/evaluate', { method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, body: await r.json() as any }));
const ASSIGNED = { tenant_id: TENANT, client_id: 'E2EAIC1', tax_case_id: 'e2e-ai-case', tax_year: 2025 };
const request = (overrides: Record<string, unknown> = {}) => ({ request_id: randomUUID(), agent_id: 'A34', scope: ASSIGNED, workflow_stage: 3, intent: 'ADVISORY',
  purpose: 'EVIDENCE_COMPLETENESS', capabilities: [{ tool_id: 'workflow.read', action: 'READ' }], data_classes: ['INTERNAL'],
  evidence_source_ids: [randomUUID()], confidence: 0.9, risk_level: 'LOW', financial_amount: 0, ...overrides });
const refusedByPolicy = (r: { status: number; body: any }) => {
  expect(r.status, JSON.stringify(r.body)).toBeGreaterThanOrEqual(400);
  expect(r.status).toBeLessThan(500); // a policy refusal, not an unavailable store
  expect(r.body.code).toMatch(/^AI_[A-Z_]+$/);
  expect(r.body.code).not.toBe('AI_INVALID_REQUEST');
  expect(r.body).toMatchObject({ action_executed: false, external_submission_allowed: false, requires_human_review: true });
};
const read = (token: string, path: string) => fetch(ORIGIN + '/api/ai-governance' + path, { headers: { authorization: `Bearer ${token}` } })
  .then(async r => ({ status: r.status, body: await r.json() as any }));

beforeAll(async () => {
  for (const uid of [ACCOUNTANT, ADMIN]) {
    expect((await providerControl('/e2e/provider-user', { uid, email: `${uid}@example.test`, name: `Synthetic ${uid}`, password: 'Synthetic-pass-1!' })).status).toBe(200);
    const s = await durableSession(await providerToken(uid));
    expect(s.status).toBe(200); tokens[uid] = s.body.token;
  }
});
afterAll(async () => { await closeBrowser(); });

describe('journey N: governed AI evaluation on the real server', () => {
  it('refuses an uncommissioned agent on an assigned case, and executes nothing', async () => {
    const r = await evaluate(tokens[ACCOUNTANT], request());
    refusedByPolicy(r); expect(r.body.code).toBe('AI_AGENT_INACTIVE');
  });
  it('refuses an unmapped agent, an action proposal and an unassigned case', async () => {
    const a = await evaluate(tokens[ACCOUNTANT], request({ agent_id: 'A11' })); refusedByPolicy(a); expect(a.body.code).toBe('AI_AGENT_INACTIVE');
    const b = await evaluate(tokens[ACCOUNTANT], request({ intent: 'PROPOSE_ACTION', financial_amount: 100 })); refusedByPolicy(b); expect(b.body.code).toBe('AI_AGENT_INACTIVE');
    const c = await evaluate(tokens[ACCOUNTANT], request({ scope: { ...ASSIGNED, client_id: 'e2eClient', tax_case_id: 'e2e-ai-unassigned' } }));
    refusedByPolicy(c); expect(c.body.code).toBe('AI_CASE_ACCESS_DENIED');
    const d = await evaluate(tokens[ACCOUNTANT], request({ scope: { ...ASSIGNED, tax_year: 2024 } }));
    refusedByPolicy(d); expect(d.body.code).toBe('AI_CASE_ACCESS_DENIED');
  });
  it('refuses another tenant and any caller-supplied approval or identity fields', async () => {
    const foreign = await evaluate(tokens[ACCOUNTANT], request({ scope: { ...ASSIGNED, tenant_id: 'tenantE2EOther' } }));
    refusedByPolicy(foreign); expect(foreign.body.code).toBe('AI_TENANT_DENIED');
    for (const forged of [{ approved: true }, { role: 'admin' }, { uid: ADMIN }, { human_approval: 'CPA_EA' }]) {
      const r = await evaluate(tokens[ACCOUNTANT], { ...request(), ...forged });
      expect(r.status).toBe(400); expect(r.body.code).toBe('AI_INVALID_REQUEST'); expect(r.body.action_executed).toBe(false);
    }
  });
  it('requires a durable session: anonymous and provider tokens are refused', async () => {
    expect((await evaluate(null, request())).status).toBe(401);
    const provider = await evaluate(await providerToken(ACCOUNTANT), request());
    expect(provider.status).toBe(401); expect(provider.body.action_executed).not.toBe(true);
  });
  it('an administrator stops an agent; evaluation stays refused', async () => {
    const stop = await fetch(ORIGIN + '/api/ai-governance/kill-switches', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[ADMIN]}` },
      body: JSON.stringify({ scope: 'AGENT', agent_id: 'A34', reason: 'Synthetic journey N stop' }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
    expect(stop.status).toBe(201); expect(stop.body).toMatchObject({ scope: 'AGENT', target: 'A34', enabled: true, activated_by: ADMIN });
    const asAccountant = await fetch(ORIGIN + '/api/ai-governance/kill-switches', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[ACCOUNTANT]}` },
      body: JSON.stringify({ scope: 'AGENT', agent_id: 'A34', reason: 'Synthetic unauthorised stop' }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
    expect(asAccountant.status).toBe(403); expect(asAccountant.body.code).toBe('AI_KILL_SWITCH_ROLE_DENIED');
    const list = await read(tokens[ADMIN], '/kill-switches');
    expect(list.body.kill_switches.filter((k: any) => k.enabled && k.target === 'A34')).toHaveLength(1);
    // The agent is already inactive, so the refusal code does not isolate the stop; the stop itself is recorded above.
    const r = await evaluate(tokens[ACCOUNTANT], request());
    refusedByPolicy(r);
  });
  it('records every refusal; only the administrator reads them; no agent is commissioned', async () => {
    const decisions = await read(tokens[ADMIN], '/control-center/decisions');
    expect(decisions.status).toBe(200);
    // Every policy refusal above is durable (schema refusals and unauthenticated calls are rejected before policy).
    expect(decisions.body.items.map((i: any) => i.reason_code).sort()).toEqual(
      ['AI_AGENT_INACTIVE', 'AI_AGENT_INACTIVE', 'AI_AGENT_INACTIVE', 'AI_AGENT_INACTIVE', 'AI_CASE_ACCESS_DENIED', 'AI_CASE_ACCESS_DENIED', 'AI_TENANT_DENIED']);
    expect(decisions.body.items.every((i: any) => i.outcome === 'DENIED' && i.action_executed === false && i.actor_uid === ACCOUNTANT)).toBe(true);
    const commissioning = await read(tokens[ADMIN], '/control-center/commissioning');
    expect(commissioning.status).toBe(200);
    expect(commissioning.body.material_actions).toBe('BLOCKED');
    expect(commissioning.body.agents).toHaveLength(61);
    expect(new Set(commissioning.body.agents.map((a: any) => a.commissioning_state))).toEqual(new Set(['DRAFT', 'STOPPED']));
    expect(commissioning.body.agents.find((a: any) => a.agent_id === 'A34').commissioning_state).toBe('STOPPED');
    expect((await read(tokens[ACCOUNTANT], '/control-center/decisions')).status).toBeGreaterThanOrEqual(400);
  });
  it('an administrator engages an agent stop through the AI Emergency Stop UI; it is recorded; the accountant has no such control', async () => {
    const s = await liveSessionWithToken(tokens[ADMIN], '/staff');
    await s.page.getByRole('button', { name: /AI Emergency Stop/ }).first().click();
    const panel = s.page.locator('section', { has: s.page.getByRole('heading', { name: 'AI Emergency Stop' }) });
    await panel.getByRole('heading', { name: 'Recorded stops' }).waitFor();
    await panel.getByLabel('One agent').check();
    await panel.getByLabel('Agent', { exact: true }).selectOption('A10');
    await panel.getByLabel(/^Reason \(recorded/).fill('Synthetic journey N stop through the UI');
    await panel.getByRole('button', { name: 'Engage emergency stop…' }).click();
    // A confirmation step names the exact target before anything is sent.
    const confirm = panel.getByRole('alertdialog');
    await confirm.getByText(/Stop agent A10 for this tenant\?/).waitFor();
    await confirm.getByRole('button', { name: 'Confirm emergency stop' }).click();
    await panel.getByRole('status').filter({ hasText: 'Emergency stop engaged for A10.' }).waitFor();
    await panel.getByRole('row').filter({ hasText: 'A10' }).filter({ hasText: 'ENGAGED' }).filter({ hasText: ADMIN }).waitFor();
    // The server recorded it: the stop is durable, attributed to the administrator, and A10 is now stopped.
    const list = await read(tokens[ADMIN], '/kill-switches');
    expect(list.body.kill_switches.filter((k: any) => k.enabled && k.target === 'A10' && k.activated_by === ADMIN)).toHaveLength(1);
    const commissioning = await read(tokens[ADMIN], '/control-center/commissioning');
    expect(commissioning.body.agents.find((a: any) => a.agent_id === 'A10').commissioning_state).toBe('STOPPED');
    // Lifting a stop is not offered in the workspace.
    expect(await panel.getByRole('button', { name: /lift|disable|release|resume/i }).count()).toBe(0);
    // Audit: the stop is a CRITICAL governance security event attributed to the administrator.
    const events = await read(tokens[ADMIN], '/control-center/security-events');
    expect(events.status).toBe(200);
    const stopEvent = events.body.items.find((e: any) => e.event_type === 'KILL_SWITCH' && e.details?.target === 'A10');
    expect(stopEvent, JSON.stringify(events.body.items.map((e: any) => [e.event_type, e.details?.target]))).toMatchObject({ actor_uid: ADMIN, severity: 'CRITICAL' });
    expect(stopEvent.details).toMatchObject({ operation: 'ACTIVATE', scope: 'AGENT', target: 'A10' });
    expect(typeof stopEvent.details.switch_id).toBe('string');
    expect(stopEvent.details.reason_sha256).toMatch(/^[a-f0-9]{64}$/);
    // New governed execution for the stopped agent is refused. A10 was already inactive (nothing is commissioned), so
    // the refusal code alone cannot isolate the stop; the recorded stop above is the evidence that it is in force.
    refusedByPolicy(await evaluate(tokens[ACCOUNTANT], request({ agent_id: 'A10' })));
    // Nothing is erased: the earlier decisions and the earlier A34 stop are still recorded and readable.
    const decisionsAfter = await read(tokens[ADMIN], '/control-center/decisions');
    expect(decisionsAfter.body.items.length).toBeGreaterThanOrEqual(7);
    expect(list.body.kill_switches.filter((k: any) => k.enabled && k.target === 'A34')).toHaveLength(1);
    // Negative: a non-administrator cannot engage a global stop through the server, whatever the UI shows.
    const globalAttempt = await fetch(ORIGIN + '/api/ai-governance/kill-switches', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[ACCOUNTANT]}` },
      body: JSON.stringify({ scope: 'GLOBAL', reason: 'Synthetic unauthorised global stop' }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
    expect(globalAttempt.status).toBe(403); expect(globalAttempt.body.code).toBe('AI_KILL_SWITCH_ROLE_DENIED');
    expect((await read(tokens[ADMIN], '/kill-switches')).body.kill_switches.filter((k: any) => k.scope === 'GLOBAL')).toHaveLength(0);
    await s.context.close();

    const a = await liveSessionWithToken(tokens[ACCOUNTANT], '/staff');
    await a.page.waitForLoadState('networkidle');
    expect(await a.page.getByRole('button', { name: /AI Emergency Stop/ }).count()).toBe(0);
    expect(await a.page.getByRole('heading', { name: 'AI Emergency Stop' }).count()).toBe(0);
    await a.context.close();
  });
});
