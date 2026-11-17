/**
 * Throttles repeated FAILED provider-token verifications per client address. Each verification is an
 * outbound identity-provider call, so unbounded invalid tokens amplify load onto the provider and
 * the database. Successful verifications never count, so ordinary sign-in bursts are unaffected.
 * In-process only: a multi-instance deployment also needs an edge or shared limiter.
 */
export class AuthFailureLimiter {
  private readonly entries = new Map<string, { started: number; failures: number }>();
  constructor(private readonly limit = 20, private readonly windowMs = 60_000, private readonly capacity = 10_000, private readonly now = () => Date.now()) {}

  private current(key: string) {
    const entry = this.entries.get(key);
    if (entry && this.now() - entry.started >= this.windowMs) { this.entries.delete(key); return undefined; }
    return entry;
  }
  /** Seconds until the address may try again, or 0 when it is not blocked. */
  blockedFor(key: string): number {
    const entry = this.current(key);
    if (!entry || entry.failures < this.limit) return 0;
    return Math.max(1, Math.ceil((entry.started + this.windowMs - this.now()) / 1000));
  }
  recordFailure(key: string): void {
    let entry = this.current(key);
    if (!entry) {
      if (this.entries.size >= this.capacity) {
        for (const [stored, value] of this.entries) if (this.now() - value.started >= this.windowMs) this.entries.delete(stored);
        // A full table of live entries: drop the oldest rather than growing without bound.
        if (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value as string);
      }
      entry = { started: this.now(), failures: 0 };
      this.entries.set(key, entry);
    }
    entry.failures++;
  }
  reset(): void { this.entries.clear(); }
}

export const sessionVerificationFailures = new AuthFailureLimiter();
export const MAX_PROVIDER_ACCESS_TOKEN_LENGTH = 16_384;
