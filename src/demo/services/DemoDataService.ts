/**
 * A/R Tax Services, LLC - Central Demonstration Data Store
 * Provides stateful, reactive demonstration operations with audit logging.
 */

import { 
  DemoClient, 
  DemoEngagement, 
  DemoDocument, 
  DemoTransaction, 
  DemoReconciliationItem, 
  DemoPayrollRecord, 
  DemoTaxWorkpaper, 
  DemoAdvisoryCase, 
  DemoInvoice, 
  DemoAuditEvent,
  UnifiedStatus,
  WorkCycleStage,
  DemoRole,
  IntegrationRegistryItem,
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
} from '../types';

import { 
  INITIAL_DEMO_CLIENTS, 
  INITIAL_DEMO_ENGAGEMENTS, 
  INITIAL_DEMO_DOCUMENTS, 
  INITIAL_DEMO_TRANSACTIONS, 
  INITIAL_DEMO_RECONCILIATIONS, 
  INITIAL_DEMO_PAYROLL, 
  INITIAL_DEMO_WORKPAPERS, 
  INITIAL_DEMO_ADVISORY, 
  INITIAL_DEMO_INVOICES, 
  INITIAL_DEMO_AUDIT_LOGS,
  FUTURE_INTEGRATION_REGISTRY
} from '../mockData';

import {
  INITIAL_DEMO_HANDOFFS,
  INITIAL_DEMO_AGENCIES,
  INITIAL_DEMO_FEEDBACK,
  INITIAL_DEMO_INQUIRIES,
  INITIAL_DEMO_APPOINTMENTS,
  INITIAL_DEMO_CALLS,
  INITIAL_DEMO_CHANGE_ORDERS,
  INITIAL_DEMO_WORKLOAD_TIMELINE,
  INITIAL_DEMO_VERIFICATIONS,
  INITIAL_DEMO_INTAKE_DOCS,
  INITIAL_DEMO_DATA_BATCHES,
  INITIAL_DEMO_CASH_ENTRIES,
  INITIAL_DEMO_AP_BILLS,
  INITIAL_DEMO_PAYMENT_BATCHES,
  INITIAL_DEMO_AR_RECORDS,
  INITIAL_DEMO_PAYMENT_PLANS,
  INITIAL_DEMO_QC_INSPECTIONS,
  INITIAL_DEMO_FILING_BATCHES,
  INITIAL_DEMO_ACKS,
  INITIAL_DEMO_NOTICES,
  INITIAL_DEMO_RESOLUTION_CASES,
  INITIAL_DEMO_AUDIT_CASES,
  INITIAL_DEMO_AMENDMENTS,
  INITIAL_DEMO_ARCHIVES,
  INITIAL_DEMO_RENEWALS,
  INITIAL_DEMO_SUPPORT_TICKETS
} from '../lifecycleMockData';
import { resetClientDashboardData } from './clientDashboardAdapters';

class DemoDataStore {
  private readonly STORAGE_KEY = 'ar_tax_demo_datastore_v2';

  constructor() {
    this.loadFromStorage();
  }

  private clients: DemoClient[] = [...INITIAL_DEMO_CLIENTS];
  private engagements: DemoEngagement[] = [...INITIAL_DEMO_ENGAGEMENTS];
  private documents: DemoDocument[] = [...INITIAL_DEMO_DOCUMENTS];
  private transactions: DemoTransaction[] = [...INITIAL_DEMO_TRANSACTIONS];
  private reconciliations: DemoReconciliationItem[] = [...INITIAL_DEMO_RECONCILIATIONS];
  private payroll: DemoPayrollRecord[] = [...INITIAL_DEMO_PAYROLL];
  private workpapers: DemoTaxWorkpaper[] = [...INITIAL_DEMO_WORKPAPERS];
  private advisoryCases: DemoAdvisoryCase[] = [...INITIAL_DEMO_ADVISORY];
  private invoices: DemoInvoice[] = [...INITIAL_DEMO_INVOICES];
  private auditLogs: DemoAuditEvent[] = [...INITIAL_DEMO_AUDIT_LOGS];

  // Extended Lifecycle Collections
  private handoffs: DemoHandoff[] = [...INITIAL_DEMO_HANDOFFS];
  private agencies: GovernmentAgencyAuthority[] = [...INITIAL_DEMO_AGENCIES];
  private feedbackRecords: GovernmentFeedbackRecord[] = [...INITIAL_DEMO_FEEDBACK];
  private inquiries: ReceptionInquiry[] = [...INITIAL_DEMO_INQUIRIES];
  private appointments: AppointmentRecord[] = [...INITIAL_DEMO_APPOINTMENTS];
  private callLogs: CallLogRecord[] = [...INITIAL_DEMO_CALLS];
  private changeOrders: ScopeChangeOrder[] = [...INITIAL_DEMO_CHANGE_ORDERS];
  private workloadTimeline: WorkloadTimelineItem[] = [...INITIAL_DEMO_WORKLOAD_TIMELINE];
  private verifications: IdentityVerificationRecord[] = [...INITIAL_DEMO_VERIFICATIONS];
  private intakeDocs: IntakeDocumentRecord[] = [...INITIAL_DEMO_INTAKE_DOCS];
  private dataBatches: DataEntryBatch[] = [...INITIAL_DEMO_DATA_BATCHES];
  private cashEntries: CashTransactionEntry[] = [...INITIAL_DEMO_CASH_ENTRIES];
  private apBills: VendorBillRecord[] = [...INITIAL_DEMO_AP_BILLS];
  private paymentBatches: PaymentBatchRecord[] = [...INITIAL_DEMO_PAYMENT_BATCHES];
  private arRecords: ClientArRecord[] = [...INITIAL_DEMO_AR_RECORDS];
  private paymentPlans: PaymentPlanRecord[] = [...INITIAL_DEMO_PAYMENT_PLANS];
  private qcInspections: QualityInspectionRecord[] = [...INITIAL_DEMO_QC_INSPECTIONS];
  private filingBatches: FilingSubmissionBatch[] = [...INITIAL_DEMO_FILING_BATCHES];
  private acks: AcknowledgementRecord[] = [...INITIAL_DEMO_ACKS];
  private notices: GovernmentNoticeRecord[] = [...INITIAL_DEMO_NOTICES];
  private resolutionCases: TaxResolutionCase[] = [...INITIAL_DEMO_RESOLUTION_CASES];
  private auditCases: AuditCaseRecord[] = [...INITIAL_DEMO_AUDIT_CASES];
  private amendments: AmendmentCaseRecord[] = [...INITIAL_DEMO_AMENDMENTS];
  private archives: ArchiveRecord[] = [...INITIAL_DEMO_ARCHIVES];
  private renewals: ClientRenewalRecord[] = [...INITIAL_DEMO_RENEWALS];
  private supportTickets: SupportTicketRecord[] = [...INITIAL_DEMO_SUPPORT_TICKETS];

