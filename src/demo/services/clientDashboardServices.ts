/**
 * A/R Tax Services, LLC - Client Dashboard Demo Services
 * Implements the concrete service classes and exports type definitions
 * for the 8 modular Client Portal sections.
 */

import { demoDataStore } from './DemoDataService';

// ============================================================================
// 1. Types & Interfaces for Section 1: Overview
// ============================================================================

export interface ClientTeamMember {
  name: string;
  role: string;
  email: string;
  phone?: string;
  badge?: string;
}

export interface ClientDashboardOverview {
  clientId: string;
  entityName: string;
  clientName: string;
  engagementTitle: string;
  nextDeadline: string;
  taxYear: number;
  returnType: string;
  completionPercentage: number;
  lifecycleStageIndex: number;
  currentLifecycleStage: string;
  responsibleRole: string;
  returnReviewStatus: string;
  signatureStatus: string;
  invoiceStatus: string;
  unpaidBalanceAmount: number;
  filingStatus: string;
  immediateRequiredAction: string;
  documentsRequiringAttention: number;
  missingInformationCount: number;
  assignedTeam: ClientTeamMember[];
}

export interface IOverviewService {
  getOverview(clientId: string): Promise<ClientDashboardOverview>;
}

// ============================================================================
// 2. Types & Interfaces for Section 2: Document Vault
// ============================================================================

export interface DocumentQuestion {
  id: string;
  author: string;
  question: string;
  timestamp?: string;
  date?: string;
  response?: string;
}

export interface ClientDocumentItem {
  id: string;
  fileName: string;
  fileSize: string;
  entityName: string;
  documentType: string;
  confidenceScore: number;
  taxYear: number;
  uploadDate: string;
  securityCheckStatus: string;
  reviewStatus: string;
  issuer: string;
  isDraft: boolean;
  proposedCorrection?: string;
  keyAmounts?: string;
  summary: {
    extractedFields: Array<{ label: string; value: string }>;
    detectedIssues: string[];
    confidenceNote: string;
  };
  questions: DocumentQuestion[];
}

export interface IDocumentService {
  getDocuments(clientId: string): ClientDocumentItem[];
  getDocumentById(id: string): ClientDocumentItem | undefined;
  uploadDocument(clientId: string, file: File): ClientDocumentItem;
  removeDraftDocument(id: string): { success: boolean; error?: string };
  proposeClassificationCorrection(id: string, proposedType: string, author: string): void;
  addDocumentQuestion(id: string, question: string, author: string): void;
}

// ============================================================================
// 3. Types & Interfaces for Section 3: Tax Organizer
// ============================================================================

export interface ClientOrganizerSectionData {
  id: number;
  title: string;
  shortTitle: string;
  status: 'completed' | 'pending' | 'in_progress';
  data: Record<string, any>;
  description?: string;
  isCompleted?: boolean;
}

export interface ClientOrganizerState {
  taxYear: number;
  status: string;
  completionPercentage: number;
  activeSectionId: number;
  sections: ClientOrganizerSectionData[];
}

export interface IOrganizerService {
  getOrganizer(clientId: string): ClientOrganizerState;
  updateField(clientId: string, sectionId: number, key: string, value: any): ClientOrganizerState;
  saveDraft(clientId: string, sectionId: number): void;
  submitOrganizer(clientId: string): { success: boolean; error?: string };
  reopenOrganizer(clientId: string): { success: boolean; error?: string };
}

// ============================================================================
// 4. Types & Interfaces for Section 4: Income & Expenses
// ============================================================================

export interface ClientIncomeRecord {
  id: string;
  taxYear: number;
  date: string;
  payer: string;
  incomeType: string;
  entityName: string;
  amount: number;
  withholding: number;
  description: string;
  status?: string;
  supportingDocName?: string;
}

export interface ClientExpenseRecord {
  id: string;
  taxYear: number;
  date: string;
  vendor: string;
  category: string;
  amount: number;
  entityName: string;
  businessPurpose: string;
  paymentMethod: string;
  receiptFileName?: string;
  status?: string;
  aiConfidence?: number;
  aiExplanation?: string;
  aiRecommendation?: {
    proposedCategory: string;
    confidence: number;
    explanation: string;
  };
}

export interface IIncomeExpenseService {
  getIncome(clientId: string): ClientIncomeRecord[];
  getExpenses(clientId: string): ClientExpenseRecord[];
  getIncomeRecords(clientId: string): ClientIncomeRecord[];
  getExpenseRecords(clientId: string): ClientExpenseRecord[];
  addIncome(clientId: string, record: Omit<ClientIncomeRecord, 'id'>): ClientIncomeRecord;
  addExpense(clientId: string, record: Omit<ClientExpenseRecord, 'id'>): ClientExpenseRecord;
  addIncomeRecord(clientId: string, record: Omit<ClientIncomeRecord, 'id'>): ClientIncomeRecord;
  addExpenseRecord(clientId: string, record: Omit<ClientExpenseRecord, 'id'>): ClientExpenseRecord;
  deleteIncome(id: string): boolean;
  deleteExpense(id: string): boolean;
  deleteIncomeRecord(id: string): boolean;
  deleteExpenseRecord(id: string): boolean;
  getCategoryRecommendation(vendor: string, amount: number, purpose: string): {
    category: string;
    confidence: number;
    explanation: string;
  };
}

// ============================================================================
// 5. Types & Interfaces for Section 5: Return Review & Sign
// ============================================================================

export interface ReturnLineItem {
  line?: string;
  lineNumber?: string;
  description: string;
  amount: number;
  notes?: string;
}

export interface ReturnSignature {
  role: string;
  name: string;
  signedAt: string;
  ipAddress: string;
}

export interface ReturnCorrection {
  id: string;
  field: string;
  explanation: string;
  status: string;
  requestedAt: string;
}

export interface ReturnQuestion {
  id: string;
  author: string;
  text: string;
  date: string;
  response?: string;
}

export interface ClientDraftReturn {
  id: string;
  entityName: string;
  taxYear: number;
  version: string;
  status: string;
  preparer: string;
  certifiedBy: string;
  grossReceipts: number;
  totalDeductions: number;
  ordinaryBusinessIncome: number;
  shareholderDistributions: number;
  stateTaxLiability: number;
  refundOrBalanceDue: number;
  taxCredits: number;
  estimatedPayments: number;
  refundAmount: number;
  lines: ReturnLineItem[];
  lineItems: Array<{ lineNumber: string; description: string; amount: number }>;
  signatures: ReturnSignature[];
  questions: ReturnQuestion[];
  corrections: ReturnCorrection[];
}

