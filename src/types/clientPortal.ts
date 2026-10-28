/**
 * A/R TAX SERVICES, LLC - Client Portal Architecture Data Models & State Machine
 * 
 * Compliant with:
 * - IRS Publication 4557 (Safeguarding Taxpayer Data)
 * - IRC § 7216 (Consent to Disclose/Use Tax Return Information)
 * - MeF (Modernized e-File) Workflow Standards
 * - FinCEN Corporate Transparency Act
 */

import { UserRole } from './index';

// ---------------------------------------------------------------------------
// 1. Versioned Workflow Engine & Core Tax Lifecycle States
// ---------------------------------------------------------------------------

export type TaxWorkflowState =
  | 'NOT_STARTED'
  | 'PROFILE_CONFIRMATION'
  | 'INTAKE_IN_PROGRESS'
  | 'DOCUMENTS_REQUIRED'
  | 'DATA_PROCESSING'
  | 'CLIENT_CLARIFICATION'
  | 'BOOKS_RECONCILIATION'
  | 'STRATEGY_REVIEW'
  | 'RETURN_PREPARATION'
  | 'ACCOUNTANT_REVIEW'
  | 'CLIENT_REVIEW'
  | 'CLIENT_AUTHORIZATION_REQUIRED'
  | 'REVIEWER_APPROVAL'
  | 'READY_TO_FILE'
  | 'TRANSMITTED'
  | 'IRS_PENDING'
  | 'STATE_PENDING'
  | 'ACCEPTED'
  | 'PARTIALLY_ACCEPTED'
  | 'REJECTED'
  | 'CORRECTION_REQUIRED'
  | 'AMENDMENT_REQUIRED'
  | 'POST_FILING'
  | 'ARCHIVED'
  | 'NEXT_YEAR_PREPARATION';

export type ClientFacingLifecycleStage =
  | 'Intake'
  | 'Records'
  | 'Preparation'
  | 'Review'
  | 'Authorization'
  | 'Filing'
  | 'Accepted'
  | 'Post-Filing';

export interface WorkflowStateTransition {
  id: string;
  engagementId: string;
  taxYear: number;
  previousState: TaxWorkflowState;
  newState: TaxWorkflowState;
  responsibleRole: UserRole;
  actorIdentity: {
    userId: string;
    userName: string;
    role: string;
    email: string;
  };
  timestamp: string;
  reason: string;
  relatedDocumentIds?: string[];
  sourceDevice: {
    browser: string;
    os: string;
    ipAddressMasked: string;
  };
  correlationId: string;
  tamperEvidentEventHash: string; // SHA-256 hash of previousHash + event data
  previousEventHash?: string;
}

// ---------------------------------------------------------------------------
// 2. Client Navigation Modules
// ---------------------------------------------------------------------------

export type ClientPortalModule =
  | 'overview'
  | 'workspace'
  | 'approvals'
  | 'messages'
  | 'billing'
  | 'profile_security';

export type ClientPortalTab = 
  | 'overview'
  | 'organizer'
  | 'vault'
  | 'returns'
  | 'invoices'
  | 'messages'
  | 'calendar'
  | 'profile'
  | 'workspace'
  | 'client_intake'
  | 'required_documents'
  | 'document_center'
  | 'documents'
  | 'accounting_connections'
  | 'integrations'
  | 'tax_strategies'
  | 'tax_return'
  | 'reports'
  | 'approvals'
  | 'requests'
  | 'appointments'
  | 'notifications'
  | 'billing'
  | 'profile_security'
  | 'onboarding';

export type TaxWorkspaceTab =
  | 'intake'
  | 'documents'
  | 'expenses'
  | 'books_records'
  | 'financial_connections'
  | 'strategy'
  | 'return_review'
  | 'filing_status'
  | 'post_filing'
  | 'prior_years'
  | 'amendment'
  | 'business_closure';

export type ApprovalsTab =
  | 'pending'
  | 'filing_auth'
  | 'consent_records'
  | 'engagements'
  | 'history';

export type MessagesTab =
  | 'conversations'
  | 'requests_for_info'
  | 'appointments'
  | 'consultation_room'
  | 'notifications';

