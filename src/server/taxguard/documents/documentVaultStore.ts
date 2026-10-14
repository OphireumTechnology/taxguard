/**
 * Document vault service over the proposal-027 RPCs. Upload order: register metadata (the
 * database computes the private path) -> verify the received bytes (size, SHA-256, content
 * signature) -> store privately -> mark uploaded -> scan (if a scanner is configured) ->
 * propose OCR fields (if a provider is configured). Without a scanner documents remain
 * SCAN_PENDING and can never be downloaded.
 */
import { createHash,randomUUID } from 'node:crypto';
import type { PracticeRpcClient } from '../practice/practiceStore';
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, contentMatchesType, VaultIntegrationError, type MalwareScanner, type OcrProvider, type VaultStorage } from './vaultIntegrations';

export class DocumentVaultError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = { DOCUMENT_ACCESS_DENIED: 403, DOCUMENT_REVIEW_REQUIRES_STAFF: 403, MAKER_CHECKER_VIOLATION: 403, DOCUMENT_NOT_AVAILABLE: 403,
  DOCUMENT_VERSION_CONFLICT: 409, DOCUMENT_IDEMPOTENCY_CONFLICT: 409, DOCUMENT_VERSION_IN_PROGRESS: 409, EXTRACTION_ALREADY_VERIFIED: 409,
  DOCUMENT_TOO_LARGE: 413, DOCUMENT_TYPE_NOT_ALLOWED: 415, DOCUMENT_CONTENT_MISMATCH: 415, DOCUMENT_INTEGRITY_MISMATCH: 422 };
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
export const DOWNLOAD_URL_TTL_SECONDS = 60;

export interface UploadInput { engagementId: string; taxYear: number; caseId?: string; category: string; fileName: string; mimeType: string; documentId?: string; idempotencyKey: string }

