-- Keep the TaxGuard document bucket private and constrain direct client reads
-- to the authenticated owner's tenant/client/case path.
INSERT INTO storage.buckets (id, name, public)
VALUES ('taxguard-vault', 'taxguard-vault', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS taxguard_client_read_own_vault_objects ON storage.objects;
CREATE POLICY taxguard_client_read_own_vault_objects
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'taxguard-vault'
    AND EXISTS (
      SELECT 1
      FROM taxguard_clients c
      JOIN taxguard_cases tc
        ON tc.tenant_id = c.tenant_id
       AND tc.client_id = c.client_id
      WHERE c.owner_uid = auth.uid()::text
        AND c.tenant_id = split_part(name, '/', 2)
        AND c.client_id = split_part(name, '/', 4)
        AND tc.case_id = split_part(name, '/', 6)
        AND tc.client_uid = auth.uid()::text
    )
  );

-- Restrictive policies are AND-composed with permissive policies, so unrelated
-- authenticated SELECT policies cannot broaden vault access.
DROP POLICY IF EXISTS taxguard_vault_authenticated_select_scope ON storage.objects;
CREATE POLICY taxguard_vault_authenticated_select_scope
  ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    bucket_id <> 'taxguard-vault'
    OR (
      bucket_id = 'taxguard-vault'
      AND EXISTS (
        SELECT 1
        FROM public.taxguard_clients c
        JOIN public.taxguard_cases tc
          ON tc.tenant_id = c.tenant_id
         AND tc.client_id = c.client_id
        WHERE c.owner_uid = auth.uid()::text
          AND c.tenant_id = split_part(name, '/', 2)
          AND c.client_id = split_part(name, '/', 4)
          AND tc.case_id = split_part(name, '/', 6)
          AND tc.client_uid = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS taxguard_vault_no_authenticated_insert ON storage.objects;
CREATE POLICY taxguard_vault_no_authenticated_insert
  ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'taxguard-vault');

DROP POLICY IF EXISTS taxguard_vault_no_authenticated_update ON storage.objects;
CREATE POLICY taxguard_vault_no_authenticated_update
  ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'taxguard-vault')
  WITH CHECK (bucket_id <> 'taxguard-vault');

DROP POLICY IF EXISTS taxguard_vault_no_authenticated_delete ON storage.objects;
CREATE POLICY taxguard_vault_no_authenticated_delete
  ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'taxguard-vault');

CREATE OR REPLACE FUNCTION public.taxguard_assign_staff(
  p_tenant_id VARCHAR,
  p_client_id VARCHAR,
  p_engagement_id VARCHAR,
  p_tax_year INTEGER,
  p_role VARCHAR,
  p_user_id VARCHAR,
  p_assigned_by VARCHAR,
  p_reason TEXT
)
RETURNS SETOF public.taxguard_staff_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_assignment public.taxguard_staff_assignments%ROWTYPE;
  new_assignment public.taxguard_staff_assignments%ROWTYPE;
BEGIN
  IF p_role NOT IN ('preparer', 'accountant', 'reviewer', 'cpa_ea', 'admin', 'case_owner') THEN
    RAISE EXCEPTION 'INVALID_ASSIGNMENT_ROLE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.taxguard_clients c
    WHERE c.tenant_id = p_tenant_id
      AND c.client_id = p_client_id
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'CLIENT_SCOPE_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.taxguard_members m
    WHERE m.tenant_id = p_tenant_id
      AND m.uid = p_user_id
      AND m.status = 'active'
      AND m.role NOT IN ('client', 'prospective_client')
  ) THEN
    RAISE EXCEPTION 'STAFF_MEMBERSHIP_INVALID';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id || ':' || p_client_id || ':' || p_role));

  SELECT *
  INTO current_assignment
  FROM public.taxguard_staff_assignments
  WHERE tenant_id = p_tenant_id
    AND client_id = p_client_id
    AND role = p_role
    AND status = 'ACTIVE'
  FOR UPDATE;

  IF FOUND AND current_assignment.user_id = p_user_id THEN
    RETURN NEXT current_assignment;
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE public.taxguard_staff_assignments
    SET status = 'REASSIGNED',
        effective_to = NOW(),
        updated_at = NOW()
    WHERE id = current_assignment.id;

    INSERT INTO public.taxguard_assignment_history (
      tenant_id,
      client_id,
      role,
      previous_user_id,
      new_user_id,
      changed_by,
      reassignment_reason
    ) VALUES (
      p_tenant_id,
      p_client_id,
      p_role,
      current_assignment.user_id,
      p_user_id,
      p_assigned_by,
      COALESCE(NULLIF(p_reason, ''), 'Staff assignment updated')
    );
  END IF;

  INSERT INTO public.taxguard_staff_assignments (
    id,
    tenant_id,
    client_id,
    engagement_id,
    tax_year,
    role,
    user_id,
    assigned_by,
    effective_from,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid()::text,
    p_tenant_id,
    p_client_id,
    p_engagement_id,
    p_tax_year,
    p_role,
    p_user_id,
    p_assigned_by,
    NOW(),
    'ACTIVE',
    NOW(),
    NOW()
  )
  RETURNING * INTO new_assignment;

  RETURN NEXT new_assignment;
END;
$$;

REVOKE ALL ON FUNCTION public.taxguard_assign_staff(VARCHAR, VARCHAR, VARCHAR, INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_assign_staff(VARCHAR, VARCHAR, VARCHAR, INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT)
  TO service_role;
