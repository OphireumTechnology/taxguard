/**
 * A/R Tax Services, LLC - Initial Seed Data for Client Dashboard
 * Provides realistic demonstration data for all 8 client sections.
 */

import {
  ClientIncomeRecord,
  ClientExpenseRecord,
  TaxOrganizerState,
  ClientReturnReviewData,
  ClientInvoiceRecord,
  ClientNoticeRecord,
  ClientArchiveRecord,
  ClientNotification
} from './clientDashboardInterfaces';

export const INITIAL_CLIENT_INCOME: ClientIncomeRecord[] = [
  {
    id: 'inc_01',
    clientId: 'cli_perotti',
    taxYear: 2025,
    type: 'Business revenue',
    entity: 'Perotti Capital Holdings LLC',
    date: '2025-11-15',
    payer: 'Highland Ridge Commercial LLC',
    amount: 142500.00,
    withholding: 0.00,
    description: 'Q4 Real Estate Advisory & Asset Structuring Retainer',
    supportingDocName: 'highland_ridge_invoice_receipt_q4.pdf',
    status: 'Reviewed'
  },
  {
    id: 'inc_02',
    clientId: 'cli_perotti',
    taxYear: 2025,
    type: 'Interest',
    entity: 'Perotti Capital Holdings LLC',
    date: '2025-12-31',
    payer: 'First Horizon Commercial Bank',
    amount: 8640.22,
    withholding: 0.00,
    description: 'Commercial Money Market Yield (Form 1099-INT)',
    supportingDocName: 'first_horizon_1099_int_2025.pdf',
    status: 'Reviewed'
  },
  {
    id: 'inc_03',
    clientId: 'cli_perotti',
    taxYear: 2025,
    type: 'Dividends',
    entity: 'Perotti Capital Holdings LLC',
    date: '2025-12-28',
    payer: 'Vanguard Brokerage Services',
    amount: 18450.00,
    withholding: 0.00,
    description: 'Qualified Dividend Distribution (Form 1099-DIV)',
    supportingDocName: 'vanguard_consolidated_1099_2025.pdf',
    status: 'Reviewed'
  },
  {
    id: 'inc_04',
    clientId: 'cli_perotti',
    taxYear: 2025,
    type: 'Capital gains',
    entity: 'Perotti Capital Holdings LLC',
    date: '2025-08-14',
    payer: 'Palmetto Title & Escrow Co.',
    amount: 62800.00,
    withholding: 0.00,
    description: 'Commercial Outparcel Disposition (Form 1099-S)',
    supportingDocName: 'palmetto_settlement_statement_2025.pdf',
    status: 'Submitted'
  }
];

