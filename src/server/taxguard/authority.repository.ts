export interface CaseScope {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
}

export class AuthorityError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400, message?: string) {
    super(message || code);
    this.name = 'AuthorityError';
    this.code = code;
    this.status = status;
  }
}

export function safeId(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(value)) {
    throw new AuthorityError('INVALID_IDENTIFIER', 400);
  }
  return value;
}

export function casePath(scope: CaseScope): string {
  return `${safeId(scope.tenantId)}/${safeId(scope.clientId)}/${safeId(scope.engagementId)}/${scope.taxYear}`;
}

export class TaxGuardAuthorityRepository {
  async getCase(_scope: CaseScope, _uid?: string): Promise<any> {
    throw new AuthorityError('AUTHORITY_STORE_NOT_CONFIGURED', 503);
  }
  async getEvidence(_scope: CaseScope, _uid: string, _evidenceId: string): Promise<any> {
    throw new AuthorityError('AUTHORITY_STORE_NOT_CONFIGURED', 503);
  }
  async beginAiReview(
    _scope: CaseScope,
    _uid: string,
    _revision: number,
    _operationId: string,
    _evidenceId: string,
    _purpose: string
  ): Promise<any> {
    throw new AuthorityError('AUTHORITY_STORE_NOT_CONFIGURED', 503);
  }
  async recordAiProposal(
    _scope: CaseScope,
    _uid: string,
    _revision: number,
    _operationId: string,
    _evidenceId: string,
    _proposal: any,
    _model: string
  ): Promise<any> {
    throw new AuthorityError('AUTHORITY_STORE_NOT_CONFIGURED', 503);
  }
  async recordAiFailure(
    _scope: CaseScope,
    _uid: string,
    _revision: number,
    _operationId: string
  ): Promise<void> {
    return;
  }
}
