import { apiEndpoint } from '../config/apiEndpoint';
import { getStoredToken } from '../services/api';

export async function getSecureDownloadUrl(documentId: string): Promise<string> {
  const token = getStoredToken();
  const res = await fetch(apiEndpoint(`/api/documents/${encodeURIComponent(documentId)}/download`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    throw new Error('Secure document download is unavailable in this environment.');
  }
  const data = await res.json().catch(() => null);
  if (!data?.url) {
    throw new Error('Secure download URL not returned.');
  }
  return data.url as string;
}
