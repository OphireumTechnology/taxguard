class PracticeAnalyticsService {
  getPracticeAnalytics(..._args: any[]): any {
    return {
      generatedAt: new Date().toISOString(),
      totalCases: 0,
      activeCases: 0,
      overdueDeadlines: 0,
      openTasks: 0,
      byStage: {},
    };
  }

  getCaseCommandCenter(..._args: any[]): any {
    return {
      generatedAt: new Date().toISOString(),
      cases: [],
      alerts: [],
      metrics: {
        totalCases: 0,
        blockedCases: 0,
        overdueTasks: 0,
      },
    };
  }
}

export const globalPracticeAnalyticsService = new PracticeAnalyticsService();
