import { readFileSync, readdirSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';

/** Supabase-style rpc() over PGlite: named arguments, Postgres error code and message passed through. */
export function pgliteRpc(pg: () => PGlite, calls?: Array<{ name: string; args: Record<string, unknown> }>) {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      calls?.push({ name, args });
      if (!/^taxguard_[a-z_]+$/.test(name)) throw new Error('unexpected rpc');
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
/** Applies the named proposals (by numeric prefix) in order. */
export async function applyProposals(pg: PGlite, pattern: RegExp) {
  for (const name of readdirSync('docs/proposed-migrations').filter(n => pattern.test(n)).sort())
    await pg.exec(readFileSync('docs/proposed-migrations/' + name, 'utf8'));
}