  private listeners: Array<() => void> = [];

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private loadFromStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.clients) this.clients = parsed.clients;
          if (parsed.engagements) this.engagements = parsed.engagements;
          if (parsed.documents) this.documents = parsed.documents;
          if (parsed.transactions) this.transactions = parsed.transactions;
          if (parsed.reconciliations) this.reconciliations = parsed.reconciliations;
          if (parsed.payroll) this.payroll = parsed.payroll;
          if (parsed.workpapers) this.workpapers = parsed.workpapers;
          if (parsed.advisoryCases) this.advisoryCases = parsed.advisoryCases;
          if (parsed.invoices) this.invoices = parsed.invoices;
          if (parsed.auditLogs) this.auditLogs = parsed.auditLogs;
        }
      } catch {
        // ignore load errors
      }
    }
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const state = {
          clients: this.clients,
          engagements: this.engagements,
          documents: this.documents,
          transactions: this.transactions,
          reconciliations: this.reconciliations,
          payroll: this.payroll,
          workpapers: this.workpapers,
          advisoryCases: this.advisoryCases,
          invoices: this.invoices,
          auditLogs: this.auditLogs
        };
        window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore save errors
      }
    }
  }

  private clearStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(this.STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }

  private notify(): void {
    this.saveToStorage();
    this.listeners.forEach(cb => cb());
  }

  // --- Audit Log ---
  public logAudit(event: Omit<DemoAuditEvent, 'id' | 'timestamp'>): void {
    const newEntry: DemoAuditEvent = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    this.auditLogs.unshift(newEntry);
    this.notify();
  }

  public getAuditLogs(): DemoAuditEvent[] {
    return [...this.auditLogs];
  }

  // --- Clients ---
  public getClients(): DemoClient[] {
    return [...this.clients];
  }

  public getClientById(id: string): DemoClient | undefined {
    return this.clients.find(c => c.id === id);
  }

  public updateClientStatus(clientId: string, status: UnifiedStatus, actor: string, role: DemoRole): void {
    const client = this.clients.find(c => c.id === clientId);
    if (client) {
      const oldStatus = client.status;
      client.status = status;
      this.logAudit({
        user: actor,
        role,
        action: 'Updated Client Status',
        record: `Client: ${client.name} (${client.id})`,
        result: 'Success (Simulated)',
        previousValue: oldStatus,
        newValue: status
      });
      this.notify();
    }
  }

  // --- Engagements ---
  public getEngagements(): DemoEngagement[] {
    return [...this.engagements];
  }

  public getEngagementById(id: string): DemoEngagement | undefined {
    return this.engagements.find(e => e.id === id);
  }

  public updateEngagementStage(
    id: string, 
    stage: WorkCycleStage, 
    status: UnifiedStatus, 
    actor: string, 
    role: DemoRole, 
    notes?: string
  ): void {
    const eng = this.engagements.find(e => e.id === id);
    if (eng) {
      const prev = `${eng.currentStage} / ${eng.currentStatus}`;
      eng.currentStage = stage;
      eng.currentStatus = status;
      eng.lastActivity = `${actor} moved engagement to ${stage} (${status}).`;
      this.logAudit({
        user: actor,
        role,
        action: 'Transitioned Work-Cycle Stage',
        record: `Engagement: ${eng.formType} - ${eng.clientName}`,
        result: 'Success (Simulated)',
        previousValue: prev,
        newValue: `${stage} / ${status}`,
        reason: notes
      });
      this.notify();
    }
  }

  /**
   * Submit prepared return package for Senior Reviewer / CPA certification.
   */
  public submitForSeniorReview(
    id: string,
    preparerName: string,
    preparerId: string
  ): { success: boolean; error?: string } {
    const eng = this.engagements.find(e => e.id === id);
    if (!eng) return { success: false, error: 'Engagement not found.' };

    eng.approvalState = 'Pending Review';
    eng.currentStage = 'Approve';
    eng.currentStatus = 'Senior Review';
    eng.assignedPreparerId = preparerId;
    eng.lastActivity = `${preparerName} finalized draft calculations and submitted return package for Senior CPA Review.`;
    eng.completionPercentage = Math.max(eng.completionPercentage, 65);

    this.logAudit({
      user: preparerName,
      role: 'accountant',
      action: 'Submitted Return for Senior Review',
      record: `Engagement: ${eng.id} (${eng.formType})`,
      result: 'Success (Simulated)',
      reason: 'Draft return prepared, diagnostics passed, workpapers tied out.'
    });

    this.notify();
    return { success: true };
  }

  /**
   * Maker-Checker Rule: Preparer cannot approve own return!
   */
  public approveEngagementByReviewer(
    id: string, 
    reviewerName: string, 
    reviewerId: string
  ): { success: boolean; error?: string } {
    const eng = this.engagements.find(e => e.id === id);
    if (!eng) return { success: false, error: 'Engagement record not found.' };

    // Strict Maker-Checker enforcement
    if (eng.assignedPreparerId === reviewerId) {
      this.logAudit({
        user: reviewerName,
        role: 'reviewer',
        action: 'Maker-Checker Violation Blocked',
        record: `Engagement: ${eng.id}`,
        result: 'Denied (Simulated)',
        reason: 'Preparer is legally and procedurally prohibited from performing final CPA quality certification on their own return workpapers.'
      });
      return {
        success: false,
        error: 'Maker-Checker Gate Violation: Preparer cannot approve or sign off on their own prepared return.'
      };
    }

    eng.approvalState = 'Reviewer Approved';
    eng.currentStage = 'Approve';
    eng.currentStatus = 'Ready for Client Review';
    eng.lastActivity = `${reviewerName} certified workpapers and released return for client signature demonstration.`;
    eng.completionPercentage = 85;

    this.logAudit({
      user: reviewerName,
      role: 'reviewer',
      action: 'Approved Final Return Package',
      record: `Engagement: ${eng.id} (${eng.formType})`,
      result: 'Success (Simulated)',
      reason: 'All technical tax lines, schedules, and book-to-tax adjustments verified.'
    });

    this.notify();
    return { success: true };
  }

  public rejectEngagementByReviewer(
    id: string, 
    reviewerName: string, 
    rejectionReason: string
  ): void {
    const eng = this.engagements.find(e => e.id === id);
    if (eng) {
      eng.approvalState = 'Corrections Required';
      eng.currentStatus = 'Corrections Required';
      eng.lastActivity = `${reviewerName} returned for correction: ${rejectionReason}`;
      eng.missingRequirements.push(`Reviewer Notice: ${rejectionReason}`);

      this.logAudit({
        user: reviewerName,
        role: 'reviewer',
        action: 'Returned with Correction Notice',
        record: `Engagement: ${eng.id}`,
        result: 'Warning (Simulated)',
        reason: rejectionReason
      });

      this.notify();
    }
  }

  public assignStaff(engagementId: string, preparerId: string, reviewerId: string, actor: string): void {
    const eng = this.engagements.find(e => e.id === engagementId);
    if (eng) {
      eng.assignedPreparerId = preparerId;
      eng.assignedReviewerId = reviewerId;
      this.logAudit({
        user: actor,
        role: 'engagement-manager',
        action: 'Assigned Preparer and Reviewer',
        record: `Engagement: ${eng.clientName} (${eng.formType})`,
        result: 'Success (Simulated)',
        reason: `Preparer: ${preparerId} | Reviewer: ${reviewerId}`
      });
      this.notify();
    }
  }

  public updateEngagementStatus(engagementId: string, status: UnifiedStatus, actor: string, reason?: string): void {
    const eng = this.engagements.find(e => e.id === engagementId);
    if (eng) {
      const prev = eng.currentStatus;
      eng.currentStatus = status;
      eng.lastActivity = `${actor}: ${reason || status}`;
      this.logAudit({
        user: actor,
        role: 'engagement-manager',
        action: 'Updated Engagement Status',
        record: `Engagement: ${eng.clientName} (${eng.formType})`,
        result: 'Success (Simulated)',
        previousValue: prev,
        newValue: status,
        reason
      });
      this.notify();
    }
  }

  public clientSignReturn(id: string, clientName: string): void {
    const eng = this.engagements.find(e => e.id === id);
    if (eng) {
      eng.approvalState = 'Signed & Ready to File';
      eng.currentStage = 'File';
      eng.currentStatus = 'Ready to File';
      eng.lastActivity = `${clientName} completed Form 8879 authorization e-signature (Simulated).`;
      eng.completionPercentage = 95;

      this.logAudit({
        user: clientName,
        role: 'client',
        action: 'Simulated Form 8879 E-Signature',
        record: `Engagement: ${eng.id}`,
        result: 'Success (Simulated)',
        reason: 'Authorized simulated IRS MeF electronic transmission.'
      });

      this.notify();
    }
  }

  public fileReturnSimulated(id: string, actor: string, role: DemoRole): void {
    const eng = this.engagements.find(e => e.id === id);
    if (eng) {
      eng.approvalState = 'Filed (Simulated)';
      eng.currentStage = 'Monitor';
      eng.currentStatus = 'Accepted—Simulated';
      eng.lastActivity = `Simulated IRS/State MeF submission completed. Acceptance acknowledgment received (Simulated Demo Only).`;
      eng.completionPercentage = 100;

      this.logAudit({
        user: actor,
        role,
        action: 'Simulated Electronic Tax Filing',
        record: `Engagement: ${eng.id} (${eng.formType})`,
        result: 'Success (Simulated)',
        reason: 'Simulated test submission to mock IRS electronic gateway.'
      });

      this.notify();
    }
  }

  public rollForwardEngagement(id: string, actor: string, role: DemoRole): DemoEngagement | undefined {
    const oldEng = this.engagements.find(e => e.id === id);
    if (!oldEng) return undefined;

    const newYear = oldEng.taxYear + 1;
    const newId = `eng_${newYear}_${oldEng.clientId.replace('cli_', '')}_rolled`;
    
    const newEng: DemoEngagement = {
      ...oldEng,
      id: newId,
      taxYear: newYear,
      currentStage: 'Collect',
      currentStatus: 'Awaiting Documents',
      completionPercentage: 10,
      approvalState: 'Pending Preparation',
      statutoryDeadline: `March 15, ${newYear + 1}`,
      internalDeadline: `March 1, ${newYear + 1}`,
      lastActivity: `Rolled forward from Tax Year ${oldEng.taxYear} by ${actor}.`,
      nextAction: `Issue Tax Year ${newYear} document collection packet to client.`,
      missingRequirements: ['Prior Year Tax Organizer Updates', 'Current Year W-2 / 1099 Statements'],
      feeStatus: 'Unbilled',
      isRolledForward: true
    };

    oldEng.isArchived = true;
    oldEng.currentStatus = 'Archived';
    this.engagements.unshift(newEng);

    this.logAudit({
      user: actor,
      role,
      action: 'Rolled Forward Tax Engagement',
      record: `New Engagement: ${newId} (TY${newYear})`,
      result: 'Success (Simulated)',
      reason: `Rolled forward master profile from prior TY${oldEng.taxYear}.`
    });

    this.notify();
    return newEng;
  }

  // --- Documents ---
  public getDocuments(): DemoDocument[] {
    return [...this.documents];
  }

  public getDocumentsByClient(clientId: string): DemoDocument[] {
    return this.documents.filter(d => d.clientId === clientId);
  }

  public uploadDocument(doc: Omit<DemoDocument, 'id' | 'uploadedAt' | 'sha256Hash' | 'malwareScanStatus' | 'status'>): DemoDocument {
    const newDoc: DemoDocument = {
      ...doc,
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      uploadedAt: new Date().toISOString(),
      sha256Hash: `sim_${Math.random().toString(36).substr(2, 10)}${Math.random().toString(36).substr(2, 10)}`,
      malwareScanStatus: 'clean (simulated)',
      status: 'Pending Review'
    };

    this.documents.unshift(newDoc);

    this.logAudit({
      user: doc.uploadedBy,
      role: 'client',
      action: 'Uploaded Document',
      record: `File: ${newDoc.fileName} (${newDoc.category})`,
      result: 'Success (Simulated)',
      reason: 'Client-side SHA-256 hash computed and anti-malware scan simulated clean.'
    });

    this.notify();
    return newDoc;
  }

  // --- Transactions ---
  public getTransactions(): DemoTransaction[] {
    return [...this.transactions];
  }

  public categorizeTransaction(txnId: string, category: string, actor: string, role: DemoRole): void {
    const txn = this.transactions.find(t => t.id === txnId);
    if (txn) {
      txn.category = category;
      txn.status = 'Categorized';
      this.logAudit({
        user: actor,
        role,
        action: 'Categorized Bank Transaction',
        record: `Txn: ${txn.description} ($${txn.amount})`,
        result: 'Success (Simulated)',
        newValue: category
      });
      this.notify();
    }
  }

  public updateTransactionCategory(txnId: string, category: string, actor: string = 'Sarah Jenkins', role: DemoRole = 'bookkeeper'): void {
    this.categorizeTransaction(txnId, category, actor, role);
  }

  // --- Invoices & Simulated Payment ---
  public getInvoices(): DemoInvoice[] {
    return [...this.invoices];
  }

  public payInvoiceSimulated(invoiceId: string, clientName: string): void {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (inv) {
      inv.balanceDue = 0.00;
      inv.status = 'Paid (Simulated)';

      this.logAudit({
        user: clientName,
        role: 'client',
        action: 'Simulated Fee Payment',
        record: `Invoice ${inv.invoiceNumber} ($${inv.amount.toFixed(2)})`,
        result: 'Success (Simulated)',
        reason: 'Simulated payment completed in demonstration mode. No card or bank funds were moved.'
      });

      this.notify();
    }
  }

  // --- Workpapers ---
  public getWorkpapers(): DemoTaxWorkpaper[] {
    return [...this.workpapers];
  }

  // --- Reconciliations ---
  public getReconciliations(): DemoReconciliationItem[] {
    return [...this.reconciliations];
  }

  // --- Payroll ---
  public getPayroll(): DemoPayrollRecord[] {
    return [...this.payroll];
  }

  // --- Advisory ---
  public getAdvisoryCases(): DemoAdvisoryCase[] {
    return [...this.advisoryCases];
  }

  // --- Integrations ---
  public getIntegrationRegistry(): IntegrationRegistryItem[] {
    return [...FUTURE_INTEGRATION_REGISTRY];
  }

  // --- Extended Lifecycle Accessors & Operations ---
  public getHandoffs(): DemoHandoff[] {
    return [...this.handoffs];
  }

  public getHandoffsForRole(role: DemoRole): DemoHandoff[] {
    return this.handoffs.filter(h => h.toRole === role || h.fromRole === role);
  }

  public createHandoff(handoff: Omit<DemoHandoff, 'id'>, actor: string): DemoHandoff {
    const newHandoff: DemoHandoff = {
      id: `hnd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      ...handoff
    };
    this.handoffs.unshift(newHandoff);
    this.logAudit({
      user: actor,
      role: handoff.fromRole,
      action: `Created Handoff to ${handoff.toRole}`,
      record: `${handoff.client} - ${handoff.engagement}`,
      result: 'Success (Simulated)',
      reason: handoff.reason
    });
    this.notify();
    return newHandoff;
  }

  public acceptHandoff(handoffId: string, actor: string, role: DemoRole): void {
    const item = this.handoffs.find(h => h.id === handoffId);
    if (item) {
      item.acceptanceStatus = 'Accepted';
      item.acceptedBy = actor;
      item.acceptedTimestamp = new Date().toISOString();
      this.logAudit({
        user: actor,
        role: role,
        action: `Accepted Handoff from ${item.fromRole}`,
        record: `${item.client} - Stage: ${item.currentStage}`,
        result: 'Success (Simulated)',
        reason: 'Staff member accepted responsibilities and workpapers.'
      });
      this.notify();
    }
  }

  public rejectHandoff(handoffId: string, reason: string, actor: string, role: DemoRole): void {
    const item = this.handoffs.find(h => h.id === handoffId);
    if (item) {
      item.acceptanceStatus = 'Rejected';
      item.rejectionReason = reason;
      this.logAudit({
        user: actor,
        role: role,
        action: `Rejected Handoff from ${item.fromRole}`,
        record: `${item.client} - Stage: ${item.currentStage}`,
        result: 'Warning (Simulated)',
        reason: reason
      });
      this.notify();
    }
  }

  public escalateHandoff(handoffId: string, reason: string, actor: string, role: DemoRole): void {
    const item = this.handoffs.find(h => h.id === handoffId);
    if (item) {
      item.acceptanceStatus = 'Escalated';
      item.escalationStatus = `Escalated to Operations Director: ${reason}`;
      this.logAudit({
        user: actor,
        role: role,
        action: 'Escalated Bottleneck Handoff',
        record: `${item.client} - Stage: ${item.currentStage}`,
        result: 'Warning (Simulated)',
        reason: reason
      });
      this.notify();
    }
  }

  public getAgencies(): GovernmentAgencyAuthority[] {
    return [...this.agencies];
  }

  public getFeedbackRecords(): GovernmentFeedbackRecord[] {
    return [...this.feedbackRecords];
  }

  public getInquiries(): ReceptionInquiry[] {
    return [...this.inquiries];
  }

  public addInquiry(inquiry: Omit<ReceptionInquiry, 'id' | 'createdAt'>): ReceptionInquiry {
    const newInquiry: ReceptionInquiry = {
      id: `inq_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...inquiry
    };
    this.inquiries.unshift(newInquiry);
    this.logAudit({
      user: 'Front Desk Reception',
      role: 'reception',
      action: 'Registered Client Inquiry',
      record: inquiry.contactName,
      result: 'Success (Simulated)',
      reason: `Source: ${inquiry.source} | Type: ${inquiry.inquiryType}`
    });
    this.notify();
    return newInquiry;
  }

  public updateInquiryStatus(id: string, status: ReceptionInquiry['status'], actor: string): void {
    const inq = this.inquiries.find(i => i.id === id);
    if (inq) {
      const prev = inq.status;
      inq.status = status;
      this.logAudit({
        user: actor,
        role: 'reception',
        action: `Updated Inquiry Status to ${status}`,
        record: inq.contactName,
        result: 'Success (Simulated)',
        previousValue: prev,
        newValue: status
      });
      this.notify();
    }
  }

  public getAppointments(): AppointmentRecord[] {
    return [...this.appointments];
  }

  public scheduleAppointment(apt: Omit<AppointmentRecord, 'id'>): AppointmentRecord {
    const newApt: AppointmentRecord = {
      id: `apt_${Date.now()}`,
      ...apt
    };
    this.appointments.unshift(newApt);
    this.logAudit({
      user: 'Reception & Scheduling',
      role: 'reception',
      action: 'Scheduled Consultation',
      record: `${apt.clientName} with ${apt.staffName}`,
      result: 'Success (Simulated)',
      reason: `${apt.dateTime} (${apt.consultationType})`
    });
    this.notify();
    return newApt;
  }

  public getCallLogs(): CallLogRecord[] {
    return [...this.callLogs];
  }

  public logCall(call: Omit<CallLogRecord, 'id' | 'timestamp'>): CallLogRecord {
    const newCall: CallLogRecord = {
      id: `cal_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' EST',
      ...call
    };
    this.callLogs.unshift(newCall);
    this.notify();
    return newCall;
  }

  public getChangeOrders(): ScopeChangeOrder[] {
    return [...this.changeOrders];
  }

  public createChangeOrder(order: Omit<ScopeChangeOrder, 'id' | 'createdAt'>): ScopeChangeOrder {
    const newOrder: ScopeChangeOrder = {
      id: `sco_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      ...order
    };
    this.changeOrders.unshift(newOrder);
    this.logAudit({
      user: 'Brandon Cole',
      role: 'engagement-manager',
      action: 'Issued Scope Change Order',
      record: `${order.clientName} - Delta +$${order.priceDelta}`,
      result: 'Success (Simulated)',
      reason: order.title
    });
    this.notify();
    return newOrder;
  }

  public updateChangeOrderStatus(id: string, status: ScopeChangeOrder['status'], actor: string): void {
    const sco = this.changeOrders.find(s => s.id === id);
    if (sco) {
      sco.status = status;
      this.logAudit({
        user: actor,
        role: 'engagement-manager',
        action: `Scope Change Order ${status}`,
        record: `${sco.clientName} - ${sco.title}`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public getWorkloadTimeline(): WorkloadTimelineItem[] {
    return [...this.workloadTimeline];
  }

  public getVerifications(): IdentityVerificationRecord[] {
    return [...this.verifications];
  }

  public updateVerificationStatus(id: string, idStatus: IdentityVerificationRecord['idStatus'], actor: string, notes?: string): void {
    const ver = this.verifications.find(v => v.id === id);
    if (ver) {
      ver.idStatus = idStatus;
      ver.verifiedBy = actor;
      ver.verifiedAt = new Date().toISOString();
      if (notes) ver.notes = `${ver.notes} | ${notes}`;
      this.logAudit({
        user: actor,
        role: 'verification',
        action: `Identity Verification Status: ${idStatus}`,
        record: ver.clientName,
        result: idStatus.includes('Verified') ? 'Success (Simulated)' : 'Warning (Simulated)',
        reason: notes || 'Identity document reviewed'
      });
      this.notify();
    }
  }

  public flagSuspiciousRecord(id: string, reason: string, actor: string): void {
    const ver = this.verifications.find(v => v.id === id);
    if (ver) {
      ver.escalationFlag = true;
      ver.idStatus = 'Flagged Discrepancy';
      this.logAudit({
        user: actor,
        role: 'verification',
        action: 'Flagged Identity Discrepancy',
        record: ver.clientName,
        result: 'Denied (Simulated)',
        reason: reason
      });
      this.notify();
    }
  }

  public getIntakeDocs(): IntakeDocumentRecord[] {
    return [...this.intakeDocs];
  }

  public classifyIntakeDoc(id: string, classification: IntakeDocumentRecord['classification'], assignedRole: DemoRole, actor: string): void {
    const doc = this.intakeDocs.find(d => d.id === id);
    if (doc) {
      doc.classification = classification;
      doc.assignedRole = assignedRole;
      doc.status = 'Routed';
      doc.chainOfCustody.push({
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        actor: actor,
        action: `Classified as ${classification} and routed to ${assignedRole}`
      });
      this.logAudit({
        user: actor,
        role: 'documents',
        action: 'Classified & Routed Document',
        record: `${doc.fileName} -> ${assignedRole}`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public splitIntakePackage(id: string, parts: number, actor: string): void {
    const doc = this.intakeDocs.find(d => d.id === id);
    if (doc) {
      doc.packageCondition = 'Clean Single Document';
      doc.status = 'Routed';
      doc.chainOfCustody.push({
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        actor: actor,
        action: `Split multi-page dossier into ${parts} indexed individual workpapers`
      });
      this.notify();
    }
  }

  public getDataBatches(): DataEntryBatch[] {
    return [...this.dataBatches];
  }

  public getCashEntries(): CashTransactionEntry[] {
    return [...this.cashEntries];
  }

  public createDataBatch(batch: Omit<DataEntryBatch, 'id'>): DataEntryBatch {
    const newBatch: DataEntryBatch = {
      id: `bat_${Date.now()}`,
      ...batch
    };
    this.dataBatches.unshift(newBatch);
    this.notify();
    return newBatch;
  }

  public addCashEntry(entry: Omit<CashTransactionEntry, 'id'>): CashTransactionEntry {
    const newEntry: CashTransactionEntry = {
      id: `ce_${Date.now()}`,
      ...entry
    };
    this.cashEntries.unshift(newEntry);
    this.notify();
    return newEntry;
  }

  public submitBatchToBookkeeping(batchId: string, actor: string): void {
    const b = this.dataBatches.find(bat => bat.id === batchId);
    if (b) {
      b.status = 'Submitted to Bookkeeping';
      this.logAudit({
        user: actor,
        role: 'data-entry',
        action: 'Submitted Data Batch to Bookkeeping',
        record: `${b.clientName} - ${b.batchName} (${b.totalEntries} entries, $${b.totalAmount})`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public getApBills(): VendorBillRecord[] {
    return [...this.apBills];
  }

  public getPaymentBatches(): PaymentBatchRecord[] {
    return [...this.paymentBatches];
  }

  public approveApBill(billId: string, actor: string): void {
    const bill = this.apBills.find(b => b.id === billId);
    if (bill) {
      bill.approvalStatus = 'Approved for Payment';
      this.logAudit({
        user: actor,
        role: 'accounts-payable',
        action: 'Approved Vendor Bill for Payment',
        record: `${bill.vendorName} Invoice #${bill.invoiceNumber} ($${bill.amount})`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public createPaymentBatch(billIds: string[], actor: string): PaymentBatchRecord {
    const selected = this.apBills.filter(b => billIds.includes(b.id));
    const total = selected.reduce((sum, b) => sum + b.amount, 0);
    const newBatch: PaymentBatchRecord = {
      id: `pbat_${Date.now()}`,
      batchDate: new Date().toISOString().split('T')[0],
      totalAmount: total,
      billCount: selected.length,
      status: 'Prepared'
    };
    selected.forEach(b => { b.paymentBatchId = newBatch.id; });
    this.paymentBatches.unshift(newBatch);
    this.logAudit({
      user: actor,
      role: 'accounts-payable',
      action: 'Created Vendor Payment Batch',
      record: `Batch ${newBatch.id} - ${selected.length} bills ($${total.toLocaleString()})`,
      result: 'Success (Simulated)'
    });
    this.notify();
    return newBatch;
  }

  public executeSimulatedPayment(batchId: string, actor: string): void {
    const batch = this.paymentBatches.find(p => p.id === batchId);
    if (batch) {
      batch.status = 'Released (Simulated)';
      this.apBills.filter(b => b.paymentBatchId === batchId).forEach(b => {
        b.approvalStatus = 'Simulated Paid';
      });
      this.logAudit({
        user: actor,
        role: 'accounts-payable',
        action: 'Released Simulated Vendor ACH Batch',
        record: `Batch ${batchId} - $${batch.totalAmount.toLocaleString()}`,
        result: 'Success (Simulated)',
        reason: 'Demonstration payment authorization - no live bank movement.'
      });
      this.notify();
    }
  }

  public getArRecords(): ClientArRecord[] {
    return [...this.arRecords];
  }

  public getPaymentPlans(): PaymentPlanRecord[] {
    return [...this.paymentPlans];
  }

  public sendArReminder(invoiceId: string, actor: string): void {
    const inv = this.arRecords.find(a => a.id === invoiceId);
    if (inv) {
      inv.status = 'Reminder Sent (Simulated)';
      this.logAudit({
        user: actor,
        role: 'accounts-receivable',
        action: 'Sent Simulated Payment Reminder',
        record: `${inv.clientName} - Invoice ${inv.invoiceNumber} ($${inv.balanceDue})`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public recordArPayment(invoiceId: string, amount: number, actor: string): void {
    const inv = this.arRecords.find(a => a.id === invoiceId);
    if (inv) {
      inv.balanceDue = Math.max(0, inv.balanceDue - amount);
      if (inv.balanceDue === 0) {
        inv.status = 'Paid (Simulated)';
      }
      this.logAudit({
        user: actor,
        role: 'accounts-receivable',
        action: 'Recorded Simulated Client Payment',
        record: `${inv.clientName} - Invoice ${inv.invoiceNumber} (Amount: $${amount})`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public createPaymentPlan(plan: Omit<PaymentPlanRecord, 'id'>, actor: string): PaymentPlanRecord {
    const newPlan: PaymentPlanRecord = {
      id: `pplan_${Date.now()}`,
      ...plan
    };
    this.paymentPlans.unshift(newPlan);
    const ar = this.arRecords.find(a => a.clientId === plan.clientId);
    if (ar) ar.paymentPlanActive = true;
    this.logAudit({
      user: actor,
      role: 'accounts-receivable',
      action: 'Enrolled Client in Payment Plan',
      record: `${plan.clientName} - $${plan.monthlyInstallment}/mo for ${plan.installmentsTotal} months`,
      result: 'Success (Simulated)'
    });
    this.notify();
    return newPlan;
  }

  public getQcInspections(): QualityInspectionRecord[] {
    return [...this.qcInspections];
  }

  public resolveQcFinding(inspectionId: string, findingIndex: number, actor: string): void {
    const insp = this.qcInspections.find(q => q.id === inspectionId);
    if (insp && insp.findings[findingIndex]) {
      insp.findings[findingIndex].remediated = true;
      const allRemediated = insp.findings.every(f => f.remediated || f.severity === 'Observation');
      if (allRemediated) {
        insp.qcReleaseStatus = 'Remediated';
      }
      this.logAudit({
        user: actor,
        role: 'quality-control',
        action: 'Remediated QC Finding',
        record: `${insp.clientName} - Finding #${findingIndex + 1}`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public clearQcRelease(inspectionId: string, actor: string): { success: boolean; error?: string } {
    const insp = this.qcInspections.find(q => q.id === inspectionId);
    if (!insp) return { success: false, error: 'Inspection not found' };

    const unresolvedCritical = insp.findings.some(f => f.severity === 'Critical' && !f.remediated);
    if (unresolvedCritical) {
      return { success: false, error: 'Release blocked: Unresolved critical finding remains on record.' };
    }

    insp.qcReleaseStatus = 'Quality Control Cleared';
    this.logAudit({
      user: actor,
      role: 'quality-control',
      action: 'Cleared QC Gate for Electronic Filing',
      record: `${insp.clientName} - ${insp.formType}`,
      result: 'Success (Simulated)',
      reason: '7-point quality checklist verified. Workpapers certified.'
    });
    this.notify();
    return { success: true };
  }

  public getFilingBatches(): FilingSubmissionBatch[] {
    return [...this.filingBatches];
  }

  public createFilingBatch(batchNumber: string, formType: string, jurisdictions: string[], count: number): FilingSubmissionBatch {
    const newBatch: FilingSubmissionBatch = {
      id: `fbat_${Date.now()}`,
      batchNumber,
      formType,
      jurisdictions,
      submissionCount: count,
      schemaValidationStatus: 'Passed (Simulated)',
      status: 'Ready for Transmission'
    };
    this.filingBatches.unshift(newBatch);
    this.notify();
    return newBatch;
  }

  public transmitFilingBatch(batchId: string, actor: string): { submissionId: string; timestamp: string } {
    const batch = this.filingBatches.find(b => b.id === batchId);
    const subId = `10402026${String(Date.now()).substring(5)}0001`;
    const ts = new Date().toISOString();
    if (batch) {
      batch.status = 'Transmitted—Simulated';
      batch.transmissionTimestamp = ts;
    }
    this.logAudit({
      user: actor,
      role: 'filing',
      action: 'Transmitted Electronic Return Batch (Simulated)',
      record: `Batch ${batch?.batchNumber || batchId} - Submission ID ${subId}`,
      result: 'Success (Simulated)',
      reason: 'Modernized e-File (MeF) transmission simulated in demo environment.'
    });
    this.notify();
    return { submissionId: subId, timestamp: ts };
  }

  public getAcknowledgements(): AcknowledgementRecord[] {
    return [...this.acks];
  }

  public simulateAcknowledgement(submissionId: string, status: AcknowledgementRecord['status'], code: string, message: string, actor: string): AcknowledgementRecord {
    const newAck: AcknowledgementRecord = {
      id: `ack_${Date.now()}`,
      submissionId,
      clientName: 'Perotti Capital Holdings LLC',
      taxYear: 2025,
      formType: 'Form 1120-S',
      jurisdiction: 'Federal IRS',
      ackType: 'Federal',
      status,
      returnCode: code,
      messageText: message,
      timestamp: new Date().toISOString(),
      correctionCaseCreated: status.includes('Rejected')
    };
    this.acks.unshift(newAck);
    this.logAudit({
      user: actor,
      role: 'acknowledgements',
      action: `Processed Government Acknowledgement: ${status}`,
      record: `Submission ${submissionId} (Code ${code})`,
      result: status.includes('Accepted') ? 'Success (Simulated)' : 'Warning (Simulated)',
      reason: message
    });
    this.notify();
    return newAck;
  }

  public getGovernmentNotices(): GovernmentNoticeRecord[] {
    return [...this.notices];
  }

  public updateNoticeStatus(noticeId: string, status: GovernmentNoticeRecord['status'], actor: string): void {
    const not = this.notices.find(n => n.id === noticeId);
    if (not) {
      not.status = status;
      this.logAudit({
        user: actor,
        role: 'correspondence',
        action: `Updated Notice Defense Status to ${status}`,
        record: `${not.clientName} - ${not.noticeNumber}`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public getResolutionCases(): TaxResolutionCase[] {
    return [...this.resolutionCases];
  }

  public updateResolutionStatus(caseId: string, status: TaxResolutionCase['caseStatus'], actor: string): void {
    const rc = this.resolutionCases.find(r => r.id === caseId);
    if (rc) {
      rc.caseStatus = status;
      this.logAudit({
        user: actor,
        role: 'resolution',
        action: `Tax Resolution Case Status: ${status}`,
        record: `${rc.clientName} - ${rc.resolutionStrategy}`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public getAuditCases(): AuditCaseRecord[] {
    return [...this.auditCases];
  }

  public updateAuditStatus(caseId: string, status: AuditCaseRecord['status'], actor: string): void {
    const ac = this.auditCases.find(a => a.id === caseId);
    if (ac) {
      ac.status = status;
      this.logAudit({
        user: actor,
        role: 'audit',
        action: `Audit Examination Case Status: ${status}`,
        record: `${ac.clientName} - Examiner ${ac.examinerName}`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public getAmendmentCases(): AmendmentCaseRecord[] {
    return [...this.amendments];
  }

  public updateAmendmentStatus(caseId: string, status: AmendmentCaseRecord['filingStatus'], actor: string): void {
    const amd = this.amendments.find(a => a.id === caseId);
    if (amd) {
      amd.filingStatus = status;
      this.logAudit({
        user: actor,
        role: 'amendments',
        action: `Amended Return Status: ${status}`,
        record: `${amd.clientName} - ${amd.amendedForm}`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public getArchiveRecords(): ArchiveRecord[] {
    return [...this.archives];
  }

  public applyLegalHold(archiveId: string, active: boolean, actor: string): void {
    const arc = this.archives.find(a => a.id === archiveId);
    if (arc) {
      arc.legalHoldActive = active;
      arc.destructionStatus = active ? 'Legal Hold' : 'Retained Active';
      this.logAudit({
        user: actor,
        role: 'records',
        action: active ? 'Placed Legal Hold on Archive' : 'Released Legal Hold',
        record: `${arc.clientName} - Tax Year ${arc.taxYear}`,
        result: 'Success (Simulated)',
        reason: active ? 'Litigation / examination preservation notice' : 'Hold lifted'
      });
      this.notify();
    }
  }

  public getRenewalRecords(): ClientRenewalRecord[] {
    return [...this.renewals];
  }

  public updateRenewalStatus(id: string, status: ClientRenewalRecord['renewalStatus'], actor: string): void {
    const ren = this.renewals.find(r => r.id === id);
    if (ren) {
      ren.renewalStatus = status;
      this.logAudit({
        user: actor,
        role: 'client-success',
        action: `Updated Client Renewal Status: ${status}`,
        record: `${ren.clientName} - Next Tax Year ${ren.renewalTaxYear}`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  public getSupportTickets(): SupportTicketRecord[] {
    return [...this.supportTickets];
  }

  public createSupportTicket(ticket: Omit<SupportTicketRecord, 'id' | 'createdAt'>): SupportTicketRecord {
    const newTicket: SupportTicketRecord = {
      id: `sup_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...ticket
    };
    this.supportTickets.unshift(newTicket);
    this.logAudit({
      user: ticket.userName,
      role: ticket.userRole,
      action: 'Opened Support Ticket',
      record: `${ticket.ticketNumber} - ${ticket.summary}`,
      result: 'Success (Simulated)'
    });
    this.notify();
    return newTicket;
  }

  public updateSupportTicketStatus(id: string, status: SupportTicketRecord['status'], actor: string): void {
    const tkt = this.supportTickets.find(t => t.id === id);
    if (tkt) {
      tkt.status = status;
      this.logAudit({
        user: actor,
        role: 'support',
        action: `Support Ticket ${status}`,
        record: `${tkt.ticketNumber} - ${tkt.summary}`,
        result: 'Success (Simulated)'
      });
      this.notify();
    }
  }

  // --- Reset to Demo State ---
  public resetToDefault(actor: string): void {
    this.clearStorage();
    resetClientDashboardData();
    this.clients = [...INITIAL_DEMO_CLIENTS];
    this.engagements = [...INITIAL_DEMO_ENGAGEMENTS];
    this.documents = [...INITIAL_DEMO_DOCUMENTS];
    this.transactions = [...INITIAL_DEMO_TRANSACTIONS];
    this.reconciliations = [...INITIAL_DEMO_RECONCILIATIONS];
    this.payroll = [...INITIAL_DEMO_PAYROLL];
    this.workpapers = [...INITIAL_DEMO_WORKPAPERS];
    this.advisoryCases = [...INITIAL_DEMO_ADVISORY];
    this.invoices = [...INITIAL_DEMO_INVOICES];
    this.auditLogs = [...INITIAL_DEMO_AUDIT_LOGS];

    // Reset extended collections
    this.handoffs = [...INITIAL_DEMO_HANDOFFS];
    this.agencies = [...INITIAL_DEMO_AGENCIES];
    this.feedbackRecords = [...INITIAL_DEMO_FEEDBACK];
    this.inquiries = [...INITIAL_DEMO_INQUIRIES];
    this.appointments = [...INITIAL_DEMO_APPOINTMENTS];
    this.callLogs = [...INITIAL_DEMO_CALLS];
    this.changeOrders = [...INITIAL_DEMO_CHANGE_ORDERS];
    this.workloadTimeline = [...INITIAL_DEMO_WORKLOAD_TIMELINE];
    this.verifications = [...INITIAL_DEMO_VERIFICATIONS];
    this.intakeDocs = [...INITIAL_DEMO_INTAKE_DOCS];
    this.dataBatches = [...INITIAL_DEMO_DATA_BATCHES];
    this.cashEntries = [...INITIAL_DEMO_CASH_ENTRIES];
    this.apBills = [...INITIAL_DEMO_AP_BILLS];
    this.paymentBatches = [...INITIAL_DEMO_PAYMENT_BATCHES];
    this.arRecords = [...INITIAL_DEMO_AR_RECORDS];
    this.paymentPlans = [...INITIAL_DEMO_PAYMENT_PLANS];
    this.qcInspections = [...INITIAL_DEMO_QC_INSPECTIONS];
    this.filingBatches = [...INITIAL_DEMO_FILING_BATCHES];
    this.acks = [...INITIAL_DEMO_ACKS];
    this.notices = [...INITIAL_DEMO_NOTICES];
    this.resolutionCases = [...INITIAL_DEMO_RESOLUTION_CASES];
    this.auditCases = [...INITIAL_DEMO_AUDIT_CASES];
    this.amendments = [...INITIAL_DEMO_AMENDMENTS];
    this.archives = [...INITIAL_DEMO_ARCHIVES];
    this.renewals = [...INITIAL_DEMO_RENEWALS];
    this.supportTickets = [...INITIAL_DEMO_SUPPORT_TICKETS];

    this.logAudit({
      user: actor,
      role: 'admin',
      action: 'Reset Demonstration Data Store',
      record: 'Master Demonstration Environment',
      result: 'Success (Simulated)',
      reason: 'All mock database entities reset to clean initial baseline.'
    });

    this.notify();
  }

  public resetDemoData(actor: string = 'System Administrator'): void {
    this.resetToDefault(actor);
  }
}

export const demoDataStore = new DemoDataStore();
