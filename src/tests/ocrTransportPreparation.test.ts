import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { GoogleCloudDocumentAiProvider, type OcrDocumentInput } from '../server/taxguard/ocrProvider';
import { parseDocumentAiResponse } from '../server/taxguard/documentAiResponse';
const state = vi.hoisted(() => ({ exists: true, content: Buffer.from('%PDF-synthetic-only'), size: 20 }));
vi.mock('node:fs', () => ({ existsSync: () => state.exists, readFileSync: () => state.content, statSync: () => ({ isFile: () => true, size: state.size }) }));
const input = (): OcrDocumentInput => ({ tenantId: 'synthetic_tenant', clientId: 'synthetic_client', engagementId: 'synthetic_engagement', caseId: 'synthetic_case', taxYear: 2025, documentId: 'synthetic_document', fileName: 'synthetic.pdf', storagePath: 'synthetic-only-fixture', sha256: createHash('sha256').update(state.content).digest('hex'), mimeType: 'application/pdf' });
let fetchMock = vi.fn();
beforeEach(() => {
  state.exists = true; state.size = 20; state.content = Buffer.from('%PDF-synthetic-only');
  GoogleCloudDocumentAiProvider.setTransport(undefined);
  vi.stubEnv('DOCUMENT_AI_PROCESSOR_ID', 'projects/synthetic-project/locations/us/processors/synthetic-processor');
  vi.stubEnv('GOOGLE_CLOUD_ACCESS_TOKEN', 'synthetic-token');
  fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ document: { entities: [{ type: 'synthetic_field', mentionText: 'candidate', confidence: 0, pageAnchor: { pageRefs: [{ page: '1' }] } }] } })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); GoogleCloudDocumentAiProvider.setTransport(undefined); });
describe('cloud OCR preparation, synthetic transport only', () => {
  it('preserves zero confidence and converts zero-indexed string page without concatenation', async () => {
    const result = await new GoogleCloudDocumentAiProvider().extract(input());
    expect(result[0]).toMatchObject({ confidence: 0, page: 2, proposedValue: 'candidate' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://us-documentai.googleapis.com/v1/projects/synthetic-project/locations/us/processors/synthetic-processor:process');
  });
  it('refuses production filesystem source export before accessing transport', async () => {
    vi.stubEnv('NODE_ENV', 'production'); await expect(new GoogleCloudDocumentAiProvider().extract(input())).rejects.toThrow('OCR_DURABLE_SOURCE_REQUIRED'); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['https://evil.example/processor', 'projects/x/locations/us.evil.example/processors/x', 'projects/x/locations/us/processors/x?redirect=evil', '../processor'])('rejects endpoint/config injection %s', async processor => {
    vi.stubEnv('DOCUMENT_AI_PROCESSOR_ID', processor); await expect(new GoogleCloudDocumentAiProvider().extract(input())).rejects.toThrow('OCR_INVALID_SOURCE'); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('refuses missing or changed source instead of sending an empty or different document', async () => {
    state.exists = false; await expect(new GoogleCloudDocumentAiProvider().extract(input())).rejects.toThrow('OCR_SOURCE_UNAVAILABLE');
    state.exists = true; await expect(new GoogleCloudDocumentAiProvider().extract({ ...input(), sha256: 'a'.repeat(64) })).rejects.toThrow('OCR_SOURCE_HASH_MISMATCH'); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('refuses oversized source before provider dispatch', async () => {
    state.size = 21 * 1024 * 1024; await expect(new GoogleCloudDocumentAiProvider().extract(input())).rejects.toThrow('OCR_INVALID_SOURCE'); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('bounds a hanging provider request without retry or fallback', async () => {
    vi.useFakeTimers(); fetchMock.mockImplementation(() => new Promise(() => {}));
    const pending = new GoogleCloudDocumentAiProvider().extract(input());
    const assertion = expect(pending).rejects.toThrow('OCR_SERVICE_TIMEOUT');
    await vi.advanceTimersByTimeAsync(10000); await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('rejects oversized provider response before decoding', async () => {
    fetchMock.mockImplementation(async () => new Response('x'.repeat(4 * 1024 * 1024 + 1)));
    await expect(new GoogleCloudDocumentAiProvider().extract(input())).rejects.toThrow('OCR_INVALID_RESPONSE');
  });
  it('sanitizes transport diagnostics', async () => {
    fetchMock.mockRejectedValue(new Error('PRIVATE_TOKEN_AND_HOST')); await expect(new GoogleCloudDocumentAiProvider().extract(input())).rejects.toThrow('OCR_SERVICE_UNAVAILABLE');
  });
});
describe('untrusted OCR candidate decoding', () => {
  it.each([undefined, null, 0])('missing or zero confidence %s never becomes high confidence', confidence => {
    const result = parseDocumentAiResponse({ document: { entities: [{ type: 'field', confidence }] } }, 'synthetic', '1'); expect(result[0].confidence).toBe(0);
  });
  it('raw text without confidence remains unverified at zero confidence', () => {
    expect(parseDocumentAiResponse({ document: { text: 'synthetic text' } }, 'synthetic', '1')[0].confidence).toBe(0);
  });
  it.each([-1, 1.1, NaN, Infinity, '0.95', true])('rejects malformed confidence %s', confidence => {
    expect(() => parseDocumentAiResponse({ document: { entities: [{ type: 'field', confidence }] } }, 'synthetic', '1')).toThrow('OCR_INVALID_RESPONSE');
  });
  it.each([null, {}, { document: { error: { code: 1 } } }, { document: { entities: {} } }, { document: { entities: new Array(1001).fill({}) } }, { document: { entities: [{ mentionText: { malicious: true } }] } }])('rejects malformed or oversized response', raw => {
    expect(() => parseDocumentAiResponse(raw, 'synthetic', '1')).toThrow('OCR_INVALID_RESPONSE');
  });
  it('preserves intentionally empty normalized text instead of substituting mention text', () => {
    expect(parseDocumentAiResponse({ document: { entities: [{ normalizedValue: { text: '' }, mentionText: 'untrusted fallback' }] } }, 'synthetic', '1')[0].proposedValue).toBe('');
  });
});
