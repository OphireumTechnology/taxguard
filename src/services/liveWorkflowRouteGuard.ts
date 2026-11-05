export function guardLiveWorkflowStage(first: any, second?: any): any {
  if (typeof first === 'object' && first !== null) {
    const stage = typeof second === 'number' ? second : 1;
    const authStage = first.workflow?.activeStage || first.activeStage || 1;
    const allowed = stage <= authStage;
    return {
      allowed,
      reason: allowed ? '' : `Stage ${stage} is locked until prior stages are completed.`
    };
  }
  const requested = typeof first === 'number' ? first : 1;
  const authoritative = typeof second === 'number' ? second : 1;
  return requested <= authoritative;
}
