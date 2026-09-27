/**
 * A/R Tax Services, LLC - Extended Lifecycle Demonstration Mock Data
 * Comprehensive synthetic records covering all 29 roles and the 18-stage operating cycle.
 */

import {
  DemoHandoff,
  GovernmentAgencyAuthority,
  GovernmentFeedbackRecord,
  ReceptionInquiry,
  AppointmentRecord,
  CallLogRecord,
  ScopeChangeOrder,
  WorkloadTimelineItem,
  IdentityVerificationRecord,
  IntakeDocumentRecord,
  DataEntryBatch,
  CashTransactionEntry,
  VendorBillRecord,
  PaymentBatchRecord,
  ClientArRecord,
  PaymentPlanRecord,
  QualityInspectionRecord,
  FilingSubmissionBatch,
  AcknowledgementRecord,
  GovernmentNoticeRecord,
  TaxResolutionCase,
  AuditCaseRecord,
  AmendmentCaseRecord,
  ArchiveRecord,
  ClientRenewalRecord,
  SupportTicketRecord
} from './types';

// 1. Cross-Role Handoff Records (Section 7)
export const INITIAL_DEMO_HANDOFFS: DemoHandoff[] = [
  {
    id: 'hnd_001',
    client: 'Perotti Capital Holdings LLC',
    entity: 'S-Corporation',
    engagement: 'TY2025 Form 1120-S & SC1120S',
    taxYear: 2025,
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    fromRole: 'accountant',
    toRole: 'reviewer',
    currentStage: 'Review',
    reason: 'Preparer workpapers completed. Form 1120-S, Schedule M-1, and K-1s submitted for CPA certification.',
    requiredAction: 'Perform secondary technical review, verify book-to-tax adjustments, check maker-checker gate.',
    requiredDocuments: ['Trial Balance Final v3', 'Schedule M-1 Workpaper', 'Sec 179 Asset Schedule', 'Draft 1120-S PDF'],
    priority: 'High',
    internalDeadline: '2026-03-01',
    statutoryDeadline: '2026-03-15',
    handoffNotes: 'All 4 quarters of payroll withholding reconciled against 941s. Officer health insurance included in W-2.',
    acceptanceStatus: 'Accepted',
    acceptedBy: 'Elena Rostova, CPA',
    acceptedTimestamp: '2026-02-18T14:30:00Z'
  },
  {
    id: 'hnd_002',
    client: 'Perotti Capital Holdings LLC',
    entity: 'S-Corporation',
    engagement: 'TY2025 Form 1120-S & SC1120S',
    taxYear: 2025,
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    fromRole: 'reviewer',
    toRole: 'quality-control',
    currentStage: 'Approve',
    reason: 'Reviewer certified tax return. Transferred to Quality Assurance for procedural verification.',
    requiredAction: 'Verify source-to-return traceability, checklist completion, and 7-point filing release package readiness.',
    requiredDocuments: ['Reviewer Signoff Certificate #QC-2026-091', 'Draft Form 8879-S'],
    priority: 'High',
    internalDeadline: '2026-03-03',
    statutoryDeadline: '2026-03-15',
    handoffNotes: 'Maker-checker separation confirmed: Preparer Marcus Vance / Reviewer Elena Rostova.',
    acceptanceStatus: 'Accepted',
    acceptedBy: 'Isabel Thorpe',
    acceptedTimestamp: '2026-02-19T09:15:00Z'
  },
  {
    id: 'hnd_003',
    client: 'Summit Ridge Logistics Corp',
    entity: 'C-Corporation',
    engagement: 'TY2025 Form 1120 Corporate Return',
    taxYear: 2025,
    jurisdiction: 'Federal (IRS) & North Carolina DOR',
    fromRole: 'data-entry',
    toRole: 'bookkeeper',
    currentStage: 'Record',
    reason: 'Entered transaction batch #SB-2026-04 with 42 credit card receipts and equipment invoices.',
    requiredAction: 'Verify vendor classifications and match entries against monthly Wells Fargo statement.',
    requiredDocuments: ['Batch SB-2026-04 CSV', 'Fleet Fuel Receipts Shoebox PDF'],
    priority: 'Medium',
    internalDeadline: '2026-02-28',
    statutoryDeadline: '2026-04-15',
    handoffNotes: 'Unidentified check #4092 ($8,750) flagged for client explanation.',
    acceptanceStatus: 'Accepted',
    acceptedBy: 'Samuel Rivera',
    acceptedTimestamp: '2026-02-15T11:00:00Z'
  },
  {
    id: 'hnd_004',
    client: 'Dr. Alistair Finch',
    entity: 'Individual / Schedule C',
    engagement: 'TY2025 Form 1040 & Schedule C',
    taxYear: 2025,
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    fromRole: 'reception',
    toRole: 'intake',
    currentStage: 'Onboard',
    reason: 'New client consultation requested following referral by Dr. Vance.',
    requiredAction: 'Send engagement letter, initiate AICPA conflict clearance, and issue 2025 Tax Organizer packet.',
    requiredDocuments: ['Prospective Intake Slip', 'Prior Year 2024 Form 1040 copy'],
    priority: 'Medium',
    internalDeadline: '2026-02-25',
    statutoryDeadline: '2026-04-15',
    handoffNotes: 'Client preferred phone consultation on Tuesday afternoon.',
    acceptanceStatus: 'Pending'
  },
  {
    id: 'hnd_005',
    client: 'Magnolia Artisan Bakery LLC',
    entity: 'Partnership / Form 1065',
    engagement: 'TY2025 Form 1065',
    taxYear: 2025,
    jurisdiction: 'Federal (IRS) & SC DOR',
    fromRole: 'documents',
    toRole: 'verification',
    currentStage: 'Validate',
    reason: 'New partner admitted in Q3. Operating agreement amendment received.',
    requiredAction: 'Verify partner identity documents, capital contribution percentages, and EIN registration.',
    requiredDocuments: ['Articles of Amendment', 'Drivers Licenses for Both Partners'],
    priority: 'High',
    internalDeadline: '2026-02-27',
    statutoryDeadline: '2026-03-15',
    handoffNotes: 'Capital ratio changed from 50/50 to 60/40 effective September 1.',
    acceptanceStatus: 'Pending'
  },
  {
    id: 'hnd_006',
    client: 'Coastal Haven Hospitality Group',
    entity: 'S-Corporation',
    engagement: 'IRS CP2000 Notice Defense TY2023',
    taxYear: 2023,
    jurisdiction: 'Federal IRS (Ogden Service Center)',
    fromRole: 'correspondence',
    toRole: 'resolution',
    currentStage: 'Resolve',
    reason: 'IRS Notice CP2000 proposing $14,280 tax adjustment due to 1099-K merchant card reporting mismatch.',
    requiredAction: 'File Form 2848 Power of Attorney, obtain wage & income transcripts, draft rebuttal letter with POS records.',
    requiredDocuments: ['Notice CP2000 copy', '2023 Merchant Processing 1099-K', 'Draft Form 2848'],
    priority: 'Urgent',
    internalDeadline: '2026-03-05',
    statutoryDeadline: '2026-03-18',
    handoffNotes: 'Response deadline is March 18, 2026. Gross sales were properly included on Line 1a; 1099-K included sales tax.',
    acceptanceStatus: 'Accepted',
    acceptedBy: 'Miranda Cruz, EA',
    acceptedTimestamp: '2026-02-17T16:00:00Z'
  }
];

