import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachScopedClientGrants, explicitTaxYear, hasClientYearAccess, reachableClientIds, scopedClientGrants } from '../server/staffScopedGrants';
import { bookkeepingRouter } from '../server/routes/bookkeeping.routes';
import { db } from '../server/db';
import { setLedgerStoreForTesting } from '../server/taxguard/bookkeeping/ledgerBackend';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Engagement / tax-year scoped grants (owner decision 2026-10-19). Synthetic data only.
describe('scoped client grants', () => {
  const user = { authorizedClientIds: ['wholeClient'] };
  attachScopedClientGrants(user, [{ clientId: 'scopedClient', engagementId: 'e1', taxYear: 2025 }]);
  it('grants the scoped client for its tax year only; whole-client grants are unchanged', () => {
    expect(hasClientYearAccess(user, 'scopedClient', 2025)).toBe(true);
    expect(hasClientYearAccess(user, 'scopedClient', 2024)).toBe(false);
    expect(hasClientYearAccess(user, 'scopedClient', undefined)).toBe(false);
    expect(hasClientYearAccess(user, 'wholeClient', undefined)).toBe(true);
    expect(hasClientYearAccess(user, 'otherClient', 2025)).toBe(false);
    expect(user.authorizedClientIds).toEqual(['wholeClient']); // never widened
    expect(reachableClientIds(user)).toEqual(['wholeClient', 'scopedClient']);
  });
  it('is never serialized and cannot be altered by callers', () => {
    expect(JSON.stringify(user)).not.toContain('scopedClient');
    const grants = scopedClientGrants(user) as any[];
    expect(() => { grants.push({ clientId: 'x', engagementId: 'e', taxYear: 2025 }); }).toThrow();
    expect(() => { grants[0].taxYear = 2024; }).toThrow();
  });
  it('reads only an explicit, plausible tax year', () => {
    expect(explicitTaxYear({ query: { taxYear: '2025' } })).toBe(2025);
    expect(explicitTaxYear({ body: { taxYear: 2025 } })).toBe(2025);
    for (const v of [undefined, '', '25', '2025abc', 'NaN', 1999, 2101, 2025.5]) expect(explicitTaxYear({ query: { taxYear: v as any } })).toBeUndefined();
  });
});

// Real local authentication -> /api/bookkeeping -> durable ledger (proposals 024 + 030 on PGlite).
const T = 'tenantA', C = 'bkScoped', OTHER = 'bkScopedOther';
const BK = 'bk-scoped', BK_TOKEN = 'bk-scoped-token';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>; let server: Server; let origin = ''; let n = 0;
beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|300000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','o1','Synthetic Scoped Books'),('${T}','${OTHER}','o2','Other');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('${T}','${BK}','bookkeeper','active');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by,effective_from) VALUES('bks-1','${T}','${C}','bookkeeper','${BK}','seed',now()-interval '1 day');`);
  setLedgerStoreForTesting(new SqlLedgerStore(pgliteRpc(() => fixture.pg)));
  const app = express(); app.use(express.json()); app.use('/api/bookkeeping', bookkeepingRouter);
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 60000);
afterAll(async () => { setLedgerStoreForTesting(null); server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  // No whole-client grant at all: only an engagement-scoped grant for 2025.
  const user: any = { id: BK, name: 'Synthetic Scoped Bookkeeper', email: 'bks@example.test', role: 'bookkeeper', tenantId: T, authorizedClientIds: [], status: 'active', createdAt: '2025-01-01', isVerified: true };
  attachScopedClientGrants(user, [{ clientId: C, engagementId: 'eng-2025', taxYear: 2025 }]);
  db.users.set(BK, user); db.sessions.set(BK_TOKEN, { userId: BK, expiresAt: Date.now() + 60_000 } as any);
});
afterEach(() => { db.users.delete(BK); db.sessions.delete(BK_TOKEN); vi.unstubAllEnvs(); });
const call = async (method: 'GET' | 'POST', path: string, params: { client?: string; taxYear?: number | null } = {}) => {
  const client = params.client ?? C; const year = params.taxYear === undefined ? 2025 : params.taxYear;
  const q = method === 'GET' ? `?clientId=${client}${year === null ? '' : `&taxYear=${year}`}` : '';
  const r = await fetch(origin + '/api/bookkeeping' + path + q, { method, headers: { Authorization: `Bearer ${BK_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': `bks-key-${++n}-${Date.now()}` },
    ...(method === 'POST' ? { body: JSON.stringify({ clientId: client, ...(year === null ? {} : { taxYear: year }) }) } : {}) });
  return { status: r.status, body: await r.json().catch(() => null) as any };
};

describe('bookkeeper on the durable ledger with an engagement-scoped grant', () => {
  it('works the granted client for the granted tax year', async () => {
    const chart = await call('POST', '/chart-of-accounts/standard');
    expect(chart.status, JSON.stringify(chart.body)).toBeLessThan(300);
    expect((await call('GET', '/journal-entries')).status).toBe(200);
    expect((await call('GET', '/bookkeeper-dashboard')).status).toBe(200);
    expect((await call('GET', '/bookkeeper-clients')).body.clientIds).toEqual([C]);
  });
  it('a reviewer with only a scoped grant reads the durable ledger for that year and is refused otherwise', async () => {
    const REV = 'rev-scoped', REV_TOKEN = 'rev-scoped-token';
    await fixture.pg.exec(`INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('${T}','${REV}','senior_reviewer','active') ON CONFLICT DO NOTHING;
      INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by,effective_from) VALUES('bks-rev','${T}','${C}','reviewer','${REV}','seed',now()-interval '1 day') ON CONFLICT DO NOTHING;`);
    const reviewer: any = { id: REV, name: 'Synthetic Scoped Reviewer', email: 'rvs@example.test', role: 'senior_reviewer', tenantId: T, authorizedClientIds: [], status: 'active', createdAt: '2025-01-01', isVerified: true };
    attachScopedClientGrants(reviewer, [{ clientId: C, engagementId: 'eng-2025', taxYear: 2025 }]);
    db.users.set(REV, reviewer); db.sessions.set(REV_TOKEN, { userId: REV, expiresAt: Date.now() + 60_000, verifiedMfa: true } as any);
    try {
      const get = (year: number | null, client = C) => fetch(origin + `/api/bookkeeping/journal-entries?clientId=${client}${year === null ? '' : `&taxYear=${year}`}`,
        { headers: { Authorization: `Bearer ${REV_TOKEN}` } }).then(r => r.status);
      expect(await get(2025)).toBe(200);
      for (const [what, status] of [['other year', await get(2024)], ['no year', await get(null)], ['other client', await get(2025, OTHER)]] as const)
        expect([what, status]).toEqual([what, 403]);
    } finally { db.users.delete(REV); db.sessions.delete(REV_TOKEN); }
  });

  it('refuses another tax year, a missing tax year and another client', async () => {
    for (const [what, r] of [['other year', await call('GET', '/journal-entries', { taxYear: 2024 })], ['no year', await call('GET', '/journal-entries', { taxYear: null })],
      ['other client', await call('GET', '/journal-entries', { client: OTHER })], ['post other year', await call('POST', '/chart-of-accounts/standard', { taxYear: 2024 })],
      ['dashboard other year', await call('GET', '/bookkeeper-dashboard', { taxYear: 2024 })]] as const)
      expect([what, r.status, r.body?.code]).toEqual([what, 403, 'BOOKKEEPER_SCOPE_DENIED']);
  });
});
