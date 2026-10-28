/**
 * TaxGuard AI – Core Storage & Data Management Service
 * Multi-tenant, role-isolated repository with cryptographic hashing.
 */

import {
  TaxGuardEngagementCase,
  TaxGuardDocument,
  TaxGuardExtractionDossier,
  TaxGuardDiscrepancy,
  TaxGuardMissingItem,
  TaxGuardExpenseItem,
  DraftWorkpaper,
  PublicVerificationRecord,
  TaxGuardFieldMapping,
  TaxGuardSmartFormTemplate,
  TaxGuardDocumentSummary,
  DocumentClassificationDetail,
  ControlledScanPackage,
  EvidenceLibraryItem,
  CaseTask,
  DocumentCategory
} from '../types';
import { TaxGuardAuditService } from './TaxGuardAuditService';

// Initial synthetic cases for demonstration & staff workflows
const INITIAL_CASES: TaxGuardEngagementCase[] = [
  {
    id: 'case_2025_001',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    clientName: 'Daniel Henze (Henze Construction, LLC)',
    clientEmail: 'dhenzeconstruction@gmail.com',
    entityType: 'Single-Member LLC',
    taxYear: 2024,
    returnType: '1040',
    jurisdictions: ['Federal', 'South Carolina'],
    assignedPreparer: 'Marcus Vance, EA',
    assignedReviewer: 'Sarah Jenkins, CPA',
    assignedCpa: 'Desmond Hinds, Principal',
    status: 'extraction_review',
    priority: 'expedited',
    internalDeadline: '2025-03-15',
    filingDeadline: '2025-04-15',
    clientProgressPercent: 75,
    missingItemsCount: 2,
    discrepanciesCount: 1,
    lockedFinalPackage: false,
    makerCheckerSteps: [
      { stepNumber: 1, stepName: 'Client Intake Submission', description: 'Tax organizer and profile answered', requiredRole: 'client', riskTier: 'informational', completed: true, completedBy: 'Daniel Henze', completedAt: '2025-01-20' },
      { stepNumber: 2, stepName: 'Document Collection & Validation', description: 'MIME validation & quarantine checks', requiredRole: 'preparer', riskTier: 'routine', completed: true, completedBy: 'Marcus Vance, EA', completedAt: '2025-01-22' },
      { stepNumber: 3, stepName: 'AI Extraction & Confidence Triage', description: 'OCR extraction of W-2, 1099, & Bank PDFs', requiredRole: 'preparer', riskTier: 'material', completed: false, requiresDualAuthorization: true },
      { stepNumber: 4, stepName: 'Preparer Review & Reconciliation', description: 'Check variance analysis & Schedule C', requiredRole: 'preparer', riskTier: 'material', completed: false, requiresDualAuthorization: true },
      { stepNumber: 5, stepName: 'Senior CPA Technical Review', description: 'Section 179 depreciation & SC allocation', requiredRole: 'reviewer', riskTier: 'high_risk', completed: false, requiresDualAuthorization: true },
      { stepNumber: 6, stepName: 'Quality Control Sign-Off', description: 'Verify discrepancy closure', requiredRole: 'cpa', riskTier: 'high_risk', completed: false, requiresDualAuthorization: true },
      { stepNumber: 7, stepName: 'Client E-Sign Authorization', description: 'Form 8879 authorization e-signature', requiredRole: 'client', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: true },
      { stepNumber: 8, stepName: 'Final Lock & Package Hashing', description: 'SHA-256 seal & QR code minting', requiredRole: 'cpa', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: true },
      { stepNumber: 9, stepName: 'Filing Release (Drake / IRS MeF Gate)', description: 'Electronic filing transmission gate', requiredRole: 'cpa', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: true },
      { stepNumber: 10, stepName: 'Statutory Archive & Chain of Custody', description: '7-year retention commit & audit freeze', requiredRole: 'admin', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: false }
    ]
  },
  {
    id: 'case_2025_002',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_palmetto_002',
    clientName: 'Palmetto Ridge Holdings, Inc.',
    clientEmail: 'finance@palmettoridge.com',
    entityType: 'S-Corporation',
    taxYear: 2024,
    returnType: '1120-S',
    jurisdictions: ['Federal', 'South Carolina', 'North Carolina'],
    assignedPreparer: 'Marcus Vance, EA',
    assignedReviewer: 'Sarah Jenkins, CPA',
    assignedCpa: 'Desmond Hinds, Principal',
    status: 'cpa_review',
    priority: 'urgent_statute',
    internalDeadline: '2025-03-01',
    filingDeadline: '2025-03-15',
    clientProgressPercent: 90,
    missingItemsCount: 0,
    discrepanciesCount: 0,
    lockedFinalPackage: false,
    makerCheckerSteps: [
      { stepNumber: 1, stepName: 'Client Intake Submission', description: 'Corporate questionnaire complete', requiredRole: 'client', riskTier: 'informational', completed: true, completedBy: 'C. Calhoun, CFO', completedAt: '2025-01-15' },
      { stepNumber: 2, stepName: 'Document Collection & Validation', description: 'Trial balance, 1120-S prior returns', requiredRole: 'preparer', riskTier: 'routine', completed: true, completedBy: 'Marcus Vance, EA', completedAt: '2025-01-18' },
      { stepNumber: 3, stepName: 'AI Extraction & Confidence Triage', description: 'Extracted K-1s and 1099-DIV', requiredRole: 'preparer', riskTier: 'material', completed: true, completedBy: 'Marcus Vance, EA', completedAt: '2025-01-20' },
      { stepNumber: 4, stepName: 'Preparer Review & Reconciliation', description: 'Schedule M-1 book-to-tax reconciliation', requiredRole: 'preparer', riskTier: 'material', completed: true, completedBy: 'Marcus Vance, EA', completedAt: '2025-01-24' },
      { stepNumber: 5, stepName: 'Senior CPA Technical Review', description: 'Apportionment factors for SC / NC', requiredRole: 'reviewer', riskTier: 'high_risk', completed: false, requiresDualAuthorization: true },
      { stepNumber: 6, stepName: 'Quality Control Sign-Off', description: 'Dual review gate check', requiredRole: 'cpa', riskTier: 'high_risk', completed: false, requiresDualAuthorization: true },
      { stepNumber: 7, stepName: 'Client E-Sign Authorization', description: 'Form 8453-S signed', requiredRole: 'client', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: true },
      { stepNumber: 8, stepName: 'Final Lock & Package Hashing', description: 'SHA-256 seal & QR code generation', requiredRole: 'cpa', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: true },
      { stepNumber: 9, stepName: 'Filing Release (Drake / IRS MeF Gate)', description: 'Electronic filing transmission gate', requiredRole: 'cpa', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: true },
      { stepNumber: 10, stepName: 'Statutory Archive & Chain of Custody', description: '7-year retention commit', requiredRole: 'admin', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: false }
    ]
  }
];

