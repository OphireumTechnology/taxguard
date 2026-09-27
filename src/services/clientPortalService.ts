/**
 * A/R TAX SERVICES, LLC - Client Portal Service & State Engine
 * 
 * Implements:
 * - Versioned 24-State Tax Workflow Engine with Tamper-Evident Event Hashes
 * - Jurisdiction-Aware Statutory Deadline Engine (IRS + SC/NC/GA DOR)
 * - Offline-First Sync Queue with Idempotency & Conflict Guard
 * - Document Provenance and Extraction Validator
 * - Business-Closure Multi-Agency Verification
 */

import {
  TaxWorkflowState,
  ClientFacingLifecycleStage,
  WorkflowStateTransition,
  JurisdictionDeadline,
  ApprovalRecord,
  TaxStrategyItem,
  AccountingConnector,
  BusinessClosureWorkflow,
  RegulatoryUpdateItem,
  AuditEventRecord,
  SyncEvent,
  SyncQueueState,
  FilingSubmissionDetails,
  ExpenseItem,
  CashTransactionItem,
  MileageLogItem,
  FixedAssetRecord,
  MissingDocumentItem,
  FinancialInstitutionConnector,
  AmendmentRequestItem
} from '../types/clientPortal';

// Simple deterministic hash utility for tamper-evident client-side demonstration
export function generateEventHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256_mock_${hex}_${input.length.toString(16)}`;
}

// ---------------------------------------------------------------------------
// 1. Lifecycle State Machine Mapping
// ---------------------------------------------------------------------------

export const STATE_TO_CLIENT_STAGE: Record<TaxWorkflowState, ClientFacingLifecycleStage> = {
  NOT_STARTED: 'Intake',
  PROFILE_CONFIRMATION: 'Intake',
  INTAKE_IN_PROGRESS: 'Intake',
  DOCUMENTS_REQUIRED: 'Records',
  DATA_PROCESSING: 'Records',
  CLIENT_CLARIFICATION: 'Records',
  BOOKS_RECONCILIATION: 'Records',
  STRATEGY_REVIEW: 'Preparation',
  RETURN_PREPARATION: 'Preparation',
  ACCOUNTANT_REVIEW: 'Preparation',
  CLIENT_REVIEW: 'Review',
  CLIENT_AUTHORIZATION_REQUIRED: 'Authorization',
  REVIEWER_APPROVAL: 'Authorization',
  READY_TO_FILE: 'Authorization',
  TRANSMITTED: 'Filing',
  IRS_PENDING: 'Filing',
  STATE_PENDING: 'Filing',
  ACCEPTED: 'Accepted',
  PARTIALLY_ACCEPTED: 'Filing',
  REJECTED: 'Review',
  CORRECTION_REQUIRED: 'Review',
  AMENDMENT_REQUIRED: 'Review',
  POST_FILING: 'Post-Filing',
  ARCHIVED: 'Post-Filing',
  NEXT_YEAR_PREPARATION: 'Post-Filing'
};

export const CLIENT_STAGES: ClientFacingLifecycleStage[] = [
  'Intake',
  'Records',
  'Preparation',
  'Review',
  'Authorization',
  'Filing',
  'Accepted',
  'Post-Filing'
];

// Plain language state titles for client viewing
export const STATE_FRIENDLY_LABELS: Record<TaxWorkflowState, { title: string; clientDescription: string; tone: 'neutral' | 'info' | 'action' | 'success' | 'alert' }> = {
  NOT_STARTED: {
    title: 'Engagement Ready to Begin',
    clientDescription: 'Your tax engagement has been established. Complete initial profile confirmation to start.',
    tone: 'neutral'
  },
  PROFILE_CONFIRMATION: {
    title: 'Confirm Identity & Profile',
    clientDescription: 'Please verify personal contact information, filing status, and dependents.',
    tone: 'action'
  },
  INTAKE_IN_PROGRESS: {
    title: 'Tax Organizer in Progress',
    clientDescription: 'Answer annual tax questions so our advisory team can customize your document checklist.',
    tone: 'action'
  },
  DOCUMENTS_REQUIRED: {
    title: 'Supporting Documents Needed',
    clientDescription: 'Please upload outstanding W-2s, 1099s, bank statements, and required schedules.',
    tone: 'action'
  },
  DATA_PROCESSING: {
    title: 'Secure OCR Extraction & Classification',
    clientDescription: 'Our system and accountants are cataloging and cross-referencing your submitted records.',
    tone: 'info'
  },
  CLIENT_CLARIFICATION: {
    title: 'Advisor Clarification Requested',
    clientDescription: 'Desmond Hinds or your assigned preparer has posted questions regarding specific items.',
    tone: 'alert'
  },
  BOOKS_RECONCILIATION: {
    title: 'Ledger & Books Reconciliation',
    clientDescription: 'Reconciling bank accounts and QuickBooks ledger balances to support deductions.',
    tone: 'info'
  },
  STRATEGY_REVIEW: {
    title: 'Strategic Positioning Analysis',
    clientDescription: 'Analyzing potential deductions, Section 179 depreciation, and credit eligibility.',
    tone: 'info'
  },
  RETURN_PREPARATION: {
    title: 'Return in Preparation',
    clientDescription: 'Your tax return forms and schedules are actively being calculated and assembled.',
    tone: 'info'
  },
  ACCOUNTANT_REVIEW: {
    title: 'Preparer Quality Review',
    clientDescription: 'A thorough internal technical review is being performed on all workpapers.',
    tone: 'info'
  },
  CLIENT_REVIEW: {
    title: 'Draft Return Ready for Your Review',
    clientDescription: 'Inspect your locked review copy, verify personal figures, and leave any questions.',
    tone: 'action'
  },
  CLIENT_AUTHORIZATION_REQUIRED: {
    title: 'Signature Authorization Required (Form 8879)',
    clientDescription: 'Action required: Authorize electronic filing using your secure identity verification.',
    tone: 'action'
  },
  REVIEWER_APPROVAL: {
    title: 'Final CPA / Filing Officer Review',
    clientDescription: 'Elena Rostova, CPA is performing secondary review before official transmitter release.',
    tone: 'info'
  },
  READY_TO_FILE: {
    title: 'Queued for Electronic Transmission',
    clientDescription: 'All approvals verified. Return is staged in the authorized MeF transmitter queue.',
    tone: 'info'
  },
  TRANSMITTED: {
    title: 'Transmitted to Tax Authorities',
    clientDescription: 'Batch transmission sent via secure IRS Modernized e-File channel.',
    tone: 'info'
  },
  IRS_PENDING: {
    title: 'IRS Acknowledgment Pending',
    clientDescription: 'Awaiting formal electronic acknowledgment from the Internal Revenue Service.',
    tone: 'info'
  },
  STATE_PENDING: {
    title: 'State Acknowledgment Pending',
    clientDescription: 'Awaiting formal electronic acknowledgment from state revenue departments.',
    tone: 'info'
  },
  ACCEPTED: {
    title: 'Return Officially Accepted',
    clientDescription: 'Both federal and state revenue authorities have accepted your filed tax return.',
    tone: 'success'
  },
  PARTIALLY_ACCEPTED: {
    title: 'Federal Accepted / State Pending',
    clientDescription: 'IRS acceptance confirmed; state revenue department acknowledgment is in progress.',
    tone: 'info'
  },
  REJECTED: {
    title: 'Transmission Notice Received',
    clientDescription: 'The filing agency returned an inquiry or correction code. Our team is resolving it.',
    tone: 'alert'
  },
  CORRECTION_REQUIRED: {
    title: 'Additional Documentation Required',
    clientDescription: 'A missing schedule or mismatched form requires your quick confirmation to re-file.',
    tone: 'action'
  },
  AMENDMENT_REQUIRED: {
    title: 'Amendment in Preparation (1040-X)',
    clientDescription: 'An amended return workflow has been initiated to reflect revised source information.',
    tone: 'info'
  },
  POST_FILING: {
    title: 'Post-Filing Records & Payments Active',
    clientDescription: 'Final returns, payment schedules, and 1040-ES estimated vouchers are available.',
    tone: 'success'
  },
  ARCHIVED: {
    title: 'Tax Year Safely Archived',
    clientDescription: 'Full tax return, supporting vault documents, and audit logs are retained.',
    tone: 'neutral'
  },
  NEXT_YEAR_PREPARATION: {
    title: 'Next Cycle Preparation Open',
    clientDescription: 'Carryforward schedules and proactive planning for the upcoming tax year are live.',
    tone: 'neutral'
  }
};

// ---------------------------------------------------------------------------
// 2. Deadlines Engine with Jurisdiction Awareness
// ---------------------------------------------------------------------------

export function getJurisdictionDeadlines(taxYear: number = 2025): JurisdictionDeadline[] {
  return [
    {
      id: 'dl_fed_1040',
      jurisdiction: 'Federal',
      agencyName: 'Internal Revenue Service (IRS)',
      obligationTitle: 'Individual Income Tax Return',
      formNumber: 'Form 1040',
      statutoryDueDate: '2026-04-15',
      adjustedDueDate: '2026-04-15', // Wednesday, standard filing day
      extensionAvailable: true,
      extensionForm: 'Form 4868 (6-Month Extension to Oct 15)',
      extendedDueDate: '2026-10-15',
      daysRemaining: 32,
      urgency: 'critical',
      penaltyNotice: 'Failure to file penalty is 5% of unpaid taxes per month; interest accrues from April 15.'
    },
    {
      id: 'dl_sc_1040',
      jurisdiction: 'State',
      agencyName: 'South Carolina Department of Revenue (SCDOR)',
      obligationTitle: 'SC Individual Resident Income Tax Return',
      formNumber: 'Form SC1040',
      statutoryDueDate: '2026-04-15',
      adjustedDueDate: '2026-04-15',
      extensionAvailable: true,
      extensionForm: 'Form SC4868',
      extendedDueDate: '2026-10-15',
      daysRemaining: 32,
      urgency: 'critical',
      penaltyNotice: 'South Carolina assesses 5% per month late-filing penalty plus statutory interest.'
    },
    {
      id: 'dl_fed_es_q1',
      jurisdiction: 'Federal',
      agencyName: 'Internal Revenue Service (IRS)',
      obligationTitle: 'Q1 2026 Estimated Tax Payment',
      formNumber: 'Form 1040-ES (Voucher 1)',
      statutoryDueDate: '2026-04-15',
      adjustedDueDate: '2026-04-15',
      extensionAvailable: false,
      daysRemaining: 32,
      urgency: 'critical',
      penaltyNotice: 'Underpayment of estimated tax penalty applies under IRC § 6654.'
    },
    {
      id: 'dl_fed_es_q2',
      jurisdiction: 'Federal',
      agencyName: 'Internal Revenue Service (IRS)',
      obligationTitle: 'Q2 2026 Estimated Tax Payment',
      formNumber: 'Form 1040-ES (Voucher 2)',
      statutoryDueDate: '2026-06-15',
      adjustedDueDate: '2026-06-15',
      extensionAvailable: false,
      daysRemaining: 93,
      urgency: 'normal',
      penaltyNotice: 'Payable online via IRS Direct Pay or EFTPS.'
    },
    {
      id: 'dl_fed_1120s',
      jurisdiction: 'Federal',
      agencyName: 'Internal Revenue Service (IRS)',
      obligationTitle: 'S-Corporation / Partnership Tax Return',
      formNumber: 'Form 1120-S / Form 1065',
      statutoryDueDate: '2026-03-15',
      adjustedDueDate: '2026-03-16', // March 15 is Sunday, moved to Monday March 16
      extensionAvailable: true,
      extensionForm: 'Form 7004 (6-Month Extension to Sept 15)',
      extendedDueDate: '2026-09-15',
      daysRemaining: 2,
      urgency: 'critical',
      penaltyNotice: 'IRC § 6699 assesses $220/month per shareholder for late filing.'
    }
  ];
}

// ---------------------------------------------------------------------------
// 3. Mock Data Fixtures for Realistic Client Portal
// ---------------------------------------------------------------------------

export const INITIAL_TRANSITIONS: WorkflowStateTransition[] = [
  {
    id: 'tr_01',
    engagementId: 'eng_2025_001',
    taxYear: 2025,
    previousState: 'NOT_STARTED',
    newState: 'PROFILE_CONFIRMATION',
    responsibleRole: 'client',
    actorIdentity: {
      userId: 'user_client_1',
      userName: 'Robert & Sarah Perotti',
      role: 'Client',
      email: 'robert.perotti@example.com'
    },
    timestamp: '2026-01-10T14:30:00Z',
    reason: 'Client signed annual engagement agreement',
    sourceDevice: {
      browser: 'Chrome 122.0',
      os: 'macOS 14.3',
      ipAddressMasked: '73.189.•••.•••'
    },
    correlationId: 'corr_init_9182',
    tamperEvidentEventHash: 'sha256_e8f0a21b39918274092bbf893e98129037cba8971234'
  },
  {
    id: 'tr_02',
    engagementId: 'eng_2025_001',
    taxYear: 2025,
    previousState: 'PROFILE_CONFIRMATION',
    newState: 'INTAKE_IN_PROGRESS',
    responsibleRole: 'client',
    actorIdentity: {
      userId: 'user_client_1',
      userName: 'Robert Perotti',
      role: 'Client',
      email: 'robert.perotti@example.com'
    },
    timestamp: '2026-01-15T09:12:00Z',
    reason: 'Client began completing 2025 tax organizer questions',
    sourceDevice: {
      browser: 'Chrome 122.0',
      os: 'macOS 14.3',
      ipAddressMasked: '73.189.•••.•••'
    },
    correlationId: 'corr_intake_8819',
    tamperEvidentEventHash: 'sha256_b319a908273615481726a7182930412893817a892b3c',
    previousEventHash: 'sha256_e8f0a21b39918274092bbf893e98129037cba8971234'
  },
  {
    id: 'tr_03',
    engagementId: 'eng_2025_001',
    taxYear: 2025,
    previousState: 'INTAKE_IN_PROGRESS',
    newState: 'DOCUMENTS_REQUIRED',
    responsibleRole: 'accountant',
    actorIdentity: {
      userId: 'staff_desmond_hinds',
      userName: 'Desmond Hinds',
      role: 'Founder & CEO',
      email: 'dhinds@artaxserv.com'
    },
    timestamp: '2026-01-20T11:45:00Z',
    reason: 'Generated tailored 2025 document checklist based on intake responses',
    sourceDevice: {
      browser: 'Edge 121.0',
      os: 'Windows 11 Enterprise',
      ipAddressMasked: '64.120.•••.•••'
    },
    correlationId: 'corr_checklist_1029',
    tamperEvidentEventHash: 'sha256_c9182738491029384756102938475610293847561029',
    previousEventHash: 'sha256_b319a908273615481726a7182930412893817a892b3c'
  },
  {
    id: 'tr_04',
    engagementId: 'eng_2025_001',
    taxYear: 2025,
    previousState: 'DOCUMENTS_REQUIRED',
    newState: 'CLIENT_REVIEW',
    responsibleRole: 'accountant',
    actorIdentity: {
      userId: 'staff_desmond_hinds',
      userName: 'Desmond Hinds',
      role: 'Founder & CEO',
      email: 'dhinds@artaxserv.com'
    },
    timestamp: '2026-03-10T16:00:00Z',
    reason: 'Prepared 2025 Form 1040 and SC1040; published locked review draft for client inspection',
    sourceDevice: {
      browser: 'Edge 121.0',
      os: 'Windows 11 Enterprise',
      ipAddressMasked: '64.120.•••.•••'
    },
    correlationId: 'corr_draft_review_9918',
    tamperEvidentEventHash: 'sha256_71829384756102938475610293847561029384756102',
    previousEventHash: 'sha256_c9182738491029384756102938475610293847561029'
  }
];

export const INITIAL_APPROVALS: ApprovalRecord[] = [
  {
    id: 'appr_8879_2025',
    clientId: 'user_client_1',
    taxYear: 2025,
    approvalType: 'form_8879_filing_auth',
    title: 'IRS Form 8879: IRS e-file Signature Authorization',
    description: 'Federal and South Carolina electronic filing authorization for 2025 Form 1040 / Form SC1040.',
    status: 'pending_client_signature',
    documentVersionId: 'doc_ver_1040_final_draft_v2',
    documentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    exactConsentLanguage: 'Under penalties of perjury, I declare that I have examined a copy of my 2025 electronic individual income tax return and accompanying schedules and statements, and to the best of my knowledge and belief, it is true, correct, and complete. I authorize A/R Tax Services, LLC (ERO: Desmond Hinds) to transmit this return to the IRS and South Carolina Department of Revenue.',
    signerName: 'Robert Perotti',
    signerEmail: 'robert.perotti@example.com',
    signerRole: 'primary_taxpayer',
    authStrength: 'password_and_totp_verified',
    tamperEvidentHashChain: 'sha256_appr_chain_901827384918273645'
  },
  {
    id: 'appr_7216_2025',
    clientId: 'user_client_1',
    taxYear: 2025,
    approvalType: 'irc_7216_consent',
    title: 'IRC § 7216 Consent to Disclose / Use Tax Return Information',
    description: 'Statutory disclosure consent allowing firm advisors to perform proactive tax-planning scenarios.',
    status: 'approved',
    documentVersionId: 'doc_7216_consent_v1',
    documentSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    exactConsentLanguage: 'Federal law requires this consent form be provided to you. Unless authorized by law, we cannot disclose, without your consent, your tax return information to third parties for purposes other than tax preparation.',
    signerName: 'Robert Perotti',
    signerEmail: 'robert.perotti@example.com',
    signerRole: 'primary_taxpayer',
    authStrength: 'password_and_totp_verified',
    signedTimestamp: '2026-01-11T16:22:15Z',
    timeZone: 'America/New_York (EST)',
    ipAddressMasked: '73.189.•••.•••',
    tamperEvidentHashChain: 'sha256_chain_7216_8819283746152',
    certificateDownloadUrl: '/certificates/cert_7216_perotti_2025.pdf'
  },
  {
    id: 'appr_eng_2025',
    clientId: 'user_client_1',
    taxYear: 2025,
    approvalType: 'engagement_agreement',
    title: '2025 Annual Tax Engagement Agreement',
    description: 'Terms of engagement, scope of services, billing structure, and taxpayer responsibilities.',
    status: 'approved',
    documentVersionId: 'doc_eng_letter_2025_v1',
    documentSha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    exactConsentLanguage: 'I agree to the scope of professional tax services as set forth by A/R Tax Services, LLC for the 2025 calendar tax year.',
    signerName: 'Robert Perotti',
    signerEmail: 'robert.perotti@example.com',
    signerRole: 'primary_taxpayer',
    authStrength: 'password_and_totp_verified',
    signedTimestamp: '2026-01-10T14:35:00Z',
    timeZone: 'America/New_York (EST)',
    ipAddressMasked: '73.189.•••.•••',
    tamperEvidentHashChain: 'sha256_chain_eng_192837461528',
    certificateDownloadUrl: '/certificates/cert_eng_perotti_2025.pdf'
  }
];

export const INITIAL_STRATEGIES: TaxStrategyItem[] = [
  {
    id: 'strat_01',
    title: 'IRC § 179 & Bonus Depreciation on Qualified Capital Equipment',
    applicableEntity: 'Perotti Advisory Group, LLC (S-Corp)',
    taxYear: 2025,
    objective: 'Accelerate recovery of tangible personal property purchased and placed into service during 2025.',
    relevantAuthority: 'IRC § 179 / Treasury Reg. § 1.179-1; IRC § 168(k)',
    eligibilityConditions: [
      'Property must be tangible personal property acquired for business use (>50%).',
      'Placed into service prior to December 31, 2025.',
      'Subject to business income limitation under § 179(b)(3).'
    ],
    requiredEvidence: [
      'Itemized purchase invoices and bills of sale.',
      'Substantiation of in-service date.',
      'Log verifying >50% business use.'
    ],
    estimatedScenarioSavings: {
      conservative: 6800,
      moderate: 9400,
      disclaimer: 'Scenario projection only; actual tax liability depends on total pass-through income and marginal bracket.'
    },
    risksAndLimitations: [
      'Recapture rules apply under § 179(d)(10) if business use drops to 50% or below in subsequent tax years.'
    ],
    implementationSteps: [
      'Reconcile fixed asset invoices against capital expenditure schedule.',
      'Elect § 179 treatment on Form 4562 Part I.',
      'Coordinate pass-through basis tracking on Schedule K-1.'
    ],
    responsibleProfessional: 'Desmond Hinds, Founder & CEO',
    reviewDate: '2026-02-18',
    clientAcknowledgmentStatus: 'acknowledged',
    clientAcknowledgedTimestamp: '2026-02-20T10:14:00Z',
    status: 'approved_by_cpa'
  },
  {
    id: 'strat_02',
    title: 'IRC § 199A Qualified Business Income (QBI) Optimization',
    applicableEntity: 'Robert Perotti (Individual Form 1040)',
    taxYear: 2025,
    objective: 'Maximize up to 20% deduction on qualified business income from domestic pass-through entities.',
    relevantAuthority: 'IRC § 199A; Treasury Reg. §§ 1.199A-1 through 1.199A-6',
    eligibilityConditions: [
      'Qualified trade or business operated in the United States.',
      'Evaluation of Specified Service Trade or Business (SSTB) threshold limits for married filing jointly.',
      'W-2 wage and unadjusted basis immediately after acquisition (UBIA) limitation testing.'
    ],
    requiredEvidence: [
      'Form W-3 and quarterly 941 reports substantiating officer compensation.',
      'Schedule K-1 Statement A QBI pass-through data.'
    ],
    estimatedScenarioSavings: {
      conservative: 5200,
      moderate: 7100,
      disclaimer: 'Subject to statutory taxable income phaseout limitations and W-2 wage testing.'
    },
    risksAndLimitations: [
      'SSTB status could phase out deduction if joint taxable income exceeds statutory ceilings.'
    ],
    implementationSteps: [
      'Model officer reasonable compensation versus dividend distributions.',
      'Complete Form 8995-A with applicable wage worksheets.',
      'Retain substantiation workpapers for IRS documentation.'
    ],
    responsibleProfessional: 'Elena Rostova, CPA',
    reviewDate: '2026-02-25',
    clientAcknowledgmentStatus: 'pending',
    status: 'approved_by_cpa'
  }
];

export const INITIAL_ACCOUNTING_CONNECTIONS: AccountingConnector[] = [
  {
    id: 'conn_qbo_01',
    clientId: 'user_client_1',
    platform: 'quickbooks_online',
    platformName: 'Intuit QuickBooks Online',
    connectedEntityName: 'Perotti Advisory Group, LLC',
    authMethod: 'oauth_2_read_only',
    status: 'connected',
    grantedScopes: ['com.intuit.quickbooks.accounting.readonly'],
    lastSyncTimestamp: '2026-03-12T04:15:00Z',
    syncRecordCounts: {
      accounts: 34,
      transactions: 412,
      reconciledCount: 398,
      pendingClarificationCount: 2
    },
    proposedAdjustments: [
      {
        id: 'adj_01',
        date: '2025-12-31',
        accountName: '6010 - Office Supplies vs Equipment',
        description: 'Reclassify $2,450 workstation purchase from Office Expense to Capital Fixed Asset (Equipment)',
        proposedDebit: 2450,
        proposedCredit: 0,
        taxReason: 'Required for IRC § 179 depreciation election on Form 4562.',
        status: 'draft_proposal'
      },
      {
        id: 'adj_02',
        date: '2025-12-31',
        accountName: '6080 - Business Meals (50% Limitation)',
        description: 'Segregate client dining ($1,820) from 100% deductible office snacks ($430)',
        proposedDebit: 1820,
        proposedCredit: 0,
        taxReason: 'IRC § 274(n) enforces 50% deduction limit on business meal expenditures.',
        status: 'draft_proposal'
      }
    ]
  }
];

export const INITIAL_BUSINESS_CLOSURE_WORKFLOW: BusinessClosureWorkflow = {
  id: 'closure_wf_01',
  entityName: 'Perotti Advisory Group, LLC',
  einMasked: '••-•••4912',
  stateOfFormation: 'South Carolina',
  targetClosureDate: '2025-12-31',
  status: 'in_progress',
  steps: [
    {
      id: 'step_01',
      title: 'Final Federal Return Marking (Form 1120-S / Form 1065)',
      category: 'federal_tax',
      description: 'Check "Final Return" box on Form 1120-S / Form 1065 and issue Final Schedule K-1s to all partners/shareholders.',
      completed: true,
      requiresCpaReview: true,
      notes: 'Final 2025 return marked; Schedule K-1 marked Final.'
    },
    {
      id: 'step_02',
      title: 'South Carolina Articles of Dissolution Filing',
      category: 'state_dissolution',
      description: 'Submit Articles of Dissolution with the South Carolina Secretary of State and obtain tax clearance from SCDOR.',
      completed: false,
      requiresCpaReview: true,
      notes: 'Awaiting client approval of Articles of Dissolution form.'
    },
    {
      id: 'step_03',
      title: 'Final Payroll Return & Form 941 / Form 940 Closeout',
      category: 'payroll_contractor',
      description: 'File final Form 941 with "Final" checkbox, file annual Form 940, and issue all Form W-2s.',
      completed: true,
      requiresCpaReview: true,
      notes: 'Final payroll ran on Dec 15; W-2s and 941s transmitted.'
    },
    {
      id: 'step_04',
      title: 'Contractor Reporting (Form 1099-NEC / Form 1096)',
      category: 'payroll_contractor',
      description: 'Transmit all final 1099-NEC payments to contractors and file Form 1096 summary.',
      completed: true,
      requiresCpaReview: false,
      notes: 'Completed Jan 28, 2026.'
    },
    {
      id: 'step_05',
      title: 'Asset Disposition & Inventory Distribution',
      category: 'asset_inventory',
      description: 'Document the sale, transfer, or liquidation of business personal property and inventory.',
      completed: true,
      requiresCpaReview: true,
      notes: 'All equipment depreciated or transferred at fair market value.'
    },
    {
      id: 'step_06',
      title: 'State Sales Tax Account Closeout (SCDOR Form C-278)',
      category: 'state_dissolution',
      description: 'Submit final sales tax report and cancel SC retail sales tax license.',
      completed: false,
      requiresCpaReview: true,
      notes: 'Pending final month sales tax remittance.'
    },
    {
      id: 'step_07',
      title: 'IRS Business Account & EIN Inactivation Request',
      category: 'accounts_closure',
      description: 'Send formal written notification to the IRS Internal Revenue Service Center requesting business account closure.',
      completed: false,
      requiresCpaReview: true,
      notes: 'Requires all tax returns and payments to be fully processed first.'
    },
    {
      id: 'step_08',
      title: 'Record Retention & Statute of Limitations Archive',
      category: 'federal_tax',
      description: 'Retain employment tax records for a minimum of 4 years; income tax records for at least 7 years under IRS guidelines.',
      completed: false,
      requiresCpaReview: false,
      notes: 'Digital vault configured with 7-year legal retention schedule.'
    }
  ]
};

export const INITIAL_REGULATORY_UPDATES: RegulatoryUpdateItem[] = [
  {
    id: 'reg_01',
    sourceUrl: 'https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025',
    title: 'IRS Revenue Procedure 2024-40: 2025 Tax Inflation Adjustments',
    agency: 'Internal Revenue Service (IRS)',
    publicationDate: '2024-10-22',
    effectiveDate: '2025-01-01',
    jurisdiction: 'Federal',
    taxYear: 2025,
    contentHash: 'sha256_reg_rp202440_91823',
    impactSummary: 'Standard deduction increases to $30,000 for married couples filing jointly; top tax bracket begins at $751,600.',
    actionRequired: false,
    professionalReviewStatus: 'reviewed_and_approved',
    reviewedBy: 'Desmond Hinds, Founder & CEO'
  },
  {
    id: 'reg_02',
    sourceUrl: 'https://dor.sc.gov/tax/individual-income/rate-reduction',
    title: 'SCDOR Information Letter 24-12: SC Individual Income Tax Rate Cut',
    agency: 'South Carolina Department of Revenue',
    publicationDate: '2024-11-15',
    effectiveDate: '2025-01-01',
    jurisdiction: 'South Carolina',
    taxYear: 2025,
    contentHash: 'sha256_scdor_il2412_00918',
    impactSummary: 'South Carolina maximum individual income tax rate reduced from 6.4% to 6.2% for tax year 2025.',
    actionRequired: false,
    professionalReviewStatus: 'reviewed_and_approved',
    reviewedBy: 'Desmond Hinds, Founder & CEO'
  },
  {
    id: 'reg_03',
    sourceUrl: 'https://www.fincen.gov/boi',
    title: 'FinCEN Notice: Corporate Transparency Act (CTA) Reporting Verification',
    agency: 'Financial Crimes Enforcement Network (FinCEN)',
    publicationDate: '2024-12-05',
    effectiveDate: '2025-01-01',
    jurisdiction: 'Federal',
    taxYear: 2025,
    contentHash: 'sha256_fincen_cta_81920',
    impactSummary: 'Mandatory beneficial ownership reporting for domestic entities created prior to 2024 and ongoing reporting for updates within 30 days.',
    actionRequired: true,
    actionInstructions: 'Verify beneficial owner details in your Profile & Security tab under Business Entity Profile.',
    professionalReviewStatus: 'reviewed_and_approved',
    reviewedBy: 'Elena Rostova, CPA'
  }
];

export const INITIAL_AUDIT_EVENTS: AuditEventRecord[] = [
  {
    id: 'audit_01',
    timestamp: '2026-03-14T10:14:00Z',
    actor: {
      userId: 'user_client_1',
      userName: 'Robert Perotti',
      role: 'Client'
    },
    action: 'SIGN_IN',
    targetResource: 'Client Portal Session',
    resourceTarget: 'Client Portal Session',
    resourceId: 'sess_99182746',
    ipAddressMasked: '73.189.•••.•••',
    actorIpAddress: '73.189.201.44',
    actorEmail: 'robert.perotti@apexmachinery.com',
    actorRole: 'Client Taxpayer',
    actorUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    eventCategory: 'auth',
    tamperEvidentHash: 'sha256_audit_ev_918273645019',
    eventHash: 'sha256_audit_ev_918273645019'
  },
  {
    id: 'audit_02',
    timestamp: '2026-03-14T10:18:22Z',
    actor: {
      userId: 'user_client_1',
      userName: 'Robert Perotti',
      role: 'Client'
    },
    action: 'VIEW_SENSITIVE_RECORD',
    targetResource: 'Form 1040 Locked Review Draft',
    resourceTarget: 'Form 1040 Locked Review Draft',
    resourceId: 'doc_ver_1040_final_draft_v2',
    ipAddressMasked: '73.189.•••.•••',
    actorIpAddress: '73.189.201.44',
    actorEmail: 'robert.perotti@apexmachinery.com',
    actorRole: 'Client Taxpayer',
    actorUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    eventCategory: 'document',
    tamperEvidentHash: 'sha256_audit_ev_817263549018',
    eventHash: 'sha256_audit_ev_817263549018'
  },
  {
    id: 'audit_03',
    timestamp: '2026-03-14T09:45:00Z',
    actor: {
      userId: 'staff_desmond_hinds',
      userName: 'Desmond Hinds',
      role: 'Founder & CEO'
    },
    action: 'DOCUMENT_UPLOAD',
    targetResource: 'Client Draft Tax Return v2',
    resourceTarget: 'Client Draft Tax Return v2',
    resourceId: 'doc_ver_1040_final_draft_v2',
    ipAddressMasked: '64.120.•••.•••',
    actorIpAddress: '64.120.14.88',
    actorEmail: 'dhinds@artaxservices.com',
    actorRole: 'Founder & Principal Preparer',
    actorUserAgent: 'Chrome/122.0.0.0 Safari/537.36',
    eventCategory: 'document',
    tamperEvidentHash: 'sha256_audit_ev_716253489017',
    eventHash: 'sha256_audit_ev_716253489017'
  },
  {
    id: 'audit_04',
    timestamp: '2026-03-13T16:30:10Z',
    actor: {
      userId: 'user_client_1',
      userName: 'Robert Perotti',
      role: 'Client'
    },
    action: 'FORM_8879_AUTHORIZED',
    targetResource: 'IRS e-File Signature Authorization (Form 8879)',
    resourceTarget: 'IRS e-File Signature Authorization (Form 8879)',
    resourceId: 'sig_8879_perotti_2025',
    ipAddressMasked: '73.189.•••.•••',
    actorIpAddress: '73.189.201.44',
    actorEmail: 'robert.perotti@apexmachinery.com',
    actorRole: 'Client Taxpayer',
    actorUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    eventCategory: 'signing',
    tamperEvidentHash: 'sha256_audit_ev_605142378906',
    eventHash: 'sha256_audit_ev_605142378906'
  },
  {
    id: 'audit_05',
    timestamp: '2026-03-13T14:15:00Z',
    actor: {
      userId: 'user_client_1',
      userName: 'Robert Perotti',
      role: 'Client'
    },
    action: 'CLIENT_COMMENT_SUBMITTED',
    targetResource: 'IRC § 7216 Consent to Disclose / Advisory Use',
    resourceTarget: 'IRC § 7216 Consent to Disclose / Advisory Use',
    resourceId: 'consent_7216_grant_2025',
    ipAddressMasked: '73.189.•••.•••',
    actorIpAddress: '73.189.201.44',
    actorEmail: 'robert.perotti@apexmachinery.com',
    actorRole: 'Client Taxpayer',
    actorUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    eventCategory: 'consent',
    tamperEvidentHash: 'sha256_audit_ev_504031267895',
    eventHash: 'sha256_audit_ev_504031267895'
  },
  {
    id: 'audit_06',
    timestamp: '2026-03-12T11:20:00Z',
    actor: {
      userId: 'staff_elena_rostova',
      userName: 'Elena Rostova, CPA',
      role: 'Senior Reviewer'
    },
    action: 'SENIOR_REVIEWER_SIGNOFF',
    targetResource: 'Comprehensive Quality Review Signoff (Form 1040 & Sch C)',
    resourceTarget: 'Comprehensive Quality Review Signoff (Form 1040 & Sch C)',
    resourceId: 'cpa_signoff_2025_001',
    ipAddressMasked: '64.120.•••.•••',
    actorIpAddress: '64.120.14.89',
    actorEmail: 'elena@artaxservices.com',
    actorRole: 'Senior Reviewer & CPA',
    actorUserAgent: 'Chrome/122.0.0.0 Safari/537.36',
    eventCategory: 'security',
    tamperEvidentHash: 'sha256_audit_ev_403920156784',
    eventHash: 'sha256_audit_ev_403920156784'
  }
];

export const MOCK_AUDIT_TRAIL: AuditEventRecord[] = INITIAL_AUDIT_EVENTS;

export const INITIAL_FILING_DETAILS: FilingSubmissionDetails = {
  submissionId: 'mef_sub_2025_9812736',
  taxYear: 2025,
  jurisdiction: 'Federal (IRS)',
  formType: 'Form 1040 (U.S. Individual Income Tax Return)',
  transmissionTimestamp: '2026-03-14T10:00:00Z',
  transmissionChannel: 'MeF_Authorized_Transmitter',
  efinMasked: '29••••',
  status: 'pending_irs',
  submissionTrackingNumber: '20260731000000001829'
};

// ---------------------------------------------------------------------------
// 4. Offline Synchronization Queue Manager
// ---------------------------------------------------------------------------

const LOCAL_STORAGE_SYNC_QUEUE_KEY = 'ar_tax_client_sync_queue_v1';

export class ClientSyncService {
  private static events: SyncEvent[] = [];

  static getQueue(): SyncEvent[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_SYNC_QUEUE_KEY);
      if (data) {
        this.events = JSON.parse(data);
      }
    } catch {
      // fallback in-memory
    }
    return this.events;
  }

  static enqueueEvent(
    actionType: SyncEvent['actionType'],
    payload: Record<string, any>,
    clientId: string = 'user_client_1'
  ): SyncEvent {
    const queue = this.getQueue();
    const event: SyncEvent = {
      eventId: `sync_ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      clientId,
      deviceId: 'browser_client_device_primary',
      localSequenceNumber: queue.length + 1,
      createdAt: new Date().toISOString(),
      idempotencyKey: `idem_${actionType}_${Date.now()}`,
      actionType,
      payload,
      status: 'pending_local'
    };

    queue.push(event);
    try {
      localStorage.setItem(LOCAL_STORAGE_SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // storage unavailable
    }
    return event;
  }

  static syncAll(): { syncedCount: number; errors: number } {
    const queue = this.getQueue();
    let synced = 0;
    
    // Simulate server transmission and idempotency check
    const updated = queue.map(ev => {
      if (ev.status === 'pending_local') {
        synced++;
        return { ...ev, status: 'synced' as const };
      }
      return ev;
    });

    try {
      localStorage.setItem(LOCAL_STORAGE_SYNC_QUEUE_KEY, JSON.stringify(updated));
    } catch {
      // storage unavailable
    }
    return { syncedCount: synced, errors: 0 };
  }

  static clearSynced(): void {
    const queue = this.getQueue();
    const remaining = queue.filter(ev => ev.status !== 'synced');
    try {
      localStorage.setItem(LOCAL_STORAGE_SYNC_QUEUE_KEY, JSON.stringify(remaining));
    } catch {
      // storage unavailable
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Mock Fixtures & Direct Export Aliases for Views
// ---------------------------------------------------------------------------

export const MOCK_DEADLINES: JurisdictionDeadline[] = getJurisdictionDeadlines(2025);
export const MOCK_APPROVALS: ApprovalRecord[] = INITIAL_APPROVALS;
export const MOCK_STRATEGIES: TaxStrategyItem[] = INITIAL_STRATEGIES;
export const MOCK_ACCOUNTING_CONNECTORS: AccountingConnector[] = INITIAL_ACCOUNTING_CONNECTIONS;
export const MOCK_BUSINESS_CLOSURE: BusinessClosureWorkflow = INITIAL_BUSINESS_CLOSURE_WORKFLOW;
export const MOCK_FILING_DETAILS: FilingSubmissionDetails = INITIAL_FILING_DETAILS;

export const MOCK_ENGAGEMENT: any = {
  id: 'eng_2025_001',
  clientId: 'user_client_1',
  serviceType: 'individual_tax_1040',
  taxYear: 2025,
  status: 'ready_for_signature',
  assignedAccountantName: 'Desmond Hinds, Founder & CEO',
  assignedReviewerName: 'Elena Rostova, CPA',
  createdAt: '2026-01-05T09:00:00Z',
  updatedAt: '2026-03-12T10:00:00Z'
};

export const MOCK_DOCUMENTS: any[] = [
  {
    id: 'doc_w2_01',
    clientId: 'user_client_1',
    engagementId: 'eng_2025_001',
    title: '2025_Form_W2_Apex_Tech.pdf',
    category: 'w2',
    taxYear: 2025,
    fileSize: 450000,
    status: 'approved',
    uploadedAt: '2026-01-22T14:20:00Z',
    uploadedBy: 'Robert Perotti',
    fileUrl: '/mock/2025_w2.pdf'
  },
  {
    id: 'doc_1099_01',
    clientId: 'user_client_1',
    engagementId: 'eng_2025_001',
    title: '2025_Form_1099_NEC_Consulting.pdf',
    category: '1099',
    taxYear: 2025,
    fileSize: 320000,
    status: 'approved',
    uploadedAt: '2026-01-25T11:10:00Z',
    uploadedBy: 'Robert Perotti',
    fileUrl: '/mock/2025_1099nec.pdf'
  },
  {
    id: 'doc_k1_01',
    clientId: 'user_client_1',
    engagementId: 'eng_2025_001',
    title: '2025_Schedule_K1_Perotti_Advisory.pdf',
    category: 'schedule_k1',
    taxYear: 2025,
    fileSize: 580000,
    status: 'approved',
    uploadedAt: '2026-02-02T16:00:00Z',
    uploadedBy: 'Robert Perotti',
    fileUrl: '/mock/2025_k1.pdf'
  },
  {
    id: 'doc_bank_stmt_01',
    clientId: 'user_client_1',
    engagementId: 'eng_2025_001',
    title: 'Dec_2025_Chase_Business_Operating_Stmt.pdf',
    category: 'bank_statement',
    taxYear: 2025,
    fileSize: 1200000,
    status: 'action_required',
    uploadedAt: '2026-02-14T09:45:00Z',
    uploadedBy: 'Robert Perotti',
    fileUrl: '/mock/chase_dec_2025.pdf'
  }
];

// ---------------------------------------------------------------------------
// 12. Expense Items & Records (Section 5)
// ---------------------------------------------------------------------------
export const MOCK_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp_001',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Perotti Advisory Group, LLC',
    date: '2025-03-14',
    vendor: 'Dell Technologies',
    amount: 2450.00,
    currency: 'USD',
    paymentMethod: 'business_card',
    category: 'depreciation_section_179',
    businessPurpose: 'Dual high-resolution client presentation displays and engineering workstation dock.',
    receiptDocumentId: 'doc_receipt_01',
    receiptFileName: 'Dell_Order_Workstation_2025.pdf',
    notes: 'Eligible for 100% first-year expensing under IRC § 179.',
    classificationOrigin: 'client_entered',
    aiSuggestedCategory: 'depreciation_section_179',
    professionalReviewStatus: 'accountant_approved',
    accountantNotes: 'Approved for Form 4562 Line 6 § 179 election.',
    createdAt: '2025-03-15T10:00:00Z'
  },
  {
    id: 'exp_002',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Perotti Advisory Group, LLC',
    date: '2025-05-18',
    vendor: 'Google Cloud Platform',
    amount: 485.60,
    currency: 'USD',
    paymentMethod: 'business_card',
    category: 'utilities',
    businessPurpose: 'Monthly client portal cloud hosting, encrypted database instances, and compute.',
    receiptDocumentId: 'doc_receipt_02',
    receiptFileName: 'GCP_Invoice_May2025.pdf',
    notes: 'Recurring monthly infrastructure cost.',
    classificationOrigin: 'accounting_import',
    aiSuggestedCategory: 'office_expense',
    professionalReviewStatus: 'accountant_approved',
    createdAt: '2025-05-20T14:15:00Z'
  },
  {
    id: 'exp_003',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Perotti Advisory Group, LLC',
    date: '2025-08-11',
    vendor: 'The Capital Grille - Charleston',
    amount: 320.00,
    currency: 'USD',
    paymentMethod: 'business_card',
    category: 'meals_50_percent',
    businessPurpose: 'Quarterly strategic advisory dinner with real estate development client.',
    receiptDocumentId: 'doc_receipt_03',
    receiptFileName: 'CapitalGrille_Dinner_Aug11.pdf',
    notes: 'Attendees: Robert Perotti, Marcus Vance (VP Carolina Commercial). Substantial business discussion held.',
    classificationOrigin: 'client_entered',
    aiSuggestedCategory: 'meals_50_percent',
    professionalReviewStatus: 'accountant_approved',
    accountantNotes: 'Subject to statutory 50% limitation under IRC § 274(n).',
    createdAt: '2025-08-12T09:30:00Z'
  },
  {
    id: 'exp_004',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Perotti Advisory Group, LLC',
    date: '2025-11-04',
    vendor: 'Staples Business Delivery',
    amount: 142.80,
    currency: 'USD',
    paymentMethod: 'business_card',
    category: 'supplies',
    businessPurpose: 'Presentation binders, tax workpaper filing folders, and printing toner.',
    receiptFileName: 'Staples_Order_110425.pdf',
    classificationOrigin: 'client_entered',
    professionalReviewStatus: 'unreviewed',
    createdAt: '2025-11-05T11:00:00Z'
  }
];

