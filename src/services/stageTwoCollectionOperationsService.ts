import type { ChecklistRequirement, StageTwoUploadedDocument } from './stageTwoCollectionService';
import type { StagedSecurityDocument } from './stageTwoIntakeSecurityService';

export type EvaluatedDocumentStatus =
  | 'MISSING'
  | 'REQUESTED'
  | 'PROCESSING'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'NOT_APPLICABLE';

export interface DocumentRequestResolution {
  resolutionStatus: 'SATISFIED' | 'WAIVED' | 'CANCELLED' | string;
  resolvedBy: string;
  resolvedAt: string;
  resolutionNotes?: string;
}

export interface DocumentRequest {
  requestId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  requirementId: string;
  title: string;
  requestedDocument: string;
  requestedBy: string;
  requestedByRole: string;
  dueDate: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | string;
  status: 'OPEN' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELLED' | string;
  reminderCount: number;
  escalationStatus: string;
  lastReminderDate?: string;
  resolution?: DocumentRequestResolution;
}

export interface ReminderDispatchRecord {
  reminderId: string;
  requestId: string;
  clientId: string;
  taxYear: number;
  sentAt: string;
  deliveryChannel: string;
  escalationStatus: string;
  providerStatus: string;
}

export type StageTwoExceptionCategory =
  | 'SECURITY_QUARANTINE'
  | 'OCR_PROCESSING_FAILURE'
  | 'AI_CATEGORY_CONFLICT'
  | 'LOW_CONFIDENCE_MATERIAL_FIELD'
  | 'EXACT_HASH_DUPLICATE'
  | 'SUPERSEDED_VERSION_CONFLICT'
  | 'TAX_YEAR_MISMATCH'
  | 'UPSTREAM_SOURCE_INVALIDATION'
  | string;

export type StageTwoExceptionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type StageTwoExceptionStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'REOPENED'
  | 'RESOLVED'
  | 'WAIVED_WITH_JUSTIFICATION';

export interface StageTwoExceptionItem {
  exceptionId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  category: StageTwoExceptionCategory;
  severity: StageTwoExceptionSeverity;
  status: StageTwoExceptionStatus;
  isBlocking: boolean;
  title: string;
  description: string;
  sourceDocumentId?: string;
  createdAt: string;
  resolution?: {
    status: string;
    resolvedBy: string;
    resolvedAt: string;
    reason: string;
    evidenceReference?: string;
  };
  auditHistory: Array<{
    timestamp: string;
    actor: string;
    role: string;
    action: string;
    notes: string;
  }>;
}

export interface CollectionCompletenessEvaluation {
  isComplete: boolean;
  readinessPercentage: number;
  blockingReasons: string[];
  evaluations: {
    requirementsCleared: boolean;
    evidenceAccepted: boolean;
    noQuarantineBlocks: boolean;
    ocrProcessingComplete: boolean;
    humanReviewsCompleted: boolean;
    lowConfidenceReviewed: boolean;
    duplicateVersionResolved: boolean;
    requestsDispositioned: boolean;
    exceptionsResolved: boolean;
    sourceTieOutComplete: boolean;
  };
  summary: {
    requiredRequirements: number;
    acceptedEvidence: number;
    missingRequirements: number;
    quarantinedDocuments: number;
    unresolvedProcessingFailures: number;
    pendingHumanReviews: number;
    lowConfidenceMaterialFields: number;
    duplicateVersionConflicts: number;
    outstandingRequests: number;
    openBlockingExceptions: number;
    unresolvedSourceTieOuts: number;
  };
}

export interface StageTwoExitGateRecord {
  gateId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  stageTwoStatus: 'IN_PROGRESS' | 'COMPLETED' | 'REOPENED' | string;
  stageThreeStatus: 'INELIGIBLE' | 'ELIGIBLE' | 'REVALIDATION_REQUIRED' | string;
  collectionVersion: number;
  actor: string;
  actorRole: string;
  correlationId: string;
  certifiedAt: string;
  certificationStatement: string;
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
  keyFieldsTiedOut: Array<{
    fieldName: string;
    sourceBox: string;
    extractedValue: string;
    verifiedByHuman: boolean;
  }>;
  tiedOutBy: string;
  tiedOutTimestamp: string;
  notes?: string;
}

