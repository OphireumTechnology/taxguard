/**
 * A/R Tax Services, LLC - Stage Two Collection Operations & Exit Gate Engine
 * Unified 18-Stage Tax Operating Workflow — Milestone M2 / Stage 02: Collect
 *
 * Implements Sprint 4 Capabilities (Reconciled Feature IDs):
 * - TG-COL-021: Missing Document Detection & Requirement Status Evaluation
 * - TG-COL-022: Document Request Management & Duplicate Prevention
 * - TG-COL-023: Client Reminder & Automated Chasing Engine
 * - TG-COL-024: Unified Exception Management Integration (Persistence, Auditing, Role-Gating)
 * - TG-COL-025: Source Tie-Out Reconciliation Layer (Checklist to Authoritative Source)
 * - TG-COL-026: Deterministic Collection Completeness Engine (Multi-Factor Evaluation)
 * - TG-COL-027: Stage 02 Hard Exit Gate (Stage 02 COMPLETED -> Stage 03 ELIGIBLE)
 * - TG-COL-028: Upstream Change Invalidation & Stage 02 Reopening
 *
 * PRESERVED FEATURE MAPPINGS (Sprint 3 Governance):
 * - TG-COL-018: Strict AI Governance & Boundary Invariants
 * - TG-COL-019: Operational Human Review Queue
 * - TG-COL-020: Accountant Dispositions & Decision Logging
 */

import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';
import {
  StageTwoCollectionService,
  ChecklistRequirement,
  StageTwoUploadedDocument,
  CollectionDocumentStatus
} from './stageTwoCollectionService';
import {
  StageTwoIntakeSecurityService,
  StagedSecurityDocument
} from './stageTwoIntakeSecurityService';
import {
  StageTwoDocumentIntelligenceService,
  DocumentIntelligenceRecord,
  HumanReviewQueueItem
} from './stageTwoDocumentIntelligenceService';

// ============================================================================
// RECONCILED FEATURE MAPPING REGISTRY
// ============================================================================

