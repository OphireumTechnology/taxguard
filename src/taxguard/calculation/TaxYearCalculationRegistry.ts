import type {
  TaxCalculationContext,
  TaxCalculationDefinition,
  TaxCalculationInput,
  TaxCalculationResult
} from './TaxCalculationContract';

export type TaxCalculationJurisdiction =
  | 'federal'
  | 'state'
  | 'local';

export type TaxCalculationDefinitionStatus =
  | 'DRAFT'
  | 'VERIFIED'
  | 'SUPERSEDED'
  | 'RETIRED';

export interface RegisteredTaxCalculation {
  calculationType: string;
  version: string;

  jurisdiction:
    TaxCalculationJurisdiction;

  supportedTaxYears:
    readonly number[];

  status:
    TaxCalculationDefinitionStatus;

  definition:
    TaxCalculationDefinition;

  ruleIds:
    readonly string[];

  authorityIds:
    readonly string[];

  verifiedBy?: string;
  verifiedAt?: string;

  supersededBy?: string;

  createdAt: string;
}

export interface RegisterCalculationInput {
  calculationType: string;

  version: string;

  jurisdiction:
    TaxCalculationJurisdiction;

  supportedTaxYears:
    readonly number[];

  definition:
    TaxCalculationDefinition;

  ruleIds:
    readonly string[];

  authorityIds:
    readonly string[];
}

export interface VerifyCalculationInput {
  calculationType: string;

  version: string;

  verifiedBy: string;
}

export interface ExecuteRegisteredCalculationInput {
  calculationType: string;

  version?: string;

  context:
    TaxCalculationContext;

  inputs:
    readonly TaxCalculationInput[];
}

