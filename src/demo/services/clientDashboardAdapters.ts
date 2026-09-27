/**
 * A/R Tax Services, LLC - Client Dashboard Adapters
 * Provides Demo and Production adapter implementations for all 8 client sections.
 * Guarantees zero external network or banking calls in demo mode.
 */

import {
  IClientDashboardService,
  IEngagementService,
  IDocumentService,
  ITaxOrganizerService,
  IIncomeExpenseService,
  IReturnReviewService,
  IInvoiceService,
  ITaxNoticeService,
  IArchiveService,
  INotificationService,
  IAuditService,
  ClientOverviewData,
  ClientDocumentRecord,
  TaxOrganizerState,
  ClientIncomeRecord,
  ClientExpenseRecord,
  ClientReturnReviewData,
  ClientInvoiceRecord,
  ClientNoticeRecord,
  ClientArchiveRecord,
  ClientNotification
} from './clientDashboardInterfaces';

import { demoDataStore } from './DemoDataService';
import {
  INITIAL_CLIENT_INCOME,
  INITIAL_CLIENT_EXPENSES,
  INITIAL_TAX_ORGANIZER,
  INITIAL_DRAFT_RETURN,
  INITIAL_CLIENT_NOTICES,
  INITIAL_CLIENT_ARCHIVES,
  INITIAL_CLIENT_NOTIFICATIONS
} from './clientInitialData';

// ----------------------------------------------------------------------------
// Local Storage Persistent Helper for Client State
// ----------------------------------------------------------------------------
const CLIENT_STORAGE_KEY = 'ar_tax_client_dashboard_v2';

interface PersistentClientState {
  income: ClientIncomeRecord[];
  expenses: ClientExpenseRecord[];
  organizer: TaxOrganizerState;
  draftReturn: ClientReturnReviewData;
  notices: ClientNoticeRecord[];
  archives: ClientArchiveRecord[];
  notifications: ClientNotification[];
}

function loadPersistedClientState(): PersistentClientState {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(CLIENT_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // fallback to initial
    }
  }
  return {
    income: [...INITIAL_CLIENT_INCOME],
    expenses: [...INITIAL_CLIENT_EXPENSES],
    organizer: JSON.parse(JSON.stringify(INITIAL_TAX_ORGANIZER)),
    draftReturn: JSON.parse(JSON.stringify(INITIAL_DRAFT_RETURN)),
    notices: [...INITIAL_CLIENT_NOTICES],
    archives: [...INITIAL_CLIENT_ARCHIVES],
    notifications: [...INITIAL_CLIENT_NOTIFICATIONS]
  };
}

let clientState: PersistentClientState = loadPersistedClientState();

function savePersistedClientState(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(clientState));
    } catch {
      // storage unavailable or quota reached
    }
  }
}

export function resetClientDashboardData(): void {
  clientState = {
    income: [...INITIAL_CLIENT_INCOME],
    expenses: [...INITIAL_CLIENT_EXPENSES],
    organizer: JSON.parse(JSON.stringify(INITIAL_TAX_ORGANIZER)),
    draftReturn: JSON.parse(JSON.stringify(INITIAL_DRAFT_RETURN)),
    notices: [...INITIAL_CLIENT_NOTICES],
    archives: [...INITIAL_CLIENT_ARCHIVES],
    notifications: [...INITIAL_CLIENT_NOTIFICATIONS]
  };
  savePersistedClientState();
}

// ----------------------------------------------------------------------------
// 1. Client Dashboard Overview Service
// ----------------------------------------------------------------------------
export class DemoClientDashboardAdapter implements IClientDashboardService {
  async getOverview(clientId: string): Promise<ClientOverviewData> {
    const client = demoDataStore.getClientById(clientId) || demoDataStore.getClientById('cli_perotti');
    const engagement = demoDataStore.getEngagements().find(e => e.clientId === (client?.id || 'cli_perotti')) || demoDataStore.getEngagements()[0];
    const invoices = demoDataStore.getInvoices().filter(i => i.clientId === (client?.id || 'cli_perotti'));
    const totalBalance = invoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);
    const unreadNotifications = clientState.notifications.filter(n => !n.isRead).length;

