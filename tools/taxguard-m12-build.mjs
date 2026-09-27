///////// Ophireum Multimedia Productions
//////// M12 Part 1 of 4 — State Jurisdiction + Tax-Year Rule-Pack Foundation

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
  'src/taxguard/state/StateTaxArchitecture.ts',
  String.raw`
export type TaxGuardStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA'
  | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA'
  | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO'
  | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH'
  | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT'
  | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | 'DC';

export type TaxGuardStateReturnType =
  | 'RESIDENT'
  | 'PART_YEAR_RESIDENT'
  | 'NONRESIDENT'
  | 'INFORMATIONAL'
  | 'NO_INDIVIDUAL_INCOME_TAX_RETURN';

export type TaxGuardStateRuleStatus =
  | 'DRAFT'
  | 'VERIFIED'
  | 'SUPERSEDED';

export type TaxGuardStateRuleRisk =
  | 'routine'
  | 'material'
  | 'critical';

export interface TaxGuardStateContext {
  clientId: string;

  engagementId: string;

  taxYear: number;

  correlationId: string;

  stateCode:
    TaxGuardStateCode;
}

export interface TaxGuardStateJurisdiction {
  jurisdictionId: string;

  stateCode:
    TaxGuardStateCode;

  name: string;

  taxYear: number;

  individualIncomeTaxReturnSupported:
    boolean;

  supportedReturnTypes:
    readonly TaxGuardStateReturnType[];

  authorityIds:
    readonly string[];

  verified:
    boolean;

  verifiedBy?: string;

  verifiedAt?: string;

  immutable: true;
}

export interface TaxGuardStateRule {
  ruleId: string;

  stateCode:
    TaxGuardStateCode;

  taxYear: number;

  name: string;

  description: string;

  status:
    TaxGuardStateRuleStatus;

  risk:
    TaxGuardStateRuleRisk;

  authorityIds:
    readonly string[];

  evidenceRequirementIds:
    readonly string[];

  federalDependencyIds:
    readonly string[];

  requiredFactPaths:
    readonly string[];

  requiresProfessionalReview:
    boolean;

  verifiedBy?: string;

  verifiedAt?: string;

  supersedesRuleId?: string;

  immutable: true;
}

export interface TaxGuardStateRulePack {
  rulePackId: string;

  stateCode:
    TaxGuardStateCode;

  taxYear: number;

  jurisdictionId: string;

  ruleIds:
    readonly string[];

  authorityIds:
    readonly string[];

  status:
    TaxGuardStateRuleStatus;

  verifiedBy?: string;

  verifiedAt?: string;

  immutable: true;
}

function now(): string {
  return new Date()
    .toISOString();
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
      'TG_STATE_INVALID_TAX_YEAR'
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

export class TaxGuardStateJurisdictionRegistry {

  private readonly jurisdictions =
    new Map<
      string,
      TaxGuardStateJurisdiction
    >();

  register(
    input: {
      jurisdictionId: string;

      stateCode:
        TaxGuardStateCode;

      name: string;

      taxYear: number;

      individualIncomeTaxReturnSupported:
        boolean;

      supportedReturnTypes:
        readonly TaxGuardStateReturnType[];

      authorityIds?:
        readonly string[];
    }
  ):
    TaxGuardStateJurisdiction {

    requireText(
      input.jurisdictionId,
      'TG_STATE_JURISDICTION_ID_REQUIRED'
    );

    requireText(
      input.name,
      'TG_STATE_JURISDICTION_NAME_REQUIRED'
    );

    validateTaxYear(
      input.taxYear
    );

    if (
      this.jurisdictions.has(
        input.jurisdictionId
      )
    ) {
      throw new Error(
        'TG_STATE_JURISDICTION_DUPLICATE'
      );
    }

    const duplicate =
      [
        ...this.jurisdictions.values()
      ].some(
        jurisdiction =>
          jurisdiction.stateCode ===
            input.stateCode &&
          jurisdiction.taxYear ===
            input.taxYear
      );

    if (duplicate) {
      throw new Error(
        'TG_STATE_JURISDICTION_YEAR_DUPLICATE'
      );
    }

    const record:
      TaxGuardStateJurisdiction =
        Object.freeze({
          jurisdictionId:
            input.jurisdictionId,

          stateCode:
            input.stateCode,

          name:
            input.name,

          taxYear:
            input.taxYear,

          individualIncomeTaxReturnSupported:
            input
              .individualIncomeTaxReturnSupported,

          supportedReturnTypes:
            unique(
              input.supportedReturnTypes
            ) as TaxGuardStateReturnType[],

          authorityIds:
            unique(
              input.authorityIds ??
              []
            ),

          verified:
            false,

          immutable:
            true
        });

    this.jurisdictions.set(
      record.jurisdictionId,
      record
    );

    return this.clone(
      record
    );
  }

  verify(
    jurisdictionId: string,

    input: {
      verifiedBy: string;

      authorityIds:
        readonly string[];
    }
  ):
    TaxGuardStateJurisdiction {

    requireText(
      input.verifiedBy,
      'TG_STATE_JURISDICTION_VERIFIER_REQUIRED'
    );

    if (
      input.authorityIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_JURISDICTION_AUTHORITY_REQUIRED'
      );
    }

    const current =
      this.requireInternal(
        jurisdictionId
      );

    const verified:
      TaxGuardStateJurisdiction =
        Object.freeze({
          ...current,

          authorityIds:
            unique(
              input.authorityIds
            ),

          verified:
            true,

          verifiedBy:
            input.verifiedBy,

          verifiedAt:
            now()
        });

    this.jurisdictions.set(
      jurisdictionId,
      verified
    );

    return this.clone(
      verified
    );
  }

  get(
    jurisdictionId: string
  ):
    TaxGuardStateJurisdiction {

    return this.clone(
      this.requireInternal(
        jurisdictionId
      )
    );
  }

  findVerified(
    stateCode:
      TaxGuardStateCode,

    taxYear: number
  ):
    TaxGuardStateJurisdiction {

    validateTaxYear(
      taxYear
    );

    const match =
      [
        ...this.jurisdictions.values()
      ].find(
        jurisdiction =>
          jurisdiction.stateCode ===
            stateCode &&
          jurisdiction.taxYear ===
            taxYear &&
          jurisdiction.verified
      );

    if (!match) {
      throw new Error(
        'TG_STATE_VERIFIED_JURISDICTION_NOT_FOUND'
      );
    }

    return this.clone(
      match
    );
  }

  private requireInternal(
    jurisdictionId: string
  ):
    TaxGuardStateJurisdiction {

    const record =
      this.jurisdictions.get(
        jurisdictionId
      );

    if (!record) {
      throw new Error(
        'TG_STATE_JURISDICTION_NOT_FOUND'
      );
    }

    return record;
  }

  private clone(
    record:
      TaxGuardStateJurisdiction
  ):
    TaxGuardStateJurisdiction {

    return {
      ...record,

      supportedReturnTypes: [
        ...record.supportedReturnTypes
      ],

      authorityIds: [
        ...record.authorityIds
      ]
    };
  }
}

export class TaxGuardStateRuleRegistry {

  private readonly rules =
    new Map<
      string,
      TaxGuardStateRule
    >();

  registerDraft(
    input: {
      ruleId: string;

      stateCode:
        TaxGuardStateCode;

      taxYear: number;

      name: string;

      description: string;

      risk:
        TaxGuardStateRuleRisk;

      authorityIds:
        readonly string[];

      evidenceRequirementIds?:
        readonly string[];

      federalDependencyIds?:
        readonly string[];

      requiredFactPaths?:
        readonly string[];

      requiresProfessionalReview?:
        boolean;

      supersedesRuleId?:
        string;
    }
  ):
    TaxGuardStateRule {

    requireText(
      input.ruleId,
      'TG_STATE_RULE_ID_REQUIRED'
    );

    requireText(
      input.name,
      'TG_STATE_RULE_NAME_REQUIRED'
    );

    requireText(
      input.description,
      'TG_STATE_RULE_DESCRIPTION_REQUIRED'
    );

    validateTaxYear(
      input.taxYear
    );

    if (
      this.rules.has(
        input.ruleId
      )
    ) {
      throw new Error(
        'TG_STATE_RULE_DUPLICATE'
      );
    }

    if (
      input.authorityIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_RULE_AUTHORITY_REQUIRED'
      );
    }

    if (
      input.supersedesRuleId &&
      !this.rules.has(
        input.supersedesRuleId
      )
    ) {
      throw new Error(
        'TG_STATE_SUPERSEDED_RULE_NOT_FOUND'
      );
    }

    const rule:
      TaxGuardStateRule =
        Object.freeze({
          ruleId:
            input.ruleId,

          stateCode:
            input.stateCode,

          taxYear:
            input.taxYear,

          name:
            input.name,

          description:
            input.description,

          status:
            'DRAFT',

          risk:
            input.risk,

          authorityIds:
            unique(
              input.authorityIds
            ),

          evidenceRequirementIds:
            unique(
              input.evidenceRequirementIds ??
              []
            ),

          federalDependencyIds:
            unique(
              input.federalDependencyIds ??
              []
            ),

          requiredFactPaths:
            unique(
              input.requiredFactPaths ??
              []
            ),

          requiresProfessionalReview:
            input.requiresProfessionalReview ??
            false,

          supersedesRuleId:
            input.supersedesRuleId,

          immutable:
            true
        });

    this.rules.set(
      rule.ruleId,
      rule
    );

    return this.clone(
      rule
    );
  }

  verify(
    ruleId: string,

    verifiedBy: string
  ):
    TaxGuardStateRule {

    requireText(
      verifiedBy,
      'TG_STATE_RULE_VERIFIER_REQUIRED'
    );

    const current =
      this.requireInternal(
        ruleId
      );

    if (
      current.status !==
        'DRAFT'
    ) {
      throw new Error(
        'TG_STATE_RULE_NOT_DRAFT'
      );
    }

    const verified:
      TaxGuardStateRule =
        Object.freeze({
          ...current,

          status:
            'VERIFIED',

          verifiedBy,

          verifiedAt:
            now()
        });

    this.rules.set(
      ruleId,
      verified
    );

    return this.clone(
      verified
    );
  }

  getVerified(
    ruleId: string
  ):
    TaxGuardStateRule {

    const rule =
      this.requireInternal(
        ruleId
      );

    if (
      rule.status !==
        'VERIFIED'
    ) {
      throw new Error(
        'TG_STATE_RULE_NOT_VERIFIED'
      );
    }

    return this.clone(
      rule
    );
  }

  listVerified(
    stateCode:
      TaxGuardStateCode,

    taxYear: number
  ):
    readonly TaxGuardStateRule[] {

    validateTaxYear(
      taxYear
    );

    return [
      ...this.rules.values()
    ]
      .filter(
        rule =>
          rule.stateCode ===
            stateCode &&
          rule.taxYear ===
            taxYear &&
          rule.status ===
            'VERIFIED'
      )
      .map(
        rule =>
          this.clone(
            rule
          )
      );
  }

  private requireInternal(
    ruleId: string
  ):
    TaxGuardStateRule {

    const rule =
      this.rules.get(
        ruleId
      );

    if (!rule) {
      throw new Error(
        'TG_STATE_RULE_NOT_FOUND'
      );
    }

    return rule;
  }

  private clone(
    rule:
      TaxGuardStateRule
  ):
    TaxGuardStateRule {

    return {
      ...rule,

      authorityIds: [
        ...rule.authorityIds
      ],

      evidenceRequirementIds: [
        ...rule.evidenceRequirementIds
      ],

      federalDependencyIds: [
        ...rule.federalDependencyIds
      ],

      requiredFactPaths: [
        ...rule.requiredFactPaths
      ]
    };
  }
}

export class TaxGuardStateRulePackRegistry {

  private readonly packs =
    new Map<
      string,
      TaxGuardStateRulePack
    >();

  constructor(
    private readonly jurisdictions:
      TaxGuardStateJurisdictionRegistry,

    private readonly rules:
      TaxGuardStateRuleRegistry
  ) {}

  createDraft(
    input: {
      rulePackId: string;

      stateCode:
        TaxGuardStateCode;

      taxYear: number;

      jurisdictionId: string;

      ruleIds:
        readonly string[];

      authorityIds:
        readonly string[];
    }
  ):
    TaxGuardStateRulePack {

    requireText(
      input.rulePackId,
      'TG_STATE_RULE_PACK_ID_REQUIRED'
    );

    validateTaxYear(
      input.taxYear
    );

    if (
      this.packs.has(
        input.rulePackId
      )
    ) {
      throw new Error(
        'TG_STATE_RULE_PACK_DUPLICATE'
      );
    }

    const jurisdiction =
      this.jurisdictions.get(
        input.jurisdictionId
      );

    if (
      !jurisdiction.verified
    ) {
      throw new Error(
        'TG_STATE_RULE_PACK_JURISDICTION_NOT_VERIFIED'
      );
    }

    if (
      jurisdiction.stateCode !==
        input.stateCode ||
      jurisdiction.taxYear !==
        input.taxYear
    ) {
      throw new Error(
        'TG_STATE_RULE_PACK_JURISDICTION_MISMATCH'
      );
    }

    if (
      input.ruleIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_RULE_PACK_RULE_REQUIRED'
      );
    }

    if (
      input.authorityIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_RULE_PACK_AUTHORITY_REQUIRED'
      );
    }

    for (
      const ruleId
      of unique(
        input.ruleIds
      )
    ) {
      const rule =
        this.rules.getVerified(
          ruleId
        );

      if (
        rule.stateCode !==
          input.stateCode ||
        rule.taxYear !==
          input.taxYear
      ) {
        throw new Error(
          'TG_STATE_RULE_PACK_RULE_MISMATCH'
        );
      }
    }

    const pack:
      TaxGuardStateRulePack =
        Object.freeze({
          rulePackId:
            input.rulePackId,

          stateCode:
            input.stateCode,

          taxYear:
            input.taxYear,

          jurisdictionId:
            input.jurisdictionId,

          ruleIds:
            unique(
              input.ruleIds
            ),

          authorityIds:
            unique(
              input.authorityIds
            ),

          status:
            'DRAFT',

          immutable:
            true
        });

    this.packs.set(
      pack.rulePackId,
      pack
    );

    return this.clone(
      pack
    );
  }

  verify(
    rulePackId: string,

    verifiedBy: string
  ):
    TaxGuardStateRulePack {

    requireText(
      verifiedBy,
      'TG_STATE_RULE_PACK_VERIFIER_REQUIRED'
    );

    const current =
      this.requireInternal(
        rulePackId
      );

    if (
      current.status !==
        'DRAFT'
    ) {
      throw new Error(
        'TG_STATE_RULE_PACK_NOT_DRAFT'
      );
    }

    for (
      const ruleId
      of current.ruleIds
    ) {
      this.rules.getVerified(
        ruleId
      );
    }

    const verified:
      TaxGuardStateRulePack =
        Object.freeze({
          ...current,

          status:
            'VERIFIED',

          verifiedBy,

          verifiedAt:
            now()
        });

    this.packs.set(
      rulePackId,
      verified
    );

    return this.clone(
      verified
    );
  }

  getVerified(
    stateCode:
      TaxGuardStateCode,

    taxYear: number
  ):
    TaxGuardStateRulePack {

    validateTaxYear(
      taxYear
    );

    const pack =
      [
        ...this.packs.values()
      ].find(
        item =>
          item.stateCode ===
            stateCode &&
          item.taxYear ===
            taxYear &&
          item.status ===
            'VERIFIED'
      );

    if (!pack) {
      throw new Error(
        'TG_STATE_VERIFIED_RULE_PACK_NOT_FOUND'
      );
    }

    return this.clone(
      pack
    );
  }

  private requireInternal(
    rulePackId: string
  ):
    TaxGuardStateRulePack {

    const pack =
      this.packs.get(
        rulePackId
      );

    if (!pack) {
      throw new Error(
        'TG_STATE_RULE_PACK_NOT_FOUND'
      );
    }

    return pack;
  }

  private clone(
    pack:
      TaxGuardStateRulePack
  ):
    TaxGuardStateRulePack {

    return {
      ...pack,

      ruleIds: [
        ...pack.ruleIds
      ],

      authorityIds: [
        ...pack.authorityIds
      ]
    };
  }
}
`
);

