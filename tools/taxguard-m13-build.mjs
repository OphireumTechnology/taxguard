///////////// M13 Part 1 of 4 — Business Entity Classification + Federal Return Family Registry
//////////// ///////////// Ophireum Multimedia Productions

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
  'src/taxguard/business/BusinessReturnArchitecture.ts',
  String.raw`
export type TaxGuardBusinessLegalEntityType =
  | 'SOLE_PROPRIETORSHIP'
  | 'LLC'
  | 'PARTNERSHIP'
  | 'CORPORATION'
  | 'OTHER';

export type TaxGuardBusinessTaxClassification =
  | 'DISREGARDED_ENTITY'
  | 'SOLE_PROPRIETOR'
  | 'PARTNERSHIP'
  | 'S_CORPORATION'
  | 'C_CORPORATION'
  | 'UNKNOWN';

export type TaxGuardFederalBusinessReturnFamily =
  | 'SCHEDULE_C'
  | 'FORM_1065'
  | 'FORM_1120_S'
  | 'FORM_1120'
  | 'UNRESOLVED';

export type TaxGuardBusinessClassificationStatus =
  | 'DRAFT'
  | 'VERIFIED'
  | 'REQUIRES_REVIEW'
  | 'SUPERSEDED';

export type TaxGuardBusinessRisk =
  | 'routine'
  | 'material'
  | 'critical';

export interface TaxGuardBusinessContext {
  clientId: string;

  engagementId: string;

  taxYear: number;

  correlationId: string;

  businessId: string;
}

export interface TaxGuardBusinessEvidenceReference {
  evidenceId: string;

  sourceDocumentId: string;

  provenanceDecisionId: string;
}

export interface TaxGuardBusinessClassificationRecord {
  classificationId: string;

  context:
    TaxGuardBusinessContext;

  legalEntityType:
    TaxGuardBusinessLegalEntityType;

  taxClassification:
    TaxGuardBusinessTaxClassification;

  returnFamily:
    TaxGuardFederalBusinessReturnFamily;

  authorityIds:
    readonly string[];

  ruleIds:
    readonly string[];

  evidence:
    readonly TaxGuardBusinessEvidenceReference[];

  status:
    TaxGuardBusinessClassificationStatus;

  risk:
    TaxGuardBusinessRisk;

  requiresProfessionalReview:
    boolean;

  reviewReasons:
    readonly string[];

  classifiedBy: string;

  verifiedBy?: string;

  createdAt: string;

  verifiedAt?: string;

  deterministic: true;

  aiFinalClassification:
    false;

  immutable: true;
}

export interface TaxGuardBusinessReturnFamilyDefinition {
  definitionId: string;

  returnFamily:
    TaxGuardFederalBusinessReturnFamily;

  taxYear: number;

  ruleIds:
    readonly string[];

  authorityIds:
    readonly string[];

  requiredFactPaths:
    readonly string[];

  requiredEvidenceTypes:
    readonly string[];

  requiresProfessionalReview:
    boolean;

  verifiedBy: string;

  verifiedAt: string;

  verified: true;

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

function validateTaxYear(
  taxYear: number
): void {

  if (
    !Number.isInteger(
      taxYear
    ) ||
    taxYear < 1900 ||
    taxYear > 2200
  ) {
    throw new Error(
      'TG_BUSINESS_INVALID_TAX_YEAR'
    );
  }
}

function unique(
  values: readonly string[]
): string[] {

  return [
    ...new Set(
      values
        .map(
          value =>
            value.trim()
        )
        .filter(Boolean)
    )
  ];
}

function cloneContext(
  context:
    TaxGuardBusinessContext
): TaxGuardBusinessContext {

  return {
    ...context
  };
}

function cloneEvidence(
  evidence:
    readonly TaxGuardBusinessEvidenceReference[]
):
  TaxGuardBusinessEvidenceReference[] {

  return evidence.map(
    item => ({
      ...item
    })
  );
}

export class TaxGuardBusinessReturnFamilyResolver {

  static resolve(
    input: {
      legalEntityType:
        TaxGuardBusinessLegalEntityType;

      taxClassification:
        TaxGuardBusinessTaxClassification;
    }
  ):
    TaxGuardFederalBusinessReturnFamily {

    /*
     * IMPORTANT:
     *
     * "LLC" is a legal entity type, not by itself
     * a federal income-tax return classification.
     *
     * TaxGuard therefore resolves the federal
     * return family from VERIFIED tax classification,
     * not merely from the LLC label.
     */

    switch (
      input.taxClassification
    ) {

      case 'SOLE_PROPRIETOR':
      case 'DISREGARDED_ENTITY':
        return 'SCHEDULE_C';

      case 'PARTNERSHIP':
        return 'FORM_1065';

      case 'S_CORPORATION':
        return 'FORM_1120_S';

      case 'C_CORPORATION':
        return 'FORM_1120';

      case 'UNKNOWN':
      default:
        return 'UNRESOLVED';
    }
  }
}

export class TaxGuardBusinessClassificationRegistry {

  private readonly records =
    new Map<
      string,
      TaxGuardBusinessClassificationRecord
    >();

  createDraft(
    input: {
      classificationId: string;

      context:
        TaxGuardBusinessContext;

      legalEntityType:
        TaxGuardBusinessLegalEntityType;

      taxClassification:
        TaxGuardBusinessTaxClassification;

      authorityIds:
        readonly string[];

      ruleIds:
        readonly string[];

      evidence:
        readonly TaxGuardBusinessEvidenceReference[];

      risk:
        TaxGuardBusinessRisk;

      classifiedBy: string;
    }
  ):
    TaxGuardBusinessClassificationRecord {

    requireText(
      input.classificationId,
      'TG_BUSINESS_CLASSIFICATION_ID_REQUIRED'
    );

    requireText(
      input.context.clientId,
      'TG_BUSINESS_CLIENT_ID_REQUIRED'
    );

    requireText(
      input.context.engagementId,
      'TG_BUSINESS_ENGAGEMENT_ID_REQUIRED'
    );

    requireText(
      input.context.correlationId,
      'TG_BUSINESS_CORRELATION_ID_REQUIRED'
    );

    requireText(
      input.context.businessId,
      'TG_BUSINESS_ID_REQUIRED'
    );

    requireText(
      input.classifiedBy,
      'TG_BUSINESS_CLASSIFIER_REQUIRED'
    );

    validateTaxYear(
      input.context.taxYear
    );

    if (
      this.records.has(
        input.classificationId
      )
    ) {
      throw new Error(
        'TG_BUSINESS_CLASSIFICATION_DUPLICATE'
      );
    }

    const returnFamily =
      TaxGuardBusinessReturnFamilyResolver
        .resolve({
          legalEntityType:
            input.legalEntityType,

          taxClassification:
            input.taxClassification
        });

    const reviewReasons:
      string[] = [];

    if (
      input.taxClassification ===
        'UNKNOWN'
    ) {
      reviewReasons.push(
        'BUSINESS_TAX_CLASSIFICATION_UNRESOLVED'
      );
    }

    if (
      returnFamily ===
        'UNRESOLVED'
    ) {
      reviewReasons.push(
        'BUSINESS_RETURN_FAMILY_UNRESOLVED'
      );
    }

    if (
      input.authorityIds.length === 0
    ) {
      reviewReasons.push(
        'BUSINESS_AUTHORITY_REQUIRED'
      );
    }

    if (
      input.ruleIds.length === 0
    ) {
      reviewReasons.push(
        'BUSINESS_RULE_REQUIRED'
      );
    }

    if (
      input.evidence.length === 0
    ) {
      reviewReasons.push(
        'BUSINESS_CLASSIFICATION_EVIDENCE_REQUIRED'
      );
    }

    for (
      const evidence
      of input.evidence
    ) {
      requireText(
        evidence.evidenceId,
        'TG_BUSINESS_EVIDENCE_ID_REQUIRED'
      );

      requireText(
        evidence.sourceDocumentId,
        'TG_BUSINESS_SOURCE_DOCUMENT_REQUIRED'
      );

      requireText(
        evidence.provenanceDecisionId,
        'TG_BUSINESS_PROVENANCE_REQUIRED'
      );
    }

    const requiresProfessionalReview =
      input.risk !==
        'routine' ||
      reviewReasons.length > 0 ||
      input.legalEntityType ===
        'LLC';

    const status:
      TaxGuardBusinessClassificationStatus =
        reviewReasons.length > 0
          ? 'REQUIRES_REVIEW'
          : 'DRAFT';

    const record:
      TaxGuardBusinessClassificationRecord =
        Object.freeze({
          classificationId:
            input.classificationId,

          context:
            cloneContext(
              input.context
            ),

          legalEntityType:
            input.legalEntityType,

          taxClassification:
            input.taxClassification,

          returnFamily,

          authorityIds:
            unique(
              input.authorityIds
            ),

          ruleIds:
            unique(
              input.ruleIds
            ),

          evidence:
            cloneEvidence(
              input.evidence
            ),

          status,

          risk:
            input.risk,

          requiresProfessionalReview,

          reviewReasons:
            unique(
              reviewReasons
            ),

          classifiedBy:
            input.classifiedBy,

          createdAt:
            new Date()
              .toISOString(),

          deterministic:
            true,

          aiFinalClassification:
            false,

          immutable:
            true
        });

    this.records.set(
      record.classificationId,
      record
    );

    return this.clone(
      record
    );
  }

  verify(
    classificationId: string,

    input: {
      verifiedBy: string;

      authorityIds?:
        readonly string[];

      ruleIds?:
        readonly string[];

      evidence?:
        readonly TaxGuardBusinessEvidenceReference[];
    }
  ):
    TaxGuardBusinessClassificationRecord {

    requireText(
      input.verifiedBy,
      'TG_BUSINESS_CLASSIFICATION_VERIFIER_REQUIRED'
    );

    const current =
      this.requireInternal(
        classificationId
      );

    if (
      current.status ===
        'VERIFIED'
    ) {
      throw new Error(
        'TG_BUSINESS_CLASSIFICATION_ALREADY_VERIFIED'
      );
    }

    if (
      current.status ===
        'SUPERSEDED'
    ) {
      throw new Error(
        'TG_BUSINESS_CLASSIFICATION_SUPERSEDED'
      );
    }

    const authorityIds =
      unique(
        input.authorityIds ??
        current.authorityIds
      );

    const ruleIds =
      unique(
        input.ruleIds ??
        current.ruleIds
      );

    const evidence =
      cloneEvidence(
        input.evidence ??
        current.evidence
      );

    if (
      current.taxClassification ===
        'UNKNOWN' ||
      current.returnFamily ===
        'UNRESOLVED'
    ) {
      throw new Error(
        'TG_BUSINESS_CLASSIFICATION_UNRESOLVED'
      );
    }

    if (
      authorityIds.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_VERIFIED_AUTHORITY_REQUIRED'
      );
    }

    if (
      ruleIds.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_VERIFIED_RULE_REQUIRED'
      );
    }

    if (
      evidence.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_VERIFIED_EVIDENCE_REQUIRED'
      );
    }

    for (
      const item
      of evidence
    ) {
      requireText(
        item.evidenceId,
        'TG_BUSINESS_EVIDENCE_ID_REQUIRED'
      );

      requireText(
        item.sourceDocumentId,
        'TG_BUSINESS_SOURCE_DOCUMENT_REQUIRED'
      );

      requireText(
        item.provenanceDecisionId,
        'TG_BUSINESS_PROVENANCE_REQUIRED'
      );
    }

    const verified:
      TaxGuardBusinessClassificationRecord =
        Object.freeze({
          ...current,

          authorityIds,

          ruleIds,

          evidence,

          status:
            'VERIFIED',

          reviewReasons: [],

          verifiedBy:
            input.verifiedBy,

          verifiedAt:
            new Date()
              .toISOString()
        });

    this.records.set(
      classificationId,
      verified
    );

    return this.clone(
      verified
    );
  }

  get(
    classificationId: string
  ):
    TaxGuardBusinessClassificationRecord {

    return this.clone(
      this.requireInternal(
        classificationId
      )
    );
  }

  getVerified(
    classificationId: string
  ):
    TaxGuardBusinessClassificationRecord {

    const record =
      this.requireInternal(
        classificationId
      );

    if (
      record.status !==
        'VERIFIED'
    ) {
      throw new Error(
        'TG_BUSINESS_CLASSIFICATION_NOT_VERIFIED'
      );
    }

    return this.clone(
      record
    );
  }

  private requireInternal(
    classificationId: string
  ):
    TaxGuardBusinessClassificationRecord {

    const record =
      this.records.get(
        classificationId
      );

    if (!record) {
      throw new Error(
        'TG_BUSINESS_CLASSIFICATION_NOT_FOUND'
      );
    }

    return record;
  }

  private clone(
    record:
      TaxGuardBusinessClassificationRecord
  ):
    TaxGuardBusinessClassificationRecord {

    return {
      ...record,

      context: {
        ...record.context
      },

      authorityIds: [
        ...record.authorityIds
      ],

      ruleIds: [
        ...record.ruleIds
      ],

      evidence:
        cloneEvidence(
          record.evidence
        ),

      reviewReasons: [
        ...record.reviewReasons
      ]
    };
  }
}

export class TaxGuardBusinessReturnFamilyRegistry {

  private readonly definitions =
    new Map<
      string,
      TaxGuardBusinessReturnFamilyDefinition
    >();

  registerVerified(
    input: {
      definitionId: string;

      returnFamily:
        TaxGuardFederalBusinessReturnFamily;

      taxYear: number;

      ruleIds:
        readonly string[];

      authorityIds:
        readonly string[];

      requiredFactPaths?:
        readonly string[];

      requiredEvidenceTypes?:
        readonly string[];

      requiresProfessionalReview?:
        boolean;

      verifiedBy: string;
    }
  ):
    TaxGuardBusinessReturnFamilyDefinition {

    requireText(
      input.definitionId,
      'TG_BUSINESS_RETURN_DEFINITION_ID_REQUIRED'
    );

    requireText(
      input.verifiedBy,
      'TG_BUSINESS_RETURN_DEFINITION_VERIFIER_REQUIRED'
    );

    validateTaxYear(
      input.taxYear
    );

    if (
      input.returnFamily ===
        'UNRESOLVED'
    ) {
      throw new Error(
        'TG_BUSINESS_UNRESOLVED_RETURN_FAMILY_BLOCKED'
      );
    }

    if (
      input.ruleIds.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_RETURN_RULE_REQUIRED'
      );
    }

    if (
      input.authorityIds.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_RETURN_AUTHORITY_REQUIRED'
      );
    }

    if (
      this.definitions.has(
        input.definitionId
      )
    ) {
      throw new Error(
        'TG_BUSINESS_RETURN_DEFINITION_DUPLICATE'
      );
    }

    const definition:
      TaxGuardBusinessReturnFamilyDefinition =
        Object.freeze({
          definitionId:
            input.definitionId,

          returnFamily:
            input.returnFamily,

          taxYear:
            input.taxYear,

          ruleIds:
            unique(
              input.ruleIds
            ),

          authorityIds:
            unique(
              input.authorityIds
            ),

          requiredFactPaths:
            unique(
              input.requiredFactPaths ??
              []
            ),

          requiredEvidenceTypes:
            unique(
              input.requiredEvidenceTypes ??
              []
            ),

          requiresProfessionalReview:
            input.requiresProfessionalReview ??
            true,

          verifiedBy:
            input.verifiedBy,

          verifiedAt:
            new Date()
              .toISOString(),

          verified:
            true,

          immutable:
            true
        });

    this.definitions.set(
      definition.definitionId,
      definition
    );

    return this.clone(
      definition
    );
  }

  getVerified(
    definitionId: string
  ):
    TaxGuardBusinessReturnFamilyDefinition {

    const definition =
      this.definitions.get(
        definitionId
      );

    if (!definition) {
      throw new Error(
        'TG_BUSINESS_RETURN_DEFINITION_NOT_FOUND'
      );
    }

    return this.clone(
      definition
    );
  }

  findVerified(
    returnFamily:
      TaxGuardFederalBusinessReturnFamily,

    taxYear: number
  ):
    TaxGuardBusinessReturnFamilyDefinition {

    validateTaxYear(
      taxYear
    );

    const definition =
      [
        ...this.definitions.values()
      ].find(
        item =>
          item.returnFamily ===
            returnFamily &&
          item.taxYear ===
            taxYear &&
          item.verified
      );

    if (!definition) {
      throw new Error(
        'TG_BUSINESS_VERIFIED_RETURN_DEFINITION_NOT_FOUND'
      );
    }

    return this.clone(
      definition
    );
  }

  private clone(
    definition:
      TaxGuardBusinessReturnFamilyDefinition
  ):
    TaxGuardBusinessReturnFamilyDefinition {

    return {
      ...definition,

      ruleIds: [
        ...definition.ruleIds
      ],

      authorityIds: [
        ...definition.authorityIds
      ],

      requiredFactPaths: [
        ...definition.requiredFactPaths
      ],

      requiredEvidenceTypes: [
        ...definition.requiredEvidenceTypes
      ]
    };
  }
}

export class TaxGuardBusinessClassificationBoundary {

  static aiCreateVerifiedClassification():
    never {

    throw new Error(
      'TG_BUSINESS_AI_VERIFIED_CLASSIFICATION_BLOCKED'
    );
  }

  static guessTaxClassification():
    never {

    throw new Error(
      'TG_BUSINESS_TAX_CLASSIFICATION_GUESS_BLOCKED'
    );
  }

  static inferReturnFamilyWithoutVerifiedClassification():
    never {

    throw new Error(
      'TG_BUSINESS_UNVERIFIED_RETURN_FAMILY_BLOCKED'
    );
  }
}
`
);

