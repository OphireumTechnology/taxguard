import { describe, expect, it } from 'vitest';
import { inspectOnboarding, inspectIdentity, draftEngagement, draftOrganizerFollowups } from '../server/ai/onboarding/OnboardingAdvisories';

const scope = { tenantId: 'firm', caseId: 'case', clientId: 'client', taxYear: 2025 };
const scenarios = [
  [inspectOnboarding, { contactComplete: false, checklistComplete: true, consentReceiptCurrent: false }, ['COMPLETE_CONTACT_DETAILS', 'REVIEW_CONSENT_RECEIPT']],
  [inspectIdentity, { evidenceStatus: 'VERIFIED', nameConsistent: null, duplicateFlag: true }, ['CHECK_NAME_CONSISTENCY', 'REVIEW_POSSIBLE_DUPLICATE']],
  [draftEngagement, { requestedServices: ['tax', 'tax', 'payroll'], approvedServices: ['tax'], engagementStatus: 'PENDING' },
    { taxYear: 2025, engagementStatus: 'PENDING', proposedServices: ['tax'], unlistedServiceCount: 1, requiresScopeConfirmation: true }],
  [draftOrganizerFollowups, { questions: [
    { applicable: true, questionId: 'income', answerStatus: 'CONFLICTING' },
    { applicable: false, questionId: 'entity', answerStatus: 'MISSING' },
  ] }, [{ questionId: 'income', reason: 'CONFLICTING' }]],
] as const;

describe.each(scenarios)('%o', (run, data, findings) => {
  it('returns the scoped review draft', () => {
    expect(run(scope, { scope, data })).toMatchObject({ findings, human_review_required: true, authoritative_mutation: false });
  });
  it('rejects another case and unexpected raw identity fields', () => {
    expect(() => run(scope, { scope: { ...scope, caseId: 'other' }, data })).toThrow('AI_ONBOARDING_SCOPE_INVALID');
    expect(() => run(scope, { scope, data: { ...data, legalName: 'Synthetic' } })).toThrow();
  });
});
