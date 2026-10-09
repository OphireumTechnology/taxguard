import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  verifySupabaseAccessToken,
  isSupabaseServerConfigured,
  setSupabaseAdmin
} from '../server/supabase';
import { SupabaseDurableSessions } from '../server/supabase-db';
import { resolveAuthorizedClientContext } from '../server/auth';
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
    documents: new Map<string, any>(),
    assignments: [] as any[]
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
      const filters: Array<[string, any]> = [];

      let pendingUpdates: any = null;

      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: any) => {
          filters.push([col, val]);
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
          if (table === 'taxguard_clients') {
            const client = Array.from(store.clients.values()).find(
              row => row.tenant_id === filterVal && row.owner_uid === filterVal2
            );
            return { data: client || null, error: null };
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
          if (table === 'taxguard_staff_assignments') {
            const data = store.assignments.filter(row =>
              filters.every(([column, value]) => row[column] === value)
            );
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          }
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

    it('authorizes only active assignments whose effective dates include the current instant', async () => {
      const sessions = new SupabaseDurableSessions(mockSupabase.client, 'tenantA');
      const { token } = await sessions.create({
        uid: 'staff_assignments',
        email: 'staff@example.com',
        authTime: Math.floor(Date.now() / 1000)
      });
      mockSupabase.store.identities.get('staff_assignments').user_data.role = 'accountant';
      mockSupabase.store.members.get('tenantA_staff_assignments').role = 'accountant';

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const assignment = (
        clientId: string,
        fields: Record<string, unknown> = {}
      ) => ({
        tenant_id: 'tenantA',
        user_id: 'staff_assignments',
        client_id: clientId,
        status: 'ACTIVE',
        effective_from: new Date(now - 1).toISOString(),
        effective_to: null,
        ...fields
      });
      mockSupabase.store.assignments.push(
        assignment('client-starts-now', { effective_from: new Date(now).toISOString() }),
        assignment('client-open-ended'),
        assignment('client-starts-later', { effective_from: new Date(now + 1).toISOString() }),
        assignment('client-expired', { effective_to: new Date(now - 1).toISOString() }),
        assignment('client-ends-now', { effective_to: new Date(now).toISOString() }),
        assignment('client-engagement-scoped', { engagement_id: 'engagement-1', tax_year: 2025 }),
        assignment('client-reassigned', { status: 'REASSIGNED' }),
        assignment('client-revoked', { status: 'REVOKED' }),
        assignment('client-wrong-tenant', { tenant_id: 'tenantB' }),
        assignment('client-wrong-user', { user_id: 'another-staff' })
      );

      const user = await sessions.verify(token);
      expect(user?.authorizedClientIds).toEqual(['client-starts-now', 'client-open-ended']);
      expect(resolveAuthorizedClientContext(
        { user } as any,
        { status: vi.fn().mockReturnThis(), json: vi.fn() } as any,
        'test_resource',
        'client-ends-now',
        'tenantA'
      )).toBeNull();
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

  describe('5. Supabase Production Migrations — RLS UUID/VARCHAR Type Compatibility & Security Audit', () => {
    const migrationsDir = `${process.cwd()}/supabase/migrations`;
    const coreMigrationFile = '20260928000000_taxguard_core_schema.sql';
    const lifecycleMigrationFile = '20260929000000_taxguard_complete_lifecycle_schema.sql';
    const bookkeepingMigrationFile = '20260930000000_taxguard_bookkeeping_schema.sql';
    const practiceOperationsMigrationFile = '20261001000000_taxguard_practice_operations_schema.sql';
    const storageGovernanceMigrationFile = '20261002000000_taxguard_storage_and_assignment_governance.sql';
    const privateStorageMigrationFile = '20261004000000_taxguard_private_storage_client_scope.sql';

    it('maintains strict migration sequence with 20260928000000 first, 20260929000000 second, and 20260930000000 third', async () => {
      const fs = await import('node:fs');
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      expect(files).toEqual([
        coreMigrationFile,
        lifecycleMigrationFile,
        bookkeepingMigrationFile,
        practiceOperationsMigrationFile,
        storageGovernanceMigrationFile,
        privateStorageMigrationFile,
        '20261008000000_taxguard_ai_registry_foundation.sql',
        '20261008010000_taxguard_ai_governance_decisions.sql',
        '20261008020000_taxguard_ai_orchestration_history.sql',
        '20261008030000_taxguard_ai_gateway_admission.sql',
        '20261008040000_taxguard_ai_capability_execution.sql',
        '20261008050000_taxguard_ai_execution_ledger.sql',
        '20261008060000_taxguard_ai_document_advisory_routing.sql',
      ]);
    });

    it('keeps vault access owner-scoped and makes staff assignment changes durable and atomic', async () => {
      const fs = await import('node:fs');
      const sql = fs.readFileSync(`${migrationsDir}/${privateStorageMigrationFile}`, 'utf8');
      expect(sql).toContain("VALUES ('taxguard-vault', 'taxguard-vault', false)");
      expect(sql).toContain("c.owner_uid = auth.uid()::text");
      expect(sql).toContain("tc.client_uid = auth.uid()::text");
      expect(sql).toContain('CREATE POLICY taxguard_vault_authenticated_select_scope');
      expect(sql).toContain('AS RESTRICTIVE FOR SELECT TO authenticated');
      expect(sql).toContain("bucket_id <> 'taxguard-vault'");
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.taxguard_assign_staff');
      expect(sql).toContain('SET search_path = pg_catalog');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('INSERT INTO public.taxguard_assignment_history');
      expect(sql).toContain('FROM PUBLIC, anon, authenticated');
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.taxguard_assign_staff');
      expect(sql).toContain('TO service_role');
      expect(sql).not.toContain('REVOKE INSERT, UPDATE, DELETE ON storage.objects');
    });

    it('prevents an unrelated permissive storage policy from expanding authenticated vault access', async () => {
      const fs = await import('node:fs');
      const { PGlite } = await import('@electric-sql/pglite');
      const migration = fs.readFileSync(`${migrationsDir}/${privateStorageMigrationFile}`, 'utf8');
      const storageMigration = migration.split('CREATE OR REPLACE FUNCTION public.taxguard_assign_staff')[0];
      const pg = new PGlite();
      try {
        await pg.exec(`
          CREATE ROLE authenticated NOLOGIN;
          CREATE ROLE service_role NOLOGIN;
          CREATE SCHEMA auth;
          CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql STABLE AS $$
            SELECT current_setting('request.jwt.claim.sub', true);
          $$;
          CREATE SCHEMA storage;
          CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL);
          CREATE TABLE storage.objects (
            id text PRIMARY KEY,
            bucket_id text NOT NULL,
            name text NOT NULL
          );
          CREATE TABLE public.taxguard_clients (
            tenant_id text NOT NULL,
            client_id text NOT NULL,
            owner_uid text NOT NULL
          );
          CREATE TABLE public.taxguard_cases (
            tenant_id text NOT NULL,
            client_id text NOT NULL,
            case_id text NOT NULL,
            client_uid text NOT NULL
          );
          ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
          GRANT USAGE ON SCHEMA storage, auth TO authenticated;
          GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
          GRANT SELECT ON public.taxguard_clients, public.taxguard_cases TO authenticated;
          INSERT INTO public.taxguard_clients VALUES
            ('tenantA', 'client-a', 'uid-a'),
            ('tenantA', 'client-b', 'uid-b'),
            ('tenantB', 'client-c', 'uid-c');
          INSERT INTO public.taxguard_cases VALUES
            ('tenantA', 'client-a', 'case-a', 'uid-a'),
            ('tenantA', 'client-b', 'case-b', 'uid-b'),
            ('tenantB', 'client-c', 'case-c', 'uid-c');
          INSERT INTO storage.objects VALUES
            ('object-a', 'taxguard-vault', 'tenants/tenantA/clients/client-a/cases/case-a/docs/a.pdf'),
            ('object-b', 'taxguard-vault', 'tenants/tenantA/clients/client-b/cases/case-b/docs/b.pdf'),
            ('object-c', 'taxguard-vault', 'tenants/tenantB/clients/client-c/cases/case-c/docs/c.pdf');
          CREATE POLICY unrelated_permissive_storage_access
            ON storage.objects FOR ALL TO authenticated
            USING (true) WITH CHECK (true);
        `);

        await pg.exec(storageMigration);
        await pg.exec(storageMigration);
        await pg.exec(`
          BEGIN;
          SET LOCAL ROLE authenticated;
          SET LOCAL request.jwt.claim.sub = 'uid-a';
        `);
        const visible = await pg.query<{ id: string }>(
          "SELECT id FROM storage.objects WHERE bucket_id = 'taxguard-vault' ORDER BY id;"
        );
        expect(visible.rows).toEqual([{ id: 'object-a' }]);
        await pg.exec('COMMIT;');

        await pg.exec(`
          BEGIN;
          SET LOCAL ROLE authenticated;
          SET LOCAL request.jwt.claim.sub = 'uid-a';
        `);
        await expect(pg.query(
          "INSERT INTO storage.objects VALUES ('object-new', 'taxguard-vault', 'tenants/tenantA/clients/client-a/cases/case-a/docs/new.pdf');"
        )).rejects.toThrow();
        await pg.exec('ROLLBACK;');

        await pg.exec(`
          BEGIN;
          SET LOCAL ROLE authenticated;
          SET LOCAL request.jwt.claim.sub = 'uid-a';
        `);
        const updated = await pg.query(
          "UPDATE storage.objects SET name = 'tampered' WHERE id = 'object-b';"
        );
        const deleted = await pg.query(
          "DELETE FROM storage.objects WHERE id = 'object-b';"
        );
        expect(updated.rowCount).toBe(0);
        expect(deleted.rowCount).toBe(0);
        await pg.exec('COMMIT;');
      } finally {
        await pg.close();
      }
    }, 30000);

    it('compiles the assignment RPC with a safe search path and service-role-only execution', async () => {
      const fs = await import('node:fs');
      const { PGlite } = await import('@electric-sql/pglite');
      const migration = fs.readFileSync(`${migrationsDir}/${privateStorageMigrationFile}`, 'utf8');
      const rpcSql = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.taxguard_assign_staff'));
      const pg = new PGlite();
      try {
        await pg.exec(`
          CREATE ROLE anon NOLOGIN;
          CREATE ROLE authenticated NOLOGIN;
          CREATE ROLE service_role NOLOGIN;
          CREATE TABLE public.taxguard_staff_assignments (
            id varchar(128) PRIMARY KEY,
            tenant_id varchar(128) NOT NULL,
            client_id varchar(64) NOT NULL,
            engagement_id varchar(128),
            tax_year integer,
            role varchar(64) NOT NULL,
            user_id varchar(128) NOT NULL,
            assigned_by varchar(128) NOT NULL,
            effective_from timestamptz NOT NULL,
            effective_to timestamptz,
            status varchar(32) NOT NULL,
            created_at timestamptz NOT NULL,
            updated_at timestamptz NOT NULL
          );
          CREATE TABLE public.taxguard_clients (
            tenant_id varchar(128) NOT NULL,
            client_id varchar(64) NOT NULL,
            status varchar(32) NOT NULL
          );
          CREATE TABLE public.taxguard_members (
            tenant_id varchar(128) NOT NULL,
            uid varchar(128) NOT NULL,
            status varchar(32) NOT NULL,
            role varchar(64) NOT NULL
          );
          CREATE TABLE public.taxguard_assignment_history (
            tenant_id varchar(128) NOT NULL,
            client_id varchar(64) NOT NULL,
            role varchar(64) NOT NULL,
            previous_user_id varchar(128),
            new_user_id varchar(128) NOT NULL,
            changed_by varchar(128) NOT NULL,
            reassignment_reason text NOT NULL
          );
        `);
        await pg.exec(rpcSql);
        const privileges = await pg.query<{ service_role_can_execute: boolean; authenticated_can_execute: boolean; function_config: string[] }>(`
          SELECT
            has_function_privilege('service_role', 'public.taxguard_assign_staff(varchar,varchar,varchar,integer,varchar,varchar,varchar,text)', 'EXECUTE') AS service_role_can_execute,
            has_function_privilege('authenticated', 'public.taxguard_assign_staff(varchar,varchar,varchar,integer,varchar,varchar,varchar,text)', 'EXECUTE') AS authenticated_can_execute,
            proconfig AS function_config
          FROM pg_proc
          WHERE oid = 'public.taxguard_assign_staff(varchar,varchar,varchar,integer,varchar,varchar,varchar,text)'::regprocedure;
        `);
        expect(privileges.rows).toEqual([{
          service_role_can_execute: true,
          authenticated_can_execute: false,
          function_config: ['search_path=pg_catalog']
        }]);
      } finally {
        await pg.close();
      }
    }, 30000);

    it('ensures zero uncast auth.uid() comparisons against VARCHAR/TEXT identity columns (prevents SQLSTATE 42883)', async () => {
      const fs = await import('node:fs');
      const coreSql = fs.readFileSync(`${migrationsDir}/${coreMigrationFile}`, 'utf8');
      const lifecycleSql = fs.readFileSync(`${migrationsDir}/${lifecycleMigrationFile}`, 'utf8');

      for (const [fileName, sql] of [
        [coreMigrationFile, coreSql],
        [lifecycleMigrationFile, lifecycleSql]
      ] as const) {
        // Every occurrence of auth.uid() must be explicitly cast to ::text
        const allAuthUidMatches: string[] = sql.match(/auth\.uid\(\)(::text)?/g) ?? [];
        expect(allAuthUidMatches.length, `Expected auth.uid() usages in ${fileName}`).toBeGreaterThan(0);

        for (const match of allAuthUidMatches) {
          expect(match, `Uncast auth.uid() found in ${fileName}`).toBe('auth.uid()::text');
        }

        // Explicitly forbid bare `= auth.uid()` without `::text`
        expect(sql).not.toMatch(/=\s*auth\.uid\(\)(?!::text)/);
      }
    });

    it('executes both migrations sequentially against a clean schema and verifies PostgreSQL type compatibility and idempotency on retry', async () => {
      const fs = await import('node:fs');
      const coreSql = fs.readFileSync(`${migrationsDir}/${coreMigrationFile}`, 'utf8');
      const lifecycleSql = fs.readFileSync(`${migrationsDir}/${lifecycleMigrationFile}`, 'utf8');

      interface TableCatalog {
        columns: Map<string, string>;
        rlsEnabled: boolean;
        policies: Map<string, { role: string; command: string; usingExpr: string }>;
      }

      const catalog = new Map<string, TableCatalog>();

      const executeMigrationInCatalog = (sql: string) => {
        // 1. Parse CREATE TABLE IF NOT EXISTS
        const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/g;
        let tableMatch: RegExpExecArray | null;
        while ((tableMatch = tableRegex.exec(sql)) !== null) {
          const tableName = tableMatch[1];
          const body = tableMatch[2];
          if (!catalog.has(tableName)) {
            const columns = new Map<string, string>();
            const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
            for (const line of lines) {
              if (line.startsWith('CONSTRAINT') || line.startsWith('--')) continue;
              const colMatch = line.match(/^(\w+)\s+([A-Z0-9_()]+)/i);
              if (colMatch) {
                columns.set(colMatch[1], colMatch[2].toUpperCase());
              }
              const fkMatch = line.match(/REFERENCES\s+(\w+)\((\w+)\)/i);
              if (fkMatch && colMatch) {
                const refTable = catalog.get(fkMatch[1]);
                expect(refTable, `Foreign key target table ${fkMatch[1]} must exist before ${tableName}`).toBeDefined();
                const refColType = refTable?.columns.get(fkMatch[2]);
                expect(refColType, `Foreign key column type on ${fkMatch[1]}.${fkMatch[2]}`).toBe(colMatch[2].toUpperCase());
              }
            }
            catalog.set(tableName, {
              columns,
              rlsEnabled: false,
              policies: new Map()
            });
          }
        }

        // 2. Parse ALTER TABLE ... ENABLE ROW LEVEL SECURITY
        const rlsRegex = /ALTER\s+TABLE\s+(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/g;
        let rlsMatch: RegExpExecArray | null;
        while ((rlsMatch = rlsRegex.exec(sql)) !== null) {
          const table = catalog.get(rlsMatch[1]);
          expect(table, `Table ${rlsMatch[1]} must exist before enabling RLS`).toBeDefined();
          if (table) table.rlsEnabled = true;
        }

        // 3. Parse DROP POLICY IF EXISTS and CREATE POLICY sequentially
        const policyStmtRegex = /(DROP\s+POLICY\s+IF\s+EXISTS\s+(\w+)\s+ON\s+(\w+);)|(CREATE\s+POLICY\s+(\w+)\s+ON\s+(\w+)\s+FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\s+TO\s+(\w+)\s+USING\s*\(([\s\S]*?)\)(?:\s+WITH\s+CHECK\s*\([\s\S]*?\))?;)/g;
        let stmtMatch: RegExpExecArray | null;
        while ((stmtMatch = policyStmtRegex.exec(sql)) !== null) {
          if (stmtMatch[1]) {
            const policyName = stmtMatch[2];
            const tableName = stmtMatch[3];
            const table = catalog.get(tableName);
            expect(table, `Table ${tableName} must exist for DROP POLICY ${policyName}`).toBeDefined();
            table?.policies.delete(policyName);
          } else if (stmtMatch[4]) {
            const policyName = stmtMatch[5];
            const tableName = stmtMatch[6];
            const command = stmtMatch[7];
            const role = stmtMatch[8];
            const usingExpr = stmtMatch[9].trim();

            const table = catalog.get(tableName);
            expect(table, `Table ${tableName} must exist for CREATE POLICY ${policyName}`).toBeDefined();
            // Non-idempotent guard: policy must not already exist when CREATE POLICY runs
            expect(
              table?.policies.has(policyName),
              `Policy ${policyName} on ${tableName} was not dropped before CREATE POLICY (non-idempotent retry hazard)`
            ).toBe(false);

            // Type-check every equality comparison in USING expression
            const comparisonRegex = /(?:(\w+)\.)?(\w+)\s*=\s*(auth\.uid\(\)(?:::text)?)/g;
            let compMatch: RegExpExecArray | null;
            while ((compMatch = comparisonRegex.exec(usingExpr)) !== null) {
              const alias = compMatch[1];
              const colName = compMatch[2];
              const rhs = compMatch[3];

              const targetTable = alias === 'c' ? catalog.get('taxguard_cases') : table;
              expect(targetTable).toBeDefined();
              const colType = targetTable?.columns.get(colName);
              expect(colType, `Column ${colName} must exist on target table for policy ${policyName}`).toBeDefined();

              // In PostgreSQL, VARCHAR(n) / TEXT columns require auth.uid()::text, whereas UUID requires auth.uid()
              if (colType?.startsWith('VARCHAR') || colType === 'TEXT') {
                expect(
                  rhs,
                  `Type mismatch on ${tableName}.${policyName}: column ${colName} (${colType}) compared with ${rhs}`
                ).toBe('auth.uid()::text');
              }
            }

            table?.policies.set(policyName, { role, command, usingExpr });
          }
        }
      };

      // First run on clean schema
      executeMigrationInCatalog(coreSql);
      executeMigrationInCatalog(lifecycleSql);

      // Verify all 31 tables exist and have RLS enabled
      expect(catalog.size).toBe(31);
      for (const [tableName, tableInfo] of catalog.entries()) {
        expect(tableInfo.rlsEnabled, `RLS must be enabled on ${tableName}`).toBe(true);
        // Every table must have a service_role policy
        const hasServiceRole = Array.from(tableInfo.policies.values()).some(p => p.role === 'service_role');
        expect(hasServiceRole, `Table ${tableName} must have service_role authority policy`).toBe(true);
      }

      // Second run (simulating retry after partial execution) must succeed without duplicate policy errors
      expect(() => {
        executeMigrationInCatalog(coreSql);
        executeMigrationInCatalog(lifecycleSql);
      }).not.toThrow();
    });

    it('enforces all 10 RLS security invariants across both migrations without weakening tenant isolation', async () => {
      const fs = await import('node:fs');
      const coreSql = fs.readFileSync(`${migrationsDir}/${coreMigrationFile}`, 'utf8');
      const lifecycleSql = fs.readFileSync(`${migrationsDir}/${lifecycleMigrationFile}`, 'utf8');
      const combinedSql = `${coreSql}\n${lifecycleSql}`;

      // 1. Authenticated policies never use USING (true)
      const authPolicyMatches: string[] =
        combinedSql.match(/CREATE\s+POLICY\s+\w+\s+ON\s+\w+\s+FOR\s+\w+\s+TO\s+authenticated\s+USING\s*\(([\s\S]*?)\);/g) ?? [];
      expect(authPolicyMatches.length).toBe(14); // 5 in core + 9 in lifecycle

      for (const policySql of authPolicyMatches) {
        expect(policySql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
        // 2. Authenticated policies are strictly FOR SELECT (no direct client INSERT/UPDATE/DELETE)
        expect(policySql).toMatch(/FOR\s+SELECT\s+TO\s+authenticated/);
      }

      // 3. Verify all 10 nested EXISTS policies enforce both case_id AND tenant_id joins plus client/preparer/reviewer UID checks
      const existsPolicies = authPolicyMatches.filter((p: string) => p.includes('EXISTS'));
      expect(existsPolicies.length).toBe(10); // 1 in core (documents) + 9 in lifecycle (stages 10-18)

      for (const existsPolicy of existsPolicies) {
        expect(existsPolicy).toContain('SELECT 1 FROM taxguard_cases c');
        expect(existsPolicy).toMatch(/AND\s+c\.tenant_id\s*=\s*taxguard_\w+\.tenant_id/);
        expect(existsPolicy).toContain('c.client_uid = auth.uid()::text');
        expect(existsPolicy).toContain('c.preparer_uid = auth.uid()::text');
        expect(existsPolicy).toContain('c.reviewer_uid = auth.uid()::text');
      }
    });

    it(
      'compiles and executes both migrations sequentially in a real PostgreSQL engine (PGlite), validates all Stage 10-18 structures, and verifies runtime RLS & retry safety',
      async () => {
        const fs = await import('node:fs');
        const { PGlite } = await import('@electric-sql/pglite');

        const coreSql = fs.readFileSync(`${migrationsDir}/${coreMigrationFile}`, 'utf8');
        const lifecycleSql = fs.readFileSync(`${migrationsDir}/${lifecycleMigrationFile}`, 'utf8');

        const pg = new PGlite();
        try {
          // Bootstrap Supabase-compatible auth schema and roles in PostgreSQL
          await pg.exec(`
            CREATE SCHEMA IF NOT EXISTS auth;
            CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
              SELECT COALESCE(
                nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
                '00000000-0000-0000-0000-000000000001'::uuid
              );
            $$;
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                CREATE ROLE authenticated NOLOGIN;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                CREATE ROLE service_role NOLOGIN;
              END IF;
            END
            $$;
            GRANT USAGE ON SCHEMA public, auth TO authenticated, service_role;
          `);

          // Verify PostgreSQL rejects unquoted "authorization" column with SQLSTATE 42601
          await expect(
            pg.exec('CREATE TABLE test_unquoted_kw (authorization JSONB);')
          ).rejects.toThrow(/syntax error at or near "authorization"/i);

          // Strip only CREATE EXTENSION lines if WASM build does not bundle contrib shared libraries
          // (gen_random_uuid() is built into core PostgreSQL 13+)
          const prepareForPglite = (sql: string) =>
            sql.replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi, '-- extension provided by core PG');

          // 1. Execute Migration 1 (20260928000000_taxguard_core_schema.sql)
          await pg.exec(prepareForPglite(coreSql));

          // 2. Execute Migration 2 (20260929000000_taxguard_complete_lifecycle_schema.sql)
          await pg.exec(prepareForPglite(lifecycleSql));

          // 3. Verify all 31 tables exist in pg_tables with rowsecurity = true
          const tablesRes = await pg.query<{ tablename: string; rowsecurity: boolean }>(`
            SELECT tablename, rowsecurity
            FROM pg_tables
            WHERE schemaname = 'public' AND tablename LIKE 'taxguard_%'
            ORDER BY tablename;
          `);
          expect(tablesRes.rows.length).toBe(31);
          for (const row of tablesRes.rows) {
            expect(row.rowsecurity, `Table ${row.tablename} must have RLS enabled in PostgreSQL`).toBe(true);
          }

          // 4. Verify Stage 11 taxguard_signature_packages has the "authorization" JSONB column
          const sigColRes = await pg.query<{ column_name: string; data_type: string }>(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'taxguard_signature_packages'
              AND column_name = 'authorization';
          `);
          expect(sigColRes.rows).toEqual([{ column_name: 'authorization', data_type: 'jsonb' }]);

          // 5. Verify all 45 RLS policies are compiled in pg_policies
          const policiesRes = await pg.query<{ policyname: string; tablename: string }>(`
            SELECT policyname, tablename
            FROM pg_policies
            WHERE schemaname = 'public'
            ORDER BY tablename, policyname;
          `);
          expect(policiesRes.rows.length).toBe(45); // 31 service_role + 14 authenticated

          // 6. Grant table SELECT to authenticated role and test runtime RLS evaluation across all 14 authenticated tables
          await pg.exec(`
            GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
            GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

            INSERT INTO taxguard_tenants (id, name) VALUES ('tenant_1', 'A/R Tax Services');
            INSERT INTO taxguard_members (tenant_id, uid, role) VALUES ('tenant_1', '00000000-0000-0000-0000-000000000001', 'client');
            INSERT INTO taxguard_clients (tenant_id, client_id, owner_uid) VALUES ('tenant_1', '101', '00000000-0000-0000-0000-000000000001');
            INSERT INTO taxguard_cases (
              case_id, tenant_id, client_id, engagement_id, tax_year,
              client_uid, preparer_uid, reviewer_uid, created_by, updated_by
            ) VALUES (
              'case_2025_1', 'tenant_1', '101', 'eng_2025', 2025,
              '00000000-0000-0000-0000-000000000001', 'prep_1', 'rev_1', 'admin_1', 'admin_1'
            );
            INSERT INTO taxguard_documents (
              document_id, tenant_id, client_id, engagement_id, tax_year, case_id,
              hash, mime_type, created_by
            ) VALUES (
              'doc_1', 'tenant_1', '101', 'eng_2025', 2025, 'case_2025_1',
              'h1', 'application/pdf', '00000000-0000-0000-0000-000000000001'
            );
            INSERT INTO taxguard_audit_log (
              tenant_id, case_id, action, actor_uid
            ) VALUES (
              'tenant_1', 'case_2025_1', 'CASE_CREATED', '00000000-0000-0000-0000-000000000001'
            );

            -- Stage 10: Approvals
            INSERT INTO taxguard_approvals (
              approval_id, tenant_id, case_id, tax_year, return_version_id,
              return_hash, prepared_by, reviewed_by, approved_by, credential, rationale
            ) VALUES (
              'appr_1', 'tenant_1', 'case_2025_1', 2025, 'v1',
              'hash_1', 'prep_1', 'rev_1', 'rev_1', 'CPA', 'Verified'
            );

            -- Stage 11: Signature Packages (including "authorization" JSONB column)
            INSERT INTO taxguard_signature_packages (
              package_id, tenant_id, case_id, tax_year, return_version_id,
              return_hash, provider, "authorization"
            ) VALUES (
              'sig_1', 'tenant_1', 'case_2025_1', 2025, 'v1',
              'hash_1', 'DOCUSIGN', '{"eroPinVerified": true}'::jsonb
            );

            -- Stage 12: Filing Packages
            INSERT INTO taxguard_filing_packages (
              package_id, submission_id, tenant_id, case_id, tax_year,
              return_version_id, return_hash, idempotency_key, signature_authorization_id, provider
            ) VALUES (
              'fil_1', 'sub_1', 'tenant_1', 'case_2025_1', 2025,
              'v1', 'hash_1', 'idem_1', 'sig_auth_1', 'IRS_MEF'
            );

            -- Stage 13: Government Feedback
            INSERT INTO taxguard_government_feedback (
              feedback_id, tenant_id, case_id, tax_year, submission_id,
              provider, payload_hash, normalized_code, message
            ) VALUES (
              'fb_1', 'tenant_1', 'case_2025_1', 2025, 'sub_1',
              'IRS_MEF', 'phash_1', 'ACCEPTED', 'Return accepted'
            );

            -- Stage 14: Resolution Cases
            INSERT INTO taxguard_resolution_cases (
              resolution_id, tenant_id, case_id, tax_year, issue_type, description, assigned_to
            ) VALUES (
              'res_1', 'tenant_1', 'case_2025_1', 2025, 'NOTICE', 'Notice review', 'prep_1'
            );

            -- Stage 15: Monitoring Items
            INSERT INTO taxguard_monitoring_items (
              item_id, tenant_id, case_id, tax_year, item_type, title, description, due_date, assigned_to
            ) VALUES (
              'mon_1', 'tenant_1', 'case_2025_1', 2025, 'DEADLINE', 'Q1 Estimate', 'Check payment', NOW(), 'prep_1'
            );

            -- Stage 16: Archive Manifests
            INSERT INTO taxguard_archive_manifests (
              manifest_id, tenant_id, case_id, tax_year, integrity_hash, archived_by
            ) VALUES (
              'arch_1', 'tenant_1', 'case_2025_1', 2025, 'ihash_1', 'rev_1'
            );

            -- Stage 17: Renewal Records
            INSERT INTO taxguard_renewal_records (
              renewal_id, tenant_id, case_id, prior_tax_year, next_tax_year
            ) VALUES (
              'ren_1', 'tenant_1', 'case_2025_1', 2025, 2026
            );

            -- Stage 18: Repeat Cases
            INSERT INTO taxguard_repeat_cases (
              repeat_id, tenant_id, previous_case_id, next_case_id, client_id, prior_tax_year, next_tax_year
            ) VALUES (
              'rep_1', 'tenant_1', 'case_2025_1', 'case_2026_1', '101', 2025, 2026
            );
          `);

          // Execute SELECTs across all 14 authenticated-policy tables as matching client_uid
          await pg.exec(`
            BEGIN;
            SET LOCAL ROLE authenticated;
            SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
          `);
          const authSigRes = await pg.query<{ package_id: string; authorization: { eroPinVerified: boolean } }>(
            'SELECT package_id, "authorization" FROM taxguard_signature_packages;'
          );
          expect(authSigRes.rows).toEqual([
            { package_id: 'sig_1', authorization: { eroPinVerified: true } }
          ]);

          for (const tbl of [
            'taxguard_members',
            'taxguard_clients',
            'taxguard_cases',
            'taxguard_documents',
            'taxguard_audit_log',
            'taxguard_approvals',
            'taxguard_signature_packages',
            'taxguard_filing_packages',
            'taxguard_government_feedback',
            'taxguard_resolution_cases',
            'taxguard_monitoring_items',
            'taxguard_archive_manifests',
            'taxguard_renewal_records',
            'taxguard_repeat_cases'
          ]) {
            const res = await pg.query(`SELECT count(*)::int AS cnt FROM ${tbl};`);
            expect((res.rows[0] as { cnt: number }).cnt, `Authorized user should see 1 row in ${tbl}`).toBe(1);
          }
          await pg.exec('COMMIT;');

          // Execute SELECTs as a different `authenticated` user and confirm 0 rows returned across all 14 tables
          await pg.exec(`
            BEGIN;
            SET LOCAL ROLE authenticated;
            SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000999';
          `);
          for (const tbl of [
            'taxguard_members',
            'taxguard_clients',
            'taxguard_cases',
            'taxguard_documents',
            'taxguard_audit_log',
            'taxguard_approvals',
            'taxguard_signature_packages',
            'taxguard_filing_packages',
            'taxguard_government_feedback',
            'taxguard_resolution_cases',
            'taxguard_monitoring_items',
            'taxguard_archive_manifests',
            'taxguard_renewal_records',
            'taxguard_repeat_cases'
          ]) {
            const res = await pg.query(`SELECT count(*)::int AS cnt FROM ${tbl};`);
            expect((res.rows[0] as { cnt: number }).cnt, `Unauthorized user must see 0 rows in ${tbl}`).toBe(0);
          }
          await pg.exec('COMMIT;');

          // 7. Verify Retry Safety for State B (Migration 1 already committed, Migration 2 re-applied) and full re-run
          await expect(pg.exec(prepareForPglite(lifecycleSql))).resolves.not.toThrow();
          await expect(pg.exec(prepareForPglite(coreSql))).resolves.not.toThrow();
        } finally {
          await pg.close();
        }
      },
      30000
    );
  });
});