const INITIAL_DOCUMENTS: TaxGuardDocument[] = [
  {
    id: 'doc_2024_w2_01',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    clientName: 'Daniel Henze',
    fileName: '2024_Form_W2_HenzeConstruction.pdf',
    fileSizeBytes: 245120,
    mimeType: 'application/pdf',
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    uploadedAt: '2025-01-20T14:32:00Z',
    uploadedBy: 'Daniel Henze',
    uploadedByRole: 'client',
    proposedCategory: 'W-2',
    confirmedCategory: 'W-2',
    categoryConfirmedBy: 'Marcus Vance, EA',
    taxYear: 2024,
    malwareStatus: 'not_configured',
    malwareNotice: 'Malware scanning endpoint is not configured in this environment. Document held in quarantine pending professional verification.',
    isQuarantined: false,
    reviewStatus: 'in_review',
    version: 1,
    retentionExpiresAt: '2032-01-20T00:00:00Z',
    chainOfCustody: [
      { timestamp: '2025-01-20T14:32:00Z', action: 'UPLOAD', actor: 'Daniel Henze', actorRole: 'client', notes: 'Client uploaded from verified portal session' },
      { timestamp: '2025-01-20T14:32:05Z', action: 'MIME_CHECK', actor: 'TaxGuard System', actorRole: 'system', notes: 'MIME application/pdf confirmed' },
      { timestamp: '2025-01-21T09:15:00Z', action: 'CATEGORY_CONFIRM', actor: 'Marcus Vance, EA', actorRole: 'preparer', notes: 'Confirmed W-2 wage statement' }
    ]
  },
  {
    id: 'doc_2024_1099nec_01',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    clientName: 'Daniel Henze',
    fileName: '1099-NEC_ApexCommercialContractors.pdf',
    fileSizeBytes: 182400,
    mimeType: 'application/pdf',
    sha256Hash: 'a7c934298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852c991',
    uploadedAt: '2025-01-21T11:20:00Z',
    uploadedBy: 'Daniel Henze',
    uploadedByRole: 'client',
    proposedCategory: '1099-NEC',
    confirmedCategory: '1099-NEC',
    categoryConfirmedBy: 'Marcus Vance, EA',
    taxYear: 2024,
    malwareStatus: 'not_configured',
    malwareNotice: 'Malware scanning endpoint is not configured in this environment. Document held in quarantine pending professional verification.',
    isQuarantined: false,
    reviewStatus: 'verified',
    version: 1,
    retentionExpiresAt: '2032-01-21T00:00:00Z',
    chainOfCustody: [
      { timestamp: '2025-01-21T11:20:00Z', action: 'UPLOAD', actor: 'Daniel Henze', actorRole: 'client' },
      { timestamp: '2025-01-21T11:20:02Z', action: 'MIME_CHECK', actor: 'TaxGuard System', actorRole: 'system' }
    ]
  },
  {
    id: 'doc_2024_bank_stmt_q4',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    clientName: 'Daniel Henze',
    fileName: 'FirstCitizens_Operating_Q4_2024.pdf',
    fileSizeBytes: 890400,
    mimeType: 'application/pdf',
    sha256Hash: 'c4e98f098fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852f821',
    uploadedAt: '2025-01-22T16:00:00Z',
    uploadedBy: 'Marcus Vance, EA',
    uploadedByRole: 'preparer',
    proposedCategory: 'Bank Statement',
    confirmedCategory: 'Bank Statement',
    taxYear: 2024,
    malwareStatus: 'not_configured',
    malwareNotice: 'Malware scanning endpoint is not configured in this environment.',
    isQuarantined: false,
    reviewStatus: 'in_review',
    version: 1,
    retentionExpiresAt: '2032-01-22T00:00:00Z',
    chainOfCustody: [
      { timestamp: '2025-01-22T16:00:00Z', action: 'UPLOAD', actor: 'Marcus Vance, EA', actorRole: 'preparer' }
    ]
  }
];

const INITIAL_EXTRACTIONS: TaxGuardExtractionDossier[] = [
  {
    id: 'ext_w2_001',
    tenantId: 'tenant_ar_tax_prod',
    documentId: 'doc_2024_w2_01',
    clientId: 'client_henze_001',
    taxYear: 2024,
    formDetected: 'W-2',
    overallConfidence: 0.94,
    status: 'partially_verified',
    lastProcessedAt: '2025-01-21T10:00:00Z',
    fields: [
      {
        id: 'fld_w2_01',
        fieldName: 'taxpayerName',
        fieldLabel: 'Employee Name (Box e)',
        extractedValue: 'Daniel Henze',
        sourceDocumentId: 'doc_2024_w2_01',
        sourceDocumentName: '2024_Form_W2_HenzeConstruction.pdf',
        sourcePageNumber: 1,
        confidenceScore: 0.99,
        provider: 'gemini-flash',
        modelVersion: 'gemini-2.5-flash-pro-tax-v1',
        extractedAt: '2025-01-21T10:00:00Z',
        requiresHumanReview: false,
        isMaterialField: true,
        humanReviewed: true,
        reviewedBy: 'Marcus Vance, EA',
        reviewedAt: '2025-01-21T11:00:00Z',
        correctionHistory: []
      },
      {
        id: 'fld_w2_02',
        fieldName: 'taxpayerSsnEnding',
        fieldLabel: 'Social Security Number (Masked)',
        extractedValue: '***-**-4892',
        sourceDocumentId: 'doc_2024_w2_01',
        sourceDocumentName: '2024_Form_W2_HenzeConstruction.pdf',
        sourcePageNumber: 1,
        confidenceScore: 0.98,
        provider: 'gemini-flash',
        modelVersion: 'gemini-2.5-flash-pro-tax-v1',
        extractedAt: '2025-01-21T10:00:00Z',
        requiresHumanReview: true,
        isMaterialField: true,
        humanReviewed: true,
        reviewedBy: 'Marcus Vance, EA',
        reviewedAt: '2025-01-21T11:00:00Z',
        correctionHistory: []
      },
      {
        id: 'fld_w2_03',
        fieldName: 'wagesTipsOtherComp',
        fieldLabel: 'Box 1 - Wages, tips, other compensation',
        extractedValue: 94250.00,
        sourceDocumentId: 'doc_2024_w2_01',
        sourceDocumentName: '2024_Form_W2_HenzeConstruction.pdf',
        sourcePageNumber: 1,
        confidenceScore: 0.96,
        provider: 'gemini-flash',
        modelVersion: 'gemini-2.5-flash-pro-tax-v1',
        extractedAt: '2025-01-21T10:00:00Z',
        requiresHumanReview: true,
        isMaterialField: true,
        humanReviewed: true,
        reviewedBy: 'Marcus Vance, EA',
        reviewedAt: '2025-01-21T11:05:00Z',
        correctionHistory: []
      },
      {
        id: 'fld_w2_04',
        fieldName: 'fedIncomeTaxWithheld',
        fieldLabel: 'Box 2 - Federal Income Tax Withheld',
        extractedValue: 14820.00,
        sourceDocumentId: 'doc_2024_w2_01',
        sourceDocumentName: '2024_Form_W2_HenzeConstruction.pdf',
        sourcePageNumber: 1,
        confidenceScore: 0.95,
        provider: 'gemini-flash',
        modelVersion: 'gemini-2.5-flash-pro-tax-v1',
        extractedAt: '2025-01-21T10:00:00Z',
        requiresHumanReview: true,
        isMaterialField: true,
        humanReviewed: true,
        reviewedBy: 'Marcus Vance, EA',
        reviewedAt: '2025-01-21T11:05:00Z',
        correctionHistory: []
      },
      {
        id: 'fld_w2_05',
        fieldName: 'stateWithholdingSC',
        fieldLabel: 'Box 17 - State Income Tax Withheld (SC)',
        extractedValue: 4610.00,
        sourceDocumentId: 'doc_2024_w2_01',
        sourceDocumentName: '2024_Form_W2_HenzeConstruction.pdf',
        sourcePageNumber: 1,
        confidenceScore: 0.81,
        provider: 'gemini-flash',
        modelVersion: 'gemini-2.5-flash-pro-tax-v1',
        extractedAt: '2025-01-21T10:00:00Z',
        requiresHumanReview: true, // Low confidence threshold < 0.85
        isMaterialField: true,
        humanReviewed: false,
        correctionHistory: []
      }
    ]
  }
];

const INITIAL_DISCREPANCIES: TaxGuardDiscrepancy[] = [
  {
    id: 'disc_001',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    taxYear: 2024,
    ruleCode: 'QC-008',
    category: 'income',
    severity: 'requires_review',
    title: 'Possible 1099-NEC vs. General Ledger Gross Revenue Variance',
    neutralDescription: 'Extracted non-employee compensation from Apex Commercial Contractors ($42,800.00) exceeds quarterly bank operating deposits recorded by $1,450.00.',
    affectedDocuments: ['1099-NEC_ApexCommercialContractors.pdf', 'FirstCitizens_Operating_Q4_2024.pdf'],
    affectedFields: ['Box 1 Nonemployee compensation', 'Operating Inflows Q4'],
    recommendedAction: 'Verify whether $1,450.00 retained retainage was withheld or deposited into an alternate account.',
    status: 'open',
    identifiedAt: '2025-01-22T17:30:00Z'
  }
];

const INITIAL_MISSING_ITEMS: TaxGuardMissingItem[] = [
  {
    id: 'miss_001',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    taxYear: 2024,
    requiredItemName: '2024 Form 1098 Mortgage Interest Statement',
    reasonNeeded: 'Required to substantiate itemized mortgage interest deduction and SC real property credit.',
    relatedFormOrSchedule: 'Schedule A (Form 1040) / SC Form 1040',
    priority: 'important',
    dueDate: '2025-02-15',
    status: 'pending_client',
    createdAt: '2025-01-20T15:00:00Z'
  },
  {
    id: 'miss_002',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    taxYear: 2024,
    requiredItemName: 'Final 2024 Commercial Vehicle Mileage Log / Depreciation Record',
    reasonNeeded: 'Required by Treasury Reg. § 1.274-5 to substantiate business vehicle mileage vs Section 179 write-off.',
    relatedFormOrSchedule: 'Form 4562 & Schedule C',
    priority: 'deadline_critical',
    dueDate: '2025-02-10',
    status: 'pending_client',
    createdAt: '2025-01-20T15:00:00Z'
  }
];