function required(
  value: string,
  code: string
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

function key(
  calculationType: string,
  version: string
): string {
  return (
    calculationType.trim() +
    '@' +
    version.trim()
  );
}

function copy(
  record:
    RegisteredTaxCalculation
): RegisteredTaxCalculation {
  return {
    ...record,

    supportedTaxYears:
      [...record.supportedTaxYears],

    ruleIds:
      [...record.ruleIds],

    authorityIds:
      [...record.authorityIds]
  };
}

export class TaxYearCalculationRegistry {
  private static readonly records =
    new Map<
      string,
      RegisteredTaxCalculation
    >();

  static registerDraft(
    input:
      RegisterCalculationInput
  ): RegisteredTaxCalculation {
    const calculationType =
      required(
        input.calculationType,
        'TAX_CALCULATION_TYPE_REQUIRED'
      );

    const version =
      required(
        input.version,
        'TAX_CALCULATION_VERSION_REQUIRED'
      );

    if (
      input.supportedTaxYears
        .length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_TAX_YEAR_REQUIRED'
      );
    }

    for (
      const taxYear
      of input.supportedTaxYears
    ) {
      if (
        !Number.isInteger(
          taxYear
        ) ||
        taxYear < 1900 ||
        taxYear > 2200
      ) {
        throw new Error(
          'TAX_CALCULATION_INVALID_TAX_YEAR'
        );
      }
    }

    if (
      new Set(
        input.supportedTaxYears
      ).size !==
      input.supportedTaxYears.length
    ) {
      throw new Error(
        'TAX_CALCULATION_DUPLICATE_TAX_YEAR'
      );
    }

    if (
      input.ruleIds.length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_VERIFIED_RULE_REQUIRED'
      );
    }

    if (
      input.authorityIds.length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_VERIFIED_AUTHORITY_REQUIRED'
      );
    }

    if (
      input.definition
        .calculationType !==
      calculationType
    ) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_TYPE_MISMATCH'
      );
    }

    if (
      input.definition.version !==
      version
    ) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_VERSION_MISMATCH'
      );
    }

    const definitionYears =
      [
        ...input.definition
          .supportedTaxYears
      ].sort();

    const registrationYears =
      [
        ...input.supportedTaxYears
      ].sort();

    if (
      JSON.stringify(
        definitionYears
      ) !==
      JSON.stringify(
        registrationYears
      )
    ) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_TAX_YEAR_MISMATCH'
      );
    }

    const recordKey =
      key(
        calculationType,
        version
      );

    if (
      this.records.has(
        recordKey
      )
    ) {
      throw new Error(
        'TAX_CALCULATION_DUPLICATE_DEFINITION'
      );
    }

    const record:
      RegisteredTaxCalculation = {
        calculationType,

        version,

        jurisdiction:
          input.jurisdiction,

        supportedTaxYears:
          [
            ...input
              .supportedTaxYears
          ],

        status:
          'DRAFT',

        definition:
          input.definition,

        ruleIds:
          [...input.ruleIds],

        authorityIds:
          [...input.authorityIds],

        createdAt:
          new Date()
            .toISOString()
      };

    this.records.set(
      recordKey,
      record
    );

    return copy(record);
  }

  static verify(
    input:
      VerifyCalculationInput
  ): RegisteredTaxCalculation {
    const recordKey =
      key(
        input.calculationType,
        input.version
      );

    const record =
      this.records.get(
        recordKey
      );

    if (!record) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_FOUND'
      );
    }

    if (
      record.status !==
      'DRAFT'
    ) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_DRAFT'
      );
    }

    const verifiedBy =
      required(
        input.verifiedBy,
        'TAX_CALCULATION_VERIFIER_REQUIRED'
      );

    const verified:
      RegisteredTaxCalculation = {
        ...record,

        status:
          'VERIFIED',

        verifiedBy,

        verifiedAt:
          new Date()
            .toISOString()
      };

    this.records.set(
      recordKey,
      verified
    );

    return copy(
      verified
    );
  }

  static get(
    calculationType: string,
    version: string
  ):
    RegisteredTaxCalculation |
    undefined {
    const record =
      this.records.get(
        key(
          calculationType,
          version
        )
      );

    return record
      ? copy(record)
      : undefined;
  }

  static findVerified(
    calculationType: string,
    taxYear: number,
    jurisdiction:
      TaxCalculationJurisdiction
  ): RegisteredTaxCalculation[] {
    return [
      ...this.records.values()
    ]
      .filter(
        record =>
          record
            .calculationType ===
            calculationType &&

          record.status ===
            'VERIFIED' &&

          record.jurisdiction ===
            jurisdiction &&

          record
            .supportedTaxYears
            .includes(
              taxYear
            )
      )
      .map(copy);
  }

  static resolveVerified(
    calculationType: string,
    taxYear: number,
    jurisdiction:
      TaxCalculationJurisdiction
  ): RegisteredTaxCalculation {
    const matches =
      this.findVerified(
        calculationType,
        taxYear,
        jurisdiction
      );

    if (
      matches.length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_NO_VERIFIED_DEFINITION'
      );
    }

    if (
      matches.length > 1
    ) {
      throw new Error(
        'TAX_CALCULATION_AMBIGUOUS_VERIFIED_DEFINITION'
      );
    }

    return matches[0];
  }

  static execute(
    request:
      ExecuteRegisteredCalculationInput
  ): TaxCalculationResult {
    const record =
      request.version
        ? this.get(
            request.calculationType,
            request.version
          )
        : this.resolveVerified(
            request.calculationType,
            request.context
              .taxYear,
            request.context
              .jurisdiction
          );

    if (!record) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_FOUND'
      );
    }

    if (
      record.status !==
      'VERIFIED'
    ) {
      throw new Error(
        'TAX_CALCULATION_UNVERIFIED_DEFINITION_BLOCKED'
      );
    }

    if (
      record.jurisdiction !==
      request.context
        .jurisdiction
    ) {
      throw new Error(
        'TAX_CALCULATION_WRONG_JURISDICTION'
      );
    }

    if (
      !record
        .supportedTaxYears
        .includes(
          request.context
            .taxYear
        )
    ) {
      throw new Error(
        'TAX_CALCULATION_UNSUPPORTED_TAX_YEAR'
      );
    }

    if (
      request.context
        .calculationType !==
      record.calculationType
    ) {
      throw new Error(
        'TAX_CALCULATION_CONTEXT_TYPE_MISMATCH'
      );
    }

    const contextRules =
      new Set(
        request.context.ruleIds
      );

    for (
      const ruleId
      of record.ruleIds
    ) {
      if (
        !contextRules.has(
          ruleId
        )
      ) {
        throw new Error(
          'TAX_CALCULATION_RULE_PROVENANCE_MISMATCH'
        );
      }
    }

    const contextAuthorities =
      new Set(
        request.context
          .authorityIds
      );

    for (
      const authorityId
      of record.authorityIds
    ) {
      if (
        !contextAuthorities.has(
          authorityId
        )
      ) {
        throw new Error(
          'TAX_CALCULATION_AUTHORITY_PROVENANCE_MISMATCH'
        );
      }
    }

    return record
      .definition
      .execute(
        request.context,
        request.inputs
      );
  }

  static supersede(
    calculationType: string,
    version: string,
    supersededBy: string
  ): RegisteredTaxCalculation {
    const recordKey =
      key(
        calculationType,
        version
      );

    const record =
      this.records.get(
        recordKey
      );

    if (!record) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_FOUND'
      );
    }

    if (
      record.status !==
      'VERIFIED'
    ) {
      throw new Error(
        'TAX_CALCULATION_ONLY_VERIFIED_CAN_BE_SUPERSEDED'
      );
    }

    const replacement =
      required(
        supersededBy,
        'TAX_CALCULATION_SUPERSEDING_VERSION_REQUIRED'
      );

    if (
      replacement ===
      version
    ) {
      throw new Error(
        'TAX_CALCULATION_SELF_SUPERSESSION_BLOCKED'
      );
    }

    const updated:
      RegisteredTaxCalculation = {
        ...record,

        status:
          'SUPERSEDED',

        supersededBy:
          replacement
      };

    this.records.set(
      recordKey,
      updated
    );

    return copy(
      updated
    );
  }

  static retire(
    calculationType: string,
    version: string
  ): RegisteredTaxCalculation {
    const recordKey =
      key(
        calculationType,
        version
      );

    const record =
      this.records.get(
        recordKey
      );

    if (!record) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_FOUND'
      );
    }

    const updated:
      RegisteredTaxCalculation = {
        ...record,

        status:
          'RETIRED'
      };

    this.records.set(
      recordKey,
      updated
    );

    return copy(
      updated
    );
  }

  static clearForTests(): void {
    this.records.clear();
  }
}