////////This establishes the M12 foundation without inventing any state's actual tax rates, thresholds, deductions, credits, or filing rules. State jurisdictions, rules, and rule packs begin unverified/draft and must be explicitly verified against authority before downstream calculation use.
////////M12 Part 2 of 4 — Federal-to-State Dependency + Validated Facts + Deterministic Calculation

write(
  'src/taxguard/state/StateTaxCalculation.ts',
  String.raw`
import type {
  TaxGuardStateCode,
  TaxGuardStateContext,
  TaxGuardStateRulePack
} from './StateTaxArchitecture';

export type TaxGuardStateFactValue =
  | string
  | number
  | boolean;

export interface TaxGuardStateValidatedFact {
  factId: string;
  context: TaxGuardStateContext;
  factPath: string;
  value: TaxGuardStateFactValue;
  evidenceIds: readonly string[];
  sourceDocumentIds: readonly string[];
  validatedBy: string;
  validatedAt: string;
  validated: true;
  aiProposedOnly: false;
  immutable: true;
}

export interface TaxGuardFederalDependency {
  dependencyId: string;
  context: TaxGuardStateContext;
  federalCalculationId: string;
  federalFactPath: string;
  value: string;
  evidenceIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  verified: true;
  immutable: true;
}

export interface TaxGuardStateCalculationInput {
  inputId: string;
  factPath: string;
  value: string;
  evidenceIds: readonly string[];
  sourceDocumentIds: readonly string[];
  validated: true;
}

export interface TaxGuardStateCalculationDefinition {
  calculationDefinitionId: string;
  stateCode: TaxGuardStateCode;
  taxYear: number;
  calculationType: string;
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  requiredFactPaths: readonly string[];
  requiredFederalDependencyIds: readonly string[];
  requiresProfessionalReview: boolean;
  verifiedBy: string;
  verifiedAt: string;
  verified: true;
  immutable: true;
}

export interface TaxGuardStateCalculationTraceEntry {
  traceId: string;
  sequence: number;
  operation:
    | 'INPUT'
    | 'FEDERAL_DEPENDENCY'
    | 'ADD'
    | 'SUBTRACT'
    | 'MULTIPLY'
    | 'RESULT';
  sourceIds: readonly string[];
  value: string;
  immutable: true;
}

export interface TaxGuardStateCalculationResult {
  calculationId: string;
  context: TaxGuardStateContext;
  calculationDefinitionId: string;
  calculationType: string;
  value: string;
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  evidenceIds: readonly string[];
  sourceDocumentIds: readonly string[];
  federalDependencyIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  trace: readonly TaxGuardStateCalculationTraceEntry[];
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
      'TG_STATE_CALC_INVALID_TAX_YEAR'
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
    TaxGuardStateContext
): TaxGuardStateContext {
  return {
    ...context
  };
}

function sameContext(
  left:
    TaxGuardStateContext,
  right:
    TaxGuardStateContext
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
    left.stateCode ===
      right.stateCode
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
      'TG_STATE_CALC_INVALID_DECIMAL'
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
      'TG_STATE_CALC_INVALID_DECIMAL'
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
      'TG_STATE_CALC_NON_FINITE_RESULT'
    );
  }

  return value.toFixed(2);
}

export class TaxGuardStateValidatedFactRegistry {

  private readonly facts =
    new Map<
      string,
      TaxGuardStateValidatedFact
    >();

  register(
    input: {
      factId: string;
      context: TaxGuardStateContext;
      factPath: string;
      value: TaxGuardStateFactValue;
      evidenceIds: readonly string[];
      sourceDocumentIds: readonly string[];
      validatedBy: string;
    }
  ): TaxGuardStateValidatedFact {

    requireText(
      input.factId,
      'TG_STATE_FACT_ID_REQUIRED'
    );

    requireText(
      input.factPath,
      'TG_STATE_FACT_PATH_REQUIRED'
    );

    requireText(
      input.validatedBy,
      'TG_STATE_FACT_VALIDATOR_REQUIRED'
    );

    validateTaxYear(
      input.context.taxYear
    );

    if (
      input.evidenceIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_FACT_EVIDENCE_REQUIRED'
      );
    }

    if (
      input.sourceDocumentIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FACT_SOURCE_REQUIRED'
      );
    }

    if (
      this.facts.has(
        input.factId
      )
    ) {
      throw new Error(
        'TG_STATE_FACT_DUPLICATE'
      );
    }

    const record:
      TaxGuardStateValidatedFact =
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
  ): TaxGuardStateValidatedFact {
    const fact =
      this.facts.get(
        factId
      );

    if (!fact) {
      throw new Error(
        'TG_STATE_FACT_NOT_FOUND'
      );
    }

    return this.clone(
      fact
    );
  }

  findByPath(
    context:
      TaxGuardStateContext,
    factPath: string
  ): TaxGuardStateValidatedFact {
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
        'TG_STATE_REQUIRED_FACT_NOT_FOUND'
      );
    }

    return this.clone(
      fact
    );
  }

  private clone(
    fact:
      TaxGuardStateValidatedFact
  ): TaxGuardStateValidatedFact {
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
      ]
    };
  }
}

export class TaxGuardFederalDependencyRegistry {

  private readonly dependencies =
    new Map<
      string,
      TaxGuardFederalDependency
    >();

  registerVerified(
    input: {
      dependencyId: string;
      context: TaxGuardStateContext;
      federalCalculationId: string;
      federalFactPath: string;
      value: string;
      evidenceIds: readonly string[];
      provenanceDecisionIds:
        readonly string[];
    }
  ): TaxGuardFederalDependency {

    requireText(
      input.dependencyId,
      'TG_STATE_FEDERAL_DEPENDENCY_ID_REQUIRED'
    );

    requireText(
      input.federalCalculationId,
      'TG_STATE_FEDERAL_CALCULATION_REQUIRED'
    );

    requireText(
      input.federalFactPath,
      'TG_STATE_FEDERAL_FACT_PATH_REQUIRED'
    );

    parseDecimal(
      input.value
    );

    if (
      input.evidenceIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_FEDERAL_EVIDENCE_REQUIRED'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FEDERAL_PROVENANCE_REQUIRED'
      );
    }

    if (
      this.dependencies.has(
        input.dependencyId
      )
    ) {
      throw new Error(
        'TG_STATE_FEDERAL_DEPENDENCY_DUPLICATE'
      );
    }

    const record:
      TaxGuardFederalDependency =
        Object.freeze({
          dependencyId:
            input.dependencyId,

          context:
            cloneContext(
              input.context
            ),

          federalCalculationId:
            input.federalCalculationId,

          federalFactPath:
            input.federalFactPath,

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
  ): TaxGuardFederalDependency {
    const record =
      this.dependencies.get(
        dependencyId
      );

    if (!record) {
      throw new Error(
        'TG_STATE_FEDERAL_DEPENDENCY_NOT_FOUND'
      );
    }

    return this.clone(
      record
    );
  }

  private clone(
    record:
      TaxGuardFederalDependency
  ): TaxGuardFederalDependency {
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

export class TaxGuardStateCalculationDefinitionRegistry {

  private readonly definitions =
    new Map<
      string,
      TaxGuardStateCalculationDefinition
    >();

  registerVerified(
    input: {
      calculationDefinitionId: string;
      stateCode: TaxGuardStateCode;
      taxYear: number;
      calculationType: string;
      rulePack: TaxGuardStateRulePack;
      requiredFactPaths?: readonly string[];
      requiredFederalDependencyIds?:
        readonly string[];
      requiresProfessionalReview?:
        boolean;
      verifiedBy: string;
    }
  ): TaxGuardStateCalculationDefinition {

    requireText(
      input.calculationDefinitionId,
      'TG_STATE_CALC_DEFINITION_ID_REQUIRED'
    );

    requireText(
      input.calculationType,
      'TG_STATE_CALC_TYPE_REQUIRED'
    );

    requireText(
      input.verifiedBy,
      'TG_STATE_CALC_VERIFIER_REQUIRED'
    );

    validateTaxYear(
      input.taxYear
    );

    if (
      input.rulePack.status !==
        'VERIFIED'
    ) {
      throw new Error(
        'TG_STATE_CALC_RULE_PACK_NOT_VERIFIED'
      );
    }

    if (
      input.rulePack.stateCode !==
        input.stateCode ||
      input.rulePack.taxYear !==
        input.taxYear
    ) {
      throw new Error(
        'TG_STATE_CALC_RULE_PACK_MISMATCH'
      );
    }

    if (
      input.rulePack.ruleIds
        .length === 0 ||
      input.rulePack.authorityIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_CALC_VERIFIED_RULES_REQUIRED'
      );
    }

    if (
      this.definitions.has(
        input.calculationDefinitionId
      )
    ) {
      throw new Error(
        'TG_STATE_CALC_DEFINITION_DUPLICATE'
      );
    }

    const record:
      TaxGuardStateCalculationDefinition =
        Object.freeze({
          calculationDefinitionId:
            input.calculationDefinitionId,

          stateCode:
            input.stateCode,

          taxYear:
            input.taxYear,

          calculationType:
            input.calculationType,

          ruleIds: [
            ...input.rulePack.ruleIds
          ],

          authorityIds: [
            ...input.rulePack.authorityIds
          ],

          requiredFactPaths:
            unique(
              input.requiredFactPaths ??
              []
            ),

          requiredFederalDependencyIds:
            unique(
              input
                .requiredFederalDependencyIds ??
              []
            ),

          requiresProfessionalReview:
            input
              .requiresProfessionalReview ??
            false,

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
      record.calculationDefinitionId,
      record
    );

    return this.clone(
      record
    );
  }

  getVerified(
    calculationDefinitionId:
      string
  ): TaxGuardStateCalculationDefinition {
    const record =
      this.definitions.get(
        calculationDefinitionId
      );

    if (!record) {
      throw new Error(
        'TG_STATE_CALC_DEFINITION_NOT_FOUND'
      );
    }

    if (!record.verified) {
      throw new Error(
        'TG_STATE_CALC_DEFINITION_NOT_VERIFIED'
      );
    }

    return this.clone(
      record
    );
  }

  private clone(
    record:
      TaxGuardStateCalculationDefinition
  ): TaxGuardStateCalculationDefinition {
    return {
      ...record,
      ruleIds: [
        ...record.ruleIds
      ],
      authorityIds: [
        ...record.authorityIds
      ],
      requiredFactPaths: [
        ...record.requiredFactPaths
      ],
      requiredFederalDependencyIds: [
        ...record
          .requiredFederalDependencyIds
      ]
    };
  }
}

export class TaxGuardStateCalculationEngine {

  calculate(
    input: {
      calculationId: string;
      context: TaxGuardStateContext;
      definition:
        TaxGuardStateCalculationDefinition;
      stateInputs:
        readonly TaxGuardStateCalculationInput[];
      federalDependencies:
        readonly TaxGuardFederalDependency[];
      provenanceDecisionIds:
        readonly string[];
    }
  ): TaxGuardStateCalculationResult {

    requireText(
      input.calculationId,
      'TG_STATE_CALC_ID_REQUIRED'
    );

    validateTaxYear(
      input.context.taxYear
    );

    if (
      !input.definition.verified
    ) {
      throw new Error(
        'TG_STATE_CALC_DEFINITION_NOT_VERIFIED'
      );
    }

    if (
      input.definition.stateCode !==
        input.context.stateCode ||
      input.definition.taxYear !==
        input.context.taxYear
    ) {
      throw new Error(
        'TG_STATE_CALC_CONTEXT_MISMATCH'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_CALC_PROVENANCE_REQUIRED'
      );
    }

    const factPaths =
      new Set(
        input.stateInputs.map(
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
          'TG_STATE_CALC_REQUIRED_FACT_MISSING:' +
          requiredFactPath
        );
      }
    }

    const dependencyIds =
      new Set(
        input.federalDependencies
          .map(
            dependency =>
              dependency.dependencyId
          )
      );

    for (
      const requiredDependencyId
      of input.definition
        .requiredFederalDependencyIds
    ) {
      if (
        !dependencyIds.has(
          requiredDependencyId
        )
      ) {
        throw new Error(
          'TG_STATE_CALC_FEDERAL_DEPENDENCY_MISSING:' +
          requiredDependencyId
        );
      }
    }

    for (
      const stateInput
      of input.stateInputs
    ) {
      if (
        !stateInput.validated
      ) {
        throw new Error(
          'TG_STATE_CALC_UNVALIDATED_INPUT'
        );
      }

      if (
        stateInput.evidenceIds
          .length === 0
      ) {
        throw new Error(
          'TG_STATE_CALC_INPUT_EVIDENCE_REQUIRED'
        );
      }

      if (
        stateInput.sourceDocumentIds
          .length === 0
      ) {
        throw new Error(
          'TG_STATE_CALC_INPUT_SOURCE_REQUIRED'
        );
      }

      parseDecimal(
        stateInput.value
      );
    }

    for (
      const dependency
      of input.federalDependencies
    ) {
      if (
        !sameContext(
          dependency.context,
          input.context
        )
      ) {
        throw new Error(
          'TG_STATE_CALC_FEDERAL_CONTEXT_MISMATCH'
        );
      }

      if (!dependency.verified) {
        throw new Error(
          'TG_STATE_CALC_FEDERAL_NOT_VERIFIED'
        );
      }

      parseDecimal(
        dependency.value
      );
    }

    /*
     * M12 deliberately does not encode state-specific
     * tax formulas here.
     *
     * This architecture only provides a deterministic
     * execution boundary. A verified, tax-year-specific
     * calculation definition/rule pack must ultimately
     * provide the statutory operation.
     *
     * For the M12 foundation, validated numeric state
     * inputs and verified federal dependencies are
     * aggregated deterministically so the provenance,
     * gating, reconciliation and form architecture can
     * be exercised without inventing state law.
     */

    let total = 0;

    const trace:
      TaxGuardStateCalculationTraceEntry[] =
        [];

    let sequence = 1;

    for (
      const stateInput
      of input.stateInputs
    ) {
      const value =
        parseDecimal(
          stateInput.value
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
            stateInput.inputId
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
      of input.federalDependencies
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
            'FEDERAL_DEPENDENCY',

          sourceIds: [
            dependency.dependencyId,
            dependency
              .federalCalculationId
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
          ...input.stateInputs.map(
            item =>
              item.inputId
          ),
          ...input.federalDependencies
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

    const evidenceIds =
      unique([
        ...input.stateInputs
          .flatMap(
            item =>
              item.evidenceIds
          ),
        ...input.federalDependencies
          .flatMap(
            item =>
              item.evidenceIds
          )
      ]);

    const sourceDocumentIds =
      unique(
        input.stateInputs
          .flatMap(
            item =>
              item.sourceDocumentIds
          )
      );

    const reviewReasons =
      input.definition
        .requiresProfessionalReview
        ? [
            'STATE_CALCULATION_PROFESSIONAL_REVIEW_REQUIRED'
          ]
        : [];

    return Object.freeze({
      calculationId:
        input.calculationId,

      context:
        cloneContext(
          input.context
        ),

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
        ...input.definition
          .ruleIds
      ],

      authorityIds: [
        ...input.definition
          .authorityIds
      ],

      evidenceIds,

      sourceDocumentIds,

      federalDependencyIds:
        input.federalDependencies
          .map(
            item =>
              item.dependencyId
          ),

      provenanceDecisionIds:
        unique(
          input.provenanceDecisionIds
        ),

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

export class TaxGuardStateCalculationBoundary {

  static aiCalculateFinalLiability():
    never {
    throw new Error(
      'TG_STATE_AI_FINAL_CALCULATION_BLOCKED'
    );
  }

  static guessMissingFact():
    never {
    throw new Error(
      'TG_STATE_MISSING_FACT_GUESS_BLOCKED'
    );
  }

  static guessMissingAuthority():
    never {
    throw new Error(
      'TG_STATE_MISSING_AUTHORITY_GUESS_BLOCKED'
    );
  }
}
`
);



