-- Forward-only security correction. Historical migration 20261002000000 is immutable.
-- Applies only after the original migration was applied by a supported bootstrap path.
-- Does not modify Supabase-managed Storage schema/tables or global policies.
-- Private taxguard-vault bucket and scoped object policies require independent verification.
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