// ---------------------------------------------------------------------------
// 13. Cash Transactions (Section 6)
// ---------------------------------------------------------------------------
export const MOCK_CASH_TRANSACTIONS: CashTransactionItem[] = [
  {
    id: 'cash_001',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Perotti Advisory Group, LLC',
    date: '2025-06-22',
    amount: 150.00,
    direction: 'outflow',
    transactionType: 'petty_cash_activity',
    counterparty: 'Downtown Courier Express',
    businessPurpose: 'Same-day legal courier delivery of stamped municipal zoning permits to Columbia City Hall.',
    explanationWhenNoReceipt: 'Handwritten delivery receipt provided; physical ticket stamped and uploaded.',
    supportingEvidenceDocId: 'doc_courier_receipt',
    supportingEvidenceFileName: 'Courier_Handwritten_Slip.pdf',
    clientPerjuryCertified: true,
    certifiedTimestamp: '2025-06-23T08:15:00Z',
    signerLegalName: 'Robert Perotti',
    status: 'verified_by_accountant',
    cpaAuditNotes: 'Verified receipt against city permit timestamp.'
  },
  {
    id: 'cash_002',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Perotti Advisory Group, LLC',
    date: '2025-09-05',
    amount: 1200.00,
    direction: 'inflow',
    transactionType: 'cash_income',
    counterparty: 'Apex Builders LLC (Cash Settlement)',
    businessPurpose: 'On-site technical consultation fee paid in cash during job-site walk.',
    explanationWhenNoReceipt: 'Formal invoice #2025-089 issued with signed cash receipt counter-slip provided to client.',
    supportingEvidenceDocId: 'doc_cash_invoice_slip',
    supportingEvidenceFileName: 'Signed_Cash_Receipt_Slip_089.pdf',
    clientPerjuryCertified: true,
    certifiedTimestamp: '2025-09-05T17:00:00Z',
    signerLegalName: 'Robert Perotti',
    status: 'verified_by_accountant',
    cpaAuditNotes: 'Reconciled and included in Schedule C Gross Receipts.'
  },
  {
    id: 'cash_003',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Perotti Advisory Group, LLC',
    date: '2025-10-14',
    amount: 75.00,
    direction: 'outflow',
    transactionType: 'cash_expense',
    counterparty: 'Municipal Parking Garage - Charlotte',
    businessPurpose: 'Attending client project review conference with general contractor.',
    explanationWhenNoReceipt: 'Automated kiosk dispenser failed to print receipt; date and location match client agenda.',
    clientPerjuryCertified: true,
    certifiedTimestamp: '2025-10-15T09:12:00Z',
    signerLegalName: 'Robert Perotti',
    status: 'submitted_to_cpa'
  }
];

