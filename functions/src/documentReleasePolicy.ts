/** Legacy download path stays closed unless a trusted scanner records a clean,
 * generation-bound object. Browser metadata writes are disabled in Firestore rules.
 */
export function documentCanBeReleased(data: Record<string, unknown>, uid: string): boolean {
  if (data.clientId !== uid || data.scanStatus !== 'CLEAN' || data.status === 'quarantined' ||
      typeof data.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(data.id) ||
      typeof data.storageGeneration !== 'string' || !/^\d+$/.test(data.storageGeneration) ||
      typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.sha256) ||
      typeof data.storagePath !== 'string') return false;
  return data.storagePath.startsWith(`clients/${uid}/${data.id}/`) &&
    data.storagePath.split('/').length === 4 && !data.storagePath.includes('..');
}
