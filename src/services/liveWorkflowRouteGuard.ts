export function guardLiveWorkflowStage(requestedStage: number, authoritativeStage: number): boolean {
  return requestedStage <= authoritativeStage;
}
