
export class HumanReviewBridge {
  static createReviewQueueItem(proposal: any): any {
    return {
      id: "rev-" + Date.now(),
      proposal,
      status: "PENDING_HUMAN_REVIEW"
    };
  }
}
