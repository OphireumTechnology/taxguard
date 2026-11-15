export async function getSecureDownloadUrl(documentId: string): Promise<string> {
  throw new Error(`Secure storage URL unavailable for document ${documentId}`);
}
