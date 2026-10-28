
import type {
  TaxGuardDecisionRisk,
  TaxGuardDecisionStatus,
  TaxGuardDecisionType,
  TaxGuardProfessionalDecision,
  TaxGuardProvenanceContext,
  TaxGuardProvenanceNode,
  TaxGuardProvenanceNodeType
} from './TaxGuardDecisionProvenance';

import {
  TaxGuardDecisionProvenanceRegistry
} from './TaxGuardDecisionProvenance';

function requireText(
  value: string,
  errorCode: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}

function unique(
  values: readonly string[]
): string[] {

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

export interface TaxGuardDecisionInput {
  decisionId: string;

  decisionType:
    TaxGuardDecisionType;

  status:
    Exclude<
      TaxGuardDecisionStatus,
      'SUPERSEDED'
    >;

  risk:
    TaxGuardDecisionRisk;

  context:
    TaxGuardProvenanceContext;

  subjectNodeIds:
    readonly string[];

  evidenceNodeIds:
    readonly string[];

  ruleNodeIds:
    readonly string[];

  authorityNodeIds:
    readonly string[];

  calculationNodeIds?:
    readonly string[];

  returnNodeIds?:
    readonly string[];

  requestedBy: string;

  decidedBy: string;

  decidedByRole:
    | 'PREPARER'
    | 'REVIEWER'
    | 'CPA'
    | 'EA'
    | 'ADMIN';

  reason: string;
}

export interface TaxGuardIntegrityResult {
  valid: boolean;

  missingNodeIds:
    readonly string[];

  unverifiedNodeIds:
    readonly string[];

  contextMismatchNodeIds:
    readonly string[];

  brokenSourceNodeIds:
    readonly string[];

  errors:
    readonly string[];
}

export class TaxGuardProvenanceIntegrityGuard {

  static inspect(
    registry:
      TaxGuardDecisionProvenanceRegistry,

    context:
      TaxGuardProvenanceContext,

    nodeIds:
      readonly string[]
  ):
    TaxGuardIntegrityResult {

    const missingNodeIds:
      string[] = [];

    const unverifiedNodeIds:
      string[] = [];

    const contextMismatchNodeIds:
      string[] = [];

    const brokenSourceNodeIds:
      string[] = [];

    const errors:
      string[] = [];

    const nodes =
      registry.internalNodes();

    for (
      const nodeId
      of unique(nodeIds)
    ) {
      const node =
        nodes.get(nodeId);

      if (!node) {
        missingNodeIds.push(
          nodeId
        );

        continue;
      }

      if (
        !sameContext(
          context,
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
      missingNodeIds.length > 0
    ) {
      errors.push(
        'MISSING_PROVENANCE_NODE'
      );
    }

    if (
      unverifiedNodeIds.length > 0
    ) {
      errors.push(
        'UNVERIFIED_PROVENANCE_NODE'
      );
    }

    if (
      contextMismatchNodeIds
        .length > 0
    ) {
      errors.push(
        'PROVENANCE_CONTEXT_MISMATCH'
      );
    }

    if (
      brokenSourceNodeIds
        .length > 0
    ) {
      errors.push(
        'BROKEN_PROVENANCE_SOURCE'
      );
    }

    return {
      valid:
        errors.length === 0,

      missingNodeIds:
        unique(
          missingNodeIds
        ),

      unverifiedNodeIds:
        unique(
          unverifiedNodeIds
        ),

      contextMismatchNodeIds:
        unique(
          contextMismatchNodeIds
        ),

      brokenSourceNodeIds:
        unique(
          brokenSourceNodeIds
        ),

      errors
    };
  }

  static assertValid(
    registry:
      TaxGuardDecisionProvenanceRegistry,

    context:
      TaxGuardProvenanceContext,

    nodeIds:
      readonly string[]
  ):
    true {

    const result =
      this.inspect(
        registry,
        context,
        nodeIds
      );

    if (!result.valid) {
      throw new Error(
        'TG_PROVENANCE_INTEGRITY_BLOCKED:' +
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
}

export class TaxGuardProfessionalDecisionEngine {

  constructor(
    private readonly registry:
      TaxGuardDecisionProvenanceRegistry
  ) {}

  record(
    input:
      TaxGuardDecisionInput
  ):
    TaxGuardProfessionalDecision {

    requireText(
      input.decisionId,
      'TG_DECISION_ID_REQUIRED'
    );

    requireText(
      input.requestedBy,
      'TG_DECISION_REQUESTER_REQUIRED'
    );

    requireText(
      input.decidedBy,
      'TG_DECISION_DECIDER_REQUIRED'
    );

    requireText(
      input.reason,
      'TG_DECISION_REASON_REQUIRED'
    );

    if (
      this.registry
        .internalDecisions()
        .has(
          input.decisionId
        )
    ) {
      throw new Error(
        'TG_DECISION_DUPLICATE_ID'
      );
    }

    const subjectNodeIds =
      unique(
        input.subjectNodeIds
      );

    const evidenceNodeIds =
      unique(
        input.evidenceNodeIds
      );

    const ruleNodeIds =
      unique(
        input.ruleNodeIds
      );

    const authorityNodeIds =
      unique(
        input.authorityNodeIds
      );

    const calculationNodeIds =
      unique(
        input.calculationNodeIds ??
        []
      );

    const returnNodeIds =
      unique(
        input.returnNodeIds ??
        []
      );

    if (
      subjectNodeIds.length === 0
    ) {
      throw new Error(
        'TG_DECISION_SUBJECT_REQUIRED'
      );
    }

    if (
      evidenceNodeIds.length === 0
    ) {
      throw new Error(
        'TG_DECISION_EVIDENCE_REQUIRED'
      );
    }

    if (
      ruleNodeIds.length === 0
    ) {
      throw new Error(
        'TG_DECISION_RULE_REQUIRED'
      );
    }

    if (
      authorityNodeIds.length === 0
    ) {
      throw new Error(
        'TG_DECISION_AUTHORITY_REQUIRED'
      );
    }

    const allNodeIds =
      unique([
        ...subjectNodeIds,
        ...evidenceNodeIds,
        ...ruleNodeIds,
        ...authorityNodeIds,
        ...calculationNodeIds,
        ...returnNodeIds
      ]);

    TaxGuardProvenanceIntegrityGuard
      .assertValid(
        this.registry,
        input.context,
        allNodeIds
      );

    this.assertNodeTypes(
      evidenceNodeIds,
      'EVIDENCE'
    );

    this.assertNodeTypes(
      ruleNodeIds,
      'RULE'
    );

    this.assertNodeTypes(
      authorityNodeIds,
      'AUTHORITY'
    );

    this.assertNodeTypes(
      calculationNodeIds,
      'CALCULATION'
    );

    this.assertReturnNodeTypes(
      returnNodeIds
    );

    if (
      (
        input.risk ===
          'material' ||
        input.risk ===
          'critical'
      ) &&
      input.requestedBy ===
        input.decidedBy
    ) {
      throw new Error(
        'TG_DECISION_MAKER_CHECKER_REQUIRED'
      );
    }

    if (
      (
        input.risk ===
          'material' ||
        input.risk ===
          'critical'
      ) &&
      ![
        'REVIEWER',
        'CPA',
        'EA'
      ].includes(
        input.decidedByRole
      )
    ) {
      throw new Error(
        'TG_DECISION_AUTHORIZED_PROFESSIONAL_REQUIRED'
      );
    }

    const decision:
      TaxGuardProfessionalDecision =
        Object.freeze({
          decisionId:
            input.decisionId,

          decisionType:
            input.decisionType,

          status:
            input.status,

          risk:
            input.risk,

          context: {
            ...input.context
          },

          subjectNodeIds,

          evidenceNodeIds,

          ruleNodeIds,

          authorityNodeIds,

          calculationNodeIds,

          returnNodeIds,

          decidedBy:
            input.decidedBy,

          decidedByRole:
            input.decidedByRole,

          reason:
            input.reason,

          createdAt:
            new Date()
              .toISOString(),

          aiDecision:
            false,

          immutable:
            true
        });

    this.registry
      .internalDecisions()
      .set(
        decision.decisionId,
        decision
      );

    let sequence =
      1;

    for (
      const nodeId
      of allNodeIds
    ) {
      const node =
        this.registry.getNode(
          nodeId
        );

      this.registry.appendTrace({
        decisionId:
          decision.decisionId,

        sequence:
          sequence++,

        nodeId,

        nodeType:
          node.nodeType,

        action:
          'BOUND',

        actorId:
          input.decidedBy
      });
    }

    this.registry.appendTrace({
      decisionId:
        decision.decisionId,

      sequence:
        sequence++,

      nodeId:
        subjectNodeIds[0],

      nodeType:
        this.registry
          .getNode(
            subjectNodeIds[0]
          )
          .nodeType,

      action:
        'DECISION_RECORDED',

      actorId:
        input.decidedBy
    });

    return this.registry
      .getDecision(
        decision.decisionId
      );
  }

  private assertNodeTypes(
    nodeIds:
      readonly string[],

    expected:
      TaxGuardProvenanceNodeType
  ):
    void {

    for (
      const nodeId
      of nodeIds
    ) {
      const node =
        this.registry.getNode(
          nodeId
        );

      if (
        node.nodeType !==
          expected
      ) {
        throw new Error(
          'TG_DECISION_NODE_TYPE_MISMATCH:' +
          nodeId
        );
      }
    }
  }

  private assertReturnNodeTypes(
    nodeIds:
      readonly string[]
  ):
    void {

    for (
      const nodeId
      of nodeIds
    ) {
      const node:
        TaxGuardProvenanceNode =
          this.registry.getNode(
            nodeId
          );

      if (
        node.nodeType !==
          'PREPARED_RETURN' &&
        node.nodeType !==
          'FORM_LINE'
      ) {
        throw new Error(
          'TG_DECISION_RETURN_NODE_TYPE_MISMATCH:' +
          nodeId
        );
      }
    }
  }
}
