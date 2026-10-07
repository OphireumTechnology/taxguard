import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response as ExpressResponse } from 'express';
import { createProductionApp } from '../server/productionApp';
import { setSupabaseAdmin } from '../server/supabase';
import { createMockSupabaseClient } from './helpers/mockSupabase';
import { db } from '../server/db';
import {
  requireAccountantAssignment,
  resolveAuthorizedClientContext,
  type AuthenticatedRequest
} from '../server/auth';
import { SupabaseStorageVault } from '../server/taxguard/supabaseStorage';
import { globalDurableJobQueueService } from '../server/taxguard/operations/durableJobQueue.service';
import { serverDocumentReviewStore } from '../server/taxguard/accountantDocumentReview.service';
import { StageOneOnboardingService } from '../services/stageOneOnboardingService';
import { api, clearStoredToken, setStoredToken } from '../services/api';

let server: Server;
let origin: string;
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
  vi.stubEnv('SUPABASE_URL', 'https://mock.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key');
  server = createServer(createProductionApp());
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  vi.unstubAllEnvs();
});

beforeEach(() => {
  mockSupabase = createMockSupabaseClient();
  setSupabaseAdmin(mockSupabase.client);
  clearStoredToken();
  globalDurableJobQueueService.clear();
  serverDocumentReviewStore.clear();
});

function seedStaff(assignments: Array<Record<string, unknown>> = []) {
  mockSupabase.store.identities.set('sb_staff_001', {
    uid: 'sb_staff_001',
    tenant_id: 'tenantA',
    user_data: {
      id: 'sb_staff_001',
      email: 'staff@example.com',
      name: 'Assigned Staff',
      role: 'accountant',
      status: 'active'
    }
  });
  mockSupabase.store.members.set('tenantA_sb_staff_001', {
    tenant_id: 'tenantA',
    uid: 'sb_staff_001',
    role: 'accountant',
    status: 'active'
  });
  mockSupabase.store.assignments.push(...assignments.map(assignment => ({
    tenant_id: 'tenantA',
    user_id: 'sb_staff_001',
    status: 'ACTIVE',
    effective_from: new Date(Date.now() - 60_000).toISOString(),
    effective_to: null,
    ...assignment
  })));
}

