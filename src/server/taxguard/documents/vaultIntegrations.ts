export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export class SupabaseVaultStorage {
  constructor(private readonly supabase: any = null, private readonly bucket = 'taxguard-documents') {}

  async upload(_path: string, _data: Buffer | Uint8Array, _contentType?: string): Promise<any> {
    if (!this.supabase) {
      throw Object.assign(new Error('Durable document vault storage is not configured.'), {
        code: 'VAULT_STORAGE_UNAVAILABLE',
        status: 503,
      });
    }
    throw Object.assign(new Error('Durable document vault storage is not configured.'), {
      code: 'VAULT_STORAGE_UNAVAILABLE',
      status: 503,
    });
  }

  async download(_path: string): Promise<Buffer> {
    throw Object.assign(new Error('Durable document vault storage is not configured.'), {
      code: 'VAULT_STORAGE_UNAVAILABLE',
      status: 503,
    });
  }

  async delete(_path: string): Promise<void> {
    throw Object.assign(new Error('Durable document vault storage is not configured.'), {
      code: 'VAULT_STORAGE_UNAVAILABLE',
      status: 503,
    });
  }

  async getSignedUrl(_path: string, _expiresInSeconds = 300): Promise<string> {
    throw Object.assign(new Error('Durable document vault storage is not configured.'), {
      code: 'VAULT_STORAGE_UNAVAILABLE',
      status: 503,
    });
  }
}