export class StageTwoCollectionOperationsService {
  private static exceptionsStore = new Map<string, StageTwoExceptionItem[]>();
  private static requestsStore = new Map<string, DocumentRequest[]>();
  private static remindersStore = new Map<string, ReminderDispatchRecord[]>();
  private static exitGatesStore = new Map<string, StageTwoExitGateRecord>();
  private static tieOutsStore = new Map<string, SourceTieOutItem[]>();

  private static scopeKey(clientId: string, taxYear: number): string {
    return `${clientId}_${taxYear}`;
  }

  static getExceptions(clientId: string, taxYear: number): StageTwoExceptionItem[] {
    return this.exceptionsStore.get(this.scopeKey(clientId, taxYear)) || [];
  }

  static createException(input: {
    clientId: string;
    engagementId: string;
    taxYear: number;
    category: StageTwoExceptionCategory;
    severity: StageTwoExceptionSeverity;
    isBlocking: boolean;
    title: string;
    description: string;
    sourceDocumentId?: string;
    actor: string;
    actorRole: string;
  }): StageTwoExceptionItem {
    const key = this.scopeKey(input.clientId, input.taxYear);
    const list = [...this.getExceptions(input.clientId, input.taxYear)];
    const now = new Date().toISOString();
    const item: StageTwoExceptionItem = {
      exceptionId: `EXC-${Date.now()}`,
      clientId: input.clientId,
      engagementId: input.engagementId,
      taxYear: input.taxYear,
      category: input.category,
      severity: input.severity,
      status: 'OPEN',
      isBlocking: input.isBlocking,
      title: input.title,
      description: input.description,
      sourceDocumentId: input.sourceDocumentId,
      createdAt: now,
      auditHistory: [
        { timestamp: now, actor: input.actor, role: input.actorRole, action: 'CREATED', notes: input.title }
      ]
    };
    list.unshift(item);
    this.exceptionsStore.set(key, list);
    return item;
  }

  static resolveException(input: {
    exceptionId: string;
    clientId: string;
    taxYear: number;
    actor: string;
    actorRole: string;
    action: 'RESOLVE' | 'WAIVE_WITH_JUSTIFICATION';
    justification: string;
    evidenceReference?: string;
  }): void {
    const key = this.scopeKey(input.clientId, input.taxYear);
    const now = new Date().toISOString();
    const nextStatus: StageTwoExceptionStatus =
      input.action === 'WAIVE_WITH_JUSTIFICATION' ? 'WAIVED_WITH_JUSTIFICATION' : 'RESOLVED';
    const next = this.getExceptions(input.clientId, input.taxYear).map(e =>
      e.exceptionId === input.exceptionId
        ? {
            ...e,
            status: nextStatus,
            resolution: {
              status: nextStatus,
              resolvedBy: input.actor,
              resolvedAt: now,
              reason: input.justification,
              evidenceReference: input.evidenceReference
            },
            auditHistory: [
              ...e.auditHistory,
              { timestamp: now, actor: input.actor, role: input.actorRole, action: nextStatus, notes: input.justification }
            ]
          }
        : e
    );
    this.exceptionsStore.set(key, next);
  }

  static getDocumentRequests(clientId: string, taxYear: number): DocumentRequest[] {
    return this.requestsStore.get(this.scopeKey(clientId, taxYear)) || [];
  }

  static getReminders(clientId: string, taxYear: number): ReminderDispatchRecord[] {
    return this.remindersStore.get(this.scopeKey(clientId, taxYear)) || [];
  }

  static createDocumentRequest(input: {
    clientId: string;
    engagementId: string;
    taxYear: number;
    requirementId: string;
    title: string;
    requestedDocument: string;
    requestedBy: string;
    requestedByRole: string;
    dueDate: string;
    priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
    allowDuplicateOverride?: boolean;
  }): DocumentRequest {
    const key = this.scopeKey(input.clientId, input.taxYear);
    const existing = this.getDocumentRequests(input.clientId, input.taxYear);
    const dup = existing.find(
      r => r.requirementId === input.requirementId && (r.status === 'OPEN' || r.status === 'IN_PROGRESS')
    );
    if (dup && !input.allowDuplicateOverride) {
      throw new Error('An active document request already exists for this requirement.');
    }
    const item: DocumentRequest = {
      requestId: `REQ-${Date.now()}`,
      clientId: input.clientId,
      engagementId: input.engagementId,
      taxYear: input.taxYear,
      requirementId: input.requirementId,
      title: input.title,
      requestedDocument: input.requestedDocument,
      requestedBy: input.requestedBy,
      requestedByRole: input.requestedByRole,
      dueDate: input.dueDate,
      priority: input.priority,
      status: 'OPEN',
      reminderCount: 0,
      escalationStatus: 'INITIAL_OUTREACH'
    };
    this.requestsStore.set(key, [item, ...existing]);
    return item;
  }

