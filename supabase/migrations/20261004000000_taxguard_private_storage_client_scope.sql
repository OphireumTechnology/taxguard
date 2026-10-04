-- ==============================================================================
-- TaxGuard AI - Production Supabase / PostgreSQL Private Storage Client Scope Migration
-- Version: 20261004000000
-- Description: Incremental hardening for Stage 02 private taxpayer storage:
--   1. Strict client-path prefix validation on storage.objects for 'taxguard-vault':
--      Expected pattern: tenants/{tenant_id}/clients/{client_id}/cases/{case_id}/docs/{filename}
--   2. Client Upload Isolation: Client can only upload objects within their own tenant & client scope
--   3. Client Read Isolation: Client can only download/read objects within their own tenant & client scope
--   4. Staff Access Control: Staff can only access storage objects for clients where an active assignment exists
--   5. Immutability & Administrative Boundary: Direct client UPDATE and DELETE strictly blocked
--   6. Complete Anonymous / Public Revocation on storage schema
-- Defense-in-depth: Zero cross-client leaks, zero cross-tenant leaks, zero public bucket exposure.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Explicit Revocation of Anonymous / Public Access on Storage
-- ------------------------------------------------------------------------------
REVOKE ALL ON storage.objects FROM anon;
REVOKE ALL ON storage.buckets FROM anon;

-- Ensure bucket remains private and cannot be made public accidentally
UPDATE storage.buckets
SET public = FALSE, updated_at = NOW()
WHERE id = 'taxguard-vault';

-- ------------------------------------------------------------------------------
-- 2. Client-Scoped Upload Policy (INSERT to storage.objects)
-- ------------------------------------------------------------------------------
-- An authenticated client may only upload into their own assigned tenant and client directory:
-- Path must begin with: tenants/{tenant_id}/clients/{client_id}/cases/{case_id}/docs/
DROP POLICY IF EXISTS storage_vault_client_insert ON storage.objects;
CREATE POLICY storage_vault_client_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'taxguard-vault'
    AND split_part(name, '/', 1) = 'tenants'
    AND split_part(name, '/', 3) = 'clients'
    AND split_part(name, '/', 5) = 'cases'
    AND split_part(name, '/', 7) = 'docs'
    AND (
      EXISTS (
        SELECT 1 FROM taxguard_clients c
        WHERE c.tenant_id = split_part(storage.objects.name, '/', 2)
          AND c.client_id = split_part(storage.objects.name, '/', 4)
          AND c.owner_uid = auth.uid()::text
          AND c.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM taxguard_members m
        WHERE m.tenant_id = split_part(storage.objects.name, '/', 2)
          AND m.client_id = split_part(storage.objects.name, '/', 4)
          AND m.uid = auth.uid()::text
          AND m.role = 'client'
          AND m.status = 'active'
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 3. Client-Scoped Read Policy (SELECT from storage.objects)
-- ------------------------------------------------------------------------------
-- An authenticated client may only inspect or download objects from their own client path.
DROP POLICY IF EXISTS storage_vault_client_select ON storage.objects;
CREATE POLICY storage_vault_client_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'taxguard-vault'
    AND split_part(name, '/', 1) = 'tenants'
    AND split_part(name, '/', 3) = 'clients'
    AND (
      EXISTS (
        SELECT 1 FROM taxguard_clients c
        WHERE c.tenant_id = split_part(storage.objects.name, '/', 2)
          AND c.client_id = split_part(storage.objects.name, '/', 4)
          AND c.owner_uid = auth.uid()::text
          AND c.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM taxguard_members m
        WHERE m.tenant_id = split_part(storage.objects.name, '/', 2)
          AND m.client_id = split_part(storage.objects.name, '/', 4)
          AND m.uid = auth.uid()::text
          AND m.role = 'client'
          AND m.status = 'active'
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 4. Staff-Scoped Read Policy (SELECT from storage.objects)
-- ------------------------------------------------------------------------------
-- A practitioner / CPA / EA may only inspect or download client objects if:
--   a) They have an active, non-expired staff assignment for that client, OR
--   b) They are an assigned preparer or reviewer for the specific tax case, OR
--   c) They are an active administrator / practice manager for the tenant.
DROP POLICY IF EXISTS storage_vault_staff_select ON storage.objects;
CREATE POLICY storage_vault_staff_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'taxguard-vault'
    AND split_part(name, '/', 1) = 'tenants'
    AND split_part(name, '/', 3) = 'clients'
    AND (
      -- Check authoritative staff assignment (effective date validated)
      taxguard_is_staff_assigned_to_client(
        split_part(storage.objects.name, '/', 2),
        auth.uid()::text,
        split_part(storage.objects.name, '/', 4)
      )
      -- Check case participant role
      OR EXISTS (
        SELECT 1 FROM taxguard_cases c
        WHERE c.tenant_id = split_part(storage.objects.name, '/', 2)
          AND c.client_id = split_part(storage.objects.name, '/', 4)
          AND c.case_id = split_part(storage.objects.name, '/', 6)
          AND (c.preparer_uid = auth.uid()::text OR c.reviewer_uid = auth.uid()::text)
      )
      -- Check practice administrator / manager role
      OR EXISTS (
        SELECT 1 FROM taxguard_members m
        WHERE m.tenant_id = split_part(storage.objects.name, '/', 2)
          AND m.uid = auth.uid()::text
          AND m.role IN ('admin', 'practice_manager')
          AND m.status = 'active'
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 5. Immutability & Administrative Mutation Boundaries
-- ------------------------------------------------------------------------------
-- Direct client UPDATE and DELETE on storage.objects are forbidden.
-- Deletion, quarantine purging, and version superseding must proceed
-- via backend orchestration under the service_role authority.
DROP POLICY IF EXISTS storage_vault_client_update ON storage.objects;
DROP POLICY IF EXISTS storage_vault_client_delete ON storage.objects;
-- (No UPDATE or DELETE policies are granted to authenticated role; service_role has ALL)
