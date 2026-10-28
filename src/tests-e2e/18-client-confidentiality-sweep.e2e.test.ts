import { afterAll, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, FOREIGN_CLIENT, ORIGIN, sees, sessionWithToken, UNASSIGNED_CLIENT } from './helpers';

// C9: every client-reachable read of the default profile, called directly with the client's own session after
// all earlier suites have recorded staff-only data (review notes, internal message notes, invoice rework notes,
// credit and refund reasons, decider identities). The server response itself must carry none of it; hiding
// fields in the portal is not enough. Runs last (name order). Synthetic data only.
const STAFF_IDS = ['e2e-mgr', 'e2e-mgr2', 'e2e-acct', 'e2e-rev', 'e2e-bk', 'e2e-admin'];
const PRIVATE_TEXT = [/C9 PRIVATE/, /F-PRIVATE/, /K-PRIVATE/, /goodwill/i, /Synthetic internal: confirm the employer/, /Synthetic overpayment returned by cheque/,
  /Synthetic accountant attempt/, /Synthetic state return add-on/];
const OTHER_SCOPE = ['tenantE2EOther', FOREIGN_CLIENT, UNASSIGNED_CLIENT];
// Field names that only ever describe staff work or staff identity.
const STAFF_KEYS = new Set(['reviewNote', 'internalNote', 'internalNotes', 'staffNote', 'reviewedBy', 'decidedBy', 'preparedBy', 'approvedBy', 'issuedBy', 'voidedBy',
  'requestedBy', 'recordedBy', 'assignedBy', 'uploadedBy', 'createdBy', 'updatedBy', 'actorUid', 'actorRole', 'ownerUid', 'rateOverrideReason', 'voidReason', 'history', 'auditTrail']);

type Finding = { endpoint: string; problem: string };
/** Records from a list response, whether it is a bare array or wrapped ({items}, {threads}, {requests}, ...). */
const list = (body: any): any[] => Array.isArray(body) ? body
  : (body?.items ?? body?.threads ?? body?.appointments ?? body?.requests ?? body?.engagements ?? body?.matters ?? body?.notifications ?? []);
function scan(endpoint: string, body: unknown, findings: Finding[]) {
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (STAFF_KEYS.has(k) && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) findings.push({ endpoint, problem: `staff field ${path}.${k}` });
        walk(v, `${path}.${k}`);
      }
      return;
    }
    if (typeof value === 'string') {
      if (STAFF_IDS.includes(value)) findings.push({ endpoint, problem: `staff identity at ${path}` });
      for (const p of PRIVATE_TEXT) if (p.test(value)) findings.push({ endpoint, problem: `private text ${p} at ${path}` });
      for (const o of OTHER_SCOPE) if (value === o) findings.push({ endpoint, problem: `other scope ${o} at ${path}` });
    }
  };
  walk(body, '$');
}

let clientToken = '';
afterAll(async () => { await closeBrowser(); });

