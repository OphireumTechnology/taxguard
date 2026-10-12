import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';

// Every proposal in docs/proposed-migrations (Codex 000-110 and Claude 230-260) applied in order on
// the actual core schema, then database-wide security invariants and a cross-module isolation /
// role matrix. Synthetic data only. Proposals remain unapplied anywhere else.
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const proposals = readdirSync('docs/proposed-migrations').filter(n => /^\d{14}_.+\.sql$/.test(n)).sort();

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^\d{14}_.+\.sql$/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('tenantA','isoA','ownA','Synthetic A'),('tenantB','isoB','ownB','Synthetic B');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','iso-mgr','practice_manager','active'),('tenantB','iso-mgr-b','practice_manager','active'),
      ('tenantA','iso-client','client','active'),('tenantA','iso-recruiter','recruiter','active'),('tenantA','iso-acct','accountant','active'),('tenantA','iso-suspended','admin','suspended');`);
}, 120000);
afterAll(async () => { await fixture?.pg.close(); });

describe('proposal composition', () => {
  it('applies every proposal in order without conflicts', () => {
    expect(proposals.length).toBeGreaterThanOrEqual(16);
    expect(proposals).toEqual(expect.arrayContaining(['20261012230000_taxguard_session_management.sql', '20261012240000_taxguard_durable_ledger.sql',
      '20261012250000_taxguard_practice_management.sql', '20261012260000_taxguard_case_workflow.sql', '20261012270000_taxguard_document_vault.sql', '20261012280000_taxguard_billing.sql', '20261012290000_taxguard_book_to_tax.sql', '20261012300000_taxguard_bookkeeper_workqueue.sql',
      '20261012310000_taxguard_document_requests.sql', '20261012320000_taxguard_role_dashboards.sql']));
  });
  it('re-applies cleanly (idempotent DDL)', async () => {
    await applyProposals(fixture.pg, /^202610122[3-9]|^2026101230|^2026101231|^2026101232/);
  }, 60000);
});

describe('database-wide security invariants', () => {
  it('every SECURITY DEFINER taxguard function pins search_path', async () => {
    const rows = (await fixture.pg.query<{ proname: string }>(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard%' AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')`)).rows;
    expect(rows.map(r => r.proname)).toEqual([]);
  });
  it('no taxguard function added by the Claude proposals is executable by anon or authenticated', async () => {
    const rows = (await fixture.pg.query<{ proname: string }>(`SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND (p.proname LIKE 'taxguard\\_ledger\\_%' OR p.proname LIKE 'taxguard\\_practice\\_%' OR p.proname LIKE 'taxguard\\_case\\_%' OR p.proname LIKE 'taxguard\\_doc\\_%' OR p.proname LIKE 'taxguard\\_bill\\_%' OR p.proname LIKE 'taxguard\\_b2t\\_%' OR p.proname LIKE 'taxguard\\_docreq\\_%' OR p.proname LIKE 'taxguard\\_client\\_notification%'
        OR p.proname IN ('taxguard_session_actor','taxguard_list_own_sessions','taxguard_revoke_own_session','taxguard_revoke_other_own_sessions',
          'taxguard_admin_revoke_member_sessions','taxguard_list_own_security_events'))
        AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))`)).rows;
    expect(rows.map(r => r.proname)).toEqual([]);
  });
  it('new tables are not readable by anon or authenticated', async () => {
    for (const table of ['taxguard_ledger_entries', 'taxguard_ledger_lines', 'taxguard_ledger_accounts', 'taxguard_ledger_bank_transactions', 'taxguard_engagement_notes', 'taxguard_case_stage_events']) {
      for (const role of ['anon', 'authenticated']) {
        expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_table_privilege('${role}', 'public.${table}', 'SELECT') AS ok`)).rows[0].ok, `${role} ${table}`).toBe(false);
      }
    }
  });
  it('internal helpers are not executable by the service role either', async () => {
    for (const fn of ["taxguard_ledger_actor(text,text,text)", "taxguard_practice_client_access(text,text,text,boolean,boolean)", "taxguard_session_actor(text,text,text)"]) {
      expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_function_privilege('service_role', 'public.${fn}', 'EXECUTE') AS ok`)).rows[0].ok, fn).toBe(false);
    }
  });
});

describe('cross-module tenant isolation and role matrix', () => {
  const rpc = pgliteRpc(() => fixture.pg);
  const ledger = new SqlLedgerStore(rpc), practice = new PracticeStore(rpc), cases = new CaseStore(rpc);
  const reads = (tenant: string, client: string, actor: string) => [
    () => ledger.read({ tenantId: tenant, clientId: client }, actor, 2025),
    () => practice.clientDetail(tenant, client, actor),
    () => practice.listClients(tenant, actor).then(r => { if (r.items.some((c: any) => c.clientId === client)) return r; throw new Error('CLIENT_NOT_FOUND'); }),
  ];
  it('a manager of one tenant reaches nothing of another tenant through any module', async () => {
    for (const read of reads('tenantA', 'isoB', 'iso-mgr')) await expect(read()).rejects.toThrow();
    for (const read of reads('tenantB', 'isoB', 'iso-mgr')) await expect(read()).rejects.toThrow();
    await expect(cases.queue('tenantB', 'iso-mgr')).rejects.toMatchObject({ code: 'PRACTICE_ACCESS_DENIED' });
  });
  it.each([['client', 'iso-client'], ['recruiter', 'iso-recruiter'], ['suspended administrator', 'iso-suspended'], ['unknown user', 'iso-nobody']])('refuses a %s in every module', async (_l, actor) => {
    for (const read of reads('tenantA', 'isoA', actor)) await expect(read()).rejects.toThrow();
    await expect(cases.queue('tenantA', actor)).rejects.toThrow();
    await expect(practice.createEngagement('tenantA', 'isoA', actor, 'iso-key-' + actor, { title: 'Attempt', type: 'tax_preparation', taxYears: [2025] })).rejects.toThrow();
  });
  it('unassigned staff see neither ledger nor client detail, while managers do', async () => {
    await expect(ledger.read({ tenantId: 'tenantA', clientId: 'isoA' }, 'iso-acct', 2025)).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED' });
    await expect(practice.clientDetail('tenantA', 'isoA', 'iso-acct')).rejects.toMatchObject({ code: 'CLIENT_NOT_FOUND' });
    await expect(ledger.read({ tenantId: 'tenantA', clientId: 'isoA' }, 'iso-mgr', 2025)).rejects.toMatchObject({ code: 'LEDGER_ACCESS_DENIED' });
    expect((await practice.clientDetail('tenantA', 'isoA', 'iso-mgr')).client.clientId).toBe('isoA');
  });
});