export interface IReturnReviewService {
  getDraftReturn(clientId: string, taxYear?: number): ClientDraftReturn | undefined;
  approveDraftReturn(returnId: string, signatoryName: string, ipAddress: string): { success: boolean; error?: string };
  requestCorrection(returnId: string, field: string, explanation: string, author: string): { success: boolean; error?: string };
  askQuestion(returnId: string, question: string, author: string): { success: boolean; error?: string };
}

// ============================================================================
// 6. Types & Interfaces for Section 6: Invoices & Fee Billing
// ============================================================================

export interface InvoiceLineItem {
  description: string;
  hours?: number;
  rate?: number;
  amount: number;
}

export interface InvoicePaymentRecord {
  date: string;
  amount: number;
  method: string;
  receiptId: string;
}

export interface ClientInvoiceRecord {
  id: string;
  invoiceNumber: string;
  serviceDescription: string;
  engagementTitle: string;
  issueDate: string;
  dueDate: string;
  taxYear: number;
  subtotal: number;
  retainerApplied: number;
  balanceDue: number;
  status: string;
  clientName?: string;
  items: InvoiceLineItem[];
  paymentHistory: InvoicePaymentRecord[];
}

export interface IInvoiceService {
  getInvoices(clientId: string): ClientInvoiceRecord[];
  simulatePayment(invoiceId: string, amount: number, method: string): { success: boolean; receiptId?: string; error?: string };
  disputeInvoice(invoiceId: string, reason: string, author: string): void;
  requestPaymentPlan(invoiceId: string, installments: number, author: string): void;
}

// ============================================================================
// 7. Types & Interfaces for Section 7: Tax Notices
// ============================================================================

export interface NoticeMessage {
  id: string;
  author: string;
  role?: string;
  text?: string;
  message?: string;
  date: string;
}

export interface ClientNoticeRecord {
  id: string;
  authority: string;
  noticeNumber: string;
  noticeTitle: string;
  taxYear: number;
  receivedDate: string;
  responseDeadline: string;
  amountRequested: number;
  status: string;
  assignedCpa: string;
  aiSummary: string;
  daysRemaining?: number;
  messages: NoticeMessage[];
}

export interface INoticeService {
  getNotices(clientId: string): ClientNoticeRecord[];
  uploadNotice(clientId: string, notice: Partial<ClientNoticeRecord>): ClientNoticeRecord;
  addNoticeComment(noticeId: string, text: string, author: string): void;
  addNoticeMessage(noticeId: string, text: string, author: string): void;
  approveNoticeResponse(noticeId: string, author: string): void;
  requestPoa(clientId: string): void;
}

// ============================================================================
// 8. Types & Interfaces for Section 8: Planning & Advisory
// ============================================================================

export interface AdvisoryScenario {
  title: string;
  description: string;
  estimatedTaxLiability: number;
  projectedSavings: number;
}

export interface ClientAdvisoryRecommendation {
  id: string;
  title: string;
  category: string;
  annualEstimatedSavings: number;
  implementationEffort: string;
  statutoryBasis: string;
  status: string;
  description: string;
}

export interface ClientAdvisoryPlan {
  clientId: string;
  entityName: string;
  taxYear: number;
  entityType: string;
  recommendations: ClientAdvisoryRecommendation[];
  scenarios: AdvisoryScenario[];
  quarterlyEstimates: Array<{
    quarter: string;
    dueDate: string;
    federalAmount: number;
    stateAmount: number;
    status: string;
  }>;
}

export interface IAdvisoryService {
  getAdvisoryPlan(clientId: string): ClientAdvisoryPlan;
  scheduleStrategyCall(clientId: string, preferredDate: string, topic: string): { success: boolean; confirmation: string };
  requestConsultation(clientId: string, topic: string): void;
}

// ============================================================================
// Concrete Demo Implementations
// ============================================================================

/**
 * 1. Overview Service
 */
export class DemoOverviewService implements IOverviewService {
  public async getOverview(clientId: string): Promise<ClientDashboardOverview> {
    const client = demoDataStore.getClientById(clientId);
    const eng = demoDataStore.getEngagements().find(e => e.clientId === clientId);
    const invs = demoDataStore.getInvoices().filter(i => i.clientId === clientId);
    const unpaidBalance = invs
      .filter(i => i.status !== 'Paid (Simulated)')
      .reduce((sum, i) => sum + i.balanceDue, 0);

    return {
      clientId: client?.id || clientId,
      entityName: client?.businessName || 'Perotti Capital Holdings LLC',
      clientName: client?.name || 'Michael Perotti',
      engagementTitle: eng ? `${eng.taxYear} Corporate & Multi-State Tax Compliance` : '2025 Corporate & Multi-State Tax Compliance',
      nextDeadline: 'March 15, 2026 (Form 1120-S Statutory Filing)',
      taxYear: 2025,
      returnType: 'Form 1120-S (S-Corporation Federal & State)',
      completionPercentage: 82,
      lifecycleStageIndex: 10,
      currentLifecycleStage: 'Approve',
      responsibleRole: 'Senior Reviewer (CPA Elena Rostova)',
      returnReviewStatus: 'CPA Review Complete (Ready for Client Authorization)',
      signatureStatus: 'Form 8879-S Signature Pending',
      invoiceStatus: unpaidBalance > 0 ? 'Unpaid Balance' : 'Paid in Full',
      unpaidBalanceAmount: unpaidBalance,
      filingStatus: 'Awaiting Client E-Signature Authorization',
      immediateRequiredAction: 'Review Draft Form 1120-S & Authorize Form 8879-S',
      documentsRequiringAttention: 2,
      missingInformationCount: 1,
      assignedTeam: [
        { name: 'Elena Rostova, CPA', role: 'Senior Tax Reviewer & Managing CPA', email: 'elena.rostova@artaxservices.com' },
        { name: 'David Vance, EA', role: 'Staff Tax Preparer & Enrolled Agent', email: 'david.vance@artaxservices.com' },
        { name: 'Sarah Jenkins', role: 'Client Service Manager', email: 'sarah.jenkins@artaxservices.com' }
      ]
    };
  }
}

/**
 * 2. Document Vault Service
 */
