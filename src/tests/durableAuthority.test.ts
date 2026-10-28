import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxGuardAuthorityRepository, casePath } from '../server/taxguard/authority.repository';
import { TransactionalFirestore } from './helpers/transactionalFirestore';
import { proposeDurableOpenAIReview } from '../server/ai/TaxGuardOpenAIService';
import { OpenAIReasoningProvider } from '../server/ai/OpenAIReasoningProvider';
import { ServerStageGateOrchestrator } from '../server/taxguard/serverStageGateOrchestrator';

const scope = { tenantId: 'tenantA', clientId: '001', engagementId: 'engA', taxYear: 2025 };
const path = casePath(scope);
const evidence = { evidencePackage: { evidencePackageId: 'ev1', clientId: '001', engagementId: 'engA', taxYear: 2025,
  knowledgeSourceIds: ['source1'], ruleEvaluationIds: ['rule1'], findingIds: ['finding1'], aiProposalIds: [],
  requiresHumanReview: true as const, correlationId: 'corr1', createdAt: '2026-01-01' }, sourceSha256: 'a'.repeat(64), sourceDocumentIds: ['doc1'] };
let db: TransactionalFirestore; let repo: TaxGuardAuthorityRepository;
beforeEach(async () => {
  db = new TransactionalFirestore();
  const members = { admin: { role: 'administrator', status: 'active' }, owner: { role: 'client', status: 'active', clientId: '001' },
    preparer: { role: 'accountant', status: 'active' }, reviewer: { role: 'reviewer', status: 'active', credentialVerified: true, credentialType: 'CPA', credentialExpiresAt: '2099-01-01' } };
  for (const [uid, member] of Object.entries(members)) db.records.set(`taxguardTenants/tenantA/members/${uid}`, member);
  db.records.set('taxguardTenants/tenantA/clients/001', { ownerUid: 'owner' });
  db.records.set('taxguardTenants/tenantA/clients/001/engagements/engA', { clientId: '001', taxYears: [2025] });
  repo = new TaxGuardAuthorityRepository(db as any);
  await repo.createCase(scope, 'admin', { clientUid: 'owner', preparerUid: 'preparer', reviewerUid: 'reviewer' });
});
async function addEvidence() { return repo.recordEvidence(scope, 'preparer', 1, 'evidence-op', evidence); }
describe('durable scoped authority', () => {
  it('persists assignments and case scope across repository instances', async () => {
    const fresh = new TaxGuardAuthorityRepository(db as any);
    expect(await fresh.getCase(scope, 'owner')).toMatchObject({ ...scope, revision: 1, externalSubmissionEnabled: false });
    expect(db.records.get(path + '/assignments/reviewer')).toMatchObject({ role: 'reviewer', active: true });
  });
  it.each(['tenantId', 'clientId', 'engagementId', 'taxYear'])('isolates %s', async key => {
    await expect(repo.getCase({ ...scope, [key]: key === 'taxYear' ? 2024 : 'other' }, 'owner')).rejects.toThrow('CASE_ACCESS_DENIED');
  });
  it.each(['../other', 'a/b', '', 'a'.repeat(129)])('rejects invalid path id %s', id => {
    expect(() => casePath({ ...scope, clientId: id })).toThrow('INVALID_IDENTIFIER');
  });
  it('denies administrator override for case evidence', async () => {
    await expect(repo.getEvidence(scope, 'admin', 'ev1')).rejects.toThrow('CASE_ACCESS_DENIED');
  });
  it('denies expired/revoked membership and assignment', async () => {
    db.records.get(path + '/assignments/preparer').active = false;
    await expect(addEvidence()).rejects.toThrow('CASE_ACCESS_DENIED');
    db.records.get(path + '/assignments/preparer').active = true;
    db.records.get('taxguardTenants/tenantA/members/preparer').status = 'suspended';
    await expect(addEvidence()).rejects.toThrow('CASE_ACCESS_DENIED');
  });
  it('commits evidence, provenance and audit atomically and returns defensive reads', async () => {
    await addEvidence();
    expect(db.records.get(path + '/provenance/ev1').authorityVerified).toBe(false);
    expect(db.records.get(path + '/audit/evidence-op').action).toBe('EVIDENCE_RECORDED');
    const loaded = await repo.getEvidence(scope, 'reviewer', 'ev1');
    loaded.evidence.evidencePackage.knowledgeSourceIds.push('fake');
    expect((await repo.getEvidence(scope, 'reviewer', 'ev1')).evidence.evidencePackage.knowledgeSourceIds).toEqual(['source1']);
  });
  it('rolls back on storage failure', async () => {
    db.failCommit = true;
    await expect(addEvidence()).rejects.toThrow('Commit unavailable');
    expect(db.records.has(path + '/evidence/ev1')).toBe(false);
    expect(db.records.get(path).revision).toBe(1);
  });
  it('handles exact replay and rejects conflicting idempotency reuse', async () => {
    await addEvidence();
    expect(await addEvidence()).toMatchObject({ revision: 2, replayed: true });
    await expect(repo.recordEvidence(scope, 'preparer', 1, 'evidence-op', { ...evidence, sourceSha256: 'b'.repeat(64) })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });
  it('rejects stale concurrent writers without losing an update', async () => {
    const results = await Promise.allSettled([addEvidence(), repo.recordException(scope, 'preparer', 1, 'ex1', 'MISSING_SOURCE')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(db.records.get(path).revision).toBe(2);
  });
  it('preserves immutable evidence', async () => {
    await addEvidence();
    await expect(repo.recordEvidence(scope, 'preparer', 2, 'replacement', evidence)).rejects.toThrow('Already exists');
    expect(db.records.get(path).revision).toBe(2);
  });
  it('rejects evidence from another engagement', async () => {
    await expect(repo.recordEvidence(scope, 'preparer', 1, 'x', { ...evidence, evidencePackage: { ...evidence.evidencePackage, engagementId: 'other' } })).rejects.toThrow('INVALID_EVIDENCE');
  });
  it.each(['preparer', 'owner', 'admin'])('denies approval by %s', async uid => {
    await addEvidence();
    await expect(repo.recordReview(scope, uid, 2, 'review1', 'ev1', 'APPROVED')).rejects.toThrow();
    expect(db.records.has(path + '/approvals/review1')).toBe(false);
  });
  it.each([{ credentialVerified: false }, { credentialExpiresAt: '2020-01-01' }, { credentialType: 'AI' }])('rejects invalid credentials %j', async patch => {
    await addEvidence(); Object.assign(db.records.get('taxguardTenants/tenantA/members/reviewer'), patch);
    await expect(repo.recordReview(scope, 'reviewer', 2, 'review1', 'ev1', 'APPROVED')).rejects.toThrow('INDEPENDENT_PROFESSIONAL_REQUIRED');
  });
  it('enforces maker-checker using stored preparer identity', async () => {
    await addEvidence(); db.records.get(path + '/evidence/ev1').preparedBy = 'reviewer';
    await expect(repo.recordReview(scope, 'reviewer', 2, 'review1', 'ev1', 'APPROVED')).rejects.toThrow('INDEPENDENT_EVIDENCE_REVIEW_REQUIRED');
  });
  it('requires independent resolution of exceptions before approval', async () => {
    await addEvidence(); await repo.recordException(scope, 'preparer', 2, 'ex1', 'CONFLICT');
    await expect(repo.recordReview(scope, 'reviewer', 3, 'r1', 'ev1', 'APPROVED')).rejects.toThrow('OPEN_EXCEPTIONS');
    await expect(repo.resolveException(scope, 'preparer', 3, 'resolve1', 'ex1')).rejects.toThrow('INDEPENDENT_PROFESSIONAL_REQUIRED');
    await repo.resolveException(scope, 'reviewer', 3, 'resolve1', 'ex1');
    await repo.recordReview(scope, 'reviewer', 4, 'r1', 'ev1', 'APPROVED');
    expect(db.records.get(path + '/approvals/r1')).toMatchObject({ reviewedBy: 'reviewer', preparedBy: 'preparer' });
  });
  it('requires a current approval and sequential stage gate', async () => {
    await addEvidence(); await repo.recordReview(scope, 'reviewer', 2, 'r1', 'ev1', 'APPROVED');
    await expect(repo.recordStageGate(scope, 'reviewer', 3, 'g1', { stage: 2, passed: true, approvalId: 'r1', evaluatorVersion: 'v1' })).rejects.toThrow('GATE_BLOCKED');
    await repo.recordStageGate(scope, 'reviewer', 3, 'g1', { stage: 1, passed: true, approvalId: 'r1', evaluatorVersion: 'v1' });
    expect(db.records.get(path)).toMatchObject({ activeStage: 2, externalSubmissionEnabled: false });
    expect(db.records.has(path + '/stageGateDecisions/g1')).toBe(true);
  });
  it('persists AI, review request, provenance and trace together without calling the provider on replay', async () => {
    await addEvidence();
    const provider = { model: 'test-model', reason: vi.fn().mockResolvedValue({ explanation: 'Review is required.', confidence: 'LOW_CONFIDENCE' }) } as unknown as OpenAIReasoningProvider;
    const input = { evidenceId: 'ev1', purpose: 'REVIEW_EVIDENCE_COMPLETENESS', revision: 2, operationId: 'ai1' };
    const result = await proposeDurableOpenAIReview(repo, scope, 'preparer', input, provider);
    expect(result.proposal.status).toBe('REVIEW_REQUIRED');
    for (const collection of ['aiProposals', 'aiProviderProvenance', 'decisionTraces', 'reviewRequests', 'audit']) expect(db.records.has(`${path}/${collection}/ai1_result`)).toBe(true);
    expect(db.records.get(path + '/decisionTraces/ai1_result').hasDecisionAuthority).toBe(false);
    await expect(proposeDurableOpenAIReview(repo, scope, 'preparer', input, provider)).rejects.toThrow('AI_REQUEST_ALREADY_STARTED');
    expect(provider.reason).toHaveBeenCalledOnce();
  });
  it('does not transmit AI requests for an unauthorized actor', async () => {
    await addEvidence(); const provider = { model: 'test', reason: vi.fn() } as any;
    await expect(proposeDurableOpenAIReview(repo, scope, 'owner', { evidenceId: 'ev1', purpose: 'IDENTIFY_REVIEW_QUESTIONS', revision: 2, operationId: 'ai1' }, provider)).rejects.toThrow();
    expect(provider.reason).not.toHaveBeenCalled();
  });
  it('persists a review-required failure without a proposal', async () => {
    await addEvidence(); const provider = { model: 'test', reason: vi.fn().mockRejectedValue(new Error('provider unavailable')) } as any;
    await expect(proposeDurableOpenAIReview(repo, scope, 'preparer', { evidenceId: 'ev1', purpose: 'IDENTIFY_REVIEW_QUESTIONS', revision: 2, operationId: 'ai1' }, provider)).rejects.toThrow();
    expect(db.records.get(path + '/reviewRequests/ai1_failure').requiresHumanReview).toBe(true);
    expect(db.records.has(path + '/aiProposals/ai1_result')).toBe(false);
  });
  it('enforces durable AI rate limits before transport', async () => {
    await addEvidence(); Object.assign(db.records.get(path), { aiWindowStart: Date.now(), aiRequestCount: 20 });
    await expect(repo.beginAiReview(scope, 'preparer', 2, 'ai1', 'ev1', 'IDENTIFY_REVIEW_QUESTIONS')).rejects.toThrow('AI_RATE_LIMITED');
  });
  it('persists actual deterministic gate checks without advancing a failed gate', async () => {
    await addEvidence(); await repo.recordReview(scope, 'reviewer', 2, 'r1', 'ev1', 'APPROVED');
    await ServerStageGateOrchestrator.commitScopedStageOne(repo,
      { scope, actorUid: 'reviewer', expectedRevision: 3, operationId: 'gate1', approvalId: 'r1' },
      { hardExitGatePassed: true, identityComplete: false, taxProfileComplete: true, consentComplete: true, reviewComplete: true });
    const gate = db.records.get(path + '/stageGateDecisions/gate1');
    expect(gate.passed).toBe(false);
    expect(gate.evidence.checks.identityComplete).toBe(false);
    expect(db.records.get(path).activeStage).toBe(1);
  });
  it('allows the assigned reviewer to inspect durable provenance but denies clients and arbitrary collections', async () => {
    await addEvidence();
    expect(await repo.getArtifact(scope, 'reviewer', 'provenance', 'ev1')).toMatchObject({ evidencePackageId: 'ev1', authorityVerified: false });
    await expect(repo.getArtifact(scope, 'owner', 'provenance', 'ev1')).rejects.toThrow('PROFESSIONAL_REQUIRED');
    await expect(repo.getArtifact(scope, 'reviewer', 'assignments', 'owner')).rejects.toThrow('INVALID_ARTIFACT');
  });
});
