class OperationalSearchService {
  searchAuthorizedCases(cases: any[], query: string): any[] {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized || !Array.isArray(cases)) return [];
    return cases.filter((item) => {
      const hay = [
        item?.caseId,
        item?.caseKey,
        item?.clientId,
        item?.clientName,
        item?.taxYear,
        item?.status,
      ]
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).toLowerCase())
        .join(' ');
      return hay.includes(normalized);
    });
  }

  search(..._args: any[]): any {
    return {
      matches: [],
      total: 0,
    };
  }
}

export const globalOperationalSearchService = new OperationalSearchService();
