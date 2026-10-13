-- PROPOSAL 011 ONLY. NOT APPLIED. Requires actual core and proposals 000-010.
-- Read-only bounded service directory. No provider calls, factor data or gate clearing.
-- SQL action eligibility is a hint: approval always rechecks authority in proposal 010.
CREATE INDEX IF NOT EXISTS idx_taxguard_mfa_recoveries_directory ON public.taxguard_mfa_recovery_requests(tenant_id,status,created_at DESC,request_id COLLATE "C" DESC);
CREATE INDEX IF NOT EXISTS idx_taxguard_mfa_recoveries_directory_all ON public.taxguard_mfa_recovery_requests(tenant_id,created_at DESC,request_id COLLATE "C" DESC);
CREATE OR REPLACE FUNCTION public.taxguard_list_mfa_recoveries(
 p_tenant text,p_actor text,p_actor_session_hash text,p_status text,p_page_size integer,p_after_created timestamptz,p_after_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor_role text; actor_epoch timestamptz; actor_auth bigint; actor_i jsonb; result jsonb;
BEGIN
 IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$'
  OR p_actor_session_hash IS NULL OR p_actor_session_hash !~ '^[a-f0-9]{64}$'
  OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 51
  OR (p_status IS NOT NULL AND p_status NOT IN ('pending_approval','approved'))
  OR ((p_after_created IS NULL) <> (p_after_id IS NULL)) OR (p_after_created IS NOT NULL AND NOT isfinite(p_after_created))
  OR (p_after_id IS NOT NULL AND p_after_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') THEN
  RAISE EXCEPTION 'STAFF_RECOVERY_INPUT_INVALID' USING ERRCODE='P0001';
 END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id=p_tenant AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_DENIED' USING ERRCODE='P0001'; END IF;
  SELECT role,status_changed_at INTO actor_role,actor_epoch FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor AND status='active'
    AND NOT mfa_reenrollment_required AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
  SELECT user_data INTO actor_i FROM public.taxguard_identities WHERE tenant_id=p_tenant AND uid=p_actor FOR SHARE NOWAIT;
  IF NOT FOUND OR actor_i->>'id' IS DISTINCT FROM p_actor OR actor_i->>'role' IS DISTINCT FROM actor_role
    OR actor_i->>'status' IS DISTINCT FROM 'active' OR (actor_i ? 'tenantId' AND actor_i->>'tenantId' IS DISTINCT FROM p_tenant) THEN
    RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001';
  END IF;
  -- Proof must still name a live durable administrator session inside this transaction.
  -- NOWAIT prevents actor-session locks from cycling with existing lifecycle transactions.
  SELECT auth_time INTO actor_auth FROM public.taxguard_sessions WHERE tenant_id=p_tenant AND uid=p_actor
    AND session_token_hash=p_actor_session_hash AND revoked=false AND aal='aal2'
    AND expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF actor_auth IS NULL OR actor_auth<=0 OR actor_auth>floor(extract(epoch FROM clock_timestamp()))::bigint+30 THEN
    RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE='P0001';
  END IF;
  IF actor_epoch IS NOT NULL AND to_timestamp(actor_auth)<=actor_epoch THEN
    RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE='P0001';
  END IF;

 SELECT COALESCE(jsonb_agg(page.row_data ORDER BY page.created_at DESC,page.row_id COLLATE "C" DESC),'[]'::jsonb) INTO result FROM (
 SELECT r.created_at,r.request_id AS row_id,jsonb_build_object(
  'requestId',r.request_id,'targetUid',r.target_uid,'targetName',i.user_data->>'name','targetRole',m.role,
  'makerUid',r.maker_uid,'checkerUid',r.checker_uid,'reasonCategory',r.reason_category,'reason',r.reason,
  'status',r.status,'createdAt',r.created_at,'approvedAt',r.approved_at,'jobId',j.job_id,'jobStatus',j.status,
  'approveEligible',COALESCE(r.status='pending_approval' AND p_actor<>r.maker_uid AND p_actor<>r.target_uid
   AND m.role IN ('accountant','reviewer','senior_reviewer','bookkeeper','practice_manager','operations','admin','administrator','consultant','managing_consultant','founder','legal_specialist','firm_manager','recruiter')
   AND m.status IN ('active','suspended') AND NOT m.mfa_reenrollment_required
   AND i.user_data->>'id'=m.uid AND i.user_data->>'tenantId'=m.tenant_id AND i.user_data->>'role'=m.role AND i.user_data->>'status'=m.status
   AND maker.status='active' AND NOT maker.mfa_reenrollment_required AND maker.role IN ('admin','administrator','super_admin','super_administrator'),false)
 ) AS row_data
 FROM public.taxguard_mfa_recovery_requests r
 LEFT JOIN public.taxguard_members m ON m.tenant_id=r.tenant_id AND m.uid=r.target_uid
 LEFT JOIN public.taxguard_identities i ON i.tenant_id=r.tenant_id AND i.uid=r.target_uid
 LEFT JOIN public.taxguard_members maker ON maker.tenant_id=r.tenant_id AND maker.uid=r.maker_uid
 LEFT JOIN public.taxguard_mfa_reset_jobs j ON j.tenant_id=r.tenant_id AND j.request_id=r.request_id AND j.target_uid=r.target_uid
 WHERE r.tenant_id=p_tenant AND (p_status IS NULL OR r.status=p_status)
  AND (p_after_created IS NULL OR (r.created_at,r.request_id COLLATE "C") < (p_after_created,p_after_id COLLATE "C"))
 ORDER BY r.created_at DESC,r.request_id COLLATE "C" DESC LIMIT p_page_size
 ) page;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_list_mfa_recoveries(text,text,text,text,integer,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_list_mfa_recoveries(text,text,text,text,integer,timestamptz,text) TO service_role;
