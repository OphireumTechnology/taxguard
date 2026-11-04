export function onboardingMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Onboarding service error.';
}

export interface OnboardingQueueItem {
  clientId: string;
  name: string;
  submittedAt: string;
  status: string;
}

export interface OnboardingView {
  clientId?: string;
  name?: string;
  status?: string;
  step: number;
  completed: boolean;
  dossier: any;
  identityVerification?: any;
  duplicates?: any;
  consent?: any;
}

export const onboardingApi = {
  getStageOneDossier: async (clientId?: string): Promise<OnboardingView> => ({
    step: 1,
    completed: true,
    dossier: {}
  }),
  queue: async (): Promise<{ items: OnboardingQueueItem[] }> => ({
    items: []
  }),
  get: async (clientId: string): Promise<OnboardingView> => ({
    clientId,
    name: 'Michael Perotti',
    status: 'PENDING_REVIEW',
    step: 1,
    completed: true,
    dossier: {}
  }),
  approve: async (clientId: string, payload?: any) => ({ success: true }),
  reject: async (clientId: string, payload?: any) => ({ success: true }),
  approveOnboarding: async (clientId: string) => ({ success: true })
};
