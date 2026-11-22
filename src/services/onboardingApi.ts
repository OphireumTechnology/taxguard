import { apiRequest } from './api';

export interface OnboardingFields {
  legalName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  entityType?: string;
  filingStatus?: string;
  state?: string;
  taxYear?: number;
  [key: string]: any;
}

export interface OnboardingRequirements {
  profile: boolean;
  tin: boolean;
  address: boolean;
  representative: boolean;
  identityDocument: boolean;
  consentAvailable: boolean;
}

export interface OnboardingView {
  status: 'DRAFT' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'APPROVED' | string;
  clientId?: string;
  revision?: number;
  requirements: OnboardingRequirements;
  fields?: OnboardingFields;
  completionPercent?: number;
  missingFields?: string[];
  updatedAt?: string;
  [key: string]: any;
}

export interface OnboardingQueueItem {
  id: string;
  clientId: string;
  clientName?: string;
  status: string;
  submittedAt?: string;
  [key: string]: any;
}

export function onboardingMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Onboarding service is unavailable right now.';
}

export const onboardingApi: any = new Proxy(
  {
    getView: () => apiRequest('/api/stage-one'),
    save: (fields: OnboardingFields) =>
      apiRequest('/api/stage-one', { method: 'PUT', body: JSON.stringify(fields) }),
    submit: (fields?: OnboardingFields) =>
      apiRequest('/api/stage-one/submit', { method: 'POST', body: JSON.stringify(fields || {}) }),
    listQueue: () => apiRequest('/api/stage-one/queue'),
    decide: (id: string, payload: any) =>
      apiRequest(`/api/stage-one/${encodeURIComponent(id)}/decision`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => apiRequest(`/api/stage-one/${prop}`);
    },
  }
);