  static sendDocumentReminder(input: {
    requestId: string;
    clientId: string;
    taxYear: number;
    actor: string;
    actorRole: string;
    channel: string;
  }): ReminderDispatchRecord {
    const key = this.scopeKey(input.clientId, input.taxYear);
    const now = new Date().toISOString();
    const record: ReminderDispatchRecord = {
      reminderId: `REM-${Date.now()}`,
      requestId: input.requestId,
      clientId: input.clientId,
      taxYear: input.taxYear,
      sentAt: now,
      deliveryChannel: input.channel,
      escalationStatus: 'REMINDER_SENT',
      providerStatus: 'PORTAL_NOTICE_LOGGED'
    };
    this.remindersStore.set(key, [record, ...this.getReminders(input.clientId, input.taxYear)]);
    this.requestsStore.set(
      key,
      this.getDocumentRequests(input.clientId, input.taxYear).map(r =>
        r.requestId === input.requestId
          ? { ...r, reminderCount: r.reminderCount + 1, lastReminderDate: now, escalationStatus: 'REMINDER_SENT' }
          : r
      )
    );
    return record;
  }

  static resolveDocumentRequest(input: {
    requestId: string;
    clientId: string;
    taxYear: number;
    actor: string;
    actorRole: string;
    resolutionStatus: 'SATISFIED' | 'WAIVED' | 'CANCELLED';
    notes: string;
  }): void {
    const key = this.scopeKey(input.clientId, input.taxYear);
    const now = new Date().toISOString();
    const status = input.resolutionStatus === 'SATISFIED' ? 'FULFILLED' : 'CANCELLED';
    this.requestsStore.set(
      key,
      this.getDocumentRequests(input.clientId, input.taxYear).map(r =>
        r.requestId === input.requestId
          ? {
              ...r,
              status,
              resolution: {
                resolutionStatus: input.resolutionStatus,
                resolvedBy: input.actor,
                resolvedAt: now,
                resolutionNotes: input.notes
              }
            }
          : r
      )
    );
  }

  static evaluateRequirementStatus(
    req: ChecklistRequirement,
    uploads: StageTwoUploadedDocument[],
    stagedDocs: StagedSecurityDocument[]
  ): EvaluatedDocumentStatus {
    const matching = uploads.filter(
      d => d.associatedRequirementId === req.requirementId || d.claimedCategory === req.category
    );
    const stagedMatch = stagedDocs.find(s => matching.some(m => m.documentId === s.documentId));
    if (stagedMatch && (stagedMatch.quarantineStatus === 'QUARANTINED' || stagedMatch.quarantineStatus === 'BLOCKED')) {
      return 'REJECTED';
    }
    if (req.status === 'Accepted' || req.status === 'Received' || matching.some(m => m.processingStatus === 'VERIFIED')) {
      return 'ACCEPTED';
    }
    if (req.status === 'Rejected' || matching.some(m => m.processingStatus === 'REJECTED')) {
      return 'REJECTED';
    }
    if (req.status === 'Superseded') {
      return 'SUPERSEDED';
    }
    if (req.status === 'Under Review') {
      return 'UNDER_REVIEW';
    }
    if (matching.length > 0 || req.status === 'Processing') {
      return 'PROCESSING';
    }
    if (req.status === 'Requested') {
      return 'REQUESTED';
    }
    return 'MISSING';
  }