export class DemoVaultService implements IDocumentService {
  private documents: ClientDocumentItem[] = [
    {
      id: 'doc_w2_2025_01',
      fileName: '2025_W2_Michael_Perotti.pdf',
      fileSize: '412 KB',
      entityName: 'Perotti Capital Holdings LLC',
      documentType: 'W-2',
      confidenceScore: 99,
      taxYear: 2025,
      uploadDate: '2026-01-20',
      securityCheckStatus: 'Clean (SHA-256 Verified)',
      reviewStatus: 'Approved',
      issuer: 'Perotti Capital Holdings LLC',
      isDraft: false,
      summary: {
        extractedFields: [
          { label: 'Employer Identification Number (EIN)', value: 'XX-XXX4192' },
          { label: 'Box 1 Wages, tips, other compensation', value: '$120,000.00' },
          { label: 'Box 2 Federal income tax withheld', value: '$22,410.00' },
          { label: 'Box 3 Social Security wages', value: '$120,000.00' },
          { label: 'Box 4 Social Security tax withheld', value: '$7,440.00' },
          { label: 'Box 5 Medicare wages', value: '$120,000.00' },
          { label: 'Box 6 Medicare tax withheld', value: '$1,740.00' }
        ],
        detectedIssues: [],
        confidenceNote: 'Extracted with 99% accuracy against payroll register.'
      },
      questions: []
    },
    {
      id: 'doc_1099b_2025_02',
      fileName: 'Apex_Investments_1099B_Consolidated.pdf',
      fileSize: '1.8 MB',
      entityName: 'Perotti Capital Holdings LLC',
      documentType: '1099',
      confidenceScore: 97,
      taxYear: 2025,
      uploadDate: '2026-02-04',
      securityCheckStatus: 'Clean (SHA-256 Verified)',
      reviewStatus: 'Approved',
      issuer: 'Apex Clearing & Brokerage',
      isDraft: false,
      summary: {
        extractedFields: [
          { label: '1099-B Gross Proceeds', value: '$642,800.00' },
          { label: 'Total Cost Basis', value: '$580,000.00' },
          { label: 'Net Capital Gain', value: '$62,800.00' },
          { label: 'Wash Sale Disallowed', value: '$0.00' }
        ],
        detectedIssues: [],
        confidenceNote: 'Basis reported to IRS matches certified Form 8949 reconciliations.'
      },
      questions: []
    },
    {
      id: 'doc_k1_2025_03',
      fileName: 'Charleston_Tech_Holdings_K1_2025.pdf',
      fileSize: '890 KB',
      entityName: 'Charleston Tech Holdings LLC',
      documentType: 'K-1',
      confidenceScore: 98,
      taxYear: 2025,
      uploadDate: '2026-02-14',
      securityCheckStatus: 'Clean (SHA-256 Verified)',
      reviewStatus: 'Approved',
      issuer: 'Charleston Tech Holdings LLC',
      isDraft: false,
      summary: {
        extractedFields: [
          { label: 'Box 1 Ordinary business income (loss)', value: '$145,200.00' },
          { label: 'Box 4 Guaranteed payments for services', value: '$0.00' },
          { label: 'Box 19 Code A Cash distributions', value: '$75,000.00' },
          { label: 'Ending capital account balance', value: '$318,400.00' }
        ],
        detectedIssues: [],
        confidenceNote: 'Schedule K-1 audited against partnership final Form 1065.'
      },
      questions: []
    },
    {
      id: 'doc_bank_stmt_dec2025',
      fileName: 'PNC_Commercial_Checking_Dec2025.pdf',
      fileSize: '3.2 MB',
      entityName: 'Perotti Capital Holdings LLC',
      documentType: 'Bank',
      confidenceScore: 95,
      taxYear: 2025,
      uploadDate: '2026-01-12',
      securityCheckStatus: 'Clean (SHA-256 Verified)',
      reviewStatus: 'Approved',
      issuer: 'PNC Bank N.A.',
      isDraft: false,
      summary: {
        extractedFields: [
          { label: 'Statement Period', value: '12/01/2025 - 12/31/2025' },
          { label: 'Ending Ledger Balance', value: '$284,912.45' },
          { label: 'Total Commercial Deposits', value: '$68,450.00' },
          { label: 'Total Operational Checks/Debits', value: '$41,230.12' }
        ],
        detectedIssues: [],
        confidenceNote: 'Reconciled to general ledger account 1000 Cash.'
      },
      questions: []
    },
    {
      id: 'doc_sc_tax_notice_2025',
      fileName: 'SC_DOR_Pass_Through_Acknowledgment.pdf',
      fileSize: '512 KB',
      entityName: 'Perotti Capital Holdings LLC',
      documentType: 'Notice',
      confidenceScore: 99,
      taxYear: 2025,
      uploadDate: '2026-01-28',
      securityCheckStatus: 'Clean (SHA-256 Verified)',
      reviewStatus: 'Approved',
      issuer: 'South Carolina Department of Revenue',
      isDraft: false,
      summary: {
        extractedFields: [
          { label: 'Notice Code', value: 'SC-PTE-2025-ACT61' },
          { label: 'Subject', value: 'Pass-Through Entity Elective Tax Acceptance' },
          { label: 'Status', value: 'Approved for Tax Year 2025' }
        ],
        detectedIssues: [],
        confidenceNote: 'Confirmed valid South Carolina elective PTE election on file.'
      },
      questions: []
    }
  ];

  public getDocuments(clientId: string): ClientDocumentItem[] {
    return this.documents;
  }

  public getDocumentById(id: string): ClientDocumentItem | undefined {
    return this.documents.find(d => d.id === id);
  }

  public uploadDocument(clientId: string, file: File): ClientDocumentItem {
    const ext = file.name.split('.').pop()?.toUpperCase() || 'PDF';
    let docType = 'Receipt';
    if (file.name.toLowerCase().includes('w2')) docType = 'W-2';
    else if (file.name.toLowerCase().includes('1099')) docType = '1099';
    else if (file.name.toLowerCase().includes('k1') || file.name.toLowerCase().includes('k-1')) docType = 'K-1';
    else if (file.name.toLowerCase().includes('bank') || file.name.toLowerCase().includes('stmt')) docType = 'Bank';
    else if (file.name.toLowerCase().includes('notice') || file.name.toLowerCase().includes('cp')) docType = 'Notice';

    const newDoc: ClientDocumentItem = {
      id: `doc_${Date.now()}`,
      fileName: file.name,
      fileSize: `${Math.round(file.size / 1024) || 350} KB`,
      entityName: 'Perotti Capital Holdings LLC',
      documentType: docType,
      confidenceScore: 92,
      taxYear: 2025,
      uploadDate: new Date().toISOString().split('T')[0],
      securityCheckStatus: 'Clean (SHA-256 Verified)',
      reviewStatus: 'Pending Review',
      issuer: 'Client Upload',
      isDraft: true,
      summary: {
        extractedFields: [
          { label: 'Ingestion Format', value: ext },
          { label: 'Verification Protocol', value: 'Edge Anti-Malware Passed' },
          { label: 'OCR Status', value: 'Text Layer Normalized' }
        ],
        detectedIssues: [],
        confidenceNote: 'Uploaded document queued for automated optical indexing and CPA confirmation.'
      },
      questions: []
    };

    this.documents.unshift(newDoc);
    return newDoc;
  }