export type ProfileSecurityTab =
  | 'taxpayer_profile'
  | 'business_entity'
  | 'dependents_reps'
  | 'connected_accounts'
  | 'storage_selection'
  | 'devices_sessions'
  | 'mfa_security'
  | 'privacy_consent'
  | 'audit_activity'
  | 'data_export_closure';

// ---------------------------------------------------------------------------
// 3. Document Extraction Provenance & Classification
// ---------------------------------------------------------------------------

export interface ExtractedFact {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fieldKey: string;
  fieldLabel: string;
  extractedValue: string | number;
  confidenceScore: number; // 0 to 100
  extractionTimestamp: string;
  modelIdentifier: string; // e.g. "ar-tax-ocr-v2.4"
  reviewerStatus: 'unreviewed' | 'confirmed_by_accountant' | 'adjusted_by_accountant' | 'flagged';
  humanCorrection?: {
    correctedBy: string;
    originalValue: string | number;
    correctedValue: string | number;
    correctionTimestamp: string;
    correctionReason: string;
  };
}

export interface ClientDocumentRecord {
  id: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  sha256Digest: string;
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  storageProvider: 'platform_vault' | 'google_drive' | 'one_drive' | 'aws_s3';
  storagePath: string;
  malwareScanStatus: 'clean' | 'scanning' | 'quarantined' | 'service_unavailable';
  malwareScanTimestamp?: string;
  retentionScheduleYears: number;
  legalHoldActive: boolean;
  extractedFacts: ExtractedFact[];
}

// ---------------------------------------------------------------------------
// 4. Approvals, Consents & Form 8879 Authorization
// ---------------------------------------------------------------------------

export type ApprovalType =
  | 'form_8879_filing_auth'
  | 'state_filing_auth'
  | 'irc_7216_consent'
  | 'engagement_agreement'
  | 'payment_authorization'
  | 'strategy_acknowledgment'
  | 'prior_year_amendment_auth';

export interface ApprovalRecord {
  id: string;
  clientId: string;
  taxYear: number;
  approvalType: ApprovalType;
  title: string;
  description: string;
  status: 'pending_client_signature' | 'approved' | 'rejected' | 'superseded';
  documentVersionId: string;
  documentSha256: string;
  exactConsentLanguage: string;
  signerName: string;
  signerEmail: string;
  signerRole: 'primary_taxpayer' | 'spouse_taxpayer' | 'officer' | 'authorized_rep';
  authStrength: 'password_and_totp_verified' | 'identity_verified_email_pin';
  signedTimestamp?: string;
  timeZone?: string;
  ipAddressMasked?: string;
  deviceFingerprintMasked?: string;
  tamperEvidentHashChain: string;
  certificateDownloadUrl?: string;
  reviewerSignoff?: {
    reviewerName: string;
    reviewerRole: string;
    reviewerTimestamp: string;
    reviewerNotes: string;
  };
}

// ---------------------------------------------------------------------------
// 5. Accounting & Ledger Integrations
// ---------------------------------------------------------------------------

export type AccountingPlatform = 'quickbooks_online' | 'xero' | 'freshbooks' | 'manual_ledger';

export interface AccountingConnector {
  id: string;
  clientId: string;
  platform: AccountingPlatform;
  platformName: string;
  connectedEntityName: string;
  authMethod: 'oauth_2_read_only';
  status: 'connected' | 'syncing' | 'disconnected' | 'auth_expired';
  grantedScopes: string[];
  lastSyncTimestamp: string;
  syncRecordCounts: {
    accounts: number;
    transactions: number;
    reconciledCount: number;
    pendingClarificationCount: number;
  };
  proposedAdjustments: LedgerAdjustment[];
}

export interface LedgerAdjustment {
  id: string;
  date: string;
  accountName: string;
  description: string;
  proposedDebit: number;
  proposedCredit: number;
  taxReason: string;
  status: 'draft_proposal' | 'client_reviewed' | 'posted_to_workpaper' | 'rejected';
}

// ---------------------------------------------------------------------------
// 6. Tax Strategy Specifications
// ---------------------------------------------------------------------------