const INITIAL_EXPENSES: TaxGuardExpenseItem[] = [
  {
    id: 'exp_001',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    transactionDate: '2024-11-14',
    payee: 'Home Depot Commercial #4521 Columbia SC',
    amount: 1420.50,
    proposedAccountCategory: 'Schedule C Line 22 - Supplies',
    taxTreatment: 'deductible',
    confidenceScore: 0.97,
    aiExplanation: 'Vendor categorization and invoice line items show job-site lumber and framing fasteners.',
    approvalStatus: 'preparer_approved',
    reviewedBy: 'Marcus Vance, EA',
    reviewedAt: '2025-01-22T14:10:00Z'
  },
  {
    id: 'exp_002',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    transactionDate: '2024-12-05',
    payee: 'Ruth’s Chris Steakhouse Columbia',
    amount: 345.80,
    proposedAccountCategory: 'Schedule C Line 24b - Deductible Meals (50%)',
    taxTreatment: 'partially_deductible_50',
    confidenceScore: 0.91,
    aiExplanation: 'IRC § 274(n) limits business meal deductions to 50%. Client stated meeting with subcontractor.',
    approvalStatus: 'pending'
  },
  {
    id: 'exp_003',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    transactionDate: '2024-10-18',
    payee: 'Best Buy #882 Electronics',
    amount: 2199.99,
    proposedAccountCategory: 'Form 4562 - Section 179 Eligible Computer Equipment',
    taxTreatment: 'capitalized',
    confidenceScore: 0.88,
    aiExplanation: 'Equipment exceeds de minimis safe harbor threshold ($2,500 without AFS, but client elected Section 179 expensing).',
    approvalStatus: 'pending'
  }
];

const INITIAL_WORKPAPER: DraftWorkpaper = {
  id: 'wp_2024_henze_01',
  tenantId: 'tenant_ar_tax_prod',
  engagementId: 'case_2025_001',
  clientId: 'client_henze_001',
  clientName: 'Daniel Henze (Henze Construction, LLC)',
  taxYear: 2024,
  formType: '1040',
  version: 1,
  isDraft: true,
  watermarkText: 'DRAFT – NOT APPROVED FOR FILING',
  preparedBy: 'Marcus Vance, EA',
  preparedAt: '2025-01-22T15:30:00Z',
  sourceDocumentIndex: [
    { id: 'doc_2024_w2_01', name: '2024_Form_W2_HenzeConstruction.pdf', category: 'W-2', verified: true },
    { id: 'doc_2024_1099nec_01', name: '1099-NEC_ApexCommercialContractors.pdf', category: '1099-NEC', verified: true },
    { id: 'doc_2024_bank_stmt_q4', name: 'FirstCitizens_Operating_Q4_2024.pdf', category: 'Bank Statement', verified: false }
  ],
  scheduleTotals: {
    totalGrossIncome: 137050.00,
    totalAdjustments: 6850.00,
    adjustedGrossIncome: 130200.00,
    totalDeductions: 29200.00, // Standard deduction MFJ
    taxableIncome: 101000.00,
    totalFederalWithholding: 14820.00,
    totalEstimatedPayments: 4000.00,
    preliminaryTaxLiability: 12640.00,
    estimatedRefundOrDue: -6180.00 // Negative indicates estimated refund
  },
  openQuestions: [
    'Awaiting Form 1098 Mortgage Interest from client mortgage provider.',
    'Substantiation of vehicle mileage log for 2024 F-250 commercial truck.'
  ],
  reviewerNotes: [
    'Schedule C business gross receipts reconcile with 1099-NEC subject to retainage clearance.',
    'Self-employment tax deduction (50%) accurately computed at $4,845.'
  ],
  cryptographicHash: 'f4d92a098fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852e109',
  qrVerificationId: 'AR-TAX-2024-VRF-88219'
};

const INITIAL_PUBLIC_VERIFICATIONS: Record<string, PublicVerificationRecord> = {
  'AR-TAX-2024-VRF-88219': {
    verificationId: 'AR-TAX-2024-VRF-88219',
    documentType: 'Official Tax Workpaper & Compliance Dossier (Draft Phase)',
    issuingOrganization: 'A/R Tax Services, LLC',
    jurisdiction: 'United States & South Carolina',
    issueDate: '2025-01-22',
    version: 1,
    status: 'valid',
    cryptographicSha256: 'f4d92a098fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852e109',
    authorizedSignatoryTitle: 'Senior Review Partner'
  },
  'AR-TAX-2023-VRF-44109': {
    verificationId: 'AR-TAX-2023-VRF-44109',
    documentType: 'Certified Client Tax Filing Summary (2023 Final)',
    issuingOrganization: 'A/R Tax Services, LLC',
    jurisdiction: 'United States & South Carolina',
    issueDate: '2024-04-12',
    version: 2,
    status: 'valid',
    cryptographicSha256: '882ac4098fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852f88a',
    authorizedSignatoryTitle: 'Desmond Hinds, Principal'
  }
};

const INITIAL_FIELD_MAPPINGS: TaxGuardFieldMapping[] = [
  {
    id: 'map_001',
    sourceDocId: 'doc_2024_w2_01',
    sourceDocName: '2024_Form_W2_HenzeConstruction.pdf',
    sourcePageNumber: 1,
    extractedFieldName: 'Box 1: Wages, tips, other compensation',
    extractedValue: 84500.00,
    normalizedRecordKey: 'wages_salaries_tips',
    accountingCategory: 'Officer Wages & Compensation',
    workpaperField: 'Workpaper WP-1040-W2 Line 1',
    taxFormLine: 'Form 1040, Line 1z (Wages, salaries, tips)',
    taxYear: 2024,
    confidenceScore: 0.98,
    mappingRule: 'RULE-W2-TO-1040-V1',
    ruleVersion: '1.2.0',
    reviewerDecision: 'preparer_accepted',
    isMaterial: true,
    approvalStatus: 'preparer_approved',
    reviewedBy: 'Marcus Vance, EA',
    reviewedAt: '2025-01-22T10:00:00Z',
    correctionHistory: []
  },
  {
    id: 'map_002',
    sourceDocId: 'doc_2024_w2_01',
    sourceDocName: '2024_Form_W2_HenzeConstruction.pdf',
    sourcePageNumber: 1,
    extractedFieldName: 'Box 2: Federal income tax withheld',
    extractedValue: 12450.00,
    normalizedRecordKey: 'federal_income_tax_withheld',
    accountingCategory: 'Payroll Tax Withholdings',
    workpaperField: 'Workpaper WP-1040-WH Line 1',
    taxFormLine: 'Form 1040, Line 25a (Federal withholding from W-2)',
    taxYear: 2024,
    confidenceScore: 0.97,
    mappingRule: 'RULE-W2-WH-1040-V1',
    ruleVersion: '1.2.0',
    reviewerDecision: 'preparer_accepted',
    isMaterial: true,
    approvalStatus: 'preparer_approved',
    reviewedBy: 'Marcus Vance, EA',
    reviewedAt: '2025-01-22T10:05:00Z',
    correctionHistory: []
  },
  {
    id: 'map_003',
    sourceDocId: 'doc_2024_1099nec_01',
    sourceDocName: '2024_Form_1099NEC_PalmettoCommercial.pdf',
    sourcePageNumber: 1,
    extractedFieldName: 'Box 1: Nonemployee compensation',
    extractedValue: 42800.00,
    normalizedRecordKey: 'nonemployee_compensation_gross',
    accountingCategory: 'Contractor Gross Receipts',
    workpaperField: 'Schedule C WP-SCH-C-REV Line 1',
    taxFormLine: 'Schedule C, Part I, Line 1 (Gross receipts or sales)',
    taxYear: 2024,
    confidenceScore: 0.94,
    mappingRule: 'RULE-1099NEC-TO-SCH-C-V1',
    ruleVersion: '1.1.0',
    reviewerDecision: 'proposed',
    isMaterial: true,
    approvalStatus: 'pending_review',
    correctionHistory: []
  },
  {
    id: 'map_004',
    sourceDocId: 'doc_2024_receipts_deprec',
    sourceDocName: '2024_Equipment_Invoices_HeavyDuty.pdf',
    sourcePageNumber: 2,
    extractedFieldName: 'Invoice Total: Bobcat Skid-Steer Loader',
    extractedValue: 38500.00,
    normalizedRecordKey: 'section_179_eligible_equipment',
    accountingCategory: 'Heavy Machinery & Equipment (7-Year Property)',
    workpaperField: 'Form 4562 WP-DEPR Part I Line 6',
    taxFormLine: 'Form 4562, Part I, Line 6 / Schedule C Line 13',
    taxYear: 2024,
    confidenceScore: 0.91,
    mappingRule: 'RULE-EQUIP-TO-4562-SEC179',
    ruleVersion: '1.0.0',
    reviewerDecision: 'proposed',
    isMaterial: true,
    approvalStatus: 'pending_review',
    correctionHistory: []
  }
];

