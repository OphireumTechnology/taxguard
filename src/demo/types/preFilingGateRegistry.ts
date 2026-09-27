/**
 * A/R Tax Services, LLC - Authoritative Pre-Filing Gate Registry Types & Contracts
 * Strict 7-Point Quality-Control Release Model, Maker-Checker Enforcement,
 * Simulated Government Acknowledgements, Rejection Correction, and Immutable Archive.
 * 
 * DEMONSTRATION ENVIRONMENT ONLY — No live IRS or state filing is performed.
 */

export type GateId = 
  | 'gate-1-verification'
  | 'gate-2-documents'
  | 'gate-3-accounting'
  | 'gate-4-exceptions'
  | 'gate-5-qc-review'
  | 'gate-6-client-authorization'
  | 'gate-7-filing-release';

export type GateState = 
  | 'Not Evaluated'
  | 'Blocked'
  | 'Awaiting Client'
  | 'Awaiting Preparer'
  | 'Awaiting Reviewer'
  | 'Ready for Review'
  | 'Cleared'
  | 'Reopened'
  | 'Superseded'
  | 'Not Applicable with Approval';

export type GateCategory = 
  | 'Verification'
  | 'Documents'
  | 'Accounting'
  | 'Diagnostics'
  | 'Quality Control'
  | 'Client Authorization'
  | 'Filing Release';

export type ResponsibleRole = 
  | 'Preparer'
  | 'Reviewer'
  | 'Client'
  | 'Filing Operator'
  | 'Lead CPA'
  | 'System';

export interface PreFilingGate {
  gateId: GateId | string;
  gateNumber: number;
  name: string;
  description: string;
  category: GateCategory | string;
  isRequired: boolean;
  isCleared: boolean;
  blockingReason?: string;
  blockingItems: string[];
  requiredEvidence: string[];
  responsibleRole: ResponsibleRole | string;
  clearedBy?: string;
  clearedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reopenedAt?: string;
  reopenReason?: string;
  ruleVersion: string;
  taxYear: number;
  lastEvaluatedAt: string;
  status: GateState | string;

  // Backward-compatibility properties
  id: string; // alias for gateId
  label: string; // alias for name
  isBlocking: boolean; // alias for !isCleared
  blockReason?: string; // alias for blockingReason
  ownerRole?: string; // alias for responsibleRole
}

export interface MakerCheckerRecord {
  id: string;
  maker: string;
  checker: string;
  role: string;
  action: string;
  decision: 'Approved' | 'Rejected' | 'Returned for Correction' | 'Reopened';
  reason: string;
  beforeState: string;
  afterState: string;
  timestamp: string;
  returnVersion: string;
  gateAffected: string;
}

export interface GateOverrideRecord {
  id: string;
  gateId: GateId | string;
  authorizedRole: string;
  authorizedBy: string;
  writtenReason: string;
  supportingEvidence: string;
  riskAcknowledgement: boolean;
  secondaryApprover: string;
  effectiveDate: string;
  expirationDate?: string;
  auditEventId: string;
  timestamp: string;
}

export type SimulatedAckStatus =
  | 'Federal accepted, state pending'
  | 'Federal rejected, state not submitted'
  | 'Federal accepted, state rejected'
  | 'Federal pending'
  | 'Duplicate submission detected'
  | 'Transmission timeout'
  | 'Technical rejection'
  | 'Business-rule rejection'
  | 'Correction required'
  | 'Resubmission accepted';

export interface SimulatedAcknowledgementRecord {
  demoAcknowledgementId: string;
  demoSubmissionId: string;
  jurisdiction: 'IRS (Federal)' | 'SC Department of Revenue (State)' | 'NC Department of Revenue' | 'Multi-State Gateway' | string;
  returnType: string;
  taxYear: number;
  status: SimulatedAckStatus | string;
  responseCode: string;
  plainLanguageExplanation: string;
  technicalDetails: string;
  receivedTimestamp: string;
  requiredAction: string;
  correctionDeadline?: string;
  relatedFilingVersion: string;
  auditCorrelationId: string;
  agency?: string;
  code?: string;
  transmissionHash?: string;
  electronicPostmark?: string;
  statutoryNotice?: string;
}

