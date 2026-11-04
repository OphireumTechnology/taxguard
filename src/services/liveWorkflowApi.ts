export const LiveWorkflowApi = {
  getState: async (clientId: string) => ({ currentStage: 1, isLocked: false }),
  completeStage: async (clientId: string, stage: number) => ({ success: true, nextStage: stage + 1 }),
  getEligibility: async (clientId: string) => ({ eligible: true, stage: 1 })
};
