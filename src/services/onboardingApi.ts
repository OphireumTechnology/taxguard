export function onboardingMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Onboarding service error.';
}

export interface OnboardingFields {
  taxpayerType?: string;
  legalName?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  repName?: string;
  repTitle?: string;
  tinType?: string;
  tinLast4?: string;
}

export interface OnboardingQueueItem {
  clientId: string;
  name?: string;
  legalName?: string;
  submittedAt: string;
  status: string;
  identityDocument?: boolean;
  possibleDuplicates?: number;
}

export interface OnboardingView {
  clientId: string;
  name?: string;
  legalName?: string;
  taxpayerType?: string;
  tinType?: string;
  tinMasked?: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  representative?: {
    fullName?: string;
    title?: string;
  } | null;
  status: 'DRAFT' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'APPROVED';
  revision: number;
  clientReason?: string;
  requirements: {
    profile: boolean;
    tin: boolean;
    address: boolean;
    representative: boolean;
    identityDocument: boolean;
    consentAvailable: boolean;
  };
  consent?: { version: number; text: string } | null;
  consentVersion?: number;
  consentSigner?: string;
  consentAt?: string;
  possibleDuplicates?: string[];
  step?: number;
  completed?: boolean;
  dossier?: any;
  identityVerification?: any;
  duplicates?: any;
}

const defaultView = (clientId = 'user_client_1'): OnboardingView => ({
  clientId,
  legalName: 'Michael Perotti',
  taxpayerType: 'individual',
  tinType: 'SSN',
  tinMasked: '***-**-4912',
  address: { street: '1200 Main Street', city: 'Columbia', state: 'SC', postalCode: '29201' },
  representative: null,
  status: 'APPROVED',
  revision: 1,
  requirements: {
    profile: true,
    tin: true,
    address: true,
    representative: true,
    identityDocument: true,
    consentAvailable: true
  },
  consent: {
    version: 1,
    text: 'IRC § 7216 Consent to Use and Disclose Tax Return Information.'
  },
  possibleDuplicates: [],
  step: 1,
  completed: true,
  dossier: {}
});

export const onboardingApi = {
  getStageOneDossier: async (clientId?: string): Promise<OnboardingView> => defaultView(clientId),
  queue: async (): Promise<{ items: OnboardingQueueItem[] }> => ({ items: [] }),
  get: async (clientId: string): Promise<OnboardingView> => defaultView(clientId),
  client: async (clientId: string): Promise<OnboardingView> => defaultView(clientId),
  mine: async (): Promise<OnboardingView> => defaultView(),
  save: async (_revision: number, _fields: OnboardingFields): Promise<OnboardingView> => defaultView(),
  submit: async (_revision: number, _consentVersion: number, _signer: string): Promise<OnboardingView> => ({
    ...defaultView(),
    status: 'SUBMITTED'
  }),
  decide: async (
    clientId: string,
    _revision: number,
    decision: 'approve' | 'request_changes',
    _payload?: { internalNote?: string; duplicateOverride?: boolean; clientReason?: string }
  ): Promise<OnboardingView> => ({
    ...defaultView(clientId),
    status: decision === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED'
  }),
  approve: async (_clientId: string, _payload?: any) => ({ success: true }),
  reject: async (_clientId: string, _payload?: any) => ({ success: true }),
  approveOnboarding: async (_clientId: string) => ({ success: true })
};
