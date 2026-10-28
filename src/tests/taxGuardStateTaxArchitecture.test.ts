
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardStateJurisdictionRegistry,
  TaxGuardStateRulePackRegistry,
  TaxGuardStateRuleRegistry
} from '../taxguard/state/StateTaxArchitecture';

import {
  TaxGuardFederalDependencyRegistry,
  TaxGuardStateCalculationBoundary,
  TaxGuardStateCalculationDefinitionRegistry,
  TaxGuardStateCalculationEngine,
  TaxGuardStateValidatedFactRegistry
} from '../taxguard/state/StateTaxCalculation';

import {
  TaxGuardStateAiPreparationBoundary,
  TaxGuardStateExternalFilingGuard,
  TaxGuardStateFormMappingEngine,
  TaxGuardStateProfessionalReviewRegistry,
  TaxGuardStateReconciliationGuard,
  TaxGuardStateReturnAssemblyEngine,
  TaxGuardStateWorkflowGate
} from '../taxguard/state/StateTaxPreparation';

function context() {
  return {
    clientId: 'CLIENT-M12-001',
    engagementId: 'ENGAGEMENT-M12-001',
    taxYear: 2025,
    correlationId: 'CORRELATION-M12-001',
    stateCode: 'NJ' as const
  };
}

function createVerifiedFoundation() {
  const jurisdictions =
    new TaxGuardStateJurisdictionRegistry();

  jurisdictions.register({
    jurisdictionId: 'JUR-NJ-2025',
    stateCode: 'NJ',
    name: 'Test State Jurisdiction',
    taxYear: 2025,
    individualIncomeTaxReturnSupported: true,
    supportedReturnTypes: [
      'RESIDENT',
      'PART_YEAR_RESIDENT',
      'NONRESIDENT'
    ]
  });

  const jurisdiction =
    jurisdictions.verify(
      'JUR-NJ-2025',
      {
        verifiedBy: 'REVIEWER-A',
        authorityIds: [
          'AUTH-STATE-001'
        ]
      }
    );

  const rules =
    new TaxGuardStateRuleRegistry();

  rules.registerDraft({
    ruleId: 'STATE-RULE-001',
    stateCode: 'NJ',
    taxYear: 2025,
    name: 'Test verified state rule',
    description:
      'Synthetic test rule only; not a statutory tax rule.',
    risk: 'material',
    authorityIds: [
      'AUTH-STATE-001'
    ],
    evidenceRequirementIds: [
      'EVIDENCE-REQ-001'
    ],
    federalDependencyIds: [
      'FED-DEP-001'
    ],
    requiredFactPaths: [
      'state.test.amount'
    ],
    requiresProfessionalReview: true
  });

  const rule =
    rules.verify(
      'STATE-RULE-001',
      'REVIEWER-B'
    );

  const packs =
    new TaxGuardStateRulePackRegistry(
      jurisdictions,
      rules
    );

  packs.createDraft({
    rulePackId: 'STATE-PACK-001',
    stateCode: 'NJ',
    taxYear: 2025,
    jurisdictionId: 'JUR-NJ-2025',
    ruleIds: [
      'STATE-RULE-001'
    ],
    authorityIds: [
      'AUTH-STATE-001'
    ]
  });

  const rulePack =
    packs.verify(
      'STATE-PACK-001',
      'CPA-A'
    );

  return {
    jurisdictions,
    jurisdiction,
    rules,
    rule,
    packs,
    rulePack
  };
}

