export const CONSULTATION_CONSENT_VERSION = '2026-01';
export const CONSULTATION_CONSENT_TEXT =
  'Submitting a consultation request does not create a client-accountant engagement until a formal engagement letter is executed with Destria Tax Services, LLC.';

export class ConsultationError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
  }
}

export class ConsultationStore {
  constructor(private readonly _client?: unknown) {}
  private fail(): never {
    throw new ConsultationError('CONSULTATION_STORE_UNAVAILABLE', 503);
  }
  async convert(..._args: unknown[]): Promise<any> { return this.fail(); }
  async decide(..._args: unknown[]): Promise<any> { return this.fail(); }
  async list(..._args: unknown[]): Promise<any> { return this.fail(); }
  async submit(..._args: unknown[]): Promise<any> { return this.fail(); }
}
