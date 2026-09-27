import { 
  User, 
  Engagement, 
  DocumentItem, 
  Appointment, 
  ServicePlan, 
  Invoice, 
  AccountingConnection, 
  Message, 
  JobListing, 
  Applicant, 
  AuditLog 
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user_client_1',
    email: 'm.perotti@example.com',
    name: 'Michael Perotti',
    role: 'client',
    phone: '803-555-0142',
    companyName: 'Perotti Financial Consulting',
    clientType: 'business',
    mfaEnabled: true,
    status: 'active',
    isVerified: true,
    assignedAccountantId: 'user_accountant_desmond',
    assignedReviewerId: 'user_reviewer_elena',
    onboardingStatus: 'approved',
    onboardingStep: 15,
    createdAt: '2025-11-12T10:00:00Z',
    lastLoginAt: '2026-09-08T08:15:00Z'
  },
  {
    id: 'user_client_2',
    email: 'comfort.d@example.com',
    name: 'Comfort Dondo',
    role: 'client',
    phone: '803-555-0199',
    companyName: 'Dondo Enterprise Holdings LLC',
    clientType: 'business',
    mfaEnabled: true,
    status: 'active',
    isVerified: true,
    assignedAccountantId: 'user_accountant_marcus',
    assignedReviewerId: 'user_reviewer_elena',
    onboardingStatus: 'approved',
    onboardingStep: 15,
    createdAt: '2025-08-10T14:30:00Z',
    lastLoginAt: '2026-09-07T16:45:00Z'
  },
  {
    id: 'user_accountant_desmond',
    email: 'dhinds@artaxservices.com',
    name: 'Desmond Hinds',
    role: 'accountant',
    title: 'Founder & Senior Managing Accountant',
    credentials: ['EA Candidate', 'AFSP Registered Tax Return Preparer', 'Certified QuickBooks ProAdvisor'],
    phone: '678-205-9486',
    companyName: 'A/R Tax Services, LLC',
    mfaEnabled: true,
    status: 'active',
    isVerified: true,
    createdAt: '2020-01-01T08:00:00Z',
    lastLoginAt: '2026-09-08T08:30:00Z'
  },
  {
    id: 'user_accountant_marcus',
    email: 'mvance@artaxservices.com',
    name: 'Marcus Vance',
    role: 'accountant',
    title: 'Staff Tax Accountant',
    credentials: ['MS Accounting', 'Certified Bookkeeper', 'Xero Advisor Certified'],
    phone: '803-555-0182',
    companyName: 'A/R Tax Services, LLC',
    mfaEnabled: true,
    status: 'active',
    isVerified: true,
    createdAt: '2023-04-15T09:00:00Z',
    lastLoginAt: '2026-09-08T07:50:00Z'
  },
  {
    id: 'user_reviewer_elena',
    email: 'erostova@artaxservices.com',
    name: 'Elena Rostova, CPA',
    role: 'senior_reviewer',
    title: 'Principal Quality & Compliance Reviewer',
    credentials: ['CPA (South Carolina Board of Accountancy)', 'IRS Enrolled Agent'],
    phone: '803-555-0177',
    companyName: 'A/R Tax Services, LLC',
    mfaEnabled: true,
    status: 'active',
    isVerified: true,
    createdAt: '2022-09-01T09:00:00Z',
    lastLoginAt: '2026-09-08T08:10:00Z'
  },
  {
    id: 'user_recruiter_sarah',
    email: 'recruiter@artaxservices.com',
    name: 'Sarah Jenkins',
    role: 'recruiter',
    title: 'Talent Acquisition & HR Specialist',
    phone: '803-555-0164',
    companyName: 'A/R Tax Services, LLC',
    mfaEnabled: true,
    status: 'active',
    isVerified: true,
    createdAt: '2023-01-10T09:00:00Z',
    lastLoginAt: '2026-09-08T08:00:00Z'
  },
  {
    id: 'user_admin',
    email: 'admin@artaxservices.com',
    name: 'Victoria Reynolds',
    role: 'admin',
    title: 'Director of Practice Operations & Administration',
    phone: '678-205-9486',
    companyName: 'A/R Tax Services, LLC',
    mfaEnabled: true,
    status: 'active',
    isVerified: true,
    createdAt: '2020-01-01T00:00:00Z',
    lastLoginAt: '2026-09-08T08:45:00Z'
  },
  {
    id: 'user_super_admin',
    email: 'security@artaxservices.com',
    name: 'Principal Security Officer',
    role: 'super_admin',
    title: 'Chief Information Security Officer',
    credentials: ['CISSP', 'CISM'],
    phone: '678-205-9486',
    companyName: 'A/R Tax Services, LLC',
    mfaEnabled: true,
    status: 'active',
    isVerified: true,
    createdAt: '2020-01-01T00:00:00Z',
    lastLoginAt: '2026-09-08T08:50:00Z'
  },
  {
    id: 'user_client_disabled',
    email: 'suspended.test@example.com',
    name: 'Suspended Account Test',
    role: 'client',
    phone: '803-555-0000',
    clientType: 'individual',
    mfaEnabled: false,
    status: 'disabled',
    isVerified: false,
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-01T00:00:00Z'
  }
];

