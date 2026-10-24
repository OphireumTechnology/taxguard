import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { C, closeBrowser, dumpOnFailure, newSession, openModule, staffLogin } from './helpers';
import { auditAccessibility } from './a11yAudit';

// Automated accessibility regressions for staff workspaces (client portal navigation and named controls are
// covered separately by the Phase 12C suite). These checks catch what automation can see; they do not
// establish WCAG conformance, which requires manual assistive-technology testing and acceptance.
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('automated accessibility audit', () => {
  it('detects each defect class it claims to check (self-test on a synthetic page)', async () => {
    const s = await newSession();
    await s.page.setContent(`<main><button></button><input type="text"><label>Named<input type="text"></label>
      <span id="dup">a</span><span id="dup">b</span><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="5" height="5">
      <a href="#x" tabindex="3">Positive</a><button aria-label="Named icon"></button><div hidden><button></button></div></main>`);
    const rules = (await auditAccessibility(s.page)).map(f => f.rule).sort();
    expect(rules).toEqual(['control-without-name', 'duplicate-id', 'field-without-label', 'image-without-alt', 'positive-tabindex']);
    await s.context.close();
  });

  const plan: Array<[string, string[]]> = [
    ['e2e-mgr', ['Clients & Engagements', 'Case Workflow', 'Document Review', 'Document Requests', 'Billing', 'Appointments', 'Consultation Requests', 'Reassignment Requests']],
    ['e2e-bk', ['Ledger Workspace', 'Transactions']],
    ['e2e-admin', ['Compliance Audit Log']],
    ['e2e-acct', []],
    ['e2e-rev', []],
  ];
  for (const [who, modules] of plan) {
    it(`finds no unnamed controls, unlabelled fields, duplicate IDs, unlabelled images or positive tabindex for ${who}`, async () => {
      const s = await staffLogin(who);
      expect(await auditAccessibility(s.page), `${who} home`).toEqual([]);
      for (const m of modules) {
        await openModule(s.page, m);
        await s.page.waitForLoadState('networkidle');
        expect(await auditAccessibility(s.page), `${who} ${m}`).toEqual([]);
      }
      await s.context.close();
    });
  }
});

describe('keyboard and focus in the staff billing workspace', () => {
  it('opens and cancels a refund entirely by keyboard, with focus moved into and back out of the form', async () => {
    const s = await staffLogin('e2e-mgr'); const { page } = s;
    await openModule(page, 'Billing');
    await page.getByLabel('Client identifier').fill(C);
    await page.getByLabel('Client identifier').press('Enter'); // the form submits from the keyboard
    const trigger = page.locator('button[data-refund-trigger]').first();
    await trigger.waitFor();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const focusedLabel = () => page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.labels?.[0]?.textContent?.trim() ?? document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim());
    expect(await focusedLabel()).toBe('Refund amount');
    await page.keyboard.press('Tab'); // reason field
    await page.keyboard.press('Tab'); // submit is disabled until valid, so focus moves to Cancel
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Cancel');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-refund-trigger'));
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toMatch(/^Record a refund for payment /);
    await s.context.close();
  });

  it('keeps the billing workspace within a 375 px viewport (no horizontal page scroll)', async () => {
    const s = await staffLogin('e2e-mgr'); const { page } = s;
    await page.setViewportSize({ width: 375, height: 812 });
    // At phone width the workspace navigation is a modal drawer: focus moves in, Escape closes it and
    // returns focus to the button that opened it.
    const opener = page.getByRole('button', { name: 'Open navigation' });
    await opener.click();
    const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
    await drawer.waitFor();
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"][aria-label="Workspace navigation"]'))).toBe(true);
    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden' });
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Open navigation');
    await opener.click();
    await drawer.getByRole('button', { name: 'Billing', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.getByLabel('Client identifier').fill(C);
    await page.getByLabel('Client identifier').press('Enter');
    await page.locator('button[data-refund-trigger]').first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await s.context.close();
  });
});
