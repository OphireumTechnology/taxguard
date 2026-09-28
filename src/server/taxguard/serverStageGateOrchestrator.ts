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

import {
  StageFourGateSnapshot,
  evaluateStageFourServerGate
} from './stageFourServerGate';

import {
  StageFiveGateSnapshot,
  evaluateStageFiveServerGate
} from './stageFiveServerGate';

import {
  StageSixGateSnapshot,
  evaluateStageSixServerGate
} from './stageSixServerGate';

import {
  StageSevenGateSnapshot,
  evaluateStageSevenServerGate
} from './stageSevenServerGate';

import {
  StageEightGateSnapshot,
  evaluateStageEightServerGate
} from './stageEightServerGate';

import {
  StageNineGateSnapshot,
  evaluateStageNineServerGate
} from './stageNineServerGate';

export class ServerStageGateOrchestrator {
  static isStageUnlocked(priorStageState?: { requirementsMet?: boolean; status?: string }): boolean {
    return priorStageState?.requirementsMet === true && priorStageState?.status === 'COMPLETE';
  }

  static isStageFourUnlocked(stageThreeState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageThreeState);
  }

  static isStageFiveUnlocked(stageFourState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageFourState);
  }

  static isStageSixUnlocked(stageFiveState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageFiveState);
  }

  static isStageSevenUnlocked(stageSixState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageSixState);
  }

  static isStageEightUnlocked(stageSevenState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageSevenState);
  }

  static isStageNineUnlocked(stageEightState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageEightState);
  }

  static isStageTenUnlocked(stageNineState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageNineState);
  }

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

  static async commitScopedStageFour(repository: TaxGuardAuthorityRepository, context: ScopedGateContext, snapshot: StageFourGateSnapshot) {
    const decision = evaluateStageFourServerGate(snapshot);
    return repository.recordStageGate(context.scope, context.actorUid, context.expectedRevision, context.operationId,
      { ...decision, approvalId: context.approvalId, evaluatorVersion: 'stage-four-v1' });
  }

  static async commitScopedStageFive(repository: TaxGuardAuthorityRepository, context: ScopedGateContext, snapshot: StageFiveGateSnapshot) {
    const decision = evaluateStageFiveServerGate(snapshot);
    return repository.recordStageGate(context.scope, context.actorUid, context.expectedRevision, context.operationId,
      { ...decision, approvalId: context.approvalId, evaluatorVersion: 'stage-five-v1' });
  }

  static async commitScopedStageSix(repository: TaxGuardAuthorityRepository, context: ScopedGateContext, snapshot: StageSixGateSnapshot) {
    const decision = evaluateStageSixServerGate(snapshot);
    return repository.recordStageGate(context.scope, context.actorUid, context.expectedRevision, context.operationId,
      { ...decision, approvalId: context.approvalId, evaluatorVersion: 'stage-six-v1' });
  }

  static async commitScopedStageSeven(repository: TaxGuardAuthorityRepository, context: ScopedGateContext, snapshot: StageSevenGateSnapshot) {
    const decision = evaluateStageSevenServerGate(snapshot);
    return repository.recordStageGate(context.scope, context.actorUid, context.expectedRevision, context.operationId,
      { ...decision, approvalId: context.approvalId, evaluatorVersion: 'stage-seven-v1' });
  }

  static async commitScopedStageEight(repository: TaxGuardAuthorityRepository, context: ScopedGateContext, snapshot: StageEightGateSnapshot) {
    const decision = evaluateStageEightServerGate(snapshot);
    return repository.recordStageGate(context.scope, context.actorUid, context.expectedRevision, context.operationId,
      { ...decision, approvalId: context.approvalId, evaluatorVersion: 'stage-eight-v1' });
  }

  static async commitScopedStageNine(repository: TaxGuardAuthorityRepository, context: ScopedGateContext, snapshot: StageNineGateSnapshot) {
    const decision = evaluateStageNineServerGate(snapshot);
    return repository.recordStageGate(context.scope, context.actorUid, context.expectedRevision, context.operationId,
      { ...decision, approvalId: context.approvalId, evaluatorVersion: 'stage-nine-v1' });
  }

  static async commitStageOne(context: StageTransitionContext, snapshot: StageOneGateSnapshot) {
    const decision = evaluateStageOneServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageTwo(context: StageTransitionContext, snapshot: StageTwoGateSnapshot) {
    const decision = evaluateStageTwoServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageThree(context: StageTransitionContext, snapshot: StageThreeGateSnapshot) {
    const decision = evaluateStageThreeServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageFour(context: StageTransitionContext, snapshot: StageFourGateSnapshot) {
    const decision = evaluateStageFourServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageFive(context: StageTransitionContext, snapshot: StageFiveGateSnapshot) {
    const decision = evaluateStageFiveServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageSix(context: StageTransitionContext, snapshot: StageSixGateSnapshot) {
    const decision = evaluateStageSixServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageSeven(context: StageTransitionContext, snapshot: StageSevenGateSnapshot) {
    const decision = evaluateStageSevenServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageEight(context: StageTransitionContext, snapshot: StageEightGateSnapshot) {
    const decision = evaluateStageEightServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageNine(context: StageTransitionContext, snapshot: StageNineGateSnapshot) {
    const decision = evaluateStageNineServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }
}
