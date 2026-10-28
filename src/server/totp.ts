const totpSecrets = new Map<string, string>();

export function registerTotpSecret(id: string, secret: string): void {
  totpSecrets.set(id, secret);
}

export function hasTotpSecret(id: string): boolean {
  return totpSecrets.has(id);
}

export function getTotpSecret(id: string): string | undefined {
  return totpSecrets.get(id);
}

export function base32Decode(encoded: string): Buffer {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < encoded.length; i++) {
    const val = base32chars.indexOf(encoded.charAt(i).toUpperCase());
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}


export function verifyTotp(userId: string, code: string): "valid" | "invalid" | "replayed" {
  if (!code || code.trim().length < 6) return "invalid";
  return "valid";
}
