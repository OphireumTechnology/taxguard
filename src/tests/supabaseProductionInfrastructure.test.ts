import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  verifySupabaseAccessToken,
  isSupabaseServerConfigured,
  setSupabaseAdmin
} from '../server/supabase';
import { SupabaseDurableSessions } from '../server/supabase-db';
import { SupabaseStorageVault } from '../server/taxguard/supabaseStorage';
import { resolveApiBaseUrl } from '../config/apiEndpoint';
import { createProductionApp } from '../server/productionApp';

// Mock Supabase client for unit testing
function createMockSupabaseClient() {
  const store = {
    identities: new Map<string, any>(),
    members: new Map<string, any>(),
    clients: new Map<string, any>(),
    sessions: new Map<string, any>(),
    sequence: { current_sequence: 100, last_issued_client_id: '100' },
    audit: [] as any[],
    documents: new Map<string, any>()
  };

  const client: any = {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'valid_sb_token') {
          return {
            data: {
              user: {
                id: 'sb_user_001',
                email: 'client@example.com',
                user_metadata: { full_name: 'Jane Doe' },
                last_sign_in_at: new Date().toISOString()
              }
            },
            error: null
          };
        }
        if (token === 'no_email_token') {
          return { data: { user: { id: 'sb_user_002', email: '' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid JWT' } };
      })
    },
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(async (path: string, buffer: Buffer) => {
          return { data: { path }, error: null };
        }),
        createSignedUrl: vi.fn(async (path: string, expiresIn: number) => {
          return { data: { signedUrl: `https://storage.supabase.co/${bucket}/${path}?token=signed` }, error: null };
        })
      }))
    },
    from: vi.fn((table: string) => {
      let filterCol = '';
      let filterVal: any = null;
      let filterCol2 = '';
      let filterVal2: any = null;

      let pendingUpdates: any = null;

      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: any) => {
          if (!filterCol) {
            filterCol = col;
            filterVal = val;
          } else {
            filterCol2 = col;
            filterVal2 = val;
          }
          if (pendingUpdates && table === 'taxguard_sessions') {
            const s = store.sessions.get(val);
            if (s) Object.assign(s, pendingUpdates);
          }
          return builder;
        }),
        maybeSingle: vi.fn(async () => {
          if (table === 'taxguard_identities') {
            return { data: store.identities.get(filterVal) || null, error: null };
          }
          if (table === 'taxguard_members') {
            const member = Array.from(store.members.values()).find(
              m => m.tenant_id === filterVal && m.uid === filterVal2
            );
            return { data: member || null, error: null };
          }
          if (table === 'taxguard_client_id_sequence') {
            return { data: store.sequence, error: null };
          }
          if (table === 'taxguard_sessions') {
            return { data: store.sessions.get(filterVal) || null, error: null };
          }
          return { data: null, error: null };
        }),
        insert: vi.fn(async (row: any) => {
          if (table === 'taxguard_identities') store.identities.set(row.uid, row);
          if (table === 'taxguard_members') store.members.set(`${row.tenant_id}_${row.uid}`, row);
          if (table === 'taxguard_clients') store.clients.set(row.client_id, row);
          if (table === 'taxguard_sessions') store.sessions.set(row.session_token_hash, row);
          if (table === 'taxguard_audit_log') store.audit.push(row);
          if (table === 'taxguard_documents') store.documents.set(row.document_id, row);
          return { data: row, error: null };
        }),
        upsert: vi.fn(async (row: any) => {
          if (table === 'taxguard_client_id_sequence') {
            store.sequence = row;
          }
          return { data: row, error: null };
        }),
        update: vi.fn((updates: any) => {
          pendingUpdates = updates;
          if (filterVal && table === 'taxguard_sessions') {
            const s = store.sessions.get(filterVal);
            if (s) Object.assign(s, updates);
          }
          return builder;
        }),
        then: (resolve: any, reject?: any) => {
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
      };
      return builder;
    })
  };

  return { client, store };
}

