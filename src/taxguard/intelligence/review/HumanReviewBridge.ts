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

export class HumanReviewBridge {
  static submit(input: HumanReviewSubmission): { queueItemId: string; status: string; createdAt: string } {
    return {
      queueItemId: `hrq_${Date.now().toString(36)}`,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
    };
  }
}
