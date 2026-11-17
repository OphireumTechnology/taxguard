import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, control, dumpOnFailure, ensureStaffed, newSession, ORIGIN,
  realErrors, sees, sessionWithToken, type Session } from './helpers';

let manager = '', client = '', administrator = '', bookkeeper = '', engagementId = '';
const title = 'Synthetic Phase 12C notice ' + Date.now();
beforeAll(async () => {
  manager = await apiLogin('e2e-mgr'); client = await apiLogin('e2e-client');
  administrator = await apiLogin('e2e-admin'); bookkeeper = await apiLogin('e2e-bk');
  engagementId = await ensureStaffed(manager);
  expect((await api(manager, 'POST', `/api/vault/clients/${C}/requests`, {
    engagementId, taxYear: 2025, title, category: 'income', required: true,
  })).status).toBeLessThan(300);
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(closeBrowser);
const nav = (s: Session, name: string) => s.page.getByRole('navigation', { name: 'Client portal', exact: true }).getByRole('button', { name, exact: true });
const notice = (s: Session) => s.page.getByRole('listitem').filter({ hasText: title });

describe('Phase 12C notification and history acceptance', () => {
  it('keeps a failed read receipt unread, then persists a confirmed receipt and opens document requests', async () => {
    const s = await sessionWithToken(client, '/portal/dashboard#nav=notifications');
    await sees(s.page, title);
    const receipt = '**/api/vault/clients/*/notifications/*/read';
    await s.page.route(receipt, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"UNAVAILABLE"}' }));
    await notice(s).getByRole('button', { name: /Mark .* as read/ }).click();
    await sees(s.page, 'The server did not confirm this change. It is still shown as unread. Try again.');
    expect(await notice(s).getByRole('button', { name: /Mark .* as read/ }).count()).toBe(1);
    await s.page.unroute(receipt);
    await notice(s).getByRole('button', { name: /Mark .* as read/ }).click();
    await notice(s).getByRole('button', { name: /Mark .* as read/ }).waitFor({ state: 'detached' });
    await s.page.reload(); await sees(s.page, title);
    expect(await notice(s).getByRole('button', { name: /Mark .* as read/ }).count()).toBe(0);
    await s.page.getByLabel('Unread only', { exact: true }).check();
    expect(await notice(s).count()).toBe(0);
    await s.page.getByLabel('Unread only', { exact: true }).uncheck();
    await notice(s).getByRole('button', { name: /Open document requests/ }).click();
    await sees(s.page, 'Requested documents');
    expect(new URL(s.page.url()).hash).toBe('#nav=documents');
    expect(realErrors(s)).toEqual([]); await s.context.close();
  });

  it('restores client views with Back, Forward and reload without duplicate entries', async () => {
    const s = await sessionWithToken(client, '/portal/dashboard');
    await nav(s, 'Documents').click(); await sees(s.page, 'Secure document upload');
    const entries = await s.page.evaluate(() => history.length);
    await nav(s, 'Documents').click(); expect(await s.page.evaluate(() => history.length)).toBe(entries);
    await nav(s, 'Notifications').click(); await sees(s.page, title);
    await s.page.goBack(); await sees(s.page, 'Secure document upload');
    expect(new URL(s.page.url()).hash).toBe('#nav=documents');
    await s.page.goBack(); expect(new URL(s.page.url()).hash).toBe('');
    await s.page.goForward(); await sees(s.page, 'Secure document upload');
    await s.page.goForward(); await sees(s.page, title);
    await s.page.reload(); await sees(s.page, title);
    expect(new URL(s.page.url()).hash).toBe('#nav=notifications');
    expect(realErrors(s)).toEqual([]); await s.context.close();
  });

  it('discards an old load after navigating away and back', async () => {
    const s = await sessionWithToken(client, '/portal/dashboard#nav=notifications');
    await sees(s.page, title);
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const waiting = new Promise<void>(resolve => { started = resolve; });
    let count = 0;
    const routePattern = '**/api/vault/clients/*/notifications';
    await s.page.route(routePattern, async route => {
      if (++count === 1) {
        started(); await gate;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread: 1, items: [{
          notificationId: 'stale-notice', title: 'STALE SESSION NOTICE', kind: 'REQUEST_CREATED', requestId: null,
          createdAt: '2026-10-15T00:00:00Z', readAt: null,
        }] }) });
      } else await route.continue();
    });
    await s.page.getByRole('button', { name: 'Refresh', exact: true }).click(); await waiting;
    await nav(s, 'Documents').click(); await sees(s.page, 'Secure document upload');
    await nav(s, 'Notifications').click(); await sees(s.page, title);
    release(); await s.page.waitForTimeout(250);
    expect(await s.page.getByText('STALE SESSION NOTICE').count()).toBe(0);
    expect(realErrors(s)).toEqual([]); await s.context.close();
  });

  it('clears visible notices when the current token changes without a reload', async () => {
    const s = await sessionWithToken(client, '/portal/dashboard#nav=notifications');
    await sees(s.page, title);
    await s.page.evaluate('(async () => { const api = await import("/src/services/api.ts"); api.clearStoredToken(); })()');
    await s.page.getByText(title).first().waitFor({ state: 'detached' });
    expect(await s.page.locator('body').innerText()).not.toContain(title);
    expect(realErrors(s)).toEqual([]); await s.context.close();
  });

  it('reports malformed notification data as an error and recovers through Retry', async () => {
    const s = await newSession();
    const pattern = '**/api/vault/clients/*/notifications';
    await s.page.route(pattern, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"unread":-1,"items":[]}' }));
    await s.context.addInitScript(t => { localStorage.setItem('artax_session_token', t); localStorage.setItem('taxguard_environment', 'local'); }, client);
    await s.page.goto(ORIGIN + '/portal/dashboard#nav=notifications');
    await sees(s.page, 'Notifications could not be loaded.');
    await s.page.unroute(pattern); await s.page.getByRole('button', { name: 'Retry', exact: true }).click();
    await sees(s.page, title); expect(realErrors(s)).toEqual([]); await s.context.close();
  });
  it('honors logout from another tab despite an old sessionStorage fallback', async () => {
    const s = await sessionWithToken(client, '/portal/dashboard#nav=notifications');
    await sees(s.page, title);
    await s.page.evaluate(token => { sessionStorage.setItem('artax_session_token', token); sessionStorage.setItem('token', token); }, client);
    const other = await s.context.newPage(); await other.goto(ORIGIN + '/');
    await other.evaluate(() => { localStorage.removeItem('artax_session_token'); localStorage.removeItem('token'); });
    await s.page.getByText(title).first().waitFor({ state: 'detached' });
    expect(await s.page.evaluate(() => sessionStorage.getItem('artax_session_token'))).toBeNull();
    expect(await s.page.locator('body').innerText()).not.toContain(title);
    expect(realErrors(s)).toEqual([]); await s.context.close();
  });
});

