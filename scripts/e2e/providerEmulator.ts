/**
 * Loopback emulation of the identity provider and a narrow slice of PostgREST, for the E2E server
 * only. It lets the real server exercise its DURABLE (provider-session) code paths — MFA assurance,
 * durable sessions, recent sign-in, MFA recovery with the real provider adapter — with synthetic
 * users. It is never used outside scripts/e2e and accepts only the per-run service key.
 *
 *   GET    /auth/v1/user                              verify a token minted by /e2e/provider-token
 *   GET    /auth/v1/admin/users/:uid/factors          provider factor inventory
 *   DELETE /auth/v1/admin/users/:uid/factors/:id      remove a factor
 *   GET|POST|PATCH|DELETE /rest/v1/<allowed table>    eq / in / is / neq / gt(e) / lt(e) filters,
 *                                                     select, order, limit, insert, upsert, update
 *   POST /e2e/provider-user | /e2e/provider-token | /e2e/provider-factor   test controls
 * Identifiers are validated against an allow-list and regexes; every value is a bound parameter.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';

type Send = (status: number, body: unknown, headers?: Record<string, string>) => void;
type Factor = { id: string; status: 'verified' | 'unverified'; factor_type: 'totp'; friendly_name: string; created_at: string; updated_at: string };
type ProviderUser = { id: string; email: string; factors: Factor[]; name: string };
const users = new Map<string, ProviderUser>();
const tokens = new Map<string, { uid: string; aal: 'aal1' | 'aal2'; primary: number }>();
const TABLES = new Set(['taxguard_identities', 'taxguard_members', 'taxguard_clients', 'taxguard_sessions', 'taxguard_audit_log', 'taxguard_staff_assignments',
  'taxguard_client_id_sequence', 'taxguard_cases', 'taxguard_staff_invitations', 'taxguard_tenants']);
const COLUMN = /^[a-z_][a-z0-9_]{0,62}$/;
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

function newFactor(): Factor {
  const t = new Date().toISOString();
  return { id: randomUUID(), status: 'verified', factor_type: 'totp', friendly_name: 'Synthetic authenticator', created_at: t, updated_at: t };
}
function mint(uid: string, aal: 'aal1' | 'aal2', primaryAgeSeconds: number) {
  const primary = now() - Math.max(0, primaryAgeSeconds);
  const amr = [{ method: 'password', timestamp: primary }, ...(aal === 'aal2' ? [{ method: 'totp', timestamp: now() }] : [])];
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, aal, amr, exp: now() + 3600, iat: now(), role: 'authenticated' })}.${randomBytes(16).toString('base64url')}`;
  tokens.set(token, { uid, aal, primary });
  return token;
}
function where(query: URLSearchParams, params: unknown[]) {
  const clauses: string[] = [];
  for (const [col, raw] of query) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(col)) continue;
    if (!COLUMN.test(col)) throw new Error('column');
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/s.exec(raw);
    if (!m) throw new Error('filter');
    const [, not, op, value] = m;
    let clause: string;
    if (op === 'is') { if (!['null', 'true', 'false'].includes(value)) throw new Error('is'); clause = `"${col}" IS ${value.toUpperCase()}`; }
    else if (op === 'in') {
      const list = value.replace(/^\(|\)$/g, '').split(',').map(v => v.replace(/^"|"$/g, ''));
      params.push(list); clause = `"${col}"::text = ANY($${params.length}::text[])`;
    } else {
      params.push(value);
      const sym = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op as 'eq'];
      clause = `"${col}"::text ${sym} $${params.length}::text`;
      if (op !== 'eq' && op !== 'neq') clause = `"${col}" ${sym} $${params.length}`;
    }
    clauses.push(not ? `NOT (${clause})` : clause);
  }
  return clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
}
function selectList(query: URLSearchParams) {
  const s = query.get('select');
  if (!s || s === '*') return '*';
  const cols = s.split(',').map(c => c.trim());
  if (cols.some(c => !COLUMN.test(c))) throw new Error('select');
  return cols.map(c => `"${c}"`).join(',');
}

export async function handleProviderEmulation(method: string, url: URL, headers: Record<string, string | string[] | undefined>, body: any, pool: pg.Pool, send: Send): Promise<boolean> {
  const path = url.pathname;
  let m: RegExpExecArray | null;
  // ---- test controls -------------------------------------------------------------------------
  if (method === 'POST' && path === '/e2e/provider-user') {
    const u: ProviderUser = { id: body.uid, email: String(body.email).toLowerCase(), name: body.name ?? body.uid, factors: body.withFactor === false ? [] : [newFactor()] };
    users.set(u.id, u); send(200, { uid: u.id, factors: u.factors.length }); return true;
  }
  if (method === 'POST' && path === '/e2e/provider-token') {
    if (!users.has(body.uid)) { send(404, { code: 'E2E_NO_PROVIDER_USER' }); return true; }
    send(200, { accessToken: mint(body.uid, body.aal === 'aal1' ? 'aal1' : 'aal2', Number(body.primaryAgeSeconds ?? 0)) }); return true;
  }
  if (method === 'POST' && path === '/e2e/provider-factor') {
    const u = users.get(body.uid); if (!u) { send(404, { code: 'E2E_NO_PROVIDER_USER' }); return true; }
    const f = newFactor(); u.factors.push(f); send(200, { factors: u.factors.length }); return true;
  }
  // ---- provider auth -------------------------------------------------------------------------
  if (method === 'GET' && path === '/auth/v1/user') {
    const bearer = String(headers.authorization || '').replace(/^Bearer /, '');
    const t = tokens.get(bearer); const u = t && users.get(t.uid);
    if (!t || !u) { send(401, { code: 401, msg: 'invalid JWT', error_code: 'bad_jwt' }); return true; }
    send(200, { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: '2026-01-01T00:00:00Z', last_sign_in_at: new Date(t.primary * 1000).toISOString(),
      app_metadata: { provider: 'email' }, user_metadata: { full_name: u.name }, factors: u.factors, created_at: '2026-01-01T00:00:00Z', updated_at: new Date().toISOString() });
    return true;
  }
  if ((m = /^\/auth\/v1\/admin\/users\/([A-Za-z0-9_-]+)\/factors(?:\/([A-Za-z0-9_-]+))?$/.exec(path))) {
    const u = users.get(m[1]);
    if (!u) { send(404, { code: 404, msg: 'User not found' }); return true; }
    if (method === 'GET' && !m[2]) { send(200, u.factors); return true; }
    if (method === 'DELETE' && m[2]) {
      const before = u.factors.length; u.factors = u.factors.filter(f => f.id !== m![2]);
      if (u.factors.length === before) { send(404, { code: 404, msg: 'Factor not found' }); return true; }
      for (const [k, v] of tokens) if (v.uid === u.id) tokens.delete(k); // provider signs the user out
      send(200, { id: m[2] }); return true;
    }
  }
  // ---- PostgREST table slice -------------------------------------------------------------------
  if ((m = /^\/rest\/v1\/([a-z_]+)$/.exec(path)) && TABLES.has(m[1])) {
    const table = `public."${m[1]}"`; const q = url.searchParams; const params: unknown[] = [];
    const prefer = String(headers.prefer || ''); const wantRows = prefer.includes('return=representation') || method === 'GET';
    const single = String(headers.accept || '').includes('vnd.pgrst.object');
    try {
      let sql: string;
      if (method === 'GET') {
        sql = `SELECT ${selectList(q)} FROM ${table}${where(q, params)}`;
        const order = q.get('order');
        if (order) { const [c, dir] = order.split('.'); if (!COLUMN.test(c)) throw new Error('order'); sql += ` ORDER BY "${c}" ${dir === 'desc' ? 'DESC' : 'ASC'}`; }
        const limit = Number(q.get('limit')); if (Number.isInteger(limit) && limit > 0) sql += ` LIMIT ${Math.min(limit, 1000)}`;
      } else if (method === 'POST') {
        const rows = Array.isArray(body) ? body : [body];
        const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]; if (!cols.length || cols.some(c => !COLUMN.test(c))) throw new Error('insert');
        const values = rows.map(r => '(' + cols.map(c => { params.push(r[c] !== null && typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c] ?? null); return `$${params.length}`; }).join(',') + ')');
        sql = `INSERT INTO ${table}(${cols.map(c => `"${c}"`).join(',')}) VALUES ${values.join(',')}`;
        if (prefer.includes('resolution=merge-duplicates') || prefer.includes('resolution=ignore-duplicates')) {
          const conflict = (q.get('on_conflict') || '').split(',').filter(Boolean); if (!conflict.length || conflict.some(c => !COLUMN.test(c))) throw new Error('on_conflict');
          sql += ` ON CONFLICT (${conflict.map(c => `"${c}"`).join(',')}) ` + (prefer.includes('ignore-duplicates') ? 'DO NOTHING'
            : `DO UPDATE SET ${cols.filter(c => !conflict.includes(c)).map(c => `"${c}" = EXCLUDED."${c}"`).join(',') || `"${conflict[0]}" = EXCLUDED."${conflict[0]}"`}`);
        }
        sql += ' RETURNING *';
      } else if (method === 'PATCH') {
        const cols = Object.keys(body || {}); if (!cols.length || cols.some(c => !COLUMN.test(c))) throw new Error('update');
        const sets = cols.map(c => { params.push(body[c] !== null && typeof body[c] === 'object' ? JSON.stringify(body[c]) : body[c]); return `"${c}" = $${params.length}`; });
        sql = `UPDATE ${table} SET ${sets.join(',')}${where(q, params)} RETURNING *`;
      } else if (method === 'DELETE') {
        sql = `DELETE FROM ${table}${where(q, params)} RETURNING *`;
      } else { send(405, { code: 'PGRST', message: 'method' }); return true; }
      if (method !== 'GET' && !/ WHERE /.test(sql) && method !== 'POST') throw new Error('unfiltered write');
      const rows = JSON.parse(JSON.stringify((await pool.query(sql, params)).rows));
      if (single) { if (rows.length !== 1) { send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${rows.length} rows` }); return true; } send(200, rows[0]); return true; }
      if (!wantRows) { send(201, null); return true; }
      send(200, rows); return true;
    } catch (e: any) {
      send(400, { code: e?.code ?? 'PGRST100', message: e?.message ?? 'bad request', details: e?.detail ?? null, hint: null }); return true;
    }
  }
  return false;
}