    const stageMap: Record<string, number> = {
      'Onboard': 0, 'Collect': 1, 'Validate': 2, 'Record': 3, 'Reconcile': 4, 'Review': 5,
      'Report': 6, 'Plan': 7, 'Prepare Taxes': 8, 'Approve': 9, 'Sign': 10, 'File': 11,
      'Government Feedback': 12, 'Resolve': 13, 'Monitor': 14, 'Archive': 15, 'Renew': 16, 'Repeat': 17
    };

    const currentStage = engagement?.currentStage || 'Approve';
    const stageIndex = stageMap[currentStage] ?? 9;

    return {
      clientId: client?.id || 'cli_perotti',
      clientName: client?.name || 'Michael Perotti',
      activeEntity: client?.businessName || 'Perotti Capital Holdings LLC',
      tinMasked: client?.einOrSsnMasked || '***-**-4890',
      activeEngagementId: engagement?.id || 'eng_2025_perotti_1120s',
      engagementName: `${engagement?.taxYear || 2025} Corporate Tax Filing (${engagement?.formType || 'Form 1120-S'})`,
      taxYear: engagement?.taxYear || 2025,
      returnType: `${engagement?.formType || 'Form 1120-S'} & SC1120S`,
      currentLifecycleStage: currentStage,
      lifecycleStageIndex: stageIndex,
      completionPercentage: engagement?.completionPercentage || 78,
      immediateRequiredAction: engagement?.approvalState === 'Reviewer Approved'
        ? 'Review draft Form 1120-S and authorize electronic Form 8879-S signature'
        : 'Awaiting CPA review of submitted draft corrections',
      nextDeadline: engagement?.statutoryDeadline || 'March 15, 2026',
      missingInformationCount: engagement?.missingRequirements?.length || 2,
      documentsRequiringAttention: 1,
      organizerStatus: clientState.organizer.status as any,
      organizerCompletionPercent: clientState.organizer.completionPercentage,
      returnReviewStatus: clientState.draftReturn.clientApprovedAt
        ? 'Client Approved'
        : clientState.draftReturn.clientCorrectionRequested
        ? 'Correction Requested'
        : 'Reviewer Approved',
      signatureStatus: engagement?.approvalState === 'Signed & Ready to File' || engagement?.approvalState === 'Filed (Simulated)'
        ? 'Signed (Simulated)'
        : 'Signature Requested',
      filingStatus: engagement?.approvalState === 'Filed (Simulated)'
        ? 'Filed (Simulated)'
        : engagement?.approvalState === 'Signed & Ready to File'
        ? 'Ready to File'
        : 'Pending Review',
      invoiceStatus: totalBalance > 0 ? 'Unpaid Balance' : 'Paid',
      outstandingBalance: totalBalance,
      recentNotificationsCount: unreadNotifications,
      assignedTeam: {
        managingPrincipal: { name: 'Desmond Hinds, MSA', email: 'desmond.hinds@artaxservices.com' },
        seniorReviewer: { name: 'Elena Rostova, CPA', email: 'elena.rostova@artaxservices.com' },
        taxPreparer: { name: 'Marcus Vance, EA', email: 'marcus.vance@artaxservices.com' }
      }
    };
  }
}

// ----------------------------------------------------------------------------
// 2. Engagement Service
// ----------------------------------------------------------------------------
export class DemoEngagementAdapter implements IEngagementService {
  async getActiveEngagement(clientId: string): Promise<any> {
    const all = demoDataStore.getEngagements();
    return all.find(e => e.clientId === clientId) || all[0];
  }
}