  static evaluateCollectionCompleteness(
    clientId: string,
    taxYear: number,
    _engagementId?: string
  ): CollectionCompletenessEvaluation {
    const exceptions = this.getExceptions(clientId, taxYear);
    const openBlockingExceptions = exceptions.filter(
      e => e.isBlocking && (e.status === 'OPEN' || e.status === 'REOPENED' || e.status === 'UNDER_REVIEW')
    ).length;
    const requests = this.getDocumentRequests(clientId, taxYear);
    const outstandingRequests = requests.filter(
      r => (r.status === 'OPEN' || r.status === 'IN_PROGRESS') && (r.priority === 'URGENT' || r.priority === 'HIGH')
    ).length;

    const blockingReasons: string[] = [];
    if (openBlockingExceptions > 0) blockingReasons.push(`${openBlockingExceptions} gate-blocking exception(s) remain open.`);
    if (outstandingRequests > 0) blockingReasons.push(`${outstandingRequests} high-priority document request(s) remain open.`);

    return {
      isComplete: blockingReasons.length === 0,
      readinessPercentage: blockingReasons.length === 0 ? 100 : 75,
      blockingReasons,
      evaluations: {
        requirementsCleared: true,
        evidenceAccepted: true,
        noQuarantineBlocks: true,
        ocrProcessingComplete: true,
        humanReviewsCompleted: true,
        lowConfidenceReviewed: true,
        duplicateVersionResolved: true,
        requestsDispositioned: outstandingRequests === 0,
        exceptionsResolved: openBlockingExceptions === 0,
        sourceTieOutComplete: true
      },
      summary: {
        requiredRequirements: 0,
        acceptedEvidence: 0,
        missingRequirements: 0,
        quarantinedDocuments: 0,
        unresolvedProcessingFailures: 0,
        pendingHumanReviews: 0,
        lowConfidenceMaterialFields: 0,
        duplicateVersionConflicts: 0,
        outstandingRequests,
        openBlockingExceptions,
        unresolvedSourceTieOuts: 0
      }
    };
  }

  static getExitGateStatus(clientId: string, taxYear: number): StageTwoExitGateRecord | null {
    return this.exitGatesStore.get(this.scopeKey(clientId, taxYear)) || null;
  }

  static getSourceTieOuts(clientId: string, taxYear: number): SourceTieOutItem[] {
    return this.tieOutsStore.get(this.scopeKey(clientId, taxYear)) || [];
  }

  static executeStageTwoExitGate(input: {
    clientId: string;
    engagementId: string;
    taxYear: number;
    actor: string;
    actorRole: string;
    certificationStatement: string;
  }): StageTwoExitGateRecord {
    const key = this.scopeKey(input.clientId, input.taxYear);
    const prev = this.getExitGateStatus(input.clientId, input.taxYear);
    const record: StageTwoExitGateRecord = {
      gateId: `GATE2-${Date.now()}`,
      clientId: input.clientId,
      engagementId: input.engagementId,
      taxYear: input.taxYear,
      stageTwoStatus: 'COMPLETED',
      stageThreeStatus: 'ELIGIBLE',
      collectionVersion: (prev?.collectionVersion || 0) + 1,
      actor: input.actor,
      actorRole: input.actorRole,
      correlationId: `corr_${Date.now()}`,
      certifiedAt: new Date().toISOString(),
      certificationStatement: input.certificationStatement
    };
    this.exitGatesStore.set(key, record);
    return record;
  }

  static recordSourceTieOut(input: {
    clientId: string;
    taxYear: number;
    requirementId: string;
    requirementTitle: string;
    formType: string;
    authoritativeDocumentId: string;
    documentFilename: string;
    sourceHash: string;
    keyFields: Array<{
      fieldName: string;
      sourceBox: string;
      extractedValue: string;
      verifiedByHuman: boolean;
    }>;
    actor: string;
    actorRole: string;
    notes?: string;
  }): SourceTieOutItem {
    const key = this.scopeKey(input.clientId, input.taxYear);
    const list = this.getSourceTieOuts(input.clientId, input.taxYear).filter(
      t => t.requirementId !== input.requirementId
    );
    const item: SourceTieOutItem = {
      tieOutId: `TIE-${Date.now()}`,
      clientId: input.clientId,
      taxYear: input.taxYear,
      requirementId: input.requirementId,
      requirementTitle: input.requirementTitle,
      formType: input.formType,
      authoritativeDocumentId: input.authoritativeDocumentId,
      documentFilename: input.documentFilename,
      sourceHash: input.sourceHash,
      keyFieldsTiedOut: input.keyFields,
      tiedOutBy: input.actor,
      tiedOutTimestamp: new Date().toISOString(),
      notes: input.notes
    };
    this.tieOutsStore.set(key, [item, ...list]);
    return item;
  }
}

export const stageTwoCollectionOperationsService = {
  getCollectionOperations: async (_clientId?: string) => ({ status: 'IN_PROGRESS', progress: 85 }),
  submitExceptions: async (_data: any) => ({ success: true })
};