///////////This connects the state architecture to validated taxpayer facts and verified federal dependencies while maintaining TaxGuard's core boundaries:
////////validated facts → verified state rule pack → verified calculation definition → deterministic calculation → evidence/provenance trace → human review where required.


/////// M12 Part 3 of 4 — State Return Assembly, Form Mapping, Reconciliation & Professional Review

write(
  'src/taxguard/state/StateTaxPreparation.ts',
  String.raw`
import type {
  TaxGuardStateContext,
  TaxGuardStateReturnType,
  TaxGuardStateRulePack
} from './StateTaxArchitecture';

import type {
  TaxGuardStateCalculationResult
} from './StateTaxCalculation';

export interface TaxGuardStateFormLineBinding {
  bindingId: string;
  formId: string;
  lineId: string;
  calculationId: string;
  calculationType: string;
  value: string;
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  evidenceIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  immutable: true;
}

export interface TaxGuardStatePreparedReturn {
  preparedStateReturnId: string;
  context: TaxGuardStateContext;
  returnType: TaxGuardStateReturnType;
  rulePackId: string;
  formIds: readonly string[];
  lineBindings:
    readonly TaxGuardStateFormLineBinding[];
  calculationIds: readonly string[];
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  evidenceIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  requiresHumanReview: boolean;
  reviewReasons: readonly string[];
  assembledAt: string;
  deterministic: true;
  aiPrepared: false;
  externalFilingEnabled: false;
  immutable: true;
}

export interface TaxGuardStateReconciliationResult {
  valid: boolean;
  reasons: readonly string[];
}

export interface TaxGuardStateProfessionalApproval {
  approvalId: string;
  context: TaxGuardStateContext;
  preparedStateReturnId: string;
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
    TaxGuardStateContext
): TaxGuardStateContext {
  return {
    ...context
  };
}

function sameContext(
  left:
    TaxGuardStateContext,
  right:
    TaxGuardStateContext
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
    left.stateCode ===
      right.stateCode
  );
}

export class TaxGuardStateFormMappingEngine {

  map(
    input: {
      bindingId: string;
      formId: string;
      lineId: string;
      calculation:
        TaxGuardStateCalculationResult;
    }
  ): TaxGuardStateFormLineBinding {

    requireText(
      input.bindingId,
      'TG_STATE_FORM_BINDING_ID_REQUIRED'
    );

    requireText(
      input.formId,
      'TG_STATE_FORM_ID_REQUIRED'
    );

    requireText(
      input.lineId,
      'TG_STATE_FORM_LINE_REQUIRED'
    );

    if (
      input.calculation.ruleIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FORM_RULE_REQUIRED'
      );
    }

    if (
      input.calculation.authorityIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FORM_AUTHORITY_REQUIRED'
      );
    }

    if (
      input.calculation.evidenceIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FORM_EVIDENCE_REQUIRED'
      );
    }

    if (
      input.calculation
        .provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FORM_PROVENANCE_REQUIRED'
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

export class TaxGuardStateReturnAssemblyEngine {

  assemble(
    input: {
      preparedStateReturnId: string;

      context:
        TaxGuardStateContext;

      returnType:
        TaxGuardStateReturnType;

      rulePack:
        TaxGuardStateRulePack;

      calculations:
        readonly TaxGuardStateCalculationResult[];

      lineBindings:
        readonly TaxGuardStateFormLineBinding[];

      provenanceDecisionIds:
        readonly string[];
    }
  ): TaxGuardStatePreparedReturn {

    requireText(
      input.preparedStateReturnId,
      'TG_STATE_PREPARED_RETURN_ID_REQUIRED'
    );

    if (
      input.rulePack.status !==
        'VERIFIED'
    ) {
      throw new Error(
        'TG_STATE_PREP_RULE_PACK_NOT_VERIFIED'
      );
    }

    if (
      input.rulePack.stateCode !==
        input.context.stateCode ||
      input.rulePack.taxYear !==
        input.context.taxYear
    ) {
      throw new Error(
        'TG_STATE_PREP_RULE_PACK_CONTEXT_MISMATCH'
      );
    }

    if (
      input.calculations.length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_CALCULATION_REQUIRED'
      );
    }

    if (
      input.lineBindings.length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_FORM_BINDING_REQUIRED'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_PROVENANCE_REQUIRED'
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
          'TG_STATE_PREP_CALCULATION_CONTEXT_MISMATCH'
        );
      }

      if (
        calculation.aiCalculated !==
          false ||
        calculation.deterministic !==
          true
      ) {
        throw new Error(
          'TG_STATE_PREP_INVALID_CALCULATION_BOUNDARY'
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
          'TG_STATE_PREP_ORPHAN_FORM_BINDING'
        );
      }
    }

    const ruleIds =
      unique([
        ...input.rulePack.ruleIds,

        ...input.calculations
          .flatMap(
            calculation =>
              calculation.ruleIds
          )
      ]);

    const authorityIds =
      unique([
        ...input.rulePack.authorityIds,

        ...input.calculations
          .flatMap(
            calculation =>
              calculation.authorityIds
          )
      ]);

    if (
      ruleIds.length === 0 ||
      authorityIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_RULE_AUTHORITY_REQUIRED'
      );
    }

    const evidenceIds =
      unique(
        input.calculations
          .flatMap(
            calculation =>
              calculation.evidenceIds
          )
      );

    if (
      evidenceIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_EVIDENCE_REQUIRED'
      );
    }

    const reviewReasons =
      unique(
        input.calculations
          .flatMap(
            calculation =>
              calculation.reviewReasons
          )
      );

    const requiresHumanReview =
      input.calculations.some(
        calculation =>
          calculation
            .requiresHumanReview
      );

    return Object.freeze({
      preparedStateReturnId:
        input.preparedStateReturnId,

      context:
        cloneContext(
          input.context
        ),

      returnType:
        input.returnType,

      rulePackId:
        input.rulePack.rulePackId,

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

      provenanceDecisionIds:
        unique([
          ...input.provenanceDecisionIds,

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

export class TaxGuardStateReconciliationGuard {

  static evaluate(
    input: {
      preparedReturn:
        TaxGuardStatePreparedReturn;

      calculations:
        readonly TaxGuardStateCalculationResult[];
    }
  ): TaxGuardStateReconciliationResult {

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
      const expectedId
      of input.preparedReturn
        .calculationIds
    ) {
      if (
        !calculations.has(
          expectedId
        )
      ) {
        reasons.push(
          'STATE_CALCULATION_MISSING:' +
          expectedId
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
          'STATE_FORM_BINDING_CALCULATION_MISSING:' +
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
          'STATE_RECONCILIATION_CONTEXT_MISMATCH:' +
          binding.bindingId
        );
      }

      if (
        calculation.value !==
          binding.value
      ) {
        reasons.push(
          'STATE_FORM_VALUE_MISMATCH:' +
          binding.bindingId
        );
      }

      if (
        calculation.calculationType !==
          binding.calculationType
      ) {
        reasons.push(
          'STATE_FORM_CALCULATION_TYPE_MISMATCH:' +
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
      typeof TaxGuardStateReconciliationGuard.evaluate
    >[0]
  ): true {

    const result =
      this.evaluate(
        input
      );

    if (!result.valid) {
      throw new Error(
        'TG_STATE_RECONCILIATION_BLOCKED:' +
        result.reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardStateProfessionalReviewRegistry {

  private readonly approvals =
    new Map<
      string,
      TaxGuardStateProfessionalApproval
    >();

  approve(
    input: {
      approvalId: string;

      context:
        TaxGuardStateContext;

      preparedStateReturn:
        TaxGuardStatePreparedReturn;

      returnVersionId: string;

      requestedBy: string;

      approvedBy: string;

      approvedByRole:
        | 'REVIEWER'
        | 'CPA'
        | 'EA';

      provenanceDecisionId: string;
    }
  ): TaxGuardStateProfessionalApproval {

    requireText(
      input.approvalId,
      'TG_STATE_APPROVAL_ID_REQUIRED'
    );

    requireText(
      input.returnVersionId,
      'TG_STATE_APPROVAL_VERSION_REQUIRED'
    );

    requireText(
      input.requestedBy,
      'TG_STATE_APPROVAL_REQUESTER_REQUIRED'
    );

    requireText(
      input.approvedBy,
      'TG_STATE_APPROVAL_APPROVER_REQUIRED'
    );

    requireText(
      input.provenanceDecisionId,
      'TG_STATE_APPROVAL_PROVENANCE_REQUIRED'
    );

    if (
      input.requestedBy ===
        input.approvedBy
    ) {
      throw new Error(
        'TG_STATE_APPROVAL_MAKER_CHECKER_REQUIRED'
      );
    }

    if (
      !sameContext(
        input.context,
        input.preparedStateReturn
          .context
      )
    ) {
      throw new Error(
        'TG_STATE_APPROVAL_CONTEXT_MISMATCH'
      );
    }

    if (
      this.approvals.has(
        input.approvalId
      )
    ) {
      throw new Error(
        'TG_STATE_APPROVAL_DUPLICATE'
      );
    }

    const approval:
      TaxGuardStateProfessionalApproval =
        Object.freeze({
          approvalId:
            input.approvalId,

          context:
            cloneContext(
              input.context
            ),

          preparedStateReturnId:
            input.preparedStateReturn
              .preparedStateReturnId,

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

  get(
    approvalId: string
  ): TaxGuardStateProfessionalApproval {

    const approval =
      this.approvals.get(
        approvalId
      );

    if (!approval) {
      throw new Error(
        'TG_STATE_APPROVAL_NOT_FOUND'
      );
    }

    return {
      ...approval,
      context: {
        ...approval.context
      }
    };
  }
}

export class TaxGuardStateWorkflowGate {

  static assertReady(
    input: {
      jurisdictionVerified: boolean;
      rulePackVerified: boolean;
      reconciliationValid: boolean;
      unresolvedExceptionIds:
        readonly string[];
      provenanceApproved: boolean;
      professionalApprovalPresent: boolean;
    }
  ): true {

    const reasons:
      string[] = [];

    if (
      !input.jurisdictionVerified
    ) {
      reasons.push(
        'STATE_JURISDICTION_NOT_VERIFIED'
      );
    }

    if (
      !input.rulePackVerified
    ) {
      reasons.push(
        'STATE_RULE_PACK_NOT_VERIFIED'
      );
    }

    if (
      !input.reconciliationValid
    ) {
      reasons.push(
        'STATE_RECONCILIATION_REQUIRED'
      );
    }

    if (
      input.unresolvedExceptionIds
        .length > 0
    ) {
      reasons.push(
        'STATE_UNRESOLVED_EXCEPTIONS'
      );
    }

    if (
      !input.provenanceApproved
    ) {
      reasons.push(
        'STATE_PROVENANCE_APPROVAL_REQUIRED'
      );
    }

    if (
      !input.professionalApprovalPresent
    ) {
      reasons.push(
        'STATE_PROFESSIONAL_APPROVAL_REQUIRED'
      );
    }

    if (
      reasons.length > 0
    ) {
      throw new Error(
        'TG_STATE_WORKFLOW_GATE_BLOCKED:' +
        reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardStateExternalFilingGuard {

  static submit(): never {
    throw new Error(
      'TG_STATE_EXTERNAL_FILING_DISABLED'
    );
  }
}

export class TaxGuardStateAiPreparationBoundary {

  static prepareFinalReturn(): never {
    throw new Error(
      'TG_STATE_AI_FINAL_PREPARATION_BLOCKED'
    );
  }

  static approveMaterialDecision(): never {
    throw new Error(
      'TG_STATE_AI_FINAL_APPROVAL_BLOCKED'
    );
  }
}
`
);

write(
  'src/taxguard/state/index.ts',
  String.raw`
export * from './StateTaxArchitecture';
export * from './StateTaxCalculation';
export * from './StateTaxPreparation';
`
);
write(
  'src/tests/taxGuardStateTaxArchitecture.test.ts',
  String.raw`
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
`
);

console.log('');
console.log(
  '============================================================'
);
console.log(
  'TaxGuard M12 State Tax Architecture generated successfully.'
);
console.log(
  '============================================================'
);
console.log('Created:');
console.log(
  'src/taxguard/state/StateTaxArchitecture.ts'
);
console.log(
  'src/taxguard/state/StateTaxCalculation.ts'
);
console.log(
  'src/taxguard/state/StateTaxPreparation.ts'
);
console.log(
  'src/taxguard/state/index.ts'
);
console.log(
  'src/tests/taxGuardStateTaxArchitecture.test.ts'
);
console.log('');
console.log(
  'M1-M11 source was not modified.'
);
console.log(
  'No statutory state tax rates were invented.'
);
console.log(
  'External state filing remains DISABLED.'
);







