-- ==============================================================================
-- TaxGuard AI - Production Supabase / PostgreSQL Storage & Assignment Governance Migration
-- Version: 20261002000000
-- Description: Establishes the authoritative Stage 02 storage and assignment governance:
--   1. Storage Vault Bucket Registration (taxguard-vault, private, 25MB limit)
--   2. Storage Security Foundation (storage.buckets & storage.objects RLS and service_role policies)
--   3. Staff Assignment Governance RPCs:
--      - taxguard_is_staff_assigned_to_client (evaluates tenant, client, status, effectiveFrom, effectiveTo)
--      - taxguard_is_staff_assigned_to_engagement (evaluates engagement & tax year scopes)
--   4. Staff Assignment & Caseload History Row Level Security (RLS) Policies
--   5. Document RLS Authorization Bridge (assigned staff document access)
-- Defense-in-depth: Strict Row Level Security (RLS), SECURITY DEFINER search_path isolation,
-- and fail-closed effective date semantics.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1–2. Supabase-managed Storage boundary (review-only migration repair)
-- ------------------------------------------------------------------------------
-- Supabase owns storage schema, storage.buckets and storage.objects. Application
-- migrations MUST NOT create/alter these managed tables, enable their RLS, or
-- replace global service_role policies. Such DDL fails with SQLSTATE 42501 on
-- hosted preview branches and risks overriding platform security boundaries.
--
-- The private 'taxguard-vault' bucket (25 MiB; PDF/JPEG/PNG/XLSX/CSV) must be
-- provisioned separately through the Supabase Storage API/dashboard by an
-- authorized operator. The operator must verify public=false, size/MIME limits,
-- and scoped object policies before staging acceptance. Do not make the bucket
-- public or grant blanket authenticated access to storage.objects.
--
-- This migration intentionally touches only TaxGuard-owned functions and
-- public application-table RLS policies below. A separate, reviewed Storage
-- policy change is required for actual object upload/download authorization.

-- ------------------------------------------------------------------------------
-- 3. Staff Assignment Governance Functions / RPCs (Least Privilege & Search Path)
-- ------------------------------------------------------------------------------

-- Authoritative check whether staff member has an active, currently effective assignment for a client
CREATE OR REPLACE FUNCTION taxguard_is_staff_assigned_to_client(
  p_tenant_id VARCHAR(128),
  p_user_id VARCHAR(128),
  p_client_id VARCHAR(64),
  p_role VARCHAR(64) DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assigned BOOLEAN;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Strict input validation: fail closed on missing scope
  IF p_tenant_id IS NULL OR p_user_id IS NULL OR p_client_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- A caller must never probe another staff member's assignments.
  -- Service-role calls are trusted server-side operations only.
  IF (auth.uid() IS NULL OR p_user_id <> auth.uid()::text)
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM taxguard_staff_assignments
    WHERE tenant_id = p_tenant_id
      AND user_id = p_user_id
      AND client_id = p_client_id
      AND status = 'ACTIVE'
      AND effective_from <= v_now
      AND (effective_to IS NULL OR effective_to > v_now)
      AND (p_role IS NULL OR role = p_role)
  ) INTO v_assigned;

  RETURN COALESCE(v_assigned, FALSE);
END;
$$;

-- Revoke public execution, grant only to authenticated and service_role
REVOKE ALL ON FUNCTION taxguard_is_staff_assigned_to_client(VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION taxguard_is_staff_assigned_to_client(VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION taxguard_is_staff_assigned_to_client(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION taxguard_is_staff_assigned_to_client(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;

-- Authoritative check whether staff member is assigned to an engagement / tax year
CREATE OR REPLACE FUNCTION taxguard_is_staff_assigned_to_engagement(
  p_tenant_id VARCHAR(128),
  p_user_id VARCHAR(128),
  p_client_id VARCHAR(64),
  p_engagement_id VARCHAR(128),
  p_tax_year INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assigned BOOLEAN;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL OR p_client_id IS NULL OR p_engagement_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF (auth.uid() IS NULL OR p_user_id <> auth.uid()::text)
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RETURN FALSE;
  END IF;

  -- A caller must never probe another staff member's assignments.
  -- Service-role calls are trusted server-side operations only.
  IF (auth.uid() IS NULL OR p_user_id <> auth.uid()::text)
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM taxguard_staff_assignments
    WHERE tenant_id = p_tenant_id
      AND user_id = p_user_id
      AND client_id = p_client_id
      AND (engagement_id IS NULL OR engagement_id = p_engagement_id)
      AND (p_tax_year IS NULL OR tax_year IS NULL OR tax_year = p_tax_year)
      AND status = 'ACTIVE'
      AND effective_from <= v_now
      AND (effective_to IS NULL OR effective_to > v_now)
  ) INTO v_assigned;

  RETURN COALESCE(v_assigned, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION taxguard_is_staff_assigned_to_engagement(VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION taxguard_is_staff_assigned_to_engagement(VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION taxguard_is_staff_assigned_to_engagement(VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION taxguard_is_staff_assigned_to_engagement(VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. Staff Assignment & Reassignment History RLS Policies
-- ------------------------------------------------------------------------------

-- Service Role full administrative access
DROP POLICY IF EXISTS service_role_all_staff_assignments ON taxguard_staff_assignments;
CREATE POLICY service_role_all_staff_assignments ON taxguard_staff_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_assignment_history ON taxguard_assignment_history;
CREATE POLICY service_role_all_assignment_history ON taxguard_assignment_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users:
-- Staff members can read assignments where they are the assigned practitioner,
-- client owners can read assignments for their own client record,
-- and tenant administrators / managers can read all assignments within their tenant.
DROP POLICY IF EXISTS staff_read_assigned_clients ON taxguard_staff_assignments;
CREATE POLICY staff_read_assigned_clients ON taxguard_staff_assignments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM taxguard_clients c
      WHERE c.tenant_id = taxguard_staff_assignments.tenant_id
        AND c.client_id = taxguard_staff_assignments.client_id
        AND c.owner_uid = auth.uid()::text
    ) OR
    EXISTS (
      SELECT 1 FROM taxguard_members m
      WHERE m.tenant_id = taxguard_staff_assignments.tenant_id
        AND m.uid = auth.uid()::text
        AND m.role IN ('admin', 'practice_manager', 'reviewer', 'senior_reviewer')
        AND m.status = 'active'
    )
  );

-- Authenticated history: staff involved in reassignment or tenant admins can inspect history
DROP POLICY IF EXISTS staff_read_assignment_history ON taxguard_assignment_history;
CREATE POLICY staff_read_assignment_history ON taxguard_assignment_history
  FOR SELECT TO authenticated
  USING (
    new_user_id = auth.uid()::text OR
    previous_user_id = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM taxguard_members m
      WHERE m.tenant_id = taxguard_assignment_history.tenant_id
        AND m.uid = auth.uid()::text
        AND m.role IN ('admin', 'practice_manager')
        AND m.status = 'active'
    )
  );

-- ------------------------------------------------------------------------------
-- 5. Document RLS Authorization Bridge (Assigned Staff Access)
-- ------------------------------------------------------------------------------
-- Enhances taxguard_documents: in addition to creator and tax case participants,
-- actively assigned staff members for the client may read documents for verification.
DROP POLICY IF EXISTS assigned_staff_documents_access ON taxguard_documents;
CREATE POLICY assigned_staff_documents_access ON taxguard_documents
  FOR SELECT TO authenticated
  USING (
    taxguard_is_staff_assigned_to_client(
      taxguard_documents.tenant_id,
      auth.uid()::text,
      taxguard_documents.client_id
    )
  );
