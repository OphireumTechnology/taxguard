/**
 * A/R Tax Services, LLC — Stage Three Validation Engine
 * Unified 18-Stage Tax Operating Workflow — Milestone M3 / Stage 03: Validate
 *
 * Implements Sprint 1 Capabilities (Canonical TG-VAL Feature IDs):
 * - TG-VAL-001: Centralized Stage 03 Validation Workspace Context
 * - TG-VAL-002: Stage 02 -> Stage 03 Handoff Validator
 * - TG-VAL-003: Validation Source Registry with Immutable Provenance
 * - TG-VAL-004: Identity & Entity Consistency Engine
 * - TG-VAL-005: Tax-Year & Period Consistency Engine
 * - TG-VAL-006: Cross-Document Consistency Engine (Multi-Rule Reconciler)
 * - TG-VAL-007: Mathematical & Structural Validation Engine (Arithmetic & Balance Checks)
 * - TG-VAL-008: Authoritative Source Hierarchy & Conflict Arbitrator
 * - TG-VAL-009: Validation Conflict Engine & Multi-Source Reconciliation
 * - TG-VAL-010: Validation Exception Registry (Separate from Stage 02)
 * - TG-VAL-011: Operational Human Validation Review Queue & Maker-Checker
 * - TG-VAL-012: Validation Provenance Ledger & Audit Logging
 *
 * GOVERNANCE INVARIANT:
 * OCR and AI extraction results are proposed information only (isAiProposedOnly: true).
 * AI MUST NOT independently convert extracted information into "tax-verified" data.
 * Authoritative human review and source-linked provenance are mandatory.
 */

import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';
import {
  StageTwoCollectionService,
  ChecklistRequirement,
  StageTwoUploadedDocument
} from './stageTwoCollectionService';
import {
  StageTwoCollectionOperationsService,
  StageTwoExitGateRecord,
  SourceTieOutItem
} from './stageTwoCollectionOperationsService';
import {
  StageTwoDocumentIntelligenceService,
  DocumentIntelligenceRecord
} from './stageTwoDocumentIntelligenceService';

// ============================================================================
// CANONICAL FEATURE REGISTRY (STAGE 03: VALIDATE)
// ============================================================================

export const CANONICAL_STAGE_THREE_FEATURE_REGISTRY = {
  // Canonical Stage 03 Validation Architecture Registry (TG-VAL-001 through TG-VAL-012)
  'TG-VAL-001': 'Centralized Stage 03 Validation Workspace Context',
  'TG-VAL-002': 'Stage 02 -> Stage 03 Handoff Validator',
  'TG-VAL-003': 'Validation Source Registry with Immutable Provenance',
  'TG-VAL-004': 'Identity & Entity Consistency Engine',
  'TG-VAL-005': 'Tax-Year & Period Consistency Engine',
  'TG-VAL-006': 'Cross-Document Consistency Engine (Multi-Rule Reconciler)',
  'TG-VAL-007': 'Mathematical & Structural Validation Engine',
  'TG-VAL-008': 'Authoritative Source Hierarchy & Conflict Arbitrator',
  // Preserved Downstream Features
  'TG-VAL-009': 'Validation Conflict Engine & Multi-Source Reconciliation',
  'TG-VAL-010': 'Validation Exception Registry (Separate from Stage 02)',
  'TG-VAL-011': 'Operational Human Validation Review Queue & Maker-Checker',
  'TG-VAL-012': 'Validation Provenance Ledger & Audit Logging'
} as const;

// Granular Sub-Feature & Module Registry for Sprint 1, Sprint 2 and Sprint 3
export const STAGE_THREE_SUB_FEATURE_REGISTRY = {
  'TG-VAL-001': 'Stage 02 Certified Intake',
  'TG-VAL-002': 'Validation Source Registry',
  'TG-VAL-003': 'Source Integrity Verification',
  'TG-VAL-004': 'Taxpayer Identity Consistency',
  'TG-VAL-005': 'TIN/EIN Consistency',
  'TG-VAL-006': 'Tax-Year Consistency',
  'TG-VAL-007': 'Entity Classification Validation',
  'TG-VAL-008': 'Controlled Tax Form Validation',
  'TG-VAL-009': 'OCR-to-Source Provenance Validation',
  'TG-VAL-010': 'Extracted Field Validation',
  'TG-VAL-011': 'Confidence Threshold Engine',
  'TG-VAL-012': 'Cross-Document Consistency Engine',
  'TG-VAL-013': 'Mathematical & Structural Validation',
  'TG-VAL-014': 'Duplicate & Version Validation',
  'TG-VAL-015': 'Conflict Detection & Materiality Engine',
  'TG-VAL-016': 'Validation Exception Registry',
  'TG-VAL-017': 'Human Validation Review Queue',
  'TG-VAL-018': 'Reviewer Resolution Controls',
  'TG-VAL-019': 'Maker-Checker Enforcement',
  'TG-VAL-020': 'Validation Audit Trail',
  'TG-VAL-021': 'Validation Completeness Evaluator',
  'TG-VAL-022': 'Stage 03 Hard Exit Gate',
  'TG-VAL-023': 'CPA/EA Validation Certification',
  'TG-VAL-024': 'Upstream Invalidation & Gate Reopening',
  'TG-VAL-025': 'Downstream Revalidation Signal'
} as const;

// Dedicated Stage 03 Sprint 2 Registry (Document Intelligence & Exception Foundation)
export const STAGE_THREE_SPRINT_TWO_REGISTRY = {
  'TG-VAL-009': 'OCR-to-Source Provenance Validation',
  'TG-VAL-010': 'Extracted Field Validation',
  'TG-VAL-011': 'Confidence Threshold Engine',
  'TG-VAL-012': 'Cross-Document Consistency Engine',
  'TG-VAL-013': 'Mathematical & Structural Validation',
  'TG-VAL-014': 'Duplicate & Version Validation',
  'TG-VAL-015': 'Conflict Detection & Materiality Engine',
  'TG-VAL-016': 'Validation Exception Registry'
} as const;

// Dedicated Stage 03 Sprint 3 Registry (Human Review, Maker-Checker, Certification, Exit Gate & Revalidation)
export const STAGE_THREE_SPRINT_THREE_REGISTRY = {
  'TG-VAL-017': 'Human Validation Review Queue',
  'TG-VAL-018': 'Reviewer Resolution Controls',
  'TG-VAL-019': 'Maker-Checker Enforcement',
  'TG-VAL-020': 'Validation Audit Trail',
  'TG-VAL-021': 'Validation Completeness Evaluator',
  'TG-VAL-022': 'Stage 03 Hard Exit Gate',
  'TG-VAL-023': 'CPA/EA Validation Certification',
  'TG-VAL-024': 'Upstream Invalidation & Gate Reopening',
  'TG-VAL-025': 'Downstream Revalidation Signal'
} as const;

export const STAGE_THREE_CANONICAL_25_REGISTRY = STAGE_THREE_SUB_FEATURE_REGISTRY;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AuthoritativeSourceTier =
  | 'AUTHORITATIVE'      // IRS transcripts, official notices, audited financials, issuer W-2/1099
  | 'SUPPORTING'         // General ledger, payroll journals, bank confirmations, broker 1099-B statements
  | 'DERIVED'            // Workpapers, computed tax schedules, trial balance reconciliations
  | 'CLIENT_REPORTED'    // Questionnaires, uncertified spreadsheets, client portal remarks
  | 'AI_EXTRACTED'       // Raw OCR / LLM suggestions before accountant confirmation
  | 'UNVERIFIED';        // Raw uploaded data pending verification

export type ValidationStatus =
  | 'UNVALIDATED'
  | 'VALIDATED'
  | 'CONFLICT'
  | 'STALE'
  | 'REVALIDATION_REQUIRED';

export interface ValidationSourceRecord {
  validationSourceId: string;
  documentId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  collectionVersion: number;
  documentVersion: number;
  documentCategory: string;
  originalFilename: string;
  sourceHash: string;
  OCRArtifactId: string;
  extractionArtifactId: string;
  pageNumber: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fieldName: string;
  rawExtractedValue: string | number;
  normalizedValue: string | number;
  sourceTier: AuthoritativeSourceTier;
  isAuthoritative?: boolean;
  AIConfidence: number | null;
  isAiProposedOnly: boolean;
  humanReviewStatus: 'UNREVIEWED' | 'REVIEWED_APPROVED' | 'HUMAN_CORRECTED' | 'REJECTED';
  validationStatus: ValidationStatus;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
}

// TG-VAL-003: Source Integrity Result
export interface SourceIntegrityResult {
  documentId: string;
  fileName: string;
  sha256Hash: string;
  isHashFormatValid: boolean;
  securityCheckStatus: string;
  processingStatus: string;
  isQuarantined: boolean;
  integrityStatus: 'VERIFIED' | 'TAMPERED_OR_INVALID' | 'QUARANTINED' | 'UNPROCESSED';
  details: string;
}

// TG-VAL-004: Taxpayer Identity Finding
export interface TaxpayerIdentityFinding {
  findingId: string;
  documentId: string;
  documentName: string;
  fieldName: string;
  profileLegalName: string;
  observedName: string;
  matchResult: 'EXACT_MATCH' | 'PARTIAL_MATCH' | 'MISMATCH';
  isBlocking: boolean;
  details: string;
}

// TG-VAL-005: TIN/EIN Validation Finding
export interface TinEinValidationFinding {
  findingId: string;
  documentId: string;
  documentName: string;
  fieldName: string;
  tinType: 'SSN' | 'EIN' | 'ITIN' | 'UNKNOWN';
  profileTin: string;
  observedTin: string;
  maskedObservedTin: string;
  isFormatValid: boolean;
  matchResult: 'EXACT_MATCH' | 'MISMATCH' | 'INVALID_FORMAT';
  isBlocking: boolean;
  details: string;
}

// TG-VAL-006: Tax-Year Consistency Finding
export interface TaxYearConsistencyFinding {
  findingId: string;
  documentId: string;
  documentName: string;
  expectedTaxYear: number;
  observedTaxYear: number;
  periodType: 'ANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'FISCAL';
  isCorrectTaxYear: boolean;
  isCorrectedForm: boolean;
  isPriorYear: boolean;
  details: string;
  isBlocking: boolean;
}

// TG-VAL-007: Entity Classification Finding
export interface EntityClassificationFinding {
  findingId: string;
  documentId: string;
  documentName: string;
  documentCategory: string;
  clientEntityClassification: string;
  compatibilityStatus: 'COMPATIBLE' | 'INCOMPATIBLE' | 'REQUIRES_EXPLANATION';
  isBlocking: boolean;
  details: string;
}

// TG-VAL-008: Controlled Tax Form Validation Result
export interface ControlledTaxFormValidationResult {
  validationId: string;
  documentId: string;
  documentName: string;
  formType: string;
  status: 'VALID' | 'MISSING_MANDATORY_FIELDS' | 'INVALID_STRUCTURE';
  mandatoryFieldsEvaluated: Array<{
    fieldName: string;
    label: string;
    isPresent: boolean;
    value: any;
  }>;
  missingFields: string[];
  isBlocking: boolean;
  details: string;
}

export type IdentityFindingType =
  | 'MATCH'
  | 'PARTIAL_MATCH'
  | 'MISMATCH'
  | 'MISSING_SOURCE'
  | 'REQUIRES_REVIEW';

export interface IdentityEntityValidationFinding {
  findingId: string;
  field: string;
  label: string;
  profileValue: string;
  observedValue: string;
  maskedObservedValue: string;
  sourceDocumentId: string;
  sourceDocumentName: string;
  result: IdentityFindingType;
  details: string;
  isBlocking: boolean;
}

export interface PeriodConsistencyFinding {
  findingId: string;
  documentId: string;
  documentName: string;
  expectedTaxYear: number;
  observedTaxYear: number;
  periodType: 'ANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'FISCAL';
  periodIdentifier: string;
  isCorrectTaxYear: boolean;
  isCorrectedForm: boolean;
  isPriorYear: boolean;
  details: string;
  isBlocking: boolean;
}

export interface CrossDocumentRule {
  ruleId: string;
  ruleName: string;
  ruleVersion: string;
  sourceTypes: string[];
  comparisonMethod: 'EXACT_MATCH' | 'TOLERANCE_MATCH' | 'RECONCILIATION_SUM' | 'BOUNDS_CHECK';
  materialityThreshold: number;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  result: 'PASS' | 'FAIL' | 'WARNING' | 'INSUFFICIENT_EVIDENCE';
  expectedValue: number | string | null;
  observedValue: number | string | null;
  variance: number | null;
  sourceReferences: Array<{
    sourceId: string;
    documentId: string;
    documentName: string;
    fieldName: string;
    value: any;
  }>;
  requiresHumanReview: boolean;
  blockingStatus: boolean;
  narrative: string;
}

export interface MathematicalValidationResult {
  calculationId: string;
  calculationName: string;
  relationshipType:
    | 'SUBTOTAL_RECONCILIATION'
    | 'GROSS_DEDUCTION_NET'
    | 'QUARTERLY_ANNUAL_SUM'
    | 'DEBIT_CREDIT_BALANCE'
    | 'ROLLFORWARD_BALANCE'
    | 'CONTROL_TOTAL';
  status: 'VALID' | 'VARIANCE_DETECTED' | 'INSUFFICIENT_EVIDENCE';
  computedValue: number | null;
  statedValue: number | null;
  variance: number | null;
  tolerance: number;
  componentInputs: Array<{
    label: string;
    value: number | null;
    sourceId?: string;
  }>;
  isFabricated: boolean; // Must always be false; no fabricated data
  notes: string;
}

export type ConflictCategory =
  | 'IDENTITY_MISMATCH'
  | 'TIN_MISMATCH'
  | 'TAX_YEAR_MISMATCH'
  | 'ENTITY_TYPE_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'WITHHOLDING_MISMATCH'
  | 'SOURCE_CONFLICT'
  | 'PERIOD_MISMATCH'
  | 'MATHEMATICAL_VARIANCE'
  | 'DUPLICATE_SOURCE'
  | 'SUPERSEDED_SOURCE'
  | 'INSUFFICIENT_EVIDENCE';

export interface ValidationConflict {
  conflictId: string;
  clientId: string;
  taxYear: number;
  conflictCategory: ConflictCategory;
  affectedField: string;
  sourceA: {
    sourceId: string;
    documentId: string;
    documentName: string;
    value: any;
    sourceTier: AuthoritativeSourceTier;
  };
  sourceB: {
    sourceId: string;
    documentId: string;
    documentName: string;
    value: any;
    sourceTier: AuthoritativeSourceTier;
  };
  observedValues: string;
  variance: number | string;
  materiality: 'MATERIAL' | 'IMMATERIAL';
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blockingStatus: boolean;
  createdTimestamp: string;
  assignedReviewer: string;
  resolutionStatus: 'UNRESOLVED' | 'RESOLVED' | 'WAIVED' | 'ESCALATED';
  resolutionRationale?: string;
  resolvedBy?: string;
  resolvedTimestamp?: string;
}

export type ValidationExceptionStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'UNDER_REVIEW'
  | 'AWAITING_CLIENT'
  | 'AWAITING_PREPARER'
  | 'AWAITING_REVIEWER'
  | 'RESOLVED'
  | 'WAIVED'
  | 'REOPENED';

export interface ValidationException {
  exceptionId: string;
  clientId: string;
  engagementId?: string;
  taxYear: number;
  category: string;
  title: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  materiality?: 'MATERIAL' | 'IMMATERIAL';
  status: ValidationExceptionStatus;
  isBlocking: boolean;
  sourceReferences?: string[];
  validationRule?: string;
  assignedRole?: string;
  relatedSourceId?: string;
  relatedDocumentId?: string;
  relatedConflictId?: string;
  createdTimestamp: string;
  createdBy: string;
  assignedTo: string;
  resolutionTimestamp?: string;
  resolutionRationale?: string;
  auditReferences?: string[];
  resolution?: {
    resolvedAt: string;
    resolvedBy: string;
    resolvedByRole: string;
    resolutionAction: string;
    justification: string;
    correctedValue?: any;
  };
}

// TG-VAL-009: OCR-to-Source Provenance Result
export interface OcrSourceProvenanceResult {
  validationSourceId: string;
  documentId: string;
  originalFilename: string;
  hasSha256Hash: boolean;
  sha256HashValid: boolean;
  documentVersion: number;
  hasOcrArtifact: boolean;
  ocrArtifactId: string;
  pageNumber: number;
  hasBoundingBox: boolean;
  hasExtractionArtifact: boolean;
  extractionArtifactId: string;
  fieldName: string;
  lineageStatus: 'VERIFIED' | 'MISSING_PROVENANCE' | 'INVALID_RELATIONSHIP' | 'QUARANTINED_OR_REJECTED';
  isBlocking: boolean;
  details: string;
}

// TG-VAL-010: Extracted Field Validation Result
export interface ExtractedFieldValidationResult {
  validationId: string;
  sourceId: string;
  documentId: string;
  fieldName: string;
  rawExtractedValue: string | number;
  normalizedValue: string | number;
  expectedDatatype: 'currency' | 'number' | 'string' | 'date' | 'tin' | 'ein' | 'ssn';
  isValidFormat: boolean;
  conventionCheck: 'PASSED' | 'UNEXPECTED_NEGATIVE' | 'MALFORMED' | 'OUT_OF_BOUNDS';
  ruleApplied: string;
  confidence: number | null;
  reviewStatus: 'UNREVIEWED' | 'REVIEWED_APPROVED' | 'HUMAN_CORRECTED' | 'REJECTED';
  isBlocking: boolean;
  details: string;
}

// TG-VAL-011: Confidence Threshold Types
export type ConfidenceTier = 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE' | 'MISSING_CONFIDENCE';

export interface ConfidenceThresholdConfig {
  highThreshold: number;       // default: 0.90
  reviewThreshold: number;     // default: 0.75
  lowBlockingThreshold: number; // default: 0.60
}

export interface ConfidenceEvaluationResult {
  sourceId: string;
  documentId: string;
  fieldName: string;
  rawConfidence: number | null;
  confidenceTier: ConfidenceTier;
  isMaterial: boolean;
  requiresHumanReview: boolean;
  isBlocking: boolean;
  thresholdApplied: {
    high: number;
    review: number;
    lowBlocking: number;
  };
  details: string;
}

// TG-VAL-014: Duplicate & Version Validation Result
export interface DuplicateVersionValidationResult {
  documentId: string;
  filename: string;
  sourceStatus: 'CURRENT' | 'DUPLICATE' | 'CORRECTED' | 'SUPERSEDED' | 'REPLACEMENT';
  versionNumber: number;
  isAuthoritativeActive: boolean;
  supersedesDocId?: string;
  supersededByDocId?: string;
  requiresRevalidation: boolean;
  isBlocking: boolean;
  exceptionCreated?: string;
  details: string;
}

// Authoritative Source Class Hierarchy & Governance
// Note: This hierarchy is an operational validation preference and default precedence rule,
// NOT a universal, immutable legal hierarchy for all scenarios. Contextual professional judgment
// by a licensed CPA/EA may adjust precedence. AI-extracted values are strictly provisional
// and must never outrank the underlying source document from which they were extracted.
export type AuthoritativeSourceClass =
  | 'GOVERNMENT_ISSUED_TAX_FORMS'
  | 'OFFICIAL_PAYROLL_FILINGS'
  | 'BANK_BROKER_STATEMENTS'
  | 'SIGNED_ENTITY_RECORDS'
  | 'ACCOUNTING_LEDGERS'
  | 'CLIENT_PROVIDED_SCHEDULES'
  | 'AI_EXTRACTED_VALUES';

export const AUTHORITATIVE_SOURCE_CLASS_HIERARCHY: Record<AuthoritativeSourceClass, { rank: number; score: number; description: string }> = {
  GOVERNMENT_ISSUED_TAX_FORMS: { rank: 1, score: 100, description: 'Official tax authority filings (W-2, 1099, K-1, 941, transcripts)' },
  OFFICIAL_PAYROLL_FILINGS: { rank: 2, score: 90, description: 'Certified payroll provider reports & filings' },
  BANK_BROKER_STATEMENTS: { rank: 3, score: 80, description: 'Third-party financial institution statements' },
  SIGNED_ENTITY_RECORDS: { rank: 4, score: 75, description: 'Signed legal entity resolutions and operating agreements' },
  ACCOUNTING_LEDGERS: { rank: 5, score: 65, description: 'Client general ledger journals & trial balances' },
  CLIENT_PROVIDED_SCHEDULES: { rank: 6, score: 40, description: 'Uncertified spreadsheets and questionnaire responses' },
  AI_EXTRACTED_VALUES: { rank: 7, score: 20, description: 'Raw AI OCR extractions pending professional review' }
};

// TG-VAL-017: Human Validation Review Queue Item
export interface HumanValidationQueueItem {
  queueItemId: string;
  reviewItemId?: string;
  tenantId?: string;
  clientId: string;
  engagementId?: string;
  taxYear: number;
  itemType:
    | 'CONFLICT'
    | 'LOW_CONFIDENCE'
    | 'IDENTITY_MISMATCH'
    | 'TAX_YEAR_MISMATCH'
    | 'MATHEMATICAL_VARIANCE'
    | 'INSUFFICIENT_EVIDENCE'
    | 'SUPERSEDED_SOURCE'
    | 'CONTROLLED_FORM_DEFECT'
    | 'PROVENANCE_FAILURE'
    | 'VERSION_CONFLICT'
    | 'BLOCKING_EXCEPTION';
  referenceId: string;
  sourceDocumentIds?: string[];
  validationRuleIds?: string[];
  exceptionIds?: string[];
  title: string;
  description: string;
  materiality?: 'IMMATERIAL' | 'MATERIAL' | 'ROUTINE' | 'HIGH_RISK' | 'CRITICAL';
  riskLevel?: 'routine' | 'material' | 'high_risk' | 'critical';
  blockingStatus?: boolean;
  assignedRole?: 'cpa' | 'ea' | 'tax_attorney' | 'reviewer' | 'accountant' | 'unassigned';
  assignedReviewer: string;
  preparerId?: string; // Maker/Preparer who created or modified this item (for maker-checker enforcement)
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status:
    | 'OPEN'
    | 'ASSIGNED'
    | 'IN_REVIEW'
    | 'NEEDS_CLIENT_INFORMATION'
    | 'NEEDS_PREPARER_CORRECTION'
    | 'READY_FOR_RESOLUTION'
    | 'RESOLVED'
    | 'WAIVED'
    | 'REOPENED'
    | 'PENDING_REVIEW'
    | 'ESCALATED';
  createdAt?: string;
  updatedAt?: string;
  resolutionAt?: string;
  resolutionRationale?: string;
  resolutionAction?: string;
  auditReferences?: string[];
  disposition?: {
    action:
      | 'ACCEPT_SOURCE'
      | 'ACCEPT_CORRECTION'
      | 'REJECT_SOURCE'
      | 'REQUEST_CORRECTION'
      | 'REQUEST_CLIENT_INFORMATION'
      | 'RESOLVE_CONFLICT'
      | 'WAIVE_EXCEPTION'
      | 'REOPEN_REVIEW'
      | 'CORRECT_VALUE'
      | 'REQUEST_EVIDENCE'
      | 'MARK_NOT_APPLICABLE'
      | 'ESCALATE';
    actor: string;
    actorRole: string;
    timestamp: string;
    justification: string;
    correctedValue?: any;
    isAiProposedOnly?: boolean;
  };
}

