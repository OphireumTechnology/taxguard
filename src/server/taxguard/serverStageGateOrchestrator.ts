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

import {
  StageTenGateSnapshot,
  evaluateStageTenServerGate
} from './stageTenServerGate';

import {
  StageElevenGateSnapshot,
  evaluateStageElevenServerGate
} from './stageElevenServerGate';

import {
  StageTwelveGateSnapshot,
  evaluateStageTwelveServerGate
} from './stageTwelveServerGate';

import {
  StageThirteenGateSnapshot,
  evaluateStageThirteenServerGate
} from './stageThirteenServerGate';

import {
  StageFourteenGateSnapshot,
  evaluateStageFourteenServerGate
} from './stageFourteenServerGate';

import {
  StageFifteenGateSnapshot,
  evaluateStageFifteenServerGate
} from './stageFifteenServerGate';

import {
  StageSixteenGateSnapshot,
  evaluateStageSixteenServerGate
} from './stageSixteenServerGate';

import {
  StageSeventeenGateSnapshot,
  evaluateStageSeventeenServerGate
} from './stageSeventeenServerGate';

import {
  StageEighteenGateSnapshot,
  evaluateStageEighteenServerGate
} from './stageEighteenServerGate';

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

  static isStageElevenUnlocked(stageTenState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageTenState);
  }

  static isStageTwelveUnlocked(stageElevenState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageElevenState);
  }

  static isStageThirteenUnlocked(stageTwelveState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageTwelveState);
  }

  static isStageFourteenUnlocked(stageThirteenState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageThirteenState);
  }

  static isStageFifteenUnlocked(stageFourteenState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageFourteenState);
  }

  static isStageSixteenUnlocked(stageFifteenState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageFifteenState);
  }

  static isStageSeventeenUnlocked(stageSixteenState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageSixteenState);
  }

  static isStageEighteenUnlocked(stageSeventeenState?: { requirementsMet?: boolean; status?: string }): boolean {
    return this.isStageUnlocked(stageSeventeenState);
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

  static async commitStageTen(context: StageTransitionContext, snapshot: StageTenGateSnapshot) {
    const decision = evaluateStageTenServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageEleven(context: StageTransitionContext, snapshot: StageElevenGateSnapshot) {
    const decision = evaluateStageElevenServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageTwelve(context: StageTransitionContext, snapshot: StageTwelveGateSnapshot) {
    const decision = evaluateStageTwelveServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageThirteen(context: StageTransitionContext, snapshot: StageThirteenGateSnapshot) {
    const decision = evaluateStageThirteenServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageFourteen(context: StageTransitionContext, snapshot: StageFourteenGateSnapshot) {
    const decision = evaluateStageFourteenServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageFifteen(context: StageTransitionContext, snapshot: StageFifteenGateSnapshot) {
    const decision = evaluateStageFifteenServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageSixteen(context: StageTransitionContext, snapshot: StageSixteenGateSnapshot) {
    const decision = evaluateStageSixteenServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageSeventeen(context: StageTransitionContext, snapshot: StageSeventeenGateSnapshot) {
    const decision = evaluateStageSeventeenServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }

  static async commitStageEighteen(context: StageTransitionContext, snapshot: StageEighteenGateSnapshot) {
    const decision = evaluateStageEighteenServerGate(snapshot);
    return StageTransitionCoordinator.persistDecision(context, decision);
  }
}