// ---------------------------------------------------------------------------
// 14. Mileage & Asset Tracking (Section 5)
// ---------------------------------------------------------------------------
export const MOCK_MILEAGE: MileageLogItem[] = [
  {
    id: 'mil_001',
    clientId: 'user_client_1',
    taxYear: 2025,
    date: '2025-04-10',
    vehicleDescription: '2023 Ford F-150 Lightning (Business Vehicle)',
    startLocation: 'Office (100 Executive Center Dr, Columbia SC)',
    endLocation: 'Job Site (450 Riverfront Way, Charleston SC)',
    businessPurpose: 'Commercial structural inspection and owner walkthrough.',
    startingOdometer: 14210,
    endingOdometer: 14440,
    totalMiles: 230,
    standardMileageRate: 0.67,
    calculatedDeduction: 154.10,
    substantiationStatus: 'verified_by_accountant'
  },
  {
    id: 'mil_002',
    clientId: 'user_client_1',
    taxYear: 2025,
    date: '2025-07-22',
    vehicleDescription: '2023 Ford F-150 Lightning (Business Vehicle)',
    startLocation: 'Office (Columbia SC)',
    endLocation: 'SC Department of Transportation (Columbia SC)',
    businessPurpose: 'Submitting traffic mitigation study plans for client permit.',
    startingOdometer: 17850,
    endingOdometer: 17878,
    totalMiles: 28,
    standardMileageRate: 0.67,
    calculatedDeduction: 18.76,
    substantiationStatus: 'verified_by_accountant'
  },
  {
    id: 'mil_003',
    clientId: 'user_client_1',
    taxYear: 2025,
    date: '2025-10-12',
    vehicleDescription: '2023 Ford F-150 Lightning (Business Vehicle)',
    startLocation: 'Office (Columbia SC)',
    endLocation: 'Regional Engineering Symposium (Greenville SC)',
    businessPurpose: 'Professional continuing education and contractor vendor showcase.',
    startingOdometer: 21300,
    endingOdometer: 21510,
    totalMiles: 210,
    standardMileageRate: 0.67,
    calculatedDeduction: 140.70,
    substantiationStatus: 'logged'
  }
];

