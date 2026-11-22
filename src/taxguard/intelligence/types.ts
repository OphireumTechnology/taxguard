/**
 * TaxGuard Intelligence Core
 * Canonical contracts for knowledge, deterministic rules,
 * evidence generation, and AI-assisted reasoning.
 *
 * Governance invariant:
 * AI-generated information is proposed-only and must never
 * become tax-verified information without authorized human review.
 */

export type IntelligenceAuthority =
  | 'PRIMARY_AUTHORITY'
  | 'SECONDARY_AUTHORITY'
  | 'FIRM_POLICY'
  | 'REFERENCE';

export type KnowledgeSourceType =
  | 'IRC'
  | 'TREASURY_REGULATION'
  | 'IRS_FORM'
  | 'IRS_INSTRUCTION'
  | 'IRS_PUBLICATION'
  | 'IRS_NOTICE'
  | 'IRS_REVENUE_PROCEDURE'
  | 'IRS_REVENUE_RULING'
  | 'COURT_AUTHORITY'
  | 'STATE_AUTHORITY'
  | 'FIRM_SOP'
  | 'OTHER';

export type IntelligenceOrigin =
  | 'KNOWLEDGE_BASE'
  | 'RULE_ENGINE'
  | 'AI_REASONING'
  | 'HUMAN_REVIEW';

export type IntelligenceStatus =
  | 'PROPOSED'
  | 'REVIEW_REQUIRED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'STALE';

export type RuleResult =
  | 'PASS'
  | 'FAIL'
  | 'REVIEW_REQUIRED'
  | 'NOT_APPLICABLE';

export type ConfidenceLevel =
  | 'HIGH_CONFIDENCE'
  | 'MEDIUM_CONFIDENCE'
  | 'LOW_CONFIDENCE'
  | 'MISSING_CONFIDENCE';

export interface KnowledgeSource {
  sourceId: string;
  sourceType: KnowledgeSourceType;

  title: string;
  citation?: string;
  jurisdiction: string;

  taxYear?: number;

  authority: IntelligenceAuthority;

  effectiveFrom?: string;
  effectiveTo?: string;

  version?: string;

  sourceUri?: string;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface RuleDefinition {
  ruleId: string;
  ruleCode: string;

  name: string;
  description: string;

  jurisdiction: string;

  taxYears: number[];

  authoritySourceIds: string[];

  deterministic: true;

  version: string;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface RuleEvaluationInput {
  clientId: string;
  engagementId: string;
  taxYear: number;

  ruleId: string;

  facts: Record<string, unknown>;

  correlationId: string;
}

export interface RuleEvaluation {
  evaluationId: string;

  clientId: string;
  engagementId: string;
  taxYear: number;

  ruleId: string;

  result: RuleResult;

  explanation: string;

  authoritySourceIds: string[];

  evaluatedFacts: Record<string, unknown>;

  evaluatedAt: string;

  correlationId: string;
}

export interface IntelligenceFinding {
  findingId: string;

  clientId: string;
  engagementId: string;
  taxYear: number;

  origin: IntelligenceOrigin;

  title: string;
  description: string;

  confidence: ConfidenceLevel;

  status: IntelligenceStatus;

  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];

  requiresHumanReview: boolean;

  createdAt: string;

  createdBy: string;

  correlationId: string;
}

export interface AiReasoningProposal {
  proposalId: string;

  clientId: string;
  engagementId: string;
  taxYear: number;

  promptPurpose: string;

  explanation: string;

  issueSpots: string[];

  recommendations: string[];

  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];

  confidence: ConfidenceLevel;

  /**
   * Hard governance invariant.
   * AI output must remain proposed-only until reviewed
   * through the authorized TaxGuard human-review workflow.
   */
  isAiProposedOnly: true;

  status: 'PROPOSED' | 'REVIEW_REQUIRED';

  createdAt: string;

  correlationId: string;
}

export interface EvidencePackage {
  evidencePackageId: string;

  clientId: string;
  engagementId: string;
  taxYear: number;

  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];
  findingIds: string[];
  aiProposalIds: string[];

  requiresHumanReview: true;

  createdAt: string;

  correlationId: string;
}