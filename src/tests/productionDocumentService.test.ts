import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('../services/api', () => ({
  api: {
    documents: {
      list: apiMocks.list,
      upload: apiMocks.upload,
    },
  },
}));

vi.mock('../services/production/ProductionEnvironmentGuard', () => ({
  ProductionEnvironmentGuard: {
    assertLiveWriteAllowed: vi.fn(),
  },
}));

import { ProductionDocumentService } from '../services/production/ProductionDocumentService';
import { ProductionEnvironmentGuard } from '../services/production/ProductionEnvironmentGuard';

describe('ProductionDocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads LIVE documents only through the authenticated API', async () => {
    apiMocks.list.mockResolvedValue({
      documents: [
        {
          id: 'doc-1',
          clientId: 'client-1',
          taxYear: 2026,
          fileName: 'w2.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 2048,
          status: 'SECURITY_CLEARED',
        },
      ],
    });

    const service = new ProductionDocumentService();

    const result = await service.listDocuments(
      'client-1',
      2026
    );

    expect(
      ProductionEnvironmentGuard.assertLiveWriteAllowed
    ).toHaveBeenCalled();

    expect(apiMocks.list).toHaveBeenCalledWith({
      clientId: 'client-1',
      taxYear: 2026,
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        clientId: 'client-1',
        taxYear: 2026,
        fileName: 'w2.pdf',
      }),
    ]);
  });

  it('routes LIVE uploads through the authenticated API', async () => {
    apiMocks.upload.mockResolvedValue({
      message: 'accepted',
      extractionSummary: null,
      document: {
        id: 'doc-2',
        clientId: 'client-1',
        taxYear: 2026,
        fileName: '1099.pdf',
      },
    });

    const service = new ProductionDocumentService();

    const result = await service.uploadDocument({
      clientId: 'client-1',
      taxYear: 2026,
      fileName: '1099.pdf',
      contentType: 'application/pdf',
      size: 4096,
    });

    expect(apiMocks.upload).toHaveBeenCalledWith({
      clientId: 'client-1',
      taxYear: 2026,
      fileName: '1099.pdf',
      fileType: 'application/pdf',
      fileSize: '4096',
    });

    expect(result.id).toBe('doc-2');
  });

  it('preserves the production document-intake fail-closed gate', async () => {
    apiMocks.upload.mockRejectedValue(
      new Error(
        'DOCUMENT_INTAKE_NOT_READY: secure quarantine and scanning pipeline not commissioned'
      )
    );

    const service = new ProductionDocumentService();

    await expect(
      service.uploadDocument({
        clientId: 'client-1',
        taxYear: 2026,
        fileName: 'w2.pdf',
      })
    ).rejects.toThrow('DOCUMENT_INTAKE_NOT_READY');
  });

  it('does not silently delete documents without server authority', async () => {
    const service = new ProductionDocumentService();

    await expect(
      service.deleteDocument('client-1', 'doc-1')
    ).rejects.toThrow('DOCUMENT_DELETE_NOT_AVAILABLE');
  });
});
