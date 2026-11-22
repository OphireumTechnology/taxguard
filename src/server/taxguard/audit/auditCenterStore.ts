export class AuditCenterError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
  }
}

export class AuditCenterStore {
  constructor(private readonly _client?: unknown) {}
  private fail(): never {
    throw new AuditCenterError('AUDIT_CENTER_STORE_UNAVAILABLE', 503);
  }
  async categories(..._args: unknown[]): Promise<any> { return this.fail(); }
  async event(..._args: unknown[]): Promise<any> { return this.fail(); }
  async list(..._args: unknown[]): Promise<any> { return this.fail(); }
  async securitySummary(..._args: unknown[]): Promise<any> { return this.fail(); }
}
