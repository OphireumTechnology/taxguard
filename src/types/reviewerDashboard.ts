import type { DraftReturnEntity } from '../server/taxguard/persistence.types';
export interface ReviewScope { tenantId: string; clientId: string; engagementId: string; taxYear: number }
export interface ReviewerQueueCase {
  id: string; scope: ReviewScope; clientName: string; preparerId: string; preparerName: string;
  activeStage: number; caseStatus: string; reviewStatus: string; priority?: string; dueDate?: string;
  highRisk: boolean; openExceptions: number; reviewerUid: string; decisionAllowed: boolean;
}
export interface ReviewerArtifact { id: string; [key: string]: any }
export type ReviewerReturn = Omit<DraftReturnEntity, 'status'> & { status: string };
export interface ReviewerSnapshot {
  scope: ReviewScope;
  case: { activeStage: number; revision: number; version?: number; preparerUid: string; reviewerUid: string; openExceptions: number; status?: string };
  independentReviewer: boolean;
  decisionsAvailable: boolean;
  documents: ReviewerArtifact[]; returns: ReviewerReturn[]; workpapers: ReviewerArtifact[];
  records: ReviewerArtifact[]; reconciliations: ReviewerArtifact[]; exceptions: ReviewerArtifact[];
  resolutions: ReviewerArtifact[]; aiFindings: ReviewerArtifact[]; history: ReviewerArtifact[];
  stages: ReviewerArtifact[]; extractedFields: ReviewerArtifact[]; provenance: ReviewerArtifact[];
}
export interface ReviewerDecision {
  version: number; operationId: string; returnId: string; decision: 'APPROVE' | 'RETURN';
  confirmed: boolean; reason: string; corrections?: string;
}
