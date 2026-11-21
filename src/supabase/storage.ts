import { supabase } from './config';

export async function getSecureDownloadUrl(
  documentIdOrPath: string,
  bucket = 'client-documents',
  expiresInSeconds = 300
): Promise<string> {
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(documentIdOrPath, expiresInSeconds);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }
  throw new Error('Secure storage download is unavailable in this environment.');
}
