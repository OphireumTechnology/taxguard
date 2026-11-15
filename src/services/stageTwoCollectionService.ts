import type { StagedSecurityDocument } from './stageTwoIntakeSecurityService';
import type {
  DocumentIntelligenceRecord,
  HumanReviewAction,
  HumanReviewQueueItem,
  TaxDocumentCategory
} from './stageTwoDocumentIntelligenceService';

export type CollectionDocumentStatus =
  | 'Required'
  | 'Requested'
  | 'Received'
  | 'Processing'
  | 'Under Review'
  | 'Accepted'
  | 'Rejected'
  | 'Missing'
  | 'Superseded'
  | 'Not Applicable'
  | string;

export interface ChecklistRequirement {
  requirementId: string;
  title: string;
  formNumber: string;
  category: string;
  jurisdiction: string;
  description: string;
  priority: 'Required' | 'Recommended' | 'Optional' | string;
  status: CollectionDocumentStatus;
  statutoryBasis?: string;
  reason?: string;
  [key: string]: any;
}

export interface CollectionReadinessReport {
  readinessScore: number;
  receivedCount: number;
  requiredCount: number;
  missingCount: number;
  rejectedCount: number;
  underReviewCount: number;
  isReadyForStageThree: boolean;
  nextAction?: {
    message: string;
    supportingText: string;
  };
}

export interface TaxYearCollectionWorkspaceContext {
  clientId: string;
  engagementId: string;
  taxYear: number;
  entityName: string;
  returnType: string;
  jurisdictions: string[];
  assignedPreparer: string;
  assignedReviewer: string;
}

export interface StageTwoUploadedDocument {
  documentId: string;
  associatedRequirementId?: string;
  claimedCategory?: string;
  isVerified?: boolean;
  originalFileName: string;
  processingStatus: 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'VERIFIED' | 'REJECTED' | string;
  taxYear: number;
  uploadTimestamp: string;
  fileSizeBytes: number;
  sha256Hash: string;
  mimeType?: string;
  downloadUrl?: string;
  intelligenceRecord?: DocumentIntelligenceRecord;
  [key: string]: any;
}

export class StageTwoCollectionService {
  static inMemoryUploads: Map<string, StageTwoUploadedDocument[]> = new Map();
  private static inMemoryReqs: Map<string, ChecklistRequirement[]> = new Map();
  private static inMemoryStaged: Map<string, StagedSecurityDocument[]> = new Map();
  private static inMemoryIntel: Map<string, DocumentIntelligenceRecord> = new Map();
  private static inMemoryReviewQueue: Map<string, HumanReviewQueueItem[]> = new Map();

  static getWorkspaceContext(clientId?: string, taxYear?: number): TaxYearCollectionWorkspaceContext {
    return {
      clientId: clientId || 'user_client_1',
      engagementId: `eng_${taxYear || 2025}_01`,
      taxYear: taxYear || 2025,
      entityName: 'Perotti Financial Consulting LLC',
      returnType: 'Form 1120-S & Form 1040',
      jurisdictions: ['Federal (IRS)', 'South Carolina'],
      assignedPreparer: 'Desmond Hinds, CPA',
      assignedReviewer: 'Sarah Jenkins, CPA'
    };
  }

  static getUploadedDocuments(clientId?: string, taxYear?: number): StageTwoUploadedDocument[] {
    const key = `${clientId || 'default'}_${taxYear || 2025}`;
    return this.inMemoryUploads.get(key) || [];
  }

  static getRequirements(clientId?: string, taxYear?: number): ChecklistRequirement[] {
    const key = `${clientId || 'default'}_${taxYear || 2025}`;
    return this.inMemoryReqs.get(key) || [];
  }

  static saveRequirements(clientId: string, taxYear: number, reqs: ChecklistRequirement[]): void {
    const key = `${clientId}_${taxYear}`;
    this.inMemoryReqs.set(key, reqs);
  }

  static updateRequirementStatus(
    clientId: string,
    taxYear: number,
    requirementId: string,
    status: CollectionDocumentStatus,
    _actor?: string,
    reason?: string
  ): ChecklistRequirement[] {
    const reqs = [...this.getRequirements(clientId, taxYear)];
    const updated = reqs.map(r =>
      r.requirementId === requirementId ? { ...r, status, ...(reason ? { reason } : {}) } : r
    );
    this.saveRequirements(clientId, taxYear, updated);
    return updated;
  }

