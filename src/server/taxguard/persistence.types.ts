export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export const CANONICAL_STAGE_LABELS: Record<StageNumber, string> = {
  1: 'Client Onboarding & Identity',
  2: 'Document Intake & Extraction',
  3: 'Validation & Reconcile',
  4: 'Record & Classification',
  5: 'Reconcile Accounts & Balances',
  6: 'Professional Review',
  7: 'Financial & Tax Reporting',
  8: 'Strategic Tax Planning',
  9: 'Draft Return Preparation',
  10: 'Technical Quality Review',
  11: 'Client Approval & Authorizations',
  12: 'Electronic Filing & Submission',
  13: 'Filing Acknowledgement & Tracking',
  14: 'Government Feedback & Notice Review',
  15: 'Tax Resolution & Defense',
  16: 'Continuous Monitoring & Compliance',
  17: 'Engagement Archive & Data Custody',
  18: 'Client Retention & Renewal'
};

export const STAGE_NAMES = CANONICAL_STAGE_LABELS;

export type TaxCaseStatus = 'ACTIVE' | 'ON_HOLD' | 'IN_REVIEW' | 'COMPLETED' | 'FILED' | 'ARCHIVED';
export type StageStateStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'PENDING_REVIEW';
export type DocumentLifecycleStatus = 'UPLOADED' | 'QUEUED' | 'EXTRACTED' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';

export interface TaxCaseEntity {
  caseId: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  status: TaxCaseStatus;
  activeStage: StageNumber;
  createdAt: string;
  updatedAt: string;
  assignedPreparerId?: string;
  assignedReviewerId?: string;
  version: number;
}

export interface StageStateEntity {
  stageId: string;
  caseId: string;
  stageNumber: StageNumber;
  status: StageStateStatus;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface ExtractedFieldProvenance {
  confidence: number;
  sourceBoundingBox?: any;
  method: 'AI' | 'OCR' | 'MANUAL';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ExtractedFieldEntity {
  fieldId: string;
  documentId: string;
  key: string;
  value: string;
  provenance: ExtractedFieldProvenance;
  status: 'PENDING' | 'ACCEPTED' | 'CORRECTED' | 'REJECTED';
}

export interface DocumentEntity {
  documentId: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentLifecycleStatus;
  storagePath: string;
  sha256?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceEntity {
  evidenceId: string;
  caseId: string;
  stageNumber: StageNumber;
  type: string;
  data: Record<string, any>;
  createdAt: string;
}

export type TaxRecordCategory = 'INCOME' | 'DEDUCTION' | 'CREDIT' | 'PAYMENT' | 'ASSET';

export interface TaxRecordEntity {
  recordId: string;
  caseId: string;
  category: TaxRecordCategory;
  description: string;
  amountCents: number;
  verified: boolean;
  metadata?: Record<string, any>;
}

export type ReconciliationCategory = 'BANK' | 'CREDIT_CARD' | 'PAYROLL' | 'BOOK_TO_TAX';
export type ReconciliationStatus = 'UNRECONCILED' | 'IN_PROGRESS' | 'RECONCILED' | 'EXCEPTION';

export interface ReconciliationRecordEntity {
  reconciliationId: string;
  caseId: string;
  category: ReconciliationCategory;
  status: ReconciliationStatus;
  varianceCents: number;
  updatedAt: string;
}

export interface TaxWorkpaperEntity {
  workpaperId: string;
  caseId: string;
  title: string;
  status: string;
  preparedBy: string;
  reviewedBy?: string;
  sections: any[];
  updatedAt: string;
}

export type ReviewActionType = 'CLAIM' | 'ACCEPT' | 'CORRECT' | 'REJECT' | 'RECLASSIFY' | 'DUPLICATE' | 'SUPERSEDE' | 'REQUEST';

export type ReportType = 'TAX_SUMMARY' | 'SCHEDULE_K1' | 'BALANCE_SHEET' | 'PROFIT_LOSS';

export interface TaxReportEntity {
  reportId: string;
  caseId: string;
  reportType: ReportType;
  generatedAt: string;
  data: Record<string, any>;
}

export interface PlanningScenarioEntity {
  scenarioId: string;
  caseId: string;
  name: string;
  taxYear: number;
  projections: Record<string, any>;
}

export interface ReturnDiagnostic {
  code: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
}

export interface DraftReturnEntity {
  returnId: string;
  caseId: string;
  formType: string;
  taxYear: number;
  diagnostics: ReturnDiagnostic[];
  status: 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED';
}

export interface ApprovalRecord {
  approvalId: string;
  caseId: string;
  approvedBy: string;
  role: string;
  approvedAt: string;
  hash: string;
}

export interface SignatureEvent {
  eventId: string;
  signerEmail: string;
  signerName: string;
  timestamp: string;
  ipAddress: string;
}

export interface SignaturePackageEntity {
  packageId: string;
  caseId: string;
  status: 'SENT' | 'SIGNED' | 'DECLINED';
  events: SignatureEvent[];
}

export interface FilingAttempt {
  attemptId: string;
  timestamp: string;
  status: 'QUEUED' | 'TRANSMITTED' | 'ACCEPTED' | 'REJECTED';
  transmissionId?: string;
}

export interface FilingAcknowledgement {
  acknowledgementId: string;
  submissionId: string;
  acceptedAt: string;
  irsAcceptanceCode?: string;
}

export interface FilingPackageEntity {
  filingId: string;
  caseId: string;
  status: 'READY' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  attempts: FilingAttempt[];
  acknowledgement?: FilingAcknowledgement;
}

export interface GovernmentNotice {
  noticeId: string;
  agency: string;
  noticeCode: string;
  receivedDate: string;
  responseDueDate: string;
  status: string;
}

export interface GovernmentFeedbackEntity {
  feedbackId: string;
  caseId: string;
  notices: GovernmentNotice[];
}

export interface ResolutionIssue {
  issueId: string;
  title: string;
  amountInDisputeCents: number;
  status: string;
}

export interface ResolutionCaseEntity {
  resolutionId: string;
  caseId: string;
  issues: ResolutionIssue[];
  status: string;
}

export interface MonitoringItemEntity {
  monitoringId: string;
  caseId: string;
  checkType: string;
  lastCheckedAt: string;
  status: 'PASS' | 'FLAG';
}

export interface ArchiveManifestEntity {
  archiveId: string;
  caseId: string;
  archivedAt: string;
  documentCount: number;
  sha256Digest: string;
}

export type CarryForwardClassification = 'DEPRECIATION' | 'LOSS_CARRYOVER' | 'CREDIT_CARRYFORWARD' | 'PASSIVE_ACTIVITY';

export interface CarryForwardCandidate {
  id: string;
  classification: CarryForwardClassification;
  amountCents: number;
  sourceTaxYear: number;
}

export interface RenewalRecordEntity {
  renewalId: string;
  clientId: string;
  targetTaxYear: number;
  engagementProposed: boolean;
}

export interface RepeatCaseEntity {
  repeatId: string;
  previousCaseId: string;
  newTaxYear: number;
  status: string;
}

export interface ProviderReadinessInfo {
  provider: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
  latencyMs?: number;
  message?: string;
}
