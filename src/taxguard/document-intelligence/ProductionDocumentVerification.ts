import type {
  TaxGuardDocumentContext,
  TaxGuardDocumentSecurityRecord,
  TaxGuardDocumentSource,
  TaxGuardQuarantineRecord
} from './ProductionDocumentIntelligence';

import type {
  TaxGuardExtractedField,
  TaxGuardExtractionArtifact,
  TaxGuardOcrArtifact
} from './ProductionDocumentExtraction';

export type TaxGuardDocumentReviewerRole =
  | 'PREPARER'
  | 'REVIEWER'
  | 'CPA'
  | 'EA';

export type TaxGuardFieldReviewDisposition =
  | 'VERIFIED_AS_EXTRACTED'
  | 'CORRECTED'
  | 'REJECTED';

export interface TaxGuardFieldVerificationRecord {
  verificationId: string;

  context:
    TaxGuardDocumentContext;

  sourceDocumentId: string;
  ocrArtifactId: string;
  extractionArtifactId: string;
  extractedFieldId: string;

  fieldPath: string;

  extractedValue: string;

  verifiedValue?: string;

  disposition:
    TaxGuardFieldReviewDisposition;

  reviewerId: string;

  reviewerRole:
    TaxGuardDocumentReviewerRole;

  reviewedAt: string;

  pageNumber: number;

  boundingBox: {
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };

  evidenceIds:
    readonly string[];

  provenanceDecisionId: string;

  immutable: true;
}

export interface TaxGuardValidatedDocumentFact {
  factId: string;

  context:
    TaxGuardDocumentContext;

  sourceDocumentId: string;
  ocrArtifactId: string;
  extractionArtifactId: string;
  extractedFieldId: string;
  verificationId: string;

  factPath: string;
  value: string;

  pageNumber: number;

  boundingBox: {
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };

  evidenceIds:
    readonly string[];

  provenanceDecisionId: string;

  validatedBy: string;
  validatedByRole:
    TaxGuardDocumentReviewerRole;

  validatedAt: string;

  validated: true;
  aiProposedOnly: false;
  immutable: true;
}

export interface TaxGuardDocumentReleaseDecision {
  releaseDecisionId: string;

  context:
    TaxGuardDocumentContext;

  sourceDocumentId: string;

  validatedFactIds:
    readonly string[];

  verificationIds:
    readonly string[];

  releasedBy: string;

  releasedByRole:
    TaxGuardDocumentReviewerRole;

  releasedAt: string;

