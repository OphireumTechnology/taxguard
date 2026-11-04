export async function getSecureDownloadUrl(path: string): Promise<string> {
  return path || '#';
}
