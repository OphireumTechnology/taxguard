/**
 * A/R Tax Services, LLC - Service Layer Implementations
 * Prompt Section 14: Concrete Mock Service Implementations backed by demoDataStore.
 */

import { demoDataStore } from './DemoDataService';
import {
  IReceptionService,
  IEngagementService,
  IVerificationService,
  IDocumentIntakeService,
  IDataEntryService,
  IAccountsPayableService,
  IAccountsReceivableService,
  IQualityControlService,
  IFilingService,
  IAcknowledgementService,
  IGovernmentCorrespondenceService,
  ITaxResolutionService,
  IAuditService,
  IAmendmentService,
  IRecordsService,
  IRenewalService,
  ISupportService,
  IHandoffService,
  IGovernmentAgencyRegistryService
} from './serviceInterfaces';
import {
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
  DemoHandoff,
  GovernmentAgencyAuthority,
  DemoRole
} from '../types';

export class ReceptionService implements IReceptionService {
  getInquiries(): ReceptionInquiry[] {
    return demoDataStore.getInquiries();
  }
  getAppointments(): AppointmentRecord[] {
    return demoDataStore.getAppointments();
  }
  getCallLogs(): CallLogRecord[] {
    return demoDataStore.getCallLogs();
  }
  addInquiry(inquiry: Omit<ReceptionInquiry, 'id' | 'createdAt'>): ReceptionInquiry {
    return demoDataStore.addInquiry(inquiry);
  }
  scheduleAppointment(appointment: Omit<AppointmentRecord, 'id'>): AppointmentRecord {
    return demoDataStore.scheduleAppointment(appointment);
  }
  logCall(call: Omit<CallLogRecord, 'id' | 'timestamp'>): CallLogRecord {
    return demoDataStore.logCall(call);
  }
  updateInquiryStatus(id: string, status: ReceptionInquiry['status'], actor: string): void {
    demoDataStore.updateInquiryStatus(id, status, actor);
  }
  sendSimulatedReminder(appointmentId: string): void {
    demoDataStore.logAudit({
      user: 'Automated Notification Bot',
      role: 'reception',
      action: 'Sent Consultation Reminder (Simulated SMS/Email)',
      record: `Appointment #${appointmentId}`,
      result: 'Success (Simulated)'
    });
  }
}

export class EngagementService implements IEngagementService {
  getChangeOrders(): ScopeChangeOrder[] {
    return demoDataStore.getChangeOrders();
  }
  getWorkloadTimeline(engagementId: string): WorkloadTimelineItem[] {
    return demoDataStore.getWorkloadTimeline();
  }
  createChangeOrder(order: Omit<ScopeChangeOrder, 'id' | 'createdAt'>): ScopeChangeOrder {
    return demoDataStore.createChangeOrder(order);
  }
  updateChangeOrderStatus(id: string, status: ScopeChangeOrder['status'], actor: string): void {
    demoDataStore.updateChangeOrderStatus(id, status, actor);
  }
  assignStaff(engagementId: string, preparerId: string, reviewerId: string, actor: string): void {
    demoDataStore.assignStaff(engagementId, preparerId, reviewerId, actor);
  }
  holdEngagement(engagementId: string, reason: string, actor: string): void {
    demoDataStore.updateEngagementStatus(engagementId, 'Corrections Required', actor, reason);
  }
}

export class VerificationService implements IVerificationService {
  getVerificationRecords(): IdentityVerificationRecord[] {
    return demoDataStore.getVerifications();
  }
  getRecordById(id: string): IdentityVerificationRecord | undefined {
    return demoDataStore.getVerifications().find(v => v.id === id);
  }
  updateVerificationStatus(id: string, idStatus: IdentityVerificationRecord['idStatus'], actor: string, notes?: string): void {
    demoDataStore.updateVerificationStatus(id, idStatus, actor, notes);
  }
  flagSuspiciousRecord(id: string, reason: string, actor: string): void {
    demoDataStore.flagSuspiciousRecord(id, reason, actor);
  }
  requestReplacementDoc(id: string, docType: string, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'verification',
      action: 'Requested Replacement Identity Document',
      record: `Record #${id} - Requested: ${docType}`,
      result: 'Success (Simulated)'
    });
  }
}

