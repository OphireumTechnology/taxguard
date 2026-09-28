import {
  StageTransitionCoordinator
} from './stageTransitionCoordinator';
import { TaxGuardAuthorityRepository, type CaseScope } from './authority.repository';
type ScopedGateContext = { scope: CaseScope; actorUid: string; expectedRevision: number; operationId: string; approvalId: string };

import {
  StageTransitionContext
} from './stageGate.types';

import {
  StageOneGateSnapshot,
  evaluateStageOneServerGate
} from './stageOneServerGate';

import {
  StageTwoGateSnapshot,
  evaluateStageTwoServerGate
} from './stageTwoServerGate';

import {
  StageThreeGateSnapshot,
  evaluateStageThreeServerGate
} from './stageThreeServerGate';

export class ServerStageGateOrchestrator {
  static async commitScopedStageOne(repository: TaxGuardAuthorityRepository, context: ScopedGateContext, snapshot: StageOneGateSnapshot) {
    const decision = evaluateStageOneServerGate(snapshot);
    return repository.recordStageGate(context.scope, context.actorUid, context.expectedRevision, context.operationId,
      { ...decision, approvalId: context.approvalId, evaluatorVersion: 'stage-one-v1' });
  }
  static async commitScopedStageTwo(repository: TaxGuardAuthorityRepository, context: ScopedGateContext, snapshot: StageTwoGateSnapshot) {
    const decision = evaluateStageTwoServerGate(snapshot);
    return repository.recordStageGate(context.scope, context.actorUid, context.expectedRevision, context.operationId,
      { ...decision, approvalId: context.approvalId, evaluatorVersion: 'stage-two-v1' });
  }
  static async commitScopedStageThree(repository: TaxGuardAuthorityRepository, context: ScopedGateContext, snapshot: StageThreeGateSnapshot) {
    const decision = evaluateStageThreeServerGate(snapshot);
    return repository.recordStageGate(context.scope, context.actorUid, context.expectedRevision, context.operationId,
      { ...decision, approvalId: context.approvalId, evaluatorVersion: 'stage-three-v1' });
  }

  static async commitStageOne(
    context: StageTransitionContext,
    snapshot: StageOneGateSnapshot
  ) {

    const decision =
      evaluateStageOneServerGate(snapshot);

    return StageTransitionCoordinator
      .persistDecision(
        context,
        decision
      );
  }

  static async commitStageTwo(
    context: StageTransitionContext,
    snapshot: StageTwoGateSnapshot
  ) {

    const decision =
      evaluateStageTwoServerGate(snapshot);

    return StageTransitionCoordinator
      .persistDecision(
        context,
        decision
      );
  }

  static async commitStageThree(
    context: StageTransitionContext,
    snapshot: StageThreeGateSnapshot
  ) {

    const decision =
      evaluateStageThreeServerGate(snapshot);

    return StageTransitionCoordinator
      .persistDecision(
        context,
        decision
      );
  }
}
