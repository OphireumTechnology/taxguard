
import type {
  TaxGuardProfessionalDecision,
  TaxGuardProvenanceContext,
  TaxGuardProvenanceNode,
  TaxGuardProvenanceNodeType
} from './TaxGuardDecisionProvenance';

import {
  TaxGuardDecisionProvenanceRegistry
} from './TaxGuardDecisionProvenance';

export interface TaxGuardProvenanceChainResult {
  valid: boolean;

  nodeIds:
    readonly string[];

  missingRequiredTypes:
    readonly TaxGuardProvenanceNodeType[];

  orphanNodeIds:
    readonly string[];

  brokenSourceNodeIds:
    readonly string[];

  unverifiedNodeIds:
    readonly string[];

  contextMismatchNodeIds:
    readonly string[];

  errors:
    readonly string[];
}

export interface TaxGuardProvenanceWorkflowGateResult {
  allowed: boolean;

  decisionId?: string;

  reasons:
    readonly string[];
}

function unique<T>(
  values: readonly T[]
): T[] {

  return [
    ...new Set(values)
  ];
}

function sameContext(
  left:
    TaxGuardProvenanceContext,

  right:
    TaxGuardProvenanceContext
): boolean {

  return (
    left.clientId ===
      right.clientId &&
    left.engagementId ===
      right.engagementId &&
    left.taxYear ===
      right.taxYear &&
    left.correlationId ===
      right.correlationId
  );
}

export class TaxGuardCompleteProvenanceChainValidator {

  static validateDecision(
    registry:
      TaxGuardDecisionProvenanceRegistry,

    decision:
      TaxGuardProfessionalDecision
  ):
    TaxGuardProvenanceChainResult {

    const nodeIds =
      unique([
        ...decision.subjectNodeIds,
        ...decision.evidenceNodeIds,
        ...decision.ruleNodeIds,
        ...decision.authorityNodeIds,
        ...decision.calculationNodeIds,
        ...decision.returnNodeIds
      ]);

    const nodes =
      registry.internalNodes();

    const missingRequiredTypes:
      TaxGuardProvenanceNodeType[] =
        [];

    const orphanNodeIds:
      string[] = [];

    const brokenSourceNodeIds:
      string[] = [];

    const unverifiedNodeIds:
      string[] = [];

    const contextMismatchNodeIds:
      string[] = [];

    const errors:
      string[] = [];

    const requiredTypes:
      TaxGuardProvenanceNodeType[] =
        [
          'EVIDENCE',
          'RULE',
          'AUTHORITY'
        ];

    for (
      const requiredType
      of requiredTypes
    ) {
      const found =
        nodeIds.some(
          nodeId =>
            nodes.get(
              nodeId
            )?.nodeType ===
            requiredType
        );

      if (!found) {
        missingRequiredTypes.push(
          requiredType
        );
      }
    }

    for (
      const nodeId
      of nodeIds
    ) {
      const node =
        nodes.get(
          nodeId
        );

      if (!node) {
        brokenSourceNodeIds.push(
          nodeId
        );

        continue;
      }

      if (
        !sameContext(
          decision.context,
          node.context
        )
      ) {
        contextMismatchNodeIds.push(
          nodeId
        );
      }

      if (
        this.requiresVerification(
          node.nodeType
        ) &&
        !node.verified
      ) {
        unverifiedNodeIds.push(
          nodeId
        );
      }

      if (
        this.requiresUpstreamSource(
          node.nodeType
        ) &&
        node.sourceIds.length === 0
      ) {
        orphanNodeIds.push(
          nodeId
        );
      }

      for (
        const sourceId
        of node.sourceIds
      ) {
        if (
          !nodes.has(
            sourceId
          )
        ) {
          brokenSourceNodeIds.push(
            nodeId
          );
        }
      }
    }

    if (
      missingRequiredTypes.length > 0
    ) {
      errors.push(
        'MISSING_REQUIRED_PROVENANCE_TYPE'
      );
    }

    if (
      orphanNodeIds.length > 0
    ) {
      errors.push(
        'ORPHAN_PROVENANCE_NODE'
      );
    }

    if (
      brokenSourceNodeIds.length > 0
    ) {
      errors.push(
        'BROKEN_PROVENANCE_CHAIN'
      );
    }

    if (
      unverifiedNodeIds.length > 0
    ) {
      errors.push(
        'UNVERIFIED_PROVENANCE_CHAIN'
      );
    }

    if (
      contextMismatchNodeIds.length >
      0
    ) {
      errors.push(
        'PROVENANCE_CONTEXT_MISMATCH'
      );
    }

    return {
      valid:
        errors.length === 0,

      nodeIds,

      missingRequiredTypes:
        unique(
          missingRequiredTypes
        ),

      orphanNodeIds:
        unique(
          orphanNodeIds
        ),

      brokenSourceNodeIds:
        unique(
          brokenSourceNodeIds
        ),

      unverifiedNodeIds:
        unique(
          unverifiedNodeIds
        ),

      contextMismatchNodeIds:
        unique(
          contextMismatchNodeIds
        ),

      errors
    };
  }

