export class CaseStoreError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly failedChecks?: unknown[];

  constructor(code: string, messageOrStatus?: string | number, status = 400, failedChecks?: unknown[]) {
    super(typeof messageOrStatus === 'string' ? messageOrStatus : code);
    this.name = 'CaseStoreError';
    this.code = code;
    this.status = typeof messageOrStatus === 'number' ? messageOrStatus : status;
    this.failedChecks = failedChecks;
  }
}

export class CaseStore {
  constructor(private readonly db: any = null) {}

  private failUnavailable(): never {
    throw new CaseStoreError(
      'CASE_STORE_UNAVAILABLE',
      'Durable practice case store is not configured.',
      503
    );
  }

  async queue(..._args: any[]): Promise<any> {
    if (!this.db) return [];
    return [];
  }

  async detail(..._args: any[]): Promise<any> {
    if (!this.db) return null;
    return null;
  }

  async statusReport(..._args: any[]): Promise<any> {
    return {
      generatedAt: new Date().toISOString(),
      totalCases: 0,
      byStatus: {},
      cases: [],
    };
  }

  async create(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async advance(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async returnTo(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async setHold(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async restaff(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async addNote(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }
}
