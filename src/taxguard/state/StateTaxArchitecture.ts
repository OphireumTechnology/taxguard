
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
