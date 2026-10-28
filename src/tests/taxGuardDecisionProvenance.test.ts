
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardDecisionProvenanceRegistry
} from '../taxguard/provenance/TaxGuardDecisionProvenance';

import {
  TaxGuardProfessionalDecisionEngine,
  TaxGuardProvenanceIntegrityGuard
} from '../taxguard/provenance/TaxGuardDecisionIntegrity';

import {
  TaxGuardCompleteProvenanceChainValidator,
  TaxGuardDecisionWorkflowGate,
  TaxGuardProvenanceGraph
} from '../taxguard/provenance/TaxGuardProvenanceChain';

function context() {
  return {
    clientId:
      'CLIENT-M10-001',

    engagementId:
      'ENGAGEMENT-M10-001',

    taxYear:
      2025,

    correlationId:
      'CORRELATION-M10-001'
  };
}

function buildVerifiedChain(
  registry:
    TaxGuardDecisionProvenanceRegistry
) {

  const ctx =
    context();

  registry.registerNode({
    nodeId:
      'DOC-1',

    nodeType:
      'SOURCE_DOCUMENT',

    context:
      ctx,

    description:
      'Verified source tax document.',

    verified:
      true,

    verifiedBy:
      'REVIEWER-A'
  });

  registry.registerNode({
    nodeId:
      'EVIDENCE-1',

    nodeType:
      'EVIDENCE',

    context:
      ctx,

    sourceIds: [
      'DOC-1'
    ],

    hash:
      'sha256-test-evidence',

    description:
      'Evidence extracted from verified source document.',

    verified:
      true,

    verifiedBy:
      'REVIEWER-A'
  });

  registry.registerNode({
    nodeId:
      'FACT-1',

    nodeType:
      'VALIDATED_FACT',

    context:
      ctx,

    sourceIds: [
      'EVIDENCE-1'
    ],

    description:
      'Validated taxpayer fact.',

    verified:
      true,

    verifiedBy:
      'REVIEWER-A'
  });

  registry.registerNode({
    nodeId:
      'AUTHORITY-1',

    nodeType:
      'AUTHORITY',

    context:
      ctx,

    description:
      'Verified tax authority.',

    verified:
      true,

    verifiedBy:
      'REVIEWER-A'
  });

  registry.registerNode({
    nodeId:
      'RULE-1',

    nodeType:
      'RULE',

    context:
      ctx,

    sourceIds: [
      'AUTHORITY-1'
    ],

    description:
      'Verified tax rule bound to authority.',

    verified:
      true,

    verifiedBy:
      'REVIEWER-A'
  });

  registry.registerNode({
    nodeId:
      'CALC-1',

    nodeType:
      'CALCULATION',

    context:
      ctx,

    sourceIds: [
      'FACT-1',
      'RULE-1',
      'AUTHORITY-1'
    ],

    description:
      'Deterministic tax calculation.',

    verified:
      true,

    verifiedBy:
      'REVIEWER-A'
  });

  registry.registerNode({
    nodeId:
      'RETURN-1',

    nodeType:
      'PREPARED_RETURN',

    context:
      ctx,

    sourceIds: [
      'CALC-1'
    ],

    description:
      'Prepared federal return.',

    verified:
      true,

    verifiedBy:
      'REVIEWER-A'
  });

  registry.registerNode({
    nodeId:
      'LINE-15',

    nodeType:
      'FORM_LINE',

    context:
      ctx,

    sourceIds: [
      'CALC-1',
      'RETURN-1'
    ],

    description:
      'Prepared Form 1040 line.',

    verified:
      true,

    verifiedBy:
      'REVIEWER-A'
  });

  return ctx;
}