  static assertDecisionValid(
    registry:
      TaxGuardDecisionProvenanceRegistry,

    decision:
      TaxGuardProfessionalDecision
  ):
    true {

    const result =
      this.validateDecision(
        registry,
        decision
      );

    if (!result.valid) {
      throw new Error(
        'TG_PROVENANCE_CHAIN_BLOCKED:' +
        result.errors.join(',')
      );
    }

    return true;
  }

  private static requiresVerification(
    nodeType:
      TaxGuardProvenanceNodeType
  ):
    boolean {

    return [
      'SOURCE_DOCUMENT',
      'EVIDENCE',
      'VALIDATED_FACT',
      'RULE',
      'AUTHORITY',
      'CALCULATION',
      'PREPARED_RETURN',
      'FORM_LINE'
    ].includes(
      nodeType
    );
  }

  private static requiresUpstreamSource(
    nodeType:
      TaxGuardProvenanceNodeType
  ):
    boolean {

    return [
      'EVIDENCE',
      'VALIDATED_FACT',
      'RULE',
      'CALCULATION',
      'PREPARED_RETURN',
      'FORM_LINE'
    ].includes(
      nodeType
    );
  }
}

export class TaxGuardDecisionWorkflowGate {

  static evaluate(
    registry:
      TaxGuardDecisionProvenanceRegistry,

    decisionId:
      string
  ):
    TaxGuardProvenanceWorkflowGateResult {

    let decision:
      TaxGuardProfessionalDecision;

    try {
      decision =
        registry.getDecision(
          decisionId
        );
    } catch {
      return {
        allowed:
          false,

        decisionId,

        reasons: [
          'DECISION_NOT_FOUND'
        ]
      };
    }

    const chain =
      TaxGuardCompleteProvenanceChainValidator
        .validateDecision(
          registry,
          decision
        );

    const reasons:
      string[] = [
        ...chain.errors
      ];

    if (
      decision.status !==
        'APPROVED'
    ) {
      reasons.push(
        'DECISION_NOT_APPROVED'
      );
    }

    if (
      decision.aiDecision !==
        false
    ) {
      reasons.push(
        'AI_DECISION_BLOCKED'
      );
    }

    if (
      (
        decision.risk ===
          'material' ||
        decision.risk ===
          'critical'
      ) &&
      ![
        'REVIEWER',
        'CPA',
        'EA'
      ].includes(
        decision.decidedByRole
      )
    ) {
      reasons.push(
        'AUTHORIZED_PROFESSIONAL_REQUIRED'
      );
    }

    return {
      allowed:
        reasons.length === 0,

      decisionId,

      reasons:
        unique(
          reasons
        )
    };
  }

  static assertAllowed(
    registry:
      TaxGuardDecisionProvenanceRegistry,

    decisionId:
      string
  ):
    true {

    const result =
      this.evaluate(
        registry,
        decisionId
      );

    if (!result.allowed) {
      throw new Error(
        'TG_DECISION_WORKFLOW_BLOCKED:' +
        result.reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardProvenanceGraph {

  static ancestors(
    registry:
      TaxGuardDecisionProvenanceRegistry,

    nodeId:
      string
  ):
    readonly TaxGuardProvenanceNode[] {

    const nodes =
      registry.internalNodes();

    if (
      !nodes.has(
        nodeId
      )
    ) {
      throw new Error(
        'TG_PROVENANCE_NODE_NOT_FOUND'
      );
    }

    const visited =
      new Set<string>();

    const result:
      TaxGuardProvenanceNode[] =
        [];

    const visit =
      (currentId: string) => {

        const current =
          nodes.get(
            currentId
          );

        if (!current) {
          throw new Error(
            'TG_PROVENANCE_BROKEN_ANCESTOR:' +
            currentId
          );
        }

        for (
          const sourceId
          of current.sourceIds
        ) {
          if (
            visited.has(
              sourceId
            )
          ) {
            continue;
          }

          visited.add(
            sourceId
          );

          const source =
            nodes.get(
              sourceId
            );

          if (!source) {
            throw new Error(
              'TG_PROVENANCE_BROKEN_ANCESTOR:' +
              sourceId
            );
          }

          result.push({
            ...source,

            context: {
              ...source.context
            },

            sourceIds: [
              ...source.sourceIds
            ]
          });

          visit(
            sourceId
          );
        }
      };

    visit(
      nodeId
    );

    return result;
  }

  static assertNoCycle(
    registry:
      TaxGuardDecisionProvenanceRegistry,

    nodeId:
      string
  ):
    true {

    const nodes =
      registry.internalNodes();

    const visiting =
      new Set<string>();

    const visited =
      new Set<string>();

    const visit =
      (currentId: string) => {

        if (
          visiting.has(
            currentId
          )
        ) {
          throw new Error(
            'TG_PROVENANCE_CYCLE_DETECTED:' +
            currentId
          );
        }

        if (
          visited.has(
            currentId
          )
        ) {
          return;
        }

        const node =
          nodes.get(
            currentId
          );

        if (!node) {
          throw new Error(
            'TG_PROVENANCE_NODE_NOT_FOUND'
          );
        }

        visiting.add(
          currentId
        );

        for (
          const sourceId
          of node.sourceIds
        ) {
          visit(
            sourceId
          );
        }

        visiting.delete(
          currentId
        );

        visited.add(
          currentId
        );
      };

    visit(
      nodeId
    );

    return true;
  }
}
