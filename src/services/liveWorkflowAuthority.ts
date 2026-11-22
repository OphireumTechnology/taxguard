import { LiveWorkflowApi } from './liveWorkflowApi';

export interface LiveWorkflowAuthoritySnapshot {
  status: 'loading' | 'ready' | 'unavailable' | 'error' | string;
  clientId?: string;
  taxYear: number;
  activeStage?: number;
  completedStages?: number[];
  stageStates?: Record<string, string>;
  workflow?: any;
  eligibility?: Record<string, any>;
  error?: string | null;
  authoritative?: boolean;
  updatedAt?: string;
  [key: string]: any;
}

export const LiveWorkflowAuthority: any = {
  async fetchSnapshot(clientId: string, taxYear: number): Promise<LiveWorkflowAuthoritySnapshot> {
    try {
      const state = await LiveWorkflowApi.getState(clientId, taxYear);
      const activeStage = Number(state?.activeStage || 1);
      return {
        status: 'ready',
        clientId,
        taxYear,
        activeStage,
        completedStages: Array.isArray(state?.completedStages) ? state.completedStages : [],
        stageStates: state?.stageStates || { '1': 'in_progress' },
        workflow: {
          activeStage,
          stageStates: state?.stageStates || { '1': 'in_progress' },
          completedStages: Array.isArray(state?.completedStages) ? state.completedStages : [],
          ...state,
        },
        eligibility: state?.eligibility || {},
        error: null,
        authoritative: true,
        updatedAt: state?.updatedAt || new Date().toISOString(),
        ...state,
      };
    } catch (err: any) {
      return {
        status: 'unavailable',
        clientId,
        taxYear,
        activeStage: 1,
        completedStages: [],
        stageStates: { '1': 'in_progress' },
        workflow: null,
        eligibility: {},
        error: err?.message || 'Unable to verify workflow state.',
        authoritative: false,
        updatedAt: new Date().toISOString(),
      };
    }
  },
  async getSnapshot(clientId: string, taxYear: number): Promise<LiveWorkflowAuthoritySnapshot> {
    return this.fetchSnapshot(clientId, taxYear);
  },
  clearCache(): void {
    // No client-side authority cache retained
  },
};