// 2. Government Agency & Authority Registry (Section 8)
export const INITIAL_DEMO_AGENCIES: GovernmentAgencyAuthority[] = [
  {
    id: 'auth_irs_mef',
    agencyName: 'Internal Revenue Service (IRS)',
    jurisdiction: 'Federal (United States)',
    agencyType: 'Federal',
    returnOrNoticeTypes: ['Form 1040', 'Form 1120-S', 'Form 1120', 'Form 1065', 'Form 941/940', 'CP Notices', 'LTR Notices'],
    filingMethod: 'Modernized e-File (MeF) via Authorized ERO Gateway',
    paymentMethod: 'Electronic Federal Tax Payment System (EFTPS) / Direct Pay ACH',
    acknowledgementMethod: 'MeF XML Acknowledgement with 20-digit Submission ID',
    contactInformation: 'e-Help Desk: 1-866-255-0654 | Practitioner Priority: 1-866-860-4259',
    integrationStatus: 'Not Configured',
    requiredAuthorization: 'IRS Form 8879 / Form 2848 (Power of Attorney)',
    responsibleStaffRole: 'filing',
    lastConfigurationReviewDate: '2026-01-10'
  },
  {
    id: 'auth_ssa_bsowe',
    agencyName: 'Social Security Administration (SSA)',
    jurisdiction: 'Federal (United States)',
    agencyType: 'Federal',
    returnOrNoticeTypes: ['Form W-2 / W-3 Wage Reporting'],
    filingMethod: 'Business Services Online (BSO) Wage File Upload',
    paymentMethod: 'N/A (Information Return)',
    acknowledgementMethod: 'BSO Wage File Receipt Confirmation Batch ID',
    contactInformation: 'Employer Reporting Service: 1-800-772-6270',
    integrationStatus: 'Not Configured',
    requiredAuthorization: 'SSA BSO User ID & Employer Attestation',
    responsibleStaffRole: 'payroll',
    lastConfigurationReviewDate: '2026-01-12'
  },
  {
    id: 'auth_sc_dor',
    agencyName: 'South Carolina Department of Revenue (SCDOR)',
    jurisdiction: 'State of South Carolina',
    agencyType: 'State Department of Revenue',
    returnOrNoticeTypes: ['SC1040', 'SC1120S', 'SC1120', 'SC1065', 'WH-1605/1606 Withholding', 'Sales Tax ST-3'],
    filingMethod: 'Fed/State MeF Relay & MyDORWAY Portal',
    paymentMethod: 'MyDORWAY ACH Debit / Electronic Check',
    acknowledgementMethod: 'StateAck XML Acknowledgement File',
    contactInformation: 'Tax Practitioner Hotline: 1-803-898-5000 | Columbia, SC Office',
    integrationStatus: 'Not Configured',
    requiredAuthorization: 'SC Form SC-2848 (State Power of Attorney)',
    responsibleStaffRole: 'filing',
    lastConfigurationReviewDate: '2026-01-15'
  },
  {
    id: 'auth_sc_dew',
    agencyName: 'South Carolina Department of Employment and Workforce (SC DEW)',
    jurisdiction: 'State of South Carolina',
    agencyType: 'State Workforce / Unemployment',
    returnOrNoticeTypes: ['Quarterly Contribution Report Form UCE-101 / UCE-120'],
    filingMethod: 'SUITS (State Unemployment Insurance Tax System) Portal',
    paymentMethod: 'SUITS ACH Debit',
    acknowledgementMethod: 'SUITS Submission Confirmation Number',
    contactInformation: 'Employer Tax Division: 1-803-737-3075 | Columbia, SC',
    integrationStatus: 'Not Configured',
    requiredAuthorization: 'Third-Party Agent (TPA) Authorization in SUITS',
    responsibleStaffRole: 'payroll',
    lastConfigurationReviewDate: '2026-01-15'
  },
  {
    id: 'auth_nc_dor',
    agencyName: 'North Carolina Department of Revenue (NCDOR)',
    jurisdiction: 'State of North Carolina',
    agencyType: 'State Department of Revenue',
    returnOrNoticeTypes: ['D-400 Individual', 'CD-401S S-Corp', 'CD-405 C-Corp', 'NC-5 Withholding'],
    filingMethod: 'Fed/State MeF Electronic Transmission',
    paymentMethod: 'eServices ACH Debit Payment',
    acknowledgementMethod: 'StateAck XML File (NC Return Sequence)',
    contactInformation: 'Practitioner Assistance: 1-877-252-3052 | Raleigh, NC',
    integrationStatus: 'Not Configured',
    requiredAuthorization: 'NC Form GEN-58 (Power of Attorney)',
    responsibleStaffRole: 'acknowledgements',
    lastConfigurationReviewDate: '2026-01-18'
  },
  {
    id: 'auth_ga_dor',
    agencyName: 'Georgia Department of Revenue',
    jurisdiction: 'State of Georgia',
    agencyType: 'State Department of Revenue',
    returnOrNoticeTypes: ['Form 500 Individual', 'Form 600S S-Corp', 'Form 600 C-Corp', 'G-7 Withholding'],
    filingMethod: 'Georgia Tax Center (GTC) / Fed-State MeF',
    paymentMethod: 'GTC Electronic Funds Transfer',
    acknowledgementMethod: 'GTC XML Acknowledgement',
    contactInformation: 'Taxpayer Services: 1-877-423-6711 | Atlanta, GA',
    integrationStatus: 'Not Configured',
    requiredAuthorization: 'GA Form RD-1061 Power of Attorney',
    responsibleStaffRole: 'filing',
    lastConfigurationReviewDate: '2026-01-20'
  },
  {
    id: 'auth_sc_sos',
    agencyName: 'South Carolina Secretary of State',
    jurisdiction: 'State of South Carolina',
    agencyType: 'Secretary of State',
    returnOrNoticeTypes: ['Annual Business Report', 'Articles of Organization', 'Registered Agent Filings'],
    filingMethod: 'Business Entities Online Portal',
    paymentMethod: 'Credit Card / State Subscriber Account',
    acknowledgementMethod: 'Certificate of Existence & Stamped Articles PDF',
    contactInformation: 'Business Filings Division: 1-803-734-2158 | Columbia, SC',
    integrationStatus: 'Not Configured',
    requiredAuthorization: 'Authorized Corporate Representative',
    responsibleStaffRole: 'verification',
    lastConfigurationReviewDate: '2026-01-22'
  },
  {
    id: 'auth_columbia_license',
    agencyName: 'City of Columbia Business License Division',
    jurisdiction: 'City of Columbia, South Carolina',
    agencyType: 'Local / Municipal',
    returnOrNoticeTypes: ['Standardized Business License Renewal Form (NAICS Class)'],
    filingMethod: 'SC Municipal Business License Portal (Local Hospitality / Accommodations)',
    paymentMethod: 'Municipal ACH / Certified Check',
    acknowledgementMethod: 'Business License Certificate Decal & Receipt ID',
    contactInformation: 'License Division: 1-803-545-3345 | 1136 Washington St, Columbia, SC',
    integrationStatus: 'Not Configured',
    requiredAuthorization: 'Local Business License Power of Attorney',
    responsibleStaffRole: 'operations',
    lastConfigurationReviewDate: '2026-01-25'
  }
];