export const INITIAL_SERVICE_PLANS: ServicePlan[] = [
  {
    id: 'plan_individual_essential',
    name: 'Individual Essential',
    tagline: 'Precision personal tax preparation & IRS compliance',
    price: 250,
    billingPeriod: 'one_time',
    isPopular: false,
    description: 'Comprehensive annual federal and state individual tax preparation with dedicated tax strategist review.',
    idealFor: 'W-2 employees, homeowners, retirees, and families seeking error-free filing.',
    features: [
      'Federal & State Individual Tax Preparation (Form 1040)',
      'W-2 and 1099 Standard Processing',
      'Encrypted Document Upload & Digital Vault',
      'Direct Secure Messaging with Assigned Accountant',
      'IRS Transcript Review & Analysis',
      'Year-Round Client Portal Access',
      'One Full Tax Return Package'
    ]
  },
  {
    id: 'plan_business_advisory',
    name: 'Business Advisory',
    tagline: 'Full-spectrum accounting & business tax management',
    price: 199,
    billingPeriod: 'monthly',
    isPopular: true,
    description: 'Ongoing strategic business accounting, monthly bookkeeping, quarterly estimates, and seamless software integration.',
    idealFor: 'LLCs, S-Corporations, startups, and growing small businesses.',
    features: [
      'Complete Business Tax Preparation (1120-S, 1065, Schedule C)',
      'Monthly Bookkeeping & Account Reconciliation',
      'Quarterly Estimated Tax Filings & Calculations',
      'QuickBooks Online & Xero Accounting Integration',
      'Payroll Tax Compliance & 1099 Vendor Filings',
      'Multi-State Tax Filings Support',
      'Priority Support & Dedicated Tax Strategist',
      'Up to Two Business Entities Covered'
    ]
  },
  {
    id: 'plan_premium_family_office',
    name: 'Premium Family Office',
    tagline: 'Holistic wealth preservation & multi-entity stewardship',
    price: 499,
    billingPeriod: 'monthly',
    isPopular: false,
    description: 'Bespoke wealth management coordination, estate coordination, multi-tier corporate structuring, and year-round executive advisory.',
    idealFor: 'High-net-worth families, executives, multi-entity owners, and legacy builders.',
    features: [
      'Both Individual and Multi-Entity Corporate Returns',
      'Proactive Year-Round Tax Strategy & Planning',
      'Estate Planning & Trust Coordination with Legal Specialists',
      'Asset Protection Strategy & Consultation',
      'Credit Solutions & Identity Theft Protection Guidance',
      'Direct Access to Founder Desmond Hinds & Senior Reviewer',
      'Custom Management Reports & Monthly Executive Briefings',
      'Immediate Same-Day Concierge Support'
    ]
  }
];

