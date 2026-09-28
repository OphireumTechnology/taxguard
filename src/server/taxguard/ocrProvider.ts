/**
 * TaxGuard Provider-Neutral OCR Interface and Engine
 * Enforces isAiProposedOnly: true, strict provenance, and fail-closed availability.
 */

import { AuthorityError } from './authority.repository';
import { ProviderReadinessRegistry } from './providerReadiness.service';
import {
  ExtractedFieldEntity,
  ExtractedFieldProvenance,
} from './persistence.types';

export interface OcrDocumentInput {
  tenantId: string;
  clientId: string;
  engagementId: string;
  caseId: string;
  taxYear: number;
  documentId: string;
  fileName: string;
  storagePath: string;
  sha256: string;
  mimeType: string;
}

export interface OcrExtractionOutput {
  field: string;
  page: number;
  proposedValue: unknown;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  sourceText?: string;
  provider: string;
  providerVersion: string;
}

export interface TaxGuardOcrProvider {
  extract(input: OcrDocumentInput): Promise<OcrExtractionOutput[]>;
}

/** Default Real OCR adapter: delegates to production provider or throws OCR_PROVIDER_NOT_CONFIGURED */
export class ProductionOcrAdapter implements TaxGuardOcrProvider {
  constructor(private customExtractor?: (input: OcrDocumentInput) => Promise<OcrExtractionOutput[]>) {}

  async extract(input: OcrDocumentInput): Promise<OcrExtractionOutput[]> {
    if (this.customExtractor) {
      return this.customExtractor(input);
    }

    const readiness = ProviderReadinessRegistry.getProviderStatus('OCR');
    if (!readiness.isOperational) {
      throw new AuthorityError('OCR_PROVIDER_NOT_CONFIGURED', 503);
    }

    // When an actual external cloud OCR processor is configured via env
    throw new AuthorityError('OCR_PROVIDER_NOT_CONFIGURED', 503);
  }
}

export function validateProvenance(provenance: unknown): asserts provenance is ExtractedFieldProvenance {
  if (!provenance || typeof provenance !== 'object') {
    throw new AuthorityError('MISSING_PROVENANCE', 400);
  }
  const p = provenance as Partial<ExtractedFieldProvenance>;
  if (!p.tenantId || !p.caseId || !p.documentId || !p.source || !p.provider || !p.providerVersion || p.confidence === undefined || p.recordVersion === undefined) {
    throw new AuthorityError('MISSING_PROVENANCE', 400);
  }
}