  public removeDraftDocument(id: string): { success: boolean; error?: string } {
    const idx = this.documents.findIndex(d => d.id === id);
    if (idx === -1) return { success: false, error: 'Document not found.' };
    if (!this.documents[idx].isDraft) {
      return { success: false, error: 'Approved documents cannot be removed. Contact your CPA.' };
    }
    this.documents.splice(idx, 1);
    return { success: true };
  }

  public proposeClassificationCorrection(id: string, proposedType: string, author: string): void {
    const doc = this.documents.find(d => d.id === id);
    if (doc) {
      doc.documentType = proposedType;
      doc.reviewStatus = 'Pending Review';
      doc.proposedCorrection = proposedType;
    }
  }

  public addDocumentQuestion(id: string, question: string, author: string): void {
    const doc = this.documents.find(d => d.id === id);
    if (doc) {
      if (!doc.questions) doc.questions = [];
      doc.questions.push({
        id: `q_${Date.now()}`,
        author,
        question,
        date: new Date().toISOString().split('T')[0]
      });
    }
  }
}

/**
 * 3. Tax Organizer Service
 */
export class DemoOrganizerService implements IOrganizerService {
  private organizerState: ClientOrganizerState = {
    taxYear: 2025,
    status: 'In Progress',
    completionPercentage: 75,
    activeSectionId: 1,
    sections: [
      { id: 1, title: 'Corporate Profile & Principal Activity', shortTitle: 'Entity Profile', status: 'completed', description: 'General legal corporate entity structure, statutory identification, and state of incorporation.', isCompleted: true, data: { legalName: 'Perotti Capital Holdings LLC', ein: 'XX-XXX4192', naicsCode: '531110', principalActivity: 'Lessors of Real Estate & Financial Asset Management', incorporationState: 'South Carolina', sElectionEffectiveDate: '2021-01-01' } },
      { id: 2, title: 'Shareholders & Stock Ownership', shortTitle: 'Shareholders', status: 'completed', description: 'Schedule K-1 shareholder census, capital contributions, and ownership percentages.', isCompleted: true, data: { totalShares: 1000, shareholderName: 'Michael Perotti', ownershipPercentage: 100, ssnLastFour: '6821', address: '124 Charleston Way, Charleston, SC 29401' } },
      { id: 3, title: 'Officer Compensation & Payroll', shortTitle: 'Officer Payroll', status: 'completed', description: 'Officer salaries, W-2 payroll filings, and RCReports reasonable compensation benchmark checks.', isCompleted: true, data: { officerSalaryPaid: 120000, compensationMethod: 'W-2 through ADP', reasonableCompStudyPerformed: true } },
      { id: 4, title: 'Accounting Method & Books', shortTitle: 'Accounting Method', status: 'completed', description: 'Cash vs. Accrual tax accounting method and general ledger software integration.', isCompleted: true, data: { accountingMethod: 'Accrual', softwareUsed: 'QuickBooks Online Accountant', inventoryMaintained: false } },
      { id: 5, title: 'Revenue & Gross Receipts', shortTitle: 'Revenues', status: 'completed', description: 'Gross sales, 1099-NEC/1099-K reconciliations, and allowances.', isCompleted: true, data: { gross1099KReceived: 0, grossTradeReceipts: 742500, salesReturnsAndAllowances: 0 } },
      { id: 6, title: 'Cost of Goods Sold (COGS)', shortTitle: 'COGS', status: 'completed', description: 'Direct labor, materials, and inventory cost allocations.', isCompleted: true, data: { hasInventory: false, laborCostDirect: 0, materialsCost: 0 } },
      { id: 7, title: 'Ordinary Business Deductions', shortTitle: 'Operating Expenses', status: 'completed', description: 'Office lease, utilities, professional fees, insurance, and telecommunications.', isCompleted: true, data: { officeRent: 36000, professionalLegalFees: 14500, utilities: 4800, businessInsurance: 8900 } },
      { id: 8, title: 'Depreciation & Section 179 Assets', shortTitle: 'Fixed Assets', status: 'completed', description: 'Machinery, computer hardware, and bonus depreciation elections.', isCompleted: true, data: { placedInService2025: 'Mac Studio Server, Office Conference Furniture', totalNewAssetCost: 18500, electSection179: true } },
      { id: 9, title: 'Digital Assets & Virtual Currencies', shortTitle: 'Crypto & Digital', status: 'completed', description: 'Statutory IRS Form 1040/1120-S digital asset mandatory questions.', isCompleted: true, data: { engagedInCryptoTransactions: false, receivedRewardsOrStaking: false } },
      { id: 10, title: 'Vehicles & Standard Mileage vs. Actual', shortTitle: 'Vehicles', status: 'completed', description: 'Business mileage logs, automobile lease payments, and fuel deductions.', isCompleted: true, data: { totalBusinessMiles: 14200, totalPersonalMiles: 3100, vehicleModel: '2023 Tesla Model Y', writtenLogMaintained: true } },
      { id: 11, title: 'Business Meals & Entertainment', shortTitle: 'Meals', status: 'completed', description: 'Statutory 50% limitation compliance under IRC § 274(n).', isCompleted: true, data: { mealsSubjectTo50Percent: 6420, entertainmentCostZeroDeductible: 0 } },
      { id: 12, title: 'Health Insurance & Retirement Plans', shortTitle: 'Benefits', status: 'completed', description: 'Greater than 2% shareholder health insurance additions and pension deferrals.', isCompleted: true, data: { shareholderHealthPremiumsPaid: 12800, sepIraContribution: 25000 } },
      { id: 13, title: 'Related Party Loans & Distributions', shortTitle: 'Loans & Equity', status: 'completed', description: 'Shareholder distributions and promissory note verifications.', isCompleted: true, data: { shareholderDistributionsTotal: 145000, loansToOrFromShareholders: 0 } },
      { id: 14, title: 'State Tax Nexus & Apportionment', shortTitle: 'State Nexus', status: 'completed', description: 'Multi-state physical and economic nexus apportionment schedules.', isCompleted: true, data: { statesWithPropertyOrPayroll: 'South Carolina (100%)', multiStateApportionmentNeeded: false } },
      { id: 15, title: 'Pass-Through Entity Tax (SC Act 61)', shortTitle: 'PTE Election', status: 'completed', description: 'South Carolina Act 61 SALT workaround election status.', isCompleted: true, data: { electSouthCarolinaPTE: true, estimatedPteBenefit: 12800 } },
      { id: 16, title: 'Charitable Contributions', shortTitle: 'Charity', status: 'pending', description: 'Direct corporate charitable contributions and Schedule K flow-through items.', isCompleted: false, data: { corporateCharitableGifts: 5000, writtenReceiptsOver250Kept: true } },
      { id: 17, title: 'Foreign Accounts (FBAR & Form 8938)', shortTitle: 'Foreign Accounts', status: 'pending', description: 'FinCEN Form 114 reporting obligations for foreign bank holdings.', isCompleted: false, data: { foreignFinancialAccountsAggregateOver10k: false } },
      { id: 18, title: 'Estimated Quarterly Tax Payments Made', shortTitle: 'Estimates', status: 'pending', description: 'Federal and South Carolina quarterly EFTPS/SC MyDORWAY vouchers.', isCompleted: false, data: { q1FederalPaid: 12500, q2FederalPaid: 12500, q3FederalPaid: 12500, q4FederalPaid: 12500 } },
      { id: 19, title: 'Prior Year Carryforwards & Credits', shortTitle: 'Carryforwards', status: 'pending', description: 'Net operating loss and general business credit carryforwards.', isCompleted: false, data: { priorNOLAvailable: 0, rAndDCreditsClaimed: 0 } },
      { id: 20, title: 'Corporate Governance & Minutes', shortTitle: 'Governance', status: 'pending', description: 'Annual corporate resolutions and shareholder meeting minutes.', isCompleted: false, data: { annualShareholderMinutesDrafted: true, bylawsCurrent: true } },
      { id: 21, title: 'Client Declaration & Filing Authorization', shortTitle: 'Final Declaration', status: 'pending', description: 'Final intake declaration and authorization for preparer processing.', isCompleted: false, data: { taxpayerReviewedIntake: true, electronicSignatureAuthorized: false } }
    ]
  };

