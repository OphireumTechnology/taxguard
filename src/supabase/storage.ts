import { vaultService } from '../services/vaultService';

/**
 * Secure document download URL. The browser never signs storage URLs itself: the server vault authorizes the request
 * (signed-in session, client and tenant scope, staff assignment, completed malware scan) and returns a short-lived signed
 * URL for the private bucket (POST /api/vault/clients/:clientId/documents/:documentId/versions/:version/download).
 * Any refusal is raised to the caller; there is no local substitute.
 */
export async function getSecureDownloadUrl(document: { id: string; clientId: string; version: number }): Promise<string> {
  if (!document?.id || !document.clientId || !Number.isInteger(document.version)) throw new Error('DOCUMENT_REFERENCE_INVALID');
  const { url } = await vaultService.download(document.clientId, document.id, document.version);
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) throw new Error('DOCUMENT_URL_INVALID');
  return url;
}