////// 
Sole proprietor / qualifying disregarded treatment
    → Schedule C architecture

Partnership classification
    → Form 1065 architecture

S corporation classification
    → Form 1120-S architecture

C corporation classification
    → Form 1120 architecture

////// M13 also continues the existing TaxGuard controls: evidence + source document + provenance are required for verified classification, unresolved classification fails closed, and AI cannot create the final verified business tax classification.

///////M13 Part 2 of 4 — Business Facts, Evidence, Federal Dependencies & Deterministic Calculation
write(
  'src/taxguard/business/BusinessReturnCalculation.ts',
  String.raw`
import type {
  TaxGuardBusinessContext,
  TaxGuardBusinessClassificationRecord,
  TaxGuardBusinessReturnFamilyDefinition
} from './BusinessReturnArchitecture';

export type TaxGuardBusinessFactValue =
  | string
  | number
  | boolean;

export interface TaxGuardBusinessValidatedFact {
  factId: string;
  context: TaxGuardBusinessContext;
  factPath: string;
  value: TaxGuardBusinessFactValue;
  evidenceIds: readonly string[];
  sourceDocumentIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  validatedBy: string;
  validatedAt: string;
  validated: true;
  aiProposedOnly: false;
  immutable: true;
}

export interface TaxGuardBusinessFederalDependency {
  dependencyId: string;
  context: TaxGuardBusinessContext;
  dependencyType:
    | 'OWNER_INDIVIDUAL_RETURN'
    | 'PRIOR_YEAR_RETURN'
    | 'PAYROLL'
    | 'INFORMATION_RETURN'
    | 'OTHER_VERIFIED_FEDERAL_DEPENDENCY';
  sourceCalculationId?: string;
  sourceReturnId?: string;
  factPath: string;
  value: string;
  evidenceIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  verified: true;
  immutable: true;
}

export interface TaxGuardBusinessCalculationInput {
  inputId: string;
  factPath: string;
  value: string;
  evidenceIds: readonly string[];
  sourceDocumentIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  validated: true;
}

export interface TaxGuardBusinessCalculationDefinition {
  calculationDefinitionId: string;
  returnFamilyDefinitionId: string;
  returnFamily:
    TaxGuardBusinessReturnFamilyDefinition['returnFamily'];
  taxYear: number;
  calculationType: string;
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  requiredFactPaths: readonly string[];
  requiredDependencyIds: readonly string[];
  requiresProfessionalReview: boolean;
  verifiedBy: string;
  verifiedAt: string;
  verified: true;
  immutable: true;
}

export interface TaxGuardBusinessCalculationTraceEntry {
  traceId: string;
  sequence: number;
  operation:
    | 'INPUT'
    | 'DEPENDENCY'
    | 'RESULT';
  sourceIds: readonly string[];
  value: string;
  immutable: true;
}

export interface TaxGuardBusinessCalculationResult {
  calculationId: string;
  context: TaxGuardBusinessContext;
  classificationId: string;
  returnFamily:
    TaxGuardBusinessReturnFamilyDefinition['returnFamily'];
  calculationDefinitionId: string;
  calculationType: string;
  value: string;
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  evidenceIds: readonly string[];
  sourceDocumentIds: readonly string[];
  dependencyIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  trace:
    readonly TaxGuardBusinessCalculationTraceEntry[];
  requiresHumanReview: boolean;
  reviewReasons: readonly string[];
  deterministic: true;
  aiCalculated: false;
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

function validateTaxYear(
  taxYear: number
): void {

  if (
    !Number.isInteger(
      taxYear
    ) ||
    taxYear < 1900 ||
    taxYear > 2200
  ) {
    throw new Error(
      'TG_BUSINESS_CALC_INVALID_TAX_YEAR'
    );
  }
}

function unique(
  values: readonly string[]
): string[] {

  return [
    ...new Set(
      values
        .map(
          value =>
            value.trim()
        )
        .filter(Boolean)
    )
  ];
}

function cloneContext(
  context:
    TaxGuardBusinessContext
): TaxGuardBusinessContext {

  return {
    ...context
  };
}

function sameContext(
  left:
    TaxGuardBusinessContext,
  right:
    TaxGuardBusinessContext
): boolean {

  return (
    left.clientId ===
      right.clientId &&
    left.engagementId ===
      right.engagementId &&
    left.taxYear ===
      right.taxYear &&
    left.correlationId ===
      right.correlationId &&
    left.businessId ===
      right.businessId
  );
}

function parseDecimal(
  value: string
): number {

  const normalized =
    value.trim();

  if (
    !/^-?\d+(?:\.\d+)?$/
      .test(normalized)
  ) {
    throw new Error(
      'TG_BUSINESS_CALC_INVALID_DECIMAL'
    );
  }

  const parsed =
    Number(normalized);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    throw new Error(
      'TG_BUSINESS_CALC_INVALID_DECIMAL'
    );
  }

  return parsed;
}

function normalizeDecimal(
  value: number
): string {

  if (
    !Number.isFinite(
      value
    )
  ) {
    throw new Error(
      'TG_BUSINESS_CALC_NON_FINITE_RESULT'
    );
  }

  return value.toFixed(2);
}

export class TaxGuardBusinessValidatedFactRegistry {

  private readonly facts =
    new Map<
      string,
      TaxGuardBusinessValidatedFact
    >();

  register(
    input: {
      factId: string;
      context:
        TaxGuardBusinessContext;
      factPath: string;
      value:
        TaxGuardBusinessFactValue;
      evidenceIds:
        readonly string[];
      sourceDocumentIds:
        readonly string[];
      provenanceDecisionIds:
        readonly string[];
      validatedBy: string;
    }
  ):
    TaxGuardBusinessValidatedFact {

    requireText(
      input.factId,
      'TG_BUSINESS_FACT_ID_REQUIRED'
    );

    requireText(
      input.factPath,
      'TG_BUSINESS_FACT_PATH_REQUIRED'
    );

    requireText(
      input.validatedBy,
      'TG_BUSINESS_FACT_VALIDATOR_REQUIRED'
    );

    validateTaxYear(
      input.context.taxYear
    );

    if (
      input.evidenceIds.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_FACT_EVIDENCE_REQUIRED'
      );
    }

    if (
      input.sourceDocumentIds
        .length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_FACT_SOURCE_REQUIRED'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_FACT_PROVENANCE_REQUIRED'
      );
    }

    if (
      this.facts.has(
        input.factId
      )
    ) {
      throw new Error(
        'TG_BUSINESS_FACT_DUPLICATE'
      );
    }

    const record:
      TaxGuardBusinessValidatedFact =
        Object.freeze({
          factId:
            input.factId,

          context:
            cloneContext(
              input.context
            ),

          factPath:
            input.factPath,

          value:
            input.value,

          evidenceIds:
            unique(
              input.evidenceIds
            ),

          sourceDocumentIds:
            unique(
              input.sourceDocumentIds
            ),

          provenanceDecisionIds:
            unique(
              input.provenanceDecisionIds
            ),

          validatedBy:
            input.validatedBy,

          validatedAt:
            new Date()
              .toISOString(),

          validated:
            true,

          aiProposedOnly:
            false,

          immutable:
            true
        });

    this.facts.set(
      record.factId,
      record
    );

    return this.clone(
      record
    );
  }

  get(
    factId: string
  ):
    TaxGuardBusinessValidatedFact {

    const fact =
      this.facts.get(
        factId
      );

    if (!fact) {
      throw new Error(
        'TG_BUSINESS_FACT_NOT_FOUND'
      );
    }

    return this.clone(
      fact
    );
  }

  findByPath(
    context:
      TaxGuardBusinessContext,
    factPath: string
  ):
    TaxGuardBusinessValidatedFact {

    const fact =
      [
        ...this.facts.values()
      ].find(
        item =>
          sameContext(
            item.context,
            context
          ) &&
          item.factPath ===
            factPath
      );

    if (!fact) {
      throw new Error(
        'TG_BUSINESS_REQUIRED_FACT_NOT_FOUND'
      );
    }

    return this.clone(
      fact
    );
  }

  private clone(
    fact:
      TaxGuardBusinessValidatedFact
  ):
    TaxGuardBusinessValidatedFact {

    return {
      ...fact,

      context: {
        ...fact.context
      },

      evidenceIds: [
        ...fact.evidenceIds
      ],

      sourceDocumentIds: [
        ...fact.sourceDocumentIds
      ],

      provenanceDecisionIds: [
        ...fact.provenanceDecisionIds
      ]
    };
  }
}

export class TaxGuardBusinessFederalDependencyRegistry {

  private readonly dependencies =
    new Map<
      string,
      TaxGuardBusinessFederalDependency
    >();

  registerVerified(
    input: {
      dependencyId: string;

      context:
        TaxGuardBusinessContext;

      dependencyType:
        TaxGuardBusinessFederalDependency[
          'dependencyType'
        ];

      sourceCalculationId?: string;

      sourceReturnId?: string;

      factPath: string;

      value: string;

      evidenceIds:
        readonly string[];

      provenanceDecisionIds:
        readonly string[];
    }
  ):
    TaxGuardBusinessFederalDependency {

    requireText(
      input.dependencyId,
      'TG_BUSINESS_DEPENDENCY_ID_REQUIRED'
    );

    requireText(
      input.factPath,
      'TG_BUSINESS_DEPENDENCY_FACT_PATH_REQUIRED'
    );

    parseDecimal(
      input.value
    );

    if (
      !input.sourceCalculationId &&
      !input.sourceReturnId
    ) {
      throw new Error(
        'TG_BUSINESS_DEPENDENCY_SOURCE_REQUIRED'
      );
    }

    if (
      input.evidenceIds.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_DEPENDENCY_EVIDENCE_REQUIRED'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_DEPENDENCY_PROVENANCE_REQUIRED'
      );
    }

    if (
      this.dependencies.has(
        input.dependencyId
      )
    ) {
      throw new Error(
        'TG_BUSINESS_DEPENDENCY_DUPLICATE'
      );
    }

    const record:
      TaxGuardBusinessFederalDependency =
        Object.freeze({
          dependencyId:
            input.dependencyId,

          context:
            cloneContext(
              input.context
            ),

          dependencyType:
            input.dependencyType,

          sourceCalculationId:
            input.sourceCalculationId,

          sourceReturnId:
            input.sourceReturnId,

          factPath:
            input.factPath,

          value:
            input.value,

          evidenceIds:
            unique(
              input.evidenceIds
            ),

          provenanceDecisionIds:
            unique(
              input.provenanceDecisionIds
            ),

          verified:
            true,

          immutable:
            true
        });

    this.dependencies.set(
      record.dependencyId,
      record
    );

    return this.clone(
      record
    );
  }

  get(
    dependencyId: string
  ):
    TaxGuardBusinessFederalDependency {

    const record =
      this.dependencies.get(
        dependencyId
      );

    if (!record) {
      throw new Error(
        'TG_BUSINESS_DEPENDENCY_NOT_FOUND'
      );
    }

    return this.clone(
      record
    );
  }

  private clone(
    record:
      TaxGuardBusinessFederalDependency
  ):
    TaxGuardBusinessFederalDependency {

    return {
      ...record,

      context: {
        ...record.context
      },

      evidenceIds: [
        ...record.evidenceIds
      ],

      provenanceDecisionIds: [
        ...record.provenanceDecisionIds
      ]
    };
  }
}

export class TaxGuardBusinessCalculationDefinitionRegistry {

  private readonly definitions =
    new Map<
      string,
      TaxGuardBusinessCalculationDefinition
    >();

  registerVerified(
    input: {
      calculationDefinitionId:
        string;

      returnFamilyDefinition:
        TaxGuardBusinessReturnFamilyDefinition;

      calculationType: string;

      requiredFactPaths?:
        readonly string[];

      requiredDependencyIds?:
        readonly string[];

      requiresProfessionalReview?:
        boolean;

      verifiedBy: string;
    }
  ):
    TaxGuardBusinessCalculationDefinition {

    requireText(
      input.calculationDefinitionId,
      'TG_BUSINESS_CALC_DEFINITION_ID_REQUIRED'
    );

    requireText(
      input.calculationType,
      'TG_BUSINESS_CALC_TYPE_REQUIRED'
    );

    requireText(
      input.verifiedBy,
      'TG_BUSINESS_CALC_VERIFIER_REQUIRED'
    );

    if (
      !input.returnFamilyDefinition
        .verified
    ) {
      throw new Error(
        'TG_BUSINESS_RETURN_FAMILY_NOT_VERIFIED'
      );
    }

    if (
      input.returnFamilyDefinition
        .returnFamily ===
        'UNRESOLVED'
    ) {
      throw new Error(
        'TG_BUSINESS_UNRESOLVED_CALCULATION_BLOCKED'
      );
    }

    if (
      this.definitions.has(
        input.calculationDefinitionId
      )
    ) {
      throw new Error(
        'TG_BUSINESS_CALC_DEFINITION_DUPLICATE'
      );
    }

    const definition:
      TaxGuardBusinessCalculationDefinition =
        Object.freeze({
          calculationDefinitionId:
            input.calculationDefinitionId,

          returnFamilyDefinitionId:
            input.returnFamilyDefinition
              .definitionId,

          returnFamily:
            input.returnFamilyDefinition
              .returnFamily,

          taxYear:
            input.returnFamilyDefinition
              .taxYear,

          calculationType:
            input.calculationType,

          ruleIds: [
            ...input.returnFamilyDefinition
              .ruleIds
          ],

          authorityIds: [
            ...input.returnFamilyDefinition
              .authorityIds
          ],

          requiredFactPaths:
            unique(
              input.requiredFactPaths ??
              input.returnFamilyDefinition
                .requiredFactPaths
            ),

          requiredDependencyIds:
            unique(
              input.requiredDependencyIds ??
              []
            ),

          requiresProfessionalReview:
            input.requiresProfessionalReview ??
            input.returnFamilyDefinition
              .requiresProfessionalReview,

          verifiedBy:
            input.verifiedBy,

          verifiedAt:
            new Date()
              .toISOString(),

          verified:
            true,

          immutable:
            true
        });

    this.definitions.set(
      definition
        .calculationDefinitionId,
      definition
    );

    return this.clone(
      definition
    );
  }

  getVerified(
    calculationDefinitionId:
      string
  ):
    TaxGuardBusinessCalculationDefinition {

    const definition =
      this.definitions.get(
        calculationDefinitionId
      );

    if (!definition) {
      throw new Error(
        'TG_BUSINESS_CALC_DEFINITION_NOT_FOUND'
      );
    }

    return this.clone(
      definition
    );
  }

  private clone(
    definition:
      TaxGuardBusinessCalculationDefinition
  ):
    TaxGuardBusinessCalculationDefinition {

    return {
      ...definition,

      ruleIds: [
        ...definition.ruleIds
      ],

      authorityIds: [
        ...definition.authorityIds
      ],

      requiredFactPaths: [
        ...definition.requiredFactPaths
      ],

      requiredDependencyIds: [
        ...definition
          .requiredDependencyIds
      ]
    };
  }
}

export class TaxGuardBusinessCalculationEngine {

  calculate(
    input: {
      calculationId: string;

      context:
        TaxGuardBusinessContext;

      classification:
        TaxGuardBusinessClassificationRecord;

      definition:
        TaxGuardBusinessCalculationDefinition;

      businessInputs:
        readonly TaxGuardBusinessCalculationInput[];

      dependencies:
        readonly TaxGuardBusinessFederalDependency[];

      provenanceDecisionIds:
        readonly string[];
    }
  ):
    TaxGuardBusinessCalculationResult {

    requireText(
      input.calculationId,
      'TG_BUSINESS_CALC_ID_REQUIRED'
    );

    validateTaxYear(
      input.context.taxYear
    );

    if (
      input.classification.status !==
        'VERIFIED'
    ) {
      throw new Error(
        'TG_BUSINESS_CALC_CLASSIFICATION_NOT_VERIFIED'
      );
    }

    if (
      !sameContext(
        input.classification.context,
        input.context
      )
    ) {
      throw new Error(
        'TG_BUSINESS_CALC_CLASSIFICATION_CONTEXT_MISMATCH'
      );
    }

    if (
      input.classification
        .returnFamily !==
        input.definition
          .returnFamily
    ) {
      throw new Error(
        'TG_BUSINESS_CALC_RETURN_FAMILY_MISMATCH'
      );
    }

    if (
      input.definition.taxYear !==
        input.context.taxYear
    ) {
      throw new Error(
        'TG_BUSINESS_CALC_TAX_YEAR_MISMATCH'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_CALC_PROVENANCE_REQUIRED'
      );
    }

    const factPaths =
      new Set(
        input.businessInputs.map(
          item =>
            item.factPath
        )
      );

    for (
      const requiredFactPath
      of input.definition
        .requiredFactPaths
    ) {
      if (
        !factPaths.has(
          requiredFactPath
        )
      ) {
        throw new Error(
          'TG_BUSINESS_CALC_REQUIRED_FACT_MISSING:' +
          requiredFactPath
        );
      }
    }

    const dependencyIds =
      new Set(
        input.dependencies.map(
          dependency =>
            dependency.dependencyId
        )
      );

    for (
      const requiredDependencyId
      of input.definition
        .requiredDependencyIds
    ) {
      if (
        !dependencyIds.has(
          requiredDependencyId
        )
      ) {
        throw new Error(
          'TG_BUSINESS_CALC_DEPENDENCY_MISSING:' +
          requiredDependencyId
        );
      }
    }

    for (
      const businessInput
      of input.businessInputs
    ) {
      if (
        !businessInput.validated
      ) {
        throw new Error(
          'TG_BUSINESS_CALC_UNVALIDATED_INPUT'
        );
      }

      if (
        businessInput.evidenceIds
          .length === 0 ||
        businessInput.sourceDocumentIds
          .length === 0 ||
        businessInput.provenanceDecisionIds
          .length === 0
      ) {
        throw new Error(
          'TG_BUSINESS_CALC_INPUT_PROVENANCE_INCOMPLETE'
        );
      }

      parseDecimal(
        businessInput.value
      );
    }

    for (
      const dependency
      of input.dependencies
    ) {
      if (
        !sameContext(
          dependency.context,
          input.context
        )
      ) {
        throw new Error(
          'TG_BUSINESS_CALC_DEPENDENCY_CONTEXT_MISMATCH'
        );
      }

      if (!dependency.verified) {
        throw new Error(
          'TG_BUSINESS_CALC_DEPENDENCY_NOT_VERIFIED'
        );
      }

      parseDecimal(
        dependency.value
      );
    }

    /*
     * M13 is the business-return architecture
     * foundation. It does NOT encode statutory
     * Form 1065, 1120-S, 1120 or Schedule C
     * formulas here.
     *
     * The deterministic aggregation below is
     * synthetic infrastructure used to exercise
     * verified facts, dependencies, evidence,
     * provenance and downstream return assembly.
     *
     * Real tax calculations require separately
     * verified tax-year-specific rule/calculation
     * definitions.
     */

    let total = 0;

    let sequence = 1;

    const trace:
      TaxGuardBusinessCalculationTraceEntry[] =
        [];

    for (
      const businessInput
      of input.businessInputs
    ) {
      const value =
        parseDecimal(
          businessInput.value
        );

      total += value;

      trace.push(
        Object.freeze({
          traceId:
            input.calculationId +
            '-TRACE-' +
            sequence,

          sequence,

          operation:
            'INPUT',

          sourceIds: [
            businessInput.inputId
          ],

          value:
            normalizeDecimal(
              value
            ),

          immutable:
            true
        })
      );

      sequence += 1;
    }

    for (
      const dependency
      of input.dependencies
    ) {
      const value =
        parseDecimal(
          dependency.value
        );

      total += value;

      trace.push(
        Object.freeze({
          traceId:
            input.calculationId +
            '-TRACE-' +
            sequence,

          sequence,

          operation:
            'DEPENDENCY',

          sourceIds: [
            dependency.dependencyId
          ],

          value:
            normalizeDecimal(
              value
            ),

          immutable:
            true
        })
      );

      sequence += 1;
    }

    trace.push(
      Object.freeze({
        traceId:
          input.calculationId +
          '-TRACE-' +
          sequence,

        sequence,

        operation:
          'RESULT',

        sourceIds: [
          ...input.businessInputs
            .map(
              item =>
                item.inputId
            ),

          ...input.dependencies
            .map(
              item =>
                item.dependencyId
            )
        ],

        value:
          normalizeDecimal(
            total
          ),

        immutable:
          true
      })
    );

    const reviewReasons =
      input.definition
        .requiresProfessionalReview
        ? [
            'BUSINESS_CALCULATION_PROFESSIONAL_REVIEW_REQUIRED'
          ]
        : [];

    return Object.freeze({
      calculationId:
        input.calculationId,

      context:
        cloneContext(
          input.context
        ),

      classificationId:
        input.classification
          .classificationId,

      returnFamily:
        input.classification
          .returnFamily,

      calculationDefinitionId:
        input.definition
          .calculationDefinitionId,

      calculationType:
        input.definition
          .calculationType,

      value:
        normalizeDecimal(
          total
        ),

      ruleIds: [
        ...input.definition.ruleIds
      ],

      authorityIds: [
        ...input.definition
          .authorityIds
      ],

      evidenceIds:
        unique([
          ...input.businessInputs
            .flatMap(
              item =>
                item.evidenceIds
            ),

          ...input.dependencies
            .flatMap(
              item =>
                item.evidenceIds
            )
        ]),

      sourceDocumentIds:
        unique(
          input.businessInputs
            .flatMap(
              item =>
                item.sourceDocumentIds
            )
        ),

      dependencyIds:
        input.dependencies.map(
          item =>
            item.dependencyId
        ),

      provenanceDecisionIds:
        unique([
          ...input.provenanceDecisionIds,

          ...input.businessInputs
            .flatMap(
              item =>
                item.provenanceDecisionIds
            ),

          ...input.dependencies
            .flatMap(
              item =>
                item.provenanceDecisionIds
            )
        ]),

      trace,

      requiresHumanReview:
        input.definition
          .requiresProfessionalReview,

      reviewReasons,

      deterministic:
        true,

      aiCalculated:
        false,

      immutable:
        true
    });
  }
}

export class TaxGuardBusinessCalculationBoundary {

  static aiCalculateFinalLiability():
    never {

    throw new Error(
      'TG_BUSINESS_AI_FINAL_CALCULATION_BLOCKED'
    );
  }

  static guessMissingFact():
    never {

    throw new Error(
      'TG_BUSINESS_MISSING_FACT_GUESS_BLOCKED'
    );
  }

  static guessMissingAuthority():
    never {

    throw new Error(
      'TG_BUSINESS_MISSING_AUTHORITY_GUESS_BLOCKED'
    );
  }
}
`
);

