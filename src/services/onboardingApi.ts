import { api } from './api';

export interface OnboardingFields {
  legalFirstName?: string;
  legalLastName?: string;
  legalName?: string;
  entityType?: string;
  taxYear?: number;
  phone?: string;
  address?: string;
  filingStatus?: string;
  [key: string]: any;
}

export interface OnboardingView {
  clientId?: string;
  status: string;
  fields: OnboardingFields;
  requirements: {
    profile: boolean;
    tin: boolean;
    address: boolean;
    representative: boolean;
    identityDocument: boolean;
    consentAvailable: boolean;
  };
  clientReason?: string | null;
  submittedAt?: string;
  reviewedAt?: string;
  reviewerNotes?: string;
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

export function onboardingMessage(err: unknown, fallback = 'Unable to load onboarding data.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const onboardingApi: any = {
  get: (clientId?: string, signal?: AbortSignal) =>
    api.request('/api/stage-one', { query: { clientId }, signal }),
  save: (payload: Record<string, any>) =>
    api.request('/api/stage-one', { method: 'POST', body: JSON.stringify(payload) }),
  submit: (payload: Record<string, any>) =>
    api.request('/api/stage-one/submit', { method: 'POST', body: JSON.stringify(payload) }),
  queue: (signal?: AbortSignal) => api.request('/api/stage-one/queue', { signal }),
  review: (id: string, payload: Record<string, any>) =>
    api.request(`/api/stage-one/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
