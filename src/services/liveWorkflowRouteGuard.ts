import type { LiveWorkflowAuthoritySnapshot } from './liveWorkflowAuthority';

export interface LiveWorkflowRouteDecision {
  allowed: boolean;
  targetStage: number;
  redirectStage?: number;
  reason?: string;
  [key: string]: any;
}

export function guardLiveWorkflowStage(
  snapshot: Partial<LiveWorkflowAuthoritySnapshot> | null | undefined,
  requestedStage: number
): LiveWorkflowRouteDecision {
  const current = snapshot?.workflow?.currentStage || snapshot?.currentStage || 1;
  const completed = snapshot?.completedStages || snapshot?.workflow?.completedStages || [];
  if (requestedStage <= current || completed.includes(requestedStage)) {
    return { allowed: true, targetStage: requestedStage };
  }
  return {
    allowed: false,
    targetStage: current,
    redirectStage: current,
    reason: `Complete Stage ${current} before opening Stage ${requestedStage}.`,
  };
}
