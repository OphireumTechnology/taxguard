import { supabase } from './config';

export async function getSecureDownloadUrl(
  storagePathOrDoc: string | { storagePath?: string; filePath?: string; path?: string; url?: string; id?: string; [key: string]: any },
  bucket = 'client-documents',
  expiresInSeconds = 300
): Promise<string> {
  const storagePath =
    typeof storagePathOrDoc === 'string'
      ? storagePathOrDoc
      : storagePathOrDoc?.storagePath || storagePathOrDoc?.filePath || storagePathOrDoc?.path || '';
  if (!supabase || !storagePath) {
    throw new Error('Secure document download is unavailable in this environment.');
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Unable to generate a secure download link.');
  }
  return data.signedUrl;
}
