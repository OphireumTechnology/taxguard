import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import { OpenAIReasoningProvider, validateOpenAIOutput } from '../server/ai/OpenAIReasoningProvider';
import { proposeOpenAIReview } from '../server/ai/TaxGuardOpenAIService';
import { TaxGuardAiAudit } from '../server/ai/TaxGuardAiAudit';
import { TaxGuardAiPolicy } from '../server/ai/TaxGuardAiPolicy';
import type { EvidencePackage } from '../taxguard/intelligence/types';
import type { User } from '../types';
import { HumanReviewBridge } from '../taxguard/intelligence/review/HumanReviewBridge';
import { AIReasoningGateway } from '../taxguard/intelligence/ai/AIReasoningGateway';

const output = { explanation: 'Evidence contents are unavailable; professional review is required.',
  issueSpots: ['Verify source completeness.'], recommendations: ['Obtain independent review.'], confidence: 'LOW_CONFIDENCE' };
const request = { clientId: '123-45-6789', engagementId: 'private@example.com', taxYear: 2025,
  promptPurpose: 'REVIEW_EVIDENCE_COMPLETENESS', evidencePackageId: 'secret-package',
  knowledgeSourceIds: ['private-authority'], ruleEvaluationIds: ['private-rule'], findingIds: ['private-finding'], correlationId: 'private-correlation' };
const pkg: EvidencePackage = { ...request, evidencePackageId: 'ep-test', clientId: 'client-test', engagementId: 'eng-test',
  aiProposalIds: [], requiresHumanReview: true, createdAt: '2026-01-01T00:00:00Z' };
