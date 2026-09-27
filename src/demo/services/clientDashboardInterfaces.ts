/**
 * A/R Tax Services, LLC - Provider-Neutral Client Dashboard Architecture
 * Interfaces for modular service layer supporting interchangeable Demo and Production adapters.
 */

export interface ClientOverviewData {
  clientId: string;
  clientName: string;
  activeEntity: string;
  tinMasked: string;
  activeEngagementId: string;
  engagementName: string;
  taxYear: number;
  returnType: string;
  currentLifecycleStage: string;
  lifecycleStageIndex: number;
  completionPercentage: number;
  immediateRequiredAction: string;
  nextDeadline: string;
  missingInformationCount: number;
  documentsRequiringAttention: number;
  organizerStatus: 'Not Started' | 'In Progress' | 'Submitted' | 'Reviewed';
  organizerCompletionPercent: number;
  returnReviewStatus: 'Draft In Preparation' | 'Reviewer Approved' | 'Client Review Pending' | 'Client Approved' | 'Correction Requested';
  signatureStatus: 'Not Ready' | 'Signature Requested' | 'Signed (Simulated)' | 'Completed';
  filingStatus: 'Pending Review' | 'Ready to File' | 'Filed (Simulated)' | 'Accepted (Simulated)';
  invoiceStatus: 'Paid' | 'Unpaid Balance' | 'Past Due';
  outstandingBalance: number;
  recentNotificationsCount: number;
  assignedTeam: {
    managingPrincipal: { name: string; email: string };
    seniorReviewer: { name: string; email: string };
    taxPreparer: { name: string; email: string };
  };
}

export interface ClientDocumentRecord {
  id: string;
  clientId: string;
  engagementId?: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  category: string;
  taxYear: number;
  entity: string;
  uploadedAt: string;
  uploadedBy: string;
  processingStage: 
    | 'Uploaded'
    | 'Awaiting security check'
    | 'Demo security check completed'
    | 'Classification pending'
    | 'Classified'
    | 'Extraction pending'
    | 'Extracted'
    | 'Requires review'
    | 'Reviewed'
    | 'Archived';
  securityStatus: string;
  reviewStatus: 'Pending Review' | 'Approved' | 'Requires Clarification' | 'Flagged';
  version: number;
  isDraft: boolean;
  description?: string;
  summary?: {
    detectedType: string;
    taxYear: number;
    issuer: string;
    recipient: string;
    importantDates: string[];
    keyAmounts: { label: string; amount: string }[];
    missingPages: string[];
    questions: string[];
    confidenceScore: number;
  };
  clientQuestions?: Array<{
    id: string;
    author: string;
    text: string;
    timestamp: string;
    answered: boolean;
    response?: string;
  }>;
}

export interface TaxOrganizerState {
  clientId: string;
  taxYear: number;
  status: 'Draft' | 'In Progress' | 'Submitted' | 'Reviewed';
  completionPercentage: number;
  submittedAt?: string;
  sections: {
    personal: Record<string, any>;
    filingStatus: Record<string, any>;
    spouse: Record<string, any>;
    dependents: Record<string, any>;
    employment: Record<string, any>;
    selfEmployment: Record<string, any>;
    businessActivity: Record<string, any>;
    investments: Record<string, any>;
    digitalAssets: Record<string, any>;
    retirement: Record<string, any>;
    education: Record<string, any>;
    healthcare: Record<string, any>;
    property: Record<string, any>;
    rentalProperties: Record<string, any>;
    itemizedDeductions: Record<string, any>;
    charitableContributions: Record<string, any>;
    foreignActivity: Record<string, any>;
    multiStateActivity: Record<string, any>;
    estimatedPayments: Record<string, any>;
    notices: Record<string, any>;
    priorYearChanges: Record<string, any>;
    electronicSignatureConsent: Record<string, any>;
  };
  missingDocumentChecklist: string[];
}

export interface ClientIncomeRecord {
  id: string;
  clientId: string;
  taxYear: number;
  type: 'Wages' | 'Self-employment' | 'Business revenue' | 'Interest' | 'Dividends' | 'Capital gains' | 'Rental income' | 'Retirement' | 'Other income';
  entity: string;
  date: string;
  payer: string;
  amount: number;
  withholding: number;
  description: string;
  supportingDocName?: string;
  status: 'Draft' | 'Submitted' | 'Reviewed';
}

