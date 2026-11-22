import {
  LiveWorkflowRepository
} from './liveWorkflow.repository';

import {
  TaxGuardLiveWorkflowCase,
  TaxGuardWorkflowStage
} from './liveWorkflow.types';

export interface TrustedGateTransition {
  clientId: string;
  taxYear: number;

  stage: TaxGuardWorkflowStage;

  actorUserId: string;
  actorRole: string;

  expectedRevision: number;

  gatePassed: boolean;

  gateName: string;

  gateEvidence?: Record<string, unknown>;
}

export class LiveWorkflowGateService {

  static async commitPassedGate(
    input: TrustedGateTransition
  ): Promise<TaxGuardLiveWorkflowCase> {

    if (!input.clientId?.trim()) {
      throw new Error(
        'Permanent TaxGuard Client ID required.'
      );
    }

    if (!input.gatePassed) {
      throw new Error(
        `${input.gateName} has not passed.`
      );
    }

    if (![1, 2, 3].includes(input.stage)) {
      throw new Error(
        'Unsupported workflow stage.'
      );
    }

    /*
     * IMPORTANT:
     *
     * This method is server-side only.
     * It is not exposed as a browser-controlled "complete"
     * operation.
     *
     * Stage-specific TaxGuard logic determines gatePassed.
     */

    const updated =
      await LiveWorkflowRepository.completeStage(
        input.clientId.trim(),
        input.taxYear,
        input.stage,
        input.actorUserId,
        input.actorRole,
        input.expectedRevision,
        input.gateEvidence
      );

    return updated;
  }
}