export interface TaxStrategyItem {
  id: string;
  title: string;
  applicableEntity: string;
  taxYear: number;
  objective: string;
  relevantAuthority: string; // e.g. "IRC § 179 / § 168(k)" or "IRC § 199A"
  eligibilityConditions: string[];
  requiredEvidence: string[];
  estimatedScenarioSavings: {
    conservative: number;
    moderate: number;
    disclaimer: string;
  };
  risksAndLimitations: string[];
  implementationSteps: string[];
  responsibleProfessional: string;
  reviewDate: string;
  clientAcknowledgmentStatus: 'pending' | 'acknowledged' | 'deferred';
  clientAcknowledgedTimestamp?: string;
  status: 'draft' | 'approved_by_cpa' | 'in_execution' | 'completed';
}

// ---------------------------------------------------------------------------
// 7. Jurisdiction-Aware Deadlines & Regulatory Guidance
// ---------------------------------------------------------------------------

export interface JurisdictionDeadline {
  id: string;
  jurisdiction: 'Federal' | 'State' | 'Local';
  agencyName: string; // e.g. "IRS" or "South Carolina Department of Revenue"
  obligationTitle: string;
  formNumber: string; // "Form 1040", "Form 1120-S", "Form SC1040", "1040-ES Q1"
  statutoryDueDate: string;
  adjustedDueDate: string; // adjusted for weekend or Emancipation Day
  extensionAvailable: boolean;
  extensionForm?: string;
  extendedDueDate?: string;
  daysRemaining: number;
  urgency: 'critical' | 'upcoming' | 'normal' | 'past_due' | 'filed';
  penaltyNotice: string;
}

export interface RegulatoryUpdateItem {
  id: string;
  sourceUrl: string;
  title: string;
  agency: string;
  publicationDate: string;
  effectiveDate: string;
  jurisdiction: string;
  taxYear: number;
  contentHash: string;
  impactSummary: string;
  actionRequired: boolean;
  actionInstructions?: string;
  professionalReviewStatus: 'reviewed_and_approved' | 'in_review';
  reviewedBy?: string;
}

// ---------------------------------------------------------------------------
// 8. Electronic Filing & Government Acknowledgment
// ---------------------------------------------------------------------------

export interface FilingSubmissionDetails {
  submissionId: string;
  taxYear: number;
  jurisdiction: 'Federal (IRS)' | 'South Carolina (SCDOR)' | 'North Carolina (NCDOR)' | 'Georgia (GDOR)';
  formType: string;
  transmissionTimestamp: string;
  transmissionChannel: 'MeF_Authorized_Transmitter';
  efinMasked: string;
  status: 'transmitted' | 'pending_irs' | 'pending_state' | 'accepted' | 'rejected' | 'correction_required';
  submissionTrackingNumber: string;
  acknowledgmentTimestamp?: string;
  officialAcceptanceCode?: string;
  rejectionDetails?: {
    errorCode: string;
    officialMessage: string;
    plainLanguageExplanation: string;
    correctionSteps: string[];
    assignedSpecialist: string;
  };
}

// ---------------------------------------------------------------------------
// 9. Business-Closure Workflow
// ---------------------------------------------------------------------------

export interface BusinessClosureStep {
  id: string;
  title: string;
  category: 'federal_tax' | 'state_dissolution' | 'payroll_contractor' | 'asset_inventory' | 'accounts_closure';
  description: string;
  completed: boolean;
  requiresCpaReview: boolean;
  notes?: string;
  substantiatingDocumentIds?: string[];
}

export interface BusinessClosureWorkflow {
  id: string;
  entityName: string;
  einMasked: string;
  stateOfFormation: string;
  targetClosureDate: string;
  status: 'not_initiated' | 'in_progress' | 'cpa_review' | 'ready_for_filing' | 'completed';
  steps: BusinessClosureStep[];
}

// ---------------------------------------------------------------------------
// 10. Offline Event Synchronization Engine
// ---------------------------------------------------------------------------

export interface SyncEvent {
  eventId: string;
  clientId: string;
  deviceId: string;
  localSequenceNumber: number;
  createdAt: string;
  idempotencyKey: string;
  actionType: 'intake_autosave' | 'document_staged' | 'clarification_response' | 'client_comment' | 'preference_update';
  payload: Record<string, any>;
  status: 'pending_local' | 'synced' | 'conflict_detected' | 'quarantined';
  conflictResolution?: {
    serverTimestamp: string;
    resolutionNote: string;
    requiresHumanReview: boolean;
  };
}

