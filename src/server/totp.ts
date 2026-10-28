/**
 * RFC 6238 TOTP verification for local (non-production) TaxGuard sessions.
 *
 * - HMAC-SHA1, 30-second step, 6 digits (the authenticator-app default).
 * - Accepts the current step and one step either side (clock drift).
 * - Replay protection: a step that has been accepted for a user can never be accepted again.
 * - Secrets live only in this module's map. They are never attached to user objects,
 *   never returned by any API and never logged.
 *
 * Production identity (and MFA) belongs to Supabase; this verifier is not used there.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const secrets = new Map<string, Buffer>();
const lastAcceptedStep = new Map<string, number>();

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error('TOTP secret must be base32.');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** 160-bit random secret, base32-encoded (RFC 4226 recommends at least 128 bits). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function generateTotpCode(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', secret).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return binary.toString().padStart(DIGITS, '0');
}

export function currentTotpStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/** Registers (or replaces) the TOTP secret for a user. Rejects secrets shorter than 128 bits. */
export function registerTotpSecret(userId: string, base32Secret: string): void {
  const key = base32Decode(base32Secret);
  if (key.length < 16) throw new Error('TOTP secret must be at least 128 bits.');
  secrets.set(userId, key);
  lastAcceptedStep.delete(userId);
}

export function hasTotpSecret(userId: string): boolean {
  return secrets.has(userId);
}

export function removeTotpSecret(userId: string): void {
  secrets.delete(userId);
  lastAcceptedStep.delete(userId);
}

export type TotpResult = 'valid' | 'invalid' | 'replayed' | 'not_enrolled';

export function verifyTotp(userId: string, code: unknown, nowMs: number = Date.now()): TotpResult {
  const secret = secrets.get(userId);
  if (!secret) return 'not_enrolled';
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return 'invalid';
  const now = currentTotpStep(nowMs);
  const last = lastAcceptedStep.get(userId) ?? -1;
  let matchedStep = -1;
  for (let step = now - WINDOW; step <= now + WINDOW; step++) {
    const expected = Buffer.from(generateTotpCode(secret, step));
    // Compare every candidate in constant time; do not stop at the first match.
    if (timingSafeEqual(expected, Buffer.from(code)) && matchedStep === -1) matchedStep = step;
  }
  if (matchedStep === -1) return 'invalid';
  if (matchedStep <= last) return 'replayed';
  lastAcceptedStep.set(userId, matchedStep);
  return 'valid';
}

/** otpauth:// URI for enrolling an authenticator app (shown once by the provisioning script). */
export function totpProvisioningUri(base32Secret: string, accountEmail: string, issuer = 'TaxGuard AI (local)'): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  return `otpauth://totp/${label}?secret=${base32Secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
