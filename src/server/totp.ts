import { createHmac, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const totpSecrets = new Map<string, string>();
const usedTotpSteps = new Map<string, number>();

export function base32Decode(input: string): Buffer {
  const cleaned = input.trim().toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  if (!cleaned || !/^[A-Z2-7]+$/.test(cleaned)) {
    throw new Error('INVALID_BASE32_SECRET');
  }
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('INVALID_BASE32_SECRET');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function registerTotpSecret(userId: string, base32Secret: string): void {
  base32Decode(base32Secret);
  totpSecrets.set(userId, base32Secret.trim().toUpperCase());
}

export function hasTotpSecret(userId: string): boolean {
  return totpSecrets.has(userId);
}

export function generateTotpCode(base32Secret: string, epochMs = Date.now(), stepSeconds = 30): string {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(epochMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
  return code;
}

export function verifyTotpCode(userId: string, code: string, epochMs = Date.now()): boolean {
  const secret = totpSecrets.get(userId);
  if (!secret || !/^\d{6}$/.test(code)) return false;
  const currentStep = Math.floor(epochMs / 1000 / 30);
  const lastUsed = usedTotpSteps.get(userId) ?? -1;
  for (const delta of [-1, 0, 1]) {
    const step = currentStep + delta;
    if (step <= lastUsed) continue;
    const expected = generateTotpCode(secret, step * 30 * 1000);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      usedTotpSteps.set(userId, step);
      return true;
    }
  }
  return false;
}
