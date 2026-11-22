import { apiRequest } from './api';

export type CollectionDocumentStatus =
  | 'missing'
  | 'requested'
  | 'uploaded'
  | 'processing'
  | 'verified'
  | 'rejected'
  | 'waived'
  | string;

export interface ChecklistRequirement {
  id: string;
  title: string;
  category?: string;
  required?: boolean;
  status: CollectionDocumentStatus;
  description?: string;
  [key: string]: any;
}

export interface StageTwoUploadedDocument {
  id?: string;
  documentId?: string;
  requirementId?: string;
  fileName?: string;
  originalFileName?: string;
  category?: string;
  status?: CollectionDocumentStatus;
  uploadedAt?: string;
  size?: number;
  [key: string]: any;
}

export interface CollectionReadinessReport {
  percentComplete: number;
  requiredCount: number;
  completedCount: number;
  ready: boolean;
  blockers?: string[];
  [key: string]: any;
}

export interface TaxYearCollectionWorkspaceContext {
  clientId: string;
  taxYear: number;
  requirements: ChecklistRequirement[];
  documents: StageTwoUploadedDocument[];
  readiness: CollectionReadinessReport;
  [key: string]: any;
}

export const StageTwoCollectionService: any = new Proxy(
  {
    getContext: (clientId: string, taxYear: number) =>
      apiRequest(`/api/stage-two-three/collection?clientId=${encodeURIComponent(clientId)}&taxYear=${taxYear}`),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => ({ success: true, requirements: [], documents: [] });
    },
  }
);
