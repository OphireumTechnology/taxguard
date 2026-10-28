
export class OperationalSearchService {
  async search(query: string, scope?: any): Promise<any> { return { results: [] }; }
  async searchAuthorizedCases(query: string, tenantId: string, userId: string): Promise<any> { return { cases: [] }; }
}
export const globalOperationalSearchService = new OperationalSearchService();