describe('C9: client-facing API responses carry no staff-only data', () => {
  it('the scanner reports each kind of leak it claims to detect (self-test)', () => {
    const findings: Finding[] = [];
    scan('synthetic', { a: [{ reviewNote: 'x' }], b: { decidedBy: null, nested: { author: 'e2e-acct' } }, c: 'C9 PRIVATE note', d: 'tenantE2EOther', e: { history: [] } }, findings);
    expect(findings.map(f => f.problem).sort()).toEqual(['other scope tenantE2EOther at $.d', 'private text /C9 PRIVATE/ at $.c', 'staff field $.a[0].reviewNote', 'staff identity at $.b.nested.author']);
  });

  it('the staff-only data exists and staff can read it, so the client sweep proves withholding, not absence', async () => {
    const mgr = await apiLogin('e2e-mgr'); const acct = await apiLogin('e2e-acct');
    const docs = list((await api(mgr, 'GET', `/api/vault/clients/${C}/documents`, undefined, null)).body);
    const details = await Promise.all(docs.map((d: any) => api(mgr, 'GET', `/api/vault/clients/${C}/documents/${d.documentId}`, undefined, null)));
    expect(JSON.stringify(details.map(d => d.body))).toMatch(/C9 PRIVATE/);
    const invoices = JSON.stringify((await api(mgr, 'GET', `/api/billing/clients/${C}/invoices`, undefined, null)).body);
    // (The rework note F-PRIVATE is cleared by design when the preparer resubmits, so it is checked only on the client side.)
    for (const p of [/K-PRIVATE/, /"approvedBy":"e2e-mgr"/, /"decidedBy":"e2e-mgr2"/, /"preparedBy":"e2e-acct"/]) expect(invoices).toMatch(p);
    const threads = list((await api(acct, 'GET', `/api/communications/clients/${C}/threads`, undefined, null)).body);
    const bodies = await Promise.all(threads.map((t: any) => api(acct, 'GET', `/api/communications/clients/${C}/threads/${t.threadId ?? t.id}`, undefined, null)));
    expect(JSON.stringify(bodies.map(b => b.body))).toMatch(/Synthetic internal: confirm the employer/);
  });

  it('every client-reachable read is free of staff notes, staff identities, decisions and other scopes', async () => {
    clientToken = await apiLogin('e2e-client');
    const findings: Finding[] = []; const reached: string[] = []; const refused: string[] = [];
    const read = async (path: string) => {
      const r = await api(clientToken, 'GET', path, undefined, null);
      if (r.status === 200) { reached.push(path); scan(path, r.body, findings); } else refused.push(`${r.status} ${path}`);
      return r.status === 200 ? r.body : null;
    };
    await read('/api/auth/me');
    await read('/api/stage-one/me');
    const docs = await read(`/api/vault/clients/${C}/documents`);
    for (const d of list(docs)) {
      await read(`/api/vault/clients/${C}/documents/${d.documentId}`);
      await read(`/api/vault/clients/${C}/documents/${d.documentId}?includeInternal=true`);
    }
    await read(`/api/vault/clients/${C}/requests?taxYear=2025`);
    await read(`/api/vault/clients/${C}/notifications`);
    await read(`/api/vault/clients/${C}/notification-preferences`);
    await read(`/api/vault/clients/${C}/upload-targets`);
    const threads = await read(`/api/communications/clients/${C}/threads`);
    for (const t of list(threads)) await read(`/api/communications/clients/${C}/threads/${t.threadId ?? t.id}`);
    const appointments = await read(`/api/scheduling/clients/${C}/appointments`);
    for (const a of list(appointments)) {
      await read(`/api/scheduling/clients/${C}/appointments/${a.appointmentId ?? a.id}`);
      await read(`/api/scheduling/clients/${C}/appointments/${a.appointmentId ?? a.id}/room`);
    }
    await read(`/api/legal-matters/clients/${C}/matters`);
    const engagements = await read(`/api/client-portal/clients/${C}/engagements`);
    await read(`/api/client-portal/clients/${C}/case-stages`);
    await read(`/api/client-portal/clients/${C}/consultations`);
    await read(`/api/reassignment/clients/${C}/requests`);
    const invoices = await read(`/api/billing/clients/${C}/invoices`);
    await read(`/api/billing/clients/${C}/invoice-pages`);
    const engagementIds = new Set<string>(list(engagements).map((e: any) => e.engagementId));
    for (const id of engagementIds) {
      await read(`/api/stage-two-three/questionnaire/2025?engagementId=${encodeURIComponent(id)}`);
      await read(`/api/stage-two-three/requirements/2025?engagementId=${encodeURIComponent(id)}`);
      const reqs = await read(`/api/stage-two-three/requests/2025?engagementId=${encodeURIComponent(id)}`);
      for (const r of list(reqs)) await read(`/api/stage-two-three/requests/2025/${r.requestId ?? r.id}?engagementId=${encodeURIComponent(id)}`);
    }
    // Issued invoice documents are client documents too.
    for (const inv of list(invoices)) {
      const r = await fetch(ORIGIN + `/api/billing/clients/${C}/invoices/${inv.invoiceId}/document`, { headers: { Authorization: `Bearer ${clientToken}` } });
      if (r.status !== 200) continue;
      reached.push(`invoice document ${inv.invoiceNumber}`);
      scan(`invoice document ${inv.invoiceNumber}`, Buffer.from(await r.arrayBuffer()).toString('latin1'), findings);
    }
    // The sweep must actually have reached the data the earlier suites created.
    expect(reached.length).toBeGreaterThanOrEqual(20);
    expect(list(docs).length).toBeGreaterThan(0);
    expect(list(invoices).length).toBeGreaterThanOrEqual(2);
    expect(list(threads).length).toBeGreaterThan(0);
    expect(findings, JSON.stringify({ refused }, null, 1)).toEqual([]);
  });

  it('a client cannot read another client, another tenant or staff-only endpoints', async () => {
    for (const other of [FOREIGN_CLIENT, UNASSIGNED_CLIENT]) {
      for (const path of [`/api/vault/clients/${other}/documents`, `/api/communications/clients/${other}/threads`, `/api/billing/clients/${other}/invoices`,
        `/api/scheduling/clients/${other}/appointments`, `/api/client-portal/clients/${other}/engagements`, `/api/stage-one/clients/${other}`]) {
        const r = await api(clientToken, 'GET', path, undefined, null);
        expect(r.status, path).toBeGreaterThanOrEqual(403);
        expect(JSON.stringify(r.body ?? {}), path).not.toMatch(/Synthetic (Unassigned|Foreign) Client/);
      }
    }
    for (const path of ['/api/vault/review-queue', '/api/communications/inbox', '/api/practice/clients', '/api/billing/ar-aging', '/api/audit-center/events',
      '/api/stage-one/queue', '/api/scheduling/schedule?from=2026-01-01&to=2026-12-31', '/api/reassignment/queue', '/api/consultations/requests', '/api/cases'])
      expect((await api(clientToken, 'GET', path, undefined, null)).status, path).toBeGreaterThanOrEqual(401);
  });

  it('the portal pages render none of the staff-only text either', async () => {
    const s = await sessionWithToken(clientToken, '/portal/dashboard');
    for (const view of ['documents', 'messages', 'billing', 'requests', 'appointments']) {
      await s.page.goto(`${ORIGIN}/portal/dashboard#nav=${view}`);
      await s.page.waitForLoadState('networkidle');
      const text = await s.page.locator('body').innerText();
      for (const p of PRIVATE_TEXT) expect(text, `${view} ${p}`).not.toMatch(p);
      for (const id of STAFF_IDS) expect(text.split(/\s+/), `${view} ${id}`).not.toContain(id);
    }
    await sees(s.page, 'A/R Tax Services');
    await s.context.close();
  });
});