const INITIAL_SMART_FORMS: TaxGuardSmartFormTemplate[] = [
  {
    formId: 'form_1040_2024',
    formName: 'Form 1040 – U.S. Individual Income Tax Return',
    taxYear: 2024,
    formType: '1040',
    lines: [
      {
        lineNumber: '1z',
        lineDescription: 'Wages, salaries, tips, etc. from Form(s) W-2',
        suggestedValue: 84500.00,
        sourceCitation: 'Form W-2 Box 1 (Henze Construction, LLC)',
        sourceDocId: 'doc_2024_w2_01',
        confidence: 0.98,
        isMaterial: true,
        isMissingRequired: false,
        hasSourceConflict: false,
        status: 'preparer_confirmed',
        reviewedBy: 'Marcus Vance, EA'
      },
      {
        lineNumber: '2b',
        lineDescription: 'Taxable interest',
        suggestedValue: 1240.00,
        sourceCitation: 'Form 1099-INT Box 1 (First Palmetto Bank)',
        sourceDocId: 'doc_2024_1099int_01',
        confidence: 0.96,
        isMaterial: false,
        isMissingRequired: false,
        hasSourceConflict: false,
        status: 'proposed'
      },
      {
        lineNumber: '8',
        lineDescription: 'Additional income & Schedule C net business income',
        suggestedValue: 28420.00,
        sourceCitation: 'Schedule C Line 31 (Net Profit Draft WP)',
        sourceDocId: 'doc_2024_1099nec_01',
        confidence: 0.89,
        isMaterial: true,
        isMissingRequired: false,
        hasSourceConflict: false,
        status: 'proposed'
      },
      {
        lineNumber: '12',
        lineDescription: 'Standard deduction or itemized deductions',
        suggestedValue: 29200.00,
        sourceCitation: '2024 MFJ Statutory Standard Deduction ($29,200)',
        sourceDocId: 'statutory_table_2024',
        confidence: 1.0,
        isMaterial: true,
        isMissingRequired: false,
        hasSourceConflict: false,
        status: 'preparer_confirmed',
        reviewedBy: 'Marcus Vance, EA'
      },
      {
        lineNumber: '25a',
        lineDescription: 'Federal income tax withheld from Form(s) W-2',
        suggestedValue: 12450.00,
        sourceCitation: 'Form W-2 Box 2 (Federal withholding)',
        sourceDocId: 'doc_2024_w2_01',
        confidence: 0.97,
        isMaterial: true,
        isMissingRequired: false,
        hasSourceConflict: false,
        status: 'preparer_confirmed',
        reviewedBy: 'Marcus Vance, EA'
      }
    ]
  },
  {
    formId: 'form_sch_c_2024',
    formName: 'Schedule C (Form 1040) – Profit or Loss From Business',
    taxYear: 2024,
    formType: '1040',
    lines: [
      {
        lineNumber: '1',
        lineDescription: 'Gross receipts or sales',
        suggestedValue: 42800.00,
        sourceCitation: 'Form 1099-NEC Box 1 (Palmetto Commercial Contractors)',
        sourceDocId: 'doc_2024_1099nec_01',
        confidence: 0.94,
        isMaterial: true,
        isMissingRequired: false,
        hasSourceConflict: false,
        status: 'proposed'
      },
      {
        lineNumber: '8',
        lineDescription: 'Advertising',
        suggestedValue: 1850.00,
        sourceCitation: 'Extracted Google Ads & Print Flyers Invoices',
        sourceDocId: 'doc_2024_receipts_01',
        confidence: 0.92,
        isMaterial: false,
        isMissingRequired: false,
        hasSourceConflict: false,
        status: 'proposed'
      },
      {
        lineNumber: '9',
        lineDescription: 'Car and truck expenses (Vehicle mileage substantiation)',
        suggestedValue: 4200.00,
        sourceCitation: '6,268 Business Miles @ 67¢/mile (IRS Std Mileage)',
        sourceDocId: 'doc_2024_mileage_log',
        confidence: 0.82,
        isMaterial: true,
        isMissingRequired: true,
        hasSourceConflict: false,
        conflictNotes: 'Awaiting client confirmation of contemporaneous odometer records',
        status: 'proposed'
      },
      {
        lineNumber: '13',
        lineDescription: 'Depreciation and section 179 expense deduction',
        suggestedValue: 38500.00,
        sourceCitation: 'Form 4562 Line 12 Election (Skid-Steer Loader)',
        sourceDocId: 'doc_2024_receipts_deprec',
        confidence: 0.91,
        isMaterial: true,
        isMissingRequired: false,
        hasSourceConflict: false,
        status: 'proposed'
      }
    ]
  }
];

const INITIAL_SUMMARIES: TaxGuardDocumentSummary[] = [
  {
    id: 'sum_001',
    documentId: 'doc_2024_w2_01',
    documentName: '2024_Form_W2_HenzeConstruction.pdf',
    documentCategory: 'W-2',
    taxpayerName: 'Daniel Henze',
    taxYear: 2024,
    issuerOrPayer: 'Henze Construction, LLC (EIN: 57-XXXX812)',
    recipient: 'Daniel Henze (SSN: XXX-XX-4819)',
    importantDates: ['Tax Year: 2024', 'Issued: 2025-01-15', 'Filing Deadline: 2025-04-15'],
    keyAmounts: [
      { label: 'Box 1: Taxable Wages', amount: 84500.00, formatted: '$84,500.00' },
      { label: 'Box 2: Federal Withholding', amount: 12450.00, formatted: '$12,450.00' },
      { label: 'Box 3: Social Security Wages', amount: 84500.00, formatted: '$84,500.00' },
      { label: 'Box 17: SC State Tax Withheld', amount: 4620.00, formatted: '$4,620.00' }
    ],
    clientFriendlySummary: 'This Form W-2 reports your annual compensation of $84,500.00 from Henze Construction, LLC. A total of $12,450.00 was withheld for federal taxes and $4,620.00 was withheld for South Carolina state taxes. These withholdings directly count as prepayments toward your 2024 tax balance.',
    professionalTechnicalSummary: 'Statutory Form W-2 verification complete. Box 1 taxable compensation reconciles with Box 3 and Box 5 OASDI/Medicare bases. Federal withholding at 14.7% effective rate aligns with annualized W-4 elections. South Carolina withholding corresponds to SC W-4 allowances on file.',
    potentialTaxAccountingRelationships: [
      'Maps to Form 1040 Line 1z (Wages, salaries, tips)',
      'Maps to Form 1040 Line 25a (Federal tax withholding prepayment)',
      'Maps to SC-1040 Line 14 (South Carolina withholding credit)'
    ],
    missingPagesOrFields: [],
    detectedInconsistencies: [],
    questionsForClient: [
      'Did you have any retirement plan contributions (e.g. Simple IRA or 401(k)) not reported in Box 12?'
    ],
    questionsForProfessionalReview: [
      'Confirm reasonable compensation threshold for S-Corp / LLC officer relative to prevailing Columbia, SC trade standards.'
    ],
    overallConfidence: 0.98,
    sourcePageReferences: ['Page 1: Boxes 1-20'],
    statutoryNotice: 'AI-generated summary – Requires verification before use in accounting records or tax filings.',
    generatedAt: '2025-01-20T14:35:00Z'
  },
  {
    id: 'sum_002',
    documentId: 'doc_2024_1099nec_01',
    documentName: '2024_Form_1099NEC_PalmettoCommercial.pdf',
    documentCategory: '1099-NEC',
    taxpayerName: 'Daniel Henze',
    taxYear: 2024,
    issuerOrPayer: 'Palmetto Commercial Contractors, LLC',
    recipient: 'Daniel Henze (TIN: XXX-XX-4819)',
    importantDates: ['Tax Year: 2024', 'Issued: 2025-01-18'],
    keyAmounts: [
      { label: 'Box 1: Nonemployee Compensation', amount: 42800.00, formatted: '$42,800.00' },
      { label: 'Box 4: Federal Tax Withheld', amount: 0.00, formatted: '$0.00' }
    ],
    clientFriendlySummary: 'This 1099-NEC reflects $42,800.00 in payments for subcontracting services provided to Palmetto Commercial Contractors. No taxes were withheld from these checks, so this income is subject to federal income tax and self-employment tax on Schedule C.',
    professionalTechnicalSummary: 'Form 1099-NEC nonemployee compensation reported in Box 1. Gross revenue subject to IRC § 1401 Self-Employment Tax and IRC § 162 ordinary/necessary business deduction offset on Schedule C. Zero backup withholding observed.',
    potentialTaxAccountingRelationships: [
      'Maps to Schedule C Part I Line 1 (Gross receipts)',
      'Requires Schedule SE calculation for Self-Employment Contributions Act (SECA)'
    ],
    missingPagesOrFields: [],
    detectedInconsistencies: [
      'No federal withholding reported; client estimated tax payment vouchers should be checked for quarterly safe harbor compliance.'
    ],
    questionsForClient: [
      'Do you have deductible mileage, subcontractor payments, or direct materials associated with this subcontract work?'
    ],
    questionsForProfessionalReview: [
      'Check if 2024 Q1-Q4 estimated payments satisfied the 100% / 110% prior-year safe harbor rule under IRC § 6654.'
    ],
    overallConfidence: 0.94,
    sourcePageReferences: ['Page 1: Box 1'],
    statutoryNotice: 'AI-generated summary – Requires verification before use in accounting records or tax filings.',
    generatedAt: '2025-01-20T15:10:00Z'
  }
];

