/**
 * A/R Tax Services, LLC - Central Accountant Tax Preparation & Review Center Service
 * Stateful, reactive, auditable engine powering consolidated document processing,
 * workpapers, AI extractions, hard-stop gate validations, and demo filing records.
 */

import {
  TaxYearOption,
  ConsolidatedDocument,
  AiExceptionItem,
  MissingDocumentItem,
  PriorYearComparisonItem,
  IncomeWorkpaperItem,
  TaxPaymentItem,
  BusinessWorkpaperProfile,
  RentalPropertyProfile,
  InvestmentAccountProfile,
  DeductionCreditMatrixItem,
  PotentialFormMapping,
  ReturnTraceabilityRecord,
  PreFilingGate,
  DemoFilingRecord,
  ExceptionDisposition
} from '../types/accountantCenter';
import { demoDataStore } from './DemoDataService';
import { DemoRole } from '../types';
import {
  preFilingGateRegistryService,
  ClientProfileContext
} from './preFilingGateRegistryService';

export interface AccountantClientSummary {
  id: string;
  name: string;
  category: 'Simple Employee' | 'Business Owner' | 'Investor' | 'Rental Owner' | 'Complex Demo';
  entityType: string;
  ssnEinMasked: string;
  filingStatus: string;
  activeTaxYear: TaxYearOption;
  workflowStatus: string;
  assignedPreparer: string;
  assignedReviewer: string;
  hasForeignInfo: boolean;
  hasPriorYearReturn: boolean;
}

class AccountantCenterService {
  private selectedClientId: string = 'cli_complex_alex'; // Default to Complex Demo to showcase full engine
  private selectedTaxYear: TaxYearOption = 2025;
  private isDarkMode: boolean = false;
  private listeners: (() => void)[] = [];

  // Clients
  private clients: AccountantClientSummary[] = [
    {
      id: 'cli_complex_alex',
      name: 'Alexander Sterling',
      category: 'Complex Demo',
      entityType: 'Individual (Form 1040) & Single-Member LLC',
      ssnEinMasked: '•••-••-8841',
      filingStatus: 'Married Filing Jointly',
      activeTaxYear: 2025,
      workflowStatus: 'ACCOUNTANT REVIEW',
      assignedPreparer: 'Marcus Vance, EA',
      assignedReviewer: 'Elena Rostova, CPA',
      hasForeignInfo: true,
      hasPriorYearReturn: true
    },
    {
      id: 'cli_employee_john',
      name: 'John Smith',
      category: 'Simple Employee',
      entityType: 'Individual (Form 1040)',
      ssnEinMasked: '•••-••-1429',
      filingStatus: 'Single',
      activeTaxYear: 2025,
      workflowStatus: 'ACCOUNTANT REVIEW',
      assignedPreparer: 'Marcus Vance, EA',
      assignedReviewer: 'Elena Rostova, CPA',
      hasForeignInfo: false,
      hasPriorYearReturn: true
    },
    {
      id: 'cli_biz_sarah',
      name: 'Sarah Jenkins (Apex Dynamics)',
      category: 'Business Owner',
      entityType: 'S-Corporation (Form 1120-S) & Schedule C',
      ssnEinMasked: '••-•••9312',
      filingStatus: 'Head of Household',
      activeTaxYear: 2025,
      workflowStatus: 'READY FOR TAX PREPARATION',
      assignedPreparer: 'Marcus Vance, EA',
      assignedReviewer: 'Elena Rostova, CPA',
      hasForeignInfo: false,
      hasPriorYearReturn: true
    },
    {
      id: 'cli_investor_david',
      name: 'David Chen',
      category: 'Investor',
      entityType: 'Individual (Form 1040)',
      ssnEinMasked: '•••-••-5520',
      filingStatus: 'Single',
      activeTaxYear: 2025,
      workflowStatus: 'ACCOUNTANT REVIEW',
      assignedPreparer: 'Marcus Vance, EA',
      assignedReviewer: 'Elena Rostova, CPA',
      hasForeignInfo: false,
      hasPriorYearReturn: true
    },
    {
      id: 'cli_rental_emily',
      name: 'Emily Rodriguez',
      category: 'Rental Owner',
      entityType: 'Individual (Form 1040, Schedule E)',
      ssnEinMasked: '•••-••-7034',
      filingStatus: 'Married Filing Jointly',
      activeTaxYear: 2025,
      workflowStatus: 'MISSING DOCUMENTS',
      assignedPreparer: 'Marcus Vance, EA',
      assignedReviewer: 'Elena Rostova, CPA',
      hasForeignInfo: false,
      hasPriorYearReturn: true
    },
    {
      id: 'cli_summit',
      name: 'Summit Peak Holdings, LLC',
      category: 'Business Owner',
      entityType: 'S-Corporation (Form 1120-S)',
      ssnEinMasked: '••-•••4910',
      filingStatus: 'Corporate',
      activeTaxYear: 2025,
      workflowStatus: 'RETURN IN PREPARATION',
      assignedPreparer: 'Marcus Vance, EA',
      assignedReviewer: 'Elena Rostova, CPA',
      hasForeignInfo: false,
      hasPriorYearReturn: true
    },
    {
      id: 'cli_perotti',
      name: 'Michael Perotti (Palmetto Logistics)',
      category: 'Business Owner',
      entityType: 'S-Corporation (Form 1120-S)',
      ssnEinMasked: '••-•••8291',
      filingStatus: 'Corporate',
      activeTaxYear: 2025,
      workflowStatus: 'ACCOUNTANT REVIEW',
      assignedPreparer: 'Marcus Vance, EA',
      assignedReviewer: 'Elena Rostova, CPA',
      hasForeignInfo: false,
      hasPriorYearReturn: true
    }
  ];

  // Consolidated Document Repository
  private documents: ConsolidatedDocument[] = [];

  // AI Exceptions
  private exceptions: AiExceptionItem[] = [];

  // Missing Documents
  private missingDocuments: MissingDocumentItem[] = [];

  // Prior Year Comparisons
  private priorYearItems: PriorYearComparisonItem[] = [];

  // Income Workpaper
  private incomeItems: IncomeWorkpaperItem[] = [];

  // Tax Payments
  private paymentItems: TaxPaymentItem[] = [];

  // Business Profile
  private businessProfiles: BusinessWorkpaperProfile[] = [];

  // Rental Properties
  private rentalProperties: RentalPropertyProfile[] = [];

  // Investment Accounts
  private investmentAccounts: InvestmentAccountProfile[] = [];

  // Deductions & Credits Matrix
  private deductionCredits: DeductionCreditMatrixItem[] = [];

  // Potential Form Mappings
  private formMappings: PotentialFormMapping[] = [];

  // Return Traceability
  private traceabilityRecords: ReturnTraceabilityRecord[] = [];

  // Pre-Filing QC Checklist (17 stages)
  private qcChecklist: { id: string; stageNumber: number; title: string; checked: boolean; note?: string }[] = [];

  // Final Approval State
  private finalApproval: {
    clientReviewed: boolean;
    sourceWorkpapersReviewed: boolean;
    exceptionsReviewed: boolean;
    supportingDocReviewed: boolean;
    qcCompleted: boolean;
    firmProceduresReviewed: boolean;
    isApproved: boolean;
    approvedBy?: string;
    approvedAt?: string;
    approvalTimestamp?: string;
  } = {
    clientReviewed: false,
    sourceWorkpapersReviewed: false,
    exceptionsReviewed: false,
    supportingDocReviewed: false,
    qcCompleted: false,
    firmProceduresReviewed: false,
    isApproved: false
  };

  // Demo Filing Records
  private filingRecords: DemoFilingRecord[] = [];

