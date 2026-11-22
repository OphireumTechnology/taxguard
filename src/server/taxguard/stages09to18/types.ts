/**
 * TaxGuard AI — Stages 09–18 Canonical Domain Types, Error Codes, and Governance Contracts
 * Workflow Authority: LEGACY_18_V1 (Stages 01–18 immutable sequence)
 */

import type { StageNumber } from '../persistence.types';

export type Stage09To18Number = 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export const STAGE_09_18_PLANNING_WEIGHTS: Record<Stage09To18Number, number> = {
  9: 25,
  10: 12,
  11: 8,
  12: 12,
  13: 8,
  14: 10,
  15: 8,
  16: 7,
  17: 5,
  18: 5,
};

/** Exact Section 18 Provider Commissioning Status Vocabulary */
export type CommissioningStatus =
  | 'NOT_IMPLEMENTED'
  | 'IMPLEMENTED_UNVERIFIED'
  | 'SANDBOX_CONFIGURED'
  | 'SANDBOX_VERIFIED'
  | 'STAGING_VERIFIED'
  | 'PRODUCTION_AUTHORIZED'
  | 'PRODUCTION_VERIFIED'
  | 'BLOCKED'
  | 'DISABLED';

export type ExternalProviderKey =
  | 'E_SIGNATURE_PROVIDER'
  | 'E_FILE_TRANSMITTER'
  | 'GOVERNMENT_TRANSCRIPT_PROVIDER'
  | 'EMAIL_SMS_NOTIFICATION_PROVIDER'
  | 'ARCHIVE_WORM_STORAGE'
  | 'AI_ADVISORY_GATEWAY';

export interface ProviderCommissioningRecord {
  providerKey: ExternalProviderKey;
  displayName: string;
  status: CommissioningStatus;
  liveExecutionPermitted: boolean;
  blockingCode: string | null;
  requiredPreconditions: string[];
  checkedAt: string;
}

/** Explicit Stage-Level Scope Context — mandatory on every operation */
export interface ScopedCaseContext {
  tenantId: string;
  clientId: string;
  engagementId: string;
  caseId: string;
  taxYear: number;
}

export type GovernanceRole =
  | 'client'
  | 'prospective_client'
  | 'preparer'
  | 'accountant'
  | 'bookkeeper'
  | 'reviewer'
  | 'senior_reviewer'
  | 'approver'
  | 'practice_manager'
  | 'admin'
  | 'administrator'
  | 'super_admin'
  | 'super_administrator'
  | 'recruiter'
  | 'operations';

export interface ActorSessionContext {
  userId: string;
  email: string;
  name: string;
  role: GovernanceRole;
  tenantId: string;
  clientId?: string;
  assignedClientIds?: string[];
  mfaAssuranceLevel: 'aal1' | 'aal2';
  sessionExpiresAt: number;
  accountStatus: 'active' | 'suspended' | 'disabled';
  credentialVerified?: boolean;
  credentialType?: 'CPA' | 'EA' | 'ATTORNEY';
}