export const MOCK_FIXED_ASSETS: FixedAssetRecord[] = [
  {
    id: 'ast_001',
    clientId: 'user_client_1',
    entityName: 'Perotti Advisory Group, LLC',
    taxYearAcquired: 2025,
    assetDescription: 'Dell Precision 7960 Tower Workstation + Dual UltraSharp 32" 4K Displays',
    assetCategory: 'computers_software',
    acquisitionDate: '2025-03-14',
    costBasis: 2450.00,
    businessUsePercentage: 100,
    section179ElectionRequested: true,
    specialDepreciationAllowance: false,
    professionalDepreciationStatus: 'depreciated_form_4562'
  },
  {
    id: 'ast_002',
    clientId: 'user_client_1',
    entityName: 'Perotti Advisory Group, LLC',
    taxYearAcquired: 2023,
    assetDescription: 'Survey & Laser Metrology Kit for Building Inspection',
    assetCategory: 'equipment_machinery',
    acquisitionDate: '2023-06-10',
    costBasis: 6800.00,
    businessUsePercentage: 100,
    section179ElectionRequested: true,
    specialDepreciationAllowance: false,
    professionalDepreciationStatus: 'depreciated_form_4562'
  }
];

// ---------------------------------------------------------------------------
// 15. Missing-Document Checklist (Section 11)
// ---------------------------------------------------------------------------
export const MOCK_MISSING_DOCUMENTS: MissingDocumentItem[] = [
  {
    id: 'req_001',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Robert & Sarah Perotti (Individual Form 1040)',
    title: 'Form 1098 - Mortgage Interest Statement (Primary Residence)',
    category: '1098',
    reasonRequired: 'Needed to compute Schedule A itemized deductions for residential mortgage interest and real estate property taxes.',
    dueDate: '2026-03-15',
    status: 'ACCEPTED_FOR_REVIEW',
    urgency: 'critical',
    uploadedDocumentId: 'doc_1098_01',
    uploadedFileName: '2025_Form_1098_WellsFargo.pdf',
    uploadedTimestamp: '2026-01-28T14:20:00Z',
    clarifications: [
      {
        id: 'clr_01',
        author: 'Robert Perotti',
        role: 'client',
        timestamp: '2026-01-28T14:21:00Z',
        message: 'Uploaded the official Wells Fargo year-end statement. Box 1 interest matches $14,210.00.'
      },
      {
        id: 'clr_02',
        author: 'Desmond Hinds, Founder & CEO',
        role: 'accountant',
        timestamp: '2026-01-29T10:05:00Z',
        message: 'Received and verified. Interest and escrow property taxes confirmed for Schedule A.'
      }
    ]
  },
  {
    id: 'req_002',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Perotti Advisory Group, LLC (S-Corp)',
    title: 'December 2025 Chase Business Operating Bank Statement',
    category: 'bank_statement',
    reasonRequired: 'Required for year-end cash reconciliation and validating year-end accounts payable.',
    dueDate: '2026-03-10',
    status: 'NEEDS_CLARIFICATION',
    urgency: 'critical',
    uploadedDocumentId: 'doc_bank_stmt_01',
    uploadedFileName: 'Dec_2025_Chase_Business_Operating_Stmt.pdf',
    uploadedTimestamp: '2026-02-14T09:45:00Z',
    clarifications: [
      {
        id: 'clr_03',
        author: 'Desmond Hinds, Founder & CEO',
        role: 'accountant',
        timestamp: '2026-02-16T11:20:00Z',
        message: 'Page 4 is truncated; please re-upload complete statement with ending page showing Uncleared Check #1042.'
      }
    ]
  },
  {
    id: 'req_003',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Robert & Sarah Perotti (Individual Form 1040)',
    title: 'Form 1099-B (Consolidated Brokerage Year-End Statement)',
    category: '1099_b',
    reasonRequired: 'Substantiates capital gains/losses on Schedule D and wash-sale adjustments.',
    dueDate: '2026-03-20',
    status: 'REQUESTED',
    urgency: 'critical',
    clarifications: []
  },
  {
    id: 'req_004',
    clientId: 'user_client_1',
    taxYear: 2025,
    entityName: 'Perotti Advisory Group, LLC',
    title: 'Form 940 / 941 Q4 Annual Federal Payroll Summary',
    category: 'payroll',
    reasonRequired: 'Reconciliation of Officer W-2 compensation against corporate return lines 7 & 8.',
    dueDate: '2026-03-01',
    status: 'ACCEPTED_FOR_REVIEW',
    uploadedFileName: 'Gusto_2025_Form940_Summary.pdf',
    uploadedTimestamp: '2026-01-20T10:00:00Z',
    urgency: 'critical',
    clarifications: []
  }
];