export interface ClientExpenseRecord {
  id: string;
  clientId: string;
  taxYear: number;
  date: string;
  vendor: string;
  amount: number;
  entity: string;
  businessPurpose: string;
  category: string;
  paymentMethod: 'Credit Card' | 'ACH / Bank' | 'Check' | 'Cash';
  receiptFileName?: string;
  status: 'Draft' | 'Submitted' | 'Reviewed';
  aiRecommendation?: {
    proposedCategory: string;
    confidence: number;
    explanation: string;
    supportingDoc?: string;
    accepted: boolean;
  };
}

export interface ClientReturnReviewData {
  returnId: string;
  clientId: string;
  clientName: string;
  entity: string;
  returnType: string;
  taxYear: number;
  preparationStatus: string;
  reviewerStatus: string;
  version: string;
  figures: {
    grossReceipts: number;
    totalDeductions: number;
    taxableOrdinaryIncome: number;
    credits: number;
    estimatedPaymentsMade: number;
    balanceDueOrRefund: number;
  };
  federalSummary: {
    form: string;
    lineItems: { line: string; description: string; amount: number }[];
  };
  stateSummary: {
    state: string;
    form: string;
    taxDue: number;
  };
  priorYearComparison: {
    priorTaxYear: number;
    priorGrossReceipts: number;
    priorTaxableIncome: number;
    percentageChange: string;
  };
  importantChanges: string[];
  openQuestions: string[];
  missingEvidence: string[];
  signatureRequired: boolean;
  signatureCertified: boolean;
  clientApprovedAt?: string;
  clientCorrectionRequested?: {
    fieldOrSection: string;
    explanation: string;
    evidenceName?: string;
    timestamp: string;
  };
}

export interface ClientInvoiceRecord {
  id: string;
  clientId: string;
  invoiceNumber: string;
  engagement: string;
  serviceDescription: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  credits: number;
  retainerApplied: number;
  amountPaid: number;
  balanceDue: number;
  status: 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Past Due' | 'Cancelled' | 'Disputed';
  lineItems: { description: string; hours?: number; rate?: number; amount: number }[];
  payments: Array<{
    paymentId: string;
    date: string;
    amount: number;
    method: string;
    receiptId: string;
    isSimulated: boolean;
  }>;
}

export interface ClientNoticeRecord {
  id: string;
  clientId: string;
  authority: 'IRS' | 'State Department of Revenue' | 'Local / Municipal';
  authorityName: string;
  noticeNumber: string;
  noticeTitle: string;
  taxYear: number;
  receivedDate: string;
  responseDeadline: string;
  daysRemaining: number;
  amountRequested: number;
  possibleCategory: string;
  requiredClientActions: string[];
  assignedProfessional: string;
  status: 
    | 'Received'
    | 'Processing'
    | 'Requires Client Information'
    | 'Under Professional Review'
    | 'Response Drafted'
    | 'Awaiting Client Approval'
    | 'Submitted — Demo Only'
    | 'Monitoring'
    | 'Resolved'
    | 'Closed';
  evidenceFiles: string[];
  summaryNotes: string;
  responseDraft?: string;
}

export interface ClientArchiveRecord {
  id: string;
  clientId: string;
  entity: string;
  taxYear: number;
  recordType: 
    | 'Final tax returns'
    | 'Government acknowledgements'
    | 'Financial statements'
    | 'Client-authorized workpapers'
    | 'Signed authorizations'
    | 'Tax plans'
    | 'Notices'
    | 'Responses'
    | 'Amendments'
    | 'Invoices'
    | 'Receipts';
  title: string;
  fileName: string;
  fileSize: string;
  issueDate: string;
  approvalStatus: 'Approved' | 'Certified' | 'Archived';
  filingStatus: 'Accepted by IRS' | 'Filed' | 'Exempt' | 'N/A';
  verificationId: string;
  demoSha256Hash: string;
  isReadOnly: boolean;
  mefSubmissionId?: string;
  acceptedAt?: string;
  amendmentStatus?: 'Original' | 'Amended' | 'Superseded';
}

export interface ClientNotification {
  id: string;
  clientId: string;
  title: string;
  message: string;
  type: 
    | 'document_received'
    | 'document_clarification'
    | 'organizer_incomplete'
    | 'organizer_submitted'
    | 'return_ready'
    | 'correction_requested'
    | 'signature_required'
    | 'invoice_issued'
    | 'payment_simulated'
    | 'notice_deadline'
    | 'filing_status_changed'
    | 'archived_available';
  targetNav: string;
  timestamp: string;
  isRead: boolean;
}