// ----------------------------------------------------------------------------
// 3. Document Service
// ----------------------------------------------------------------------------
export class DemoDocumentAdapter implements IDocumentService {
  async getDocuments(clientId: string): Promise<ClientDocumentRecord[]> {
    const rawDocs = demoDataStore.getDocumentsByClient(clientId);
    return rawDocs.map((d, index) => ({
      id: d.id,
      clientId: d.clientId,
      engagementId: d.engagementId,
      fileName: d.fileName,
      fileSize: d.fileSize || '1.8 MB',
      fileType: d.fileType || 'application/pdf',
      category: d.category,
      taxYear: d.taxYear || 2025,
      entity: 'Perotti Capital Holdings LLC',
      uploadedAt: d.uploadedAt,
      uploadedBy: d.uploadedBy,
      processingStage: index === 0 ? 'Requires review' : 'Reviewed',
      securityStatus: 'Demo Security Verified — SHA-256 Passed',
      reviewStatus: d.status as any,
      version: 1,
      isDraft: index === 0,
      description: `Client tax document for ${d.category} (TY2025)`,
      summary: {
        detectedType: d.category,
        taxYear: d.taxYear || 2025,
        issuer: 'First Horizon Bank / Commercial Partner',
        recipient: 'Perotti Capital Holdings LLC',
        importantDates: ['2025-12-31', '2026-01-15'],
        keyAmounts: [
          { label: 'Reported Balance / Total', amount: '$142,500.00' },
          { label: 'Withholding', amount: '$0.00' }
        ],
        missingPages: [],
        questions: [],
        confidenceScore: 0.984
      },
      clientQuestions: []
    }));
  }

  async uploadDocument(payload: Omit<ClientDocumentRecord, 'id' | 'uploadedAt' | 'processingStage' | 'securityStatus' | 'reviewStatus' | 'version' | 'isDraft'>): Promise<ClientDocumentRecord> {
    const added = demoDataStore.uploadDocument({
      clientId: payload.clientId,
      fileName: payload.fileName,
      category: payload.category as any,
      uploadedBy: payload.uploadedBy,
      taxYear: payload.taxYear,
      fileSize: payload.fileSize,
      fileType: payload.fileType,
      notes: payload.description
    });

    demoDataStore.logAudit({
      user: payload.uploadedBy,
      role: 'client',
      action: 'Uploaded Document',
      record: `File: ${payload.fileName}`,
      result: 'Success (Simulated)',
      reason: 'Automated simulated security check completed clean.'
    });

    return {
      id: added.id,
      clientId: added.clientId,
      fileName: added.fileName,
      fileSize: added.fileSize || '1.2 MB',
      fileType: added.fileType || 'application/pdf',
      category: added.category,
      taxYear: added.taxYear || 2025,
      entity: payload.entity,
      uploadedAt: added.uploadedAt,
      uploadedBy: added.uploadedBy,
      processingStage: 'Requires review',
      securityStatus: 'Demo Security Verified — SHA-256 Passed',
      reviewStatus: 'Pending Review',
      version: 1,
      isDraft: true,
      description: payload.description,
      summary: {
        detectedType: added.category,
        taxYear: added.taxYear || 2025,
        issuer: 'Uploaded Source Document',
        recipient: 'Perotti Capital Holdings LLC',
        importantDates: [new Date().toISOString().slice(0, 10)],
        keyAmounts: [{ label: 'Gross Value', amount: '$12,450.00' }],
        missingPages: [],
        questions: [],
        confidenceScore: 0.97
      }
    };
  }

  async replaceDocument(docId: string, fileName: string, fileSize: string): Promise<ClientDocumentRecord> {
    const docs = demoDataStore.getDocuments();
    const doc = docs.find(d => d.id === docId);
    if (doc) {
      doc.fileName = fileName;
      doc.fileSize = fileSize;
      doc.uploadedAt = new Date().toISOString();
      demoDataStore.logAudit({
        user: 'Michael Perotti',
        role: 'client',
        action: 'Replaced Client Document',
        record: `Document: ${docId} with ${fileName}`,
        result: 'Success (Simulated)'
      });
    }
    return {
      id: docId,
      clientId: doc?.clientId || 'cli_perotti',
      fileName,
      fileSize,
      fileType: 'application/pdf',
      category: doc?.category || 'Supporting Document',
      taxYear: doc?.taxYear || 2025,
      entity: 'Perotti Capital Holdings LLC',
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Michael Perotti',
      processingStage: 'Awaiting security check',
      securityStatus: 'Clean (Simulated)',
      reviewStatus: 'Pending Review',
      version: 2,
      isDraft: true
    };
  }

