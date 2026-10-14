import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { MAX_DOCUMENT_BYTES, VaultIntegrationError, type MalwareScanner } from './vaultIntegrations';

export interface ScanRequest { requestId: string; digest: string; issuedAt: number; bytes: Buffer; signature: string }
export interface ScanVerdict { requestId: string; digest: string; issuedAt: number; verdict: 'CLEAN' | 'INFECTED'; signature: string }
/** A commissioned implementation must use authenticated TLS and honor AbortSignal. No network
 * transport is installed here. Each response is bound to one request and exact document bytes. */
export interface ScannerTransport { scan(request: ScanRequest, signal: AbortSignal): Promise<ScanVerdict> }
const sign = (key: Buffer, fields: unknown[]) => createHmac('sha256', key).update(JSON.stringify(fields)).digest('hex');
export function scanRequestSignature(key: Buffer, request: Omit<ScanRequest, 'signature'>) {
  return sign(key, ['taxguard-scan-request-v1', request.requestId, request.digest, request.issuedAt]);
}
export function scanVerdictSignature(key: Buffer, verdict: Omit<ScanVerdict, 'signature'>) {
  return sign(key, ['taxguard-scan-verdict-v1', verdict.requestId, verdict.digest, verdict.issuedAt, verdict.verdict]);
}

export class AuthenticatedMalwareScanner implements MalwareScanner {
  readonly name = 'authenticated-scanner-v1';
  private readonly key: Buffer;
  constructor(private readonly transport: ScannerTransport, key: Buffer, private readonly timeoutMs = 30_000) {
    if (!Buffer.isBuffer(key) || key.length < 32 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new VaultIntegrationError('SCANNER_CONFIGURATION_INVALID');
    this.key = Buffer.from(key);
  }
  async scan(bytes: Buffer,context?:{requestId:string;issuedAt:number}): Promise<'CLEAN' | 'INFECTED'> {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new VaultIntegrationError('SCANNER_INPUT_INVALID');
    const copy = Buffer.from(bytes);
    if(context&&(!/^[a-f0-9-]{36}$/.test(context.requestId)||!Number.isSafeInteger(context.issuedAt)||Math.abs(Date.now()-context.issuedAt)>30000))throw new VaultIntegrationError('SCANNER_INPUT_INVALID');
    const request = { requestId: context?.requestId??randomUUID(), digest: createHash('sha256').update(copy).digest('hex'), issuedAt: context?.issuedAt??Date.now(), bytes: copy };
    const started=performance.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.transport.scan({ ...request, signature: scanRequestSignature(this.key, request) }, controller.signal),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new VaultIntegrationError('SCANNER_TIMEOUT')); }, this.timeoutMs); }),
      ]);
      if(controller.signal.aborted || performance.now()-started>=this.timeoutMs)throw new VaultIntegrationError('SCANNER_TIMEOUT');
      if (!result || result.requestId !== request.requestId || result.digest !== request.digest || result.issuedAt !== request.issuedAt ||
        !['CLEAN', 'INFECTED'].includes(result.verdict) || typeof result.signature !== 'string' || !/^[a-f0-9]{64}$/.test(result.signature) ||
        !timingSafeEqual(Buffer.from(result.signature, 'hex'), Buffer.from(scanVerdictSignature(this.key, result), 'hex'))) {
        throw new VaultIntegrationError('SCANNER_VERDICT_INVALID');
      }
      return result.verdict;
    } catch (error) {
      if (error instanceof VaultIntegrationError) throw error;
      throw new VaultIntegrationError('SCANNER_UNAVAILABLE');
    } finally { if (timer) clearTimeout(timer); controller.abort(); }
  }
}