export const INITIAL_ENGAGEMENTS: Engagement[] = [
  {
    id: 'eng_2025_001',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    taxYear: 2025,
    serviceType: 'individual_tax_1040',
    serviceTitle: '2025 Comprehensive Individual Federal & SC State Filing',
    status: 'under_review',
    priority: 'high',
    assignedAccountantId: 'user_accountant_desmond',
    assignedAccountantName: 'Desmond Hinds',
    reviewerId: 'user_reviewer_elena',
    reviewerName: 'Elena Rostova, CPA',
    dueDate: '2026-04-15',
    progressPercent: 75,
    internalNotes: 'W-2s verified against IRS transcript. Investment portfolio 1099-B wash sale checked. Pending senior review before final client signature.',
    clientNotes: 'Your return has been prepared by Desmond Hinds and is currently in secondary compliance review with our CPA quality control team.',
    createdAt: '2026-01-15T11:00:00Z',
    updatedAt: '2026-09-08T08:00:00Z',
    tasks: [
      { id: 't1', title: 'Complete Tax Intake Questionnaire', completed: true, requiredRole: 'client' },
      { id: 't2', title: 'Upload W-2 & 1099 Income Statements', completed: true, requiredRole: 'client' },
      { id: 't3', title: 'Accountant Workpaper Preparation', completed: true, requiredRole: 'accountant' },
      { id: 't4', title: 'Senior CPA Quality & Compliance Review', completed: false, requiredRole: 'reviewer', dueDate: '2026-09-12' },
      { id: 't5', title: 'Client e-Signature on Form 8879', completed: false, requiredRole: 'client', dueDate: '2026-09-15' },
      { id: 't6', title: 'Final IRS & SC DOR Electronic Submission', completed: false, requiredRole: 'accountant' }
    ]
  },
  {
    id: 'eng_2025_002',
    clientId: 'user_client_2',
    clientName: 'Comfort Dondo',
    businessName: 'Dondo Enterprise Holdings LLC',
    taxYear: 2025,
    serviceType: 'business_tax_scorp_llc',
    serviceTitle: '2025 S-Corp Form 1120-S & Q3 Bookkeeping Reconciliation',
    status: 'in_preparation',
    priority: 'urgent',
    assignedAccountantId: 'user_accountant_marcus',
    assignedAccountantName: 'Marcus Vance',
    reviewerId: 'user_reviewer_elena',
    reviewerName: 'Elena Rostova, CPA',
    dueDate: '2026-09-15',
    progressPercent: 50,
    internalNotes: 'QuickBooks sync completed. Reconciling August credit card statements and shareholder distribution adjustments.',
    clientNotes: 'Marcus Vance is reviewing the August QuickBooks ledger export and finalizing payroll reconciliation.',
    createdAt: '2026-02-01T09:30:00Z',
    updatedAt: '2026-09-07T15:20:00Z',
    tasks: [
      { id: 't201', title: 'QuickBooks Ledger Connection & Export', completed: true, requiredRole: 'client' },
      { id: 't202', title: 'Upload Q3 Payroll Summary 941s', completed: true, requiredRole: 'client' },
      { id: 't203', title: 'Reconciliation & General Ledger Audit', completed: false, requiredRole: 'accountant' },
      { id: 't204', title: 'Draft Form 1120-S & Schedule K-1s', completed: false, requiredRole: 'accountant' },
      { id: 't205', title: 'Senior Review & Partner Sign-off', completed: false, requiredRole: 'reviewer' }
    ]
  },
  {
    id: 'eng_2024_003',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    taxYear: 2024,
    serviceType: 'individual_tax_1040',
    serviceTitle: '2024 Individual Tax Filing (Completed & Archived)',
    status: 'delivered',
    priority: 'low',
    assignedAccountantId: 'user_accountant_desmond',
    assignedAccountantName: 'Desmond Hinds',
    reviewerId: 'user_reviewer_elena',
    reviewerName: 'Elena Rostova, CPA',
    dueDate: '2025-04-15',
    progressPercent: 100,
    internalNotes: 'Filed successfully. IRS and SC DOR accepted. Client copy delivered and archived.',
    clientNotes: 'Your 2024 tax filings were accepted and are permanently available in your Download Center.',
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2025-04-10T12:00:00Z',
    tasks: [
      { id: 't301', title: 'All Steps Completed', completed: true, requiredRole: 'accountant' }
    ]
  }
];

