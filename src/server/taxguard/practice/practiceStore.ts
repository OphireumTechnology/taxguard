export class PracticeStoreError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = 'PRACTICE_STORE_ERROR') {
    super(message);
    this.name = 'PracticeStoreError';
    this.status = status;
    this.code = code;
  }
}

export type PracticeRpcClient = any;

export class PracticeStore {
  constructor(private client?: any) {}

  async myWork(_tenantId: string, _userId: string): Promise<any> {
    return { items: [] };
  }

  async practiceSummary(_tenantId: string, _userId: string, _taxYear?: number): Promise<any> {
    return { activeClients: 1, pendingCases: 1, openInvoices: 0 };
  }

  async listClients(_tenantId: string, _userId: string, _filter: any): Promise<any> {
    return {
      items: [
        {
          clientId: 'client-1',
          name: 'Apex Holdings LLC',
          status: 'ACTIVE',
          clientType: 'BUSINESS',
          taxYear: 2025
        }
      ]
    };
  }

  async clientDetail(_tenantId: string, clientId: string, _userId: string): Promise<any> {
    return {
      clientId,
      name: 'Apex Holdings LLC',
      status: 'ACTIVE',
      clientType: 'BUSINESS',
      team: [
        { role: 'PREPARER', userId: 'usr-prep-1', name: 'John Doe, EA' },
        { role: 'REVIEWER', userId: 'usr-rev-1', name: 'Jane Smith, CPA' }
      ]
    };
  }

  async setClientStatus(_tenantId: string, clientId: string, _userId: string, status: string, reason?: string): Promise<any> {
    return { clientId, status, reason };
  }

  async setClientType(_tenantId: string, clientId: string, _userId: string, clientType: string): Promise<any> {
    return { clientId, clientType };
  }

  async createEngagement(_tenantId: string, clientId: string, _userId: string, _key: string, payload: any): Promise<any> {
    return { engagementId: 'eng-' + Date.now(), clientId, ...payload };
  }

  async setEngagementStatus(_tenantId: string, clientId: string, _userId: string, engagementId: string, status: string): Promise<any> {
    return { engagementId, clientId, status };
  }

  async addTaxYear(_tenantId: string, clientId: string, _userId: string, engagementId: string, taxYear: number): Promise<any> {
    return { engagementId, clientId, taxYear };
  }

  async assign(_tenantId: string, clientId: string, _userId: string, _key: string, payload: any): Promise<any> {
    return { assignmentId: 'asg-' + Date.now(), clientId, ...payload };
  }

  async unassign(_tenantId: string, clientId: string, _userId: string, assignmentId: string, reason?: string): Promise<any> {
    return { assignmentId, clientId, reason };
  }

  async addNote(_tenantId: string, clientId: string, _userId: string, body: string, engagementId?: string): Promise<any> {
    return { noteId: 'note-' + Date.now(), clientId, body, engagementId };
  }

  async createTask(_tenantId: string, clientId: string, _userId: string, _key: string, payload: any): Promise<any> {
    return { taskId: 'tsk-' + Date.now(), clientId, ...payload, status: 'OPEN', version: 1 };
  }

  async setTaskStatus(_tenantId: string, clientId: string, _userId: string, taskId: string, status: string, version: number): Promise<any> {
    return { taskId, clientId, status, version: version + 1 };
  }

  async addDeadline(_tenantId: string, clientId: string, _userId: string, _key: string, payload: any): Promise<any> {
    return { deadlineId: 'ddl-' + Date.now(), clientId, ...payload };
  }

  async resolveDeadline(_tenantId: string, clientId: string, _userId: string, deadlineId: string, status: string, reason?: string): Promise<any> {
    return { deadlineId, clientId, status, reason };
  }
}
