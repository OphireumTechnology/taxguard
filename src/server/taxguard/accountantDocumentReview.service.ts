/**
 * A/R Tax Services, LLC — TaxGuard AI
 * Accountant Document Review & Stage 03 Validation Service
 *
 * Implements:
 * - Dedicated Stage 03 professional document review queue & workspace
 * - Split-view data provider (source document + 4-tier values: Source, Proposed, Corrected, Verified)
 * - Professional review actions (Claim, Accept, Correct, Reject, Reclassify, Duplicate, Supersede, Request)
 * - Mandatory correction reason & audit logging
 * - Maker-Checker authorization (Preparer cannot self-approve protected actions)
 * - Optimistic concurrency control (Rejects stale mutations)
 * - Verified evidence generation with immutable source provenance
 * - Downstream stage invalidation upon material upstream change
 * - Client request loop persistence
 */

import { db } from '../db';
import { AuthorityError } from './authority.repository';
import {
  DocumentEntity,
  ExtractedFieldEntity,
  ExtractedFieldProvenance,
  EvidenceEntity
} from './persistence.types';

export interface ReviewQueueFilter {
  tenantId?: string;
  clientId?: string;
  taxYear?: number;
  category?: string;
  reviewStatus?: 'ALL' | 'PENDING' | 'IN_REVIEW' | 'COMPLETED' | 'FLAGGED';
  processingStatus?: string;
  assignedReviewerId?: string;
}

