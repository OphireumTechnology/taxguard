/**
 * TaxGuard AI – Verified Tax and Accounting Operations
 * Powered by Ophireum AI Technology
 * Comprehensive Type Definitions
 */

export type TaxGuardTenantId = string;

export type TaxReturnFormType = 
  | '1040' 
  | '1040-SR'
  | '1065' 
  | '1120' 
  | '1120-S' 
  | '990' 
  | '1041' 
  | 'SC-1040' 
  | 'SC-1120';

export type TaxFilingStatus = 
  | 'Single' 
  | 'Married Filing Jointly' 
  | 'Married Filing Separately' 
  | 'Head of Household' 
  | 'Qualifying Surviving Spouse'
  | 'Entity Corporate'
  | 'Entity Partnership';

export type DocumentCategory = 
  | 'W-2'
  | '1099-NEC'
  | '1099-MISC'
  | '1099-INT'
  | '1099-DIV'
  | '1099-B'
  | '1099-K'
  | '1099-R'
  | 'Schedule K-1'
  | '1098 Mortgage'
  | 'Bank Statement'
  | 'Credit Card Statement'
  | 'Receipt'
  | 'Invoice'
  | 'Payroll Report'
  | 'Prior Year Return'
  | 'Fixed Asset Record'
  | 'Brokerage Statement'
  | 'Cryptocurrency Transaction Report'
  | 'Business Registration'
  | 'IRS Notice'
  | 'State Tax Notice'
  | 'Supporting Schedule'
  | 'Engagement Document'
  | 'Unclassified';

export type MalwareScanStatus = 
  | 'not_configured' 
  | 'pending_scan' 
  | 'quarantined' 
  | 'clean' 
  | 'infected';

export type DocumentReviewStatus = 
  | 'pending_classification' 
  | 'pending_ocr' 
  | 'in_review' 
  | 'verified' 
  | 'rejected' 
  | 'quarantined' 
  | 'archived';

export interface ChainOfCustodyEntry {
  timestamp: string;
  action: string;
  actor: string;
  actorRole: string;
  ipAddress?: string;
  notes?: string;
}

export interface TaxGuardDocument {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256Hash: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByRole: string;
  proposedCategory: DocumentCategory;
  confirmedCategory?: DocumentCategory;
  categoryConfirmedBy?: string;
  taxYear: number;
  malwareStatus: MalwareScanStatus;
  malwareNotice: string;
  isQuarantined: boolean;
  reviewStatus: DocumentReviewStatus;
  version: number;
  retentionExpiresAt: string;
  chainOfCustody: ChainOfCustodyEntry[];
  downloadUrl?: string;
}

export interface ExtractedField {
  id: string;
  fieldName: string;
  fieldLabel: string;
  extractedValue: string | number;
  sourceDocumentId: string;
  sourceDocumentName: string;
  sourcePageNumber: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  confidenceScore: number; // 0.00 - 1.00
  provider: 'gemini-flash' | 'google-document-ai' | 'azure-doc-intelligence' | 'aws-textract';
  modelVersion: string;
  extractedAt: string;
  requiresHumanReview: boolean;
  isMaterialField: boolean; // e.g. SSN, Taxable Income, Withholding
  humanReviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  correctedValue?: string | number;
  correctionReason?: string;
  correctionHistory: Array<{
    previousValue: string | number;
    newValue: string | number;
    changedBy: string;
    changedAt: string;
    reason: string;
  }>;
}

export interface TaxGuardExtractionDossier {
  id: string;
  tenantId: string;
  documentId: string;
  clientId: string;
  taxYear: number;
  formDetected: DocumentCategory;
  fields: ExtractedField[];
  overallConfidence: number;
  status: 'pending_review' | 'partially_verified' | 'fully_approved' | 'escalated';
  lastProcessedAt: string;
}

export type DiscrepancySeverity = 'informational' | 'requires_review' | 'high_variance' | 'critical_blocker';

export interface TaxGuardDiscrepancy {
  id: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  ruleCode: string; // e.g. QC-001
  category: 'identity' | 'income' | 'balance' | 'deduction' | 'multi_state' | 'compliance';
  severity: DiscrepancySeverity;
  title: string;
  neutralDescription: string;
  affectedDocuments: string[];
  affectedFields: string[];
  recommendedAction: string;
  status: 'open' | 'under_investigation' | 'justified_by_preparer' | 'resolved' | 'dismissed';
  identifiedAt: string;
  reviewedBy?: string;
  reviewerNotes?: string;
  resolvedAt?: string;
}