////////////////Verified business classification
        ↓
Verified return-family definition
        ↓
Validated business facts
        +
Verified dependencies
        ↓
Verified calculation definition
        ↓
Deterministic calculation
        ↓
Evidence + source + provenance trace


//////////////////As with M12, the arithmetic here is deliberately synthetic infrastructure, not a real Form 1065, 1120-S, 1120, or Schedule C tax computation. We will not hard-code statutory calculations until the corresponding tax-year rule packs and authorities are verified.

write(
  'src/taxguard/business/BusinessReturnPreparation.ts',
  String.raw`
import type {
  TaxGuardBusinessContext,
  TaxGuardBusinessClassificationRecord,
  TaxGuardFederalBusinessReturnFamily
} from './BusinessReturnArchitecture';

import type {
  TaxGuardBusinessCalculationResult
} from './BusinessReturnCalculation';

export interface TaxGuardBusinessFormLineBinding {
  bindingId: string;

  formId: string;

  lineId: string;

  calculationId: string;

  calculationType: string;

  value: string;

  ruleIds:
    readonly string[];

  authorityIds:
    readonly string[];

  evidenceIds:
    readonly string[];

  provenanceDecisionIds:
    readonly string[];

  immutable: true;
}

export interface TaxGuardPreparedBusinessReturn {
  preparedBusinessReturnId: string;

  context:
    TaxGuardBusinessContext;

  classificationId: string;

  returnFamily:
    TaxGuardFederalBusinessReturnFamily;

  formIds:
    readonly string[];

  lineBindings:
    readonly TaxGuardBusinessFormLineBinding[];

  calculationIds:
    readonly string[];

  ruleIds:
    readonly string[];

  authorityIds:
    readonly string[];

  evidenceIds:
    readonly string[];

  sourceDocumentIds:
    readonly string[];

  provenanceDecisionIds:
    readonly string[];

  requiresHumanReview: boolean;

  reviewReasons:
    readonly string[];

  assembledAt: string;

  deterministic: true;

  aiPrepared: false;

  externalFilingEnabled: false;

  immutable: true;
}

export interface TaxGuardBusinessReconciliationResult {
  valid: boolean;

  reasons:
    readonly string[];
}

export interface TaxGuardBusinessProfessionalApproval {
  approvalId: string;

  context:
    TaxGuardBusinessContext;

  preparedBusinessReturnId: string;

  returnVersionId: string;

  requestedBy: string;

  approvedBy: string;

  approvedByRole:
    | 'REVIEWER'
    | 'CPA'
    | 'EA';

  provenanceDecisionId: string;

  approvedAt: string;

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

function unique(
  values: readonly string[]
): string[] {

  return [
    ...new Set(
      values
        .map(
          value =>
            value.trim()
        )
        .filter(Boolean)
    )
  ];
}

function cloneContext(
  context:
    TaxGuardBusinessContext
): TaxGuardBusinessContext {

  return {
    ...context
  };
}

function sameContext(
  left:
    TaxGuardBusinessContext,

  right:
    TaxGuardBusinessContext
): boolean {

  return (
    left.clientId ===
      right.clientId &&

    left.engagementId ===
      right.engagementId &&

    left.taxYear ===
      right.taxYear &&

    left.correlationId ===
      right.correlationId &&

    left.businessId ===
      right.businessId
  );
}

export class TaxGuardBusinessFormMappingEngine {

  map(
    input: {
      bindingId: string;

      formId: string;

      lineId: string;

      calculation:
        TaxGuardBusinessCalculationResult;
    }
  ):
    TaxGuardBusinessFormLineBinding {

    requireText(
      input.bindingId,
      'TG_BUSINESS_FORM_BINDING_ID_REQUIRED'
    );

    requireText(
      input.formId,
      'TG_BUSINESS_FORM_ID_REQUIRED'
    );

    requireText(
      input.lineId,
      'TG_BUSINESS_FORM_LINE_REQUIRED'
    );

    if (
      input.calculation.ruleIds
        .length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_FORM_RULE_REQUIRED'
      );
    }

    if (
      input.calculation.authorityIds
        .length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_FORM_AUTHORITY_REQUIRED'
      );
    }

    if (
      input.calculation.evidenceIds
        .length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_FORM_EVIDENCE_REQUIRED'
      );
    }

    if (
      input.calculation
        .provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_FORM_PROVENANCE_REQUIRED'
      );
    }

    return Object.freeze({
      bindingId:
        input.bindingId,

      formId:
        input.formId,

      lineId:
        input.lineId,

      calculationId:
        input.calculation
          .calculationId,

      calculationType:
        input.calculation
          .calculationType,

      value:
        input.calculation.value,

      ruleIds: [
        ...input.calculation
          .ruleIds
      ],

      authorityIds: [
        ...input.calculation
          .authorityIds
      ],

      evidenceIds: [
        ...input.calculation
          .evidenceIds
      ],

      provenanceDecisionIds: [
        ...input.calculation
          .provenanceDecisionIds
      ],

      immutable:
        true
    });
  }
}

export class TaxGuardBusinessReturnAssemblyEngine {

  assemble(
    input: {
      preparedBusinessReturnId:
        string;

      context:
        TaxGuardBusinessContext;

      classification:
        TaxGuardBusinessClassificationRecord;

      calculations:
        readonly TaxGuardBusinessCalculationResult[];

      lineBindings:
        readonly TaxGuardBusinessFormLineBinding[];

      provenanceDecisionIds:
        readonly string[];
    }
  ):
    TaxGuardPreparedBusinessReturn {

    requireText(
      input.preparedBusinessReturnId,
      'TG_BUSINESS_PREPARED_RETURN_ID_REQUIRED'
    );

    if (
      input.classification.status !==
        'VERIFIED'
    ) {
      throw new Error(
        'TG_BUSINESS_PREP_CLASSIFICATION_NOT_VERIFIED'
      );
    }

    if (
      input.classification
        .returnFamily ===
        'UNRESOLVED'
    ) {
      throw new Error(
        'TG_BUSINESS_PREP_RETURN_FAMILY_UNRESOLVED'
      );
    }

    if (
      !sameContext(
        input.classification.context,
        input.context
      )
    ) {
      throw new Error(
        'TG_BUSINESS_PREP_CLASSIFICATION_CONTEXT_MISMATCH'
      );
    }

    if (
      input.calculations.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_PREP_CALCULATION_REQUIRED'
      );
    }

    if (
      input.lineBindings.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_PREP_FORM_BINDING_REQUIRED'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_PREP_PROVENANCE_REQUIRED'
      );
    }

    for (
      const calculation
      of input.calculations
    ) {
      if (
        !sameContext(
          calculation.context,
          input.context
        )
      ) {
        throw new Error(
          'TG_BUSINESS_PREP_CALCULATION_CONTEXT_MISMATCH'
        );
      }

      if (
        calculation.returnFamily !==
          input.classification
            .returnFamily
      ) {
        throw new Error(
          'TG_BUSINESS_PREP_RETURN_FAMILY_MISMATCH'
        );
      }

      if (
        calculation.aiCalculated !==
          false ||
        calculation.deterministic !==
          true
      ) {
        throw new Error(
          'TG_BUSINESS_PREP_INVALID_CALCULATION_BOUNDARY'
        );
      }
    }

    const calculationIds =
      new Set(
        input.calculations.map(
          calculation =>
            calculation.calculationId
        )
      );

    for (
      const binding
      of input.lineBindings
    ) {
      if (
        !calculationIds.has(
          binding.calculationId
        )
      ) {
        throw new Error(
          'TG_BUSINESS_PREP_ORPHAN_FORM_BINDING'
        );
      }
    }

    const ruleIds =
      unique([
        ...input.classification
          .ruleIds,

        ...input.calculations
          .flatMap(
            calculation =>
              calculation.ruleIds
          )
      ]);

    const authorityIds =
      unique([
        ...input.classification
          .authorityIds,

        ...input.calculations
          .flatMap(
            calculation =>
              calculation.authorityIds
          )
      ]);

    const evidenceIds =
      unique([
        ...input.classification
          .evidence.map(
            evidence =>
              evidence.evidenceId
          ),

        ...input.calculations
          .flatMap(
            calculation =>
              calculation.evidenceIds
          )
      ]);

    const sourceDocumentIds =
      unique([
        ...input.classification
          .evidence.map(
            evidence =>
              evidence.sourceDocumentId
          ),

        ...input.calculations
          .flatMap(
            calculation =>
              calculation
                .sourceDocumentIds
          )
      ]);

    if (
      ruleIds.length === 0 ||
      authorityIds.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_PREP_RULE_AUTHORITY_REQUIRED'
      );
    }

    if (
      evidenceIds.length === 0 ||
      sourceDocumentIds.length === 0
    ) {
      throw new Error(
        'TG_BUSINESS_PREP_EVIDENCE_REQUIRED'
      );
    }

    const reviewReasons =
      unique([
        ...input.classification
          .reviewReasons,

        ...input.calculations
          .flatMap(
            calculation =>
              calculation.reviewReasons
          )
      ]);

    const requiresHumanReview =
      input.classification
        .requiresProfessionalReview ||
      input.calculations.some(
        calculation =>
          calculation
            .requiresHumanReview
      );

    return Object.freeze({
      preparedBusinessReturnId:
        input.preparedBusinessReturnId,

      context:
        cloneContext(
          input.context
        ),

      classificationId:
        input.classification
          .classificationId,

      returnFamily:
        input.classification
          .returnFamily,

      formIds:
        unique(
          input.lineBindings.map(
            binding =>
              binding.formId
          )
        ),

      lineBindings:
        input.lineBindings.map(
          binding => ({
            ...binding,

            ruleIds: [
              ...binding.ruleIds
            ],

            authorityIds: [
              ...binding.authorityIds
            ],

            evidenceIds: [
              ...binding.evidenceIds
            ],

            provenanceDecisionIds: [
              ...binding
                .provenanceDecisionIds
            ]
          })
        ),

      calculationIds: [
        ...calculationIds
      ],

      ruleIds,

      authorityIds,

      evidenceIds,

      sourceDocumentIds,

      provenanceDecisionIds:
        unique([
          ...input
            .provenanceDecisionIds,

          ...input.classification
            .evidence.map(
              evidence =>
                evidence
                  .provenanceDecisionId
            ),

          ...input.calculations
            .flatMap(
              calculation =>
                calculation
                  .provenanceDecisionIds
            )
        ]),

      requiresHumanReview,

      reviewReasons,

      assembledAt:
        new Date()
          .toISOString(),

      deterministic:
        true,

      aiPrepared:
        false,

      externalFilingEnabled:
        false,

      immutable:
        true
    });
  }
}

export class TaxGuardBusinessReconciliationGuard {

  static evaluate(
    input: {
      preparedReturn:
        TaxGuardPreparedBusinessReturn;

      calculations:
        readonly TaxGuardBusinessCalculationResult[];
    }
  ):
    TaxGuardBusinessReconciliationResult {

    const reasons:
      string[] = [];

    const calculations =
      new Map(
        input.calculations.map(
          calculation => [
            calculation.calculationId,
            calculation
          ]
        )
      );

    for (
      const calculationId
      of input.preparedReturn
        .calculationIds
    ) {
      if (
        !calculations.has(
          calculationId
        )
      ) {
        reasons.push(
          'BUSINESS_CALCULATION_MISSING:' +
          calculationId
        );
      }
    }

    for (
      const binding
      of input.preparedReturn
        .lineBindings
    ) {
      const calculation =
        calculations.get(
          binding.calculationId
        );

      if (!calculation) {
        reasons.push(
          'BUSINESS_FORM_BINDING_CALCULATION_MISSING:' +
          binding.bindingId
        );

        continue;
      }

      if (
        !sameContext(
          calculation.context,
          input.preparedReturn
            .context
        )
      ) {
        reasons.push(
          'BUSINESS_RECONCILIATION_CONTEXT_MISMATCH:' +
          binding.bindingId
        );
      }

      if (
        calculation.returnFamily !==
          input.preparedReturn
            .returnFamily
      ) {
        reasons.push(
          'BUSINESS_RETURN_FAMILY_MISMATCH:' +
          binding.bindingId
        );
      }

      if (
        calculation.value !==
          binding.value
      ) {
        reasons.push(
          'BUSINESS_FORM_VALUE_MISMATCH:' +
          binding.bindingId
        );
      }

      if (
        calculation.calculationType !==
          binding.calculationType
      ) {
        reasons.push(
          'BUSINESS_FORM_CALCULATION_TYPE_MISMATCH:' +
          binding.bindingId
        );
      }
    }

    return {
      valid:
        reasons.length === 0,

      reasons: [
        ...new Set(
          reasons
        )
      ]
    };
  }

  static assertValid(
    input: Parameters<
      typeof TaxGuardBusinessReconciliationGuard.evaluate
    >[0]
  ): true {

    const result =
      this.evaluate(
        input
      );

    if (!result.valid) {
      throw new Error(
        'TG_BUSINESS_RECONCILIATION_BLOCKED:' +
        result.reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardBusinessProfessionalReviewRegistry {

  private readonly approvals =
    new Map<
      string,
      TaxGuardBusinessProfessionalApproval
    >();

  approve(
    input: {
      approvalId: string;

      context:
        TaxGuardBusinessContext;

      preparedBusinessReturn:
        TaxGuardPreparedBusinessReturn;

      returnVersionId: string;

      requestedBy: string;

      approvedBy: string;

      approvedByRole:
        | 'REVIEWER'
        | 'CPA'
        | 'EA';

      provenanceDecisionId: string;
    }
  ):
    TaxGuardBusinessProfessionalApproval {

    requireText(
      input.approvalId,
      'TG_BUSINESS_APPROVAL_ID_REQUIRED'
    );

    requireText(
      input.returnVersionId,
      'TG_BUSINESS_APPROVAL_VERSION_REQUIRED'
    );

    requireText(
      input.requestedBy,
      'TG_BUSINESS_APPROVAL_REQUESTER_REQUIRED'
    );

    requireText(
      input.approvedBy,
      'TG_BUSINESS_APPROVAL_APPROVER_REQUIRED'
    );

    requireText(
      input.provenanceDecisionId,
      'TG_BUSINESS_APPROVAL_PROVENANCE_REQUIRED'
    );

    if (
      input.requestedBy ===
        input.approvedBy
    ) {
      throw new Error(
        'TG_BUSINESS_APPROVAL_MAKER_CHECKER_REQUIRED'
      );
    }

    if (
      !sameContext(
        input.context,
        input.preparedBusinessReturn
          .context
      )
    ) {
      throw new Error(
        'TG_BUSINESS_APPROVAL_CONTEXT_MISMATCH'
      );
    }

    if (
      this.approvals.has(
        input.approvalId
      )
    ) {
      throw new Error(
        'TG_BUSINESS_APPROVAL_DUPLICATE'
      );
    }

    const approval:
      TaxGuardBusinessProfessionalApproval =
        Object.freeze({
          approvalId:
            input.approvalId,

          context:
            cloneContext(
              input.context
            ),

          preparedBusinessReturnId:
            input.preparedBusinessReturn
              .preparedBusinessReturnId,

          returnVersionId:
            input.returnVersionId,

          requestedBy:
            input.requestedBy,

          approvedBy:
            input.approvedBy,

          approvedByRole:
            input.approvedByRole,

          provenanceDecisionId:
            input.provenanceDecisionId,

          approvedAt:
            new Date()
              .toISOString(),

          immutable:
            true
        });

    this.approvals.set(
      approval.approvalId,
      approval
    );

    return {
      ...approval,

      context: {
        ...approval.context
      }
    };
  }
}

export class TaxGuardBusinessWorkflowGate {

  static assertReady(
    input: {
      classificationVerified:
        boolean;

      returnFamilyResolved:
        boolean;

      calculationsVerified:
        boolean;

      reconciliationValid:
        boolean;

      unresolvedExceptionIds:
        readonly string[];

      provenanceApproved:
        boolean;

      professionalApprovalPresent:
        boolean;
    }
  ): true {

    const reasons:
      string[] = [];

    if (
      !input.classificationVerified
    ) {
      reasons.push(
        'BUSINESS_CLASSIFICATION_NOT_VERIFIED'
      );
    }

    if (
      !input.returnFamilyResolved
    ) {
      reasons.push(
        'BUSINESS_RETURN_FAMILY_UNRESOLVED'
      );
    }

    if (
      !input.calculationsVerified
    ) {
      reasons.push(
        'BUSINESS_CALCULATIONS_NOT_VERIFIED'
      );
    }

    if (
      !input.reconciliationValid
    ) {
      reasons.push(
        'BUSINESS_RECONCILIATION_REQUIRED'
      );
    }

    if (
      input.unresolvedExceptionIds
        .length > 0
    ) {
      reasons.push(
        'BUSINESS_UNRESOLVED_EXCEPTIONS'
      );
    }

    if (
      !input.provenanceApproved
    ) {
      reasons.push(
        'BUSINESS_PROVENANCE_APPROVAL_REQUIRED'
      );
    }

    if (
      !input.professionalApprovalPresent
    ) {
      reasons.push(
        'BUSINESS_PROFESSIONAL_APPROVAL_REQUIRED'
      );
    }

    if (
      reasons.length > 0
    ) {
      throw new Error(
        'TG_BUSINESS_WORKFLOW_GATE_BLOCKED:' +
        reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardBusinessExternalFilingGuard {

  static submit(): never {

    throw new Error(
      'TG_BUSINESS_EXTERNAL_FILING_DISABLED'
    );
  }
}

export class TaxGuardBusinessAiPreparationBoundary {

  static prepareFinalReturn():
    never {

    throw new Error(
      'TG_BUSINESS_AI_FINAL_PREPARATION_BLOCKED'
    );
  }

  static approveMaterialDecision():
    never {

    throw new Error(
      'TG_BUSINESS_AI_FINAL_APPROVAL_BLOCKED'
    );
  }
}
`
);