export const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc_101',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    fileName: '2025_W2_Palmetto_Financial.pdf',
    fileSize: '1.2 MB',
    fileType: 'application/pdf',
    category: 'tax_form_w2',
    taxYear: 2025,
    status: 'approved',
    uploadedAt: '2026-02-10T14:22:00Z',
    uploadedBy: 'Michael Perotti',
    version: 1,
    description: 'Primary W-2 Wage Statement from employer Palmetto Financial Group',
    isAiProcessed: true,
    ocrConfidence: 98,
    isEncrypted: true,
    extractedData: [
      { key: 'box_1_wages', label: 'Box 1: Wages, tips, other comp', value: '$124,500.00', confidence: 99, reviewed: true },
      { key: 'box_2_fed_tax', label: 'Box 2: Federal income tax withheld', value: '$22,410.00', confidence: 99, reviewed: true },
      { key: 'box_3_ss_wages', label: 'Box 3: Social security wages', value: '$124,500.00', confidence: 98, reviewed: true },
      { key: 'box_4_ss_tax', label: 'Box 4: Social security tax withheld', value: '$7,719.00', confidence: 98, reviewed: true },
      { key: 'box_16_state_wages', label: 'Box 16: SC State Wages', value: '$124,500.00', confidence: 98, reviewed: true },
      { key: 'box_17_state_tax', label: 'Box 17: SC State Tax Withheld', value: '$7,470.00', confidence: 97, reviewed: true }
    ],
    reviewedBy: 'Desmond Hinds',
    reviewedAt: '2026-02-12T09:15:00Z'
  },
  {
    id: 'doc_102',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    fileName: '2025_1099_DIV_Vanguard_Brokerage.pdf',
    fileSize: '840 KB',
    fileType: 'application/pdf',
    category: 'tax_form_1099',
    taxYear: 2025,
    status: 'accountant_reviewing',
    uploadedAt: '2026-02-18T16:05:00Z',
    uploadedBy: 'Michael Perotti',
    version: 1,
    description: 'Consolidated 1099 Brokerage Statement - Dividend and Capital Gain Distributions',
    isAiProcessed: true,
    ocrConfidence: 94,
    isEncrypted: true,
    extractedData: [
      { key: 'box_1a_total_div', label: '1a Total ordinary dividends', value: '$4,850.20', confidence: 96, reviewed: true },
      { key: 'box_1b_qual_div', label: '1b Qualified dividends', value: '$3,920.00', confidence: 94, reviewed: true },
      { key: 'box_2a_cap_gain', label: '2a Total capital gain dist', value: '$1,240.50', confidence: 92, reviewed: false }
    ],
    reviewedBy: 'Desmond Hinds',
    reviewedAt: '2026-03-01T11:40:00Z'
  },
  {
    id: 'doc_201',
    clientId: 'user_client_2',
    clientName: 'Comfort Dondo',
    fileName: 'Dondo_Holdings_Q3_BalanceSheet_Aug2026.xlsx',
    fileSize: '3.4 MB',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'balance_sheet',
    taxYear: 2025,
    status: 'needs_review',
    uploadedAt: '2026-09-02T11:10:00Z',
    uploadedBy: 'Comfort Dondo',
    version: 2,
    description: 'Exported trial balance & balance sheet from accounting system',
    isAiProcessed: true,
    ocrConfidence: 89,
    isEncrypted: true,
    extractedData: [
      { key: 'total_assets', label: 'Total Current Assets', value: '$642,300.00', confidence: 92, reviewed: false },
      { key: 'total_liabilities', label: 'Total Current Liabilities', value: '$118,450.00', confidence: 90, reviewed: false },
      { key: 'shareholder_equity', label: 'Shareholder Equity', value: '$523,850.00', confidence: 85, needsAttention: true, reviewed: false }
    ]
  },
  {
    id: 'doc_202',
    clientId: 'user_client_2',
    clientName: 'Comfort Dondo',
    fileName: 'Dondo_LLC_Articles_of_Incorporation_SC.pdf',
    fileSize: '2.1 MB',
    fileType: 'application/pdf',
    category: 'legal_document',
    taxYear: 2025,
    status: 'approved',
    uploadedAt: '2025-08-15T09:00:00Z',
    uploadedBy: 'Comfort Dondo',
    version: 1,
    description: 'South Carolina Secretary of State certified organizational papers and EIN confirmation',
    isAiProcessed: false,
    isEncrypted: true,
    reviewedBy: 'Elena Rostova, CPA',
    reviewedAt: '2025-08-20T10:00:00Z'
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt_001',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    clientEmail: 'm.perotti@example.com',
    clientPhone: '803-555-0142',
    serviceType: 'Individual Tax Strategy & Year-End Review',
    accountantId: 'user_accountant_desmond',
    accountantName: 'Desmond Hinds',
    requestedFounder: true,
    date: '2026-09-15',
    timeSlot: '10:00 AM - 11:00 AM EST',
    type: 'virtual',
    status: 'confirmed',
    meetingLink: 'https://meet.google.com/art-axse-rvc',
    notes: 'Discussion of tax loss harvesting options and retirement contributions before calendar year end.',
    createdAt: '2026-09-01T10:00:00Z'
  },
  {
    id: 'apt_002',
    clientId: 'user_client_2',
    clientName: 'Comfort Dondo',
    clientEmail: 'comfort.d@example.com',
    clientPhone: '803-555-0199',
    serviceType: 'Corporate Tax & Multi-Entity Strategy',
    accountantId: 'user_accountant_desmond',
    accountantName: 'Desmond Hinds',
    requestedFounder: true,
    date: '2026-09-18',
    timeSlot: '02:00 PM - 03:00 PM EST',
    type: 'in_office',
    status: 'confirmed',
    location: 'A/R Tax Services, LLC Executive Suite, Columbia, SC',
    notes: 'Review S-Corp officer reasonable compensation calculation and multi-state compliance.',
    createdAt: '2026-09-02T14:00:00Z'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv_1001',
    invoiceNumber: 'INV-2025-0041',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    servicePlanId: 'plan_individual_essential',
    description: 'Individual Essential 2025 Tax Return Preparation & Electronic Filing',
    amount: 250,
    currency: 'USD',
    status: 'paid',
    issuedDate: '2026-01-15',
    dueDate: '2026-02-15',
    paidAt: '2026-01-15T12:30:00Z',
    paymentMethod: 'Credit Card (Stripe ending 4242)'
  },
  {
    id: 'inv_1002',
    invoiceNumber: 'INV-2026-0892',
    clientId: 'user_client_2',
    clientName: 'Comfort Dondo',
    servicePlanId: 'plan_business_advisory',
    description: 'Monthly Business Advisory & Bookkeeping Retainer - September 2026',
    amount: 199,
    currency: 'USD',
    status: 'paid',
    issuedDate: '2026-09-01',
    dueDate: '2026-09-15',
    paidAt: '2026-09-02T10:14:00Z',
    paymentMethod: 'ACH Direct Debit (Chase ending 9104)'
  },
  {
    id: 'inv_1003',
    invoiceNumber: 'INV-2026-0940',
    clientId: 'user_client_2',
    clientName: 'Comfort Dondo',
    description: 'S-Corporation Year-End Tax Return (Form 1120-S) Deposit',
    amount: 650,
    currency: 'USD',
    status: 'pending',
    issuedDate: '2026-09-05',
    dueDate: '2026-09-20'
  }
];

