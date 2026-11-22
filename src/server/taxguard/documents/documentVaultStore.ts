export class DocumentVaultError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
  }
}

export class DocumentVaultStore {
  constructor(..._args: unknown[]) {}
  private fail(): never {
    throw new DocumentVaultError('DOCUMENT_VAULT_STORE_UNAVAILABLE', 503);
  }
  async detail(..._args: unknown[]): Promise<any> { return this.fail(); }
  async downloadUrl(..._args: unknown[]): Promise<any> { return this.fail(); }
  async list(..._args: unknown[]): Promise<any> { return this.fail(); }
  async review(..._args: unknown[]): Promise<any> { return this.fail(); }
  async reviewQueue(..._args: unknown[]): Promise<any> { return this.fail(); }
  async upload(..._args: unknown[]): Promise<any> { return this.fail(); }
  async uploadTargets(..._args: unknown[]): Promise<any> { return this.fail(); }
  async verifyExtraction(..._args: unknown[]): Promise<any> { return this.fail(); }
}