  downstreamUseAllowed: true;

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

function sameContext(
  left:
    TaxGuardDocumentContext,

  right:
    TaxGuardDocumentContext
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

export class TaxGuardHumanFieldVerificationRegistry {

  private readonly verifications =
    new Map<
      string,
      TaxGuardFieldVerificationRecord
    >();

  verify(
    input: {
      verificationId: string;

      document:
        TaxGuardDocumentSource;

      ocr:
        TaxGuardOcrArtifact;

      extraction:
        TaxGuardExtractionArtifact;

      field:
        TaxGuardExtractedField;

      disposition:
        TaxGuardFieldReviewDisposition;

      correctedValue?: string;

      reviewerId: string;

      reviewerRole:
        TaxGuardDocumentReviewerRole;

      evidenceIds:
        readonly string[];

      provenanceDecisionId:
        string;
    }
  ):
    TaxGuardFieldVerificationRecord {

    requireText(
      input.verificationId,
      'TG_DOC_VERIFICATION_ID_REQUIRED'
    );

    requireText(
      input.reviewerId,
      'TG_DOC_VERIFICATION_REVIEWER_REQUIRED'
    );

    requireText(
      input.provenanceDecisionId,
      'TG_DOC_VERIFICATION_PROVENANCE_REQUIRED'
    );

    if (
      input.evidenceIds.length === 0
    ) {
      throw new Error(
        'TG_DOC_VERIFICATION_EVIDENCE_REQUIRED'
      );
    }

    if (
      this.verifications.has(
        input.verificationId
      )
    ) {
      throw new Error(
        'TG_DOC_VERIFICATION_DUPLICATE'
      );
    }

    if (
      input.document.sourceDocumentId !==
        input.ocr.sourceDocumentId ||

      input.document.sourceDocumentId !==
        input.extraction.sourceDocumentId
    ) {
      throw new Error(
        'TG_DOC_VERIFICATION_SOURCE_MISMATCH'
      );
    }

    if (
      input.ocr.ocrArtifactId !==
        input.extraction.ocrArtifactId
    ) {
      throw new Error(
        'TG_DOC_VERIFICATION_OCR_MISMATCH'
      );
    }

    if (
      !sameContext(
        input.document.context,
        input.ocr.context
      ) ||

      !sameContext(
        input.document.context,
        input.extraction.context
      )
    ) {
      throw new Error(
        'TG_DOC_VERIFICATION_CONTEXT_MISMATCH'
      );
    }

    const extractionField =
      input.extraction.fields.find(
        candidate =>
          candidate.extractedFieldId ===
            input.field.extractedFieldId
      );

    if (!extractionField) {
      throw new Error(
        'TG_DOC_VERIFICATION_FIELD_NOT_IN_EXTRACTION'
      );
    }

    if (
      input.disposition ===
        'CORRECTED' &&
      !input.correctedValue?.trim()
    ) {
      throw new Error(
        'TG_DOC_VERIFICATION_CORRECTED_VALUE_REQUIRED'
      );
    }

    if (
      input.disposition ===
        'REJECTED' &&
      input.correctedValue
    ) {
      throw new Error(
        'TG_DOC_VERIFICATION_REJECTED_VALUE_NOT_ALLOWED'
      );
    }

    const verifiedValue =
      input.disposition ===
        'VERIFIED_AS_EXTRACTED'
        ? input.field.normalizedValue ??
          input.field.rawValue

        : input.disposition ===
            'CORRECTED'
          ? input.correctedValue
              ?.trim()

          : undefined;

    const record:
      TaxGuardFieldVerificationRecord =
        Object.freeze({
          verificationId:
            input.verificationId,

          context: {
            ...input.document.context
          },

          sourceDocumentId:
            input.document
              .sourceDocumentId,

          ocrArtifactId:
            input.ocr
              .ocrArtifactId,

          extractionArtifactId:
            input.extraction
              .extractionArtifactId,

          extractedFieldId:
            input.field
              .extractedFieldId,

          fieldPath:
            input.field.fieldPath,

          extractedValue:
            input.field.rawValue,

          verifiedValue,

          disposition:
            input.disposition,

          reviewerId:
            input.reviewerId,

          reviewerRole:
            input.reviewerRole,

          reviewedAt:
            new Date()
              .toISOString(),

          pageNumber:
            input.field.pageNumber,

          boundingBox: {
            ...input.field
              .boundingBox
          },

          evidenceIds:
            unique(
              input.evidenceIds
            ),

          provenanceDecisionId:
            input.provenanceDecisionId,

          immutable:
            true
        });

    this.verifications.set(
      record.verificationId,
      record
    );

    return this.clone(
      record
    );
  }

  get(
    verificationId: string
  ):
    TaxGuardFieldVerificationRecord {

    const record =
      this.verifications.get(
        verificationId
      );

    if (!record) {
      throw new Error(
        'TG_DOC_VERIFICATION_NOT_FOUND'
      );
    }

    return this.clone(
      record
    );
  }

  private clone(
    record:
      TaxGuardFieldVerificationRecord
  ):
    TaxGuardFieldVerificationRecord {

    return {
      ...record,

      context: {
        ...record.context
      },

      boundingBox: {
        ...record.boundingBox
      },

      evidenceIds: [
        ...record.evidenceIds
      ]
    };
  }
}

export class TaxGuardValidatedDocumentFactRegistry {

  private readonly facts =
    new Map<
      string,
      TaxGuardValidatedDocumentFact
    >();

  create(
    input: {
      factId: string;

      verification:
        TaxGuardFieldVerificationRecord;
    }
  ):
    TaxGuardValidatedDocumentFact {

    requireText(
      input.factId,
      'TG_DOC_VALIDATED_FACT_ID_REQUIRED'
    );

    if (
      this.facts.has(
        input.factId
      )
    ) {
      throw new Error(
        'TG_DOC_VALIDATED_FACT_DUPLICATE'
      );
    }

    if (
      input.verification
        .disposition ===
        'REJECTED'
    ) {
      throw new Error(
        'TG_DOC_REJECTED_FIELD_CANNOT_BECOME_FACT'
      );
    }

    if (
      !input.verification
        .verifiedValue
        ?.trim()
    ) {
      throw new Error(
        'TG_DOC_VALIDATED_FACT_VALUE_REQUIRED'
      );
    }

    const fact:
      TaxGuardValidatedDocumentFact =
        Object.freeze({
          factId:
            input.factId,

          context: {
            ...input.verification
              .context
          },

          sourceDocumentId:
            input.verification
              .sourceDocumentId,

          ocrArtifactId:
            input.verification
              .ocrArtifactId,

          extractionArtifactId:
            input.verification
              .extractionArtifactId,

          extractedFieldId:
            input.verification
              .extractedFieldId,

          verificationId:
            input.verification
              .verificationId,

          factPath:
            input.verification
              .fieldPath,

          value:
            input.verification
              .verifiedValue,

          pageNumber:
            input.verification
              .pageNumber,

          boundingBox: {
            ...input.verification
              .boundingBox
          },

          evidenceIds: [
            ...input.verification
              .evidenceIds
          ],

          provenanceDecisionId:
            input.verification
              .provenanceDecisionId,

          validatedBy:
            input.verification
              .reviewerId,

          validatedByRole:
            input.verification
              .reviewerRole,

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
      fact.factId,
      fact
    );

    return this.clone(
      fact
    );
  }

  get(
    factId: string
  ):
    TaxGuardValidatedDocumentFact {

    const fact =
      this.facts.get(
        factId
      );

    if (!fact) {
      throw new Error(
        'TG_DOC_VALIDATED_FACT_NOT_FOUND'
      );
    }

    return this.clone(
      fact
    );
  }

  private clone(
    fact:
      TaxGuardValidatedDocumentFact
  ):
    TaxGuardValidatedDocumentFact {

    return {
      ...fact,

      context: {
        ...fact.context
      },

      boundingBox: {
        ...fact.boundingBox
      },

      evidenceIds: [
        ...fact.evidenceIds
      ]
    };
  }
}

export class TaxGuardDocumentReleaseGate {

  private readonly releases =
    new Map<
      string,
      TaxGuardDocumentReleaseDecision
    >();

  release(
    input: {
      releaseDecisionId: string;

      document:
        TaxGuardDocumentSource;

      quarantine:
        TaxGuardQuarantineRecord;

      security:
        TaxGuardDocumentSecurityRecord;

      extraction:
        TaxGuardExtractionArtifact;

      verifications:
        readonly TaxGuardFieldVerificationRecord[];

      validatedFacts:
        readonly TaxGuardValidatedDocumentFact[];

      releasedBy: string;

      releasedByRole:
        TaxGuardDocumentReviewerRole;
    }
  ):
    TaxGuardDocumentReleaseDecision {

    requireText(
      input.releaseDecisionId,
      'TG_DOC_RELEASE_ID_REQUIRED'
    );

    requireText(
      input.releasedBy,
      'TG_DOC_RELEASE_REVIEWER_REQUIRED'
    );

    if (
      this.releases.has(
        input.releaseDecisionId
      )
    ) {
      throw new Error(
        'TG_DOC_RELEASE_DUPLICATE'
      );
    }

    if (
      input.quarantine.status !==
        'RELEASED'
    ) {
      throw new Error(
        'TG_DOC_RELEASE_QUARANTINE_BLOCKED'
      );
    }

    if (
      input.security.status !==
        'PASSED'
    ) {
      throw new Error(
        'TG_DOC_RELEASE_SECURITY_BLOCKED'
      );
    }

    if (
      input.document.sourceDocumentId !==
        input.extraction.sourceDocumentId
    ) {
      throw new Error(
        'TG_DOC_RELEASE_SOURCE_MISMATCH'
      );
    }

    if (
      !sameContext(
        input.document.context,
        input.extraction.context
      )
    ) {
      throw new Error(
        'TG_DOC_RELEASE_CONTEXT_MISMATCH'
      );
    }

    if (
      input.verifications.length === 0
    ) {
      throw new Error(
        'TG_DOC_RELEASE_VERIFICATION_REQUIRED'
      );
    }

    if (
      input.validatedFacts.length === 0
    ) {
      throw new Error(
        'TG_DOC_RELEASE_VALIDATED_FACT_REQUIRED'
      );
    }

    const verifiedFieldIds =
      new Set(
        input.verifications
          .filter(
            verification =>
              verification.disposition !==
                'REJECTED'
          )
          .map(
            verification =>
              verification.extractedFieldId
          )
      );

    for (
      const field
      of input.extraction.fields
    ) {
      if (
        !verifiedFieldIds.has(
          field.extractedFieldId
        )
      ) {
        throw new Error(
          'TG_DOC_RELEASE_UNREVIEWED_FIELD:' +
          field.extractedFieldId
        );
      }
    }

    const verificationIds =
      new Set(
        input.verifications.map(
          verification =>
            verification.verificationId
        )
      );

    for (
      const fact
      of input.validatedFacts
    ) {
      if (
        fact.sourceDocumentId !==
          input.document.sourceDocumentId
      ) {
        throw new Error(
          'TG_DOC_RELEASE_FACT_SOURCE_MISMATCH'
        );
      }

      if (
        !sameContext(
          fact.context,
          input.document.context
        )
      ) {
        throw new Error(
          'TG_DOC_RELEASE_FACT_CONTEXT_MISMATCH'
        );
      }

      if (
        !verificationIds.has(
          fact.verificationId
        )
      ) {
        throw new Error(
          'TG_DOC_RELEASE_ORPHAN_FACT'
        );
      }

      if (
        !fact.validated ||
        fact.aiProposedOnly
      ) {
        throw new Error(
          'TG_DOC_RELEASE_UNVALIDATED_FACT'
        );
      }
    }

    const release:
      TaxGuardDocumentReleaseDecision =
        Object.freeze({
          releaseDecisionId:
            input.releaseDecisionId,

          context: {
            ...input.document.context
          },

          sourceDocumentId:
            input.document
              .sourceDocumentId,

          validatedFactIds:
            input.validatedFacts.map(
              fact =>
                fact.factId
            ),

          verificationIds:
            input.verifications.map(
              verification =>
                verification
                  .verificationId
            ),

          releasedBy:
            input.releasedBy,

          releasedByRole:
            input.releasedByRole,

          releasedAt:
            new Date()
              .toISOString(),

          downstreamUseAllowed:
            true,

          immutable:
            true
        });

    this.releases.set(
      release.releaseDecisionId,
      release
    );

    return {
      ...release,

      context: {
        ...release.context
      },

      validatedFactIds: [
        ...release.validatedFactIds
      ],

      verificationIds: [
        ...release.verificationIds
      ]
    };
  }
}

export class TaxGuardDocumentDownstreamGate {

  static assertMayUseTaxFacts(
    input: {
      release:
        TaxGuardDocumentReleaseDecision;

      facts:
        readonly TaxGuardValidatedDocumentFact[];
    }
  ): true {

    if (
      !input.release
        .downstreamUseAllowed
    ) {
      throw new Error(
        'TG_DOC_DOWNSTREAM_RELEASE_REQUIRED'
      );
    }

    const releasedFactIds =
      new Set(
        input.release
          .validatedFactIds
      );

    for (
      const fact
      of input.facts
    ) {
      if (
        !releasedFactIds.has(
          fact.factId
        )
      ) {
        throw new Error(
          'TG_DOC_DOWNSTREAM_FACT_NOT_RELEASED'
        );
      }

      if (
        !fact.validated ||
        fact.aiProposedOnly
      ) {
        throw new Error(
          'TG_DOC_DOWNSTREAM_FACT_NOT_VALIDATED'
        );
      }

      if (
        fact.sourceDocumentId !==
          input.release
            .sourceDocumentId
      ) {
        throw new Error(
          'TG_DOC_DOWNSTREAM_SOURCE_MISMATCH'
        );
      }

      if (
        !sameContext(
          fact.context,
          input.release.context
        )
      ) {
        throw new Error(
          'TG_DOC_DOWNSTREAM_CONTEXT_MISMATCH'
        );
      }
    }

    return true;
  }
}

export class TaxGuardDocumentVerificationBoundary {

  static aiApproveField():
    never {

    throw new Error(
      'TG_DOC_AI_FIELD_APPROVAL_BLOCKED'
    );
  }

  static aiCreateValidatedTaxFact():
    never {

    throw new Error(
      'TG_DOC_AI_VALIDATED_FACT_BLOCKED'
    );
  }

  static bypassHumanVerification():
    never {

    throw new Error(
      'TG_DOC_HUMAN_VERIFICATION_BYPASS_BLOCKED'
    );
  }

  static releaseUnreviewedExtraction():
    never {

    throw new Error(
      'TG_DOC_UNREVIEWED_EXTRACTION_RELEASE_BLOCKED'
    );
  }
}