write(
  'src/taxguard/business/index.ts',
  String.raw`
export * from './BusinessReturnArchitecture';
export * from './BusinessReturnCalculation';
export * from './BusinessReturnPreparation';
`
);

//////////// M13 Part 4 of 4 — Regression Tests + Builder Completion
//////////// write(
  'src/tests/taxGuardBusinessReturnArchitecture.test.ts',
  String.raw`
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardBusinessClassificationBoundary,
  TaxGuardBusinessClassificationRegistry,
  TaxGuardBusinessReturnFamilyRegistry,
  TaxGuardBusinessReturnFamilyResolver
} from '../taxguard/business/BusinessReturnArchitecture';

import {
  TaxGuardBusinessCalculationBoundary,
  TaxGuardBusinessCalculationDefinitionRegistry,
  TaxGuardBusinessCalculationEngine,
  TaxGuardBusinessFederalDependencyRegistry,
  TaxGuardBusinessValidatedFactRegistry
} from '../taxguard/business/BusinessReturnCalculation';

import {
  TaxGuardBusinessAiPreparationBoundary,
  TaxGuardBusinessExternalFilingGuard,
  TaxGuardBusinessFormMappingEngine,
  TaxGuardBusinessProfessionalReviewRegistry,
  TaxGuardBusinessReconciliationGuard,
  TaxGuardBusinessReturnAssemblyEngine,
  TaxGuardBusinessWorkflowGate
} from '../taxguard/business/BusinessReturnPreparation';

function context() {
  return {
    clientId:
      'CLIENT-M13-001',

    engagementId:
      'ENGAGEMENT-M13-001',

    taxYear:
      2025,

    correlationId:
      'CORRELATION-M13-001',

    businessId:
      'BUSINESS-M13-001'
  };
}

function createVerifiedClassification() {

  const registry =
    new TaxGuardBusinessClassificationRegistry();

  registry.createDraft({
    classificationId:
      'CLASS-M13-001',

    context:
      context(),

    legalEntityType:
      'LLC',

    taxClassification:
      'S_CORPORATION',

    authorityIds: [
      'AUTH-BUSINESS-001'
    ],

    ruleIds: [
      'RULE-BUSINESS-001'
    ],

    evidence: [
      {
        evidenceId:
          'EVIDENCE-CLASS-001',

        sourceDocumentId:
          'SOURCE-CLASS-001',

        provenanceDecisionId:
          'PROVENANCE-CLASS-001'
      }
    ],

    risk:
      'material',

    classifiedBy:
      'PREPARER-A'
  });

  const classification =
    registry.verify(
      'CLASS-M13-001',
      {
        verifiedBy:
          'CPA-A'
      }
    );

  return {
    registry,
    classification
  };
}

function createVerifiedReturnFamily() {

  const registry =
    new TaxGuardBusinessReturnFamilyRegistry();

  const definition =
    registry.registerVerified({
      definitionId:
        'RETURN-FAMILY-M13-001',

      returnFamily:
        'FORM_1120_S',

      taxYear:
        2025,

      ruleIds: [
        'RULE-BUSINESS-001'
      ],

      authorityIds: [
        'AUTH-BUSINESS-001'
      ],

      requiredFactPaths: [
        'business.synthetic.amount'
      ],

      requiredEvidenceTypes: [
        'SYNTHETIC_TEST_EVIDENCE'
      ],

      requiresProfessionalReview:
        true,

      verifiedBy:
        'CPA-A'
    });

  return {
    registry,
    definition
  };
}

function createCalculationFoundation() {

  const {
    classification
  } =
    createVerifiedClassification();

  const {
    definition:
      returnFamilyDefinition
  } =
    createVerifiedReturnFamily();

  const definitions =
    new TaxGuardBusinessCalculationDefinitionRegistry();

  const calculationDefinition =
    definitions.registerVerified({
      calculationDefinitionId:
        'BUSINESS-CALC-DEF-001',

      returnFamilyDefinition,

      calculationType:
        'SYNTHETIC_BUSINESS_TEST_CALCULATION',

      requiredFactPaths: [
        'business.synthetic.amount'
      ],

      requiredDependencyIds: [
        'BUSINESS-DEP-001'
      ],

      requiresProfessionalReview:
        true,

      verifiedBy:
        'CPA-A'
    });

  const dependencies =
    new TaxGuardBusinessFederalDependencyRegistry();

  const dependency =
    dependencies.registerVerified({
      dependencyId:
        'BUSINESS-DEP-001',

      context:
        context(),

      dependencyType:
        'PRIOR_YEAR_RETURN',

      sourceReturnId:
        'PRIOR-RETURN-001',

      factPath:
        'business.synthetic.priorAmount',

      value:
        '100.00',

      evidenceIds: [
        'EVIDENCE-DEP-001'
      ],

      provenanceDecisionIds: [
        'PROVENANCE-DEP-001'
      ]
    });

  const engine =
    new TaxGuardBusinessCalculationEngine();

  const calculation =
    engine.calculate({
      calculationId:
        'BUSINESS-CALC-001',

      context:
        context(),

      classification,

      definition:
        calculationDefinition,

      businessInputs: [
        {
          inputId:
            'BUSINESS-INPUT-001',

          factPath:
            'business.synthetic.amount',

          value:
            '50.00',

          evidenceIds: [
            'EVIDENCE-INPUT-001'
          ],

          sourceDocumentIds: [
            'SOURCE-INPUT-001'
          ],

          provenanceDecisionIds: [
            'PROVENANCE-INPUT-001'
          ],

          validated:
            true
        }
      ],

      dependencies: [
        dependency
      ],

      provenanceDecisionIds: [
        'PROVENANCE-CALC-001'
      ]
    });

  return {
    classification,
    returnFamilyDefinition,
    calculationDefinition,
    dependency,
    calculation
  };
}

function createPreparedReturn() {

  const foundation =
    createCalculationFoundation();

  const mapper =
    new TaxGuardBusinessFormMappingEngine();

  const binding =
    mapper.map({
      bindingId:
        'BUSINESS-BINDING-001',

      formId:
        'FORM-1120-S-TEST',

      lineId:
        'LINE-SYNTHETIC',

      calculation:
        foundation.calculation
    });

  const assembler =
    new TaxGuardBusinessReturnAssemblyEngine();

  const preparedReturn =
    assembler.assemble({
      preparedBusinessReturnId:
        'BUSINESS-RETURN-001',

      context:
        context(),

      classification:
        foundation.classification,

      calculations: [
        foundation.calculation
      ],

      lineBindings: [
        binding
      ],

      provenanceDecisionIds: [
        'PROVENANCE-RETURN-001'
      ]
    });

  return {
    ...foundation,
    binding,
    preparedReturn
  };
}

describe(
  'TaxGuard M13 Business Return Architecture',
  () => {

    it(
      'M13.1 does not classify an LLC by legal entity label alone',
      () => {

        expect(
          TaxGuardBusinessReturnFamilyResolver
            .resolve({
              legalEntityType:
                'LLC',

              taxClassification:
                'UNKNOWN'
            })
        ).toBe(
          'UNRESOLVED'
        );
      }
    );

    it(
      'M13.2 resolves verified partnership classification to Form 1065 family',
      () => {

        expect(
          TaxGuardBusinessReturnFamilyResolver
            .resolve({
              legalEntityType:
                'LLC',

              taxClassification:
                'PARTNERSHIP'
            })
        ).toBe(
          'FORM_1065'
        );
      }
    );

    it(
      'M13.3 resolves S corporation classification to Form 1120-S family',
      () => {

        expect(
          TaxGuardBusinessReturnFamilyResolver
            .resolve({
              legalEntityType:
                'CORPORATION',

              taxClassification:
                'S_CORPORATION'
            })
        ).toBe(
          'FORM_1120_S'
        );
      }
    );

    it(
      'M13.4 blocks verification of unresolved business classification',
      () => {

        const registry =
          new TaxGuardBusinessClassificationRegistry();

        registry.createDraft({
          classificationId:
            'CLASS-UNRESOLVED',

          context:
            context(),

          legalEntityType:
            'LLC',

          taxClassification:
            'UNKNOWN',

          authorityIds: [
            'AUTH-001'
          ],

          ruleIds: [
            'RULE-001'
          ],

          evidence: [
            {
              evidenceId:
                'EVIDENCE-001',

              sourceDocumentId:
                'SOURCE-001',

              provenanceDecisionId:
                'PROVENANCE-001'
            }
          ],

          risk:
            'material',

          classifiedBy:
            'PREPARER-A'
        });

        expect(
          () =>
            registry.verify(
              'CLASS-UNRESOLVED',
              {
                verifiedBy:
                  'CPA-A'
              }
            )
        ).toThrow(
          'TG_BUSINESS_CLASSIFICATION_UNRESOLVED'
        );
      }
    );

    it(
      'M13.5 creates evidence-backed verified business classification',
      () => {

        const {
          classification
        } =
          createVerifiedClassification();

        expect(
          classification.status
        ).toBe(
          'VERIFIED'
        );

        expect(
          classification.returnFamily
        ).toBe(
          'FORM_1120_S'
        );

        expect(
          classification.aiFinalClassification
        ).toBe(false);
      }
    );

    it(
      'M13.6 registers verified tax-year return-family definition',
      () => {

        const {
          definition
        } =
          createVerifiedReturnFamily();

        expect(
          definition.verified
        ).toBe(true);

        expect(
          definition.taxYear
        ).toBe(2025);

        expect(
          definition.returnFamily
        ).toBe(
          'FORM_1120_S'
        );
      }
    );

    it(
      'M13.7 records validated business fact with evidence and provenance',
      () => {

        const registry =
          new TaxGuardBusinessValidatedFactRegistry();

        const fact =
          registry.register({
            factId:
              'BUSINESS-FACT-001',

            context:
              context(),

            factPath:
              'business.synthetic.amount',

            value:
              '50.00',

            evidenceIds: [
              'EVIDENCE-FACT-001'
            ],

            sourceDocumentIds: [
              'SOURCE-FACT-001'
            ],

            provenanceDecisionIds: [
              'PROVENANCE-FACT-001'
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
      'M13.8 records verified federal dependency',
      () => {

        const registry =
          new TaxGuardBusinessFederalDependencyRegistry();

        const dependency =
          registry.registerVerified({
            dependencyId:
              'DEP-TEST-001',

            context:
              context(),

            dependencyType:
              'PRIOR_YEAR_RETURN',

            sourceReturnId:
              'PRIOR-RETURN-001',

            factPath:
              'business.synthetic.priorAmount',

            value:
              '100.00',

            evidenceIds: [
              'EVIDENCE-DEP-001'
            ],

            provenanceDecisionIds: [
              'PROVENANCE-DEP-001'
            ]
          });

        expect(
          dependency.verified
        ).toBe(true);
      }
    );

    it(
      'M13.9 blocks calculation when required fact is missing',
      () => {

        const {
          classification
        } =
          createVerifiedClassification();

        const {
          definition:
            returnFamilyDefinition
        } =
          createVerifiedReturnFamily();

        const definitions =
          new TaxGuardBusinessCalculationDefinitionRegistry();

        const definition =
          definitions.registerVerified({
            calculationDefinitionId:
              'CALC-DEF-MISSING',

            returnFamilyDefinition,

            calculationType:
              'SYNTHETIC_TEST',

            requiredFactPaths: [
              'business.required.amount'
            ],

            verifiedBy:
              'CPA-A'
          });

        const engine =
          new TaxGuardBusinessCalculationEngine();

        expect(
          () =>
            engine.calculate({
              calculationId:
                'CALC-MISSING',

              context:
                context(),

              classification,

              definition,

              businessInputs: [],

              dependencies: [],

              provenanceDecisionIds: [
                'PROVENANCE-001'
              ]
            })
        ).toThrow(
          'TG_BUSINESS_CALC_REQUIRED_FACT_MISSING'
        );
      }
    );

    it(
      'M13.10 performs deterministic non-AI business calculation foundation',
      () => {

        const {
          calculation
        } =
          createCalculationFoundation();

        expect(
          calculation.value
        ).toBe(
          '150.00'
        );

        expect(
          calculation.deterministic
        ).toBe(true);

        expect(
          calculation.aiCalculated
        ).toBe(false);
      }
    );

    it(
      'M13.11 maps calculation to evidence-backed business form line',
      () => {

        const {
          calculation
        } =
          createCalculationFoundation();

        const binding =
          new TaxGuardBusinessFormMappingEngine()
            .map({
              bindingId:
                'BINDING-TEST',

              formId:
                'FORM-1120-S-TEST',

              lineId:
                'LINE-TEST',

              calculation
            });

        expect(
          binding.value
        ).toBe(
          '150.00'
        );

        expect(
          binding.authorityIds.length
        ).toBeGreaterThan(0);
      }
    );

    it(
      'M13.12 assembles prepared business return with filing disabled',
      () => {

        const {
          preparedReturn
        } =
          createPreparedReturn();

        expect(
          preparedReturn.returnFamily
        ).toBe(
          'FORM_1120_S'
        );

        expect(
          preparedReturn.aiPrepared
        ).toBe(false);

        expect(
          preparedReturn.externalFilingEnabled
        ).toBe(false);
      }
    );

    it(
      'M13.13 reconciles prepared return to deterministic calculation',
      () => {

        const {
          preparedReturn,
          calculation
        } =
          createPreparedReturn();

        const result =
          TaxGuardBusinessReconciliationGuard
            .evaluate({
              preparedReturn,

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
      'M13.14 enforces maker-checker professional approval',
      () => {

        const {
          preparedReturn
        } =
          createPreparedReturn();

        const approvals =
          new TaxGuardBusinessProfessionalReviewRegistry();

        expect(
          () =>
            approvals.approve({
              approvalId:
                'APPROVAL-001',

              context:
                context(),

              preparedBusinessReturn:
                preparedReturn,

              returnVersionId:
                'RETURN-VERSION-001',

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
          'TG_BUSINESS_APPROVAL_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M13.15 blocks workflow when exceptions remain unresolved',
      () => {

        expect(
          () =>
            TaxGuardBusinessWorkflowGate
              .assertReady({
                classificationVerified:
                  true,

                returnFamilyResolved:
                  true,

                calculationsVerified:
                  true,

                reconciliationValid:
                  true,

                unresolvedExceptionIds: [
                  'EXCEPTION-001'
                ],

                provenanceApproved:
                  true,

                professionalApprovalPresent:
                  true
              })
        ).toThrow(
          'TG_BUSINESS_WORKFLOW_GATE_BLOCKED'
        );
      }
    );

    it(
      'M13.16 permits workflow after all governance gates pass',
      () => {

        expect(
          TaxGuardBusinessWorkflowGate
            .assertReady({
              classificationVerified:
                true,

              returnFamilyResolved:
                true,

              calculationsVerified:
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
      'M13.17 blocks AI classification, calculation and final approval',
      () => {

        expect(
          () =>
            TaxGuardBusinessClassificationBoundary
              .aiCreateVerifiedClassification()
        ).toThrow(
          'TG_BUSINESS_AI_VERIFIED_CLASSIFICATION_BLOCKED'
        );

        expect(
          () =>
            TaxGuardBusinessCalculationBoundary
              .aiCalculateFinalLiability()
        ).toThrow(
          'TG_BUSINESS_AI_FINAL_CALCULATION_BLOCKED'
        );

        expect(
          () =>
            TaxGuardBusinessAiPreparationBoundary
              .approveMaterialDecision()
        ).toThrow(
          'TG_BUSINESS_AI_FINAL_APPROVAL_BLOCKED'
        );
      }
    );

    it(
      'M13.18 keeps external business filing disabled',
      () => {

        expect(
          () =>
            TaxGuardBusinessExternalFilingGuard
              .submit()
        ).toThrow(
          'TG_BUSINESS_EXTERNAL_FILING_DISABLED'
        );
      }
    );
  }
);
`
);

console.log('');
console.log(
  '============================================================'
);
console.log(
  'TaxGuard M13 Business Return Architecture generated successfully.'
);
console.log(
  '============================================================'
);
console.log('Created:');
console.log(
  'src/taxguard/business/BusinessReturnArchitecture.ts'
);
console.log(
  'src/taxguard/business/BusinessReturnCalculation.ts'
);
console.log(
  'src/taxguard/business/BusinessReturnPreparation.ts'
);
console.log(
  'src/taxguard/business/index.ts'
);
console.log(
  'src/tests/taxGuardBusinessReturnArchitecture.test.ts'
);
console.log('');
console.log(
  'M1-M12 source was not modified.'
);
console.log(
  'No statutory business tax formulas were invented.'
);
console.log(
  'External business filing remains DISABLED.'
);

///////////