  async deleteDraftDocument(docId: string): Promise<boolean> {
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Deleted Draft Document',
      record: `Doc ID: ${docId}`,
      result: 'Success (Simulated)'
    });
    return true;
  }

  async respondToDocumentQuestion(docId: string, response: string, author: string): Promise<boolean> {
    demoDataStore.logAudit({
      user: author,
      role: 'client',
      action: 'Responded to Document Question',
      record: `Doc ID: ${docId}`,
      result: 'Success (Simulated)',
      reason: response
    });
    return true;
  }
}

// ----------------------------------------------------------------------------
// 4. Tax Organizer Service
// ----------------------------------------------------------------------------
export class DemoTaxOrganizerAdapter implements ITaxOrganizerService {
  async getOrganizer(clientId: string, taxYear: number): Promise<TaxOrganizerState> {
    return JSON.parse(JSON.stringify(clientState.organizer));
  }

  async saveDraft(clientId: string, taxYear: number, partialData: Partial<TaxOrganizerState['sections']>): Promise<TaxOrganizerState> {
    clientState.organizer.sections = {
      ...clientState.organizer.sections,
      ...partialData
    };
    clientState.organizer.status = 'In Progress';
    savePersistedClientState();

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Saved Tax Organizer Draft',
      record: `Tax Year ${taxYear} Organizer`,
      result: 'Success (Simulated)'
    });

    return JSON.parse(JSON.stringify(clientState.organizer));
  }

  async submitOrganizer(clientId: string, taxYear: number): Promise<TaxOrganizerState> {
    clientState.organizer.status = 'Submitted';
    clientState.organizer.submittedAt = new Date().toISOString();
    clientState.organizer.completionPercentage = 100;
    savePersistedClientState();

    // Add notification
    clientState.notifications.unshift({
      id: `notif_${Date.now()}`,
      clientId,
      title: 'Tax Organizer Submitted',
      message: `Tax Year ${taxYear} organizer submitted for CPA review. A missing-document checklist has been generated.`,
      type: 'organizer_submitted',
      targetNav: 'questionnaire',
      timestamp: new Date().toISOString(),
      isRead: false
    });
    savePersistedClientState();

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Submitted Tax Organizer',
      record: `Tax Year ${taxYear} Organizer`,
      result: 'Success (Simulated)',
      reason: 'Client reviewed all 21 sections and completed electronic signature verification.'
    });

    return JSON.parse(JSON.stringify(clientState.organizer));
  }

  async reopenOrganizer(clientId: string, taxYear: number): Promise<TaxOrganizerState> {
    clientState.organizer.status = 'In Progress';
    savePersistedClientState();

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Reopened Tax Organizer for Edits',
      record: `Tax Year ${taxYear} Organizer`,
      result: 'Success (Simulated)'
    });

    return JSON.parse(JSON.stringify(clientState.organizer));
  }
}

// ----------------------------------------------------------------------------
// 5. Income & Expenses Service
// ----------------------------------------------------------------------------
export class DemoIncomeExpenseAdapter implements IIncomeExpenseService {
  async getIncome(clientId: string): Promise<ClientIncomeRecord[]> {
    return [...clientState.income];
  }

