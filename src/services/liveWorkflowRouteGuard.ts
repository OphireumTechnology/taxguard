import type { LiveWorkflowAuthoritySnapshot } from './liveWorkflowAuthority';

export function guardLiveWorkflowStage(
  arg1: number | LiveWorkflowAuthoritySnapshot | any,
  arg2?: number | LiveWorkflowAuthoritySnapshot | any
): { allowed: boolean; targetStage: number; activeStage?: number; reason?: string } {
  const snapshot = typeof arg1 === 'object' ? arg1 : arg2;
  const requestedStage = typeof arg1 === 'number' ? arg1 : typeof arg2 === 'number' ? arg2 : 1;
  const activeStage = Number(snapshot?.workflow?.activeStage ?? snapshot?.activeStage ?? 1);
  if (requestedStage <= activeStage) {
    return { allowed: true, targetStage: requestedStage, activeStage };
  }
  return {
    allowed: false,
    targetStage: activeStage,
    activeStage,
    reason: `Stage ${requestedStage} is locked until Stage ${activeStage} is completed.`,
  };
}