export const INITIAL_CLIENT_EXPENSES: ClientExpenseRecord[] = [
  {
    id: 'exp_01',
    clientId: 'cli_perotti',
    taxYear: 2025,
    date: '2025-03-12',
    vendor: 'Carolina Commercial Realty Inc.',
    amount: 48000.00,
    entity: 'Perotti Capital Holdings LLC',
    businessPurpose: 'Headquarters Lease Suite 400 (Greenville, SC)',
    category: 'Rent',
    paymentMethod: 'ACH / Bank',
    receiptFileName: 'lease_payment_receipt_2025.pdf',
    status: 'Reviewed',
    aiRecommendation: {
      proposedCategory: 'Rent',
      confidence: 0.99,
      explanation: 'Matches recurring commercial lease contract schedule.',
      supportingDoc: 'lease_agreement_greenville_suite400.pdf',
      accepted: true
    }
  },
  {
    id: 'exp_02',
    clientId: 'cli_perotti',
    taxYear: 2025,
    date: '2025-06-20',
    vendor: 'A/R Tax Services, LLC',
    amount: 4500.00,
    entity: 'Perotti Capital Holdings LLC',
    businessPurpose: 'Entity Tax Preparation & Regulatory Compliance',
    category: 'Legal and professional',
    paymentMethod: 'ACH / Bank',
    receiptFileName: 'artax_invoice_inv_2025_0892_receipt.pdf',
    status: 'Reviewed',
    aiRecommendation: {
      proposedCategory: 'Legal and professional',
      confidence: 0.98,
      explanation: 'IRC Section 162 ordinary and necessary professional advisory fee.',
      supportingDoc: 'artax_statement_2025.pdf',
      accepted: true
    }
  },
  {
    id: 'exp_03',
    clientId: 'cli_perotti',
    taxYear: 2025,
    date: '2025-09-18',
    vendor: 'Dell Financial Services',
    amount: 3420.50,
    entity: 'Perotti Capital Holdings LLC',
    businessPurpose: 'Replacement CAD Workstation for Asset Modeling',
    category: 'Supplies',
    paymentMethod: 'Credit Card',
    receiptFileName: 'dell_invoice_workstation_89012.pdf',
    status: 'Submitted',
    aiRecommendation: {
      proposedCategory: 'Supplies',
      confidence: 0.92,
      explanation: 'De minimis safe harbor expense under Treas. Reg. 1.263(a)-1(f) (<$2,500/item).',
      supportingDoc: 'dell_invoice_workstation_89012.pdf',
      accepted: true
    }
  },
  {
    id: 'exp_04',
    clientId: 'cli_perotti',
    taxYear: 2025,
    date: '2025-10-04',
    vendor: 'Travelers Commercial Insurance',
    amount: 6850.00,
    entity: 'Perotti Capital Holdings LLC',
    businessPurpose: 'Commercial General Liability & Cyber Coverage',
    category: 'Insurance',
    paymentMethod: 'ACH / Bank',
    receiptFileName: 'travelers_policy_receipt_2025.pdf',
    status: 'Reviewed',
    aiRecommendation: {
      proposedCategory: 'Insurance',
      confidence: 0.97,
      explanation: 'Ordinary and necessary risk coverage under IRC Section 162.',
      accepted: true
    }
  }
];

export const INITIAL_TAX_ORGANIZER: TaxOrganizerState = {
  clientId: 'cli_perotti',
  taxYear: 2025,
  status: 'In Progress',
  completionPercentage: 75,
  sections: {
    personal: {
      taxpayerName: 'Michael Perotti',
      tinMasked: '***-**-4890',
      birthDate: '1979-05-14',
      occupation: 'Managing Member & Asset Strategist',
      phone: '(864) 555-0192',
      email: 'm.perotti@perotticapital.com',
      addressStreet: '100 North Main Street, Suite 400',
      city: 'Greenville',
      state: 'SC',
      zipCode: '29601',
      residencyStatus: 'Full-Year Resident'
    },
    filingStatus: {
      status: 'Married Filing Jointly',
      livedTogetherEntireYear: true,
      hasQualifyingDependents: true
    },
    spouse: {
      spouseName: 'Claire Perotti',
      spouseTinMasked: '***-**-7104',
      spouseOccupation: 'Architectural Consultant',
      spouseBirthDate: '1981-11-22'
    },
    dependents: {
      dependentCount: 2,
      dependentsList: [
        { name: 'Lucas Perotti', relationship: 'Son', age: 14, student: true },
        { name: 'Sophia Perotti', relationship: 'Daughter', age: 11, student: true }
      ]
    },
    employment: {
      receivedW2: true,
      w2EmployerCount: 1,
      officerCompensationTaken: true,
      officerWagesAmount: 120000.00
    },
    selfEmployment: {
      hasScheduleC: false,
      businessName: 'Perotti Capital Holdings LLC',
      ein: '82-9104890',
      principalActivityCode: '531390'
    },
    businessActivity: {
      sCorpOwnershipPercentage: 100,
      materialParticipation: true,
      capitalContributionsMade: 0,
      distributionsTaken: 95000.00,
      hasHealthInsurancePaidByCorp: true
    },
    investments: {
      soldStocksBonds: true,
      received1099B: true,
      brokerageCount: 2,
      hasWashSales: false
    },
    digitalAssets: {
      ownedOrTransactedCrypto: false,
      explanation: 'No cryptocurrency or virtual assets transacted in 2025.'
    },
    retirement: {
      contributedSolo401k: true,
      solo401kAmount: 23000.00,
      employerMatchContribution: 18000.00,
      convertedRothIRA: false
    },
    education: {
      has529Contributions: true,
      state529State: 'SC (Future Scholar 529)',
      contributionAmount: 6000.00
    },
    healthcare: {
      highDeductiblePlan: true,
      contributedHSA: true,
      hsaAnnualAmount: 8300.00
    },
    property: {
      purchasedRealEstate: false,
      refinancedMortgage: false,
      propertyTaxesPaidSC: 12450.00
    },
    rentalProperties: {
      ownsRentalRealEstate: false,
      directRentalIncome: 0
    },
    itemizedDeductions: {
      mortgageInterest1098: 24800.00,
      stateAndLocalTaxesCapped: 10000.00,
      medicalExpensesExceedingThreshold: false
    },
    charitableContributions: {
      cashCharitableContributions: 16500.00,
      hasWrittenAcknowledgmentBankRecords: true,
      nonCashCharityOver500: false
    },
    foreignActivity: {
      hasForeignBankAccounts: false,
      fbarRequired: false,
      foreignTaxesPaid: 0
    },
    multiStateActivity: {
      conductedBusinessOutsideSC: true,
      otherStates: ['NC', 'GA'],
      apportionmentRecordsAvailable: true
    },
    estimatedPayments: {
      paidFederalQuarterly: true,
      q1Fed: 12500,
      q2Fed: 12500,
      q3Fed: 12500,
      q4Fed: 12500,
      totalFedEstimates: 50000,
      paidSCStateEstimates: true,
      totalSCEstimates: 14000
    },
    notices: {
      receivedAnyTaxNoticesIn2025: false,
      resolvedPriorDisputes: true
    },
    priorYearChanges: {
      accountingMethodChanged: false,
      ownershipStructureChanged: false
    },
    electronicSignatureConsent: {
      consentedToEFile: true,
      consentDate: '2026-02-10',
      ipAddress: '68.188.14.92 (Simulated)'
    }
  },
  missingDocumentChecklist: [
    'Schedule K-1 from Coastal Logistics Partners LLC (TY2025)',
    '1099-DIV Statement from Charles Schwab Custody',
    'Confirmation of SC DOR Q4 Estimated Tax Voucher'
  ]
};