export interface SyncQueueState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedTimestamp: string;
  pendingLocalCount: number;
  conflictsCount: number;
}

// ---------------------------------------------------------------------------
// 11. Tamper-Evident Audit Event Trail
// ---------------------------------------------------------------------------

export interface AuditEventRecord {
  id: string;
  timestamp: string;
  actor: {
    userId: string;
    userName: string;
    role: string;
  };
  action: 
    | 'SIGN_IN'
    | 'SIGN_OUT'
    | 'VIEW_SENSITIVE_RECORD'
    | 'DOCUMENT_UPLOAD'
    | 'DOCUMENT_DOWNLOAD'
    | 'OCR_EXTRACTION_COMPLETED'
    | 'HUMAN_FIELD_CORRECTION'
    | 'CLIENT_COMMENT_SUBMITTED'
    | 'FORM_8879_AUTHORIZED'
    | 'SENIOR_REVIEWER_SIGNOFF'
    | 'MEF_TRANSMISSION_INITIATED'
    | 'GOVERNMENT_ACKNOWLEDGMENT_RECORDED'
    | 'OFFLINE_EVENT_SYNCED'
    | 'STORAGE_PLAN_CHANGED'
    | string;
  targetResource: string;
  resourceId: string;
  ipAddressMasked: string;
  tamperEvidentHash: string;
  // Audit UI & Reporting Extensions
  eventCategory?: 'auth' | 'consent' | 'document' | 'signing' | 'security' | 'export' | string;
  actorEmail?: string;
  actorRole?: string;
  actorIpAddress?: string;
  actorUserAgent?: string;
  eventHash?: string;
  resourceTarget?: string;
}

// ---------------------------------------------------------------------------
// 12. Expense Records & Substantiation (Prompt Section 5)
// ---------------------------------------------------------------------------

export type ExpenseCategory =
  | 'advertising'
  | 'vehicle_mileage'
  | 'commissions_fees'
  | 'contract_labor'
  | 'depreciation_section_179'
  | 'employee_benefits'
  | 'insurance'
  | 'interest_mortgage_business'
  | 'legal_professional'
  | 'office_expense'
  | 'pension_profit_sharing'
  | 'rent_lease_vehicles_machinery'
  | 'rent_lease_other_business_property'
  | 'repairs_maintenance'
  | 'supplies'
  | 'taxes_licenses'
  | 'travel'
  | 'meals_50_percent'
  | 'utilities'
  | 'other_expenses';

