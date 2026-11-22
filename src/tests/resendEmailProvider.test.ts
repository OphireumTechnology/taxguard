import { describe, expect, it, vi } from 'vitest';
import { RESEND_ENDPOINT, resendConfiguration, sendTransactionalEmail } from '../server/taxguard/operations/resendEmailProvider';
import { NotificationOrchestratorService } from '../server/taxguard/operations/notificationOrchestrator.service';

// Resend adapter and the notification orchestrator's e-mail and SMS channels. fetch is always stubbed: no message
// leaves the process and no real key is used. Synthetic addresses and keys only.
const KEY = 'synthetic-resend-key-not-real';
const env = (over: Record<string, string> = {}) => ({ RESEND_API_KEY: KEY, RESEND_FROM_ADDRESS: 'Destria Tax Services, LLC <info@destriataxservices.com>', TAXGUARD_EMAIL_DELIVERY: 'enabled', ...over }) as NodeJS.ProcessEnv;
const message = { to: 'client@example.test', subject: 'Synthetic subject', text: 'Synthetic body.', idempotencyKey: 'notif_synthetic_0001' };
const stub = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('Resend commissioning', () => {
  it('needs a key, a sender on the verified domain and the owner switch', () => {
    expect(resendConfiguration({} as NodeJS.ProcessEnv)).toEqual({ ready: false, code: 'EMAIL_PROVIDER_NOT_COMMISSIONED' });
    expect(resendConfiguration(env({ RESEND_FROM_ADDRESS: 'TaxGuard <no-reply@other.example>' }))).toEqual({ ready: false, code: 'EMAIL_SENDER_NOT_VERIFIED' });
    expect(resendConfiguration(env({ RESEND_FROM_ADDRESS: 'info@destriataxservices.com.evil.example' }))).toEqual({ ready: false, code: 'EMAIL_SENDER_NOT_VERIFIED' });
    expect(resendConfiguration(env({ TAXGUARD_EMAIL_DELIVERY: '' }))).toEqual({ ready: false, code: 'EMAIL_DELIVERY_DISABLED' });
    expect(resendConfiguration(env())).toMatchObject({ ready: true, from: 'Destria Tax Services, LLC <info@destriataxservices.com>' });
  });
});

describe('sendTransactionalEmail', () => {
  it('sends nothing until commissioned', async () => {
    const f = stub(200, { id: 'abc12345-0000' });
    expect(await sendTransactionalEmail(message, { env: env({ TAXGUARD_EMAIL_DELIVERY: '' }), fetch: f as any })).toEqual({ status: 'NOT_CONFIGURED', code: 'EMAIL_DELIVERY_DISABLED' });
    expect(f).not.toHaveBeenCalled();
  });
  it('is SENT only with Resend\'s acknowledgement id, with the idempotency key and the key only in the Authorization header', async () => {
    const f = stub(200, { id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' });
    expect(await sendTransactionalEmail(message, { env: env(), fetch: f as any })).toEqual({ status: 'SENT', providerReference: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_ENDPOINT);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(headers['Idempotency-Key']).toBe('notif_synthetic_0001');
    expect(JSON.parse(String(init.body))).toEqual({ from: 'Destria Tax Services, LLC <info@destriataxservices.com>', to: ['client@example.test'], subject: 'Synthetic subject', text: 'Synthetic body.' });
    expect(String(init.body)).not.toContain(KEY);
  });
  it.each([
    [200, {}, 'EMAIL_PROVIDER_UNAVAILABLE', true],
    [422, { message: 'invalid' }, 'EMAIL_PROVIDER_REJECTED', false],
    [429, {}, 'EMAIL_PROVIDER_RATE_LIMITED', true],
    [503, {}, 'EMAIL_PROVIDER_UNAVAILABLE', true],
  ] as const)('HTTP %i (%j) is %s, never SENT', async (status, body, code, retryable) => {
    expect(await sendTransactionalEmail(message, { env: env(), fetch: stub(status, body) as any })).toEqual({ status: 'FAILED', code, retryable });
  });
  it('refuses invalid input and network failures without sending or claiming delivery', async () => {
    const f = stub(200, { id: 'abc12345-0000' });
    for (const bad of [{ ...message, to: 'not-an-address' }, { ...message, subject: '' }, { ...message, idempotencyKey: 'x' }])
      expect(await sendTransactionalEmail(bad, { env: env(), fetch: f as any })).toEqual({ status: 'FAILED', code: 'EMAIL_INPUT_INVALID', retryable: false });
    expect(f).not.toHaveBeenCalled();
    const down = vi.fn(async () => { throw new TypeError('fetch failed'); });
    expect(await sendTransactionalEmail(message, { env: env(), fetch: down as any })).toEqual({ status: 'FAILED', code: 'EMAIL_PROVIDER_UNAVAILABLE', retryable: true });
  });
});

describe('notification orchestrator channels', () => {
  const base = { tenantId: 'tenant-synthetic', recipientId: 'user-1', recipientRole: 'client', templateType: 'SYNTHETIC', title: 'Synthetic', body: 'Synthetic body.' };
  it('never reports e-mail or SMS as sent without a provider acknowledgement', async () => {
    vi.stubEnv('RESEND_API_KEY', ''); vi.stubEnv('SENDGRID_API_KEY', 'synthetic'); vi.stubEnv('SMTP_HOST', 'synthetic'); vi.stubEnv('TWILIO_AUTH_TOKEN', 'x'); vi.stubEnv('TWILIO_ACCOUNT_SID', 'y');
    try {
      const o = new NotificationOrchestratorService();
      expect(await o.dispatch({ ...base, channel: 'EMAIL' })).toMatchObject({ status: 'NOT_CONFIGURED', failureCode: 'EMAIL_RECIPIENT_ADDRESS_UNKNOWN' });
      const email = await o.dispatch({ ...base, channel: 'EMAIL', recipientEmail: 'client@example.test' });
      expect(email).toMatchObject({ status: 'NOT_CONFIGURED', failureCode: 'EMAIL_PROVIDER_NOT_COMMISSIONED' });
      expect(email.providerReference).toBeUndefined();
      const sms = await o.dispatch({ ...base, channel: 'SMS' });
      expect(sms).toMatchObject({ status: 'NOT_CONFIGURED', failureCode: 'SMS_PROVIDER_NOT_COMMISSIONED' });
      expect(sms.providerReference).toBeUndefined();
    } finally { vi.unstubAllEnvs(); }
  });
});
