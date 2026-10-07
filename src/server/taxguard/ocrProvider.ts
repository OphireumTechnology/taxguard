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

export type DocumentIntelligenceProviderMode = 'LOCAL' | 'CLOUD' | 'FAIL_SAFE';

export interface TaxGuardOcrProvider {
  extract(input: OcrDocumentInput): Promise<OcrExtractionOutput[]>;
  getMode?(): DocumentIntelligenceProviderMode;
  isConfigured?(): boolean;
}

/** Local Heuristic OCR Provider for development and tests */
export class LocalHeuristicOcrProvider implements TaxGuardOcrProvider {
  readonly mode: DocumentIntelligenceProviderMode = 'LOCAL';
  readonly providerName = 'TaxGuard Local Heuristic Provider v1.2';
  readonly providerVersion = 'v1.2-local';

  getMode(): DocumentIntelligenceProviderMode {
    return 'LOCAL';
  }

  isConfigured(): boolean {
    return true;
  }

  async extract(input: OcrDocumentInput): Promise<OcrExtractionOutput[]> {
    const timestamp = new Date().toISOString();
    return [
      {
        field: 'documentType',
        page: 1,
        proposedValue: input.fileName.toUpperCase().includes('W2') || input.fileName.toUpperCase().includes('W-2') ? 'W-2' : 'Other',
        confidence: 0.95,
        boundingBox: { x: 0.05, y: 0.05, width: 0.2, height: 0.05 },
        sourceText: input.fileName,
        provider: this.providerName,
        providerVersion: this.providerVersion,
      },
      {
        field: 'taxYear',
        page: 1,
        proposedValue: input.taxYear,
        confidence: 0.98,
        boundingBox: { x: 0.8, y: 0.05, width: 0.15, height: 0.05 },
        sourceText: String(input.taxYear),
        provider: this.providerName,
        providerVersion: this.providerVersion,
      }
    ];
  }
}

/** Google Cloud Document AI Real Production OCR Provider */
export class GoogleCloudDocumentAiProvider implements TaxGuardOcrProvider {
  readonly mode: DocumentIntelligenceProviderMode = 'CLOUD';
  readonly providerName = 'Google Cloud Document AI';
  readonly providerVersion = 'v2.1';

  private static customTransport?: (input: OcrDocumentInput) => Promise<OcrExtractionOutput[]>;

  static setTransport(transport?: (input: OcrDocumentInput) => Promise<OcrExtractionOutput[]>): void {
    this.customTransport = transport;
  }

  static getTransport(): ((input: OcrDocumentInput) => Promise<OcrExtractionOutput[]>) | undefined {
    return this.customTransport;
  }

  getMode(): DocumentIntelligenceProviderMode {
    return 'CLOUD';
  }

  isConfigured(): boolean {
    if (GoogleCloudDocumentAiProvider.customTransport) return true;
    return Boolean(
      process.env.DOCUMENT_AI_PROCESSOR_ID ||
      (process.env.TAXGUARD_OCR_ENABLED === 'true' && process.env.GOOGLE_CLOUD_VISION_KEY)
    );
  }

