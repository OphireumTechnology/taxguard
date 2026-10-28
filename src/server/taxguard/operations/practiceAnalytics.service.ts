
export class PracticeAnalyticsService {
  async getPracticeAnalytics(tenantId: string, taxYear?: number): Promise<any> { return { totalActiveCases: 1, complianceRate: 100 }; }
  async getCaseCommandCenter(tenantId: string, taxYear?: number): Promise<any> { return { cases: [] }; }
}
export const globalPracticeAnalyticsService = new PracticeAnalyticsService();
