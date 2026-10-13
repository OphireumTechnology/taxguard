-- PROPOSAL ONLY. NOT APPLIED. Apply after the five preceding staff proposals.
-- Service-role directory reads; the server must also verify durable AAL2 authority.
CREATE INDEX IF NOT EXISTS idx_taxguard_members_directory
  ON public.taxguard_members(tenant_id, status, created_at DESC, uid COLLATE "C" DESC);
CREATE INDEX IF NOT EXISTS idx_taxguard_invitations_directory
  ON public.taxguard_staff_invitations(tenant_id, status, created_at DESC, id COLLATE "C" DESC);

CREATE OR REPLACE FUNCTION public.taxguard_list_staff_members(
  p_tenant text, p_actor text, p_status text, p_page_size integer,
  p_after_created timestamptz, p_after_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF p_tenant IS NULL OR length(btrim(p_tenant)) NOT BETWEEN 1 AND 128
    OR p_actor IS NULL OR length(btrim(p_actor)) NOT BETWEEN 1 AND 128
    OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 51
    OR (p_status IS NOT NULL AND p_status NOT IN ('active','pending_approval','suspended','disabled','deactivated'))
    OR ((p_after_created IS NULL) <> (p_after_id IS NULL))
    OR (p_after_created IS NOT NULL AND NOT isfinite(p_after_created))
    OR (p_after_id IS NOT NULL AND (length(btrim(p_after_id)) NOT BETWEEN 1 AND 128 OR p_after_id ~ '[[:cntrl:]]')) THEN
    RAISE EXCEPTION 'STAFF_DIRECTORY_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_members
    WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active'
      AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT COALESCE(jsonb_agg(page.row_data ORDER BY page.created_at DESC, page.row_id COLLATE "C" DESC), '[]'::jsonb)
    INTO result FROM (
    SELECT m.created_at, m.uid AS row_id, jsonb_build_object(
      'uid', m.uid, 'name', i.user_data->>'name', 'email', i.user_data->>'email',
      'role', m.role, 'status', m.status, 'createdAt', m.created_at,
      'invitedBy', m.invited_by, 'approvedBy', m.approved_by, 'approvedAt', m.approved_at,
      'statusChangedBy', m.status_changed_by, 'statusChangedAt', m.status_changed_at,
      'mfaReenrollmentRequired', m.mfa_reenrollment_required,
      'identityConsistent', COALESCE(i.user_data->>'id' = m.uid AND i.user_data->>'tenantId' = m.tenant_id
        AND i.user_data->>'role' = m.role AND i.user_data->>'status' = m.status, false),
      'mfaEnabled', COALESCE(i.user_data->'mfaEnabled' = 'true'::jsonb, false)
    ) AS row_data
    FROM public.taxguard_members m LEFT JOIN public.taxguard_identities i ON i.uid = m.uid AND i.tenant_id = m.tenant_id
    WHERE m.tenant_id = p_tenant
      AND m.role NOT IN ('client','prospective_client','super_admin','super_administrator')
      AND (p_status IS NULL OR m.status = p_status)
      AND (p_after_created IS NULL OR (m.created_at, m.uid COLLATE "C") < (p_after_created, p_after_id COLLATE "C"))
    ORDER BY m.created_at DESC, m.uid COLLATE "C" DESC LIMIT p_page_size
  ) page;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_list_staff_members(text,text,text,integer,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_list_staff_members(text,text,text,integer,timestamptz,text) TO service_role;

CREATE OR REPLACE FUNCTION public.taxguard_list_staff_invitations(
  p_tenant text, p_actor text, p_status text, p_page_size integer,
  p_after_created timestamptz, p_after_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF p_tenant IS NULL OR length(btrim(p_tenant)) NOT BETWEEN 1 AND 128
    OR p_actor IS NULL OR length(btrim(p_actor)) NOT BETWEEN 1 AND 128
    OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 51
    OR (p_status IS NOT NULL AND p_status NOT IN ('pending','accepted','revoked'))
    OR ((p_after_created IS NULL) <> (p_after_id IS NULL))
    OR (p_after_created IS NOT NULL AND NOT isfinite(p_after_created))
    OR (p_after_id IS NOT NULL AND (length(btrim(p_after_id)) NOT BETWEEN 1 AND 64 OR p_after_id ~ '[[:cntrl:]]')) THEN
    RAISE EXCEPTION 'STAFF_DIRECTORY_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_members
    WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active'
      AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT COALESCE(jsonb_agg(page.row_data ORDER BY page.created_at DESC, page.row_id COLLATE "C" DESC), '[]'::jsonb)
    INTO result FROM (
    SELECT v.created_at, v.id AS row_id, jsonb_build_object(
      'id', v.id,
      'email', v.email,
      'role', v.role,
      'legalFirstName', v.legal_first_name,
      'legalLastName', v.legal_last_name,
      'status', v.status,
      'createdAt', v.created_at,
      'expiresAt', v.expires_at,
      'invitedBy', v.invited_by,
      'acceptedUid', v.accepted_uid,
      'acceptedAt', v.accepted_at,
      'revokedBy', v.revoked_by,
      'revokedAt', v.revoked_at
    ) AS row_data
    FROM public.taxguard_staff_invitations v
    WHERE v.tenant_id = p_tenant

      AND (p_status IS NULL OR v.status = p_status)
      AND (p_after_created IS NULL OR (v.created_at, v.id COLLATE "C") < (p_after_created, p_after_id COLLATE "C"))
    ORDER BY v.created_at DESC, v.id COLLATE "C" DESC LIMIT p_page_size
  ) page;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_list_staff_invitations(text,text,text,integer,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_list_staff_invitations(text,text,text,integer,timestamptz,text) TO service_role;