export const INITIAL_ACCOUNTING_CONNECTIONS: AccountingConnection[] = [
  {
    id: 'conn_qbo_01',
    clientId: 'user_client_2',
    provider: 'quickbooks_online',
    providerName: 'Intuit QuickBooks Online',
    companyName: 'Dondo Enterprise Holdings LLC',
    status: 'connected',
    lastSyncedAt: '2026-09-08T06:00:00Z',
    syncScope: ['Chart of Accounts', 'General Ledger', 'Invoices', 'Bank Feeds', 'P&L'],
    syncHealth: 'healthy',
    totalTransactionsSynced: 1420
  },
  {
    id: 'conn_xero_02',
    clientId: 'user_client_1',
    provider: 'xero',
    providerName: 'Xero Cloud Accounting',
    companyName: 'Perotti Consulting Services',
    status: 'connected',
    lastSyncedAt: '2026-09-07T18:00:00Z',
    syncScope: ['Bank Transactions', 'Invoices', 'Expense Records'],
    syncHealth: 'healthy',
    totalTransactionsSynced: 560
  }
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg_01',
    senderId: 'user_accountant_desmond',
    senderName: 'Desmond Hinds',
    senderRole: 'accountant',
    recipientId: 'user_client_1',
    engagementId: 'eng_2025_001',
    content: 'Good morning Michael. I have reviewed your W-2 wage statements and matched them against your IRS Wage & Income Transcript. Everything balances precisely. We are currently finalizing the dividend categorization for your Vanguard statement.',
    timestamp: '2026-09-07T10:15:00Z',
    isInternalOnly: false,
    isRead: true
  },
  {
    id: 'msg_02',
    senderId: 'user_client_1',
    senderName: 'Michael Perotti',
    senderRole: 'client',
    recipientId: 'user_accountant_desmond',
    engagementId: 'eng_2025_001',
    content: 'Thank you Desmond. I uploaded the corrected Schedule D supplement last night as well. Let me know if you need any further clarification on the Vanguard capital gain distributions.',
    timestamp: '2026-09-07T11:05:00Z',
    isInternalOnly: false,
    isRead: true
  },
  {
    id: 'msg_03',
    senderId: 'user_accountant_desmond',
    senderName: 'Desmond Hinds',
    senderRole: 'accountant',
    engagementId: 'eng_2025_001',
    content: '[INTERNAL STAFF NOTE] Checked Vanguard 1099-B box 2a. Wash sale amounts are immaterial ($14.20). Verified cost basis reporting. Ready for Elena Rostova to review.',
    timestamp: '2026-09-07T14:30:00Z',
    isInternalOnly: true,
    isRead: true
  }
];