export class DocumentIntakeService implements IDocumentIntakeService {
  getIntakeQueue(): IntakeDocumentRecord[] {
    return demoDataStore.getIntakeDocs();
  }
  classifyDocument(id: string, classification: IntakeDocumentRecord['classification'], assignedRole: DemoRole, actor: string): void {
    demoDataStore.classifyIntakeDoc(id, classification, assignedRole, actor);
  }
  splitPackage(id: string, resultingParts: number, actor: string): void {
    demoDataStore.splitIntakePackage(id, resultingParts, actor);
  }
  flagUnreadable(id: string, notes: string, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'documents',
      action: 'Flagged Document Unreadable',
      record: `Doc #${id}: ${notes}`,
      result: 'Warning (Simulated)'
    });
  }
  assignToEngagement(id: string, engagementId: string, taxYear: number, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'documents',
      action: 'Assigned Document to Engagement',
      record: `Doc #${id} -> Engagement ${engagementId} (TY${taxYear})`,
      result: 'Success (Simulated)'
    });
  }
}

export class DataEntryService implements IDataEntryService {
  getBatches(): DataEntryBatch[] {
    return demoDataStore.getDataBatches();
  }
  getEntriesByBatch(batchId: string): CashTransactionEntry[] {
    return demoDataStore.getCashEntries().filter(e => e.batchId === batchId);
  }
  createBatch(batch: Omit<DataEntryBatch, 'id'>): DataEntryBatch {
    return demoDataStore.createDataBatch(batch);
  }
  addTransactionEntry(entry: Omit<CashTransactionEntry, 'id'>): CashTransactionEntry {
    return demoDataStore.addCashEntry(entry);
  }
  submitBatchToBookkeeping(batchId: string, actor: string): void {
    demoDataStore.submitBatchToBookkeeping(batchId, actor);
  }
}

export class AccountsPayableService implements IAccountsPayableService {
  getVendorBills(): VendorBillRecord[] {
    return demoDataStore.getApBills();
  }
  getPaymentBatches(): PaymentBatchRecord[] {
    return demoDataStore.getPaymentBatches();
  }
  approveBillForPayment(billId: string, actor: string): void {
    demoDataStore.approveApBill(billId, actor);
  }
  createPaymentBatch(billIds: string[], actor: string): PaymentBatchRecord {
    return demoDataStore.createPaymentBatch(billIds, actor);
  }
  executeSimulatedPayment(batchId: string, actor: string): void {
    demoDataStore.executeSimulatedPayment(batchId, actor);
  }
  flagMissingW9(billId: string, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'accounts-payable',
      action: 'Flagged Missing W-9 on Vendor',
      record: `Bill #${billId}`,
      result: 'Warning (Simulated)',
      reason: '1099 compliance hold applied prior to payment disbursement.'
    });
  }
}

export class AccountsReceivableService implements IAccountsReceivableService {
  getArRecords(): ClientArRecord[] {
    return demoDataStore.getArRecords();
  }
  getPaymentPlans(): PaymentPlanRecord[] {
    return demoDataStore.getPaymentPlans();
  }
  sendSimulatedReminder(invoiceId: string, actor: string): void {
    demoDataStore.sendArReminder(invoiceId, actor);
  }
  recordSimulatedPayment(invoiceId: string, amount: number, actor: string): void {
    demoDataStore.recordArPayment(invoiceId, amount, actor);
  }
  requestWriteOff(invoiceId: string, reason: string, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'accounts-receivable',
      action: 'Requested Bad Debt Write-Off',
      record: `Invoice #${invoiceId}`,
      result: 'Warning (Simulated)',
      reason
    });
  }
  createPaymentPlan(plan: Omit<PaymentPlanRecord, 'id'>, actor: string): PaymentPlanRecord {
    return demoDataStore.createPaymentPlan(plan, actor);
  }
}