export interface TaxGuardMissingItem {
  id: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  requiredItemName: string;
  reasonNeeded: string;
  relatedFormOrSchedule: string;
  priority: 'routine' | 'important' | 'deadline_critical';
  dueDate: string;
  status: 'pending_client' | 'received_pending_review' | 'verified_complete' | 'waived_by_cpa';
  clientResponseNote?: string;
  submittedDocumentId?: string;
  staffReviewerNote?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TaxGuardExpenseItem {
  id: string;
  tenantId: string;
  clientId: string;
  transactionDate: string;
  payee: string;
  amount: number;
  sourceDocId?: string;
  proposedAccountCategory: string; // e.g. "Line 24b - Deductible Meals (50%)"
  taxTreatment: 'deductible' | 'partially_deductible_50' | 'capitalized' | 'non_deductible_personal' | 'requires_clarification';
  confidenceScore: number;
  aiExplanation: string;
  approvalStatus: 'pending' | 'preparer_approved' | 'reviewer_certified' | 'rejected';
  approvedAccountCategory?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DraftWorkpaper {
  id: string;
  tenantId: string;
  engagementId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  formType: TaxReturnFormType;
  version: number;
  isDraft: boolean; // Must be true until final CPA approval
  watermarkText: string; // "DRAFT – NOT APPROVED FOR FILING"
  preparedBy: string;
  preparedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  cpaApprover?: string;
  cpaApprovedAt?: string;
  sourceDocumentIndex: Array<{ id: string; name: string; category: DocumentCategory; verified: boolean }>;
  scheduleTotals: {
    totalGrossIncome: number;
    totalAdjustments: number;
    adjustedGrossIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    totalFederalWithholding: number;
    totalEstimatedPayments: number;
    preliminaryTaxLiability: number;
    estimatedRefundOrDue: number;
  };
  m1Reconciliation?: {
    bookNetIncome: number;
    federalTaxExpense: number;
    taxExemptInterest: number;
    depreciationVariance: number;
    taxableNetIncomePerReturn: number;
  };
  openQuestions: string[];
  reviewerNotes: string[];
  cryptographicHash?: string;
  qrVerificationId?: string;
}

export type ApprovalRiskTier = 'informational' | 'routine' | 'material' | 'high_risk' | 'filing_critical';

export interface MakerCheckerReviewStep {
  stepNumber: number;
  stepName: string;
  description: string;
  requiredRole: string;
  riskTier: ApprovalRiskTier;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  signoffNotes?: string;
  requiresDualAuthorization?: boolean;
}

export interface TaxGuardEngagementCase {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  entityType: 'Individual' | 'S-Corporation' | 'C-Corporation' | 'Partnership' | 'Single-Member LLC';
  taxYear: number;
  returnType: TaxReturnFormType;
  jurisdictions: string[]; // e.g. ["Federal", "SC", "NC"]
  assignedPreparer: string;
  assignedReviewer: string;
  assignedCpa: string;
  status: 'intake' | 'document_collection' | 'extraction_review' | 'workpaper_prep' | 'cpa_review' | 'client_signing' | 'ready_for_filing' | 'completed';
  priority: 'normal' | 'expedited' | 'urgent_statute';
  internalDeadline: string;
  filingDeadline: string;
  clientProgressPercent: number;
  missingItemsCount: number;
  discrepanciesCount: number;
  makerCheckerSteps: MakerCheckerReviewStep[];
  lockedFinalPackage: boolean;
  finalPackageHash?: string;
  verificationId?: string;
}

export interface PublicVerificationRecord {
  verificationId: string;
  documentType: string;
  issuingOrganization: string;
  jurisdiction: string;
  issueDate: string;
  version: number;
  status: 'valid' | 'revoked' | 'replaced' | 'expired' | 'not_found';
  cryptographicSha256: string;
  authorizedSignatoryTitle: string;
  // Notice: NO confidential taxpayer names, SSNs, financial figures, or addresses are stored here.
}

export interface TaxGuardAuditEntry {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  recordType: 'case' | 'document' | 'extraction' | 'workpaper' | 'approval' | 'verification' | 'governance' | 'auth' | 'billing' | 'report' | 'engagement' | 'plan' | 'notice' | 'task';
  recordId: string;
  timestamp: string;
  beforeStateRef?: string;
  afterStateRef?: string;
  ipAddress: string;
  correlationId: string;
  result: 'success' | 'denied' | 'error';
  riskLevel: 'routine' | 'material' | 'high_risk' | 'critical';
  details: string;
}

export interface TaxResearchSource {
  id: string;
  sourceName: string;
  sourceUrl: string;
  responsibleAgency: 'IRS' | 'U.S. Treasury' | 'SC Department of Revenue' | 'SEC' | 'FinCEN' | 'U.S. DOL';
  jurisdiction: 'Federal' | 'South Carolina' | 'North Carolina' | 'Multi-State';
  applicableTaxYear: number;
  publicationDate: string;
  lastVerifiedDate: string;
  status: 'verified_active' | 'expiring_soon' | 'archived_superseded' | 're_verification_required';
  verifiedBy: string;
  summary: string;
}

export interface AiGovernanceModelRecord {
  modelId: string;
  displayName: string;
  provider: string;
  version: string;
  dataClassificationAllowed: 'Public & De-Identified' | 'Redacted Tax Metadata' | 'No Raw SSN Permitted';
  promptVersion: string;
  nistRmfCategory: 'Govern' | 'Map' | 'Measure' | 'Manage';
  humanReviewRequirement: 'Mandatory Prior to Material Conclusion' | 'Informational Suggestions Only';
  riskClassification: 'Medium - Regulated Financial Data';
  deploymentDate: string;
  owner: string;
  lastReviewDate: string;
  status: 'active' | 'disabled_by_cpa' | 'evaluation';
}

// Field Mapping Engine Types
export interface TaxGuardFieldMapping {
  id: string;
  sourceDocId: string;
  sourceDocName: string;
  sourcePageNumber: number;
  extractedFieldName: string;
  extractedValue: string | number;
  normalizedRecordKey: string;
  accountingCategory: string;
  workpaperField: string;
  taxFormLine: string;
  taxYear: number;
  confidenceScore: number;
  mappingRule: string;
  ruleVersion: string;
  reviewerDecision: 'proposed' | 'preparer_accepted' | 'reviewer_certified' | 'rejected';
  isMaterial: boolean;
  approvalStatus: 'pending_review' | 'preparer_approved' | 'reviewer_locked';
  reviewedBy?: string;
  reviewedAt?: string;
  correctionHistory: Array<{
    previousDestination: string;
    newDestination: string;
    changedBy: string;
    changedAt: string;
    reason: string;
  }>;
}

export interface TaxGuardSmartFormTemplate {
  formId: string;
  formName: string;
  taxYear: number;
  formType: TaxReturnFormType;
  lines: Array<{
    lineNumber: string;
    lineDescription: string;
    suggestedValue: string | number;
    sourceCitation: string;
    sourceDocId: string;
    confidence: number;
    isMaterial: boolean;
    isMissingRequired: boolean;
    hasSourceConflict: boolean;
    conflictNotes?: string;
    status: 'proposed' | 'preparer_confirmed' | 'reviewer_locked';
    reviewedBy?: string;
  }>;
}

// Document Summaries Types
export interface TaxGuardDocumentSummary {
  id: string;
  documentId: string;
  documentName: string;
  documentCategory: DocumentCategory;
  taxpayerName: string;
  taxYear: number;
  issuerOrPayer: string;
  recipient: string;
  importantDates: string[];
  keyAmounts: Array<{ label: string; amount: number; formatted: string }>;
  clientFriendlySummary: string;
  professionalTechnicalSummary: string;
  potentialTaxAccountingRelationships: string[];
  missingPagesOrFields: string[];
  detectedInconsistencies: string[];
  questionsForClient: string[];
  questionsForProfessionalReview: string[];
  overallConfidence: number;
  sourcePageReferences: string[];
  statutoryNotice: string;
  generatedAt: string;
}

// Document Scanner Types
export interface ScannedDocumentPage {
  id: string;
  pageNumber: number;
  previewDataUrl: string;
  rotationDegrees: 0 | 90 | 180 | 270;
  cropBounds?: { top: number; right: number; bottom: number; left: number };
  filterMode: 'original' | 'high_contrast' | 'black_and_white' | 'brighten';
  isBlankDetected: boolean;
}

export interface ControlledScanPackage {
  id: string;
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  captureMethod: 'device_camera' | 'file_upload';
  pageCount: number;
  originalFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256Digest: string;
  createdAt: string;
  uploadedBy: string;
  uploadedByRole: string;
  securityState: MalwareScanStatus;
  processingState: 'captured' | 'quarantined' | 'classification_queued' | 'ready_for_review';
  pages: ScannedDocumentPage[];
}

// Document Classification Types
export interface DocumentClassificationDetail {
  id: string;
  documentId: string;
  documentName: string;
  proposedCategory: DocumentCategory;
  alternativeCategory: DocumentCategory;
  confidenceScore: number;
  explanation: string;
  detectedTaxYear: number;
  detectedTaxpayerOrEntity: string;
  applicableEngagementId: string;
  classificationModel: string;
  modelVersion: string;
  processedAt: string;
  reviewStatus: 'proposed' | 'human_confirmed' | 'human_corrected';
  confirmedCategory?: DocumentCategory;
  reviewer?: string;
  reviewerNotes?: string;
  // Auto-sorting metadata
  proposedClient: string;
  proposedEntity: string;
  proposedWorkflowDestination: string;
  proposedRetentionCategory: 'Permanent Tax Records' | '7-Year Statutory' | 'Routine Supporting';
  reviewPriority: 'Routine' | 'High-Variance' | 'Urgent Missing Item';
  sensitivityLevel: 'Confidential Taxpayer Data (IRC § 7216)';
}

// Evidence Library Types
export interface EvidenceLibraryItem {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  engagementId: string;
  taxYear: number;
  category: DocumentCategory;
  documentId: string;
  documentName: string;
  pageNumber: number;
  extractedFieldKey: string;
  extractedValue: string | number;
  provenanceTrail: {
    uploadedAt: string;
    sha256Hash: string;
    extractedAt: string;
    verifiedBy: string;
    verifiedAt: string;
    version: number;
  };
  workflowUsages: string[]; // e.g. ["Form 1040 Line 1z", "Schedule C Reconciliation", "M-1 Book Adjustment"]
  retentionCategory: string;
  legalHold: boolean;
  status: 'active_approved' | 'superseded' | 'pending_verification';
}

// Case Management Tasks
export interface CaseTask {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  completed: boolean;
  dependencies?: string[];
  isBlocker?: boolean;
}