export const INITIAL_JOBS: JobListing[] = [
  {
    id: 'job_01',
    title: 'Senior Corporate Tax Strategist',
    department: 'Tax',
    location: 'Columbia, South Carolina (Hybrid)',
    type: 'Full-Time',
    workplace: 'Hybrid',
    description: 'A/R Tax Services, LLC is seeking an experienced Senior Tax Strategist to spearhead corporate entity filings (1120-S, 1065), multi-state apportionment, and high-net-worth tax planning.',
    responsibilities: [
      'Lead comprehensive tax preparation for S-Corporations, Partnerships, and multi-tier LLCs.',
      'Perform detailed technical reviews of staff workpapers and electronic returns.',
      'Provide year-round strategic advisory and tax-saving consultations to business executives.',
      'Represent clients in IRS and South Carolina Department of Revenue correspondence.'
    ],
    requirements: [
      'CPA or Enrolled Agent (EA) credential required.',
      '5+ years of progressive tax preparation experience in public accounting.',
      'Proficiency in UltraTax, Drake, ProConnect, or equivalent professional tax software.',
      'Deep commitment to client integrity, confidentiality, and exceptional service.'
    ],
    benefits: [
      'Competitive compensation package ($95,000 - $130,000 + performance bonuses)',
      'Comprehensive health, dental, and vision insurance',
      '401(k) retirement plan with generous employer matching',
      'Generous paid time off and flexible off-season hours',
      'Continuing Professional Education (CPE) sponsorship'
    ],
    isActive: true,
    status: 'open',
    salaryRange: '$95,000 - $130,000 / year',
    postedDate: '2026-08-15'
  },
  {
    id: 'job_02',
    title: 'Staff Accountant & Bookkeeping Specialist',
    department: 'Accounting',
    location: 'Columbia, South Carolina or Remote',
    type: 'Full-Time',
    workplace: 'Remote',
    description: 'We are expanding our business advisory division and seeking a detail-driven Staff Accountant to manage monthly client reconciliations, QuickBooks Online integration, and payroll compliance.',
    responsibilities: [
      'Execute monthly and quarterly bank and credit card reconciliations across QBO and Xero.',
      'Prepare adjusting journal entries, depreciation schedules, and monthly management reports.',
      'Assist clients in cleaning up historical books and organizing financial records for tax season.',
      'Collaborate directly with Senior Tax Accountants during year-end closing.'
    ],
    requirements: [
      'Bachelor’s degree in Accounting, Finance, or related field.',
      '2+ years of bookkeeping or public accounting experience.',
      'QuickBooks Online Certified ProAdvisor preferred.',
      'Strong organizational skills and meticulous attention to numerical precision.'
    ],
    benefits: [
      'Competitive salary ($55,000 - $72,000)',
      '100% remote flexibility with home office stipend',
      'Health insurance and wellness allowance',
      'Tuition & CPA exam study materials assistance'
    ],
    isActive: true,
    status: 'open',
    salaryRange: '$55,000 - $72,000 / year',
    postedDate: '2026-08-20'
  },
  {
    id: 'job_03',
    title: 'Client Onboarding & Concierge Specialist',
    department: 'Operations',
    location: 'Columbia, South Carolina (Onsite)',
    type: 'Full-Time',
    workplace: 'Onsite',
    description: 'Serve as the welcoming ambassador of A/R Tax Services, LLC. Guide prospective clients through digital onboarding, encrypted document collection, consultation scheduling, and portal navigation.',
    responsibilities: [
      'Facilitate seamless client onboarding through our digital portal and intake questionnaires.',
      'Ensure missing document alerts are resolved swiftly with warmth and professionalism.',
      'Manage consultation calendars for Founder Desmond Hinds and senior tax staff.',
      'Uphold strict client privacy and SOC 2 / GDPR-aligned data handling protocols.'
    ],
    requirements: [
      'Associate or Bachelor’s degree preferred.',
      '2+ years of client service experience in high-end financial, legal, or executive services.',
      'Superb verbal and written communication skills with warm, empathetic demeanor.',
      'Tech-savvy with CRM, document portals, and scheduling tools.'
    ],
    benefits: [
      'Competitive compensation ($48,000 - $60,000)',
      'Paid holidays, vacation, and professional development',
      'Health & retirement benefits'
    ],
    isActive: true,
    status: 'open',
    salaryRange: '$48,000 - $60,000 / year',
    postedDate: '2026-08-28'
  },
  {
    id: 'job_04_closed',
    title: 'Seasonal Tax Preparer (Archived)',
    department: 'Tax',
    location: 'Columbia, South Carolina (Onsite)',
    type: 'Contract',
    workplace: 'Onsite',
    description: 'Seasonal tax filing associate for prior filing window.',
    responsibilities: ['Assist with individual Form 1040 document processing.'],
    requirements: ['1+ year experience in tax preparation.'],
    benefits: ['Flexible seasonal compensation.'],
    isActive: false,
    status: 'closed',
    salaryRange: '$30 - $40 / hour',
    postedDate: '2026-01-10',
    closingDate: '2026-04-16'
  }
];

