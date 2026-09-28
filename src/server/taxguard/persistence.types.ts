/**
 * TaxGuard M18.4 - M18.6 Canonical Persistence and Stage Engine Types
 * Server-authoritative entity interfaces and enumerations.
 */

export type TaxGuardRole =
  | 'client'
  | 'accountant'
  | 'reviewer'
  | 'senior_reviewer'
  | 'administrator'
  | 'cpa';

export type TaxCaseStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'BLOCKED'
  | 'IN_REVIEW'
  | 'READY'
  | 'APPROVED'
  | 'FILED'
  | 'RESOLVED'
  | 'ARCHIVED';

export type StageNumber =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export const STAGE_NAMES: Record<StageNumber, string> = {
  1: 'ONBOARD',
  2: 'COLLECT',
  3: 'VALIDATE',
  4: 'RECORD',
  5: 'RECONCILE',
  6: 'REVIEW',
  7: 'REPORT',
  8: 'PLAN',
  9: 'PREPARE_TAXES',
  10: 'APPROVE',
  11: 'SIGN',
  12: 'FILE',
  13: 'GOVERNMENT_FEEDBACK',
  14: 'RESOLVE',
  15: 'MONITOR',
  16: 'ARCHIVE',
  17: 'RENEW',
  18: 'REPEAT',
};

export const STAGE_TITLES: Record<StageNumber, string> = {
  1: '01 Onboard',
  2: '02 Collect',
  3: '03 Validate',
  4: '04 Record',
  5: '05 Reconcile',
  6: '06 Review',
  7: '07 Report',
  8: '08 Plan',
  9: '09 Prepare Taxes',
  10: '10 Approve',
  11: '11 Sign',
  12: '12 File',
  13: '13 Government Feedback',
  14: '14 Resolve',
  15: '15 Monitor',
  16: '16 Archive',
  17: '17 Renew',
  18: '18 Repeat',
};

export type StageStateStatus =
  | 'LOCKED'
  | 'AVAILABLE'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'NEEDS_REVIEW'
  | 'READY'
  | 'COMPLETE'
  | 'INVALIDATED';

export type DocumentLifecycleStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'QUARANTINED'
  | 'SCANNING'
  | 'REJECTED'
  | 'RELEASED'
  | 'OCR_PENDING'
  | 'OCR_COMPLETE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'VERIFIED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

export type OcrJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CORRECTED';

export type ProviderType =
  | 'DATABASE'
  | 'DOCUMENT_STORAGE'
  | 'MALWARE_SCANNER'
  | 'OCR'
  | 'AI';

export type ProviderReadinessStatus =
  | 'CONFIGURED'
  | 'DEGRADED'
  | 'NOT_CONFIGURED'
  | 'DISABLED';

export interface ProviderReadinessInfo {
  provider: ProviderType;
  status: ProviderReadinessStatus;
  description: string;
  isOperational: boolean;
  lastChecked: string;
}

/** Base interface for applicable scoped authoritative entities */
export interface ScopedAuthoritativeEntity {
  id: string;
  tenantId: string;
  clientId: string;
  engagementId: string;
  caseId: string;
  taxYear: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface TenantEntity {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface UserEntity {
  id: string;
  tenantId: string;
  email: string;
  role: TaxGuardRole;
  status: 'active' | 'suspended';
  credentialVerified?: boolean;
  credentialType?: 'CPA' | 'EA' | 'ATTORNEY';
  credentialExpiresAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface ClientEntity {
  id: string;
  tenantId: string;
  name: string;
  ownerUid: string;
  status: 'active' | 'inactive';
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface EngagementEntity {
  id: string;
  tenantId: string;
  clientId: string;
  name: string;
  taxYears: number[];
  status: 'active' | 'closed';
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface TaxCaseEntity extends ScopedAuthoritativeEntity {
  status: TaxCaseStatus;
  activeStage: StageNumber;
  clientUid: string;
  preparerUid: string;
  reviewerUid: string;
  openExceptions: number;
  externalSubmissionEnabled: false;
  notes?: string;
}

export interface StageStateEntity extends ScopedAuthoritativeEntity {
  stage: StageNumber;
  stageName: string;
  status: StageStateStatus;
  requirementsMet: boolean;
  evaluatedAt?: string;
  evaluatedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  blockedReason?: string;
  invalidatedReason?: string;
  invalidatedBy?: string;
  invalidatedAt?: string;
  gateResult?: Record<string, unknown>;
}

export interface DocumentEntity extends ScopedAuthoritativeEntity {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  sha256: string;
  status: DocumentLifecycleStatus;
  quarantineReason?: string;
  scanResult?: {
    clean: boolean;
    scanner: string;
    scannerVersion: string;
    scannedAt: string;
    details?: string;
  };
  releaseApprovedBy?: string;
  releaseApprovedAt?: string;
  ocrJobId?: string;
}

export interface EvidenceEntity extends ScopedAuthoritativeEntity {
  evidencePackageId: string;
  sourceSha256: string;
  sourceDocumentIds: string[];
  status: 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';
  requiresHumanReview: true;
  preparedBy: string;
  evidencePackage: Record<string, unknown>;
}

export interface ExtractedFieldProvenance {
  tenantId: string;
  caseId: string;
  documentId: string;
  page?: number;
  source: string;
  provider: string;
  providerVersion: string;
  proposal: unknown;
  confidence: number;
  recordVersion: number;
  humanDecision?: 'ACCEPTED' | 'REJECTED' | 'CORRECTED';
  reviewer?: string;
  reviewTimestamp?: string;
}

export interface ExtractedFieldEntity extends ScopedAuthoritativeEntity {
  documentId: string;
  page: number;
  field: string;
  proposedValue: unknown;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  sourceText?: string;
  provider: string;
  providerVersion: string;
  isAiProposedOnly: true;
  humanDecision?: 'ACCEPTED' | 'REJECTED' | 'CORRECTED';
  finalAcceptedValue?: unknown;
  reviewer?: string;
  reviewerRole?: string;
  reviewTimestamp?: string;
  reviewReason?: string;
  provenance: ExtractedFieldProvenance;
}

export interface ValidationEntity extends ScopedAuthoritativeEntity {
  stage: StageNumber;
  ruleId: string;
  passed: boolean;
  details?: string;
  evidenceId?: string;
}

export interface ExceptionEntity extends ScopedAuthoritativeEntity {
  code: string;
  status: 'OPEN' | 'RESOLVED';
  openedBy: string;
  openedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface ReviewEntity extends ScopedAuthoritativeEntity {
  evidenceId?: string;
  documentId?: string;
  stage?: StageNumber;
  reviewer: string;
  reviewerRole: string;
  outcome: 'APPROVED' | 'CHANGES_REQUIRED';
  notes?: string;
}

export interface ApprovalEntity extends ScopedAuthoritativeEntity {
  stage?: StageNumber;
  evidenceId?: string;
  approvedBy: string;
  credentialType: string;
  notes?: string;
}

export interface AuditEventEntity {
  id: string;
  tenantId: string;
  clientId: string;
  engagementId: string;
  caseId: string;
  taxYear: number;
  action: string;
  actorUid: string;
  actorRole: string;
  details?: string;
  metadata?: Record<string, unknown>;
  version: number;
  timestamp: string;
}
