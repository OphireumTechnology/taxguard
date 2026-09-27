import {
  StageTransitionCoordinator
} from './stageTransitionCoordinator';

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