  async addIncome(payload: Omit<ClientIncomeRecord, 'id' | 'status'>): Promise<ClientIncomeRecord> {
    const newRecord: ClientIncomeRecord = {
      ...payload,
      id: `inc_${Date.now()}`,
      status: 'Submitted'
    };
    clientState.income.unshift(newRecord);
    savePersistedClientState();

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Added Client Income Record',
      record: `${newRecord.type}: ${newRecord.payer} ($${newRecord.amount.toFixed(2)})`,
      result: 'Success (Simulated)'
    });

    return newRecord;
  }

  async updateIncome(id: string, payload: Partial<ClientIncomeRecord>): Promise<ClientIncomeRecord> {
    const idx = clientState.income.findIndex(i => i.id === id);
    if (idx !== -1) {
      clientState.income[idx] = { ...clientState.income[idx], ...payload };
      savePersistedClientState();
      return clientState.income[idx];
    }
    throw new Error('Income record not found');
  }

  async deleteIncome(id: string): Promise<boolean> {
    clientState.income = clientState.income.filter(i => i.id !== id);
    savePersistedClientState();
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Deleted Draft Income Record',
      record: `Income ID: ${id}`,
      result: 'Success (Simulated)'
    });
    return true;
  }

  async getExpenses(clientId: string): Promise<ClientExpenseRecord[]> {
    return [...clientState.expenses];
  }

  async addExpense(payload: Omit<ClientExpenseRecord, 'id' | 'status'>): Promise<ClientExpenseRecord> {
    const recommendation = await this.getAICategoryRecommendation(
      payload.vendor,
      payload.amount,
      payload.businessPurpose
    );

    const newRecord: ClientExpenseRecord = {
      ...payload,
      id: `exp_${Date.now()}`,
      status: 'Submitted',
      aiRecommendation: {
        ...recommendation,
        accepted: true
      }
    };
    clientState.expenses.unshift(newRecord);
    savePersistedClientState();

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Added Business Expense Record',
      record: `${newRecord.vendor}: $${newRecord.amount.toFixed(2)} (${newRecord.category})`,
      result: 'Success (Simulated)',
      reason: recommendation.explanation
    });

    return newRecord;
  }

  async updateExpense(id: string, payload: Partial<ClientExpenseRecord>): Promise<ClientExpenseRecord> {
    const idx = clientState.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      clientState.expenses[idx] = { ...clientState.expenses[idx], ...payload };
      savePersistedClientState();
      return clientState.expenses[idx];
    }
    throw new Error('Expense record not found');
  }

  async deleteExpense(id: string): Promise<boolean> {
    clientState.expenses = clientState.expenses.filter(e => e.id !== id);
    savePersistedClientState();
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Deleted Business Expense Record',
      record: `Expense ID: ${id}`,
      result: 'Success (Simulated)'
    });
    return true;
  }

  async getAICategoryRecommendation(vendor: string, amount: number, purpose: string): Promise<{
    proposedCategory: string;
    confidence: number;
    explanation: string;
  }> {
    const lower = `${vendor} ${purpose}`.toLowerCase();
    if (lower.includes('lease') || lower.includes('rent')) {
      return {
        proposedCategory: 'Rent',
        confidence: 0.98,
        explanation: 'Identified as recurring real estate or equipment lease under IRC Sec. 162.'
      };
    }
    if (lower.includes('tax') || lower.includes('cpa') || lower.includes('attorney') || lower.includes('legal')) {
      return {
        proposedCategory: 'Legal and professional',
        confidence: 0.99,
        explanation: 'Professional services deduction under IRC Section 162(a).'
      };
    }
    if (lower.includes('flight') || lower.includes('hotel') || lower.includes('airline') || lower.includes('uber')) {
      return {
        proposedCategory: 'Travel',
        confidence: 0.95,
        explanation: 'Business travel expense substantiated with commercial vendor record.'
      };
    }
    if (lower.includes('dinner') || lower.includes('restaurant') || lower.includes('catering') || lower.includes('meal')) {
      return {
        proposedCategory: 'Meals',
        confidence: 0.93,
        explanation: 'Business meal subject to statutory 50% deduction limitation.'
      };
    }
    if (lower.includes('insurance') || lower.includes('liability')) {
      return {
        proposedCategory: 'Insurance',
        confidence: 0.97,
        explanation: 'Ordinary commercial risk coverage.'
      };
    }
    if (lower.includes('computer') || lower.includes('software') || lower.includes('office') || lower.includes('dell')) {
      return {
        proposedCategory: 'Supplies',
        confidence: 0.92,
        explanation: 'Tangible property de minimis safe harbor regulation.'
      };
    }
    return {
      proposedCategory: 'Other',
      confidence: 0.85,
      explanation: 'Simulated classification based on commercial vendor profile.'
    };
  }
}