export const INITIAL_DRAFT_RETURN: ClientReturnReviewData = {
  returnId: 'ret_2025_1120s_perotti',
  clientId: 'cli_perotti',
  clientName: 'Michael Perotti',
  entity: 'Perotti Capital Holdings LLC',
  returnType: 'Form 1120-S & SC1120S',
  taxYear: 2025,
  preparationStatus: 'Completed by Desmond Hinds, MSA',
  reviewerStatus: 'Certified by Elena Rostova, CPA',
  version: 'v1.4 - Final Draft for Client Authorization',
  figures: {
    grossReceipts: 645000.00,
    totalDeductions: 398500.00,
    taxableOrdinaryIncome: 246500.00,
    credits: 4200.00,
    estimatedPaymentsMade: 50000.00,
    balanceDueOrRefund: -3850.00 // Refund due
  },
  federalSummary: {
    form: 'Form 1120-S (U.S. Income Tax Return for an S Corporation)',
    lineItems: [
      { line: 'Line 1a', description: 'Gross receipts or sales', amount: 645000.00 },
      { line: 'Line 2', description: 'Cost of goods sold / direct execution costs', amount: 98000.00 },
      { line: 'Line 3', description: 'Gross profit', amount: 547000.00 },
      { line: 'Line 7', description: 'Compensation of officers', amount: 120000.00 },
      { line: 'Line 8', description: 'Salaries and wages', amount: 65000.00 },
      { line: 'Line 12', description: 'Taxes and licenses', amount: 14200.00 },
      { line: 'Line 16', description: 'Rents paid for corporate facilities', amount: 48000.00 },
      { line: 'Line 19', description: 'Other business deductions (Section 162)', amount: 53300.00 },
      { line: 'Line 21', description: 'Ordinary business income (Schedule K, Line 1)', amount: 246500.00 }
    ]
  },
  stateSummary: {
    state: 'South Carolina',
    form: 'Form SC1120S (Corporate Income Tax Return)',
    taxDue: 0.00 // S-Corp flow-through entity
  },
  priorYearComparison: {
    priorTaxYear: 2024,
    priorGrossReceipts: 580000.00,
    priorTaxableIncome: 215000.00,
    percentageChange: '+11.2% Top-line Revenue Growth'
  },
  importantChanges: [
    'Bonus Depreciation stepped down to 60% for eligible equipment under TCJA phaseout.',
    'SC Pass-Through Entity (PTE) tax credit apportioned to shareholder Schedule K-1.',
    'Standard mileage rate and section 179 vehicle deductions optimized.'
  ],
  openQuestions: [],
  missingEvidence: [],
  signatureRequired: true,
  signatureCertified: false
};

