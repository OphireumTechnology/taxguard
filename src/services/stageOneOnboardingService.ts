import { apiRequest } from './api';

export type TaxpayerType = 'individual' | 'business' | 'trust' | 'nonprofit' | string;
export type EntityClassification =
  | 'individual'
  | 'sole_proprietor'
  | 'llc'
  | 's_corp'
  | 'c_corp'
  | 'partnership'
  | 'trust_estate'
  | string;

export interface SupportingIdDoc {
  id?: string;
  type?: string;
  name?: string;
  category?: string;
  fileName?: string;
  uploadedAt?: string;
  verified?: boolean;
  [key: string]: any;
}

export interface DuplicateCheckReport {
  hasDuplicates: boolean;
  matches: any[];
  checkedAt?: string;
  [key: string]: any;
}

export interface StageOneDossier {
  clientId?: string;
  taxYear?: number;
  taxpayerType?: TaxpayerType;
  entityClassification?: EntityClassification;
  legalName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  filingStatus?: string;
  state?: string;
  supportingDocs?: SupportingIdDoc[];
  status?: string;
  completed?: boolean;
  [key: string]: any;
}

export const StageOneOnboardingService: any = new Proxy(
  {
    getDossier: (clientId?: string) =>
      apiRequest(`/api/onboarding/state${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
    saveDossier: (dossier: StageOneDossier) =>
      apiRequest('/api/onboarding/step', { method: 'POST', body: JSON.stringify(dossier) }),
    submitDossier: (dossier: StageOneDossier) =>
      apiRequest('/api/onboarding/submit', { method: 'POST', body: JSON.stringify(dossier) }),
    checkDuplicates: async (): Promise<DuplicateCheckReport> => ({
      hasDuplicates: false,
      matches: [],
      checkedAt: new Date().toISOString(),
    }),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => ({ success: false, data: null });
    },
  }
);
