export class BookToTaxError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
  }
}

export class BookToTaxStore {
  constructor(private readonly _client?: unknown) {}
  private fail(): never {
    throw new BookToTaxError('BOOK_TO_TAX_STORE_UNAVAILABLE', 503);
  }
  async categories(..._args: unknown[]): Promise<any> { return this.fail(); }
  async generateWorkpaper(..._args: unknown[]): Promise<any> { return this.fail(); }
  async openSet(..._args: unknown[]): Promise<any> { return this.fail(); }
  async overview(..._args: unknown[]): Promise<any> { return this.fail(); }
  async prepareAdjustment(..._args: unknown[]): Promise<any> { return this.fail(); }
  async reviewAdjustment(..._args: unknown[]): Promise<any> { return this.fail(); }
  async reviewSet(..._args: unknown[]): Promise<any> { return this.fail(); }
  async reviewWorkpaper(..._args: unknown[]): Promise<any> { return this.fail(); }
  async saveCategory(..._args: unknown[]): Promise<any> { return this.fail(); }
  async setMapping(..._args: unknown[]): Promise<any> { return this.fail(); }
}
