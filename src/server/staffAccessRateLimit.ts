/** Bounded local abuse limiter. SQL independently limits distributed administrator issuance. */
export class StaffAccessRateLimit {
  private readonly entries = new Map<string, { started: number; count: number }>();
  constructor(private readonly limit = 20, private readonly windowMs = 60_000, private readonly capacity = 10_000, private readonly now = () => Date.now()) {}
  allow(key: string): boolean {
    const now = this.now();
    let entry = this.entries.get(key);
    if (entry && now - entry.started >= this.windowMs) { this.entries.delete(key); entry = undefined; }
    if (!entry) {
      if (this.entries.size >= this.capacity) {
        for (const [storedKey, stored] of this.entries) if (now - stored.started >= this.windowMs) this.entries.delete(storedKey);
        if (this.entries.size >= this.capacity) return false;
      }
      entry = { started: now, count: 0 }; this.entries.set(key, entry);
    }
    if (entry.count >= this.limit) return false;
    entry.count++; return true;
  }
}
