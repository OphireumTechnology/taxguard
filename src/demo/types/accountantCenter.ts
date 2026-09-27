/**
 * A/R Tax Services, LLC - Accountant Tax Preparation & Review Center Types
 * Comprehensive data contracts for consolidated documents, workpapers,
 * AI extractions, exceptions, hard-stop readiness, and demo filing records.
 */

export type TaxYearOption = 2026 | 2025 | 2024 | 2023;

export type DocumentCategory = 
  | '01 — Income (W-2, 1099, SSA)'
  | '02 — Business (P&L, Balance Sheet, Expenses)'
  | '03 — Rental Property (Income & Deductions)'
  | '04 — Investments & Capital Gains (1099-B, Crypto)'
  | '05 — Deductions & Itemized Credits (1098, Charity, Medical)'
  | '06 — Tax Payments & Withholding (Estimated, Vouchers)'
  | '07 — Prior Year Tax Returns & Archive'
  | '08 — International & Foreign Reporting (FBAR, 8938)'
  | '09 — Entity & Organizational Documents (EIN, Org Chart)'
  | '10 — Notices, Transcripts & Controversies';

export type DocumentProcessingStatus = 
  | 'Uploaded'
  | 'Processing'
  | 'OCR Complete'
  | 'AI Classification Complete'
  | 'Extraction Complete';

export type DocumentReviewStatus = 
  | 'Pending Review'
  | 'Accountant Review Required'
  | 'Low Confidence'
  | 'Needs Clarification'
  | 'Needs Correction'
  | 'Approved'
  | 'Rejected'
  | 'Superseded'
  | 'Archived';

export type DocumentQualityStatus = 
  | 'Complete'
  | 'Missing Pages'
  | 'Poor Quality'
  | 'Duplicate'
  | 'Possible Duplicate'
  | 'Tax-Year Mismatch'
  | 'Wrong Taxpayer'
  | 'Wrong Business'
  | 'Wrong Property';

