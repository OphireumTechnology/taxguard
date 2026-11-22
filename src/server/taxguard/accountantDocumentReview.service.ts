export interface ReviewItemDetails {
  id: string;
  documentId?: string;
  clientId?: string;
  taxYear?: number;
  status: string;
  reviewerNotes?: string;
  [key: string]: any;
}

export interface ClientCaseRequestRecord {
  id: string;
  requestId?: string;
  clientId?: string;
  taxYear?: number;
  title?: string;
  message?: string;
  status: string;
  createdAt?: string;
  [key: string]: any;
}

export class AccountantDocumentReviewService {
  async listPendingReviews(_tenantId: string, _clientId?: string): Promise<ReviewItemDetails[]> {
    return [];
  }

  async reviewDocument(
    _documentId: string,
    _actorUid: string,
    _decision: 'approved' | 'rejected' | 'needs_revision',
    _notes?: string
  ): Promise<{ ok: boolean; status: string }> {
    return { ok: true, status: _decision };
  }
}

export const accountantDocumentReviewService = new AccountantDocumentReviewService();
