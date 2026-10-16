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
 *   POST /e2e/provider-sign-in-age   backdates the user's next browser password sign-ins (recent-sign-in tests)
 * Browser-facing provider API (provider-mode E2E profile; anon key accepted):
 *   POST /auth/v1/token?grant_type=password|refresh_token, POST /auth/v1/logout,
 *   POST /auth/v1/factors (TOTP enrolment), POST /auth/v1/factors/:id/challenge | /verify,
 *   DELETE /auth/v1/factors/:id (unenrol; a VERIFIED factor needs an AAL2 token)
 * TOTP codes are checked with RFC 6238 (30 s step, one step drift, no step replay). Factor secrets
 * stay inside the emulator and are never part of an API response except the enrolment response.
 * Identifiers are validated against an allow-list and regexes; every value is a bound parameter.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';

type Send = (status: number, body: unknown, headers?: Record<string, string>) => void;
type Factor = { id: string; status: 'verified' | 'unverified'; factor_type: 'totp'; friendly_name: string; created_at: string; updated_at: string; secret?: string; lastStep?: number };
type ProviderUser = { id: string; email: string; factors: Factor[]; name: string; password?: string; signInAgeSeconds?: number };
const users = new Map<string, ProviderUser>();
const tokens = new Map<string, { uid: string; aal: 'aal1' | 'aal2'; primary: number }>();
const refreshTokens = new Map<string, { uid: string; aal: 'aal1' | 'aal2'; primary: number }>();
const challenges = new Map<string, { factorId: string; expires: number }>();
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32 = (buf: Buffer) => { let bits = 0, v = 0, out = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(v << (5 - bits)) & 31]; return out; };
const unbase32 = (s: string) => { let bits = 0, v = 0; const out: number[] = []; for (const ch of s) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret: string, step: number) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(step)); const h = createHmac('sha1', unbase32(secret)).update(b).digest(); const o = h[h.length - 1] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0'); };
/** Public factor shape: never the secret or replay state. */
const publicFactor = (f: Factor) => ({ id: f.id, status: f.status, factor_type: f.factor_type, friendly_name: f.friendly_name, created_at: f.created_at, updated_at: f.updated_at });
const userJson = (u: ProviderUser, primary: number) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: '2026-01-01T00:00:00Z',
  confirmed_at: '2026-01-01T00:00:00Z', last_sign_in_at: new Date(primary * 1000).toISOString(), app_metadata: { provider: 'email' }, user_metadata: { full_name: u.name },
  factors: u.factors.map(publicFactor), identities: [], created_at: '2026-01-01T00:00:00Z', updated_at: new Date().toISOString() });
function session(u: ProviderUser, aal: 'aal1' | 'aal2', primary: number) {
  const access = mintAt(u.id, aal, primary, u.email); const refresh = randomBytes(24).toString('base64url');
  refreshTokens.set(refresh, { uid: u.id, aal, primary });
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now() + 3600, refresh_token: refresh, user: userJson(u, primary) };
}
const bearerUser = (headers: Record<string, string | string[] | undefined>) => {
  const t = tokens.get(String(headers.authorization || '').replace(/^Bearer /, '')); const u = t && users.get(t.uid);
  return t && u ? { t, u } : null;
};
const TABLES = new Set(['taxguard_identities', 'taxguard_members', 'taxguard_clients', 'taxguard_sessions', 'taxguard_audit_log', 'taxguard_staff_assignments',
  'taxguard_client_id_sequence', 'taxguard_cases', 'taxguard_staff_invitations', 'taxguard_tenants']);
const COLUMN = /^[a-z_][a-z0-9_]{0,62}$/;
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

