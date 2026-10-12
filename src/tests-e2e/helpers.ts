import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

// Browser E2E helpers. Run only through `npm run test:e2e` (scripts/e2e/run-e2e.mjs), which starts
// the real server on 127.0.0.1 with synthetic users. Credentials are read from the runner's
// private temp file and are never printed.
export const ORIGIN = process.env.E2E_ORIGIN || '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(ORIGIN)) throw new Error('E2E tests run only against the loopback server started by npm run test:e2e.');
export const T = 'tenantE2E', C = 'e2eClient', FOREIGN_CLIENT = 'e2eForeignClient', UNASSIGNED_CLIENT = 'e2eUnassigned';
type E2EUser = { id: string; email: string; name: string; role: string; password: string; totp: string };
const credentialsFile = process.env.E2E_CREDENTIALS_FILE!;
const users: E2EUser[] = JSON.parse(fs.readFileSync(credentialsFile, 'utf8')).users;
export const user = (id: string) => { const u = users.find(x => x.id === id); if (!u) throw new Error('unknown synthetic user ' + id); return u; };
export const control = () => JSON.parse(fs.readFileSync(process.env.E2E_CONTROL_FILE!, 'utf8')) as { origin: string; key: string };

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(s: string) { let bits = 0, v = 0; const out: number[] = []; for (const ch of s) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
export function totpAt(secret: string, step: number) {
  const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', base32Decode(secret)).update(b).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
/**
 * A fresh authenticator code. The server refuses a reused time step (replay protection), so
 * steps already used for this user in this run (across test files) are skipped by waiting.
 */
export async function freshCode(id: string) {
  const ledgerFile = credentialsFile + '.steps.json';
  for (;;) {
    let used: Record<string, number> = {};
    try { used = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')); } catch {}
    const step = Math.floor(Date.now() / 30000);
    if ((used[id] ?? -1) < step) { used[id] = step; fs.writeFileSync(ledgerFile, JSON.stringify(used)); return totpAt(user(id).totp, step); }
    await new Promise(r => setTimeout(r, (step + 1) * 30000 - Date.now() + 250));
  }
}
export function markStepUsed(id: string, step: number) {
  const ledgerFile = credentialsFile + '.steps.json';
  let used: Record<string, number> = {}; try { used = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')); } catch {}
  used[id] = Math.max(used[id] ?? -1, step); fs.writeFileSync(ledgerFile, JSON.stringify(used));
}

let browser: Browser | null = null;
export async function launch() {
  browser ??= await chromium.launch({ channel: 'msedge', headless: process.env.E2E_HEADED !== '1' });
  return browser;
}
export async function closeBrowser() { await browser?.close(); browser = null; }

export type Session = { context: BrowserContext; page: Page; errors: string[]; api: Array<{ status: number; method: string; path: string }> };
/** A new isolated browser context (no shared cookies or storage) with page-error and API logging. */
export async function newSession(): Promise<Session> {
  const context = await (await launch()).newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = []; const api: Session['api'] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 500)); });
  page.on('response', r => { const u = r.url(); if (u.startsWith(ORIGIN + '/api/')) api.push({ status: r.status(), method: r.request().method(), path: u.slice(ORIGIN.length) }); });
  page.setDefaultTimeout(20000);
  return track({ context, page, errors, api });
}