export const INITIAL_APPLICANTS: Applicant[] = [
  {
    id: 'app_101',
    jobId: 'job_01',
    jobTitle: 'Senior Corporate Tax Strategist',
    fullName: 'Jasmine Caldwell, EA',
    email: 'j.caldwell.tax@example.com',
    phone: '803-555-0819',
    linkedinUrl: 'https://linkedin.com/in/jasmine-caldwell-tax',
    resumeFileName: 'Jasmine_Caldwell_Resume_2026.pdf',
    coverLetter: 'I have followed Desmond Hinds and A/R Tax Services for several years. My 7 years of S-Corp and Partnership tax prep aligns perfectly with your firm’s legacy-building mission.',
    status: 'interview',
    appliedDate: '2026-08-25',
    notes: 'Strong candidate. Phone screening went exceptionally well. Interview with Desmond Hinds scheduled for Sept 14.',
    rating: 5
  },
  {
    id: 'app_102',
    jobId: 'job_02',
    jobTitle: 'Staff Accountant & Bookkeeping Specialist',
    fullName: 'David R. Chen',
    email: 'd.chen.accounting@example.com',
    phone: '843-555-0133',
    resumeFileName: 'David_Chen_StaffAccountant_CV.pdf',
    status: 'screening',
    appliedDate: '2026-09-01',
    notes: 'QBO ProAdvisor certified with 3 years experience at regional firm.',
    rating: 4
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud_001',
    userId: 'user_accountant_desmond',
    userName: 'Desmond Hinds',
    userRole: 'accountant',
    action: 'DOCUMENT_OCR_VERIFIED',
    resource: 'Document #doc_101 (2025_W2_Palmetto_Financial.pdf)',
    details: 'Verified Box 1 ($124,500) and Box 2 ($22,410) against IRS Transcript. OCR confidence 98%.',
    ipAddress: '68.188.140.22',
    timestamp: '2026-09-08T08:32:15Z',
    severity: 'info'
  },
  {
    id: 'aud_002',
    userId: 'user_client_1',
    userName: 'Michael Perotti',
    userRole: 'client',
    action: 'DOCUMENT_UPLOADED',
    resource: 'Document #doc_102 (2025_1099_DIV_Vanguard_Brokerage.pdf)',
    details: 'Uploaded 840 KB PDF via encrypted client portal. AES-256 encrypted at rest.',
    ipAddress: '174.99.21.104',
    timestamp: '2026-09-08T07:45:10Z',
    severity: 'info'
  },
  {
    id: 'aud_003',
    userId: 'user_admin',
    userName: 'Executive Operations Admin',
    userRole: 'admin',
    action: 'SERVICE_PLAN_UPDATED',
    resource: 'Service Plan #plan_business_advisory',
    details: 'Updated included features list and multi-state filing support guidelines.',
    ipAddress: '68.188.140.22',
    timestamp: '2026-09-07T16:12:00Z',
    severity: 'info'
  },
  {
    id: 'aud_004',
    userId: 'user_super_admin',
    userName: 'Principal Security Officer',
    userRole: 'super_admin',
    action: 'MFA_POLICY_AUDIT',
    resource: 'System Security Configuration',
    details: 'Ran cryptographic compliance scan. All 7 active accounts have MFA enrolled. Zero unencrypted documents detected.',
    ipAddress: '68.188.140.22',
    timestamp: '2026-09-07T09:00:00Z',
    severity: 'info'
  }
];

