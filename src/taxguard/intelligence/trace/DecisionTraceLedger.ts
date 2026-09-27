/**
 * TaxGuard Intelligence Core
 * TG-CORE-007 — Decision Trace & Explainability Ledger
 *
 * PURPOSE
 * -------
 * Provides deterministic, append-only traceability across the TaxGuard
 * Intelligence Core.
 *
 * This component records how evidence, deterministic rules, AI proposals,
 * human review, and authorized decisions relate to one another.
 *
 * HARD GOVERNANCE INVARIANTS
 * --------------------------
 * 1. This ledger does NOT approve tax decisions.
 * 2. This ledger does NOT certify Stage 03.
 * 3. This ledger does NOT clear any TaxGuard gate.
 * 4. This ledger does NOT file or transmit tax returns.
 * 5. This ledger does NOT modify deterministic rule results.
 * 6. This ledger does NOT convert AI proposals into verified tax facts.
 * 7. AI-derived material remains proposed-only until authorized human review.
 * 8. Trace records preserve source identifiers rather than replacing sources.
 */

export type DecisionTraceStage =
  | 'KNOWLEDGE'
  | 'RULE_EVALUATION'
  | 'EVIDENCE_PACKAGE'
  | 'AI_PROPOSAL'
  | 'HUMAN_REVIEW'
  | 'AUTHORIZED_DECISION';

export type DecisionTraceSourceType =
  | 'KNOWLEDGE_SOURCE'
  | 'RULE_EVALUATION'
  | 'EVIDENCE_PACKAGE'
  | 'AI_PROPOSAL'
  | 'HUMAN_REVIEW'
  | 'DECISION'
  | 'AUDIT_EVENT';

export type DecisionTraceActorRole =
  | 'system'
  | 'preparer'
  | 'accountant'
  | 'reviewer'
  | 'cpa'
  | 'ea'
  | 'tax_attorney'
  | 'admin'
  | 'client'
  | 'ai_model'
  | string;

export interface DecisionTraceSourceReference {
  sourceType: DecisionTraceSourceType;
  sourceId: string;
}

export interface DecisionTraceInput {
  traceId?: string;

  clientId: string;
  engagementId: string;
  taxYear: number;

  stage: DecisionTraceStage;

  actorId: string;
  actorRole: DecisionTraceActorRole;

  summary: string;

  knowledgeSourceIds?: string[];
  ruleEvaluationIds?: string[];
  evidencePackageIds?: string[];
  aiProposalIds?: string[];
  humanReviewIds?: string[];
  decisionIds?: string[];
  auditReferences?: string[];

  /**
   * Must be true whenever the trace contains AI-originated reasoning
   * that has not itself become an authorized human decision.
   */
  isAiProposedOnly?: boolean;

  correlationId: string;

  createdAt?: string;
}

export interface DecisionTraceRecord {
  traceId: string;

  clientId: string;
  engagementId: string;
  taxYear: number;

  stage: DecisionTraceStage;

  actorId: string;
  actorRole: DecisionTraceActorRole;

  summary: string;

  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];
  evidencePackageIds: string[];
  aiProposalIds: string[];
  humanReviewIds: string[];
  decisionIds: string[];
  auditReferences: string[];

  sourceReferences: DecisionTraceSourceReference[];

  requiresHumanReview: boolean;
  isAiProposedOnly: boolean;

  correlationId: string;
  createdAt: string;

  /**
   * Explicit governance marker.
   *
   * A trace is evidence ABOUT a decision path.
   * It is never the approval/certification itself.
   */
  hasDecisionAuthority: false;
}

export interface DecisionTraceQuery {
  clientId: string;
  taxYear: number;
  engagementId?: string;
  correlationId?: string;
}

export class DecisionTraceLedger {
  private static readonly records = new Map<string, DecisionTraceRecord>();

