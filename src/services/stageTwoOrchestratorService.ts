/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StageTwoCollectionSummaryReport {
  clientId: string;
  taxYear: number;
  totalRequirements: number;
  fulfilledRequirements: number;
  completionPercentage: number;
  unresolvedExceptionsCount: number;
  readinessStatus: 'NOT_READY' | 'READY_FOR_REVIEW' | 'STAGE_EXIT_APPROVED';
  categories: Array<{
    categoryName: string;
    total: number;
    fulfilled: number;
  }>;
  outstandingItems: Array<{
    id: string;
    title: string;
    priority: string;
    reason: string;
  }>;
}

export const StageTwoOrchestratorService = {
  getSummaryReport: async (clientId: string, taxYear: number): Promise<StageTwoCollectionSummaryReport> => {
    return {
      clientId,
      taxYear,
      totalRequirements: 6,
      fulfilledRequirements: 5,
      completionPercentage: 83,
      unresolvedExceptionsCount: 0,
      readinessStatus: 'READY_FOR_REVIEW',
      categories: [
        { categoryName: 'Income & W-2s', total: 2, fulfilled: 2 },
        { categoryName: '1099 Statements', total: 2, fulfilled: 2 },
        { categoryName: 'Bank & Financials', total: 1, fulfilled: 1 },
        { categoryName: 'State Jurisdiction', total: 1, fulfilled: 0 }
      ],
      outstandingItems: [
        { id: 'sc_withholding', title: 'SC Form WH-1612 State Withholding Summary', priority: 'Medium', reason: 'Awaiting client upload' }
      ]
    };
  }
};