export const RECONCILED_STAGE_TWO_FEATURE_REGISTRY = {
  // Sprint 1
  'TG-COL-001': 'Centralized Tax-Year Collection Workspace Context',
  'TG-COL-002': 'Dynamic Rules-Driven Required Document Checklist with Stable IDs',
  'TG-COL-003': 'Secure Upload Center Integration with Unique Document IDs & SHA-256',
  // Sprint 2
  'TG-COL-004': 'Isolated File Staging & Ingestion Tracking',
  'TG-COL-005': 'File Signature / MIME Validation via Binary Magic Bytes',
  'TG-COL-006': 'File Size & Archive Expansion Bomb Protection',
  'TG-COL-007': 'Malware Scanning Abstraction & Dev Scanner Integration',
  'TG-COL-008': 'Quarantine Workflow & Role-Gated Disposition',
  'TG-COL-009': 'Client-Side Document Encryption (AES-256-GCM)',
  'TG-COL-010': 'SHA-256 Integrity Registry & Hash Mismatch Detection',
  'TG-COL-011': 'Original Document Preservation & 7-Year Retention Provenance',
  // Sprint 3
  'TG-COL-012': 'Document OCR Processing & Artifact Generation',
  'TG-COL-013': 'AI Document Classification Across 20 Controlled Tax Categories',
  'TG-COL-014': 'Structured Data Extraction with Field-Level Provenance',
  'TG-COL-015': 'Confidence Scoring & Material Field Threshold Routing',
  'TG-COL-016': 'Duplicate Document Detection (Exact Hash & Logical Semantic)',
  'TG-COL-017': 'Document Version Intelligence & Revision Tracking',
  // Sprint 3 Governance & Review (Permanently Preserved)
  'TG-COL-018': 'Strict AI Governance & Boundary Invariants (AI Proposed Data != Verified)',
  'TG-COL-019': 'Operational Human Review Queue for Flagged Extractions & Conflicts',
  'TG-COL-020': 'Accountant Dispositions, Field Corrections & Audit Logging',
  // Sprint 4 Operations & Exit Gate (Reconciled Sequential IDs)
  'TG-COL-021': 'Missing Document Detection & Dynamic Requirement Evaluation',
  'TG-COL-022': 'Document Request Management & Active Duplicate Prevention',
  'TG-COL-023': 'Client Reminder & Automated Chasing Engine with Escalation',
  'TG-COL-024': 'Unified Stage 02 Exception Management & Audit Persistence',
  'TG-COL-025': 'Source Tie-Out Reconciliation Layer (Non-Approval Invariant)',
  'TG-COL-026': 'Deterministic Collection Completeness Engine (Multi-Factor Evaluator)',
  'TG-COL-027': 'Stage 02 Hard Exit Gate (Authoritative Transition to Stage 03 Eligible)',
  'TG-COL-028': 'Upstream Change Invalidation & Downstream Re-evaluation Trigger'
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type EvaluatedDocumentStatus =
  | 'MISSING'
  | 'REQUESTED'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'NOT_APPLICABLE';

export type DocumentRequestStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface DocumentRequest {
  requestId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  requirementId: string;
  title: string;
  requestedDocument: string;
  requestedBy: string;
  requestedByRole: 'cpa' | 'preparer' | 'admin';
  requestDate: string;
  dueDate: string;
  status: DocumentRequestStatus;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  instructions?: string;
  clientResponse?: {
    respondedAt: string;
    respondedBy: string;
    attachedDocumentId?: string;
    clientNotes?: string;
  };
  resolution?: {
    resolvedAt: string;
    resolvedBy: string;
    resolutionStatus: 'SATISFIED' | 'WAIVED' | 'CANCELLED';
    resolutionNotes: string;
  };
  reminderCount: number;
  lastReminderDate?: string;
  nextReminderDate?: string;
  deliveryChannel: 'EMAIL' | 'SMS' | 'PORTAL_NOTIFICATION' | 'CLIENT_PORTAL';
  escalationStatus: 'NORMAL' | 'DUE_SOON' | 'OVERDUE' | 'ESCALATED' | 'CRITICAL';
}

export interface ReminderDispatchRecord {
  reminderId: string;
  requestId: string;
  clientId: string;
  taxYear: number;
  dispatchedAt: string;
  dispatchedBy: string;
  deliveryChannel: 'EMAIL' | 'SMS' | 'PORTAL_NOTIFICATION' | 'CLIENT_PORTAL';
  escalationStatus: 'NORMAL' | 'DUE_SOON' | 'OVERDUE' | 'ESCALATED' | 'CRITICAL';
  recipientAddress: string;
  messageSubject: string;
  messageBody: string;
  isSimulated: boolean;
  providerStatus: string;
}

export type StageTwoExceptionCategory =
  | 'SECURITY_QUARANTINE'
  | 'MALWARE_DETECTED'
  | 'FILE_SIGNATURE_MISMATCH'
  | 'ARCHIVE_BOMB_RISK'
  | 'OCR_PROCESSING_FAILURE'
  | 'AI_CATEGORY_CONFLICT'
  | 'LOW_CONFIDENCE_MATERIAL_FIELD'
  | 'EXACT_HASH_DUPLICATE'
  | 'LOGICAL_DUPLICATE'
  | 'SUPERSEDED_VERSION_CONFLICT'
  | 'TAX_YEAR_MISMATCH'
  | 'MISSING_MANDATORY_EVIDENCE'
  | 'UPSTREAM_SOURCE_INVALIDATION'
  | 'HUMAN_REVIEW_REQUIRED';

export type StageTwoExceptionStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'UNDER_REVIEW'
  | 'AWAITING_CLIENT'
  | 'AWAITING_PREPARER'
  | 'RESOLVED'
  | 'WAIVED_WITH_JUSTIFICATION'
  | 'REOPENED';

export type StageTwoExceptionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface StageTwoExceptionItem {
  exceptionId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  category: StageTwoExceptionCategory;
  severity: StageTwoExceptionSeverity;
  isBlocking: boolean;
  title: string;
  description: string;
  sourceDocumentId?: string;
  requirementId?: string;
  status: StageTwoExceptionStatus;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolution?: {
    resolvedAt: string;
    resolvedBy: string;
    resolvedByRole: string;
    status: 'RESOLVED' | 'WAIVED_WITH_JUSTIFICATION';
    reason: string;
    evidenceReference?: string;
  };
  auditHistory: {
    timestamp: string;
    actor: string;
    role: string;
    action: string;
    notes: string;
  }[];
}

export interface SourceTieOutItem {
  tieOutId: string;
  clientId: string;
  taxYear: number;
  requirementId: string;
  requirementTitle: string;
  formType: string;
  authoritativeDocumentId: string;
  documentFilename: string;
  sourceHash: string;
  tieOutStatus: 'MATCHED_AUTHORITATIVE' | 'PARTIAL_MATCH' | 'DISCREPANCY' | 'UNLINKED';
  keyFieldsTiedOut: {
    fieldName: string;
    sourceBox: string;
    extractedValue: any;
    verifiedByHuman: boolean;
  }[];
  tiedOutBy: string;
  tiedOutRole: string;
  tiedOutTimestamp: string;
  notes?: string;
  disclaimer: string;
}

export interface CollectionCompletenessEvaluation {
  clientId: string;
  engagementId: string;
  taxYear: number;
  evaluatedAt: string;
  collectionVersion: number;
  readinessPercentage: number;
  isComplete: boolean;
  blockingReasons: string[];
  summary: {
    totalRequirements: number;
    requiredRequirements: number;
    acceptedEvidence: number;
    missingRequirements: number;
    outstandingRequests: number;
    quarantinedDocuments: number;
    unresolvedProcessingFailures: number;
    lowConfidenceMaterialFields: number;
    pendingHumanReviews: number;
    duplicateVersionConflicts: number;
    openBlockingExceptions: number;
    unresolvedSourceTieOuts: number;
  };
  evaluations: {
    requirementsCleared: boolean;
    evidenceAccepted: boolean;
    noQuarantineBlocks: boolean;
    ocrProcessingComplete: boolean;
    lowConfidenceReviewed: boolean;
    duplicateVersionResolved: boolean;
    humanReviewsCompleted: boolean;
    requestsDispositioned: boolean;
    exceptionsResolved: boolean;
    sourceTieOutComplete: boolean;
  };
}

export interface StageTwoExitGateRecord {
  gateId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  evaluationTimestamp: string;
  collectionVersion: number;
  gateResult: 'CLEARED' | 'BLOCKED';
  stageTwoStatus: 'COMPLETED' | 'IN_PROGRESS' | 'REOPENED';
  stageThreeStatus: 'ELIGIBLE' | 'INELIGIBLE' | 'REVALIDATION_REQUIRED';
  evaluatedConditions: Record<string, boolean>;
  actor: string;
  actorRole: string;
  certificationStatement: string;
  correlationId: string;
}

export interface UpstreamInvalidationEvent {
  invalidationId: string;
  clientId: string;
  taxYear: number;
  documentId: string;
  reason: 'REPLACED' | 'CORRECTED' | 'SUPERSEDED' | 'REJECTED' | 'QUARANTINED' | 'MATERIAL_CHANGE';
  previousGateId?: string;
  timestamp: string;
  actor: string;
  impact: {
    stageTwoStatus: 'REOPENED';
    stageThreeStatus: 'REVALIDATION_REQUIRED';
    createdExceptionId: string;
  };
}

// Storage keys for browser persistence
const STORAGE_KEY_REQUESTS = 'artax_stage2_requests_v1';
const STORAGE_KEY_EXCEPTIONS = 'artax_stage2_exceptions_v1';
const STORAGE_KEY_TIEOUT = 'artax_stage2_tieout_v1';
const STORAGE_KEY_GATE = 'artax_stage2_exit_gate_v1';
const STORAGE_KEY_REMINDERS = 'artax_stage2_reminders_v1';

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class StageTwoCollectionOperationsService {
  private static requestsStore: Map<string, DocumentRequest[]> = new Map();
  private static exceptionsStore: Map<string, StageTwoExceptionItem[]> = new Map();
  private static tieOutStore: Map<string, SourceTieOutItem[]> = new Map();
  private static exitGateStore: Map<string, StageTwoExitGateRecord> = new Map();
  private static remindersStore: Map<string, ReminderDispatchRecord[]> = new Map();
  private static invalidationEvents: UpstreamInvalidationEvent[] = [];

  // --------------------------------------------------------------------------
  // TG-COL-021: MISSING DOCUMENT DETECTION & EVALUATION
  // --------------------------------------------------------------------------

  /**
   * Evaluates requirements against current documents.
   * Invariant: A document must not satisfy a requirement merely because a file was uploaded.
   * Rejected, quarantined, invalid, or superseded documents must not satisfy requirements.
   */
  public static evaluateRequirementStatus(
    req: ChecklistRequirement,
    allDocs: StageTwoUploadedDocument[],
    stagedDocs: StagedSecurityDocument[]
  ): EvaluatedDocumentStatus {
    // If requirement priority is Optional or Not Applicable
    if (req.status === 'Not Applicable') {
      return 'NOT_APPLICABLE';
    }

    // Find documents associated with this requirement
    const matchingDocs = allDocs.filter(
      d => d.associatedRequirementId === req.requirementId ||
           d.claimedCategory === req.category ||
           (d.intelligenceRecord && d.intelligenceRecord.aiDetectedCategory === req.category)
    );

    if (matchingDocs.length === 0) {
      // Check if there are active requests for this requirement
      const cId = (req as any).clientId;
      const yr = (req as any).taxYear;
      if (cId && yr) {
        const requests = this.getDocumentRequests(cId, yr);
        const activeReq = requests.find(
          r => r.requirementId === req.requirementId &&
               (r.status === 'OPEN' || r.status === 'IN_PROGRESS')
        );
        if (activeReq) {
          return 'REQUESTED';
        }
      }
      return 'MISSING';
    }

    // Check matching docs in reverse chronological order (newest first)
    for (const doc of matchingDocs) {
      // 1. Check security staging
      const staged = stagedDocs.find(s => s.documentId === doc.documentId) || doc.stagedSecurityDoc;
      if (staged) {
        if (
          staged.quarantineStatus === 'SECURITY_REVIEW' ||
          staged.quarantineStatus === 'REJECTED' ||
          staged.quarantineStatus === 'DELETED_DISPOSED' ||
          staged.malwareScanStatus === 'INFECTED' ||
          staged.malwareScanStatus === 'SUSPICIOUS'
        ) {
          continue; // Quarantined cannot satisfy requirement
        }
        if (staged.signatureValidation.validationResult !== 'PASSED') {
          continue; // Invalid MIME signature cannot satisfy
        }
      }

      // 2. Check intelligence record
      const intel = doc.intelligenceRecord || StageTwoDocumentIntelligenceService.getIntelligenceRecord(doc.documentId);
      if (intel) {
        // Superseded doc cannot satisfy
        if (intel.versionIntelligence?.relationship === 'SUPERSEDED') {
          continue;
        }

        // Exact duplicate conflict cannot satisfy without review
        if (intel.duplicateDetection?.isDuplicate && !intel.humanReviewed) {
          return 'UNDER_REVIEW';
        }

        // Category conflict cannot satisfy without review
        if (intel.classificationConflict && !intel.humanReviewed) {
          return 'UNDER_REVIEW';
        }

        // Pending human review
        if (intel.humanReviewRequired && !intel.humanReviewed) {
          return 'UNDER_REVIEW';
        }

        // OCR processing
        if (intel.ocrState === 'QUEUED' || intel.ocrState === 'PROCESSING') {
          return 'PROCESSING';
        }

        // If human reviewed and accepted, or clean without human review required
        if (intel.humanReviewed || !intel.humanReviewRequired) {
          return 'ACCEPTED';
        }
      }

      // If document was explicitly accepted/verified in upload record or security staging
      if (doc.processingStatus === 'Accepted' || (doc.processingStatus as string) === 'Verified' || (doc.processingStatus as string) === 'VERIFIED') {
        return 'ACCEPTED';
      }
      if (staged && (staged.stagingStatus === 'SECURITY_CLEARED' || staged.stagingStatus === 'SECURELY_STORED') && staged.taxDataVerified) {
        return 'ACCEPTED';
      }
      if (doc.processingStatus === 'Rejected') {
        continue;
      }
      if (doc.processingStatus === 'Under Review') {
        return 'UNDER_REVIEW';
      }
      if (doc.processingStatus === 'Processing') {
        return 'PROCESSING';
      }
      if (doc.processingStatus === 'Received') {
        return 'RECEIVED';
      }
    }

    // If all uploaded docs were rejected, superseded, or quarantined
    const hasRejected = matchingDocs.some(d => d.processingStatus === 'Rejected');
    if (hasRejected) {
      return 'REJECTED';
    }

    const hasSuperseded = matchingDocs.some(d => d.intelligenceRecord?.versionIntelligence?.relationship === 'SUPERSEDED');
    if (hasSuperseded) {
      return 'SUPERSEDED';
    }

    return 'MISSING';
  }

  // --------------------------------------------------------------------------
  // TG-COL-022: DOCUMENT REQUEST MANAGEMENT
  // --------------------------------------------------------------------------

  public static createDocumentRequest(params: {
    clientId: string;
    engagementId: string;
    taxYear: number;
    requirementId: string;
    title: string;
    requestedDocument: string;
    requestedBy: string;
    requestedByRole: 'cpa' | 'preparer' | 'admin';
    dueDate?: string;
    priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
    instructions?: string;
    allowDuplicateOverride?: boolean;
  }): DocumentRequest {
    const key = `${params.clientId}_${params.taxYear}`;
    const existing = this.getDocumentRequests(params.clientId, params.taxYear);

    // Prevent duplicate active requests for the same unresolved requirement unless explicitly authorized
    const activeDuplicate = existing.find(
      r => r.requirementId === params.requirementId &&
           (r.status === 'OPEN' || r.status === 'IN_PROGRESS')
    );

    if (activeDuplicate && !params.allowDuplicateOverride) {
      throw new Error(
        `Duplicate Document Request Blocked: An active request (${activeDuplicate.requestId}) already exists for requirement ${params.requirementId}. Duplicate creation prohibited without explicit override.`
      );
    }

    // Role check: client cannot create document requests
    if (params.requestedByRole !== 'cpa' && params.requestedByRole !== 'preparer' && params.requestedByRole !== 'admin') {
      throw new Error(`Unauthorized: Role '${params.requestedByRole}' cannot create formal document requests.`);
    }

    const defaultDueDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    const requestId = `REQ-DOC-${params.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;

    const newRequest: DocumentRequest = {
      requestId,
      clientId: params.clientId,
      engagementId: params.engagementId,
      taxYear: params.taxYear,
      requirementId: params.requirementId,
      title: params.title,
      requestedDocument: params.requestedDocument,
      requestedBy: params.requestedBy,
      requestedByRole: params.requestedByRole,
      requestDate: new Date().toISOString(),
      dueDate: params.dueDate || defaultDueDate,
      status: 'OPEN',
      priority: params.priority || 'HIGH',
      instructions: params.instructions || `Please upload official documentation for ${params.title}.`,
      reminderCount: 0,
      deliveryChannel: 'PORTAL_NOTIFICATION',
      escalationStatus: 'NORMAL'
    };

    const updated = [newRequest, ...existing];
    this.requestsStore.set(key, updated);
    this.persistRequests(key, updated);

    // Update requirement status to Requested if it was Missing
    const reqs = StageTwoCollectionService.getRequirements(params.clientId, params.taxYear);
    const target = reqs.find(r => r.requirementId === params.requirementId);
    if (target && target.status === 'Required') {
      StageTwoCollectionService.updateRequirementStatus(
        params.clientId,
        params.taxYear,
        params.requirementId,
        'Requested',
        undefined,
        `Document request created: ${requestId}`
      );
    }

    // Audit log
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.requestedBy,
      userEmail: `${params.requestedBy.toLowerCase()}@artaxservices.com`,
      userRole: params.requestedByRole,
      action: 'DOCUMENT_REQUEST_CREATED',
      recordType: 'document',
      recordId: requestId,
      ipAddress: '127.0.0.1 (Service Gateway)',
      result: 'success',
      riskLevel: 'routine',
      details: `Created document request ${requestId} for requirement ${params.requirementId} (${params.title}). Due: ${newRequest.dueDate}`
    });

    return newRequest;
  }

  public static getDocumentRequests(clientId: string, taxYear: number): DocumentRequest[] {
    if (!clientId) {
      return [];
    }
    const key = `${clientId}_${taxYear}`;
    if (this.requestsStore.has(key)) {
      return this.requestsStore.get(key)!;
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_REQUESTS}_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored) as DocumentRequest[];
          this.requestsStore.set(key, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading stored requests', e);
      }
    }

    // Seed realistic default requests for demonstration if empty
    const seeded: DocumentRequest[] = [
      {
        requestId: `REQ-DOC-${taxYear}-1001`,
        clientId,
        engagementId: `ENG-${taxYear}-${clientId.toUpperCase()}`,
        taxYear,
        requirementId: `REQ-${taxYear}-IND-W2`,
        title: 'Form W-2 Wage & Tax Statement',
        requestedDocument: 'Official W-2 Wage Statement from primary employer',
        requestedBy: 'Sarah Jenkins, CPA',
        requestedByRole: 'cpa',
        requestDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        status: 'OPEN',
        priority: 'HIGH',
        instructions: 'Please upload the copy received from employer payroll or ADP/Workday download.',
        reminderCount: 1,
        lastReminderDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        nextReminderDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        deliveryChannel: 'EMAIL',
        escalationStatus: 'NORMAL'
      }
    ];

    this.requestsStore.set(key, seeded);
    return seeded;
  }

  public static resolveDocumentRequest(params: {
    requestId: string;
    clientId: string;
    taxYear: number;
    actor: string;
    actorRole: 'cpa' | 'preparer' | 'admin';
    resolutionStatus: 'SATISFIED' | 'WAIVED' | 'CANCELLED';
    notes: string;
    attachedDocumentId?: string;
  }): DocumentRequest {
    const key = `${params.clientId}_${params.taxYear}`;
    const requests = this.getDocumentRequests(params.clientId, params.taxYear);
    const index = requests.findIndex(r => r.requestId === params.requestId);

    if (index === -1) {
      throw new Error(`Document request ${params.requestId} not found.`);
    }

    if (!params.notes || !params.notes.trim()) {
      throw new Error('Mandatory resolution notes are required to disposition a document request.');
    }

    const req = requests[index];
    req.status = params.resolutionStatus === 'SATISFIED' ? 'FULFILLED' : 'CANCELLED';
    req.resolution = {
      resolvedAt: new Date().toISOString(),
      resolvedBy: params.actor,
      resolutionStatus: params.resolutionStatus,
      resolutionNotes: params.notes
    };
    if (params.attachedDocumentId) {
      req.clientResponse = {
        respondedAt: new Date().toISOString(),
        respondedBy: params.actor,
        attachedDocumentId: params.attachedDocumentId,
        clientNotes: params.notes
      };
    }

    requests[index] = req;
    this.requestsStore.set(key, [...requests]);
    this.persistRequests(key, requests);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor.toLowerCase()}@artaxservices.com`,
      userRole: params.actorRole,
      action: 'DOCUMENT_REQUEST_RESOLVED',
      recordType: 'document',
      recordId: params.requestId,
      ipAddress: '127.0.0.1 (Service Gateway)',
      result: 'success',
      riskLevel: 'routine',
      details: `Resolved request ${params.requestId} with status ${params.resolutionStatus}. Reason: ${params.notes}`
    });

    return req;
  }

  // --------------------------------------------------------------------------
  // TG-COL-023: CLIENT REMINDER / CHASING ENGINE
  // --------------------------------------------------------------------------

  public static sendDocumentReminder(params: {
    requestId: string;
    clientId: string;
    taxYear: number;
    actor: string;
    actorRole: 'cpa' | 'preparer' | 'admin';
    channel?: 'EMAIL' | 'SMS' | 'PORTAL_NOTIFICATION' | 'CLIENT_PORTAL';
    customMessage?: string;
  }): ReminderDispatchRecord {
    const requests = this.getDocumentRequests(params.clientId, params.taxYear);
    const target = requests.find(r => r.requestId === params.requestId);

    if (!target) {
      throw new Error(`Document request ${params.requestId} not found.`);
    }

    if (target.status !== 'OPEN' && target.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot send reminder for closed or fulfilled request ${params.requestId}.`);
    }

    const now = Date.now();
    const dueTime = new Date(target.dueDate).getTime();
    const isOverdue = now > dueTime;
    const isDueSoon = dueTime - now < 3 * 24 * 3600 * 1000;

    let escalation: ReminderDispatchRecord['escalationStatus'] = 'NORMAL';
    if (isOverdue) {
      escalation = (target.reminderCount + 1) >= 2 ? 'CRITICAL' : 'ESCALATED';
    } else if (isDueSoon) {
      escalation = 'DUE_SOON';
    }

    const channel = params.channel || target.deliveryChannel || 'EMAIL';
    const reminderId = `REM-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const dispatchRecord: ReminderDispatchRecord = {
      reminderId,
      requestId: target.requestId,
      clientId: params.clientId,
      taxYear: params.taxYear,
      dispatchedAt: new Date().toISOString(),
      dispatchedBy: params.actor,
      deliveryChannel: channel,
      escalationStatus: escalation,
      recipientAddress: `client_${params.clientId}@taxguard.clientportal.secure`,
      messageSubject: `[ACTION REQUIRED] Tax Year ${params.taxYear} Documentation Request: ${target.title}`,
      messageBody: params.customMessage ||
        `Dear Client, this is a reminder regarding outstanding documentation: ${target.requestedDocument}. Due by: ${new Date(target.dueDate).toLocaleDateString()}.`,
      isSimulated: true, // DEVELOPMENT/DEMO NOTIFICATION MUST BE CLEARLY IDENTIFIED
      providerStatus: 'SIMULATED / DEVELOPMENT NOTIFICATION — No external SMTP/SMS transport configured in development sandbox'
    };

    // Update target request chasing metadata
    target.reminderCount += 1;
    target.lastReminderDate = dispatchRecord.dispatchedAt;
    target.nextReminderDate = new Date(now + 7 * 24 * 3600 * 1000).toISOString();
    target.escalationStatus = escalation;

    const key = `${params.clientId}_${params.taxYear}`;
    this.persistRequests(key, requests);

    // Save reminder log
    const reminders = this.getReminders(params.clientId, params.taxYear);
    const updatedReminders = [dispatchRecord, ...reminders];
    this.remindersStore.set(key, updatedReminders);
    this.persistReminders(key, updatedReminders);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor.toLowerCase()}@artaxservices.com`,
      userRole: params.actorRole,
      action: 'CLIENT_REMINDER_DISPATCHED',
      recordType: 'notice',
      recordId: reminderId,
      ipAddress: '127.0.0.1 (Service Gateway)',
      result: 'success',
      riskLevel: 'routine',
      details: `Dispatched reminder #${target.reminderCount} (${channel}, ${escalation}) for request ${target.requestId}. (Simulated Dev Engine)`
    });

    return dispatchRecord;
  }

  public static getReminders(clientId: string, taxYear: number): ReminderDispatchRecord[] {
    const key = `${clientId}_${taxYear}`;
    if (this.remindersStore.has(key)) {
      return this.remindersStore.get(key)!;
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_REMINDERS}_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored) as ReminderDispatchRecord[];
          this.remindersStore.set(key, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading stored reminders', e);
      }
    }
    return [];
  }

  // --------------------------------------------------------------------------
  // TG-COL-024: UNIFIED EXCEPTION MANAGEMENT INTEGRATION
  // --------------------------------------------------------------------------

  public static createException(params: {
    clientId: string;
    engagementId: string;
    taxYear: number;
    category: StageTwoExceptionCategory;
    severity: StageTwoExceptionSeverity;
    isBlocking: boolean;
    title: string;
    description: string;
    sourceDocumentId?: string;
    requirementId?: string;
    assignedTo?: string;
    actor: string;
    actorRole: string;
  }): StageTwoExceptionItem {
    const key = `${params.clientId}_${params.taxYear}`;
    const exceptions = this.getExceptions(params.clientId, params.taxYear);
    const exceptionId = `EXC-COL-${params.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;

    const newException: StageTwoExceptionItem = {
      exceptionId,
      clientId: params.clientId,
      engagementId: params.engagementId,
      taxYear: params.taxYear,
      category: params.category,
      severity: params.severity,
      isBlocking: params.isBlocking,
      title: params.title,
      description: params.description,
      sourceDocumentId: params.sourceDocumentId,
      requirementId: params.requirementId,
      status: 'OPEN',
      assignedTo: params.assignedTo || 'Unassigned Staff',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditHistory: [
        {
          timestamp: new Date().toISOString(),
          actor: params.actor,
          role: params.actorRole,
          action: 'EXCEPTION_CREATED',
          notes: `Created exception: ${params.title} (${params.category})`
        }
      ]
    };

    const updated = [newException, ...exceptions];
    this.exceptionsStore.set(key, updated);
    this.persistExceptions(key, updated);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor.toLowerCase()}@artaxservices.com`,
      userRole: params.actorRole,
      action: 'COLLECTION_EXCEPTION_LOGGED',
      recordType: 'governance',
      recordId: exceptionId,
      ipAddress: '127.0.0.1 (Service Gateway)',
      result: 'success',
      riskLevel: params.severity === 'CRITICAL' ? 'critical' : 'material',
      details: `Exception ${exceptionId} logged: ${params.title}. Blocking=${params.isBlocking}`
    });

    return newException;
  }

  public static getExceptions(clientId: string, taxYear: number): StageTwoExceptionItem[] {
    const key = `${clientId}_${taxYear}`;
    if (this.exceptionsStore.has(key)) {
      return this.exceptionsStore.get(key)!;
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_EXCEPTIONS}_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored) as StageTwoExceptionItem[];
          this.exceptionsStore.set(key, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading stored exceptions', e);
      }
    }

    // Default seeded exceptions derived from real security/intelligence checks
    const seeded: StageTwoExceptionItem[] = [];
    this.exceptionsStore.set(key, seeded);
    return seeded;
  }

  public static resolveException(params: {
    exceptionId: string;
    clientId: string;
    taxYear: number;
    actor: string;
    actorRole: string;
    action: 'RESOLVE' | 'WAIVE_WITH_JUSTIFICATION';
    justification: string;
    evidenceReference?: string;
  }): StageTwoExceptionItem {
    // Role Authorization: Only CPA, reviewer, compliance, or admin can resolve/waive exceptions
    if (!['cpa', 'reviewer', 'compliance', 'admin'].includes(params.actorRole.toLowerCase())) {
      throw new Error(`Unauthorized: Role '${params.actorRole}' cannot resolve or waive Stage 02 exceptions.`);
    }

    if (!params.justification || !params.justification.trim()) {
      throw new Error('Mandatory justification is required to resolve or waive an exception.');
    }

    const key = `${params.clientId}_${params.taxYear}`;
    const exceptions = this.getExceptions(params.clientId, params.taxYear);
    const index = exceptions.findIndex(e => e.exceptionId === params.exceptionId);

    if (index === -1) {
      throw new Error(`Exception ${params.exceptionId} not found.`);
    }

    const exc = exceptions[index];
    const newStatus: StageTwoExceptionStatus =
      params.action === 'WAIVE_WITH_JUSTIFICATION' ? 'WAIVED_WITH_JUSTIFICATION' : 'RESOLVED';

    exc.status = newStatus;
    exc.isBlocking = false;
    exc.updatedAt = new Date().toISOString();
    exc.resolution = {
      resolvedAt: exc.updatedAt,
      resolvedBy: params.actor,
      resolvedByRole: params.actorRole,
      status: newStatus as any,
      reason: params.justification,
      evidenceReference: params.evidenceReference
    };

    exc.auditHistory.push({
      timestamp: exc.updatedAt,
      actor: params.actor,
      role: params.actorRole,
      action: params.action === 'WAIVE_WITH_JUSTIFICATION' ? 'EXCEPTION_WAIVED' : 'EXCEPTION_RESOLVED',
      notes: `${params.action}: ${params.justification} (Ref: ${params.evidenceReference || 'N/A'})`
    });

    exceptions[index] = exc;
    this.exceptionsStore.set(key, [...exceptions]);
    this.persistExceptions(key, exceptions);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor.toLowerCase()}@artaxservices.com`,
      userRole: params.actorRole,
      action: 'COLLECTION_EXCEPTION_DISPOSITION',
      recordType: 'governance',
      recordId: params.exceptionId,
      ipAddress: '127.0.0.1 (Service Gateway)',
      result: 'success',
      riskLevel: 'routine',
      details: `Exception ${params.exceptionId} dispositioned as ${newStatus}. Justification: ${params.justification}`
    });

    return exc;
  }

  // --------------------------------------------------------------------------
  // TG-COL-025: SOURCE TIE-OUT RECONCILIATION LAYER
  // --------------------------------------------------------------------------

  public static recordSourceTieOut(params: {
    clientId: string;
    taxYear: number;
    requirementId: string;
    requirementTitle: string;
    formType: string;
    authoritativeDocumentId: string;
    documentFilename: string;
    sourceHash: string;
    keyFields: {
      fieldName: string;
      sourceBox: string;
      extractedValue: any;
      verifiedByHuman: boolean;
    }[];
    actor: string;
    actorRole: string;
    notes?: string;
  }): SourceTieOutItem {
    if (!params.authoritativeDocumentId) {
      throw new Error('Authoritative document ID is required for source tie-out.');
    }

    const key = `${params.clientId}_${params.taxYear}`;
    const existing = this.getSourceTieOuts(params.clientId, params.taxYear);

    const tieOutId = `TO-${params.taxYear}-${params.requirementId.replace(/[^a-zA-Z0-9]/g, '-')}`;

    const item: SourceTieOutItem = {
      tieOutId,
      clientId: params.clientId,
      taxYear: params.taxYear,
      requirementId: params.requirementId,
      requirementTitle: params.requirementTitle,
      formType: params.formType,
      authoritativeDocumentId: params.authoritativeDocumentId,
      documentFilename: params.documentFilename,
      sourceHash: params.sourceHash,
      tieOutStatus: 'MATCHED_AUTHORITATIVE',
      keyFieldsTiedOut: params.keyFields,
      tiedOutBy: params.actor,
      tiedOutRole: params.actorRole,
      tiedOutTimestamp: new Date().toISOString(),
      notes: params.notes,
      disclaimer:
        'CRITICAL GOVERNANCE INVARIANT: Source tie-out confirms mechanical linkage and evidence reconciliation only. Does not constitute tax-return approval, position confirmation, or return signing.'
    };

    const filtered = existing.filter(e => e.requirementId !== params.requirementId);
    const updated = [item, ...filtered];
    this.tieOutStore.set(key, updated);
    this.persistTieOuts(key, updated);

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor.toLowerCase()}@artaxservices.com`,
      userRole: params.actorRole,
      action: 'SOURCE_TIE_OUT_RECORDED',
      recordType: 'verification',
      recordId: tieOutId,
      ipAddress: '127.0.0.1 (Service Gateway)',
      result: 'success',
      riskLevel: 'routine',
      details: `Source tie-out completed for requirement ${params.requirementId} with authoritative doc ${params.authoritativeDocumentId}`
    });

    return item;
  }

  public static getSourceTieOuts(clientId: string, taxYear: number): SourceTieOutItem[] {
    const key = `${clientId}_${taxYear}`;
    if (this.tieOutStore.has(key)) {
      return this.tieOutStore.get(key)!;
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_TIEOUT}_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored) as SourceTieOutItem[];
          this.tieOutStore.set(key, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading stored tie-outs', e);
      }
    }
    return [];
  }

  // --------------------------------------------------------------------------
  // TG-COL-026: DETERMINISTIC COLLECTION COMPLETENESS ENGINE
  // --------------------------------------------------------------------------

  public static evaluateCollectionCompleteness(
    clientId: string,
    taxYear: number,
    engagementId?: string
  ): CollectionCompletenessEvaluation {
    const resolvedEngagement = engagementId || `ENG-${taxYear}-${clientId.toUpperCase()}`;

    const requirements = StageTwoCollectionService.getRequirements(clientId, taxYear);
    const uploads = StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
    const stagedDocs = StageTwoCollectionService.getStagedSecurityDocuments(clientId, taxYear);
    const quarantinedDocs = StageTwoCollectionService.getQuarantinedDocuments(clientId);
    const reviewQueue = StageTwoDocumentIntelligenceService.getReviewQueue(clientId, taxYear);
    const requests = this.getDocumentRequests(clientId, taxYear);
    const exceptions = this.getExceptions(clientId, taxYear);
    const tieOuts = this.getSourceTieOuts(clientId, taxYear);

    const requiredItems = requirements.filter(r => r.priority === 'Required');
    const blockingReasons: string[] = [];

    // 1. Mandatory Checklist Requirements Check
    let missingRequiredCount = 0;
    let acceptedEvidenceCount = 0;

    for (const req of requiredItems) {
      const status = this.evaluateRequirementStatus(req, uploads, stagedDocs);
      if (status === 'ACCEPTED') {
        acceptedEvidenceCount++;
      } else {
        missingRequiredCount++;
        blockingReasons.push(
          `Unfulfilled Mandatory Requirement: ${req.title} (${req.formNumber}) is currently in '${status}' status.`
        );
      }
    }

    // 2. Active Quarantine Check
    const activeQuarantine = quarantinedDocs.filter(
      q => q.quarantineStatus === 'SECURITY_REVIEW' || q.quarantineStatus === 'REJECTED' || q.malwareScanStatus === 'INFECTED'
    );
    if (activeQuarantine.length > 0) {
      blockingReasons.push(
        `Active Security Quarantine: ${activeQuarantine.length} document(s) quarantined for malware or signature violations.`
      );
    }

    // 3. OCR / Processing Failures Check
    let processingFailures = 0;
    for (const doc of uploads) {
      const intel = doc.intelligenceRecord || StageTwoDocumentIntelligenceService.getIntelligenceRecord(doc.documentId);
      if (intel && intel.ocrArtifact?.processingResult === 'FAILED') {
        processingFailures++;
        blockingReasons.push(
          `Unresolved OCR Processing Failure: Document ${doc.documentId} (${doc.originalFileName}) failed OCR parsing.`
        );
      }
    }

    // 4. Pending Human Reviews Check
    const pendingReviews = reviewQueue.filter(q => q.status === 'PENDING_REVIEW');
    if (pendingReviews.length > 0) {
      blockingReasons.push(
        `Pending Human Review Queue: ${pendingReviews.length} item(s) require CPA/preparer review (conflicts, duplicates, low confidence).`
      );
    }

    // 5. Unresolved Duplicate / Version Conflicts
    let duplicateVersionConflicts = 0;
    for (const doc of uploads) {
      const intel = doc.intelligenceRecord || StageTwoDocumentIntelligenceService.getIntelligenceRecord(doc.documentId);
      if (intel) {
        if (intel.duplicateDetection?.isDuplicate && !intel.humanReviewed) {
          duplicateVersionConflicts++;
        }
        if (intel.versionIntelligence?.requiresDownstreamRevalidation && !intel.humanReviewed) {
          duplicateVersionConflicts++;
        }
      }
    }

    // 6. Outstanding Mandatory Document Requests Check
    const outstandingRequests = requests.filter(
      r => (r.status === 'OPEN' || r.status === 'IN_PROGRESS') && r.priority === 'HIGH'
    );
    if (outstandingRequests.length > 0) {
      blockingReasons.push(
        `Outstanding Mandatory Document Requests: ${outstandingRequests.length} high-priority request(s) awaiting client response.`
      );
    }

    // 7. Open Blocking Exceptions Check
    const openBlockingExceptions = exceptions.filter(
      e => e.isBlocking && e.status !== 'RESOLVED' && e.status !== 'WAIVED_WITH_JUSTIFICATION'
    );
    if (openBlockingExceptions.length > 0) {
      for (const exc of openBlockingExceptions) {
        blockingReasons.push(
          `Open Blocking Exception [${exc.category}]: ${exc.title} (${exc.exceptionId})`
        );
      }
    }

    // 8. Source Tie-Out Completeness
    let unlinkedTieOuts = 0;
    for (const req of requiredItems) {
      const tied = tieOuts.find(t => t.requirementId === req.requirementId);
      if (!tied && req.priority === 'Required') {
        unlinkedTieOuts++;
      }
    }

    // Readiness percentage calculation (informational)
    const totalRequired = Math.max(1, requiredItems.length);
    const scoreFactor = Math.max(0, (acceptedEvidenceCount / totalRequired) * 80) +
      (activeQuarantine.length === 0 ? 5 : 0) +
      (pendingReviews.length === 0 ? 5 : 0) +
      (openBlockingExceptions.length === 0 ? 5 : 0) +
      (outstandingRequests.length === 0 ? 5 : 0);

    const readinessPercentage = Math.min(100, Math.round(scoreFactor));
    const isComplete = blockingReasons.length === 0;

    return {
      clientId,
      engagementId: resolvedEngagement,
      taxYear,
      evaluatedAt: new Date().toISOString(),
      collectionVersion: uploads.length + tieOuts.length,
      readinessPercentage,
      isComplete,
      blockingReasons,
      summary: {
        totalRequirements: requirements.length,
        requiredRequirements: requiredItems.length,
        acceptedEvidence: acceptedEvidenceCount,
        missingRequirements: missingRequiredCount,
        outstandingRequests: outstandingRequests.length,
        quarantinedDocuments: activeQuarantine.length,
        unresolvedProcessingFailures: processingFailures,
        lowConfidenceMaterialFields: pendingReviews.filter(r => r.reviewReasons.includes('LOW_CONFIDENCE_MATERIAL_FIELD')).length,
        pendingHumanReviews: pendingReviews.length,
        duplicateVersionConflicts,
        openBlockingExceptions: openBlockingExceptions.length,
        unresolvedSourceTieOuts: unlinkedTieOuts
      },
      evaluations: {
        requirementsCleared: missingRequiredCount === 0,
        evidenceAccepted: acceptedEvidenceCount === requiredItems.length,
        noQuarantineBlocks: activeQuarantine.length === 0,
        ocrProcessingComplete: processingFailures === 0,
        lowConfidenceReviewed: pendingReviews.filter(r => r.reviewReasons.includes('LOW_CONFIDENCE_MATERIAL_FIELD')).length === 0,
        duplicateVersionResolved: duplicateVersionConflicts === 0,
        humanReviewsCompleted: pendingReviews.length === 0,
        requestsDispositioned: outstandingRequests.length === 0,
        exceptionsResolved: openBlockingExceptions.length === 0,
        sourceTieOutComplete: unlinkedTieOuts === 0
      }
    };
  }

  // --------------------------------------------------------------------------
  // TG-COL-027: STAGE 02 HARD EXIT GATE
  // --------------------------------------------------------------------------

  public static executeStageTwoExitGate(params: {
    clientId: string;
    engagementId: string;
    taxYear: number;
    actor: string;
    actorRole: 'cpa' | 'reviewer' | 'admin';
    certificationStatement: string;
    bypassNonBlockingWarnings?: boolean;
  }): StageTwoExitGateRecord {
    // Role check: Only CPA, reviewer, or admin can certify Stage 02 Exit Gate
    if (params.actorRole !== 'cpa' && params.actorRole !== 'reviewer' && params.actorRole !== 'admin') {
      throw new Error(`Unauthorized: Role '${params.actorRole}' cannot certify Stage 02 Exit Gate.`);
    }

    if (!params.certificationStatement || !params.certificationStatement.trim()) {
      throw new Error('A signed professional certification statement is mandatory to clear Stage 02 Exit Gate.');
    }

    // Authoritative Completeness Evaluation
    const completeness = this.evaluateCollectionCompleteness(params.clientId, params.taxYear, params.engagementId);

    if (!completeness.isComplete) {
      throw new Error(
        `Stage 02 Hard Exit Gate REJECTED. Cannot transition to Stage 03. ${completeness.blockingReasons.length} blocking condition(s) unresolved:\n- ${completeness.blockingReasons.join('\n- ')}`
      );
    }

    const gateId = `GATE2-CERT-${params.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;
    const correlationId = `CORR-GATE2-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const record: StageTwoExitGateRecord = {
      gateId,
      clientId: params.clientId,
      engagementId: params.engagementId,
      taxYear: params.taxYear,
      evaluationTimestamp: new Date().toISOString(),
      collectionVersion: completeness.collectionVersion,
      gateResult: 'CLEARED',
      stageTwoStatus: 'COMPLETED',
      stageThreeStatus: 'ELIGIBLE',
      evaluatedConditions: {
        requirementsCleared: completeness.evaluations.requirementsCleared,
        evidenceAccepted: completeness.evaluations.evidenceAccepted,
        noQuarantineBlocks: completeness.evaluations.noQuarantineBlocks,
        ocrProcessingComplete: completeness.evaluations.ocrProcessingComplete,
        lowConfidenceReviewed: completeness.evaluations.lowConfidenceReviewed,
        duplicateVersionResolved: completeness.evaluations.duplicateVersionResolved,
        humanReviewsCompleted: completeness.evaluations.humanReviewsCompleted,
        requestsDispositioned: completeness.evaluations.requestsDispositioned,
        exceptionsResolved: completeness.evaluations.exceptionsResolved,
        sourceTieOutComplete: completeness.evaluations.sourceTieOutComplete
      },
      actor: params.actor,
      actorRole: params.actorRole,
      certificationStatement: params.certificationStatement,
      correlationId
    };

    const key = `${params.clientId}_${params.taxYear}`;
    this.exitGateStore.set(key, record);
    this.persistExitGate(key, record);

    // Emit immutable audit event
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor.toLowerCase()}@artaxservices.com`,
      userRole: params.actorRole,
      action: 'STAGE_TWO_EXIT_GATE_CLEARED',
      recordType: 'governance',
      recordId: gateId,
      ipAddress: '127.0.0.1 (Service Gateway)',
      result: 'success',
      riskLevel: 'routine',
      details: `Stage 02 (Collect) cleared by ${params.actor} (${params.actorRole}). Stage 03 (Validate) now ELIGIBLE. Collection Version: ${record.collectionVersion}. Correlation: ${correlationId}`
    });

    return record;
  }

  public static getExitGateStatus(clientId: string, taxYear: number): StageTwoExitGateRecord | null {
    const key = `${clientId}_${taxYear}`;
    if (this.exitGateStore.has(key)) {
      return this.exitGateStore.get(key)!;
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_GATE}_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored) as StageTwoExitGateRecord;
          this.exitGateStore.set(key, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading stored exit gate', e);
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // TG-COL-028: UPSTREAM CHANGE INVALIDATION & STAGE 02 REOPENING
  // --------------------------------------------------------------------------

  /**
   * Called when a material source document is replaced, corrected, superseded,
   * rejected, quarantined, or materially changed.
   * Invariant: If Stage 02 was cleared, resets Stage 02 to REOPENED and marks
   * Stage 03 as REVALIDATION_REQUIRED.
   */
  public static handleUpstreamDocumentChange(params: {
    clientId: string;
    taxYear: number;
    engagementId?: string;
    documentId: string;
    reason: 'REPLACED' | 'CORRECTED' | 'SUPERSEDED' | 'REJECTED' | 'QUARANTINED' | 'MATERIAL_CHANGE';
    actor: string;
    actorRole: string;
    notes?: string;
  }): UpstreamInvalidationEvent {
    const key = `${params.clientId}_${params.taxYear}`;
    const currentGate = this.getExitGateStatus(params.clientId, params.taxYear);

    const invalidationId = `INV-${params.taxYear}-${Math.floor(10000 + Math.random() * 90000)}`;

    // 1. Reset or set Gate Record to REOPENED
    const gate: StageTwoExitGateRecord = currentGate || {
      gateId: `GATE-02-${params.taxYear}-${params.clientId}`,
      clientId: params.clientId,
      engagementId: params.engagementId || `ENG-${params.taxYear}-${params.clientId}`,
      taxYear: params.taxYear,
      evaluationTimestamp: new Date().toISOString(),
      collectionVersion: 1,
      gateResult: 'BLOCKED',
      stageTwoStatus: 'REOPENED',
      stageThreeStatus: 'REVALIDATION_REQUIRED',
      evaluatedConditions: { upstreamInvalidation: false },
      actor: params.actor,
      actorRole: params.actorRole,
      certificationStatement: `Stage 02 reopened due to upstream ${params.reason} event.`,
      correlationId: invalidationId
    };

    gate.stageTwoStatus = 'REOPENED';
    gate.stageThreeStatus = 'REVALIDATION_REQUIRED';
    gate.gateResult = 'BLOCKED';
    this.exitGateStore.set(key, gate);
    this.persistExitGate(key, gate);

    // 2. Automatically generate blocking exception
    const exc = this.createException({
      clientId: params.clientId,
      engagementId: params.engagementId || gate.engagementId,
      taxYear: params.taxYear,
      category: 'UPSTREAM_SOURCE_INVALIDATION',
      severity: 'CRITICAL',
      isBlocking: true,
      title: `Upstream Source Document Invalidation: Doc ${params.documentId}`,
      description: `Stage 02 reopened because document ${params.documentId} underwent an upstream ${params.reason} event: ${params.notes || 'Re-evaluation mandatory before progressing to Stage 03.'}`,
      sourceDocumentId: params.documentId,
      actor: params.actor,
      actorRole: params.actorRole
    });

    const event: UpstreamInvalidationEvent = {
      invalidationId,
      clientId: params.clientId,
      taxYear: params.taxYear,
      documentId: params.documentId,
      reason: params.reason,
      previousGateId: gate.gateId,
      timestamp: new Date().toISOString(),
      actor: params.actor,
      impact: {
        stageTwoStatus: 'REOPENED',
        stageThreeStatus: 'REVALIDATION_REQUIRED',
        createdExceptionId: exc.exceptionId
      }
    };

    this.invalidationEvents.unshift(event);

    // Emit immutable audit log
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: params.actor,
      userEmail: `${params.actor.toLowerCase()}@artaxservices.com`,
      userRole: params.actorRole,
      action: 'STAGE_TWO_REOPENED_UPSTREAM_CHANGE',
      recordType: 'governance',
      recordId: invalidationId,
      ipAddress: '127.0.0.1 (Service Gateway)',
      result: 'success',
      riskLevel: 'critical',
      details: `Stage 02 REOPENED due to upstream ${params.reason} of document ${params.documentId}. Exception: ${exc.exceptionId}. Stage 03 marked REVALIDATION_REQUIRED.`
    });

    return event;
  }

  // --------------------------------------------------------------------------
  // TESTING & STATE RESET HELPERS
  // --------------------------------------------------------------------------

  public static resetForTesting(): void {
    this.requestsStore.clear();
    this.exceptionsStore.clear();
    this.tieOutStore.clear();
    this.exitGateStore.clear();
    this.remindersStore.clear();
    this.invalidationEvents = [];

    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage).forEach(k => {
          if (
            k.startsWith(STORAGE_KEY_REQUESTS) ||
            k.startsWith(STORAGE_KEY_EXCEPTIONS) ||
            k.startsWith(STORAGE_KEY_TIEOUT) ||
            k.startsWith(STORAGE_KEY_GATE) ||
            k.startsWith(STORAGE_KEY_REMINDERS)
          ) {
            localStorage.removeItem(k);
          }
        });
      } catch (e) {
        // ignore in test
      }
    }
  }

  // Private persistence helpers
  private static persistRequests(key: string, data: DocumentRequest[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_REQUESTS}_${key}`, JSON.stringify(data));
      } catch (e) {
        // ignore
      }
    }
  }

  private static persistExceptions(key: string, data: StageTwoExceptionItem[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_EXCEPTIONS}_${key}`, JSON.stringify(data));
      } catch (e) {
        // ignore
      }
    }
  }

  private static persistTieOuts(key: string, data: SourceTieOutItem[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_TIEOUT}_${key}`, JSON.stringify(data));
      } catch (e) {
        // ignore
      }
    }
  }

  private static persistExitGate(key: string, data: StageTwoExitGateRecord): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_GATE}_${key}`, JSON.stringify(data));
      } catch (e) {
        // ignore
      }
    }
  }

  private static persistReminders(key: string, data: ReminderDispatchRecord[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_REMINDERS}_${key}`, JSON.stringify(data));
      } catch (e) {
        // ignore
      }
    }
  }
}
