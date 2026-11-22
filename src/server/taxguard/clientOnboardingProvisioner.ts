export async function provisionOrResolveClientOnboarding(..._args: unknown[]): Promise<any> {
  return {
    status: 'PENDING',
    activeStage: 1,
    stages: [],
  };
}

export function deriveCanonicalStageStates(..._args: unknown[]): any[] {
  return [];
}

export function evaluateLiveWorkflowEligibility(..._args: unknown[]): any {
  return { eligible: false, blockers: ['DURABLE_STORE_NOT_CONFIGURED'] };
}

export async function updateProvisionedCaseStage(..._args: unknown[]): Promise<any> {
  return { updated: false };
}
