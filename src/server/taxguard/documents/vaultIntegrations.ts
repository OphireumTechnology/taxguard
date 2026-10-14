/**
 * Integration boundaries for the document vault. Production must provide a private storage
 * backend and a commissioned malware scanner; OCR is optional. Nothing here contacts a
 * provider unless a backend is explicitly constructed with a client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const VAULT_BUCKET = 'taxguard-vault';
export const MAX_DOCUMENT_BYTES = 26_214_400;
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'] as const;

export interface VaultStorage {
  put(path: string, bytes: Buffer, mimeType: string): Promise<void>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
}
export interface MalwareScanner { readonly name: string; scan(bytes: Buffer,context?:{requestId:string;issuedAt:number}): Promise<'CLEAN' | 'INFECTED'> }
export interface OcrField { fieldKey: string; value: unknown; confidence: number; page?: number }
export interface OcrProvider { readonly name: string; extract(bytes: Buffer, mimeType: string): Promise<OcrField[]> }

export class VaultIntegrationError extends Error {
  constructor(public readonly code: string, public readonly status = 503) { super(code); }
}

/** Content signature check: the bytes must match the declared type, not just the header. */
export function contentMatchesType(mimeType: string, bytes: Buffer): boolean {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (mimeType) {
    case 'application/pdf': return starts([0x25, 0x50, 0x44, 0x46, 0x2d]);
    case 'image/png': return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg': return starts([0xff, 0xd8, 0xff]);
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return starts([0x50, 0x4b, 0x03, 0x04]);
    case 'text/csv': {
      const sample = bytes.subarray(0, 8192);
      // Printable UTF-8 text without NUL bytes; no spreadsheet formula injection at line starts.
      if (sample.includes(0)) return false;
      const text = sample.toString('utf8');
      return !/(^|\n)\s*[=+\-@]/.test(text) && !/�/.test(text);
    }
    default: return false;
  }
}

/** Private Supabase Storage bucket. Refuses to operate if the bucket is missing or public. */
export class SupabaseVaultStorage implements VaultStorage {
  private verified = false;
  constructor(private readonly client: SupabaseClient, private readonly bucket = VAULT_BUCKET) {}
  private async assertPrivate() {
    if (this.verified) return;
    const { data, error } = await this.client.storage.getBucket(this.bucket);
    if (error || !data) throw new VaultIntegrationError('VAULT_STORAGE_UNAVAILABLE');
    if (data.public !== false) throw new VaultIntegrationError('VAULT_BUCKET_NOT_PRIVATE');
    this.verified = true;
  }
  async put(path: string, bytes: Buffer, mimeType: string) {
    await this.assertPrivate();
    const { error } = await this.client.storage.from(this.bucket).upload(path, bytes, { contentType: mimeType, upsert: false });
    if (error) throw new VaultIntegrationError('VAULT_STORAGE_WRITE_FAILED');
  }
  async signedUrl(path: string, ttlSeconds: number) {
    await this.assertPrivate();
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(path, ttlSeconds);
    if (error || !data?.signedUrl) throw new VaultIntegrationError('VAULT_STORAGE_SIGN_FAILED');
    return data.signedUrl;
  }
}
