
export type TaxGuardProvenanceNodeType =
  | 'SOURCE_DOCUMENT'
  | 'EVIDENCE'
  | 'VALIDATED_FACT'
  | 'RULE'
  | 'AUTHORITY'
  | 'CALCULATION'
  | 'PREPARED_RETURN'
  | 'FORM_LINE'
  | 'PROFESSIONAL_DECISION';

export type TaxGuardDecisionType =
  | 'FACT_ACCEPTED'
  | 'FACT_REJECTED'
  | 'RULE_APPLIED'
  | 'CALCULATION_ACCEPTED'
  | 'CALCULATION_OVERRIDDEN'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'EXCEPTION_RESOLVED'
  | 'OTHER';

export type TaxGuardDecisionRisk =
  | 'routine'
  | 'material'
  | 'critical';

export type TaxGuardDecisionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED';

export interface TaxGuardProvenanceContext {
  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;
}

export interface TaxGuardProvenanceNode {
  nodeId: string;

  nodeType:
    TaxGuardProvenanceNodeType;

  context:
    TaxGuardProvenanceContext;

  sourceIds:
    readonly string[];

  hash?: string;

  description: string;

  verified: boolean;

  verifiedBy?: string;

  createdAt: string;

  immutable: true;
}

export interface TaxGuardProfessionalDecision {
  decisionId: string;

  decisionType:
    TaxGuardDecisionType;

  status:
    TaxGuardDecisionStatus;

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

  calculationNodeIds:
    readonly string[];

  returnNodeIds:
    readonly string[];

  decidedBy: string;

  decidedByRole:
    | 'PREPARER'
    | 'REVIEWER'
    | 'CPA'
    | 'EA'
    | 'ADMIN';

  reason: string;

  createdAt: string;

  aiDecision:
    false;

  immutable: true;
}

export interface TaxGuardDecisionTraceEntry {
  traceId: string;

  decisionId: string;

  sequence: number;

  nodeId: string;

  nodeType:
    TaxGuardProvenanceNodeType;

  action:
    | 'BOUND'
    | 'VERIFIED'
    | 'DECISION_RECORDED'
    | 'INTEGRITY_CHECKED';

  actorId: string;

  timestamp: string;

  immutable: true;
}

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

function now(): string {
  return new Date()
    .toISOString();
}

function unique(
  values: readonly string[]
): string[] {

  return [
    ...new Set(values)
  ];
}

function cloneContext(
  context:
    TaxGuardProvenanceContext
):
  TaxGuardProvenanceContext {

  return {
    ...context
  };
}

export class TaxGuardDecisionProvenanceRegistry {

  private readonly nodes =
    new Map<
      string,
      TaxGuardProvenanceNode
    >();

  private readonly decisions =
    new Map<
      string,
      TaxGuardProfessionalDecision
    >();

  private readonly traces:
    TaxGuardDecisionTraceEntry[] =
      [];

  registerNode(
    input: {
      nodeId: string;

      nodeType:
        TaxGuardProvenanceNodeType;

      context:
        TaxGuardProvenanceContext;

      sourceIds?: readonly string[];

      hash?: string;

      description: string;

      verified?: boolean;

      verifiedBy?: string;
    }
  ):
    TaxGuardProvenanceNode {

    requireText(
      input.nodeId,
      'TG_PROVENANCE_NODE_ID_REQUIRED'
    );

    requireText(
      input.context.clientId,
      'TG_PROVENANCE_CLIENT_REQUIRED'
    );

    requireText(
      input.context.engagementId,
      'TG_PROVENANCE_ENGAGEMENT_REQUIRED'
    );

    requireText(
      input.context.correlationId,
      'TG_PROVENANCE_CORRELATION_REQUIRED'
    );

    requireText(
      input.description,
      'TG_PROVENANCE_DESCRIPTION_REQUIRED'
    );

    if (
      !Number.isInteger(
        input.context.taxYear
      ) ||
      input.context.taxYear < 1900 ||
      input.context.taxYear > 2200
    ) {
      throw new Error(
        'TG_PROVENANCE_INVALID_TAX_YEAR'
      );
    }

    if (
      this.nodes.has(
        input.nodeId
      )
    ) {
      throw new Error(
        'TG_PROVENANCE_DUPLICATE_NODE'
      );
    }

    const sourceIds =
      unique(
        input.sourceIds ?? []
      );

    for (
      const sourceId
      of sourceIds
    ) {
      if (
        !this.nodes.has(
          sourceId
        )
      ) {
        throw new Error(
          'TG_PROVENANCE_SOURCE_NOT_FOUND:' +
          sourceId
        );
      }
    }

    const verified =
      input.verified ??
      false;

    if (
      verified &&
      !input.verifiedBy?.trim()
    ) {
      throw new Error(
        'TG_PROVENANCE_VERIFIER_REQUIRED'
      );
    }

    const record:
      TaxGuardProvenanceNode =
        Object.freeze({
          nodeId:
            input.nodeId,

          nodeType:
            input.nodeType,

          context:
            cloneContext(
              input.context
            ),

          sourceIds,

          hash:
            input.hash,

          description:
            input.description,

          verified,

          verifiedBy:
            input.verifiedBy,

          createdAt:
            now(),

          immutable:
            true
        });

    this.nodes.set(
      record.nodeId,
      record
    );

    return this.cloneNode(
      record
    );
  }