// ---------------------------------------------------------------------------
// 16. Bank & Financial Connections (Section 8)
// ---------------------------------------------------------------------------
export const MOCK_FINANCIAL_CONNECTORS: FinancialInstitutionConnector[] = [
  {
    id: 'fin_001',
    institutionName: 'JPMorgan Chase Business Banking',
    institutionType: 'bank',
    accountMask: '•••• 4921',
    accountTypeLabel: 'Business Operating Checking',
    authMethod: 'oauth_2_read_only_aggregator',
    status: 'connected',
    lastSyncDate: '2026-03-14T04:00:00Z',
    syncFrequency: 'daily_automatic',
    dataScopesRequested: ['read_account_details', 'read_transactions_statement_history', 'read_balances'],
    retentionPolicy: 'Encrypted storage with 7-year statutory audit retention.',
    balance: 48920.45
  },
  {
    id: 'fin_002',
    institutionName: 'Stripe Merchant Processing',
    institutionType: 'merchant_processor',
    accountMask: 'acct_1N••••4910',
    accountTypeLabel: 'Credit Card & Client Invoicing Payouts',
    authMethod: 'oauth_2_read_only_aggregator',
    status: 'connected',
    lastSyncDate: '2026-03-14T04:00:00Z',
    syncFrequency: 'daily_automatic',
    dataScopesRequested: ['read_charges', 'read_fees', 'read_transfers', 'read_disputes'],
    retentionPolicy: 'Read-only API access. Reconciled against gross 1099-K reporting.',
    balance: 6420.00
  },
  {
    id: 'fin_003',
    institutionName: 'Gusto Payroll Services',
    institutionType: 'payroll',
    accountMask: 'co_••••8821',
    accountTypeLabel: 'Automated Officer & Staff Payroll Feed',
    authMethod: 'oauth_2_read_only_aggregator',
    status: 'connected',
    lastSyncDate: '2026-03-13T18:30:00Z',
    syncFrequency: 'daily_automatic',
    dataScopesRequested: ['read_payroll_runs', 'read_tax_liabilities', 'read_contractor_1099s'],
    retentionPolicy: 'Synched for Form 1120-S line 7 compensation reconciliation.'
  },
  {
    id: 'fin_004',
    institutionName: 'Fidelity Investments (Taxable & SEP-IRA)',
    institutionType: 'brokerage',
    accountMask: '•••• 9120',
    accountTypeLabel: 'SEP-IRA & Corporate Treasury Reserves',
    authMethod: 'oauth_2_read_only_aggregator',
    status: 'connected',
    lastSyncDate: '2026-03-12T22:00:00Z',
    syncFrequency: 'daily_automatic',
    dataScopesRequested: ['read_1099_consolidated', 'read_dividends', 'read_capital_gains'],
    retentionPolicy: 'Read-only tax schedule aggregation.'
  }
];