const INITIAL_CLASSIFICATIONS: DocumentClassificationDetail[] = [
  {
    id: 'cls_001',
    documentId: 'doc_2024_w2_01',
    documentName: '2024_Form_W2_HenzeConstruction.pdf',
    proposedCategory: 'W-2',
    alternativeCategory: '1099-NEC',
    confidenceScore: 0.99,
    explanation: 'Detected standard IRS Form W-2 layout, Box 1 Wage indicator, and federal employer identification number 57-XXXX812.',
    detectedTaxYear: 2024,
    detectedTaxpayerOrEntity: 'Daniel Henze / Henze Construction, LLC',
    applicableEngagementId: 'case_2025_001',
    classificationModel: 'ophireum-doc-classifier-v2.5',
    modelVersion: '2.5.1',
    processedAt: '2025-01-20T14:32:05Z',
    reviewStatus: 'human_confirmed',
    confirmedCategory: 'W-2',
    reviewer: 'Marcus Vance, EA',
    reviewerNotes: 'Confirmed against employer master file.',
    proposedClient: 'Daniel Henze (Henze Construction, LLC)',
    proposedEntity: 'Single-Member LLC',
    proposedWorkflowDestination: 'Form 1040 Line 1z / WP-W2',
    proposedRetentionCategory: 'Permanent Tax Records',
    reviewPriority: 'Routine',
    sensitivityLevel: 'Confidential Taxpayer Data (IRC § 7216)'
  },
  {
    id: 'cls_002',
    documentId: 'doc_2024_1099nec_01',
    documentName: '2024_Form_1099NEC_PalmettoCommercial.pdf',
    proposedCategory: '1099-NEC',
    alternativeCategory: '1099-MISC',
    confidenceScore: 0.94,
    explanation: 'Detected Form 1099-NEC Box 1 Nonemployee Compensation and payer Palmetto Commercial Contractors, LLC.',
    detectedTaxYear: 2024,
    detectedTaxpayerOrEntity: 'Daniel Henze',
    applicableEngagementId: 'case_2025_001',
    classificationModel: 'ophireum-doc-classifier-v2.5',
    modelVersion: '2.5.1',
    processedAt: '2025-01-20T15:02:00Z',
    reviewStatus: 'proposed',
    proposedClient: 'Daniel Henze (Henze Construction, LLC)',
    proposedEntity: 'Single-Member LLC',
    proposedWorkflowDestination: 'Schedule C Line 1',
    proposedRetentionCategory: '7-Year Statutory',
    reviewPriority: 'Routine',
    sensitivityLevel: 'Confidential Taxpayer Data (IRC § 7216)'
  },
  {
    id: 'cls_003',
    documentId: 'doc_2024_bank_stmt_12',
    documentName: 'Dec2024_FirstPalmettoBank_Operating.pdf',
    proposedCategory: 'Bank Statement',
    alternativeCategory: 'Credit Card Statement',
    confidenceScore: 0.96,
    explanation: 'Detected checking account balance table, debits, credits, and First Palmetto Bank letterhead.',
    detectedTaxYear: 2024,
    detectedTaxpayerOrEntity: 'Henze Construction, LLC',
    applicableEngagementId: 'case_2025_001',
    classificationModel: 'ophireum-doc-classifier-v2.5',
    modelVersion: '2.5.1',
    processedAt: '2025-01-21T09:12:00Z',
    reviewStatus: 'human_confirmed',
    confirmedCategory: 'Bank Statement',
    reviewer: 'Marcus Vance, EA',
    proposedClient: 'Daniel Henze (Henze Construction, LLC)',
    proposedEntity: 'Single-Member LLC',
    proposedWorkflowDestination: 'Cash Reconciliation / Schedule L',
    proposedRetentionCategory: '7-Year Statutory',
    reviewPriority: 'Routine',
    sensitivityLevel: 'Confidential Taxpayer Data (IRC § 7216)'
  }
];

const INITIAL_EVIDENCE_ITEMS: EvidenceLibraryItem[] = [
  {
    id: 'evd_001',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    clientName: 'Daniel Henze',
    engagementId: 'case_2025_001',
    taxYear: 2024,
    category: 'W-2',
    documentId: 'doc_2024_w2_01',
    documentName: '2024_Form_W2_HenzeConstruction.pdf',
    pageNumber: 1,
    extractedFieldKey: 'box_1_wages',
    extractedValue: 84500.00,
    provenanceTrail: {
      uploadedAt: '2025-01-20T14:32:00Z',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      extractedAt: '2025-01-20T14:35:00Z',
      verifiedBy: 'Marcus Vance, EA',
      verifiedAt: '2025-01-22T10:00:00Z',
      version: 1
    },
    workflowUsages: ['Form 1040 Line 1z', 'Workpaper WP-1040-W2'],
    retentionCategory: 'Permanent Tax Records',
    legalHold: false,
    status: 'active_approved'
  },
  {
    id: 'evd_002',
    tenantId: 'tenant_ar_tax_prod',
    clientId: 'client_henze_001',
    clientName: 'Daniel Henze',
    engagementId: 'case_2025_001',
    taxYear: 2024,
    category: '1099-NEC',
    documentId: 'doc_2024_1099nec_01',
    documentName: '2024_Form_1099NEC_PalmettoCommercial.pdf',
    pageNumber: 1,
    extractedFieldKey: 'box_1_nonemployee_comp',
    extractedValue: 42800.00,
    provenanceTrail: {
      uploadedAt: '2025-01-20T15:00:00Z',
      sha256Hash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      extractedAt: '2025-01-20T15:05:00Z',
      verifiedBy: 'Pending Review',
      verifiedAt: '',
      version: 1
    },
    workflowUsages: ['Schedule C Line 1'],
    retentionCategory: '7-Year Statutory',
    legalHold: false,
    status: 'pending_verification'
  }
];