export class QualityControlService implements IQualityControlService {
  getInspections(): QualityInspectionRecord[] {
    return demoDataStore.getQcInspections();
  }
  getInspectionByEngagement(engagementId: string): QualityInspectionRecord | undefined {
    return demoDataStore.getQcInspections().find(q => q.engagementId === engagementId);
  }
  performInspection(
    engagementId: string, 
    inspector: string, 
    findings: Array<{ severity: 'Critical' | 'Warning' | 'Observation'; description: string; remediated: boolean }>
  ): QualityInspectionRecord {
    const newRecord: QualityInspectionRecord = {
      id: `qc_${Date.now()}`,
      engagementId,
      clientName: 'Perotti Capital Holdings LLC',
      taxYear: 2025,
      formType: 'Form 1120-S',
      inspectedBy: inspector,
      inspectionDate: new Date().toISOString().split('T')[0],
      traceabilityScore: 95,
      makerCheckerSeparationConfirmed: true,
      reviewerEvidenceAttached: true,
      clientConsentOnRecord: true,
      findings,
      qcReleaseStatus: findings.some(f => f.severity === 'Critical' && !f.remediated) 
        ? 'Findings Open - Release Blocked' 
        : 'Quality Control Cleared'
    };
    demoDataStore.logAudit({
      user: inspector,
      role: 'quality-control',
      action: 'Completed Quality Assurance Inspection',
      record: `Engagement ${engagementId} - Traceability ${newRecord.traceabilityScore}%`,
      result: 'Success (Simulated)'
    });
    return newRecord;
  }
  resolveFinding(inspectionId: string, findingIndex: number, actor: string): void {
    demoDataStore.resolveQcFinding(inspectionId, findingIndex, actor);
  }
  clearQualityControl(inspectionId: string, actor: string): { success: boolean; error?: string } {
    return demoDataStore.clearQcRelease(inspectionId, actor);
  }
  blockRelease(inspectionId: string, reason: string, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'quality-control',
      action: 'Blocked E-File Release Gate',
      record: `Inspection #${inspectionId}`,
      result: 'Denied (Simulated)',
      reason
    });
  }
}

export class FilingService implements IFilingService {
  getSubmissionBatches(): FilingSubmissionBatch[] {
    return demoDataStore.getFilingBatches();
  }
  checkFilingGates(engagementId: string): FilingGateStatus {
    const qc = demoDataStore.getQcInspections().find(q => q.engagementId === engagementId);
    return {
      preparerCompleted: true,
      reviewerApproved: true,
      qcCleared: qc?.qcReleaseStatus === 'Quality Control Cleared',
      clientApproved: true,
      signatureCompleted: true,
      billingReleased: true,
      filingSpecialistConfirmed: true
    };
  }
  runSimulatedDiagnostics(batchId: string): { passed: boolean; message: string } {
    return {
      passed: true,
      message: 'All Modernized e-File (MeF) XML schemas validated successfully against IRS Publication 4164.'
    };
  }
  createSubmissionBatch(batchNumber: string, formType: string, jurisdictions: string[], count: number): FilingSubmissionBatch {
    return demoDataStore.createFilingBatch(batchNumber, formType, jurisdictions, count);
  }
  transmitBatchSimulated(batchId: string, actor: string): { submissionId: string; timestamp: string } {
    return demoDataStore.transmitFilingBatch(batchId, actor);
  }
}

export class AcknowledgementService implements IAcknowledgementService {
  getAcknowledgements(): AcknowledgementRecord[] {
    return demoDataStore.getAcknowledgements();
  }
  matchAcknowledgement(submissionId: string): AcknowledgementRecord | undefined {
    return demoDataStore.getAcknowledgements().find(a => a.submissionId === submissionId);
  }
  simulateAcknowledgementResponse(
    submissionId: string, 
    scenario: 'Federal Accepted' | 'Federal Rejected' | 'State Accepted' | 'State Rejected' | 'Duplicate Filing' | 'Schema Failure' | 'Overdue',
    actor: string
  ): AcknowledgementRecord {
    const statusMap = {
      'Federal Accepted': { status: 'Accepted—Simulated' as const, code: '100', msg: 'IRS MeF electronic return received and accepted without errors.' },
      'Federal Rejected': { status: 'Rejected—Simulated' as const, code: 'R000-TIN-MISMATCH', msg: 'Primary SSN / EIN does not match SSA / IRS master records.' },
      'State Accepted': { status: 'Accepted—Simulated' as const, code: 'SC-ACK-01', msg: 'South Carolina Department of Revenue accepted corporate return.' },
      'State Rejected': { status: 'Rejected—Simulated' as const, code: 'F1120S-002', msg: 'State withholding on K-1 does not balance with quarterly employer filings.' },
      'Duplicate Filing': { status: 'Rejected—Simulated' as const, code: 'R000-DUP-SUBMISSION', msg: 'A submission with this tax period and TIN has already been accepted.' },
      'Schema Failure': { status: 'Rejected—Simulated' as const, code: 'R000-XML-SCHEMA', msg: 'XML payload failed IRS schema validation at line 144.' },
      'Overdue': { status: 'Overdue Ack Warning' as const, code: 'WARN-TIMEOUT', msg: 'Acknowledgement pending > 48 hours. ERO follow-up inquiry queued.' }
    };
    const s = statusMap[scenario];
    return demoDataStore.simulateAcknowledgement(submissionId, s.status, s.code, s.msg, actor);
  }
  createCorrectionCase(ackId: string, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'acknowledgements',
      action: 'Created Rejection Correction Case',
      record: `Ack #${ackId}`,
      result: 'Success (Simulated)',
      reason: 'Routed to Tax Preparer Marcus Vance for schema correction.'
    });
  }
}

