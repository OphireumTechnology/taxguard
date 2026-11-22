class DurableIdempotencyService {
  private records = new Map<string, { value: any; createdAt: string }>();

  get(key: string): any | null {
    return this.records.get(key)?.value ?? null;
  }

  has(key: string): boolean {
    return this.records.has(key);
  }

  set(key: string, value: any): void {
    this.records.set(key, { value, createdAt: new Date().toISOString() });
  }

  check(key: string): { exists: boolean; value: any | null } {
    const entry = this.records.get(key);
    return { exists: Boolean(entry), value: entry?.value ?? null };
  }

  record(key: string, value: any): void {
    this.set(key, value);
  }

  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.records.get(key);
    if (existing) return existing.value as T;
    const result = await fn();
    this.set(key, result);
    return result;
  }
}

export const globalDurableIdempotencyService = new DurableIdempotencyService();