  public getOrganizer(clientId: string): ClientOrganizerState {
    return this.organizerState;
  }

  public updateField(clientId: string, sectionId: number, key: string, value: any): ClientOrganizerState {
    const section = this.organizerState.sections.find(s => s.id === sectionId);
    if (section) {
      section.data[key] = value;
      section.status = 'completed';
      section.isCompleted = true;
    }
    const completedCount = this.organizerState.sections.filter(s => s.status === 'completed').length;
    this.organizerState.completionPercentage = Math.round((completedCount / this.organizerState.sections.length) * 100);
    return { ...this.organizerState };
  }

  public saveDraft(clientId: string, sectionId: number): void {
    this.organizerState.activeSectionId = sectionId;
  }

  public submitOrganizer(clientId: string): { success: boolean; error?: string } {
    this.organizerState.status = 'Submitted';
    this.organizerState.completionPercentage = 100;
    this.organizerState.sections.forEach(s => {
      s.status = 'completed';
      s.isCompleted = true;
    });
    return { success: true };
  }

  public reopenOrganizer(clientId: string): { success: boolean; error?: string } {
    this.organizerState.status = 'In Progress';
    return { success: true };
  }
}

/**
 * 4. Income & Expense Service
 */
export class DemoIncomeExpenseService implements IIncomeExpenseService {
  private incomeRecords: ClientIncomeRecord[] = [
    { id: 'inc_1', date: '2025-01-15', payer: 'Broad Street Commercial Tenants', incomeType: 'Business revenue', entityName: 'Perotti Capital Holdings LLC', amount: 62500, withholding: 0, description: 'Commercial base lease rent - Q1', taxYear: 2025, status: 'Reviewed' },
    { id: 'inc_2', date: '2025-04-15', payer: 'Broad Street Commercial Tenants', incomeType: 'Business revenue', entityName: 'Perotti Capital Holdings LLC', amount: 62500, withholding: 0, description: 'Commercial base lease rent - Q2', taxYear: 2025, status: 'Reviewed' },
    { id: 'inc_3', date: '2025-07-15', payer: 'Broad Street Commercial Tenants', incomeType: 'Business revenue', entityName: 'Perotti Capital Holdings LLC', amount: 62500, withholding: 0, description: 'Commercial base lease rent - Q3', taxYear: 2025, status: 'Reviewed' },
    { id: 'inc_4', date: '2025-10-15', payer: 'Broad Street Commercial Tenants', incomeType: 'Business revenue', entityName: 'Perotti Capital Holdings LLC', amount: 62500, withholding: 0, description: 'Commercial base lease rent - Q4', taxYear: 2025, status: 'Reviewed' },
    { id: 'inc_5', date: '2025-11-20', payer: 'Palmetto Advisory Partners', incomeType: 'Business revenue', entityName: 'Perotti Capital Holdings LLC', amount: 492500, withholding: 0, description: 'Corporate portfolio management & advisory fees', taxYear: 2025, status: 'Reviewed' }
  ];

  private expenseRecords: ClientExpenseRecord[] = [
    { id: 'exp_1', date: '2025-01-10', vendor: 'South Carolina Commercial Realty', category: 'Rent', amount: 36000, entityName: 'Perotti Capital Holdings LLC', businessPurpose: 'Executive headquarters lease - Annual', paymentMethod: 'ACH Wire', taxYear: 2025, status: 'Reviewed' },
    { id: 'exp_2', date: '2025-02-14', vendor: 'Charleston Legal Counsel LLC', category: 'Legal and professional', amount: 14500, entityName: 'Perotti Capital Holdings LLC', businessPurpose: 'Operating agreement & contract review', paymentMethod: 'Corporate Check', taxYear: 2025, status: 'Reviewed' },
    { id: 'exp_3', date: '2025-03-22', vendor: 'Apex Tech Solutions', category: 'Office expense', amount: 4800, entityName: 'Perotti Capital Holdings LLC', businessPurpose: 'Cloud infrastructure & cybersecurity suite', paymentMethod: 'Credit Card', taxYear: 2025, status: 'Reviewed', aiConfidence: 98, aiExplanation: 'Standard trade and business operating supply.' },
    { id: 'exp_4', date: '2025-05-18', vendor: 'Palmetto Mutual Insurance', category: 'Insurance', amount: 8900, entityName: 'Perotti Capital Holdings LLC', businessPurpose: 'Commercial general liability & D&O policy', paymentMethod: 'ACH Wire', taxYear: 2025, status: 'Reviewed' },
    { id: 'exp_5', date: '2025-08-11', vendor: 'Apple Store Charleston', category: 'Supplies', amount: 3850, entityName: 'Perotti Capital Holdings LLC', businessPurpose: 'Hardware upgrade for financial modeling', paymentMethod: 'Credit Card', taxYear: 2025, status: 'Reviewed' },
    { id: 'exp_6', date: '2025-10-04', vendor: 'Delta Air Lines & Marriot', category: 'Travel', amount: 5240, entityName: 'Perotti Capital Holdings LLC', businessPurpose: 'Commercial asset acquisition due diligence trip', paymentMethod: 'Credit Card', taxYear: 2025, status: 'Reviewed' }
  ];

  public getIncome(clientId: string): ClientIncomeRecord[] {
    return this.incomeRecords;
  }

  public getExpenses(clientId: string): ClientExpenseRecord[] {
    return this.expenseRecords;
  }

