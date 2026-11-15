import type { EvidencePackage } from '../types';

export interface HumanReviewSubmission {
  evidencePackage: EvidencePackage;
  title: string;
  description: string;
  itemType: string;
  severity: string;
  riskLevel: string;
  assignedRole: string;
}

export interface HumanReviewQueueResult {
  queueItemId: string;
  status: string;
  submittedAt: string;
}

export class HumanReviewBridge {
  static submit(_input: HumanReviewSubmission): HumanReviewQueueResult {
    return {
      queueItemId: 'hrq_' + Date.now(),
      status: 'PENDING_REVIEW',
      submittedAt: new Date().toISOString(),
    };
  }
}