const INITIAL_CASE_TASKS: Record<string, CaseTask[]> = {
  case_2025_001: [
    { id: 'task_001', title: 'Collect year-end equipment depreciation invoices', assignedTo: 'Marcus Vance, EA', dueDate: '2025-02-15', completed: true },
    { id: 'task_002', title: 'Obtain written mileage log for 2024 Ford F-250', assignedTo: 'Daniel Henze', dueDate: '2025-02-28', completed: false, isBlocker: true },
    { id: 'task_003', title: 'Perform Schedule C gross receipts reconciliation', assignedTo: 'Sarah Jenkins, CPA', dueDate: '2025-03-05', completed: false, dependencies: ['task_002'] },
    { id: 'task_004', title: 'Senior CPA Quality Review & Section 179 Signoff', assignedTo: 'Desmond Hinds, Principal', dueDate: '2025-03-12', completed: false, dependencies: ['task_003'] }
  ],
  case_2025_002: [
    { id: 'task_201', title: 'Verify South Carolina vs. North Carolina apportionment factor', assignedTo: 'Sarah Jenkins, CPA', dueDate: '2025-02-20', completed: true },
    { id: 'task_202', title: 'Confirm officer compensation reasonableness vs. dividend distributions', assignedTo: 'Desmond Hinds, Principal', dueDate: '2025-02-25', completed: false }
  ]
};

export class TaxGuardStorageService {
  private static cases: TaxGuardEngagementCase[] = INITIAL_CASES;
  private static documents: TaxGuardDocument[] = INITIAL_DOCUMENTS;
  private static extractions: TaxGuardExtractionDossier[] = INITIAL_EXTRACTIONS;
  private static discrepancies: TaxGuardDiscrepancy[] = INITIAL_DISCREPANCIES;
  private static missingItems: TaxGuardMissingItem[] = INITIAL_MISSING_ITEMS;
  private static expenses: TaxGuardExpenseItem[] = INITIAL_EXPENSES;
  private static workpapers: DraftWorkpaper[] = [INITIAL_WORKPAPER];
  private static verifications: Record<string, PublicVerificationRecord> = INITIAL_PUBLIC_VERIFICATIONS;
  private static fieldMappings: TaxGuardFieldMapping[] = INITIAL_FIELD_MAPPINGS;
  private static smartForms: TaxGuardSmartFormTemplate[] = INITIAL_SMART_FORMS;
  private static summaries: TaxGuardDocumentSummary[] = INITIAL_SUMMARIES;
  private static classifications: DocumentClassificationDetail[] = INITIAL_CLASSIFICATIONS;
  private static scanPackages: ControlledScanPackage[] = [];
  private static evidenceLibrary: EvidenceLibraryItem[] = INITIAL_EVIDENCE_ITEMS;
  private static caseTasks: Record<string, CaseTask[]> = INITIAL_CASE_TASKS;

  // Multi-tenant & Role-based Case Retrieval
  public static getCases(role: string, currentClientId?: string): TaxGuardEngagementCase[] {
    if (role === 'client' && currentClientId) {
      return this.cases.filter(c => c.clientId === currentClientId);
    }
    return this.cases;
  }

  public static getCaseById(caseId: string, role: string, currentClientId?: string): TaxGuardEngagementCase | undefined {
    const found = this.cases.find(c => c.id === caseId);
    if (!found) return undefined;
    if (role === 'client' && currentClientId && found.clientId !== currentClientId) {
      // Tenant boundary enforcement
      return undefined;
    }
    return found;
  }

  // Multi-tenant & Role-based Document Retrieval
  public static getDocuments(role: string, currentClientId?: string): TaxGuardDocument[] {
    if (role === 'client' && currentClientId) {
      return this.documents.filter(d => d.clientId === currentClientId);
    }
    return this.documents;
  }

  // Upload new document with quarantine status and security checks
  public static addDocument(doc: Omit<TaxGuardDocument, 'id' | 'uploadedAt' | 'chainOfCustody' | 'version' | 'retentionExpiresAt'>): TaxGuardDocument {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const retentionDate = new Date(Date.now() + 7 * 365 * 24 * 3600 * 1000).toISOString(); // 7-year statutory IRS retention

    const newDoc: TaxGuardDocument = {
      ...doc,
      id,
      uploadedAt: now,
      version: 1,
      retentionExpiresAt: retentionDate,
      chainOfCustody: [
        {
          timestamp: now,
          action: 'UPLOAD_MIME_CHECK',
          actor: doc.uploadedBy,
          actorRole: doc.uploadedByRole,
          notes: 'MIME validated. Placed in non-processable quarantine pending scanning configuration.'
        }
      ]
    };

    this.documents.unshift(newDoc);

    TaxGuardAuditService.logEvent({
      tenantId: doc.tenantId,
      userId: doc.uploadedBy,
      userEmail: `${doc.uploadedBy.toLowerCase().replace(/\s+/g, '')}@client.artaxservices.com`,
      userRole: doc.uploadedByRole,
      action: 'DOCUMENT_UPLOAD',
      recordType: 'document',
      recordId: id,
      ipAddress: 'Client-Authenticated Node',
      result: 'success',
      riskLevel: 'routine',
      details: `Document "${doc.fileName}" (${(doc.fileSizeBytes / 1024).toFixed(1)} KB) uploaded. SHA-256: ${doc.sha256Hash}`
    });

    return newDoc;
  }

  // Extractions
  public static getExtractions(role: string, currentClientId?: string): TaxGuardExtractionDossier[] {
    if (role === 'client' && currentClientId) {
      return this.extractions.filter(e => e.clientId === currentClientId);
    }
    return this.extractions;
  }

  public static updateExtractedField(dossierId: string, fieldId: string, newValue: string | number, reviewerName: string, reason: string): boolean {
    const dossier = this.extractions.find(e => e.id === dossierId);
    if (!dossier) return false;

    const field = dossier.fields.find(f => f.id === fieldId);
    if (!field) return false;

    const prevValue = field.extractedValue;
    field.correctionHistory.push({
      previousValue: prevValue,
      newValue,
      changedBy: reviewerName,
      changedAt: new Date().toISOString(),
      reason
    });

    field.extractedValue = newValue;
    field.correctedValue = newValue;
    field.correctionReason = reason;
    field.humanReviewed = true;
    field.reviewedBy = reviewerName;
    field.reviewedAt = new Date().toISOString();

    TaxGuardAuditService.logEvent({
      tenantId: dossier.tenantId,
      userId: reviewerName,
      userEmail: 'staff@artaxservices.com',
      userRole: 'preparer',
      action: 'EXTRACTION_FIELD_CORRECTION',
      recordType: 'extraction',
      recordId: fieldId,
      ipAddress: 'Office LAN 10.0.4.12',
      result: 'success',
      riskLevel: field.isMaterialField ? 'material' : 'routine',
      details: `Field "${field.fieldLabel}" corrected from "${prevValue}" to "${newValue}". Reason: ${reason}`
    });

    return true;
  }

  // Discrepancies
  public static getDiscrepancies(role: string, currentClientId?: string): TaxGuardDiscrepancy[] {
    if (role === 'client' && currentClientId) {
      return this.discrepancies.filter(d => d.clientId === currentClientId);
    }
    return this.discrepancies;
  }

  public static resolveDiscrepancy(id: string, reviewerName: string, notes: string): boolean {
    const disc = this.discrepancies.find(d => d.id === id);
    if (!disc) return false;
    disc.status = 'resolved';
    disc.reviewedBy = reviewerName;
    disc.reviewerNotes = notes;
    disc.resolvedAt = new Date().toISOString();

    TaxGuardAuditService.logEvent({
      tenantId: disc.tenantId,
      userId: reviewerName,
      userEmail: 'reviewer@artaxservices.com',
      userRole: 'reviewer',
      action: 'DISCREPANCY_RESOLVED',
      recordType: 'case',
      recordId: id,
      ipAddress: 'Office LAN 10.0.4.15',
      result: 'success',
      riskLevel: 'material',
      details: `Discrepancy ${disc.ruleCode} marked resolved. Notes: ${notes}`
    });

    return true;
  }

  // Missing Items
  public static getMissingItems(role: string, currentClientId?: string): TaxGuardMissingItem[] {
    if (role === 'client' && currentClientId) {
      return this.missingItems.filter(m => m.clientId === currentClientId);
    }
    return this.missingItems;
  }

  public static respondToMissingItem(id: string, note: string): boolean {
    const item = this.missingItems.find(m => m.id === id);
    if (!item) return false;
    item.clientResponseNote = note;
    item.status = 'received_pending_review';

    TaxGuardAuditService.logEvent({
      tenantId: item.tenantId,
      userId: 'Client',
      userEmail: 'client@artaxservices.com',
      userRole: 'client',
      action: 'MISSING_ITEM_RESPONSE',
      recordType: 'case',
      recordId: id,
      ipAddress: 'Client Portal SSL Session',
      result: 'success',
      riskLevel: 'routine',
      details: `Client responded to missing item "${item.requiredItemName}". Note: ${note}`
    });

    return true;
  }

