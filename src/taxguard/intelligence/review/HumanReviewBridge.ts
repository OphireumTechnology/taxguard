export class HumanReviewBridge {
  async submitForReview(data: any): Promise<{ id: string; status: string }> {
    return { id: 'rev_' + Date.now(), status: 'queued' };
  }
}