// TG-VAL-021: Completeness Evaluator Types
export interface ValidationCriterionResult {
  criterionId: string;
  description: string;
  status: 'PASSED' | 'FAILED' | 'NOT_APPLICABLE';
  isBlocking: boolean;
  details?: string;
}

export interface ValidationCompletenessEvaluation {
  readinessScore: number;
  criteriaResults: ValidationCriterionResult[];
  blockingReasons: string[];
  warnings: string[];
  openExceptions: ValidationException[];
  openReviewItems: HumanValidationQueueItem[];
  isReadyForCertification: boolean;
  isReadyForExit: boolean;
}

// TG-VAL-023: CPA/EA Validation Certification
export interface StageThreeCertificationRecord {
  certificationId: string;
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  reviewerId: string;
  reviewerRole: 'cpa' | 'ea' | 'tax_attorney' | 'reviewer';
  certificationTimestamp: string;
  validationStateVersion: number;
  sourceSetHash: string;
  exceptionSetHash: string;
  reviewSetHash: string;
  certificationStatement: string;
  auditReference: string;
  status: 'ACTIVE' | 'INVALIDATED_BY_UPSTREAM_CHANGE' | 'SUPERSEDED' | 'REVOKED';
  invalidatedAt?: string;
  invalidationReason?: string;
  isSimulatedCredential?: boolean;
}

// TG-VAL-022: Hard Exit Gate Types
export type StageThreeGateStatus =
  | 'NOT_EVALUATED'
  | 'BLOCKED'
  | 'AWAITING_PREPARER'
  | 'AWAITING_REVIEWER'
  | 'AWAITING_CLIENT'
  | 'READY_FOR_CERTIFICATION'
  | 'CLEARED'
  | 'REOPENED'
  | 'SUPERSEDED';

export interface StageThreeExitGateRecord {
  gateId: string;
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  gateStatus: StageThreeGateStatus;
  stageTwoExitRecordId: string;
  stageThreeValidationStateVersion: number;
  sourceSetHash: string;
  validationResultsSummary: {
    totalSources: number;
    validatedSources: number;
    openExceptionsCount: number;
    openReviewItemsCount: number;
    readinessScore: number;
  };
  exceptionStateHash: string;
  reviewStateHash: string;
  professionalCertificationId: string | null;
  certifiedBy: string | null;
  certifiedRole: string | null;
  certificationTimestamp: string | null;
  timestamp: string;
  correlationId: string;
  auditReference: string;
}

// TG-VAL-025: Downstream Revalidation Signal
export interface StageFourEligibilitySignal {
  signalId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  stageThreeGateVersion: number;
  status: 'STAGE_04_ELIGIBLE' | 'STAGE_04_BLOCKED' | 'REVALIDATION_REQUIRED';
  reason: string;
  affectedRecords: string[];
  timestamp: string;
  auditReference: string;
}

export interface ValidationProvenanceEntry {
  provenanceId: string;
  validationSourceId: string;
  documentId: string;
  documentVersion: number;
  pageNumber: number;
  fieldName: string;
  rawExtractedValue: any;
  confidence: number;
  isAiProposed: boolean;
  validatedValue: any;
  wasChanged: boolean;
  changedBy?: string;
  changeReason?: string;
  reviewedBy?: string;
  reviewTimestamp?: string;
  validatingRuleId: string;
  validationResult: string;
  correlationId: string;
  timestamp: string;
}

export interface StageThreeWorkspaceContext {
  clientId: string;
  engagementId: string;
  entityName: string;
  entityClassification: string;
  returnType: string;
  taxYear: number;
  federalJurisdiction: string;
  stateJurisdictions: string[];
  assignedPreparer: string;
  assignedReviewer: string;
  stageTwoGateId: string;
  stageTwoCollectionVersion: number;
  stageTwoClearanceTimestamp: string;
  validationStatus:
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'VALIDATED'
    | 'REVALIDATION_REQUIRED'
    | 'BLOCKED_BY_STAGE_02';
  openExceptionCount: number;
  blockingExceptionCount: number;
  validationReadinessPercentage: number;
  isHandoffVerified: boolean;
}