  getNode(
    nodeId: string
  ):
    TaxGuardProvenanceNode {

    const record =
      this.nodes.get(
        nodeId
      );

    if (!record) {
      throw new Error(
        'TG_PROVENANCE_NODE_NOT_FOUND'
      );
    }

    return this.cloneNode(
      record
    );
  }

  listNodes():
    readonly TaxGuardProvenanceNode[] {

    return [
      ...this.nodes.values()
    ].map(
      record =>
        this.cloneNode(
          record
        )
    );
  }

  getDecision(
    decisionId: string
  ):
    TaxGuardProfessionalDecision {

    const decision =
      this.decisions.get(
        decisionId
      );

    if (!decision) {
      throw new Error(
        'TG_PROVENANCE_DECISION_NOT_FOUND'
      );
    }

    return this.cloneDecision(
      decision
    );
  }

  decisionHistory():
    readonly TaxGuardProfessionalDecision[] {

    return [
      ...this.decisions.values()
    ].map(
      decision =>
        this.cloneDecision(
          decision
        )
    );
  }

  traceHistory(
    decisionId?: string
  ):
    readonly TaxGuardDecisionTraceEntry[] {

    return this.traces
      .filter(
        trace =>
          !decisionId ||
          trace.decisionId ===
            decisionId
      )
      .map(
        trace => ({
          ...trace
        })
      );
  }

  hasNode(
    nodeId: string
  ):
    boolean {

    return this.nodes.has(
      nodeId
    );
  }

  internalNodes():
    ReadonlyMap<
      string,
      TaxGuardProvenanceNode
    > {

    return this.nodes;
  }

  internalDecisions():
    Map<
      string,
      TaxGuardProfessionalDecision
    > {

    return this.decisions;
  }

  appendTrace(
    input: Omit<
      TaxGuardDecisionTraceEntry,
      'traceId' |
      'timestamp' |
      'immutable'
    >
  ):
    TaxGuardDecisionTraceEntry {

    const trace:
      TaxGuardDecisionTraceEntry =
        Object.freeze({
          traceId:
            'TG-TRACE-' +
            String(
              this.traces.length +
              1
            ).padStart(
              8,
              '0'
            ),

          ...input,

          timestamp:
            now(),

          immutable:
            true
        });

    this.traces.push(
      trace
    );

    return {
      ...trace
    };
  }

  private cloneNode(
    record:
      TaxGuardProvenanceNode
  ):
    TaxGuardProvenanceNode {

    return {
      ...record,

      context:
        cloneContext(
          record.context
        ),

      sourceIds: [
        ...record.sourceIds
      ]
    };
  }

  private cloneDecision(
    decision:
      TaxGuardProfessionalDecision
  ):
    TaxGuardProfessionalDecision {

    return {
      ...decision,

      context:
        cloneContext(
          decision.context
        ),

      subjectNodeIds: [
        ...decision.subjectNodeIds
      ],

      evidenceNodeIds: [
        ...decision.evidenceNodeIds
      ],

      ruleNodeIds: [
        ...decision.ruleNodeIds
      ],

      authorityNodeIds: [
        ...decision.authorityNodeIds
      ],

      calculationNodeIds: [
        ...decision.calculationNodeIds
      ],

      returnNodeIds: [
        ...decision.returnNodeIds
      ]
    };
  }
}
