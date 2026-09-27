import type {
  TaxAuthoritySourceRegistry
} from './TaxAuthoritySourceRegistry';

import type {
  TaxRule,
  TaxRuleRegistry
} from './TaxRuleRegistry';

import type {
  TaxRuleApplicabilityResult
} from './TaxRuleApplicabilityEngine';

export type EvidenceValidationState =
  | 'pending'
  | 'validated'
  | 'rejected'
  | 'quarantined';

export type EvidenceOrigin =
  | 'uploaded_document'
  | 'validated_taxpayer_fact'
  | 'system_record'
  | 'professional_review'
  | 'external_verified_source';

export interface EvidenceLocator {
  pageNumber?: number;

  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  fieldName?: string;

  sourcePath?: string;
}

export interface TaxEvidenceRecord {
  evidenceId: string;

  origin: EvidenceOrigin;

  documentId?: string;

  documentHash?: string;

  artifactId?: string;

  factPath?: string;

  factValue?: unknown;

  locator?: EvidenceLocator;

  validationState:
    EvidenceValidationState;

  validatedBy?: string;

  validatedAt?: string;

  createdAt: string;
}

export interface TaxEvidenceAuthorityCitation {
  sourceId: string;

  sourceTitle: string;

  sourceUrl?: string;

  taxYear: number;

  locator?: string;

  section?: string;

  explanation?: string;
}

export interface RuleEvidenceBinding {
  bindingId: string;

  ruleId: string;

  taxYear: number;

  jurisdictionCode: string;

  evidenceIds: string[];

  citations: TaxEvidenceAuthorityCitation[];

  createdAt: string;

  createdBy: string;
}

export interface DecisionEvidencePackage {
  packageId: string;

  ruleId: string;

  ruleName: string;

  taxYear: number;

  jurisdictionCode: string;

  applicabilityState:
    TaxRuleApplicabilityResult['state'];

  applicable: boolean;

  professionalReviewRequired: boolean;

  evidence: TaxEvidenceRecord[];

  citations: TaxEvidenceAuthorityCitation[];

  integrity: {
    evidenceComplete: boolean;
    citationComplete: boolean;
    authorityVerified: boolean;
    ruleVerified: boolean;
    taxYearAligned: boolean;
    jurisdictionAligned: boolean;
  };

  readyForDecisionUse: boolean;

  reasonCodes: string[];

  createdAt: string;
}

function normalize(value: string): string {
  return value.trim();
}

function normalizeCode(value: string): string {
  return value
    .trim()
    .toUpperCase();
}

function cloneEvidence(
  evidence: TaxEvidenceRecord
): TaxEvidenceRecord {
  return {
    ...evidence,

    locator:
      evidence.locator
        ? {
            ...evidence.locator,

            boundingBox:
              evidence.locator.boundingBox
                ? {
                    ...evidence.locator.boundingBox
                  }
                : undefined
          }
        : undefined
  };
}

function cloneCitation(
  citation: TaxEvidenceAuthorityCitation
): TaxEvidenceAuthorityCitation {
  return {
    ...citation
  };
}

function assertDate(
  value: string | undefined,
  errorCode: string
): void {
  if (!value) {
    return;
  }

  if (
    Number.isNaN(
      Date.parse(value)
    )
  ) {
    throw new Error(errorCode);
  }
}

function isValidHash(
  value: string
): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function uniqueStrings(
  values: string[]
): string[] {
  return [
    ...new Set(
      values
        .map(value => value.trim())
        .filter(Boolean)
    )
  ];
}

export class TaxEvidenceCitationBindingService {

  private readonly evidence =
    new Map<string, TaxEvidenceRecord>();

  private readonly bindings =
    new Map<string, RuleEvidenceBinding>();

  constructor(
    private readonly authorities:
      TaxAuthoritySourceRegistry,

    private readonly rules:
      TaxRuleRegistry
  ) {}