// ---------------------------------------------------------------------------
// 17. Amendment Requests (Section 22)
// ---------------------------------------------------------------------------
export const MOCK_AMENDMENT_REQUESTS: AmendmentRequestItem[] = [
  {
    id: 'amend_001',
    clientId: 'user_client_1',
    taxYear: 2024,
    originalReturnDescription: '2024 Form 1040 Individual Income Tax Return (Filed April 12, 2025)',
    statutoryForm: 'Form 1040-X',
    reasonForAmendment: 'Received late corrected Form 1099-DIV with qualified dividend adjustment and omitted residential clean energy credit (Form 5695).',
    changeDetails: 'Installed rooftop solar energy system in December 2024 ($18,000 cost basis eligible for 30% IRC § 25D credit = $5,400 tax reduction).',
    hasGovernmentNotice: false,
    attachedSupportingDocs: [
      { name: 'Solar_Installation_Final_Contract_Paid.pdf', size: '1.4 MB', date: '2025-05-10' },
      { name: 'Corrected_1099DIV_Fidelity_2024.pdf', size: '420 KB', date: '2025-05-12' }
    ],
    clientCertifiedUnderPerjury: true,
    submittedAt: '2025-05-15T14:30:00Z',
    status: 'ready_for_client_authorization',
    cpaAssignedNotes: 'Prepared Form 1040-X showing $5,400 additional refund due to client. E-file authorization queued.'
  }
];
