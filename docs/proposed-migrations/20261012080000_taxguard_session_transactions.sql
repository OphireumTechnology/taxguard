-- PROPOSAL ONLY. NOT APPLIED. Requires core schema and proposals 000 through 007.
-- Verified provider proofs and the server-configured tenant are supplied only by the service.
-- auth_time is provider seconds; expires_at is JavaScript epoch milliseconds.
-- Row-lock protocol: tenant -> member -> identity -> session; lifecycle also locks member
-- before identity and sessions. No provider changes or staff role grants are performed.
CREATE OR REPLACE FUNCTION public.taxguard_create_session(
  p_tenant text, p_uid text, p_token_hash text, p_auth_time bigint, p_expires_at bigint, p_aal text, p_verified_factor_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  member_row taxguard_members%ROWTYPE;
  identity_row taxguard_identities%ROWTYPE;
  client_row taxguard_clients%ROWTYPE;
  now_ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  IF p_tenant IS NULL OR length(p_tenant) NOT BETWEEN 1 AND 128 OR p_tenant ~ '[[:cntrl:]]' OR p_tenant <> btrim(p_tenant) OR
     p_uid IS NULL OR length(p_uid) NOT BETWEEN 1 AND 128 OR p_uid ~ '[[:cntrl:]]' OR p_uid <> btrim(p_uid) OR
     p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' OR
     p_auth_time IS NULL OR p_auth_time <= 0 OR p_auth_time > now_ms / 1000 + 30 OR
     p_expires_at IS NULL OR p_expires_at <= now_ms OR p_expires_at > now_ms + 7230000 OR
     p_aal IS NULL OR p_aal NOT IN ('aal1','aal2') OR
     p_verified_factor_count IS NULL OR p_verified_factor_count < 0 OR p_verified_factor_count > 100 THEN
    RAISE EXCEPTION 'SESSION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM taxguard_tenants WHERE id = p_tenant AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_AUTHORITY_DENIED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO member_row FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_uid FOR SHARE;
  IF NOT FOUND OR member_row.status IS DISTINCT FROM 'active' OR
     member_row.role IS NULL OR btrim(member_row.role) = '' THEN
    RAISE EXCEPTION 'SESSION_AUTHORITY_DENIED' USING ERRCODE = 'P0001';
  END IF;
  -- The durable identity row binds tenant; legacy staff JSON may omit its optional
  -- tenantId, but a conflicting value is denied. Canonical client JSON requires it.
  SELECT * INTO identity_row FROM taxguard_identities WHERE tenant_id = p_tenant AND uid = p_uid FOR SHARE;
  IF NOT FOUND OR identity_row.user_data->>'id' IS DISTINCT FROM p_uid OR
     (identity_row.user_data ? 'tenantId' AND identity_row.user_data->>'tenantId' IS DISTINCT FROM p_tenant) OR
     identity_row.user_data->>'role' IS DISTINCT FROM member_row.role OR
     identity_row.user_data->>'status' IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'SESSION_AUTHORITY_DENIED' USING ERRCODE = 'P0001';
  END IF;
  IF member_row.role IN ('client','prospective_client') THEN
    SELECT * INTO client_row FROM taxguard_clients
      WHERE tenant_id = p_tenant AND owner_uid = p_uid FOR SHARE;
    IF identity_row.user_data->>'tenantId' IS DISTINCT FROM p_tenant OR NOT FOUND OR client_row.status IS DISTINCT FROM 'active' OR
       member_row.client_id IS DISTINCT FROM client_row.client_id OR
       identity_row.user_data->>'clientId' IS DISTINCT FROM client_row.client_id THEN
      RAISE EXCEPTION 'SESSION_AUTHORITY_DENIED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF member_row.role NOT IN ('client','prospective_client') THEN
    IF p_verified_factor_count IS NULL OR p_verified_factor_count < 1 THEN
      RAISE EXCEPTION 'STAFF_MFA_ENROLLMENT_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF p_aal <> 'aal2' THEN RAISE EXCEPTION 'STAFF_MFA_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF member_row.mfa_reenrollment_required THEN
      RAISE EXCEPTION 'STAFF_MFA_REENROLLMENT_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    -- Strict comparison denies proofs issued in the status-change second as well.
    IF member_row.status_changed_at IS NOT NULL AND
       to_timestamp(p_auth_time) <= member_row.status_changed_at THEN
      RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal)
    VALUES(p_tenant,p_uid,p_token_hash,p_auth_time,p_expires_at,p_aal)
    ON CONFLICT (session_token_hash) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_TOKEN_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
    VALUES(p_tenant,'SESSION_CREATED',p_uid,member_row.role,
      jsonb_build_object('tokenHashPrefix',left(p_token_hash,8)));
  RETURN jsonb_build_object('created',true);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_create_session(text,text,text,bigint,bigint,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_create_session(text,text,text,bigint,bigint,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.taxguard_revoke_session(p_tenant text,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  session_uid text;
  session_row taxguard_sessions%ROWTYPE;
  actor_role text := 'unknown';
BEGIN
  IF p_tenant IS NULL OR length(p_tenant) NOT BETWEEN 1 AND 128 OR p_tenant ~ '[[:cntrl:]]' OR
     p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'SESSION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  -- Scoped, unlocked discovery only; acquire authority locks before the session lock.
  SELECT uid INTO session_uid FROM taxguard_sessions
    WHERE tenant_id = p_tenant AND session_token_hash = p_token_hash AND revoked = false;
  IF NOT FOUND THEN RETURN jsonb_build_object('revoked',false); END IF;
  SELECT role INTO actor_role FROM taxguard_members WHERE tenant_id = p_tenant AND uid = session_uid FOR SHARE;
  actor_role := coalesce(nullif(btrim(actor_role),''),'unknown');
  PERFORM 1 FROM taxguard_identities WHERE tenant_id = p_tenant AND uid = session_uid FOR SHARE;
  SELECT * INTO session_row FROM taxguard_sessions WHERE tenant_id = p_tenant
    AND session_token_hash = p_token_hash AND uid = session_uid FOR UPDATE;
  IF NOT FOUND OR session_row.revoked THEN RETURN jsonb_build_object('revoked',false); END IF;
  UPDATE taxguard_sessions SET revoked = true WHERE id = session_row.id AND tenant_id = p_tenant;
  INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
    VALUES(p_tenant,'SESSION_REVOKED',session_row.uid,actor_role,
      jsonb_build_object('tokenHashPrefix',left(p_token_hash,8)));
  RETURN jsonb_build_object('revoked',true);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_revoke_session(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_revoke_session(text,text) TO service_role;
