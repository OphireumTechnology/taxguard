/**
 * Supabase Storage Provider for TaxGuard AI
 * Replaces Firebase Cloud Storage while strictly maintaining:
 * - Tenant and Client isolation
 * - Cryptographic content hash (SHA-256)
 * - Versioning
 * - Full audit lifecycle:
 *   REQUESTED -> RECEIVED -> QUARANTINED -> SCANNING -> RELEASED ->
 *   OCR_PENDING -> OCR_COMPLETE -> HUMAN_REVIEW_REQUIRED -> VERIFIED
 *   plus REJECTED, SUPERSEDED, ARCHIVED.
 * - Fail-closed: Throws DOCUMENT_INTAKE_NOT_READY if quarantine/malware scanning is uncommissioned.
 */

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../supabase';
import { AuthorityError, safeId } from './authority.repository';

export type TaxGuardStorageLifecycleStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'QUARANTINED'
  | 'SCANNING'
  | 'RELEASED'
  | 'OCR_PENDING'
  | 'OCR_COMPLETE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

export interface SupabaseDocumentMetadata {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  caseId: string;
  documentId: string;
  version: number;
  hash: string;
  mimeType: string;
  status: TaxGuardStorageLifecycleStatus;
  provenance: Record<string, any>;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  quarantineStatus: 'QUARANTINED' | 'CLEAN' | 'INFECTED';
  scannedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export class SupabaseStorageVault {
  private readonly client: SupabaseClient;
  private readonly bucketName = 'taxguard-vault';

  constructor(client?: SupabaseClient) {
    this.client = client || getSupabaseAdmin();
  }

  /**
   * Builds the strictly isolated tenant storage path.
   */
  getStoragePath(scope: {
    tenantId: string;
    clientId: string;
    caseId: string;
    documentId: string;
    version: number;
  }): string {
    [scope.tenantId, scope.clientId, scope.caseId, scope.documentId].forEach(safeId);
    return `tenants/${scope.tenantId}/clients/${scope.clientId}/cases/${scope.caseId}/docs/${scope.documentId}_v${scope.version}`;
  }

  /**
   * Uploads an incoming document into quarantine.
   *
   * SECURITY INVARIANT: If malware scanning is not operational,
   * document intake must fail closed with DOCUMENT_INTAKE_NOT_READY.
   */
  async uploadQuarantinedDocument(
    scope: {
      tenantId: string;
      clientId: string;
      engagementId: string;
      taxYear: number;
      caseId: string;
      documentId: string;
      version?: number;
      fileName: string;
      mimeType: string;
      createdBy: string;
    },
    fileBuffer: Buffer
  ): Promise<SupabaseDocumentMetadata> {
    // 1. Fail closed check
    const isScannerReady = process.env.TAXGUARD_MALWARE_SCANNER_ENABLED === 'true';
    if (!isScannerReady) {
      throw new AuthorityError('DOCUMENT_INTAKE_NOT_READY', 503);
    }

    [scope.tenantId, scope.clientId, scope.engagementId, scope.caseId, scope.documentId, scope.createdBy].forEach(safeId);

    const version = scope.version || 1;
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    const storagePath = this.getStoragePath({
      tenantId: scope.tenantId,
      clientId: scope.clientId,
      caseId: scope.caseId,
      documentId: scope.documentId,
      version
    });

    // 2. Upload file to Supabase Storage bucket
    const { error: uploadError } = await this.client.storage
      .from(this.bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: scope.mimeType,
        upsert: false
      });

    if (uploadError) {
      throw new AuthorityError(`STORAGE_UPLOAD_FAILED: ${uploadError.message}`, 500);
    }

    // 3. Register document in database in QUARANTINED status
    const metadata: SupabaseDocumentMetadata = {
      tenantId: scope.tenantId,
      clientId: scope.clientId,
      engagementId: scope.engagementId,
      taxYear: scope.taxYear,
      caseId: scope.caseId,
      documentId: scope.documentId,
      version,
      hash,
      mimeType: scope.mimeType,
      status: 'QUARANTINED', // Strictly quarantined on intake
      provenance: {
        source: 'CLIENT_UPLOAD',
        quarantineInitiatedAt: new Date().toISOString()
      },
      storagePath,
      fileName: scope.fileName,
      fileSizeBytes: fileBuffer.length,
      quarantineStatus: 'QUARANTINED',
      createdBy: scope.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { error: metadataError } = await this.client
      .from('taxguard_documents')
      .insert({
        document_id: metadata.documentId,
        tenant_id: metadata.tenantId,
        client_id: metadata.clientId,
        engagement_id: metadata.engagementId,
        tax_year: metadata.taxYear,
        case_id: metadata.caseId,
        version: metadata.version,
        hash: metadata.hash,
        mime_type: metadata.mimeType,
        status: metadata.status,
        provenance: metadata.provenance,
        storage_path: metadata.storagePath,
        file_name: metadata.fileName,
        file_size_bytes: metadata.fileSizeBytes,
        quarantine_status: metadata.quarantineStatus,
        created_by: metadata.createdBy,
        created_at: metadata.createdAt,
        updated_at: metadata.updatedAt
      });
    if (metadataError) {
      throw new AuthorityError('DOCUMENT_METADATA_STORE_UNAVAILABLE', 503);
    }

    return metadata;
  }

  /**
   * Generates a signed, short-lived download URL for an authorized document.
   */
  async getSignedDownloadUrl(
    scope: {
      tenantId: string;
      clientId: string;
      documentId: string;
    },
    expiresInSeconds = 300
  ): Promise<string> {
    [scope.tenantId, scope.clientId, scope.documentId].forEach(safeId);
    const { data: document, error: lookupError } = await this.client
      .from('taxguard_documents')
      .select('document_id, tenant_id, client_id, case_id, version, storage_path, status, quarantine_status')
      .eq('tenant_id', scope.tenantId)
      .eq('client_id', scope.clientId)
      .eq('document_id', scope.documentId)
      .maybeSingle();

    if (lookupError) {
      throw new AuthorityError('DOCUMENT_AUTHORIZATION_UNAVAILABLE', 503);
    }
    if (
      !document ||
      document.tenant_id !== scope.tenantId ||
      document.client_id !== scope.clientId ||
      document.document_id !== scope.documentId
    ) {
      throw new AuthorityError('DOCUMENT_NOT_FOUND', 404);
    }
    if (!['RELEASED', 'VERIFIED'].includes(document.status) || document.quarantine_status !== 'CLEAN') {
      throw new AuthorityError('DOCUMENT_NOT_AVAILABLE', 403);
    }

    const expectedPath = this.getStoragePath({
      tenantId: scope.tenantId,
      clientId: scope.clientId,
      caseId: document.case_id,
      documentId: document.document_id,
      version: Number(document.version)
    });
    if (document.storage_path !== expectedPath) {
      throw new AuthorityError('DOCUMENT_STORAGE_SCOPE_INVALID', 403);
    }

    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .createSignedUrl(expectedPath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new AuthorityError(`FAILED_TO_SIGN_URL: ${error?.message || 'Unknown error'}`, 500);
    }

    return data.signedUrl;
  }
}