// 3. Government Feedback Lifecycle Records (Section 9)
export const INITIAL_DEMO_FEEDBACK: GovernmentFeedbackRecord[] = [
  {
    id: 'fbk_001',
    authority: 'Internal Revenue Service',
    jurisdiction: 'Federal',
    form: 'Form 1120-S',
    taxYear: 2024,
    submissionId: '10402025055000000001',
    responseCode: 'A000-ACCEPTED',
    responseDescription: 'Electronic return successfully accepted by IRS MeF gateway. All business rules and XML schema validated.',
    receivedDate: '2025-03-12',
    deadline: '2025-03-15',
    responsibleRole: 'acknowledgements',
    requiredAction: 'File accepted acknowledgement in permanent client dossier. Notify taxpayer of electronic acceptance.',
    relatedReturnVersion: 'Form 1120-S Final v2',
    relatedDocuments: ['IRS Ack XML #10402025055000000001.xml', 'Form 8879-S Executed.pdf'],
    resolutionHistory: [
      '2025-03-12 10:14:22 UTC: Return transmitted via simulated MeF batch.',
      '2025-03-12 11:32:05 UTC: Federal acceptance acknowledgement received (Code 100).',
      '2025-03-12 11:45:00 UTC: Taxpayer notification email triggered (Simulated).'
    ],
    clientNotificationStatus: 'Notified',
    status: 'Accepted—Simulated'
  },
  {
    id: 'fbk_002',
    authority: 'South Carolina Department of Revenue',
    jurisdiction: 'South Carolina',
    form: 'Form SC1120S',
    taxYear: 2024,
    submissionId: 'SC2025055000000002',
    responseCode: 'R000-STATE-REJECT',
    responseDescription: 'Reject Code F1120S-002: Withholding tax reported on Schedule K-1 does not match SC WH-1606 quarterly filings on record with MyDORWAY.',
    receivedDate: '2025-03-13',
    deadline: '2025-03-20',
    responsibleRole: 'filing',
    requiredAction: 'Reconcile fourth-quarter SC withholding deposit against bank records. Issue correction case to Preparer.',
    relatedReturnVersion: 'Form SC1120S v1',
    relatedDocuments: ['SC DOR StateAck XML.xml', 'Quarterly WH-1606 Workpaper.xlsx'],
    resolutionHistory: [
      '2025-03-13 14:20:00 UTC: State rejection parsed by Acknowledgement Specialist.',
      '2025-03-13 15:00:00 UTC: Handoff opened to Tax Preparer Marcus Vance for withholding reconciliation.'
    ],
    clientNotificationStatus: 'Pending',
    status: 'Correction Required'
  },
  {
    id: 'fbk_003',
    authority: 'Internal Revenue Service',
    jurisdiction: 'Federal',
    form: 'Form 1040',
    taxYear: 2025,
    submissionId: '10402026045000000088',
    responseCode: 'PND-AWAITING-ACK',
    responseDescription: 'Submission batch received by IRS front-end processing. Awaiting formal schema validation response.',
    receivedDate: '2026-02-18',
    deadline: '2026-02-20',
    responsibleRole: 'acknowledgements',
    requiredAction: 'Monitor MeF queue for 24-hour transmission response status.',
    relatedReturnVersion: 'Form 1040 Final v1',
    relatedDocuments: ['MeF Batch 2026-088 Manifest'],
    resolutionHistory: [
      '2026-02-18 09:00:00 UTC: Batch queued for transmission.'
    ],
    clientNotificationStatus: 'Queued',
    status: 'Awaiting Acknowledgement—Simulated'
  }
];

