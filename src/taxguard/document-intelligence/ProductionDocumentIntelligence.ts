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