describe('document replacement and metadata privacy presentation', () => {
  it('locks the original scope, cancels safely, uploads version two and keeps it quarantined', async () => {
    const fileName = 'phase12c-original.pdf';
    const q = new URLSearchParams({ engagementId, taxYear: '2025', category: 'income', fileName });
    const upload = await fetch(ORIGIN + `/api/vault/clients/${C}/documents?` + q, {
      method: 'POST', headers: { authorization: 'Bearer ' + client, 'content-type': 'application/pdf', 'idempotency-key': 'phase12c-original-' + Date.now() },
      body: '%PDF-1.4\nSynthetic Phase 12C original\n%%EOF',
    });
    expect(upload.status).toBeLessThan(300); const original = await upload.json() as any;
    const c = control();
    expect((await fetch(c.origin + '/e2e/scan', { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'tenantE2E', client: C, documentId: original.documentId, version: 1, result: 'CLEAN' }) })).status).toBe(200);
    const documents = (await api(manager, 'GET', `/api/vault/clients/${C}/documents`)).body.items;
    const current = documents.find((d: any) => d.documentId === original.documentId);
    expect((await api(manager, 'POST', `/api/vault/clients/${C}/documents/${original.documentId}/versions/1/review`, {
      decision: 'request_replacement', rowVersion: current.rowVersion, note: 'C9 SYNTHETIC INTERNAL REVIEW NOTE',
    })).status).toBeLessThan(300);
    const s = await sessionWithToken(client, '/portal/dashboard#nav=documents');
    const vault = s.page.getByRole('region', { name: 'Secure document upload', exact: true });
    await vault.getByRole('button', { name: 'Upload a replacement for ' + fileName }).click();
    expect(await vault.getByLabel('Engagement and tax year').isDisabled()).toBe(true);
    expect(await vault.getByLabel('Category', { exact: true }).isDisabled()).toBe(true);
    expect(await vault.locator('input[type=file]').evaluate(input => input === document.activeElement)).toBe(true);
    await vault.getByRole('button', { name: 'Cancel replacement' }).click();
    expect(await vault.getByLabel('Category', { exact: true }).isDisabled()).toBe(false);
    await vault.getByRole('button', { name: 'Upload a replacement for ' + fileName }).click();
    await vault.locator('input[type=file]').setInputFiles({ name: 'phase12c-replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSynthetic replacement\n%%EOF') });
    await vault.getByRole('button', { name: 'Upload securely' }).click();
    await sees(s.page, 'phase12c-replacement.pdf uploaded as a replacement: Awaiting security scan.');
    const rows = (await api(client, 'GET', `/api/vault/clients/${C}/documents`)).body.items;
    const replacement = rows.find((d: any) => d.documentId === original.documentId && d.version === 2);
    expect(replacement).toMatchObject({ engagementId, taxYear: 2025, category: 'income', status: 'SCAN_PENDING' });
    expect(await vault.getByRole('button', { name: 'Download phase12c-replacement.pdf' }).count()).toBe(0);
    expect(await vault.getByRole('button', { name: 'Upload a replacement for ' + fileName }).count()).toBe(0);
    expect(await s.page.locator('body').innerText()).not.toContain('C9 SYNTHETIC INTERNAL REVIEW NOTE');
    expect(realErrors(s)).toEqual([]); await s.context.close();
  });
});