// ----------------------------------------------------------------------------
// 6. Return Review Service
// ----------------------------------------------------------------------------
export class DemoReturnReviewAdapter implements IReturnReviewService {
  async getDraftReturn(clientId: string, taxYear: number): Promise<ClientReturnReviewData> {
    return JSON.parse(JSON.stringify(clientState.draftReturn));
  }

  async requestCorrection(
    clientId: string,
    returnId: string,
    section: string,
    explanation: string,
    evidenceName?: string
  ): Promise<boolean> {
    clientState.draftReturn.clientCorrectionRequested = {
      fieldOrSection: section,
      explanation,
      evidenceName,
      timestamp: new Date().toISOString()
    };
    savePersistedClientState();

    const engagements = demoDataStore.getEngagements();
    const eng = engagements.find(e => e.clientId === clientId);
    if (eng) {
      eng.approvalState = 'Corrections Required';
      eng.currentStatus = 'Corrections Required';
      eng.lastActivity = `Client requested correction on ${section}: "${explanation}".`;
    }

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Requested Return Correction',
      record: `Return: ${returnId} (Section: ${section})`,
      result: 'Warning (Simulated)',
      reason: explanation
    });

    return true;
  }

  async approveReturn(clientId: string, returnId: string, version: string): Promise<boolean> {
    clientState.draftReturn.clientApprovedAt = new Date().toISOString();
    clientState.draftReturn.signatureCertified = true;
    savePersistedClientState();

    const engagements = demoDataStore.getEngagements();
    const eng = engagements.find(e => e.clientId === clientId);
    if (eng) {
      eng.approvalState = 'Signed & Ready to File';
      eng.currentStage = 'File';
      eng.currentStatus = 'Ready to File';
      eng.lastActivity = `Michael Perotti approved draft return and signed Form 8879 authorization.`;
      eng.completionPercentage = 95;
    }

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Approved Draft Return and Form 8879',
      record: `Return: ${returnId} (${version})`,
      result: 'Success (Simulated)',
      reason: 'Client reviewed tax lines and granted electronic filing authorization.'
    });

    return true;
  }

  async rejectReturn(clientId: string, returnId: string, comments: string): Promise<boolean> {
    clientState.draftReturn.clientCorrectionRequested = {
      fieldOrSection: 'Entire Package',
      explanation: comments,
      timestamp: new Date().toISOString()
    };
    savePersistedClientState();

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Rejected Draft Return',
      record: `Return: ${returnId}`,
      result: 'Denied (Simulated)',
      reason: comments
    });

    return true;
  }
}

// ----------------------------------------------------------------------------
// 7. Fee Invoices Service
// ----------------------------------------------------------------------------
export class DemoInvoiceAdapter implements IInvoiceService {
  async getInvoices(clientId: string): Promise<ClientInvoiceRecord[]> {
    const rawInvoices = demoDataStore.getInvoices().filter(i => i.clientId === clientId);
    return rawInvoices.map(inv => ({
      id: inv.id,
      clientId: inv.clientId,
      invoiceNumber: inv.invoiceNumber,
      engagement: '2025 Corporate Tax Compliance & Advisory',
      serviceDescription: 'Tax Year 2025 Form 1120-S & SC1120S Preparation, Review & Filing',
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      subtotal: inv.amount,
      tax: 0.00,
      credits: 0.00,
      retainerApplied: 500.00,
      amountPaid: inv.amount - inv.balanceDue,
      balanceDue: inv.balanceDue,
      status: (inv.balanceDue === 0 ? 'Paid' : inv.status.includes('Paid') ? 'Paid' : 'Issued') as any,
      lineItems: [
        { description: 'Form 1120-S Federal Corporate Return Preparation', amount: 3200.00 },
        { description: 'South Carolina SC1120S State Flow-Through Return', amount: 800.00 },
        { description: 'Shareholder Schedule K-1 Preparation (2 Partners)', amount: 750.00 }
      ],
      payments: inv.balanceDue === 0 ? [
        {
          paymentId: `pay_${inv.id}`,
          date: new Date().toISOString().slice(0, 10),
          amount: inv.amount,
          method: 'Simulated Card (Ending 4242)',
          receiptId: `REC-${inv.invoiceNumber}-DEMO`,
          isSimulated: true
        }
      ] : []
    }));
  }

