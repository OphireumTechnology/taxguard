import { test, expect } from '@playwright/test';
// Shared shell only. These tests cannot certify real authentication, RLS or the 29 product journeys.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const request = route.request(); const url = new URL(request.url());
    const allowed = url.origin === 'http://127.0.0.1:4179' && request.method() === 'GET'
      && (url.pathname === '/' || url.pathname === '/index.html' || /^\/assets\/[^/]+\.(?:js|css)$/.test(url.pathname));
    return allowed ? route.continue() : route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
});
for (const role of ['client', 'accountant', 'reviewer', 'bookkeeper', 'practice_manager', 'operations', 'admin']) {
  test(`matching synthetic ${role} role displays its shell`, async ({ page }) => {
    const roleControl = page.getByLabel('Fixture role', { exact: true });
    const workspaceControl = page.getByLabel('Requested workspace', { exact: true });
    await expect(roleControl).toHaveCount(1);
    await expect(workspaceControl).toHaveCount(1);
    await roleControl.selectOption(role);
    await workspaceControl.selectOption(role);
    await expect(roleControl).toHaveValue(role);
    await expect(workspaceControl).toHaveValue(role);
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toBeVisible();
  });
}
test('role mismatch conceals navigation and synthetic records', async ({ page }) => {
  await page.getByLabel('Fixture role', { exact: true }).selectOption('client');
  await expect(page.getByText('An authorized active session is required for this workspace.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspect synthetic record' })).toHaveCount(0);
});
test('inactive and unauthenticated fixture state conceal content; recovery closes prior dialog', async ({ page }) => {
  await page.getByRole('button', { name: 'View profile' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByLabel('Active fixture membership').uncheck();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toHaveCount(0);
  await page.getByLabel('Active fixture membership').check();
  await page.getByRole('button', { name: 'View profile' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Simulate session revocation while a native modal makes background controls inert.
  await page.getByLabel('Authenticated fixture').evaluate(element => element.click());
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toHaveCount(0);
  await page.getByLabel('Authenticated fixture').check();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Inspect synthetic record' })).toHaveCount(0);
});
test('navigation search selects only rendered fixture modules', async ({ page }) => {
  // Use desktop fixture width and viewport for this interaction; real viewport tests are separate.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Search authorized workspace navigation' }).click();
  await page.getByLabel('Find an authorized module').fill('Documents');
  await page.getByRole('dialog').getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('mobile drawer traps focus, makes background inert and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const opener = page.getByRole('button', { name: 'Open navigation' });
  await opener.click();
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
  const close = drawer.getByRole('button', { name: 'Close navigation' });
  await expect(close).toBeFocused();
  await expect(page.locator('.tg-shell-header')).toHaveAttribute('inert', '');
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('button', { name: 'Review', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0); await expect(opener).toBeFocused();
});
test('actual viewport has no page overflow', async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