  // Expenses
  public static getExpenses(role: string, currentClientId?: string): TaxGuardExpenseItem[] {
    if (role === 'client' && currentClientId) {
      return this.expenses.filter(e => e.clientId === currentClientId);
    }
    return this.expenses;
  }

  public static approveExpense(id: string, reviewer: string, approvedCategory?: string): boolean {
    const exp = this.expenses.find(e => e.id === id);
    if (!exp) return false;
    exp.approvalStatus = 'preparer_approved';
    exp.reviewedBy = reviewer;
    exp.reviewedAt = new Date().toISOString();
    if (approvedCategory) {
      exp.approvedAccountCategory = approvedCategory;
    }
    return true;
  }

  // Workpapers
  public static getWorkpapers(role: string, currentClientId?: string): DraftWorkpaper[] {
    if (role === 'client' && currentClientId) {
      return this.workpapers.filter(w => w.clientId === currentClientId);
    }
    return this.workpapers;
  }

  // Maker-Checker Review Step Approval
  public static completeReviewStep(caseId: string, stepNumber: number, reviewerRole: string, reviewerName: string, notes: string): { success: boolean; error?: string } {
    const c = this.cases.find(item => item.id === caseId);
    if (!c) return { success: false, error: 'Case not found' };

    const step = c.makerCheckerSteps.find(s => s.stepNumber === stepNumber);
    if (!step) return { success: false, error: 'Step not found' };

    // Enforce separation of duties: maker cannot checker high-risk steps
    if (step.requiresDualAuthorization && (step.riskTier === 'high_risk' || step.riskTier === 'filing_critical')) {
      if (stepNumber >= 5 && reviewerRole === 'preparer') {
        return { 
          success: false, 
          error: 'Separation of duties violation: Staff preparer cannot sign off on Senior Reviewer or CPA Quality Control approval gates.' 
        };
      }
    }

    step.completed = true;
    step.completedBy = reviewerName;
    step.completedAt = new Date().toISOString();
    step.signoffNotes = notes;

    TaxGuardAuditService.logEvent({
      tenantId: c.tenantId,
      userId: reviewerName,
      userEmail: `${reviewerName.toLowerCase().replace(/\s+/g, '')}@artaxservices.com`,
      userRole: reviewerRole,
      action: 'MAKER_CHECKER_STEP_SIGNOFF',
      recordType: 'approval',
      recordId: `${caseId}_step_${stepNumber}`,
      ipAddress: '10.0.4.22',
      result: 'success',
      riskLevel: step.riskTier === 'filing_critical' ? 'high_risk' : 'material',
      details: `Step ${stepNumber} (${step.stepName}) approved by ${reviewerName} (${reviewerRole}). Notes: ${notes}`
    });

    return { success: true };
  }

  // Safe Public Verification Lookup
  public static verifyRecord(verificationId: string): PublicVerificationRecord | null {
    const cleanId = (verificationId || '').trim();
    if (!cleanId || !this.verifications[cleanId]) {
      return null;
    }
    return this.verifications[cleanId];
  }

  // Field Mapping Engine Methods
  public static getFieldMappings(role: string, currentClientId?: string): TaxGuardFieldMapping[] {
    return this.fieldMappings;
  }

