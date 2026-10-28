import type {
  TaxGuardDocumentContext,
  TaxGuardDocumentProviderCapability,
  TaxGuardDocumentSecurityRecord,
  TaxGuardDocumentSource,
  TaxGuardQuarantineRecord
} from './ProductionDocumentIntelligence';

export interface TaxGuardBoundingBox {
  pageNumber: number;

  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TaxGuardOcrPage {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface TaxGuardOcrArtifact {
  ocrArtifactId: string;
  sourceDocumentId: string;

  context:
    TaxGuardDocumentContext;

  providerId: string;
  providerReferenceId: string;

  pages:
    readonly TaxGuardOcrPage[];

  averageConfidence: number;

  createdAt: string;

  productionProviderVerified: true;
  immutable: true;
}

export interface TaxGuardExtractedField {
  extractedFieldId: string;

  fieldPath: string;
  rawValue: string;
  normalizedValue?: string;

  confidence: number;

  pageNumber: number;

  boundingBox:
    TaxGuardBoundingBox;

  sourceText: string;

  requiresHumanReview: boolean;

  immutable: true;
}

export interface TaxGuardExtractionArtifact {
  extractionArtifactId: string;
  sourceDocumentId: string;
  ocrArtifactId: string;

  context:
    TaxGuardDocumentContext;

  providerId: string;
  providerReferenceId: string;

  fields:
    readonly TaxGuardExtractedField[];

  minimumConfidence: number;
  averageConfidence: number;

  requiresHumanReview: boolean;

  reviewReasons:
    readonly string[];

  createdAt: string;

  aiProposedOnly: true;
  taxVerified: false;
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

function validateConfidence(
  confidence: number,
  errorCode: string
): void {

  if (
    !Number.isFinite(
      confidence
    ) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error(
      errorCode
    );
  }
}

function validateBoundingBox(
  box:
    TaxGuardBoundingBox
): void {

  if (
    !Number.isInteger(
      box.pageNumber
    ) ||
    box.pageNumber < 1
  ) {
    throw new Error(
      'TG_DOC_BOUNDING_BOX_PAGE_INVALID'
    );
  }

  for (
    const value
    of [
      box.x,
      box.y,
      box.width,
      box.height
    ]
  ) {
    if (
      !Number.isFinite(
        value
      ) ||
      value < 0
    ) {
      throw new Error(
        'TG_DOC_BOUNDING_BOX_INVALID'
      );
    }
  }

  if (
    box.width <= 0 ||
    box.height <= 0
  ) {
    throw new Error(
      'TG_DOC_BOUNDING_BOX_INVALID'
    );
  }
}

function assertProvider(
  provider:
    TaxGuardDocumentProviderCapability,

  expectedType:
    'OCR' |
    'DOCUMENT_EXTRACTION'
): void {

  if (
    provider.providerType !==
      expectedType
  ) {
    throw new Error(
      'TG_DOC_PROVIDER_TYPE_MISMATCH'
    );
  }

  if (
    !provider.configured ||
    !provider.productionConnected
  ) {
    throw new Error(
      'TG_DOC_PROVIDER_NOT_PRODUCTION_READY'
    );
  }
}

function assertProcessingReleased(
  input: {
    document:
      TaxGuardDocumentSource;

    quarantine:
      TaxGuardQuarantineRecord;

    security:
      TaxGuardDocumentSecurityRecord;
  }
): void {

  if (
    input.quarantine.status !==
      'RELEASED'
  ) {
    throw new Error(
      'TG_DOC_OCR_QUARANTINE_BLOCKED'
    );
  }

  if (
    input.security.status !==
      'PASSED'
  ) {
    throw new Error(
      'TG_DOC_OCR_SECURITY_BLOCKED'
    );
  }

  if (
    input.document.sourceDocumentId !==
      input.quarantine.sourceDocumentId ||

    input.document.sourceDocumentId !==
      input.security.sourceDocumentId
  ) {
    throw new Error(
      'TG_DOC_OCR_DOCUMENT_MISMATCH'
    );
  }

  if (
    !sameContext(
      input.document.context,
      input.quarantine.context
    ) ||

    !sameContext(
      input.document.context,
      input.security.context
    )
  ) {
    throw new Error(
      'TG_DOC_OCR_CONTEXT_MISMATCH'
    );
  }
}

export class TaxGuardProductionOcrRegistry {

  private readonly artifacts =
    new Map<
      string,
      TaxGuardOcrArtifact
    >();

  create(
    input: {
      ocrArtifactId: string;

      document:
        TaxGuardDocumentSource;

      quarantine:
        TaxGuardQuarantineRecord;

      security:
        TaxGuardDocumentSecurityRecord;

      provider:
        TaxGuardDocumentProviderCapability;

      providerReferenceId: string;

      pages:
        readonly TaxGuardOcrPage[];
    }
  ):
    TaxGuardOcrArtifact {

    requireText(
      input.ocrArtifactId,
      'TG_DOC_OCR_ID_REQUIRED'
    );

    requireText(
      input.providerReferenceId,
      'TG_DOC_OCR_PROVIDER_REFERENCE_REQUIRED'
    );

    if (
      this.artifacts.has(
        input.ocrArtifactId
      )
    ) {
      throw new Error(
        'TG_DOC_OCR_DUPLICATE'
      );
    }

    assertProvider(
      input.provider,
      'OCR'
    );

    assertProcessingReleased({
      document:
        input.document,

      quarantine:
        input.quarantine,

      security:
        input.security
    });

    if (
      input.pages.length === 0
    ) {
      throw new Error(
        'TG_DOC_OCR_PAGES_REQUIRED'
      );
    }

    const pageNumbers =
      new Set<number>();

    let confidenceTotal = 0;

    const pages =
      input.pages.map(
        page => {

          if (
            !Number.isInteger(
              page.pageNumber
            ) ||
            page.pageNumber < 1
          ) {
            throw new Error(
              'TG_DOC_OCR_PAGE_NUMBER_INVALID'
            );
          }

          if (
            pageNumbers.has(
              page.pageNumber
            )
          ) {
            throw new Error(
              'TG_DOC_OCR_DUPLICATE_PAGE'
            );
          }

          pageNumbers.add(
            page.pageNumber
          );

          requireText(
            page.text,
            'TG_DOC_OCR_PAGE_TEXT_REQUIRED'
          );

          validateConfidence(
            page.confidence,
            'TG_DOC_OCR_CONFIDENCE_INVALID'
          );

          confidenceTotal +=
            page.confidence;

          return Object.freeze({
            ...page
          });
        }
      );

    const artifact:
      TaxGuardOcrArtifact =
        Object.freeze({
          ocrArtifactId:
            input.ocrArtifactId,

          sourceDocumentId:
            input.document
              .sourceDocumentId,

          context: {
            ...input.document.context
          },

          providerId:
            input.provider.providerId,

          providerReferenceId:
            input.providerReferenceId,

          pages,

          averageConfidence:
            confidenceTotal /
            pages.length,

          createdAt:
            new Date()
              .toISOString(),

          productionProviderVerified:
            true,

          immutable:
            true
        });

    this.artifacts.set(
      artifact.ocrArtifactId,
      artifact
    );

    return this.clone(
      artifact
    );
  }

  get(
    ocrArtifactId: string
  ):
    TaxGuardOcrArtifact {

    const artifact =
      this.artifacts.get(
        ocrArtifactId
      );

    if (!artifact) {
      throw new Error(
        'TG_DOC_OCR_NOT_FOUND'
      );
    }

    return this.clone(
      artifact
    );
  }

  private clone(
    artifact:
      TaxGuardOcrArtifact
  ):
    TaxGuardOcrArtifact {

    return {
      ...artifact,

      context: {
        ...artifact.context
      },

      pages:
        artifact.pages.map(
          page => ({
            ...page
          })
        )
    };
  }
}

export class TaxGuardProductionExtractionRegistry {

  private readonly artifacts =
    new Map<
      string,
      TaxGuardExtractionArtifact
    >();

  create(
    input: {
      extractionArtifactId:
        string;

      document:
        TaxGuardDocumentSource;

      ocr:
        TaxGuardOcrArtifact;

      provider:
        TaxGuardDocumentProviderCapability;

      providerReferenceId:
        string;

      fields:
        readonly TaxGuardExtractedField[];

      minimumConfidence?:
        number;
    }
  ):
    TaxGuardExtractionArtifact {

    requireText(
      input.extractionArtifactId,
      'TG_DOC_EXTRACTION_ID_REQUIRED'
    );

    requireText(
      input.providerReferenceId,
      'TG_DOC_EXTRACTION_PROVIDER_REFERENCE_REQUIRED'
    );

    if (
      this.artifacts.has(
        input.extractionArtifactId
      )
    ) {
      throw new Error(
        'TG_DOC_EXTRACTION_DUPLICATE'
      );
    }

    assertProvider(
      input.provider,
      'DOCUMENT_EXTRACTION'
    );

    if (
      input.document.sourceDocumentId !==
        input.ocr.sourceDocumentId
    ) {
      throw new Error(
        'TG_DOC_EXTRACTION_SOURCE_MISMATCH'
      );
    }

    if (
      !sameContext(
        input.document.context,
        input.ocr.context
      )
    ) {
      throw new Error(
        'TG_DOC_EXTRACTION_CONTEXT_MISMATCH'
      );
    }

    if (
      input.fields.length === 0
    ) {
      throw new Error(
        'TG_DOC_EXTRACTION_FIELDS_REQUIRED'
      );
    }

    const minimumConfidence =
      input.minimumConfidence ??
      0.90;

    validateConfidence(
      minimumConfidence,
      'TG_DOC_EXTRACTION_THRESHOLD_INVALID'
    );

    const fieldIds =
      new Set<string>();

    const ocrPages =
      new Set(
        input.ocr.pages.map(
          page =>
            page.pageNumber
        )
      );

    let confidenceTotal = 0;

    const reviewReasons:
      string[] = [];

    const fields =
      input.fields.map(
        field => {

          requireText(
            field.extractedFieldId,
            'TG_DOC_EXTRACTED_FIELD_ID_REQUIRED'
          );

          requireText(
            field.fieldPath,
            'TG_DOC_EXTRACTED_FIELD_PATH_REQUIRED'
          );

          requireText(
            field.rawValue,
            'TG_DOC_EXTRACTED_RAW_VALUE_REQUIRED'
          );

          requireText(
            field.sourceText,
            'TG_DOC_EXTRACTED_SOURCE_TEXT_REQUIRED'
          );

          if (
            fieldIds.has(
              field.extractedFieldId
            )
          ) {
            throw new Error(
              'TG_DOC_EXTRACTED_FIELD_DUPLICATE'
            );
          }

          fieldIds.add(
            field.extractedFieldId
          );

          validateConfidence(
            field.confidence,
            'TG_DOC_EXTRACTED_CONFIDENCE_INVALID'
          );

          validateBoundingBox(
            field.boundingBox
          );

          if (
            field.pageNumber !==
              field.boundingBox
                .pageNumber
          ) {
            throw new Error(
              'TG_DOC_EXTRACTED_BOUNDING_BOX_PAGE_MISMATCH'
            );
          }

          if (
            !ocrPages.has(
              field.pageNumber
            )
          ) {
            throw new Error(
              'TG_DOC_EXTRACTED_PAGE_NOT_IN_OCR'
            );
          }

          confidenceTotal +=
            field.confidence;

          const requiresHumanReview =
            field.requiresHumanReview ||
            field.confidence <
              minimumConfidence;

          if (
            field.confidence <
              minimumConfidence
          ) {
            reviewReasons.push(
              'LOW_CONFIDENCE:' +
              field.extractedFieldId
            );
          }

          if (
            field.requiresHumanReview
          ) {
            reviewReasons.push(
              'FIELD_REVIEW_REQUIRED:' +
              field.extractedFieldId
            );
          }

          return Object.freeze({
            ...field,

            boundingBox: {
              ...field.boundingBox
            },

            requiresHumanReview
          });
        }
      );

    const artifact:
      TaxGuardExtractionArtifact =
        Object.freeze({
          extractionArtifactId:
            input.extractionArtifactId,

          sourceDocumentId:
            input.document
              .sourceDocumentId,

          ocrArtifactId:
            input.ocr.ocrArtifactId,

          context: {
            ...input.document.context
          },

          providerId:
            input.provider.providerId,

          providerReferenceId:
            input.providerReferenceId,

          fields,

          minimumConfidence,

          averageConfidence:
            confidenceTotal /
            fields.length,

          requiresHumanReview:
            fields.some(
              field =>
                field
                  .requiresHumanReview
            ),

          reviewReasons: [
            ...new Set(
              reviewReasons
            )
          ],

          createdAt:
            new Date()
              .toISOString(),

          /*
           * Critical TaxGuard boundary:
           * OCR/extraction output is proposed
           * information only. It is never a
           * verified taxpayer tax fact until an
           * authorized human review completes.
           */
          aiProposedOnly:
            true,

          taxVerified:
            false,

          immutable:
            true
        });

    this.artifacts.set(
      artifact
        .extractionArtifactId,
      artifact
    );

    return this.clone(
      artifact
    );
  }

  get(
    extractionArtifactId:
      string
  ):
    TaxGuardExtractionArtifact {

    const artifact =
      this.artifacts.get(
        extractionArtifactId
      );

    if (!artifact) {
      throw new Error(
        'TG_DOC_EXTRACTION_NOT_FOUND'
      );
    }

    return this.clone(
      artifact
    );
  }

  private clone(
    artifact:
      TaxGuardExtractionArtifact
  ):
    TaxGuardExtractionArtifact {

    return {
      ...artifact,

      context: {
        ...artifact.context
      },

      fields:
        artifact.fields.map(
          field => ({
            ...field,

            boundingBox: {
              ...field.boundingBox
            }
          })
        ),

      reviewReasons: [
        ...artifact.reviewReasons
      ]
    };
  }
}

export class TaxGuardDocumentIntelligenceBoundary {

  static markExtractionTaxVerified():
    never {

    throw new Error(
      'TG_DOC_AI_EXTRACTION_CANNOT_BE_TAX_VERIFIED'
    );
  }

  static bypassBoundingBox():
    never {

    throw new Error(
      'TG_DOC_BOUNDING_BOX_PROVENANCE_REQUIRED'
    );
  }

  static bypassHumanReview():
    never {

    throw new Error(
      'TG_DOC_HUMAN_REVIEW_REQUIRED'
    );
  }

  static fabricateProviderResult():
    never {

    throw new Error(
      'TG_DOC_PROVIDER_RESULT_FABRICATION_BLOCKED'
    );
  }
}