// 4A. Reception Records
export const INITIAL_DEMO_INQUIRIES: ReceptionInquiry[] = [
  {
    id: 'inq_001',
    contactName: 'David Sterling',
    companyName: 'Palmetto Tech Consulting LLC',
    phone: '(803) 555-0142',
    email: 'd.sterling@palmettotech.com',
    source: 'Website',
    inquiryType: 'Tax Return',
    urgentNoticeFlag: false,
    communicationPreference: 'Email',
    notes: 'Looking for CPA firm to handle TY2025 multi-member LLC partnership return and quarterly bookkeeping.',
    status: 'Scheduled',
    createdAt: '2026-02-14T10:30:00Z'
  },
  {
    id: 'inq_002',
    contactName: 'Rachel Green',
    companyName: 'Green Floral Designs',
    phone: '(803) 555-0198',
    email: 'rachel@greenfloral.com',
    source: 'Telephone',
    inquiryType: 'IRS Notice Escalation',
    urgentNoticeFlag: true,
    communicationPreference: 'Phone',
    notes: 'Received IRS Notice CP504 Intent to Levy regarding unfiled 941 payroll taxes from Q2 2024. 30-day clock running.',
    status: 'Routed to Intake',
    createdAt: '2026-02-16T14:15:00Z'
  },
  {
    id: 'inq_003',
    contactName: 'Carlos Montoya',
    companyName: 'Montoya Construction Group',
    phone: '(843) 555-0321',
    email: 'carlos@montoyabuilds.com',
    source: 'Referral',
    inquiryType: 'Bookkeeping',
    urgentNoticeFlag: false,
    communicationPreference: 'Phone',
    notes: 'Referred by Summit Ridge Logistics. Needs full CAS clean-up of 2025 bank feeds and monthly reconciliation.',
    status: 'New',
    createdAt: '2026-02-17T09:00:00Z'
  },
  {
    id: 'inq_004',
    contactName: 'Emily Thornwood',
    phone: '(803) 555-0811',
    email: 'emily.thornwood@example.com',
    source: 'Walk-In',
    inquiryType: 'General Advisory',
    urgentNoticeFlag: false,
    communicationPreference: 'Email',
    notes: 'Walk-in inquiring about S-Corporation reasonable compensation requirements for solo dental practice.',
    status: 'Callback Needed',
    createdAt: '2026-02-17T15:45:00Z'
  }
];

export const INITIAL_DEMO_APPOINTMENTS: AppointmentRecord[] = [
  {
    id: 'apt_001',
    inquiryId: 'inq_001',
    clientName: 'David Sterling (Palmetto Tech)',
    staffName: 'Desmond Hinds, Founder',
    staffRole: 'advisor',
    dateTime: '2026-02-23 14:00 EST',
    durationMinutes: 45,
    consultationType: 'Virtual Zoom (Simulated)',
    reminderSent: true,
    status: 'Confirmed'
  },
  {
    id: 'apt_002',
    inquiryId: 'inq_002',
    clientName: 'Rachel Green (Green Floral)',
    staffName: 'Miranda Cruz, EA',
    staffRole: 'resolution',
    dateTime: '2026-02-19 10:30 EST',
    durationMinutes: 60,
    consultationType: 'Phone Call',
    reminderSent: true,
    status: 'Confirmed'
  }
];

export const INITIAL_DEMO_CALLS: CallLogRecord[] = [
  {
    id: 'cal_001',
    callerName: 'Michael Perotti',
    phone: '(803) 555-0100',
    timestamp: '2026-02-18 11:20 EST',
    reason: 'Checking when Form 8879 will be ready to sign on portal.',
    routedTo: 'accountant',
    actionTaken: 'Advised client return passed reviewer certification and is in final QA gate. Will be available this afternoon.'
  },
  {
    id: 'cal_002',
    callerName: 'SC Department of Revenue Agent Vance',
    phone: '(803) 898-5000',
    timestamp: '2026-02-17 14:10 EST',
    reason: 'Inquiring on power of attorney Form SC-2848 for Summit Ridge Logistics Corp.',
    routedTo: 'correspondence',
    actionTaken: 'Transferred to Notice Specialist Liam O’Connor.'
  }
];

// 4B. Engagement Manager Records
export const INITIAL_DEMO_CHANGE_ORDERS: ScopeChangeOrder[] = [
  {
    id: 'sco_001',
    engagementId: 'eng_2025_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    title: 'Out-of-Scope R&D Tax Credit Study (IRC § 41)',
    scopeDescription: 'Client requested qualification and Form 6765 calculation for proprietary fintech software development expenditures ($142,000 qualified research expenses).',
    priceDelta: 2850.00,
    originalBudget: 4500.00,
    revisedBudget: 7350.00,
    status: 'Client Accepted',
    createdAt: '2026-02-05'
  },
  {
    id: 'sco_002',
    engagementId: 'eng_2025_summit',
    clientName: 'Summit Ridge Logistics Corp',
    title: 'Interstate Multi-State Nexus Filing (NC, GA, FL)',
    scopeDescription: 'Expanded fleet delivery routes triggered physical and economic nexus in North Carolina, Georgia, and Florida, requiring 3 additional state corporate returns.',
    priceDelta: 3200.00,
    originalBudget: 5200.00,
    revisedBudget: 8400.00,
    status: 'Sent for Approval',
    createdAt: '2026-02-12'
  }
];

