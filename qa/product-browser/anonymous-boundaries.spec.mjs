import { test, expect } from '@playwright/test';
import { allowAnonymousProductRequest } from './boundary.mjs';
// Real application, partial anonymous boundaries only. No synthetic shell, auth mock, account or write.
test.beforeEach(async ({ page, context }) => {
  expect(await context.cookies()).toEqual([]);
  await page.route('**/*', route => allowAnonymousProductRequest(route.request().url(), route.request().method())
    ? route.continue() : route.abort());
});
test('CLIENT-AUTH partial: real client sign-in exposes associated email/password fields', async ({ page }) => {
  await page.goto('/portal/login');
  await expect(page.getByLabel('Email Address', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toHaveCount(0);
});
for (const route of ['/portal/dashboard', '/portal/profile']) {
  test(`SESSION partial: anonymous ${route} returns to real client sign-in`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByLabel('Email Address', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/portal\/login$/);
    await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toHaveCount(0);
  });
}
test('SESSION partial: anonymous staff workspace conceals staff records', async ({ page }) => {
  await page.goto('/staff/workspace');
  await expect(page.getByLabel('Staff Work Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Staff Security Token / Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toHaveCount(0);
});
test('ACCESSIBILITY partial: native login labels focus their actual controls', async ({ page }) => {
  await page.goto('/portal/login');
  await page.getByText('Email Address', { exact: true }).click();
  await expect(page.getByLabel('Email Address', { exact: true })).toBeFocused();
  await page.getByText('Password', { exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
});
test('ACCESSIBILITY partial: actual login viewport has no page overflow', async ({ page }) => {
  await page.goto('/portal/login');
  await expect(page.getByLabel('Email Address', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
