import { isSupabaseConfigured, supabase } from './config';

export const VAULT_BUCKET = 'taxguard-client-documents';

export async function uploadDocumentToStorage(
  path: string,
  file: Blob | File | ArrayBuffer
): Promise<{ path: string; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { path, error: 'Document storage provider is not configured.' };
  }
  const { data, error } = await supabase.storage.from(VAULT_BUCKET).upload(path, file, { upsert: false });
  if (error) return { path, error: error.message };
  return { path: data.path };
}

export async function getSecureDownloadUrl(
  docOrPath: string | Record<string, any>,
  expiresInSeconds = 300
): Promise<string> {
  const path =
    typeof docOrPath === 'string'
      ? docOrPath
      : docOrPath?.storagePath || docOrPath?.url || docOrPath?.fileName || docOrPath?.id || '';
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Document storage provider is not configured.');
  }
  const { data, error } = await supabase.storage
    .from(VAULT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Unable to create signed download URL.');
  }
  return data.signedUrl;
}