export const INITIAL_DEMO_WORKLOAD_TIMELINE: WorkloadTimelineItem[] = [
  { stage: 'Onboard', responsibleRole: 'intake', targetDays: 3, status: 'Completed', handoffGate: 'Signed Proposal & Deposit' },
  { stage: 'Collect', responsibleRole: 'documents', targetDays: 7, status: 'Completed', handoffGate: '100% Core Docs Received' },
  { stage: 'Validate', responsibleRole: 'verification', targetDays: 2, status: 'Completed', handoffGate: 'KYC & Entity Match Clean' },
  { stage: 'Record', responsibleRole: 'data-entry', targetDays: 5, status: 'Completed', handoffGate: 'All Batches Keyed & Tied' },
  { stage: 'Reconcile', responsibleRole: 'bookkeeper', targetDays: 4, status: 'Completed', handoffGate: 'Bank Rec Variance = $0.00' },
  { stage: 'Review', responsibleRole: 'reviewer', targetDays: 3, status: 'In Progress', handoffGate: 'CPA Certification Signoff' },
  { stage: 'Report', responsibleRole: 'operations', targetDays: 2, status: 'Upcoming', handoffGate: 'Management Financials Issued' },
  { stage: 'Plan', responsibleRole: 'advisor', targetDays: 3, status: 'Upcoming', handoffGate: 'Tax Strategy Memo Delivered' },
  { stage: 'Prepare Taxes', responsibleRole: 'accountant', targetDays: 5, status: 'Completed', handoffGate: 'Form 1120-S Workpapers Done' },
  { stage: 'Approve', responsibleRole: 'quality-control', targetDays: 2, status: 'In Progress', handoffGate: 'QC 7-Point Package Cleared' },
  { stage: 'Sign', responsibleRole: 'client', targetDays: 3, status: 'Upcoming', handoffGate: 'Form 8879 Executed' },
  { stage: 'File', responsibleRole: 'filing', targetDays: 1, status: 'Upcoming', handoffGate: 'MeF Transmission Timestamped' },
  { stage: 'Government Feedback', responsibleRole: 'acknowledgements', targetDays: 2, status: 'Upcoming', handoffGate: 'Agency XML Acks Received' },
  { stage: 'Resolve', responsibleRole: 'resolution', targetDays: 0, status: 'Upcoming', handoffGate: 'Zero Unresolved Agency Notices' },
  { stage: 'Monitor', responsibleRole: 'compliance', targetDays: 30, status: 'Upcoming', handoffGate: 'Refund / Payment Cleared' },
  { stage: 'Archive', responsibleRole: 'records', targetDays: 2, status: 'Upcoming', handoffGate: '7-Year Digital Vault Lock' },
  { stage: 'Renew', responsibleRole: 'client-success', targetDays: 14, status: 'Upcoming', handoffGate: 'Next Year Retainer Contract' },
  { stage: 'Repeat', responsibleRole: 'intake', targetDays: 1, status: 'Upcoming', handoffGate: 'Cycle Reset for TY2026' }
];

// 4C. Identity & Verification Records
export const INITIAL_DEMO_VERIFICATIONS: IdentityVerificationRecord[] = [
  {
    id: 'ver_001',
    clientId: 'cli_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    entityType: 'S-Corporation',
    idDocumentType: "Driver's License",
    idStatus: 'Verified (Simulated)',
    addressMatchStatus: 'Match',
    einVerificationStatus: 'IRS Letter 147C Verified',
    articlesOfOrgStatus: 'State SOS Active',
    dependentCheckStatus: 'N/A',
    maskedSsn: '***-**-4819',
    notes: 'Driver license renewal valid through 2028. Registered corporate address matches SC Secretary of State database.',
    verifiedBy: 'Claudia Vance',
    verifiedAt: '2026-01-15T11:00:00Z',
    escalationFlag: false
  },
  {
    id: 'ver_002',
    clientId: 'cli_summit',
    clientName: 'Summit Ridge Logistics Corp',
    entityType: 'S-Corporation',
    idDocumentType: 'Passport',
    idStatus: 'Verified (Simulated)',
    addressMatchStatus: 'Match',
    einVerificationStatus: 'IRS Letter 147C Verified',
    articlesOfOrgStatus: 'State SOS Active',
    dependentCheckStatus: 'N/A',
    maskedSsn: '***-**-8120',
    notes: 'US Passport verified for CEO Robert Martinez. Ownership structure: 100% sole shareholder.',
    verifiedBy: 'Claudia Vance',
    verifiedAt: '2026-01-18T15:30:00Z',
    escalationFlag: false
  },
  {
    id: 'ver_003',
    clientId: 'cli_montoya',
    clientName: 'Montoya Construction Group',
    entityType: 'LLC / Partnership',
    idDocumentType: "Driver's License",
    idStatus: 'Pending Review',
    addressMatchStatus: 'Address Discrepancy',
    einVerificationStatus: 'Pending SSA Verification',
    articlesOfOrgStatus: 'Missing Operating Agreement',
    dependentCheckStatus: 'N/A',
    maskedSsn: '***-**-2931',
    notes: 'Address on driver license (Charleston, SC) differs from business headquarters address in Columbia, SC. Operating agreement missing member capital percentages.',
    escalationFlag: true
  }
];

// 4D. Document Intake Queue Records
export const INITIAL_DEMO_INTAKE_DOCS: IntakeDocumentRecord[] = [
  {
    id: 'intk_001',
    fileName: 'Perotti_2025_Consolidated_1099B_Schwab.pdf',
    fileSize: '4.8 MB',
    clientId: 'cli_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    taxYear: 2025,
    classification: 'Tax Form (W-2/1099/K-1)',
    packageCondition: 'Clean Single Document',
    duplicateDetected: false,
    assignedRole: 'accountant',
    retentionCategory: '7-Year Tax Workpaper',
    chainOfCustody: [
      { timestamp: '2026-02-10 08:30:00', actor: 'Client Upload (Michael Perotti)', action: 'Uploaded through secure client portal' },
      { timestamp: '2026-02-10 09:15:00', actor: 'Derek Shaw', action: 'Classified as Consolidated Brokerage 1099-B/DIV/INT' }
    ],
    status: 'Routed',
    receivedAt: '2026-02-10'
  },
  {
    id: 'intk_002',
    fileName: 'SummitRidge_Q4_Combined_Scans.pdf',
    fileSize: '18.2 MB',
    clientId: 'cli_summit',
    clientName: 'Summit Ridge Logistics Corp',
    taxYear: 2025,
    classification: 'Receipt/Invoice',
    packageCondition: 'Multi-Page Bundle (Requires Split)',
    duplicateDetected: false,
    assignedRole: 'data-entry',
    retentionCategory: '7-Year Tax Workpaper',
    chainOfCustody: [
      { timestamp: '2026-02-12 14:00:00', actor: 'Client Upload', action: 'Uploaded via portal' },
      { timestamp: '2026-02-12 15:00:00', actor: 'Derek Shaw', action: 'Flagged: 45-page batch containing mixed fuel tickets, bills, and payroll slips. Split required.' }
    ],
    status: 'Awaiting staff review',
    receivedAt: '2026-02-12'
  },
  {
    id: 'intk_003',
    fileName: 'IRS_CP2000_Notice_Scan_Blurry.pdf',
    fileSize: '1.2 MB',
    clientId: 'cli_haven',
    clientName: 'Coastal Haven Hospitality Group',
    taxYear: 2023,
    classification: 'Agency Notice',
    packageCondition: 'Unreadable Scan',
    duplicateDetected: false,
    assignedRole: 'correspondence',
    retentionCategory: 'Notice Response File',
    chainOfCustody: [
      { timestamp: '2026-02-14 11:00:00', actor: 'Client Upload', action: 'Uploaded via mobile camera' },
      { timestamp: '2026-02-14 11:30:00', actor: 'Derek Shaw', action: 'Notice page 2 illegible due to poor contrast. Requested replacement scan.' }
    ],
    status: 'Demo file received',
    receivedAt: '2026-02-14'
  }
];

