import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import { capabilityFixture } from './aiCapabilities.fixture';
let f: Awaited<ReturnType<typeof capabilityFixture>>;
beforeAll(async () => { f = await capabilityFixture(); }, 30000);
afterAll(async () => { await f?.pg.close(); });
it('has unique ordered CLI-style migration identities and keeps proposals outside the chain', () => {
  const names = fs.readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort();
  expect(names.length).toBeGreaterThan(7);
  expect(names.every(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))).toBe(true);
  expect(new Set(names.map(name => name.slice(0, 14))).size).toBe(names.length);
  expect(names.some(name => name.includes('append_only'))).toBe(false);
});
it('preserves all 61 deployment registrations as DRAFT after the complete sequence', async () => {
  const rows = (await f.pg.query<{ status: string; count: number }>('SELECT status,count(*)::int AS count FROM ai_agents GROUP BY status')).rows;
  expect(rows).toEqual([{ status: 'DRAFT', count: 61 }]);
});
it.each(['taxguard_cases', 'taxguard_documents', 'taxguard_clients', 'taxguard_audit_log'])('enables RLS for %s in the disposable schema', async table => {
  const rows = (await f.pg.query<{ relrowsecurity: boolean }>('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass', [table])).rows;
  expect(rows).toEqual([{ relrowsecurity: true }]);
});
it('retains default-denied direct authenticated access to the immutable AI history', async () => {
  await f.pg.exec('SET ROLE authenticated');
  try { await expect(f.pg.query('SELECT * FROM ai_execution_history')).rejects.toThrow('permission denied'); }
  finally { await f.pg.exec('RESET ROLE'); }
});
it('confirms the core audit guard remains proposed and transaction rollback leaves schema unchanged', async () => {
  const query = "SELECT tgname FROM pg_trigger WHERE tgrelid='taxguard_audit_log'::regclass AND tgname='taxguard_audit_append_only'";
  expect((await f.pg.query(query)).rows).toEqual([]);
  await expect(f.pg.transaction(async tx => {
    await tx.exec(fs.readFileSync('docs/sql/taxguard-audit-append-only.proposal.sql', 'utf8'));
    expect((await tx.query(query)).rows).toHaveLength(1);
    throw new Error('SYNTHETIC_PROPOSAL_ROLLBACK');
  })).rejects.toThrow('SYNTHETIC_PROPOSAL_ROLLBACK');
  expect((await f.pg.query(query)).rows).toEqual([]);
});
