import { test, expect } from '@playwright/test';
import { allowAnonymousProductRequest } from './boundary.mjs';
const observations = new WeakMap();
// Real application, partial anonymous boundaries only. No synthetic shell, auth mock, account or write.
test.beforeEach(async ({ page, context }) => {
  expect(await context.cookies()).toEqual([]);
  const observed = { runtimeErrors: 0, blockedRequests: 0 };
  observations.set(page, observed);
  page.on('pageerror', () => { observed.runtimeErrors++; });
  await context.route('**/*', route => {
    if (allowAnonymousProductRequest(route.request().url(), route.request().method())) return route.continue();
    observed.blockedRequests++;
    return route.abort();
  });
});
test.afterEach(async ({ page }) => {
  const observed = observations.get(page);
  // Record counts only: URLs/errors could contain sensitive payloads. An aborted dependency is not success.
  expect(observed?.blockedRequests, 'requests outside the reviewed anonymous boundary').toBe(0);
  expect(observed?.runtimeErrors, 'uncaught actual application exceptions').toBe(0);
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

test('CLIENT-AUTH partial: recovery form opens and returns without sending email', async ({ page }) => {
  await page.goto('/portal/login');
  await page.getByRole('button', { name: 'Forgot Password?', exact: true }).click();
  await expect(page.getByLabel('Registered Account Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to Sign In', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});