function seedReviewItem(documentId: string, clientId: string, tenantId = 'tenantA') {
  serverDocumentReviewStore.set(documentId, {
    documentId,
    tenantId,
    clientId,
    clientName: clientId,
    taxYear: 2025,
    fileName: `${documentId}.pdf`,
    fileSizeBytes: 100,
    mimeType: 'application/pdf',
    sha256: 'hash',
    storagePath: `tenants/${tenantId}/clients/${clientId}/${documentId}`,
    downloadUrl: '',
    claimedCategory: 'W2',
    proposedCategory: 'W2',
    status: 'PENDING_REVIEW',
    version: 1,
    extractedFields: [],
    validationFindings: [],
    exceptions: [],
    internalNotes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as any);
}

async function login(accessToken: string) {
  const response = await fetch(`${origin}/api/auth/supabase-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://artaxserv.com' },
    body: JSON.stringify({ accessToken })
  });
  return { response, body: await response.json() };
}

function request(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${origin}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: 'https://artaxserv.com',
      ...(init.headers as Record<string, string> || {})
    }
  });
}

function guard(
  user: NonNullable<AuthenticatedRequest['user']>,
  resource: string,
  clientId?: string,
  tenantId?: string
) {
  const req = { user, ip: '127.0.0.1', get: () => 'sec-test-request' } as unknown as AuthenticatedRequest;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; }
  } as unknown as ExpressResponse & { statusCode: number; body: unknown };
  return { result: resolveAuthorizedClientContext(req, res, resource, clientId, tenantId), res };
}

describe('SEC-CLIENT-001 through SEC-CLIENT-020: client-data isolation', () => {
  it('SEC-CLIENT-001: allows Client A to read its own authoritative profile', async () => {
    const { body } = await login('valid_sb_token');
    const response = await request('/api/profile/authoritative', body.token);
    expect(response.status).toBe(200);
    expect((await response.json()).clientId).toBe(body.clientId);
  });

  it('SEC-CLIENT-002: denies Client A access to Client B profile ID', async () => {
    const a = await login('valid_sb_token');
    const b = await login('valid_sb_token_b');
    const response = await request(`/api/profile/authoritative?clientId=${b.body.clientId}`, a.body.token);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('Client B');
  });

  it('SEC-CLIENT-003: returns no document data for another client document ID', async () => {
    const a = await login('valid_sb_token');
    const response = await request('/api/documents/document-client-b', a.body.token);
    expect([403, 404, 503]).toContain(response.status);
    expect(await response.text()).not.toContain('document-client-b');
  });

  it('SEC-CLIENT-004: returns no engagement data for another client engagement ID', async () => {
    const a = await login('valid_sb_token');
    const response = await request('/api/engagements/engagement-client-b', a.body.token);
    expect([403, 404, 503]).toContain(response.status);
    expect(await response.text()).not.toContain('engagement-client-b');
  });

  it('SEC-CLIENT-005: denies a Client B Stage 01 URL scope to Client A', async () => {
    const a = await login('valid_sb_token');
    const b = await login('valid_sb_token_b');
    const response = await request(
      `/api/case-authority/tenantA/${b.body.clientId}/engagement-b/cases`,
      a.body.token
    );
    expect(response.status).toBe(403);
  });

  it('SEC-CLIENT-006: denies Client B Stage 02 questionnaire data to Client A', async () => {
    const a = await login('valid_sb_token');
    const b = await login('valid_sb_token_b');
    const response = await request(
      `/api/stage-two-three/questionnaire/2025?clientId=${b.body.clientId}`,
      a.body.token
    );
    expect(response.status).toBe(403);
  });

  it('SEC-CLIENT-007: rejects a manipulated clientId in a case URL', async () => {
    const a = await login('valid_sb_token');
    const response = await request('/api/case-authority/tenantA/client-b/engagement-b/cases', a.body.token);
    expect(response.status).toBe(403);
  });

  it('SEC-CLIENT-008: rejects a manipulated request-body clientId', async () => {
    const a = await login('valid_sb_token');
    const response = await request('/api/stage-two-three/questionnaire/2025', a.body.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'client-b', answers: {} })
    });
    expect(response.status).toBe(403);
  });

  it('SEC-CLIENT-009: rejects a manipulated query-string clientId', async () => {
    const a = await login('valid_sb_token');
    const response = await request('/api/stage-two-three/requirements/2025?clientId=client-b', a.body.token);
    expect(response.status).toBe(403);
  });

  it('SEC-CLIENT-010: clears Client A Stage 01 state on logout/session change', () => {
    const values = new Map<string, string>([
      ['artax_stage_one_dossier_client-a', 'A'],
      ['artax_active_onboarding_client_id', 'client-a']
    ]);
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        get length() { return values.size; },
        key(index: number) { return Array.from(values.keys())[index] || null; },
        removeItem(key: string) { values.delete(key); }
      }
    });
    StageOneOnboardingService.clearSensitiveClientData();
    expect(values.size).toBe(0);
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('SEC-CLIENT-011: clears Client A Stage 02/03 document cache and sync queue', () => {
    const values = new Map<string, string>([
      ['artax_stage2_client-a', 'A'],
      ['artax_stage3_client-a', 'A'],
      ['ar_tax_client_sync_queue_v1', 'A']
    ]);
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        get length() { return values.size; },
        key(index: number) { return Array.from(values.keys())[index] || null; },
        removeItem(key: string) { values.delete(key); }
      }
    });
    StageOneOnboardingService.clearSensitiveClientData();
    expect(values.size).toBe(0);
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('SEC-CLIENT-012: uses a new session token after identity transition instead of retaining Client A', () => {
    const storage = () => {
      const values = new Map<string, string>();
      return {
        getItem: (key: string) => values.get(key) || null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => { values.delete(key); }
      };
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
    setStoredToken('session-client-a');
    setStoredToken('session-client-b');
    expect(localStorage.getItem('artax_session_token')).toBe('session-client-b');
    expect(sessionStorage.getItem('artax_session_token')).toBe('session-client-b');
    delete (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  });

  it('SEC-CLIENT-013: fails closed when the authenticated client ownership mapping is missing', async () => {
    const a = await login('valid_sb_token');
    mockSupabase.store.clients.clear();
    expect((await request('/api/auth/me', a.body.token)).status).toBe(401);
  });

  it('SEC-CLIENT-014: fails closed on identity-store errors instead of consulting in-memory users', async () => {
    const failingClient: any = {
      from: () => ({
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: null, error: new Error('database unavailable') })
      })
    };
    const { SupabaseDurableSessions } = await import('../server/supabase-db');
    await expect(
      new SupabaseDurableSessions(failingClient, 'tenantA').create({
        uid: 'unmapped-user',
        email: 'unmapped@example.com',
        displayName: 'Unmapped',
        authTime: Math.floor(Date.now() / 1000)
      })
    ).rejects.toMatchObject({ status: 503 });
  });

  it('SEC-CLIENT-015: production session provisioning does not bind an email to a seeded client', async () => {
    const seededUser = Array.from(db.users.values()).find(
      user => user.email?.toLowerCase() === 'm.perotti@example.com'
    );
    expect(seededUser).toBeDefined();
    const { body, response } = await login('seed_email_token');
    expect(response.status).toBe(200);
    expect(body.clientId).toBeTruthy();
    expect(body.user.role).toBe('client');
    expect(body.user.clientId).toBe(body.clientId);
    expect(body.clientId).not.toBe(seededUser?.clientId);
    expect(body.user.name).not.toBe(seededUser?.name);
  });

  it('SEC-CLIENT-016: staff access requires a persisted active client assignment', async () => {
    const a = await login('valid_sb_token');
    const b = await login('valid_sb_token_b');
    mockSupabase.store.identities.set('sb_staff_001', {
      uid: 'sb_staff_001',
      tenant_id: 'tenantA',
      user_data: {
        id: 'sb_staff_001',
        email: 'staff@example.com',
        name: 'Assigned Staff',
        role: 'accountant',
        status: 'active'
      }
    });
    mockSupabase.store.members.set('tenantA_sb_staff_001', {
      tenant_id: 'tenantA',
      uid: 'sb_staff_001',
      role: 'accountant',
      status: 'active'
    });
    mockSupabase.store.assignments.push({
      tenant_id: 'tenantA',
      client_id: a.body.clientId,
      user_id: 'sb_staff_001',
      status: 'ACTIVE',
      effective_from: new Date(Date.now() - 60_000).toISOString(),
      effective_to: null
    });
    const staff = await login('valid_staff_token');
    expect(staff.response.status).toBe(200);
    expect((await request(`/api/profile/authoritative?clientId=${a.body.clientId}`, staff.body.token)).status).toBe(200);
    expect((await request(`/api/profile/authoritative?clientId=${b.body.clientId}`, staff.body.token)).status).toBe(403);
  });

  it('uses durable client authorization for accountant middleware and constrains administrators to their tenant', () => {
    const authorize = (user: any, clientId: string) => {
      const req = {
        user,
        params: { clientId },
        query: {},
        body: {},
        ip: '127.0.0.1'
      } as unknown as AuthenticatedRequest;
      const res = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this; },
        json() { return this; }
      } as any;
      const next = vi.fn();
      requireAccountantAssignment(req, res, next);
      return { res, next };
    };

    const assigned = authorize({
      id: 'staff-1',
      role: 'accountant',
      tenantId: 'tenantA',
      authorizedClientIds: ['client-assigned']
    }, 'client-assigned');
    expect(assigned.next).toHaveBeenCalledOnce();

    const unassigned = authorize({
      id: 'staff-1',
      role: 'accountant',
      tenantId: 'tenantA',
      authorizedClientIds: []
    }, 'client-unassigned');
    expect(unassigned.next).not.toHaveBeenCalled();
    expect(unassigned.res.statusCode).toBe(403);

    const wrongTenantAdmin = authorize({
      id: 'admin-1',
      role: 'admin',
      tenantId: 'tenantB'
    }, 'client-any');
    expect(wrongTenantAdmin.next).not.toHaveBeenCalled();
    expect(wrongTenantAdmin.res.statusCode).toBe(403);
  });

  it('SEC-CLIENT-021: a client job listing without clientId is scoped to its authenticated client', async () => {
    const a = await login('valid_sb_token');
    const b = await login('valid_sb_token_b');
    await globalDurableJobQueueService.enqueue({
      tenantId: 'tenantA',
      clientId: a.body.clientId,
      jobType: 'DOCUMENT_PROCESSING',
      payload: { marker: 'client-a-job' }
    });
    await globalDurableJobQueueService.enqueue({
      tenantId: 'tenantA',
      clientId: b.body.clientId,
      jobType: 'DOCUMENT_PROCESSING',
      payload: { marker: 'client-b-job' }
    });

    const response = await request('/api/operations/jobs', a.body.token);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.total).toBe(1);
    expect(result.jobs.map((job: any) => job.clientId)).toEqual([a.body.clientId]);
    expect(JSON.stringify(result)).toContain('client-a-job');
    expect(JSON.stringify(result)).not.toContain('client-b-job');
  });

  it('SEC-CLIENT-022: a client cannot expand a job listing with a manipulated clientId', async () => {
    const a = await login('valid_sb_token');
    const b = await login('valid_sb_token_b');
    await globalDurableJobQueueService.enqueue({
      tenantId: 'tenantA',
      clientId: a.body.clientId,
      jobType: 'DOCUMENT_PROCESSING',
      payload: { marker: 'client-a-job' }
    });
    await globalDurableJobQueueService.enqueue({
      tenantId: 'tenantA',
      clientId: b.body.clientId,
      jobType: 'DOCUMENT_PROCESSING',
      payload: { marker: 'client-b-job' }
    });

    const response = await request(`/api/operations/jobs?clientId=${b.body.clientId}`, a.body.token);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('client-b-job');
  });

  it('SEC-CLIENT-022a: staff cancellation only returns jobs for an active assignment', async () => {
    const a = await login('valid_sb_token');
    const assignedJob = await globalDurableJobQueueService.enqueue({
      tenantId: 'tenantA',
      clientId: a.body.clientId,
      jobType: 'DOCUMENT_PROCESSING',
      payload: { marker: 'assigned-job' }
    });
    seedStaff([{ client_id: a.body.clientId }]);
    const assignedStaff = await login('valid_staff_token');
    const allowed = await request(`/api/operations/jobs/${assignedJob.id}/cancel`, assignedStaff.body.token, {
      method: 'POST'
    });
    expect(allowed.status).toBe(200);
    expect(JSON.stringify(await allowed.json())).toContain('assigned-job');

    const unassignedJob = await globalDurableJobQueueService.enqueue({
      tenantId: 'tenantA',
      clientId: a.body.clientId,
      jobType: 'DOCUMENT_PROCESSING',
      payload: { marker: 'unassigned-job' }
    });
    mockSupabase.store.assignments.length = 0;
    seedStaff();
    const unassignedStaff = await login('valid_staff_token');
    const denied = await request(`/api/operations/jobs/${unassignedJob.id}/cancel`, unassignedStaff.body.token, {
      method: 'POST'
    });
    expect(denied.status).toBe(403);
    expect(await denied.text()).not.toContain('unassigned-job');
  });

  it('SEC-CLIENT-023: an accountant needs an active assignment for each Stage 02 review client', async () => {
    const a = await login('valid_sb_token');
    const b = await login('valid_sb_token_b');
    seedReviewItem('review-a', a.body.clientId);
    seedReviewItem('review-b', b.body.clientId);
    seedStaff([{ client_id: a.body.clientId }]);
    const staff = await login('valid_staff_token');

    const ownQueue = await request(
      `/api/stage-two-three/accountant/review-queue?clientId=${a.body.clientId}`,
      staff.body.token
    );
    expect(ownQueue.status).toBe(200);
    expect((await ownQueue.json()).items.map((item: any) => item.documentId)).toEqual(['review-a']);
    expect((await request(
      `/api/stage-two-three/accountant/review-item/review-a`,
      staff.body.token
    )).status).toBe(200);
    expect((await request('/api/stage-two-three/accountant/review-action', staff.body.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: 'review-a', expectedVersion: 1, action: 'CLAIM' })
    })).status).toBe(200);

    expect((await request(
      `/api/stage-two-three/accountant/review-queue?clientId=${b.body.clientId}`,
      staff.body.token
    )).status).toBe(403);
    expect((await request(
      '/api/stage-two-three/accountant/review-item/review-b',
      staff.body.token
    )).status).toBe(403);
    expect((await request('/api/stage-two-three/accountant/review-action', staff.body.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: 'review-b', expectedVersion: 1, action: 'CLAIM' })
    })).status).toBe(403);
  });

  it.each(['unassigned', 'INACTIVE', 'REASSIGNED', 'cross-tenant'])(
    'SEC-CLIENT-024: denies Stage 02 review queue access for %s assignments',
    async (assignmentState) => {
      const a = await login('valid_sb_token');
      seedReviewItem('review-a', a.body.clientId);
      if (assignmentState === 'unassigned') {
        seedStaff();
      } else if (assignmentState === 'cross-tenant') {
        seedStaff([{ tenant_id: 'tenantB', client_id: a.body.clientId }]);
      } else {
        seedStaff([{ client_id: a.body.clientId, status: assignmentState }]);
      }
      const staff = await login('valid_staff_token');
      const response = await request(
        `/api/stage-two-three/accountant/review-queue?clientId=${a.body.clientId}`,
        staff.body.token
      );
      expect(response.status).toBe(403);
    }
  );

  it('SEC-CLIENT-025: requires non-administrator staff to select an assigned Stage 02 review client', async () => {
    seedStaff();
    const staff = await login('valid_staff_token');
    const response = await request('/api/stage-two-three/accountant/review-queue', staff.body.token);
    expect(response.status).toBe(403);
  });

  it('SEC-CLIENT-017: signed storage URLs require matching owner and safe lifecycle metadata', async () => {
    const document = {
      tenant_id: 'tenantA',
      client_id: 'client-a',
      document_id: 'doc-a',
      case_id: 'case-a',
      version: 1,
      status: 'VERIFIED',
      quarantine_status: 'CLEAN',
      storage_path: 'tenants/tenantA/clients/client-a/cases/case-a/docs/doc-a_v1'
    };
    const client: any = {
      from: () => ({
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: document, error: null })
      }),
      storage: { from: () => ({ createSignedUrl: vi.fn(async (path: string) => ({ data: { signedUrl: `https://signed/${path}` }, error: null })) }) }
    };
    const vault = new SupabaseStorageVault(client);
    await expect(vault.getSignedDownloadUrl({
      tenantId: 'tenantA',
      clientId: 'client-b',
      documentId: 'doc-a'
    })).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
    await expect(vault.getSignedDownloadUrl({
      tenantId: 'tenantA',
      clientId: 'client-a',
      documentId: 'doc-a'
    })).resolves.toContain('/clients/client-a/');
  });

  it('SEC-CLIENT-018: rejects a late API response after the stored auth token changes', async () => {
    setStoredToken('client-a-token');
    let resolveResponse!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveResponse = resolve; })));
    const pending = api.profile.getAuthoritative();
    setStoredToken('client-b-token');
    resolveResponse(new globalThis.Response(JSON.stringify({ clientId: 'client-a' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    vi.unstubAllGlobals();
  });

  it('SEC-CLIENT-019: denies cross-tenant resource selection', () => {
    const client = { id: 'client-a-user', clientId: 'client-a', tenantId: 'tenantA', role: 'client' } as any;
    const { result, res } = guard(client, 'documents', 'client-a', 'tenantB');
    expect(result).toBeNull();
    expect(res.statusCode).toBe(403);
  });

  it('SEC-CLIENT-020: audits authorization denials without logging caller-controlled identifiers or sensitive data', () => {
    const req = {
      user: { id: 'client-a-user', clientId: 'client-a', tenantId: 'tenantA', role: 'client' },
      ip: '127.0.0.1',
      get: (name: string) => ({
        'x-request-id': '123-45-6789\r\nseverity=critical',
        'x-correlation-id': 'Bearer taxpayer-sensitive-token'
      } as Record<string, string>)[name.toLowerCase()]
    } as unknown as AuthenticatedRequest;
    const res = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json() { return this; }
    } as unknown as ExpressResponse & { statusCode: number };
    resolveAuthorizedClientContext(req, res, 'tax_documents', 'client-b');
    const event = db.securityEvents[0];

    expect(event).toMatchObject({
      userId: 'client-a-user',
      resourceType: 'tax_documents',
      authorizationResult: 'denied'
    });
    expect(event.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.stringify(event)).not.toContain('123-45-6789');
    expect(JSON.stringify(event)).not.toContain('taxpayer-sensitive-token');
    expect(JSON.stringify(event)).not.toContain('severity=critical');
  });

});