describe('staff navigation and automated accessibility audit', () => {
  it('restores administrator tabs and bookkeeper modules through history and reload', async () => {
    const admin = await sessionWithToken(administrator, '/staff');
    await admin.page.getByRole('button', { name: /AI Control Center/ }).first().click();
    await sees(admin.page, 'AI Control Center');
    expect(new URL(admin.page.url()).hash).toBe('#view=ai-control');
    await admin.page.getByRole('button', { name: 'Provider Readiness', exact: true }).first().click();
    await sees(admin.page, 'Reported Provider Configuration');
    await admin.page.goBack(); await admin.page.getByRole('tab', { name: 'Execution history' }).waitFor();
    await admin.page.reload(); await admin.page.getByRole('tab', { name: 'Execution history' }).waitFor();
    expect(realErrors(admin)).toEqual([]); await admin.context.close();

    const book = await sessionWithToken(bookkeeper, '/staff');
    const navigation = book.page.getByRole('navigation', { name: 'Bookkeeper navigation', exact: true });
    await navigation.getByRole('button', { name: 'Reports', exact: true }).click();
    expect(new URL(book.page.url()).hash).toBe('#view=reports');
    await navigation.getByRole('button', { name: 'Transactions', exact: true }).click();
    await book.page.goBack();
    await navigation.getByRole('button', { name: 'Reports', exact: true }).waitFor();
    expect(await navigation.getByRole('button', { name: 'Reports', exact: true }).getAttribute('aria-current')).toBe('page');
    await book.page.reload();
    expect(await navigation.getByRole('button', { name: 'Reports', exact: true }).getAttribute('aria-current')).toBe('page');
    expect(realErrors(book)).toEqual([]); await book.context.close();
  });
  it('restores practice-manager views with Back, Forward and reload; ignores unknown views', async () => {
    const s = await sessionWithToken(manager, '/staff');
    await s.page.getByRole('button', { name: 'Document Review', exact: true }).first().click();
    await sees(s.page, 'Document Review');
    await s.page.getByRole('button', { name: 'Document Requests', exact: true }).first().click();
    await sees(s.page, 'Missing documents');
    await s.page.goBack(); await sees(s.page, 'Document Review');
    await s.page.goForward(); await sees(s.page, 'Missing documents');
    await s.page.reload(); await sees(s.page, 'Missing documents');
    await s.page.goto(ORIGIN + '/staff#view=unknown-role-grant');
    await sees(s.page, 'Practice Manager Dashboard');
    expect(await s.page.getByText('Missing documents', { exact: true }).count()).toBe(0);
    expect(realErrors(s)).toEqual([]); await s.context.close();
  });

  it('audits named client controls and keyboard focus in mobile navigation across three widths', async () => {
    const s = await sessionWithToken(client, '/portal/dashboard#nav=notifications');
    await sees(s.page, title);
    for (const width of [375, 768, 1440]) {
      await s.page.setViewportSize({ width, height: 900 });
      expect(await s.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), String(width)).toBe(true);
    }
    const unnamed = await s.page.evaluate(() => Array.from(document.querySelectorAll('button,input,select,textarea')).filter(element => {
      const node = element as HTMLElement;
      if (!node.getClientRects().length || node.closest('[inert]') || node.closest('dialog:not([open])')) return false;
      if (node.getAttribute('aria-label')?.trim() || node.getAttribute('aria-labelledby') || node.textContent?.trim()) return false;
      const form = node as HTMLInputElement;
      return !form.labels?.length;
    }).map(node => node.tagName + ':' + (node as HTMLInputElement).type));
    expect(unnamed).toEqual([]);
    const contrast = await notice(s).evaluate(card => {
      // Tailwind can return OKLCH as the computed color. Let the browser convert to sRGB.
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      const rgb = (value: string) => {
        context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
      };
      const luminance = (color: number[]) => color.map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
        .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
      const background = luminance(rgb(getComputedStyle(card).backgroundColor));
      return Array.from(card.querySelectorAll('p')).map(node => {
        const foreground = luminance(rgb(getComputedStyle(node).color));
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
    });
    expect(contrast.length).toBeGreaterThan(0);
    for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Keyboard skip navigation focuses the workspace without replacing the current view.
    const skip = s.page.getByRole('link', { name: 'Skip to workspace' });
    await skip.focus(); await skip.press('Enter');
    expect(await s.page.locator('.tg-shell-content').evaluate(node => node === document.activeElement)).toBe(true);
    await sees(s.page, title);
    await s.page.setViewportSize({ width: 375, height: 900 });
    await s.page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    const drawer = s.page.getByRole('dialog', { name: 'Workspace navigation' });
    await drawer.waitFor();
    const close = drawer.getByRole('button', { name: 'Close navigation' });
    expect(await close.evaluate(node => node === document.activeElement)).toBe(true);
    await close.press('Shift+Tab');
    expect(await drawer.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await s.page.keyboard.press('Escape'); await drawer.waitFor({ state: 'detached' });
    expect(await s.page.getByRole('button', { name: 'Open navigation', exact: true }).evaluate(node => node === document.activeElement)).toBe(true);
    expect(realErrors(s)).toEqual([]); await s.context.close();
  });
});
