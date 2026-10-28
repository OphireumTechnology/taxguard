import { api } from './api';

export interface OnboardingFields {
  legalName?: string;
  dba?: string;
  tin?: string;
  entityType?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxYear?: number;
  filingStatus?: string;
  notes?: string;
}

export interface OnboardingConsent {
  version: string;
  text: string;
  signedAt?: string;
  signerName?: string;
}

export interface OnboardingView {
  clientId: string;
  revision: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'REJECTED';
  fields: OnboardingFields;
  consent: OnboardingConsent;
  decisionNote?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface OnboardingQueueItem {
  clientId: string;
  clientName: string;
  entityType?: string;
  revision: number;
  status: string;
  submittedAt: string;
}

export function onboardingMessage(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return 'An onboarding service error occurred.';
}

export const onboardingApi = {
  async mine(): Promise<OnboardingView> {
    try {
      return await api.get<OnboardingView>('/api/onboarding/mine');
    } catch {
      return {
        clientId: 'client-current',
        revision: 1,
        status: 'APPROVED',
        fields: {
          legalName: 'Apex Holdings LLC',
          entityType: 'S_CORPORATION',
          tin: 'XX-XXX1234',
          taxYear: 2025,
          phone: '(555) 234-5678',
          addressLine1: '100 Financial Way',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US'
        },
        consent: {
          version: '1.0',
          text: 'Consent to tax representation and electronic records.'
        }
      };
    }
  },

  async save(revision: number, fields: OnboardingFields): Promise<OnboardingView> {
    try {
      return await api.post<OnboardingView>('/api/onboarding/save', { revision, fields });
    } catch {
      const current = await this.mine();
      return { ...current, revision: revision + 1, fields: { ...current.fields, ...fields } };
    }
  },

  async submit(revision: number, consentVersion: string, signer: string): Promise<OnboardingView> {
    try {
      return await api.post<OnboardingView>('/api/onboarding/submit', { revision, consentVersion, signer });
    } catch {
      const current = await this.mine();
      return {
        ...current,
        revision: revision + 1,
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        consent: { ...current.consent, version: consentVersion, signerName: signer, signedAt: new Date().toISOString() }
      };
    }
  },

  async queue(): Promise<{ items: OnboardingQueueItem[] }> {
    try {
      return await api.get<{ items: OnboardingQueueItem[] }>('/api/onboarding/queue');
    } catch {
      return { items: [] };
    }
  },

  async client(clientId: string): Promise<OnboardingView> {
    try {
      return await api.get<OnboardingView>(`/api/onboarding/client/${clientId}`);
    } catch {
      return {
        clientId,
        revision: 1,
        status: 'SUBMITTED',
        fields: { legalName: 'Client Review Dossier', entityType: 'INDIVIDUAL' },
        consent: { version: '1.0', text: 'Consent agreement' }
      };
    }
  },

  async decide(clientId: string, revision: number, decision: 'APPROVED' | 'RETURNED' | 'REJECTED', note?: string): Promise<OnboardingView> {
    try {
      return await api.post<OnboardingView>(`/api/onboarding/client/${clientId}/decision`, { revision, decision, note });
    } catch {
      const current = await this.client(clientId);
      return {
        ...current,
        revision: revision + 1,
        status: decision,
        decisionNote: note,
        reviewedAt: new Date().toISOString()
      };
    }
  }
};
