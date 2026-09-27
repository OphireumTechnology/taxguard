import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function write(relativePath, content) {
  const target = path.join(root, relativePath);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true }
  );

  fs.writeFileSync(
    target,
    content.trimStart(),
    'utf8'
  );

  console.log(
    'Created:',
    relativePath
  );
}

write(
  'src/taxguard/document-intelligence/ProductionDocumentIntelligence.ts',
  String.raw`
export type TaxGuardDocumentStatus =
  | 'RECEIVED'
  | 'QUARANTINED'
  | 'SECURITY_VALIDATED'
  | 'OCR_PENDING'
  | 'OCR_COMPLETE'
  | 'EXTRACTION_PENDING'
  | 'EXTRACTION_COMPLETE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'HUMAN_VERIFIED'
  | 'RELEASED'
  | 'REJECTED';

export type TaxGuardDocumentRisk =
  | 'routine'
  | 'material'
  | 'critical';

export type TaxGuardDocumentSecurityStatus =
  | 'PENDING'
  | 'PASSED'
  | 'FAILED';

export type TaxGuardMalwareScanStatus =
  | 'NOT_SCANNED'
  | 'CLEAN'
  | 'INFECTED'
  | 'ERROR';

export type TaxGuardDocumentMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/tiff';

export interface TaxGuardDocumentContext {
  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;
}

export interface TaxGuardDocumentSource {
  sourceDocumentId: string;
  context: TaxGuardDocumentContext;

  originalFileName: string;
  normalizedFileName: string;

  declaredMimeType: string;
  detectedMimeType: TaxGuardDocumentMimeType;

  sizeBytes: number;
  sha256: string;

  uploadedBy: string;
  receivedAt: string;

  status: TaxGuardDocumentStatus;
  riskLevel: TaxGuardDocumentRisk;

  immutable: true;
}

export interface TaxGuardQuarantineRecord {
  quarantineId: string;
  sourceDocumentId: string;
  context: TaxGuardDocumentContext;

  reason:
    | 'NEW_UPLOAD'
    | 'SECURITY_REVIEW'
    | 'TYPE_MISMATCH'
    | 'MALWARE_SCAN_REQUIRED'
    | 'MALWARE_DETECTED'
    | 'SECURITY_VALIDATION_FAILED';

  quarantinedAt: string;
  releasedAt?: string;
  rejectedAt?: string;

  status:
    | 'ACTIVE'
    | 'RELEASED'
    | 'REJECTED';

  immutable: true;
}

export interface TaxGuardDocumentSecurityRecord {
  securityRecordId: string;
  sourceDocumentId: string;
  context: TaxGuardDocumentContext;

  fileSignatureValid: boolean;
  declaredTypeMatchesDetectedType: boolean;

  malwareScanStatus:
    TaxGuardMalwareScanStatus;

  scannerProvider:
    string;

  scannerReferenceId?:
    string;

  status:
    TaxGuardDocumentSecurityStatus;

  checkedBy:
    string;

  checkedAt:
    string;

  failureReasons:
    readonly string[];

  immutable: true;
}

export interface TaxGuardDocumentProviderCapability {
  providerId: string;

  providerType:
    | 'MALWARE_SCANNER'
    | 'OCR'
    | 'DOCUMENT_EXTRACTION';

  productionConnected: boolean;

  configured: boolean;

  lastVerifiedAt?: string;
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
      'TG_DOC_INVALID_TAX_YEAR'
    );
  }
}

function cloneContext(
  context:
    TaxGuardDocumentContext
): TaxGuardDocumentContext {

  return {
    ...context
  };
}

function normalizeFileName(
  fileName: string
): string {

  const trimmed =
    fileName.trim();

  if (!trimmed) {
    throw new Error(
      'TG_DOC_FILENAME_REQUIRED'
    );
  }

  const normalized =
    trimmed
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        '-'
      )
      .replace(
        /-+/g,
        '-'
      );

  if (!normalized) {
    throw new Error(
      'TG_DOC_FILENAME_INVALID'
    );
  }

  return normalized;
}

function validateSha256(
  sha256: string
): string {

  const normalized =
    sha256
      .trim()
      .toLowerCase();

  if (
    !/^[a-f0-9]{64}$/
      .test(normalized)
  ) {
    throw new Error(
      'TG_DOC_SHA256_INVALID'
    );
  }

  return normalized;
}

function validateMimeType(
  mimeType: string
): TaxGuardDocumentMimeType {

  const allowed:
    readonly TaxGuardDocumentMimeType[] =
      [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/tiff'
      ];

  if (
    !allowed.includes(
      mimeType as
        TaxGuardDocumentMimeType
    )
  ) {
    throw new Error(
      'TG_DOC_UNSUPPORTED_FILE_TYPE'
    );
  }

  return mimeType as
    TaxGuardDocumentMimeType;
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

export class TaxGuardDocumentProviderRegistry {

  private readonly providers =
    new Map<
      string,
      TaxGuardDocumentProviderCapability
    >();

  register(
    capability:
      TaxGuardDocumentProviderCapability
  ):
    TaxGuardDocumentProviderCapability {

    requireText(
      capability.providerId,
      'TG_DOC_PROVIDER_ID_REQUIRED'
    );

    if (
      this.providers.has(
        capability.providerId
      )
    ) {
      throw new Error(
        'TG_DOC_PROVIDER_DUPLICATE'
      );
    }

    const record =
      Object.freeze({
        ...capability
      });

    this.providers.set(
      record.providerId,
      record
    );

    return {
      ...record
    };
  }

  get(
    providerId: string
  ):
    TaxGuardDocumentProviderCapability {

    const provider =
      this.providers.get(
        providerId
      );

    if (!provider) {
      throw new Error(
        'TG_DOC_PROVIDER_NOT_FOUND'
      );
    }

    return {
      ...provider
    };
  }

  assertProductionReady(
    providerId: string
  ): true {

    const provider =
      this.get(
        providerId
      );

    if (
      !provider.configured ||
      !provider.productionConnected
    ) {
      throw new Error(
        'TG_DOC_PROVIDER_NOT_PRODUCTION_READY'
      );
    }

    return true;
  }
}

export class TaxGuardSecureDocumentIntakeRegistry {

  private readonly documents =
    new Map<
      string,
      TaxGuardDocumentSource
    >();

  private readonly hashes =
    new Set<string>();

  receive(
    input: {
      sourceDocumentId: string;

      context:
        TaxGuardDocumentContext;

      originalFileName: string;

      declaredMimeType: string;

      detectedMimeType: string;

      sizeBytes: number;

      sha256: string;

      uploadedBy: string;

      riskLevel?:
        TaxGuardDocumentRisk;
    }
  ):
    TaxGuardDocumentSource {

    requireText(
      input.sourceDocumentId,
      'TG_DOC_SOURCE_ID_REQUIRED'
    );

    requireText(
      input.uploadedBy,
      'TG_DOC_UPLOADER_REQUIRED'
    );

    validateTaxYear(
      input.context.taxYear
    );

    if (
      !Number.isInteger(
        input.sizeBytes
      ) ||
      input.sizeBytes <= 0
    ) {
      throw new Error(
        'TG_DOC_INVALID_SIZE'
      );
    }

    if (
      this.documents.has(
        input.sourceDocumentId
      )
    ) {
      throw new Error(
        'TG_DOC_DUPLICATE_SOURCE_ID'
      );
    }

    const sha256 =
      validateSha256(
        input.sha256
      );

    if (
      this.hashes.has(
        sha256
      )
    ) {
      throw new Error(
        'TG_DOC_DUPLICATE_CONTENT'
      );
    }

    const detectedMimeType =
      validateMimeType(
        input.detectedMimeType
      );

    const record:
      TaxGuardDocumentSource =
        Object.freeze({
          sourceDocumentId:
            input.sourceDocumentId,

          context:
            cloneContext(
              input.context
            ),

          originalFileName:
            input.originalFileName,

          normalizedFileName:
            normalizeFileName(
              input.originalFileName
            ),

          declaredMimeType:
            input.declaredMimeType,

          detectedMimeType,

          sizeBytes:
            input.sizeBytes,

          sha256,

          uploadedBy:
            input.uploadedBy,

          receivedAt:
            new Date()
              .toISOString(),

          status:
            'QUARANTINED',

          riskLevel:
            input.riskLevel ??
            'material',

          immutable:
            true
        });

    this.documents.set(
      record.sourceDocumentId,
      record
    );

    this.hashes.add(
      record.sha256
    );

    return this.clone(
      record
    );
  }

  get(
    sourceDocumentId: string
  ):
    TaxGuardDocumentSource {

    const document =
      this.documents.get(
        sourceDocumentId
      );

    if (!document) {
      throw new Error(
        'TG_DOC_SOURCE_NOT_FOUND'
      );
    }

    return this.clone(
      document
    );
  }

  private clone(
    document:
      TaxGuardDocumentSource
  ):
    TaxGuardDocumentSource {

    return {
      ...document,

      context: {
        ...document.context
      }
    };
  }
}

export class TaxGuardDocumentQuarantineRegistry {

  private readonly records =
    new Map<
      string,
      TaxGuardQuarantineRecord
    >();

  quarantine(
    input: {
      quarantineId: string;

      document:
        TaxGuardDocumentSource;

      reason:
        TaxGuardQuarantineRecord[
          'reason'
        ];
    }
  ):
    TaxGuardQuarantineRecord {

    requireText(
      input.quarantineId,
      'TG_DOC_QUARANTINE_ID_REQUIRED'
    );

    if (
      this.records.has(
        input.quarantineId
      )
    ) {
      throw new Error(
        'TG_DOC_QUARANTINE_DUPLICATE'
      );
    }

    const record:
      TaxGuardQuarantineRecord =
        Object.freeze({
          quarantineId:
            input.quarantineId,

          sourceDocumentId:
            input.document
              .sourceDocumentId,

          context:
            cloneContext(
              input.document.context
            ),

          reason:
            input.reason,

          quarantinedAt:
            new Date()
              .toISOString(),

          status:
            'ACTIVE',

          immutable:
            true
        });

    this.records.set(
      record.quarantineId,
      record
    );

    return this.clone(
      record
    );
  }

  release(
    quarantineId: string,

    security:
      TaxGuardDocumentSecurityRecord
  ):
    TaxGuardQuarantineRecord {

    const current =
      this.require(
        quarantineId
      );

    if (
      !sameContext(
        current.context,
        security.context
      ) ||
      current.sourceDocumentId !==
        security.sourceDocumentId
    ) {
      throw new Error(
        'TG_DOC_QUARANTINE_SECURITY_CONTEXT_MISMATCH'
      );
    }

    if (
      security.status !==
        'PASSED'
    ) {
      throw new Error(
        'TG_DOC_QUARANTINE_RELEASE_BLOCKED'
      );
    }

    const updated:
      TaxGuardQuarantineRecord =
        Object.freeze({
          ...current,

          releasedAt:
            new Date()
              .toISOString(),

          status:
            'RELEASED'
        });

    this.records.set(
      quarantineId,
      updated
    );

    return this.clone(
      updated
    );
  }

  reject(
    quarantineId: string
  ):
    TaxGuardQuarantineRecord {

    const current =
      this.require(
        quarantineId
      );

    const updated:
      TaxGuardQuarantineRecord =
        Object.freeze({
          ...current,

          rejectedAt:
            new Date()
              .toISOString(),

          status:
            'REJECTED'
        });

    this.records.set(
      quarantineId,
      updated
    );

    return this.clone(
      updated
    );
  }

  get(
    quarantineId: string
  ):
    TaxGuardQuarantineRecord {

    return this.clone(
      this.require(
        quarantineId
      )
    );
  }

  private require(
    quarantineId: string
  ):
    TaxGuardQuarantineRecord {

    const record =
      this.records.get(
        quarantineId
      );

    if (!record) {
      throw new Error(
        'TG_DOC_QUARANTINE_NOT_FOUND'
      );
    }

    return record;
  }

  private clone(
    record:
      TaxGuardQuarantineRecord
  ):
    TaxGuardQuarantineRecord {

    return {
      ...record,

      context: {
        ...record.context
      }
    };
  }
}

export class TaxGuardDocumentSecurityGate {

  evaluate(
    input: {
      securityRecordId: string;

      document:
        TaxGuardDocumentSource;

      fileSignatureValid: boolean;

      malwareScanStatus:
        TaxGuardMalwareScanStatus;

      scannerProvider: string;

      scannerReferenceId?: string;

      checkedBy: string;
    }
  ):
    TaxGuardDocumentSecurityRecord {

    requireText(
      input.securityRecordId,
      'TG_DOC_SECURITY_ID_REQUIRED'
    );

    requireText(
      input.scannerProvider,
      'TG_DOC_SCANNER_PROVIDER_REQUIRED'
    );

    requireText(
      input.checkedBy,
      'TG_DOC_SECURITY_REVIEWER_REQUIRED'
    );

    const failureReasons:
      string[] = [];

    const declaredTypeMatchesDetectedType =
      input.document
        .declaredMimeType ===
      input.document
        .detectedMimeType;

    if (
      !input.fileSignatureValid
    ) {
      failureReasons.push(
        'FILE_SIGNATURE_INVALID'
      );
    }

    if (
      !declaredTypeMatchesDetectedType
    ) {
      failureReasons.push(
        'DECLARED_TYPE_MISMATCH'
      );
    }

    if (
      input.malwareScanStatus !==
        'CLEAN'
    ) {
      failureReasons.push(
        input.malwareScanStatus ===
          'INFECTED'
          ? 'MALWARE_DETECTED'
          : 'MALWARE_SCAN_NOT_CLEAN'
      );
    }

    const status:
      TaxGuardDocumentSecurityStatus =
        failureReasons.length === 0
          ? 'PASSED'
          : 'FAILED';

    return Object.freeze({
      securityRecordId:
        input.securityRecordId,

      sourceDocumentId:
        input.document
          .sourceDocumentId,

      context:
        cloneContext(
          input.document.context
        ),

      fileSignatureValid:
        input.fileSignatureValid,

      declaredTypeMatchesDetectedType,

      malwareScanStatus:
        input.malwareScanStatus,

      scannerProvider:
        input.scannerProvider,

      scannerReferenceId:
        input.scannerReferenceId,

      status,

      checkedBy:
        input.checkedBy,

      checkedAt:
        new Date()
          .toISOString(),

      failureReasons,

      immutable:
        true
    });
  }

  assertPassed(
    security:
      TaxGuardDocumentSecurityRecord
  ): true {

    if (
      security.status !==
        'PASSED'
    ) {
      throw new Error(
        'TG_DOC_SECURITY_GATE_BLOCKED:' +
        security.failureReasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardDocumentProcessingBoundary {

  static assertMayProcess(
    input: {
      quarantine:
        TaxGuardQuarantineRecord;

      security:
        TaxGuardDocumentSecurityRecord;
    }
  ): true {

    if (
      input.quarantine.status !==
        'RELEASED'
    ) {
      throw new Error(
        'TG_DOC_PROCESSING_QUARANTINE_BLOCKED'
      );
    }

    if (
      input.security.status !==
        'PASSED'
    ) {
      throw new Error(
        'TG_DOC_PROCESSING_SECURITY_BLOCKED'
      );
    }

    if (
      input.quarantine
        .sourceDocumentId !==
      input.security
        .sourceDocumentId
    ) {
      throw new Error(
        'TG_DOC_PROCESSING_DOCUMENT_MISMATCH'
      );
    }

    if (
      !sameContext(
        input.quarantine.context,
        input.security.context
      )
    ) {
      throw new Error(
        'TG_DOC_PROCESSING_CONTEXT_MISMATCH'
      );
    }

    return true;
  }
}
`
);

