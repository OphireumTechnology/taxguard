import type { HumanReviewItem } from '../types';

export class HumanReviewBridge {
  static submit(input: Record<string, any>): HumanReviewItem {
    return {
      queueItemId: `hr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
      ...input,
    };
  }

  submit(input: Record<string, any>): HumanReviewItem {
    return HumanReviewBridge.submit(input);
  }
}
