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
});
