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

export interface HumanReviewRecord extends HumanReviewSubmission {
  reviewId: string;
  queueItemId: string;
  status: 'PENDING_REVIEW';
  createdAt: string;
}

export const HumanReviewBridge = {
  submit(input: HumanReviewSubmission): HumanReviewRecord {
    const id = `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      ...input,
      reviewId: id,
      queueItemId: id,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
    };
  },
};
