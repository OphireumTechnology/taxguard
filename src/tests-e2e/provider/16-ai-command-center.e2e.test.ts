import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, closeBrowser, dumpOnFailure, durableSession, liveSessionWithToken, providerControl, providerToken, realErrors, type Session } from '../helpers';
import { auditAccessibility } from '../a11yAudit';

// Block 108: the AI Command Center on the real server, with this run's PostgreSQL and durable sessions. The knowledge status
// file is outside what this suite controls: with AI_KNOWLEDGE_STATUS_FILE set, figures must equal the file; without it, the
// page must say the status is unavailable and show none. Screenshots are written only when E2E_SCREENSHOT_DIR is set.
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });
const ADMIN = 'd0000000-0000-4000-8000-00000000000c', ACCOUNTANT = 'd0000000-0000-4000-8000-000000000002', REVIEWER = 'd0000000-0000-4000-8000-0000000000fa', OTHER_TENANT_ADMIN = 'd0000000-0000-4000-8000-0000000000f1';
const ROUTE = '/admin/master/ai';
const ENDPOINT = '/api/ai-governance/control-center/command-center';
const STATUS_FILE = process.env.AI_KNOWLEDGE_STATUS_FILE;
const tokens: Record<string, string> = {};
const read = (token: string | null, url = ENDPOINT, method = 'GET') => fetch(ORIGIN + url, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body: '{}' }) })
  .then(async r => ({ status: r.status, text: await r.text() }));
const center = (s: Session) => s.page.getByTestId('ai-command-center');
const nav = (s: Session) => s.page.getByRole('navigation', { name: 'AI Command Center' });
const open = async (view: string, s: Session) => { await nav(s).getByRole('button', { name: view, exact: true }).click(); await s.page.getByRole('heading', { level: 2, name: view }).waitFor(); };
const metric = (s: Session, label: string) => s.page.locator('dt', { hasText: new RegExp('^' + label + '$') }).locator('xpath=following-sibling::dd').innerText();
const plain = (value: string) => value.replace(/,/g, '');
const noPageOverflow = (s: Session) => s.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const shot = async (s: Session, name: string) => {
  const dir = process.env.E2E_SCREENSHOT_DIR;
  if (dir) { fs.mkdirSync(dir, { recursive: true }); await s.page.screenshot({ path: path.join(dir, name + '.png'), fullPage: true }); }
};
const adminOnCenter = async () => { const s = await liveSessionWithToken(tokens[ADMIN], ROUTE); await center(s).waitFor(); return s; };

beforeAll(async () => {
  for (const uid of [ADMIN, ACCOUNTANT, REVIEWER]) {
    expect((await providerControl('/e2e/provider-user', { uid, email: `${uid}@example.test`, name: `Synthetic ${uid}`, password: 'Synthetic-pass-1!' })).status).toBe(200);
    const session = await durableSession(await providerToken(uid));
    expect(session.status).toBe(200);
    tokens[uid] = session.body.token;
  }
});

describe('authorization', () => {
  it('returns the report to an administrator', async () => {
    const response = await read(tokens[ADMIN]);
    expect(response.status).toBe(200);
    const body = JSON.parse(response.text);
    expect(body.sections).toHaveLength(6);
    expect(body.lifecycle).toHaveLength(7);
  });

  it('refuses without a session, and with a forged token', async () => {
    for (const token of [null, 'tg_live_' + 'f'.repeat(64), 'not-a-token']) {
      const response = await read(token);
      expect(response.status, String(token)).toBe(401);
      expect(response.text).not.toMatch(/modules|lifecycle|snapshot/);
    }
  });

  it.each([['an accountant', ACCOUNTANT], ['a reviewer', REVIEWER]])('refuses %s, whatever the browser claims', async (_name, uid) => {
    const response = await read(tokens[uid], ENDPOINT + '?role=admin&tenant_id=tenantE2E');
    expect(response.status, response.text).toBe(403);
    expect(response.text).toContain('AI_CONTROL_CENTER_ROLE_DENIED');
    expect(response.text).not.toMatch(/modules|lifecycle|snapshot/);
  });

  it('refuses an administrator of another tenant', async () => {
    expect((await providerControl('/e2e/provider-user', { uid: OTHER_TENANT_ADMIN, email: `${OTHER_TENANT_ADMIN}@example.test`, name: 'Synthetic other', password: 'Synthetic-pass-1!' })).status).toBe(200);
    const session = await durableSession(await providerToken(OTHER_TENANT_ADMIN));
    if (session.status !== 200) return expect(session.status).toBeGreaterThanOrEqual(400);
    const response = await read(session.body.token);
    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(response.text).not.toMatch(/modules|lifecycle|snapshot/);
  });

  it('does not let a request choose the status file', async () => {
    const plainRead = JSON.parse((await read(tokens[ADMIN])).text);
    const forged = await read(tokens[ADMIN], ENDPOINT + '?file=package.json');
    expect(forged.status).toBe(200);
    expect(JSON.parse(forged.text).knowledge.status).toBe(plainRead.knowledge.status);
    expect(forged.text).not.toContain('"dependencies"');
  });

  it('offers no way to write', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await read(tokens[ADMIN], ENDPOINT, method);
      expect(response.status, method).toBeGreaterThanOrEqual(400);
      expect(response.text).not.toMatch(/modules|lifecycle/);
    }
  });

  it('reveals no address, path, runtime or old product name', async () => {
    expect((await read(tokens[ADMIN])).text).not.toMatch(/11434|127\.0\.0\.1|localhost|ollama|qwen|ophir(?!eum)|"endpoint"|sqlite|[A-Z]:\\\\/i);
  });

  it('shows a refused staff member the reason and no figures', async () => {
    const s = await liveSessionWithToken(tokens[ACCOUNTANT], ROUTE);
    await s.page.getByRole('alert').getByText('Your role is not authorized to view the AI Command Center.').waitFor();
    expect(await center(s).count()).toBe(0);
    await s.context.close();
  });
});