  static evaluateCollectionReadiness(clientId?: string, taxYear?: number): CollectionReadinessReport {
    const reqs = this.getRequirements(clientId, taxYear);
    const required = reqs.filter(r => r.priority === 'Required' && r.status !== 'Not Applicable');
    const received = required.filter(r => r.status === 'Received' || r.status === 'Accepted').length;
    const missing = required.filter(r => r.status === 'Required' || r.status === 'Missing' || r.status === 'Requested').length;
    const rejected = required.filter(r => r.status === 'Rejected').length;
    const underReview = required.filter(r => r.status === 'Under Review' || r.status === 'Processing').length;
    const score = required.length === 0 ? 0 : Math.round((received / required.length) * 100);
    return {
      readinessScore: score,
      receivedCount: received,
      requiredCount: required.length,
      missingCount: missing,
      rejectedCount: rejected,
      underReviewCount: underReview,
      isReadyForStageThree: required.length > 0 && missing === 0 && rejected === 0,
      nextAction: missing > 0
        ? {
            message: `${missing} required source document(s) remaining`,
            supportingText: 'Upload or resolve remaining required documents to advance collection.'
          }
        : undefined
    };
  }

  static getStagedSecurityDocuments(clientId?: string, taxYear?: number): StagedSecurityDocument[] {
    const key = `${clientId || 'default'}_${taxYear || 2025}`;
    return this.inMemoryStaged.get(key) || [];
  }

  static getQuarantinedDocuments(clientId?: string): StagedSecurityDocument[] {
    const results: StagedSecurityDocument[] = [];
    for (const [k, docs] of this.inMemoryStaged.entries()) {
      if (!clientId || k.startsWith(`${clientId}_`)) {
        results.push(...docs.filter(d => d.quarantineStatus === 'QUARANTINED' || d.pipelineStage === 'QUARANTINED'));
      }
    }
    return results;
  }

  static dispositionQuarantinedDocument(input: {
    documentId: string;
    actor: string;
    actorRole: string;
    disposition: 'CLEARED' | 'REJECTED' | 'DELETED_DISPOSED';
    reason: string;
  }): { success: boolean } {
    for (const [key, docs] of this.inMemoryStaged.entries()) {
      const next = docs.map(d =>
        d.documentId === input.documentId
          ? {
              ...d,
              quarantineStatus: (input.disposition === 'CLEARED' ? 'CLEAN' : 'BLOCKED') as StagedSecurityDocument['quarantineStatus'],
              pipelineStage: (input.disposition === 'CLEARED' ? 'READY_FOR_OCR' : 'REJECTED') as StagedSecurityDocument['pipelineStage'],
              notes: input.reason
            }
          : d
      );
      this.inMemoryStaged.set(key, next);
    }
    return { success: true };
  }

  static getHumanReviewQueue(clientId?: string, taxYear?: number, _role?: string): HumanReviewQueueItem[] {
    const key = `${clientId || 'default'}_${taxYear || 2025}`;
    return this.inMemoryReviewQueue.get(key) || [];
  }

  static executeHumanReviewAction(input: {
    documentId: string;
    actor: string;
    actorRole: string;
    action: HumanReviewAction;
    justification: string;
    fieldCorrections?: Record<string, any>;
    reclassifiedCategory?: TaxDocumentCategory;
  }): { success: boolean } {
    for (const [key, items] of this.inMemoryReviewQueue.entries()) {
      const next = items.map(item =>
        item.documentId === input.documentId
          ? { ...item, status: 'REVIEWED', reason: input.justification }
          : item
      );
      this.inMemoryReviewQueue.set(key, next);
    }
    return { success: true };
  }

  static getIntelligenceRecord(documentId: string): DocumentIntelligenceRecord | undefined {
    return this.inMemoryIntel.get(documentId);
  }

  static async ingestDocumentUpload(data: any): Promise<StageTwoUploadedDocument> {
    const doc: StageTwoUploadedDocument = {
      documentId: 'doc_' + Date.now(),
      associatedRequirementId: data?.requirementId,
      claimedCategory: data?.category || 'general',
      isVerified: false,
      originalFileName: data?.file?.name || data?.fileName || 'document.pdf',
      processingStatus: 'UPLOADED',
      taxYear: data?.taxYear || 2025,
      uploadTimestamp: new Date().toISOString(),
      fileSizeBytes: data?.file?.size || 0,
      sha256Hash: '0'.repeat(64)
    };
    const key = `${data?.clientId || 'default'}_${doc.taxYear}`;
    const list = [...this.getUploadedDocuments(data?.clientId, doc.taxYear), doc];
    this.inMemoryUploads.set(key, list);
    return doc;
  }
}

export const stageTwoCollectionService = {
  getMissingDocuments: async (_clientId?: string) => [],
  getPendingRequests: async (_clientId?: string) => [],
  getUploadedDocuments: (clientId?: string, taxYear?: number) => StageTwoCollectionService.getUploadedDocuments(clientId, taxYear)
};
