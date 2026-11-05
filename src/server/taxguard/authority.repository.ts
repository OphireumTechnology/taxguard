/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CaseScope {
  tenantId: string;
  clientId: string;
  taxYear: number;
}

export class AuthorityError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = 'AuthorityError';
  }
}

export function safeId(id: unknown): string {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new AuthorityError('INVALID_IDENTIFIER', 400);
  }
  return id;
}

export class TaxGuardAuthorityRepository {
  async getCase(scope: CaseScope, _uid: string) {
    return {
      caseId: 'case_default',
      activeStage: 4,
      status: 'ACTIVE',
      scope
    };
  }

  async getEvidence(scope: CaseScope, _uid: string, evidenceId: string) {
    return {
      evidenceId,
      evidence: {
        evidencePackage: {
          evidenceId,
          scope,
          documents: [],
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  async beginAiReview(scope: CaseScope, _uid: string, revision: number, _operationId: string, _evidenceId: string, _purpose: string) {
    return {
      replayed: false,
      revision: revision + 1,
      startedAt: new Date().toISOString()
    };
  }

  async recordAiProposal(scope: CaseScope, _uid: string, revision: number, _operationId: string, _evidenceId: string, proposal: any, model?: string) {
    return {
      proposalId: 'prop_' + Math.random().toString(36).substring(2, 9),
      revision,
      scope,
      model,
      savedAt: new Date().toISOString()
    };
  }

  async recordAiFailure(scope: CaseScope, _uid: string, revision: number, _operationId: string) {
    return {
      revision,
      status: 'FAILED',
      failedAt: new Date().toISOString()
    };
  }
}
