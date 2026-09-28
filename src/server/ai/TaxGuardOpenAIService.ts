import { AIReasoningGateway } from '../../taxguard/intelligence/ai/AIReasoningGateway';
import { DecisionTraceLedger } from '../../taxguard/intelligence/trace/DecisionTraceLedger';
import { HumanReviewBridge } from '../../taxguard/intelligence/review/HumanReviewBridge';
import type { EvidencePackage } from '../../taxguard/intelligence/types';
import type { User } from '../../types';
import { OpenAIReasoningProvider, TaxGuardProviderError } from './OpenAIReasoningProvider';
import { TaxGuardAiAudit } from './TaxGuardAiAudit';
import { TaxGuardAuthorityRepository, AuthorityError, safeId, type CaseScope } from '../taxguard/authority.repository';
import { OPENAI_PURPOSES } from './OpenAIReasoningProvider';

/** Live path: repository authorization precedes transport; all review/trace writes are atomic. */
export async function proposeDurableOpenAIReview(repository: TaxGuardAuthorityRepository, scope: CaseScope, uid: string,
  input: { evidenceId: string; purpose: string; revision: number; operationId: string }, provider = new OpenAIReasoningProvider()) {
  safeId(input.operationId);
  if (input.operationId.length > 110 || !OPENAI_PURPOSES.includes(input.purpose as typeof OPENAI_PURPOSES[number])) throw new AuthorityError('INVALID_AI_REQUEST');
  const loaded = await repository.getEvidence(scope, uid, input.evidenceId);
  const started = await repository.beginAiReview(scope, uid, input.revision, input.operationId, input.evidenceId, input.purpose);
  // Replaying an ambiguous request never incurs another provider call.
  if (started.replayed) throw new AuthorityError('AI_REQUEST_ALREADY_STARTED', 409);
  try {
    const proposal = await AIReasoningGateway.reason(provider, loaded.evidence.evidencePackage, input.purpose);
    const persisted = await repository.recordAiProposal(scope, uid, started.revision, `${input.operationId}_result`, input.evidenceId, proposal, provider.model);
    return { ...persisted, proposal, requiresHumanReview: true, externalSubmissionAllowed: false };
  } catch (error) {
    // If concurrent case changes prevent this write, the durable STARTED record remains unresolved.
    await repository.recordAiFailure(scope, uid, started.revision, `${input.operationId}_failure`).catch(() => {});
    throw error;
  }
}

/** Server orchestration only. The caller must load evidence and assignment from
 * trusted storage; neither actor nor evidence may be taken from an HTTP body.
 * This is deliberately not exposed as an arbitrary browser-supplied package API.
 */
export async function proposeOpenAIReview(input: {
  actor: User;
  evidencePackage: EvidencePackage;
  assignedProfessionalId: string;
  purpose: string;
}, provider = new OpenAIReasoningProvider()) {
  const { actor } = input;
  if (!actor || !['accountant', 'reviewer', 'senior_reviewer'].includes(actor.role) ||
      actor.status !== 'active' || actor.id !== input.assignedProfessionalId) {
    throw new TaxGuardProviderError('TAXGUARD_AI_FORBIDDEN');
  }
  const pkg = structuredClone(input.evidencePackage);
  const audit = { actorId: actor.id, correlationId: pkg.correlationId, provider: 'OPENAI' as const, model: provider.model };
  TaxGuardAiAudit.record({ ...audit, eventType: 'AI_REQUEST_ACCEPTED' });
  try {
    const proposal = await AIReasoningGateway.reason(provider, pkg, input.purpose);
    const review = HumanReviewBridge.submit({
      evidencePackage: { ...pkg, aiProposalIds: [...pkg.aiProposalIds, proposal.proposalId] },
      title: 'OpenAI advisory checklist requires professional review',
      description: 'Counts-only context; no taxpayer facts or tax authority were verified by the provider.',
      itemType: 'INSUFFICIENT_EVIDENCE', severity: 'HIGH', riskLevel: 'material', assignedRole: 'reviewer',
    });
    const trace = DecisionTraceLedger.append({
      clientId: pkg.clientId, engagementId: pkg.engagementId, taxYear: pkg.taxYear,
      stage: 'AI_PROPOSAL', actorId: actor.id, actorRole: actor.role,
      summary: 'OpenAI counts-only advisory proposal; independent professional review required.',
      evidencePackageIds: [pkg.evidencePackageId], aiProposalIds: [proposal.proposalId],
      knowledgeSourceIds: pkg.knowledgeSourceIds, ruleEvaluationIds: pkg.ruleEvaluationIds,
      humanReviewIds: [review.queueItemId], isAiProposedOnly: true, correlationId: pkg.correlationId,
    });
    TaxGuardAiAudit.record({ ...audit, eventType: 'AI_PROPOSAL_CREATED' });
    return { proposal, review, trace, provenance: { provider: 'OPENAI' as const,
      model: provider.model, promptVersion: 'counts-only-v1', evidencePackageId: pkg.evidencePackageId,
      generatedAt: proposal.createdAt, authorityVerified: false, externalSubmissionAllowed: false } };
  } catch (error) {
    TaxGuardAiAudit.record({ ...audit, eventType: 'AI_PROVIDER_FAILURE' });
    // Do not return partial success if review or provenance recording failed.
    if (error instanceof TaxGuardProviderError) throw error;
    throw new TaxGuardProviderError('TAXGUARD_AI_REVIEW_REQUIRED');
  }
}
