import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, dumpOnFailure, ensureStaffed, FOREIGN_CLIENT, openModule, realErrors, sees, sessionWithToken, staffLogin, UNASSIGNED_CLIENT, type Session } from './helpers';

// Phase 7 in the browser: durable client / staff messaging (proposal 039) on the real server with
// PostgreSQL. Client opens a conversation in the portal -> the assigned accountant sees it awaiting
// a reply, answers and records an internal note -> the client sees the answer but never the note.
let mgrToken = ''; let clientToken = ''; let acctToken = '';
let client: Session; let acct: Session;
const subject = 'Synthetic question about my 2025 return';
beforeAll(async () => {
  const mgr = await staffLogin('e2e-mgr');
  mgrToken = (await mgr.page.evaluate(() => localStorage.getItem('artax_session_token')))!;
  await ensureStaffed(mgrToken);
  await mgr.context.close();
  clientToken = await apiLogin('e2e-client');
  acctToken = await apiLogin('e2e-acct');
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('client and staff messaging', () => {
  it('the client starts a conversation from the portal Messages module', async () => {
    client = await sessionWithToken(clientToken, '/portal');
    const { page } = client;
    await page.getByRole('button', { name: 'Messages', exact: true }).first().click();
    await sees(page, 'Messages with your advisors');
    await sees(page, 'No conversations yet.');
    expect(await page.getByText('Internal note').count()).toBe(0);
    const form = page.getByRole('form', { name: 'Start a conversation' });
    await form.getByLabel('Subject').fill(subject);
    await form.getByLabel('Topic').selectOption('TAX_QUESTION');
    await form.getByLabel('Message').fill('Have you received my synthetic wage statement?');
    await form.getByRole('button', { name: 'Start conversation' }).click();
    await sees(page, 'Conversation started. Your message was recorded by the server.');
    await page.getByRole('article', { name: 'Conversation' }).getByText('Have you received my synthetic wage statement?').waitFor();
    expect(realErrors(client)).toEqual([]);
  });

  it('the assigned accountant sees it awaiting a reply, answers, and records an internal note', async () => {
    acct = await staffLogin('e2e-acct');
    const { page } = acct;
    const inbox = page.getByRole('region', { name: /^Client messages awaiting reply/ });
    await inbox.getByText(subject).waitFor();
    await inbox.getByRole('button', { name: `Open conversations for client ${C}` }).click();
    await inbox.getByRole('button', { name: new RegExp(subject) }).click();
    const conversation = inbox.getByRole('article', { name: 'Conversation' });
    await conversation.getByText('Have you received my synthetic wage statement?').waitFor();
    const reply = conversation.getByRole('form', { name: 'Reply' });
    await reply.getByLabel('Internal note (not visible to the client)').check();
    await reply.getByRole('textbox', { name: 'Internal note', exact: true }).fill('Synthetic internal: confirm the employer name before replying.');
    await reply.getByRole('button', { name: 'Record internal note' }).click();
    await sees(page, 'Internal note recorded. The client cannot see it.');
    await reply.getByRole('textbox', { name: 'Reply', exact: true }).fill('Yes, your synthetic wage statement was received.');
    await reply.getByRole('button', { name: 'Send message' }).click();
    await sees(page, 'Message sent and recorded by the server.');
    await conversation.getByText('Internal note — not visible to the client').waitFor();
    await inbox.getByRole('button', { name: 'Close client conversations' }).click();
    await sees(page, 'No client messages are waiting for a reply.');
    expect(realErrors(acct)).toEqual([]);
  });

  it('the client sees the answer, never the internal note, and the overview counts the unread reply', async () => {
    const { page } = client;
    await page.goto(page.url().split('#')[0], { waitUntil: 'domcontentloaded' });
    await sees(page, '1 unread');
    await page.getByRole('button', { name: 'Messages', exact: true }).first().click();
    await page.getByRole('button', { name: new RegExp(subject) }).click();
    const conversation = page.getByRole('article', { name: 'Conversation' });
    await conversation.getByText('Yes, your synthetic wage statement was received.').waitFor();
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/confirm the employer name|Internal note/);
    expect(text).toContain('Your advisor team');
    expect(realErrors(client)).toEqual([]);
  });

  it('refuses other clients\' conversations, unassigned and other-tenant clients, and posting to a resolved thread', async () => {
    const [thread] = (await api(clientToken, 'GET', `/api/communications/clients/${C}/threads`)).body;
    for (const other of [UNASSIGNED_CLIENT, FOREIGN_CLIENT]) {
      expect((await api(clientToken, 'GET', `/api/communications/clients/${other}/threads`)).status, other).toBe(404);
      expect((await api(acctToken, 'GET', `/api/communications/clients/${other}/threads`)).status, other).toBeGreaterThanOrEqual(403);
    }
    expect((await api(clientToken, 'POST', `/api/communications/clients/${C}/threads/${thread.threadId}/messages`, { body: 'x', visibility: 'INTERNAL_ONLY' })).body.code).toBe('COMM_INTERNAL_STAFF_ONLY');
    expect((await api(clientToken, 'POST', `/api/communications/clients/${C}/threads/${thread.threadId}/status`, { status: 'RESOLVED' })).body.code).toBe('COMM_STAFF_REQUIRED');
    expect((await api(acctToken, 'POST', `/api/communications/clients/${C}/threads/${thread.threadId}/status`, { status: 'ARCHIVED' })).body.code).toBe('COMM_MANAGER_REQUIRED');
    const resolved = await api(mgrToken, 'POST', `/api/communications/clients/${C}/threads/${thread.threadId}/status`, { status: 'RESOLVED' });
    expect(resolved.body.status, JSON.stringify(resolved)).toBe('RESOLVED');
    expect((await api(clientToken, 'POST', `/api/communications/clients/${C}/threads/${thread.threadId}/messages`, { body: 'One more synthetic question' })).body.code).toBe('COMM_THREAD_CLOSED');
    // Replaying an earlier send with the same key returns the recorded message, not a duplicate.
    const key = 'e2e-msg-replay-1';
    const first = await api(mgrToken, 'POST', `/api/communications/clients/${C}/threads`, { subject: 'Synthetic replay check', body: 'Synthetic body' }, key);
    const again = await api(mgrToken, 'POST', `/api/communications/clients/${C}/threads`, { subject: 'Synthetic replay check', body: 'Synthetic body' }, key);
    expect(again.body.message).toMatchObject({ messageId: first.body.message.messageId, replayed: true });
    expect((await api(mgrToken, 'GET', `/api/communications/clients/${C}/threads`)).body.filter((t: any) => t.subject === 'Synthetic replay check')).toHaveLength(1);
  });
});
