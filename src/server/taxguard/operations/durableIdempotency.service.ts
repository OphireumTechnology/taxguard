
export class DurableIdempotencyService {
  private executed = new Map<string, any>();
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.executed.has(key)) return this.executed.get(key);
    const result = await fn();
    this.executed.set(key, result);
    return result;
  }
}
export const globalDurableIdempotencyService = new DurableIdempotencyService();
