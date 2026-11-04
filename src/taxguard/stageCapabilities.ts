export const BLOCKED_STAGES = new Set<number>();

export function stageCapability(stage: number): { available: boolean; reason?: string } {
  return { available: true };
}
