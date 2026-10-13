import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuthenticatedMalwareScanner, scanRequestSignature, scanVerdictSignature, type ScanVerdict } from '../server/taxguard/documents/authenticatedScanner';

describe('authenticated scanner adapter (fake transport only)', () => {
  const key = randomBytes(32), bytes = Buffer.from('%PDF synthetic document');
  const respond = (request: any, verdict: 'CLEAN' | 'INFECTED' = 'CLEAN'): ScanVerdict => {
    expect(request.signature).toBe(scanRequestSignature(key, request));
    expect(request.digest).toBe(createHash('sha256').update(request.bytes).digest('hex'));
    const response = { requestId: request.requestId, digest: request.digest, issuedAt: request.issuedAt, verdict };
    return { ...response, signature: scanVerdictSignature(key, response) };
  };
  it.each(['CLEAN', 'INFECTED'] as const)('accepts only authenticated byte-bound %s verdicts', async verdict => {
    const scanner = new AuthenticatedMalwareScanner({ async scan(r) { return respond(r, verdict); } }, key);
    expect(await scanner.scan(bytes)).toBe(verdict);
  });
  it.each(['signature', 'digest', 'requestId', 'issuedAt', 'verdict'])('rejects tampered %s', async field => {
    const scanner = new AuthenticatedMalwareScanner({ async scan(r) { return { ...respond(r), [field]: field === 'issuedAt' ? r.issuedAt - 1 : 'tampered' } as any; } }, key);
    await expect(scanner.scan(bytes)).rejects.toThrow('SCANNER_VERDICT_INVALID');
  });
  it('rejects replay of a signed response from an earlier request', async () => {
    let previous: ScanVerdict | undefined;
    const scanner = new AuthenticatedMalwareScanner({ async scan(r) { return previous ??= respond(r); } }, key);
    expect(await scanner.scan(bytes)).toBe('CLEAN');
    await expect(scanner.scan(bytes)).rejects.toThrow('SCANNER_VERDICT_INVALID');
  });
  it('bounds a hung scanner and aborts its transport', async () => {
    let signal: AbortSignal | undefined;
    const scanner = new AuthenticatedMalwareScanner({ scan(_r, s) { signal = s; return new Promise(() => {}); } }, key, 10);
    await expect(scanner.scan(bytes)).rejects.toThrow('SCANNER_TIMEOUT');
    expect(signal?.aborted).toBe(true);
  });
  it('sanitizes provider errors and refuses unsafe configuration or empty files', async () => {
    const transport = { async scan(): Promise<ScanVerdict> { throw new Error('provider secret'); } };
    expect(() => new AuthenticatedMalwareScanner(transport, Buffer.alloc(1))).toThrow('SCANNER_CONFIGURATION_INVALID');
    await expect(new AuthenticatedMalwareScanner(transport, key).scan(bytes)).rejects.toThrow('SCANNER_UNAVAILABLE');
    await expect(new AuthenticatedMalwareScanner(transport, key).scan(Buffer.alloc(0))).rejects.toThrow('SCANNER_INPUT_INVALID');
  });
});
