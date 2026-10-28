import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxAuthoritySourceRegistry
} from '../taxguard/knowledge/TaxAuthoritySourceRegistry';

import {
  TaxRuleRegistry
} from '../taxguard/knowledge/TaxRuleRegistry';

import {
  TaxRuleApplicabilityEngine
} from '../taxguard/knowledge/TaxRuleApplicabilityEngine';

import {
  TaxEvidenceCitationBindingService
} from '../taxguard/knowledge/TaxEvidenceCitationBinding';

describe(
  'M6.5 Evidence + Citation Binding',
  () => {

    let authorities:
      TaxAuthoritySourceRegistry;

    let rules:
      TaxRuleRegistry;

    let applicability:
      TaxRuleApplicabilityEngine;

    let binding:
      TaxEvidenceCitationBindingService;

    beforeEach(() => {
      authorities =
        new TaxAuthoritySourceRegistry();

      rules =
        new TaxRuleRegistry(
          authorities
        );

      applicability =
        new TaxRuleApplicabilityEngine(
          rules
        );

      binding =
        new TaxEvidenceCitationBindingService(
          authorities,
          rules
        );
    });

    function installVerifiedFoundation() {

      authorities.register({
        sourceId:
          'IRS-M65-2025',

        jurisdictionLevel:
          'federal',

        jurisdictionCode:
          'US',

        authorityType:
          'official_guidance',

        title:
          'M6.5 Test Authority',

        issuingAuthority:
          'Internal Revenue Service',

        taxYears:
          [2025],

        sourceUrl:
          'https://www.irs.gov/',

        citation: {
          title:
            'M6.5 Test Authority'
        }
      });

      authorities.verify(
        'IRS-M65-2025',
        {
          reviewedBy:
            'authorized-authority-reviewer'
        }
      );

      rules.register({
        ruleId:
          'TG-M65-RULE',

        name:
          'M6.5 Test Rule',

        description:
          'Evidence and citation binding test rule.',

        jurisdictionLevel:
          'federal',

        jurisdictionCode:
          'US',

        taxYears:
          [2025],

        executionClass:
          'informational',

        authoritySourceIds:
          ['IRS-M65-2025'],

        citations: [
          {
            sourceId:
              'IRS-M65-2025',

            section:
              'Test Section',

            locator:
              'Test Locator'
          }
        ],

        requiredFacts:
          [
            'taxpayer.filingStatus'
          ],

        applicabilityConditions:
          [
            {
              factPath:
                'taxpayer.filingStatus',

              operator:
                'equals',

              value:
                'single'
            }
          ]
      });

      rules.verify(
        'TG-M65-RULE',
        {
          reviewedBy:
            'authorized-rule-reviewer'
        }
      );
    }

    function validatedEvidence() {

      return binding.registerEvidence({
        evidenceId:
          'EVIDENCE-001',

        origin:
          'uploaded_document',

        documentId:
          'DOC-001',

        documentHash:
          'a'.repeat(64),

        artifactId:
          'OCR-001',

        factPath:
          'taxpayer.filingStatus',

        factValue:
          'single',

        locator: {
          pageNumber: 1,
          fieldName:
            'filingStatus'
        },

        validationState:
          'validated',

        validatedBy:
          'authorized-reviewer',

        validatedAt:
          '2026-09-23T00:00:00.000Z'
      });
    }

    it(
      'requires SHA-256 hash for uploaded evidence',
      () => {

        expect(() =>
          binding.registerEvidence({
            evidenceId:
              'BAD-EVIDENCE',

            origin:
              'uploaded_document',

            documentId:
              'DOC-BAD',

            documentHash:
              'not-a-hash',

            validationState:
              'pending'
          })
        ).toThrow(
          'VALID_SHA256_DOCUMENT_HASH_REQUIRED'
        );
      }
    );

    it(
      'requires validator for directly validated evidence',
      () => {

        expect(() =>
          binding.registerEvidence({
            evidenceId:
              'EVIDENCE-VALIDATOR',

            origin:
              'validated_taxpayer_fact',

            factPath:
              'taxpayer.filingStatus',

            validationState:
              'validated',

            validatedAt:
              '2026-09-23T00:00:00.000Z'
          })
        ).toThrow(
          'EVIDENCE_VALIDATOR_REQUIRED'
        );
      }
    );

    it(
      'preserves document provenance',
      () => {

        const evidence =
          validatedEvidence();

        expect(
          evidence.documentId
        ).toBe('DOC-001');

        expect(
          evidence.documentHash
        ).toHaveLength(64);

        expect(
          evidence.artifactId
        ).toBe('OCR-001');

        expect(
          evidence.locator?.pageNumber
        ).toBe(1);
      }
    );

    it(
      'does not bind evidence to an unverified rule',
      () => {

        authorities.register({
          sourceId:
            'IRS-M65-DRAFT',

          jurisdictionLevel:
            'federal',

          jurisdictionCode:
            'US',

          authorityType:
            'official_guidance',

          title:
            'Draft Authority',

          issuingAuthority:
            'Internal Revenue Service',

          taxYears:
            [2025],

          sourceUrl:
            'https://www.irs.gov/',

          citation: {
            title:
              'Draft Authority'
          }
        });

        rules.register({
          ruleId:
            'TG-M65-DRAFT-RULE',

          name:
            'Draft Rule',

          description:
            'Draft test rule.',

          jurisdictionLevel:
            'federal',

          jurisdictionCode:
            'US',

          taxYears:
            [2025],

          executionClass:
            'informational',

          authoritySourceIds:
            ['IRS-M65-DRAFT']
        });

        validatedEvidence();

        expect(() =>
          binding.bindRuleEvidence({
            bindingId:
              'BIND-DRAFT',

            ruleId:
              'TG-M65-DRAFT-RULE',

            taxYear:
              2025,

            jurisdictionCode:
              'US',

            evidenceIds:
              ['EVIDENCE-001'],

            createdBy:
              'authorized-reviewer'
          })
        ).toThrow(
          'BINDING_RULE_NOT_USABLE'
        );
      }
    );

    it(
      'does not bind pending evidence',
      () => {

        installVerifiedFoundation();

        binding.registerEvidence({
          evidenceId:
            'EVIDENCE-PENDING',

          origin:
            'validated_taxpayer_fact',

          factPath:
            'taxpayer.filingStatus',

          factValue:
            'single',

          validationState:
            'pending'
        });

        expect(() =>
          binding.bindRuleEvidence({
            bindingId:
              'BIND-PENDING',

            ruleId:
              'TG-M65-RULE',

            taxYear:
              2025,

            jurisdictionCode:
              'US',

            evidenceIds:
              ['EVIDENCE-PENDING'],

            createdBy:
              'authorized-reviewer'
          })
        ).toThrow(
          'BINDING_EVIDENCE_NOT_VALIDATED'
        );
      }
    );

    it(
      'binds validated evidence to verified rule',
      () => {

        installVerifiedFoundation();
        validatedEvidence();

        const result =
          binding.bindRuleEvidence({
            bindingId:
              'BIND-001',

            ruleId:
              'TG-M65-RULE',

            taxYear:
              2025,

            jurisdictionCode:
              'US',

            evidenceIds:
              ['EVIDENCE-001'],

            createdBy:
              'authorized-reviewer'
          });

        expect(
          result.evidenceIds
        ).toContain(
          'EVIDENCE-001'
        );

        expect(
          result.citations
        ).toHaveLength(1);
      }
    );

    it(
      'builds citation from verified authority',
      () => {

        installVerifiedFoundation();

        const citations =
          binding.buildAuthorityCitations(
            'TG-M65-RULE',
            2025
          );

        expect(citations)
          .toHaveLength(1);

        expect(
          citations[0].sourceId
        ).toBe(
          'IRS-M65-2025'
        );

        expect(
          citations[0].section
        ).toBe(
          'Test Section'
        );
      }
    );

    it(
      'blocks jurisdiction mismatch',
      () => {

        installVerifiedFoundation();
        validatedEvidence();

        expect(() =>
          binding.bindRuleEvidence({
            bindingId:
              'BIND-SC',

            ruleId:
              'TG-M65-RULE',

            taxYear:
              2025,

            jurisdictionCode:
              'SC',

            evidenceIds:
              ['EVIDENCE-001'],

            createdBy:
              'authorized-reviewer'
          })
        ).toThrow(
          'BINDING_JURISDICTION_MISMATCH'
        );
      }
    );

    it(
      'creates a complete decision evidence package',
      () => {

        installVerifiedFoundation();
        validatedEvidence();

        binding.bindRuleEvidence({
          bindingId:
            'BIND-001',

          ruleId:
            'TG-M65-RULE',

          taxYear:
            2025,

          jurisdictionCode:
            'US',

          evidenceIds:
            ['EVIDENCE-001'],

          createdBy:
            'authorized-reviewer'
        });

        const result =
          applicability.evaluateRule(
            'TG-M65-RULE',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          );

        const evidencePackage =
          binding.buildDecisionEvidencePackage({
            packageId:
              'PACKAGE-001',

            applicability:
              result,

            bindingId:
              'BIND-001'
          });

        expect(
          evidencePackage
            .readyForDecisionUse
        ).toBe(true);

        expect(
          evidencePackage
            .integrity
            .evidenceComplete
        ).toBe(true);

        expect(
          evidencePackage
            .integrity
            .citationComplete
        ).toBe(true);

        expect(
          evidencePackage
            .integrity
            .authorityVerified
        ).toBe(true);

        expect(
          evidencePackage
            .integrity
            .ruleVerified
        ).toBe(true);
      }
    );

    it(
      'does not mark a non-applicable decision ready',
      () => {

        installVerifiedFoundation();
        validatedEvidence();

        binding.bindRuleEvidence({
          bindingId:
            'BIND-001',

          ruleId:
            'TG-M65-RULE',

          taxYear:
            2025,

          jurisdictionCode:
            'US',

          evidenceIds:
            ['EVIDENCE-001'],

          createdBy:
            'authorized-reviewer'
        });

        const result =
          applicability.evaluateRule(
            'TG-M65-RULE',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'married'
              }
            }
          );

        const evidencePackage =
          binding.buildDecisionEvidencePackage({
            packageId:
              'PACKAGE-NOT-APPLICABLE',

            applicability:
              result,

            bindingId:
              'BIND-001'
          });

        expect(
          evidencePackage
            .readyForDecisionUse
        ).toBe(false);

        expect(
          evidencePackage.reasonCodes
        ).toContain(
          'RULE_NOT_APPLICABLE'
        );
      }
    );

    it(
      'prevents rejected evidence from later validation',
      () => {

        binding.registerEvidence({
          evidenceId:
            'EVIDENCE-REJECTED',

          origin:
            'validated_taxpayer_fact',

          factPath:
            'taxpayer.filingStatus',

          factValue:
            'single',

          validationState:
            'pending'
        });

        binding.rejectEvidence(
          'EVIDENCE-REJECTED'
        );

        expect(() =>
          binding.validateEvidence(
            'EVIDENCE-REJECTED',
            'reviewer'
          )
        ).toThrow(
          'EVIDENCE_NOT_ELIGIBLE_FOR_VALIDATION'
        );
      }
    );

    it(
      'prevents quarantined evidence from later validation',
      () => {

        binding.registerEvidence({
          evidenceId:
            'EVIDENCE-QUARANTINED',

          origin:
            'validated_taxpayer_fact',

          factPath:
            'taxpayer.filingStatus',

          factValue:
            'single',

          validationState:
            'pending'
        });

        binding.quarantineEvidence(
          'EVIDENCE-QUARANTINED'
        );

        expect(() =>
          binding.validateEvidence(
            'EVIDENCE-QUARANTINED',
            'reviewer'
          )
        ).toThrow(
          'EVIDENCE_NOT_ELIGIBLE_FOR_VALIDATION'
        );
      }
    );

    it(
      'returns defensive evidence copies',
      () => {

        validatedEvidence();

        const first =
          binding.getEvidence(
            'EVIDENCE-001'
          );

        expect(first)
          .not.toBeNull();

        if (!first) {
          return;
        }

        first.documentId =
          'TAMPERED';

        const second =
          binding.getEvidence(
            'EVIDENCE-001'
          );

        expect(
          second?.documentId
        ).toBe(
          'DOC-001'
        );
      }
    );
  }
);
