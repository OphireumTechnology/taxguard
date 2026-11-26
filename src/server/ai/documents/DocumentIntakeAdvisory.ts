import { isUploadRejected, validateDocumentUpload, type UploadRejectionCode } from '../../documentUploadValidation';
import { GovernanceError } from '../governance/contracts';

type Scope = Readonly<{ clientId: string; engagementId: string; taxYear: number }>;
type IntakeSnapshot = Scope & Readonly<{
  documentId: string;
  version: number;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  category?: string;
  status: string;
  quarantineStatus: string;
  linkedRequest: boolean;
}>;
type IntakeFinding = UploadRejectionCode | 'WAITING_FOR_SCAN' | 'REVIEW_INTAKE' | 'DOCUMENT_UNAVAILABLE' | 'REQUEST_LINK_MISSING';

/** Advisory over a trusted vault snapshot. This function cannot upload, scan, release or enqueue processing. */
export function inspectDocumentIntake(scope: Scope, snapshot: IntakeSnapshot, now = new Date()) {
  if (!snapshot || typeof snapshot !== 'object') throw new GovernanceError('AI_DOCUMENT_METADATA_INVALID');
  if (!scope.clientId || !scope.engagementId || scope.clientId !== snapshot.clientId
    || scope.engagementId !== snapshot.engagementId || scope.taxYear !== snapshot.taxYear) {
    throw new GovernanceError('AI_DOCUMENT_SCOPE_INVALID');
  }
  if (typeof snapshot.documentId !== 'string' || !snapshot.documentId.trim()
    || !Number.isSafeInteger(snapshot.version) || snapshot.version < 1
    || typeof snapshot.linkedRequest !== 'boolean') throw new GovernanceError('AI_DOCUMENT_METADATA_INVALID');

  const validation = validateDocumentUpload({ ...snapshot, fileSize: snapshot.sizeBytes }, now);
  const findings: IntakeFinding[] = [];
  if (isUploadRejected(validation)) {
    findings.push(validation.code, 'DOCUMENT_UNAVAILABLE');
  } else if (['QUARANTINED', 'PENDING'].includes(snapshot.quarantineStatus)
    && ['UPLOAD_PENDING', 'SCAN_PENDING'].includes(snapshot.status)) {
    findings.push('WAITING_FOR_SCAN');
  } else if (snapshot.quarantineStatus === 'CLEAN' && ['PENDING_REVIEW', 'VERIFIED'].includes(snapshot.status)) {
    findings.push('REVIEW_INTAKE');
  } else {
    findings.push('DOCUMENT_UNAVAILABLE');
  }
  if (!snapshot.linkedRequest) findings.push('REQUEST_LINK_MISSING');

  return {
    agent_id: 'A05' as const, status: 'ADVISORY' as const, human_review_required: true as const,
    authoritative_mutation: false as const, document_id: snapshot.documentId, document_version: snapshot.version, findings,
  };
}
