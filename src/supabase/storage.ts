export async function getSecureDownloadUrl(documentId: string): Promise<string> {
  throw new Error(`Secure download URL unavailable offline for document ${documentId}`);
}
