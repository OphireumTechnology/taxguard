-- PROPOSAL 037 ONLY. NOT APPLIED. Requires proposals 010, 011 and 034.
-- Read-only additions for the MFA recovery user interface:
--   taxguard_staff_admin_session      the shared administrator-session check WITHOUT the recency
--                                     window (reading is not a privileged change); recency stays
--                                     on every mutation (taxguard_privileged_session, 034).
--   taxguard_mfa_recovery_history     the audit trail of one recovery request for administrators of
--                                     the same tenant: actions, actors, times and a fixed list of
--                                     non-secret metadata fields. No reason text, factor data or IDs.
--   taxguard_mfa_recovery_step        what the target staff member may know about their own open
--                                     recovery (called by the service after verifying their provider
--                                     token): a coarse step only, never other people or job internals.
-- Rollback (development): drop the three functions.

CREATE OR REPLACE FUNCTION public.taxguard_staff_admin_session(p_tenant text, p_actor text, p_session_hash text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor_role text; actor_epoch timestamptz; actor_auth bigint; actor_i jsonb;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' OR p_session_hash IS NULL OR p_session_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id = p_tenant AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT role, status_changed_at INTO actor_role, actor_epoch FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active'
    AND NOT mfa_reenrollment_required AND role IN ('admin','administrator','super_admin','super_administrator');
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT user_data INTO actor_i FROM public.taxguard_identities WHERE tenant_id = p_tenant AND uid = p_actor;
  IF NOT FOUND OR actor_i->>'id' IS DISTINCT FROM p_actor OR actor_i->>'role' IS DISTINCT FROM actor_role OR actor_i->>'status' IS DISTINCT FROM 'active'
     OR (actor_i ? 'tenantId' AND actor_i->>'tenantId' IS DISTINCT FROM p_tenant) THEN
    RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  SELECT auth_time INTO actor_auth FROM public.taxguard_sessions WHERE tenant_id = p_tenant AND uid = p_actor AND session_token_hash = p_session_hash
    AND revoked = false AND aal = 'aal2' AND expires_at > floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF actor_auth IS NULL OR (actor_epoch IS NOT NULL AND to_timestamp(actor_auth) <= actor_epoch) THEN RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  RETURN actor_role;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_mfa_recovery_history(p_tenant text, p_actor text, p_session_hash text, p_request_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r public.taxguard_mfa_recovery_requests;
BEGIN
  PERFORM public.taxguard_staff_admin_session(p_tenant, p_actor, p_session_hash);
  IF p_request_id IS NULL OR p_request_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'MFA_RECOVERY_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO r FROM public.taxguard_mfa_recovery_requests WHERE tenant_id = p_tenant AND request_id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object('requestId', r.request_id, 'targetUid', r.target_uid, 'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', a.action, 'actorUid', a.actor_uid,
      'actorRole', a.actor_role, 'at', a.timestamp,
      'details', jsonb_strip_nulls(jsonb_build_object('attempt', a.metadata->'attempt', 'errorCode', a.metadata->'errorCode', 'removedFactors', a.metadata->'removedFactors',
        'status', a.metadata->'status', 'revokedSessions', a.metadata->'revokedSessions', 'reasonCategory', a.metadata->'reasonCategory', 'nextAttemptAt', a.metadata->'nextAttemptAt')))
      ORDER BY a.timestamp, a.id), '[]'::jsonb)
    FROM public.taxguard_audit_log a WHERE a.tenant_id = p_tenant AND a.action LIKE 'STAFF\_MFA\_%'
      AND (a.metadata->>'requestId' = p_request_id OR a.metadata->>'jobId' = p_request_id)));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_mfa_recovery_step(p_tenant text, p_uid text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE((SELECT jsonb_build_object('step', CASE
        WHEN r.status = 'pending_approval' THEN 'awaiting_approval'
        WHEN j.status IN ('pending','leased') THEN 'awaiting_reset'
        WHEN j.status = 'failed' THEN 'reset_failed'
        WHEN j.status = 'reset_verified' THEN 'ready_for_enrollment'
        WHEN j.status = 'enrollment_verified' THEN 'awaiting_reactivation' END)
      FROM public.taxguard_mfa_recovery_requests r LEFT JOIN public.taxguard_mfa_reset_jobs j ON j.tenant_id = r.tenant_id AND j.request_id = r.request_id
      WHERE r.tenant_id = p_tenant AND r.target_uid = p_uid AND r.status IN ('pending_approval','approved')), jsonb_build_object('step', 'none')) $$;

REVOKE ALL ON FUNCTION public.taxguard_staff_admin_session(text,text,text), public.taxguard_mfa_recovery_history(text,text,text,text), public.taxguard_mfa_recovery_step(text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_mfa_recovery_history(text,text,text,text), public.taxguard_mfa_recovery_step(text,text) TO service_role;