  async simulatePayment(invoiceId: string, amount: number, method: string): Promise<{
    success: boolean;
    receiptId: string;
    newBalance: number;
  }> {
    demoDataStore.payInvoiceSimulated(invoiceId, 'Michael Perotti');
    const receiptId = `REC-SIM-${Date.now().toString().slice(-6)}`;

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Executed Simulated Invoice Payment',
      record: `Invoice: ${invoiceId} ($${amount.toFixed(2)}) via ${method}`,
      result: 'Success (Simulated)',
      reason: 'Simulated payment processed. No real funds were moved.'
    });

    return {
      success: true,
      receiptId,
      newBalance: 0
    };
  }

  async submitDispute(invoiceId: string, reason: string): Promise<boolean> {
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Submitted Invoice Billing Inquiry / Dispute',
      record: `Invoice: ${invoiceId}`,
      result: 'Warning (Simulated)',
      reason
    });
    return true;
  }

  async requestPaymentPlan(invoiceId: string, proposal: string): Promise<boolean> {
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Requested Installment Payment Plan',
      record: `Invoice: ${invoiceId}`,
      result: 'Success (Simulated)',
      reason: proposal
    });
    return true;
  }
}

// ----------------------------------------------------------------------------
// 8. Tax Notice Service
// ----------------------------------------------------------------------------
export class DemoTaxNoticeAdapter implements ITaxNoticeService {
  async getNotices(clientId: string): Promise<ClientNoticeRecord[]> {
    return [...clientState.notices];
  }

  async uploadNotice(payload: Omit<ClientNoticeRecord, 'id' | 'status' | 'daysRemaining' | 'evidenceFiles'>): Promise<ClientNoticeRecord> {
    const newNotice: ClientNoticeRecord = {
      ...payload,
      id: `not_${Date.now()}`,
      status: 'Processing',
      daysRemaining: 30,
      evidenceFiles: []
    };
    clientState.notices.unshift(newNotice);
    savePersistedClientState();

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Uploaded Government Tax Notice',
      record: `${newNotice.authority}: ${newNotice.noticeNumber} - ${newNotice.noticeTitle}`,
      result: 'Success (Simulated)',
      reason: 'AI demo summary generated for CPA controversy review.'
    });

    return newNotice;
  }

  async uploadEvidence(noticeId: string, fileName: string): Promise<boolean> {
    const notice = clientState.notices.find(n => n.id === noticeId);
    if (notice) {
      notice.evidenceFiles.push(fileName);
      savePersistedClientState();
      demoDataStore.logAudit({
        user: 'Michael Perotti',
        role: 'client',
        action: 'Uploaded Evidence for Tax Notice',
        record: `Notice: ${noticeId}, File: ${fileName}`,
        result: 'Success (Simulated)'
      });
    }
    return true;
  }

  async requestRepresentation(noticeId: string): Promise<boolean> {
    const notice = clientState.notices.find(n => n.id === noticeId);
    if (notice) {
      notice.status = 'Under Professional Review';
      savePersistedClientState();
      demoDataStore.logAudit({
        user: 'Michael Perotti',
        role: 'client',
        action: 'Requested Representation (Form 2848 Power of Attorney)',
        record: `Notice: ${noticeId}`,
        result: 'Success (Simulated)',
        reason: 'Authorized Elena Rostova, CPA to represent entity before agency.'
      });
    }
    return true;
  }

  async closeNotice(noticeId: string): Promise<boolean> {
    const notice = clientState.notices.find(n => n.id === noticeId);
    if (notice) {
      notice.status = 'Closed';
      savePersistedClientState();
      demoDataStore.logAudit({
        user: 'Michael Perotti',
        role: 'client',
        action: 'Closed Resolved Notice',
        record: `Notice: ${noticeId}`,
        result: 'Success (Simulated)'
      });
    }
    return true;
  }
}