export class GovernmentCorrespondenceService implements IGovernmentCorrespondenceService {
  getNotices(): GovernmentNoticeRecord[] {
    return demoDataStore.getGovernmentNotices();
  }
  createNoticeCase(notice: Omit<GovernmentNoticeRecord, 'id' | 'status'>, actor: string): GovernmentNoticeRecord {
    const newNotice: GovernmentNoticeRecord = {
      id: `not_${Date.now()}`,
      status: 'Notice Received',
      ...notice
    };
    demoDataStore.logAudit({
      user: actor,
      role: 'correspondence',
      action: 'Opened Tax Notice Defense Case',
      record: `${notice.clientName} - ${notice.noticeNumber}`,
      result: 'Success (Simulated)'
    });
    return newNotice;
  }
  updateNoticeStatus(noticeId: string, status: GovernmentNoticeRecord['status'], actor: string): void {
    demoDataStore.updateNoticeStatus(noticeId, status, actor);
  }
  draftAiResponse(noticeId: string): { draftText: string; citations: string[]; confidence: number } {
    return {
      draftText: 'RE: South Carolina Department of Revenue Notice Response. Taxpayer hereby substantiates timely withholding payment via EFTPS Confirmation #883921 and attached cancelled check #1042.',
      citations: ['SC Code Ann. § 12-8-580', 'Treas. Reg. § 1.6656-1 (Reasonable Cause)'],
      confidence: 0.94
    };
  }
  submitResponseSimulated(noticeId: string, actor: string): void {
    demoDataStore.updateNoticeStatus(noticeId, 'Response Submitted—Simulated', actor);
  }
}

export class TaxResolutionService implements ITaxResolutionService {
  getResolutionCases(): TaxResolutionCase[] {
    return demoDataStore.getResolutionCases();
  }
  openResolutionCase(caseItem: Omit<TaxResolutionCase, 'id'>, actor: string): TaxResolutionCase {
    const newCase: TaxResolutionCase = {
      id: `res_${Date.now()}`,
      ...caseItem
    };
    demoDataStore.logAudit({
      user: actor,
      role: 'resolution',
      action: 'Opened Tax Resolution Case',
      record: `${caseItem.clientName} - ${caseItem.resolutionStrategy}`,
      result: 'Success (Simulated)'
    });
    return newCase;
  }
  updateCaseStatus(caseId: string, status: TaxResolutionCase['caseStatus'], actor: string): void {
    demoDataStore.updateResolutionStatus(caseId, status, actor);
  }
  recordHearing(caseId: string, hearingDate: string, notes: string, actor: string): void {
    const c = demoDataStore.getResolutionCases().find(r => r.id === caseId);
    if (c) c.hearingDate = hearingDate;
    demoDataStore.logAudit({
      user: actor,
      role: 'resolution',
      action: 'Scheduled IRS Appeals Conference',
      record: `Case #${caseId} on ${hearingDate}`,
      result: 'Success (Simulated)',
      reason: notes
    });
  }
}

