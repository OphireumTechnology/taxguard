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

  describe('5. Supabase Production Migrations — RLS UUID/VARCHAR Type Compatibility & Security Audit', () => {
    const migrationsDir = `${process.cwd()}/supabase/migrations`;
    const coreMigrationFile = '20260928000000_taxguard_core_schema.sql';
    const lifecycleMigrationFile = '20260929000000_taxguard_complete_lifecycle_schema.sql';

    it('maintains strict migration sequence with 20260928000000 first and 20260929000000 second', async () => {
      const fs = await import('node:fs');
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      expect(files).toEqual([coreMigrationFile, lifecycleMigrationFile]);
    });

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
  });
});
