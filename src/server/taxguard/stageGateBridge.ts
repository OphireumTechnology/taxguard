import {
  LiveWorkflowGateService
} from './liveWorkflowGate.service';

import {
  TaxGuardLiveWorkflowCase,
  TaxGuardWorkflowStage
} from './liveWorkflow.types';

export interface StageGateBridgeInput {
  clientId: string;
  taxYear: number;

  stage: TaxGuardWorkflowStage;

  actorUserId: string;
  actorRole: string;

  expectedRevision: number;

  gatePassed: boolean;
  gateName: string;

  evidence?: Record<string, unknown>;
}

export async function persistPassedStageGate(
  input: StageGateBridgeInput
): Promise<TaxGuardLiveWorkflowCase> {

  if (!input.gatePassed) {
    throw new Error(
      `${input.gateName} did not pass. Workflow transition denied.`
    );
  }

  return LiveWorkflowGateService.commitPassedGate({
    clientId: input.clientId,
    taxYear: input.taxYear,

    stage: input.stage,

    actorUserId: input.actorUserId,
    actorRole: input.actorRole,

    expectedRevision: input.expectedRevision,

    gatePassed: true,
    gateName: input.gateName,

    gateEvidence: input.evidence
  });
}
