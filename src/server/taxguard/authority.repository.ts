import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { EvidencePackage, AiReasoningProposal } from '../../taxguard/intelligence/types';
import type { StageGateEvidence } from './stageGate.types';

export interface CaseScope { tenantId: string; clientId: string; engagementId: string; taxYear: number }
export class AuthorityError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}
export function safeId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new AuthorityError('INVALID_IDENTIFIER');
}
export function casePath(scope: CaseScope): string {
  if (!scope) throw new AuthorityError('INVALID_SCOPE');
  [scope.tenantId, scope.clientId, scope.engagementId].forEach(safeId);
  if (!Number.isInteger(scope.taxYear) || scope.taxYear < 2000 || scope.taxYear > 2200) throw new AuthorityError('INVALID_TAX_YEAR');
  return `taxguardTenants/${scope.tenantId}/clients/${scope.clientId}/engagements/${scope.engagementId}/years/${scope.taxYear}`;
}
function digest(value: unknown): string {
  function canonical(v: any): any { return Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v; }
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
interface CaseRecord extends CaseScope { revision: number; activeStage: number; clientUid: string; preparerUid: string; reviewerUid: string; openExceptions: number; externalSubmissionEnabled: false; aiWindowStart?: number; aiRequestCount?: number }
interface Access { member: any; assignment: any; current: CaseRecord }
interface Write { collection: string; id: string; data: Record<string, unknown> }

/** Admin SDK only. New scoped records coexist with legacy records; no implicit migration.
 * Membership/client/engagement anchors must be provisioned by an authorized operator.
 */
export class TaxGuardAuthorityRepository {
  constructor(private readonly db: Firestore) {
    if (!db) throw new AuthorityError('AUTHORITY_UNAVAILABLE', 503);
  }
  private async access(tx: Transaction, scope: CaseScope, uid: string): Promise<Access> {
    safeId(uid);
    const path = casePath(scope);
    const member = (await tx.get(this.db.doc(`taxguardTenants/${scope.tenantId}/members/${uid}`))).data();
    const current = (await tx.get(this.db.doc(path))).data() as CaseRecord;
    if (!member || member.status !== 'active' || !current) throw new AuthorityError('CASE_ACCESS_DENIED', 403);
    if (['tenantId', 'clientId', 'engagementId', 'taxYear'].some(k => current[k] !== scope[k])) throw new AuthorityError('SCOPE_MISMATCH', 403);
    const assignment = (await tx.get(this.db.doc(`${path}/assignments/${uid}`))).data();
    if (!assignment || assignment.active !== true || assignment.uid !== uid) throw new AuthorityError('CASE_ACCESS_DENIED', 403);
    if (member.role === 'client') {
      if (current.clientUid !== uid || member.clientId !== scope.clientId || assignment.role !== 'client') throw new AuthorityError('CASE_ACCESS_DENIED', 403);
    } else if (!['accountant', 'reviewer', 'senior_reviewer'].includes(member.role) ||
        !['preparer', 'reviewer'].includes(assignment.role)) throw new AuthorityError('CASE_ACCESS_DENIED', 403);
    return { member, assignment, current };
  }
  private reviewer(access: Access, uid: string) {
    if (access.assignment.role !== 'reviewer' || access.current.reviewerUid !== uid || access.current.preparerUid === uid ||
        !['reviewer', 'senior_reviewer'].includes(access.member.role) || access.member.credentialVerified !== true ||
        !['CPA', 'EA', 'ATTORNEY'].includes(access.member.credentialType) ||
        !(Date.parse(access.member.credentialExpiresAt) > Date.now())) throw new AuthorityError('INDEPENDENT_PROFESSIONAL_REQUIRED', 403);
  }
  private preparer(access: Access, uid: string) {
    if (access.assignment.role !== 'preparer' || access.current.preparerUid !== uid || access.member.role !== 'accountant') throw new AuthorityError('PREPARER_REQUIRED', 403);
  }
  async getCase(scope: CaseScope, uid: string) {
    return this.db.runTransaction(async tx => (await this.access(tx, scope, uid)).current);
  }
  async getEvidence(scope: CaseScope, uid: string, id: string) {
    safeId(id);
    return this.db.runTransaction(async tx => {
      const access = await this.access(tx, scope, uid);
      if (access.assignment.role === 'client') throw new AuthorityError('PROFESSIONAL_REQUIRED', 403);
      const data = (await tx.get(this.db.doc(`${casePath(scope)}/evidence/${id}`))).data();
      if (!data) throw new AuthorityError('EVIDENCE_NOT_FOUND', 404);
      return { evidence: data, revision: access.current.revision };
    });
  }
  async getArtifact(scope: CaseScope, uid: string, collection: string, id: string) {
    safeId(id);
    if (!['provenance', 'reviews', 'approvals', 'exceptions', 'exceptionResolutions', 'aiProposals', 'aiProviderProvenance',
      'decisionTraces', 'reviewRequests', 'stageGateDecisions', 'audit'].includes(collection)) throw new AuthorityError('INVALID_ARTIFACT');
    return this.db.runTransaction(async tx => {
      const access = await this.access(tx, scope, uid);
      if (access.assignment.role === 'client') throw new AuthorityError('PROFESSIONAL_REQUIRED', 403);
      const data = (await tx.get(this.db.doc(`${casePath(scope)}/${collection}/${id}`))).data();
      if (!data) throw new AuthorityError('ARTIFACT_NOT_FOUND', 404);
      return data;
    });
  }
  async createCase(scope: CaseScope, adminUid: string, assignment: { clientUid: string; preparerUid: string; reviewerUid: string }) {
    const path = casePath(scope); safeId(adminUid); Object.values(assignment).forEach(safeId);
    if (new Set(Object.values(assignment)).size !== 3) throw new AuthorityError('INDEPENDENT_ASSIGNMENTS_REQUIRED');
    return this.db.runTransaction(async tx => {
      const memberRef = (uid: string) => this.db.doc(`taxguardTenants/${scope.tenantId}/members/${uid}`);
      const admin = (await tx.get(memberRef(adminUid))).data();
      if (admin?.role !== 'administrator' || admin.status !== 'active') throw new AuthorityError('ADMIN_REQUIRED', 403);
      const client = (await tx.get(this.db.doc(`taxguardTenants/${scope.tenantId}/clients/${scope.clientId}`))).data();
      const engagement = (await tx.get(this.db.doc(path.split('/years/')[0]))).data();
      const prep = (await tx.get(memberRef(assignment.preparerUid))).data();
      const reviewer = (await tx.get(memberRef(assignment.reviewerUid))).data();
      const owner = (await tx.get(memberRef(assignment.clientUid))).data();
      const existing = await tx.get(this.db.doc(path));
      if (existing.exists) throw new AuthorityError('CASE_EXISTS', 409);
      if (client?.ownerUid !== assignment.clientUid || engagement?.clientId !== scope.clientId ||
          !Array.isArray(engagement?.taxYears) || !engagement.taxYears.includes(scope.taxYear) ||
          owner?.role !== 'client' || owner?.clientId !== scope.clientId || owner?.status !== 'active' ||
          prep?.role !== 'accountant' || prep.status !== 'active' ||
          !['reviewer', 'senior_reviewer'].includes(reviewer?.role) || reviewer.status !== 'active') throw new AuthorityError('INVALID_CASE_ASSIGNMENTS');
      const current: CaseRecord = { ...scope, ...assignment, revision: 1, activeStage: 1, openExceptions: 0, externalSubmissionEnabled: false };
      tx.create(this.db.doc(path), current);
      for (const [role, uid] of [['client', assignment.clientUid], ['preparer', assignment.preparerUid], ['reviewer', assignment.reviewerUid]]) {
        tx.create(this.db.doc(`${path}/assignments/${uid}`), { uid, role, active: true, assignedBy: adminUid, assignedAt: new Date().toISOString() });
      }
      tx.create(this.db.doc(`${path}/audit/bootstrap`), { action: 'CASE_CREATED', actorUid: adminUid, scope, timestamp: new Date().toISOString(), revision: 1 });
      return current;
    });
  }
  private async mutate(scope: CaseScope, uid: string, revision: number, operationId: string, request: unknown,
    build: (tx: Transaction, access: Access) => Promise<{ writes: Write[]; patch?: Partial<CaseRecord> }>) {
    const path = casePath(scope); safeId(operationId);
    if (!Number.isSafeInteger(revision) || revision < 1) throw new AuthorityError('INVALID_REVISION');
    const requestHash = digest({ uid, request });
    return this.db.runTransaction(async tx => {
      const access = await this.access(tx, scope, uid);
      const opRef = this.db.doc(`${path}/operations/${operationId}`);
      const previous = (await tx.get(opRef)).data();
      if (previous) {
        if (previous.requestHash !== requestHash) throw new AuthorityError('IDEMPOTENCY_CONFLICT', 409);
        return { ...previous.result, replayed: true };
      }
      if (access.current.revision !== revision) throw new AuthorityError('REVISION_CONFLICT', 409);
      const { writes, patch = {} } = await build(tx, access);
      const timestamp = new Date().toISOString();
      const result = { revision: revision + 1, operationId };
      for (const write of writes) {
        safeId(write.id);
        tx.create(this.db.doc(`${path}/${write.collection}/${write.id}`), { ...write.data, scope, recordedBy: uid, recordedAt: timestamp, revision: result.revision });
      }
      tx.set(this.db.doc(path), { ...access.current, ...patch, revision: result.revision, externalSubmissionEnabled: false });
      tx.create(this.db.doc(`${path}/audit/${operationId}`), { action: (request as any).action, actorUid: uid, scope, timestamp, revision: result.revision });
      tx.create(opRef, { requestHash, result });
      return result;
    });
  }
  async recordEvidence(scope: CaseScope, uid: string, revision: number, operationId: string,
    input: { evidencePackage: EvidencePackage; sourceSha256: string; sourceDocumentIds: string[] }) {
    const value = structuredClone(input); const pkg = value?.evidencePackage;
    if (!pkg || pkg.clientId !== scope.clientId || pkg.engagementId !== scope.engagementId || pkg.taxYear !== scope.taxYear ||
        pkg.requiresHumanReview !== true || !/^[a-f0-9]{64}$/.test(value.sourceSha256)) throw new AuthorityError('INVALID_EVIDENCE');
    [pkg.evidencePackageId, pkg.correlationId].forEach(safeId);
    for (const ids of [pkg.knowledgeSourceIds, pkg.ruleEvaluationIds, pkg.findingIds, pkg.aiProposalIds, value.sourceDocumentIds]) {
      if (!Array.isArray(ids) || ids.length > 100) throw new AuthorityError('INVALID_EVIDENCE');
      ids.forEach(safeId);
    }
    // Keep only declared fields, not arbitrary client assertions of verification.
    const evidencePackage: EvidencePackage = { evidencePackageId: pkg.evidencePackageId, clientId: scope.clientId, engagementId: scope.engagementId,
      taxYear: scope.taxYear, knowledgeSourceIds: pkg.knowledgeSourceIds, ruleEvaluationIds: pkg.ruleEvaluationIds, findingIds: pkg.findingIds,
      aiProposalIds: [], requiresHumanReview: true, correlationId: pkg.correlationId, createdAt: new Date().toISOString() };
    return this.mutate(scope, uid, revision, operationId, { action: 'EVIDENCE_RECORDED', input: value }, async (_tx, access) => {
      this.preparer(access, uid);
      return { writes: [
        { collection: 'evidence', id: pkg.evidencePackageId, data: { evidencePackage, sourceSha256: value.sourceSha256, sourceDocumentIds: value.sourceDocumentIds, preparedBy: uid, status: 'UNVERIFIED', requiresHumanReview: true } },
        { collection: 'provenance', id: pkg.evidencePackageId, data: { evidencePackageId: pkg.evidencePackageId, sourceSha256: value.sourceSha256, sourceDocumentIds: value.sourceDocumentIds, authorityVerified: false } },
      ] };
    });
  }
  async recordReview(scope: CaseScope, uid: string, revision: number, operationId: string, evidenceId: string, outcome: 'APPROVED' | 'CHANGES_REQUIRED') {
    safeId(evidenceId);
    if (!['APPROVED', 'CHANGES_REQUIRED'].includes(outcome)) throw new AuthorityError('INVALID_REVIEW');
    return this.mutate(scope, uid, revision, operationId, { action: 'PROFESSIONAL_REVIEW', evidenceId, outcome }, async (tx, access) => {
      this.reviewer(access, uid);
      const evidence = (await tx.get(this.db.doc(`${casePath(scope)}/evidence/${evidenceId}`))).data();
      if (!evidence || evidence.preparedBy === uid) throw new AuthorityError('INDEPENDENT_EVIDENCE_REVIEW_REQUIRED', 403);
      if (outcome === 'APPROVED' && access.current.openExceptions !== 0) throw new AuthorityError('OPEN_EXCEPTIONS', 409);
      const data = { evidenceId, outcome, preparedBy: evidence.preparedBy, reviewedBy: uid,
        credentialType: access.member.credentialType, externalSubmissionAllowed: false };
      return { writes: [{ collection: 'reviews', id: operationId, data },
        ...(outcome === 'APPROVED' ? [{ collection: 'approvals', id: operationId, data }] : [])] };
    });
  }
  async recordException(scope: CaseScope, uid: string, revision: number, operationId: string, code: string) {
    safeId(code);
    return this.mutate(scope, uid, revision, operationId, { action: 'EXCEPTION_OPENED', code }, async (_tx, access) => {
      if (access.assignment.role === 'client') throw new AuthorityError('PROFESSIONAL_REQUIRED', 403);
      return { writes: [{ collection: 'exceptions', id: operationId, data: { code, status: 'OPEN' } }], patch: { openExceptions: access.current.openExceptions + 1 } };
    });
  }
  async resolveException(scope: CaseScope, uid: string, revision: number, operationId: string, exceptionId: string) {
    safeId(exceptionId);
    return this.mutate(scope, uid, revision, operationId, { action: 'EXCEPTION_RESOLVED', exceptionId }, async (tx, access) => {
      this.reviewer(access, uid);
      const root = casePath(scope);
      const exception = await tx.get(this.db.doc(`${root}/exceptions/${exceptionId}`));
      const resolved = await tx.get(this.db.doc(`${root}/exceptionResolutions/${exceptionId}`));
      if (!exception.exists || resolved.exists || access.current.openExceptions < 1) throw new AuthorityError('EXCEPTION_CONFLICT', 409);
      return { writes: [{ collection: 'exceptionResolutions', id: exceptionId, data: { exceptionId, status: 'RESOLVED' } }], patch: { openExceptions: access.current.openExceptions - 1 } };
    });
  }
  async recordAiProposal(scope: CaseScope, uid: string, revision: number, operationId: string, evidenceId: string,
    proposal: AiReasoningProposal, model: string) {
    safeId(evidenceId);
    if (!proposal || proposal.isAiProposedOnly !== true || proposal.status !== 'REVIEW_REQUIRED' ||
        proposal.clientId !== scope.clientId || proposal.engagementId !== scope.engagementId || proposal.taxYear !== scope.taxYear ||
        typeof model !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(model)) throw new AuthorityError('INVALID_AI_PROPOSAL');
    return this.mutate(scope, uid, revision, operationId, { action: 'AI_PROPOSAL_RECORDED', evidenceId, proposal, model }, async (tx, access) => {
      this.preparer(access, uid);
      const evidence = (await tx.get(this.db.doc(`${casePath(scope)}/evidence/${evidenceId}`))).data();
      if (!evidence || digest(proposal.knowledgeSourceIds) !== digest(evidence.evidencePackage.knowledgeSourceIds) ||
          digest(proposal.ruleEvaluationIds) !== digest(evidence.evidencePackage.ruleEvaluationIds)) throw new AuthorityError('AI_EVIDENCE_MISMATCH');
      return { writes: [
        { collection: 'aiProposals', id: operationId, data: { proposal, evidenceId, isAiProposedOnly: true } },
        { collection: 'aiProviderProvenance', id: operationId, data: { provider: 'OPENAI', model, promptVersion: 'counts-only-v1', evidenceId, authorityVerified: false } },
        { collection: 'decisionTraces', id: operationId, data: { evidenceId, proposalId: proposal.proposalId, stage: 'AI_PROPOSAL', hasDecisionAuthority: false, isAiProposedOnly: true } },
        { collection: 'reviewRequests', id: operationId, data: { evidenceId, proposalId: proposal.proposalId, status: 'PENDING_REVIEW', requiresHumanReview: true } },
      ] };
    });
  }
  async beginAiReview(scope: CaseScope, uid: string, revision: number, operationId: string, evidenceId: string, purpose: string) {
    safeId(evidenceId);
    return this.mutate(scope, uid, revision, operationId, { action: 'AI_REQUEST_STARTED', evidenceId, purpose }, async (tx, access) => {
      this.preparer(access, uid);
      const evidence = await tx.get(this.db.doc(`${casePath(scope)}/evidence/${evidenceId}`));
      if (!evidence.exists) throw new AuthorityError('EVIDENCE_NOT_FOUND', 404);
      const reset = !(access.current.aiWindowStart > Date.now() - 3600000);
      const count = reset ? 0 : access.current.aiRequestCount || 0;
      if (count >= 20) throw new AuthorityError('AI_RATE_LIMITED', 429);
      return { writes: [{ collection: 'aiRequests', id: operationId, data: { evidenceId, purpose, status: 'STARTED', isAiProposedOnly: true } }],
        patch: { aiWindowStart: reset ? Date.now() : access.current.aiWindowStart, aiRequestCount: count + 1 } };
    });
  }
  async recordAiFailure(scope: CaseScope, uid: string, revision: number, operationId: string) {
    return this.mutate(scope, uid, revision, operationId, { action: 'AI_REQUEST_FAILED' }, async (_tx, access) => {
      this.preparer(access, uid);
      return { writes: [{ collection: 'reviewRequests', id: operationId, data: { status: 'PENDING_REVIEW', requiresHumanReview: true, reason: 'AI_PROVIDER_FAILURE' } }] };
    });
  }
  /** Called only after a server gate evaluator; never accept passed from an HTTP body. */
  async recordStageGate(scope: CaseScope, uid: string, revision: number, operationId: string,
    decision: { stage: number; passed: boolean; approvalId: string; evaluatorVersion: string; evidence?: StageGateEvidence }) {
    safeId(decision.approvalId); safeId(decision.evaluatorVersion);
    if (!Number.isInteger(decision.stage) || decision.stage < 1 || decision.stage > 18 || typeof decision.passed !== 'boolean') throw new AuthorityError('INVALID_GATE');
    return this.mutate(scope, uid, revision, operationId, { action: 'STAGE_GATE_DECISION', decision }, async (tx, access) => {
      this.reviewer(access, uid);
      const approval = (await tx.get(this.db.doc(`${casePath(scope)}/approvals/${decision.approvalId}`))).data();
      if (decision.stage !== access.current.activeStage || !approval || approval.revision !== revision ||
          approval.reviewedBy !== uid || access.current.openExceptions !== 0) throw new AuthorityError('GATE_BLOCKED', 409);
      return { writes: [{ collection: 'stageGateDecisions', id: operationId, data: { ...decision, externalSubmissionAllowed: false } }],
        patch: decision.passed ? { activeStage: Math.min(18, decision.stage + 1) } : {} };
    });
  }
}
