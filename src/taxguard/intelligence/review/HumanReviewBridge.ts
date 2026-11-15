import type { EvidencePackage } from '../types';

export interface HumanReviewSubmission {
  evidencePackage: EvidencePackage;
  title: string;
  description: string;
  itemType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskLevel: string;
  assignedRole: string;
}

export interface HumanReviewItem extends HumanReviewSubmission {
  queueItemId: string;
  status: 'PENDING_REVIEW';
  createdAt: string;
}

export const HumanReviewBridge = {
  submit(input: HumanReviewSubmission): HumanReviewItem {
    return {
      ...input,
      queueItemId: `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString()
    };
  }
};