  public getIncomeRecords(clientId: string): ClientIncomeRecord[] {
    return this.incomeRecords;
  }

  public getExpenseRecords(clientId: string): ClientExpenseRecord[] {
    return this.expenseRecords;
  }

  public addIncome(clientId: string, record: Omit<ClientIncomeRecord, 'id'>): ClientIncomeRecord {
    const newRecord: ClientIncomeRecord = {
      ...record,
      id: `inc_${Date.now()}`
    };
    this.incomeRecords.unshift(newRecord);
    return newRecord;
  }

  public addExpense(clientId: string, record: Omit<ClientExpenseRecord, 'id'>): ClientExpenseRecord {
    const newRecord: ClientExpenseRecord = {
      ...record,
      id: `exp_${Date.now()}`
    };
    this.expenseRecords.unshift(newRecord);
    return newRecord;
  }

  public addIncomeRecord(clientId: string, record: Omit<ClientIncomeRecord, 'id'>): ClientIncomeRecord {
    return this.addIncome(clientId, record);
  }

  public addExpenseRecord(clientId: string, record: Omit<ClientExpenseRecord, 'id'>): ClientExpenseRecord {
    return this.addExpense(clientId, record);
  }

  public deleteIncome(id: string): boolean {
    const idx = this.incomeRecords.findIndex(i => i.id === id);
    if (idx !== -1) {
      this.incomeRecords.splice(idx, 1);
      return true;
    }
    return false;
  }

  public deleteExpense(id: string): boolean {
    const idx = this.expenseRecords.findIndex(e => e.id === id);
    if (idx !== -1) {
      this.expenseRecords.splice(idx, 1);
      return true;
    }
    return false;
  }

  public deleteIncomeRecord(id: string): boolean {
    return this.deleteIncome(id);
  }

  public deleteExpenseRecord(id: string): boolean {
    return this.deleteExpense(id);
  }

  public getCategoryRecommendation(vendor: string, amount: number, purpose: string): {
    category: string;
    confidence: number;
    explanation: string;
  } {
    const lower = `${vendor} ${purpose}`.toLowerCase();
    if (lower.includes('law') || lower.includes('legal') || lower.includes('cpa') || lower.includes('attorney')) {
      return { category: 'Legal and professional', confidence: 98, explanation: 'Matches professional and legal service vendor definitions under IRC § 162.' };
    }
    if (lower.includes('rent') || lower.includes('lease') || lower.includes('realty')) {
      return { category: 'Rent', confidence: 96, explanation: 'Matches commercial real property lease expenditure under Line 13.' };
    }
    if (lower.includes('fly') || lower.includes('hotel') || lower.includes('airline') || lower.includes('delta')) {
      return { category: 'Travel', confidence: 95, explanation: 'Qualifies as ordinary and necessary business travel away from tax home.' };
    }
    if (lower.includes('dinner') || lower.includes('lunch') || lower.includes('restaurant') || lower.includes('meal')) {
      return { category: 'Meals (50%)', confidence: 92, explanation: 'Subject to statutory 50% limitation under IRC § 274(n).' };
    }
    return { category: 'Office expense', confidence: 85, explanation: 'Categorized as general trade or business operating supply under IRC § 162.' };
  }
}

/**
 * 5. Return Review Service
 */
export class DemoReturnReviewService implements IReturnReviewService {
  private draftReturn: ClientDraftReturn = {
    id: 'ret_2025_1120s_perotti',
    entityName: 'Perotti Capital Holdings LLC',
    taxYear: 2025,
    version: '1.2 (Technical Review Certified)',
    status: 'Ready for Signature',
    preparer: 'David Vance, EA (A/R Tax Services)',
    certifiedBy: 'Elena Rostova, CPA (License #SC-28419)',
    grossReceipts: 742500,
    totalDeductions: 382450,
    ordinaryBusinessIncome: 360050,
    shareholderDistributions: 145000,
    stateTaxLiability: 12600,
    refundOrBalanceDue: 0,
    taxCredits: 0,
    estimatedPayments: 50000,
    refundAmount: 0,
    lines: [
      { line: 'Line 1a', lineNumber: 'Line 1a', description: 'Gross receipts or sales', amount: 742500, notes: 'Tie-out with customer bank deposits & invoicing' },
      { line: 'Line 2', lineNumber: 'Line 2', description: 'Cost of goods sold', amount: 0, notes: 'Service and holding entity — no inventory' },
      { line: 'Line 3', lineNumber: 'Line 3', description: 'Gross profit', amount: 742500 },
      { line: 'Line 7', lineNumber: 'Line 7', description: 'Compensation of officers', amount: 120000, notes: 'Supported by ADP W-2 filing and reasonable comp study' },
      { line: 'Line 8', lineNumber: 'Line 8', description: 'Salaries and wages', amount: 84000 },
      { line: 'Line 12', lineNumber: 'Line 12', description: 'Taxes and licenses', amount: 18450, notes: 'Includes SC PTE Act 61 elective tax payments' },
      { line: 'Line 13', lineNumber: 'Line 13', description: 'Interest expense', amount: 6200 },
      { line: 'Line 14', lineNumber: 'Line 14', description: 'Depreciation (Form 4562)', amount: 18500, notes: 'Section 179 expensing elected for technology upgrades' },
      { line: 'Line 16', lineNumber: 'Line 16', description: 'Rents', amount: 36000 },
      { line: 'Line 19', lineNumber: 'Line 19', description: 'Other deductions (statement attached)', amount: 99300, notes: 'Itemized Schedule: Legal $14.5k, Ins $8.9k, Travel $5.2k, Meals $3.2k, Office $67.5k' },
      { line: 'Line 20', lineNumber: 'Line 20', description: 'Total deductions', amount: 382450 },
      { line: 'Line 21', lineNumber: 'Line 21', description: 'Ordinary business income (loss)', amount: 360050, notes: 'Allocated 100% to Shareholder Michael Perotti on Schedule K-1' }
    ],
    lineItems: [
      { lineNumber: 'Line 1a', description: 'Gross receipts or sales', amount: 742500 },
      { lineNumber: 'Line 2', description: 'Cost of goods sold', amount: 0 },
      { lineNumber: 'Line 3', description: 'Gross profit', amount: 742500 },
      { lineNumber: 'Line 7', description: 'Compensation of officers', amount: 120000 },
      { lineNumber: 'Line 8', description: 'Salaries and wages', amount: 84000 },
      { lineNumber: 'Line 12', description: 'Taxes and licenses', amount: 18450 },
      { lineNumber: 'Line 13', description: 'Interest expense', amount: 6200 },
      { lineNumber: 'Line 14', description: 'Depreciation (Form 4562)', amount: 18500 },
      { lineNumber: 'Line 16', description: 'Rents', amount: 36000 },
      { lineNumber: 'Line 19', description: 'Other deductions (statement attached)', amount: 99300 },
      { lineNumber: 'Line 20', description: 'Total deductions', amount: 382450 },
      { lineNumber: 'Line 21', description: 'Ordinary business income (loss)', amount: 360050 }
    ],
    signatures: [
      { role: 'Paid Preparer', name: 'David Vance, EA', signedAt: '2026-02-18 10:14 EST', ipAddress: '10.0.4.12' },
      { role: 'Senior CPA Reviewer', name: 'Elena Rostova, CPA', signedAt: '2026-02-19 14:32 EST', ipAddress: '10.0.4.18' }
    ],
    questions: [
      { id: 'rq1', author: 'Elena Rostova, CPA', text: 'Section 179 expensing has been optimized to leave ordinary income at $360,050 to maximize your QBI deduction threshold.', date: '2026-02-19', response: 'Understood and approved.' }
    ],
    corrections: []
  };

