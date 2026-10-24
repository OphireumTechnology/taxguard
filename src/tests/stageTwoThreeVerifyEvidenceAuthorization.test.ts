import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stageTwoThreeRouter } from '../server/routes/stage-two-three.routes';
import { db } from '../server/db';
import {
  AccountantDocumentReviewService,
  serverDocumentReviewStore
} from '../server/taxguard/accountantDocumentReview.service';

describe('POST /accountant/verify-evidence authorization', () => {
  const token = 'verify-evidence-test-token';
  let server: Server;
  let baseUrl: string;
  let verifyEvidence: ReturnType<typeof vi.spyOn>;

  const addUser = (id: string, role: string, tenantId: string) => {
    db.users.set(id, {
      id,
      email: `${id}@example.test`,
      name: id,
      role: role as any,
      tenantId,
      status: 'active',
      isVerified: true,
      createdAt: new Date().toISOString()
    });
  };

  const addDocument = (documentId = 'document-1', clientId = 'client-a', tenantId = 'tenant-a') => {
    db.documents.set(documentId, {
      id: documentId,
      clientId,
      taxYear: 2025,
      fileName: `${documentId}.pdf`
    } as any);
    serverDocumentReviewStore.set(documentId, {
      documentId,
      tenantId,
      clientId,
      taxYear: 2025,
      engagementId: 'eng_review_cache',
      extractedFields: [],
      version: 1
    } as any);
  };

  const assign = (
    userId: string,
    clientId: string,
    status = 'active',
    scope: { engagementId?: string; taxYear?: number } = {}
  ) => {
    const id = `assignment-${userId}-${clientId}`;
    db.clientAccountantAssignments.set(id, {
      id,
      clientId,
      clientName: clientId,
      accountantId: userId,
      accountantName: userId,
      assignmentType: 'primary',
      status,
      accessScope: [],
      assignedBy: 'admin',
      assignedByName: 'Admin',
      assignedAt: new Date().toISOString(),
      effectiveDate: new Date(Date.now() - 60_000).toISOString(),
      ...scope
    } as any);
  };

  const post = async (body: Record<string, unknown>, authenticate = true) => {
    const response = await fetch(`${baseUrl}/accountant/verify-evidence`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authenticate ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('TAXGUARD_TENANT_ID', 'tenant-a');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    addUser('staff-a', 'accountant', 'tenant-a');
    addUser('client-a', 'client', 'tenant-a');
    addUser('client-b', 'client', 'tenant-a');
    addUser('client-other', 'client', 'tenant-b');
    db.sessions.set(token, {
      userId: 'staff-a',
      role: 'accountant',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000
    });
    addDocument();
    verifyEvidence = vi.spyOn(AccountantDocumentReviewService, 'verifyEvidenceAndInvalidateDownstream')
      .mockReturnValue({ evidenceRecords: [], invalidatedStages: [] });

    const app = express();
    app.use(express.json());
    app.use(stageTwoThreeRouter);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    for (const id of ['staff-a', 'admin-a', 'admin-b', 'client-a', 'client-b', 'client-other']) {
      db.users.delete(id);
    }
    db.sessions.delete(token);
    for (const id of ['document-1', 'document-other']) {
      db.documents.delete(id);
      serverDocumentReviewStore.delete(id);
    }
    for (const id of ['assignment-staff-a-client-a', 'assignment-staff-a-client-b']) {
      db.clientAccountantAssignments.delete(id);
    }
    verifyEvidence.mockRestore();
    vi.unstubAllEnvs();
  });

  it('requires a server-authenticated staff session', async () => {
    const result = await post({ documentId: 'document-1' }, false);
    expect(result.status).toBe(401);
    db.sessions.set(token, {
      userId: 'client-a',
      role: 'client',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000
    });
    const nonStaff = await post({ documentId: 'document-1' });
    expect(nonStaff.status).toBe(403);
    expect(verifyEvidence).not.toHaveBeenCalled();
  });

  it('never returns internal error detail to the caller (generic code, server-side log only)', async () => {
    assign('staff-a', 'client-a');
    verifyEvidence.mockImplementationOnce(() => { throw new Error('relation "taxguard_synthetic_private" does not exist (host 10.0.0.5)'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await post({ documentId: 'document-1', clientId: 'client-a' });
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: 'STAGE_WORKFLOW_UNAVAILABLE', code: 'STAGE_WORKFLOW_UNAVAILABLE' });
    expect(JSON.stringify(result.body)).not.toMatch(/relation|taxguard_synthetic_private|10\.0\.0\.5/);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/taxguard_synthetic_private|10\.0\.0\.5/);
    log.mockRestore();
  });

  it('uses the persisted document owner and session tenant, ignoring caller tenant and engagement fields', async () => {
    assign('staff-a', 'client-a');
    const result = await post({
      documentId: 'document-1',
      clientId: 'client-a',
      tenantId: 'tenant-b',
      taxpayerId: 'client-b',
      engagementId: 'forged-engagement',
      ownership: { clientId: 'client-b' },
      taxYear: 1999
    });
    expect(result.status).toBe(200);
    expect(verifyEvidence).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      clientId: 'client-a',
      engagementId: 'eng_2025',
      taxYear: 2025,
      documentId: 'document-1'
    }));
  });

  it('denies a document request when the supplied clientId conflicts with its persisted owner', async () => {
    assign('staff-a', 'client-a');
    const result = await post({ documentId: 'document-1', clientId: 'client-b' });
    expect(result.status).toBe(404);
    expect(verifyEvidence).not.toHaveBeenCalled();
  });

  it('requires an active assignment to the actual document client, not a caller-selected client', async () => {
    const unassigned = await post({ documentId: 'document-1', clientId: 'client-a' });
    expect(unassigned.status).toBe(404);
    assign('staff-a', 'client-b');
    const result = await post({ documentId: 'document-1', clientId: 'client-b' });
    expect(result.status).toBe(404);
    expect(verifyEvidence).not.toHaveBeenCalled();
  });

  it('ignores a caller tenant override and operates only in the authenticated tenant', async () => {
    assign('staff-a', 'client-a');
    const result = await post({ documentId: 'document-1', tenantId: 'tenant-b', clientId: 'client-a' });
    expect(result.status).toBe(200);
    expect(verifyEvidence).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a' }));
  });

  it('returns not found for a document owned by another tenant without revealing it', async () => {
    addDocument('document-other', 'client-other', 'tenant-b');
    const result = await post({ documentId: 'document-other', clientId: 'client-other' });
    expect(result.status).toBe(404);
    expect(verifyEvidence).not.toHaveBeenCalled();
  });

  it('fails closed when the persisted document does not exist, even if a review cache entry does', async () => {
    serverDocumentReviewStore.set('document-unpersisted', {
      documentId: 'document-unpersisted',
      tenantId: 'tenant-a',
      clientId: 'client-a'
    } as any);
    const result = await post({ documentId: 'document-unpersisted', clientId: 'client-a' });
    expect(result.status).toBe(404);
    expect(verifyEvidence).not.toHaveBeenCalled();
    serverDocumentReviewStore.delete('document-unpersisted');
  });

  it('fails closed if the persisted document owner cannot be resolved', async () => {
    db.users.delete('client-a');
    const result = await post({ documentId: 'document-1', clientId: 'client-a' });
    expect(result.status).toBe(404);
    expect(verifyEvidence).not.toHaveBeenCalled();
  });

  it('fails closed if the review record owner conflicts with persisted ownership', async () => {
    serverDocumentReviewStore.set('document-1', {
      documentId: 'document-1',
      tenantId: 'tenant-a',
      clientId: 'client-b'
    } as any);
    assign('staff-a', 'client-a');
    const result = await post({ documentId: 'document-1', clientId: 'client-a' });
    expect(result.status).toBe(404);
    expect(verifyEvidence).not.toHaveBeenCalled();
  });

  it('denies a revoked staff assignment', async () => {
    assign('staff-a', 'client-a', 'revoked');
    const result = await post({ documentId: 'document-1', clientId: 'client-a' });
    expect(result.status).toBe(404);
    expect(verifyEvidence).not.toHaveBeenCalled();
  });

  it('enforces optional engagement and tax-year assignment scope against persisted document data', async () => {
    assign('staff-a', 'client-a', 'active', { engagementId: 'engagement-other', taxYear: 2024 });
    const mismatch = await post({ documentId: 'document-1' });
    expect(mismatch.status).toBe(404);
    expect(verifyEvidence).not.toHaveBeenCalled();

    const assignment = db.clientAccountantAssignments.get('assignment-staff-a-client-a') as any;
    assignment.engagementId = 'eng_2025';
    assignment.taxYear = 2025;
    const match = await post({ documentId: 'document-1' });
    expect(match.status).toBe(200);
    expect(verifyEvidence).toHaveBeenCalledOnce();
  });

  it('allows an administrator only for documents in the administrator session tenant', async () => {
    addUser('admin-a', 'admin', 'tenant-a');
    db.sessions.set(token, {
      userId: 'admin-a',
      role: 'admin',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000
    });
    const allowed = await post({ documentId: 'document-1' });
    expect(allowed.status).toBe(200);
    expect(verifyEvidence).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      clientId: 'client-a'
    }));

    addUser('admin-b', 'admin', 'tenant-b');
    db.sessions.set(token, {
      userId: 'admin-b',
      role: 'admin',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000
    });
    const denied = await post({ documentId: 'document-1' });
    expect(denied.status).toBe(403);
    expect(verifyEvidence).toHaveBeenCalledTimes(1);
  });

  /**
   * Supabase-configured path, using a stand-in that (like PostgREST) returns only the
   * selected columns. Synthetic rows only; no network.
   */
  describe('with the durable store configured', () => {
    type Row = Record<string, any>;
    let tables: Record<string, Row[]>;
    let failing: Set<string>;
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const fake = () => ({
      from(table: string) {
        const filters: [string, unknown][] = [];
        let columns: string[] | null = null;
        let limit = Infinity;
        const project = (r: Row) => (columns ? Object.fromEntries(columns.map(c => [c, r[c]])) : { ...r });
        const rows = () => (tables[table] ?? []).filter(r => filters.every(([k, v]) => r[k] === v)).slice(0, limit);
        const err = () => (failing.has(table) ? { message: 'synthetic read failure' } : null);
        const b: any = {
          select: (cols = '*') => { columns = cols.trim() === '*' ? null : cols.split(',').map(c => c.trim()); return b; },
          eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
          order: () => b,
          limit: (n: number) => { limit = n; return b; },
          maybeSingle: async () => (err() ? { data: null, error: err() } : { data: rows()[0] ? project(rows()[0]) : null, error: null }),
          then: (resolve: any, reject: any) => Promise.resolve(err() ? { data: null, error: err() } : { data: rows().map(project), error: null }).then(resolve, reject),
        };
        return b;
      },
    });
    const assignment = (patch: Row = {}) => ({ tenant_id: 'tenant-a', user_id: 'staff-a', client_id: 'client-a', engagement_id: null, tax_year: null, status: 'ACTIVE', effective_from: past, effective_to: null, ...patch });

    beforeEach(async () => {
      const { setSupabaseAdmin } = await import('../server/supabase');
      vi.stubEnv('SUPABASE_URL', 'https://synthetic-project.supabase.co');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-role');
      failing = new Set();
      tables = {
        taxguard_documents: [
          { document_id: 'document-1', tenant_id: 'tenant-a', client_id: 'client-a', engagement_id: 'eng_review_cache', tax_year: 2025, version: 1 },
          { document_id: 'document-other', tenant_id: 'tenant-b', client_id: 'client-other', engagement_id: 'eng_other', tax_year: 2025, version: 1 },
        ],
        taxguard_clients: [
          { tenant_id: 'tenant-a', client_id: 'client-a', owner_uid: 'client-a' },
          { tenant_id: 'tenant-b', client_id: 'client-other', owner_uid: 'client-other' },
        ],
        taxguard_staff_assignments: [],
      };
      setSupabaseAdmin(fake() as any);
    });
    afterEach(async () => {
      const { setSupabaseAdmin } = await import('../server/supabase');
      setSupabaseAdmin(null);
    });

    it('allows staff with an active, effective, client-wide assignment (regression: status must be selected)', async () => {
      tables.taxguard_staff_assignments = [assignment()];
      const result = await post({ documentId: 'document-1' });
      expect(result.status).toBe(200);
      expect(verifyEvidence).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', clientId: 'client-a' }));
    });

    it.each([
      ['assigned to a different client', { client_id: 'client-b' }],
      ['assignment revoked', { status: 'REVOKED' }],
      ['assignment expired', { effective_to: past }],
      ['assignment not yet effective', { effective_from: new Date(Date.now() + 86_400_000).toISOString() }],
      ['scoped to another engagement', { engagement_id: 'eng_other' }],
      ['scoped to another tax year', { tax_year: 2024 }],
      ['assigned to another staff member', { user_id: 'someone-else' }],
    ])('denies staff when %s', async (_label, patch) => {
      tables.taxguard_staff_assignments = [assignment(patch)];
      const result = await post({ documentId: 'document-1' });
      expect(result.status).toBe(404);
      expect(verifyEvidence).not.toHaveBeenCalled();
    });

    it('allows a matching engagement- and year-scoped assignment', async () => {
      tables.taxguard_staff_assignments = [assignment({ engagement_id: 'eng_review_cache', tax_year: 2025 })];
      expect((await post({ documentId: 'document-1' })).status).toBe(200);
    });

    it('never reveals or acts on a document in another tenant, even with a matching assignment row', async () => {
      tables.taxguard_staff_assignments = [assignment({ client_id: 'client-other', tenant_id: 'tenant-b' })];
      const result = await post({ documentId: 'document-other' });
      expect(result.status).toBe(404);
      expect(result.body).toEqual({ error: 'Document not found.' });
      expect(verifyEvidence).not.toHaveBeenCalled();
    });

    it('denies when the caller-selected client differs from the document owner', async () => {
      tables.taxguard_staff_assignments = [assignment(), assignment({ client_id: 'client-b' })];
      expect((await post({ documentId: 'document-1', clientId: 'client-b' })).status).toBe(404);
      expect(verifyEvidence).not.toHaveBeenCalled();
    });

    it('denies when the document owner record is missing', async () => {
      tables.taxguard_staff_assignments = [assignment()];
      tables.taxguard_clients = [];
      expect((await post({ documentId: 'document-1' })).status).toBe(404);
    });

    it.each(['taxguard_documents', 'taxguard_clients', 'taxguard_staff_assignments'])('fails closed with 503 when %s cannot be read', async table => {
      tables.taxguard_staff_assignments = [assignment()];
      failing.add(table);
      const result = await post({ documentId: 'document-1' });
      expect(result.status).toBe(503);
      expect(verifyEvidence).not.toHaveBeenCalled();
    });
  });
});
