export interface ReviewSubmission {
  evidencePackage: any;
  title: string;
  description: string;
  itemType: string;
  severity: string;
  riskLevel: string;
  assignedRole: string;
}

export class HumanReviewBridge {
  static submit(submission: ReviewSubmission) {
    return {
      queueItemId: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...submission,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
    };
  }
}
