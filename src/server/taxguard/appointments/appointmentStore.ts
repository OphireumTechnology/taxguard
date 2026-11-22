export class AppointmentStoreError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
  }
}

export class AppointmentStore {
  constructor(private readonly _client?: unknown) {}
  private fail(): never {
    throw new AppointmentStoreError('APPOINTMENT_STORE_UNAVAILABLE', 503);
  }
  async create(..._args: unknown[]): Promise<any> { return this.fail(); }
  async get(..._args: unknown[]): Promise<any> { return this.fail(); }
  async listForClient(..._args: unknown[]): Promise<any> { return this.fail(); }
  async reschedule(..._args: unknown[]): Promise<any> { return this.fail(); }
  async room(..._args: unknown[]): Promise<any> { return this.fail(); }
  async roomEvent(..._args: unknown[]): Promise<any> { return this.fail(); }
  async schedule(..._args: unknown[]): Promise<any> { return this.fail(); }
  async transition(..._args: unknown[]): Promise<any> { return this.fail(); }
  async update(..._args: unknown[]): Promise<any> { return this.fail(); }
}
