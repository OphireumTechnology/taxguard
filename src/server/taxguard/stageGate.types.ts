import {
  TaxGuardWorkflowStage
} from './liveWorkflow.types';

export interface StageGateEvidence {
  source: string;

  evaluatedAt: string;

  checks: Record<string, boolean>;

  blockingReasons: string[];

  metadata?: Record<string, unknown>;
}

export interface StageGateDecision {
  stage: TaxGuardWorkflowStage;

  passed: boolean;

  gateName: string;

  evidence: StageGateEvidence;
}

export interface StageTransitionActor {
  userId: string;
  role: string;
}

export interface StageTransitionContext {
  clientId: string;
  taxYear: number;

  expectedRevision: number;

  actor: StageTransitionActor;
}
