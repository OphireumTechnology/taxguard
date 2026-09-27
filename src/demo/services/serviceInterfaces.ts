/**
 * A/R Tax Services, LLC - Central Service Interfaces
 * Prompt Section 14: Shared Mock Service Architecture
 * Designed for future real integration replacement.
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
  FilingGateStatus,
  FilingSubmissionBatch,
  AcknowledgementRecord,
  GovernmentNoticeRecord,
  TaxResolutionCase,
  AuditCaseRecord,
  AmendmentCaseRecord,
  ArchiveRecord,
  ClientRenewalRecord,
  SupportTicketRecord,
  DemoRole,
  WorkCycleStage,
  UnifiedStatus
} from '../types';

export interface IReceptionService {
  getInquiries(): ReceptionInquiry[];
  getAppointments(): AppointmentRecord[];
  getCallLogs(): CallLogRecord[];
  addInquiry(inquiry: Omit<ReceptionInquiry, 'id' | 'createdAt'>): ReceptionInquiry;
  scheduleAppointment(appointment: Omit<AppointmentRecord, 'id'>): AppointmentRecord;
  logCall(call: Omit<CallLogRecord, 'id' | 'timestamp'>): CallLogRecord;
  updateInquiryStatus(id: string, status: ReceptionInquiry['status'], actor: string): void;
  sendSimulatedReminder(appointmentId: string): void;
}

export interface IEngagementService {
  getChangeOrders(): ScopeChangeOrder[];
  getWorkloadTimeline(engagementId: string): WorkloadTimelineItem[];
  createChangeOrder(order: Omit<ScopeChangeOrder, 'id' | 'createdAt'>): ScopeChangeOrder;
  updateChangeOrderStatus(id: string, status: ScopeChangeOrder['status'], actor: string): void;
  assignStaff(engagementId: string, preparerId: string, reviewerId: string, actor: string): void;
  holdEngagement(engagementId: string, reason: string, actor: string): void;
}

export interface IVerificationService {
  getVerificationRecords(): IdentityVerificationRecord[];
  getRecordById(id: string): IdentityVerificationRecord | undefined;
  updateVerificationStatus(id: string, idStatus: IdentityVerificationRecord['idStatus'], actor: string, notes?: string): void;
  flagSuspiciousRecord(id: string, reason: string, actor: string): void;
  requestReplacementDoc(id: string, docType: string, actor: string): void;
}

export interface IDocumentIntakeService {
  getIntakeQueue(): IntakeDocumentRecord[];
  classifyDocument(id: string, classification: IntakeDocumentRecord['classification'], assignedRole: DemoRole, actor: string): void;
  splitPackage(id: string, resultingParts: number, actor: string): void;
  flagUnreadable(id: string, notes: string, actor: string): void;
  assignToEngagement(id: string, engagementId: string, taxYear: number, actor: string): void;
}

export interface IDataEntryService {
  getBatches(): DataEntryBatch[];
  getEntriesByBatch(batchId: string): CashTransactionEntry[];
  createBatch(batch: Omit<DataEntryBatch, 'id'>): DataEntryBatch;
  addTransactionEntry(entry: Omit<CashTransactionEntry, 'id'>): CashTransactionEntry;
  submitBatchToBookkeeping(batchId: string, actor: string): void;
}

export interface IAccountsPayableService {
  getVendorBills(): VendorBillRecord[];
  getPaymentBatches(): PaymentBatchRecord[];
  approveBillForPayment(billId: string, actor: string): void;
  createPaymentBatch(billIds: string[], actor: string): PaymentBatchRecord;
  executeSimulatedPayment(batchId: string, actor: string): void;
  flagMissingW9(billId: string, actor: string): void;
}

export interface IAccountsReceivableService {
  getArRecords(): ClientArRecord[];
  getPaymentPlans(): PaymentPlanRecord[];
  sendSimulatedReminder(invoiceId: string, actor: string): void;
  recordSimulatedPayment(invoiceId: string, amount: number, actor: string): void;
  requestWriteOff(invoiceId: string, reason: string, actor: string): void;
  createPaymentPlan(plan: Omit<PaymentPlanRecord, 'id'>, actor: string): PaymentPlanRecord;
}

export interface IQualityControlService {
  getInspections(): QualityInspectionRecord[];
  getInspectionByEngagement(engagementId: string): QualityInspectionRecord | undefined;
  performInspection(engagementId: string, inspector: string, findings: Array<{ severity: 'Critical' | 'Warning' | 'Observation'; description: string; remediated: boolean }>): QualityInspectionRecord;
  resolveFinding(inspectionId: string, findingIndex: number, actor: string): void;
  clearQualityControl(inspectionId: string, actor: string): { success: boolean; error?: string };
  blockRelease(inspectionId: string, reason: string, actor: string): void;
}

export interface IFilingService {
  getSubmissionBatches(): FilingSubmissionBatch[];
  checkFilingGates(engagementId: string): FilingGateStatus;
  runSimulatedDiagnostics(batchId: string): { passed: boolean; message: string };
  createSubmissionBatch(batchNumber: string, formType: string, jurisdictions: string[], count: number): FilingSubmissionBatch;
  transmitBatchSimulated(batchId: string, actor: string): { submissionId: string; timestamp: string };
}

export interface IAcknowledgementService {
  getAcknowledgements(): AcknowledgementRecord[];
  matchAcknowledgement(submissionId: string): AcknowledgementRecord | undefined;
  simulateAcknowledgementResponse(
    submissionId: string, 
    scenario: 'Federal Accepted' | 'Federal Rejected' | 'State Accepted' | 'State Rejected' | 'Duplicate Filing' | 'Schema Failure' | 'Overdue',
    actor: string
  ): AcknowledgementRecord;
  createCorrectionCase(ackId: string, actor: string): void;
}

export interface IGovernmentCorrespondenceService {
  getNotices(): GovernmentNoticeRecord[];
  createNoticeCase(notice: Omit<GovernmentNoticeRecord, 'id' | 'status'>, actor: string): GovernmentNoticeRecord;
  updateNoticeStatus(noticeId: string, status: GovernmentNoticeRecord['status'], actor: string): void;
  draftAiResponse(noticeId: string): { draftText: string; citations: string[]; confidence: number };
  submitResponseSimulated(noticeId: string, actor: string): void;
}

export interface ITaxResolutionService {
  getResolutionCases(): TaxResolutionCase[];
  openResolutionCase(caseItem: Omit<TaxResolutionCase, 'id'>, actor: string): TaxResolutionCase;
  updateCaseStatus(caseId: string, status: TaxResolutionCase['caseStatus'], actor: string): void;
  recordHearing(caseId: string, hearingDate: string, notes: string, actor: string): void;
}

export interface IAuditService {
  getAuditCases(): AuditCaseRecord[];
  createAuditCase(auditCase: Omit<AuditCaseRecord, 'id'>, actor: string): AuditCaseRecord;
  updateAuditStatus(caseId: string, status: AuditCaseRecord['status'], actor: string): void;
  recordIdrResponse(caseId: string, idrItemNumber: number, description: string, actor: string): void;
}

export interface IAmendmentService {
  getAmendmentCases(): AmendmentCaseRecord[];
  createAmendmentCase(caseItem: Omit<AmendmentCaseRecord, 'id' | 'filingStatus'>, actor: string): AmendmentCaseRecord;
  updateAmendmentStatus(caseId: string, status: AmendmentCaseRecord['filingStatus'], actor: string): void;
  simulateFilingAmendment(caseId: string, actor: string): void;
}

export interface IRecordsService {
  getArchiveRecords(): ArchiveRecord[];
  archiveEngagement(engagementId: string, actor: string): ArchiveRecord;
  applyLegalHold(archiveId: string, active: boolean, actor: string): void;
  generateSimulatedDestructionCertificate(archiveId: string, actor: string): string;
  restoreRecord(archiveId: string, actor: string): void;
}

export interface IRenewalService {
  getRenewalRecords(): ClientRenewalRecord[];
  createRenewalProposal(renewal: Omit<ClientRenewalRecord, 'id'>, actor: string): ClientRenewalRecord;
  updateRenewalStatus(id: string, status: ClientRenewalRecord['renewalStatus'], actor: string): void;
  rollForwardToNewCycle(clientId: string, nextYear: number, actor: string): void;
}

export interface ISupportService {
  getTickets(): SupportTicketRecord[];
  createTicket(ticket: Omit<SupportTicketRecord, 'id' | 'createdAt'>): SupportTicketRecord;
  updateTicketStatus(id: string, status: SupportTicketRecord['status'], actor: string): void;
  resetUserSession(role: DemoRole, actor: string): void;
}

export interface IHandoffService {
  getAllHandoffs(): DemoHandoff[];
  getHandoffsForRole(role: DemoRole): DemoHandoff[];
  createHandoff(handoff: Omit<DemoHandoff, 'id'>, actor: string): DemoHandoff;
  acceptHandoff(handoffId: string, actor: string, role: DemoRole): void;
  rejectHandoff(handoffId: string, reason: string, actor: string, role: DemoRole): void;
  escalateHandoff(handoffId: string, reason: string, actor: string, role: DemoRole): void;
}

export interface IGovernmentAgencyRegistryService {
  getAllAuthorities(): GovernmentAgencyAuthority[];
  getAuthorityById(id: string): GovernmentAgencyAuthority | undefined;
  testConnectionSimulated(id: string): { status: 'Not Configured'; message: string; timestamp: string };
}