  public getDraftReturn(clientId: string, taxYear?: number): ClientDraftReturn | undefined {
    return this.draftReturn;
  }

  public approveDraftReturn(returnId: string, signatoryName: string, ipAddress: string): { success: boolean; error?: string } {
    this.draftReturn.status = 'Signed & Ready to File';
    if (!this.draftReturn.signatures) this.draftReturn.signatures = [];
    this.draftReturn.signatures.push({
      role: 'Taxpayer / Corporate Officer (Form 8879-S)',
      name: signatoryName,
      signedAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' EST',
      ipAddress
    });
    return { success: true };
  }

  public requestCorrection(returnId: string, field: string, explanation: string, author: string): { success: boolean; error?: string } {
    this.draftReturn.status = 'Corrections Required';
    if (!this.draftReturn.corrections) this.draftReturn.corrections = [];
    this.draftReturn.corrections.push({
      id: `cor_${Date.now()}`,
      field,
      explanation,
      status: 'Open Review',
      requestedAt: new Date().toISOString().split('T')[0]
    });
    return { success: true };
  }

  public askQuestion(returnId: string, question: string, author: string): { success: boolean; error?: string } {
    if (!this.draftReturn.questions) this.draftReturn.questions = [];
    this.draftReturn.questions.push({
      id: `q_${Date.now()}`,
      author,
      text: question,
      date: new Date().toISOString().split('T')[0]
    });
    return { success: true };
  }
}
export const DemoReturnService = DemoReturnReviewService;

/**
 * 6. Invoices & Billing Service
 */
export class DemoInvoiceService implements IInvoiceService {
  private invoices: ClientInvoiceRecord[] = [
    {
      id: 'inv_2025_001',
      invoiceNumber: 'INV-2025-0842',
      serviceDescription: 'Annual Corporate Tax Compliance Retainer (Q1-Q4)',
      engagementTitle: '2025 Corporate & Multi-State Tax Compliance',
      issueDate: '2026-01-15',
      dueDate: '2026-02-15',
      taxYear: 2025,
      clientName: 'Perotti Capital Holdings LLC',
      subtotal: 4500,
      retainerApplied: 4500,
      balanceDue: 0,
      status: 'Paid (Simulated)',
      items: [
        { description: 'Corporate entity compliance retainer fee', amount: 4500 }
      ],
      paymentHistory: [
        { date: '2026-01-16', amount: 4500, method: 'Retainer Balance Draw', receiptId: 'RCP-89211' }
      ]
    },
    {
      id: 'inv_2025_002',
      invoiceNumber: 'INV-2026-0194',
      serviceDescription: '2025 Form 1120-S & SC1120S Preparation & CPA Technical Certification',
      engagementTitle: '2025 Corporate & Multi-State Tax Compliance',
      issueDate: '2026-02-19',
      dueDate: '2026-03-20',
      taxYear: 2025,
      clientName: 'Perotti Capital Holdings LLC',
      subtotal: 3250,
      retainerApplied: 1000,
      balanceDue: 2250,
      status: 'Issued',
      items: [
        { description: 'Federal Form 1120-S Corporate Return & K-1 Preparation', hours: 10, rate: 200, amount: 2000 },
        { description: 'South Carolina Form SC1120S & Act 61 PTE Election Filing', hours: 4, rate: 200, amount: 800 },
        { description: 'Senior CPA Quality Review & Technical Reviewer Sign-off', hours: 1.5, rate: 300, amount: 450 }
      ],
      paymentHistory: []
    }
  ];

  public getInvoices(clientId: string): ClientInvoiceRecord[] {
    return this.invoices;
  }

  public simulatePayment(invoiceId: string, amount: number, method: string): { success: boolean; receiptId?: string; error?: string } {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (!inv) return { success: false, error: 'Invoice not found.' };

    const receiptId = `RCP-SIM-${Math.floor(100000 + Math.random() * 900000)}`;
    inv.balanceDue = Math.max(0, inv.balanceDue - amount);
    if (inv.balanceDue === 0) {
      inv.status = 'Paid (Simulated)';
    }
    if (!inv.paymentHistory) inv.paymentHistory = [];
    inv.paymentHistory.push({
      date: new Date().toISOString().split('T')[0],
      amount,
      method,
      receiptId
    });

    return { success: true, receiptId };
  }

  public disputeInvoice(invoiceId: string, reason: string, author: string): void {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (inv) {
      inv.status = 'Disputed';
    }
  }

  public requestPaymentPlan(invoiceId: string, installments: number, author: string): void {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (inv) {
      inv.status = `Payment Plan (${installments}x)`;
    }
  }
}

/**
 * 7. Tax Notices Service
 */
export class DemoNoticeService implements INoticeService {
  private notices: ClientNoticeRecord[] = [
    {
      id: 'ntc_irs_cp2000_sample',
      authority: 'Internal Revenue Service (IRS)',
      noticeNumber: 'CP2000',
      noticeTitle: 'Proposed Information Return Discrepancy (Tax Year 2024)',
      taxYear: 2024,
      receivedDate: '2025-11-10',
      responseDeadline: '2025-12-15',
      amountRequested: 0,
      status: 'Resolved by CPA (No Tax Due)',
      daysRemaining: 0,
      assignedCpa: 'Elena Rostova, CPA',
      aiSummary: 'IRS proposed tax adjustment based on 1099-B cost basis mismatch. Elena Rostova submitted Form 8821 response with certified broker schedule. IRS issued complete closure letter confirming $0 balance.',
      messages: [
        { id: 'm1', author: 'Elena Rostova, CPA', text: 'Rebuttal package filed with Brookhaven Campus on Nov 18. Agency accepted full basis reconciliation.', date: '2025-11-18' }
      ]
    },
    {
      id: 'ntc_sc_act61_confirmation',
      authority: 'South Carolina Department of Revenue',
      noticeNumber: 'SC-L-2025',
      noticeTitle: 'Notice of Pass-Through Entity Tax Election Acceptance',
      taxYear: 2025,
      receivedDate: '2026-01-28',
      responseDeadline: '2026-04-15',
      amountRequested: 0,
      status: 'Informational Only',
      daysRemaining: 28,
      assignedCpa: 'Elena Rostova, CPA',
      aiSummary: 'Confirmation of active elective PTE status under SC Act 61. Entity authorized to remit tax at corporate level.',
      messages: []
    }
  ];

