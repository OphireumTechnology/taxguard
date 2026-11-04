export class StageOneOnboardingService {
  static async getOnboardingState(clientId?: string) {
    return { currentStep: 1, isComplete: false, taxYear: 2025 };
  }

  static async submitStageOneStep(step: number, data: any) {
    return { success: true, nextStep: step + 1 };
  }
}
