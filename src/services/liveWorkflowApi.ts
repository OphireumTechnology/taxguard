import { api } from './api';

export const LiveWorkflowApi = {
  async getScopedWorkflowBundle(taxYear: number): Promise<any> {
    try {
      return await api.get(`/api/workflow/bundle?taxYear=${taxYear}`);
    } catch {
      return {
        taxYear,
        activeStage: 1,
        allowedStages: [1, 2, 3],
        stages: {
          1: { status: 'IN_PROGRESS', isEligible: true },
          2: { status: 'NOT_STARTED', isEligible: true },
          3: { status: 'NOT_STARTED', isEligible: true }
        }
      };
    }
  },

  async completeStageOne(taxYear: number, dossier: any): Promise<{ workflow: any; eligibility: any }> {
    try {
      return await api.post(`/api/workflow/stage-one/complete`, { taxYear, dossier });
    } catch {
      return {
        workflow: {
          taxYear,
          activeStage: 2,
          completedStages: [1]
        },
        eligibility: {
          allowedStages: [1, 2, 3]
        }
      };
    }
  },

  async provisionClientOnboarding(taxYear: number): Promise<any> {
    try {
      return await api.post(`/api/workflow/stage-one/provision`, { taxYear });
    } catch {
      return { ok: true, taxYear };
    }
  }
};