  registerEvidence(
    input: Omit<
      TaxEvidenceRecord,
      'createdAt'
    >
  ): TaxEvidenceRecord {

    const evidenceId =
      normalize(input.evidenceId);

    if (!evidenceId) {
      throw new Error(
        'EVIDENCE_ID_REQUIRED'
      );
    }

    if (
      this.evidence.has(
        evidenceId
      )
    ) {
      throw new Error(
        'EVIDENCE_ALREADY_EXISTS'
      );
    }

    /*
     * Uploaded documents must carry a cryptographic
     * source hash. M6.5 does not silently invent one.
     */

    if (
      input.origin ===
        'uploaded_document'
    ) {
      if (
        !input.documentId ||
        !normalize(input.documentId)
      ) {
        throw new Error(
          'EVIDENCE_DOCUMENT_ID_REQUIRED'
        );
      }

      if (
        !input.documentHash ||
        !isValidHash(
          input.documentHash
        )
      ) {
        throw new Error(
          'VALID_SHA256_DOCUMENT_HASH_REQUIRED'
        );
      }
    }

    /*
     * Validated taxpayer facts require a fact path.
     */

    if (
      input.origin ===
        'validated_taxpayer_fact' &&
      (
        !input.factPath ||
        !normalize(input.factPath)
      )
    ) {
      throw new Error(
        'EVIDENCE_FACT_PATH_REQUIRED'
      );
    }

    if (
      input.validationState ===
        'validated'
    ) {
      if (
        !input.validatedBy ||
        !normalize(
          input.validatedBy
        )
      ) {
        throw new Error(
          'EVIDENCE_VALIDATOR_REQUIRED'
        );
      }

      if (!input.validatedAt) {
        throw new Error(
          'EVIDENCE_VALIDATION_TIME_REQUIRED'
        );
      }

      assertDate(
        input.validatedAt,
        'INVALID_EVIDENCE_VALIDATION_DATE'
      );
    }

    const record:
      TaxEvidenceRecord = {
        ...input,

        evidenceId,

        documentId:
          input.documentId
            ? normalize(
                input.documentId
              )
            : undefined,

        factPath:
          input.factPath
            ? normalize(
                input.factPath
              )
            : undefined,

        validatedBy:
          input.validatedBy
            ? normalize(
                input.validatedBy
              )
            : undefined,

        createdAt:
          new Date().toISOString()
      };

    this.evidence.set(
      evidenceId,
      record
    );

    return cloneEvidence(record);
  }

  getEvidence(
    evidenceId: string
  ): TaxEvidenceRecord | null {

    const record =
      this.evidence.get(
        normalize(evidenceId)
      );

    return record
      ? cloneEvidence(record)
      : null;
  }

  validateEvidence(
    evidenceId: string,
    reviewer: string,
    reviewedAt =
      new Date().toISOString()
  ): TaxEvidenceRecord {

    const record =
      this.evidence.get(
        normalize(evidenceId)
      );

    if (!record) {
      throw new Error(
        'EVIDENCE_NOT_FOUND'
      );
    }

    if (
      record.validationState ===
        'rejected' ||
      record.validationState ===
        'quarantined'
    ) {
      throw new Error(
        'EVIDENCE_NOT_ELIGIBLE_FOR_VALIDATION'
      );
    }

    const reviewerId =
      normalize(reviewer);

    if (!reviewerId) {
      throw new Error(
        'EVIDENCE_VALIDATOR_REQUIRED'
      );
    }

    assertDate(
      reviewedAt,
      'INVALID_EVIDENCE_VALIDATION_DATE'
    );

    record.validationState =
      'validated';

    record.validatedBy =
      reviewerId;

    record.validatedAt =
      reviewedAt;

    return cloneEvidence(record);
  }

  rejectEvidence(
    evidenceId: string
  ): TaxEvidenceRecord {

    const record =
      this.evidence.get(
        normalize(evidenceId)
      );

    if (!record) {
      throw new Error(
        'EVIDENCE_NOT_FOUND'
      );
    }

    record.validationState =
      'rejected';

    return cloneEvidence(record);
  }

  quarantineEvidence(
    evidenceId: string
  ): TaxEvidenceRecord {

    const record =
      this.evidence.get(
        normalize(evidenceId)
      );

    if (!record) {
      throw new Error(
        'EVIDENCE_NOT_FOUND'
      );
    }

    record.validationState =
      'quarantined';

    return cloneEvidence(record);
  }

