import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { api, apiLogin, closeBrowser, dumpOnFailure, newSession, ORIGIN, sessionWithToken, type Session } from './helpers';

// Block 108: this profile has no governance database, so the AI Command Center must fail closed: no figures, whoever asks.
// Its real service, database and sessions are exercised in provider/16-ai-command-center.e2e.test.ts.
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });
const ROUTE = '/admin/master/ai';
const ENDPOINT = '/api/ai-governance/control-center/command-center';
const center = (s: Session) => s.page.getByTestId('ai-command-center');

describe('without a governance database', () => {
  it('refuses the API without a session', async () => {
    const response = await fetch(ORIGIN + ENDPOINT);
    expect(response.status).toBe(401);
    expect(await response.text()).not.toMatch(/modules|lifecycle|snapshot/);
  });

  it('answers unavailable to an administrator, with no figures', async () => {
    const response = await api(await apiLogin('e2e-admin'), 'GET', ENDPOINT);
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ code: 'AI_GOVERNANCE_UNAVAILABLE' });
  });

  it('shows the administrator that the service is unavailable, and invents nothing', async () => {
    const s = await sessionWithToken(await apiLogin('e2e-admin'), ROUTE);
    await s.page.getByRole('alert').getByText(/service is unavailable\. No figures are shown/).waitFor();
    expect(await center(s).count()).toBe(0);
    await s.context.close();
  });

  it('asks a visitor with no session to sign in, without calling the API', async () => {
    const s = await newSession();
    await s.page.goto(ORIGIN + ROUTE);
    await s.page.getByRole('button', { name: /sign in/i }).first().waitFor();
    expect(await center(s).count()).toBe(0);
    expect(s.api.filter(r => r.path.startsWith(ENDPOINT))).toEqual([]);
    await s.context.close();
  });

  it('never leaves a client on the page', async () => {
    const s = await sessionWithToken(await apiLogin('e2e-client'), ROUTE);
    await s.page.waitForURL(url => !url.pathname.startsWith('/admin/master'));
    expect(await center(s).count()).toBe(0);
    await s.context.close();
  });
});