export const TESTIMONIALS_DATA = [
  {
    id: 't_01',
    name: 'Michael Perotti',
    company: 'Financial Services',
    quote: 'Mr. Hinds is a superb person to connect with regarding finances. He is professional, knowledgeable and provides excellent customer service.',
    rating: 5,
    location: 'Columbia, SC'
  },
  {
    id: 't_02',
    name: 'Comfort Dondo',
    company: 'Excellence in Enterprise',
    quote: 'Working with Brother Desmond Hinds has been absolutely life-changing for both my organization and my personal finances. His guidance helped transform my credit, clarify my financial goals, and position me to move into the next phase of growth with confidence and stability.',
    rating: 5,
    location: 'Columbia, SC'
  },
  {
    id: 't_03',
    name: 'Rob Williams, Sr.',
    company: 'Excellent Tax Service',
    quote: 'The service was very professional. I highly recommend Desmond.',
    rating: 5,
    location: 'South Carolina'
  },
  {
    id: 't_04',
    name: 'Darren Stovall',
    company: 'True Professional',
    quote: 'I have used Mr. Hinds for some years now and I’ve never been disappointed. Truly the best I’ve ever used. I highly recommend his service!!!',
    rating: 5,
    location: 'South Carolina'
  },
  {
    id: 't_05',
    name: 'William Beam',
    company: 'Satisfied Client',
    quote: 'My experience with Desmond has been amazing to say the least. He’s a hard worker for all of his clients. He’s well informed and knowledgeable... Outstanding brother to have on your side, he is an asset!',
    rating: 5,
    location: 'South Carolina'
  },
  {
    id: 't_06',
    name: 'Sean',
    company: 'Official Business',
    quote: 'I’ve been working with My Brother Desmond for 6 years now and I’ve never been disappointed. He has definitely helped with my financials and I have referred him countless clients.',
    rating: 5,
    location: 'South Carolina'
  },
  {
    id: 't_07',
    name: 'Johnnie Newsome',
    company: 'Individual Tax Client',
    quote: 'Thank you so much helping me with my taxes... Truly grateful for the patience and expertise.',
    rating: 5,
    location: 'South Carolina'
  }
];

export const FAQ_DATA = [
  {
    category: 'Tax Preparation & Strategy',
    question: 'What documents do I need to prepare my annual tax return?',
    answer: 'For individual filings, you will generally need your W-2 wage statements, 1099 statements (NEC, MISC, INT, DIV, B), Form 1098 for mortgage interest, Form 1095-A if you purchased healthcare via the Health Insurance Marketplace, receipts for deductible business or charitable expenses, and your prior-year tax return. Our secure portal provides an automated document checklist based on your specific intake questionnaire.'
  },
  {
    category: 'Tax Preparation & Strategy',
    question: 'What is the turnaround time for a completed tax return?',
    answer: 'Once all requested documents are uploaded to your encrypted portal, initial draft preparation typically takes 3 to 7 business days. All returns undergo a secondary quality and compliance review before being delivered for your electronic signature.'
  },
  {
    category: 'Business Services',
    question: 'Can you help my business transition to an S-Corporation?',
    answer: 'Yes. We analyze your net business profits, calculate optimal owner-employee reasonable compensation, coordinate Form 2553 election filings with the IRS, and structure payroll withholdings to ensure ongoing federal and state compliance.'
  },
  {
    category: 'Security & Privacy',
    question: 'How is my sensitive financial data protected?',
    answer: 'All data transmitted through A/R Tax Services, LLC is encrypted using TLS 1.3 in transit and stored with AES-256 encryption at rest. Each client document is stored in isolated object partitions with strict role-based access control. We enforce multi-factor authentication (MFA) across all staff accounts.'
  },
  {
    category: 'Consultations & Engagement',
    question: 'Can I schedule a one-on-one consultation with Desmond Hinds directly?',
    answer: 'Yes. When booking a consultation through our online scheduler, you may specifically request Founder Desmond Hinds for virtual, telephone, or in-office sessions at our Columbia, South Carolina executive office.'
  },
  {
    category: 'Legal & Estate Coordination',
    question: 'Does A/R Tax Services provide legal counsel for wills and trusts?',
    answer: 'A/R Tax Services, LLC provides tax planning and administrative document coordination for estates and trusts. We work in direct partnership with properly licensed South Carolina attorneys for all formal legal drafting and representation. Our accounting personnel do not provide legal advice.'
  }
];
