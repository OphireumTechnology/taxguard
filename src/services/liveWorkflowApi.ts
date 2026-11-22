import { api } from './api';

export const LiveWorkflowApi = {
  async getState(taxYear?: number, signal?: AbortSignal): Promise<any> {
    return api.request('/api/live-workflow/state', { query: { taxYear }, signal });
  },
  async getEligibility(taxYear?: number, signal?: AbortSignal): Promise<any> {
    return api.request('/api/live-workflow/eligibility', { query: { taxYear }, signal });
  },
  async getScopedWorkflowBundle(...args: any[]): Promise<any> {
    const taxYear = typeof args[0] === 'number' ? args[0] : undefined;
    return api.request('/api/live-workflow/state', { query: { taxYear } });
  },
  async provisionClientOnboarding(...args: any[]): Promise<any> {
    const payload = args.length === 1 && typeof args[0] === 'object' ? args[0] : { args };
    return api.request('/api/live-workflow/provision', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },
  async completeStageOne(...args: any[]): Promise<any> {
    const payload = args.length === 1 && typeof args[0] === 'object' ? args[0] : { args };
    return api.request('/api/live-workflow/stages/1/complete', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },
  async completeStage(stage: number, taxYear?: number, payload?: Record<string, any>): Promise<any> {
    return api.request(`/api/live-workflow/stages/${stage}/complete`, {
      method: 'POST',
      body: JSON.stringify({ taxYear, ...(payload || {}) }),
    });
  },
};
