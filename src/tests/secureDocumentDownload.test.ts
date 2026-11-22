import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStoredToken, setStoredToken } from '../services/api';
import { getSecureDownloadUrl } from '../supabase/storage';

// Client document downloads go through the server vault, which authorizes the request and returns a short-lived signed
// URL. The browser never signs storage URLs with the public key, and a refusal never produces a substitute file.
// Synthetic values; fetch is stubbed.
const calls: Array<{ url: string; method: string; auth: string | null }> = [];
const serve = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
  calls.push({ url: String(input), method: init.method || 'GET', auth: new Headers(init.headers).get('Authorization') });
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}));
const doc = { id: 'doc-1', clientId: 'client-1', version: 2 };
beforeEach(() => { calls.length = 0; setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('secure document download', () => {
  it('asks the server vault for the exact document version with the session and returns its signed URL', async () => {
    serve(200, { url: 'https://storage.example.test/object?token=synthetic', expiresInSeconds: 60, fileName: 'w2.pdf' });
    expect(await getSecureDownloadUrl(doc)).toBe('https://storage.example.test/object?token=synthetic');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/vault/clients/client-1/documents/doc-1/versions/2/download');
    expect(calls[0].auth).toBe('Bearer synthetic-session');
  });
  it('raises refusals and malformed answers instead of returning anything', async () => {
    serve(409, { code: 'DOCUMENT_NOT_AVAILABLE' });
    await expect(getSecureDownloadUrl(doc)).rejects.toBeTruthy();
    serve(200, { url: 'http://insecure.example.test/object' });
    await expect(getSecureDownloadUrl(doc)).rejects.toThrow('DOCUMENT_URL_INVALID');
    await expect(getSecureDownloadUrl({ id: 'doc-1', clientId: '', version: 1 })).rejects.toThrow('DOCUMENT_REFERENCE_INVALID');
  });
  it('the browser module never signs storage URLs, and the documents view never fabricates a file', () => {
    const storage = fs.readFileSync('src/supabase/storage.ts', 'utf8');
    expect(storage).not.toMatch(/createSignedUrl|supabase\.storage|from '\.\/config'/);
    const view = fs.readFileSync('src/components/portal/views/DocumentsView.tsx', 'utf8');
    expect(view).not.toMatch(/new Blob\(|createObjectURL|Encrypted Vault Verified/);
    expect(view).toContain('setDownloadError(`${docItem.fileName}: ${vaultMessage(error)}`)');
  });
});