// ----------------------------------------------------------------------------
// 9. Prior Year Archive Service
// ----------------------------------------------------------------------------
export class DemoArchiveAdapter implements IArchiveService {
  async getArchiveRecords(clientId: string, filters?: { taxYear?: number; category?: string; search?: string }): Promise<ClientArchiveRecord[]> {
    let list = [...clientState.archives];
    if (filters?.taxYear) {
      list = list.filter(r => r.taxYear === filters.taxYear);
    }
    if (filters?.category) {
      list = list.filter(r => r.recordType === filters.category);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(r => r.title.toLowerCase().includes(q) || r.fileName.toLowerCase().includes(q));
    }
    return list;
  }

  async requestAmendment(recordId: string, reason: string): Promise<boolean> {
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Requested Prior Year Return Amendment',
      record: `Archive Record: ${recordId}`,
      result: 'Success (Simulated)',
      reason
    });
    return true;
  }

  async requestHistoricalRecord(recordId: string, reason: string): Promise<boolean> {
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Requested Certified Historical Archival Copy',
      record: `Archive Record: ${recordId}`,
      result: 'Success (Simulated)',
      reason
    });
    return true;
  }
}

// ----------------------------------------------------------------------------
// 10. Notification Service
// ----------------------------------------------------------------------------
export class DemoNotificationAdapter implements INotificationService {
  async getNotifications(clientId: string): Promise<ClientNotification[]> {
    return [...clientState.notifications];
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notif = clientState.notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.isRead = true;
      savePersistedClientState();
    }
  }

  async markAllAsRead(clientId: string): Promise<void> {
    clientState.notifications.forEach(n => { n.isRead = true; });
    savePersistedClientState();
  }

  async addNotification(notification: Omit<ClientNotification, 'id' | 'timestamp' | 'isRead'>): Promise<void> {
    clientState.notifications.unshift({
      ...notification,
      id: `notif_${Date.now()}`,
      timestamp: new Date().toISOString(),
      isRead: false
    });
    savePersistedClientState();
  }
}

// ----------------------------------------------------------------------------
// 11. Audit Service
// ----------------------------------------------------------------------------
export class DemoAuditAdapter implements IAuditService {
  async logEvent(event: {
    user: string;
    role: string;
    action: string;
    record: string;
    result: string;
    reason?: string;
  }): Promise<void> {
    demoDataStore.logAudit({
      user: event.user,
      role: event.role as any,
      action: event.action,
      record: event.record,
      result: event.result as any,
      reason: event.reason
    });
  }
}

// ----------------------------------------------------------------------------
// Production Adapter Placeholders (Clearly not configured)
// ----------------------------------------------------------------------------
export class ProductionClientDashboardAdapter implements IClientDashboardService {
  async getOverview(clientId: string): Promise<ClientOverviewData> {
    throw new Error('Production client dashboard service integration not configured.');
  }
}

// ----------------------------------------------------------------------------
// Service Instances (Defaulted to Demo Adapters)
// ----------------------------------------------------------------------------
export const clientDashboardService: IClientDashboardService = new DemoClientDashboardAdapter();
export const clientEngagementService: IEngagementService = new DemoEngagementAdapter();
export const clientDocumentService: IDocumentService = new DemoDocumentAdapter();
export const clientOrganizerService: ITaxOrganizerService = new DemoTaxOrganizerAdapter();
export const clientIncomeExpenseService: IIncomeExpenseService = new DemoIncomeExpenseAdapter();
export const clientReturnReviewService: IReturnReviewService = new DemoReturnReviewAdapter();
export const clientInvoiceService: IInvoiceService = new DemoInvoiceAdapter();
export const clientNoticeService: ITaxNoticeService = new DemoTaxNoticeAdapter();
export const clientArchiveService: IArchiveService = new DemoArchiveAdapter();
export const clientNotificationService: INotificationService = new DemoNotificationAdapter();
export const clientAuditService: IAuditService = new DemoAuditAdapter();
