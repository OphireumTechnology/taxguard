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
let taxPrivileges: { proname: string; client: boolean; service: boolean }[] = [];

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^\d{14}_.+\.sql$/);
  // Captured before 're-applies cleanly' re-runs older proposals, whose privilege loops would reset these grants.
  taxPrivileges = (await fixture.pg.query<{ proname: string; client: boolean; service: boolean }>(`SELECT p.proname,
      has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE') AS client,
      has_function_privilege('service_role', p.oid, 'EXECUTE') AS service
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\\_tax\\_%'`)).rows;
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
      '20261012310000_taxguard_document_requests.sql', '20261012320000_taxguard_role_dashboards.sql',
      '20261012330000_taxguard_tax_engine_foundation.sql',
      '20261012340000_taxguard_mfa_recovery_completion.sql',
      '20261012350000_taxguard_staff_access_hardening.sql',
      '20261012360000_taxguard_tax_rule_verification_cases.sql',
      '20261012370000_taxguard_mfa_recovery_history.sql',
      '20261012380000_taxguard_tax_rule_coverage.sql',
      '20261013390000_taxguard_client_messaging.sql',
      '20261014400000_taxguard_appointments.sql',
      '20261014410000_taxguard_audit_center.sql',
      '20261014420000_taxguard_legal_coordination.sql',
      '20261014430000_taxguard_consultation_requests.sql',
      '20261014440000_taxguard_client_portal_reads.sql',
      '20261014450000_taxguard_reassignment_requests.sql',
      '20261014460000_taxguard_audit_security_view.sql',
      '20261014470000_taxguard_billing_client_projection.sql',
      '20261014480000_taxguard_security_events.sql',
      '20261014490000_taxguard_data_api_lockdown.sql',
      '20261014500000_taxguard_document_scan_requests.sql',
      '20261016000000_taxguard_portal_case_stages.sql',
      '20261016010000_taxguard_portal_consultations.sql',
      '20261016020000_taxguard_staff_onboarding_status.sql', '20261016030000_taxguard_appointment_rooms.sql',
      '20261016040000_taxguard_notification_preferences.sql', '20261016050000_taxguard_contact_intake.sql',
      '20261017000000_taxguard_membership_session_proof.sql', '20261018000000_taxguard_case_validate_replacement_evidence.sql',
      '20261018010000_taxguard_billing_refund_records.sql', '20261018020000_taxguard_client_id_sequence_initialize.sql',
      '20261018030000_taxguard_client_onboarding.sql', '20261018040000_taxguard_billing_transition_audit.sql',
      '20261018050000_taxguard_case_workpaper_evidence.sql', '20261018060000_taxguard_engagement_scoped_access.sql',
      '20261018070000_taxguard_ledger_year_scope.sql', '20261018080000_taxguard_document_request_scope.sql',
      '20261018090000_taxguard_case_assignment_liveness.sql', '20261018100000_taxguard_practice_client_scope.sql',
      '20261018105000_taxguard_case_restaff.sql', '20261018140000_taxguard_ai_agent_evaluation.sql',
      '20261018150000_taxguard_tax_research.sql', '20261018160000_taxguard_return_diagnostics.sql',
      '20261018170000_taxguard_risk_materiality.sql', '20261018180000_taxguard_case_validate_extraction_evidence.sql', '20261018190000_taxguard_tax_calc_input_lineage.sql',
      '20261018110000_taxguard_financial_reporting.sql', '20261018120000_taxguard_report_cent_transport.sql', '20261018130000_taxguard_ledger_report_year_guard.sql', '20261019000000_taxguard_invoice_idempotency.sql', '20261019010000_taxguard_adjustment_idempotency.sql', '20261019020000_taxguard_refund_idempotency.sql', '20261019030000_taxguard_billing_write_retries.sql', '20261019040000_taxguard_ledger_write_retries.sql', '20261019050000_taxguard_line_removal_retries.sql', '20261019060000_taxguard_catalog_concurrency.sql', '20261019080000_taxguard_ledger_replay_year_scope.sql', '20261019090000_taxguard_onboarding_authority_after_wait.sql', '20261019100000_taxguard_tax_conclusions.sql', '20261019110000_taxguard_tax_form_mapping.sql', '20261019115000_taxguard_tax_approval_authority.sql', '20261019120000_taxguard_tax_returns.sql', '20261019130000_taxguard_form_rule_approval_authority.sql', '20261019140000_taxguard_tax_return_verification.sql', '20261019150000_taxguard_return_level_diagnostics.sql', '20261019160000_taxguard_return_risk_assessment.sql', '20261019170000_taxguard_return_quality_control.sql', '20261019180000_taxguard_return_final_authorization.sql']));
  });
  it('re-applies cleanly (idempotent DDL)', async () => {
    await applyProposals(fixture.pg, /^202610122[3-9]|^2026101230|^2026101231|^2026101232|^2026101233|^2026101234|^2026101235|^2026101236|^2026101237|^2026101238|^20261013|^20261014|^20261015|^20261016/);
  }, 60000);
});