export interface ExpenseItem {
  id: string;
  clientId: string;
  taxYear: number;
  entityName: string;
  date: string;
  vendor: string;
  amount: number;
  currency: 'USD';
  paymentMethod: 'business_card' | 'bank_transfer' | 'cash' | 'check' | 'personal_funds_reimbursable';
  category: ExpenseCategory;
  businessPurpose: string;
  receiptDocumentId?: string;
  receiptFileName?: string;
  notes?: string;
  classificationOrigin: 'client_entered' | 'ai_suggested' | 'accounting_import';
  aiSuggestedCategory?: ExpenseCategory;
  professionalReviewStatus: 'unreviewed' | 'accountant_approved' | 'adjusted_by_accountant' | 'flagged_for_client';
  accountantNotes?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 13. Cash Transactions & Perjury Certification (Prompt Section 6)
// ---------------------------------------------------------------------------

export type CashTransactionType =
  | 'cash_income'
  | 'cash_expense'
  | 'petty_cash_activity'
  | 'owner_contribution'
  | 'owner_distribution'
  | 'reimbursement'
  | 'bank_deposit'
  | 'cash_withdrawal'
  | 'other_cash_movement';

export interface CashTransactionItem {
  id: string;
  clientId: string;
  taxYear: number;
  entityName: string;
  date: string;
  amount: number;
  direction: 'inflow' | 'outflow';
  transactionType: CashTransactionType;
  counterparty: string; // Source or Recipient
  businessPurpose: string;
  supportingEvidenceDocId?: string;
  supportingEvidenceFileName?: string;
  explanationWhenNoReceipt: string;
  clientPerjuryCertified: boolean;
  certifiedTimestamp?: string;
  signerLegalName?: string;
  status: 'pending_substantiation' | 'submitted_to_cpa' | 'verified_by_accountant' | 'reconciliation_required';
  cpaAuditNotes?: string;
}

// ---------------------------------------------------------------------------
// 14. Mileage & Asset Tracking (Prompt Section 5)
// ---------------------------------------------------------------------------

export interface MileageLogItem {
  id: string;
  clientId: string;
  taxYear: number;
  date: string;
  vehicleDescription: string;
  startLocation: string;
  endLocation: string;
  businessPurpose: string;
  startingOdometer: number;
  endingOdometer: number;
  totalMiles: number;
  standardMileageRate: number; // e.g. 0.67 for 2024/2025 IRS standard rate
  calculatedDeduction: number;
  substantiationStatus: 'logged' | 'verified_by_accountant';
}

export interface FixedAssetRecord {
  id: string;
  clientId: string;
  entityName: string;
  taxYearAcquired: number;
  assetDescription: string;
  assetCategory: 'equipment_machinery' | 'computers_software' | 'vehicles' | 'office_furniture' | 'building_leasehold';
  acquisitionDate: string;
  costBasis: number;
  businessUsePercentage: number;
  section179ElectionRequested: boolean;
  specialDepreciationAllowance: boolean;
  professionalDepreciationStatus: 'draft' | 'depreciated_form_4562';
}

// ---------------------------------------------------------------------------
// 15. Missing-Document Checklist (Prompt Section 11)
// ---------------------------------------------------------------------------

export type MissingDocStatus =
  | 'NOT_REQUESTED'
  | 'REQUESTED'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'NEEDS_CLARIFICATION'
  | 'ACCEPTED_FOR_REVIEW'
  | 'SUPERSEDED'
  | 'WAIVED_BY_PROFESSIONAL';

export interface MissingDocumentItem {
  id: string;
  clientId: string;
  taxYear: number;
  entityName: string;
  title: string;
  category: string;
  reasonRequired: string;
  dueDate: string;
  status: MissingDocStatus;
  urgency: 'critical' | 'normal' | 'optional';
  uploadedDocumentId?: string;
  uploadedFileName?: string;
  uploadedTimestamp?: string;
  clarifications: Array<{
    id: string;
    author: string;
    role: 'client' | 'accountant';
    timestamp: string;
    message: string;
  }>;
}

// ---------------------------------------------------------------------------
// 16. Bank & Financial-Source Connections (Prompt Section 8)
// ---------------------------------------------------------------------------

export interface FinancialInstitutionConnector {
  id: string;
  institutionName: string;
  institutionType: 'bank' | 'merchant_processor' | 'payroll' | 'brokerage';
  accountMask: string;
  accountTypeLabel: string;
  authMethod: 'oauth_2_read_only_aggregator';
  status: 'connected' | 'syncing' | 'needs_reauth' | 'disconnected';
  lastSyncDate: string;
  syncFrequency: 'daily_automatic' | 'manual_refresh';
  dataScopesRequested: string[];
  retentionPolicy: string;
  balance?: number;
}

// ---------------------------------------------------------------------------
// 17. Amendment Requests (Prompt Section 22)
// ---------------------------------------------------------------------------

export interface AmendmentRequestItem {
  id: string;
  clientId: string;
  taxYear: number;
  originalReturnDescription: string;
  statutoryForm: 'Form 1040-X' | 'Form 1120-S (Amended)' | 'Form 1065 (Amended)' | 'Form SC1040 (Amended)';
  reasonForAmendment: string;
  changeDetails: string;
  hasGovernmentNotice: boolean;
  noticeDetails?: string;
  attachedSupportingDocs: Array<{ name: string; size: string; date: string }>;
  clientCertifiedUnderPerjury: boolean;
  submittedAt: string;
  status: 'submitted_to_cpa' | 'in_technical_review' | 'amendment_workpaper_in_progress' | 'ready_for_client_authorization' | 'transmitted';
  cpaAssignedNotes?: string;
}
