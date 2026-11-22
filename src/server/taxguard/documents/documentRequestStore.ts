export class DocumentRequestStore {
  constructor(private readonly _client?: unknown) {}
  private fail(): never {
    throw new Error('DOCUMENT_REQUEST_STORE_UNAVAILABLE');
  }
  async applyTemplate(..._args: unknown[]): Promise<any> { return this.fail(); }
  async create(..._args: unknown[]): Promise<any> { return this.fail(); }
  async link(..._args: unknown[]): Promise<any> { return this.fail(); }
  async list(..._args: unknown[]): Promise<any> { return this.fail(); }
  async markRead(..._args: unknown[]): Promise<any> { return this.fail(); }
  async missing(..._args: unknown[]): Promise<any> { return this.fail(); }
  async notifications(..._args: unknown[]): Promise<any> { return this.fail(); }
  async preferences(..._args: unknown[]): Promise<any> { return this.fail(); }
  async remind(..._args: unknown[]): Promise<any> { return this.fail(); }
  async resolve(..._args: unknown[]): Promise<any> { return this.fail(); }
  async reviewQueue(..._args: unknown[]): Promise<any> { return this.fail(); }
  async saveTemplate(..._args: unknown[]): Promise<any> { return this.fail(); }
  async setPreference(..._args: unknown[]): Promise<any> { return this.fail(); }
  async templates(..._args: unknown[]): Promise<any> { return this.fail(); }
}
