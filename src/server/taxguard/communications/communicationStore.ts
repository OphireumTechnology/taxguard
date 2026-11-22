export class CommunicationStoreError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
  }
}

export class CommunicationStore {
  constructor(private readonly _client?: unknown) {}
  private fail(): never {
    throw new CommunicationStoreError('COMMUNICATION_STORE_UNAVAILABLE', 503);
  }
  async createThread(..._args: unknown[]): Promise<any> { return this.fail(); }
  async inbox(..._args: unknown[]): Promise<any> { return this.fail(); }
  async markRead(..._args: unknown[]): Promise<any> { return this.fail(); }
  async messages(..._args: unknown[]): Promise<any> { return this.fail(); }
  async post(..._args: unknown[]): Promise<any> { return this.fail(); }
  async setStatus(..._args: unknown[]): Promise<any> { return this.fail(); }
  async threads(..._args: unknown[]): Promise<any> { return this.fail(); }
}
