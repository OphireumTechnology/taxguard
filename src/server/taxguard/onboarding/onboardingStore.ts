export class OnboardingError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, messageOrStatus?: string | number, status = 400) {
    super(typeof messageOrStatus === 'string' ? messageOrStatus : code);
    this.name = 'OnboardingError';
    this.code = code;
    this.status = typeof messageOrStatus === 'number' ? messageOrStatus : status;
  }
}

export class OnboardingStore {
  constructor(private readonly db: any = null) {}

  private failUnavailable(): never {
    throw new OnboardingError(
      'ONBOARDING_STORE_UNAVAILABLE',
      'Durable onboarding store is not configured.',
      503
    );
  }

  async get(..._args: any[]): Promise<any> {
    if (!this.db) return null;
    return null;
  }

  async queue(..._args: any[]): Promise<any> {
    if (!this.db) return [];
    return [];
  }

  async save(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async submit(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async decide(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }
}
