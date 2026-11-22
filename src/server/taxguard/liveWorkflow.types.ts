export type TaxGuardWorkflowStage =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export type TaxGuardStageStatus = 'LOCKED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export interface TaxGuardStageRecord {
  status: TaxGuardStageStatus;
  completedAt?: string | null;
  completedBy?: string | null;
  evidenceHash?: string | null;
  [key: string]: any;
}

export interface TaxGuardLiveWorkflowCase {
  id?: string;
  clientId: string;
  taxYear: number;
  environment?: string;
  revision: number;
  activeStage: TaxGuardWorkflowStage;
  stage1: TaxGuardStageRecord;
  stage2: TaxGuardStageRecord;
  stage3: TaxGuardStageRecord;
  externalSubmissionEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface TaxGuardWorkflowAuditEvent {
  id?: string;
  eventId?: string;
  caseId?: string;
  clientId: string;
  taxYear: number;
  stage?: TaxGuardWorkflowStage;
  action: string;
  result?: string;
  actorUserId: string;
  actorRole: string;
  timestamp?: string;
  serverTimestamp?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}
