import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxAIKnowledgeBoundary
} from '../taxguard/knowledge/TaxAIKnowledgeBoundary';

describe(
  'M6.7 AI Knowledge Boundary',
  () => {

    let boundary:
      TaxAIKnowledgeBoundary;

    beforeEach(() => {
      boundary =
        new TaxAIKnowledgeBoundary();
    });

    function proposal() {
      return boundary
        .registerProposal({
          proposalId:
            'AI-PROP-001',

          kind:
            'fact_extraction',

          proposedValue: {
            wages: 85000
          },

          confidence:
            0.96,

          sourceArtifactIds:
            ['OCR-001'],

          evidenceIds:
            ['EVIDENCE-001'],

          ruleIds:
            ['RULE-001'],

          authoritySourceIds:
            ['AUTH-001']
        });
    }

    it(
      'always marks AI output as proposal only',
      () => {

        const value =
          proposal();

        expect(
          value.isAiProposedOnly
        ).toBe(true);

        expect(
          value.status
        ).toBe(
          'proposed'
        );
      }
    );

    it(
      'does not allow AI proposal to become verified fact',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.canUseAsVerifiedFact
        ).toBe(false);
      }
    );

    it(
      'does not allow AI proposal to become verified rule',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.canUseAsVerifiedRule
        ).toBe(false);
      }
    );

    it(
      'does not allow AI proposal to become verified authority',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.canUseAsVerifiedAuthority
        ).toBe(false);
      }
    );

    it(
      'fails closed when fact is not verified',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              false,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'FACT_NOT_VERIFIED'
        );

        expect(
          result.canUseForMaterialDecision
        ).toBe(false);
      }
    );

    it(
      'fails closed when evidence is not verified',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              false,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'EVIDENCE_NOT_VERIFIED'
        );
      }
    );

    it(
      'fails closed when rule is not verified',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              false,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'RULE_NOT_VERIFIED'
        );
      }
    );

    it(
      'fails closed when authority is not verified',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              false,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'AUTHORITY_NOT_VERIFIED'
        );
      }
    );

    it(
      'blocks unresolved knowledge conflict',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              true,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toContain(
          'BLOCKING_KNOWLEDGE_CONFLICT'
        );

        expect(
          result.canUseForMaterialDecision
        ).toBe(false);
      }
    );

    it(
      'requires professional review when applicable',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              true,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              true
          });

        expect(
          result.requiresHumanReview
        ).toBe(true);

        expect(
          result.blockingReasons
        ).toContain(
          'PROFESSIONAL_REVIEW_REQUIRED'
        );
      }
    );

    it(
      'requires explicit human approval',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              false,

            professionalReviewCompleted:
              false,

            humanApprovalPresent:
              false
          });

        expect(
          result.blockingReasons
        ).toContain(
          'HUMAN_APPROVAL_REQUIRED'
        );
      }
    );

    it(
      'records human approval identity role and rationale',
      () => {

        proposal();

        const approval =
          boundary.approveProposal({
            approvalId:
              'APPROVAL-001',

            proposalId:
              'AI-PROP-001',

            approvedBy:
              'reviewer-001',

            role:
              'Reviewer',

            rationale:
              'Evidence and applicable rule independently reviewed.'
          });

        expect(
          approval.approvedBy
        ).toBe(
          'reviewer-001'
        );

        expect(
          approval.role
        ).toBe(
          'Reviewer'
        );

        expect(
          approval.rationale.length
        ).toBeGreaterThan(0);
      }
    );

    it(
      'human approval does not mutate proposal into verified authority',
      () => {

        proposal();

        boundary.approveProposal({
          approvalId:
            'APPROVAL-001',

          proposalId:
            'AI-PROP-001',

          approvedBy:
            'reviewer',

          role:
            'Reviewer',

          rationale:
            'Reviewed'
        });

        expect(
          boundary
            .getProposal(
              'AI-PROP-001'
            )
            ?.isAiProposedOnly
        ).toBe(true);
      }
    );

    it(
      'allows material decision only after all governance gates are satisfied',
      () => {

        const value =
          proposal();

        const result =
          boundary.evaluate({
            proposal:
              value,

            verifiedFact:
              true,

            verifiedEvidence:
              true,

            verifiedRule:
              true,

            verifiedAuthority:
              true,

            unresolvedBlockingConflict:
              false,

            unresolvedMaterialConflict:
              false,

            professionalReviewRequired:
              true,

            professionalReviewCompleted:
              true,

            humanApprovalPresent:
              true
          });

        expect(
          result.blockingReasons
        ).toHaveLength(0);

        expect(
          result.canUseForMaterialDecision
        ).toBe(true);
      }
    );

    it(
      'rejects invalid confidence',
      () => {

        expect(() =>
          boundary.registerProposal({
            proposalId:
              'BAD-CONFIDENCE',

            kind:
              'explanation',

            proposedValue:
              'test',

            confidence:
              1.5
          })
        ).toThrow(
          'AI_PROPOSAL_CONFIDENCE_INVALID'
        );
      }
    );

    it(
      'returns defensive proposal copies',
      () => {

        const value =
          proposal();

        value.ruleIds.push(
          'TAMPERED'
        );

        expect(
          boundary
            .getProposal(
              'AI-PROP-001'
            )
            ?.ruleIds
        ).not.toContain(
          'TAMPERED'
        );
      }
    );
  }
);