function createCalculation() {
  const foundation =
    createVerifiedFoundation();

  const definitions =
    new TaxGuardStateCalculationDefinitionRegistry();

  const definition =
    definitions.registerVerified({
      calculationDefinitionId:
        'STATE-CALC-DEF-001',
      stateCode: 'NJ',
      taxYear: 2025,
      calculationType:
        'SYNTHETIC_STATE_TEST_CALCULATION',
      rulePack:
        foundation.rulePack,
      requiredFactPaths: [
        'state.test.amount'
      ],
      requiredFederalDependencyIds: [
        'FED-DEP-001'
      ],
      requiresProfessionalReview: true,
      verifiedBy: 'CPA-A'
    });

  const federal =
    new TaxGuardFederalDependencyRegistry();

  const federalDependency =
    federal.registerVerified({
      dependencyId: 'FED-DEP-001',
      context: context(),
      federalCalculationId:
        'FED-CALC-001',
      federalFactPath:
        'federal.test.amount',
      value: '100.00',
      evidenceIds: [
        'EVIDENCE-FED-001'
      ],
      provenanceDecisionIds: [
        'PROVENANCE-FED-001'
      ]
    });

  const engine =
    new TaxGuardStateCalculationEngine();

  const calculation =
    engine.calculate({
      calculationId:
        'STATE-CALC-001',
      context: context(),
      definition,
      stateInputs: [
        {
          inputId:
            'STATE-INPUT-001',
          factPath:
            'state.test.amount',
          value:
            '50.00',
          evidenceIds: [
            'EVIDENCE-STATE-001'
          ],
          sourceDocumentIds: [
            'SOURCE-STATE-001'
          ],
          validated:
            true
        }
      ],
      federalDependencies: [
        federalDependency
      ],
      provenanceDecisionIds: [
        'PROVENANCE-STATE-001'
      ]
    });

  return {
    ...foundation,
    definition,
    federalDependency,
    calculation
  };
}

