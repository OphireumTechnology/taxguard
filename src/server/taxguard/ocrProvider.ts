/**
 * TaxGuard Provider-Neutral OCR Interface and Engine
 * Enforces isAiProposedOnly: true, strict provenance, and fail-closed availability.
 */

import { AuthorityError } from './authority.repository';
import { createHash } from 'node:crypto';
import { parseDocumentAiResponse } from './documentAiResponse';
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

    // The native path has no commissioned, scoped released-vault reader or consent proof.
    // Never export a production local filesystem document through this preparatory transport.
    if (process.env.NODE_ENV === 'production') throw new AuthorityError('OCR_DURABLE_SOURCE_REQUIRED', 503);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const location = processorId.includes('/locations/')
        ? processorId.split('/locations/')[1].split('/')[0]
        : 'us';
      const processorPath = processorId.startsWith('projects/')
        ? processorId
        : `projects/${process.env.GOOGLE_CLOUD_PROJECT || ''}/locations/${location}/processors/${processorId}`;

      if (!/^projects\/[A-Za-z0-9_-]+\/locations\/[a-z]+(?:-[a-z0-9]+)*\/processors\/[A-Za-z0-9_-]+$/.test(processorPath) ||
          !/^[a-f0-9]{64}$/.test(input.sha256) ||
          !['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'].includes(input.mimeType)) {
        throw new AuthorityError('OCR_INVALID_SOURCE', 400);
      }

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
            const stat = fs.statSync(input.storagePath);
            if (!stat.isFile() || stat.size <= 0 || stat.size > 20 * 1024 * 1024) throw new AuthorityError('OCR_INVALID_SOURCE', 400);
            const buf = fs.readFileSync(input.storagePath);
            if (buf.length <= 0 || buf.length > 20 * 1024 * 1024 || createHash('sha256').update(buf).digest('hex') !== input.sha256) {
              throw new AuthorityError('OCR_SOURCE_HASH_MISMATCH', 400);
            }
            base64Content = buf.toString('base64');
          }
        } catch (error) {
          if (error instanceof AuthorityError) throw error;
        }
      }

      if (!base64Content) throw new AuthorityError('OCR_SOURCE_UNAVAILABLE', 503);

      const body = {
        rawDocument: {
          content: base64Content,
          mimeType: input.mimeType || 'application/pdf',
        },
      };

      const request = async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: 'error',
      });

      if (!response.ok) {
        throw new AuthorityError('OCR_SERVICE_UNAVAILABLE', 503);
      }

      // Bound bytes before JSON parsing; timeout includes response-body consumption.
      const reader = response.body?.getReader();
      if (!reader) throw new AuthorityError('OCR_INVALID_RESPONSE', 503);
      activeReader = reader;
      const parts: Uint8Array[] = []; let length = 0;
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > 4 * 1024 * 1024) { await reader.cancel(); throw new AuthorityError('OCR_INVALID_RESPONSE', 503); }
          parts.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      return parseDocumentAiResponse(JSON.parse(Buffer.concat(parts).toString('utf8')), this.providerName, this.providerVersion);
      };
      const expired = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          void activeReader?.cancel().catch(() => {});
          reject(new AuthorityError('OCR_SERVICE_TIMEOUT', 503));
        }, 10000);
      });
      return await Promise.race([request(), expired]);
    } catch (err: any) {
      if (err instanceof AuthorityError) throw err;
      throw new AuthorityError('OCR_SERVICE_UNAVAILABLE', 503);
    } finally {
      if (timeout) clearTimeout(timeout);
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