  public static updateFieldMapping(id: string, newDestination: string, reviewerName: string, reason: string): boolean {
    const mapping = this.fieldMappings.find(m => m.id === id);
    if (!mapping) return false;

    const prevDestination = mapping.taxFormLine;
    mapping.correctionHistory.push({
      previousDestination: prevDestination,
      newDestination,
      changedBy: reviewerName,
      changedAt: new Date().toISOString(),
      reason
    });

    mapping.taxFormLine = newDestination;
    mapping.reviewedBy = reviewerName;
    mapping.reviewedAt = new Date().toISOString();
    mapping.reviewerDecision = 'preparer_accepted';

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: reviewerName,
      userEmail: 'staff@artaxservices.com',
      userRole: 'preparer',
      action: 'FIELD_MAPPING_UPDATED',
      recordType: 'extraction',
      recordId: id,
      ipAddress: '10.0.4.18',
      result: 'success',
      riskLevel: mapping.isMaterial ? 'material' : 'routine',
      details: `Field mapping updated from "${prevDestination}" to "${newDestination}". Reason: ${reason}`
    });

    return true;
  }

  public static approveFieldMapping(id: string, reviewerName: string, role: string): boolean {
    const mapping = this.fieldMappings.find(m => m.id === id);
    if (!mapping) return false;

    if (role === 'cpa' || role === 'reviewer') {
      mapping.approvalStatus = 'reviewer_locked';
      mapping.reviewerDecision = 'reviewer_certified';
    } else {
      mapping.approvalStatus = 'preparer_approved';
      mapping.reviewerDecision = 'preparer_accepted';
    }
    mapping.reviewedBy = reviewerName;
    mapping.reviewedAt = new Date().toISOString();

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: reviewerName,
      userEmail: 'staff@artaxservices.com',
      userRole: role,
      action: 'FIELD_MAPPING_APPROVED',
      recordType: 'extraction',
      recordId: id,
      ipAddress: '10.0.4.18',
      result: 'success',
      riskLevel: mapping.isMaterial ? 'material' : 'routine',
      details: `Field mapping certified by ${reviewerName} (${role}). Destination: ${mapping.taxFormLine}`
    });

    return true;
  }

  // Smart Form Filling
  public static getSmartForms(): TaxGuardSmartFormTemplate[] {
    return this.smartForms;
  }

  public static updateSmartFormField(formId: string, lineNumber: string, confirmedValue: string | number, reviewerName: string): boolean {
    const form = this.smartForms.find(f => f.formId === formId);
    if (!form) return false;
    const line = form.lines.find(l => l.lineNumber === lineNumber);
    if (!line) return false;

    line.suggestedValue = confirmedValue;
    line.status = 'reviewer_locked';
    line.reviewedBy = reviewerName;

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: reviewerName,
      userEmail: 'reviewer@artaxservices.com',
      userRole: 'reviewer',
      action: 'SMART_FORM_FIELD_LOCKED',
      recordType: 'workpaper',
      recordId: `${formId}_line_${lineNumber}`,
      ipAddress: '10.0.4.15',
      result: 'success',
      riskLevel: line.isMaterial ? 'material' : 'routine',
      details: `Form ${form.formName} line ${lineNumber} value locked as ${confirmedValue} by ${reviewerName}`
    });

    return true;
  }

  // Document Summaries
  public static getSummaries(role: string, currentClientId?: string): TaxGuardDocumentSummary[] {
    return this.summaries;
  }

  public static getSummaryByDocId(documentId: string): TaxGuardDocumentSummary | undefined {
    return this.summaries.find(s => s.documentId === documentId);
  }

  // Document Classification
  public static getClassifications(role: string, currentClientId?: string): DocumentClassificationDetail[] {
    return this.classifications;
  }

  public static confirmClassification(id: string, category: DocumentCategory, reviewerName: string, notes: string): boolean {
    const cls = this.classifications.find(c => c.id === id);
    if (!cls) return false;

    const prevCategory = cls.confirmedCategory || cls.proposedCategory;
    cls.confirmedCategory = category;
    cls.reviewStatus = category === cls.proposedCategory ? 'human_confirmed' : 'human_corrected';
    cls.reviewer = reviewerName;
    cls.reviewerNotes = notes;

    // Synchronize underlying document category if present
    const doc = this.documents.find(d => d.id === cls.documentId);
    if (doc) {
      doc.confirmedCategory = category;
      doc.categoryConfirmedBy = reviewerName;
      doc.reviewStatus = 'in_review';
    }

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: reviewerName,
      userEmail: 'staff@artaxservices.com',
      userRole: 'preparer',
      action: 'DOCUMENT_CLASSIFICATION_CONFIRMED',
      recordType: 'document',
      recordId: cls.documentId,
      ipAddress: '10.0.4.12',
      result: 'success',
      riskLevel: 'routine',
      details: `Classification for document "${cls.documentName}" set to ${category} (was ${prevCategory}). Notes: ${notes}`
    });

    return true;
  }

  // Document Scanner Package
  public static saveScanPackage(pkg: ControlledScanPackage): ControlledScanPackage {
    this.scanPackages.unshift(pkg);

    // Create corresponding document in vault as well with quarantine status
    this.addDocument({
      tenantId: pkg.tenantId,
      clientId: pkg.clientId,
      clientName: 'Daniel Henze',
      fileName: pkg.originalFileName,
      fileSizeBytes: pkg.fileSizeBytes,
      mimeType: pkg.mimeType,
      sha256Hash: pkg.sha256Digest,
      uploadedBy: pkg.uploadedBy,
      uploadedByRole: pkg.uploadedByRole,
      proposedCategory: 'Unclassified',
      taxYear: pkg.taxYear,
      malwareStatus: pkg.securityState,
      malwareNotice: 'External antivirus provider (ClamAV / VirusTotal) is not configured in this environment. Scanned package is retained in quarantined processing boundary.',
      isQuarantined: true,
      reviewStatus: 'pending_classification'
    });

    TaxGuardAuditService.logEvent({
      tenantId: pkg.tenantId,
      userId: pkg.uploadedBy,
      userEmail: 'client@artaxservices.com',
      userRole: pkg.uploadedByRole,
      action: 'CONTROLLED_SCAN_PACKAGE_COMMITTED',
      recordType: 'document',
      recordId: pkg.id,
      ipAddress: '10.0.4.45',
      result: 'success',
      riskLevel: 'routine',
      details: `Multi-page document package (${pkg.pageCount} pages) captured via ${pkg.captureMethod}. Package ID: ${pkg.id}`
    });

    return pkg;
  }

  public static getScanPackages(role: string, currentClientId?: string): ControlledScanPackage[] {
    if (role === 'client' && currentClientId) {
      return this.scanPackages.filter(p => p.clientId === currentClientId);
    }
    return this.scanPackages;
  }

  // Evidence Library
  public static getEvidenceLibrary(role: string, currentClientId?: string, categoryFilter?: string): EvidenceLibraryItem[] {
    let items = this.evidenceLibrary;
    if (role === 'client' && currentClientId) {
      items = items.filter(i => i.clientId === currentClientId);
    }
    if (categoryFilter && categoryFilter !== 'all') {
      items = items.filter(i => i.category === categoryFilter);
    }
    return items;
  }

  // Case Management Actions
  public static createCase(newCase: Omit<TaxGuardEngagementCase, 'id' | 'lockedFinalPackage' | 'makerCheckerSteps'>): TaxGuardEngagementCase {
    const id = `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullCase: TaxGuardEngagementCase = {
      ...newCase,
      id,
      lockedFinalPackage: false,
      makerCheckerSteps: [
        { stepNumber: 1, stepName: 'Client Intake Submission', description: 'Tax organizer and intake submitted', requiredRole: 'client', riskTier: 'informational', completed: true, completedBy: newCase.clientName, completedAt: new Date().toISOString().split('T')[0] },
        { stepNumber: 2, stepName: 'Document Validation', description: 'Quarantine and MIME check', requiredRole: 'preparer', riskTier: 'routine', completed: false },
        { stepNumber: 3, stepName: 'AI Extraction Review', description: 'Verify extracted fields and OCR confidence', requiredRole: 'preparer', riskTier: 'material', completed: false, requiresDualAuthorization: true },
        { stepNumber: 4, stepName: 'Preparer Reconciliation', description: 'Reconciliation of forms and workpapers', requiredRole: 'preparer', riskTier: 'material', completed: false, requiresDualAuthorization: true },
        { stepNumber: 5, stepName: 'Senior Reviewer Technical Check', description: 'Multi-jurisdictional check', requiredRole: 'reviewer', riskTier: 'high_risk', completed: false, requiresDualAuthorization: true },
        { stepNumber: 6, stepName: 'CPA Final Quality Control', description: 'Quality control sign-off', requiredRole: 'cpa', riskTier: 'high_risk', completed: false, requiresDualAuthorization: true },
        { stepNumber: 7, stepName: 'Client E-Signature Authorization', description: 'Form 8879 / 8453 client sign-off', requiredRole: 'client', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: true },
        { stepNumber: 8, stepName: 'Final Lock & SHA-256 Hashing', description: 'Mint cryptographic verification record', requiredRole: 'cpa', riskTier: 'filing_critical', completed: false, requiresDualAuthorization: true }
      ]
    };

    this.cases.unshift(fullCase);

    TaxGuardAuditService.logEvent({
      tenantId: fullCase.tenantId,
      userId: fullCase.assignedPreparer,
      userEmail: 'staff@artaxservices.com',
      userRole: 'preparer',
      action: 'CASE_CREATED',
      recordType: 'case',
      recordId: id,
      ipAddress: '10.0.4.10',
      result: 'success',
      riskLevel: 'routine',
      details: `New engagement case created for "${fullCase.clientName}" (${fullCase.returnType}, TY${fullCase.taxYear})`
    });

    return fullCase;
  }

  public static updateCaseStatus(id: string, newStatus: TaxGuardEngagementCase['status'], userRole: string, notes?: string): boolean {
    const c = this.cases.find(item => item.id === id);
    if (!c) return false;

    // Clients cannot change case status
    if (userRole === 'client') return false;

    const prevStatus = c.status;
    c.status = newStatus;

    TaxGuardAuditService.logEvent({
      tenantId: c.tenantId,
      userId: 'Authorized Staff',
      userEmail: 'staff@artaxservices.com',
      userRole,
      action: 'CASE_STATUS_UPDATED',
      recordType: 'case',
      recordId: id,
      ipAddress: '10.0.4.12',
      result: 'success',
      riskLevel: 'material',
      details: `Case status changed from "${prevStatus}" to "${newStatus}". Notes: ${notes || 'None'}`
    });

    return true;
  }

  public static addCaseWorkflowAction(caseId: string, actionType: 'amendment' | 'audit_support' | 'notice_response' | 'business_closure', details: string, userRole: string): boolean {
    const c = this.cases.find(item => item.id === caseId);
    if (!c) return false;

    TaxGuardAuditService.logEvent({
      tenantId: c.tenantId,
      userId: 'Workflow System',
      userEmail: 'staff@artaxservices.com',
      userRole,
      action: `CASE_WORKFLOW_${actionType.toUpperCase()}`,
      recordType: 'case',
      recordId: caseId,
      ipAddress: '10.0.4.14',
      result: 'success',
      riskLevel: 'material',
      details: `Case workflow "${actionType}" initiated. Details: ${details}`
    });

    return true;
  }

  public static getCaseTasks(caseId: string): CaseTask[] {
    return this.caseTasks[caseId] || [];
  }

  public static toggleCaseTask(caseId: string, taskId: string): boolean {
    const tasks = this.caseTasks[caseId];
    if (!tasks) return false;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;
    task.completed = !task.completed;
    return true;
  }

  // Safe Demo Data Reset
  public static resetDemoData(): void {
    this.cases = JSON.parse(JSON.stringify(INITIAL_CASES));
    this.documents = JSON.parse(JSON.stringify(INITIAL_DOCUMENTS));
    this.extractions = JSON.parse(JSON.stringify(INITIAL_EXTRACTIONS));
    this.discrepancies = JSON.parse(JSON.stringify(INITIAL_DISCREPANCIES));
    this.missingItems = JSON.parse(JSON.stringify(INITIAL_MISSING_ITEMS));
    this.expenses = JSON.parse(JSON.stringify(INITIAL_EXPENSES));
    this.workpapers = [JSON.parse(JSON.stringify(INITIAL_WORKPAPER))];
    this.verifications = JSON.parse(JSON.stringify(INITIAL_PUBLIC_VERIFICATIONS));
    this.fieldMappings = JSON.parse(JSON.stringify(INITIAL_FIELD_MAPPINGS));
    this.smartForms = JSON.parse(JSON.stringify(INITIAL_SMART_FORMS));
    this.summaries = JSON.parse(JSON.stringify(INITIAL_SUMMARIES));
    this.classifications = JSON.parse(JSON.stringify(INITIAL_CLASSIFICATIONS));
    this.scanPackages = [];
    this.evidenceLibrary = JSON.parse(JSON.stringify(INITIAL_EVIDENCE_ITEMS));
    this.caseTasks = JSON.parse(JSON.stringify(INITIAL_CASE_TASKS));

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: 'Administrator',
      userEmail: 'admin@artaxservices.com',
      userRole: 'admin',
      action: 'DEMO_DATA_RESET',
      recordType: 'governance',
      recordId: 'system_reset',
      ipAddress: '10.0.4.1',
      result: 'success',
      riskLevel: 'high_risk',
      details: 'All demonstration in-memory collections restored to standard verified baseline.'
    });
  }
}