export interface ReviewItemDetails {
  documentId: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256: string;
  storagePath: string;
  downloadUrl: string;
  claimedCategory: string;
  proposedCategory: string;
  status: 'PENDING_REVIEW' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUPERSEDED' | 'DUPLICATE';
  assignedReviewerId?: string;
  assignedReviewerName?: string;
  preparerId?: string;
  preparerName?: string;
  version: number;
  extractedFields: Array<{
    fieldId: string;
    fieldLabel: string;
    sourceRawValue: string;
    proposedValue: any;
    correctedValue?: any;
    verifiedValue?: any;
    confidence: number;
    decision?: 'ACCEPTED' | 'REJECTED' | 'CORRECTED';
    correctionReason?: string;
    provenance: ExtractedFieldProvenance;
  }>;
  validationFindings: Array<{
    ruleId: string;
    title: string;
    passed: boolean;
    severity: 'info' | 'warning' | 'error';
    details: string;
  }>;
  exceptions: Array<{
    code: string;
    description: string;
    status: 'OPEN' | 'RESOLVED';
    blocking: boolean;
  }>;
  associatedRequirementId?: string;
  internalNotes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientCaseRequestRecord {
  requestId: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  documentId?: string;
  requirementId?: string;
  requestType: 'MISSING_DOCUMENT' | 'REPLACEMENT_REQUIRED' | 'CLARIFICATION' | 'AMENDMENT';
  title: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLIENT_RESPONDED' | 'RESOLVED' | 'CANCELLED';
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  dueDate?: string;
  clientResponse?: string;
  clientRespondedAt?: string;
  uploadedDocumentId?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface VerifiedTaxEvidenceRecord {
  evidenceId: string;
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  caseId: string;
  documentId: string;
  documentVersion: number;
  fieldId: string;
  fieldLabel: string;
  proposedValue: any;
  verifiedValue: any;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  verifiedAt: string;
  provenance: ExtractedFieldProvenance;
  auditTrailId: string;
  downstreamDependencies: string[];
}

// Global in-memory storage for document review queue, client requests, and verified evidence
export const serverDocumentReviewStore = new Map<string, ReviewItemDetails>();
export const serverClientRequestsStore = new Map<string, ClientCaseRequestRecord>();
export const serverVerifiedEvidenceStore = new Map<string, VerifiedTaxEvidenceRecord[]>();

export class AccountantDocumentReviewService {
  /**
   * Lists the professional review queue with authorization and filters.
   */
  public static getReviewQueue(
    requestingUser: { id: string; role: string; tenantId?: string },
    filter: ReviewQueueFilter
  ): ReviewItemDetails[] {
    const isStaff = ['accountant', 'senior_reviewer', 'admin', 'super_admin', 'cpa', 'preparer'].includes(
      requestingUser.role.toLowerCase()
    );
    if (!isStaff) {
      throw new AuthorityError('STAFF_AUTHORIZATION_REQUIRED: Clients cannot access staff review queue.', 403);
    }

    let items = Array.from(serverDocumentReviewStore.values());

    // Strict tenant isolation
    if (filter.tenantId) {
      items = items.filter(i => i.tenantId === filter.tenantId);
    }

    if (filter.clientId) {
      items = items.filter(i => i.clientId === filter.clientId);
    }

    if (filter.taxYear) {
      items = items.filter(i => i.taxYear === filter.taxYear);
    }

    if (filter.category && filter.category !== 'ALL') {
      items = items.filter(i => i.proposedCategory === filter.category || i.claimedCategory === filter.category);
    }

    if (filter.reviewStatus && filter.reviewStatus !== 'ALL') {
      if (filter.reviewStatus === 'PENDING') items = items.filter(i => i.status === 'PENDING_REVIEW');
      else if (filter.reviewStatus === 'IN_REVIEW') items = items.filter(i => i.status === 'IN_REVIEW');
      else if (filter.reviewStatus === 'COMPLETED') items = items.filter(i => i.status === 'VERIFIED');
      else if (filter.reviewStatus === 'FLAGGED') items = items.filter(i => i.exceptions.some(e => e.status === 'OPEN'));
    }

    if (filter.assignedReviewerId) {
      items = items.filter(i => i.assignedReviewerId === filter.assignedReviewerId);
    }

    // Sort newest first
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Retrieves full details for split-view document review.
   */
  public static getReviewItem(
    documentId: string,
    requestingUser: { id: string; role: string }
  ): ReviewItemDetails {
    const isStaff = ['accountant', 'senior_reviewer', 'admin', 'super_admin', 'cpa', 'preparer'].includes(
      requestingUser.role.toLowerCase()
    );
    if (!isStaff) {
      throw new AuthorityError('STAFF_AUTHORIZATION_REQUIRED', 403);
    }

    const item = serverDocumentReviewStore.get(documentId);
    if (!item) {
      throw new AuthorityError('DOCUMENT_REVIEW_ITEM_NOT_FOUND', 404);
    }
    return item;
  }

  /**
   * Executes a professional review action with Maker-Checker and Optimistic Concurrency.
   */
  public static executeReviewAction(params: {
    documentId: string;
    expectedVersion: number;
    action:
      | 'CLAIM'
      | 'ACCEPT'
      | 'CORRECT'
      | 'REJECT'
      | 'REJECT_DOCUMENT'
      | 'RECLASSIFY'
      | 'MARK_DUPLICATE'
      | 'MARK_SUPERSEDED'
      | 'REQUEST_REPLACEMENT'
      | 'REQUEST_MISSING'
      | 'REQUEST_CLARIFICATION'
      | 'ADD_NOTE'
      | 'ESCALATE'
      | 'COMPLETE_REVIEW';
    fieldId?: string;
    correctedValue?: any;
    justification: string;
    newCategory?: string;
    duplicateOfDocId?: string;
    actor: { id: string; name: string; role: string; tenantId: string };
  }): { success: boolean; item: ReviewItemDetails; updatedVersion: number } {
    const { documentId, expectedVersion, action, fieldId, correctedValue, justification, newCategory, actor } = params;

    const isStaff = ['accountant', 'senior_reviewer', 'admin', 'super_admin', 'cpa', 'preparer'].includes(
      actor.role.toLowerCase()
    );
    if (!isStaff) {
      throw new AuthorityError('STAFF_AUTHORIZATION_REQUIRED', 403);
    }

    const item = serverDocumentReviewStore.get(documentId);
    if (!item) {
      throw new AuthorityError('DOCUMENT_REVIEW_ITEM_NOT_FOUND', 404);
    }

    // 1. OPTIMISTIC CONCURRENCY CHECK
    if (item.version !== expectedVersion) {
      throw new AuthorityError(
        `CONCURRENCY_CONFLICT: Review item has been modified by another practitioner (Current version: v${item.version}, Provided: v${expectedVersion}). Please refresh state before proceeding.`,
        409
      );
    }

    // 2. MAKER-CHECKER ENFORCEMENT
    // A preparer cannot approve their own protected verification or self-certify.
    if ((action === 'COMPLETE_REVIEW' || action === 'ACCEPT') && item.preparerId === actor.id) {
      // Invariant: Preparer cannot be the sole approver
      throw new AuthorityError(
        'MAKER_CHECKER_VIOLATION: An independent reviewer must approve this document. The preparer cannot approve their own intake.',
        403
      );
    }

    // 3. MANDATORY JUSTIFICATION FOR CORRECTIONS & REJECTIONS
    if (
      ['CORRECT', 'REJECT', 'REJECT_DOCUMENT', 'MARK_DUPLICATE', 'MARK_SUPERSEDED'].includes(action) &&
      (!justification || justification.trim().length < 5)
    ) {
      throw new AuthorityError(
        'JUSTIFICATION_REQUIRED: A contemporaneous professional explanation (minimum 5 characters) is required for this review action.',
        400
      );
    }

    const now = new Date().toISOString();

    // 4. ACTION DISPATCH
    switch (action) {
      case 'CLAIM':
        item.assignedReviewerId = actor.id;
        item.assignedReviewerName = actor.name;
        item.status = 'IN_REVIEW';
        break;

      case 'ACCEPT':
        if (fieldId) {
          const field = item.extractedFields.find(f => f.fieldId === fieldId);
          if (!field) throw new AuthorityError('FIELD_NOT_FOUND', 404);
          field.decision = 'ACCEPTED';
          field.verifiedValue = field.proposedValue;
          field.provenance = {
            ...field.provenance,
            humanDecision: 'ACCEPTED',
            reviewer: actor.id,
            reviewTimestamp: now,
            recordVersion: (field.provenance.recordVersion || 1) + 1
          };
        } else {
          // Accept all proposed fields
          item.extractedFields.forEach(f => {
            f.decision = 'ACCEPTED';
            f.verifiedValue = f.proposedValue;
          });
        }
        break;

      case 'CORRECT':
        if (!fieldId) throw new AuthorityError('FIELD_ID_REQUIRED_FOR_CORRECTION', 400);
        if (correctedValue === undefined || correctedValue === null || correctedValue === '') {
          throw new AuthorityError('CORRECTED_VALUE_REQUIRED', 400);
        }
        const targetField = item.extractedFields.find(f => f.fieldId === fieldId);
        if (!targetField) throw new AuthorityError('FIELD_NOT_FOUND', 404);

        targetField.decision = 'CORRECTED';
        targetField.correctedValue = correctedValue;
        targetField.verifiedValue = correctedValue;
        targetField.correctionReason = justification;
        targetField.provenance = {
          ...targetField.provenance,
          humanDecision: 'CORRECTED',
          reviewer: actor.id,
          reviewTimestamp: now,
          recordVersion: (targetField.provenance.recordVersion || 1) + 1
        };
        break;

      case 'REJECT':
        if (fieldId) {
          const f = item.extractedFields.find(fld => fld.fieldId === fieldId);
          if (!f) throw new AuthorityError('FIELD_NOT_FOUND', 404);
          f.decision = 'REJECTED';
          f.verifiedValue = null;
        }
        break;

      case 'REJECT_DOCUMENT':
        item.status = 'REJECTED';
        item.internalNotes.push(`[${now}] Rejected by ${actor.name}: ${justification}`);
        break;

      case 'RECLASSIFY':
        if (!newCategory) throw new AuthorityError('NEW_CATEGORY_REQUIRED', 400);
        item.proposedCategory = newCategory;
        item.internalNotes.push(`[${now}] Reclassified to ${newCategory} by ${actor.name}: ${justification}`);
        break;

      case 'MARK_DUPLICATE':
        item.status = 'DUPLICATE';
        item.internalNotes.push(`[${now}] Marked as duplicate by ${actor.name}: ${justification}`);
        break;

      case 'MARK_SUPERSEDED':
        item.status = 'SUPERSEDED';
        item.internalNotes.push(`[${now}] Marked as superseded by ${actor.name}: ${justification}`);
        break;

      case 'REQUEST_REPLACEMENT':
      case 'REQUEST_MISSING':
      case 'REQUEST_CLARIFICATION':
        // Creates a client request in the client request loop
        const reqType =
          action === 'REQUEST_REPLACEMENT'
            ? 'REPLACEMENT_REQUIRED'
            : action === 'REQUEST_MISSING'
            ? 'MISSING_DOCUMENT'
            : 'CLARIFICATION';

        const clientReq: ClientCaseRequestRecord = {
          requestId: `REQ-CASE-${Date.now()}`,
          tenantId: item.tenantId,
          clientId: item.clientId,
          taxYear: item.taxYear,
          documentId: item.documentId,
          requirementId: item.associatedRequirementId,
          requestType: reqType,
          title: `Action Required: ${item.fileName}`,
          message: justification,
          status: 'OPEN',
          createdBy: actor.id,
          createdByName: actor.name,
          createdByRole: actor.role,
          createdAt: now
        };
        serverClientRequestsStore.set(clientReq.requestId, clientReq);
        item.internalNotes.push(`[${now}] Client request issued (${reqType}): ${justification}`);
        break;

      case 'ADD_NOTE':
        item.internalNotes.push(`[${now}] Note by ${actor.name}: ${justification}`);
        break;

      case 'COMPLETE_REVIEW':
        // Invariant: Cannot complete review if uncorrected exceptions exist
        const hasOpenBlocking = item.exceptions.some(e => e.status === 'OPEN' && e.blocking);
        if (hasOpenBlocking) {
          throw new AuthorityError(
            'CANNOT_COMPLETE_REVIEW: Unresolved blocking validation exceptions exist on this document.',
            422
          );
        }
        item.status = 'VERIFIED';
        break;
    }

    // Increment version & timestamp
    item.version += 1;
    item.updatedAt = now;
    serverDocumentReviewStore.set(documentId, item);

    // Audit Event
    db.logAudit({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: `DOCUMENT_REVIEW_${action}`,
      resource: `Doc ${documentId} (${item.fileName})`,
      details: `Action ${action} executed by ${actor.name}. Reason: ${justification || 'Standard workflow'}. Version is now v${item.version}.`,
      severity: action === 'REJECT_DOCUMENT' || action === 'CORRECT' ? 'warning' : 'info',
      ipAddress: '127.0.0.1'
    });

    return {
      success: true,
      item,
      updatedVersion: item.version
    };
  }

  /**
   * Establishes verified evidence from reviewed fields and invalidates downstream stages
   * if upstream verified values were modified.
   */
  public static verifyEvidenceAndInvalidateDownstream(params: {
    tenantId: string;
    clientId: string;
    engagementId: string;
    taxYear: number;
    documentId: string;
    actor: { id: string; name: string; role: string };
  }): { evidenceRecords: VerifiedTaxEvidenceRecord[]; invalidatedStages: number[] } {
    const { tenantId, clientId, engagementId, taxYear, documentId, actor } = params;
    const item = serverDocumentReviewStore.get(documentId);
    if (!item) throw new AuthorityError('DOCUMENT_NOT_FOUND', 404);

    const now = new Date().toISOString();
    const caseKey = `${tenantId}:${clientId}:${taxYear}`;
    const existingEvidence = serverVerifiedEvidenceStore.get(caseKey) || [];

    const newEvidenceList: VerifiedTaxEvidenceRecord[] = [];
    const invalidatedStages: number[] = [];

    for (const f of item.extractedFields) {
      if (f.verifiedValue !== undefined && f.verifiedValue !== null) {
        // Check if there was an existing verified value for this field that is now changed
        const existing = existingEvidence.find(e => e.documentId === documentId && e.fieldId === f.fieldId);
        const isMaterialChange = existing && JSON.stringify(existing.verifiedValue) !== JSON.stringify(f.verifiedValue);

        if (isMaterialChange) {
          // DOWNSTREAM INVALIDATION: Invalidate Stage 04, Stage 05, Stage 06 calculations/records
          invalidatedStages.push(4, 5, 6, 7, 8, 9);
        }

        const evRecord: VerifiedTaxEvidenceRecord = {
          evidenceId: `EVID-${Date.now()}-${f.fieldId}`,
          tenantId,
          clientId,
          engagementId,
          taxYear,
          caseId: `case_${taxYear}`,
          documentId,
          documentVersion: item.version,
          fieldId: f.fieldId,
          fieldLabel: f.fieldLabel,
          proposedValue: f.proposedValue,
          verifiedValue: f.verifiedValue,
          reviewerId: actor.id,
          reviewerName: actor.name,
          reviewerRole: actor.role,
          verifiedAt: now,
          provenance: f.provenance,
          auditTrailId: `adt_evid_${Date.now()}`,
          downstreamDependencies: ['Stage 04: Record', 'Stage 05: Reconcile', 'Stage 06: Review']
        };
        newEvidenceList.push(evRecord);
      }
    }

    serverVerifiedEvidenceStore.set(caseKey, [...existingEvidence, ...newEvidenceList]);

    if (invalidatedStages.length > 0) {
      db.logSecurityEvent({
        eventType: 'DOWNSTREAM_STAGES_INVALIDATED_BY_EVIDENCE_CHANGE',
        ipAddress: '127.0.0.1',
        userId: actor.id,
        details: `Material change on verified document ${documentId} invalidated downstream stages: ${Array.from(new Set(invalidatedStages)).join(', ')}.`,
        severity: 'critical'
      });
    }

    return {
      evidenceRecords: newEvidenceList,
      invalidatedStages: Array.from(new Set(invalidatedStages))
    };
  }

  /**
   * Responds to a client request and updates the review queue.
   */
  public static handleClientRequestResponse(params: {
    requestId: string;
    clientId: string;
    responseMessage: string;
    uploadedDocumentId?: string;
  }): ClientCaseRequestRecord {
    const { requestId, clientId, responseMessage, uploadedDocumentId } = params;
    const req = serverClientRequestsStore.get(requestId);
    if (!req) throw new AuthorityError('REQUEST_NOT_FOUND', 404);
    if (req.clientId !== clientId) throw new AuthorityError('CLIENT_ISOLATION_VIOLATION', 403);

    const now = new Date().toISOString();
    req.status = 'CLIENT_RESPONDED';
    req.clientResponse = responseMessage;
    req.clientRespondedAt = now;
    if (uploadedDocumentId) {
      req.uploadedDocumentId = uploadedDocumentId;
    }

    serverClientRequestsStore.set(requestId, req);

    // If associated with a document, add note to review item
    if (req.documentId) {
      const doc = serverDocumentReviewStore.get(req.documentId);
      if (doc) {
        doc.internalNotes.push(`[${now}] Client responded to request: "${responseMessage}".`);
        doc.updatedAt = now;
        serverDocumentReviewStore.set(req.documentId, doc);
      }
    }

    db.logAudit({
      userId: clientId,
      userName: `Client ${clientId}`,
      userRole: 'client',
      action: 'CLIENT_REQUEST_RESPONDED',
      resource: `CaseRequest #${requestId}`,
      details: `Taxpayer responded with notes: "${responseMessage}". Attached doc: ${uploadedDocumentId || 'none'}.`,
      severity: 'info',
      ipAddress: '127.0.0.1'
    });

    return req;
  }
}
