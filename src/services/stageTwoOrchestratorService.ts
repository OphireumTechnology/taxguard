import { apiRequest } from './api';

export interface StageTwoCollectionSummaryReport {
  clientId: string;
  taxYear: number;
  percentComplete: number;
  requiredTotal: number;
  verifiedCount: number;
  missingCount: number;
  exceptionCount: number;
  readyForStageThree: boolean;
  generatedAt: string;
  incomeSummary: {
    employmentCount: number;
    interestCount: number;
    dividendsCount: number;
    brokerageCount: number;
    businessCount: number;
    [key: string]: number;
  };
  [key: string]: any;
}

export const StageTwoOrchestratorService: any = new Proxy(
  {
    getSummaryReport: (clientId: string, taxYear: number) =>
      apiRequest(`/api/stage-two-three/summary?clientId=${encodeURIComponent(clientId)}&taxYear=${taxYear}`),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => ({
        percentComplete: 0,
        requiredTotal: 0,
        verifiedCount: 0,
        missingCount: 0,
        exceptionCount: 0,
        readyForStageThree: false,
        generatedAt: new Date().toISOString(),
      });
    },
  }
);