export class AuditService implements IAuditService {
  getAuditCases(): AuditCaseRecord[] {
    return demoDataStore.getAuditCases();
  }
  createAuditCase(auditCase: Omit<AuditCaseRecord, 'id'>, actor: string): AuditCaseRecord {
    const newCase: AuditCaseRecord = {
      id: `aud_${Date.now()}`,
      ...auditCase
    };
    demoDataStore.logAudit({
      user: actor,
      role: 'audit',
      action: 'Registered Tax Audit Examination',
      record: `${auditCase.clientName} (${auditCase.agency})`,
      result: 'Success (Simulated)'
    });
    return newCase;
  }
  updateAuditStatus(caseId: string, status: AuditCaseRecord['status'], actor: string): void {
    demoDataStore.updateAuditStatus(caseId, status, actor);
  }
  recordIdrResponse(caseId: string, idrItemNumber: number, description: string, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'audit',
      action: `Assembled IDR Item #${idrItemNumber} Response`,
      record: `Case #${caseId} - ${description}`,
      result: 'Success (Simulated)'
    });
  }
}

export class AmendmentService implements IAmendmentService {
  getAmendmentCases(): AmendmentCaseRecord[] {
    return demoDataStore.getAmendmentCases();
  }
  createAmendmentCase(caseItem: Omit<AmendmentCaseRecord, 'id' | 'filingStatus'>, actor: string): AmendmentCaseRecord {
    const newCase: AmendmentCaseRecord = {
      id: `amd_${Date.now()}`,
      filingStatus: 'Under Preparation',
      ...caseItem
    };
    demoDataStore.logAudit({
      user: actor,
      role: 'amendments',
      action: 'Opened Amended Return Case',
      record: `${caseItem.clientName} (${caseItem.amendedForm})`,
      result: 'Success (Simulated)'
    });
    return newCase;
  }
  updateAmendmentStatus(caseId: string, status: AmendmentCaseRecord['filingStatus'], actor: string): void {
    demoDataStore.updateAmendmentStatus(caseId, status, actor);
  }
  simulateFilingAmendment(caseId: string, actor: string): void {
    demoDataStore.updateAmendmentStatus(caseId, 'Filed (Simulated)', actor);
  }
}

export class RecordsService implements IRecordsService {
  getArchiveRecords(): ArchiveRecord[] {
    return demoDataStore.getArchiveRecords();
  }
  archiveEngagement(engagementId: string, actor: string): ArchiveRecord {
    const newArchive: ArchiveRecord = {
      id: `arc_${Date.now()}`,
      engagementId,
      clientName: 'Perotti Capital Holdings LLC',
      taxYear: 2025,
      packageType: 'Full Tax Filing Archive',
      documentCount: 32,
      archiveDate: new Date().toISOString().split('T')[0],
      retentionExpiryDate: '2033-04-15',
      legalHoldActive: false,
      destructionEligible: false,
      destructionStatus: 'Retained Active',
      rolledForward: true
    };
    demoDataStore.logAudit({
      user: actor,
      role: 'records',
      action: 'Archived Engagement Dossier',
      record: `Engagement ${engagementId} - 7 Year Retention Schedule`,
      result: 'Success (Simulated)'
    });
    return newArchive;
  }
  applyLegalHold(archiveId: string, active: boolean, actor: string): void {
    demoDataStore.applyLegalHold(archiveId, active, actor);
  }
  generateSimulatedDestructionCertificate(archiveId: string, actor: string): string {
    const certNumber = `CERT-DESTROY-${Date.now()}`;
    demoDataStore.logAudit({
      user: actor,
      role: 'records',
      action: 'Issued Destruction Certificate (Simulated)',
      record: `Archive #${archiveId} - Certificate ${certNumber}`,
      result: 'Success (Simulated)',
      reason: '7-year statutory retention expired. No legal hold active.'
    });
    return certNumber;
  }
  restoreRecord(archiveId: string, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'records',
      action: 'Restored Archived Record for Audit Defense',
      record: `Archive #${archiveId}`,
      result: 'Success (Simulated)'
    });
  }
}