/** Signs a staff member in through the real staff portal form: password, then authenticator code. */
export async function staffLogin(id: string, s?: Session) {
  const session = s ?? await newSession();
  const { page } = session; const u = user(id);
  await page.goto(ORIGIN + '/staff/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('practitioner@artaxservices.com').fill(u.email);
  await page.locator('input[type=password]').fill(u.password);
  await page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
  const code = page.locator('input[autocomplete="one-time-code"]');
  await code.waitFor();
  await code.fill(await freshCode(id));
  await page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
  await page.waitForURL(url => url.pathname === '/staff' || url.pathname.startsWith('/staff/') && !url.pathname.startsWith('/staff/login'));
  await page.getByText(u.name).first().waitFor();
  return session;
}

/** Real POST /api/auth/login (password + current TOTP) — used for clients and for API preconditions. */
export async function apiLogin(id: string) {
  const u = user(id);
  const r = await fetch(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password, mfaCode: await freshCode(id) }) });
  const body = await r.json();
  if (!body.token) throw new Error('login failed for ' + id + ': ' + r.status + ' ' + (body.code || ''));
  return body.token as string;
}
let keySeq = 0;
export async function api(token: string, method: string, path: string, body?: unknown, idempotencyKey: string | null = `e2e-${Date.now()}-${++keySeq}`) {
  const r = await fetch(ORIGIN + path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, body: await r.json().catch(() => null) as any };
}
/** Opens the app in a browser context already holding a real session token (client portal). */
export async function sessionWithToken(token: string, path: string) {
  const s = await newSession();
  await s.context.addInitScript(t => { localStorage.setItem('artax_session_token', t); localStorage.setItem('token', t); localStorage.setItem('taxguard_environment', 'local'); }, token);
  await s.page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded' });
  return s;
}
export async function openModule(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).first().click();
}
export const text = (page: Page) => page.locator('body').innerText();
/** Waits until the page shows the text (substring), then returns true. */
export async function sees(page: Page, value: string | RegExp, timeout = 20000) {
  await page.getByText(value).first().waitFor({ timeout });
  return true;
}
/** Page errors other than the disabled development HMR socket. */
/** Uncaught page exceptions and React error-boundary crashes (not HTTP status noise or the disabled HMR socket). */
export const realErrors = (s: Session) => s.errors.filter(e => !e.startsWith('console: ') ? !/WebSocket closed without opened/.test(e)
  : /above error occurred|Uncaught|is not defined|Cannot read properties/.test(e));

/** Selects the first option whose visible text contains the given text. */
export async function selectByText(select: import('playwright-core').Locator, contains: string) {
  const deadline = Date.now() + 15000; let value: string | undefined;
  while ((value = await select.locator('option').evaluateAll((os, t) => (os as HTMLOptionElement[]).find(o => (o.textContent || '').includes(t as string))?.value, contains)) === undefined) {
    if (Date.now() > deadline) throw new Error('no option containing ' + contains);
    await new Promise(r => setTimeout(r, 200));
  }
  await select.selectOption(value);
}
const tracked = new Set<Session>();
export function track<S extends Session>(s: S) { tracked.add(s); return s; }
/** On failure, saves a screenshot, the visible text and recent API calls of every tracked page (kept with E2E_KEEP_LOG). */
export async function dumpOnFailure(name: string) {
  const dir = process.env.E2E_DUMP_DIR; if (!dir) return;
  let i = 0;
  for (const s of tracked) {
    if (s.page.isClosed()) continue;
    const base = `${dir}/${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}-${++i}`;
    await s.page.screenshot({ path: base + '.png', fullPage: false }).catch(() => undefined);
    fs.writeFileSync(base + '.txt', s.page.url() + '\n' + (await s.page.locator('body').innerText().catch(() => '')).slice(0, 6000) + '\n--- API\n' + s.api.slice(-25).map(a => `${a.status} ${a.method} ${a.path}`).join('\n') + '\n--- ERRORS\n' + s.errors.join('\n'));
  }
}

/** The synthetic client's active 2025 engagement staffed with preparer, reviewer and bookkeeper (created once per run). */
export async function ensureStaffed(mgrToken: string) {
  const detail = (await api(mgrToken, 'GET', `/api/practice/clients/${C}`)).body;
  let eng = detail.engagements?.find((e: any) => e.taxYears?.some((y: any) => y.taxYear === 2025));
  if (!eng) {
    const created = await api(mgrToken, 'POST', `/api/practice/clients/${C}/engagements`, { title: 'Synthetic 2025 individual return', type: 'tax_preparation', taxYears: [2025] }, 'e2e-ensure-engagement');
    eng = { engagementId: created.body.engagementId, status: 'draft', version: 1 };
  }
  if (eng.status !== 'active') await api(mgrToken, 'POST', `/api/practice/clients/${C}/engagements/${eng.engagementId}/status`, { status: 'active', version: eng.version ?? 1 });
  const team = (await api(mgrToken, 'GET', `/api/practice/clients/${C}`)).body.team ?? [];
  for (const [role, userId] of [['preparer', 'e2e-acct'], ['reviewer', 'e2e-rev'], ['bookkeeper', 'e2e-bk']])
    if (!team.some((t: any) => t.role === role && t.userId === userId))
      await api(mgrToken, 'POST', `/api/practice/clients/${C}/engagements/${eng.engagementId}/team`, { taxYear: 2025, role, userId, reason: 'Synthetic initial staffing for E2E' }, 'e2e-ensure-' + role);
  return eng.engagementId as string;
}
