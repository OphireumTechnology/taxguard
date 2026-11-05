/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function getSecureDownloadUrl(documentId: string): Promise<string> {
  return `/api/documents/${encodeURIComponent(documentId)}/download`;
}
