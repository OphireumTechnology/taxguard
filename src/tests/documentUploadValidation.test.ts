import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';
import { MAX_DOCUMENT_BYTES, decodeBase64Strict, formatDocumentSize, matchesFileSignature, parseDocumentSize, validateDocumentUpload } from '../server/documentUploadValidation';

const state = vi.hoisted(() => ({ users: new Map<string, any>() }));
vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return { ...actual, authenticateToken: (req: any, res: any, next: any) => {
    const user = state.users.get(req.get('x-test-user'));
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = user; next();
  } };
});
import { documentsRouter } from '../server/routes/documents.routes';

const NOW = new Date('2026-10-11T00:00:00Z');
const valid = { fileName: 'W2_2025.pdf', fileType: 'application/pdf', fileSize: '1.2 MB', taxYear: 2025, category: 'income_document' };

describe('validateDocumentUpload (pure)', () => {
  it('accepts a consistent, bounded upload and normalizes size to bytes', () => {
    const r = validateDocumentUpload(valid, NOW);
    expect(r).toEqual({ ok: true, value: { fileName: 'W2_2025.pdf', fileType: 'application/pdf', sizeBytes: Math.ceil(1.2 * 1024 * 1024), taxYear: 2025, category: 'income_document' } });
  });
  it.each([
    ['image/jpeg', 'scan.JPG'], ['image/jpeg', 'scan.jpeg'], ['image/png', 'id.png'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'ledger.xlsx'], ['text/csv', 'bank.csv'],
  ])('accepts %s with matching extension %s', (fileType, fileName) => {
    expect(validateDocumentUpload({ ...valid, fileType, fileName }, NOW).ok).toBe(true);
  });
  it.each([
    [{ fileName: undefined }, 'FILE_NAME_INVALID'], [{ fileName: '   ' }, 'FILE_NAME_INVALID'], [{ fileName: 'x'.repeat(252) + '.pdf' }, 'FILE_NAME_INVALID'],
    [{ fileName: '../etc/passwd.pdf' }, 'FILE_NAME_INVALID'], [{ fileName: 'dir\\w2.pdf' }, 'FILE_NAME_INVALID'], [{ fileName: '.hidden.pdf' }, 'FILE_NAME_INVALID'],
    [{ fileName: 'w2\u0000.pdf' }, 'FILE_NAME_INVALID'],
    [{ fileName: 'w2.pdf.exe' }, 'FILE_SUSPICIOUS'], [{ fileName: 'invoice.exe.pdf' }, 'FILE_SUSPICIOUS'], [{ fileName: 'statement.html' }, 'FILE_SUSPICIOUS'],
    [{ fileName: 'logo.svg', fileType: 'image/png' }, 'FILE_SUSPICIOUS'], [{ fileName: 'macro.xlsm' }, 'FILE_SUSPICIOUS'], [{ fileName: 'run.PS1' }, 'FILE_SUSPICIOUS'],
    [{ fileType: undefined }, 'FILE_TYPE_UNSUPPORTED'], [{ fileType: 'application/zip' }, 'FILE_TYPE_UNSUPPORTED'], [{ fileType: 'text/html' }, 'FILE_TYPE_UNSUPPORTED'],
    [{ fileName: 'w2.png' }, 'FILE_EXTENSION_MISMATCH'], [{ fileName: 'w2' }, 'FILE_EXTENSION_MISMATCH'],
    [{ fileSize: undefined }, 'FILE_SIZE_REQUIRED'], [{ fileSize: '' }, 'FILE_SIZE_REQUIRED'], [{ fileSize: 'huge' }, 'FILE_SIZE_INVALID'],
    [{ fileSize: 0 }, 'FILE_SIZE_INVALID'], [{ fileSize: -5 }, 'FILE_SIZE_INVALID'], [{ fileSize: 1.5 }, 'FILE_SIZE_INVALID'],
    [{ fileSize: MAX_DOCUMENT_BYTES + 1 }, 'FILE_TOO_LARGE'], [{ fileSize: '26 MB' }, 'FILE_TOO_LARGE'], [{ fileSize: '1 GB' }, 'FILE_TOO_LARGE'],
    [{ taxYear: undefined }, 'TAX_YEAR_INVALID'], [{ taxYear: 'abc' }, 'TAX_YEAR_INVALID'], [{ taxYear: 1999 }, 'TAX_YEAR_INVALID'],
    [{ taxYear: 2028 }, 'TAX_YEAR_INVALID'], [{ taxYear: 2025.5 }, 'TAX_YEAR_INVALID'],
    [{ category: 'Tax Return!' }, 'CATEGORY_INVALID'], [{ category: 42 }, 'CATEGORY_INVALID'],
  ])('rejects %j with %s', (patch, code) => {
    const r = validateDocumentUpload({ ...valid, ...patch }, NOW);
    expect(r.ok).toBe(false);
    expect((r as any).code).toBe(code);
  });
  it('flags only dangerous names as suspicious', () => {
    expect((validateDocumentUpload({ ...valid, fileName: 'w2.pdf.exe' }, NOW) as any).suspicious).toBe(true);
    expect((validateDocumentUpload({ ...valid, fileType: 'application/zip' }, NOW) as any).suspicious).toBe(false);
  });
  it('accepts the 25 MB boundary exactly and next-year documents', () => {
    expect(validateDocumentUpload({ ...valid, fileSize: MAX_DOCUMENT_BYTES }, NOW).ok).toBe(true);
    expect(validateDocumentUpload({ ...valid, taxYear: 2027 }, NOW).ok).toBe(true);
    expect(validateDocumentUpload({ ...valid, taxYear: '2024' }, NOW).ok).toBe(true);
  });
  it('verifies file signatures against the declared type', () => {
    expect(matchesFileSignature(Buffer.from('%PDF-1.7 body'), 'application/pdf')).toBe(true);
    expect(matchesFileSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), 'image/png')).toBe(true);
    expect(matchesFileSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true);
    expect(matchesFileSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
    expect(matchesFileSignature(Buffer.from('a,b\n1,2\n'), 'text/csv')).toBe(true);
    expect(matchesFileSignature(Buffer.from('MZ executable'), 'application/pdf')).toBe(false);
    expect(matchesFileSignature(Buffer.from('%PDF-'), 'image/png')).toBe(false);
    expect(matchesFileSignature(Buffer.from([0x61, 0x00, 0x62]), 'text/csv')).toBe(false);
    expect(matchesFileSignature(Buffer.from('%PDF-'), 'application/zip')).toBe(false);
  });
  it('decodes base64 strictly', () => {
    expect(decodeBase64Strict(Buffer.from('%PDF-').toString('base64'))?.toString()).toBe('%PDF-');
    expect(decodeBase64Strict('data:application/pdf;base64,' + Buffer.from('%PDF-').toString('base64'))?.toString()).toBe('%PDF-');
    for (const bad of ['', 'abc', 'not*base64!', 42, null]) expect(decodeBase64Strict(bad)).toBeNull();
  });
  it('parses byte counts and display sizes, and formats sizes', () => {
    expect(parseDocumentSize(2048)).toBe(2048);
    expect(parseDocumentSize('2048')).toBe(2048);
    expect(parseDocumentSize('512 KB')).toBe(524288);
    expect(parseDocumentSize('1 bytes')).toBe(1);
    expect(parseDocumentSize('1e3')).toBeNull();
    expect(formatDocumentSize(1258292)).toBe('1.20 MB');
    expect(formatDocumentSize(10)).toBe('1 KB');
  });
});

