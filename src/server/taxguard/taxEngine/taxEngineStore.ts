export class TaxEngineStoreError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly detail?: unknown;

  constructor(code: string, messageOrStatus?: string | number, status = 400, detail?: unknown) {
    super(typeof messageOrStatus === 'string' ? messageOrStatus : code);
    this.name = 'TaxEngineStoreError';
    this.code = code;
    this.status = typeof messageOrStatus === 'number' ? messageOrStatus : status;
    this.detail = detail;
  }
}

export class TaxEngineStore {
  constructor(private readonly db: any = null) {}

  private failUnavailable(): never {
    throw new TaxEngineStoreError(
      'TAX_ENGINE_STORE_UNAVAILABLE',
      'Durable TaxEngine store is not configured.',
      503
    );
  }

  async acknowledgeDiagnostic(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async addTest(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async assessReturnRisk(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async assessRisk(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async assignFinalAuthorizer(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async assignQc(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async authorizeFinal(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async calculate(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async caseReturns(..._args: any[]): Promise<any> { return []; }
  async citeResearch(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async conclusionReadiness(..._args: any[]): Promise<any> { return { ready: false, reasons: ['Durable store unavailable'] }; }
  async conclusions(..._args: any[]): Promise<any> { return []; }
  async coverage(..._args: any[]): Promise<any> { return { coverage: [], total: 0 }; }
  async diagnostics(..._args: any[]): Promise<any> { return []; }
  async draftFormRule(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async draftReturnTemplate(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async draftRuleSet(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async finalAuthorizations(..._args: any[]): Promise<any> { return []; }
  async finalContext(..._args: any[]): Promise<any> { return null; }
  async finalQueue(..._args: any[]): Promise<any> { return []; }
  async finalReadiness(..._args: any[]): Promise<any> { return { ready: false, reasons: ['Durable store unavailable'] }; }
  async formMappingDetail(..._args: any[]): Promise<any> { return null; }
  async formMappings(..._args: any[]): Promise<any> { return []; }
  async formRuleDetail(..._args: any[]): Promise<any> { return null; }
  async formRules(..._args: any[]): Promise<any> { return []; }
  async mapForm(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async openResearch(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async prepareReturn(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async proposeConclusion(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async qcContext(..._args: any[]): Promise<any> { return null; }
  async qcQueue(..._args: any[]): Promise<any> { return []; }
  async qcReviews(..._args: any[]): Promise<any> { return []; }
  async recordQc(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async registerSource(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async releaseSignaturePackage(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async removeTest(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async research(..._args: any[]): Promise<any> { return []; }
  async returnComparison(..._args: any[]): Promise<any> { return null; }
  async returnDetail(..._args: any[]): Promise<any> { return null; }
  async returnRiskAssessments(..._args: any[]): Promise<any> { return []; }
  async returnStageFacts(..._args: any[]): Promise<any> { return null; }
  async returnTemplateDetail(..._args: any[]): Promise<any> { return null; }
  async returnTemplates(..._args: any[]): Promise<any> { return []; }
  async returnVerifications(..._args: any[]): Promise<any> { return []; }
  async reviewConclusion(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async reviewQueue(..._args: any[]): Promise<any> { return []; }
  async reviewResearch(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async reviewRun(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async reviseConclusion(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async riskAssessments(..._args: any[]): Promise<any> { return []; }
  async ruleSet(..._args: any[]): Promise<any> { return null; }
  async ruleSets(..._args: any[]): Promise<any> { return []; }
  async runDiagnostics(..._args: any[]): Promise<any> { return []; }
  async runLineage(..._args: any[]): Promise<any> { return null; }
  async runTests(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async runs(..._args: any[]): Promise<any> { return []; }
  async signatureContext(..._args: any[]): Promise<any> { return null; }
  async signaturePackages(..._args: any[]): Promise<any> { return []; }
  async sources(..._args: any[]): Promise<any> { return []; }
  async submitConclusion(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async submitResearch(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async tests(..._args: any[]): Promise<any> { return []; }
  async traceConclusion(..._args: any[]): Promise<any> { return null; }
  async traceEvidence(..._args: any[]): Promise<any> { return null; }
  async transitionFormRule(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async transitionReturn(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async transitionReturnTemplate(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async transitionRuleSet(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async unassignFinalAuthorizer(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async unassignQc(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async verifyReturn(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async verifySource(..._args: any[]): Promise<any> { this.failUnavailable(); }
  async withdrawSignaturePackage(..._args: any[]): Promise<any> { this.failUnavailable(); }
}