// ----------------------
// Central Service Interfaces
// ----------------------

export interface IClientDashboardService {
  getOverview(clientId: string): Promise<ClientOverviewData>;
}

export interface IEngagementService {
  getActiveEngagement(clientId: string): Promise<any>;
}

export interface IDocumentService {
  getDocuments(clientId: string): Promise<ClientDocumentRecord[]>;
  uploadDocument(payload: Omit<ClientDocumentRecord, 'id' | 'uploadedAt' | 'processingStage' | 'securityStatus' | 'reviewStatus' | 'version' | 'isDraft'>): Promise<ClientDocumentRecord>;
  replaceDocument(docId: string, fileName: string, fileSize: string): Promise<ClientDocumentRecord>;
  deleteDraftDocument(docId: string): Promise<boolean>;
  respondToDocumentQuestion(docId: string, response: string, author: string): Promise<boolean>;
}

export interface ITaxOrganizerService {
  getOrganizer(clientId: string, taxYear: number): Promise<TaxOrganizerState>;
  saveDraft(clientId: string, taxYear: number, partialData: Partial<TaxOrganizerState['sections']>): Promise<TaxOrganizerState>;
  submitOrganizer(clientId: string, taxYear: number): Promise<TaxOrganizerState>;
  reopenOrganizer(clientId: string, taxYear: number): Promise<TaxOrganizerState>;
}

export interface IIncomeExpenseService {
  getIncome(clientId: string): Promise<ClientIncomeRecord[]>;
  addIncome(payload: Omit<ClientIncomeRecord, 'id' | 'status'>): Promise<ClientIncomeRecord>;
  updateIncome(id: string, payload: Partial<ClientIncomeRecord>): Promise<ClientIncomeRecord>;
  deleteIncome(id: string): Promise<boolean>;

  getExpenses(clientId: string): Promise<ClientExpenseRecord[]>;
  addExpense(payload: Omit<ClientExpenseRecord, 'id' | 'status'>): Promise<ClientExpenseRecord>;
  updateExpense(id: string, payload: Partial<ClientExpenseRecord>): Promise<ClientExpenseRecord>;
  deleteExpense(id: string): Promise<boolean>;

  getAICategoryRecommendation(vendor: string, amount: number, purpose: string): Promise<{
    proposedCategory: string;
    confidence: number;
    explanation: string;
  }>;
}

export interface IReturnReviewService {
  getDraftReturn(clientId: string, taxYear: number): Promise<ClientReturnReviewData>;
  requestCorrection(clientId: string, returnId: string, section: string, explanation: string, evidenceName?: string): Promise<boolean>;
  approveReturn(clientId: string, returnId: string, version: string): Promise<boolean>;
  rejectReturn(clientId: string, returnId: string, comments: string): Promise<boolean>;
}

export interface IInvoiceService {
  getInvoices(clientId: string): Promise<ClientInvoiceRecord[]>;
  simulatePayment(invoiceId: string, amount: number, method: string): Promise<{
    success: boolean;
    receiptId: string;
    newBalance: number;
  }>;
  submitDispute(invoiceId: string, reason: string): Promise<boolean>;
  requestPaymentPlan(invoiceId: string, proposal: string): Promise<boolean>;
}

export interface ITaxNoticeService {
  getNotices(clientId: string): Promise<ClientNoticeRecord[]>;
  uploadNotice(payload: Omit<ClientNoticeRecord, 'id' | 'status' | 'daysRemaining' | 'evidenceFiles'>): Promise<ClientNoticeRecord>;
  uploadEvidence(noticeId: string, fileName: string): Promise<boolean>;
  requestRepresentation(noticeId: string): Promise<boolean>;
  closeNotice(noticeId: string): Promise<boolean>;
}

export interface IArchiveService {
  getArchiveRecords(clientId: string, filters?: { taxYear?: number; category?: string; search?: string }): Promise<ClientArchiveRecord[]>;
  requestAmendment(recordId: string, reason: string): Promise<boolean>;
  requestHistoricalRecord(recordId: string, reason: string): Promise<boolean>;
}

export interface INotificationService {
  getNotifications(clientId: string): Promise<ClientNotification[]>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(clientId: string): Promise<void>;
  addNotification(notification: Omit<ClientNotification, 'id' | 'timestamp' | 'isRead'>): Promise<void>;
}

export interface IAuditService {
  logEvent(event: {
    user: string;
    role: string;
    action: string;
    record: string;
    result: string;
    reason?: string;
  }): Promise<void>;
}