describe('the private reference image', () => {
  const IMAGE = ENDPOINT + '/master-plan-image';
  const fetchImage = (token: string | null) => fetch(ORIGIN + IMAGE, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  it('reaches only a governance role, as a PNG that is not stored', async () => {
    const allowed = await fetchImage(tokens[ADMIN]);
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('content-type')).toContain('image/png');
    expect(allowed.headers.get('cache-control')).toBe('no-store');
    expect(Buffer.from(await allowed.arrayBuffer()).subarray(1, 4).toString()).toBe('PNG');
    expect((await fetchImage(null)).status).toBe(401);
    expect((await fetchImage(tokens[ACCOUNTANT])).status).toBe(403);
    expect((await fetchImage(tokens[REVIEWER])).status).toBe(403);
  });

  it('is not served as a public file', async () => {
    const file = 'taxguard-ai-web-development-master-plan.png';
    const onDisk = path.resolve('design-reference', file).replace(/\\/g, '/');
    for (const url of [`/design-reference/${file}`, `/${file}`, `/assets/${file}`, `/DESIGN-REFERENCE/${file}`, `/%64esign-reference/${file}`, `/design-reference%2F${file}`, `/@fs/${onDisk}`, `/design-reference/dashboard-masterplan.png`]) {
      const response = await fetch(ORIGIN + url);
      expect(response.headers.get('content-type') ?? '', url).not.toContain('image/');
    }
  });

  it('loads on the page only when asked for', async () => {
    const s = await adminOnCenter();
    expect(s.api.filter(r => r.path.endsWith('/master-plan-image'))).toEqual([]);
    await s.page.getByRole('button', { name: 'Show the master plan reference image' }).click();
    const image = s.page.getByRole('img', { name: /Web Development Master Plan/ });
    await image.waitFor();
    expect(await image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await shot(s, 'master-plan-image-desktop');
    await s.page.getByRole('button', { name: 'Hide the master plan reference image' }).click();
    expect(await s.page.getByRole('img', { name: /Web Development Master Plan/ }).count()).toBe(0);
    await s.context.close();
  });

  it('asks search engines not to index the page', async () => {
    const s = await adminOnCenter();
    expect(await s.page.locator('meta[name="robots"]').getAttribute('content')).toBe('noindex, nofollow');
    await s.context.close();
  });
});

describe('the page', () => {
  it('opens from the address with governance figures read from the database', async () => {
    const s = await adminOnCenter();
    await s.page.getByRole('heading', { level: 1, name: 'TaxGuard AI Command Center' }).waitFor();
    const report = JSON.parse((await read(tokens[ADMIN])).text);
    await open('Human Governance', s);
    const recorded = Object.values(report.governance.agents_by_status as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(recorded).toBe(61);
    expect(plain(await metric(s, 'Agents recorded'))).toBe('61');
    expect(await metric(s, 'Global emergency stop')).toBe(report.governance.global_stop ? 'Active' : 'Not active');
    await open('AI Inference', s);
    expect(await metric(s, 'Agents commissioned')).toBe(String(report.governance.agents_by_status.ACTIVE ?? 0));
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('shows knowledge figures only from the status file, and says so when there is none', async () => {
    const s = await adminOnCenter();
    await open('Knowledge Engine', s);
    if (STATUS_FILE) {
      const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      expect(plain(await metric(s, 'Chunks'))).toBe(String(status.chunks.total));
      expect(plain(await metric(s, 'Embeddings'))).toBe(String(status.chunks.embeddings));
      expect(await metric(s, 'Documents in quarantine')).toBe(String(status.quarantine.documents));
      expect(plain(await metric(s, 'Memory chunks pending'))).toBe(String(status.review.production.pending));
      expect(await metric(s, 'Memory chunks approved')).toBe(String(status.review.production.approved));
      expect(plain(await metric(s, 'Queue items awaiting a person'))).toBe(String(status.review.queue_awaiting));
      await shot(s, 'knowledge-desktop');
      await open('Evaluation Center', s);
      await s.page.getByText(status.comparison.outcome === 'RETAIN_BASELINE' ? /the baseline stays/ : /improvement was confirmed/).waitFor();
      await shot(s, 'evaluation-desktop');
    } else {
      await s.page.getByText('The knowledge status is unavailable on this server, so no figures are shown.').waitFor();
      expect(await s.page.locator('dt', { hasText: /^Embeddings$/ }).count()).toBe(0);
    }
    await s.context.close();
  });

  it('expands and collapses modules from the keyboard', async () => {
    const s = await adminOnCenter();
    const button = s.page.getByRole('button', { name: /Source registry/ }).first();
    await button.focus();
    expect(await button.getAttribute('aria-expanded')).toBe('false');
    await s.page.keyboard.press('Enter');
    expect(await button.getAttribute('aria-expanded')).toBe('true');
    await s.page.getByText('test_research_foundation.py').first().waitFor();
    await shot(s, 'module-expanded-desktop');
    await s.page.keyboard.press('Space');
    expect(await button.getAttribute('aria-expanded')).toBe('false');
    await s.context.close();
  });

  it('reaches every view from the keyboard, and collapses the navigation', async () => {
    const s = await adminOnCenter();
    for (const view of ['Knowledge Engine', 'AI Inference', 'Tax Preparation', 'Human Governance', 'Evaluation Center', 'System Operations', 'Development lifecycle', 'Master plan']) {
      const target = nav(s).getByRole('button', { name: view, exact: true });
      await target.focus();
      await s.page.keyboard.press('Enter');
      await s.page.getByRole('heading', { level: 2, name: view }).waitFor();
      expect(await target.getAttribute('aria-current')).toBe('page');
    }
    await s.page.getByRole('button', { name: 'Collapse navigation' }).click();
    expect(await nav(s).getByRole('button', { name: 'Master plan' }).count()).toBe(0);
    await s.page.getByRole('button', { name: 'Expand navigation' }).click();
    await nav(s).getByRole('button', { name: 'Master plan' }).waitFor();
    await s.context.close();
  });

  it('links to existing dashboards, reuses the existing control center, and writes nothing', async () => {
    const s = await adminOnCenter();
    await open('Human Governance', s);
    await s.page.getByRole('button', { name: 'Show governance decisions' }).click();
    await s.page.getByRole('heading', { name: 'AI Control Center' }).waitFor();
    expect(await s.page.getByRole('link', { name: 'Open AI Command Center' }).getAttribute('href')).toBe(ROUTE);
    await open('Tax Preparation', s);
    await s.page.getByRole('button', { name: /Tax forms library/ }).first().click();
    expect(await s.page.getByRole('link', { name: 'Open forms library' }).getAttribute('href')).toBe('/staff/forms');
    expect(s.api.filter(r => r.method !== 'GET' && /ai-governance|knowledge|approve/.test(r.path))).toEqual([]);
    await s.context.close();
  });

  it('says what is blocked, and marks no lifecycle stage complete', async () => {
    const s = await adminOnCenter();
    const text = await center(s).innerText();
    for (const name of ['Signing, filing and acknowledgements', 'The 61 AI agents', 'Production deployment', 'Scheduled learning']) expect(text).toContain(name);
    await open('Development lifecycle', s);
    await shot(s, 'lifecycle-desktop');
    const lifecycle = await center(s).innerText();
    expect(lifecycle).toMatch(/Deploy\s+Blocked/);
    expect(lifecycle).not.toMatch(/\bComplete\b/);
    await s.context.close();
  });

  it('passes the accessibility audit on each view', async () => {
    const s = await adminOnCenter();
    for (const view of ['Master plan', 'Knowledge Engine', 'AI Inference', 'Tax Preparation', 'Human Governance', 'Evaluation Center', 'System Operations', 'Development lifecycle']) {
      await open(view, s);
      expect(await auditAccessibility(s.page, '[data-testid="ai-command-center"]'), view).toEqual([]);
    }
    await s.context.close();
  });

  it.each([['desktop', 1440, 1000], ['tablet', 768, 1024], ['phone', 375, 812]] as const)('fits a %s without sideways scrolling', async (name, width, height) => {
    const s = await adminOnCenter();
    await s.page.setViewportSize({ width, height });
    for (const view of ['Master plan', 'Knowledge Engine', 'Evaluation Center', 'Development lifecycle']) {
      await open(view, s);
      expect(await noPageOverflow(s), `${name} ${view}`).toBe(true);
    }
    await open('Master plan', s);
    await s.page.evaluate(() => window.scrollTo(0, 0));
    await shot(s, `master-plan-${name}`);
    await s.context.close();
  });
});
