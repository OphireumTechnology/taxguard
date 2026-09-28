import { api } from '../api';
import type {
  TaxGuardDocumentRecord,
  TaxGuardDocumentService,
  TaxGuardDocumentUploadRequest,
} from '../contracts/TaxGuardDocumentService';
import { ProductionEnvironmentGuard } from './ProductionEnvironmentGuard';

type ApiDocument = {
  id: string;
  clientId?: string;
  taxYear?: number;
  fileName?: string;
  name?: string;
  mimeType?: string;
  fileType?: string;
  fileSizeBytes?: number;
  fileSize?: string | number;
  uploadedAt?: string;
  createdAt?: string;
  status?: string;
};

const normalizeSize = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const normalizeDocument = (
  value: ApiDocument,
  fallbackClientId: string,
  fallbackTaxYear: number
): TaxGuardDocumentRecord => ({
  id: value.id,
  clientId: value.clientId ?? fallbackClientId,
  taxYear: value.taxYear ?? fallbackTaxYear,
  fileName: value.fileName ?? value.name ?? 'document',
  contentType: value.mimeType ?? value.fileType,
  size: normalizeSize(value.fileSizeBytes ?? value.fileSize),
  uploadedAt: value.uploadedAt ?? value.createdAt,
  status: value.status,
});

/**
 * LIVE document adapter.
 *
 * Browser-local document repositories are never authoritative.
 * All production document operations cross the authenticated TaxGuard API boundary.
 *
 * Uploads remain subject to the server's DOCUMENT_INTAKE_NOT_READY
 * fail-closed policy until real quarantine/malware scanning is commissioned.
 */
export class ProductionDocumentService implements TaxGuardDocumentService {
  async listDocuments(
    clientId: string,
    taxYear: number
  ): Promise<TaxGuardDocumentRecord[]> {
    ProductionEnvironmentGuard.assertLiveWriteAllowed(
      'Production document access'
    );

    const response = await api.documents.list({
      clientId,
      taxYear,
    });

    return (response.documents ?? []).map((document) =>
      normalizeDocument(
        document as ApiDocument,
        clientId,
        taxYear
      )
    );
  }

  async uploadDocument(
    request: TaxGuardDocumentUploadRequest
  ): Promise<TaxGuardDocumentRecord> {
    ProductionEnvironmentGuard.assertLiveWriteAllowed(
      'Production document upload'
    );

    try {
      const response = await api.documents.upload({
        clientId: request.clientId,
        taxYear: request.taxYear,
        fileName: request.fileName,
        fileType: request.contentType,
        fileSize:
          request.size === undefined
            ? undefined
            : String(request.size),
      });

      if (!response.document?.id) {
        throw new Error(
          'TaxGuard document authority returned an invalid upload response.'
        );
      }

      return normalizeDocument(
        response.document as ApiDocument,
        request.clientId,
        request.taxYear
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      if (
        message.includes('DOCUMENT_INTAKE_NOT_READY') ||
        message.includes('quarantine') ||
        message.includes('scanning pipeline')
      ) {
        throw new Error(
          'DOCUMENT_INTAKE_NOT_READY: TaxGuard LIVE document intake remains disabled until the production quarantine and malware-scanning pipeline is commissioned.'
        );
      }

      throw error;
    }
  }

  async deleteDocument(
    _clientId: string,
    _documentId: string
  ): Promise<void> {
    ProductionEnvironmentGuard.assertLiveWriteAllowed(
      'Production document deletion'
    );

    // There is currently no authenticated production delete endpoint.
    // Fail closed instead of silently deleting from demo/local state.
    throw new Error(
      'DOCUMENT_DELETE_NOT_AVAILABLE: production document deletion requires an authorized server endpoint and immutable audit event.'
    );
  }
}
