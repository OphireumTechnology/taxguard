export const LiveWorkflowApi = {
  getState: async (clientId?: string) => ({ currentStage: 1, isLocked: false }),
  completeStage: async (clientId?: string, stage?: number) => ({ success: true, nextStage: (stage || 1) + 1 }),
  getEligibility: async (clientId?: string) => ({ eligible: true, stage: 1 }),
  getScopedWorkflowBundle: async (taxYear: number = 2025) => ({
    workflow: { activeStage: 1 },
    eligibility: { activeStage: 1 }
  }),
  provisionClientOnboarding: async (taxYear: number = 2025) => ({
    tenantId: 'tenant_default',
    clientId: 'user_client_1',
    engagementId: 'eng_001',
    taxYear,
    caseId: 'case_001',
    activeStage: 1 as 1 | 2 | 3,
    stageStates: {} as Record<string, any>,
    resumed: false,
    workflow: { activeStage: 1, stage1: { status: 'COMPLETED' } },
    eligibility: { activeStage: 1 }
  }),
  completeStageOne: async (taxYear: number = 2025, dossier?: any) => ({
    workflow: { activeStage: 2 },
    eligibility: { activeStage: 2 }
  })
};
