import type { TaxGuardLiveWorkflowCase, TaxGuardWorkflowStage } from './liveWorkflow.types';

export interface StageGateEvaluation {
  eligible: boolean;
  stage: TaxGuardWorkflowStage;
  reasons: string[];
}

export class LiveWorkflowGateService {
  static evaluateStage(workflow: TaxGuardLiveWorkflowCase, stage: TaxGuardWorkflowStage): StageGateEvaluation {
    if (stage === 1) {
      return { eligible: true, stage, reasons: [] };
    }
    if (stage === 2) {
      const ok = workflow.stage1?.status === 'COMPLETED';
      return {
        eligible: ok,
        stage,
        reasons: ok ? [] : ['Stage 1 must be completed before entering Stage 2.'],
      };
    }
    if (stage === 3) {
      const ok = workflow.stage1?.status === 'COMPLETED' && workflow.stage2?.status === 'COMPLETED';
      return {
        eligible: ok,
        stage,
        reasons: ok ? [] : ['Stages 1 and 2 must be completed before entering Stage 3.'],
      };
    }
    return {
      eligible: false,
      stage,
      reasons: ['Stage gate requires authoritative repository verification.'],
    };
  }

  static getEligibility(workflow: TaxGuardLiveWorkflowCase) {
    return {
      stage1: true,
      stage2: workflow.stage1?.status === 'COMPLETED',
      stage3: workflow.stage1?.status === 'COMPLETED' && workflow.stage2?.status === 'COMPLETED',
    };
  }
}