describe('upload routes', () => {
  let server: Server, origin: string;
  const post = async (path: string, user: string, body: unknown) => {
    const response = await fetch(`${origin}/api/documents${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': user }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const created: string[] = [];
  const docsFor = (clientId: string) => Array.from(db.documents.values()).filter(d => d.clientId === clientId);

  beforeAll(async () => {
    const app = express(); app.use(express.json()); app.use('/api/documents', documentsRouter);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    for (const [id, tenantId] of [['upload-client-a', 'tenant-up-a'], ['upload-client-b', 'tenant-up-a'], ['upload-client-x', 'tenant-up-b']]) {
      const user = { id, clientId: id, tenantId, role: 'client', name: id, status: 'active' };
      db.users.set(id, user as any); state.users.set(id, user); created.push(id);
    }
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const id of created) { db.users.delete(id); state.users.delete(id); for (const d of docsFor(id)) db.documents.delete(d.id); }
    created.length = 0;
  });

  it('accepts a valid upload, stores the validated type, year and normalized size', async () => {
    const r = await post('/upload', 'upload-client-a', { ...valid, fileSize: 2048 });
    expect(r.status).toBe(201);
    expect(r.body.document).toMatchObject({ clientId: 'upload-client-a', fileType: 'application/pdf', taxYear: 2025, fileSize: '2 KB' });
  });

  it.each([
    [{ ...valid, fileType: undefined }, 'FILE_TYPE_UNSUPPORTED'],
    [{ ...valid, fileSize: undefined }, 'FILE_SIZE_REQUIRED'],
    [{ ...valid, fileSize: '40 MB' }, 'FILE_TOO_LARGE'],
    [{ ...valid, fileName: 'w2.png' }, 'FILE_EXTENSION_MISMATCH'],
    [{ ...valid, taxYear: 'next year' }, 'TAX_YEAR_INVALID'],
  ])('rejects invalid single upload %# without storing anything (previously silently defaulted)', async (body, code) => {
    const before = docsFor('upload-client-a').length;
    const r = await post('/upload', 'upload-client-a', body);
    expect(r.status).toBe(400);
    expect(r.body.code).toBe(code);
    expect(docsFor('upload-client-a')).toHaveLength(before);
  });

  it('blocks a disguised executable and records a security event without echoing the file name', async () => {
    const spy = vi.spyOn(db, 'logSecurityEvent');
    const r = await post('/upload', 'upload-client-a', { ...valid, fileName: 'refund-W2.pdf.exe' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('FILE_SUSPICIOUS');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MALWARE_SIGNATURE_DETECTED', severity: 'critical' }));
    expect(JSON.stringify(spy.mock.calls)).not.toContain('refund-W2');
    expect(docsFor('upload-client-a')).toHaveLength(0);
    spy.mockRestore();
  });

  it('a client cannot upload into another client of the same tenant or another tenant', async () => {
    for (const target of ['upload-client-b', 'upload-client-x']) {
      const r = await post('/upload', 'upload-client-a', { ...valid, clientId: target });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(docsFor(target)).toHaveLength(0);
    }
  });

  it('batch: ingests valid files, reports rejected ones by index and reason, and applies the batch tax year', async () => {
    const r = await post('/upload-batch', 'upload-client-a', { taxYear: 2024, files: [
      { fileName: 'ok.pdf', fileType: 'application/pdf', fileSize: 1000, taxYear: 1999 },
      { fileName: 'bad.pdf.bat', fileType: 'application/pdf', fileSize: 1000 },
      { fileName: 'big.pdf', fileType: 'application/pdf', fileSize: MAX_DOCUMENT_BYTES * 2 },
      { fileName: 'nosize.pdf', fileType: 'application/pdf' },
    ] });
    expect(r.status).toBe(201);
    expect(r.body.documents).toHaveLength(1);
    expect(r.body.documents[0]).toMatchObject({ fileName: 'ok.pdf', taxYear: 2024 });
    expect(r.body.rejected).toEqual([{ index: 1, code: 'FILE_SUSPICIOUS' }, { index: 2, code: 'FILE_TOO_LARGE' }, { index: 3, code: 'FILE_SIZE_REQUIRED' }]);
  });

  it('batch: returns 400 when every file is rejected, and refuses oversized or missing-year batches', async () => {
    const allBad = await post('/upload-batch', 'upload-client-a', { taxYear: 2025, files: [{ fileName: 'x.exe', fileType: 'application/pdf', fileSize: 1 }] });
    expect(allBad.status).toBe(400);
    expect(allBad.body.code).toBe('BATCH_REJECTED');
    const tooMany = await post('/upload-batch', 'upload-client-a', { taxYear: 2025, files: Array.from({ length: 21 }, (_, i) => ({ fileName: `f${i}.pdf`, fileType: 'application/pdf', fileSize: 1 })) });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.code).toBe('BATCH_TOO_LARGE');
    const noYear = await post('/upload-batch', 'upload-client-a', { files: [{ fileName: 'a.pdf', fileType: 'application/pdf', fileSize: 1 }] });
    expect(noYear.status).toBe(400);
    expect(noYear.body.rejected).toEqual([{ index: 0, code: 'TAX_YEAR_INVALID' }]);
    expect(docsFor('upload-client-a')).toHaveLength(0);
  });

  describe('cross-tenant access to existing documents', () => {
    const docId = 'xt-doc-a';
    const get = (path: string, user: string, method = 'GET') => fetch(`${origin}/api/documents${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-user': user } });
    beforeEach(() => {
      db.documents.set(docId, { id: docId, clientId: 'upload-client-a', clientName: 'a', fileName: 'w2.pdf', fileSize: '1 KB', fileType: 'application/pdf', category: 'income_document', taxYear: 2025, status: 'uploaded', uploadedAt: NOW.toISOString(), uploadedBy: 't', version: 1, isEncrypted: true } as any);
      for (const [id, tenantId] of [['xt-admin-a', 'tenant-up-a'], ['xt-admin-b', 'tenant-up-b']]) state.users.set(id, { id, tenantId, role: 'admin', name: id, status: 'active' });
    });
    afterEach(() => { db.documents.delete(docId); state.users.delete('xt-admin-a'); state.users.delete('xt-admin-b'); });

    it('same-tenant administrator may read the document and request a signed URL (control)', async () => {
      expect((await get(`/${docId}`, 'xt-admin-a')).status).toBe(200);
      expect((await get(`/${docId}/signed-url`, 'xt-admin-a', 'POST')).status).toBe(200);
    });
    it('another tenant\'s administrator cannot read, sign, review or withdraw it', async () => {
      const tokensBefore = db.signedDownloadTokens.size;
      expect((await get(`/${docId}`, 'xt-admin-b')).status).toBe(403);
      expect((await get(`/${docId}/signed-url`, 'xt-admin-b', 'POST')).status).toBe(403);
      expect(db.signedDownloadTokens.size).toBe(tokensBefore);
      const review = await fetch(`${origin}/api/documents/${docId}/review`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-user': 'xt-admin-b' }, body: JSON.stringify({ status: 'approved' }) });
      expect(review.status).toBe(403);
      const withdraw = await fetch(`${origin}/api/documents/${docId}/withdraw`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'xt-admin-b' }, body: JSON.stringify({ justification: 'cross-tenant attempt' }) });
      expect(withdraw.status).toBe(403);
      expect(db.documents.get(docId)?.status).toBe('uploaded');
    });
    it.each([[{}, 'REVIEW_STATUS_INVALID'], [{ status: 'archived' }, 'REVIEW_STATUS_INVALID'], [{ status: 'delivered' }, 'REVIEW_STATUS_INVALID'],
      [{ status: 'approved', reviewerNotes: 'x'.repeat(2001) }, 'REVIEW_NOTES_INVALID'], [{ status: 'approved', correctedFields: 'nope' }, 'CORRECTED_FIELDS_INVALID']])(
      'review rejects %j with %s instead of crashing or storing it', async (body, code) => {
        const r = await fetch(`${origin}/api/documents/${docId}/review`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-user': 'xt-admin-a' }, body: JSON.stringify(body) });
        expect(r.status).toBe(400);
        expect((await r.json()).code).toBe(code);
        expect(db.documents.get(docId)?.status).toBe('uploaded');
      });
    it('same-tenant reviewer decision is recorded', async () => {
      const r = await fetch(`${origin}/api/documents/${docId}/review`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-user': 'xt-admin-a' }, body: JSON.stringify({ status: 'needs_correction', reviewerNotes: 'Synthetic note' }) });
      expect(r.status).toBe(200);
      expect(db.documents.get(docId)).toMatchObject({ status: 'needs_correction', reviewerNotes: 'Synthetic note' });
    });
    it('another client in the same tenant cannot read it', async () => {
      expect((await get(`/${docId}`, 'upload-client-b')).status).toBe(403);
    });
  });

  it('remains disabled in production regardless of validity', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const r = await post('/upload', 'upload-client-a', valid);
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('DOCUMENT_INTAKE_NOT_READY');
  });
});