  buildAuthorityCitations(
    ruleId: string,
    taxYear: number
  ): TaxEvidenceAuthorityCitation[] {

    const rule =
      this.rules.get(ruleId);

    if (!rule) {
      throw new Error(
        'CITATION_RULE_NOT_FOUND'
      );
    }

    if (
      rule.status !==
        'verified'
    ) {
      throw new Error(
        'CITATION_RULE_NOT_VERIFIED'
      );
    }

    if (
      !rule.taxYears.includes(
        taxYear
      )
    ) {
      throw new Error(
        'CITATION_TAX_YEAR_MISMATCH'
      );
    }

    const citations:
      TaxEvidenceAuthorityCitation[] = [];

    for (
      const sourceId of
      rule.authoritySourceIds
    ) {
      const authority =
        this.authorities.get(
          sourceId
        );

      if (!authority) {
        throw new Error(
          'CITATION_AUTHORITY_NOT_FOUND'
        );
      }

      if (
        authority.status !==
          'verified'
      ) {
        throw new Error(
          'CITATION_AUTHORITY_NOT_VERIFIED'
        );
      }

      if (
        !authority.taxYears.includes(
          taxYear
        )
      ) {
        throw new Error(
          'CITATION_AUTHORITY_TAX_YEAR_MISMATCH'
        );
      }

      const ruleCitation =
        rule.citations.find(
          citation =>
            citation.sourceId ===
            sourceId
        );

      citations.push({
        sourceId,

        sourceTitle:
          authority.title,

        sourceUrl:
          authority.sourceUrl,

        taxYear,

        locator:
          ruleCitation?.locator,

        section:
          ruleCitation?.section,

        explanation:
          ruleCitation?.explanation
      });
    }

    return citations.map(
      cloneCitation
    );
  }

  bindRuleEvidence(
    input: {
      bindingId: string;
      ruleId: string;
      taxYear: number;
      jurisdictionCode: string;
      evidenceIds: string[];
      createdBy: string;
    }
  ): RuleEvidenceBinding {

    const bindingId =
      normalize(
        input.bindingId
      );

    if (!bindingId) {
      throw new Error(
        'BINDING_ID_REQUIRED'
      );
    }

    if (
      this.bindings.has(
        bindingId
      )
    ) {
      throw new Error(
        'EVIDENCE_BINDING_ALREADY_EXISTS'
      );
    }

    const rule =
      this.rules.get(
        input.ruleId
      );

    if (!rule) {
      throw new Error(
        'BINDING_RULE_NOT_FOUND'
      );
    }

    if (
      !this.rules.isUsableRule(
        rule.ruleId,
        input.taxYear
      )
    ) {
      throw new Error(
        'BINDING_RULE_NOT_USABLE'
      );
    }

    const jurisdictionCode =
      normalizeCode(
        input.jurisdictionCode
      );

    if (
      rule.jurisdictionCode !==
      jurisdictionCode
    ) {
      throw new Error(
        'BINDING_JURISDICTION_MISMATCH'
      );
    }

    const evidenceIds =
      uniqueStrings(
        input.evidenceIds
      );

    if (
      evidenceIds.length === 0
    ) {
      throw new Error(
        'BINDING_EVIDENCE_REQUIRED'
      );
    }

    for (
      const evidenceId of
      evidenceIds
    ) {
      const evidence =
        this.evidence.get(
          evidenceId
        );

      if (!evidence) {
        throw new Error(
          'BINDING_EVIDENCE_NOT_FOUND'
        );
      }

      if (
        evidence.validationState !==
          'validated'
      ) {
        throw new Error(
          'BINDING_EVIDENCE_NOT_VALIDATED'
        );
      }
    }

    const createdBy =
      normalize(
        input.createdBy
      );

    if (!createdBy) {
      throw new Error(
        'BINDING_CREATOR_REQUIRED'
      );
    }

    const citations =
      this.buildAuthorityCitations(
        rule.ruleId,
        input.taxYear
      );

    if (
      citations.length === 0
    ) {
      throw new Error(
        'BINDING_CITATION_REQUIRED'
      );
    }

    const binding:
      RuleEvidenceBinding = {
        bindingId,

        ruleId:
          rule.ruleId,

        taxYear:
          input.taxYear,

        jurisdictionCode,

        evidenceIds,

        citations,

        createdAt:
          new Date().toISOString(),

        createdBy
      };

    this.bindings.set(
      bindingId,
      binding
    );

    return {
      ...binding,

      evidenceIds: [
        ...binding.evidenceIds
      ],

      citations:
        binding.citations.map(
          cloneCitation
        )
    };
  }

