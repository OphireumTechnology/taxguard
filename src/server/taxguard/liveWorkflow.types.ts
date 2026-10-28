export type TaxGuardWorkflowStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export interface StageStatusRecord {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  updatedAt?: string;
  metadata?: Record<string, any>;
}

export interface TaxGuardLiveWorkflowCase {
  caseId: string;
  clientId: string;
  taxYear: number;
  stage1: StageStatusRecord;
  stage2: StageStatusRecord;
  stage3: StageStatusRecord;
  [key: string]: any;
}