  constructor() {
    // Load dark mode preference
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('artax_theme');
      if (storedTheme === 'dark') {
        this.isDarkMode = true;
      }
    }
    this.seedInitialData();
  }

  // --- Theme Toggle ---
  public getIsDarkMode(): boolean {
    return this.isDarkMode;
  }

  public toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('artax_theme', this.isDarkMode ? 'dark' : 'light');
    }
    this.notify();
  }

  // --- Client & Year Selection ---
  public getClients(): AccountantClientSummary[] {
    return this.clients;
  }

  public getSelectedClient(): AccountantClientSummary {
    return this.clients.find(c => c.id === this.selectedClientId) || this.clients[0];
  }

  public setSelectedClient(id: string): void {
    this.selectedClientId = id;
    this.notify();
  }

  public getSelectedTaxYear(): TaxYearOption {
    return this.selectedTaxYear;
  }

  public setSelectedTaxYear(year: TaxYearOption): void {
    this.selectedTaxYear = year;
    this.notify();
  }

  // --- Key Metrics Calculation ---
  public getDashboardMetrics() {
    const client = this.getSelectedClient();
    const docs = this.documents.filter(d => d.clientId === client.id && d.taxYear === this.selectedTaxYear);
    const expectedCount = client.category === 'Complex Demo' ? 52 : 24;
    const receivedCount = docs.length;
    const reviewedCount = docs.filter(d => d.reviewStatus === 'Approved').length;
    const pendingReviewCount = docs.filter(d => d.reviewStatus !== 'Approved' && d.reviewStatus !== 'Rejected').length;
    
    const clientExceptions = this.exceptions.filter(e => e.clientId === client.id && e.taxYear === this.selectedTaxYear && e.disposition === 'OPEN');
    const duplicateCount = docs.filter(d => d.duplicateStatus === 'Duplicate' || d.duplicateStatus === 'Possible Duplicate').length;
    const mismatchCount = docs.filter(d => d.taxYearMatchStatus !== 'Matched').length;
    const lowConfidenceCount = docs.filter(d => d.aiConfidence < 75).length;
    const clientMissing = this.missingDocuments.filter(m => m.clientId === client.id && m.taxYear === this.selectedTaxYear && m.accountantStatus !== 'Resolved').length;

    return {
      documentsReceived: receivedCount,
      documentsExpected: expectedCount,
      documentsMissing: clientMissing,
      documentsReviewed: reviewedCount,
      documentsPendingReview: pendingReviewCount,
      aiExceptions: clientExceptions.length,
      duplicates: duplicateCount,
      taxYearMismatches: mismatchCount,
      lowConfidenceDocuments: lowConfidenceCount,
      clientQuestions: 3
    };
  }

  // --- Consolidated Documents Methods ---
  public getDocuments(clientId?: string, taxYear?: TaxYearOption): ConsolidatedDocument[] {
    const targetClient = clientId || this.selectedClientId;
    const targetYear = taxYear || this.selectedTaxYear;
    return this.documents.filter(d => d.clientId === targetClient && d.taxYear === targetYear);
  }

  public getDocumentById(id: string): ConsolidatedDocument | undefined {
    return this.documents.find(d => d.id === id);
  }

  public approveDocument(docId: string, reviewerName: string = 'Marcus Vance, EA'): void {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    doc.reviewStatus = 'Approved';
    doc.lastReviewed = new Date().toISOString();
    doc.reviewer = reviewerName;

    // Log audit
    demoDataStore.logAudit({
      user: reviewerName,
      role: 'accountant',
      action: 'Document Approved',
      record: `Doc ID: ${doc.id} (${doc.documentType})`,
      result: 'Success (Simulated)',
      reason: `Accountant verified extraction fields against source page ${doc.pageNumber}`
    });

    this.notify();
  }

  public rejectDocument(docId: string, reason: string, reviewerName: string = 'Marcus Vance, EA'): void {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    doc.reviewStatus = 'Rejected';
    doc.lastReviewed = new Date().toISOString();
    doc.reviewer = reviewerName;
    doc.accountantNotes = `${doc.accountantNotes ? doc.accountantNotes + '\n' : ''}[REJECTED] ${reason}`;

    demoDataStore.logAudit({
      user: reviewerName,
      role: 'accountant',
      action: 'Document Rejected',
      record: `Doc ID: ${doc.id}`,
      result: 'Warning (Simulated)',
      reason
    });

    this.notify();
  }

  public reclassifyDocument(docId: string, newType: string, newForm: string, newCategory: any, reason: string): void {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    const oldType = doc.documentType;
    doc.documentType = newType;
    doc.formNumber = newForm;
    doc.category = newCategory;
    doc.reviewStatus = 'Accountant Review Required';
    doc.accountantNotes = `${doc.accountantNotes ? doc.accountantNotes + '\n' : ''}[RECLASSIFIED from ${oldType} to ${newType}] Reason: ${reason}`;

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Document Reclassified',
      record: `Doc ID: ${doc.id}`,
      result: 'Success (Simulated)',
      reason: `Changed from ${oldType} to ${newType}. Rationale: ${reason}`
    });

    this.notify();
  }

  public overrideExtractedField(docId: string, fieldLabel: string, verifiedValue: string | number, reason: string): void {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    const field = doc.extractedFields.find(f => f.label === fieldLabel);
    if (field) {
      field.verifiedValue = verifiedValue;
      field.isModified = true;
      field.modificationReason = reason;
      field.verifiedBy = 'Marcus Vance, EA';
      field.verifiedAt = new Date().toISOString();

      if (fieldLabel.includes('Box 1 Wages') || fieldLabel.includes('Gross Amount')) {
        doc.federalAmount = typeof verifiedValue === 'number' ? verifiedValue : parseFloat(verifiedValue) || doc.federalAmount;
      }
      if (fieldLabel.includes('Federal Withholding')) {
        doc.federalWithholding = typeof verifiedValue === 'number' ? verifiedValue : parseFloat(verifiedValue) || doc.federalWithholding;
      }
    }

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'AI Extraction Overridden',
      record: `Doc ID: ${doc.id} - ${fieldLabel}`,
      result: 'Success (Simulated)',
      reason: `Overrode to ${verifiedValue}. Note: ${reason}`
    });

    this.notify();
  }

  public markDuplicate(docId: string, isDuplicate: boolean): void {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    doc.duplicateStatus = isDuplicate ? 'Duplicate' : 'Not Duplicate';
    if (isDuplicate) {
      doc.qualityStatus = 'Duplicate';
    }

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Duplicate Flag Updated',
      record: `Doc ID: ${doc.id}`,
      result: 'Success (Simulated)',
      reason: isDuplicate ? 'Marked as duplicate document' : 'Cleared duplicate flag'
    });

    this.notify();
  }

  public requestReplacement(docId: string, reason: string): void {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    doc.reviewStatus = 'Needs Correction';
    doc.accountantNotes = `${doc.accountantNotes ? doc.accountantNotes + '\n' : ''}[REPLACEMENT REQUESTED] ${reason}`;

    // Add to missing document / request center
    this.missingDocuments.unshift({
      id: `req-${Date.now()}`,
      clientId: doc.clientId,
      taxYear: doc.taxYear,
      itemName: `Replacement for ${doc.documentType} (${doc.payerEmployer})`,
      formNumber: doc.formNumber,
      category: 'CLIENT FOLLOW-UP REQUIRED',
      priority: 'High',
      reason: `Original upload issue: ${reason}`,
      requestedDate: new Date().toISOString().split('T')[0],
      dueDate: '2026-03-31',
      clientStatus: 'Pending',
      accountantStatus: 'Requested',
      blockingHardStop: true
    });

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Requested Document Replacement',
      record: `Doc ID: ${doc.id}`,
      result: 'Success (Simulated)',
      reason
    });

    this.notify();
  }

  public updateDocumentNotes(docId: string, privateNotes: string, clientVisibleNotes?: string): void {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    doc.accountantNotes = privateNotes;
    if (clientVisibleNotes !== undefined) {
      doc.clientVisibleNotes = clientVisibleNotes;
    }

    this.notify();
  }

  // --- Exceptions Methods ---
  public getExceptions(clientId?: string, taxYear?: TaxYearOption): AiExceptionItem[] {
    const targetClient = clientId || this.selectedClientId;
    const targetYear = taxYear || this.selectedTaxYear;
    return this.exceptions.filter(e => e.clientId === targetClient && e.taxYear === targetYear);
  }

  public resolveException(id: string, disposition: ExceptionDisposition, note: string): void {
    const exc = this.exceptions.find(e => e.id === id);
    if (!exc) return;

    exc.disposition = disposition;
    exc.resolutionNote = note;
    exc.resolvedBy = 'Marcus Vance, EA';
    exc.resolvedAt = new Date().toISOString();

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'AI Exception Resolved',
      record: `Exception: ${exc.title} [${disposition}]`,
      result: 'Success (Simulated)',
      reason: note
    });

    this.notify();
  }

  // --- Missing Documents & Client Requests ---
  public getMissingDocuments(clientId?: string, taxYear?: TaxYearOption): MissingDocumentItem[] {
    const targetClient = clientId || this.selectedClientId;
    const targetYear = taxYear || this.selectedTaxYear;
    return this.missingDocuments.filter(m => m.clientId === targetClient && m.taxYear === targetYear);
  }

  public sendDocumentRequest(itemId: string, note: string, dueDate: string): void {
    const item = this.missingDocuments.find(m => m.id === itemId);
    if (!item) return;

    item.clientStatus = 'Pending';
    item.accountantStatus = 'Requested';
    item.requestedDate = new Date().toISOString().split('T')[0];
    item.dueDate = dueDate;
    item.notes = note;

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Sent Client Document Request',
      record: `Item: ${item.itemName}`,
      result: 'Success (Simulated)',
      reason: `Dispatched demo request. Due date: ${dueDate}`
    });

    this.notify();
  }

  public waiveMissingDocument(itemId: string, reason: string): void {
    const item = this.missingDocuments.find(m => m.id === itemId);
    if (!item) return;

    item.accountantStatus = 'Resolved';
    item.clientStatus = 'Waived';
    item.notes = `[WAIVED BY PREPARER] ${reason}`;
    item.blockingHardStop = false;

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Waived Missing Document',
      record: `Item: ${item.itemName}`,
      result: 'Success (Simulated)',
      reason
    });

    this.notify();
  }

  public requestMissingDocument(params: {
    documentTitle: string;
    category?: any;
    priority?: any;
    reasonIdentified: string;
    dueDate: string;
    clientMessage?: string;
  }): void {
    const client = this.getSelectedClient();
    this.missingDocuments.unshift({
      id: `req-${Date.now()}`,
      clientId: client.id,
      taxYear: this.selectedTaxYear,
      itemName: params.documentTitle,
      documentTitle: params.documentTitle,
      formNumber: '',
      category: params.category || 'CLIENT FOLLOW-UP REQUIRED',
      priority: params.priority || 'High',
      reason: params.reasonIdentified,
      reasonIdentified: params.reasonIdentified,
      requestedDate: new Date().toISOString().split('T')[0],
      dueDate: params.dueDate,
      clientStatus: 'Pending',
      accountantStatus: 'Requested',
      notes: params.clientMessage,
      blockingHardStop: true
    });

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Generated Missing Document Request',
      record: `Requested: ${params.documentTitle}`,
      result: 'Success (Simulated)',
      reason: params.reasonIdentified
    });

    this.notify();
  }

  // --- Prior-Year Comparison ---
  public getPriorYearComparisons(clientId?: string): PriorYearComparisonItem[] {
    const targetClient = clientId || this.selectedClientId;
    return this.priorYearItems.filter(p => p.clientId === targetClient);
  }

  public resolvePriorYearItem(id: string, status: 'VERIFIED & RECONCILED' | 'NOT APPLICABLE', notes: string): void {
    const item = this.priorYearItems.find(p => p.id === id);
    if (!item) return;

    item.accountantReviewStatus = status;
    item.accountantNotes = notes;
    item.requiresReview = false;

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Prior-Year Discrepancy Reconciled',
      record: item.itemLabel,
      result: 'Success (Simulated)',
      reason: notes
    });

    this.notify();
  }

  // --- Workpapers Data Access ---
  public getIncomeWorkpaper(clientId?: string, taxYear?: TaxYearOption): IncomeWorkpaperItem[] {
    const targetClient = clientId || this.selectedClientId;
    const targetYear = taxYear || this.selectedTaxYear;
    return this.incomeItems.filter(i => i.taxYear === targetYear);
  }

  public verifyIncomeItem(id: string, status: 'Verified' | 'Modified', notes?: string): void {
    const item = this.incomeItems.find(i => i.id === id);
    if (!item) return;

    item.verificationStatus = status;
    if (notes) item.notes = notes;

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Income Workpaper Item Verified',
      record: `${item.incomeType} - ${item.payerName}`,
      result: 'Success (Simulated)',
      reason: notes || 'Accountant sign-off'
    });

    this.notify();
  }

  public getPaymentReconciliation(clientId?: string, taxYear?: TaxYearOption): TaxPaymentItem[] {
    const targetYear = taxYear || this.selectedTaxYear;
    return this.paymentItems.filter(p => p.taxYear === targetYear);
  }

  public verifyPaymentItem(id: string, verified: boolean): void {
    const item = this.paymentItems.find(p => p.id === id);
    if (!item) return;

    item.accountantVerified = verified;
    this.notify();
  }

  public getBusinessProfile(clientId?: string): BusinessWorkpaperProfile | undefined {
    const targetClient = clientId || this.selectedClientId;
    return this.businessProfiles.find(b => b.clientId === targetClient);
  }

  public toggleBusinessChecklist(itemKey: string, status: 'Received' | 'Missing' | 'Not Applicable'): void {
    const profile = this.getBusinessProfile();
    if (!profile) return;

    const check = profile.completeness.find(c => c.itemKey === itemKey);
    if (check) {
      check.status = status;
      this.notify();
    }
  }

  public getRentalProperties(clientId?: string): RentalPropertyProfile[] {
    const targetClient = clientId || this.selectedClientId;
    return this.rentalProperties.filter(r => r.clientId === targetClient);
  }

  public getInvestmentAccounts(clientId?: string): InvestmentAccountProfile[] {
    const targetClient = clientId || this.selectedClientId;
    return this.investmentAccounts.filter(i => i.clientId === targetClient);
  }

  public getDeductionsCredits(clientId?: string): DeductionCreditMatrixItem[] {
    return this.deductionCredits;
  }

  public updateDeductionCredit(id: string, decision: any, status: any): void {
    const item = this.deductionCredits.find(d => d.id === id);
    if (!item) return;

    item.accountantDecision = decision;
    item.status = status;
    this.notify();
  }

  public getPotentialFormMappings(): PotentialFormMapping[] {
    return this.formMappings;
  }

  public updateFormMapping(id: string, decision: any): void {
    const item = this.formMappings.find(f => f.id === id);
    if (!item) return;

    item.accountantDecision = decision;
    this.notify();
  }

  public getTraceabilityRecords(): ReturnTraceabilityRecord[] {
    return this.traceabilityRecords;
  }

  // --- Quality Control & Hard-Stop Gates Engine ---
  public getQcChecklist() {
    return this.qcChecklist;
  }

  public toggleQcStage(stageId: string, checked: boolean): void {
    const stage = this.qcChecklist.find(s => s.id === stageId);
    if (!stage) return;

    stage.checked = checked;
    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Pre-Filing QC Stage Toggled',
      record: `Stage ${stage.stageNumber}: ${stage.title}`,
      result: 'Success (Simulated)',
      reason: checked ? 'Completed review check' : 'Unchecked milestone'
    });

    this.notify();
  }

  public getReviewChecklist() {
    return this.qcChecklist.slice(0, 8).map(q => ({
      id: q.id,
      itemNumber: q.stageNumber,
      category: 'Statutory Review',
      label: q.title,
      title: q.title,
      description: q.title,
      completed: q.checked,
      isCompleted: q.checked,
      completedBy: q.checked ? 'Marcus Vance, EA' : undefined,
      completedAt: q.checked ? '2026-02-18' : undefined,
      verifiedBy: q.checked ? 'Marcus Vance, EA' : undefined,
      verifiedTimestamp: q.checked ? '2026-02-18' : undefined
    }));
  }

  public getQcStages() {
    return this.qcChecklist.map(q => ({
      id: q.id,
      stageNumber: q.stageNumber,
      title: q.title,
      name: q.title,
      description: q.title,
      status: q.checked ? 'Completed' : 'Pending',
      completed: q.checked,
      isCompleted: q.checked,
      completedBy: q.checked ? 'Marcus Vance, EA' : undefined,
      completedAt: q.checked ? '2026-02-18' : undefined,
      requiresReviewerSignoff: q.stageNumber >= 15
    }));
  }

  public toggleChecklistItem(id: string, checked: boolean): void {
    this.toggleQcStage(id, checked);
  }

  public getPriorYearComparison(clientId?: string): PriorYearComparisonItem[] {
    return this.getPriorYearComparisons(clientId);
  }

  public reconcilePriorYearItem(id: string, notes?: string): void {
    this.resolvePriorYearItem(id, 'VERIFIED & RECONCILED', notes || 'Reconciled by accountant');
  }

  public evaluateHardStopGates(): { gates: PreFilingGate[]; canApproveForFiling: boolean; blockingReasons: string[] } {
    const client = this.getSelectedClient();
    
    // Calculate actual review/document item counts
    const pendingDocs = this.documents.filter(d => d.clientId === client.id && d.taxYear === this.selectedTaxYear && d.reviewStatus !== 'Approved' && d.reviewStatus !== 'Rejected');
    const blockingMissing = this.missingDocuments.filter(m => m.clientId === client.id && m.taxYear === this.selectedTaxYear && m.accountantStatus !== 'Resolved');
    const unverifiedIncome = this.incomeItems.filter(i => i.taxYear === this.selectedTaxYear && i.verificationStatus === 'Pending');
    const unverifiedPayments = this.paymentItems.filter(p => p.taxYear === this.selectedTaxYear && !p.accountantVerified);
    const foreignExceptions = this.exceptions.filter(e => e.clientId === client.id && e.category === 'Foreign Information Indicator' && e.disposition === 'OPEN');
    const openExceptions = this.exceptions.filter(e => e.clientId === client.id && e.taxYear === this.selectedTaxYear && e.disposition === 'OPEN');
    const openPrior = this.priorYearItems.filter(p => p.clientId === client.id && p.requiresReview);
    const uncheckedQc = this.qcChecklist.filter(q => !q.checked);

    const profile: ClientProfileContext = {
      clientId: client.id,
      clientName: client.name,
      entityType: client.entityType,
      taxYear: this.selectedTaxYear,
      filingStatus: client.filingStatus,
      jurisdictions: ['IRS (Federal)', 'South Carolina Department of Revenue (SC1040)'],
      identityVerified: true,
      preparer: client.assignedPreparer || 'Marcus Vance, EA',
      reviewer: client.assignedReviewer || 'Elena Rostova, CPA',
      hasForeignInfo: client.hasForeignInfo,
      returnVersion: preFilingGateRegistryService.getReturnVersion(client.id, this.selectedTaxYear)
    };

    const evalResult = preFilingGateRegistryService.evaluateGates(profile, {
      pendingDocsCount: pendingDocs.length,
      missingDocsCount: blockingMissing.length,
      unverifiedIncomeCount: unverifiedIncome.length,
      unverifiedPaymentsCount: unverifiedPayments.length,
      openExceptionsCount: openExceptions.length,
      foreignExceptionsCount: foreignExceptions.length,
      openPriorYearCount: openPrior.length,
      uncheckedQcCount: uncheckedQc.length,
      finalAccountantApprovalSigned: this.finalApproval.isApproved
    });

    return {
      gates: evalResult.gates,
      canApproveForFiling: evalResult.canApproveForFiling,
      blockingReasons: evalResult.blockingReasons
    };
  }

  // --- Final Accountant Approval Panel ---
  public getFinalApprovalState() {
    return this.finalApproval;
  }

  public updateFinalApprovalCheckboxes(key: keyof typeof this.finalApproval, value: boolean): void {
    if (key === 'isApproved' || key === 'approvedBy' || key === 'approvedAt') return;
    (this.finalApproval as any)[key] = value;
    this.notify();
  }

  public signFinalAccountantApproval(accountantName: string = 'Elena Rostova, CPA'): { success: boolean; message: string } {
    const client = this.getSelectedClient();

    // Section 7 MAKER-CHECKER ENFORCEMENT:
    // A preparer cannot independently review and release their own material work
    if (accountantName.trim().toLowerCase() === (client.assignedPreparer || '').trim().toLowerCase()) {
      demoDataStore.logAudit({
        user: accountantName,
        role: 'accountant' as DemoRole,
        action: 'Independent QC Review Sign-off Prohibited (Maker-Checker Conflict)',
        record: `Client: ${client.name} (TY${this.selectedTaxYear})`,
        result: 'Warning (Simulated)',
        reason: 'Preparer cannot independently act as quality-control reviewer for their own prepared return.'
      });
      return {
        success: false,
        message: `Maker-Checker Policy Violation: ${accountantName} is listed as the return Preparer. An independent reviewer (e.g. ${client.assignedReviewer || 'Elena Rostova, CPA'}) must conduct and sign the quality-control approval.`
      };
    }

    // Check if prerequisite gates are clear (Gates 1-5 for accountant review clearance)
    const { gates } = this.evaluateHardStopGates();
    const prereqFailures = gates.filter(g => (g.gateNumber || 1) <= 4 && !g.isCleared);

    if (prereqFailures.length > 0) {
      return {
        success: false,
        message: `Cannot approve for filing: ${prereqFailures[0].blockingReason || 'Prerequisite hard-stops remain unresolved.'}`
      };
    }

    // Verify all 6 checkboxes are checked
    if (!this.finalApproval.clientReviewed ||
        !this.finalApproval.sourceWorkpapersReviewed ||
        !this.finalApproval.exceptionsReviewed ||
        !this.finalApproval.supportingDocReviewed ||
        !this.finalApproval.qcCompleted ||
        !this.finalApproval.firmProceduresReviewed) {
      return {
        success: false,
        message: 'All 6 attestation checkboxes must be checked by the accountant prior to approval.'
      };
    }

    this.finalApproval.isApproved = true;
    this.finalApproval.approvedBy = accountantName;
    this.finalApproval.approvedAt = new Date().toISOString();
    this.finalApproval.approvalTimestamp = this.finalApproval.approvedAt;

    // Record Maker-Checker Log
    preFilingGateRegistryService.recordMakerChecker({
      id: `MC-APP-${Date.now()}`,
      maker: client.assignedPreparer || 'Marcus Vance, EA',
      checker: accountantName,
      role: 'Reviewer (CPA)',
      action: 'Independent Quality-Control Sign-off',
      decision: 'Approved',
      reason: '17-Stage QC Checklist, workpapers, source manifests, and return diagnostics verified.',
      beforeState: 'Awaiting Reviewer',
      afterState: 'Reviewer Approved',
      timestamp: new Date().toISOString(),
      returnVersion: preFilingGateRegistryService.getReturnVersion(client.id, this.selectedTaxYear),
      gateAffected: 'Gate 5 — Independent Quality-Control Review'
    });

    // Update client status
    client.workflowStatus = 'READY FOR FILING — DEMO';

    demoDataStore.logAudit({
      user: accountantName,
      role: 'accountant',
      action: 'Independent QC Approval Signed (Maker-Checker Verified)',
      record: `Client: ${client.name} (TY${this.selectedTaxYear})`,
      result: 'Success (Simulated)',
      reason: 'All prerequisite quality control gates cleared. Independent reviewer attestation certified.'
    });

    this.notify();
    return { success: true, message: 'Filing readiness certified. Independent QC review complete.' };
  }


  // --- Demo E-Filing Simulation ---
  public getFilingRecords(): DemoFilingRecord[] {
    return this.filingRecords;
  }

  public simulateEFiling(idempotencyKey?: string): { success: boolean; submissionId: string; message: string } {
    const client = this.getSelectedClient();
    const key = idempotencyKey || `SIM-${client.id}-${this.selectedTaxYear}-${Date.now()}`;

    // Execute through Authoritative Pre-Filing Gate Registry Service
    const simResult = preFilingGateRegistryService.runDemoFilingSimulation(
      client.id,
      this.selectedTaxYear,
      key,
      this.finalApproval.approvedBy || 'Elena Rostova, CPA'
    );

    if (!simResult.success) {
      return {
        success: false,
        submissionId: '',
        message: simResult.message
      };
    }

    // Sync state
    const simRecord = simResult.record!;
    this.filingRecords.unshift(simRecord as any);
    client.workflowStatus = simRecord.status as any;

    this.notify();
    return {
      success: true,
      submissionId: simRecord.submissionId,
      message: simResult.message
    };
  }

  // Alias for backward-compatibility with UI callers
  public simulateEfiling(idempotencyKey?: string) {
    return this.simulateEFiling(idempotencyKey);
  }

  public notifyMaterialChange(changeType: string, description: string, author: string = 'Marcus Vance, EA'): void {
    const client = this.getSelectedClient();
    preFilingGateRegistryService.notifyMaterialChange(
      client.id,
      this.selectedTaxYear,
      changeType,
      description,
      author
    );
    this.finalApproval.isApproved = false;
    client.workflowStatus = 'IN PREPARATION — DEMO';
    this.notify();
  }


  public simulateAcceptance(submissionId: string): void {
    const rec = this.filingRecords.find(r => r.submissionId === submissionId);
    if (!rec) return;

    rec.status = 'ACCEPTED — DEMO';
    rec.acceptanceDateTime = new Date().toISOString();

    const client = this.getSelectedClient();
    client.workflowStatus = 'ACCEPTED — DEMO';

    demoDataStore.logAudit({
      user: 'IRS Gateway (Simulated)',
      role: 'accountant',
      action: 'IRS Electronic Filing Acknowledgement Received',
      record: `Submission ID: ${submissionId}`,
      result: 'Success (Simulated)',
      reason: 'State & Federal Modernized e-File system returned Acceptance Acknowledgement Code 000.'
    });

    this.notify();
  }

  public simulateRejection(submissionId: string, reason: string = 'R0000-500-01 Form 1040 SSN / Name Control Mismatch'): void {
    const rec = this.filingRecords.find(r => r.submissionId === submissionId);
    if (!rec) return;

    rec.status = 'REJECTED — DEMO';
    rec.rejectionReason = reason;

    const client = this.getSelectedClient();
    client.workflowStatus = 'REJECTED — DEMO';

    demoDataStore.logAudit({
      user: 'IRS Gateway (Simulated)',
      role: 'accountant',
      action: 'IRS Electronic Filing Rejection Notice',
      record: `Submission ID: ${submissionId}`,
      result: 'Warning (Simulated)',
      reason
    });

    this.notify();
  }

  public simulateCorrection(submissionId: string): void {
    const rec = this.filingRecords.find(r => r.submissionId === submissionId);
    if (!rec) return;

    if (!rec.correctionHistory) rec.correctionHistory = [];
    rec.correctionHistory.push(`Corrected on ${new Date().toLocaleDateString()}: Name control verified against Social Security card.`);
    rec.status = 'CORRECTION REQUIRED';

    const client = this.getSelectedClient();
    client.workflowStatus = 'READY FOR FILING — DEMO';

    demoDataStore.logAudit({
      user: 'Marcus Vance, EA',
      role: 'accountant',
      action: 'Rejection Correction Applied',
      record: `Submission ID: ${submissionId}`,
      result: 'Success (Simulated)',
      reason: 'Corrected taxpayer name control. Ready for re-submission.'
    });

    this.notify();
  }

  // --- Convenience & Backward-Compatible Aliases ---
  public getAllClients(): AccountantClientSummary[] {
    return this.getClients();
  }

  public selectClient(id: string): void {
    this.setSelectedClient(id);
  }

  public selectTaxYear(year: number): void {
    this.setSelectedTaxYear(year as TaxYearOption);
  }

  public getAuditTrail() {
    return demoDataStore.getAuditLogs();
  }

  public resetDemoData(): void {
    this.seedInitialData();
    this.selectedClientId = 'cli_complex_alex';
    this.selectedTaxYear = 2025;
    this.notify();
  }

  public getFilingRecord(): DemoFilingRecord {
    if (this.filingRecords.length > 0) {
      return this.filingRecords[0];
    }
    const client = this.getSelectedClient();
    return {
      submissionId: `DEMO-${this.selectedTaxYear}-000101`,
      clientId: client.id,
      clientName: client.name,
      taxYear: this.selectedTaxYear,
      returnType: client.entityType.includes('S-Corp') ? 'Form 1120-S (S-Corporation)' : 'Form 1040 (Individual)',
      filingDateTime: '',
      filingMethod: 'Electronic Transmission (MEF XML Demo)',
      efileProvider: 'Demo E-File Service (Sandbox)',
      status: 'Ready for Filing — Demo' as any,
      accountantSigner: 'Marcus Vance, EA',
      authorizationRecordId: `AUTH-${Date.now()}`,
      mefTransmissionHash: 'SHA256:E9A0C381F08B98442',
      auditTrailId: 'AUDIT-FILING-PENDING'
    };
  }

  public commitFinalApproval(signer: string = 'Marcus Vance, EA'): void {
    this.finalApproval.clientReviewed = true;
    this.finalApproval.sourceWorkpapersReviewed = true;
    this.finalApproval.exceptionsReviewed = true;
    this.finalApproval.supportingDocReviewed = true;
    this.finalApproval.qcCompleted = true;
    this.finalApproval.firmProceduresReviewed = true;
    this.finalApproval.isApproved = true;
    this.finalApproval.approvedBy = signer;
    this.finalApproval.approvedAt = new Date().toISOString();
    this.finalApproval.approvalTimestamp = this.finalApproval.approvedAt;

    const client = this.getSelectedClient();
    client.workflowStatus = 'READY FOR FILING — DEMO';

    demoDataStore.logAudit({
      user: signer,
      role: 'accountant',
      action: 'Final Return Approval Signed',
      record: `Client: ${client.name} (TY${this.selectedTaxYear})`,
      result: 'Success (Simulated)',
      reason: 'All 6 attestations certified. Return unlocked for electronic submission.'
    });

    this.notify();
  }

  public updateFilingStatus(status: 'Accepted' | 'Rejected' | 'Resubmitted', reason?: string): void {
    const current = this.getFilingRecord();
    if (!current) return;

    if (status === 'Accepted') {
      this.simulateAcceptance(current.submissionId);
    } else if (status === 'Rejected') {
      this.simulateRejection(current.submissionId, reason || 'Simulated MeF validation reject');
    } else {
      this.simulateCorrection(current.submissionId);
    }
  }

  public getMasterPackageComponents() {
    const client = this.getSelectedClient();
    return [
      { id: 'pkg-1', sequenceNumber: 1, name: 'Return Transmittal Letter', type: 'Client Facing Transmittal', sourceRef: 'Firm Standard Letterhead', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-2', sequenceNumber: 2, name: 'Electronic Filing Authorization (Form 8879 / SC8879)', type: 'Statutory E-File Authorization', sourceRef: 'Form 8879 Signature Consent', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-3', sequenceNumber: 3, name: 'Form 1040 U.S. Individual Income Tax Return', type: 'Federal Primary Return', sourceRef: 'MeF Form 1040 Schema v2025.1', reviewer: 'Elena Rostova, CPA', status: 'Generated' },
      { id: 'pkg-4', sequenceNumber: 4, name: 'Schedule 1 (Additional Income and Adjustments)', type: 'Federal Schedule', sourceRef: 'Form 1040 Schedule 1', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-5', sequenceNumber: 5, name: 'Schedule 2 (Additional Taxes)', type: 'Federal Schedule', sourceRef: 'Form 1040 Schedule 2', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-6', sequenceNumber: 6, name: 'Schedule 3 (Additional Credits and Payments)', type: 'Federal Schedule', sourceRef: 'Form 1040 Schedule 3', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-7', sequenceNumber: 7, name: 'Schedule A (Itemized Deductions)', type: 'Federal Schedule', sourceRef: 'Mortgage / Real Estate Taxes', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-8', sequenceNumber: 8, name: 'Schedule B (Interest and Ordinary Dividends)', type: 'Federal Schedule', sourceRef: '1099-INT / 1099-DIV Workpapers', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-9', sequenceNumber: 9, name: 'Schedule C (Profit or Loss From Business)', type: 'Federal Business Schedule', sourceRef: 'Single-Member LLC P&L', reviewer: 'Elena Rostova, CPA', status: 'Generated' },
      { id: 'pkg-10', sequenceNumber: 10, name: 'Schedule D (Capital Gains and Losses)', type: 'Federal Schedule', sourceRef: '1099-B Brokerage Workpapers', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-11', sequenceNumber: 11, name: 'Schedule E (Supplemental Income and Loss — Rental)', type: 'Federal Rental Schedule', sourceRef: 'Property Income & Depreciation', reviewer: 'Elena Rostova, CPA', status: 'Generated' },
      { id: 'pkg-12', sequenceNumber: 12, name: 'Schedule SE (Self-Employment Tax)', type: 'Federal Schedule', sourceRef: 'Schedule C Net Profit SE Calculation', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-13', sequenceNumber: 13, name: 'Form 8938 (Statement of Specified Foreign Financial Assets)', type: 'International Reporting', sourceRef: 'Zürcher Kantonalbank Custody', reviewer: 'Elena Rostova, CPA', status: 'Generated' },
      { id: 'pkg-14', sequenceNumber: 14, name: 'FinCEN Form 114 (FBAR Foreign Bank and Financial Accounts)', type: 'Treasury / FinCEN Filing', sourceRef: 'BSA E-Filing System Dossier', reviewer: 'Elena Rostova, CPA', status: 'Generated' },
      { id: 'pkg-15', sequenceNumber: 15, name: 'Form 8995 (Qualified Business Income Deduction)', type: 'Federal Tax Calculation', sourceRef: 'Section 199A QBI Workpaper', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-16', sequenceNumber: 16, name: 'Form 4562 (Depreciation and Amortization)', type: 'Federal Depreciation', sourceRef: 'Fixed Asset MACRS Schedules', reviewer: 'Elena Rostova, CPA', status: 'Generated' },
      { id: 'pkg-17', sequenceNumber: 17, name: 'SC1040 South Carolina Individual Income Tax Return', type: 'State Income Tax Return', sourceRef: 'SC DOR Tax Engine v2025.1', reviewer: 'Marcus Vance, EA', status: 'Generated' },
      { id: 'pkg-18', sequenceNumber: 18, name: 'Consolidated Tax Workpaper Package', type: 'Firm Audit Lead Schedules', sourceRef: 'Cross-Footed Working Papers', reviewer: 'Elena Rostova, CPA', status: 'Generated' },
      { id: 'pkg-19', sequenceNumber: 19, name: 'ERO Transmission Log & Audit Trail Certificate', type: 'Electronic Filing Compliance', sourceRef: 'Section 33 Compliance Record', reviewer: 'Marcus Vance, EA', status: 'Generated' }
    ];
  }

  // --- Subscriptions ---
  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public notify(): void {
    this.listeners.forEach(l => l());
  }

  // --- Initial Seed Data ---
  private seedInitialData(): void {
    // Seed 17-Stage QC Checklist
    this.qcChecklist = [
      { id: 'qc-1', stageNumber: 1, title: 'Client & Identity Verification (SSN/EIN, Name Control, DOB, Driver License)', checked: true },
      { id: 'qc-2', stageNumber: 2, title: 'Tax Organizer & Intake Questionnaire Review', checked: true },
      { id: 'qc-3', stageNumber: 3, title: 'Income Reconciliation (W-2, 1099s, K-1s, SSA-1099)', checked: true },
      { id: 'qc-4', stageNumber: 4, title: 'Withholding & Tax Payments Reconciliation (Fed, State, Estimated)', checked: true },
      { id: 'qc-5', stageNumber: 5, title: 'Business Entity & Schedule C/1120-S Review', checked: true },
      { id: 'qc-6', stageNumber: 6, title: 'Rental Property & Schedule E Review', checked: true },
      { id: 'qc-7', stageNumber: 7, title: 'Investment Accounts & Capital Gains (1099-B, Wash Sales)', checked: true },
      { id: 'qc-8', stageNumber: 8, title: 'Itemized Deductions & Credits (Mortgage, Charity, Energy)', checked: true },
      { id: 'qc-9', stageNumber: 9, title: 'State & Local Tax Non-Conformity (SC Depreciation, Multi-State)', checked: true },
      { id: 'qc-10', stageNumber: 10, title: 'Foreign Information Review (FBAR, Form 8938, Foreign Accounts)', checked: true },
      { id: 'qc-11', stageNumber: 11, title: 'Prior-Year Comparison & Carryforward Reconciliation', checked: true },
      { id: 'qc-12', stageNumber: 12, title: 'AI Exception Clearance & False Positive Dispositions', checked: true },
      { id: 'qc-13', stageNumber: 13, title: 'Prepared Return Diagnostic Error Check', checked: true },
      { id: 'qc-14', stageNumber: 14, title: 'Draft Return Mathematical Cross-Foot Verification', checked: true },
      { id: 'qc-15', stageNumber: 15, title: 'Client Review & Electronic Form 8879 Authorization', checked: true },
      { id: 'qc-16', stageNumber: 16, title: 'Senior Accountant Final Sign-off Attestation', checked: false },
      { id: 'qc-17', stageNumber: 17, title: 'Demo E-File Gateway Transmission Ready', checked: false }
    ];

    // Seed Consolidated Documents (Complex Demo: Alexander Sterling)
    this.documents = [
      {
        id: 'DOC-2025-001',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '01 — Income (W-2, 1099, SSA)',
        documentType: 'Form W-2 (Wage Statement)',
        formNumber: 'Form W-2',
        taxpayer: 'Alexander Sterling',
        payerEmployer: 'Apex BioTech Innovations, Inc.',
        institution: 'ADP Payroll Services',
        accountType: 'Executive Payroll',
        documentDate: '2026-01-18',
        taxPeriod: 'CY2025',
        federalAmount: 145000.00,
        stateAmount: 145000.00,
        federalWithholding: 28400.00,
        stateWithholding: 8700.00,
        localWithholding: 0.00,
        sourceFile: '2025_W2_Apex_BioTech.pdf',
        pageNumber: 1,
        totalPages: 1,
        aiConfidence: 99.2,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Approved',
        duplicateStatus: 'Not Duplicate',
        qualityStatus: 'Complete',
        taxYearMatchStatus: 'Matched',
        accountantNotes: 'Verified against executive contract. 401(k) elective deferral matches maximum statutory limit ($23,000).',
        clientVisibility: 'Visible',
        uploadedBy: 'Alexander Sterling',
        uploadedDate: '2026-02-04',
        lastReviewed: '2026-02-10',
        reviewer: 'Marcus Vance, EA',
        version: 'Original',
        extractedFields: [
          { label: 'Box 1 Wages & Compensation', boxNumber: '1', originalAiValue: 145000, verifiedValue: 145000, confidence: 99.5, isModified: false },
          { label: 'Box 2 Federal Income Tax Withheld', boxNumber: '2', originalAiValue: 28400, verifiedValue: 28400, confidence: 99.1, isModified: false },
          { label: 'Box 3 Social Security Wages', boxNumber: '3', originalAiValue: 168600, verifiedValue: 168600, confidence: 98.9, isModified: false },
          { label: 'Box 4 Social Security Tax Withheld', boxNumber: '4', originalAiValue: 10453.20, verifiedValue: 10453.20, confidence: 99.0, isModified: false },
          { label: 'Box 16 State Wages (SC)', boxNumber: '16', originalAiValue: 145000, verifiedValue: 145000, confidence: 99.2, isModified: false },
          { label: 'Box 17 State Income Tax (SC)', boxNumber: '17', originalAiValue: 8700, verifiedValue: 8700, confidence: 98.8, isModified: false }
        ]
      },
      {
        id: 'DOC-2025-002',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '01 — Income (W-2, 1099, SSA)',
        documentType: 'Form W-2 (Duplicate Upload)',
        formNumber: 'Form W-2',
        taxpayer: 'Alexander Sterling',
        payerEmployer: 'Apex BioTech Innovations, Inc.',
        institution: 'ADP Payroll Services',
        accountType: 'Executive Payroll',
        documentDate: '2026-01-20',
        taxPeriod: 'CY2025',
        federalAmount: 145000.00,
        stateAmount: 145000.00,
        federalWithholding: 28400.00,
        stateWithholding: 8700.00,
        localWithholding: 0.00,
        sourceFile: 'Apex_W2_Copy_Scan2.pdf',
        pageNumber: 1,
        totalPages: 1,
        aiConfidence: 98.4,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Accountant Review Required',
        duplicateStatus: 'Duplicate',
        qualityStatus: 'Duplicate',
        taxYearMatchStatus: 'Matched',
        accountantNotes: 'Exact byte & field duplicate of DOC-2025-001. Flagged to prevent double-counting of wage income.',
        clientVisibility: 'Internal Only',
        uploadedBy: 'Alexander Sterling (Mobile Upload)',
        uploadedDate: '2026-02-06',
        lastReviewed: null,
        reviewer: null,
        version: 'Superseded',
        extractedFields: [
          { label: 'Box 1 Wages & Compensation', boxNumber: '1', originalAiValue: 145000, verifiedValue: 145000, confidence: 98.4, isModified: false },
          { label: 'Box 2 Federal Income Tax Withheld', boxNumber: '2', originalAiValue: 28400, verifiedValue: 28400, confidence: 98.1, isModified: false }
        ]
      },
      {
        id: 'DOC-2025-003',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '04 — Investments & Capital Gains (1099-B, Crypto)',
        documentType: 'Form 1099-B (Consolidated Brokerage)',
        formNumber: 'Form 1099-B',
        taxpayer: 'Alexander Sterling',
        payerEmployer: 'Charles Schwab & Co., Inc.',
        institution: 'Charles Schwab',
        accountType: 'Taxable Individual Brokerage',
        documentDate: '2026-02-01',
        taxPeriod: 'CY2025',
        federalAmount: 82450.00,
        stateAmount: 0.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        sourceFile: 'Schwab_1099B_Consolidated_2025.pdf',
        pageNumber: 1,
        totalPages: 6,
        aiConfidence: 94.7,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Approved',
        duplicateStatus: 'Not Duplicate',
        qualityStatus: 'Complete',
        taxYearMatchStatus: 'Matched',
        accountantNotes: 'Net short-term capital loss of ($3,200) and net long-term capital gain of $18,450. Basis reported to IRS for all covered lots.',
        clientVisibility: 'Visible',
        uploadedBy: 'Alexander Sterling',
        uploadedDate: '2026-02-08',
        lastReviewed: '2026-02-12',
        reviewer: 'Marcus Vance, EA',
        version: 'Original',
        extractedFields: [
          { label: 'Total Gross Proceeds', boxNumber: '1d', originalAiValue: 82450, verifiedValue: 82450, confidence: 96.0, isModified: false },
          { label: 'Total Cost Basis', boxNumber: '1e', originalAiValue: 67200, verifiedValue: 67200, confidence: 94.5, isModified: false },
          { label: 'Net Gain/Loss', boxNumber: 'Net', originalAiValue: 15250, verifiedValue: 15250, confidence: 95.2, isModified: false }
        ]
      },
      {
        id: 'DOC-2025-004',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '01 — Income (W-2, 1099, SSA)',
        documentType: 'Form 1099-DIV (Dividends)',
        formNumber: 'Form 1099-DIV',
        taxpayer: 'Alexander Sterling',
        payerEmployer: 'Charles Schwab & Co., Inc.',
        institution: 'Charles Schwab',
        accountType: 'Taxable Individual Brokerage',
        documentDate: '2026-02-01',
        taxPeriod: 'CY2025',
        federalAmount: 6420.00,
        stateAmount: 0.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        sourceFile: 'Schwab_1099DIV_Consolidated_2025.pdf',
        pageNumber: 2,
        totalPages: 6,
        aiConfidence: 97.1,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Approved',
        duplicateStatus: 'Not Duplicate',
        qualityStatus: 'Complete',
        taxYearMatchStatus: 'Matched',
        accountantNotes: 'Qualified dividends $5,120 eligible for 15% preferential tax rate. Ordinary dividends $1,300.',
        clientVisibility: 'Visible',
        uploadedBy: 'Alexander Sterling',
        uploadedDate: '2026-02-08',
        lastReviewed: '2026-02-12',
        reviewer: 'Marcus Vance, EA',
        version: 'Original',
        extractedFields: [
          { label: 'Box 1a Total Ordinary Dividends', boxNumber: '1a', originalAiValue: 6420, verifiedValue: 6420, confidence: 97.4, isModified: false },
          { label: 'Box 1b Qualified Dividends', boxNumber: '1b', originalAiValue: 5120, verifiedValue: 5120, confidence: 96.8, isModified: false }
        ]
      },
      {
        id: 'DOC-2025-005',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '02 — Business (P&L, Balance Sheet, Expenses)',
        documentType: 'Schedule C P&L (Consulting LLC)',
        formNumber: 'Schedule C P&L',
        taxpayer: 'Alexander Sterling',
        business: 'Sterling Strategy Advisors, LLC',
        payerEmployer: 'Various Commercial Clients',
        institution: 'First Citizens Bank',
        accountType: 'Commercial Operating',
        documentDate: '2026-01-31',
        taxPeriod: 'CY2025',
        federalAmount: 94800.00,
        stateAmount: 94800.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        sourceFile: 'Sterling_Strategy_Annual_PL_2025.pdf',
        pageNumber: 1,
        totalPages: 3,
        aiConfidence: 91.5,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Approved',
        duplicateStatus: 'Not Duplicate',
        qualityStatus: 'Complete',
        taxYearMatchStatus: 'Matched',
        accountantNotes: 'Gross receipts $94,800. Deductible operating expenses $28,450. Net self-employment profit $66,350 subject to SE tax.',
        clientVisibility: 'Visible',
        uploadedBy: 'Alexander Sterling',
        uploadedDate: '2026-02-10',
        lastReviewed: '2026-02-14',
        reviewer: 'Marcus Vance, EA',
        version: 'Original',
        extractedFields: [
          { label: 'Gross Receipts / Sales', boxNumber: 'Line 1', originalAiValue: 94800, verifiedValue: 94800, confidence: 93.0, isModified: false },
          { label: 'Total Business Expenses', boxNumber: 'Line 28', originalAiValue: 28450, verifiedValue: 28450, confidence: 90.5, isModified: false },
          { label: 'Net Business Profit', boxNumber: 'Line 31', originalAiValue: 66350, verifiedValue: 66350, confidence: 91.8, isModified: false }
        ]
      },
      {
        id: 'DOC-2025-006',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '03 — Rental Property (Income & Deductions)',
        documentType: 'Rental Summary (Charleston Condo)',
        formNumber: 'Schedule E Rental',
        taxpayer: 'Alexander Sterling',
        property: '142 Church St, Unit 3B, Charleston, SC',
        payerEmployer: 'Palmetto Property Management',
        institution: 'Palmetto PM Trust Account',
        accountType: 'Property Management Escrow',
        documentDate: '2026-01-25',
        taxPeriod: 'CY2025',
        federalAmount: 36000.00,
        stateAmount: 36000.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        sourceFile: 'Charleston_Rental_142Church_2025.pdf',
        pageNumber: 1,
        totalPages: 2,
        aiConfidence: 89.2,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Approved',
        duplicateStatus: 'Not Duplicate',
        qualityStatus: 'Complete',
        taxYearMatchStatus: 'Matched',
        accountantNotes: 'Gross rental income $36,000. Operating expenses $16,400. Mortgage interest $11,200. Annual MACRS depreciation $8,400.',
        clientVisibility: 'Visible',
        uploadedBy: 'Alexander Sterling',
        uploadedDate: '2026-02-12',
        lastReviewed: '2026-02-16',
        reviewer: 'Marcus Vance, EA',
        version: 'Original',
        extractedFields: [
          { label: 'Rents Received', boxNumber: 'Line 3', originalAiValue: 36000, verifiedValue: 36000, confidence: 92.0, isModified: false },
          { label: 'Management Fees', boxNumber: 'Line 10', originalAiValue: 3600, verifiedValue: 3600, confidence: 91.0, isModified: false },
          { label: 'Repairs & Maintenance', boxNumber: 'Line 14', originalAiValue: 4200, verifiedValue: 4200, confidence: 88.5, isModified: false }
        ]
      },
      {
        id: 'DOC-2025-007',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '08 — International & Foreign Reporting (FBAR, 8938)',
        documentType: 'Foreign Bank Statement (Zurich Cantonal)',
        formNumber: 'FinCEN Form 114 / Form 8938',
        taxpayer: 'Alexander Sterling',
        payerEmployer: 'Zürcher Kantonalbank (ZKB)',
        institution: 'Zürcher Kantonalbank',
        accountType: 'Foreign Custody Account',
        documentDate: '2025-12-31',
        taxPeriod: 'CY2025',
        federalAmount: 114500.00,
        stateAmount: 0.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        sourceFile: 'ZKB_Account_Statement_Dec2025.pdf',
        pageNumber: 1,
        totalPages: 4,
        aiConfidence: 71.8,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Accountant Review Required',
        duplicateStatus: 'Not Duplicate',
        qualityStatus: 'Complete',
        taxYearMatchStatus: 'Matched',
        accountantNotes: 'Foreign bank account max balance $114,500 exceeds $10,000 threshold. FBAR (FinCEN 114) filing mandatory. Form 8938 threshold verified.',
        clientVisibility: 'Visible',
        uploadedBy: 'Alexander Sterling',
        uploadedDate: '2026-02-15',
        lastReviewed: null,
        reviewer: null,
        version: 'Original',
        extractedFields: [
          { label: 'Max Account Balance (USD Equiv)', boxNumber: 'Part I', originalAiValue: 114500, verifiedValue: 114500, confidence: 71.8, isModified: false },
          { label: 'Foreign Interest Earned (USD)', boxNumber: 'Part II', originalAiValue: 1840, verifiedValue: 1840, confidence: 73.0, isModified: false }
        ]
      },
      {
        id: 'DOC-2025-008',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '06 — Tax Payments & Withholding (Estimated, Vouchers)',
        documentType: 'Form 1040-ES Estimated Tax Receipts',
        formNumber: 'Form 1040-ES',
        taxpayer: 'Alexander Sterling',
        payerEmployer: 'Internal Revenue Service & SC DOR',
        institution: 'US Treasury EFTPS & SC MyDORWAY',
        accountType: 'Estimated Quarterly Taxes',
        documentDate: '2026-01-15',
        taxPeriod: 'CY2025',
        federalAmount: 24000.00,
        stateAmount: 6000.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        sourceFile: '2025_Estimated_Tax_EFTPS_Confirmations.pdf',
        pageNumber: 1,
        totalPages: 4,
        aiConfidence: 96.3,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Approved',
        duplicateStatus: 'Not Duplicate',
        qualityStatus: 'Complete',
        taxYearMatchStatus: 'Matched',
        accountantNotes: 'Quarterly payments of $6,000 Fed / $1,500 State verified on EFTPS and SC MyDORWAY. Safe harbor satisfied.',
        clientVisibility: 'Visible',
        uploadedBy: 'Alexander Sterling',
        uploadedDate: '2026-02-05',
        lastReviewed: '2026-02-11',
        reviewer: 'Marcus Vance, EA',
        version: 'Original',
        extractedFields: [
          { label: 'Federal Estimated Payments (Total)', boxNumber: 'Part 1', originalAiValue: 24000, verifiedValue: 24000, confidence: 97.1, isModified: false },
          { label: 'State Estimated Payments (Total)', boxNumber: 'Part 2', originalAiValue: 6000, verifiedValue: 6000, confidence: 95.8, isModified: false }
        ]
      },
      {
        id: 'DOC-2025-009',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '05 — Deductions & Itemized Credits (1098, Charity, Medical)',
        documentType: 'Form 1098 (Mortgage Interest)',
        formNumber: 'Form 1098',
        taxpayer: 'Alexander Sterling',
        payerEmployer: 'JPMorgan Chase Bank, N.A.',
        institution: 'JPMorgan Chase',
        accountType: 'Primary Residence Mortgage',
        documentDate: '2026-01-22',
        taxPeriod: 'CY2025',
        federalAmount: 18450.00,
        stateAmount: 0.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        sourceFile: 'Chase_1098_Mortgage_2025.pdf',
        pageNumber: 1,
        totalPages: 1,
        aiConfidence: 98.9,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Approved',
        duplicateStatus: 'Not Duplicate',
        qualityStatus: 'Complete',
        taxYearMatchStatus: 'Matched',
        accountantNotes: 'Mortgage origination $680,000 is under $750,000 post-TCJA statutory cap. 100% deductible on Schedule A.',
        clientVisibility: 'Visible',
        uploadedBy: 'Alexander Sterling',
        uploadedDate: '2026-02-04',
        lastReviewed: '2026-02-10',
        reviewer: 'Marcus Vance, EA',
        version: 'Original',
        extractedFields: [
          { label: 'Box 1 Mortgage Interest Received', boxNumber: '1', originalAiValue: 18450, verifiedValue: 18450, confidence: 99.2, isModified: false },
          { label: 'Box 2 Outstanding Principal', boxNumber: '2', originalAiValue: 642100, verifiedValue: 642100, confidence: 98.5, isModified: false }
        ]
      },
      {
        id: 'DOC-2025-010',
        clientId: 'cli_complex_alex',
        clientName: 'Alexander Sterling',
        taxYear: 2025,
        category: '01 — Income (W-2, 1099, SSA)',
        documentType: 'Form 1099-INT (Mismatch Sample)',
        formNumber: 'Form 1099-INT',
        taxpayer: 'Alexander Sterling',
        payerEmployer: 'First Citizens Bank',
        institution: 'First Citizens Bank',
        accountType: 'High-Yield Savings',
        documentDate: '2025-01-15',
        taxPeriod: 'CY2024', // Prior year document mistakenly uploaded for 2025
        federalAmount: 1420.00,
        stateAmount: 0.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        sourceFile: 'FirstCitizens_1099INT_2024_Scanned.pdf',
        pageNumber: 1,
        totalPages: 1,
        aiConfidence: 81.2,
        processingStatus: 'Extraction Complete',
        reviewStatus: 'Needs Correction',
        duplicateStatus: 'Not Duplicate',
        qualityStatus: 'Tax-Year Mismatch',
        taxYearMatchStatus: 'Potential Mismatch',
        accountantNotes: 'Potential tax-year mismatch — Document is for CY2024, not active filing season CY2025. Accountant review required.',
        clientVisibility: 'Visible',
        uploadedBy: 'Alexander Sterling',
        uploadedDate: '2026-02-07',
        lastReviewed: null,
        reviewer: null,
        version: 'Original',
        extractedFields: [
          { label: 'Box 1 Interest Income', boxNumber: '1', originalAiValue: 1420, verifiedValue: 1420, confidence: 81.2, isModified: false }
        ]
      }
    ];

    // Seed AI Exceptions (Alexander Sterling)
    this.exceptions = [
      {
        id: 'EXC-001',
        clientId: 'cli_complex_alex',
        taxYear: 2025,
        title: 'Tax-Year Mismatch on First Citizens 1099-INT',
        description: 'Document "FirstCitizens_1099INT_2024_Scanned.pdf" specifies tax year 2024. Active return filing is CY2025.',
        priority: 'HIGH',
        category: 'Tax-Year Mismatch',
        relatedDocumentId: 'DOC-2025-010',
        relatedDocumentName: 'FirstCitizens_1099INT_2024_Scanned.pdf',
        disposition: 'RESOLVED',
        resolutionNote: 'Client uploaded 2024 copy in error; requested 2025 statement and archived 2024 slip.',
        resolvedBy: 'Marcus Vance, EA',
        resolvedAt: '2026-02-18T10:30:00Z',
        blockingHardStop: false
      },
      {
        id: 'EXC-002',
        clientId: 'cli_complex_alex',
        taxYear: 2025,
        title: 'Duplicate W-2 Upload Detected',
        description: 'File "Apex_W2_Copy_Scan2.pdf" has identical employer EIN, SSN, and wage box amounts to "2025_W2_Apex_BioTech.pdf".',
        priority: 'HIGH',
        category: 'Possible Duplicate',
        relatedDocumentId: 'DOC-2025-002',
        relatedDocumentName: 'Apex_W2_Copy_Scan2.pdf',
        disposition: 'RESOLVED',
        resolutionNote: 'Confirmed duplicate mobile scan. Marked superseded to prevent double inclusion.',
        resolvedBy: 'Marcus Vance, EA',
        resolvedAt: '2026-02-18T11:00:00Z',
        blockingHardStop: false
      },
      {
        id: 'EXC-003',
        clientId: 'cli_complex_alex',
        taxYear: 2025,
        title: 'Foreign Bank Account Disclosure Flag (FBAR Mandatory)',
        description: 'Zürcher Kantonalbank account balance of $114,500 exceeds statutory $10,000 reporting threshold.',
        priority: 'HIGH',
        category: 'Foreign Information Indicator',
        relatedDocumentId: 'DOC-2025-007',
        relatedDocumentName: 'ZKB_Account_Statement_Dec2025.pdf',
        disposition: 'RESOLVED',
        resolutionNote: 'Accountant verified Swiss custody account, confirmed FBAR FinCEN 114 preparation, and Form 8938 threshold compliance.',
        resolvedBy: 'Elena Rostova, CPA',
        resolvedAt: '2026-02-18T14:15:00Z',
        blockingHardStop: false
      }
    ];

    // Seed Missing Documents
    this.missingDocuments = [
      {
        id: 'MISS-001',
        clientId: 'cli_complex_alex',
        taxYear: 2025,
        itemName: 'First Citizens Bank 2025 Form 1099-INT',
        formNumber: 'Form 1099-INT',
        category: 'CRITICAL / ACCOUNTANT REVIEW',
        priority: 'Critical',
        reason: 'Current uploaded document was for prior year 2024. Need CY2025 slip.',
        requestedDate: '2026-02-12',
        dueDate: '2026-03-15',
        clientStatus: 'Uploaded',
        accountantStatus: 'Resolved',
        notes: 'Client uploaded CY2025 statement showing $1,890 interest.',
        blockingHardStop: false
      },
      {
        id: 'MISS-002',
        clientId: 'cli_complex_alex',
        taxYear: 2025,
        itemName: 'Sterling Strategy Advisors 2025 Mileage Log',
        formNumber: 'Mileage Log (Form 4562)',
        category: 'RECOMMENDED SUPPORTING DOCUMENTATION',
        priority: 'Medium',
        reason: 'Substantiation required for $4,200 business vehicle deduction.',
        requestedDate: '2026-02-14',
        dueDate: '2026-03-20',
        clientStatus: 'Uploaded',
        accountantStatus: 'Resolved',
        notes: 'Client provided MileIQ annual summary showing 6,268 business miles.',
        blockingHardStop: false
      }
    ];

    // Seed Prior Year Comparison
    this.priorYearItems = [
      {
        id: 'PY-001',
        clientId: 'cli_complex_alex',
        area: 'Wage & Salary Employers',
        itemLabel: 'Apex BioTech Innovations, Inc. (W-2)',
        priorYearValue: '$135,000 (TY2024)',
        currentYearValue: '$145,000 (TY2025)',
        differenceDescription: '+$10,000 (+7.4%)',
        aiExplanation: 'Normal annual executive merit increase and performance adjustment.',
        accountantReviewStatus: 'VERIFIED & RECONCILED',
        accountantNotes: 'Matches amended employment agreement dated Jan 2025.',
        requiresReview: false
      },
      {
        id: 'PY-002',
        clientId: 'cli_complex_alex',
        area: '1099 Business Receipts',
        itemLabel: 'Sterling Strategy Advisors, LLC (Schedule C)',
        priorYearValue: '$72,000 (TY2024)',
        currentYearValue: '$94,800 (TY2025)',
        differenceDescription: '+$22,800 (+31.6%)',
        aiExplanation: 'Expansion of advisory retainer client base.',
        accountantReviewStatus: 'VERIFIED & RECONCILED',
        accountantNotes: 'Reconciled with First Citizens operating account deposits.',
        requiresReview: false
      },
      {
        id: 'PY-003',
        clientId: 'cli_complex_alex',
        area: 'Rental Properties',
        itemLabel: '142 Church St, Charleston, SC (Schedule E)',
        priorYearValue: '$34,000 (TY2024)',
        currentYearValue: '$36,000 (TY2025)',
        differenceDescription: '+$2,000 (+5.9%)',
        aiExplanation: 'Lease renewal escalated monthly rent by $166.67.',
        accountantReviewStatus: 'VERIFIED & RECONCILED',
        accountantNotes: 'Property management agreement reviewed. Lease active through Dec 2026.',
        requiresReview: false
      }
    ];

    // Seed Income Items
    this.incomeItems = [
      {
        id: 'INC-001',
        sourceDocId: 'DOC-2025-001',
        sourceDocName: '2025_W2_Apex_BioTech.pdf',
        incomeType: 'W-2 Wage Statement',
        payerName: 'Apex BioTech Innovations, Inc.',
        taxYear: 2025,
        grossAmount: 145000.00,
        federalWithholding: 28400.00,
        stateWithholding: 8700.00,
        localWithholding: 0.00,
        aiConfidence: 99.2,
        verificationStatus: 'Verified',
        notes: 'Executive salary verified against contract.'
      },
      {
        id: 'INC-002',
        sourceDocId: 'DOC-2025-005',
        sourceDocName: 'Sterling_Strategy_Annual_PL_2025.pdf',
        incomeType: 'Schedule C Business Gross',
        payerName: 'Sterling Strategy Advisors, LLC',
        taxYear: 2025,
        grossAmount: 94800.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        aiConfidence: 91.5,
        verificationStatus: 'Verified',
        notes: 'Gross revenue. Net Schedule C profit is $66,350.'
      },
      {
        id: 'INC-003',
        sourceDocId: 'DOC-2025-006',
        sourceDocName: 'Charleston_Rental_142Church_2025.pdf',
        incomeType: 'Schedule E Rental Gross',
        payerName: '142 Church St, Charleston, SC',
        taxYear: 2025,
        grossAmount: 36000.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        aiConfidence: 89.2,
        verificationStatus: 'Verified',
        notes: 'Gross rents. Net rental profit after depreciation is $0.'
      },
      {
        id: 'INC-004',
        sourceDocId: 'DOC-2025-004',
        sourceDocName: 'Schwab_1099DIV_Consolidated_2025.pdf',
        incomeType: '1099-DIV Dividends',
        payerName: 'Charles Schwab & Co., Inc.',
        taxYear: 2025,
        grossAmount: 6420.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        aiConfidence: 97.1,
        verificationStatus: 'Verified',
        notes: 'Qualified: $5,120. Ordinary: $1,300.'
      },
      {
        id: 'INC-005',
        sourceDocId: 'DOC-2025-003',
        sourceDocName: 'Schwab_1099B_Consolidated_2025.pdf',
        incomeType: '1099-B Brokerage Proceeds',
        payerName: 'Charles Schwab & Co., Inc.',
        taxYear: 2025,
        grossAmount: 15250.00,
        federalWithholding: 0.00,
        stateWithholding: 0.00,
        localWithholding: 0.00,
        aiConfidence: 94.7,
        verificationStatus: 'Verified',
        notes: 'Net capital gain: $15,250 ($18,450 LTCG - $3,200 STCL).'
      }
    ];

    // Seed Tax Payments
    this.paymentItems = [
      {
        id: 'PAY-001',
        sourceDocId: 'DOC-2025-001',
        sourceDocName: '2025_W2_Apex_BioTech.pdf',
        paymentType: 'Federal Withholding',
        paymentDate: '2025-12-31',
        amount: 28400.00,
        taxYear: 2025,
        aiConfidence: 99.1,
        accountantVerified: true,
        notes: 'W-2 Box 2'
      },
      {
        id: 'PAY-002',
        sourceDocId: 'DOC-2025-001',
        sourceDocName: '2025_W2_Apex_BioTech.pdf',
        paymentType: 'State Withholding',
        paymentDate: '2025-12-31',
        amount: 8700.00,
        taxYear: 2025,
        aiConfidence: 98.8,
        accountantVerified: true,
        notes: 'SC Box 17'
      },
      {
        id: 'PAY-003',
        sourceDocId: 'DOC-2025-008',
        sourceDocName: '2025_Estimated_Tax_EFTPS_Confirmations.pdf',
        paymentType: 'Q1 Estimated Payment',
        paymentDate: '2025-04-15',
        amount: 6000.00,
        taxYear: 2025,
        aiConfidence: 97.5,
        accountantVerified: true,
        notes: 'EFTPS Conf #89201940'
      },
      {
        id: 'PAY-004',
        sourceDocId: 'DOC-2025-008',
        sourceDocName: '2025_Estimated_Tax_EFTPS_Confirmations.pdf',
        paymentType: 'Q2 Estimated Payment',
        paymentDate: '2025-06-16',
        amount: 6000.00,
        taxYear: 2025,
        aiConfidence: 97.2,
        accountantVerified: true,
        notes: 'EFTPS Conf #91028441'
      },
      {
        id: 'PAY-005',
        sourceDocId: 'DOC-2025-008',
        sourceDocName: '2025_Estimated_Tax_EFTPS_Confirmations.pdf',
        paymentType: 'Q3 Estimated Payment',
        paymentDate: '2025-09-15',
        amount: 6000.00,
        taxYear: 2025,
        aiConfidence: 97.0,
        accountantVerified: true,
        notes: 'EFTPS Conf #93409122'
      },
      {
        id: 'PAY-006',
        sourceDocId: 'DOC-2025-008',
        sourceDocName: '2025_Estimated_Tax_EFTPS_Confirmations.pdf',
        paymentType: 'Q4 Estimated Payment',
        paymentDate: '2026-01-15',
        amount: 6000.00,
        taxYear: 2025,
        aiConfidence: 97.4,
        accountantVerified: true,
        notes: 'EFTPS Conf #95810239'
      }
    ];

    // Seed Business Profile
    this.businessProfiles = [
      {
        id: 'BIZ-001',
        clientId: 'cli_complex_alex',
        legalName: 'Sterling Strategy Advisors, LLC',
        dba: 'Sterling Advisory Partners',
        einIndicator: '••-•••9312',
        entityType: 'Single-Member LLC',
        ownershipPercentage: 100,
        businessActivity: 'Management & Technology Consulting',
        accountingMethod: 'Cash',
        grossReceipts: 94800.00,
        otherIncome: 0.00,
        cogs: 0.00,
        payrollExpenses: 0.00,
        contractorExpenses: 8400.00,
        advertisingExpenses: 2100.00,
        officeExpenses: 3450.00,
        rentExpenses: 4800.00,
        utilitiesExpenses: 1200.00,
        insuranceExpenses: 2200.00,
        professionalFees: 1800.00,
        softwareExpenses: 2900.00,
        travelExpenses: 1600.00,
        mealsExpenses: 0.00,
        vehicleExpenses: 4200.00,
        equipmentExpenses: 0.00,
        depreciationExpenses: 0.00,
        loanActivity: 0.00,
        completeness: [
          { itemKey: 'pl', label: 'Profit & Loss Statement', status: 'Received', supportingDocId: 'DOC-2025-005', supportingDocName: 'Sterling_Strategy_Annual_PL_2025.pdf' },
          { itemKey: 'bs', label: 'Balance Sheet', status: 'Received', supportingDocId: 'DOC-2025-005', supportingDocName: 'Cash basis balance sheet' },
          { itemKey: 'bank', label: '12-Month Bank Statements', status: 'Received', supportingDocId: 'DOC-2025-005', supportingDocName: 'First Citizens Bank commercial feed' },
          { itemKey: 'cc', label: 'Credit Card Statements', status: 'Received', supportingDocId: 'DOC-2025-005', supportingDocName: 'Amex Business Gold statements' },
          { itemKey: 'payroll', label: 'Payroll Records (Form 941/940)', status: 'Not Applicable', notes: 'Single-member LLC with no employees; distributions only' },
          { itemKey: 'fa', label: 'Fixed Asset Depreciation Register', status: 'Received', notes: 'Section 179 computer equipment fully depreciated prior year' },
          { itemKey: 'mileage', label: 'Vehicle Mileage Log', status: 'Received', supportingDocId: 'MISS-002', supportingDocName: 'MileIQ Annual Tax Log (6,268 business miles)' }
        ]
      }
    ];

    // Seed Rental Property
    this.rentalProperties = [
      {
        id: 'RENT-001',
        clientId: 'cli_complex_alex',
        address: '142 Church St, Unit 3B, Charleston, SC 29401',
        ownershipPercentage: 100,
        acquisitionDate: '2021-06-15',
        purchasePrice: 420000.00,
        accumulatedDepreciation: 46182.00,
        rentalIncome: 36000.00,
        mortgageInterest: 11200.00,
        propertyTaxes: 4800.00,
        insurance: 3200.00,
        repairs: 4200.00,
        maintenance: 1800.00,
        utilities: 0.00,
        managementFees: 3600.00,
        advertising: 0.00,
        professionalFees: 400.00,
        capitalImprovements: 0.00,
        incomeDocReceived: true,
        expenseDocReceived: true,
        propertyInfoComplete: true,
        hasPriorYearComparison: true,
        priorYearIncome: 34000.00,
        aiFlags: ['No significant variance from prior year (+5.9% inflation-adjusted rent)']
      }
    ];

    // Seed Investment Accounts
    this.investmentAccounts = [
      {
        id: 'INV-001',
        clientId: 'cli_complex_alex',
        institution: 'Charles Schwab & Co., Inc.',
        accountNumberMasked: '••••-9482',
        accountType: 'Taxable Brokerage',
        taxYear: 2025,
        has1099B: true,
        has1099DIV: true,
        has1099INT: true,
        capitalGainShortTerm: -3200.00,
        capitalGainLongTerm: 18450.00,
        digitalAssetsReportable: false,
        foreignInvestmentsReportable: false,
        statementUploaded: true,
        reconciliationNotes: 'Consolidated Form 1099 received. All covered lots with basis reported to IRS. Short-term loss offsets long-term gain.',
        flagMismatchedStatements: false
      }
    ];

    // Seed Deductions & Credits Matrix
    this.deductionCredits = [
      {
        id: 'DED-001',
        area: 'Mortgage Interest (Form 1098)',
        evidenceReceived: true,
        missingEvidence: 'None — Form 1098 verified',
        sourceDocName: 'Chase_1098_Mortgage_2025.pdf',
        accountantDecision: 'Allowed in Full',
        status: 'Complete',
        amountClaimed: 18450.00
      },
      {
        id: 'DED-002',
        area: 'Charitable Cash & Non-Cash Contributions',
        evidenceReceived: true,
        missingEvidence: 'None — Acknowledgement letters for gifts >$250 on file',
        sourceDocName: 'Columbia_Community_Foundation_Receipt.pdf',
        accountantDecision: 'Allowed in Full',
        status: 'Complete',
        amountClaimed: 6500.00
      },
      {
        id: 'DED-003',
        area: 'State & Local Tax (SALT) Cap Calculation',
        evidenceReceived: true,
        missingEvidence: 'None — Real estate tax bills and state withholding reconciled',
        sourceDocName: 'Richland_County_Property_Tax_2025.pdf',
        accountantDecision: 'Phase-out / Limited',
        status: 'Complete',
        amountClaimed: 10000.00 // Capped at $10,000 statutory limit
      },
      {
        id: 'DED-004',
        area: 'Residential Clean Energy & Energy Efficiency (Form 5695)',
        evidenceReceived: true,
        missingEvidence: 'None — Solar contractor paid invoice and certification uploaded',
        sourceDocName: 'Palmetto_Solar_Contract_Paid_Invoice.pdf',
        accountantDecision: 'Allowed in Full',
        status: 'Complete',
        amountClaimed: 7800.00 // 30% credit on $26,000 residential solar installation
      }
    ];

    // Seed Potential Form Mappings
    this.formMappings = [
      {
        id: 'MAP-001',
        sourceInformation: 'W-2 Wages ($145,000) from Apex BioTech Innovations, Inc.',
        sourceDocument: 'DOC-2025-001 (Form W-2)',
        potentialFormSchedule: 'Form 1040, Line 1a',
        reasonBasis: 'Statutory wage compensation reported on Form W-2 Box 1.',
        supportingEvidence: 'Form W-2 Box 1 matches payroll ledger.',
        accountantDecision: 'Confirmed Applicable',
        status: 'Potentially applicable — accountant determination required.'
      },
      {
        id: 'MAP-002',
        sourceInformation: 'Single-Member LLC Consulting Receipts ($94,800) and Expenses ($28,450)',
        sourceDocument: 'DOC-2025-005 (Schedule C P&L)',
        potentialFormSchedule: 'Schedule C (Form 1040) & Schedule SE',
        reasonBasis: 'Unincorporated business activity conducted as sole proprietor / single-member LLC.',
        supportingEvidence: 'Annual P&L, 12-month commercial bank statements.',
        accountantDecision: 'Confirmed Applicable',
        status: 'Potentially applicable — accountant determination required.'
      },
      {
        id: 'MAP-003',
        sourceInformation: 'Residential Rental Condo Gross Income ($36,000) and Deductions ($19,600)',
        sourceDocument: 'DOC-2025-006 (Schedule E Rental)',
        potentialFormSchedule: 'Schedule E (Form 1040), Part I & Form 4562',
        reasonBasis: 'Directly held real estate rental activity with active client participation.',
        supportingEvidence: 'Property manager 1099-MISC and annual income/expense statement.',
        accountantDecision: 'Confirmed Applicable',
        status: 'Potentially applicable — accountant determination required.'
      },
      {
        id: 'MAP-004',
        sourceInformation: 'Capital Transactions: $82,450 proceeds, $67,200 basis, $15,250 net gain',
        sourceDocument: 'DOC-2025-003 (Form 1099-B)',
        potentialFormSchedule: 'Schedule D (Form 1040) & Form 8949',
        reasonBasis: 'Brokerage securities sales reported on Form 1099-B with basis reported to IRS.',
        supportingEvidence: 'Charles Schwab consolidated 1099-B statement.',
        accountantDecision: 'Confirmed Applicable',
        status: 'Potentially applicable — accountant determination required.'
      },
      {
        id: 'MAP-005',
        sourceInformation: 'Foreign Financial Account balance of $114,500 at Zürcher Kantonalbank',
        sourceDocument: 'DOC-2025-007 (Foreign Custody Statement)',
        potentialFormSchedule: 'FinCEN Form 114 (FBAR) & Form 8938',
        reasonBasis: 'Aggregate foreign financial asset value exceeds $10,000 (FBAR) and $100,000 (Form 8938 MFJ).',
        supportingEvidence: 'December 2025 ZKB custody account statement.',
        accountantDecision: 'Confirmed Applicable',
        status: 'Potentially applicable — accountant determination required.'
      }
    ];

    // Seed Return Traceability Records
    this.traceabilityRecords = [
      {
        id: 'TR-001',
        returnItemLabel: 'Form 1040, Line 1a — Wages, salaries, tips',
        reportedAmount: 145000.00,
        workpaperName: '04_INCOME_WORKPAPER (Line 1)',
        sourceDocumentId: 'DOC-2025-001',
        sourceDocumentName: '2025_W2_Apex_BioTech.pdf',
        pageNumber: 1,
        fieldBox: 'Box 1 Wages, tips, other comp.',
        extractedAiValue: 145000.00,
        accountantVerifiedValue: 145000.00,
        verifiedBy: 'Marcus Vance, EA',
        verifiedTimestamp: '2026-02-10T14:22:00Z'
      },
      {
        id: 'TR-002',
        returnItemLabel: 'Schedule 1, Line 3 — Business income or (loss)',
        reportedAmount: 66350.00,
        workpaperName: '06_BUSINESS_WORKPAPER (Schedule C)',
        sourceDocumentId: 'DOC-2025-005',
        sourceDocumentName: 'Sterling_Strategy_Annual_PL_2025.pdf',
        pageNumber: 1,
        fieldBox: 'Net Profit (Gross $94,800 - Expenses $28,450)',
        extractedAiValue: 66350.00,
        accountantVerifiedValue: 66350.00,
        verifiedBy: 'Marcus Vance, EA',
        verifiedTimestamp: '2026-02-14T11:05:00Z'
      },
      {
        id: 'TR-003',
        returnItemLabel: 'Schedule 1, Line 5 — Rental real estate, royalties, partnerships, etc.',
        reportedAmount: 0.00,
        workpaperName: '07_RENTAL_PROPERTY_WORKPAPER (Charleston Condo)',
        sourceDocumentId: 'DOC-2025-006',
        sourceDocumentName: 'Charleston_Rental_142Church_2025.pdf',
        pageNumber: 1,
        fieldBox: 'Net Income (Rents $36k - Cash Exp $27.6k - MACRS Deprec $8.4k)',
        extractedAiValue: 0.00,
        accountantVerifiedValue: 0.00,
        verifiedBy: 'Marcus Vance, EA',
        verifiedTimestamp: '2026-02-16T16:40:00Z'
      },
      {
        id: 'TR-004',
        returnItemLabel: 'Form 1040, Line 7 — Capital gain or (loss)',
        reportedAmount: 15250.00,
        workpaperName: '08_INVESTMENT_WORKPAPER (Schwab 1099-B)',
        sourceDocumentId: 'DOC-2025-003',
        sourceDocumentName: 'Schwab_1099B_Consolidated_2025.pdf',
        pageNumber: 1,
        fieldBox: 'Net LTCG ($18,450) + Net STCL (-$3,200)',
        extractedAiValue: 15250.00,
        accountantVerifiedValue: 15250.00,
        verifiedBy: 'Marcus Vance, EA',
        verifiedTimestamp: '2026-02-12T09:15:00Z'
      },
      {
        id: 'TR-005',
        returnItemLabel: 'Form 1040, Line 25a — Federal income tax withheld from Form W-2',
        reportedAmount: 28400.00,
        workpaperName: '05_WITHHOLDING_PAYMENT_WORKPAPER',
        sourceDocumentId: 'DOC-2025-001',
        sourceDocumentName: '2025_W2_Apex_BioTech.pdf',
        pageNumber: 1,
        fieldBox: 'Box 2 Federal income tax withheld',
        extractedAiValue: 28400.00,
        accountantVerifiedValue: 28400.00,
        verifiedBy: 'Marcus Vance, EA',
        verifiedTimestamp: '2026-02-10T14:23:00Z'
      }
    ];
  }
}

export const accountantCenterService = new AccountantCenterService();
