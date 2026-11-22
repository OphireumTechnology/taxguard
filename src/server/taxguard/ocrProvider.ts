import type { ExtractedFieldProvenance } from './persistence.types';
import { AuthorityError } from './authority.repository';

export interface OcrExtractedCandidate {
  fieldKey: string;
  fieldLabel?: string;
  proposedValue: string | number;
  confidence: number;
  page?: number;
  provider?: string;
  extractionMethod?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  rawTextSnippet?: string;
  [key: string]: any;
}

export interface OcrExtractionRequest {
  tenantId?: string;
  clientId?: string;
  engagementId?: string;
  caseId?: string;
  taxYear?: number;
  documentId: string;
  fileName?: string;
  storagePath?: string;
  sha256?: string;
  mimeType?: string;
}

export interface TaxGuardOcrProvider {
  readonly providerName: string;
  extract(input: OcrExtractionRequest): Promise<OcrExtractedCandidate[]>;
}

/**
 * Fail-closed production OCR adapter: refuses to fabricate extracted tax values
 * until an OCR provider is explicitly commissioned.
 */
export class ProductionOcrAdapter implements TaxGuardOcrProvider {
  readonly providerName = 'UNCOMMISSIONED_PRODUCTION_OCR';

  async extract(_input: OcrExtractionRequest): Promise<OcrExtractedCandidate[]> {
    throw new AuthorityError('OCR_PROVIDER_NOT_COMMISSIONED', 503);
  }
}

export function validateProvenance(provenance: ExtractedFieldProvenance | Record<string, unknown>): void {
  if (!provenance || typeof provenance !== 'object') {
    throw new AuthorityError('INVALID_PROVENANCE', 400);
  }
  const record = provenance as Record<string, unknown>;
  if (!record.sourceDocumentId && !record.documentId && !record.source && !record.origin) {
    throw new AuthorityError('PROVENANCE_SOURCE_REQUIRED', 400);
  }
}
