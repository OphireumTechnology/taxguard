/** Closed client contract, independent of database rollout and browser rendering. */
const fields = ['documentId', 'version', 'clientId', 'engagementId', 'taxYear', 'caseId', 'category',
  'fileName', 'mimeType', 'sizeBytes', 'status', 'quarantineStatus', 'createdAt', 'rowVersion'] as const;
export function clientDocument(value: any) {
  const result: Record<string, unknown> = {};
  for (const key of fields) if (['string', 'number', 'boolean'].includes(typeof value?.[key]) || value?.[key] === null) result[key] = value[key];
  if (['REJECTED', 'REPLACEMENT_REQUESTED'].includes(value?.status) && typeof value?.clientReason === 'string') result.clientReason = value.clientReason;
  return result;
}
export function clientDocumentDetail(value: any) {
  return { versions: Array.isArray(value?.versions) ? value.versions.map(clientDocument) : [], extractions: [], history: [] };
}
