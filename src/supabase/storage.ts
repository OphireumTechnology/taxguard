export async function getSecureDownloadUrl(documentId: string): Promise<string> {
  return `/api/vault/download/${encodeURIComponent(documentId)}?token=ephemeral`;
}