export class TaxGuardStageError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaxGuardStageError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ImmutableAuditEntry {
  auditId: string;
  correlationId: string;
  timestamp: string;
  stage: StageNumber;
  action: string;
  actorId: string;
  actorRole: GovernanceRole;
  scope: ScopedCaseContext;
  outcome: 'ALLOWED' | 'BLOCKED' | 'FAILED';
  code: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// STAGE 09 — PREPARE TAXES CONTRACTS
// ============================================================================

export type LegalEntityStructure =
  | 'INDIVIDUAL'
  | 'SINGLE_MEMBER_LLC'
  | 'MULTI_MEMBER_LLC'
  | 'CORPORATION'
  | 'TRUST'
  | 'ESTATE'
  | 'NONPROFIT'
  | 'PARTNERSHIP_GENERAL'
  | 'PARTNERSHIP_LIMITED';

export type FederalTaxClassification =
  | 'INDIVIDUAL_1040'
  | 'DISREGARDED_ENTITY'
  | 'PARTNERSHIP_1065'
  | 'C_CORP_1120'
  | 'S_CORP_1120S'
  | 'FIDUCIARY_1041'
  | 'EXEMPT_990';

export type FilingStatus =
  | 'SINGLE'
  | 'MARRIED_FILING_JOINTLY'
  | 'MARRIED_FILING_SEPARATELY'
  | 'HEAD_OF_HOUSEHOLD'
  | 'QUALIFYING_SURVIVING_SPOUSE'
  | 'ENTITY';

export interface TaxpayerProfileRecord {
  id: string;
  scope: ScopedCaseContext;
  legalEntityStructure: LegalEntityStructure;
  federalTaxClassification: FederalTaxClassification;
  filingStatus: FilingStatus;
  primaryJurisdictionCode: string;
  additionalJurisdictions: string[];
  dependentsCount: number;
  priorYearCaseId?: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export type FormSupportStatus =
  | 'SUPPORTED_RULE_APPROVED'
  | 'PROTOTYPE_UNAPPROVED'
  | 'PENDING_RULE_APPROVAL'
  | 'NOT_SUPPORTED';

export interface FormRegistryEntry {
  formCode: string;
  formTitle: string;
  jurisdiction: 'FEDERAL' | 'STATE';
  jurisdictionCode: string;
  entityClassifications: FederalTaxClassification[];
  taxYear: number;
  revisionTag: string;
  supportStatus: FormSupportStatus;
  approvedRulePackId: string | null;
  blockingReason?: string;
}

export interface TaxBracketRule {
  upTo: string | null; // null = infinity
  rate: string; // e.g. "0.1000"
}

export interface TaxRulePackRecord {
  rulePackId: string;
  formCode: string;
  jurisdiction: 'FEDERAL' | 'STATE';
  jurisdictionCode: string;
  taxYear: number;
  version: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
  sourceCitation: string;
  standardDeductions: Partial<Record<FilingStatus, string>>;
  brackets: Partial<Record<FilingStatus, TaxBracketRule[]>>;
  selfEmploymentRate: string;
  selfEmploymentNetEarningsFactor: string;
  qbiDeductionRate: string;
  preparedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  contentSha256: string;
}

export interface SourceEvidenceRecord {
  evidenceId: string;
  scope: ScopedCaseContext;
  sourceDocumentId: string;
  verifiedFactId: string;
  category:
    | 'W2_WAGES'
    | 'INTEREST_INCOME'
    | 'DIVIDEND_INCOME'
    | 'SCHEDULE_C_GROSS'
    | 'SCHEDULE_C_EXPENSES'
    | 'CAPITAL_GAIN_LOSS'
    | 'SCHEDULE_E_NET'
    | 'ADJUSTMENTS_TO_INCOME'
    | 'ITEMIZED_DEDUCTIONS'
    | 'TAX_CREDITS'
    | 'FEDERAL_WITHHOLDING'
    | 'ESTIMATED_PAYMENTS'
    | 'BOOK_TRIAL_BALANCE';
  description: string;
  amount: string; // exact decimal money string
  status: 'VERIFIED' | 'MISSING' | 'DISPUTED' | 'SUPERSEDED';
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface BookToTaxAdjustmentRecord {
  adjustmentId: string;
  scope: ScopedCaseContext;
  accountCode: string;
  accountName: string;
  taxLineCode: string;
  adjustmentType: 'PERMANENT' | 'TEMPORARY';
  scheduleType: 'M-1' | 'M-2' | 'BOOK_TO_TAX';
  description: string;
  amount: string;
  evidenceId: string;
  status: 'DRAFT' | 'APPROVED' | 'REJECTED';
  preparedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface BookToTaxReconciliationSummary {
  reconciliationId: string;
  scope: ScopedCaseContext;
  bookNetIncome: string;
  totalPermanentDifferences: string;
  totalTemporaryDifferences: string;
  reconciledTaxableIncome: string;
  reconciliationVariance: string;
  isReconciled: boolean;
  adjustments: BookToTaxAdjustmentRecord[];
  generatedAt: string;
}

export interface EvidenceLineageLink {
  lineageId: string;
  sourceDocumentId: string;
  verifiedFactId: string;
  approvedAdjustmentId: string | null;
  calculationRunId: string;
  formCode: string;
  formLineKey: string;
  amountImpact: string;
  evidenceStatus: SourceEvidenceRecord['status'];
  lineageSha256: string;
}

export interface TaxCalculationRunRecord {
  calculationRunId: string;
  scope: ScopedCaseContext;
  formCode: string;
  jurisdictionCode: string;
  rulePackId: string;
  rulePackVersion: number;
  filingStatus: FilingStatus;
  inputs: Record<string, string>;
  intermediates: Record<string, string>;
  outputs: {
    grossIncome: string;
    adjustedGrossIncome: string;
    deductionUsed: string;
    deductionMethod: 'STANDARD' | 'ITEMIZED';
    qbiDeduction: string;
    taxableIncome: string;
    regularIncomeTax: string;
    selfEmploymentTax: string;
    totalTaxBeforeCredits: string;
    totalCredits: string;
    totalTaxLiability: string;
    totalPayments: string;
    refundOrBalanceDue: string;
    isRefund: boolean;
  };
  calculationSha256: string;
  computedAt: string;
  computedBy: string;
  isAuthoritative: boolean;
}

export type ReturnVersionStatus =
  | 'DRAFT'
  | 'SUBMITTED_FOR_REVIEW'
  | 'APPROVED'
  | 'RETURNED_FOR_CORRECTION'
  | 'SUPERSEDED'
  | 'AMENDED_DRAFT';

export interface TaxReturnVersionRecord {
  returnVersionId: string;
  scope: ScopedCaseContext;
  versionNumber: number;
  optimisticVersion: number;
  formCode: string;
  jurisdictionCode: string;
  returnKind: 'ORIGINAL' | 'AMENDED';
  parentReturnVersionId: string | null;
  status: ReturnVersionStatus;
  calculationRunId: string;
  rulePackId: string;
  formFields: Array<{
    formCode: string;
    lineKey: string;
    label: string;
    value: string;
    lineageId: string;
  }>;
  lineage: EvidenceLineageLink[];
  contentSha256: string;
  preparedBy: string;
  preparedAt: string;
  submittedAt: string | null;
  materiallyModifiedAt: string | null;
  isImmutableHistorical: boolean;
}

// ============================================================================
// STAGE 10 — APPROVE CONTRACTS
// ============================================================================

export type QcCategory =
  | 'IDENTITY_AND_FILING_STATUS'
  | 'DOCUMENT_COMPLETENESS'
  | 'FINANCIAL_RECONCILIATION'
  | 'TAX_COMPUTATION_VERIFICATION'
  | 'REGULATORY_COMPLIANCE'
  | 'FORM_COMPLETENESS'
  | 'FINAL_RELEASE_READINESS';

export const ALL_QC_CATEGORIES: QcCategory[] = [
  'IDENTITY_AND_FILING_STATUS',
  'DOCUMENT_COMPLETENESS',
  'FINANCIAL_RECONCILIATION',
  'TAX_COMPUTATION_VERIFICATION',
  'REGULATORY_COMPLIANCE',
  'FORM_COMPLETENESS',
  'FINAL_RELEASE_READINESS',
];

export type RiskClassification = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Not assessed';

export interface ReviewFindingRecord {
  findingId: string;
  scope: ScopedCaseContext;
  returnVersionId: string;
  qcCategory: QcCategory;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL' | 'BLOCKING';
  description: string;
  status: 'OPEN' | 'ADDRESSED' | 'CLOSED';
  raisedBy: string;
  raisedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface QcGateCheck {
  category: QcCategory;
  passed: boolean;
  checkedBy: string;
  checkedAt: string;
  notes: string;
}

export interface ReturnApprovalRecord {
  approvalId: string;
  scope: ScopedCaseContext;
  returnVersionId: string;
  returnContentSha256: string;
  preparerId: string;
  independentReviewerId: string;
  qualifiedApproverId: string;
  releaseAuthorizerId: string | null;
  qcGates: QcGateCheck[];
  riskClassification: RiskClassification;
  riskJustification: string;
  decision: 'APPROVED' | 'RETURNED_FOR_CORRECTION' | 'INVALIDATED';
  invalidatedReason: string | null;
  invalidatedAt: string | null;
  mfaAssuranceLevel: 'aal2';
  decidedAt: string;
  notes: string;
}

// ============================================================================
// STAGE 11 — SIGN CONTRACTS
// ============================================================================

export type SignatureDocumentType =
  | 'ENGAGEMENT_AGREEMENT'
  | 'CONSENT_7216'
  | 'FORM_8879'
  | 'FORM_8879_PE'
  | 'FORM_8879_CORP'
  | 'FORM_8879_S'
  | 'FORM_8879_F'
  | 'FORM_8878'
  | 'ENTITY_AUTHORIZATION'
  | 'REPRESENTATION_AUTHORIZATION';

export interface SignatureEnvelopeRecord {
  envelopeId: string;
  scope: ScopedCaseContext;
  returnVersionId: string;
  returnContentSha256: string;
  approvalId: string;
  documentType: SignatureDocumentType;
  documentSha256: string;
  eSignatureEligible: boolean;
  ineligibilityReason: string | null;
  signerEmail: string;
  signerName: string;
  providerName: string;
  providerEnvelopeId: string | null;
  status:
    | 'DRAFT'
    | 'READY_FOR_DISPATCH'
    | 'BLOCKED_PROVIDER_UNCONFIGURED'
    | 'SENT'
    | 'SIGNED'
    | 'DECLINED'
    | 'EXPIRED'
    | 'REVOKED';
  expiresAt: string;
  signedAt: string | null;
  revokedAt: string | null;
  remindersSent: number;
  evidenceHash: string | null;
  createdBy: string;
  createdAt: string;
}

// ============================================================================
// STAGE 12 — FILE CONTRACTS
// ============================================================================

export type FilingLifecycleState =
  | 'NOT_READY'
  | 'READY_FOR_REVIEW'
  | 'AUTHORIZED_FOR_TRANSMISSION'
  | 'TRANSMISSION_PENDING'
  | 'TRANSMITTED'
  | 'ACKNOWLEDGMENT_PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'UNKNOWN_OUTCOME'
  | 'CORRECTION_REQUIRED'
  | 'CANCELLED';

export interface FilingReadinessCheck {
  checkCode: string;
  label: string;
  passed: boolean;
  blockingReason: string | null;
}

export interface FilingReadinessReport {
  ready: boolean;
  checks: FilingReadinessCheck[];
  evaluatedAt: string;
}

export interface FilingTransmissionRecord {
  filingId: string;
  scope: ScopedCaseContext;
  returnVersionId: string;
  returnContentSha256: string;
  signatureEnvelopeId: string;
  jurisdiction: 'FEDERAL' | 'STATE';
  jurisdictionCode: string;
  schemaVersion: string;
  idempotencyKey: string;
  lifecycleState: FilingLifecycleState;
  providerName: string;
  providerSubmissionId: string | null;
  autoRetryProhibited: boolean;
  authorizedBy: string;
  authorizedAt: string;
  transmittedAt: string | null;
  version: number;
}

// ============================================================================
// STAGE 13 — GOVERNMENT FEEDBACK CONTRACTS
// ============================================================================

export interface FilingAcknowledgmentRecord {
  ackId: string;
  externalAckId: string;
  scope: ScopedCaseContext;
  filingId: string;
  jurisdictionCode: string;
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  errorCodes: Array<{ code: string; category: string; message: string }>;
  payloadSha256: string;
  signatureVerified: boolean;
  receivedAt: string;
}

export interface GovernmentNoticeRecord {
  noticeId: string;
  scope: ScopedCaseContext;
  issuingAgency: string;
  noticeCode: string;
  noticeDate: string;
  responseDeadline: string | null;
  proposedAmount: string | null;
  sanitizedSummary: string;
  aiAdvisorySummary: string | null;
  aiIsAuthoritative: false;
  status: 'RECEIVED' | 'TRIAGED' | 'IN_RESOLUTION' | 'CLOSED';
  createdBy: string;
  createdAt: string;
}

export interface TranscriptRequestRecord {
  requestId: string;
  scope: ScopedCaseContext;
  transcriptType: 'ACCOUNT' | 'RETURN' | 'WAGE_AND_INCOME' | 'RECORD_OF_ACCOUNT';
  taxpayerConsentVerified: boolean;
  representationAuthorityId: string | null;
  providerStatus: CommissioningStatus;
  status: 'BLOCKED_PROVIDER_UNCOMMISSIONED' | 'BLOCKED_MISSING_CONSENT' | 'BLOCKED_MISSING_AUTHORITY';
  requestedBy: string;
  requestedAt: string;
}

// ============================================================================
// STAGE 14 — RESOLVE CONTRACTS
// ============================================================================

export type ResolutionLifecycleState =
  | 'OPEN'
  | 'TRIAGE'
  | 'INVESTIGATION'
  | 'EVIDENCE_COLLECTION'
  | 'PROPOSED_ACTION'
  | 'PROFESSIONAL_REVIEW'
  | 'AUTHORIZED_RESPONSE'
  | 'RESPONSE_PENDING'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'REOPENED'
  | 'CANCELLED';

export interface ResolutionCaseRecord {
  resolutionId: string;
  scope: ScopedCaseContext;
  originatingNoticeId: string | null;
  originatingAckId: string | null;
  lifecycleState: ResolutionLifecycleState;
  summary: string;
  assignedOwnerId: string;
  governmentConfirmationReceived: boolean;
  evidenceIds: string[];
  actions: Array<{
    actionId: string;
    fromState: ResolutionLifecycleState;
    toState: ResolutionLifecycleState;
    note: string;
    actorId: string;
    timestamp: string;
  }>;
  amendedReturnVersionId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnAmendmentRecord {
  amendmentId: string;
  scope: ScopedCaseContext;
  resolutionId: string | null;
  originalReturnVersionId: string;
  amendedReturnVersionId: string;
  amendmentFormCode: string;
  reasonForAmendment: string;
  netTaxDelta: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED';
  createdBy: string;
  createdAt: string;
}

// ============================================================================
// STAGE 15 — MONITOR CONTRACTS
// ============================================================================

export interface ComplianceObligationRecord {
  obligationId: string;
  scope: ScopedCaseContext;
  jurisdictionCode: string;
  obligationType:
    | 'ESTIMATED_TAX'
    | 'EXTENSION_DEADLINE'
    | 'NOTICE_RESPONSE'
    | 'AMENDED_FOLLOWUP'
    | 'ANNUAL_FILING'
    | 'RELIEF_DEADLINE';
  statutoryDueDate: string;
  adjustedDueDate: string;
  ruleBasis: string;
  holidayOrReliefApplied: string | null;
  projectedAmount: string | null;
  status: 'OPEN' | 'DUE_SOON' | 'OVERDUE' | 'ESCALATED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export interface NotificationOutboxRecord {
  notificationId: string;
  scope: ScopedCaseContext;
  idempotencyKey: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS';
  recipientRef: string;
  subject: string;
  deliveryStatus:
    | 'PENDING'
    | 'BLOCKED_PROVIDER_UNCOMMISSIONED'
    | 'RETRY_SCHEDULED'
    | 'DEAD_LETTER'
    | 'DELIVERED';
  attemptCount: number;
  maxAttempts: number;
  lastErrorCode: string | null;
  createdAt: string;
}

// ============================================================================
// STAGE 16 — ARCHIVE CONTRACTS
// ============================================================================

export interface RetentionPolicyRecord {
  policyId: string;
  tenantId: string;
  documentClass: string;
  jurisdictionCode: string;
  engagementType: string;
  retentionYears: number;
  policyAuthority: string;
}

export interface ArchivePackageRecord {
  archiveId: string;
  scope: ScopedCaseContext;
  retentionPolicyId: string;
  eligibleForDispositionDate: string;
  manifest: {
    returnVersionIds: string[];
    evidenceIds: string[];
    approvalIds: string[];
    signatureEnvelopeIds: string[];
    filingIds: string[];
    acknowledgmentIds: string[];
    noticeIds: string[];
    resolutionIds: string[];
    auditEventCount: number;
    auditDigestSha256: string;
  };
  integritySha256: string;
  status: 'SEALED' | 'UNDER_LEGAL_HOLD' | 'DISPOSED';
  sealedBy: string;
  sealedAt: string;
}

export interface LegalHoldRecord {
  holdId: string;
  scope: ScopedCaseContext;
  archiveId: string;
  reason: string;
  status: 'ACTIVE' | 'RELEASED';
  placedBy: string;
  placedAt: string;
  releasedBy: string | null;
  releasedAt: string | null;
  releaseNote: string | null;
}

// ============================================================================
// STAGE 17 — RENEW CONTRACTS
// ============================================================================

export interface EngagementRenewalRecord {
  renewalId: string;
  scope: ScopedCaseContext;
  priorTaxYear: number;
  nextTaxYear: number;
  proposedFee: string;
  scopeSummary: string;
  conflictCheckPassed: boolean;
  riskClassification: RiskClassification;
  agreementRenewed: boolean;
  consentRenewed: boolean;
  status: 'DRAFT' | 'PENDING_CLIENT' | 'READY_TO_ACTIVATE' | 'ACTIVATED' | 'DECLINED';
  activatedBy: string | null;
  activatedAt: string | null;
  createdBy: string;
  createdAt: string;
}

// ============================================================================
// STAGE 18 — REPEAT CONTRACTS
// ============================================================================

export type CarryforwardCategory =
  | 'CAPITAL_LOSS'
  | 'NOL'
  | 'PASSIVE_ACTIVITY_LOSS'
  | 'TAX_CREDIT'
  | 'DEPRECIATION_BASIS'
  | 'SHAREHOLDER_PARTNER_BASIS'
  | 'ESTIMATED_TAX_OVERPAYMENT'
  | 'RECURRING_ITEM';

export interface CarryforwardItemRecord {
  carryforwardId: string;
  scope: ScopedCaseContext;
  sourceTaxYear: number;
  targetTaxYear: number;
  category: CarryforwardCategory;
  description: string;
  amount: string;
  eligibilityRuleRef: string;
  reviewStatus: 'CANDIDATE' | 'REVIEWED_APPROVED' | 'REJECTED' | 'EXPIRED';
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface AnnualCycleGenerationRecord {
  generationId: string;
  tenantId: string;
  clientId: string;
  priorCaseId: string;
  priorTaxYear: number;
  newCaseId: string;
  newEngagementId: string;
  newTaxYear: number;
  renewalId: string;
  newCaseInitialStage: 1;
  approvedCarryforwardIds: string[];
  intelligenceFlags: Array<{
    code: 'POTENTIAL_NEW_ENTITY' | 'POTENTIAL_NEW_INCOME_SOURCE' | 'RECURRING_FILING_PATTERN';
    detail: string;
    advisoryOnly: true;
  }>;
  priorCaseMutated: false;
  generatedBy: string;
  generatedAt: string;
}

export interface StageReadinessItem {
  stage: Stage09To18Number;
  stageName: string;
  weightPercent: number;
  codeImplementationPercent: number;
  automatedTestVerified: boolean;
  productionStatus: 'BLOCKED_EXTERNAL_DEPENDENCY' | 'IMPLEMENTED_AWAITING_ACCEPTANCE';
  blockers: string[];
}

export interface Stages09To18ReadinessScorecard {
  workflowAuthority: 'LEGACY_18_V1';
  weightedCodeImplementationPercent: number;
  weightedProductionReadinessPercent: number;
  stagingDecision: 'NO-GO';
  productionDecision: 'NO-GO';
  stages: StageReadinessItem[];
  providers: ProviderCommissioningRecord[];
  evaluatedAt: string;
}