describe('database-wide security invariants', () => {
  it('every SECURITY DEFINER taxguard function pins search_path', async () => {
    const rows = (await fixture.pg.query<{ proname: string }>(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard%' AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')`)).rows;
    expect(rows.map(r => r.proname)).toEqual([]);
  });
  it('every SECURITY DEFINER function pins a safe search_path (pg_temp never implicitly first)', async () => {
    const rows = (await fixture.pg.query<{ proname: string }>(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prosecdef
      AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%' AND c NOT IN ('search_path=pg_catalog, public, pg_temp', 'search_path=public, pg_temp', 'search_path=pg_catalog'))`)).rows;
    expect(rows.map(r => r.proname)).toEqual([]);
  });
  it('no taxguard function added by the Claude proposals is executable by anon or authenticated', async () => {
    const rows = (await fixture.pg.query<{ proname: string }>(`SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND (p.proname LIKE 'taxguard\\_ledger\\_%' OR p.proname LIKE 'taxguard\\_comm\\_%' OR p.proname LIKE 'taxguard\\_apt\\_%' OR p.proname LIKE 'taxguard\\_audit\\_center\\_%' OR p.proname LIKE 'taxguard\\_legal\\_%' OR p.proname LIKE 'taxguard\\_consult\\_%' OR p.proname LIKE 'taxguard\\_rar\\_%' OR p.proname LIKE 'taxguard\\_portal\\_%' OR p.proname LIKE 'taxguard\\_practice\\_%' OR p.proname LIKE 'taxguard\\_case\\_%' OR p.proname LIKE 'taxguard\\_doc\\_%' OR p.proname LIKE 'taxguard\\_bill\\_%' OR p.proname LIKE 'taxguard\\_onb\\_%' OR p.proname LIKE 'taxguard\\_b2t\\_%' OR p.proname LIKE 'taxguard\\_docreq\\_%' OR p.proname LIKE 'taxguard\\_client\\_notification%' OR p.proname LIKE 'taxguard\\_security\\_event%'
        OR p.proname IN ('taxguard_session_actor','taxguard_list_own_sessions','taxguard_revoke_own_session','taxguard_revoke_other_own_sessions',
          'taxguard_admin_revoke_member_sessions','taxguard_list_own_security_events',
          'taxguard_staff_admin_session','taxguard_mfa_recovery_history','taxguard_mfa_recovery_step'))
        AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))`)).rows;
    expect(rows.map(r => r.proname)).toEqual([]);
  });
  it('no tax engine function is executable by anon or authenticated in execution order', () => {
    expect(taxPrivileges.length).toBeGreaterThan(0);
    expect(taxPrivileges.filter(r => r.client).map(r => r.proname)).toEqual([]);
  });
  it('return verification, risk and quality control internals are not executable by the service role in execution order', () => {
    const internal = ['taxguard_tax_return_verification_guard', 'taxguard_tax_return_verification_runs', 'taxguard_tax_return_risk_guard',
      'taxguard_tax_return_risk_json', 'taxguard_tax_qc_checklist_current', 'taxguard_tax_return_qc_guard', 'taxguard_tax_return_qc_live',
      'taxguard_tax_return_qc_scope'];
    const present = taxPrivileges.filter(r => internal.includes(r.proname));
    expect([...new Set(present.map(r => r.proname))].sort()).toEqual([...internal].sort());
    expect(present.filter(r => r.service).map(r => r.proname)).toEqual([]);
  });
  it('the return verification, risk and quality control entry points stay executable by the service role in execution order', () => {
    const entry = ['taxguard_tax_return_verify', 'taxguard_tax_return_risk_assess', 'taxguard_tax_return_qc_assign', 'taxguard_tax_return_qc_record',
      'taxguard_tax_return_final_readiness'];
    const present = taxPrivileges.filter(r => entry.includes(r.proname));
    expect([...new Set(present.map(r => r.proname))].sort()).toEqual([...entry].sort());
    expect(present.filter(r => !r.service).map(r => r.proname)).toEqual([]);
  });
  it('new tables are not readable by anon or authenticated', async () => {
    for (const table of ['taxguard_ledger_entries', 'taxguard_ledger_lines', 'taxguard_ledger_accounts', 'taxguard_ledger_bank_transactions', 'taxguard_engagement_notes', 'taxguard_case_stage_events']) {
      for (const role of ['anon', 'authenticated']) {
        expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_table_privilege('${role}', 'public.${table}', 'SELECT') AS ok`)).rows[0].ok, `${role} ${table}`).toBe(false);
      }
    }
  });
  it('after the Data API lock-down (049) no client-facing role writes any table and the tenant-claim policies are gone', async () => {
    const writable = (await fixture.pg.query<{ relname: string }>(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND (c.relname LIKE 'taxguard%' OR c.relname LIKE 'ai\\_%')
        AND (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE'))`)).rows;
    expect(writable.map(r => r.relname)).toEqual([]);
    const readable = (await fixture.pg.query<{ relname: string }>(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND has_table_privilege('authenticated', c.oid, 'SELECT') ORDER BY 1`)).rows;
    // Only the reads the vault storage policies need may remain (none without Supabase's default grants).
    for (const r of readable) expect(['taxguard_cases', 'taxguard_clients']).toContain(r.relname);
    expect((await fixture.pg.query(`SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE 'rls\\_taxguard\\_%\\_all'`)).rows).toEqual([]);
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