// 4E. Accounting Data Entry Batches
export const INITIAL_DEMO_DATA_BATCHES: DataEntryBatch[] = [
  {
    id: 'bat_001',
    batchName: 'January 2026 Petty Cash & Fuel Receipts',
    clientId: 'cli_summit',
    clientName: 'Summit Ridge Logistics Corp',
    totalEntries: 18,
    totalAmount: 4382.50,
    sourceType: 'Receipt Shoebox',
    status: 'Submitted to Bookkeeping',
    submittedBy: 'Fiona Gallagher',
    submittedAt: '2026-02-15T16:00:00Z',
    notes: 'All items matched to vendor receipts. Classified to GL 6310 Vehicle Fuel & GL 6320 Tolls.'
  },
  {
    id: 'bat_002',
    batchName: 'Q4 2025 Credit Card Expense Spreadsheet',
    clientId: 'cli_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    totalEntries: 24,
    totalAmount: 18940.00,
    sourceType: 'Client Spreadsheet Import',
    status: 'Approved by Bookkeeper',
    submittedBy: 'Fiona Gallagher',
    submittedAt: '2026-02-10T11:30:00Z',
    notes: 'Imported from Amex CSV export. Reconciled to statement balance.'
  }
];

export const INITIAL_DEMO_CASH_ENTRIES: CashTransactionEntry[] = [
  {
    id: 'ce_001',
    batchId: 'bat_001',
    date: '2026-01-08',
    vendorOrPayee: 'Pilot Flying J #492',
    description: 'Diesel Fuel - Unit #104 (180 gal)',
    suggestedAccount: '6310 Vehicle Fuel',
    amount: 684.20,
    matchedReceiptHash: 'rcpt_hash_a81f',
    status: 'Bookkeeper Approved'
  },
  {
    id: 'ce_002',
    batchId: 'bat_001',
    date: '2026-01-14',
    vendorOrPayee: 'Loves Travel Stop #201',
    description: 'Truck Maintenance & DEF Fluid',
    suggestedAccount: '6330 Fleet Repairs',
    amount: 349.80,
    matchedReceiptHash: 'rcpt_hash_b92c',
    status: 'Bookkeeper Approved'
  },
  {
    id: 'ce_003',
    batchId: 'bat_001',
    date: '2026-01-22',
    vendorOrPayee: 'Unidentified Cash Receipt',
    description: 'Hardware Supplies (Handwritten receipt)',
    suggestedAccount: '6400 General Supplies',
    amount: 145.00,
    status: 'Pending Documentation'
  }
];

// 4F. Accounts Payable Bills & Batches
export const INITIAL_DEMO_AP_BILLS: VendorBillRecord[] = [
  {
    id: 'ap_001',
    clientId: 'cli_summit',
    clientName: 'Summit Ridge Logistics Corp',
    vendorName: 'Cummins Atlantic Engine Service',
    invoiceNumber: 'INV-883921',
    invoiceDate: '2026-01-28',
    dueDate: '2026-02-28',
    amount: 4250.00,
    suggestedGlAccount: '6330 Equipment Maintenance',
    w9OnFileType: true,
    requires1099: true,
    duplicateWarning: false,
    approvalStatus: 'Approved for Payment'
  },
  {
    id: 'ap_002',
    clientId: 'cli_summit',
    clientName: 'Summit Ridge Logistics Corp',
    vendorName: 'Apex Commercial Tires LLC',
    invoiceNumber: 'INV-40918',
    invoiceDate: '2026-02-02',
    dueDate: '2026-03-02',
    amount: 6180.00,
    suggestedGlAccount: '6335 Fleet Tires & Parts',
    w9OnFileType: false,
    requires1099: true,
    duplicateWarning: false,
    approvalStatus: 'On Hold / Disputed'
  },
  {
    id: 'ap_003',
    clientId: 'cli_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    vendorName: 'Palmetto Real Estate Advisory Group',
    invoiceNumber: 'INV-2026-014',
    invoiceDate: '2026-02-01',
    dueDate: '2026-02-15',
    amount: 2500.00,
    suggestedGlAccount: '6110 Professional Legal & Consulting',
    w9OnFileType: true,
    requires1099: true,
    duplicateWarning: false,
    approvalStatus: 'Simulated Paid'
  }
];

export const INITIAL_DEMO_PAYMENT_BATCHES: PaymentBatchRecord[] = [
  {
    id: 'pbat_001',
    batchDate: '2026-02-15',
    totalAmount: 6750.00,
    billCount: 2,
    status: 'Authorized (Simulated)'
  }
];

// 4G. Accounts Receivable Records
export const INITIAL_DEMO_AR_RECORDS: ClientArRecord[] = [
  {
    id: 'ar_001',
    clientId: 'cli_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    invoiceNumber: 'INV-2026-001',
    issueDate: '2026-01-05',
    dueDate: '2026-02-05',
    originalAmount: 4500.00,
    retainerApplied: 1500.00,
    balanceDue: 0.00,
    agingBucket: 'Current',
    paymentPlanActive: false,
    status: 'Paid (Simulated)'
  },
  {
    id: 'ar_002',
    clientId: 'cli_summit',
    clientName: 'Summit Ridge Logistics Corp',
    invoiceNumber: 'INV-2026-004',
    issueDate: '2026-01-10',
    dueDate: '2026-02-10',
    originalAmount: 5200.00,
    retainerApplied: 0.00,
    balanceDue: 5200.00,
    agingBucket: '1-30 Days',
    paymentPlanActive: false,
    status: 'Sent'
  },
  {
    id: 'ar_003',
    clientId: 'cli_haven',
    clientName: 'Coastal Haven Hospitality Group',
    invoiceNumber: 'INV-2025-089',
    issueDate: '2025-11-15',
    dueDate: '2025-12-15',
    originalAmount: 3800.00,
    retainerApplied: 0.00,
    balanceDue: 3800.00,
    agingBucket: '61-90 Days',
    paymentPlanActive: true,
    status: 'Reminder Sent (Simulated)'
  }
];

