export const DURABLE_UNAVAILABLE_FIELDS = ['legacyRiskScore', 'clientEstimatedSavings'] as const;

export class SupabaseAccountantCaseDirectory {
  constructor(private readonly _client?: unknown) {}

  async listPreparerCases(..._args: unknown[]): Promise<any[]> {
    return [];
  }
}