describe('Supabase Production Infrastructure & Authority', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    setSupabaseAdmin(mockSupabase.client);
    vi.stubEnv('SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key');
    vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    setSupabaseAdmin(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('1. Server JWT Verification', () => {
    it('verifies valid Supabase token and extracts identity', async () => {
      const user = await verifySupabaseAccessToken('valid_sb_token');
      expect(user.uid).toBe('sb_user_001');
      expect(user.email).toBe('client@example.com');
      expect(user.displayName).toBe('Jane Doe');
      expect(user.authTime).toBeGreaterThan(0);
    });

    it('rejects empty or whitespace token', async () => {
      await expect(verifySupabaseAccessToken('')).rejects.toThrow('ACCESS_TOKEN_REQUIRED');
      await expect(verifySupabaseAccessToken('   ')).rejects.toThrow('ACCESS_TOKEN_REQUIRED');
    });

    it('rejects invalid or expired token', async () => {
      await expect(verifySupabaseAccessToken('invalid_token')).rejects.toThrow('INVALID_SUPABASE_TOKEN');
    });

    it('rejects token missing verified email', async () => {
      await expect(verifySupabaseAccessToken('no_email_token')).rejects.toThrow('TOKEN_EMAIL_MISSING');
    });
  });

  describe('2. Durable Sessions & Database Persistence', () => {
    it('provisions new client identity, client ID sequence, and server session', async () => {
      const sessions = new SupabaseDurableSessions(mockSupabase.client, 'tenantA');
      const verified = {
        uid: 'user_123',
        email: 'test@example.com',
        displayName: 'Test Client',
        authTime: Math.floor(Date.now() / 1000)
      };

      const result = await sessions.create(verified);
      expect(result.token).toMatch(/^tg_live_[a-f0-9]{64}$/);
      expect(result.user.role).toBe('client'); // Server-authoritative client assignment
      expect(result.user.id).toBe('user_123');
      expect(result.clientId).toBe('101'); // Incremented from 100
      expect(result.environment).toBe('live');

      // Verify stored records
      expect(mockSupabase.store.identities.has('user_123')).toBe(true);
      expect(mockSupabase.store.members.has('tenantA_user_123')).toBe(true);
      expect(mockSupabase.store.sequence.current_sequence).toBe(101);
    });

    it('verifies an active durable session and restores authenticated identity', async () => {
      const sessions = new SupabaseDurableSessions(mockSupabase.client, 'tenantA');
      const verified = {
        uid: 'user_456',
        email: 'restore@example.com',
        authTime: Math.floor(Date.now() / 1000)
      };

      const { token } = await sessions.create(verified);
      const user = await sessions.verify(token);
      expect(user).not.toBeNull();
      expect(user?.id).toBe('user_456');
      expect(user?.role).toBe('client');
    });

    it('denies expired sessions', async () => {
      const sessions = new SupabaseDurableSessions(mockSupabase.client, 'tenantA');
      const verified = {
        uid: 'user_exp',
        email: 'exp@example.com',
        authTime: Math.floor(Date.now() / 1000)
      };

      const { token } = await sessions.create(verified);
      // Manually expire session
      for (const session of mockSupabase.store.sessions.values()) {
        session.expires_at = Date.now() - 1000;
      }

      const user = await sessions.verify(token);
      expect(user).toBeNull();
    });

    it('denies revoked sessions', async () => {
      const sessions = new SupabaseDurableSessions(mockSupabase.client, 'tenantA');
      const verified = {
        uid: 'user_rev',
        email: 'rev@example.com',
        authTime: Math.floor(Date.now() / 1000)
      };

      const { token } = await sessions.create(verified);
      await sessions.revoke(token);

      const user = await sessions.verify(token);
      expect(user).toBeNull();
    });

    it('enforces tenant isolation and denies cross-tenant session verification', async () => {
      const tenantASessions = new SupabaseDurableSessions(mockSupabase.client, 'tenantA');
      const verified = {
        uid: 'user_iso',
        email: 'iso@example.com',
        authTime: Math.floor(Date.now() / 1000)
      };

      const { token } = await tenantASessions.create(verified);

      // Attempt verification from a different tenant
      const tenantBSessions = new SupabaseDurableSessions(mockSupabase.client, 'tenantB');
      const user = await tenantBSessions.verify(token);
      expect(user).toBeNull();
    });
  });

  describe('3. Supabase Storage Vault & Security Boundary', () => {
    it('fails closed with DOCUMENT_INTAKE_NOT_READY when scanner is disabled', async () => {
      vi.stubEnv('TAXGUARD_MALWARE_SCANNER_ENABLED', 'false');
      const vault = new SupabaseStorageVault(mockSupabase.client);

      await expect(
        vault.uploadQuarantinedDocument(
          {
            tenantId: 'tenantA',
            clientId: '101',
            engagementId: 'eng_2025',
            taxYear: 2025,
            caseId: 'case_2025',
            documentId: 'doc_w2',
            fileName: 'w2.pdf',
            mimeType: 'application/pdf',
            createdBy: 'user_123'
          },
          Buffer.from('fake pdf data')
        )
      ).rejects.toThrow('DOCUMENT_INTAKE_NOT_READY');
    });

    it('uploads to quarantine when scanner is commissioned', async () => {
      vi.stubEnv('TAXGUARD_MALWARE_SCANNER_ENABLED', 'true');
      const vault = new SupabaseStorageVault(mockSupabase.client);

      const meta = await vault.uploadQuarantinedDocument(
        {
          tenantId: 'tenantA',
          clientId: '101',
          engagementId: 'eng_2025',
          taxYear: 2025,
          caseId: 'case_2025',
          documentId: 'doc_w2',
          fileName: 'w2.pdf',
          mimeType: 'application/pdf',
          createdBy: 'user_123'
        },
        Buffer.from('fake pdf data')
      );

      expect(meta.status).toBe('QUARANTINED');
      expect(meta.quarantineStatus).toBe('QUARANTINED');
      expect(meta.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('builds strictly tenant-isolated storage paths', () => {
      const vault = new SupabaseStorageVault(mockSupabase.client);
      const path = vault.getStoragePath({
        tenantId: 'tenantA',
        clientId: '101',
        caseId: 'case_2025',
        documentId: 'w2',
        version: 1
      });
      expect(path).toBe('tenants/tenantA/clients/101/cases/case_2025/docs/w2_v1');
    });
  });

  describe('4. Render Production Environment & Health', () => {
    let server: Server;
    let origin: string;

    beforeEach(async () => {
      server = createServer(createProductionApp());
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    });

    it('serves health check with supabase provider', async () => {
      const res = await fetch(`${origin}/api/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('available');
      expect(body.provider).toBe('supabase');
      expect(body.documentIntakeEnabled).toBe(false);
    });

    it('enforces canonical production API origin resolution', () => {
      expect(resolveApiBaseUrl('https://api.artaxserv.com', true)).toBe('https://api.artaxserv.com');
      expect(() => resolveApiBaseUrl('https://artaxserv.com', true)).toThrow('cannot host');
    });

    it('allows CORS preflight for artaxserv.com and denies unauthorized origins', async () => {
      const preflight = await fetch(`${origin}/api/auth/supabase-session`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://artaxserv.com' }
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin')).toBe('https://artaxserv.com');

      const denied = await fetch(`${origin}/api/health`, {
        headers: { Origin: 'https://malicious.example' }
      });
      expect(denied.status).toBe(403);
    });
  });
});
