import { supabase, isSupabaseConfigured } from './config';

export async function getSecureDownloadUrl(documentId: string): Promise<string> {
  if (!documentId) return '#';
  if (!isSupabaseConfigured()) {
    return `/api/documents/${encodeURIComponent(documentId)}/download`;
  }

  try {
    const { data, error } = await supabase.storage
      .from('taxguard-vault')
      .createSignedUrl(documentId, 3600);

    if (error || !data?.signedUrl) {
      return `/api/documents/${encodeURIComponent(documentId)}/download`;
    }

    return data.signedUrl;
  } catch {
    return `/api/documents/${encodeURIComponent(documentId)}/download`;
  }
}