  buildDecisionEvidencePackage(
    input: {
      packageId: string;

      applicability:
        TaxRuleApplicabilityResult;

      bindingId: string;
    }
  ): DecisionEvidencePackage {

    const packageId =
      normalize(
        input.packageId
      );

    if (!packageId) {
      throw new Error(
        'DECISION_PACKAGE_ID_REQUIRED'
      );
    }

    const binding =
      this.bindings.get(
        normalize(
          input.bindingId
        )
      );

    if (!binding) {
      throw new Error(
        'DECISION_BINDING_NOT_FOUND'
      );
    }

    const rule =
      this.rules.get(
        binding.ruleId
      );

    if (!rule) {
      throw new Error(
        'DECISION_RULE_NOT_FOUND'
      );
    }

    if (
      input.applicability.ruleId !==
      rule.ruleId
    ) {
      throw new Error(
        'DECISION_RULE_BINDING_MISMATCH'
      );
    }

    if (
      input.applicability.taxYear !==
      binding.taxYear
    ) {
      throw new Error(
        'DECISION_TAX_YEAR_BINDING_MISMATCH'
      );
    }

    if (
      normalizeCode(
        input.applicability
          .jurisdictionCode
      ) !==
      binding.jurisdictionCode
    ) {
      throw new Error(
        'DECISION_JURISDICTION_BINDING_MISMATCH'
      );
    }

    const evidence =
      binding.evidenceIds
        .map(
          evidenceId =>
            this.evidence.get(
              evidenceId
            )
        )
        .filter(
          (
            record
          ): record is TaxEvidenceRecord =>
            Boolean(record)
        )
        .map(
          cloneEvidence
        );

    const evidenceComplete =
      evidence.length ===
        binding.evidenceIds.length &&
      evidence.every(
        record =>
          record.validationState ===
          'validated'
      );

    const citationComplete =
      binding.citations.length > 0;

    const authorityVerified =
      rule.authoritySourceIds.every(
        sourceId =>
          this.authorities
            .isUsableAuthority(
              sourceId,
              binding.taxYear
            )
      );

    const ruleVerified =
      this.rules.isUsableRule(
        rule.ruleId,
        binding.taxYear
      );

    const taxYearAligned =
      rule.taxYears.includes(
        binding.taxYear
      ) &&
      input.applicability.taxYear ===
        binding.taxYear;

    const jurisdictionAligned =
      rule.jurisdictionCode ===
        binding.jurisdictionCode &&
      normalizeCode(
        input.applicability
          .jurisdictionCode
      ) ===
        binding.jurisdictionCode;

    const reasonCodes:
      string[] = [];

    if (!evidenceComplete) {
      reasonCodes.push(
        'EVIDENCE_INCOMPLETE'
      );
    }

    if (!citationComplete) {
      reasonCodes.push(
        'CITATION_INCOMPLETE'
      );
    }

    if (!authorityVerified) {
      reasonCodes.push(
        'AUTHORITY_NOT_VERIFIED'
      );
    }

    if (!ruleVerified) {
      reasonCodes.push(
        'RULE_NOT_VERIFIED'
      );
    }

    if (!taxYearAligned) {
      reasonCodes.push(
        'TAX_YEAR_NOT_ALIGNED'
      );
    }

    if (!jurisdictionAligned) {
      reasonCodes.push(
        'JURISDICTION_NOT_ALIGNED'
      );
    }

    if (
      !input.applicability
        .applicable
    ) {
      reasonCodes.push(
        'RULE_NOT_APPLICABLE'
      );
    }

    const readyForDecisionUse =
      evidenceComplete &&
      citationComplete &&
      authorityVerified &&
      ruleVerified &&
      taxYearAligned &&
      jurisdictionAligned &&
      input.applicability
        .applicable;

    if (readyForDecisionUse) {
      reasonCodes.push(
        'DECISION_EVIDENCE_READY'
      );
    }

    return {
      packageId,

      ruleId:
        rule.ruleId,

      ruleName:
        rule.name,

      taxYear:
        binding.taxYear,

      jurisdictionCode:
        binding.jurisdictionCode,

      applicabilityState:
        input.applicability.state,

      applicable:
        input.applicability
          .applicable,

      professionalReviewRequired:
        input.applicability
          .professionalReviewRequired,

      evidence,

      citations:
        binding.citations.map(
          cloneCitation
        ),

      integrity: {
        evidenceComplete,
        citationComplete,
        authorityVerified,
        ruleVerified,
        taxYearAligned,
        jurisdictionAligned
      },

      readyForDecisionUse,

      reasonCodes,

      createdAt:
        new Date().toISOString()
    };
  }

  getBinding(
    bindingId: string
  ): RuleEvidenceBinding | null {

    const binding =
      this.bindings.get(
        normalize(bindingId)
      );

    if (!binding) {
      return null;
    }

    return {
      ...binding,

      evidenceIds: [
        ...binding.evidenceIds
      ],

      citations:
        binding.citations.map(
          cloneCitation
        )
    };
  }

  clearForTesting(): void {
    this.evidence.clear();
    this.bindings.clear();
  }
}
