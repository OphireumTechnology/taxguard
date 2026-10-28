export interface LiveWorkflowGuardAuthority {
  status: string;
  taxYear?: number;
  workflow?: any;
  eligibility?: any;
  error?: string | null;
}

export interface RouteDecision {
  allowed: boolean;
  reason?: string;
}

export function guardLiveWorkflowStage(
  authority: LiveWorkflowGuardAuthority,
  stage: number
): RouteDecision {
  if (authority.status === 'error') {
    return { allowed: false, reason: authority.error || 'Authoritative stage verification failed.' };
  }
  return { allowed: true };
}