describe(
  'TaxGuard M10 Evidence and Decision Provenance',
  () => {

    it(
      'M10.1 registers immutable provenance nodes',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        registry.registerNode({
          nodeId:
            'DOC-IMMUTABLE',

          nodeType:
            'SOURCE_DOCUMENT',

          context:
            context(),

          description:
            'Immutable source document.',

          verified:
            true,

          verifiedBy:
            'REVIEWER-A'
        });

        const node =
          registry.getNode(
            'DOC-IMMUTABLE'
          );

        expect(
          node.immutable
        ).toBe(true);

        expect(
          node.verified
        ).toBe(true);
      }
    );

    it(
      'M10.2 rejects duplicate provenance node IDs',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        registry.registerNode({
          nodeId:
            'DOC-DUP',

          nodeType:
            'SOURCE_DOCUMENT',

          context:
            context(),

          description:
            'Source document.',

          verified:
            true,

          verifiedBy:
            'REVIEWER-A'
        });

        expect(
          () =>
            registry.registerNode({
              nodeId:
                'DOC-DUP',

              nodeType:
                'SOURCE_DOCUMENT',

              context:
                context(),

              description:
                'Duplicate source document.',

              verified:
                true,

              verifiedBy:
                'REVIEWER-B'
            })
        ).toThrow(
          'TG_PROVENANCE_DUPLICATE_NODE'
        );
      }
    );

    it(
      'M10.3 blocks missing upstream source registration',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        expect(
          () =>
            registry.registerNode({
              nodeId:
                'EVIDENCE-BROKEN',

              nodeType:
                'EVIDENCE',

              context:
                context(),

              sourceIds: [
                'DOC-NOT-FOUND'
              ],

              description:
                'Broken evidence.',

              verified:
                true,

              verifiedBy:
                'REVIEWER-A'
            })
        ).toThrow(
          'TG_PROVENANCE_SOURCE_NOT_FOUND'
        );
      }
    );

    it(
      'M10.4 validates a complete verified provenance chain',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        const ctx =
          buildVerifiedChain(
            registry
          );

        expect(
          TaxGuardProvenanceIntegrityGuard
            .assertValid(
              registry,
              ctx,
              [
                'DOC-1',
                'EVIDENCE-1',
                'FACT-1',
                'AUTHORITY-1',
                'RULE-1',
                'CALC-1',
                'RETURN-1',
                'LINE-15'
              ]
            )
        ).toBe(true);
      }
    );

    it(
      'M10.5 blocks unverified evidence from professional decision',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        const ctx =
          context();

        registry.registerNode({
          nodeId:
            'DOC-U',

          nodeType:
            'SOURCE_DOCUMENT',

          context:
            ctx,

          description:
            'Verified document.',

          verified:
            true,

          verifiedBy:
            'REVIEWER-A'
        });

        registry.registerNode({
          nodeId:
            'EVIDENCE-U',

          nodeType:
            'EVIDENCE',

          context:
            ctx,

          sourceIds: [
            'DOC-U'
          ],

          description:
            'Unverified evidence.',

          verified:
            false
        });

        const result =
          TaxGuardProvenanceIntegrityGuard
            .inspect(
              registry,
              ctx,
              [
                'DOC-U',
                'EVIDENCE-U'
              ]
            );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.unverifiedNodeIds
        ).toContain(
          'EVIDENCE-U'
        );
      }
    );

    it(
      'M10.6 enforces maker-checker for material decision',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        const ctx =
          buildVerifiedChain(
            registry
          );

        const engine =
          new TaxGuardProfessionalDecisionEngine(
            registry
          );

        expect(
          () =>
            engine.record({
              decisionId:
                'DECISION-MAKER',

              decisionType:
                'RETURN_APPROVED',

              status:
                'APPROVED',

              risk:
                'material',

              context:
                ctx,

              subjectNodeIds: [
                'RETURN-1'
              ],

              evidenceNodeIds: [
                'EVIDENCE-1'
              ],

              ruleNodeIds: [
                'RULE-1'
              ],

              authorityNodeIds: [
                'AUTHORITY-1'
              ],

              calculationNodeIds: [
                'CALC-1'
              ],

              returnNodeIds: [
                'RETURN-1',
                'LINE-15'
              ],

              requestedBy:
                'REVIEWER-A',

              decidedBy:
                'REVIEWER-A',

              decidedByRole:
                'REVIEWER',

              reason:
                'Attempted self approval.'
            })
        ).toThrow(
          'TG_DECISION_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M10.7 records independent non-AI professional decision',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        const ctx =
          buildVerifiedChain(
            registry
          );

        const engine =
          new TaxGuardProfessionalDecisionEngine(
            registry
          );

        const decision =
          engine.record({
            decisionId:
              'DECISION-APPROVED',

            decisionType:
              'RETURN_APPROVED',

            status:
              'APPROVED',

            risk:
              'material',

            context:
              ctx,

            subjectNodeIds: [
              'RETURN-1'
            ],

            evidenceNodeIds: [
              'EVIDENCE-1'
            ],

            ruleNodeIds: [
              'RULE-1'
            ],

            authorityNodeIds: [
              'AUTHORITY-1'
            ],

            calculationNodeIds: [
              'CALC-1'
            ],

            returnNodeIds: [
              'RETURN-1',
              'LINE-15'
            ],

            requestedBy:
              'PREPARER-A',

            decidedBy:
              'REVIEWER-B',

            decidedByRole:
              'REVIEWER',

            reason:
              'Independent evidence-backed professional review.'
          });

        expect(
          decision.status
        ).toBe(
          'APPROVED'
        );

        expect(
          decision.aiDecision
        ).toBe(false);

        expect(
          decision.immutable
        ).toBe(true);
      }
    );

    it(
      'M10.8 creates immutable decision trace',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        const ctx =
          buildVerifiedChain(
            registry
          );

        const engine =
          new TaxGuardProfessionalDecisionEngine(
            registry
          );

        engine.record({
          decisionId:
            'DECISION-TRACE',

          decisionType:
            'RETURN_APPROVED',

          status:
            'APPROVED',

          risk:
            'material',

          context:
            ctx,

          subjectNodeIds: [
            'RETURN-1'
          ],

          evidenceNodeIds: [
            'EVIDENCE-1'
          ],

          ruleNodeIds: [
            'RULE-1'
          ],

          authorityNodeIds: [
            'AUTHORITY-1'
          ],

          calculationNodeIds: [
            'CALC-1'
          ],

          returnNodeIds: [
            'RETURN-1'
          ],

          requestedBy:
            'PREPARER-A',

          decidedBy:
            'CPA-B',

          decidedByRole:
            'CPA',

          reason:
            'CPA review.'
        });

        const trace =
          registry.traceHistory(
            'DECISION-TRACE'
          );

        expect(
          trace.length
        ).toBeGreaterThan(0);

        expect(
          trace.every(
            entry =>
              entry.immutable ===
              true
          )
        ).toBe(true);
      }
    );

    it(
      'M10.9 validates complete decision chain',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        const ctx =
          buildVerifiedChain(
            registry
          );

        const engine =
          new TaxGuardProfessionalDecisionEngine(
            registry
          );

        const decision =
          engine.record({
            decisionId:
              'DECISION-CHAIN',

            decisionType:
              'RETURN_APPROVED',

            status:
              'APPROVED',

            risk:
              'material',

            context:
              ctx,

            subjectNodeIds: [
              'RETURN-1'
            ],

            evidenceNodeIds: [
              'EVIDENCE-1'
            ],

            ruleNodeIds: [
              'RULE-1'
            ],

            authorityNodeIds: [
              'AUTHORITY-1'
            ],

            calculationNodeIds: [
              'CALC-1'
            ],

            returnNodeIds: [
              'RETURN-1',
              'LINE-15'
            ],

            requestedBy:
              'PREPARER-A',

            decidedBy:
              'EA-B',

            decidedByRole:
              'EA',

            reason:
              'Independent EA approval.'
          });

        const result =
          TaxGuardCompleteProvenanceChainValidator
            .validateDecision(
              registry,
              decision
            );

        expect(
          result.valid
        ).toBe(true);
      }
    );

    it(
      'M10.10 permits workflow only for approved valid decision',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        const ctx =
          buildVerifiedChain(
            registry
          );

        const engine =
          new TaxGuardProfessionalDecisionEngine(
            registry
          );

        engine.record({
          decisionId:
            'DECISION-GATE',

          decisionType:
            'RETURN_APPROVED',

          status:
            'APPROVED',

          risk:
            'material',

          context:
            ctx,

          subjectNodeIds: [
            'RETURN-1'
          ],

          evidenceNodeIds: [
            'EVIDENCE-1'
          ],

          ruleNodeIds: [
            'RULE-1'
          ],

          authorityNodeIds: [
            'AUTHORITY-1'
          ],

          calculationNodeIds: [
            'CALC-1'
          ],

          returnNodeIds: [
            'RETURN-1'
          ],

          requestedBy:
            'PREPARER-A',

          decidedBy:
            'REVIEWER-B',

          decidedByRole:
            'REVIEWER',

          reason:
            'Approved for workflow progression.'
        });

        expect(
          TaxGuardDecisionWorkflowGate
            .evaluate(
              registry,
              'DECISION-GATE'
            )
            .allowed
        ).toBe(true);
      }
    );

    it(
      'M10.11 blocks missing decision at workflow gate',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        const result =
          TaxGuardDecisionWorkflowGate
            .evaluate(
              registry,
              'DECISION-NOT-FOUND'
            );

        expect(
          result.allowed
        ).toBe(false);

        expect(
          result.reasons
        ).toContain(
          'DECISION_NOT_FOUND'
        );
      }
    );

    it(
      'M10.12 traverses provenance ancestry',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        buildVerifiedChain(
          registry
        );

        const ancestors =
          TaxGuardProvenanceGraph
            .ancestors(
              registry,
              'RETURN-1'
            );

        const ids =
          ancestors.map(
            node =>
              node.nodeId
          );

        expect(
          ids
        ).toContain(
          'CALC-1'
        );

        expect(
          ids
        ).toContain(
          'FACT-1'
        );

        expect(
          ids
        ).toContain(
          'EVIDENCE-1'
        );

        expect(
          ids
        ).toContain(
          'DOC-1'
        );

        expect(
          ids
        ).toContain(
          'RULE-1'
        );

        expect(
          ids
        ).toContain(
          'AUTHORITY-1'
        );
      }
    );

    it(
      'M10.13 verifies provenance graph has no cycle',
      () => {

        const registry =
          new TaxGuardDecisionProvenanceRegistry();

        buildVerifiedChain(
          registry
        );

        expect(
          TaxGuardProvenanceGraph
            .assertNoCycle(
              registry,
              'RETURN-1'
            )
        ).toBe(true);
      }
    );
  }
);
