export class BillingError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
  }
}

export class SandboxPaymentProvider {
  readonly name = 'SANDBOX_UNCOMMISSIONED';
  async charge(..._args: unknown[]): Promise<any> {
    throw new BillingError('PAYMENT_PROVIDER_NOT_COMMISSIONED', 503);
  }
}

export class BillingStore {
  constructor(private readonly _client?: unknown, private readonly _provider?: unknown) {}
  private fail(): never {
    throw new BillingError('BILLING_STORE_UNAVAILABLE', 503);
  }
  async addLine(..._args: unknown[]): Promise<any> { return this.fail(); }
  async arAging(..._args: unknown[]): Promise<any> { return this.fail(); }
  async catalog(..._args: unknown[]): Promise<any> { return this.fail(); }
  async createInvoice(..._args: unknown[]): Promise<any> { return this.fail(); }
  async decideCredit(..._args: unknown[]): Promise<any> { return this.fail(); }
  async list(..._args: unknown[]): Promise<any> { return this.fail(); }
  async page(..._args: unknown[]): Promise<any> { return this.fail(); }
  async paySandbox(..._args: unknown[]): Promise<any> { return this.fail(); }
  async recordManualPayment(..._args: unknown[]): Promise<any> { return this.fail(); }
  async refund(..._args: unknown[]): Promise<any> { return this.fail(); }
  async removeLine(..._args: unknown[]): Promise<any> { return this.fail(); }
  async requestCredit(..._args: unknown[]): Promise<any> { return this.fail(); }
  async transition(..._args: unknown[]): Promise<any> { return this.fail(); }
  async upsertService(..._args: unknown[]): Promise<any> { return this.fail(); }
}
