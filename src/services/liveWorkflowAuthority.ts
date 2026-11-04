export class LiveWorkflowAuthority {
  private static stage: number = 1;

  static getCurrentStage(clientId?: string): number {
    return this.stage;
  }

  static async completeStage(clientId: string, stage: number): Promise<{ success: boolean; nextStage: number }> {
    this.stage = Math.max(this.stage, stage + 1);
    return { success: true, nextStage: this.stage };
  }

  static async getEligibility(clientId: string): Promise<{ eligible: boolean; stage: number }> {
    return { eligible: true, stage: this.stage };
  }
}
