import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createVaultRouter } from '../server/routes/vault.routes';
import { DocumentVaultStore } from '../server/taxguard/documents/documentVaultStore';
import { contentMatchesType, SupabaseVaultStorage, type MalwareScanner, type OcrProvider, type VaultStorage } from '../server/taxguard/documents/vaultIntegrations';
import { AuthenticatedMalwareScanner, scanVerdictSignature } from '../server/taxguard/documents/authenticatedScanner';
import { randomBytes } from 'node:crypto';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/vault -> DocumentVaultStore -> proposal 027 (PGlite) with a synthetic private store,
// a synthetic scanner (EICAR test string) and a synthetic OCR provider. Synthetic documents only.
const T = 'tenantA', C = 'dvClient', OTHER = 'dvOther';
const PDF = (text: string) => Buffer.from('%PDF-1.4\n' + text + '\n%%EOF');
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
class MemoryStorage implements VaultStorage {
  objects = new Map<string, Buffer>(); signed: Array<{ path: string; ttl: number }> = [];
  async put(path: string, bytes: Buffer) { if (this.objects.has(path)) throw new Error('exists'); this.objects.set(path, bytes); }
  async signedUrl(path: string, ttl: number) { this.signed.push({ path, ttl }); return `https://storage.invalid/signed/${encodeURIComponent(path)}?ttl=${ttl}`; }
}
const scanner: MalwareScanner = { name: 'synthetic-eicar', async scan(bytes) { return bytes.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) ? 'INFECTED' : 'CLEAN'; } };
const ocr: OcrProvider = { name: 'synthetic-ocr', async extract() { return [{ fieldKey: 'w2.box1_wages', value: 1000.5, confidence: 0.62, page: 1 }, { fieldKey: 'w2.employer_name', value: 'Synthetic Employer', confidence: 0.9 }]; } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let storage: MemoryStorage; let useScanner = true;
let n = 0; let engagementId = '';
const people: Record<string, any> = { client: { id: 'dv-client', role: 'client', clientId: C }, other: { id: 'dv-other-client', role: 'client', clientId: OTHER },
  acct: { id: 'dv-acct', role: 'accountant' }, rev: { id: 'dv-rev', role: 'senior_reviewer' }, outsider: { id: 'dv-outsider', role: 'accountant' } };
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const upload = (client: string, body: Buffer, q: Record<string, string> = {}, type = 'application/pdf', key = `dv-key-${++n}-${Date.now()}`) =>
  fetch(origin + `/vault/clients/${client}/documents?` + new URLSearchParams({ engagementId, taxYear: '2025', category: 'income', fileName: 'synthetic-w2.pdf', ...q }),
    { method: 'POST', headers: { 'content-type': type, 'idempotency-key': key }, body }).then(async r => ({ status: r.status, body: await r.json() }));
const post = (path: string, body: unknown = {}) => fetch(origin + '/vault' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, body: await r.json() }));
const get = (path: string) => fetch(origin + '/vault' + path).then(async r => ({ status: r.status, body: await r.json() }));

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(250000|270000)_|^20261014500000_|^20261015050000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','dv-client','Synthetic Vault Client'),('${T}','${OTHER}','dv-other-client','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','dv-client','client','active','${C}'),('${T}','dv-other-client','client','active','${OTHER}'),
      ('${T}','dv-acct','accountant','active',NULL),('${T}','dv-rev','senior_reviewer','active',NULL),('${T}','dv-outsider','accountant','active',NULL),('${T}','dv-mgr','practice_manager','active',NULL);`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  engagementId = (await practice.createEngagement(T, C, 'dv-mgr', 'dv-engagement', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  const otherEng = (await practice.createEngagement(T, OTHER, 'dv-mgr', 'dv-engagement-2', { title: 'Other', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'dv-mgr', engagementId, 'active', 1);
  await practice.assign(T, C, 'dv-mgr', 'dv-asg-1', { engagementId, taxYear: 2025, role: 'preparer', userId: 'dv-acct', reason: 'Initial staffing' });
  await practice.assign(T, C, 'dv-mgr', 'dv-asg-2', { engagementId, taxYear: 2025, role: 'reviewer', userId: 'dv-rev', reason: 'Initial staffing' });
  void otherEng;
  storage = new MemoryStorage();
  const app = express();
  app.use('/vault', createVaultRouter({ store: () => new DocumentVaultStore(pgliteRpc(() => fixture.pg), storage, useScanner ? scanner : undefined, ocr),
    authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 60000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });
beforeEach(() => { useScanner = true; as('client'); });

describe('document vault', () => {
  let docId = '';
  it('keeps production uploads quarantined even when a fake CLEAN scanner is injected',async()=>{
    const env=process.env.NODE_ENV;let called=false;
    const isolated=new MemoryStorage(),store=new DocumentVaultStore(pgliteRpc(()=>fixture.pg),isolated,{name:'fake',async scan(){called=true;return 'CLEAN';}});
    process.env.NODE_ENV='production';
    try{const result=await store.upload(T,C,'dv-client',{engagementId,taxYear:2025,category:'income',fileName:'production-fake.pdf',mimeType:'application/pdf',idempotencyKey:'production-fake-key'},PDF('synthetic'));
      expect(result.status).toBe('SCAN_PENDING');expect(called).toBe(false);await expect(store.downloadUrl(T,C,'dv-client',result.documentId,result.version)).rejects.toThrow('DOCUMENT_NOT_AVAILABLE');
    }finally{process.env.NODE_ENV=env;}
  });
  it('keeps forged authenticated scanner verdicts quarantined and blocks infected downloads', async () => {
    const key = randomBytes(32);
    const scannerStorage = new MemoryStorage();
    for (const mode of ['forged', 'infected']) {
      const adapter = new AuthenticatedMalwareScanner({ async scan(request) {
        const result = { requestId: request.requestId, digest: request.digest, issuedAt: request.issuedAt, verdict: mode === 'infected' ? 'INFECTED' as const : 'CLEAN' as const };
        return { ...result, signature: mode === 'forged' ? '0'.repeat(64) : scanVerdictSignature(key, result) };
      } }, key);
      const store = new DocumentVaultStore(pgliteRpc(() => fixture.pg), scannerStorage, adapter);
      const uploaded = await store.upload(T, C, 'dv-client', { engagementId, taxYear: 2025, category: 'income', fileName: `scanner-${mode}.pdf`, mimeType: 'application/pdf', idempotencyKey: `scanner-${mode}-key` }, PDF('synthetic scanner boundary'));
      expect(uploaded.status).toBe(mode === 'forged' ? 'SCAN_PENDING' : 'REJECTED_MALWARE');
      await expect(store.downloadUrl(T, C, 'dv-client', uploaded.documentId, uploaded.version)).rejects.toThrow('DOCUMENT_NOT_AVAILABLE');
    }
    expect(scannerStorage.signed).toHaveLength(0);
  });
  it('stores a client upload privately under a server-computed path, scans it and queues it for review', async () => {
    const r = await upload(C, PDF('synthetic W-2'));
    expect(r.status).toBe(201); expect(r.body).toMatchObject({ version: 1, status: 'PENDING_REVIEW', replayed: false });
    docId = r.body.documentId;
    const [path] = [...storage.objects.keys()];
    expect(path).toBe(`tenants/${T}/clients/${C}/engagements/${engagementId}/2025/docs/${docId}_v1`);
    const listed = (await get(`/clients/${C}/documents`)).body.items;
    expect(listed[0]).toMatchObject({ documentId: docId, status: 'PENDING_REVIEW', quarantineStatus: 'CLEAN' });
    expect(listed[0]).not.toHaveProperty('uploaderRole');
    expect(JSON.stringify(listed)).not.toContain('tenants/');
  });

  it('validates type, size, content signature and idempotency before anything is stored', async () => {
    const before = storage.objects.size;
    expect((await upload(C, Buffer.from('MZ\x90\x00 not a pdf'))).body.code).toBe('DOCUMENT_CONTENT_MISMATCH');
    expect((await upload(C, Buffer.from('x'), {}, 'application/x-msdownload')).status).toBe(415);
    expect((await upload(C, Buffer.alloc(26_214_401, 0x25))).status).toBe(413);
    expect((await upload(C, Buffer.from('a,b\n=cmd()'), { fileName: 'formula.csv' }, 'text/csv')).body.code).toBe('DOCUMENT_CONTENT_MISMATCH');
    expect((await upload(C, PDF('x'), { category: 'unknown' })).body.code).toBe('DOCUMENT_INPUT_INVALID');
    expect((await upload(C, PDF('x'), { fileName: '../escape.pdf' })).body.code).toBe('DOCUMENT_INPUT_INVALID');
    expect(storage.objects.size).toBe(before);
    const first = await upload(C, PDF('retry me'), {}, 'application/pdf', 'dv-fixed-key-1');
    const again = await upload(C, PDF('retry me'), {}, 'application/pdf', 'dv-fixed-key-1');
    expect(again.body).toMatchObject({ documentId: first.body.documentId, replayed: true });
    expect((await upload(C, PDF('different bytes'), {}, 'application/pdf', 'dv-fixed-key-1')).body.code).toBe('DOCUMENT_IDEMPOTENCY_CONFLICT');
  });

  it('quarantines infected uploads permanently and keeps unscanned uploads undownloadable', async () => {
    const infected = await upload(C, PDF(EICAR));
    expect(infected.body.status).toBe('REJECTED_MALWARE');
    expect((await post(`/clients/${C}/documents/${infected.body.documentId}/versions/1/download`)).body.code).toBe('DOCUMENT_NOT_AVAILABLE');
    useScanner = false;
    const pending = await upload(C, PDF('no scanner configured'));
    expect(pending.body.status).toBe('SCAN_PENDING');
    expect((await post(`/clients/${C}/documents/${pending.body.documentId}/versions/1/download`)).body.code).toBe('DOCUMENT_NOT_AVAILABLE');
    as('rev');
    expect((await get('/review-queue')).body.items.map((d: any) => d.documentId)).not.toContain(pending.body.documentId);
  });

  it('lets only an independent assigned staff member review; clients and the uploader cannot', async () => {
    expect((await post(`/clients/${C}/documents/${docId}/versions/1/review`, { decision: 'approve', rowVersion: 3 })).body.code).toBe('DOCUMENT_REVIEW_REQUIRES_STAFF');
    as('outsider');
    expect((await post(`/clients/${C}/documents/${docId}/versions/1/review`, { decision: 'approve', rowVersion: 3 })).body.code).toBe('DOCUMENT_NOT_FOUND');
    expect((await get('/review-queue')).body.items).toEqual([]);
    as('acct');
    const staffUpload = await upload(C, PDF('staff uploaded engagement letter'), { category: 'engagement' });
    expect((await post(`/clients/${C}/documents/${staffUpload.body.documentId}/versions/1/review`, { decision: 'approve', rowVersion: 3 })).body.code).toBe('MAKER_CHECKER_VIOLATION');
    as('rev');
    const queue = (await get('/review-queue')).body.items;
    expect(queue.map((d: any) => d.documentId)).toEqual(expect.arrayContaining([docId, staffUpload.body.documentId]));
    expect((await post(`/clients/${C}/documents/${docId}/versions/1/review`, { decision: 'approve', rowVersion: 1 })).body.code).toBe('DOCUMENT_VERSION_CONFLICT');
    expect((await post(`/clients/${C}/documents/${docId}/versions/1/review`, { decision: 'reject', rowVersion: 3, note: 'no' })).body.code).toBe('DOCUMENT_INPUT_INVALID');
    const approved = await post(`/clients/${C}/documents/${docId}/versions/1/review`, { decision: 'approve', rowVersion: 3 });
    expect(approved.body).toMatchObject({ status: 'VERIFIED' });
  });

  it('issues short-lived signed URLs only to authorized actors and audits each grant', async () => {
    const ok = await post(`/clients/${C}/documents/${docId}/versions/1/download`);
    expect(ok.status).toBe(200); expect(ok.body.expiresInSeconds).toBe(60);
    expect(storage.signed.at(-1)).toEqual({ path: `tenants/${T}/clients/${C}/engagements/${engagementId}/2025/docs/${docId}_v1`, ttl: 60 });
    as('other');
    expect((await post(`/clients/${C}/documents/${docId}/versions/1/download`)).body.code).toBe('DOCUMENT_NOT_FOUND');
    expect((await get(`/clients/${C}/documents`)).status).toBe(404);
    as('outsider');
    expect((await post(`/clients/${C}/documents/${docId}/versions/1/download`)).body.code).toBe('DOCUMENT_NOT_FOUND');
    as('acct', 'tenantB');
    expect((await get(`/clients/${C}/documents`)).body.code).toBe('DOCUMENT_NOT_FOUND'); // other tenant: indistinguishable from absent
    as('rev');
    // Force a clock tie in this disposable fixture: UUID ordering must not reorder causal events.
    await fixture.pg.query("UPDATE taxguard_audit_log SET timestamp='2026-01-01T00:00:00Z' WHERE metadata->>'documentId'=$1", [docId]);
    const history = (await get(`/clients/${C}/documents/${docId}`)).body.history.map((h: any) => h.action);
    expect(history).toEqual(['DOCUMENT_UPLOAD_REGISTERED', 'DOCUMENT_UPLOADED', 'DOCUMENT_SCAN_REQUESTED', 'DOCUMENT_SCANNED', 'DOCUMENT_SCAN_VERDICT', 'DOCUMENT_EXTRACTION_PROPOSED', 'DOCUMENT_VERIFIED', 'DOCUMENT_DOWNLOAD_AUTHORIZED']);
  });

  it('keeps OCR values as proposals until a staff member verifies each field; clients never see them', async () => {
    const proposals = (await get(`/clients/${C}/documents/${docId}`)).body.extractions;
    expect(proposals).toEqual([]);
    as('rev');
    const fields = (await get(`/clients/${C}/documents/${docId}`)).body.extractions;
    expect(fields.map((f: any) => [f.fieldKey, f.decision])).toEqual([['w2.box1_wages', null], ['w2.employer_name', null]]);
    as('client');
    expect((await post(`/clients/${C}/extractions/${fields[0].fieldId}/verify`, { decision: 'ACCEPTED' })).body.code).toBe('DOCUMENT_REVIEW_REQUIRES_STAFF');
    as('rev');
    expect((await post(`/clients/${C}/extractions/${fields[0].fieldId}/verify`, { decision: 'CORRECTED', value: 1000.05 })).body.decision).toBe('CORRECTED');
    expect((await post(`/clients/${C}/extractions/${fields[0].fieldId}/verify`, { decision: 'ACCEPTED' })).body.code).toBe('EXTRACTION_ALREADY_VERIFIED');
    expect((await post(`/clients/${C}/extractions/${fields[1].fieldId}/verify`, { decision: 'ACCEPTED' })).body.decision).toBe('ACCEPTED');
    const verified = (await get(`/clients/${C}/documents/${docId}`)).body.extractions;
    expect(verified.map((f: any) => [f.fieldKey, f.decision, f.verifiedValue, f.verifiedBy])).toEqual([['w2.box1_wages', 'CORRECTED', 1000.05, 'dv-rev'],
      ['w2.employer_name', 'ACCEPTED', 'Synthetic Employer', 'dv-rev']]);
  });
  it('refuses expired bound requests, preserves quarantine and consumes a fresh retry only once',async()=>{
    as('client');useScanner=false;const uploaded=await upload(C,PDF('synthetic expiry fixture'));expect(uploaded.body.status).toBe('SCAN_PENDING');
    const expired=(await fixture.pg.query<{scan_id:string}>(`INSERT INTO taxguard_doc_scan_requests(tenant_id,client_id,document_id,version,provider,attempt,requested_at,expires_at)
      VALUES($1,$2,$3,1,'synthetic-expiry',1,now()-interval '2 hours',now()-interval '1 hour') RETURNING scan_id`,[T,C,uploaded.body.documentId])).rows[0].scan_id;
    const rpc=pgliteRpc(()=>fixture.pg),binding={p_tenant:T,p_scan_id:expired,p_provider:'synthetic-expiry',p_verdict:'CLEAN'};
    expect((await rpc.rpc('taxguard_doc_scan_complete',binding)).error?.message).toBe('SCAN_REQUEST_EXPIRED');
    expect((await get(`/clients/${C}/documents/${uploaded.body.documentId}`)).body.versions[0].status).toBe('SCAN_PENDING');
    const retry=await rpc.rpc('taxguard_doc_scan_request',{p_tenant:T,p_client:C,p_document_id:uploaded.body.documentId,p_version:1,p_provider:'synthetic-expiry',p_ttl_seconds:60});expect(retry.data.attempt).toBe(2);
    expect((await rpc.rpc('taxguard_doc_scan_complete',{...binding,p_scan_id:retry.data.scanId})).error).toBeNull();
    expect((await rpc.rpc('taxguard_doc_scan_complete',{...binding,p_scan_id:retry.data.scanId})).error?.message).toBe('SCAN_VERDICT_REPLAYED');
    await expect(fixture.pg.exec('DELETE FROM taxguard_doc_scan_requests')).rejects.toThrow('SCAN_HISTORY_IMMUTABLE');
  });

  it('versions a document and supersedes the earlier verified version on approval', async () => {
    const v2 = await upload(C, PDF('corrected synthetic W-2'), { documentId: docId });
    expect(v2.body).toMatchObject({ documentId: docId, version: 2, status: 'PENDING_REVIEW' });
    expect((await upload(C, PDF('third while second pending'), { documentId: docId })).body.code).toBe('DOCUMENT_VERSION_IN_PROGRESS');
    as('rev');
    await post(`/clients/${C}/documents/${docId}/versions/2/review`, { decision: 'approve', rowVersion: 3 });
    const versions = (await get(`/clients/${C}/documents/${docId}`)).body.versions.map((v: any) => [v.version, v.status]);
    expect(versions).toEqual([[2, 'VERIFIED'], [1, 'SUPERSEDED']]);
  });
});

describe('C9 client HTTP confidentiality with database-backed responses', () => {
  it('returns explicit replacement reasons without internal notes or reviewer identities', async () => {
    const uploaded = await upload(C, PDF('Synthetic C9 HTTP fixture'));
    as('rev');
    const internal = 'INTERNAL synthetic reviewer discussion';
    const reason = 'Please replace the unreadable second page.';
    const reviewed = await post(`/clients/${C}/documents/${uploaded.body.documentId}/versions/1/review`, {
      decision: 'request_replacement', rowVersion: 3, note: internal, clientReason: reason });
    expect(reviewed.status).toBe(200);
    const staff = (await get(`/clients/${C}/documents/${uploaded.body.documentId}`)).body;
    expect(staff.versions[0]).toMatchObject({ reviewNote: internal, reviewedBy: 'dv-rev', clientReason: reason });
    as('client');
    for (const path of [`/clients/${C}/documents?role=admin&actor=dv-rev`, `/clients/${C}/documents/${uploaded.body.documentId}?includeInternal=true`]) {
      const response = await get(path); expect(response.status).toBe(200);
      const text = JSON.stringify(response.body);
      expect(text).toContain(reason); expect(text).not.toContain(internal);
      expect(text).not.toMatch(/reviewNote|reviewedBy|uploadedBy|uploaderRole|actorUid|actorRole|dv-rev|synthetic-ocr/);
    }
  });
});

describe('vault database authority (bypassing the router)', () => {
  it('refuses a client acting on another client and staff without an assignment, directly in SQL', async () => {
    const vault = new DocumentVaultStore(pgliteRpc(() => fixture.pg), storage, scanner);
    await expect(vault.list(T, C, 'dv-other-client')).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
    await expect(vault.list(T, C, 'dv-outsider')).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
    await expect(vault.list(T, C, 'dv-nobody')).rejects.toMatchObject({ code: 'DOCUMENT_ACCESS_DENIED' });
    expect(Array.isArray(await vault.list(T, C, 'dv-client'))).toBe(true);
    expect(await vault.uploadTargets(T, C, 'dv-client')).toEqual([{ engagementId, title: 'Synthetic 2025 return', taxYear: 2025 }]);
    await expect(vault.uploadTargets(T, C, 'dv-other-client')).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
  });
});

describe('vault integration boundaries', () => {
  it('recognises genuine content signatures only', () => {
    expect(contentMatchesType('application/pdf', PDF('x'))).toBe(true);
    expect(contentMatchesType('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(true);
    expect(contentMatchesType('image/png', PDF('x'))).toBe(false);
    expect(contentMatchesType('text/csv', Buffer.from('date,amount\n2025-01-01,10\n'))).toBe(true);
    expect(contentMatchesType('text/csv', Buffer.from('a,b\n@SUM(A1)\n'))).toBe(false);
  });
  it('refuses to store or sign when the bucket is public or missing', async () => {
    const fake = (bucket: unknown, error: unknown = null) => ({ storage: { getBucket: async () => ({ data: bucket, error }), from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'x' }, error: null }) }) } }) as any;
    await expect(new SupabaseVaultStorage(fake({ public: true })).put('p', Buffer.from('x'), 'application/pdf')).rejects.toMatchObject({ code: 'VAULT_BUCKET_NOT_PRIVATE' });
    await expect(new SupabaseVaultStorage(fake(null, { message: 'missing' })).signedUrl('p', 60)).rejects.toMatchObject({ code: 'VAULT_STORAGE_UNAVAILABLE' });
    await expect(new SupabaseVaultStorage(fake({ public: false })).signedUrl('p', 60)).resolves.toBe('x');
  });
});