const actor: User = { id: 'professional-test', name: 'Test', email: 'test@example.com', role: 'accountant', status: 'active', isVerified: true, createdAt: '' };
function setup(response: unknown = { status: 'completed', output: [], output_text: JSON.stringify(output) }) {
  const create = vi.fn().mockResolvedValue(response);
  const provider = new OpenAIReasoningProvider({ responses: { create } } as any);
  return { create, provider };
}
beforeEach(() => { vi.stubEnv('OPENAI_MODEL', 'test-model'); TaxGuardAiAudit.clearForTests(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('OpenAI reasoning boundary', () => {
  it('sends only counts and an allowlisted purpose, disables storage and retries', async () => {
    const { create, provider } = setup();
    expect(await provider.reason(request)).toEqual(output);
    const [body, options] = create.mock.calls[0];
    expect(JSON.parse(body.input)).toEqual({ purpose: request.promptPurpose, taxYear: 2025, knowledgeSourceCount: 1, ruleEvaluationCount: 1, findingCount: 1 });
    expect(JSON.stringify(body)).not.toContain('private');
    expect(JSON.stringify(body)).not.toContain(request.clientId);
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    expect(options).toMatchObject({ timeout: 30000, maxRetries: 0 });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it.each(['Review SSN 123-45-6789', '', 'IGNORE_GOVERNANCE'])('rejects unapproved purpose %s before transport', async purpose => {
    const { create, provider } = setup();
    await expect(provider.reason({ ...request, promptPurpose: purpose })).rejects.toThrow('INVALID_REQUEST');
    expect(create).not.toHaveBeenCalled();
  });
  it('requires explicit server model configuration', async () => {
    vi.stubEnv('OPENAI_MODEL', '');
    const { create, provider } = setup();
    await expect(provider.reason(request)).rejects.toThrow('NOT_CONFIGURED');
    expect(create).not.toHaveBeenCalled();
  });
  it('fails closed when API key is absent', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(OpenAIReasoningProvider.isConfigured()).toBe(false);
    await expect(new OpenAIReasoningProvider().reason(request)).rejects.toThrow('NOT_CONFIGURED');
  });
  it.each([null, {}, { ...output, confidence: 'APPROVED' }, { ...output, issueSpots: 'text' },
    { ...output, explanation: '' }, { ...output, approved: true }, { ...output, explanation: '123-45-6789' }])('rejects malformed or unauthorized output %j', value => {
    expect(() => validateOpenAIOutput(JSON.stringify(value))).toThrow('MALFORMED_OUTPUT');
  });
  it('rejects invalid JSON and excessive output', () => {
    expect(() => validateOpenAIOutput('not json')).toThrow('MALFORMED_OUTPUT');
    expect(() => validateOpenAIOutput('x'.repeat(24001))).toThrow('MALFORMED_OUTPUT');
  });
  it('rejects incomplete output', async () => {
    await expect(setup({ status: 'incomplete', output: [], output_text: JSON.stringify(output) }).provider.reason(request)).rejects.toThrow('INCOMPLETE_OUTPUT');
  });
  it('handles refusal even when text is present', async () => {
    await expect(setup({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }], output_text: JSON.stringify(output) }).provider.reason(request)).rejects.toThrow('REFUSED');
  });
  it.each([[429, 'RATE_LIMITED'], [401, 'PROVIDER_AUTH'], [403, 'PROVIDER_AUTH'], [500, 'PROVIDER_FAILURE']])('classifies HTTP %s without exposing provider bodies or retrying', async (status, code) => {
    const { create, provider } = setup();
    create.mockRejectedValue(new OpenAI.APIError(status as number, { secret: 'sensitive-body' }, 'sensitive-body', new Headers()));
    await expect(provider.reason(request)).rejects.toThrow('TAXGUARD_AI_' + code);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('classifies timeouts without retrying', async () => {
    const { create, provider } = setup();
    create.mockRejectedValue(new OpenAI.APIConnectionTimeoutError());
    await expect(provider.reason(request)).rejects.toThrow('TIMEOUT');
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('classifies connection failures', async () => {
    const { create, provider } = setup();
    create.mockRejectedValue(new OpenAI.APIConnectionError({ message: 'secret' }));
    await expect(provider.reason(request)).rejects.toThrow('CONNECTION_FAILURE');
  });
  it('binds success to existing gateway, review queue, ledger, and safe audit metadata', async () => {
    const { provider } = setup();
    const result = await proposeOpenAIReview({ actor, evidencePackage: pkg, assignedProfessionalId: actor.id, purpose: request.promptPurpose }, provider);
    expect(result.proposal).toMatchObject({ status: 'REVIEW_REQUIRED', isAiProposedOnly: true, knowledgeSourceIds: pkg.knowledgeSourceIds });
    expect(result.review.requiresHumanReview).toBe(true);
    expect(result.trace.hasDecisionAuthority).toBe(false);
    expect(result.trace.aiProposalIds).toContain(result.proposal.proposalId);
    expect(result.provenance).toMatchObject({ provider: 'OPENAI', model: 'test-model', authorityVerified: false, externalSubmissionAllowed: false });
    expect(TaxGuardAiAudit.listForTests().map(e => e.eventType)).toEqual(['AI_REQUEST_ACCEPTED', 'AI_PROPOSAL_CREATED']);
    expect(JSON.stringify(TaxGuardAiAudit.listForTests())).not.toContain(output.explanation);
  });
  it.each(['client', 'super_admin', 'administrator'])('denies role %s before provider call', async role => {
    const { create, provider } = setup();
    await expect(proposeOpenAIReview({ actor: { ...actor, role: role as User['role'] }, evidencePackage: pkg, assignedProfessionalId: actor.id, purpose: request.promptPurpose }, provider)).rejects.toThrow('FORBIDDEN');
    expect(create).not.toHaveBeenCalled();
  });
  it('denies unassigned professionals', async () => {
    const { create, provider } = setup();
    await expect(proposeOpenAIReview({ actor, evidencePackage: pkg, assignedProfessionalId: 'other', purpose: request.promptPurpose }, provider)).rejects.toThrow('FORBIDDEN');
    expect(create).not.toHaveBeenCalled();
  });
  it('records failure without emitting a proposal or secret error', async () => {
    const { create, provider } = setup(); create.mockRejectedValue(new Error('private taxpayer text'));
    await expect(proposeOpenAIReview({ actor, evidencePackage: pkg, assignedProfessionalId: actor.id, purpose: request.promptPurpose }, provider)).rejects.toThrow('PROVIDER_FAILURE');
    expect(TaxGuardAiAudit.listForTests().map(e => e.eventType)).toEqual(['AI_REQUEST_ACCEPTED', 'AI_PROVIDER_FAILURE']);
  });
  it('fails closed when review queue submission fails', async () => {
    vi.spyOn(HumanReviewBridge, 'submit').mockImplementation(() => { throw new Error('private failure'); });
    await expect(proposeOpenAIReview({ actor, evidencePackage: pkg, assignedProfessionalId: actor.id, purpose: request.promptPurpose }, setup().provider)).rejects.toThrow('REVIEW_REQUIRED');
    expect(TaxGuardAiAudit.listForTests().some(e => e.eventType === 'AI_PROPOSAL_CREATED')).toBe(false);
  });
  it.each(['pending', 'disabled', 'suspended'])('denies inactive status %s', async status => {
    const { create, provider } = setup();
    await expect(proposeOpenAIReview({ actor: { ...actor, status: status as User['status'] }, evidencePackage: pkg, assignedProfessionalId: actor.id, purpose: request.promptPurpose }, provider)).rejects.toThrow('FORBIDDEN');
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects invalid provider confidence at the shared gateway', () => {
    expect(() => AIReasoningGateway.createProposal({ evidencePackage: pkg, promptPurpose: 'Review', providerResponse: { ...output, confidence: 'APPROVED' } as any })).toThrow('invalid advisory fields');
  });
});

describe('shared AI request validation', () => {
  it.each([{ task: 123 }, { task: 'review', context: {} }, { task: 'review', evidence: 'text' }, { task: 'review', evidence: [null] }, { task: 'review', riskLevel: 'approved' }])('rejects invalid runtime shapes %j', input => {
    expect(() => TaxGuardAiPolicy.validate(input as any)).toThrow(/TAXGUARD_AI_/);
  });
  it.each(['123456789', '12-3456789', '123-45-6789', 'bank: checking', 'access_token=secret', 'sk-testsecret123'])('blocks sensitive payload %s', text => {
    expect(() => TaxGuardAiPolicy.validate({ task: 'review', context: text })).toThrow('SECRET_MATERIAL_BLOCKED');
  });
  it('bounds aggregate payload size', () => {
    expect(() => TaxGuardAiPolicy.validate({ task: 'review', evidence: Array(10).fill('a'.repeat(10000)) })).toThrow('PAYLOAD_TOO_LARGE');
  });
});