export interface ExtractedField {
  label: string;
  boxNumber?: string;
  originalAiValue: string | number;
  verifiedValue: string | number;
  confidence: number;
  isModified: boolean;
  modificationReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface ConsolidatedDocument {
  id: string;
  clientId: string;
  clientName: string;
  taxYear: TaxYearOption;
  category: DocumentCategory;
  documentType: string; // e.g. "Form W-2", "Form 1099-NEC", "Form 1099-B", "Schedule C P&L"
  formNumber: string; // e.g. "Form W-2", "Form 1099-DIV", "Form 1098"
  taxpayer: string;
  spouse?: string;
  dependent?: string;
  business?: string;
  property?: string;
  payerEmployer: string;
  institution?: string;
  accountType?: string;
  documentDate: string;
  taxPeriod: string;
  federalAmount: number;
  stateAmount: number;
  federalWithholding: number;
  stateWithholding: number;
  localWithholding: number;
  sourceFile: string;
  pageNumber: number;
  totalPages: number;
  aiConfidence: number; // 0-100
  processingStatus: DocumentProcessingStatus;
  reviewStatus: DocumentReviewStatus;
  duplicateStatus: 'Not Duplicate' | 'Duplicate' | 'Possible Duplicate';
  qualityStatus: DocumentQualityStatus;
  taxYearMatchStatus: 'Matched' | 'Potential Mismatch' | 'Review Required';
  accountantNotes: string; // Private internal note
  clientVisibleNotes?: string; // Note exposed to client
  clientVisibility: 'Visible' | 'Internal Only';
  uploadedBy: string;
  uploadedDate: string;
  lastReviewed?: string | null;
  reviewer?: string | null;
  extractedFields: ExtractedField[];
  previewUrl?: string;
  version: 'Original' | 'Corrected' | 'Replacement' | 'Superseded';
}

export type ExceptionPriority = 'HIGH' | 'REVIEW' | 'INFO';

export type ExceptionDisposition = 
  | 'OPEN'
  | 'RESOLVED'
  | 'NOT_APPLICABLE'
  | 'CLIENT_CLARIFICATION_REQUIRED'
  | 'CORRECTED'
  | 'ESCALATED';

export interface AiExceptionItem {
  id: string;
  clientId: string;
  taxYear: TaxYearOption;
  title: string;
  description: string;
  priority: ExceptionPriority;
  category: 
    | 'Tax-Year Mismatch'
    | 'Possible Duplicate'
    | 'Missing Pages'
    | 'Wrong Taxpayer'
    | 'Information Mismatch'
    | 'Unclassified Document'
    | 'Low Confidence'
    | 'Prior-Year Discrepancy'
    | 'Missing Supporting Documentation'
    | 'Possible Missing Income'
    | 'New Business'
    | 'New Property'
    | 'New Investment Account'
    | 'New Dependent'
    | 'Foreign Information Indicator';
  relatedDocumentId?: string;
  relatedDocumentName?: string;
  disposition: ExceptionDisposition;
  status?: string;
  severity?: string;
  impactOnPreparation?: string;
  resolutionNote?: string;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  blockingHardStop: boolean;
}

export type AiExceptionRecord = AiExceptionItem;

export interface MissingDocumentItem {
  id: string;
  clientId: string;
  taxYear: TaxYearOption;
  itemName: string;
  documentTitle?: string;
  formNumber?: string;
  category: 
    | 'CRITICAL / ACCOUNTANT REVIEW'
    | 'CLIENT FOLLOW-UP REQUIRED'
    | 'RECOMMENDED SUPPORTING DOCUMENTATION'
    | 'POTENTIALLY NOT APPLICABLE'
    | 'UNRESOLVED AI CLASSIFICATION';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  reason: string;
  reasonIdentified?: string;
  requestedDate?: string;
  dueDate?: string;
  clientStatus: 'Not Sent' | 'Pending' | 'Uploaded' | 'Waived' | string;
  accountantStatus: 'Action Required' | 'Requested' | 'Resolved' | 'N/A' | string;
  notes?: string;
  accountantNotes?: string;
  blockingHardStop: boolean;
}

export type MissingDocumentRecord = MissingDocumentItem;

export interface PriorYearComparisonItem {
  id: string;
  clientId: string;
  area: 
    | 'Identity & Filing Status'
    | 'Dependents'
    | 'Wage & Salary Employers'
    | '1099 Business Receipts'
    | 'Rental Properties'
    | 'Brokerage & Capital Gains'
    | 'Itemized Deductions'
    | 'Tax Credits'
    | 'Carryforwards'
    | 'Estimated Payments'
    | 'State & Local Filings'
    | 'IRS Notices / Examination'
    | string;
  itemLabel: string;
  priorYearValue: string;
  previousValue?: string;
  currentYearValue: string;
  currentValue?: string;
  differenceDescription: string;
  difference?: string;
  source?: string;
  aiExplanation: string;
  accountantReviewStatus: 'ACCOUNTANT REVIEW REQUIRED' | 'VERIFIED & RECONCILED' | 'NOT APPLICABLE' | string;
  accountantNotes?: string;
  requiresReview: boolean;
}

export interface IncomeWorkpaperItem {
  id: string;
  sourceDocId: string;
  sourceDocName: string;
  incomeType: 
    | 'W-2 Wage Statement'
    | '1099-NEC Nonemployee Comp'
    | '1099-MISC Miscellaneous'
    | '1099-INT Interest'
    | '1099-DIV Dividends'
    | '1099-B Brokerage Proceeds'
    | 'SSA-1099 Social Security'
    | '1099-R Retirement Distribution'
    | 'Schedule C Business Gross'
    | 'Schedule E Rental Gross'
    | 'Other Income';
  payerName: string;
  taxYear: TaxYearOption;
  grossAmount: number;
  federalWithholding: number;
  stateWithholding: number;
  localWithholding: number;
  aiConfidence: number;
  verificationStatus: 'Pending' | 'Verified' | 'Modified';
  notes?: string;
  isDuplicateRisk?: boolean;
}

export interface TaxPaymentItem {
  id: string;
  sourceDocId: string;
  sourceDocName: string;
  paymentType: 
    | 'Federal Withholding'
    | 'State Withholding'
    | 'Local Withholding'
    | 'Q1 Estimated Payment'
    | 'Q2 Estimated Payment'
    | 'Q3 Estimated Payment'
    | 'Q4 Estimated Payment'
    | 'State Estimated Payment'
    | 'Extension Payment (Form 4868)'
    | 'Prior-Year Overpayment Applied'
    | 'Other Payment';
  paymentDate: string;
  amount: number;
  taxYear: TaxYearOption;
  aiConfidence: number;
  accountantVerified: boolean;
  notes?: string;
}

export interface BusinessCompletenessCheck {
  itemKey: string;
  label: string;
  status: 'Received' | 'Missing' | 'Not Applicable';
  supportingDocId?: string;
  supportingDocName?: string;
  notes?: string;
}

export interface BusinessWorkpaperProfile {
  id: string;
  clientId: string;
  legalName: string;
  dba: string;
  einIndicator: string; // e.g. "XX-XXX4910"
  entityType: 'Single-Member LLC' | 'S-Corporation' | 'Partnership' | 'C-Corporation' | 'Sole Proprietorship';
  ownershipPercentage: number;
  businessActivity: string;
  accountingMethod: 'Cash' | 'Accrual';
  grossReceipts: number;
  otherIncome: number;
  cogs: number;
  payrollExpenses: number;
  contractorExpenses: number;
  advertisingExpenses: number;
  officeExpenses: number;
  rentExpenses: number;
  utilitiesExpenses: number;
  insuranceExpenses: number;
  professionalFees: number;
  softwareExpenses: number;
  travelExpenses: number;
  mealsExpenses: number;
  vehicleExpenses: number;
  equipmentExpenses: number;
  depreciationExpenses: number;
  loanActivity: number;
  completeness: BusinessCompletenessCheck[];
}

export interface RentalPropertyProfile {
  id: string;
  clientId: string;
  address: string;
  ownershipPercentage: number;
  acquisitionDate: string;
  purchasePrice: number;
  accumulatedDepreciation: number;
  rentalIncome: number;
  mortgageInterest: number;
  propertyTaxes: number;
  insurance: number;
  repairs: number;
  maintenance: number;
  utilities: number;
  managementFees: number;
  advertising: number;
  professionalFees: number;
  capitalImprovements: number;
  incomeDocReceived: boolean;
  expenseDocReceived: boolean;
  propertyInfoComplete: boolean;
  hasPriorYearComparison: boolean;
  priorYearIncome?: number;
  aiFlags: string[];
}

export interface InvestmentAccountProfile {
  id: string;
  clientId: string;
  institution: string;
  accountNumberMasked: string;
  accountType: 'Taxable Brokerage' | 'IRA / Traditional' | 'Roth IRA' | 'Digital Asset Exchange';
  taxYear: TaxYearOption;
  has1099B: boolean;
  has1099DIV: boolean;
  has1099INT: boolean;
  capitalGainShortTerm: number;
  capitalGainLongTerm: number;
  digitalAssetsReportable: boolean;
  foreignInvestmentsReportable: boolean;
  statementUploaded: boolean;
  reconciliationNotes: string;
  flagMismatchedStatements: boolean;
}

export interface DeductionCreditMatrixItem {
  id: string;
  area: 
    | 'Mortgage Interest (Form 1098)'
    | 'Student Loan Interest & Education (Form 1098-E/T)'
    | 'Health Savings Account (Form 5498-SA / 1099-SA)'
    | 'Traditional / Roth IRA Contributions'
    | 'Charitable Cash & Non-Cash Contributions'
    | 'Child & Dependent Care Expenses'
    | 'Residential Clean Energy & Energy Efficiency (Form 5695)'
    | 'State & Local Tax (SALT) Cap Calculation'
    | 'Medical & Dental Out-of-Pocket Expenses';
  evidenceReceived: boolean;
  missingEvidence: string;
  aiFlag?: string;
  sourceDocName?: string;
  accountantDecision: 'Allowed in Full' | 'Disallowed' | 'Phase-out / Limited' | 'Pending Supporting Records' | 'Not Applicable';
  status: 'Complete' | 'Action Required' | 'Review Recommended';
  amountClaimed: number;
}

export interface PotentialFormMapping {
  id: string;
  sourceInformation: string;
  sourceDocument: string;
  potentialFormSchedule: string;
  reasonBasis: string;
  supportingEvidence: string;
  accountantDecision: 'Confirmed Applicable' | 'Not Required' | 'Under Review';
  status: 'Potentially applicable — accountant determination required.';
}

export interface ReturnTraceabilityRecord {
  id: string;
  returnItemLabel: string;
  reportedAmount: number;
  workpaperName: string;
  sourceDocumentId: string;
  sourceDocumentName: string;
  pageNumber: number;
  fieldBox: string;
  extractedAiValue: string | number;
  accountantVerifiedValue: string | number;
  verifiedBy: string;
  verifiedTimestamp: string;
}

export interface PreFilingGate {
  id: string; // alias for gateId
  gateId?: string;
  gateNumber?: number;
  label: string; // alias for name
  name?: string;
  description?: string;
  category: 'Profile' | 'Documents' | 'Reconciliation' | 'Exceptions' | 'QC' | 'Signoff' | 'Verification' | 'Accounting' | 'Diagnostics' | 'Quality Control' | 'Client Authorization' | 'Filing Release' | string;
  isRequired?: boolean;
  isCleared?: boolean;
  isBlocking: boolean; // alias for !isCleared
  blockReason?: string;
  blockingReason?: string;
  blockingItems?: string[];
  requiredEvidence?: string[];
  responsibleRole?: string;
  clearedBy?: string;
  clearedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reopenedAt?: string;
  reopenReason?: string;
  ruleVersion?: string;
  taxYear?: number;
  lastEvaluatedAt?: string;
  status: 'VERIFIED' | 'CONFIRMED' | 'REVIEWED' | 'RECONCILED' | 'RESOLVED' | 'COMPLETED' | 'APPROVED' | 'PENDING' | 'BLOCKED' | 'Not Evaluated' | 'Awaiting Client' | 'Awaiting Preparer' | 'Awaiting Reviewer' | 'Ready for Review' | 'Cleared' | 'Reopened' | 'Superseded' | 'Not Applicable with Approval' | string;
}

export interface DemoFilingRecord {
  submissionId: string;
  clientId: string;
  clientName: string;
  taxYear: TaxYearOption;
  returnType: 'Form 1040 (Individual)' | 'Form 1120-S (S-Corporation)' | 'Form 1065 (Partnership)' | 'Form 1120 (C-Corporation)' | string;
  filingDateTime: string;
  filingTimestamp?: string;
  filingMethod: 'Electronic Transmission (MEF XML Demo)' | string;
  efileProvider: 'Demo E-File Service (Sandbox)' | string;
  status: 'FILED — DEMO' | 'ACCEPTED — DEMO' | 'REJECTED — DEMO' | 'CORRECTION REQUIRED' | 'COMPLETED — DEMO' | string;
  acceptanceDateTime?: string;
  rejectionReason?: string;
  correctionHistory?: string[];
  accountantSigner: string;
  authorizationRecordId: string;
  mefTransmissionHash: string;
  transmissionHash?: string;
  auditTrailId: string;

  // Extended properties
  packageVersion?: string;
  jurisdictions?: string[];
  preparer?: string;
  reviewer?: string;
  clientApprovalStatus?: string;
  form8879Status?: string;
  gateStatus?: string;
  releaseStatus?: string;
  duplicateSubmissionStatus?: string;
  simulationStatus?: string;
  latestAcknowledgement?: any;
  idempotencyKey?: string;
}

export * from './preFilingGateRegistry';

