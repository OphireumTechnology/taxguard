/**
 * Resend transactional e-mail adapter (https://resend.com/docs/api-reference/emails/send-email).
 *
 * Delivery is real or it is refused: a message counts as SENT only when Resend accepts it and returns an id. Nothing is
 * ever reported as sent without that acknowledgement, and no local stand-in exists.
 *
 * Commissioning (all required; otherwise NOT_CONFIGURED and nothing is sent):
 *   RESEND_API_KEY            server-only secret (never logged, never returned)
 *   RESEND_FROM_ADDRESS       a sender on the verified domain, e.g. "Destria Tax Services, LLC <info@destriataxservices.com>"
 *   TAXGUARD_EMAIL_DELIVERY   "enabled" - the owner's explicit switch for live delivery in that environment
 * The sender must belong to destriataxservices.com (the verified Resend domain).
 */
export const RESEND_ENDPOINT = 'https://api.resend.com/emails';
export const VERIFIED_SENDER_DOMAIN = 'destriataxservices.com';

export type EmailSendResult =
  | { status: 'SENT'; providerReference: string }
  | { status: 'NOT_CONFIGURED'; code: 'EMAIL_PROVIDER_NOT_COMMISSIONED' | 'EMAIL_SENDER_NOT_VERIFIED' | 'EMAIL_DELIVERY_DISABLED' }
  | { status: 'FAILED'; code: 'EMAIL_INPUT_INVALID' | 'EMAIL_PROVIDER_REJECTED' | 'EMAIL_PROVIDER_RATE_LIMITED' | 'EMAIL_PROVIDER_UNAVAILABLE'; retryable: boolean };

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Stable per logical message, so a retry can never send twice (Resend Idempotency-Key). */
  idempotencyKey: string;
}

const ADDRESS = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}$/;
const senderAddress = (from: string) => (/<([^<>]+)>\s*$/.exec(from)?.[1] ?? from).trim();

export function resendConfiguration(env: NodeJS.ProcessEnv = process.env):
  | { ready: true; apiKey: string; from: string }
  | { ready: false; code: 'EMAIL_PROVIDER_NOT_COMMISSIONED' | 'EMAIL_SENDER_NOT_VERIFIED' | 'EMAIL_DELIVERY_DISABLED' } {
  const apiKey = (env.RESEND_API_KEY || '').trim();
  const from = (env.RESEND_FROM_ADDRESS || '').trim();
  if (!apiKey || !from) return { ready: false, code: 'EMAIL_PROVIDER_NOT_COMMISSIONED' };
  const address = senderAddress(from);
  if (!ADDRESS.test(address) || address.split('@')[1].toLowerCase() !== VERIFIED_SENDER_DOMAIN) return { ready: false, code: 'EMAIL_SENDER_NOT_VERIFIED' };
  if ((env.TAXGUARD_EMAIL_DELIVERY || '').trim() !== 'enabled') return { ready: false, code: 'EMAIL_DELIVERY_DISABLED' };
  return { ready: true, apiKey, from };
}

export async function sendTransactionalEmail(message: EmailMessage, deps: { env?: NodeJS.ProcessEnv; fetch?: typeof fetch } = {}): Promise<EmailSendResult> {
  const config = resendConfiguration(deps.env ?? process.env);
  if (config.ready === false) return { status: 'NOT_CONFIGURED', code: config.code };
  const to = (message.to || '').trim();
  if (!ADDRESS.test(to) || !message.subject?.trim() || message.subject.length > 200 || !message.text?.trim() || message.text.length > 20000
    || !/^[A-Za-z0-9_.:-]{8,256}$/.test(message.idempotencyKey || '')) {
    return { status: 'FAILED', code: 'EMAIL_INPUT_INVALID', retryable: false };
  }
  let response: Response;
  try {
    response = await (deps.fetch ?? fetch)(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': message.idempotencyKey },
      body: JSON.stringify({ from: config.from, to: [to], subject: message.subject.trim(), text: message.text }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { status: 'FAILED', code: 'EMAIL_PROVIDER_UNAVAILABLE', retryable: true };
  }
  const data = await response.json().catch(() => null) as { id?: unknown } | null;
  if (response.ok && typeof data?.id === 'string' && /^[A-Za-z0-9-]{8,128}$/.test(data.id)) return { status: 'SENT', providerReference: data.id };
  if (response.status === 429) return { status: 'FAILED', code: 'EMAIL_PROVIDER_RATE_LIMITED', retryable: true };
  if (response.status >= 500 || response.ok) return { status: 'FAILED', code: 'EMAIL_PROVIDER_UNAVAILABLE', retryable: true };
  return { status: 'FAILED', code: 'EMAIL_PROVIDER_REJECTED', retryable: false };
}