export class DocumentVaultStore {
  constructor(private readonly client: PracticeRpcClient, private readonly storage: VaultStorage, private readonly scanner?: MalwareScanner, private readonly ocr?: OcrProvider) {}

  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new DocumentVaultError('DOCUMENT_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) throw new DocumentVaultError(message, statusOf(message));
      throw new DocumentVaultError('DOCUMENT_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }

  async upload(tenantId: string, clientId: string, actor: string, input: UploadInput, bytes: Buffer) {
    if (!Buffer.isBuffer(bytes) || bytes.length < 1) throw new DocumentVaultError('DOCUMENT_INPUT_INVALID', 400);
    // Hold one immutable upload identity across asynchronous metadata/storage/scanner calls.
    bytes=Buffer.from(bytes);input={...input};
    if (bytes.length > MAX_DOCUMENT_BYTES) throw new DocumentVaultError('DOCUMENT_TOO_LARGE', 413);
    if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(input.mimeType)) throw new DocumentVaultError('DOCUMENT_TYPE_NOT_ALLOWED', 415);
    if (!contentMatchesType(input.mimeType, bytes)) throw new DocumentVaultError('DOCUMENT_CONTENT_MISMATCH', 415);
    if (typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9_.:-]{8,128}$/.test(input.idempotencyKey)) throw new DocumentVaultError('IDEMPOTENCY_KEY_REQUIRED', 400);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const newId = 'doc_' + createHash('sha256').update([tenantId, clientId, actor, input.documentId ?? '', input.idempotencyKey].join('|')).digest('hex').slice(0, 32);
    const registered = await this.call<{ documentId: string; version: number; storagePath: string; status: string }>('taxguard_doc_begin_upload', {
      p_tenant: tenantId, p_client: clientId, p_actor: actor, p_document_id: input.documentId ?? null, p_new_id: input.documentId ? null : newId,
      p_meta: { engagementId: input.engagementId, taxYear: input.taxYear, caseId: input.caseId ?? null, category: input.category, fileName: input.fileName,
        mimeType: input.mimeType, sizeBytes: bytes.length, sha256 } });
    if (registered.status !== 'UPLOAD_PENDING') return { documentId: registered.documentId, version: registered.version, status: registered.status, replayed: true };
    if (!/^tenants\/[A-Za-z0-9_-]+\/clients\/[A-Za-z0-9_-]+\/engagements\/[A-Za-z0-9_-]+\/\d{4}\/docs\/doc_[a-f0-9]{32}_v\d+$/.test(registered.storagePath)
      || !registered.storagePath.startsWith(`tenants/${tenantId}/clients/${clientId}/`)) throw new DocumentVaultError('DOCUMENT_STORAGE_SCOPE_INVALID', 500);
    try { await this.storage.put(registered.storagePath, Buffer.from(bytes), input.mimeType); }
    catch (e) { throw new DocumentVaultError(e instanceof VaultIntegrationError ? e.code : 'VAULT_STORAGE_UNAVAILABLE', 503); }
    let state = await this.call<{ status: string }>('taxguard_doc_complete_upload', { p_tenant: tenantId, p_client: clientId, p_actor: actor,
      p_document_id: registered.documentId, p_version: registered.version, p_sha256: sha256, p_size: bytes.length });
    // No approved production scanner factory exists. Test-injected/fake scanners cannot release
    // production uploads, regardless of their claimed verdict or adapter name.
    if (this.scanner && process.env.NODE_ENV!=='production') {
      const correlation={requestId:randomUUID(),issuedAt:Date.now()};
      const binding={p_tenant:tenantId,p_client:clientId,p_document:registered.documentId,p_version:registered.version,p_request:correlation.requestId,p_digest:sha256,p_scanner:this.scanner.name,p_issued:correlation.issuedAt};
      await this.call('taxguard_doc_scan_job',binding);
      const verdict = await this.scanner.scan(Buffer.from(bytes),correlation).catch(() => null);
      // A scanner failure leaves the document SCAN_PENDING (never downloadable).
      if (verdict === 'CLEAN' || verdict === 'INFECTED') {
        state = await this.call('taxguard_doc_scan_verdict', { ...binding,p_result:verdict });
        if (verdict === 'CLEAN' && this.ocr) {
          const fields = await this.ocr.extract(Buffer.from(bytes), input.mimeType).catch(() => []);
          if (fields.length) await this.call('taxguard_doc_propose_extraction', { p_tenant: tenantId, p_client: clientId, p_document_id: registered.documentId,
            p_version: registered.version, p_provider: this.ocr.name, p_fields: fields.slice(0, 200) }).catch(() => undefined);
        }
      }
    }
    return { documentId: registered.documentId, version: registered.version, status: state.status, replayed: false };
  }
  list(tenantId: string, clientId: string, actor: string, taxYear?: number) {
    return this.call<any[]>('taxguard_doc_list', { p_tenant: tenantId, p_client: clientId, p_actor: actor, p_tax_year: taxYear ?? null });
  }
  detail(tenantId: string, clientId: string, actor: string, documentId: string) {
    return this.call('taxguard_doc_detail', { p_tenant: tenantId, p_client: clientId, p_actor: actor, p_document_id: documentId });
  }
  uploadTargets(tenantId: string, clientId: string, actor: string) {
    return this.call<Array<{ engagementId: string; title: string; taxYear: number }>>('taxguard_doc_upload_targets', { p_tenant: tenantId, p_client: clientId, p_actor: actor });
  }
  reviewQueue(tenantId: string, actor: string, limit = 50) { return this.call<any[]>('taxguard_doc_review_queue', { p_tenant: tenantId, p_actor: actor, p_limit: limit }); }
  review(tenantId: string, clientId: string, actor: string, documentId: string, version: number, decision: string, rowVersion: number, note?: string) {
    return this.call('taxguard_doc_review', { p_tenant: tenantId, p_client: clientId, p_actor: actor, p_document_id: documentId, p_version: version,
      p_decision: decision, p_note: note ?? null, p_row_version: rowVersion });
  }
  verifyExtraction(tenantId: string, clientId: string, actor: string, fieldId: string, decision: string, value?: unknown) {
    return this.call('taxguard_doc_verify_extraction', { p_tenant: tenantId, p_client: clientId, p_actor: actor, p_field: fieldId, p_decision: decision,
      p_value: value === undefined ? null : { value } });
  }
  /** Authorizes (and audits) the download in the database, then signs a short-lived private URL. */
  async downloadUrl(tenantId: string, clientId: string, actor: string, documentId: string, version: number) {
    const grant = await this.call<{ storagePath: string; fileName: string; mimeType: string }>('taxguard_doc_authorize_download', { p_tenant: tenantId, p_client: clientId,
      p_actor: actor, p_document_id: documentId, p_version: version });
    try { return { url: await this.storage.signedUrl(grant.storagePath, DOWNLOAD_URL_TTL_SECONDS), expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS, fileName: grant.fileName }; }
    catch (e) { throw new DocumentVaultError(e instanceof VaultIntegrationError ? e.code : 'VAULT_STORAGE_UNAVAILABLE', 503); }
  }
}