export const INITIAL_CLIENT_NOTICES: ClientNoticeRecord[] = [
  {
    id: 'not_01',
    clientId: 'cli_perotti',
    authority: 'IRS',
    authorityName: 'Internal Revenue Service (Philadelphia Service Center)',
    noticeNumber: 'CP2000',
    noticeTitle: 'Proposed Changes to 2023 Form 1040 (Resolved / Sample Record)',
    taxYear: 2023,
    receivedDate: '2024-08-15',
    responseDeadline: '2024-09-15',
    daysRemaining: 0,
    amountRequested: 3820.00,
    possibleCategory: 'Unreported 1099-B Brokerage Basis',
    requiredClientActions: ['None — Full formal explanation submitted and accepted.'],
    assignedProfessional: 'Elena Rostova, CPA',
    status: 'Resolved',
    evidenceFiles: ['1099B_cost_basis_reconciliation_2023.pdf', 'irs_letter_of_acceptance_2023.pdf'],
    summaryNotes: 'IRS inquiry regarding Form 1099-B box mismatch. Resolved with zero additional tax liability assessed.',
    responseDraft: 'Formal 886-A response package transmitted with certified settlement ledger.'
  },
  {
    id: 'not_02',
    clientId: 'cli_perotti',
    authority: 'State Department of Revenue',
    authorityName: 'South Carolina Department of Revenue (Columbia, SC)',
    noticeNumber: 'SC-REV-04',
    noticeTitle: 'SC Business Personal Property Tax Assessment Verification',
    taxYear: 2025,
    receivedDate: '2026-02-01',
    responseDeadline: '2026-03-31',
    daysRemaining: 14,
    amountRequested: 0.00,
    possibleCategory: 'Annual Entity Information Update',
    requiredClientActions: ['Confirm Greenville County office computer schedule'],
    assignedProfessional: 'Desmond Hinds, MSA',
    status: 'Under Professional Review',
    evidenceFiles: ['sc_dor_annual_notice_2025.pdf'],
    summaryNotes: 'Routine annual county personal property assessment schedule verification.',
    responseDraft: 'Draft PT-100 property return prepared for filing alongside corporate package.'
  }
];

