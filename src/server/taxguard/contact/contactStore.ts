export class ContactIntakeError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
  }
}

export class ContactStore {
  constructor(private readonly _client?: unknown) {}
  async submit(..._args: unknown[]): Promise<any> {
    throw new ContactIntakeError('CONTACT_INTAKE_STORE_UNAVAILABLE', 503);
  }
}
