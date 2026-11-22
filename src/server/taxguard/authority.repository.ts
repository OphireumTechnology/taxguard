export interface CaseScope {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
}

export class AuthorityError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 403, message?: string) {
    super(message || code);
    this.name = 'AuthorityError';
    this.code = code;
    this.status = status;
  }
}

export function safeId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(value)) {
    throw new AuthorityError('INVALID_ID', 400, 'Invalid identifier.');
  }
  return value;
}

export function casePath(scope: CaseScope): string {
  safeId(scope.tenantId);
  safeId(scope.clientId);
  safeId(scope.engagementId);
  return `taxguardTenants/${scope.tenantId}/clients/${scope.clientId}/engagements/${scope.engagementId}/years/${scope.taxYear}`;
}

export class TaxGuardAuthorityRepository {
  constructor(private readonly _db?: any) {}

  async getCase(_scope: CaseScope, _uid?: string): Promise<any> {
    return null;
  }

  async assertCaseAccess(_scope: CaseScope, _actorUid: string): Promise<any> {
    return null;
  }

  async recordProposal(_scope: CaseScope, _proposal: any): Promise<any> {
    return { id: `prop_${Date.now().toString(36)}` };
  }

  [key: string]: any;
}
