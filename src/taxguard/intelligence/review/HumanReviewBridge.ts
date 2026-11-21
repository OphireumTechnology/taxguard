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

export interface HumanReviewRecord extends HumanReviewSubmission {
  queueItemId: string;
  status: 'PENDING_REVIEW';
  createdAt: string;
}

const reviewQueue: HumanReviewRecord[] = [];

export const HumanReviewBridge = {
  submit(submission: HumanReviewSubmission): HumanReviewRecord {
    const record: HumanReviewRecord = {
      ...submission,
      queueItemId: `hrq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
    };
    reviewQueue.push(record);
    return record;
  },
  list(): HumanReviewRecord[] {
    return [...reviewQueue];
  },
};