describe(
  'TaxGuard M12 State Tax Architecture',
  () => {

    it(
      'M12.1 registers state jurisdiction as unverified by default',
      () => {
        const jurisdictions =
          new TaxGuardStateJurisdictionRegistry();

        const record =
          jurisdictions.register({
            jurisdictionId:
              'JUR-TEST-001',
            stateCode: 'VA',
            name:
              'Synthetic Test Jurisdiction',
            taxYear: 2025,
            individualIncomeTaxReturnSupported:
              true,
            supportedReturnTypes: [
              'RESIDENT'
            ]
          });

        expect(
          record.verified
        ).toBe(false);
      }
    );

    it(
      'M12.2 requires authority before jurisdiction verification',
      () => {
        const jurisdictions =
          new TaxGuardStateJurisdictionRegistry();

        jurisdictions.register({
          jurisdictionId:
            'JUR-TEST-002',
          stateCode: 'NC',
          name:
            'Synthetic Test Jurisdiction',
          taxYear: 2025,
          individualIncomeTaxReturnSupported:
            true,
          supportedReturnTypes: [
            'RESIDENT'
          ]
        });

        expect(
          () =>
            jurisdictions.verify(
              'JUR-TEST-002',
              {
                verifiedBy:
                  'REVIEWER-A',
                authorityIds: []
              }
            )
        ).toThrow(
          'TG_STATE_JURISDICTION_AUTHORITY_REQUIRED'
        );
      }
    );

    it(
      'M12.3 keeps state rules draft until human verification',
      () => {
        const rules =
          new TaxGuardStateRuleRegistry();

        const rule =
          rules.registerDraft({
            ruleId:
              'RULE-DRAFT-001',
            stateCode: 'NY',
            taxYear: 2025,
            name:
              'Synthetic draft rule',
            description:
              'Test only.',
            risk:
              'routine',
            authorityIds: [
              'AUTH-TEST-001'
            ]
          });

        expect(
          rule.status
        ).toBe('DRAFT');

        expect(
          () =>
            rules.getVerified(
              'RULE-DRAFT-001'
            )
        ).toThrow(
          'TG_STATE_RULE_NOT_VERIFIED'
        );
      }
    );

    it(
      'M12.4 builds verified tax-year-specific rule pack',
      () => {
        const foundation =
          createVerifiedFoundation();

        expect(
          foundation.rulePack.status
        ).toBe('VERIFIED');

        expect(
          foundation.rulePack.taxYear
        ).toBe(2025);

        expect(
          foundation.rulePack.stateCode
        ).toBe('NJ');
      }
    );

    it(
      'M12.5 records evidence-backed validated state fact',
      () => {
        const facts =
          new TaxGuardStateValidatedFactRegistry();

        const fact =
          facts.register({
            factId:
              'FACT-STATE-001',
            context:
              context(),
            factPath:
              'state.test.amount',
            value:
              50,
            evidenceIds: [
              'EVIDENCE-STATE-001'
            ],
            sourceDocumentIds: [
              'SOURCE-STATE-001'
            ],
            validatedBy:
              'REVIEWER-A'
          });

        expect(
          fact.validated
        ).toBe(true);

        expect(
          fact.aiProposedOnly
        ).toBe(false);
      }
    );

    it(
      'M12.6 binds verified federal dependency to state context',
      () => {
        const dependencies =
          new TaxGuardFederalDependencyRegistry();

        const dependency =
          dependencies.registerVerified({
            dependencyId:
              'FED-DEP-TEST',
            context:
              context(),
            federalCalculationId:
              'FED-CALC-TEST',
            federalFactPath:
              'federal.test.amount',
            value:
              '100.00',
            evidenceIds: [
              'EVIDENCE-FED-001'
            ],
            provenanceDecisionIds: [
              'PROVENANCE-FED-001'
            ]
          });

        expect(
          dependency.verified
        ).toBe(true);

        expect(
          dependency.context.stateCode
        ).toBe('NJ');
      }
    );

    it(
      'M12.7 blocks calculation when required state fact is missing',
      () => {
        const foundation =
          createVerifiedFoundation();

        const definitions =
          new TaxGuardStateCalculationDefinitionRegistry();

        const definition =
          definitions.registerVerified({
            calculationDefinitionId:
              'STATE-CALC-MISSING',
            stateCode: 'NJ',
            taxYear: 2025,
            calculationType:
              'SYNTHETIC_TEST',
            rulePack:
              foundation.rulePack,
            requiredFactPaths: [
              'state.required.amount'
            ],
            verifiedBy:
              'CPA-A'
          });

        const engine =
          new TaxGuardStateCalculationEngine();

        expect(
          () =>
            engine.calculate({
              calculationId:
                'CALC-MISSING',
              context:
                context(),
              definition,
              stateInputs: [],
              federalDependencies: [],
              provenanceDecisionIds: [
                'PROVENANCE-001'
              ]
            })
        ).toThrow(
          'TG_STATE_CALC_REQUIRED_FACT_MISSING'
        );
      }
    );

    it(
      'M12.8 performs deterministic non-AI state calculation foundation',
      () => {
        const {
          calculation
        } =
          createCalculation();

        expect(
          calculation.value
        ).toBe('150.00');

        expect(
          calculation.deterministic
        ).toBe(true);

        expect(
          calculation.aiCalculated
        ).toBe(false);
      }
    );

    it(
      'M12.9 maps calculation to evidence-backed state form line',
      () => {
        const {
          calculation
        } =
          createCalculation();

        const mapper =
          new TaxGuardStateFormMappingEngine();

        const binding =
          mapper.map({
            bindingId:
              'BINDING-001',
            formId:
              'STATE-FORM-TEST',
            lineId:
              'LINE-TEST',
            calculation
          });

        expect(
          binding.value
        ).toBe('150.00');

        expect(
          binding.authorityIds
            .length
        ).toBeGreaterThan(0);
      }
    );

    it(
      'M12.10 assembles state return with external filing disabled',
      () => {
        const {
          rulePack,
          calculation
        } =
          createCalculation();

        const mapper =
          new TaxGuardStateFormMappingEngine();

        const binding =
          mapper.map({
            bindingId:
              'BINDING-RETURN',
            formId:
              'STATE-FORM-TEST',
            lineId:
              'LINE-TEST',
            calculation
          });

        const assembler =
          new TaxGuardStateReturnAssemblyEngine();

        const prepared =
          assembler.assemble({
            preparedStateReturnId:
              'STATE-RETURN-001',
            context:
              context(),
            returnType:
              'RESIDENT',
            rulePack,
            calculations: [
              calculation
            ],
            lineBindings: [
              binding
            ],
            provenanceDecisionIds: [
              'PROVENANCE-RETURN-001'
            ]
          });

        expect(
          prepared.externalFilingEnabled
        ).toBe(false);

        expect(
          prepared.aiPrepared
        ).toBe(false);
      }
    );

    it(
      'M12.11 reconciles prepared state return to calculation',
      () => {
        const {
          rulePack,
          calculation
        } =
          createCalculation();

        const mapper =
          new TaxGuardStateFormMappingEngine();

        const binding =
          mapper.map({
            bindingId:
              'BINDING-RECON',
            formId:
              'STATE-FORM-TEST',
            lineId:
              'LINE-TEST',
            calculation
          });

        const assembler =
          new TaxGuardStateReturnAssemblyEngine();

        const prepared =
          assembler.assemble({
            preparedStateReturnId:
              'STATE-RETURN-RECON',
            context:
              context(),
            returnType:
              'RESIDENT',
            rulePack,
            calculations: [
              calculation
            ],
            lineBindings: [
              binding
            ],
            provenanceDecisionIds: [
              'PROVENANCE-RETURN-001'
            ]
          });

        const result =
          TaxGuardStateReconciliationGuard
            .evaluate({
              preparedReturn:
                prepared,
              calculations: [
                calculation
              ]
            });

        expect(
          result.valid
        ).toBe(true);
      }
    );

    it(
      'M12.12 enforces maker-checker state professional review',
      () => {
        const {
          rulePack,
          calculation
        } =
          createCalculation();

        const mapper =
          new TaxGuardStateFormMappingEngine();

        const binding =
          mapper.map({
            bindingId:
              'BINDING-APPROVAL',
            formId:
              'STATE-FORM-TEST',
            lineId:
              'LINE-TEST',
            calculation
          });

        const prepared =
          new TaxGuardStateReturnAssemblyEngine()
            .assemble({
              preparedStateReturnId:
                'STATE-RETURN-APPROVAL',
              context:
                context(),
              returnType:
                'RESIDENT',
              rulePack,
              calculations: [
                calculation
              ],
              lineBindings: [
                binding
              ],
              provenanceDecisionIds: [
                'PROVENANCE-RETURN-001'
              ]
            });

        const approvals =
          new TaxGuardStateProfessionalReviewRegistry();

        expect(
          () =>
            approvals.approve({
              approvalId:
                'STATE-APPROVAL-001',
              context:
                context(),
              preparedStateReturn:
                prepared,
              returnVersionId:
                'STATE-VERSION-001',
              requestedBy:
                'CPA-A',
              approvedBy:
                'CPA-A',
              approvedByRole:
                'CPA',
              provenanceDecisionId:
                'PROVENANCE-APPROVAL-001'
            })
        ).toThrow(
          'TG_STATE_APPROVAL_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M12.13 blocks state workflow with unresolved exception',
      () => {
        expect(
          () =>
            TaxGuardStateWorkflowGate
              .assertReady({
                jurisdictionVerified:
                  true,
                rulePackVerified:
                  true,
                reconciliationValid:
                  true,
                unresolvedExceptionIds: [
                  'STATE-EXCEPTION-001'
                ],
                provenanceApproved:
                  true,
                professionalApprovalPresent:
                  true
              })
        ).toThrow(
          'TG_STATE_WORKFLOW_GATE_BLOCKED'
        );
      }
    );

    it(
      'M12.14 permits state workflow when governance gates pass',
      () => {
        expect(
          TaxGuardStateWorkflowGate
            .assertReady({
              jurisdictionVerified:
                true,
              rulePackVerified:
                true,
              reconciliationValid:
                true,
              unresolvedExceptionIds: [],
              provenanceApproved:
                true,
              professionalApprovalPresent:
                true
            })
        ).toBe(true);
      }
    );

    it(
      'M12.15 blocks AI final state calculation and approval',
      () => {
        expect(
          () =>
            TaxGuardStateCalculationBoundary
              .aiCalculateFinalLiability()
        ).toThrow(
          'TG_STATE_AI_FINAL_CALCULATION_BLOCKED'
        );

        expect(
          () =>
            TaxGuardStateAiPreparationBoundary
              .approveMaterialDecision()
        ).toThrow(
          'TG_STATE_AI_FINAL_APPROVAL_BLOCKED'
        );
      }
    );

    it(
      'M12.16 keeps external state filing disabled',
      () => {
        expect(
          () =>
            TaxGuardStateExternalFilingGuard
              .submit()
        ).toThrow(
          'TG_STATE_EXTERNAL_FILING_DISABLED'
        );
      }
    );
  }
);