////////////// M14 Part 2 of 4 — OCR, Bounding Boxes, Extraction & Confidence

write(
  'src/taxguard/document-intelligence/ProductionDocumentExtraction.ts',
  String.raw`
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
`
);


///////M14 Part 3 of 4 — Human Verification, Validated Facts, Provenance & Release Gate


write(
  'src/taxguard/document-intelligence/ProductionDocumentVerification.ts',
  String.raw`
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
`
);

write(
  'src/taxguard/document-intelligence/index.ts',
  String.raw`
export * from './ProductionDocumentIntelligence';
export * from './ProductionDocumentExtraction';
export * from './ProductionDocumentVerification';
`
);


///////////////M14 Part 3 adds the critical trust boundary
///////////// Ophireum Multimedia Productions

write(
  'src/tests/productionDocumentIntelligence.test.ts',
  String.raw`
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardDocumentProcessingBoundary,
  TaxGuardDocumentProviderRegistry,
  TaxGuardDocumentQuarantineRegistry,
  TaxGuardDocumentSecurityGate,
  TaxGuardSecureDocumentIntakeRegistry
} from '../taxguard/document-intelligence/ProductionDocumentIntelligence';

import {
  TaxGuardDocumentIntelligenceBoundary,
  TaxGuardProductionExtractionRegistry,
  TaxGuardProductionOcrRegistry
} from '../taxguard/document-intelligence/ProductionDocumentExtraction';

import {
  TaxGuardDocumentDownstreamGate,
  TaxGuardDocumentReleaseGate,
  TaxGuardDocumentVerificationBoundary,
  TaxGuardHumanFieldVerificationRegistry,
  TaxGuardValidatedDocumentFactRegistry
} from '../taxguard/document-intelligence/ProductionDocumentVerification';

function context() {
  return {
    clientId: 'CLIENT-M14-001',
    engagementId: 'ENGAGEMENT-M14-001',
    taxYear: 2025,
    correlationId: 'CORRELATION-M14-001'
  };
}

function createSecureDocument() {
  const intake =
    new TaxGuardSecureDocumentIntakeRegistry();

  const document =
    intake.receive({
      sourceDocumentId: 'SOURCE-M14-001',
      context: context(),
      originalFileName: '2025 W-2.pdf',
      declaredMimeType: 'application/pdf',
      detectedMimeType: 'application/pdf',
      sizeBytes: 125000,
      sha256: 'a'.repeat(64),
      uploadedBy: 'CLIENT-M14-001'
    });

  const quarantineRegistry =
    new TaxGuardDocumentQuarantineRegistry();

  const quarantine =
    quarantineRegistry.quarantine({
      quarantineId: 'QUARANTINE-M14-001',
      document,
      reason: 'NEW_UPLOAD'
    });

  const securityGate =
    new TaxGuardDocumentSecurityGate();

  const security =
    securityGate.evaluate({
      securityRecordId: 'SECURITY-M14-001',
      document,
      fileSignatureValid: true,
      malwareScanStatus: 'CLEAN',
      scannerProvider: 'MALWARE-PROVIDER-M14',
      scannerReferenceId: 'SCAN-M14-001',
      checkedBy: 'SECOPS-M14'
    });

  const releasedQuarantine =
    quarantineRegistry.release(
      quarantine.quarantineId,
      security
    );

  return {
    document,
    security,
    quarantine: releasedQuarantine
  };
}

function createProviders() {
  const registry =
    new TaxGuardDocumentProviderRegistry();

  const ocrProvider =
    registry.register({
      providerId: 'OCR-PROVIDER-M14',
      providerType: 'OCR',
      configured: true,
      productionConnected: true,
      lastVerifiedAt: new Date().toISOString()
    });

  const extractionProvider =
    registry.register({
      providerId: 'EXTRACTION-PROVIDER-M14',
      providerType: 'DOCUMENT_EXTRACTION',
      configured: true,
      productionConnected: true,
      lastVerifiedAt: new Date().toISOString()
    });

  return {
    registry,
    ocrProvider,
    extractionProvider
  };
}

function createExtraction(
  confidence = 0.98
) {
  const secure =
    createSecureDocument();

  const providers =
    createProviders();

  const ocrRegistry =
    new TaxGuardProductionOcrRegistry();

  const ocr =
    ocrRegistry.create({
      ocrArtifactId: 'OCR-M14-001',
      document: secure.document,
      quarantine: secure.quarantine,
      security: secure.security,
      provider: providers.ocrProvider,
      providerReferenceId: 'OCR-REMOTE-M14-001',
      pages: [
        {
          pageNumber: 1,
          text: 'Wages tips other compensation 50000.00',
          confidence: 0.99
        }
      ]
    });

  const extractionRegistry =
    new TaxGuardProductionExtractionRegistry();

  const extraction =
    extractionRegistry.create({
      extractionArtifactId: 'EXTRACT-M14-001',
      document: secure.document,
      ocr,
      provider: providers.extractionProvider,
      providerReferenceId: 'EXTRACT-REMOTE-M14-001',
      minimumConfidence: 0.90,
      fields: [
        {
          extractedFieldId: 'FIELD-M14-001',
          fieldPath: 'w2.box1.wages',
          rawValue: '50000.00',
          normalizedValue: '50000.00',
          confidence,
          pageNumber: 1,
          boundingBox: {
            pageNumber: 1,
            x: 100,
            y: 200,
            width: 180,
            height: 30
          },
          sourceText: '50000.00',
          requiresHumanReview: false,
          immutable: true
        }
      ]
    });

  return {
    ...secure,
    ...providers,
    ocr,
    extraction
  };
}

function createValidatedPipeline() {
  const foundation =
    createExtraction();

  const field =
    foundation.extraction.fields[0];

  const verificationRegistry =
    new TaxGuardHumanFieldVerificationRegistry();

  const verification =
    verificationRegistry.verify({
      verificationId: 'VERIFY-M14-001',
      document: foundation.document,
      ocr: foundation.ocr,
      extraction: foundation.extraction,
      field,
      disposition: 'VERIFIED_AS_EXTRACTED',
      reviewerId: 'REVIEWER-M14',
      reviewerRole: 'REVIEWER',
      evidenceIds: [
        'EVIDENCE-M14-001'
      ],
      provenanceDecisionId: 'PROVENANCE-M14-001'
    });

  const factRegistry =
    new TaxGuardValidatedDocumentFactRegistry();

  const fact =
    factRegistry.create({
      factId: 'FACT-M14-001',
      verification
    });

  return {
    ...foundation,
    verification,
    fact
  };
}

describe(
  'TaxGuard M14 Production Document Intelligence',
  () => {

    it(
      'M14.1 quarantines every newly received document',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        const document =
          intake.receive({
            sourceDocumentId: 'SOURCE-NEW',
            context: context(),
            originalFileName: 'Form W-2.pdf',
            declaredMimeType: 'application/pdf',
            detectedMimeType: 'application/pdf',
            sizeBytes: 1000,
            sha256: 'b'.repeat(64),
            uploadedBy: 'CLIENT'
          });

        expect(document.status)
          .toBe('QUARANTINED');
      }
    );

    it(
      'M14.2 rejects duplicate document content by SHA-256',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        const base = {
          context: context(),
          originalFileName: 'document.pdf',
          declaredMimeType: 'application/pdf',
          detectedMimeType: 'application/pdf',
          sizeBytes: 1000,
          sha256: 'c'.repeat(64),
          uploadedBy: 'CLIENT'
        };

        intake.receive({
          ...base,
          sourceDocumentId: 'SOURCE-DUP-1'
        });

        expect(
          () =>
            intake.receive({
              ...base,
              sourceDocumentId: 'SOURCE-DUP-2'
            })
        ).toThrow(
          'TG_DOC_DUPLICATE_CONTENT'
        );
      }
    );

    it(
      'M14.3 rejects unsupported detected file types',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        expect(
          () =>
            intake.receive({
              sourceDocumentId: 'SOURCE-BAD-TYPE',
              context: context(),
              originalFileName: 'payload.exe',
              declaredMimeType:
                'application/octet-stream',
              detectedMimeType:
                'application/x-msdownload',
              sizeBytes: 1000,
              sha256: 'd'.repeat(64),
              uploadedBy: 'CLIENT'
            })
        ).toThrow(
          'TG_DOC_UNSUPPORTED_FILE_TYPE'
        );
      }
    );

    it(
      'M14.4 fails security validation when malware is detected',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        const document =
          intake.receive({
            sourceDocumentId: 'SOURCE-INFECTED',
            context: context(),
            originalFileName: 'infected.pdf',
            declaredMimeType: 'application/pdf',
            detectedMimeType: 'application/pdf',
            sizeBytes: 1000,
            sha256: 'e'.repeat(64),
            uploadedBy: 'CLIENT'
          });

        const security =
          new TaxGuardDocumentSecurityGate()
            .evaluate({
              securityRecordId: 'SEC-INFECTED',
              document,
              fileSignatureValid: true,
              malwareScanStatus: 'INFECTED',
              scannerProvider: 'SCANNER',
              checkedBy: 'SECOPS'
            });

        expect(security.status)
          .toBe('FAILED');

        expect(
          security.failureReasons
        ).toContain(
          'MALWARE_DETECTED'
        );
      }
    );

    it(
      'M14.5 blocks quarantine release after failed security',
      () => {
        const intake =
          new TaxGuardSecureDocumentIntakeRegistry();

        const document =
          intake.receive({
            sourceDocumentId: 'SOURCE-BLOCKED',
            context: context(),
            originalFileName: 'blocked.pdf',
            declaredMimeType: 'application/pdf',
            detectedMimeType: 'application/pdf',
            sizeBytes: 1000,
            sha256: 'f'.repeat(64),
            uploadedBy: 'CLIENT'
          });

        const quarantineRegistry =
          new TaxGuardDocumentQuarantineRegistry();

        const quarantine =
          quarantineRegistry.quarantine({
            quarantineId: 'Q-BLOCKED',
            document,
            reason: 'NEW_UPLOAD'
          });

        const security =
          new TaxGuardDocumentSecurityGate()
            .evaluate({
              securityRecordId: 'SEC-BLOCKED',
              document,
              fileSignatureValid: false,
              malwareScanStatus: 'CLEAN',
              scannerProvider: 'SCANNER',
              checkedBy: 'SECOPS'
            });

        expect(
          () =>
            quarantineRegistry.release(
              quarantine.quarantineId,
              security
            )
        ).toThrow(
          'TG_DOC_QUARANTINE_RELEASE_BLOCKED'
        );
      }
    );

    it(
      'M14.6 allows processing only after quarantine and security gates pass',
      () => {
        const secure =
          createSecureDocument();

        expect(
          TaxGuardDocumentProcessingBoundary
            .assertMayProcess({
              quarantine: secure.quarantine,
              security: secure.security
            })
        ).toBe(true);
      }
    );

    it(
      'M14.7 blocks provider that is configured but not production connected',
      () => {
        const registry =
          new TaxGuardDocumentProviderRegistry();

        registry.register({
          providerId: 'OCR-NOT-LIVE',
          providerType: 'OCR',
          configured: true,
          productionConnected: false
        });

        expect(
          () =>
            registry.assertProductionReady(
              'OCR-NOT-LIVE'
            )
        ).toThrow(
          'TG_DOC_PROVIDER_NOT_PRODUCTION_READY'
        );
      }
    );

    it(
      'M14.8 creates production OCR artifact only after security release',
      () => {
        const result =
          createExtraction();

        expect(
          result.ocr
            .productionProviderVerified
        ).toBe(true);

        expect(
          result.ocr.averageConfidence
        ).toBeCloseTo(0.99);
      }
    );

    it(
      'M14.9 preserves field page and bounding-box provenance',
      () => {
        const result =
          createExtraction();

        const field =
          result.extraction.fields[0];

        expect(field.pageNumber)
          .toBe(1);

        expect(
          field.boundingBox.pageNumber
        ).toBe(1);

        expect(
          field.boundingBox.width
        ).toBe(180);
      }
    );

    it(
      'M14.10 marks extraction as AI-proposed and not tax verified',
      () => {
        const result =
          createExtraction();

        expect(
          result.extraction.aiProposedOnly
        ).toBe(true);

        expect(
          result.extraction.taxVerified
        ).toBe(false);
      }
    );

    it(
      'M14.11 routes low-confidence extraction to human review',
      () => {
        const result =
          createExtraction(0.70);

        expect(
          result.extraction
            .requiresHumanReview
        ).toBe(true);

        expect(
          result.extraction.reviewReasons
        ).toContain(
          'LOW_CONFIDENCE:FIELD-M14-001'
        );
      }
    );

    it(
      'M14.12 permits authorized human correction of extracted value',
      () => {
        const result =
          createExtraction();

        const registry =
          new TaxGuardHumanFieldVerificationRegistry();

        const verification =
          registry.verify({
            verificationId: 'VERIFY-CORRECTED',
            document: result.document,
            ocr: result.ocr,
            extraction: result.extraction,
            field: result.extraction.fields[0],
            disposition: 'CORRECTED',
            correctedValue: '51000.00',
            reviewerId: 'CPA-M14',
            reviewerRole: 'CPA',
            evidenceIds: [
              'EVIDENCE-CORRECTION'
            ],
            provenanceDecisionId:
              'PROVENANCE-CORRECTION'
          });

        expect(
          verification.verifiedValue
        ).toBe('51000.00');
      }
    );

    it(
      'M14.13 prevents rejected extraction from becoming validated fact',
      () => {
        const result =
          createExtraction();

        const verification =
          new TaxGuardHumanFieldVerificationRegistry()
            .verify({
              verificationId: 'VERIFY-REJECTED',
              document: result.document,
              ocr: result.ocr,
              extraction: result.extraction,
              field: result.extraction.fields[0],
              disposition: 'REJECTED',
              reviewerId: 'REVIEWER',
              reviewerRole: 'REVIEWER',
              evidenceIds: [
                'EVIDENCE-REJECT'
              ],
              provenanceDecisionId:
                'PROVENANCE-REJECT'
            });

        expect(
          () =>
            new TaxGuardValidatedDocumentFactRegistry()
              .create({
                factId: 'FACT-REJECTED',
                verification
              })
        ).toThrow(
          'TG_DOC_REJECTED_FIELD_CANNOT_BECOME_FACT'
        );
      }
    );

    it(
      'M14.14 creates validated fact only from human verification',
      () => {
        const result =
          createValidatedPipeline();

        expect(result.fact.validated)
          .toBe(true);

        expect(
          result.fact.aiProposedOnly
        ).toBe(false);

        expect(
          result.fact.validatedBy
        ).toBe('REVIEWER-M14');
      }
    );

    it(
      'M14.15 preserves full provenance on validated tax fact',
      () => {
        const result =
          createValidatedPipeline();

        expect(
          result.fact.sourceDocumentId
        ).toBe('SOURCE-M14-001');

        expect(
          result.fact.ocrArtifactId
        ).toBe('OCR-M14-001');

        expect(
          result.fact.extractionArtifactId
        ).toBe('EXTRACT-M14-001');

        expect(
          result.fact.extractedFieldId
        ).toBe('FIELD-M14-001');

        expect(
          result.fact.provenanceDecisionId
        ).toBe('PROVENANCE-M14-001');
      }
    );

    it(
      'M14.16 releases fully reviewed validated facts downstream',
      () => {
        const result =
          createValidatedPipeline();

        const release =
          new TaxGuardDocumentReleaseGate()
            .release({
              releaseDecisionId:
                'RELEASE-M14-001',
              document: result.document,
              quarantine: result.quarantine,
              security: result.security,
              extraction: result.extraction,
              verifications: [
                result.verification
              ],
              validatedFacts: [
                result.fact
              ],
              releasedBy: 'CPA-M14',
              releasedByRole: 'CPA'
            });

        expect(
          release.downstreamUseAllowed
        ).toBe(true);

        expect(
          release.validatedFactIds
        ).toContain('FACT-M14-001');
      }
    );

    it(
      'M14.17 blocks release when an extracted field has not been reviewed',
      () => {
        const result =
          createExtraction();

        expect(
          () =>
            new TaxGuardDocumentReleaseGate()
              .release({
                releaseDecisionId:
                  'RELEASE-BLOCKED',
                document: result.document,
                quarantine: result.quarantine,
                security: result.security,
                extraction: result.extraction,
                verifications: [],
                validatedFacts: [],
                releasedBy: 'CPA',
                releasedByRole: 'CPA'
              })
        ).toThrow(
          'TG_DOC_RELEASE_VERIFICATION_REQUIRED'
        );
      }
    );

    it(
      'M14.18 permits downstream use only for released validated facts',
      () => {
        const result =
          createValidatedPipeline();

        const release =
          new TaxGuardDocumentReleaseGate()
            .release({
              releaseDecisionId:
                'RELEASE-DOWNSTREAM',
              document: result.document,
              quarantine: result.quarantine,
              security: result.security,
              extraction: result.extraction,
              verifications: [
                result.verification
              ],
              validatedFacts: [
                result.fact
              ],
              releasedBy: 'CPA-M14',
              releasedByRole: 'CPA'
            });

        expect(
          TaxGuardDocumentDownstreamGate
            .assertMayUseTaxFacts({
              release,
              facts: [
                result.fact
              ]
            })
        ).toBe(true);
      }
    );

    it(
      'M14.19 blocks AI from converting extraction into verified tax fact',
      () => {
        expect(
          () =>
            TaxGuardDocumentIntelligenceBoundary
              .markExtractionTaxVerified()
        ).toThrow(
          'TG_DOC_AI_EXTRACTION_CANNOT_BE_TAX_VERIFIED'
        );

        expect(
          () =>
            TaxGuardDocumentVerificationBoundary
              .aiCreateValidatedTaxFact()
        ).toThrow(
          'TG_DOC_AI_VALIDATED_FACT_BLOCKED'
        );
      }
    );

    it(
      'M14.20 blocks fabricated provider results and human-review bypass',
      () => {
        expect(
          () =>
            TaxGuardDocumentIntelligenceBoundary
              .fabricateProviderResult()
        ).toThrow(
          'TG_DOC_PROVIDER_RESULT_FABRICATION_BLOCKED'
        );

        expect(
          () =>
            TaxGuardDocumentVerificationBoundary
              .bypassHumanVerification()
        ).toThrow(
          'TG_DOC_HUMAN_VERIFICATION_BYPASS_BLOCKED'
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
  'TaxGuard M14 Production Document Intelligence generated.'
);
console.log(
  '============================================================'
);
console.log('Created:');
console.log(
  'src/taxguard/document-intelligence/ProductionDocumentIntelligence.ts'
);
console.log(
  'src/taxguard/document-intelligence/ProductionDocumentExtraction.ts'
);
console.log(
  'src/taxguard/document-intelligence/ProductionDocumentVerification.ts'
);
console.log(
  'src/taxguard/document-intelligence/index.ts'
);
console.log(
  'src/tests/productionDocumentIntelligence.test.ts'
);
console.log('');
console.log(
  'M1-M13 frozen source was not modified.'
);
console.log(
  'OCR/extraction remains AI-proposed until human verification.'
);
console.log(
  'Unconfigured production providers fail closed.'
);
console.log(
  'External tax filing remains DISABLED.'
);