export const INITIAL_CLIENT_ARCHIVES: ClientArchiveRecord[] = [
  {
    id: 'arc_2024_01',
    clientId: 'cli_perotti',
    entity: 'Perotti Capital Holdings LLC',
    taxYear: 2024,
    recordType: 'Final tax returns',
    title: 'Tax Year 2024 Form 1120-S & SC1120S Final Filing Package',
    fileName: 'Perotti_Capital_Holdings_2024_Form_1120S_Final.pdf',
    fileSize: '4.82 MB',
    issueDate: '2025-03-12',
    approvalStatus: 'Certified',
    filingStatus: 'Accepted by IRS',
    verificationId: 'VER-2024-8879S-4890',
    demoSha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    isReadOnly: true,
    mefSubmissionId: '10401220250710000109',
    acceptedAt: '2025-03-12T14:22:08Z',
    amendmentStatus: 'Original'
  },
  {
    id: 'arc_2024_02',
    clientId: 'cli_perotti',
    entity: 'Perotti Capital Holdings LLC',
    taxYear: 2024,
    recordType: 'Government acknowledgements',
    title: 'IRS MeF Electronic Acceptance Acknowledgment (TY2024)',
    fileName: 'IRS_MeF_Acceptance_Acknowledgement_TY2024.pdf',
    fileSize: '312 KB',
    issueDate: '2025-03-12',
    approvalStatus: 'Certified',
    filingStatus: 'Accepted by IRS',
    verificationId: 'ACK-IRS-2024-0012',
    demoSha256Hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    isReadOnly: true,
    mefSubmissionId: '10401220250710000109',
    acceptedAt: '2025-03-12T14:22:08Z'
  },
  {
    id: 'arc_2024_03',
    clientId: 'cli_perotti',
    entity: 'Perotti Capital Holdings LLC',
    taxYear: 2024,
    recordType: 'Signed authorizations',
    title: 'Form 8879-S IRS E-File Signature Authorization (TY2024)',
    fileName: 'Form_8879S_Signed_Michael_Perotti_2024.pdf',
    fileSize: '540 KB',
    issueDate: '2025-03-11',
    approvalStatus: 'Certified',
    filingStatus: 'Accepted by IRS',
    verificationId: 'SIG-8879-2024-9104',
    demoSha256Hash: 'c7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef012345678',
    isReadOnly: true
  },
  {
    id: 'arc_2023_01',
    clientId: 'cli_perotti',
    entity: 'Perotti Capital Holdings LLC',
    taxYear: 2023,
    recordType: 'Final tax returns',
    title: 'Tax Year 2023 Form 1120-S & SC1120S Final Filing Package',
    fileName: 'Perotti_Capital_Holdings_2023_Form_1120S_Final.pdf',
    fileSize: '4.15 MB',
    issueDate: '2024-03-14',
    approvalStatus: 'Certified',
    filingStatus: 'Accepted by IRS',
    verificationId: 'VER-2023-8879S-1029',
    demoSha256Hash: '9876543210abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    isReadOnly: true,
    mefSubmissionId: '10401220240730000492',
    acceptedAt: '2024-03-14T16:05:44Z',
    amendmentStatus: 'Original'
  },
  {
    id: 'arc_2023_02',
    clientId: 'cli_perotti',
    entity: 'Perotti Capital Holdings LLC',
    taxYear: 2023,
    recordType: 'Financial statements',
    title: 'Annual Balance Sheet & Income Statement (Dec 31, 2023)',
    fileName: 'Perotti_Capital_Financial_Statements_2023_Certified.pdf',
    fileSize: '1.24 MB',
    issueDate: '2024-02-15',
    approvalStatus: 'Approved',
    filingStatus: 'N/A',
    verificationId: 'FS-2023-1120-CERT',
    demoSha256Hash: '456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123',
    isReadOnly: true
  }
];

export const INITIAL_CLIENT_NOTIFICATIONS: ClientNotification[] = [
  {
    id: 'notif_01',
    clientId: 'cli_perotti',
    title: 'Draft Return Ready for Review',
    message: 'Elena Rostova, CPA has certified your 2025 Form 1120-S draft. Please review and authorize.',
    type: 'return_ready',
    targetNav: 'return_review',
    timestamp: '2026-02-15T09:30:00Z',
    isRead: false
  },
  {
    id: 'notif_02',
    clientId: 'cli_perotti',
    title: 'Tax Notice Deadline Approaching',
    message: 'SC DOR Property Tax Assessment response is due in 14 days. Preparer draft ready.',
    type: 'notice_deadline',
    targetNav: 'notices',
    timestamp: '2026-02-14T11:20:00Z',
    isRead: false
  },
  {
    id: 'notif_03',
    clientId: 'cli_perotti',
    title: 'Retainer Fee Invoice Issued',
    message: 'Invoice INV-2026-0144 for Tax Year 2025 corporate preparation is available.',
    type: 'invoice_issued',
    targetNav: 'billing',
    timestamp: '2026-02-10T14:00:00Z',
    isRead: true
  },
  {
    id: 'notif_04',
    clientId: 'cli_perotti',
    title: 'Document Verified Clean',
    message: 'bank_statement_december_2025.pdf completed anti-malware verification (Simulated).',
    type: 'document_received',
    targetNav: 'vault',
    timestamp: '2026-02-08T16:45:00Z',
    isRead: true
  }
];