export interface RejectionCorrectionRecord {
  rejectionId: string;
  submissionId: string;
  classification: 'Name Control / Identity' | 'Missing Form / Attachment' | 'Schema / XML Error' | 'PIN / Signature Mismatch' | 'Schedule Balance Error' | string;
  plainLanguageExplanation: string;
  assignedStaff: string;
  assignedRole: string;
  clientActionRequired: boolean;
  clientNotificationSent: boolean;
  affectedGateIds: string[];
  originalSubmissionId: string;
  correctedReturnVersion: string;
  reviewerReapprovalRequired: boolean;
  clientReauthorizationRequired: boolean;
  resubmissionAuthorized: boolean;
  resubmissionSubmissionId?: string;
  resubmissionAcknowledgementId?: string;
  status: 'Assigned' | 'In Correction' | 'Under Review' | 'Re-authorized' | 'Resubmitted' | 'Resolved';
  history: {
    timestamp: string;
    note: string;
    author: string;
  }[];
}

export interface DemoFilingRecordExtended {
  submissionId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  returnType: string;
  filingDateTime: string;
  filingTimestamp?: string;
  filingMethod: string;
  efileProvider: string;
  status: string;
  acceptanceDateTime?: string;
  rejectionReason?: string;
  correctionHistory?: string[];
  accountantSigner: string;
  authorizationRecordId: string;
  mefTransmissionHash: string;
  transmissionHash?: string;
  auditTrailId: string;

  // Extended properties for Filing Operations & Authoritative Registry
  packageVersion: string;
  jurisdictions: string[];
  preparer: string;
  reviewer: string;
  clientApprovalStatus: 'Client Approved (Demo)' | 'Pending Client Review' | 'Changes Requested by Client' | string;
  form8879Status: 'Authorized & E-Signed (Demo)' | 'Pending Client Signature' | 'Invalidated due to Material Change' | string;
  gateStatus: 'All 7 Gates Cleared' | 'Blocked (Pending Gates)' | string;
  releaseStatus: 'Ready for Demo Release' | 'Demo Release Authorized' | 'Release Blocked' | 'Released (Simulated)' | string;
  duplicateSubmissionStatus: 'Passed (Unique Transmission)' | 'Duplicate Detected' | string;
  simulationStatus: 'Queued' | 'Transmitted (Simulated)' | 'Acknowledged (Simulated)' | 'Pending Execution';
  latestAcknowledgement?: SimulatedAcknowledgementRecord;
  idempotencyKey?: string;
}

export interface ArchivedReturnPackage {
  archiveId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  returnType: string;
  finalApprovedVersion: string;
  clientCopyUrl: string;
  workpaperIndex: { name: string; category: string; hash: string }[];
  sourceManifest: { docId: string; docName: string; pageCount: number; verifiedDate: string }[];
  approvalHistory: MakerCheckerRecord[];
  form8879Record: {
    signedBy: string;
    signedAt: string;
    documentHash: string;
    ipAddressMasked: string;
  };
  filingReleaseAuth: {
    authorizedBy: string;
    role: string;
    timestamp: string;
  };
  submissionRecord: DemoFilingRecordExtended;
  acknowledgementRecord: SimulatedAcknowledgementRecord;
  correctionHistory: RejectionCorrectionRecord[];
  gateClearanceHistory: PreFilingGate[];
  auditSummary: string[];
  retentionStatus: string;
  integrityHash: string;
  legalHoldStatus: boolean;
  accessLogs: {
    user: string;
    timestamp: string;
    action: string;
  }[];
}

export interface ClientFilingNotification {
  notificationId: string;
  clientId: string;
  taxYear: number;
  entityName: string;
  status: 
    | 'Preparing Return'
    | 'Professional Review'
    | 'Awaiting Your Review'
    | 'Awaiting Your Authorization'
    | 'Ready for Demo Filing'
    | 'Demo Submission Sent'
    | 'Demo Acknowledgement Pending'
    | 'Demo Accepted'
    | 'Client Action Required'
    | 'Correction in Progress'
    | 'Demo Completed';
  title: string;
  plainLanguageMessage: string;
  targetSection: string;
  isDemonstration: true;
  timestamp: string;
  isRead: boolean;
}
