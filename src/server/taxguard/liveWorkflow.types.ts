export type TaxGuardWorkflowStage = 1 | 2 | 3;

export type TaxGuardWorkflowStageStatus =
  | 'LOCKED'
  | 'IN_PROGRESS'
  | 'READY_FOR_REVIEW'
  | 'COMPLETED';

export interface TaxGuardStageState {
  stage: TaxGuardWorkflowStage;
  status: TaxGuardWorkflowStageStatus;
  completedAt?: string;
  completedBy?: string;
}

export interface TaxGuardLiveWorkflowCase {
  clientId: string;
  taxYear: number;

  environment: 'live';

  revision: number;

  activeStage: TaxGuardWorkflowStage;

  stage1: TaxGuardStageState;
  stage2: TaxGuardStageState;
  stage3: TaxGuardStageState;

  externalSubmissionEnabled: false;

  createdAt: string;
  updatedAt: string;
}

export interface TaxGuardWorkflowAuditEvent {
  eventId: string;

  clientId: string;
  taxYear: number;

  actorUserId: string;
  actorRole: string;

  action: string;
  stage?: TaxGuardWorkflowStage;

  result: 'success' | 'error';

  serverTimestamp: string;

  metadata?: Record<string, unknown>;
}
