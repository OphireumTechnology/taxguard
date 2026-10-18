import { readFileSync } from 'node:fs';
import {buildMigrationManifest} from '../../../scripts/staging/migration-manifest.mjs';
import type { PGlite } from '@electric-sql/pglite';

/** Supabase-style rpc() over PGlite: named arguments, Postgres error code and message passed through. */
export function pgliteRpc(pg: () => PGlite, calls?: Array<{ name: string; args: Record<string, unknown> }>) {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      calls?.push({ name, args });
      if (!/^taxguard_[a-z0-9_]+$/.test(name)) throw new Error('unexpected rpc');
      const keys = Object.keys(args);
      // Arrays of plain values map to Postgres arrays (as PostgREST does for array parameters);
      // objects and arrays of objects are JSON for jsonb parameters.
      const values = keys.map(k => { const v = args[k];
        if (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object')) return v;
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v; });
      try {
        const result = await pg().query<{ r: unknown }>(`SELECT public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) AS r`, values);
        return { data: JSON.parse(JSON.stringify(result.rows[0].r)), error: null };
      } catch (error: any) { return { data: null, error: { code: error.code, message: error.message, details: error.detail ?? null } }; }
    },
  };
}
/** Applies explicitly selected proposal files in the reviewed dependency order. */
export async function applyProposals(pg: PGlite, pattern: RegExp) {
  const plan=buildMigrationManifest().entries;const selected=new Set(plan.filter(e=>e.kind==='proposal'&&pattern.test(e.file.split('/').at(-1)!)).map(e=>e.file));
  // Narrow historical fixtures exercise the current additive security overlays, never edited history.
  if([...selected].some(file=>/20261012240000_/.test(file))){
    selected.add('docs/proposed-migrations/20261018000000_taxguard_financial_reporting.sql');
    selected.add('docs/proposed-migrations/20261018010000_taxguard_report_cent_transport.sql');
    selected.add('docs/proposed-migrations/20261019040000_taxguard_ledger_write_retries.sql');
  }
  if([...selected].some(file=>/20261012270000_|20261014460000_/.test(file)))selected.add('docs/proposed-migrations/20261015060000_taxguard_audit_custody_overlay.sql');
  if([...selected].some(file=>/20261012270000_/.test(file)))selected.add('docs/proposed-migrations/20261015030851_taxguard_document_client_confidentiality.sql');
  if([...selected].some(file=>/20261012280000_/.test(file))){selected.add('docs/proposed-migrations/20261014470000_taxguard_billing_client_projection.sql');selected.add('docs/proposed-migrations/20261015070000_taxguard_billing_access_overlay.sql');}
  if([...selected].some(file=>/20261012280000_/.test(file)))selected.add('docs/proposed-migrations/20261019000000_taxguard_invoice_idempotency.sql');
  if([...selected].some(file=>/20261012290000_/.test(file)))selected.add('docs/proposed-migrations/20261019010000_taxguard_adjustment_idempotency.sql');
  if([...selected].some(file=>/20261012280000_/.test(file)))selected.add('docs/proposed-migrations/20261019020000_taxguard_refund_idempotency.sql');
  if([...selected].some(file=>/20261012280000_/.test(file)))selected.add('docs/proposed-migrations/20261019030000_taxguard_billing_write_retries.sql');
  for (const entry of plan.filter(e=>selected.has(e.file)))
    await pg.exec(readFileSync(entry.file, 'utf8'));
}
