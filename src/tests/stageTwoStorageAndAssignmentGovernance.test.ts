import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/**
 * TaxGuard Stage 02 — Storage & Staff Assignment Governance Test Suite
 *
 * Deterministically verifies the Stage 02 migration contracts:
 * 1. Migration sequence and file integrity
 * 2. SQL security constraints (SECURITY DEFINER, search_path, zero uncast auth.uid())
 * 3. PostgreSQL in-memory execution via PGlite:
 *    - storage.buckets & storage.objects tables
 *    - private taxguard-vault bucket configuration
 *    - taxguard_is_staff_assigned_to_client function execution
 *    - effective-date semantics: current active (PASS), future (DENIED), expired (DENIED), revoked (DENIED)
 *    - cross-tenant denial
 *    - cross-client denial
 *    - RLS policy definitions and grants
 */
describe('Stage 02 — Storage & Staff Assignment Governance Suite', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const migration01 = '20260928000000_taxguard_core_schema.sql';
  const migration02 = '20260929000000_taxguard_complete_lifecycle_schema.sql';
  const migration03 = '20260930000000_taxguard_bookkeeping_schema.sql';
  const migration04 = '20261001000000_taxguard_practice_operations_schema.sql';
  const migration05 = '20261002000000_taxguard_storage_and_assignment_governance.sql';
  const migration06 = '20261004000000_taxguard_private_storage_client_scope.sql';

  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();

    // Prepare Supabase auth emulation in PostgreSQL
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
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
      END
      $$;
      GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
    `);

    // Helper to strip extension statements not bundled in core wasm
    const prepareForPglite = (sql: string) =>
      sql.replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi, '-- extension handled');

    // Execute baseline migrations 01, 04, 05, 06 in sequence
    const sql01 = prepareForPglite(fs.readFileSync(path.join(migrationsDir, migration01), 'utf8'));
    const sql04 = prepareForPglite(fs.readFileSync(path.join(migrationsDir, migration04), 'utf8'));
    const sql05 = prepareForPglite(fs.readFileSync(path.join(migrationsDir, migration05), 'utf8'));
    const sql06 = prepareForPglite(fs.readFileSync(path.join(migrationsDir, migration06), 'utf8'));

    await pg.exec(sql01);
    await pg.exec(sql04);
    await pg.exec(sql05);
    await pg.exec(sql06);
  });

  afterAll(async () => {
    if (pg) {
      await pg.close();
    }
  });

  describe('1. Migration Sequence & File Invariants', () => {
    it('contains all 6 authoritative migrations in exact chronological sequence', () => {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      expect(files).toEqual([
        migration01,
        migration02,
        migration03,
        migration04,
        migration05,
        migration06,
      ]);
    });

    it('enforces controlled search_path on all SECURITY DEFINER functions', () => {
      const sql05 = fs.readFileSync(path.join(migrationsDir, migration05), 'utf8');
      const secDefinerMatches = sql05.match(/SECURITY\s+DEFINER[\s\S]*?SET\s+search_path\s*=\s*public,\s*pg_temp/g);
      expect(secDefinerMatches).not.toBeNull();
      expect(secDefinerMatches!.length).toBeGreaterThanOrEqual(2);
    });

    it('ensures zero uncast auth.uid() comparisons in new migrations', () => {
      const sql05 = fs.readFileSync(path.join(migrationsDir, migration05), 'utf8');
      const sql06 = fs.readFileSync(path.join(migrationsDir, migration06), 'utf8');

      for (const sql of [sql05, sql06]) {
        const matches = sql.match(/auth\.uid\(\)(::text)?/g) ?? [];
        for (const m of matches) {
          expect(m).toBe('auth.uid()::text');
        }
      }
    });

    it('enforces hardened authenticated vault boundaries in the private storage migration', () => {
      const sql06 = fs.readFileSync(path.join(migrationsDir, migration06), 'utf8');

      expect(sql06).toContain('CREATE POLICY taxguard_vault_authenticated_select_scope');
      expect(sql06).toContain('AS RESTRICTIVE FOR SELECT TO authenticated');

      expect(sql06).toContain('CREATE POLICY taxguard_vault_no_authenticated_insert');
      expect(sql06).toContain('AS RESTRICTIVE FOR INSERT TO authenticated');

      expect(sql06).toContain('CREATE POLICY taxguard_vault_no_authenticated_update');
      expect(sql06).toContain('AS RESTRICTIVE FOR UPDATE TO authenticated');

      expect(sql06).toContain('CREATE POLICY taxguard_vault_no_authenticated_delete');
      expect(sql06).toContain('AS RESTRICTIVE FOR DELETE TO authenticated');
    });
  });

  describe('2. Storage Vault Schema & Privacy Verification', () => {
    it('registers taxguard-vault as a private bucket with 25MB limit', async () => {
      const res = await pg.query<{ id: string; name: string; public: boolean; file_size_limit: number }>(
        `SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'taxguard-vault'`
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].id).toBe('taxguard-vault');
      expect(res.rows[0].name).toBe('taxguard-vault');
      expect(res.rows[0].public).toBe(false);
      expect(Number(res.rows[0].file_size_limit)).toBe(26214400);
    });

    it('enforces RLS on storage.buckets and storage.objects', async () => {
      const res = await pg.query<{ tablename: string; rowsecurity: boolean }>(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'storage' AND tablename IN ('buckets', 'objects');
      `);
      expect(res.rows.length).toBe(2);
      for (const row of res.rows) {
        expect(row.rowsecurity, `RLS must be enabled on storage.${row.tablename}`).toBe(true);
      }
    });
  });

  describe('3. Staff Assignment Governance RPC Semantics', () => {
    beforeAll(async () => {
      // Seed test tenant and clients
      await pg.exec(`
        INSERT INTO taxguard_tenants (id, name, status)
        VALUES ('tenant_alpha', 'Alpha CPA Group', 'active'),
               ('tenant_beta', 'Beta Advisors', 'active')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO taxguard_clients (tenant_id, client_id, owner_uid, name)
        VALUES ('tenant_alpha', 'client_100', 'client_owner_100', 'Acme Corp'),
               ('tenant_alpha', 'client_200', 'client_owner_200', 'Bravo LLC'),
               ('tenant_beta', 'client_900', 'client_owner_900', 'Omega Inc')
        ON CONFLICT DO NOTHING;
      `);
    });

    it('returns TRUE for active assignment within effective dates', async () => {
      await pg.exec(`
        INSERT INTO taxguard_staff_assignments (
          id, tenant_id, client_id, role, user_id, assigned_by, effective_from, effective_to, status
        ) VALUES (
          'asgn_active_1', 'tenant_alpha', 'client_100', 'accountant', 'cpa_jane', 'admin_1',
          NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', 'ACTIVE'
        ) ON CONFLICT (id) DO NOTHING;
      `);

      const res = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client('tenant_alpha', 'cpa_jane', 'client_100') as assigned;
      `);
      expect(res.rows[0].assigned).toBe(true);
    });

    it('returns FALSE (DENIED) for future assignment not yet effective', async () => {
      await pg.exec(`
        INSERT INTO taxguard_staff_assignments (
          id, tenant_id, client_id, role, user_id, assigned_by, effective_from, effective_to, status
        ) VALUES (
          'asgn_future_1', 'tenant_alpha', 'client_200', 'accountant', 'cpa_future', 'admin_1',
          NOW() + INTERVAL '5 days', NOW() + INTERVAL '60 days', 'ACTIVE'
        ) ON CONFLICT (id) DO NOTHING;
      `);

      const res = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client('tenant_alpha', 'cpa_future', 'client_200') as assigned;
      `);
      expect(res.rows[0].assigned).toBe(false);
    });

    it('returns FALSE (DENIED) for expired assignment past effective_to', async () => {
      await pg.exec(`
        INSERT INTO taxguard_staff_assignments (
          id, tenant_id, client_id, role, user_id, assigned_by, effective_from, effective_to, status
        ) VALUES (
          'asgn_expired_1', 'tenant_alpha', 'client_100', 'reviewer', 'cpa_expired', 'admin_1',
          NOW() - INTERVAL '60 days', NOW() - INTERVAL '1 day', 'ACTIVE'
        ) ON CONFLICT (id) DO NOTHING;
      `);

      const res = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client('tenant_alpha', 'cpa_expired', 'client_100') as assigned;
      `);
      expect(res.rows[0].assigned).toBe(false);
    });

    it('returns FALSE (DENIED) for inactive / revoked assignment status', async () => {
      await pg.exec(`
        INSERT INTO taxguard_staff_assignments (
          id, tenant_id, client_id, role, user_id, assigned_by, effective_from, effective_to, status
        ) VALUES (
          'asgn_revoked_1', 'tenant_alpha', 'client_100', 'preparer', 'cpa_revoked', 'admin_1',
          NOW() - INTERVAL '10 days', NOW() + INTERVAL '30 days', 'REVOKED'
        ) ON CONFLICT (id) DO NOTHING;
      `);

      const res = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client('tenant_alpha', 'cpa_revoked', 'client_100') as assigned;
      `);
      expect(res.rows[0].assigned).toBe(false);
    });

    it('returns FALSE (DENIED) for cross-tenant request', async () => {
      // cpa_jane is assigned to client_100 in tenant_alpha, NOT in tenant_beta
      const res = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client('tenant_beta', 'cpa_jane', 'client_100') as assigned;
      `);
      expect(res.rows[0].assigned).toBe(false);
    });

    it('returns FALSE (DENIED) for wrong client request', async () => {
      // cpa_jane is assigned to client_100, not client_200
      const res = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client('tenant_alpha', 'cpa_jane', 'client_200') as assigned;
      `);
      expect(res.rows[0].assigned).toBe(false);
    });

    it('returns FALSE (DENIED) for missing assignment', async () => {
      const res = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client('tenant_alpha', 'cpa_unassigned_stranger', 'client_100') as assigned;
      `);
      expect(res.rows[0].assigned).toBe(false);
    });

    it('returns FALSE (DENIED) when any parameter is NULL (fail closed)', async () => {
      const res1 = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client(NULL, 'cpa_jane', 'client_100') as assigned;
      `);
      const res2 = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client('tenant_alpha', NULL, 'client_100') as assigned;
      `);
      const res3 = await pg.query<{ assigned: boolean }>(`
        SELECT taxguard_is_staff_assigned_to_client('tenant_alpha', 'cpa_jane', NULL) as assigned;
      `);
      expect(res1.rows[0].assigned).toBe(false);
      expect(res2.rows[0].assigned).toBe(false);
      expect(res3.rows[0].assigned).toBe(false);
    });
  });

  describe('4. Storage Object Path Extraction & RLS Integration', () => {
    it('verifies split_part extracts path elements according to canonical format', async () => {
      const testPath = 'tenants/tenant_alpha/clients/client_100/cases/case_2025/docs/w2_v1.pdf';
      const res = await pg.query<{
        p1: string;
        tenant: string;
        p3: string;
        client: string;
        p5: string;
        case_id: string;
        p7: string;
        file: string;
      }>(`
        SELECT 
          split_part('${testPath}', '/', 1) as p1,
          split_part('${testPath}', '/', 2) as tenant,
          split_part('${testPath}', '/', 3) as p3,
          split_part('${testPath}', '/', 4) as client,
          split_part('${testPath}', '/', 5) as p5,
          split_part('${testPath}', '/', 6) as case_id,
          split_part('${testPath}', '/', 7) as p7,
          split_part('${testPath}', '/', 8) as file;
      `);

      expect(res.rows[0].p1).toBe('tenants');
      expect(res.rows[0].tenant).toBe('tenant_alpha');
      expect(res.rows[0].p3).toBe('clients');
      expect(res.rows[0].client).toBe('client_100');
      expect(res.rows[0].p5).toBe('cases');
      expect(res.rows[0].case_id).toBe('case_2025');
      expect(res.rows[0].p7).toBe('docs');
      expect(res.rows[0].file).toBe('w2_v1.pdf');
    });

    it('verifies all expected storage and staff assignment policies exist in database catalog', async () => {
      const res = await pg.query<{ policyname: string; tablename: string }>(`
        SELECT policyname, tablename
        FROM pg_policies
        WHERE tablename IN ('buckets', 'objects', 'taxguard_staff_assignments', 'taxguard_documents')
        ORDER BY tablename, policyname;
      `);

      const policyNames = res.rows.map(r => r.policyname);
      expect(policyNames).toContain('service_role_all_storage_buckets');
      expect(policyNames).toContain('service_role_all_storage_objects');

      // Hardened private-vault architecture:
      // authenticated clients receive owner/case-scoped SELECT only;
      // direct authenticated mutations remain fail-closed.
      expect(policyNames).toContain('taxguard_client_read_own_vault_objects');
      expect(policyNames).toContain('taxguard_vault_authenticated_select_scope');
      expect(policyNames).toContain('taxguard_vault_no_authenticated_insert');
      expect(policyNames).toContain('taxguard_vault_no_authenticated_update');
      expect(policyNames).toContain('taxguard_vault_no_authenticated_delete');

      expect(policyNames).toContain('service_role_all_staff_assignments');
      expect(policyNames).toContain('staff_read_assigned_clients');
      expect(policyNames).toContain('assigned_staff_documents_access');
    });
  });
});
