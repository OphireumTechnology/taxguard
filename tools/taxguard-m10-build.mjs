//////////////M10 Part 1 of 4 — Provenance Contracts + Evidence Chain Registry
////////////// Ophireum Multimedia Productions

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function write(rel, content) {
  const target = path.join(ROOT, rel);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true }
  );

  fs.writeFileSync(
    target,
    content,
    'utf8'
  );

  console.log(
    'WROTE ' + rel
  );
}

write(
  'src/taxguard/provenance/TaxGuardDecisionProvenance.ts',
  String.raw`
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
`
);

////// JavaSrcipt - Ophireum Multimedia Productions


write(
  'src/taxguard/provenance/TaxGuardDecisionIntegrity.ts',
  String.raw`
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
`
);


write(
  'src/taxguard/provenance/TaxGuardProvenanceChain.ts',
  String.raw`
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
`
);

write(
  'src/taxguard/provenance/index.ts',
  String.raw`
export * from './TaxGuardDecisionProvenance';
export * from './TaxGuardDecisionIntegrity';
export * from './TaxGuardProvenanceChain';
`
);

/////////// M10 Part 4 of 4 — Regression Tests + Builder Completion
/////////// Opherium Multimedia Productions

write(
  'src/tests/taxGuardDecisionProvenance.test.ts',
  String.raw`
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
`
);

console.log('');
console.log(
  '=============================================='
);

console.log(
  'TaxGuard M10 source generated successfully.'
);

console.log(
  '=============================================='
);

console.log('Created:');

console.log(
  'src/taxguard/provenance/TaxGuardDecisionProvenance.ts'
);

console.log(
  'src/taxguard/provenance/TaxGuardDecisionIntegrity.ts'
);

console.log(
  'src/taxguard/provenance/TaxGuardProvenanceChain.ts'
);

console.log(
  'src/taxguard/provenance/index.ts'
);

console.log(
  'src/tests/taxGuardDecisionProvenance.test.ts'
);

console.log('');

console.log(
  'M1-M9 source was not modified.'
);

console.log(
  'External tax filing remains DISABLED.'
);