export const INITIAL_DEMO_PAYMENT_PLANS: PaymentPlanRecord[] = [
  {
    id: 'pplan_001',
    clientId: 'cli_haven',
    clientName: 'Coastal Haven Hospitality Group',
    totalBalance: 3800.00,
    monthlyInstallment: 950.00,
    installmentsTotal: 4,
    installmentsRemaining: 2,
    startDate: '2026-01-01',
    status: 'Active'
  }
];

// 4H. Quality Control Inspection Records
export const INITIAL_DEMO_QC_INSPECTIONS: QualityInspectionRecord[] = [
  {
    id: 'qc_001',
    engagementId: 'eng_2025_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    taxYear: 2025,
    formType: 'Form 1120-S & SC1120S',
    inspectedBy: 'Isabel Thorpe',
    inspectionDate: '2026-02-19',
    traceabilityScore: 98,
    makerCheckerSeparationConfirmed: true,
    reviewerEvidenceAttached: true,
    clientConsentOnRecord: true,
    findings: [
      { severity: 'Observation', description: 'Schedule B questions checked: all foreign accounts and crypto asset questions answered consistently with questionnaire.', remediated: true },
      { severity: 'Warning', description: 'SC1120S apportionment percentage rounded to 4 decimals instead of 6 decimals.', remediated: true }
    ],
    qcReleaseStatus: 'Quality Control Cleared'
  },
  {
    id: 'qc_002',
    engagementId: 'eng_2025_summit',
    clientName: 'Summit Ridge Logistics Corp',
    taxYear: 2025,
    formType: 'Form 1120',
    inspectedBy: 'Isabel Thorpe',
    inspectionDate: '2026-02-18',
    traceabilityScore: 84,
    makerCheckerSeparationConfirmed: true,
    reviewerEvidenceAttached: false,
    clientConsentOnRecord: true,
    findings: [
      { severity: 'Critical', description: 'Reviewer workpaper signoff signature missing on Section 179 depreciation schedule.', remediated: false },
      { severity: 'Warning', description: 'Check #4092 ($8,750) remains in suspense GL 1999 without supporting invoice.', remediated: false }
    ],
    qcReleaseStatus: 'Findings Open - Release Blocked'
  }
];

// 4I. Filing Submission Batches
export const INITIAL_DEMO_FILING_BATCHES: FilingSubmissionBatch[] = [
  {
    id: 'fbat_001',
    batchNumber: 'MEF-2026-0041',
    formType: 'Form 1120-S / SC1120S',
    jurisdictions: ['Federal (IRS)', 'South Carolina DOR'],
    submissionCount: 1,
    transmissionTimestamp: '2026-02-19 14:00:00 EST',
    schemaValidationStatus: 'Passed (Simulated)',
    status: 'Transmitted—Simulated'
  },
  {
    id: 'fbat_002',
    batchNumber: 'MEF-2026-0042',
    formType: 'Form 1040 / SC1040',
    jurisdictions: ['Federal (IRS)', 'South Carolina DOR'],
    submissionCount: 4,
    schemaValidationStatus: 'Passed (Simulated)',
    status: 'Ready for Transmission'
  }
];

// 4J. Acknowledgement Records
export const INITIAL_DEMO_ACKS: AcknowledgementRecord[] = [
  {
    id: 'ack_001',
    submissionId: '10402025055000000001',
    clientName: 'Perotti Capital Holdings LLC',
    taxYear: 2024,
    formType: 'Form 1120-S',
    jurisdiction: 'Federal IRS',
    ackType: 'Federal',
    status: 'Accepted—Simulated',
    returnCode: '100',
    messageText: 'IRS MeF electronic return received and accepted without errors.',
    timestamp: '2025-03-12T11:32:05Z',
    correctionCaseCreated: false
  },
  {
    id: 'ack_002',
    submissionId: 'SC2025055000000002',
    clientName: 'Perotti Capital Holdings LLC',
    taxYear: 2024,
    formType: 'SC1120S',
    jurisdiction: 'South Carolina DOR',
    ackType: 'State',
    status: 'Rejected—Simulated',
    returnCode: 'F1120S-002',
    messageText: 'Withholding mismatch between Schedule K-1 and quarterly WH-1606 filings on record.',
    timestamp: '2025-03-13T14:20:00Z',
    correctionCaseCreated: true
  }
];

// 4K. Government Notice Records
export const INITIAL_DEMO_NOTICES: GovernmentNoticeRecord[] = [
  {
    id: 'not_001',
    clientId: 'cli_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    authority: 'South Carolina Department of Revenue',
    noticeNumber: 'SCDOR-Notice-301',
    taxYear: 2024,
    noticeDate: '2025-06-18',
    responseDeadline: '2025-07-18',
    proposedTaxAmount: 1450.00,
    proposedPenaltyAmount: 145.00,
    category: 'Penalty or interest',
    assignedPractitioner: 'Liam O’Connor',
    status: 'Response Case Open'
  },
  {
    id: 'not_002',
    clientId: 'cli_haven',
    clientName: 'Coastal Haven Hospitality Group',
    authority: 'Internal Revenue Service',
    noticeNumber: 'Notice CP2000',
    taxYear: 2023,
    noticeDate: '2026-01-14',
    responseDeadline: '2026-03-18',
    proposedTaxAmount: 14280.00,
    proposedPenaltyAmount: 2856.00,
    category: 'Income mismatch',
    assignedPractitioner: 'Miranda Cruz, EA',
    status: 'Drafting Response'
  }
];

