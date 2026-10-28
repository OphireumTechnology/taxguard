
export type CollectionDocumentStatus = "PENDING" | "UPLOADED" | "EXTRACTED" | "VERIFIED" | "REJECTED";

export interface ChecklistRequirement {
  id: string;
  requirementId: string;
  title: string;
  category: string;
  description: string;
  isRequired: boolean;
  status: "missing" | "fulfilled" | "waived" | "exception";
}

export interface StageTwoUploadedDocument {
  documentId: string;
  clientId: string;
  taxYear: number;
  filename: string;
  fileSize: number;
  claimedCategory: string;
  associatedRequirementId?: string;
  processingStatus: "QUEUED" | "EXTRACTED" | "REVIEWED" | "ACCEPTED" | "REJECTED";
  isVerified: boolean;
  uploadedAt: string;
}

export interface CollectionReadinessReport {
  taxYear: number;
  clientId: string;
  totalRequired: number;
  satisfiedCount: number;
  missingCount: number;
  readyForValidation: boolean;
}

export interface TaxYearCollectionWorkspaceContext {
  clientId: string;
  taxYear: number;
  engagementId: string;
  entityType?: string;
}

export class StageTwoCollectionService {
  private static docs: Map<string, StageTwoUploadedDocument[]> = new Map();
  private static reqs: Map<string, ChecklistRequirement[]> = new Map();

  static getUploadedDocuments(clientId: string, taxYear: number): StageTwoUploadedDocument[] {
    const k = clientId + ":" + taxYear;
    return this.docs.get(k) || [
      {
        documentId: "doc-sample-1",
        clientId,
        taxYear,
        filename: "2025_W2_PrimaryEmployer.pdf",
        fileSize: 245000,
        claimedCategory: "W2",
        associatedRequirementId: "REQ_W2",
        processingStatus: "ACCEPTED",
        isVerified: true,
        uploadedAt: new Date().toISOString()
      }
    ];
  }

  static getRequirements(clientId: string, taxYear: number): ChecklistRequirement[] {
    const k = clientId + ":" + taxYear;
    return this.reqs.get(k) || [
      {
        id: "req-1",
        requirementId: "REQ_W2",
        title: "Form W-2 (Wage and Tax Statement)",
        category: "Federal Documents",
        description: "Official IRS Form W-2 from employers.",
        isRequired: true,
        status: "fulfilled"
      },
      {
        id: "req-2",
        requirementId: "REQ_1099NEC",
        title: "Form 1099-NEC",
        category: "Federal Documents",
        description: "Nonemployee Compensation for independent work.",
        isRequired: true,
        status: "missing"
      }
    ];
  }

  static saveRequirements(clientId: string, taxYear: number, reqs: ChecklistRequirement[]): void {
    const k = clientId + ":" + taxYear;
    this.reqs.set(k, reqs);
  }

  static async ingestDocumentUpload(params: any): Promise<StageTwoUploadedDocument> {
    const doc: StageTwoUploadedDocument = {
      documentId: "doc-" + Date.now(),
      clientId: params.clientId,
      taxYear: params.taxYear,
      filename: params.file?.name || "document.pdf",
      fileSize: params.file?.size || 1024,
      claimedCategory: params.category || "OTHER",
      associatedRequirementId: params.requirementId,
      processingStatus: "ACCEPTED",
      isVerified: true,
      uploadedAt: new Date().toISOString()
    };
    const k = params.clientId + ":" + params.taxYear;
    const existing = this.getUploadedDocuments(params.clientId, params.taxYear);
    this.docs.set(k, [...existing, doc]);
    return doc;
  }
}