  public getNotices(clientId: string): ClientNoticeRecord[] {
    return this.notices;
  }

  public uploadNotice(clientId: string, notice: Partial<ClientNoticeRecord>): ClientNoticeRecord {
    const newNotice: ClientNoticeRecord = {
      id: `ntc_${Date.now()}`,
      authority: notice.authority || 'Internal Revenue Service (IRS)',
      noticeNumber: notice.noticeNumber || 'Notice',
      noticeTitle: notice.noticeTitle || 'Tax Authority Notice',
      taxYear: notice.taxYear || 2025,
      receivedDate: notice.receivedDate || new Date().toISOString().split('T')[0],
      responseDeadline: notice.responseDeadline || '2026-04-15',
      amountRequested: notice.amountRequested || 0,
      status: 'Under CPA Review',
      assignedCpa: notice.assignedCpa || 'Elena Rostova, CPA',
      aiSummary: notice.aiSummary || 'Document uploaded and logged into defense workflow. CPA assigned to analyze statutory deadlines.',
      messages: [
        { id: 'm_init', author: 'TaxGuard System', text: 'Notice safely archived in encrypted vault. Response calendar locked.', date: new Date().toISOString().split('T')[0] }
      ]
    };
    this.notices.unshift(newNotice);
    return newNotice;
  }

  public addNoticeMessage(noticeId: string, text: string, author: string): void {
    const notice = this.notices.find(n => n.id === noticeId);
    if (notice) {
      if (!notice.messages) notice.messages = [];
      notice.messages.push({
        id: `msg_${Date.now()}`,
        author,
        text,
        date: new Date().toISOString().split('T')[0]
      });
    }
  }

  public addNoticeComment(noticeId: string, text: string, author: string): void {
    this.addNoticeMessage(noticeId, text, author);
  }

  public approveNoticeResponse(noticeId: string, author: string): void {
    const notice = this.notices.find(n => n.id === noticeId);
    if (notice) {
      notice.status = 'Approved by Client — Submitted to Agency';
    }
  }

  public requestPoa(clientId: string): void {
    // Simulated power of attorney generation
  }
}

/**
 * 8. Advisory & Strategy Service
 */
export class DemoAdvisoryService implements IAdvisoryService {
  private plan: ClientAdvisoryPlan = {
    clientId: 'cli_perotti',
    entityName: 'Perotti Capital Holdings LLC',
    taxYear: 2025,
    entityType: 'S-Corporation (South Carolina)',
    recommendations: [
      {
        id: 'adv_pte_act61',
        title: 'South Carolina Act 61 Pass-Through Entity (PTE) Election',
        category: 'State Tax Arbitrage',
        annualEstimatedSavings: 12800,
        implementationEffort: 'Low (Handled in return filing)',
        statutoryBasis: 'S.C. Code Ann. § 12-6-545(G)',
        status: 'Active & Selected for 2025',
        description: 'Allows S-Corporation to pay SC state income taxes at the entity level, fully bypassing the individual $10,000 SALT deduction cap on federal Form 1040.'
      },
      {
        id: 'adv_reasonable_comp',
        title: 'Officer Reasonable Compensation Optimization',
        category: 'Payroll & FICA Tax',
        annualEstimatedSavings: 14200,
        implementationEffort: 'Medium (Requires payroll adjustment)',
        statutoryBasis: 'Rev. Rul. 74-44 & IRC § 3121',
        status: 'Implemented',
        description: 'Aligning officer salary to $120,000 while distributing remaining $145,000 profit as corporate dividend distributions, eliminating 15.3% self-employment tax on dividend portions.'
      },
      {
        id: 'adv_defined_benefit',
        title: 'Cash Balance Defined Benefit Pension Integration',
        category: 'Retirement & Wealth Shelter',
        annualEstimatedSavings: 28500,
        implementationEffort: 'High (Actuarial plan design)',
        statutoryBasis: 'IRC § 401(a)(2) & IRC § 415',
        status: 'Proposed for Tax Year 2026',
        description: 'Pairing existing 401(k) with a cash balance plan to enable pre-tax contributions up to $150,000 annually, shielding top-bracket personal income.'
      }
    ],
    scenarios: [
      {
        title: 'Status Quo (No Additional Tax Planning)',
        description: 'Standard S-Corp filing without proactive pass-through optimization or retirement sheltering.',
        estimatedTaxLiability: 98450,
        projectedSavings: 0
      },
      {
        title: 'Recommended Blueprint (SC Act 61 + S-Corp Distribution Split)',
        description: 'Enact SC Act 61 PTE workaround and benchmark officer compensation at $120,000 to maximize pass-through savings.',
        estimatedTaxLiability: 71450,
        projectedSavings: 27000
      },
      {
        title: 'Maximum Wealth Shield (Blueprint + Cash Balance Pension Plan)',
        description: 'Implement Defined Benefit Cash Balance Plan enabling up to $150,000 deductible pension deferrals for high-bracket shield.',
        estimatedTaxLiability: 42950,
        projectedSavings: 55500
      }
    ],
    quarterlyEstimates: [
      { quarter: 'Q1 (Due Apr 15, 2026)', dueDate: '2026-04-15', federalAmount: 18500, stateAmount: 3200, status: 'Upcoming' },
      { quarter: 'Q2 (Due Jun 15, 2026)', dueDate: '2026-06-15', federalAmount: 18500, stateAmount: 3200, status: 'Scheduled' },
      { quarter: 'Q3 (Due Sep 15, 2026)', dueDate: '2026-09-15', federalAmount: 18500, stateAmount: 3200, status: 'Scheduled' },
      { quarter: 'Q4 (Due Jan 15, 2027)', dueDate: '2027-01-15', federalAmount: 18500, stateAmount: 3200, status: 'Scheduled' }
    ]
  };

  public getAdvisoryPlan(clientId: string): ClientAdvisoryPlan {
    return this.plan;
  }

  public scheduleStrategyCall(clientId: string, preferredDate: string, topic: string): { success: boolean; confirmation: string } {
    return {
      success: true,
      confirmation: `Call scheduled for ${preferredDate} regarding ${topic}. Elena Rostova, CPA has received your invitation.`
    };
  }

  public requestConsultation(clientId: string, topic: string): void {
    // Consultation logged
  }
}
