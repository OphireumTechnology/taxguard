import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
// @ts-ignore -- plain ESM script without type declarations
import { compareWithManifest, exportDatabase, restoreDatabase, verifyBackupIntegrity } from '../../scripts/backup/logical-backup.mjs';
import { BillingStore, SandboxPaymentProvider } from '../server/taxguard/billing/billingStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import {schemaFingerprint} from '../../scripts/staging/schema-fingerprint';

// Backup / restore / rollback rehearsal on two disposable local PostgreSQL servers (loopback only).
// Source: every migration and proposal, plus synthetic records. Target: a second server whose schema
// is recreated from the same manifest order (environment recreation), then restored and verified.
// Synthetic data only; nothing here can reach a hosted project.
let source: TestDatabase; let target: TestDatabase;
const T = 'tenantDbBackup', C = 'dbBackupClient';
const timings: Record<string, number> = {};
beforeAll(async () => {
  [source, target] = await Promise.all([startDatabase(), startDatabase()]);
  await source.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('${T}','Synthetic backup tenant') ON CONFLICT DO NOTHING;
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','db-bk-client','Synthetic client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','db-bk-mgr','practice_manager','active',NULL),('${T}','db-bk-mgr2','admin','active',NULL),('${T}','db-bk-client','client','active','${C}');`);
  const practice = new PracticeStore(pgRpc(source.pool)), billing = new BillingStore(pgRpc(source.pool), new SandboxPaymentProvider());
  const eng = (await practice.createEngagement(T, C, 'db-bk-mgr', 'db-bk-engagement', { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'db-bk-mgr', eng, 'active', 1);
  await billing.upsertService(T, 'db-bk-mgr', { serviceCode: 'SYN-1', name: 'Synthetic service', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '125.50' });
  const inv = (await billing.createInvoice(T, C, 'db-bk-mgr', 'db-bk-invoice', { dueDate: '2026-12-31' })).invoiceId;
  let r: any = await billing.addLine(T, C, 'db-bk-mgr', inv, { serviceCode: 'SYN-1', quantity: '2' }, 'backup-line-key');
  r = await billing.transition(T, C, 'db-bk-mgr', inv, 'submit', r.rowVersion);
  await billing.transition(T, C, 'db-bk-mgr2', inv, 'approve', r.rowVersion);
  await source.pool.query(`SELECT public.taxguard_security_event_record('${T}','AUTH','AUTH_FAILURE_TELEMETRY','warning',NULL,'${'ab'.repeat(16)}','{}'::jsonb)`);
}, 480000);
afterAll(async () => { await Promise.all([source?.stop(), target?.stop()]); });

describe('backup and restore rehearsal', () => {
  let backup: any;
  it('exports every table with row counts and checksums and detects a tampered backup', async () => {
    const c = await source.connect();
    try { const t0 = Date.now(); backup = await exportDatabase(c); timings.exportMs = Date.now() - t0; } finally { await c.end(); }
    expect(backup.manifest.tables.taxguard_invoices.rows).toBe(1);
    expect(backup.manifest.tables.taxguard_audit_log.rows).toBeGreaterThan(3);
    expect(verifyBackupIntegrity(backup)).toEqual([]);
    const tampered = JSON.parse(JSON.stringify(backup));
    tampered.data.taxguard_invoices[0] = tampered.data.taxguard_invoices[0].replace('"251.00"', '"1.00"').replace('251.00', '1.00');
    tampered.data.taxguard_audit_log.pop();
    expect(verifyBackupIntegrity(tampered).map((p: any) => p.code).sort()).toEqual(['CHECKSUM_MISMATCH', 'CHECKSUM_MISMATCH', 'ROW_COUNT_MISMATCH']);
  });

  it('restores into a schema recreated from the manifest and verifies every table', async () => {
    const c = await target.connect();
    try {
      await expect(restoreDatabase(c, backup)).rejects.toThrow('RESTORE_TARGET_NOT_DECLARED_DISPOSABLE');
      const t0 = Date.now(); await restoreDatabase(c, backup, { disposable: true }); timings.restoreMs = Date.now() - t0;
      expect(await compareWithManifest(c, backup.manifest)).toEqual([]);
      expect((await schemaFingerprint(c)).sha256).toBe((await schemaFingerprint(source.pool)).sha256);
      const high=(await c.query('SELECT max(event_sequence)::text n FROM taxguard_audit_log')).rows[0].n;
      const sequence=(await c.query("SELECT pg_get_serial_sequence('taxguard_audit_log','event_sequence') name")).rows[0].name;
      const next=(await c.query('SELECT nextval($1)::text n',[sequence])).rows[0].n;expect(BigInt(next)).toBeGreaterThan(BigInt(high));
    } finally { await c.end(); }
    // The restored system works: the client still sees only the client projection.
    const [inv] = await new BillingStore(pgRpc(target.pool)).list(T, C, 'db-bk-client');
    expect(inv).toMatchObject({ total: '251.00', status: 'ISSUED' });
    expect(inv).not.toHaveProperty('preparedBy');
    // Append-only protections are active again after the restore.
    await expect(target.pool.query(`DELETE FROM taxguard_service_price_history`)).rejects.toThrow();
    // Measured local timings (synthetic volume) for the runbook's RTO notes; no data is printed.
    console.log('[backup-rehearsal] ' + JSON.stringify({ tables: Object.keys(backup.manifest.tables).length, ...timings }));
  });

  it('refuses a restore that fails integrity or targets a different schema, leaving the target unchanged', async () => {
    const c = await target.connect();
    try {
      const broken = JSON.parse(JSON.stringify(backup)); broken.data.taxguard_clients = [];
      await expect(restoreDatabase(c, broken, { disposable: true })).rejects.toThrow('BACKUP_INTEGRITY_FAILED');
      const foreign = JSON.parse(JSON.stringify(backup)); foreign.manifest.tables.not_a_table = { rows: 0, sha256: 'x' }; foreign.data.not_a_table = [];
      foreign.manifest.tables.not_a_table.sha256 = createHash('sha256').update('').digest('hex');
      foreign.manifest.sha256 = createHash('sha256').update(JSON.stringify(foreign.manifest.tables)).digest('hex');
      await expect(restoreDatabase(c, foreign, { disposable: true })).rejects.toThrow('RESTORE_SCHEMA_MISMATCH');
      expect(await compareWithManifest(c, backup.manifest)).toEqual([]);
    } finally { await c.end(); }
  });

  it('refuses non-loopback connections', async () => {
    await expect(exportDatabase({ connectionParameters: { host: 'db.example.test' } })).rejects.toThrow('BACKUP_REHEARSAL_LOOPBACK_ONLY');
  });
  it('rejects checksum-consistent orphan records before commit and preserves the target',async()=>{
    const c=await target.connect();try{const orphan=structuredClone(backup);const name='taxguard_invoices';const row=JSON.parse(orphan.data[name][0]);row.tenant_id='missing_synthetic_tenant';orphan.data[name][0]=JSON.stringify(row);
      orphan.manifest.tables[name].sha256=createHash('sha256').update([...orphan.data[name]].sort().join('\n')).digest('hex');orphan.manifest.sha256=createHash('sha256').update(JSON.stringify(orphan.manifest.tables)).digest('hex');
      expect(verifyBackupIntegrity(orphan)).toEqual([]);await expect(restoreDatabase(c,orphan,{disposable:true})).rejects.toThrow('RESTORE_FOREIGN_KEY_VIOLATION');expect(await compareWithManifest(c,backup.manifest)).toEqual([]);
    }finally{await c.end();}
  });
});

describe('migration rollback rehearsal (new Phase 10 proposals)', () => {
  const apply = (file: string) => target.pool.query(fs.readFileSync(file, 'utf8'));
  const exists = (sql: string) => target.pool.query(sql).then(r => r.rows[0].ok as boolean);
  it.each([
    ['20261014500000_taxguard_document_scan_requests', `SELECT to_regclass('public.taxguard_doc_scan_requests') IS NOT NULL AS ok`],
    ['20261014480000_taxguard_security_events', `SELECT to_regclass('public.taxguard_security_event_windows') IS NOT NULL AS ok`],
    ['20261014470000_taxguard_billing_client_projection', `SELECT to_regprocedure('public.taxguard_bill_view(text,taxguard_invoices)') IS NOT NULL AS ok`],
  ])('rolls back %s without touching data, then re-applies it', async (name, probe) => {
    const before = await (async () => { const c = await target.connect(); try { return (await exportDatabase(c)).manifest; } finally { await c.end(); } })();
    expect(await exists(probe)).toBe(true);
    await apply(`docs/proposed-migrations/rollback/${name}.rollback.sql`);
    expect(await exists(probe)).toBe(false);
    // Data in every remaining table is unchanged.
    const c = await target.connect();
    try {
      const after = (await exportDatabase(c)).manifest;
      for (const [t, m] of Object.entries(after.tables)) expect(m, t).toEqual(before.tables[t]);
    } finally { await c.end(); }
    await apply(`docs/proposed-migrations/${name}.sql`);
    expect(await exists(probe)).toBe(true);
  }, 120000);
  it('after rollback of 047 the database again returns staff fields to clients (the HTTP allow-list remains the guard)', async () => {
    await apply('docs/proposed-migrations/rollback/20261014470000_taxguard_billing_client_projection.rollback.sql');
    const [inv] = await new BillingStore(pgRpc(target.pool)).list(T, C, 'db-bk-client');
    expect(inv).toHaveProperty('preparedBy');
    await apply('docs/proposed-migrations/20261014470000_taxguard_billing_client_projection.sql');
    const [again] = await new BillingStore(pgRpc(target.pool)).list(T, C, 'db-bk-client');
    expect(again).not.toHaveProperty('preparedBy');
  }, 120000);
});
