/**
 * Selects the ledger persistence for /api/bookkeeping.
 *   memory      — the in-process engine (development and tests only; never in production).
 *   durable     — SqlLedgerStore over the proposal-024 service RPCs.
 *   unavailable — durable storage required but not configured: requests fail closed (503).
 * Production uses the durable store only, and only when TAXGUARD_LEDGER_STORE=durable is set
 * explicitly (after the proposal is applied to that environment). Development may opt in with
 * the same variable; the protected production Supabase project is refused outside production.
 */
import { getSupabaseAdmin, isSupabaseServerConfigured } from '../../supabase';
import { SqlLedgerStore } from './sqlLedgerStore';

export type LedgerSelection = { mode: 'memory' } | { mode: 'durable'; store: SqlLedgerStore } | { mode: 'unavailable' };
let injected: SqlLedgerStore | null = null;
let cached: { key: string; store: SqlLedgerStore } | null = null;

/** Test seam: route requests to an isolated store (for example PGlite). Pass null to clear. */
export function setLedgerStoreForTesting(store: SqlLedgerStore | null) { injected = store; }

export function selectLedger(): LedgerSelection {
  if (injected) return { mode: 'durable', store: injected };
  const production = process.env.NODE_ENV === 'production';
  const requested = process.env.TAXGUARD_LEDGER_STORE === 'durable';
  if (!production && !requested) return { mode: 'memory' };
  if (!requested || !isSupabaseServerConfigured()) return { mode: 'unavailable' };
  const url = process.env.SUPABASE_URL || '';
  if (!production && url.includes('cvrlhixxczerytiocxid')) return { mode: 'unavailable' };
  if (!cached || cached.key !== url) cached = { key: url, store: new SqlLedgerStore(getSupabaseAdmin() as any) };
  return { mode: 'durable', store: cached.store };
}
