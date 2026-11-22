export const LEGAL_DISCLAIMER_VERSION = '2026-01';
export const LEGAL_DISCLAIMER_TEXT =
  'Destria Tax Services, LLC provides tax preparation, accounting, and tax advisory coordination. Legal representation and legal advice require a licensed attorney engaged under a separate legal retainer agreement.';

export class LegalMatterError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'LegalMatterError';
    this.code = code;
    this.status = status;
  }
}

export class LegalMatterStore {
  constructor(private readonly db: any = null) {}

  private failUnavailable(): never {
    throw new LegalMatterError(
      'LEGAL_MATTER_STORE_UNAVAILABLE',
      'Durable legal matter store is not configured.',
      503
    );
  }

  async list(..._args: any[]): Promise<any> {
    if (!this.db) return [];
    return [];
  }

  async create(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async update(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async transition(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }

  async linkDocument(..._args: any[]): Promise<any> {
    this.failUnavailable();
  }
}