// 4L. Tax Resolution Cases
export const INITIAL_DEMO_RESOLUTION_CASES: TaxResolutionCase[] = [
  {
    id: 'res_001',
    clientId: 'cli_haven',
    clientName: 'Coastal Haven Hospitality Group',
    form2848OnRecord: true,
    totalTaxLiability: 42600.00,
    openYears: [2022, 2023],
    collectionStage: 'Notice of Intent to Levy',
    resolutionStrategy: 'Installment Agreement (Form 9465)',
    caseStatus: 'Form Package Prepared',
    assignedPractitioner: 'Miranda Cruz, EA'
  }
];

// 4M. Audit Examination Cases
export const INITIAL_DEMO_AUDIT_CASES: AuditCaseRecord[] = [
  {
    id: 'aud_001',
    clientId: 'cli_summit',
    clientName: 'Summit Ridge Logistics Corp',
    taxYear: 2023,
    agency: 'IRS Small Business & Self-Employed (SB/SE)',
    examinerName: 'Agent Frank Reynolds (Badge #88392)',
    examType: 'Office Exam',
    examIssues: ['Depreciation MACRS 5-yr vs 7-yr', 'Substantiation of Travel & Entertainment IRC § 274(d)'],
    idrCount: 3,
    proposedAdjustments: 12400.00,
    responseDeadline: '2026-03-15',
    status: 'IDR Production',
    assignedDefenseLead: 'Nathaniel Drake, CPA'
  }
];

// 4N. Amendment Cases
export const INITIAL_DEMO_AMENDMENTS: AmendmentCaseRecord[] = [
  {
    id: 'amd_001',
    originalEngagementId: 'eng_2024_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    taxYear: 2024,
    originalForm: 'Form 1120-S',
    amendedForm: 'Form 1120-S Amended',
    reasonForAmendment: 'Received corrected Schedule K-1 from Palmetto Energy Fund LLC showing additional Section 179 deduction ($18,400) not reflected on original filing.',
    originalTaxableIncome: 485200.00,
    amendedTaxableIncome: 466800.00,
    originalTaxLiability: 0.00, // Pass-through
    amendedTaxLiability: 0.00,
    netRefundOrBalanceDue: 0.00,
    preparerAssigned: 'Marcus Vance, EA',
    reviewerApproved: true,
    clientSignatureForm8879X: true,
    filingStatus: 'Signed by Client'
  }
];

// 4O. Records & Archive Cases
export const INITIAL_DEMO_ARCHIVES: ArchiveRecord[] = [
  {
    id: 'arc_001',
    engagementId: 'eng_2023_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    taxYear: 2023,
    packageType: 'Full Tax Filing Archive',
    documentCount: 28,
    archiveDate: '2024-04-10',
    retentionExpiryDate: '2031-04-15', // 7-year statutory retention
    legalHoldActive: false,
    destructionEligible: false,
    destructionStatus: 'Retained Active',
    rolledForward: true
  },
  {
    id: 'arc_002',
    engagementId: 'eng_2018_summit_prior',
    clientName: 'Summit Ridge Logistics Corp',
    taxYear: 2018,
    packageType: 'Trial Balance & Financial Statements',
    documentCount: 14,
    archiveDate: '2019-04-15',
    retentionExpiryDate: '2026-04-15',
    legalHoldActive: false,
    destructionEligible: true,
    destructionStatus: 'Retained Active',
    rolledForward: true
  }
];

// 4P. Client Success & Renewal Records
export const INITIAL_DEMO_RENEWALS: ClientRenewalRecord[] = [
  {
    id: 'ren_001',
    clientId: 'cli_perotti',
    clientName: 'Perotti Capital Holdings LLC',
    priorTaxYear: 2025,
    renewalTaxYear: 2026,
    servicesPriorYear: ['Form 1120-S', 'SC1120S', 'Quarterly Advisory'],
    proposedServices: ['Form 1120-S', 'SC1120S', 'Monthly CAS Bookkeeping', 'Tax Strategy Retainer'],
    feedbackScore: 10,
    clientSatisfaction: 'Delighted',
    renewalStatus: 'Renewal Proposal Sent',
    notes: 'Client expressed interest in bundling monthly bookkeeping and quarterly tax strategy starting Q2 2026.'
  },
  {
    id: 'ren_002',
    clientId: 'cli_summit',
    clientName: 'Summit Ridge Logistics Corp',
    priorTaxYear: 2025,
    renewalTaxYear: 2026,
    servicesPriorYear: ['Form 1120', 'Payroll Filing', 'Quarterly CAS'],
    proposedServices: ['Form 1120', 'Multi-State Nexus', 'Full CAS', 'Annual Payroll'],
    feedbackScore: 8,
    clientSatisfaction: 'Satisfied',
    renewalStatus: 'Follow-up Call Scheduled',
    notes: 'Discuss expansion into North Carolina and Florida terminal logistics.'
  }
];

// 4Q. IT & Application Support Tickets
export const INITIAL_DEMO_SUPPORT_TICKETS: SupportTicketRecord[] = [
  {
    id: 'sup_001',
    ticketNumber: 'TKT-2026-104',
    userRole: 'reviewer',
    userName: 'Elena Rostova, CPA',
    category: 'Dashboard Render',
    severity: 'Low',
    browserEnvironment: 'Chrome 131.0 / macOS Sonoma 14.6',
    summary: 'Trial balance variance diff column text wrapping on narrow laptop displays.',
    sanitizedLogs: '[UI_RENDER_OBSERVER] Table cell min-width: 120px enforced. Horizontal scrollbar enabled cleanly.',
    status: 'Resolved (Simulated)',
    createdAt: '2026-02-18T09:40:00Z'
  },
  {
    id: 'sup_002',
    ticketNumber: 'TKT-2026-105',
    userRole: 'filing',
    userName: 'Julian Mercer, ERO',
    category: 'Mock Data Desync',
    severity: 'Medium',
    browserEnvironment: 'Firefox 133.0 / Windows 11 Pro',
    summary: 'Simulated submission ID counter incrementing correctly across concurrent test batches.',
    sanitizedLogs: '[DIAGNOSTIC] Batch submission ID sequence: 10402026045000000088 verified against in-memory registry.',
    status: 'Open',
    createdAt: '2026-02-19T10:15:00Z'
  }
];
