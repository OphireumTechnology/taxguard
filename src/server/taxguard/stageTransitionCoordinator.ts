import {
  persistPassedStageGate
} from './stageGateBridge';

import {
  TaxGuardLiveWorkflowCase
} from './liveWorkflow.types';

import {
  StageGateDecision,
  StageTransitionContext
} from './stageGate.types';

const ALLOWED_SERVER_GATE_ROLES =
  new Set([
    'client',
    'preparer',
    'reviewer',
    'admin'
  ]);

export class StageTransitionCoordinator {

  static async persistDecision(
    context: StageTransitionContext,
    decision: StageGateDecision
  ): Promise<TaxGuardLiveWorkflowCase> {

    if (!context.clientId?.trim()) {
      throw new Error(
        'Permanent TaxGuard Client ID required.'
      );
    }

    if (
      !ALLOWED_SERVER_GATE_ROLES.has(
        context.actor.role
      )
    ) {
      throw new Error(
        'Actor role is not authorized for workflow transitions.'
      );
    }

    if (!decision.passed) {
      throw new Error(
        `${decision.gateName} did not pass.`
      );
    }

    if (
      decision.evidence.blockingReasons.length > 0
    ) {
      throw new Error(
        'Gate contains unresolved blocking reasons.'
      );
    }

    if (
      !Object.values(
        decision.evidence.checks
      ).every(Boolean)
    ) {
      throw new Error(
        'Gate evidence contains failed checks.'
      );
    }

    return persistPassedStageGate({
      clientId:
        context.clientId.trim(),

      taxYear:
        context.taxYear,

      stage:
        decision.stage,

      actorUserId:
        context.actor.userId,

      actorRole:
        context.actor.role,

      expectedRevision:
        context.expectedRevision,

      gatePassed:
        true,

      gateName:
        decision.gateName,

      evidence: {
        source:
          decision.evidence.source,

        evaluatedAt:
          decision.evidence.evaluatedAt,

        checks:
          decision.evidence.checks,

        metadata:
          decision.evidence.metadata || {}
      }
    });
  }
}