// Storage keys
const STORAGE_KEY_VAL_SOURCES = 'artax_stage3_sources_v1';
const STORAGE_KEY_VAL_CONFLICTS = 'artax_stage3_conflicts_v1';
const STORAGE_KEY_VAL_EXCEPTIONS = 'artax_stage3_exceptions_v1';
const STORAGE_KEY_VAL_QUEUE = 'artax_stage3_review_queue_v1';
const STORAGE_KEY_VAL_PROVENANCE = 'artax_stage3_provenance_v1';
const STORAGE_KEY_VAL_CERTS = 'artax_stage3_certifications_v1';
const STORAGE_KEY_VAL_GATE = 'artax_stage3_gate_v1';
const STORAGE_KEY_VAL_SIGNAL = 'artax_stage3_signal_v1';

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class StageThreeValidationService {
  private static sourcesStore: Map<string, ValidationSourceRecord[]> = new Map();
  private static conflictsStore: Map<string, ValidationConflict[]> = new Map();
  private static exceptionsStore: Map<string, ValidationException[]> = new Map();
  private static queueStore: Map<string, HumanValidationQueueItem[]> = new Map();
  private static provenanceStore: Map<string, ValidationProvenanceEntry[]> = new Map();
  private static certificationsStore: Map<string, StageThreeCertificationRecord[]> = new Map();
  private static exitGateStore: Map<string, StageThreeExitGateRecord> = new Map();
  private static downstreamSignalsStore: Map<string, StageFourEligibilitySignal> = new Map();
  private static confidenceConfig: ConfidenceThresholdConfig = {
    highThreshold: 0.90,
    reviewThreshold: 0.75,
    lowBlockingThreshold: 0.60
  };

  /**
   * Resets in-memory stores and localStorage for clean test isolation.
   */
  public static clearAll(): void {
    this.sourcesStore.clear();
    this.conflictsStore.clear();
    this.exceptionsStore.clear();
    this.queueStore.clear();
    this.provenanceStore.clear();
    this.certificationsStore.clear();
    this.exitGateStore.clear();
    this.downstreamSignalsStore.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_VAL_SOURCES);
      localStorage.removeItem(STORAGE_KEY_VAL_CONFLICTS);
      localStorage.removeItem(STORAGE_KEY_VAL_EXCEPTIONS);
      localStorage.removeItem(STORAGE_KEY_VAL_QUEUE);
      localStorage.removeItem(STORAGE_KEY_VAL_PROVENANCE);
      localStorage.removeItem(STORAGE_KEY_VAL_CERTS);
      localStorage.removeItem(STORAGE_KEY_VAL_GATE);
      localStorage.removeItem(STORAGE_KEY_VAL_SIGNAL);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('artax_stage3_')) {
          localStorage.removeItem(k);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // TG-VAL-002: STAGE 02 -> STAGE 03 HANDOFF VALIDATOR
  // --------------------------------------------------------------------------

  /**
   * Authoritative handoff validator.
   * Stage 03 can only begin if Stage 02 gate record confirms:
   * stageTwoStatus = COMPLETED
   * stageThreeStatus = ELIGIBLE
   * gateResult = CLEARED
   * Gate ID, Client ID, Engagement ID, Tax Year must match.
   */
  public static validateStageTwoHandoff(
    clientId: string,
    taxYear: number,
    engagementId?: string
  ): {
    isValid: boolean;
    gateRecord: StageTwoExitGateRecord | null;
    status: 'ELIGIBLE' | 'REVALIDATION_REQUIRED' | 'BLOCKED_BY_STAGE_02';
    reasons: string[];
  } {
    const reasons: string[] = [];

    // Tenant / Client isolation check
    if (!clientId || !clientId.trim()) {
      return {
        isValid: false,
        gateRecord: null,
        status: 'BLOCKED_BY_STAGE_02',
        reasons: ['Client ID must be provided for tenant-isolated validation.']
      };
    }

    const gate = StageTwoCollectionOperationsService.getExitGateStatus(clientId, taxYear);

    if (!gate) {
      return {
        isValid: false,
        gateRecord: null,
        status: 'BLOCKED_BY_STAGE_02',
        reasons: [`No certified Stage 02 Exit Gate record exists for client ${clientId}, tax year ${taxYear}.`]
      };
    }

    // Validate client match
    if (gate.clientId !== clientId) {
      reasons.push(`Gate client ID mismatch: Expected '${clientId}', got '${gate.clientId}'.`);
    }

    // Validate tax year match
    if (gate.taxYear !== taxYear) {
      reasons.push(`Gate tax year mismatch: Expected ${taxYear}, got ${gate.taxYear}.`);
    }

    // Validate engagement match if supplied
    if (engagementId && gate.engagementId !== engagementId) {
      reasons.push(`Gate engagement ID mismatch: Expected '${engagementId}', got '${gate.engagementId}'.`);
    }

    // Validate authoritative exit state
    if (gate.gateResult !== 'CLEARED') {
      reasons.push(`Stage 02 Exit Gate result is '${gate.gateResult}' (must be 'CLEARED').`);
    }

    if (gate.stageTwoStatus !== 'COMPLETED') {
      reasons.push(`Stage 02 status is '${gate.stageTwoStatus}' (must be 'COMPLETED').`);
    }

    if (gate.stageThreeStatus !== 'ELIGIBLE') {
      if (gate.stageThreeStatus === 'REVALIDATION_REQUIRED') {
        return {
          isValid: false,
          gateRecord: gate,
          status: 'REVALIDATION_REQUIRED',
          reasons: ['Stage 02 was reopened or source documents modified. Revalidation is required before proceeding.']
        };
      }
      reasons.push(`Stage 03 transition status is '${gate.stageThreeStatus}' (must be 'ELIGIBLE').`);
    }

    if (reasons.length > 0) {
      return {
        isValid: false,
        gateRecord: gate,
        status: 'BLOCKED_BY_STAGE_02',
        reasons
      };
    }

    return {
      isValid: true,
      gateRecord: gate,
      status: 'ELIGIBLE',
      reasons: []
    };
  }

  // --------------------------------------------------------------------------
  // TG-VAL-001: CENTRALIZED STAGE 03 WORKSPACE CONTEXT
  // --------------------------------------------------------------------------

  public static getWorkspaceContext(
    clientId: string,
    taxYear: number,
    engagementId?: string
  ): StageThreeWorkspaceContext {
    const stage2Context = StageTwoCollectionService.getWorkspaceContext(clientId, taxYear);
    const handoff = this.validateStageTwoHandoff(clientId, taxYear, engagementId);

    const exceptions = this.getExceptions(clientId, taxYear);
    const openExceptions = exceptions.filter(e => e.status !== 'RESOLVED' && e.status !== 'WAIVED');
    const blockingExceptions = openExceptions.filter(e => e.isBlocking);

    let valStatus: StageThreeWorkspaceContext['validationStatus'] = 'NOT_STARTED';
    if (!handoff.isValid) {
      valStatus = handoff.status === 'REVALIDATION_REQUIRED' ? 'REVALIDATION_REQUIRED' : 'BLOCKED_BY_STAGE_02';
    } else {
      const sources = this.getValidationSources(clientId, taxYear);
      if (sources.length > 0) {
        valStatus = blockingExceptions.length === 0 ? 'VALIDATED' : 'IN_PROGRESS';
      }
    }

    const readiness = this.calculateReadinessPercentage(clientId, taxYear);

    return {
      clientId,
      engagementId: handoff.gateRecord?.engagementId || stage2Context.engagementId,
      entityName: stage2Context.entityName,
      entityClassification: stage2Context.entityType,
      returnType: stage2Context.returnType,
      taxYear,
      federalJurisdiction: 'US-IRS (Federal)',
      stateJurisdictions: stage2Context.jurisdictions,
      assignedPreparer: stage2Context.assignedPreparer,
      assignedReviewer: stage2Context.assignedReviewer,
      stageTwoGateId: handoff.gateRecord?.gateId || 'UNCOMMITTED_GATE',
      stageTwoCollectionVersion: handoff.gateRecord?.collectionVersion || 1,
      stageTwoClearanceTimestamp: handoff.gateRecord?.evaluationTimestamp || 'N/A',
      validationStatus: valStatus,
      openExceptionCount: openExceptions.length,
      blockingExceptionCount: blockingExceptions.length,
      validationReadinessPercentage: readiness,
      isHandoffVerified: handoff.isValid
    };
  }

  // --------------------------------------------------------------------------
  // TG-VAL-003: VALIDATION SOURCE REGISTRY WITH IMMUTABLE PROVENANCE
  // --------------------------------------------------------------------------

  public static getValidationSources(clientId: string, taxYear: number): ValidationSourceRecord[] {
    const key = `${clientId}_${taxYear}`;
    if (!this.sourcesStore.has(key)) {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`${STORAGE_KEY_VAL_SOURCES}_${key}`);
          if (stored) {
            this.sourcesStore.set(key, JSON.parse(stored));
          }
        } catch {
          // ignore
        }
      }
    }
    return this.sourcesStore.get(key) || [];
  }

  public static registerValidationSource(
    source: Omit<ValidationSourceRecord, 'validationSourceId' | 'createdAt' | 'updatedAt' | 'correlationId'>
  ): ValidationSourceRecord {
    const validationSourceId = `VSR-${source.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;
    const correlationId = `CORR-VAL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const record: ValidationSourceRecord = {
      ...source,
      validationSourceId,
      createdAt: timestamp,
      updatedAt: timestamp,
      correlationId,
      isAiProposedOnly: true // GOVERNANCE INVARIANT: Never autonomously tax-verified
    };

    const key = `${source.clientId}_${source.taxYear}`;
    const list = this.getValidationSources(source.clientId, source.taxYear);
    list.push(record);
    this.sourcesStore.set(key, list);
    this.persistSources(key, list);

    // Append to audit trail (TG-VAL-012)
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: 'system_stage3_validator',
      userEmail: 'system@artaxservices.com',
      userRole: 'system',
      action: 'VALIDATION_SOURCE_REGISTERED',
      recordType: 'document',
      recordId: validationSourceId,
      ipAddress: '127.0.0.1 (Validation Service)',
      result: 'success',
      riskLevel: 'routine',
      details: `Validation source registered: ${record.fieldName} = "${record.normalizedValue}" from ${record.originalFilename} (Doc ID: ${record.documentId}, Hash: ${record.sourceHash.substring(0, 10)}...). Tier: ${record.sourceTier}`
    });

    // Record initial provenance entry
    this.recordProvenance({
      validationSourceId,
      documentId: record.documentId,
      documentVersion: record.documentVersion,
      pageNumber: record.pageNumber,
      fieldName: record.fieldName,
      rawExtractedValue: record.rawExtractedValue,
      confidence: record.AIConfidence,
      isAiProposed: true,
      validatedValue: record.normalizedValue,
      wasChanged: false,
      validatingRuleId: 'INGEST_SOURCE_TIE',
      validationResult: 'REGISTERED',
      correlationId,
      timestamp
    });

    return record;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-003: SOURCE INTEGRITY VERIFICATION
  // --------------------------------------------------------------------------

  /**
   * Verifies SHA-256 cryptographic hash integrity and security check status
   * for a specific uploaded document before or during validation intake.
   */
  public static verifyDocumentIntegrity(doc: StageTwoUploadedDocument): SourceIntegrityResult {
    const isHashFormatValid = /^[a-f0-9]{64}$/i.test(doc.sha256Hash || '');
    const isSecurityPassed = doc.securityCheckStatus === 'Passed (SHA-256 Validated)';
    const isQuarantined = doc.securityCheckStatus === 'Quarantined' || doc.quarantineStatus === 'QUARANTINED';
    const isNotRejected = doc.processingStatus !== 'Rejected';

    let integrityStatus: SourceIntegrityResult['integrityStatus'] = 'VERIFIED';
    let details = 'Source document cryptographic SHA-256 integrity and security clearance verified.';

    if (!isHashFormatValid) {
      integrityStatus = 'TAMPERED_OR_INVALID';
      details = `Invalid SHA-256 hash structure for '${doc.originalFileName}'. Potential corruption or tampering.`;
    } else if (isQuarantined) {
      integrityStatus = 'QUARANTINED';
      details = `Document '${doc.originalFileName}' is quarantined and blocked from validation intake.`;
    } else if (!isSecurityPassed) {
      integrityStatus = 'TAMPERED_OR_INVALID';
      details = `Security check status is '${doc.securityCheckStatus}'. Cryptographic verification required.`;
    } else if (!isNotRejected) {
      integrityStatus = 'TAMPERED_OR_INVALID';
      details = `Document '${doc.originalFileName}' was rejected in Stage 02 and cannot be admitted to Stage 03.`;
    }

    return {
      documentId: doc.documentId,
      fileName: doc.originalFileName,
      sha256Hash: doc.sha256Hash,
      isHashFormatValid,
      securityCheckStatus: doc.securityCheckStatus,
      processingStatus: doc.processingStatus,
      isQuarantined,
      integrityStatus,
      details
    };
  }

  /**
   * Performs source integrity verification across all uploaded documents for the client and tax year.
   */
  public static verifySourceIntegrity(clientId: string, taxYear: number): SourceIntegrityResult[] {
    const docs = StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
    return docs.map(doc => this.verifyDocumentIntegrity(doc));
  }

  /**
   * Synchronizes sources from Stage 02 accepted documents and tie-outs into Stage 03.
   */
  public static syncSourcesFromStageTwo(clientId: string, taxYear: number): ValidationSourceRecord[] {
    const docs = StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
    const existing = this.getValidationSources(clientId, taxYear);
    const existingDocIds = new Set(existing.map(e => e.documentId));

    const newlyAdded: ValidationSourceRecord[] = [];

    docs.forEach(doc => {
      // Invariant: Only cleared, non-quarantined, non-rejected documents sync into validation
      if (doc.securityCheckStatus === 'Quarantined' || doc.quarantineStatus === 'QUARANTINED' || doc.processingStatus === 'Rejected') {
        return;
      }

      if (!existingDocIds.has(doc.documentId)) {
        // Derive appropriate source tier (TG-VAL-008)
        let tier: AuthoritativeSourceTier = 'SUPPORTING';
        if (doc.claimedCategory.includes('W-2') || doc.claimedCategory.includes('1099') || doc.claimedCategory.includes('K-1')) {
          tier = 'AUTHORITATIVE';
        } else if (doc.claimedCategory.includes('Bank') || doc.claimedCategory.includes('Payroll')) {
          tier = 'SUPPORTING';
        }

        // Register main fields from intelligence record if present
        if (doc.intelligenceRecord && doc.intelligenceRecord.extractedData) {
          Object.entries(doc.intelligenceRecord.extractedData).forEach(([field, val]) => {
            const registered = this.registerValidationSource({
              documentId: doc.documentId,
              clientId,
              engagementId: doc.engagementId || `ENG-${taxYear}-${clientId}`,
              taxYear,
              collectionVersion: 1,
              documentVersion: doc.intelligenceRecord?.versionIntelligence?.versionNumber || 1,
              documentCategory: doc.claimedCategory,
              originalFilename: doc.originalFileName,
              sourceHash: doc.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              OCRArtifactId: doc.intelligenceRecord?.ocrArtifact?.ocrArtifactId || `OCR-${doc.documentId}`,
              extractionArtifactId: `EXT-${doc.documentId}`,
              pageNumber: 1,
              fieldName: field,
              rawExtractedValue: String(val),
              normalizedValue: String(val),
              sourceTier: tier,
              AIConfidence: doc.intelligenceRecord?.overallExtractionConfidence !== undefined
                ? doc.intelligenceRecord.overallExtractionConfidence
                : null,
              isAiProposedOnly: true,
              humanReviewStatus: doc.isVerified ? 'REVIEWED_APPROVED' : 'UNREVIEWED',
              validationStatus: 'UNVALIDATED'
            });
            newlyAdded.push(registered);
          });
        } else {
          // Register generic baseline document entry
          const registered = this.registerValidationSource({
            documentId: doc.documentId,
            clientId,
            engagementId: doc.engagementId || `ENG-${taxYear}-${clientId}`,
            taxYear,
            collectionVersion: 1,
            documentVersion: doc.intelligenceRecord?.versionIntelligence?.versionNumber || 1,
            documentCategory: doc.claimedCategory,
            originalFilename: doc.originalFileName,
            sourceHash: doc.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            OCRArtifactId: `OCR-${doc.documentId}`,
            extractionArtifactId: `EXT-${doc.documentId}`,
            pageNumber: 1,
            fieldName: 'document_presence',
            rawExtractedValue: doc.originalFileName,
            normalizedValue: doc.originalFileName,
            sourceTier: tier,
            AIConfidence: null,
            isAiProposedOnly: true,
            humanReviewStatus: doc.isVerified ? 'REVIEWED_APPROVED' : 'UNREVIEWED',
            validationStatus: 'UNVALIDATED'
          });
          newlyAdded.push(registered);
        }
      }
    });

    return newlyAdded;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-004: TAXPAYER IDENTITY CONSISTENCY
  // --------------------------------------------------------------------------

  /**
   * Compares taxpayer legal name and DBA across sources against client profile.
   * Categorizes as EXACT_MATCH, PARTIAL_MATCH, or MISMATCH, raising blocking conflicts on mismatch.
   */
  public static runTaxpayerIdentityValidation(
    clientId: string,
    taxYear: number,
    expectedProfile?: {
      legalName: string;
      dba?: string;
    }
  ): TaxpayerIdentityFinding[] {
    const sources = this.getValidationSources(clientId, taxYear);
    const findings: TaxpayerIdentityFinding[] = [];

    const ctx = StageTwoCollectionService.getWorkspaceContext(clientId, taxYear);
    const legalName = expectedProfile?.legalName || ctx.entityName;
    const dba = expectedProfile?.dba;

    sources.forEach(source => {
      const field = source.fieldName.toLowerCase();
      if (
        field === 'employee_name' ||
        field === 'taxpayer_name' ||
        field === 'business_name' ||
        field === 'legal_name' ||
        field === 'recipient_name' ||
        field === 'payer_name'
      ) {
        const observed = String(source.normalizedValue).trim();
        const obsLower = observed.toLowerCase();
        const expLower = legalName.trim().toLowerCase();
        const dbaLower = dba?.trim().toLowerCase();

        let matchResult: 'EXACT_MATCH' | 'PARTIAL_MATCH' | 'MISMATCH' = 'EXACT_MATCH';
        let isBlocking = false;
        let details = `Taxpayer identity match: observed name '${observed}' matches client legal name.`;

        if (obsLower === expLower || (dbaLower && obsLower === dbaLower)) {
          matchResult = 'EXACT_MATCH';
        } else if (obsLower.includes(expLower) || expLower.includes(obsLower) || (dbaLower && obsLower.includes(dbaLower))) {
          matchResult = 'PARTIAL_MATCH';
          details = `Partial identity match: observed '${observed}' shares common root with '${legalName}'.`;
        } else {
          matchResult = 'MISMATCH';
          isBlocking = true;
          details = `Taxpayer identity mismatch! Document gives '${observed}', but profile specifies '${legalName}'.`;

          this.createConflict({
            clientId,
            taxYear,
            conflictCategory: 'IDENTITY_MISMATCH',
            affectedField: source.fieldName,
            sourceA: {
              sourceId: source.validationSourceId,
              documentId: source.documentId,
              documentName: source.originalFilename,
              value: source.normalizedValue,
              sourceTier: source.sourceTier
            },
            sourceB: {
              sourceId: 'SYS_ENGAGEMENT_PROFILE',
              documentId: 'PROFILE',
              documentName: 'Engagement Master Profile',
              value: legalName,
              sourceTier: 'AUTHORITATIVE'
            },
            observedValues: `Doc: "${observed}" vs Profile: "${legalName}"`,
            variance: 'NAME_DIFFERENCE',
            materiality: 'MATERIAL',
            severity: 'HIGH',
            blockingStatus: true
          });
        }

        findings.push({
          findingId: `IDF-${Math.random().toString(36).substring(2, 9)}`,
          documentId: source.documentId,
          documentName: source.originalFilename,
          fieldName: source.fieldName,
          profileLegalName: legalName,
          observedName: observed,
          matchResult,
          isBlocking,
          details
        });
      }
    });

    return findings;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-005: TIN/EIN CONSISTENCY
  // --------------------------------------------------------------------------

  /**
   * Evaluates SSN / EIN / ITIN format validity and consistency across source documents against profile.
   * Masks tax IDs in findings and raises critical blocking conflicts on TIN mismatch.
   */
  public static runTinEinValidation(
    clientId: string,
    taxYear: number,
    expectedProfile?: {
      einTin: string;
    }
  ): TinEinValidationFinding[] {
    const sources = this.getValidationSources(clientId, taxYear);
    const findings: TinEinValidationFinding[] = [];

    const expectedTin = expectedProfile?.einTin || '84-1928374';
    const cleanExpected = expectedTin.replace(/\D/g, '');

    sources.forEach(source => {
      const field = source.fieldName.toLowerCase();
      if (
        field === 'ein' ||
        field === 'ssn' ||
        field === 'tin' ||
        field === 'employer_ein' ||
        field === 'employee_ssn' ||
        field === 'recipient_tin' ||
        field === 'payer_tin'
      ) {
        const rawVal = String(source.normalizedValue).trim();
        const cleanVal = rawVal.replace(/\D/g, '');

        let tinType: 'SSN' | 'EIN' | 'ITIN' | 'UNKNOWN' = 'UNKNOWN';
        let isFormatValid = false;

        if (cleanVal.length === 9) {
          if (field.includes('ssn') || cleanVal.startsWith('9')) {
            isFormatValid = !cleanVal.startsWith('000') && !cleanVal.startsWith('666');
            tinType = cleanVal.startsWith('9') ? 'ITIN' : 'SSN';
          } else {
            isFormatValid = true;
            tinType = 'EIN';
          }
        }

        const isMatch = cleanVal === cleanExpected;
        let matchResult: 'EXACT_MATCH' | 'MISMATCH' | 'INVALID_FORMAT' = isMatch ? 'EXACT_MATCH' : 'MISMATCH';
        if (!isFormatValid) {
          matchResult = 'INVALID_FORMAT';
        }

        let isBlocking = false;
        let details = `Federal tax ID verified: matches profile (${this.maskTIN(cleanExpected)}).`;

        if (!isFormatValid) {
          isBlocking = true;
          details = `Invalid TIN/EIN structure on '${source.fieldName}': expected 9 digits, observed '${rawVal}'.`;
        } else if (!isMatch) {
          isBlocking = true;
          details = `TIN/EIN mismatch: document has ${this.maskTIN(cleanVal)}, expected profile ${this.maskTIN(cleanExpected)}.`;

          this.createConflict({
              clientId,
              taxYear,
              conflictCategory: 'TIN_MISMATCH',
              affectedField: source.fieldName,
              sourceA: {
                sourceId: source.validationSourceId,
                documentId: source.documentId,
                documentName: source.originalFilename,
                value: this.maskTIN(cleanVal),
                sourceTier: source.sourceTier
              },
              sourceB: {
                sourceId: 'SYS_ENGAGEMENT_PROFILE',
                documentId: 'PROFILE',
                documentName: 'Engagement Master Profile',
                value: this.maskTIN(cleanExpected),
                sourceTier: 'AUTHORITATIVE'
              },
              observedValues: `${this.maskTIN(cleanVal)} vs ${this.maskTIN(cleanExpected)}`,
              variance: 'TIN_DIFFERENCE',
              materiality: 'MATERIAL',
              severity: 'CRITICAL',
              blockingStatus: true
            });
        }

        findings.push({
          findingId: `TIN-${Math.random().toString(36).substring(2, 9)}`,
          documentId: source.documentId,
          documentName: source.originalFilename,
          fieldName: source.fieldName,
          tinType,
          profileTin: this.maskTIN(cleanExpected),
          observedTin: rawVal,
          maskedObservedTin: this.maskTIN(cleanVal),
          isFormatValid,
          matchResult,
          isBlocking,
          details
        });
      }
    });

    return findings;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-004 (LEGACY/UI ALIAS): IDENTITY & ENTITY CONSISTENCY ENGINE
  // --------------------------------------------------------------------------

  public static runIdentityEntityValidation(
    clientId: string,
    taxYear: number,
    expectedProfile?: {
      legalName: string;
      einTin: string;
      entityType: string;
      address?: string;
    }
  ): IdentityEntityValidationFinding[] {
    const sources = this.getValidationSources(clientId, taxYear);
    const findings: IdentityEntityValidationFinding[] = [];

    // Fallback profile from workspace context if not supplied
    const ctx = StageTwoCollectionService.getWorkspaceContext(clientId, taxYear);
    const profile = expectedProfile || {
      legalName: ctx.entityName,
      einTin: '84-1928374', // Known Perotti Consulting EIN
      entityType: ctx.entityType,
      address: '1428 Elm Street, Denver, CO 80202'
    };

    // Evaluate each source document providing identity
    sources.forEach(source => {
      // Check Name
      if (source.fieldName === 'employee_name' || source.fieldName === 'taxpayer_name' || source.fieldName === 'business_name') {
        const val = String(source.normalizedValue).trim().toLowerCase();
        const expected = profile.legalName.trim().toLowerCase();

        let result: IdentityFindingType = 'MATCH';
        let details = 'Exact name match with engagement profile.';
        let isBlocking = false;

        if (val === expected) {
          result = 'MATCH';
        } else if (val.includes(expected) || expected.includes(val)) {
          result = 'PARTIAL_MATCH';
          details = `Partial match detected between '${source.normalizedValue}' and profile '${profile.legalName}'.`;
        } else {
          result = 'MISMATCH';
          details = `Identity Mismatch! Document gives '${source.normalizedValue}', but client profile specifies '${profile.legalName}'.`;
          isBlocking = true;

          // Automatically generate conflict (TG-VAL-009) and exception (TG-VAL-010)
          this.createConflict({
            clientId,
            taxYear,
            conflictCategory: 'IDENTITY_MISMATCH',
            affectedField: source.fieldName,
            sourceA: {
              sourceId: source.validationSourceId,
              documentId: source.documentId,
              documentName: source.originalFilename,
              value: source.normalizedValue,
              sourceTier: source.sourceTier
            },
            sourceB: {
              sourceId: 'SYS_ENGAGEMENT_PROFILE',
              documentId: 'PROFILE',
              documentName: 'Engagement Master Profile',
              value: profile.legalName,
              sourceTier: 'AUTHORITATIVE'
            },
            observedValues: `Doc: "${source.normalizedValue}" vs Profile: "${profile.legalName}"`,
            variance: 'NAME_DIFFERENCE',
            materiality: 'MATERIAL',
            severity: 'HIGH',
            blockingStatus: true
          });
        }

        findings.push({
          findingId: `IDF-${Math.random().toString(36).substring(2, 9)}`,
          field: source.fieldName,
          label: 'Legal Taxpayer Name',
          profileValue: profile.legalName,
          observedValue: String(source.normalizedValue),
          maskedObservedValue: String(source.normalizedValue),
          sourceDocumentId: source.documentId,
          sourceDocumentName: source.originalFilename,
          result,
          details,
          isBlocking
        });
      }

      // Check EIN / TIN
      if (source.fieldName === 'ein' || source.fieldName === 'ssn' || source.fieldName === 'tin') {
        const cleanVal = String(source.normalizedValue).replace(/\D/g, '');
        const cleanExpected = profile.einTin.replace(/\D/g, '');

        let result: IdentityFindingType = 'MATCH';
        let details = 'EIN/TIN matches client master profile.';
        let isBlocking = false;

        if (cleanVal === cleanExpected) {
          result = 'MATCH';
        } else {
          result = 'MISMATCH';
          details = `TIN/EIN Mismatch: Document has '${this.maskTIN(cleanVal)}', expected '${this.maskTIN(cleanExpected)}'.`;
          isBlocking = true;

          this.createConflict({
            clientId,
            taxYear,
            conflictCategory: 'TIN_MISMATCH',
            affectedField: source.fieldName,
            sourceA: {
              sourceId: source.validationSourceId,
              documentId: source.documentId,
              documentName: source.originalFilename,
              value: this.maskTIN(cleanVal),
              sourceTier: source.sourceTier
            },
            sourceB: {
              sourceId: 'SYS_ENGAGEMENT_PROFILE',
              documentId: 'PROFILE',
              documentName: 'Engagement Master Profile',
              value: this.maskTIN(cleanExpected),
              sourceTier: 'AUTHORITATIVE'
            },
            observedValues: `${this.maskTIN(cleanVal)} vs ${this.maskTIN(cleanExpected)}`,
            variance: 'TIN_DIFFERENCE',
            materiality: 'MATERIAL',
            severity: 'CRITICAL',
            blockingStatus: true
          });
        }

        findings.push({
          findingId: `IDF-${Math.random().toString(36).substring(2, 9)}`,
          field: source.fieldName,
          label: 'Federal Tax Identification (TIN/EIN)',
          profileValue: this.maskTIN(cleanExpected),
          observedValue: String(source.normalizedValue),
          maskedObservedValue: this.maskTIN(cleanVal),
          sourceDocumentId: source.documentId,
          sourceDocumentName: source.originalFilename,
          result,
          details,
          isBlocking
        });
      }
    });

    return findings;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-006: TAX-YEAR CONSISTENCY
  // --------------------------------------------------------------------------

  /**
   * Evaluates tax year across source documents against the engagement tax year.
   * Detects prior-year documents and amended/corrected forms, logging blocking conflicts on mismatch.
   */
  public static runTaxYearConsistencyValidation(
    clientId: string,
    expectedTaxYear: number
  ): TaxYearConsistencyFinding[] {
    const docs = StageTwoCollectionService.getUploadedDocuments(clientId, expectedTaxYear);
    const findings: TaxYearConsistencyFinding[] = [];

    docs.forEach(doc => {
      let detectedYear = expectedTaxYear;
      const yearMatch = doc.originalFileName.match(/(?:^|\D)(20[12]\d)(?:\D|$)/);
      if (yearMatch) {
        detectedYear = parseInt(yearMatch[1], 10);
      }

      const isCorrect = detectedYear === expectedTaxYear;
      const isPrior = detectedYear < expectedTaxYear;
      const isCorrected = /c\b|corr|amend/i.test(doc.originalFileName);

      let isBlocking = false;
      let details = `Tax year verified: ${expectedTaxYear}.`;

      if (!isCorrect) {
        isBlocking = true;
        details = `Tax Year Mismatch! File indicates tax year ${detectedYear}, but active engagement is for ${expectedTaxYear}.`;

        this.createConflict({
          clientId,
          taxYear: expectedTaxYear,
          conflictCategory: 'TAX_YEAR_MISMATCH',
          affectedField: 'tax_year',
          sourceA: {
            sourceId: `DOC-${doc.documentId}`,
            documentId: doc.documentId,
            documentName: doc.originalFileName,
            value: detectedYear,
            sourceTier: 'SUPPORTING'
          },
          sourceB: {
            sourceId: 'SYS_WORKSPACE_YEAR',
            documentId: 'WORKSPACE',
            documentName: 'Current Filing Tax Year',
            value: expectedTaxYear,
            sourceTier: 'AUTHORITATIVE'
          },
          observedValues: `Doc Year: ${detectedYear} vs Required Year: ${expectedTaxYear}`,
          variance: Math.abs(detectedYear - expectedTaxYear),
          materiality: 'MATERIAL',
          severity: 'HIGH',
          blockingStatus: true
        });
      }

      findings.push({
        findingId: `PER-${Math.random().toString(36).substring(2, 9)}`,
        documentId: doc.documentId,
        documentName: doc.originalFileName,
        expectedTaxYear,
        observedTaxYear: detectedYear,
        periodType: 'ANNUAL',
        isCorrectTaxYear: isCorrect,
        isCorrectedForm: isCorrected,
        isPriorYear: isPrior,
        details,
        isBlocking
      });
    });

    return findings;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-007: ENTITY CLASSIFICATION VALIDATION
  // --------------------------------------------------------------------------

  /**
   * Validates that uploaded documents match the client's tax entity classification
   * (e.g. Individual 1040, S-Corporation 1120-S, Partnership 1065, C-Corporation 1120).
   * Generates critical blocking conflicts on incompatible returns or schedules.
   */
  public static runEntityClassificationValidation(
    clientId: string,
    taxYear: number,
    expectedEntityType?: string
  ): EntityClassificationFinding[] {
    const ctx = StageTwoCollectionService.getWorkspaceContext(clientId, taxYear);
    const entityType = expectedEntityType || ctx.entityType;
    const docs = StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
    const findings: EntityClassificationFinding[] = [];

    docs.forEach(doc => {
      const cat = doc.claimedCategory.toLowerCase();
      let compatibilityStatus: 'COMPATIBLE' | 'INCOMPATIBLE' | 'REQUIRES_EXPLANATION' = 'COMPATIBLE';
      let isBlocking = false;
      let details = `Document category '${doc.claimedCategory}' is compatible with entity classification '${entityType}'.`;

      if (entityType === 'S-Corporation') {
        if (cat.includes('1065') || cat.includes('schedule c')) {
          compatibilityStatus = 'INCOMPATIBLE';
          isBlocking = true;
          details = `Entity classification mismatch! Client is an S-Corporation, but received '${doc.claimedCategory}' (Partnership / Sole Prop form).`;
        }
      } else if (entityType === 'Partnership') {
        if (cat.includes('1120-s') || cat.includes('1120') || cat.includes('schedule c')) {
          compatibilityStatus = 'INCOMPATIBLE';
          isBlocking = true;
          details = `Entity classification mismatch! Client is a Partnership (Form 1065), but received '${doc.claimedCategory}'.`;
        }
      } else if (entityType === 'Individual') {
        if (cat.includes('1120-s return') || cat.includes('1065 return') || cat.includes('1120 return')) {
          compatibilityStatus = 'INCOMPATIBLE';
          isBlocking = true;
          details = `Entity classification mismatch! Client is an Individual (Form 1040), but received business income tax return '${doc.claimedCategory}'.`;
        }
      } else if (entityType === 'C-Corporation') {
        if (cat.includes('1120-s') || cat.includes('1065') || cat.includes('schedule c')) {
          compatibilityStatus = 'INCOMPATIBLE';
          isBlocking = true;
          details = `Entity classification mismatch! Client is a C-Corporation (Form 1120), but received '${doc.claimedCategory}'.`;
        }
      }

      if (compatibilityStatus === 'INCOMPATIBLE') {
        this.createConflict({
          clientId,
          taxYear,
          conflictCategory: 'ENTITY_TYPE_MISMATCH',
          affectedField: 'entity_classification',
          sourceA: {
            sourceId: `DOC-${doc.documentId}`,
            documentId: doc.documentId,
            documentName: doc.originalFileName,
            value: doc.claimedCategory,
            sourceTier: 'AUTHORITATIVE'
          },
          sourceB: {
            sourceId: 'SYS_ENGAGEMENT_PROFILE',
            documentId: 'PROFILE',
            documentName: 'Engagement Master Profile',
            value: entityType,
            sourceTier: 'AUTHORITATIVE'
          },
          observedValues: `Document: "${doc.claimedCategory}" incompatible with "${entityType}"`,
          variance: 'ENTITY_TYPE_CONFLICT',
          materiality: 'MATERIAL',
          severity: 'CRITICAL',
          blockingStatus: true
        });
      }

      findings.push({
        findingId: `ECF-${Math.random().toString(36).substring(2, 9)}`,
        documentId: doc.documentId,
        documentName: doc.originalFileName,
        documentCategory: doc.claimedCategory,
        clientEntityClassification: entityType,
        compatibilityStatus,
        isBlocking,
        details
      });
    });

    return findings;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-008: CONTROLLED TAX FORM VALIDATION
  // --------------------------------------------------------------------------

  /**
   * Validates mandatory structural fields and required data completeness
   * on controlled tax forms (W-2, 1099-NEC, 1099-MISC, 1099-INT, 1099-DIV, K-1, 941).
   */
  public static runControlledTaxFormValidation(
    clientId: string,
    taxYear: number
  ): ControlledTaxFormValidationResult[] {
    const docs = StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
    const sources = this.getValidationSources(clientId, taxYear);
    const results: ControlledTaxFormValidationResult[] = [];

    const CONTROLLED_FORM_RULES: Record<string, Array<{ fieldName: string; label: string }>> = {
      'W-2': [
        { fieldName: 'employer_name', label: 'Employer Name' },
        { fieldName: 'employer_ein', label: 'Employer EIN' },
        { fieldName: 'employee_ssn', label: 'Employee SSN' },
        { fieldName: 'box1_wages', label: 'Box 1 Wages' },
        { fieldName: 'box2_fed_withheld', label: 'Box 2 Federal Tax Withheld' }
      ],
      '1099-NEC': [
        { fieldName: 'payer_tin', label: 'Payer TIN' },
        { fieldName: 'recipient_tin', label: 'Recipient TIN' },
        { fieldName: 'box1_nonemployee_compensation', label: 'Box 1 Nonemployee Compensation' }
      ],
      '1099-MISC': [
        { fieldName: 'payer_tin', label: 'Payer TIN' },
        { fieldName: 'recipient_tin', label: 'Recipient TIN' }
      ],
      '1099-INT': [
        { fieldName: 'payer_tin', label: 'Payer TIN' },
        { fieldName: 'recipient_tin', label: 'Recipient TIN' },
        { fieldName: 'box1_interest_income', label: 'Box 1 Interest Income' }
      ],
      '1099-DIV': [
        { fieldName: 'payer_tin', label: 'Payer TIN' },
        { fieldName: 'recipient_tin', label: 'Recipient TIN' },
        { fieldName: 'box1a_total_ordinary_dividends', label: 'Box 1a Total Ordinary Dividends' }
      ],
      'K-1': [
        { fieldName: 'entity_ein', label: 'Entity EIN' },
        { fieldName: 'partner_or_shareholder_tin', label: 'Partner/Shareholder TIN' }
      ],
      '941': [
        { fieldName: 'employer_ein', label: 'Employer EIN' },
        { fieldName: 'quarter', label: 'Quarter' },
        { fieldName: 'total_wages', label: 'Total Wages' }
      ]
    };

    docs.forEach(doc => {
      const matchedFormKey = Object.keys(CONTROLLED_FORM_RULES).find(key =>
        doc.claimedCategory.toLowerCase().includes(key.toLowerCase())
      );

      if (matchedFormKey) {
        const required = CONTROLLED_FORM_RULES[matchedFormKey];
        const docSources = sources.filter(s => s.documentId === doc.documentId);

        const evaluated: Array<{ fieldName: string; label: string; isPresent: boolean; value: any }> = [];
        const missing: string[] = [];

        required.forEach(rule => {
          const found = docSources.find(s => s.fieldName.toLowerCase() === rule.fieldName.toLowerCase());
          const hasValue = !!found && found.normalizedValue !== '' && found.normalizedValue !== null && found.normalizedValue !== undefined;

          evaluated.push({
            fieldName: rule.fieldName,
            label: rule.label,
            isPresent: hasValue,
            value: found ? found.normalizedValue : null
          });

          if (!hasValue) {
            missing.push(rule.label);
          }
        });

        const isMissingFields = missing.length > 0;
        const status: ControlledTaxFormValidationResult['status'] = isMissingFields ? 'MISSING_MANDATORY_FIELDS' : 'VALID';
        const isBlocking = isMissingFields;
        const details = isMissingFields
          ? `Controlled form '${doc.claimedCategory}' is missing mandatory IRS fields: ${missing.join(', ')}.`
          : `All mandatory fields for controlled form '${doc.claimedCategory}' are verified and present.`;

        if (isMissingFields) {
          this.createValidationException({
            clientId,
            taxYear,
            category: 'CONTROLLED_FORM_DEFECT',
            title: `Missing Mandatory Fields: ${doc.claimedCategory}`,
            description: `Document '${doc.originalFileName}' fails structural validation. Missing: ${missing.join(', ')}.`,
            severity: 'HIGH',
            isBlocking: true,
            relatedDocumentId: doc.documentId,
            createdBy: 'Controlled Form Validator',
            assignedTo: 'Lead Tax Reviewer / CPA'
          });
        }

        results.push({
          validationId: `CFV-${Math.random().toString(36).substring(2, 9)}`,
          documentId: doc.documentId,
          documentName: doc.originalFileName,
          formType: matchedFormKey,
          status,
          mandatoryFieldsEvaluated: evaluated,
          missingFields: missing,
          isBlocking,
          details
        });
      }
    });

    return results;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-009: OCR-TO-SOURCE PROVENANCE VALIDATION ENGINE
  // --------------------------------------------------------------------------

  /**
   * Validates full end-to-end lineage:
   * Validation Source -> SHA-256 Hash -> Document Version -> OCR Artifact -> Page -> Extraction Artifact.
   * If any provenance link is missing or unverified, produces a blocking exception.
   */
  public static validateSingleSourceProvenance(source: ValidationSourceRecord): OcrSourceProvenanceResult {
    const docs = StageTwoCollectionService.getUploadedDocuments(source.clientId, source.taxYear);
    const doc = docs.find(d => d.documentId === source.documentId);

    const hasHash = Boolean(source.sourceHash && source.sourceHash.trim());
    const isSha256 = Boolean(source.sourceHash && /^[a-fA-F0-9]{64}$/.test(source.sourceHash.trim()));
    const hasOcr = Boolean(source.OCRArtifactId && source.OCRArtifactId.trim());
    const hasExtraction = Boolean(source.extractionArtifactId && source.extractionArtifactId.trim());
    const hasPage = source.pageNumber >= 1;
    const hasBoundingBox = Boolean(source.boundingBox && source.boundingBox.width > 0 && source.boundingBox.height > 0);

    // 1. Quarantined or rejected document cannot provide authoritative evidence
    if (doc && (doc.securityCheckStatus === 'Quarantined' || doc.quarantineStatus === 'QUARANTINED' || doc.processingStatus === 'Rejected')) {
      const res: OcrSourceProvenanceResult = {
        validationSourceId: source.validationSourceId,
        documentId: source.documentId,
        originalFilename: source.originalFilename,
        hasSha256Hash: hasHash,
        sha256HashValid: isSha256,
        documentVersion: source.documentVersion,
        hasOcrArtifact: hasOcr,
        ocrArtifactId: source.OCRArtifactId,
        pageNumber: source.pageNumber,
        hasBoundingBox,
        hasExtractionArtifact: hasExtraction,
        extractionArtifactId: source.extractionArtifactId,
        fieldName: source.fieldName,
        lineageStatus: 'QUARANTINED_OR_REJECTED',
        isBlocking: true,
        details: `Quarantined evidence rejection: Document '${source.originalFilename}' is marked as ${doc.quarantineStatus || doc.processingStatus} and cannot become authoritative evidence.`
      };

      this.createValidationException({
        clientId: source.clientId,
        taxYear: source.taxYear,
        engagementId: source.engagementId,
        category: 'SOURCE_INTEGRITY_FAILURE',
        title: `Quarantined Document Evidence Rejection: ${source.originalFilename}`,
        description: res.details,
        severity: 'CRITICAL',
        materiality: 'MATERIAL',
        isBlocking: true,
        relatedSourceId: source.validationSourceId,
        relatedDocumentId: source.documentId,
        validationRule: 'TG-VAL-009',
        createdBy: 'Lineage Provenance Validator',
        assignedTo: 'Lead Security & Quality Reviewer'
      });

      return res;
    }

    // 2. Missing required lineage elements
    if (!hasHash || !isSha256 || !hasOcr || !hasExtraction || !hasPage) {
      const missingParts: string[] = [];
      if (!hasHash || !isSha256) missingParts.push('Valid 64-char SHA-256 Hash');
      if (!hasOcr) missingParts.push('OCR Artifact ID');
      if (!hasExtraction) missingParts.push('Extraction Artifact ID');
      if (!hasPage) missingParts.push('Valid Page Number (>= 1)');

      const res: OcrSourceProvenanceResult = {
        validationSourceId: source.validationSourceId,
        documentId: source.documentId,
        originalFilename: source.originalFilename,
        hasSha256Hash: hasHash,
        sha256HashValid: isSha256,
        documentVersion: source.documentVersion,
        hasOcrArtifact: hasOcr,
        ocrArtifactId: source.OCRArtifactId,
        pageNumber: source.pageNumber,
        hasBoundingBox,
        hasExtractionArtifact: hasExtraction,
        extractionArtifactId: source.extractionArtifactId,
        fieldName: source.fieldName,
        lineageStatus: 'MISSING_PROVENANCE',
        isBlocking: true,
        details: `Lineage broken: Missing required provenance elements: ${missingParts.join(', ')}.`
      };

      this.createValidationException({
        clientId: source.clientId,
        taxYear: source.taxYear,
        engagementId: source.engagementId,
        category: 'SOURCE_PROVENANCE_MISSING',
        title: `Broken Lineage Provenance: ${source.fieldName}`,
        description: res.details,
        severity: 'HIGH',
        materiality: 'MATERIAL',
        isBlocking: true,
        relatedSourceId: source.validationSourceId,
        relatedDocumentId: source.documentId,
        validationRule: 'TG-VAL-009',
        createdBy: 'Lineage Provenance Validator',
        assignedTo: 'Senior Tax Reviewer / CPA'
      });

      return res;
    }

    // 3. Document relationship check
    if (doc) {
      if (doc.sha256Hash && doc.sha256Hash.toLowerCase() !== source.sourceHash.toLowerCase()) {
        const res: OcrSourceProvenanceResult = {
          validationSourceId: source.validationSourceId,
          documentId: source.documentId,
          originalFilename: source.originalFilename,
          hasSha256Hash: hasHash,
          sha256HashValid: isSha256,
          documentVersion: source.documentVersion,
          hasOcrArtifact: hasOcr,
          ocrArtifactId: source.OCRArtifactId,
          pageNumber: source.pageNumber,
          hasBoundingBox,
          hasExtractionArtifact: hasExtraction,
          extractionArtifactId: source.extractionArtifactId,
          fieldName: source.fieldName,
          lineageStatus: 'INVALID_RELATIONSHIP',
          isBlocking: true,
          details: `Source hash mismatch: Validation source hash (${source.sourceHash.substring(0, 12)}...) differs from uploaded document hash (${doc.sha256Hash.substring(0, 12)}...).`
        };

        this.createValidationException({
          clientId: source.clientId,
          taxYear: source.taxYear,
          engagementId: source.engagementId,
          category: 'SOURCE_INTEGRITY_FAILURE',
          title: `Document Hash Mismatch: ${source.originalFilename}`,
          description: res.details,
          severity: 'CRITICAL',
          materiality: 'MATERIAL',
          isBlocking: true,
          relatedSourceId: source.validationSourceId,
          relatedDocumentId: source.documentId,
          validationRule: 'TG-VAL-009',
          createdBy: 'Lineage Provenance Validator',
          assignedTo: 'Senior Tax Reviewer / CPA'
        });

        return res;
      }

      if (doc.intelligenceRecord?.ocrArtifact && doc.intelligenceRecord.ocrArtifact.ocrArtifactId !== source.OCRArtifactId) {
        const res: OcrSourceProvenanceResult = {
          validationSourceId: source.validationSourceId,
          documentId: source.documentId,
          originalFilename: source.originalFilename,
          hasSha256Hash: hasHash,
          sha256HashValid: isSha256,
          documentVersion: source.documentVersion,
          hasOcrArtifact: hasOcr,
          ocrArtifactId: source.OCRArtifactId,
          pageNumber: source.pageNumber,
          hasBoundingBox,
          hasExtractionArtifact: hasExtraction,
          extractionArtifactId: source.extractionArtifactId,
          fieldName: source.fieldName,
          lineageStatus: 'INVALID_RELATIONSHIP',
          isBlocking: true,
          details: `OCR artifact mismatch: Source OCR ID (${source.OCRArtifactId}) does not match document OCR artifact (${doc.intelligenceRecord.ocrArtifact.ocrArtifactId}).`
        };

        this.createValidationException({
          clientId: source.clientId,
          taxYear: source.taxYear,
          engagementId: source.engagementId,
          category: 'SOURCE_PROVENANCE_MISSING',
          title: `OCR Artifact Relationship Mismatch: ${source.originalFilename}`,
          description: res.details,
          severity: 'HIGH',
          materiality: 'MATERIAL',
          isBlocking: true,
          relatedSourceId: source.validationSourceId,
          relatedDocumentId: source.documentId,
          validationRule: 'TG-VAL-009',
          createdBy: 'Lineage Provenance Validator',
          assignedTo: 'Senior Tax Reviewer / CPA'
        });

        return res;
      }
    }

    return {
      validationSourceId: source.validationSourceId,
      documentId: source.documentId,
      originalFilename: source.originalFilename,
      hasSha256Hash: hasHash,
      sha256HashValid: isSha256,
      documentVersion: source.documentVersion,
      hasOcrArtifact: hasOcr,
      ocrArtifactId: source.OCRArtifactId,
      pageNumber: source.pageNumber,
      hasBoundingBox,
      hasExtractionArtifact: hasExtraction,
      extractionArtifactId: source.extractionArtifactId,
      fieldName: source.fieldName,
      lineageStatus: 'VERIFIED',
      isBlocking: false,
      details: 'Complete end-to-end lineage verified: Document -> Hash -> Version -> OCR -> Page -> Extraction -> Field.'
    };
  }

  public static validateOcrSourceProvenance(clientId: string, taxYear: number): OcrSourceProvenanceResult[] {
    const sources = this.getValidationSources(clientId, taxYear);
    return sources.map(s => this.validateSingleSourceProvenance(s));
  }

  // --------------------------------------------------------------------------
  // TG-VAL-010: EXTRACTED FIELD VALIDATION ENGINE
  // --------------------------------------------------------------------------

  /**
   * Validates extracted fields for expected datatypes, standard IRS formatting,
   * negative amounts, and bounds. Never silently repairs data; flags anomalies.
   */
  public static validateSingleExtractedField(source: ValidationSourceRecord): ExtractedFieldValidationResult {
    const fieldNameLower = source.fieldName.toLowerCase();
    const rawValStr = String(source.rawExtractedValue).trim();
    let expectedType: ExtractedFieldValidationResult['expectedDatatype'] = 'string';
    let isValidFormat = true;
    let conventionCheck: ExtractedFieldValidationResult['conventionCheck'] = 'PASSED';
    let isBlocking = false;
    let details = 'Field format and conventions validated.';

    if (
      fieldNameLower.includes('wage') ||
      fieldNameLower.includes('withheld') ||
      fieldNameLower.includes('income') ||
      fieldNameLower.includes('balance') ||
      fieldNameLower.includes('amount') ||
      fieldNameLower.includes('debit') ||
      fieldNameLower.includes('credit') ||
      fieldNameLower.includes('dividend') ||
      fieldNameLower.includes('compensation') ||
      fieldNameLower.includes('fee') ||
      fieldNameLower.includes('total') ||
      fieldNameLower.includes('revenue') ||
      fieldNameLower.includes('expense')
    ) {
      expectedType = 'currency';
      const cleanNum = parseFloat(rawValStr.replace(/[^0-9.-]+/g, ''));
      if (isNaN(cleanNum)) {
        isValidFormat = false;
        conventionCheck = 'MALFORMED';
        isBlocking = true;
        details = `Field '${source.fieldName}' expected currency/numeric format but observed: "${source.rawExtractedValue}".`;
      } else {
        const isBracketedNegative = rawValStr.startsWith('(') && rawValStr.endsWith(')');
        const isStandardNegative = rawValStr.startsWith('-');
        const isNegative = cleanNum < 0 || isBracketedNegative || isStandardNegative;

        if (isNegative && (fieldNameLower.includes('wage') || fieldNameLower.includes('withheld'))) {
          conventionCheck = 'UNEXPECTED_NEGATIVE';
          isBlocking = true;
          details = `Unexpected negative amount (${rawValStr}) on wage/withholding field '${source.fieldName}'. Requires CPA review.`;
        }
      }
    } else if (fieldNameLower.includes('tin') || fieldNameLower.includes('ein') || fieldNameLower.includes('ssn')) {
      expectedType = fieldNameLower.includes('ein') ? 'ein' : fieldNameLower.includes('ssn') ? 'ssn' : 'tin';
      const digitsOnly = rawValStr.replace(/\D/g, '');
      if (digitsOnly.length !== 9) {
        isValidFormat = false;
        conventionCheck = 'MALFORMED';
        isBlocking = true;
        details = `Field '${source.fieldName}' must be 9 digits (observed ${digitsOnly.length} digits).`;
      }
    } else if (fieldNameLower.includes('date') || fieldNameLower.includes('period')) {
      expectedType = 'date';
      const dateParsed = Date.parse(rawValStr);
      if (isNaN(dateParsed)) {
        isValidFormat = false;
        conventionCheck = 'MALFORMED';
        isBlocking = true;
        details = `Field '${source.fieldName}' could not be parsed as a valid calendar date: "${source.rawExtractedValue}".`;
      }
    }

    if (!isValidFormat || conventionCheck !== 'PASSED') {
      this.createValidationException({
        clientId: source.clientId,
        taxYear: source.taxYear,
        engagementId: source.engagementId,
        category: conventionCheck === 'UNEXPECTED_NEGATIVE' ? 'STRUCTURAL_MISMATCH' : 'CONTROLLED_FORM_DEFECT',
        title: `Extracted Field Defect: ${source.fieldName}`,
        description: details,
        severity: 'HIGH',
        materiality: 'MATERIAL',
        isBlocking,
        relatedSourceId: source.validationSourceId,
        relatedDocumentId: source.documentId,
        validationRule: 'TG-VAL-010',
        createdBy: 'Extracted Field Validator',
        assignedTo: 'Senior Tax Reviewer / CPA'
      });
    }

    return {
      validationId: `EFV-${source.validationSourceId}`,
      sourceId: source.validationSourceId,
      documentId: source.documentId,
      fieldName: source.fieldName,
      rawExtractedValue: source.rawExtractedValue,
      normalizedValue: source.normalizedValue,
      expectedDatatype: expectedType,
      isValidFormat,
      conventionCheck,
      ruleApplied: `RULE-FIELD-${expectedType.toUpperCase()}`,
      confidence: source.AIConfidence,
      reviewStatus: source.humanReviewStatus,
      isBlocking,
      details
    };
  }

  public static validateExtractedFields(clientId: string, taxYear: number): ExtractedFieldValidationResult[] {
    const sources = this.getValidationSources(clientId, taxYear);
    return sources.map(s => this.validateSingleExtractedField(s));
  }

  // --------------------------------------------------------------------------
  // TG-VAL-011: CONFIDENCE THRESHOLD ENGINE
  // --------------------------------------------------------------------------

  public static getConfidenceThresholdConfig(): ConfidenceThresholdConfig {
    return { ...this.confidenceConfig };
  }

  public static setConfidenceThresholdConfig(config: Partial<ConfidenceThresholdConfig>): void {
    this.confidenceConfig = {
      ...this.confidenceConfig,
      ...config
    };
  }

  /**
   * Deterministic confidence evaluation:
   * - No fabricated default confidence: if null or missing, marked MISSING_CONFIDENCE.
   * - If material field is missing confidence or low confidence, flags blocking exception.
   * - If confidence is between reviewThreshold and highThreshold, enqueues standard review.
   */
  public static evaluateFieldConfidence(
    source: ValidationSourceRecord,
    isMaterial: boolean = true
  ): ConfidenceEvaluationResult {
    const config = this.confidenceConfig;
    const rawConf = source.AIConfidence;

    let tier: ConfidenceTier;
    let requiresHumanReview = false;
    let isBlocking = false;
    let details = '';

    if (rawConf === null || rawConf === undefined || isNaN(rawConf)) {
      tier = 'MISSING_CONFIDENCE';
      requiresHumanReview = isMaterial;
      isBlocking = isMaterial;
      details = `Missing extraction confidence on '${source.fieldName}'. Deterministic policy: no fallback confidence fabricated. Routing to review.`;

      if (isMaterial) {
        this.createValidationException({
          clientId: source.clientId,
          taxYear: source.taxYear,
          engagementId: source.engagementId,
          category: 'LOW_CONFIDENCE_MATERIAL_FIELD',
          title: `Missing Confidence on Material Field: ${source.fieldName}`,
          description: `Field '${source.fieldName}' in ${source.originalFilename} has no confidence score. AI proposed value requires human verification.`,
          severity: 'HIGH',
          materiality: 'MATERIAL',
          isBlocking: true,
          relatedSourceId: source.validationSourceId,
          relatedDocumentId: source.documentId,
          validationRule: 'TG-VAL-011',
          createdBy: 'Confidence Threshold Engine',
          assignedTo: 'Senior Tax Reviewer / CPA'
        });

        this.enqueueHumanReview({
          clientId: source.clientId,
          taxYear: source.taxYear,
          itemType: 'LOW_CONFIDENCE',
          referenceId: source.validationSourceId,
          title: `Verify Material Field: ${source.fieldName}`,
          description: `Missing confidence score. Stated value: ${source.rawExtractedValue}`,
          severity: 'HIGH',
          assignedReviewer: 'Senior Tax Reviewer / CPA'
        });
      }
    } else if (rawConf >= config.highThreshold) {
      tier = 'HIGH_CONFIDENCE';
      requiresHumanReview = false;
      isBlocking = false;
      details = `Field confidence (${(rawConf * 100).toFixed(1)}%) meets or exceeds high confidence threshold (${(config.highThreshold * 100).toFixed(0)}%).`;
    } else if (rawConf >= config.reviewThreshold) {
      tier = 'REVIEW_REQUIRED';
      requiresHumanReview = true;
      isBlocking = false;
      details = `Field confidence (${(rawConf * 100).toFixed(1)}%) falls in the review zone (${(config.reviewThreshold * 100).toFixed(0)}% - ${(config.highThreshold * 100).toFixed(0)}%). Standard human review required.`;

      this.enqueueHumanReview({
        clientId: source.clientId,
        taxYear: source.taxYear,
        itemType: 'LOW_CONFIDENCE',
        referenceId: source.validationSourceId,
        title: `Review Proposed Field: ${source.fieldName}`,
        description: `Confidence (${(rawConf * 100).toFixed(1)}%) requires human review before acceptance.`,
        severity: 'MEDIUM',
        assignedReviewer: 'Tax Preparer / Reviewer'
      });
    } else {
      tier = 'LOW_CONFIDENCE';
      requiresHumanReview = true;
      isBlocking = isMaterial || rawConf < config.lowBlockingThreshold;
      details = `Field confidence (${(rawConf * 100).toFixed(1)}%) is below review threshold (${(config.reviewThreshold * 100).toFixed(0)}%).`;

      if (isMaterial || isBlocking) {
        this.createValidationException({
          clientId: source.clientId,
          taxYear: source.taxYear,
          engagementId: source.engagementId,
          category: 'LOW_CONFIDENCE_MATERIAL_FIELD',
          title: `Low Confidence Material Field: ${source.fieldName}`,
          description: `Confidence score of ${(rawConf * 100).toFixed(1)}% is below threshold for material field '${source.fieldName}'.`,
          severity: 'HIGH',
          materiality: 'MATERIAL',
          isBlocking: true,
          relatedSourceId: source.validationSourceId,
          relatedDocumentId: source.documentId,
          validationRule: 'TG-VAL-011',
          createdBy: 'Confidence Threshold Engine',
          assignedTo: 'Senior Tax Reviewer / CPA'
        });

        this.enqueueHumanReview({
          clientId: source.clientId,
          taxYear: source.taxYear,
          itemType: 'LOW_CONFIDENCE',
          referenceId: source.validationSourceId,
          title: `Resolve Low Confidence Field: ${source.fieldName}`,
          description: `Field '${source.fieldName}' confidence ${(rawConf * 100).toFixed(1)}% is below threshold.`,
          severity: 'HIGH',
          assignedReviewer: 'Senior Tax Reviewer / CPA'
        });
      }
    }

    return {
      sourceId: source.validationSourceId,
      documentId: source.documentId,
      fieldName: source.fieldName,
      rawConfidence: rawConf,
      confidenceTier: tier,
      isMaterial,
      requiresHumanReview,
      isBlocking,
      thresholdApplied: {
        high: config.highThreshold,
        review: config.reviewThreshold,
        lowBlocking: config.lowBlockingThreshold
      },
      details
    };
  }

  public static runConfidenceThresholdValidation(
    clientId: string,
    taxYear: number
  ): ConfidenceEvaluationResult[] {
    const sources = this.getValidationSources(clientId, taxYear);
    const materialFieldNames = [
      'box1_wages', 'box2_fed_withheld', 'total_ordinary_dividends',
      'ordinary_business_income', 'nonemployee_compensation', 'total_debits',
      'total_credits', 'beginning_balance', 'ending_balance'
    ];

    return sources.map(source => {
      const isMaterial = materialFieldNames.some(m => source.fieldName.toLowerCase().includes(m)) ||
                         source.sourceTier === 'AUTHORITATIVE';
      return this.evaluateFieldConfidence(source, isMaterial);
    });
  }

  // --------------------------------------------------------------------------
  // TG-VAL-014: DUPLICATE & VERSION VALIDATION ENGINE
  // --------------------------------------------------------------------------

  /**
   * Consumes Stage 02 VersionIntelligenceResult to validate duplicate vs updated vs superseded documents.
   * Ensures superseded documents become inactive, duplicate documents do not satisfy validation,
   * and updated/corrected documents trigger downstream revalidation.
   */
  public static runDuplicateAndVersionValidation(
    clientId: string,
    taxYear: number
  ): DuplicateVersionValidationResult[] {
    const docs = StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
    const results: DuplicateVersionValidationResult[] = [];
    const sources = this.getValidationSources(clientId, taxYear);
    const key = `${clientId}_${taxYear}`;

    docs.forEach(doc => {
      const intel = doc.intelligenceRecord;
      const vIntel = intel?.versionIntelligence;
      const rel = vIntel?.relationship || 'ORIGINAL';
      const versionNum = vIntel?.versionNumber || 1;
      const isCurrent = vIntel?.isCurrentActiveVersion !== false && rel !== 'DUPLICATE' && rel !== 'SUPERSEDED';

      let sourceStatus: DuplicateVersionValidationResult['sourceStatus'] = 'CURRENT';
      let isAuthoritativeActive = isCurrent;
      let requiresRevalidation = Boolean(vIntel?.requiresDownstreamRevalidation);
      let isBlocking = false;
      let exceptionCreated: string | undefined;
      let details = '';

      if (rel === 'DUPLICATE') {
        sourceStatus = 'DUPLICATE';
        isAuthoritativeActive = false;
        isBlocking = true;
        details = `Duplicate document detected (${doc.originalFileName}). Cannot satisfy downstream validation.`;

        const ex = this.createValidationException({
          clientId,
          taxYear,
          engagementId: doc.engagementId,
          category: 'DUPLICATE_SOURCE',
          title: `Duplicate Document Ingested: ${doc.originalFileName}`,
          description: details,
          severity: 'HIGH',
          materiality: 'MATERIAL',
          isBlocking: true,
          relatedDocumentId: doc.documentId,
          validationRule: 'TG-VAL-014',
          createdBy: 'Version & Duplicate Engine',
          assignedTo: 'Senior Tax Reviewer / CPA'
        });
        exceptionCreated = ex.exceptionId;

        this.createConflict({
          clientId,
          taxYear,
          conflictCategory: 'DUPLICATE_SOURCE',
          affectedField: 'document_presence',
          sourceA: {
            sourceId: `DOC-${doc.documentId}`,
            documentId: doc.documentId,
            documentName: doc.originalFileName,
            value: 'DUPLICATE_INGESTION',
            sourceTier: 'SUPPORTING'
          },
          sourceB: {
            sourceId: `DOC-${vIntel?.supersedesDocId || 'PRIOR'}`,
            documentId: vIntel?.supersedesDocId || 'PRIOR',
            documentName: 'Prior Uploaded Version',
            value: 'ORIGINAL_INGESTION',
            sourceTier: 'AUTHORITATIVE'
          },
          observedValues: `Duplicate upload of ${doc.originalFileName}`,
          variance: 'EXACT_OR_SEMANTIC_DUPLICATE',
          materiality: 'MATERIAL',
          severity: 'HIGH',
          blockingStatus: true
        });
      } else if (rel === 'SUPERSEDED') {
        sourceStatus = 'SUPERSEDED';
        isAuthoritativeActive = false;
        isBlocking = true;
        details = `Superseded document (${doc.originalFileName} v${versionNum}). Replaced by active document ${vIntel?.supersededByDocId || 'newer version'}.`;

        let modified = false;
        sources.forEach(s => {
          if (s.documentId === doc.documentId) {
            s.validationStatus = 'STALE';
            modified = true;
          }
        });
        if (modified) {
          this.sourcesStore.set(key, sources);
          this.persistSources(key, sources);
        }

        const ex = this.createValidationException({
          clientId,
          taxYear,
          engagementId: doc.engagementId,
          category: 'SUPERSEDED_SOURCE',
          title: `Superseded Source Detected: ${doc.originalFileName}`,
          description: details,
          severity: 'MEDIUM',
          materiality: 'MATERIAL',
          isBlocking: true,
          relatedDocumentId: doc.documentId,
          validationRule: 'TG-VAL-014',
          createdBy: 'Version & Duplicate Engine',
          assignedTo: 'Senior Tax Reviewer / CPA'
        });
        exceptionCreated = ex.exceptionId;
      } else if (rel === 'CORRECTED') {
        sourceStatus = 'CORRECTED';
        isAuthoritativeActive = true;
        requiresRevalidation = true;
        details = `Corrected document (${doc.originalFileName} v${versionNum}). Supersedes ${vIntel?.supersedesDocId || 'prior revision'}. Downstream revalidation required.`;

        if (vIntel?.supersedesDocId) {
          let modified = false;
          sources.forEach(s => {
            if (s.documentId === vIntel.supersedesDocId) {
              s.validationStatus = 'REVALIDATION_REQUIRED';
              modified = true;
            }
          });
          if (modified) {
            this.sourcesStore.set(key, sources);
            this.persistSources(key, sources);
          }
        }
      } else if (rel === 'REPLACEMENT') {
        sourceStatus = 'REPLACEMENT';
        isAuthoritativeActive = true;
        requiresRevalidation = true;
        details = `Replacement document (${doc.originalFileName} v${versionNum}). Supersedes prior version. Downstream revalidation required.`;
      } else {
        sourceStatus = 'CURRENT';
        isAuthoritativeActive = true;
        isBlocking = false;
        details = `Authoritative active version (${doc.originalFileName} v${versionNum}). Eligible for downstream validation.`;
      }

      results.push({
        documentId: doc.documentId,
        filename: doc.originalFileName,
        sourceStatus,
        versionNumber: versionNum,
        isAuthoritativeActive,
        supersedesDocId: vIntel?.supersedesDocId,
        supersededByDocId: vIntel?.supersededByDocId,
        requiresRevalidation,
        isBlocking,
        exceptionCreated,
        details
      });
    });

    return results;
  }

  // --------------------------------------------------------------------------
  // AUTHORITATIVE SOURCE HIERARCHY COMPARATOR
  // --------------------------------------------------------------------------

  /**
   * Evaluates authoritative precedence between two sources.
   * Invariant: AI-extracted values are never inherently more authoritative
   * than their underlying source document.
   */
  public static compareSourceAuthority(
    sourceA: ValidationSourceRecord | AuthoritativeSourceTier,
    sourceB: ValidationSourceRecord | AuthoritativeSourceTier
  ): {
    higherAuthority: 'SOURCE_A' | 'SOURCE_B' | 'EQUAL';
    scoreA: number;
    scoreB: number;
    rationale: string;
  } {
    const tierScores: Record<AuthoritativeSourceTier, number> = {
      AUTHORITATIVE: 100,
      SUPPORTING: 75,
      DERIVED: 60,
      CLIENT_REPORTED: 40,
      AI_EXTRACTED: 20,
      UNVERIFIED: 10
    };

    const tierA = typeof sourceA === 'string' ? sourceA : sourceA.sourceTier;
    const tierB = typeof sourceB === 'string' ? sourceB : sourceB.sourceTier;

    const scoreA = tierScores[tierA] || 0;
    const scoreB = tierScores[tierB] || 0;

    if (scoreA > scoreB) {
      return {
        higherAuthority: 'SOURCE_A',
        scoreA,
        scoreB,
        rationale: `Source A (${tierA}, score ${scoreA}) has higher authoritative rank than Source B (${tierB}, score ${scoreB}). AI-extracted values are never more authoritative than source documents.`
      };
    } else if (scoreB > scoreA) {
      return {
        higherAuthority: 'SOURCE_B',
        scoreA,
        scoreB,
        rationale: `Source B (${tierB}, score ${scoreB}) has higher authoritative rank than Source A (${tierA}, score ${scoreA}). AI-extracted values are never more authoritative than source documents.`
      };
    }

    return {
      higherAuthority: 'EQUAL',
      scoreA,
      scoreB,
      rationale: `Both sources hold equal authoritative rank (${tierA}, score ${scoreA}). Professional review required to arbitrate.`
    };
  }

  /**
   * Deterministic downstream progression blocker.
   * Returns whether Stage 03 blocks progression to Stage 04 due to open blocking exceptions.
   */
  public static isValidationBlocked(clientId: string, taxYear: number): {
    isBlocked: boolean;
    blockingExceptions: ValidationException[];
    unresolvedConflicts: ValidationConflict[];
    reason?: string;
  } {
    const exceptions = this.getExceptions(clientId, taxYear);
    const conflicts = this.getConflicts(clientId, taxYear);

    const blockingExceptions = exceptions.filter(e => e.isBlocking && e.status !== 'RESOLVED' && e.status !== 'WAIVED');
    const blockingConflicts = conflicts.filter(c => c.blockingStatus && c.resolutionStatus === 'UNRESOLVED');

    const isBlocked = blockingExceptions.length > 0 || blockingConflicts.length > 0;
    return {
      isBlocked,
      blockingExceptions,
      unresolvedConflicts: blockingConflicts,
      reason: isBlocked
        ? `Downstream progression blocked by ${blockingExceptions.length} open blocking exception(s) and ${blockingConflicts.length} unresolved conflict(s).`
        : undefined
    };
  }

  // --------------------------------------------------------------------------
  // TG-VAL-005 (LEGACY/UI ALIAS): TAX-YEAR & PERIOD CONSISTENCY ENGINE
  // --------------------------------------------------------------------------

  public static runTaxYearPeriodValidation(
    clientId: string,
    expectedTaxYear: number
  ): PeriodConsistencyFinding[] {
    const docs = StageTwoCollectionService.getUploadedDocuments(clientId, expectedTaxYear);
    const findings: PeriodConsistencyFinding[] = [];

    docs.forEach(doc => {
      // Analyze year from filename or extraction
      let detectedYear = expectedTaxYear;
      const yearMatch = doc.originalFileName.match(/(?:^|\D)(20[12]\d)(?:\D|$)/);
      if (yearMatch) {
        detectedYear = parseInt(yearMatch[1], 10);
      }

      const isCorrect = detectedYear === expectedTaxYear;
      const isPrior = detectedYear < expectedTaxYear;
      const isCorrected = /c\b|corr|amend/i.test(doc.originalFileName);

      let isBlocking = false;
      let details = `Tax year verified: ${expectedTaxYear}.`;

      if (!isCorrect) {
        isBlocking = true;
        details = `Tax Year Mismatch! File indicates tax year ${detectedYear}, but active engagement is for ${expectedTaxYear}.`;

        // Log conflict and exception
        this.createConflict({
          clientId,
          taxYear: expectedTaxYear,
          conflictCategory: 'TAX_YEAR_MISMATCH',
          affectedField: 'tax_year',
          sourceA: {
            sourceId: `DOC-${doc.documentId}`,
            documentId: doc.documentId,
            documentName: doc.originalFileName,
            value: detectedYear,
            sourceTier: 'SUPPORTING'
          },
          sourceB: {
            sourceId: 'SYS_WORKSPACE_YEAR',
            documentId: 'WORKSPACE',
            documentName: 'Current Filing Tax Year',
            value: expectedTaxYear,
            sourceTier: 'AUTHORITATIVE'
          },
          observedValues: `Doc Year: ${detectedYear} vs Required Year: ${expectedTaxYear}`,
          variance: Math.abs(detectedYear - expectedTaxYear),
          materiality: 'MATERIAL',
          severity: 'HIGH',
          blockingStatus: true
        });
      }

      findings.push({
        findingId: `PER-${Math.random().toString(36).substring(2, 9)}`,
        documentId: doc.documentId,
        documentName: doc.originalFileName,
        expectedTaxYear,
        observedTaxYear: detectedYear,
        periodType: 'ANNUAL',
        periodIdentifier: `CY${detectedYear}`,
        isCorrectTaxYear: isCorrect,
        isCorrectedForm: isCorrected,
        isPriorYear: isPrior,
        details,
        isBlocking
      });
    });

    return findings;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-006: CROSS-DOCUMENT CONSISTENCY ENGINE
  // --------------------------------------------------------------------------

  public static runCrossDocumentValidation(clientId: string, taxYear: number): CrossDocumentRule[] {
    const sources = this.getValidationSources(clientId, taxYear);
    const rules: CrossDocumentRule[] = [];

    // Helper: find numeric value of field in specific category
    const findValue = (categorySubstring: string, fieldName: string): { val: number | null; source?: ValidationSourceRecord } => {
      const match = sources.find(
        s => (s.documentCategory || '').toLowerCase().includes(categorySubstring.toLowerCase()) &&
             s.fieldName.toLowerCase() === fieldName.toLowerCase()
      );
      if (!match) return { val: null };
      const num = parseFloat(String(match.normalizedValue).replace(/[^0-9.-]+/g, ''));
      return { val: isNaN(num) ? null : num, source: match };
    };

    // RULE 1: W-2 Box 1 Wages vs Payroll Summary Total Wages
    const w2Wages = findValue('W-2', 'box1_wages');
    const payrollWages = findValue('Payroll', 'total_gross_wages');

    if (w2Wages.val === null || payrollWages.val === null) {
      rules.push({
        ruleId: 'R-W2-PAYROLL-WAGES',
        ruleName: 'W-2 Wages vs Payroll Summary Reconciliation',
        ruleVersion: '1.0',
        sourceTypes: ['Form W-2', 'Annual Payroll Summary'],
        comparisonMethod: 'EXACT_MATCH',
        materialityThreshold: 1.0,
        severity: 'HIGH',
        result: 'INSUFFICIENT_EVIDENCE',
        expectedValue: payrollWages.val,
        observedValue: w2Wages.val,
        variance: null,
        sourceReferences: [
          ...(w2Wages.source ? [{ sourceId: w2Wages.source.validationSourceId, documentId: w2Wages.source.documentId, documentName: w2Wages.source.originalFilename, fieldName: 'box1_wages', value: w2Wages.val }] : []),
          ...(payrollWages.source ? [{ sourceId: payrollWages.source.validationSourceId, documentId: payrollWages.source.documentId, documentName: payrollWages.source.originalFilename, fieldName: 'total_gross_wages', value: payrollWages.val }] : [])
        ],
        requiresHumanReview: false,
        blockingStatus: false,
        narrative: 'Insufficient evidence: Both W-2 and Annual Payroll records are required to perform cross-document wage reconciliation.'
      });
    } else {
      const variance = Math.abs(w2Wages.val - payrollWages.val);
      const isPass = variance <= 1.0;

      if (!isPass) {
        this.createConflict({
          clientId,
          taxYear,
          conflictCategory: 'AMOUNT_MISMATCH',
          affectedField: 'box1_wages',
          sourceA: {
            sourceId: w2Wages.source!.validationSourceId,
            documentId: w2Wages.source!.documentId,
            documentName: w2Wages.source!.originalFilename,
            value: w2Wages.val,
            sourceTier: w2Wages.source!.sourceTier
          },
          sourceB: {
            sourceId: payrollWages.source!.validationSourceId,
            documentId: payrollWages.source!.documentId,
            documentName: payrollWages.source!.originalFilename,
            value: payrollWages.val,
            sourceTier: payrollWages.source!.sourceTier
          },
          observedValues: `W-2: $${w2Wages.val.toLocaleString()} vs Payroll: $${payrollWages.val.toLocaleString()}`,
          variance,
          materiality: 'MATERIAL',
          severity: 'HIGH',
          blockingStatus: true
        });
      }

      rules.push({
        ruleId: 'R-W2-PAYROLL-WAGES',
        ruleName: 'W-2 Wages vs Payroll Summary Reconciliation',
        ruleVersion: '1.0',
        sourceTypes: ['Form W-2', 'Annual Payroll Summary'],
        comparisonMethod: 'EXACT_MATCH',
        materialityThreshold: 1.0,
        severity: 'HIGH',
        result: isPass ? 'PASS' : 'FAIL',
        expectedValue: payrollWages.val,
        observedValue: w2Wages.val,
        variance,
        sourceReferences: [
          { sourceId: w2Wages.source!.validationSourceId, documentId: w2Wages.source!.documentId, documentName: w2Wages.source!.originalFilename, fieldName: 'box1_wages', value: w2Wages.val },
          { sourceId: payrollWages.source!.validationSourceId, documentId: payrollWages.source!.documentId, documentName: payrollWages.source!.originalFilename, fieldName: 'total_gross_wages', value: payrollWages.val }
        ],
        requiresHumanReview: !isPass,
        blockingStatus: !isPass,
        narrative: isPass
          ? `Cross-document reconciliation passed: W-2 Box 1 wages ($${w2Wages.val}) reconcile exactly with Payroll Summary ($${payrollWages.val}).`
          : `Cross-document variance detected: W-2 Box 1 wages ($${w2Wages.val}) differ from Payroll Summary ($${payrollWages.val}) by $${variance.toFixed(2)}.`
      });
    }

    // RULE 2: Trial Balance Debit / Credit Equilibrium Check
    const debits = findValue('Trial Balance', 'total_debits');
    const credits = findValue('Trial Balance', 'total_credits');

    if (debits.val !== null && credits.val !== null) {
      const diff = Math.abs(debits.val - credits.val);
      const isBalanced = diff < 0.01;

      if (!isBalanced) {
        this.createConflict({
          clientId,
          taxYear,
          conflictCategory: 'AMOUNT_MISMATCH',
          affectedField: 'total_debits_vs_credits',
          sourceA: {
            sourceId: debits.source!.validationSourceId,
            documentId: debits.source!.documentId,
            documentName: debits.source!.originalFilename,
            value: debits.val,
            sourceTier: debits.source!.sourceTier
          },
          sourceB: {
            sourceId: credits.source!.validationSourceId,
            documentId: credits.source!.documentId,
            documentName: credits.source!.originalFilename,
            value: credits.val,
            sourceTier: credits.source!.sourceTier
          },
          observedValues: `Debits: $${debits.val.toLocaleString()} vs Credits: $${credits.val.toLocaleString()}`,
          variance: diff,
          materiality: 'MATERIAL',
          severity: 'CRITICAL',
          blockingStatus: true
        });

        this.createValidationException({
          clientId,
          taxYear,
          category: 'STRUCTURAL_MISMATCH',
          title: 'Trial Balance Out of Equilibrium',
          description: `Total Debits ($${debits.val.toLocaleString()}) differ from Total Credits ($${credits.val.toLocaleString()}) by $${diff.toFixed(2)}.`,
          severity: 'CRITICAL',
          materiality: 'MATERIAL',
          isBlocking: true,
          relatedSourceId: debits.source!.validationSourceId,
          relatedDocumentId: debits.source!.documentId,
          validationRule: 'TG-VAL-012',
          createdBy: 'Cross-Document Consistency Engine',
          assignedTo: 'Senior Tax Reviewer / CPA'
        });
      }

      rules.push({
        ruleId: 'R-TB-DEBIT-CREDIT',
        ruleName: 'Trial Balance Debit / Credit Mathematical Equilibrium',
        ruleVersion: '1.0',
        sourceTypes: ['Trial Balance'],
        comparisonMethod: 'EXACT_MATCH',
        materialityThreshold: 0.01,
        severity: 'CRITICAL',
        result: isBalanced ? 'PASS' : 'FAIL',
        expectedValue: credits.val,
        observedValue: debits.val,
        variance: diff,
        sourceReferences: [
          { sourceId: debits.source!.validationSourceId, documentId: debits.source!.documentId, documentName: debits.source!.originalFilename, fieldName: 'total_debits', value: debits.val },
          { sourceId: credits.source!.validationSourceId, documentId: credits.source!.documentId, documentName: credits.source!.originalFilename, fieldName: 'total_credits', value: credits.val }
        ],
        requiresHumanReview: !isBalanced,
        blockingStatus: !isBalanced,
        narrative: isBalanced
          ? `Trial balance in balance: Total Debits ($${debits.val.toLocaleString()}) = Total Credits ($${credits.val.toLocaleString()}).`
          : `Out of balance! Debits ($${debits.val.toLocaleString()}) differ from Credits ($${credits.val.toLocaleString()}) by $${diff.toFixed(2)}.`
      });
    }

    // RULE 3: Form W-2 Box 2 Withholding vs Payroll Summary Tax Withheld
    const w2Withheld = findValue('Form W-2', 'box2_fed_withheld');
    const payrollWithheld = findValue('Annual Payroll Summary', 'federal_income_tax_withheld');

    if (w2Withheld.val !== null && payrollWithheld.val !== null) {
      const diffWithholding = Math.abs(w2Withheld.val - payrollWithheld.val);
      const isWithholdingPass = diffWithholding <= 1.0;

      if (!isWithholdingPass) {
        this.createConflict({
          clientId,
          taxYear,
          conflictCategory: 'AMOUNT_MISMATCH',
          affectedField: 'box2_fed_withheld',
          sourceA: {
            sourceId: w2Withheld.source!.validationSourceId,
            documentId: w2Withheld.source!.documentId,
            documentName: w2Withheld.source!.originalFilename,
            value: w2Withheld.val,
            sourceTier: w2Withheld.source!.sourceTier
          },
          sourceB: {
            sourceId: payrollWithheld.source!.validationSourceId,
            documentId: payrollWithheld.source!.documentId,
            documentName: payrollWithheld.source!.originalFilename,
            value: payrollWithheld.val,
            sourceTier: payrollWithheld.source!.sourceTier
          },
          observedValues: `W-2: $${w2Withheld.val.toLocaleString()} vs Payroll: $${payrollWithheld.val.toLocaleString()}`,
          variance: diffWithholding,
          materiality: 'MATERIAL',
          severity: 'HIGH',
          blockingStatus: true
        });
      }

      rules.push({
        ruleId: 'R-W2-PAYROLL-WITHHOLDING',
        ruleName: 'W-2 Federal Withholding vs Payroll Summary Reconciliation',
        ruleVersion: '1.0',
        sourceTypes: ['Form W-2', 'Annual Payroll Summary'],
        comparisonMethod: 'EXACT_MATCH',
        materialityThreshold: 1.0,
        severity: 'HIGH',
        result: isWithholdingPass ? 'PASS' : 'FAIL',
        expectedValue: payrollWithheld.val,
        observedValue: w2Withheld.val,
        variance: diffWithholding,
        sourceReferences: [
          { sourceId: w2Withheld.source!.validationSourceId, documentId: w2Withheld.source!.documentId, documentName: w2Withheld.source!.originalFilename, fieldName: 'box2_fed_withheld', value: w2Withheld.val },
          { sourceId: payrollWithheld.source!.validationSourceId, documentId: payrollWithheld.source!.documentId, documentName: payrollWithheld.source!.originalFilename, fieldName: 'federal_income_tax_withheld', value: payrollWithheld.val }
        ],
        requiresHumanReview: !isWithholdingPass,
        blockingStatus: !isWithholdingPass,
        narrative: isWithholdingPass
          ? `Withholding reconciliation passed: W-2 Box 2 ($${w2Withheld.val}) matches Payroll Summary ($${payrollWithheld.val}).`
          : `Withholding mismatch: W-2 Box 2 ($${w2Withheld.val}) differs from Payroll Summary ($${payrollWithheld.val}) by $${diffWithholding.toFixed(2)}.`
      });
    }

    // RULE 4: 1099 Nonemployee Compensation vs Bookkeeping Revenue
    const nec1099 = findValue('Form 1099-NEC', 'nonemployee_compensation');
    const bookRevenue = findValue('Bookkeeping', 'gross_revenue');

    if (nec1099.val !== null && bookRevenue.val !== null) {
      // 1099 reported should not exceed total revenue
      const exceedsBookkeeping = nec1099.val > (bookRevenue.val + 5.0);
      const diff1099 = Math.abs(nec1099.val - bookRevenue.val);

      rules.push({
        ruleId: 'R-1099-BOOKKEEPING-INCOME',
        ruleName: '1099-NEC vs Bookkeeping Gross Revenue Reasonableness',
        ruleVersion: '1.0',
        sourceTypes: ['Form 1099-NEC', 'Bookkeeping'],
        comparisonMethod: 'BOUNDS_CHECK',
        materialityThreshold: 5.0,
        severity: 'HIGH',
        result: !exceedsBookkeeping ? 'PASS' : 'FAIL',
        expectedValue: bookRevenue.val,
        observedValue: nec1099.val,
        variance: diff1099,
        sourceReferences: [
          { sourceId: nec1099.source!.validationSourceId, documentId: nec1099.source!.documentId, documentName: nec1099.source!.originalFilename, fieldName: 'nonemployee_compensation', value: nec1099.val },
          { sourceId: bookRevenue.source!.validationSourceId, documentId: bookRevenue.source!.documentId, documentName: bookRevenue.source!.originalFilename, fieldName: 'gross_revenue', value: bookRevenue.val }
        ],
        requiresHumanReview: exceedsBookkeeping,
        blockingStatus: exceedsBookkeeping,
        narrative: !exceedsBookkeeping
          ? `1099-NEC revenue ($${nec1099.val}) is within reported bookkeeping revenue ($${bookRevenue.val}).`
          : `Under-reporting risk: 1099-NEC ($${nec1099.val}) exceeds total recorded bookkeeping revenue ($${bookRevenue.val}).`
      });
    }

    // RULE 5: Bank Reconciliation Ending Balance vs Bank Statement Ending Balance
    const bankRecBal = findValue('Bank Reconciliation', 'reconciled_ending_balance');
    const bankStmtBal = findValue('Bank Statement', 'ending_balance');

    if (bankRecBal.val !== null && bankStmtBal.val !== null) {
      const diffBank = Math.abs(bankRecBal.val - bankStmtBal.val);
      const isBankPass = diffBank <= 0.01;

      rules.push({
        ruleId: 'R-BANK-REC-STATEMENT',
        ruleName: 'Bank Reconciliation vs Bank Statement Ending Balance',
        ruleVersion: '1.0',
        sourceTypes: ['Bank Reconciliation', 'Bank Statement'],
        comparisonMethod: 'EXACT_MATCH',
        materialityThreshold: 0.01,
        severity: 'CRITICAL',
        result: isBankPass ? 'PASS' : 'FAIL',
        expectedValue: bankStmtBal.val,
        observedValue: bankRecBal.val,
        variance: diffBank,
        sourceReferences: [
          { sourceId: bankRecBal.source!.validationSourceId, documentId: bankRecBal.source!.documentId, documentName: bankRecBal.source!.originalFilename, fieldName: 'reconciled_ending_balance', value: bankRecBal.val },
          { sourceId: bankStmtBal.source!.validationSourceId, documentId: bankStmtBal.source!.documentId, documentName: bankStmtBal.source!.originalFilename, fieldName: 'ending_balance', value: bankStmtBal.val }
        ],
        requiresHumanReview: !isBankPass,
        blockingStatus: !isBankPass,
        narrative: isBankPass
          ? `Bank reconciliation ties exactly to bank statement ending balance ($${bankStmtBal.val}).`
          : `Bank tie-out failure: Reconciled balance ($${bankRecBal.val}) differs from bank statement ($${bankStmtBal.val}) by $${diffBank.toFixed(2)}.`
      });
    }

    // RULE 6: Schedule K-1 Distributions vs General Ledger Shareholder Draws
    const k1Dist = findValue('Schedule K-1', 'cash_distributions');
    const glDraws = findValue('General Ledger', 'shareholder_draws');

    if (k1Dist.val !== null && glDraws.val !== null) {
      const diffDist = Math.abs(k1Dist.val - glDraws.val);
      const isDistPass = diffDist <= 1.0;

      rules.push({
        ruleId: 'R-K1-SHAREHOLDER-DISTRIBUTIONS',
        ruleName: 'Schedule K-1 Distributions vs GL Draws Reconciliation',
        ruleVersion: '1.0',
        sourceTypes: ['Schedule K-1', 'General Ledger'],
        comparisonMethod: 'EXACT_MATCH',
        materialityThreshold: 1.0,
        severity: 'HIGH',
        result: isDistPass ? 'PASS' : 'FAIL',
        expectedValue: glDraws.val,
        observedValue: k1Dist.val,
        variance: diffDist,
        sourceReferences: [
          { sourceId: k1Dist.source!.validationSourceId, documentId: k1Dist.source!.documentId, documentName: k1Dist.source!.originalFilename, fieldName: 'cash_distributions', value: k1Dist.val },
          { sourceId: glDraws.source!.validationSourceId, documentId: glDraws.source!.documentId, documentName: glDraws.source!.originalFilename, fieldName: 'shareholder_draws', value: glDraws.val }
        ],
        requiresHumanReview: !isDistPass,
        blockingStatus: !isDistPass,
        narrative: isDistPass
          ? `K-1 distributions ($${k1Dist.val}) reconcile with General Ledger shareholder draws ($${glDraws.val}).`
          : `Distributions mismatch: K-1 ($${k1Dist.val}) differs from General Ledger draws ($${glDraws.val}) by $${diffDist.toFixed(2)}.`
      });
    }

    return rules;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-007: MATHEMATICAL & STRUCTURAL VALIDATION ENGINE
  // --------------------------------------------------------------------------

  public static runMathematicalValidation(
    clientId: string,
    taxYear: number
  ): MathematicalValidationResult[] {
    const sources = this.getValidationSources(clientId, taxYear);
    const results: MathematicalValidationResult[] = [];

    // Helper: get numeric field
    const getNum = (fieldName: string): { val: number | null; sourceId?: string } => {
      const found = sources.find(s => s.fieldName.toLowerCase() === fieldName.toLowerCase());
      if (!found) return { val: null };
      const n = parseFloat(String(found.normalizedValue).replace(/[^0-9.-]+/g, ''));
      return { val: isNaN(n) ? null : n, sourceId: found.validationSourceId };
    };

    // CALCULATION 1: Gross -> Deduction -> Net Pay Verification
    const gross = getNum('gross_wages');
    const deductions = getNum('pretax_deductions');
    const taxable = getNum('box1_wages');

    if (gross.val === null || taxable.val === null) {
      // INSUFFICIENT EVIDENCE: Never fabricate numbers
      results.push({
        calculationId: 'CALC-NET-PAY-01',
        calculationName: 'Taxable Wages Arithmetic Verification (Gross - Deductions = Taxable)',
        relationshipType: 'GROSS_DEDUCTION_NET',
        status: 'INSUFFICIENT_EVIDENCE',
        computedValue: null,
        statedValue: taxable.val,
        variance: null,
        tolerance: 0.05,
        componentInputs: [
          { label: 'Gross Pay', value: gross.val, sourceId: gross.sourceId },
          { label: 'Pre-Tax Deductions', value: deductions.val, sourceId: deductions.sourceId },
          { label: 'Taxable Wages', value: taxable.val, sourceId: taxable.sourceId }
        ],
        isFabricated: false,
        notes: 'Insufficient source evidence: Gross wages and/or taxable wage fields missing. No estimation performed.'
      });
    } else {
      const ded = deductions.val || 0;
      const expectedTaxable = gross.val - ded;
      const variance = Math.abs(expectedTaxable - taxable.val);
      const isValid = variance <= 0.05;

      results.push({
        calculationId: 'CALC-NET-PAY-01',
        calculationName: 'Taxable Wages Arithmetic Verification (Gross - Deductions = Taxable)',
        relationshipType: 'GROSS_DEDUCTION_NET',
        status: isValid ? 'VALID' : 'VARIANCE_DETECTED',
        computedValue: expectedTaxable,
        statedValue: taxable.val,
        variance,
        tolerance: 0.05,
        componentInputs: [
          { label: 'Gross Pay', value: gross.val, sourceId: gross.sourceId },
          { label: 'Pre-Tax Deductions', value: ded, sourceId: deductions.sourceId },
          { label: 'Stated Taxable Wages', value: taxable.val, sourceId: taxable.sourceId }
        ],
        isFabricated: false,
        notes: isValid
          ? 'Arithmetic relationship confirmed. Computed value matches stated value within tolerance.'
          : `Mathematical variance of $${variance.toFixed(2)} detected between computed ($${expectedTaxable}) and stated ($${taxable.val}).`
      });
    }

    // CALCULATION 2: Quarterly Sum -> Annual Total Reconciliation
    const q1 = getNum('payroll_q1');
    const q2 = getNum('payroll_q2');
    const q3 = getNum('payroll_q3');
    const q4 = getNum('payroll_q4');
    const annual = getNum('payroll_annual_total');

    if (q1.val === null || q2.val === null || q3.val === null || q4.val === null || annual.val === null) {
      results.push({
        calculationId: 'CALC-QTR-SUM-02',
        calculationName: 'Quarterly Payroll -> Annual Total Summation',
        relationshipType: 'QUARTERLY_ANNUAL_SUM',
        status: 'INSUFFICIENT_EVIDENCE',
        computedValue: null,
        statedValue: annual.val,
        variance: null,
        tolerance: 0.01,
        componentInputs: [
          { label: 'Q1', value: q1.val, sourceId: q1.sourceId },
          { label: 'Q2', value: q2.val, sourceId: q2.sourceId },
          { label: 'Q3', value: q3.val, sourceId: q3.sourceId },
          { label: 'Q4', value: q4.val, sourceId: q4.sourceId },
          { label: 'Annual Total', value: annual.val, sourceId: annual.sourceId }
        ],
        isFabricated: false,
        notes: 'Quarterly payroll figures incomplete across one or more quarters. Insufficient evidence.'
      });
    } else {
      const sum = q1.val + q2.val + q3.val + q4.val;
      const variance = Math.abs(sum - annual.val);
      const isValid = variance <= 0.01;

      results.push({
        calculationId: 'CALC-QTR-SUM-02',
        calculationName: 'Quarterly Payroll -> Annual Total Summation',
        relationshipType: 'QUARTERLY_ANNUAL_SUM',
        status: isValid ? 'VALID' : 'VARIANCE_DETECTED',
        computedValue: sum,
        statedValue: annual.val,
        variance,
        tolerance: 0.01,
        componentInputs: [
          { label: 'Q1', value: q1.val, sourceId: q1.sourceId },
          { label: 'Q2', value: q2.val, sourceId: q2.sourceId },
          { label: 'Q3', value: q3.val, sourceId: q3.sourceId },
          { label: 'Q4', value: q4.val, sourceId: q4.sourceId },
          { label: 'Stated Annual Total', value: annual.val, sourceId: annual.sourceId }
        ],
        isFabricated: false,
        notes: isValid
          ? 'Sum of four quarters matches annual payroll control total.'
          : `Sum of quarters ($${sum}) does not tie to annual total ($${annual.val}). Variance: $${variance.toFixed(2)}.`
      });
    }

    // CALCULATION 3: Trial Balance Debit / Credit Mathematical Equilibrium
    const tbDebits = getNum('total_debits');
    const tbCredits = getNum('total_credits');

    if (tbDebits.val === null || tbCredits.val === null) {
      results.push({
        calculationId: 'CALC-DEBIT-CREDIT-03',
        calculationName: 'Trial Balance Debit / Credit Balance Verification',
        relationshipType: 'DEBIT_CREDIT_BALANCE',
        status: 'INSUFFICIENT_EVIDENCE',
        computedValue: null,
        statedValue: tbCredits.val,
        variance: null,
        tolerance: 0.01,
        componentInputs: [
          { label: 'Total Debits', value: tbDebits.val, sourceId: tbDebits.sourceId },
          { label: 'Total Credits', value: tbCredits.val, sourceId: tbCredits.sourceId }
        ],
        isFabricated: false,
        notes: 'Insufficient evidence: Trial balance debits or credits not extracted. No estimation performed.'
      });
    } else {
      const diffTb = Math.abs(tbDebits.val - tbCredits.val);
      const isTbValid = diffTb < 0.01;

      results.push({
        calculationId: 'CALC-DEBIT-CREDIT-03',
        calculationName: 'Trial Balance Debit / Credit Balance Verification',
        relationshipType: 'DEBIT_CREDIT_BALANCE',
        status: isTbValid ? 'VALID' : 'VARIANCE_DETECTED',
        computedValue: tbCredits.val,
        statedValue: tbDebits.val,
        variance: diffTb,
        tolerance: 0.01,
        componentInputs: [
          { label: 'Total Debits', value: tbDebits.val, sourceId: tbDebits.sourceId },
          { label: 'Total Credits', value: tbCredits.val, sourceId: tbCredits.sourceId }
        ],
        isFabricated: false,
        notes: isTbValid
          ? `Mathematical equilibrium confirmed: Total Debits ($${tbDebits.val.toLocaleString()}) equal Total Credits ($${tbCredits.val.toLocaleString()}).`
          : `Out of balance: Debits differ from Credits by $${diffTb.toFixed(2)}.`
      });
    }

    // CALCULATION 4: Retained Earnings / Equity Rollforward Verification
    const begEquity = getNum('beginning_equity') || getNum('beginning_retained_earnings');
    const netIncome = getNum('net_income');
    const distributions = getNum('distributions') || getNum('shareholder_draws');
    const endEquity = getNum('ending_equity') || getNum('ending_retained_earnings');

    if (begEquity.val === null || netIncome.val === null || endEquity.val === null) {
      results.push({
        calculationId: 'CALC-ROLLFORWARD-04',
        calculationName: 'Equity / Retained Earnings Rollforward Verification',
        relationshipType: 'ROLLFORWARD_BALANCE',
        status: 'INSUFFICIENT_EVIDENCE',
        computedValue: null,
        statedValue: endEquity.val,
        variance: null,
        tolerance: 1.0,
        componentInputs: [
          { label: 'Beginning Equity', value: begEquity.val, sourceId: begEquity.sourceId },
          { label: 'Net Income', value: netIncome.val, sourceId: netIncome.sourceId },
          { label: 'Distributions', value: distributions.val, sourceId: distributions.sourceId },
          { label: 'Ending Equity', value: endEquity.val, sourceId: endEquity.sourceId }
        ],
        isFabricated: false,
        notes: 'Insufficient evidence: Beginning equity, net income, or ending equity missing. No estimation performed.'
      });
    } else {
      const distVal = distributions.val || 0;
      const expectedEnd = begEquity.val + netIncome.val - distVal;
      const diffRoll = Math.abs(expectedEnd - endEquity.val);
      const isRollValid = diffRoll <= 1.0;

      results.push({
        calculationId: 'CALC-ROLLFORWARD-04',
        calculationName: 'Equity / Retained Earnings Rollforward Verification',
        relationshipType: 'ROLLFORWARD_BALANCE',
        status: isRollValid ? 'VALID' : 'VARIANCE_DETECTED',
        computedValue: expectedEnd,
        statedValue: endEquity.val,
        variance: diffRoll,
        tolerance: 1.0,
        componentInputs: [
          { label: 'Beginning Equity', value: begEquity.val, sourceId: begEquity.sourceId },
          { label: 'Net Income', value: netIncome.val, sourceId: netIncome.sourceId },
          { label: 'Distributions', value: distVal, sourceId: distributions.sourceId },
          { label: 'Stated Ending Equity', value: endEquity.val, sourceId: endEquity.sourceId }
        ],
        isFabricated: false,
        notes: isRollValid
          ? `Rollforward arithmetic confirmed: Beg ($${begEquity.val}) + Net Income ($${netIncome.val}) - Dist ($${distVal}) = Ending ($${endEquity.val}).`
          : `Rollforward variance of $${diffRoll.toFixed(2)} detected: Expected $${expectedEnd} vs Stated $${endEquity.val}.`
      });
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-009: VALIDATION CONFLICT ENGINE
  // --------------------------------------------------------------------------

  public static getConflicts(clientId: string, taxYear: number): ValidationConflict[] {
    const key = `${clientId}_${taxYear}`;
    if (!this.conflictsStore.has(key)) {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`${STORAGE_KEY_VAL_CONFLICTS}_${key}`);
          if (stored) {
            this.conflictsStore.set(key, JSON.parse(stored));
          }
        } catch {
          // ignore
        }
      }
    }
    return this.conflictsStore.get(key) || [];
  }

  public static createConflict(
    conflictData: Omit<ValidationConflict, 'conflictId' | 'createdTimestamp' | 'resolutionStatus' | 'assignedReviewer'> & {
      assignedReviewer?: string;
    }
  ): ValidationConflict {
    const conflictId = `CONF-${conflictData.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date().toISOString();

    const conflict: ValidationConflict = {
      ...conflictData,
      conflictId,
      createdTimestamp: timestamp,
      assignedReviewer: conflictData.assignedReviewer || 'Senior Tax Reviewer / CPA',
      resolutionStatus: 'UNRESOLVED'
    };

    const key = `${conflict.clientId}_${conflict.taxYear}`;
    const list = this.getConflicts(conflict.clientId, conflict.taxYear);
    list.push(conflict);
    this.conflictsStore.set(key, list);
    this.persistConflicts(key, list);

    // Audit log (TG-VAL-012)
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: 'system_stage3_validator',
      userEmail: 'system@artaxservices.com',
      userRole: 'system',
      action: 'VALIDATION_CONFLICT_CREATED',
      recordType: 'governance',
      recordId: conflictId,
      ipAddress: '127.0.0.1 (Validation Engine)',
      result: 'success',
      riskLevel: conflict.materiality === 'MATERIAL' ? 'material' : 'routine',
      details: `Validation conflict logged [${conflict.conflictCategory}] on field '${conflict.affectedField}': ${conflict.observedValues}. Severity: ${conflict.severity}`
    });

    // If material or blocking, automatically create a validation exception (TG-VAL-010)
    if (conflict.materiality === 'MATERIAL' || conflict.blockingStatus) {
      this.createValidationException({
        clientId: conflict.clientId,
        taxYear: conflict.taxYear,
        category: conflict.conflictCategory,
        title: `Material Conflict: ${conflict.affectedField}`,
        description: `Unresolved conflict between ${conflict.sourceA.documentName} and ${conflict.sourceB.documentName}: ${conflict.observedValues}`,
        severity: conflict.severity,
        isBlocking: conflict.blockingStatus,
        relatedConflictId: conflictId,
        createdBy: 'System Validation Engine',
        assignedTo: conflict.assignedReviewer
      });

      // Also route to human review queue (TG-VAL-011)
      this.enqueueHumanReview({
        clientId: conflict.clientId,
        taxYear: conflict.taxYear,
        itemType: 'CONFLICT',
        referenceId: conflictId,
        title: `Resolve Conflict: ${conflict.affectedField}`,
        description: conflict.observedValues,
        severity: conflict.severity,
        assignedReviewer: conflict.assignedReviewer
      });
    }

    return conflict;
  }

  public static resolveConflict(params: {
    clientId: string;
    taxYear: number;
    conflictId: string;
    resolvedBy: string;
    resolvedByRole: 'cpa' | 'reviewer' | 'admin';
    resolutionRationale: string;
    action: 'ACCEPT_SOURCE_A' | 'ACCEPT_SOURCE_B' | 'OVERRIDE_CUSTOM' | 'WAIVE';
    customValue?: any;
  }): ValidationConflict {
    if (!params.resolutionRationale || !params.resolutionRationale.trim()) {
      throw new Error('A detailed written rationale is required to resolve validation conflicts.');
    }

    if (params.resolvedByRole !== 'cpa' && params.resolvedByRole !== 'reviewer' && params.resolvedByRole !== 'admin') {
      throw new Error(`Unauthorized: Role '${params.resolvedByRole}' cannot resolve validation conflicts. Requires CPA or Reviewer credentials.`);
    }

    const key = `${params.clientId}_${params.taxYear}`;
    const list = this.getConflicts(params.clientId, params.taxYear);
    const item = list.find(c => c.conflictId === params.conflictId);

    if (!item) {
      throw new Error(`Conflict ${params.conflictId} not found.`);
    }

    item.resolutionStatus = 'RESOLVED';
    item.resolutionRationale = params.resolutionRationale;
    item.resolvedBy = `${params.resolvedBy} (${params.resolvedByRole.toUpperCase()})`;
    item.resolvedTimestamp = new Date().toISOString();

    this.conflictsStore.set(key, list);
    this.persistConflicts(key, list);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.resolvedBy,
      userEmail: `${params.resolvedBy.toLowerCase()}@artaxservices.com`,
      userRole: params.resolvedByRole,
      action: 'VALIDATION_VALUE_CORRECTED',
      recordType: 'governance',
      recordId: params.conflictId,
      ipAddress: '127.0.0.1 (Reviewer Workspace)',
      result: 'success',
      riskLevel: 'routine',
      details: `Conflict ${params.conflictId} resolved by ${params.resolvedBy} via ${params.action}. Rationale: "${params.resolutionRationale}"`
    });

    return item;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-010: VALIDATION EXCEPTION REGISTRY
  // --------------------------------------------------------------------------

  public static getExceptions(clientId: string, taxYear: number): ValidationException[] {
    const key = `${clientId}_${taxYear}`;
    if (!this.exceptionsStore.has(key)) {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`${STORAGE_KEY_VAL_EXCEPTIONS}_${key}`);
          if (stored) {
            this.exceptionsStore.set(key, JSON.parse(stored));
          }
        } catch {
          // ignore
        }
      }
    }
    return this.exceptionsStore.get(key) || [];
  }

  public static createValidationException(
    params: Omit<ValidationException, 'exceptionId' | 'createdTimestamp' | 'status'>
  ): ValidationException {
    const exceptionId = `VEX-${params.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date().toISOString();

    const exception: ValidationException = {
      ...params,
      exceptionId,
      createdTimestamp: timestamp,
      status: 'OPEN'
    };

    const key = `${params.clientId}_${params.taxYear}`;
    const list = this.getExceptions(params.clientId, params.taxYear);
    list.push(exception);
    this.exceptionsStore.set(key, list);
    this.persistExceptions(key, list);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.createdBy,
      userEmail: 'support@artaxservices.com',
      userRole: 'system',
      action: 'VALIDATION_EXCEPTION_CREATED',
      recordType: 'governance',
      recordId: exceptionId,
      ipAddress: '127.0.0.1 (Validation Service)',
      result: 'success',
      riskLevel: params.severity === 'CRITICAL' || params.isBlocking ? 'material' : 'routine',
      details: `Stage 03 validation exception created [${exceptionId}]: ${exception.title}. Severity: ${exception.severity}. Blocking: ${exception.isBlocking}`
    });

    return exception;
  }

  public static resolveValidationException(params: {
    clientId: string;
    taxYear: number;
    exceptionId: string;
    resolvedBy: string;
    resolvedByRole: 'cpa' | 'reviewer' | 'admin' | 'accountant';
    action: string;
    justification: string;
  }): ValidationException {
    // Client role cannot resolve staff validation exceptions
    if ((params.resolvedByRole as string) === 'client') {
      throw new Error("Unauthorized: Client role cannot resolve internal validation exceptions.");
    }

    if (!params.justification || !params.justification.trim()) {
      throw new Error("A professional justification is required to resolve validation exceptions.");
    }

    const key = `${params.clientId}_${params.taxYear}`;
    const list = this.getExceptions(params.clientId, params.taxYear);
    const item = list.find(e => e.exceptionId === params.exceptionId);

    if (!item) {
      throw new Error(`Validation exception ${params.exceptionId} not found.`);
    }

    item.status = 'RESOLVED';
    item.resolution = {
      resolvedAt: new Date().toISOString(),
      resolvedBy: params.resolvedBy,
      resolvedByRole: params.resolvedByRole,
      resolutionAction: params.action,
      justification: params.justification
    };

    this.exceptionsStore.set(key, list);
    this.persistExceptions(key, list);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.resolvedBy,
      userEmail: `${params.resolvedBy.toLowerCase()}@artaxservices.com`,
      userRole: params.resolvedByRole,
      action: 'VALIDATION_EXCEPTION_RESOLVED',
      recordType: 'governance',
      recordId: params.exceptionId,
      ipAddress: '127.0.0.1 (Reviewer Service)',
      result: 'success',
      riskLevel: 'routine',
      details: `Validation exception ${params.exceptionId} resolved by ${params.resolvedBy} (${params.resolvedByRole}). Action: ${params.action}. Justification: "${params.justification}"`
    });

    return item;
  }

  public static waiveValidationException(params: {
    clientId: string;
    taxYear: number;
    exceptionId: string;
    waivedBy: string;
    waivedByRole: 'cpa' | 'reviewer' | 'admin';
    justification: string;
  }): ValidationException {
    if (params.waivedByRole !== 'cpa' && params.waivedByRole !== 'reviewer' && params.waivedByRole !== 'admin') {
      throw new Error(`Unauthorized: Role '${params.waivedByRole}' cannot waive validation exceptions. Requires CPA or Reviewer credentials.`);
    }

    if (!params.justification || !params.justification.trim()) {
      throw new Error('A documented professional justification is required to waive validation exceptions.');
    }

    const key = `${params.clientId}_${params.taxYear}`;
    const list = this.getExceptions(params.clientId, params.taxYear);
    const item = list.find(e => e.exceptionId === params.exceptionId);

    if (!item) {
      throw new Error(`Validation exception ${params.exceptionId} not found.`);
    }

    item.status = 'WAIVED';
    item.resolution = {
      resolvedAt: new Date().toISOString(),
      resolvedBy: params.waivedBy,
      resolvedByRole: params.waivedByRole,
      resolutionAction: 'WAIVED_BY_CPA',
      justification: params.justification
    };

    this.exceptionsStore.set(key, list);
    this.persistExceptions(key, list);

    return item;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-017 & TG-VAL-018: OPERATIONAL HUMAN VALIDATION REVIEW QUEUE & CONTROLS
  // --------------------------------------------------------------------------

  public static getReviewQueue(clientId: string, taxYear: number): HumanValidationQueueItem[] {
    const key = `${clientId}_${taxYear}`;
    if (!this.queueStore.has(key)) {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`${STORAGE_KEY_VAL_QUEUE}_${key}`);
          if (stored) {
            this.queueStore.set(key, JSON.parse(stored));
          }
        } catch {
          // ignore
        }
      }
    }
    return this.queueStore.get(key) || [];
  }

  public static enqueueHumanReview(
    itemData: Omit<HumanValidationQueueItem, 'queueItemId' | 'status'> & {
      queueItemId?: string;
      reviewItemId?: string;
      status?: HumanValidationQueueItem['status'];
    }
  ): HumanValidationQueueItem {
    const queueItemId = itemData.queueItemId || itemData.reviewItemId || `HVR-${itemData.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;

    const item: HumanValidationQueueItem = {
      queueItemId,
      reviewItemId: queueItemId,
      tenantId: itemData.tenantId || 'tenant_ar_tax_prod',
      clientId: itemData.clientId,
      engagementId: itemData.engagementId || `ENG-${itemData.taxYear}-${itemData.clientId}`,
      taxYear: itemData.taxYear,
      itemType: itemData.itemType,
      referenceId: itemData.referenceId,
      sourceDocumentIds: itemData.sourceDocumentIds || (itemData.referenceId ? [itemData.referenceId] : []),
      validationRuleIds: itemData.validationRuleIds || ['TG-VAL-017'],
      exceptionIds: itemData.exceptionIds || [],
      title: itemData.title,
      description: itemData.description,
      materiality: itemData.materiality || (itemData.severity === 'CRITICAL' ? 'CRITICAL' : itemData.severity === 'HIGH' ? 'HIGH_RISK' : itemData.severity === 'MEDIUM' ? 'MATERIAL' : 'ROUTINE'),
      riskLevel: itemData.riskLevel || (itemData.severity === 'CRITICAL' ? 'critical' : itemData.severity === 'HIGH' ? 'high_risk' : itemData.severity === 'MEDIUM' ? 'material' : 'routine'),
      blockingStatus: itemData.blockingStatus !== undefined ? itemData.blockingStatus : (itemData.severity === 'HIGH' || itemData.severity === 'CRITICAL'),
      assignedRole: itemData.assignedRole || 'reviewer',
      assignedReviewer: itemData.assignedReviewer,
      preparerId: itemData.preparerId,
      severity: itemData.severity,
      status: itemData.status || 'OPEN',
      createdAt: itemData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditReferences: itemData.auditReferences || []
    };

    const key = `${itemData.clientId}_${itemData.taxYear}`;
    const list = this.getReviewQueue(itemData.clientId, itemData.taxYear);
    list.push(item);
    this.queueStore.set(key, list);
    this.persistQueue(key, list);

    TaxGuardAuditService.logEvent({
      tenantId: item.tenantId || 'tenant_ar_tax_prod',
      userId: 'system_stage3_queue',
      userEmail: 'system@artaxservices.com',
      userRole: 'system',
      action: 'VALIDATION_REVIEW_ASSIGNED',
      recordType: 'governance',
      recordId: queueItemId,
      ipAddress: '127.0.0.1 (Review Engine)',
      result: 'success',
      riskLevel: item.riskLevel || 'routine',
      details: `Human validation review item queued: ${item.title}`
    });

    return item;
  }

  /**
   * TG-VAL-017 / TG-VAL-019: Assign a review queue item to an authorized reviewer.
   * Enforces role authorization and maker-checker separation.
   */
  public static assignReviewItem(params: {
    clientId: string;
    taxYear: number;
    queueItemId: string;
    assignedReviewer: string;
    assignedRole: 'cpa' | 'ea' | 'tax_attorney' | 'reviewer' | 'accountant' | string;
    assignerId: string;
    assignerRole: string;
  }): HumanValidationQueueItem {
    const authorizedRoles = ['cpa', 'ea', 'tax_attorney', 'reviewer', 'admin'];
    if (!authorizedRoles.includes(params.assignedRole.toLowerCase())) {
      throw new Error(`Unauthorized assignment: Role '${params.assignedRole}' is not authorized for validation review. Must be CPA, EA, Tax Attorney, or designated Reviewer.`);
    }

    const key = `${params.clientId}_${params.taxYear}`;
    const list = this.getReviewQueue(params.clientId, params.taxYear);
    const item = list.find(q => q.queueItemId === params.queueItemId || q.reviewItemId === params.queueItemId);

    if (!item) {
      throw new Error(`Review item ${params.queueItemId} not found.`);
    }

    // Maker-checker separation: preparer cannot be assigned to review or approve their own work
    if (item.preparerId && item.preparerId.trim() !== '' && item.preparerId.toLowerCase() === params.assignedReviewer.toLowerCase()) {
      throw new Error(`Maker-checker violation: Preparer '${params.assignedReviewer}' cannot be assigned to review or approve their own work.`);
    }

    item.assignedReviewer = params.assignedReviewer;
    item.assignedRole = params.assignedRole as any;
    item.status = 'ASSIGNED';
    item.updatedAt = new Date().toISOString();

    this.queueStore.set(key, list);
    this.persistQueue(key, list);

    TaxGuardAuditService.logEvent({
      tenantId: item.tenantId || 'tenant_ar_tax_prod',
      userId: params.assignerId,
      userEmail: `${params.assignerId}@artaxservices.com`,
      userRole: params.assignerRole,
      action: 'VALIDATION_REVIEW_ASSIGNED',
      recordType: 'governance',
      recordId: item.queueItemId,
      ipAddress: '127.0.0.1 (Review Engine)',
      result: 'success',
      riskLevel: 'routine',
      details: `Assigned review item ${item.queueItemId} to ${params.assignedReviewer} (${params.assignedRole})`
    });

    return item;
  }

  /**
   * TG-VAL-018 & TG-VAL-019: Record human reviewer resolution disposition.
   * Enforces role authorization, mandatory written rationale, maker-checker separation,
   * and blocks AI self-approval.
   */
  public static recordReviewDisposition(params: {
    clientId: string;
    taxYear: number;
    queueItemId: string;
    actor: string;
    actorRole: 'cpa' | 'ea' | 'tax_attorney' | 'reviewer' | 'accountant' | 'admin' | string;
    action: HumanValidationQueueItem['disposition']['action'];
    justification: string;
    correctedValue?: any;
    isAiProposedOnly?: boolean;
  }): HumanValidationQueueItem {
    if (!params.actor || !params.actor.trim()) {
      throw new Error('Authenticated reviewer identity is required for resolution.');
    }

    if (!params.justification || !params.justification.trim()) {
      throw new Error('A written rationale is required to disposition review items.');
    }

    // Anti-AI-self-approval rule
    if (params.isAiProposedOnly || params.actor.toLowerCase().includes('ai') || params.actorRole === 'ai_model') {
      throw new Error('AI output remains PROPOSED ONLY and cannot self-resolve, self-approve, or self-certify.');
    }

    const key = `${params.clientId}_${params.taxYear}`;
    const list = this.getReviewQueue(params.clientId, params.taxYear);
    const item = list.find(q => q.queueItemId === params.queueItemId || q.reviewItemId === params.queueItemId);

    if (!item) {
      throw new Error(`Review item ${params.queueItemId} not found.`);
    }

    // TG-VAL-019 Maker-Checker Enforcement: The preparer cannot independently review/approve their own work
    if (item.preparerId && item.preparerId.trim() !== '' && item.preparerId.toLowerCase() === params.actor.toLowerCase()) {
      throw new Error(`Maker-checker violation: The preparer who created or modified this item cannot independently approve, resolve, or waive it.`);
    }

    // Role authorization check: material resolutions and waivers require authorized reviewer
    const authorizedRoles = ['cpa', 'ea', 'tax_attorney', 'reviewer', 'admin'];
    if (!authorizedRoles.includes(params.actorRole.toLowerCase())) {
      throw new Error(`Unauthorized resolution: Role '${params.actorRole}' is not authorized to resolve or waive validation items.`);
    }

    if (params.action === 'WAIVE_EXCEPTION') {
      item.status = 'WAIVED';
    } else if (params.action === 'REQUEST_CORRECTION') {
      item.status = 'NEEDS_PREPARER_CORRECTION';
    } else if (params.action === 'REQUEST_CLIENT_INFORMATION') {
      item.status = 'NEEDS_CLIENT_INFORMATION';
    } else if (params.action === 'REOPEN_REVIEW') {
      item.status = 'REOPENED';
    } else {
      item.status = 'RESOLVED';
    }

    item.resolutionAt = new Date().toISOString();
    item.resolutionRationale = params.justification;
    item.resolutionAction = params.action;
    item.updatedAt = new Date().toISOString();
    item.blockingStatus = false;

    item.disposition = {
      action: params.action,
      actor: params.actor,
      actorRole: params.actorRole,
      timestamp: new Date().toISOString(),
      justification: params.justification,
      correctedValue: params.correctedValue,
      isAiProposedOnly: false
    };

    // Synchronize linked exceptions
    if (item.exceptionIds && item.exceptionIds.length > 0) {
      const exceptions = this.getExceptions(params.clientId, params.taxYear);
      item.exceptionIds.forEach(excId => {
        const exc = exceptions.find(e => e.exceptionId === excId);
        if (exc) {
          if (params.action === 'WAIVE_EXCEPTION') {
            exc.status = 'WAIVED';
            exc.resolution = {
              resolvedAt: new Date().toISOString(),
              resolvedBy: params.actor,
              resolvedByRole: params.actorRole,
              resolutionAction: 'WAIVED_BY_CPA',
              justification: params.justification
            };
          } else if (item.status === 'RESOLVED') {
            exc.status = 'RESOLVED';
            exc.resolution = {
              resolvedAt: new Date().toISOString(),
              resolvedBy: params.actor,
              resolvedByRole: params.actorRole,
              resolutionAction: 'RESOLVED_BY_HUMAN',
              justification: params.justification,
              correctedValue: params.correctedValue
            };
          }
        }
      });
      this.exceptionsStore.set(key, exceptions);
      this.persistExceptions(key, exceptions);
    } else if (item.referenceId && item.referenceId.startsWith('EXC-')) {
      const exceptions = this.getExceptions(params.clientId, params.taxYear);
      const exc = exceptions.find(e => e.exceptionId === item.referenceId);
      if (exc) {
        if (params.action === 'WAIVE_EXCEPTION') {
          exc.status = 'WAIVED';
          exc.resolution = {
            resolvedAt: new Date().toISOString(),
            resolvedBy: params.actor,
            resolvedByRole: params.actorRole,
            resolutionAction: 'WAIVED_BY_CPA',
            justification: params.justification
          };
        } else if (item.status === 'RESOLVED') {
          exc.status = 'RESOLVED';
          exc.resolution = {
            resolvedAt: new Date().toISOString(),
            resolvedBy: params.actor,
            resolvedByRole: params.actorRole,
            resolutionAction: 'RESOLVED_BY_HUMAN',
            justification: params.justification,
            correctedValue: params.correctedValue
          };
        }
        this.exceptionsStore.set(key, exceptions);
        this.persistExceptions(key, exceptions);
      }
    }

    this.queueStore.set(key, list);
    this.persistQueue(key, list);

    TaxGuardAuditService.logEvent({
      tenantId: item.tenantId || 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor}@artaxservices.com`,
      userRole: params.actorRole,
      action: params.action === 'WAIVE_EXCEPTION' ? 'VALIDATION_EXCEPTION_WAIVED' : 'VALIDATION_REVIEW_RESOLVED',
      recordType: 'approval',
      recordId: item.queueItemId,
      ipAddress: '127.0.0.1 (Review Engine)',
      result: 'success',
      riskLevel: item.riskLevel || 'routine',
      details: `Disposition '${params.action}' recorded by ${params.actor}: ${params.justification}`
    });

    return item;
  }

  public static resolveReviewItem(params: Parameters<typeof StageThreeValidationService.recordReviewDisposition>[0]): HumanValidationQueueItem {
    return this.recordReviewDisposition(params);
  }

  /**
   * TG-VAL-018 & TG-VAL-019: Reopen a review item.
   * Preserves historical attribution while re-enforcing maker-checker rules.
   */
  public static reopenReviewItem(params: {
    clientId: string;
    taxYear: number;
    queueItemId: string;
    reopenedBy: string;
    reopenedByRole: string;
    rationale: string;
  }): HumanValidationQueueItem {
    if (!params.rationale || !params.rationale.trim()) {
      throw new Error('A written rationale is required to reopen a review item.');
    }

    const key = `${params.clientId}_${params.taxYear}`;
    const list = this.getReviewQueue(params.clientId, params.taxYear);
    const item = list.find(q => q.queueItemId === params.queueItemId || q.reviewItemId === params.queueItemId);

    if (!item) {
      throw new Error(`Review item ${params.queueItemId} not found.`);
    }

    item.status = 'REOPENED';
    item.blockingStatus = true;
    item.resolutionAt = undefined;
    item.resolutionRationale = undefined;
    item.resolutionAction = undefined;
    item.updatedAt = new Date().toISOString();

    // Reopen linked exceptions
    if (item.exceptionIds && item.exceptionIds.length > 0) {
      const exceptions = this.getExceptions(params.clientId, params.taxYear);
      item.exceptionIds.forEach(excId => {
        const exc = exceptions.find(e => e.exceptionId === excId);
        if (exc) {
          exc.status = 'OPEN';
        }
      });
      this.exceptionsStore.set(key, exceptions);
      this.persistExceptions(key, exceptions);
    }

    this.queueStore.set(key, list);
    this.persistQueue(key, list);

    TaxGuardAuditService.logEvent({
      tenantId: item.tenantId || 'tenant_ar_tax_prod',
      userId: params.reopenedBy,
      userEmail: `${params.reopenedBy}@artaxservices.com`,
      userRole: params.reopenedByRole,
      action: 'VALIDATION_REVIEW_REOPENED',
      recordType: 'governance',
      recordId: item.queueItemId,
      ipAddress: '127.0.0.1 (Review Engine)',
      result: 'success',
      riskLevel: 'material',
      details: `Review item ${item.queueItemId} reopened by ${params.reopenedBy}: ${params.rationale}`
    });

    return item;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-021: VALIDATION COMPLETENESS EVALUATOR
  // --------------------------------------------------------------------------

  /**
   * Deterministic 18-point Stage 03 validation completeness evaluator.
   * High percentage scores CANNOT bypass active blocking exceptions.
   */
  public static evaluateValidationCompleteness(clientId: string, taxYear: number): ValidationCompletenessEvaluation {
    const sources = this.getValidationSources(clientId, taxYear);
    const exceptions = this.getExceptions(clientId, taxYear);
    const conflicts = this.getConflicts(clientId, taxYear);
    const queue = this.getReviewQueue(clientId, taxYear);
    const gateStatus = StageTwoCollectionOperationsService.getExitGateStatus(clientId, taxYear);

    const openExceptions = exceptions.filter(e => e.status !== 'RESOLVED' && e.status !== 'WAIVED');
    const openBlockingExceptions = openExceptions.filter(e => e.isBlocking);
    const openReviewItems = queue.filter(q => q.status !== 'RESOLVED' && q.status !== 'WAIVED');
    const blockingReviewItems = openReviewItems.filter(q => q.blockingStatus);

    const blockingReasons: string[] = [];
    const warnings: string[] = [];
    const criteriaResults: ValidationCriterionResult[] = [];

    // 1. Stage 02 certified handoff remains valid
    const stageTwoPassed = !!gateStatus && gateStatus.gateResult === 'CLEARED' && gateStatus.stageTwoStatus !== 'REOPENED' && gateStatus.stageThreeStatus !== 'REVALIDATION_REQUIRED';
    criteriaResults.push({
      criterionId: 'CRIT-01-STAGE-02-HANDOFF',
      description: 'Stage 02 certified handoff remains valid and un-reopened',
      status: stageTwoPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: stageTwoPassed ? 'Stage 02 exit gate cleared.' : 'Stage 02 collection record is missing or reopened.'
    });
    if (!stageTwoPassed) blockingReasons.push('Stage 02 certified handoff is missing or has been reopened.');

    // 2. Required validation sources exist
    const sourcesExist = sources.length > 0;
    criteriaResults.push({
      criterionId: 'CRIT-02-SOURCES-EXIST',
      description: 'Required validation sources exist in registry',
      status: sourcesExist ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: `${sources.length} sources registered.`
    });
    if (!sourcesExist) blockingReasons.push('No validation sources registered for this client and tax year.');

    // 3. Source integrity checks passed
    const integrityPassed = sourcesExist && sources.every(s => s.sourceHash && s.sourceHash.length === 64 && s.validationStatus !== 'UNVALIDATED');
    criteriaResults.push({
      criterionId: 'CRIT-03-SOURCE-INTEGRITY',
      description: 'Source integrity and cryptographic hashes verified',
      status: integrityPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: integrityPassed ? 'All source hashes verified.' : 'One or more sources lack cryptographic verification.'
    });
    if (!integrityPassed && sourcesExist) blockingReasons.push('One or more validation sources failed cryptographic integrity verification.');

    // 4. Identity validation completed
    const identityExceptions = openExceptions.filter(e => e.category === 'TAXPAYER_IDENTITY_MISMATCH' || e.category === 'IDENTITY_MISMATCH');
    const identityPassed = identityExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-04-IDENTITY-CONSISTENCY',
      description: 'Taxpayer identity matches client dossier without conflicts',
      status: identityPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: identityPassed ? 'Identity consistent across sources.' : `${identityExceptions.length} open identity exception(s).`
    });
    if (!identityPassed) blockingReasons.push('Taxpayer identity conflicts remain unresolved.');

    // 5. TIN/EIN consistency completed
    const tinExceptions = openExceptions.filter(e => e.category === 'TIN_EIN_MISMATCH');
    const tinPassed = tinExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-05-TIN-EIN-CONSISTENCY',
      description: 'TIN/EIN consistency verified against entity profile',
      status: tinPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: tinPassed ? 'TIN/EIN verified.' : `${tinExceptions.length} open TIN/EIN exception(s).`
    });
    if (!tinPassed) blockingReasons.push('TIN/EIN inconsistency exceptions remain unresolved.');

    // 6. Tax-year consistency completed
    const yearExceptions = openExceptions.filter(e => e.category === 'TAX_YEAR_MISMATCH');
    const yearPassed = yearExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-06-TAX-YEAR-CONSISTENCY',
      description: 'All document tax years match engagement tax year',
      status: yearPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: yearPassed ? 'Tax year consistent across all records.' : `${yearExceptions.length} tax year mismatch exception(s).`
    });
    if (!yearPassed) blockingReasons.push('Document tax-year mismatch exceptions remain unresolved.');

    // 7. Entity classification validation completed
    const entityExceptions = openExceptions.filter(e => e.category === 'ENTITY_CLASSIFICATION_MISMATCH');
    const entityPassed = entityExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-07-ENTITY-CLASSIFICATION',
      description: 'Entity classification validated against registered form types',
      status: entityPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: entityPassed ? 'Entity classification consistent.' : `${entityExceptions.length} open classification exception(s).`
    });
    if (!entityPassed) blockingReasons.push('Entity classification mismatch exceptions remain unresolved.');

    // 8. Controlled tax form validation completed
    const formExceptions = openExceptions.filter(e => e.category === 'CONTROLLED_FORM_DEFECT');
    const formPassed = formExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-08-CONTROLLED-FORMS',
      description: 'Controlled tax forms validated for required fields and structure',
      status: formPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: formPassed ? 'Controlled forms structurally sound.' : `${formExceptions.length} controlled form defect(s).`
    });
    if (!formPassed) blockingReasons.push('Controlled tax form defect exceptions remain unresolved.');

    // 9. Extracted field confidence / review completed
    const confidenceExceptions = openExceptions.filter(e => e.category === 'LOW_CONFIDENCE_MATERIAL_FIELD');
    const confidencePassed = confidenceExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-09-FIELD-CONFIDENCE',
      description: 'Material extracted fields meet confidence threshold or resolved by human review',
      status: confidencePassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: confidencePassed ? 'Confidence thresholds satisfied or resolved.' : `${confidenceExceptions.length} low-confidence material field(s).`
    });
    if (!confidencePassed) blockingReasons.push('Low-confidence material fields require human review before clearance.');

    // 10. Required provenance exists
    const provenanceExceptions = openExceptions.filter(e => e.category === 'PROVENANCE_FAILURE' || e.category === 'MISSING_PROVENANCE');
    const provenancePassed = provenanceExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-10-PROVENANCE-VERIFIED',
      description: 'Extracted values link to cryptographic source and page coordinates',
      status: provenancePassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: provenancePassed ? 'Provenance intact.' : `${provenanceExceptions.length} provenance failure(s).`
    });
    if (!provenancePassed) blockingReasons.push('Missing or unverified OCR-to-source provenance records remain.');

    // 11. Cross-document consistency rules completed
    const crossDocExceptions = openExceptions.filter(e => e.category === 'CROSS_DOCUMENT_DISCREPANCY');
    const crossDocPassed = crossDocExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-11-CROSS-DOC-CONSISTENCY',
      description: 'Cross-document reconciliation rules satisfied without active discrepancy',
      status: crossDocPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: crossDocPassed ? 'Cross-document rules reconciled.' : `${crossDocExceptions.length} cross-document discrepancy exception(s).`
    });
    if (!crossDocPassed) blockingReasons.push('Cross-document discrepancies exceed materiality thresholds.');

    // 12. Mathematical & structural validation completed
    const mathExceptions = openExceptions.filter(e => e.category === 'MATHEMATICAL_CALCULATION_VARIANCE');
    const mathPassed = mathExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-12-MATHEMATICAL-STRUCTURAL',
      description: 'Mathematical arithmetic and structural balances reconciled',
      status: mathPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: mathPassed ? 'Arithmetic balances verified.' : `${mathExceptions.length} mathematical variance exception(s).`
    });
    if (!mathPassed) blockingReasons.push('Mathematical calculation variances remain unresolved.');

    // 13. Version conflicts resolved
    const versionExceptions = openExceptions.filter(e => e.category === 'DUPLICATE_SOURCE_DOCUMENT' || e.category === 'SUPERSEDED_SOURCE_DOCUMENT');
    const versionPassed = versionExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-13-VERSION-INTELLIGENCE',
      description: 'Duplicate and superseded document version conflicts resolved',
      status: versionPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: versionPassed ? 'Versions reconciled.' : `${versionExceptions.length} version conflict exception(s).`
    });
    if (!versionPassed) blockingReasons.push('Unresolved duplicate or superseded document version conflicts exist.');

    // 14. Material conflicts resolved
    const materialConflicts = conflicts.filter(c => c.resolutionStatus === 'UNRESOLVED' && c.materiality !== 'IMMATERIAL');
    const conflictsPassed = materialConflicts.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-14-MATERIAL-CONFLICTS',
      description: 'All material cross-source data conflicts adjudicated',
      status: conflictsPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: conflictsPassed ? 'No unresolved material conflicts.' : `${materialConflicts.length} open material conflict(s).`
    });
    if (!conflictsPassed) blockingReasons.push('Material cross-source data conflicts remain unresolved.');

    // 15. Blocking exceptions resolved or waived
    const exceptionsPassed = openBlockingExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-15-BLOCKING-EXCEPTIONS',
      description: 'All blocking Stage 03 exceptions resolved or properly waived by CPA',
      status: exceptionsPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: exceptionsPassed ? 'No open blocking exceptions.' : `${openBlockingExceptions.length} open blocking exception(s).`
    });
    if (!exceptionsPassed) blockingReasons.push(`${openBlockingExceptions.length} blocking exception(s) remain open or un-waived.`);

    // 16. Human review requirements completed
    const reviewPassed = blockingReviewItems.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-16-HUMAN-REVIEW-COMPLETED',
      description: 'All blocking review items resolved or waived by authorized professional',
      status: reviewPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: reviewPassed ? 'Human review queue clear of blockers.' : `${blockingReviewItems.length} blocking review item(s) pending.`
    });
    if (!reviewPassed) blockingReasons.push(`${blockingReviewItems.length} human validation review queue items require resolution.`);

    // 17. Maker-checker requirements satisfied
    const makerCheckerViolations = queue.filter(q => q.status === 'RESOLVED' && q.preparerId && q.disposition && q.disposition.actor.toLowerCase() === q.preparerId.toLowerCase());
    const makerCheckerPassed = makerCheckerViolations.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-17-MAKER-CHECKER-COMPLIANCE',
      description: 'Independent review enforced; no preparer self-approvals',
      status: makerCheckerPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: makerCheckerPassed ? 'Maker-checker discipline intact.' : `${makerCheckerViolations.length} self-approved item(s) detected.`
    });
    if (!makerCheckerPassed) blockingReasons.push('Maker-checker violation: One or more review items were self-approved by their preparer.');

    // 18. No unresolved critical/high-risk blockers
    const criticalExceptions = openExceptions.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH');
    const criticalPassed = criticalExceptions.length === 0;
    criteriaResults.push({
      criterionId: 'CRIT-18-CRITICAL-BLOCKERS',
      description: 'Zero unresolved critical or high-risk validation defects',
      status: criticalPassed ? 'PASSED' : 'FAILED',
      isBlocking: true,
      details: criticalPassed ? 'No critical blockers.' : `${criticalExceptions.length} critical/high-risk issue(s).`
    });
    if (!criticalPassed) blockingReasons.push('Critical or high-risk validation defects remain open.');

    // Score calculation
    const passedCount = criteriaResults.filter(c => c.status === 'PASSED').length;
    let readinessScore = Math.round((passedCount / criteriaResults.length) * 100);

    // If any blocking reason exists, readiness cannot be 100 and certification is strictly blocked
    if (blockingReasons.length > 0) {
      readinessScore = Math.min(readinessScore, 95);
    }

    const isReadyForCertification = blockingReasons.length === 0 && openBlockingExceptions.length === 0 && blockingReviewItems.length === 0;
    const isReadyForExit = isReadyForCertification;

    return {
      readinessScore,
      criteriaResults,
      blockingReasons,
      warnings,
      openExceptions,
      openReviewItems,
      isReadyForCertification,
      isReadyForExit
    };
  }

  // --------------------------------------------------------------------------
  // TG-VAL-023: CPA/EA VALIDATION CERTIFICATION
  // --------------------------------------------------------------------------

  public static getCertifications(clientId: string, taxYear: number): StageThreeCertificationRecord[] {
    const key = `${clientId}_${taxYear}`;
    if (!this.certificationsStore.has(key)) {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`${STORAGE_KEY_VAL_CERTS}_${key}`);
          if (stored) {
            this.certificationsStore.set(key, JSON.parse(stored));
          }
        } catch {
          // ignore
        }
      }
    }
    return this.certificationsStore.get(key) || [];
  }

  public static getLatestCertification(clientId: string, taxYear: number): StageThreeCertificationRecord | null {
    const list = this.getCertifications(clientId, taxYear);
    const active = list.filter(c => c.status === 'ACTIVE');
    return active.length > 0 ? active[active.length - 1] : (list.length > 0 ? list[list.length - 1] : null);
  }

  /**
   * Execute professional CPA/EA validation certification.
   * Enforces credentials, maker-checker separation, and blocking exception resolution.
   */
  public static certifyValidation(params: {
    clientId: string;
    taxYear: number;
    engagementId: string;
    reviewerId: string;
    reviewerRole: 'cpa' | 'ea' | 'tax_attorney' | 'reviewer' | 'accountant' | 'client' | string;
    preparerId?: string;
    certificationStatement: string;
  }): StageThreeCertificationRecord {
    // Role verification
    const authorizedRoles = ['cpa', 'ea', 'tax_attorney', 'reviewer'];
    if (!authorizedRoles.includes(params.reviewerRole.toLowerCase())) {
      throw new Error(`Unauthorized certification: Professional certification requires a licensed CPA, EA, or Tax Attorney. Role '${params.reviewerRole}' is not permitted.`);
    }

    // AI cannot self-certify
    if (params.reviewerId.toLowerCase().includes('ai') || params.reviewerRole === 'ai_model') {
      throw new Error('AI output remains PROPOSED ONLY and cannot self-certify.');
    }

    // TG-VAL-019 Maker-Checker enforcement on certification
    if (params.preparerId && params.preparerId.trim() !== '' && params.preparerId.toLowerCase() === params.reviewerId.toLowerCase()) {
      throw new Error('Maker-checker violation: Preparer cannot certify their own work.');
    }

    // Completeness verification: cannot certify if unresolved blockers exist
    const completeness = this.evaluateValidationCompleteness(params.clientId, params.taxYear);
    if (!completeness.isReadyForCertification || completeness.blockingReasons.length > 0) {
      throw new Error(`Cannot certify validation: Stage 03 has unresolved blocking exceptions or incomplete requirements: ${completeness.blockingReasons.join('; ')}`);
    }

    const sources = this.getValidationSources(params.clientId, params.taxYear);
    const exceptions = this.getExceptions(params.clientId, params.taxYear);
    const queue = this.getReviewQueue(params.clientId, params.taxYear);

    // Traceable deterministic hashes
    const sourceSetHash = sources.map(s => s.sourceHash || s.validationSourceId).sort().join('|') || 'empty_source_set';
    const exceptionSetHash = exceptions.map(e => `${e.exceptionId}:${e.status}`).sort().join('|') || 'no_exceptions';
    const reviewSetHash = queue.map(q => `${q.queueItemId}:${q.status}`).sort().join('|') || 'no_queue_items';

    const certificationId = `CERT-VAL-${params.taxYear}-${Math.floor(100000 + Math.random() * 900000)}`;

    const certRecord: StageThreeCertificationRecord = {
      certificationId,
      tenantId: 'tenant_ar_tax_prod',
      clientId: params.clientId,
      engagementId: params.engagementId,
      taxYear: params.taxYear,
      reviewerId: params.reviewerId,
      reviewerRole: params.reviewerRole as any,
      certificationTimestamp: new Date().toISOString(),
      validationStateVersion: 1,
      sourceSetHash,
      exceptionSetHash,
      reviewSetHash,
      certificationStatement: params.certificationStatement,
      auditReference: `AUD-CERT-${params.clientId}-${params.taxYear}`,
      status: 'ACTIVE',
      isSimulatedCredential: true
    };

    const key = `${params.clientId}_${params.taxYear}`;
    const list = this.getCertifications(params.clientId, params.taxYear);
    list.push(certRecord);
    this.certificationsStore.set(key, list);
    this.persistCertifications(key, list);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.reviewerId,
      userEmail: `${params.reviewerId}@artaxservices.com`,
      userRole: params.reviewerRole,
      action: 'VALIDATION_CERTIFIED',
      recordType: 'approval',
      recordId: certificationId,
      ipAddress: '127.0.0.1 (Certification Engine)',
      result: 'success',
      riskLevel: 'routine',
      details: `Stage 03 validation professionally certified by ${params.reviewerId} (${params.reviewerRole}): ${params.certificationStatement}`
    });

    return certRecord;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-022: STAGE 03 HARD EXIT GATE
  // --------------------------------------------------------------------------

  public static getExitGateStatus(clientId: string, taxYear: number): StageThreeExitGateRecord | null {
    const key = `${clientId}_${taxYear}`;
    if (!this.exitGateStore.has(key)) {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`${STORAGE_KEY_VAL_GATE}_${key}`);
          if (stored) {
            this.exitGateStore.set(key, JSON.parse(stored));
          }
        } catch {
          // ignore
        }
      }
    }
    return this.exitGateStore.get(key) || null;
  }

  public static evaluateExitGate(clientId: string, taxYear: number): StageThreeExitGateRecord {
    const completeness = this.evaluateValidationCompleteness(clientId, taxYear);
    const cert = this.getLatestCertification(clientId, taxYear);
    const sources = this.getValidationSources(clientId, taxYear);
    const key = `${clientId}_${taxYear}`;

    let gateStatus: StageThreeGateStatus = 'NOT_EVALUATED';

    if (completeness.blockingReasons.length > 0 || completeness.openExceptions.some(e => e.isBlocking)) {
      gateStatus = 'BLOCKED';
    } else if (completeness.openReviewItems.some(q => q.status === 'NEEDS_PREPARER_CORRECTION')) {
      gateStatus = 'AWAITING_PREPARER';
    } else if (completeness.openReviewItems.some(q => q.status === 'NEEDS_CLIENT_INFORMATION')) {
      gateStatus = 'AWAITING_CLIENT';
    } else if (completeness.openReviewItems.some(q => q.status === 'IN_REVIEW' || q.status === 'ASSIGNED' || q.status === 'OPEN')) {
      gateStatus = 'AWAITING_REVIEWER';
    } else if (!cert || cert.status !== 'ACTIVE') {
      gateStatus = 'READY_FOR_CERTIFICATION';
    } else {
      gateStatus = 'CLEARED';
    }

    const gateId = `GATE-S3-${taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;

    const gateRecord: StageThreeExitGateRecord = {
      gateId,
      tenantId: 'tenant_ar_tax_prod',
      clientId,
      engagementId: `ENG-${taxYear}-${clientId}`,
      taxYear,
      gateStatus,
      stageTwoExitRecordId: `GATE-S2-${clientId}-${taxYear}`,
      stageThreeValidationStateVersion: 1,
      sourceSetHash: cert ? cert.sourceSetHash : 'unhashed_sources',
      validationResultsSummary: {
        totalSources: sources.length,
        validatedSources: sources.filter(s => s.validationStatus === 'VALIDATED').length,
        openExceptionsCount: completeness.openExceptions.length,
        openReviewItemsCount: completeness.openReviewItems.length,
        readinessScore: completeness.readinessScore
      },
      exceptionStateHash: cert ? cert.exceptionSetHash : 'unhashed_exceptions',
      reviewStateHash: cert ? cert.reviewSetHash : 'unhashed_review',
      professionalCertificationId: cert ? cert.certificationId : null,
      certifiedBy: cert ? cert.reviewerId : null,
      certifiedRole: cert ? cert.reviewerRole : null,
      certificationTimestamp: cert ? cert.certificationTimestamp : null,
      timestamp: new Date().toISOString(),
      correlationId: `CORR-S3-GATE-${clientId}-${taxYear}`,
      auditReference: `AUD-S3-GATE-${clientId}-${taxYear}`
    };

    return gateRecord;
  }

  /**
   * Execute Stage 03 Hard Exit Gate evaluation and commit.
   * If cleared, issues downstream signal STAGE_04_ELIGIBLE.
   * If blocked, issues downstream signal STAGE_04_BLOCKED.
   */
  public static executeStageThreeExitGate(params: {
    clientId: string;
    taxYear: number;
    engagementId: string;
    actor: string;
    actorRole: string;
  }): StageThreeExitGateRecord {
    const gateRecord = this.evaluateExitGate(params.clientId, params.taxYear);
    const key = `${params.clientId}_${params.taxYear}`;

    this.exitGateStore.set(key, gateRecord);
    this.persistExitGate(key, gateRecord);

    const isCleared = gateRecord.gateStatus === 'CLEARED';

    // Issue downstream eligibility signal
    const signal: StageFourEligibilitySignal = {
      signalId: `SIG-S4-${params.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`,
      clientId: params.clientId,
      engagementId: params.engagementId,
      taxYear: params.taxYear,
      stageThreeGateVersion: 1,
      status: isCleared ? 'STAGE_04_ELIGIBLE' : 'STAGE_04_BLOCKED',
      reason: isCleared ? 'Stage 03 hard exit gate cleared and professionally certified.' : `Stage 03 gate is ${gateRecord.gateStatus}.`,
      affectedRecords: [gateRecord.gateId],
      timestamp: new Date().toISOString(),
      auditReference: gateRecord.auditReference
    };

    this.downstreamSignalsStore.set(key, signal);
    this.persistDownstreamSignal(key, signal);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor}@artaxservices.com`,
      userRole: params.actorRole,
      action: isCleared ? 'EXIT_GATE_CLEARED' : 'EXIT_GATE_BLOCKED',
      recordType: 'governance',
      recordId: gateRecord.gateId,
      ipAddress: '127.0.0.1 (Gate Engine)',
      result: 'success',
      riskLevel: isCleared ? 'routine' : 'material',
      details: `Stage 03 exit gate evaluated: ${gateRecord.gateStatus}. Downstream status: ${signal.status}.`
    });

    return gateRecord;
  }

  // --------------------------------------------------------------------------
  // TG-VAL-024: UPSTREAM INVALIDATION & GATE REOPENING
  // --------------------------------------------------------------------------

  /**
   * Handle upstream material change in Stage 02 sources (corrected form, W-2c,
   * changed hash, quarantine, or rejection).
   * Reopens gate, invalidates active certification, flags sources for revalidation,
   * preserves prior history, and sets downstream signal to REVALIDATION_REQUIRED.
   */
  public static handleUpstreamInvalidation(params: {
    clientId: string;
    taxYear: number;
    documentId: string;
    invalidationType: 'CORRECTED_FORM' | 'SUPERSEDED' | 'QUARANTINED' | 'REJECTED' | 'HASH_CHANGED' | 'AMENDED';
    details: string;
    actor: string;
  }): {
    gateReopened: boolean;
    certificationInvalidated: boolean;
    affectedSourcesCount: number;
    affectedExceptionsCount: number;
    signal: StageFourEligibilitySignal;
  } {
    const key = `${params.clientId}_${params.taxYear}`;
    const sources = this.getValidationSources(params.clientId, params.taxYear);
    let affectedSourcesCount = 0;

    // 1. Mark affected sources as STALE and requires revalidation
    sources.forEach(s => {
      if (s.documentId === params.documentId || s.validationSourceId === params.documentId) {
        s.validationStatus = 'STALE';
        s.isAuthoritative = false;
        affectedSourcesCount++;
      }
    });
    this.sourcesStore.set(key, sources);
    this.persistSources(key, sources);

    // 2. Invalidate active certification (preserve history, never delete former certification)
    const certs = this.getCertifications(params.clientId, params.taxYear);
    let certificationInvalidated = false;
    certs.forEach(c => {
      if (c.status === 'ACTIVE') {
        c.status = 'INVALIDATED_BY_UPSTREAM_CHANGE';
        c.invalidatedAt = new Date().toISOString();
        c.invalidationReason = params.details;
        certificationInvalidated = true;
      }
    });
    this.certificationsStore.set(key, certs);
    this.persistCertifications(key, certs);

    // 3. Reopen review items or enqueue revalidation item
    const queue = this.getReviewQueue(params.clientId, params.taxYear);
    const matchingReviewItem = queue.find(q => q.sourceDocumentIds?.includes(params.documentId) || q.referenceId === params.documentId);

    if (matchingReviewItem) {
      matchingReviewItem.status = 'REOPENED';
      matchingReviewItem.blockingStatus = true;
      matchingReviewItem.updatedAt = new Date().toISOString();
    } else {
      this.enqueueHumanReview({
        clientId: params.clientId,
        taxYear: params.taxYear,
        itemType: 'SUPERSEDED_SOURCE',
        referenceId: params.documentId,
        sourceDocumentIds: [params.documentId],
        title: `Revalidation Required: Source ${params.documentId} Invalidated`,
        description: `Upstream change detected (${params.invalidationType}): ${params.details}`,
        severity: 'HIGH',
        materiality: 'MATERIAL',
        riskLevel: 'material',
        blockingStatus: true,
        assignedRole: 'cpa',
        assignedReviewer: 'Senior Tax Reviewer / CPA',
        status: 'REOPENED'
      });
    }
    this.persistQueue(key, this.getReviewQueue(params.clientId, params.taxYear));

    // 4. Reopen Stage 03 Exit Gate
    const existingGate = this.getExitGateStatus(params.clientId, params.taxYear);
    const gateId = existingGate ? existingGate.gateId : `GATE-S3-${params.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;

    const reopenedGate: StageThreeExitGateRecord = {
      gateId,
      tenantId: 'tenant_ar_tax_prod',
      clientId: params.clientId,
      engagementId: `ENG-${params.taxYear}-${params.clientId}`,
      taxYear: params.taxYear,
      gateStatus: 'REOPENED',
      stageTwoExitRecordId: `GATE-S2-${params.clientId}-${params.taxYear}`,
      stageThreeValidationStateVersion: 2,
      sourceSetHash: 'invalidated_by_upstream_change',
      validationResultsSummary: {
        totalSources: sources.length,
        validatedSources: sources.filter(s => s.validationStatus === 'VALIDATED').length,
        openExceptionsCount: this.getExceptions(params.clientId, params.taxYear).filter(e => e.status === 'OPEN').length,
        openReviewItemsCount: this.getReviewQueue(params.clientId, params.taxYear).filter(q => q.status !== 'RESOLVED' && q.status !== 'WAIVED').length,
        readinessScore: 50
      },
      exceptionStateHash: 'reopened',
      reviewStateHash: 'reopened',
      professionalCertificationId: null,
      certifiedBy: null,
      certifiedRole: null,
      certificationTimestamp: null,
      timestamp: new Date().toISOString(),
      correlationId: `CORR-REOPEN-${params.clientId}-${params.taxYear}`,
      auditReference: `AUD-REOPEN-${params.clientId}-${params.taxYear}`
    };

    this.exitGateStore.set(key, reopenedGate);
    this.persistExitGate(key, reopenedGate);

    // 5. Generate Downstream Revalidation Signal
    const signal: StageFourEligibilitySignal = {
      signalId: `SIG-S4-REVAL-${params.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`,
      clientId: params.clientId,
      engagementId: `ENG-${params.taxYear}-${params.clientId}`,
      taxYear: params.taxYear,
      stageThreeGateVersion: 2,
      status: 'REVALIDATION_REQUIRED',
      reason: `Upstream change: ${params.details}`,
      affectedRecords: [params.documentId, gateId],
      timestamp: new Date().toISOString(),
      auditReference: reopenedGate.auditReference
    };

    this.downstreamSignalsStore.set(key, signal);
    this.persistDownstreamSignal(key, signal);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor}@artaxservices.com`,
      userRole: 'system',
      action: 'EXIT_GATE_REOPENED',
      recordType: 'governance',
      recordId: gateId,
      ipAddress: '127.0.0.1 (Invalidation Watcher)',
      result: 'success',
      riskLevel: 'material',
      details: `Stage 03 exit gate reopened due to upstream invalidation (${params.invalidationType}): ${params.details}`
    });

    return {
      gateReopened: true,
      certificationInvalidated,
      affectedSourcesCount,
      affectedExceptionsCount: 1,
      signal
    };
  }

  // --------------------------------------------------------------------------
  // TG-VAL-025: DOWNSTREAM REVALIDATION SIGNAL CONTRACT
  // --------------------------------------------------------------------------

  /**
   * Returns authoritative eligibility signal for downstream Stage 04.
   * STAGE_04_ELIGIBLE: Stage 03 cleared and professionally certified.
   * REVALIDATION_REQUIRED: Upstream changes or stale sources require revalidation.
   * STAGE_04_BLOCKED: Stage 03 is not cleared or has active blockers.
   */
  public static getStageFourEligibilitySignal(clientId: string, taxYear: number): StageFourEligibilitySignal {
    const key = `${clientId}_${taxYear}`;
    const stored = this.downstreamSignalsStore.get(key);
    if (stored) return stored;

    const gate = this.getExitGateStatus(clientId, taxYear);
    const cert = this.getLatestCertification(clientId, taxYear);

    if (gate && gate.gateStatus === 'CLEARED' && cert && cert.status === 'ACTIVE') {
      return {
        signalId: `SIG-S4-DEFAULT-${taxYear}`,
        clientId,
        engagementId: `ENG-${taxYear}-${clientId}`,
        taxYear,
        stageThreeGateVersion: 1,
        status: 'STAGE_04_ELIGIBLE',
        reason: 'Stage 03 validation cleared and certified.',
        affectedRecords: [gate.gateId],
        timestamp: new Date().toISOString(),
        auditReference: gate.auditReference
      };
    }

    if (gate && (gate.gateStatus === 'REOPENED' || gate.gateStatus === 'SUPERSEDED')) {
      return {
        signalId: `SIG-S4-REVAL-${taxYear}`,
        clientId,
        engagementId: `ENG-${taxYear}-${clientId}`,
        taxYear,
        stageThreeGateVersion: 1,
        status: 'REVALIDATION_REQUIRED',
        reason: 'Stage 03 validation was reopened or superseded by upstream changes.',
        affectedRecords: [gate.gateId],
        timestamp: new Date().toISOString(),
        auditReference: gate.auditReference
      };
    }

    return {
      signalId: `SIG-S4-BLOCKED-${taxYear}`,
      clientId,
      engagementId: `ENG-${taxYear}-${clientId}`,
      taxYear,
      stageThreeGateVersion: 1,
      status: 'STAGE_04_BLOCKED',
      reason: gate ? `Stage 03 gate is in status ${gate.gateStatus}.` : 'Stage 03 validation has not been evaluated or cleared.',
      affectedRecords: gate ? [gate.gateId] : [],
      timestamp: new Date().toISOString(),
      auditReference: 'AUD-S4-BLOCKED'
    };
  }

  // --------------------------------------------------------------------------
  // TG-VAL-012: VALIDATION PROVENANCE LEDGER
  // --------------------------------------------------------------------------

  public static getProvenanceLedger(clientId: string, taxYear: number): ValidationProvenanceEntry[] {
    const key = `${clientId}_${taxYear}`;
    if (!this.provenanceStore.has(key)) {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`${STORAGE_KEY_VAL_PROVENANCE}_${key}`);
          if (stored) {
            this.provenanceStore.set(key, JSON.parse(stored));
          }
        } catch {
          // ignore
        }
      }
    }
    return this.provenanceStore.get(key) || [];
  }

  private static recordProvenance(entry: Omit<ValidationProvenanceEntry, 'provenanceId'>): ValidationProvenanceEntry {
    const full: ValidationProvenanceEntry = {
      ...entry,
      provenanceId: `PROV-${Math.floor(100000 + Math.random() * 900000)}`
    };

    const key = `global_ledger`;
    const list = this.provenanceStore.get(key) || [];
    list.unshift(full);
    this.provenanceStore.set(key, list);
    return full;
  }

  // --------------------------------------------------------------------------
  // UPSTREAM INVALIDATION CHECK (STAGE 02 MONITOR)
  // --------------------------------------------------------------------------

  /**
   * Evaluates if Stage 02 has been reopened or modified since validation began.
   * If Stage 02 is invalidated, transitions Stage 03 to REVALIDATION_REQUIRED
   * and marks sources as STALE without deleting previous audit history.
   */
  public static checkAndApplyUpstreamInvalidation(clientId: string, taxYear: number): {
    isInvalidated: boolean;
    reason?: string;
  } {
    const gate = StageTwoCollectionOperationsService.getExitGateStatus(clientId, taxYear);

    if (!gate || gate.stageTwoStatus === 'REOPENED' || gate.stageThreeStatus === 'REVALIDATION_REQUIRED') {
      const key = `${clientId}_${taxYear}`;
      const sources = this.getValidationSources(clientId, taxYear);

      sources.forEach(s => {
        if (s.validationStatus === 'VALIDATED') {
          s.validationStatus = 'STALE';
        }
      });
      this.sourcesStore.set(key, sources);
      this.persistSources(key, sources);

      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_prod',
        userId: 'system_stage3_monitor',
        userEmail: 'system@artaxservices.com',
        userRole: 'system',
        action: 'EXIT_GATE_REOPENED',
        recordType: 'governance',
        recordId: `INV-${clientId}-${taxYear}`,
        ipAddress: '127.0.0.1 (Watcher)',
        result: 'error',
        riskLevel: 'material',
        details: `Stage 03 validation marked REVALIDATION_REQUIRED due to upstream Stage 02 reopening. Validated sources marked STALE.`
      });

      return {
        isInvalidated: true,
        reason: 'Upstream Stage 02 collection record was reopened or superseded.'
      };
    }

    return { isInvalidated: false };
  }

  // --------------------------------------------------------------------------
  // READINESS EVALUATION
  // --------------------------------------------------------------------------

  public static calculateReadinessPercentage(clientId: string, taxYear: number): number {
    const comp = this.evaluateValidationCompleteness(clientId, taxYear);
    return comp.readinessScore;
  }

  // --------------------------------------------------------------------------
  // HELPERS & PERSISTENCE
  // --------------------------------------------------------------------------

  public static maskTIN(tin: string): string {
    if (!tin) return '***-**-****';
    const digits = tin.replace(/\D/g, '');
    if (digits.length === 9) {
      return `***-**-${digits.substring(5)}`;
    }
    return `***-${digits.slice(-4)}`;
  }

  private static persistSources(key: string, data: ValidationSourceRecord[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_VAL_SOURCES}_${key}`, JSON.stringify(data));
      } catch {
        // storage quota
      }
    }
  }

  private static persistConflicts(key: string, data: ValidationConflict[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_VAL_CONFLICTS}_${key}`, JSON.stringify(data));
      } catch {
        // ignore
      }
    }
  }

  private static persistExceptions(key: string, data: ValidationException[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_VAL_EXCEPTIONS}_${key}`, JSON.stringify(data));
      } catch {
        // ignore
      }
    }
  }

  private static persistQueue(key: string, data: HumanValidationQueueItem[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_VAL_QUEUE}_${key}`, JSON.stringify(data));
      } catch {
        // ignore
      }
    }
  }

  private static persistCertifications(key: string, data: StageThreeCertificationRecord[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_VAL_CERTS}_${key}`, JSON.stringify(data));
      } catch {
        // ignore
      }
    }
  }

  private static persistExitGate(key: string, data: StageThreeExitGateRecord): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_VAL_GATE}_${key}`, JSON.stringify(data));
      } catch {
        // ignore
      }
    }
  }

  private static persistDownstreamSignal(key: string, data: StageFourEligibilitySignal): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_VAL_SIGNAL}_${key}`, JSON.stringify(data));
      } catch {
        // ignore
      }
    }
  }
}