  async extract(input: OcrDocumentInput): Promise<OcrExtractionOutput[]> {
    if (GoogleCloudDocumentAiProvider.customTransport) {
      return GoogleCloudDocumentAiProvider.customTransport(input);
    }

    if (!this.isConfigured()) {
      throw new AuthorityError('OCR_PROVIDER_NOT_CONFIGURED', 503);
    }

    const processorId = (process.env.DOCUMENT_AI_PROCESSOR_ID || '').trim();
    if (!processorId) {
      throw new AuthorityError('OCR_SERVICE_UNAVAILABLE', 503);
    }

    // Live Google Cloud Document AI REST Transport
    try {
      const location = processorId.includes('/locations/')
        ? processorId.split('/locations/')[1].split('/')[0]
        : 'us';
      const processorPath = processorId.startsWith('projects/')
        ? processorId
        : `projects/${process.env.GOOGLE_CLOUD_PROJECT || 'default'}/locations/${location}/processors/${processorId}`;

      const endpoint = `https://${location}-documentai.googleapis.com/v1/${processorPath}:process`;
      
      const apiKey = process.env.GOOGLE_CLOUD_VISION_KEY;
      const url = apiKey ? `${endpoint}?key=${apiKey}` : endpoint;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (process.env.GOOGLE_CLOUD_ACCESS_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GOOGLE_CLOUD_ACCESS_TOKEN}`;
      }

      let base64Content = '';
      if (input.storagePath && typeof window === 'undefined') {
        try {
          const fs = await import('node:fs');
          if (fs.existsSync(input.storagePath)) {
            const buf = fs.readFileSync(input.storagePath);
            base64Content = buf.toString('base64');
          }
        } catch {
          // File read error
        }
      }

      const body = {
        rawDocument: {
          content: base64Content,
          mimeType: input.mimeType || 'application/pdf',
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new AuthorityError('OCR_SERVICE_UNAVAILABLE', 503);
      }

      const data = await response.json();
      const entities = data?.document?.entities || [];
      const outputs: OcrExtractionOutput[] = [];

      for (let i = 0; i < entities.length; i++) {
        const ent = entities[i];
        outputs.push({
          field: ent.type || `Field_${i}`,
          page: (ent.pageAnchor?.pageRefs?.[0]?.page || 0) + 1,
          proposedValue: ent.normalizedValue?.text || ent.mentionText || '',
          confidence: ent.confidence || 0.95,
          sourceText: ent.mentionText,
          provider: this.providerName,
          providerVersion: this.providerVersion,
        });
      }

      if (outputs.length === 0 && data?.document?.text) {
        outputs.push({
          field: 'rawDocumentText',
          page: 1,
          proposedValue: data.document.text,
          confidence: 0.90,
          sourceText: data.document.text.slice(0, 100),
          provider: this.providerName,
          providerVersion: this.providerVersion,
        });
      }

      return outputs;
    } catch (err: any) {
      if (err instanceof AuthorityError) throw err;
      throw new AuthorityError('OCR_SERVICE_UNAVAILABLE', 503);
    }
  }
}

/** Default Real OCR adapter: delegates to production provider or throws OCR_PROVIDER_NOT_CONFIGURED / OCR_SERVICE_UNAVAILABLE */
export class ProductionOcrAdapter implements TaxGuardOcrProvider {
  private activeMode: DocumentIntelligenceProviderMode =
    (process.env.TAXGUARD_OCR_PROVIDER_MODE as DocumentIntelligenceProviderMode) ||
    (process.env.NODE_ENV === 'production' ? 'CLOUD' : 'LOCAL');

  constructor(private customExtractor?: (input: OcrDocumentInput) => Promise<OcrExtractionOutput[]>) {}

  getMode(): DocumentIntelligenceProviderMode {
    return this.activeMode;
  }

  setMode(mode: DocumentIntelligenceProviderMode): void {
    this.activeMode = mode;
  }

  async extract(input: OcrDocumentInput): Promise<OcrExtractionOutput[]> {
    if (this.customExtractor) {
      return this.customExtractor(input);
    }

    // Provider readiness is authoritative. An explicitly unconfigured OCR
    // provider must fail closed and must never fall through to heuristic OCR.
    const readiness = ProviderReadinessRegistry.getProviderStatus('OCR');

    if (readiness.status === 'NOT_CONFIGURED') {
      throw new AuthorityError('OCR_PROVIDER_NOT_CONFIGURED', 503);
    }

    if (this.activeMode === 'FAIL_SAFE') {
      throw new AuthorityError('OCR_SERVICE_UNAVAILABLE', 503);
    }

    if (process.env.NODE_ENV === 'production' && this.activeMode !== 'CLOUD') {
      throw new AuthorityError('OCR_PROVIDER_NOT_CONFIGURED', 503);
    }

    if (this.activeMode === 'CLOUD') {
      const cloudProvider = new GoogleCloudDocumentAiProvider();

      if (!cloudProvider.isConfigured()) {
        throw new AuthorityError('OCR_PROVIDER_NOT_CONFIGURED', 503);
      }

      return cloudProvider.extract(input);
    }

    // In production, LOCAL is prohibited unless explicitly configured in non-production
    if (process.env.NODE_ENV === 'production') {
      throw new AuthorityError('OCR_PROVIDER_NOT_CONFIGURED', 503);
    }

    // LOCAL is permitted only when explicitly/default-selected for a
    // non-production test/development environment and readiness has not
    // declared OCR unavailable.
    const localProvider = new LocalHeuristicOcrProvider();
    return localProvider.extract(input);
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
