import type { Engagement, DocumentItem, User } from '../types';
/** Read model only; exact-scope authorization is supplied by the existing assignment authority. */
export function projectAccountantCases(
  tenantId: string | undefined, engagements: Engagement[], documents: DocumentItem[],
  findClient: (id: string) => User | undefined,
  authorized: (id: string, scope: { engagementId: string; taxYear: number }) => boolean,
) {
  if (!tenantId) return [];
  return engagements.flatMap(e => {
    const client = findClient(e.clientId);
    if (!client || client.tenantId !== tenantId || !['client','prospective_client'].includes(client.role) ||
      !Number.isInteger(e.taxYear) || e.taxYear < 2022 || !authorized(e.clientId, { engagementId: e.id, taxYear: e.taxYear })) return [];
    return [{ id: e.id, engagementId: e.id, tenantId,
      clientId: e.clientId, authorityClientId: client.clientId || client.id,
      clientName: client.name, taxYear: e.taxYear, status: e.status,
      priority: e.priority, dueDate: e.dueDate, serviceTitle: e.serviceTitle,
      documents: documents.filter(d => d.clientId === e.clientId && d.taxYear === e.taxYear)
        .map(d => ({ id: d.id, clientId: d.clientId, clientName: client.name, fileName: d.fileName,
          taxYear: d.taxYear, status: d.status, category: d.category, version: d.version,
          ocrConfidence: d.ocrConfidence, fileSize: d.fileSize, fileType: d.fileType,
          uploadedAt: d.uploadedAt, uploadedBy: d.uploadedBy, isEncrypted: d.isEncrypted })) }];
  });
}
