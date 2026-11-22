import { apiRequest } from './api';

export const LiveWorkflowApi: any = {
  getState: (clientId?: string, taxYear?: number) => {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));
    const q = params.toString();
    return apiRequest(`/api/live-workflow/state${q ? `?${q}` : ''}`);
  },
  completeStage: (payload: any) =>
    apiRequest('/api/live-workflow/complete-stage', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getEligibility: (clientId?: string, taxYear?: number) => {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));
    const q = params.toString();
    return apiRequest(`/api/live-workflow/eligibility${q ? `?${q}` : ''}`);
  },
};
