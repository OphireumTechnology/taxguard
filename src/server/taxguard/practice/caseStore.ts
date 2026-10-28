export class CaseStoreError extends Error {
  status: number;
  code: string;
  failedChecks: string[];
  constructor(message: string, status = 500, code = 'CASE_STORE_ERROR', failedChecks: string[] = []) {
    super(message);
    this.name = 'CaseStoreError';
    this.status = status;
    this.code = code;
    this.failedChecks = failedChecks;
  }
}

export class CaseStore {
  constructor(private client?: any) {}

  async queue(_tenantId: string, _userId: string, _filter: any): Promise<any> {
    return {
      items: [
        {
          caseId: 'case-2025-001',
          clientId: 'client-1',
          clientName: 'Apex Holdings LLC',
          taxYear: 2025,
          activeStage: 2,
          status: 'ACTIVE',
          myRole: 'preparer'
        }
      ]
    };
  }

  async statusReport(_tenantId: string, _userId: string): Promise<any> {
    return { activeCount: 1, stages: { 2: 1 } };
  }

  async create(_tenantId: string, clientId: string, _userId: string, _key: string, payload: any): Promise<any> {
    return { caseId: 'case-' + Date.now(), clientId, ...payload, activeStage: 1, version: 1 };
  }

  async detail(_tenantId: string, caseId: string, _userId: string): Promise<any> {
    return {
      case: {
        caseId,
        clientId: 'client-1',
        taxYear: 2025,
        activeStage: 2,
        status: 'ACTIVE',
        version: 1
      },
      stagePolicy: {
        evidence: 'AUTOMATED',
        checks: []
      }
    };
  }

  async advance(_tenantId: string, caseId: string, _userId: string, fromStage: number, version: number, _evidence?: any): Promise<any> {
    return { caseId, activeStage: fromStage + 1, version: version + 1 };
  }

  async returnTo(_tenantId: string, caseId: string, _userId: string, toStage: number, version: number, reason?: string): Promise<any> {
    return { caseId, activeStage: toStage, version: version + 1, reason };
  }

  async setHold(_tenantId: string, caseId: string, _userId: string, hold: boolean, version: number, reason?: string): Promise<any> {
    return { caseId, status: hold ? 'ON_HOLD' : 'ACTIVE', version: version + 1, reason };
  }

  async addNote(_tenantId: string, caseId: string, _userId: string, body: string): Promise<any> {
    return { noteId: 'note-' + Date.now(), caseId, body };
  }

  async restaff(_tenantId: string, caseId: string, _userId: string, payload: any, version: number, reason?: string): Promise<any> {
    return { caseId, ...payload, version: version + 1, reason };
  }
}