function newFactor(status: 'verified' | 'unverified' = 'verified'): Factor {
  const t = new Date().toISOString();
  return { id: randomUUID(), status, factor_type: 'totp', friendly_name: 'Synthetic authenticator', created_at: t, updated_at: t, secret: base32(randomBytes(20)) };
}
function mintAt(uid: string, aal: 'aal1' | 'aal2', primary: number, email?: string) {
  const amr = [{ method: 'password', timestamp: primary }, ...(aal === 'aal2' ? [{ method: 'totp', timestamp: now() }] : [])];
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, aal, amr, exp: now() + 3600, iat: now(), role: 'authenticated', email, session_id: randomUUID() })}.${randomBytes(16).toString('base64url')}`;
  tokens.set(token, { uid, aal, primary });
  return token;
}
function mint(uid: string, aal: 'aal1' | 'aal2', primaryAgeSeconds: number) { return mintAt(uid, aal, now() - Math.max(0, primaryAgeSeconds)); }
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
    const u: ProviderUser = { id: body.uid, email: String(body.email).toLowerCase(), name: body.name ?? body.uid, factors: body.withFactor === false ? [] : [newFactor()],
      password: typeof body.password === 'string' ? body.password : undefined };
    users.set(u.id, u);
    // The factor secret is returned to the (loopback, keyed) test only, so it can compute codes.
    send(200, { uid: u.id, factors: u.factors.length, factorSecret: u.factors[0]?.secret ?? null }); return true;
  }
  if (method === 'POST' && path === '/e2e/provider-token') {
    if (!users.has(body.uid)) { send(404, { code: 'E2E_NO_PROVIDER_USER' }); return true; }
    send(200, { accessToken: mint(body.uid, body.aal === 'aal1' ? 'aal1' : 'aal2', Number(body.primaryAgeSeconds ?? 0)) }); return true;
  }
  if (method === 'POST' && path === '/e2e/provider-factor') {
    const u = users.get(body.uid); if (!u) { send(404, { code: 'E2E_NO_PROVIDER_USER' }); return true; }
    const f = newFactor(); u.factors.push(f); send(200, { factors: u.factors.length, factorSecret: f.secret }); return true;
  }
  if (method === 'POST' && path === '/e2e/provider-sign-in-age') {
    const u = users.get(body.uid); if (!u) { send(404, { code: 'E2E_NO_PROVIDER_USER' }); return true; }
    u.signInAgeSeconds = Math.max(0, Number(body.seconds) || 0); send(200, { uid: u.id, signInAgeSeconds: u.signInAgeSeconds }); return true;
  }
  // ---- browser-facing provider API -------------------------------------------------------------
  if (method === 'POST' && path === '/auth/v1/token') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const u = [...users.values()].find(x => x.email === String(body.email || '').trim().toLowerCase());
      if (!u || !u.password || u.password !== body.password) { send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }); return true; }
      send(200, session(u, 'aal1', now() - (u.signInAgeSeconds ?? 0))); return true;
    }
    if (grant === 'refresh_token') {
      const r = refreshTokens.get(String(body.refresh_token || '')); const u = r && users.get(r.uid);
      if (!r || !u) { send(400, { error: 'invalid_grant', code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }); return true; }
      refreshTokens.delete(String(body.refresh_token)); send(200, session(u, r.aal, r.primary)); return true;
    }
    send(400, { code: 400, error_code: 'unsupported_grant_type', msg: 'unsupported grant' }); return true;
  }
  if (method === 'POST' && path === '/auth/v1/logout') {
    const b = bearerUser(headers); if (b) for (const [k, v] of tokens) if (v.uid === b.u.id) tokens.delete(k);
    send(204, null); return true;
  }
  if (method === 'POST' && path === '/auth/v1/factors') {
    const b = bearerUser(headers); if (!b) { send(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }); return true; }
    if (body.factor_type !== 'totp') { send(422, { code: 422, error_code: 'validation_failed', msg: 'totp only' }); return true; }
    const f = newFactor('unverified'); f.friendly_name = String(body.friendly_name || 'Authenticator'); b.u.factors.push(f);
    send(200, { id: f.id, type: 'totp', friendly_name: f.friendly_name, totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', secret: f.secret,
      uri: `otpauth://totp/TaxGuard:${encodeURIComponent(b.u.email)}?secret=${f.secret}&issuer=TaxGuard` } }); return true;
  }
  if (method === 'DELETE' && (m = /^\/auth\/v1\/factors\/([0-9a-f-]{36})$/.exec(path))) {
    const b = bearerUser(headers); if (!b) { send(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }); return true; }
    const factor = b.u.factors.find(x => x.id === m![1]); if (!factor) { send(404, { code: 404, error_code: 'mfa_factor_not_found', msg: 'Factor not found' }); return true; }
    // As the provider requires: removing a VERIFIED factor needs an AAL2 token.
    if (factor.status === 'verified' && b.t.aal !== 'aal2') { send(403, { code: 403, error_code: 'insufficient_aal', msg: 'AAL2 required to unenroll a verified factor' }); return true; }
    b.u.factors = b.u.factors.filter(f => f.id !== factor.id);
    send(200, { id: factor.id }); return true;
  }
  if (method === 'POST' && (m = /^\/auth\/v1\/factors\/([0-9a-f-]{36})\/(challenge|verify)$/.exec(path))) {
    const b = bearerUser(headers); if (!b) { send(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }); return true; }
    const factor = b.u.factors.find(x => x.id === m![1]); if (!factor) { send(404, { code: 404, error_code: 'mfa_factor_not_found', msg: 'Factor not found' }); return true; }
    if (m[2] === 'challenge') { const id = randomUUID(); challenges.set(id, { factorId: factor.id, expires: now() + 300 }); send(200, { id, type: 'totp', expires_at: now() + 300 }); return true; }
    const c = challenges.get(String(body.challenge_id || '')); challenges.delete(String(body.challenge_id || ''));
    if (!c || c.factorId !== factor.id || c.expires < now()) { send(422, { code: 422, error_code: 'mfa_challenge_expired', msg: 'Challenge expired' }); return true; }
    const step = Math.floor(Date.now() / 30000);
    const matched = [step - 1, step, step + 1].find(s2 => totp(factor.secret!, s2) === String(body.code || ''));
    if (matched === undefined || (factor.lastStep !== undefined && matched <= factor.lastStep)) { send(422, { code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }); return true; }
    factor.lastStep = matched; factor.status = 'verified'; factor.updated_at = new Date().toISOString();
    send(200, session(b.u, 'aal2', b.t.primary)); return true;
  }
  // ---- provider auth -------------------------------------------------------------------------
  if (method === 'GET' && path === '/auth/v1/user') {
    const bearer = String(headers.authorization || '').replace(/^Bearer /, '');
    const t = tokens.get(bearer); const u = t && users.get(t.uid);
    if (!t || !u) { send(401, { code: 401, msg: 'invalid JWT', error_code: 'bad_jwt' }); return true; }
    send(200, userJson(u, t.primary));
    return true;
  }
  if ((m = /^\/auth\/v1\/admin\/users\/([A-Za-z0-9_-]+)\/factors(?:\/([A-Za-z0-9_-]+))?$/.exec(path))) {
    const u = users.get(m[1]);
    if (!u) { send(404, { code: 404, msg: 'User not found' }); return true; }
    if (method === 'GET' && !m[2]) { send(200, u.factors.map(publicFactor)); return true; }
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