  /**
   * Append a trace record.
   *
   * Records are append-only. Existing trace IDs cannot be overwritten.
   */
  public static append(input: DecisionTraceInput): DecisionTraceRecord {
    this.validateInput(input);

    const traceId =
      input.traceId?.trim() ||
      this.createTraceId(
        input.clientId,
        input.taxYear,
        input.correlationId,
      );

    if (this.records.has(traceId)) {
      throw new Error(
        `Decision trace '${traceId}' already exists. Trace records are append-only and cannot be overwritten.`,
      );
    }

    const knowledgeSourceIds = this.normalizeIds(
      input.knowledgeSourceIds,
    );

    const ruleEvaluationIds = this.normalizeIds(
      input.ruleEvaluationIds,
    );

    const evidencePackageIds = this.normalizeIds(
      input.evidencePackageIds,
    );

    const aiProposalIds = this.normalizeIds(
      input.aiProposalIds,
    );

    const humanReviewIds = this.normalizeIds(
      input.humanReviewIds,
    );

    const decisionIds = this.normalizeIds(
      input.decisionIds,
    );

    const auditReferences = this.normalizeIds(
      input.auditReferences,
    );

    const containsAiMaterial =
      input.stage === 'AI_PROPOSAL' ||
      aiProposalIds.length > 0 ||
      input.actorRole.toLowerCase() === 'ai_model';

    /*
     * AI material is always proposed-only at this layer.
     *
     * Even when an authorized human later approves a decision, the original
     * AI proposal remains historically identifiable as an AI proposal.
     */
    const isAiProposedOnly = containsAiMaterial
      ? true
      : input.isAiProposedOnly === true;

    const requiresHumanReview =
      containsAiMaterial ||
      input.stage === 'HUMAN_REVIEW';

    const sourceReferences =
      this.buildSourceReferences({
        knowledgeSourceIds,
        ruleEvaluationIds,
        evidencePackageIds,
        aiProposalIds,
        humanReviewIds,
        decisionIds,
        auditReferences,
      });

    const record: DecisionTraceRecord = {
      traceId,

      clientId: input.clientId.trim(),
      engagementId: input.engagementId.trim(),
      taxYear: input.taxYear,

      stage: input.stage,

      actorId: input.actorId.trim(),
      actorRole: input.actorRole,

      summary: input.summary.trim(),

      knowledgeSourceIds,
      ruleEvaluationIds,
      evidencePackageIds,
      aiProposalIds,
      humanReviewIds,
      decisionIds,
      auditReferences,

      sourceReferences,

      requiresHumanReview,
      isAiProposedOnly,

      correlationId: input.correlationId.trim(),
      createdAt: input.createdAt ?? new Date().toISOString(),

      hasDecisionAuthority: false,
    };

    this.records.set(traceId, this.cloneRecord(record));

    return this.cloneRecord(record);
  }

  /**
   * Alias emphasizing the ledger nature of the component.
   */
  public static record(
    input: DecisionTraceInput,
  ): DecisionTraceRecord {
    return this.append(input);
  }

  /**
   * Retrieve one trace by immutable trace ID.
   */
  public static getById(
    traceId: string,
  ): DecisionTraceRecord | undefined {
    if (!traceId || !traceId.trim()) {
      return undefined;
    }

    const record = this.records.get(traceId.trim());

    return record
      ? this.cloneRecord(record)
      : undefined;
  }

