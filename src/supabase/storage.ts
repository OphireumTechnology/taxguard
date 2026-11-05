export async function getSecureDownloadUrl(documentId: string): Promise<string> {
  return `/api/documents/download/${encodeURIComponent(documentId)}`;
}

export const storageService = {
  getSecureDownloadUrl
};
