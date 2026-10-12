-- PROPOSAL 023 ONLY. NOT APPLIED. Requires actual core schema and proposals 000-011.
-- Durable session management: a signed-in member lists and revokes their own sessions; an
-- administrator revokes every session of another staff member (step-up: primary sign-in no
-- older than 15 minutes). Service-role execution only. Session token hashes are never
-- returned; sessions are addressed by their row UUID. No provider calls, no factor changes.
-- Row-lock protocol: tenant -> member -> identity -> session (as proposal 008). Target
-- session locks use NOWAIT so two administrators acting on each other surface a retryable
-- 55P03 instead of a deadlock.

CREATE INDEX IF NOT EXISTS idx_taxguard_sessions_member
  ON public.taxguard_sessions(tenant_id, uid, revoked, expires_at);

-- Internal: verifies that p_hash names a live durable session of an active, coherent member.
-- Staff sessions must be AAL2, outside an MFA re-enrolment gate, and newer than the last
-- membership status change. Not granted to any role.
CREATE OR REPLACE FUNCTION public.taxguard_session_actor(
  p_tenant text, p_uid text, p_hash text, OUT actor_role text, OUT actor_auth bigint, OUT actor_session uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE m public.taxguard_members%ROWTYPE; i jsonb;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_uid IS NULL OR p_uid !~ '^[A-Za-z0-9_-]{1,128}$' OR
     p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'SESSION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id = p_tenant AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_AUTHORITY_DENIED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO m FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_uid FOR SHARE NOWAIT;
  IF NOT FOUND OR m.status IS DISTINCT FROM 'active' OR m.role IS NULL OR btrim(m.role) = '' THEN
    RAISE EXCEPTION 'SESSION_AUTHORITY_DENIED' USING ERRCODE = 'P0001';
  END IF;
  SELECT user_data INTO i FROM public.taxguard_identities WHERE tenant_id = p_tenant AND uid = p_uid FOR SHARE NOWAIT;
  IF NOT FOUND OR i->>'id' IS DISTINCT FROM p_uid OR i->>'role' IS DISTINCT FROM m.role OR i->>'status' IS DISTINCT FROM 'active' OR
     (i ? 'tenantId' AND i->>'tenantId' IS DISTINCT FROM p_tenant) THEN
    RAISE EXCEPTION 'SESSION_AUTHORITY_DENIED' USING ERRCODE = 'P0001';
  END IF;
  SELECT s.auth_time, s.id INTO actor_auth, actor_session FROM public.taxguard_sessions s
    WHERE s.tenant_id = p_tenant AND s.uid = p_uid AND s.session_token_hash = p_hash AND s.revoked = false
      AND s.expires_at > floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint
      AND (m.role IN ('client','prospective_client') OR s.aal = 'aal2')
    FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_AUTHORITY_DENIED' USING ERRCODE = 'P0001'; END IF;
  IF m.role NOT IN ('client','prospective_client') THEN
    IF m.mfa_reenrollment_required THEN RAISE EXCEPTION 'STAFF_MFA_REENROLLMENT_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF actor_auth IS NULL OR actor_auth <= 0 OR actor_auth > floor(extract(epoch FROM clock_timestamp()))::bigint + 30 OR
       (m.status_changed_at IS NOT NULL AND to_timestamp(actor_auth) <= m.status_changed_at) THEN
      RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  actor_role := m.role;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_session_actor(text,text,text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_list_own_sessions(p_tenant text, p_uid text, p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor record; result jsonb;
BEGIN
  SELECT * INTO actor FROM public.taxguard_session_actor(p_tenant, p_uid, p_hash);
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC, id), '[]'::jsonb) INTO result FROM (
    SELECT s.created_at, s.id, jsonb_build_object(
      'sessionId', s.id, 'createdAt', s.created_at, 'authenticatedAt', to_timestamp(s.auth_time),
      'expiresAt', to_timestamp(s.expires_at / 1000.0), 'assuranceLevel', s.aal, 'current', s.id = actor.actor_session) AS row_data
    FROM public.taxguard_sessions s
    WHERE s.tenant_id = p_tenant AND s.uid = p_uid AND s.revoked = false
      AND s.expires_at > floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint
    ORDER BY s.created_at DESC, s.id LIMIT 50) page;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_list_own_sessions(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_list_own_sessions(text,text,text) TO service_role;

-- Missing, foreign, expired and already-revoked targets are indistinguishable ({revoked:false}).
-- The current session is ended through logout, not here.
CREATE OR REPLACE FUNCTION public.taxguard_revoke_own_session(p_tenant text, p_uid text, p_hash text, p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor record; target uuid;
BEGIN
  IF p_session_id IS NULL THEN RAISE EXCEPTION 'SESSION_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO actor FROM public.taxguard_session_actor(p_tenant, p_uid, p_hash);
  IF p_session_id = actor.actor_session THEN RAISE EXCEPTION 'SESSION_CURRENT_USE_LOGOUT' USING ERRCODE = 'P0001'; END IF;
  SELECT id INTO target FROM public.taxguard_sessions WHERE id = p_session_id AND tenant_id = p_tenant AND uid = p_uid
    AND revoked = false FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RETURN jsonb_build_object('revoked', false); END IF;
  UPDATE public.taxguard_sessions SET revoked = true WHERE id = target;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES (p_tenant, 'SESSION_REVOKED_BY_OWNER', p_uid, actor.actor_role, jsonb_build_object('sessionId', target));
  RETURN jsonb_build_object('revoked', true);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_revoke_own_session(text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_revoke_own_session(text,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.taxguard_revoke_other_own_sessions(p_tenant text, p_uid text, p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor record; revoked_count integer;
BEGIN
  SELECT * INTO actor FROM public.taxguard_session_actor(p_tenant, p_uid, p_hash);
  PERFORM 1 FROM public.taxguard_sessions WHERE tenant_id = p_tenant AND uid = p_uid AND revoked = false
    AND id <> actor.actor_session FOR UPDATE NOWAIT;
  UPDATE public.taxguard_sessions SET revoked = true
    WHERE tenant_id = p_tenant AND uid = p_uid AND revoked = false AND id <> actor.actor_session;
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES (p_tenant, 'SESSIONS_OTHER_REVOKED_BY_OWNER', p_uid, actor.actor_role, jsonb_build_object('revokedSessions', revoked_count));
  RETURN jsonb_build_object('revokedSessions', revoked_count);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_revoke_other_own_sessions(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_revoke_other_own_sessions(text,text,text) TO service_role;

-- The caller's own security history: sign-in, session revocation, administrator actions that
-- targeted the caller, and membership / MFA lifecycle events. Session token hash prefixes and
-- other proof fields are not returned.
CREATE OR REPLACE FUNCTION public.taxguard_list_own_security_events(p_tenant text, p_uid text, p_hash text, p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor record;
BEGIN
  SELECT * INTO actor FROM public.taxguard_session_actor(p_tenant, p_uid, p_hash);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'SESSION_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', e.action, 'actorUid', e.actor_uid, 'actorRole', e.actor_role, 'at', e.timestamp,
      'byAdministrator', e.actor_uid <> p_uid,
      'details', COALESCE(e.metadata, '{}'::jsonb) - 'tokenHashPrefix' - 'sessionHash' - 'tokenHash' - 'proof' - 'factorId' - 'secret')
      ORDER BY e.timestamp DESC, e.id), '[]'::jsonb)
    FROM (SELECT * FROM public.taxguard_audit_log
      WHERE tenant_id = p_tenant AND (
        (actor_uid = p_uid AND (action LIKE 'SESSION%' OR action LIKE 'STAFF\_MFA%' OR action LIKE 'STAFF\_SESSIONS%'))
        OR metadata->>'targetUid' = p_uid OR metadata->>'uid' = p_uid)
      ORDER BY timestamp DESC, id LIMIT p_limit) e);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_list_own_security_events(text,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_list_own_security_events(text,text,text,integer) TO service_role;

-- Administrator step-up: the acting session's primary authentication must be at most 900
-- seconds old. Targets: other staff members of the same tenant. Platform super administrator
-- sessions can be revoked only by a super administrator. Audit stores the reason category.
CREATE OR REPLACE FUNCTION public.taxguard_admin_revoke_member_sessions(
  p_tenant text, p_actor text, p_hash text, p_target text, p_reason_category text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor record; target_role text; revoked_count integer;
BEGIN
  IF p_target IS NULL OR p_target !~ '^[A-Za-z0-9_-]{1,128}$' OR p_reason_category IS NULL OR
     p_reason_category NOT IN ('security_incident','lost_or_stolen_device','offboarding','role_change','administrative_review') THEN
    RAISE EXCEPTION 'SESSION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO actor FROM public.taxguard_session_actor(p_tenant, p_actor, p_hash);
  IF actor.actor_role NOT IN ('admin','administrator','super_admin','super_administrator') THEN
    RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF actor.actor_auth < floor(extract(epoch FROM clock_timestamp()))::bigint - 900 THEN
    RAISE EXCEPTION 'STAFF_REAUTHENTICATION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_target = p_actor THEN RAISE EXCEPTION 'SESSION_TARGET_SELF' USING ERRCODE = 'P0001'; END IF;
  SELECT role INTO target_role FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_target FOR SHARE NOWAIT;
  IF NOT FOUND OR target_role IS NULL OR target_role IN ('client','prospective_client') THEN
    RAISE EXCEPTION 'SESSION_TARGET_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF target_role IN ('super_admin','super_administrator') AND actor.actor_role NOT IN ('super_admin','super_administrator') THEN
    RAISE EXCEPTION 'SESSION_TARGET_PROTECTED' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_identities WHERE tenant_id = p_tenant AND uid = p_target FOR SHARE NOWAIT;
  PERFORM 1 FROM public.taxguard_sessions WHERE tenant_id = p_tenant AND uid = p_target AND revoked = false FOR UPDATE NOWAIT;
  UPDATE public.taxguard_sessions SET revoked = true WHERE tenant_id = p_tenant AND uid = p_target AND revoked = false;
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES (p_tenant, 'STAFF_SESSIONS_REVOKED_BY_ADMIN', p_actor, actor.actor_role,
      jsonb_build_object('targetUid', p_target, 'targetRole', target_role, 'reasonCategory', p_reason_category, 'revokedSessions', revoked_count));
  RETURN jsonb_build_object('revokedSessions', revoked_count);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_admin_revoke_member_sessions(text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_admin_revoke_member_sessions(text,text,text,text,text) TO service_role;