  /**
   * Query trace history for a client/tax-year boundary.
   */
  public static query(
    query: DecisionTraceQuery,
  ): DecisionTraceRecord[] {
    if (!query.clientId || !query.clientId.trim()) {
      throw new Error('Decision trace query requires clientId.');
    }

    this.validateTaxYear(query.taxYear);

    const engagementId = query.engagementId?.trim();
    const correlationId = query.correlationId?.trim();

    return Array.from(this.records.values())
      .filter(record => {
        if (record.clientId !== query.clientId.trim()) {
          return false;
        }

        if (record.taxYear !== query.taxYear) {
          return false;
        }

        if (
          engagementId &&
          record.engagementId !== engagementId
        ) {
          return false;
        }

        if (
          correlationId &&
          record.correlationId !== correlationId
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      )
      .map(record => this.cloneRecord(record));
  }

  /**
   * Return all trace records.
   *
   * Intended primarily for controlled diagnostics and tests.
   */
  public static getAll(): DecisionTraceRecord[] {
    return Array.from(this.records.values())
      .sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      )
      .map(record => this.cloneRecord(record));
  }

  /**
   * Produce a deterministic human-readable explanation of a trace.
   *
   * This is explanatory only. It is not an approval or tax conclusion.
   */
  public static explain(traceId: string): string {
    const record = this.getById(traceId);

    if (!record) {
      throw new Error(
        `Decision trace '${traceId}' was not found.`,
      );
    }

    const references = record.sourceReferences
      .map(
        ref =>
          `${ref.sourceType}:${ref.sourceId}`,
      )
      .join(', ');

    return [
      `Trace ${record.traceId}`,
      `Stage: ${record.stage}`,
      `Client: ${record.clientId}`,
      `Engagement: ${record.engagementId}`,
      `Tax Year: ${record.taxYear}`,
      `Actor: ${record.actorId} (${record.actorRole})`,
      `Summary: ${record.summary}`,
      `Sources: ${references || 'none'}`,
      `AI Proposed Only: ${record.isAiProposedOnly}`,
      `Requires Human Review: ${record.requiresHumanReview}`,
      `Decision Authority: false`,
      `Correlation ID: ${record.correlationId}`,
    ].join('\n');
  }

  /**
   * Test/reset utility.
   *
   * Does not represent a production ledger deletion capability.
   * Persistent production storage should use immutable retention controls.
   */
  public static clearAll(): void {
    this.records.clear();
  }

  private static validateInput(
    input: DecisionTraceInput,
  ): void {
    if (!input.clientId || !input.clientId.trim()) {
      throw new Error(
        'Decision trace requires clientId.',
      );
    }

    if (
      !input.engagementId ||
      !input.engagementId.trim()
    ) {
      throw new Error(
        'Decision trace requires engagementId.',
      );
    }

    this.validateTaxYear(input.taxYear);

    if (!input.stage) {
      throw new Error(
        'Decision trace requires stage.',
      );
    }

    if (!input.actorId || !input.actorId.trim()) {
      throw new Error(
        'Decision trace requires actorId.',
      );
    }

    if (
      !input.actorRole ||
      !input.actorRole.trim()
    ) {
      throw new Error(
        'Decision trace requires actorRole.',
      );
    }

    if (!input.summary || !input.summary.trim()) {
      throw new Error(
        'Decision trace requires a summary.',
      );
    }

    if (
      !input.correlationId ||
      !input.correlationId.trim()
    ) {
      throw new Error(
        'Decision trace requires correlationId.',
      );
    }

    if (
      input.stage === 'AI_PROPOSAL' &&
      input.isAiProposedOnly === false
    ) {
      throw new Error(
        'AI reasoning must remain proposed-only until authorized human review.',
      );
    }

    if (
      input.actorRole.toLowerCase() === 'ai_model' &&
      input.isAiProposedOnly === false
    ) {
      throw new Error(
        'AI-originated trace material cannot be marked as independently approved.',
      );
    }
  }

  private static validateTaxYear(
    taxYear: number,
  ): void {
    if (
      !Number.isInteger(taxYear) ||
      taxYear < 1900 ||
      taxYear > 2200
    ) {
      throw new Error(
        'Decision trace requires a valid tax year.',
      );
    }
  }

  private static normalizeIds(
    ids?: string[],
  ): string[] {
    if (!ids) {
      return [];
    }

    return Array.from(
      new Set(
        ids
          .map(id => id?.trim())
          .filter(
            (id): id is string =>
              typeof id === 'string' &&
              id.length > 0,
          ),
      ),
    );
  }

  private static buildSourceReferences(params: {
    knowledgeSourceIds: string[];
    ruleEvaluationIds: string[];
    evidencePackageIds: string[];
    aiProposalIds: string[];
    humanReviewIds: string[];
    decisionIds: string[];
    auditReferences: string[];
  }): DecisionTraceSourceReference[] {
    const references: DecisionTraceSourceReference[] =
      [];

    const add = (
      sourceType: DecisionTraceSourceType,
      ids: string[],
    ) => {
      ids.forEach(sourceId => {
        references.push({
          sourceType,
          sourceId,
        });
      });
    };

    add(
      'KNOWLEDGE_SOURCE',
      params.knowledgeSourceIds,
    );

    add(
      'RULE_EVALUATION',
      params.ruleEvaluationIds,
    );

    add(
      'EVIDENCE_PACKAGE',
      params.evidencePackageIds,
    );

    add(
      'AI_PROPOSAL',
      params.aiProposalIds,
    );

    add(
      'HUMAN_REVIEW',
      params.humanReviewIds,
    );

    add(
      'DECISION',
      params.decisionIds,
    );

    add(
      'AUDIT_EVENT',
      params.auditReferences,
    );

    return references;
  }

  private static createTraceId(
    clientId: string,
    taxYear: number,
    correlationId: string,
  ): string {
    const safeClient = clientId
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const safeCorrelation = correlationId
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    return [
      'TRACE',
      safeClient,
      taxYear,
      safeCorrelation,
      Date.now(),
      Math.floor(Math.random() * 1_000_000),
    ].join('-');
  }

  private static cloneRecord(
    record: DecisionTraceRecord,
  ): DecisionTraceRecord {
    return {
      ...record,

      knowledgeSourceIds: [
        ...record.knowledgeSourceIds,
      ],

      ruleEvaluationIds: [
        ...record.ruleEvaluationIds,
      ],

      evidencePackageIds: [
        ...record.evidencePackageIds,
      ],

      aiProposalIds: [
        ...record.aiProposalIds,
      ],

      humanReviewIds: [
        ...record.humanReviewIds,
      ],

      decisionIds: [
        ...record.decisionIds,
      ],

      auditReferences: [
        ...record.auditReferences,
      ],

      sourceReferences:
        record.sourceReferences.map(ref => ({
          ...ref,
        })),
    };
  }
}