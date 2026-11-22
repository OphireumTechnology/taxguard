export class StaffAccessRateLimit {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxRequests = 120,
    private readonly windowMs = 60_000
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const existing = this.hits.get(key);
    if (!existing || now > existing.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    existing.count += 1;
    return existing.count <= this.maxRequests;
  }
}