export class RenewalService implements IRenewalService {
  getRenewalRecords(): ClientRenewalRecord[] {
    return demoDataStore.getRenewalRecords();
  }
  createRenewalProposal(renewal: Omit<ClientRenewalRecord, 'id'>, actor: string): ClientRenewalRecord {
    const newRen: ClientRenewalRecord = {
      id: `ren_${Date.now()}`,
      ...renewal
    };
    demoDataStore.logAudit({
      user: actor,
      role: 'client-success',
      action: 'Generated Annual Renewal Proposal',
      record: `${renewal.clientName} (TY${renewal.renewalTaxYear})`,
      result: 'Success (Simulated)'
    });
    return newRen;
  }
  updateRenewalStatus(id: string, status: ClientRenewalRecord['renewalStatus'], actor: string): void {
    demoDataStore.updateRenewalStatus(id, status, actor);
  }
  rollForwardToNewCycle(clientId: string, nextYear: number, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'client-success',
      action: 'Rolled Forward Client into New Work Cycle',
      record: `Client ${clientId} -> Tax Year ${nextYear}`,
      result: 'Success (Simulated)',
      reason: 'Automated workflow reset to Onboard stage for next tax period.'
    });
  }
}

export class SupportService implements ISupportService {
  getTickets(): SupportTicketRecord[] {
    return demoDataStore.getSupportTickets();
  }
  createTicket(ticket: Omit<SupportTicketRecord, 'id' | 'createdAt'>): SupportTicketRecord {
    return demoDataStore.createSupportTicket(ticket);
  }
  updateTicketStatus(id: string, status: SupportTicketRecord['status'], actor: string): void {
    demoDataStore.updateSupportTicketStatus(id, status, actor);
  }
  resetUserSession(role: DemoRole, actor: string): void {
    demoDataStore.logAudit({
      user: actor,
      role: 'support',
      action: `Reset Demonstration Session for Role: ${role}`,
      record: `Role Session Cache Cleared`,
      result: 'Success (Simulated)'
    });
  }
}

export class HandoffService implements IHandoffService {
  getAllHandoffs(): DemoHandoff[] {
    return demoDataStore.getHandoffs();
  }
  getHandoffsForRole(role: DemoRole): DemoHandoff[] {
    return demoDataStore.getHandoffsForRole(role);
  }
  createHandoff(handoff: Omit<DemoHandoff, 'id'>, actor: string): DemoHandoff {
    return demoDataStore.createHandoff(handoff, actor);
  }
  acceptHandoff(handoffId: string, actor: string, role: DemoRole): void {
    demoDataStore.acceptHandoff(handoffId, actor, role);
  }
  rejectHandoff(handoffId: string, reason: string, actor: string, role: DemoRole): void {
    demoDataStore.rejectHandoff(handoffId, reason, actor, role);
  }
  escalateHandoff(handoffId: string, reason: string, actor: string, role: DemoRole): void {
    demoDataStore.escalateHandoff(handoffId, reason, actor, role);
  }
}

export class GovernmentAgencyRegistryService implements IGovernmentAgencyRegistryService {
  getAllAuthorities(): GovernmentAgencyAuthority[] {
    return demoDataStore.getAgencies();
  }
  getAuthorityById(id: string): GovernmentAgencyAuthority | undefined {
    return demoDataStore.getAgencies().find(a => a.id === id);
  }
  testConnectionSimulated(id: string): { status: 'Not Configured'; message: string; timestamp: string } {
    return {
      status: 'Not Configured',
      message: 'Demonstration placeholder. Direct IRS MeF, BSO, and State DOR web APIs are not configured in demo environment.',
      timestamp: new Date().toISOString()
    };
  }
}

// Export singletons for component injection
export const receptionService = new ReceptionService();
export const engagementService = new EngagementService();
export const verificationService = new VerificationService();
export const documentIntakeService = new DocumentIntakeService();
export const dataEntryService = new DataEntryService();
export const accountsPayableService = new AccountsPayableService();
export const accountsReceivableService = new AccountsReceivableService();
export const qualityControlService = new QualityControlService();
export const filingService = new FilingService();
export const acknowledgementService = new AcknowledgementService();
export const governmentCorrespondenceService = new GovernmentCorrespondenceService();
export const taxResolutionService = new TaxResolutionService();
export const auditService = new AuditService();
export const amendmentService = new AmendmentService();
export const recordsService = new RecordsService();
export const renewalService = new RenewalService();
export const supportService = new SupportService();
export const handoffService = new HandoffService();
export const governmentAgencyRegistryService = new GovernmentAgencyRegistryService();
