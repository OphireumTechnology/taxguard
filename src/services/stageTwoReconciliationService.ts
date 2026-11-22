import { apiRequest } from './api';

export interface ReconciledRequirementCard {
  id: string;
  title: string;
  category?: string;
  status: string;
  required?: boolean;
  uploadedDocuments?: any[];
  exceptions?: any[];
  [key: string]: any;
}

export interface StageTwoAuthoritativeSnapshot {
  clientId: string;
  taxYear: number;
  cards: ReconciledRequirementCard[];
  percentComplete: number;
  readyForNextStage: boolean;
  updatedAt?: string;
  [key: string]: any;
}

export const StageTwoReconciliationService: any = new Proxy(
  {
    getSnapshot: (clientId: string, taxYear: number) =>
      apiRequest(`/api/stage-two-three/reconciliation?clientId=${encodeURIComponent(clientId)}&taxYear=${taxYear}`),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => ({ cards: [], percentComplete: 0, readyForNextStage: false });
    },
  }
);
