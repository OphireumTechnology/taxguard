-- PROPOSAL ONLY. NOT APPLIED. Requires the core schema. No provider MFA reset is implemented.
-- Service-role-only status control; request handlers must verify the actor's durable AAL2 session.
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS status_changed_by varchar(128);
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS status_reason text;
-- Future recovery must set this gate before provider changes. This RPC cannot clear it or
-- accept a caller assertion as re-enrollment proof. A separately reviewed flow is required.
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS mfa_reenrollment_required boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION taxguard_change_staff_membership_status(
  p_tenant text, p_actor text, p_uid text, p_action text, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor_role text;
  member taxguard_members%ROWTYPE;
  identity_data jsonb;
  next_status text;
  revoked_count integer;
BEGIN
  IF p_tenant IS NULL OR p_actor IS NULL OR p_uid IS NULL OR
    length(p_tenant) NOT BETWEEN 1 AND 128 OR length(p_actor) NOT BETWEEN 1 AND 128 OR
    length(p_uid) NOT BETWEEN 1 AND 128 OR p_action IS NULL OR
    p_action NOT IN ('suspend','deactivate','reactivate') OR p_reason IS NULL OR
    length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 OR p_reason ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'STAFF_LIFECYCLE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_actor = p_uid THEN
    RAISE EXCEPTION 'INDEPENDENT_ACTOR_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  SELECT role INTO actor_role FROM taxguard_members
    WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active'
      AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO member FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_uid FOR UPDATE;
  IF NOT FOUND OR member.role NOT IN ('accountant','reviewer','senior_reviewer','bookkeeper',
    'practice_manager','operations','admin','administrator','consultant','managing_consultant',
    'founder','legal_specialist','firm_manager','recruiter') THEN
    RAISE EXCEPTION 'STAFF_TARGET_DENIED' USING ERRCODE = 'P0001';
  END IF;
  SELECT user_data INTO identity_data FROM taxguard_identities
    WHERE tenant_id = p_tenant AND uid = p_uid FOR UPDATE;
  IF NOT FOUND OR identity_data->>'role' IS DISTINCT FROM member.role OR
    identity_data->>'status' IS DISTINCT FROM member.status OR
    identity_data->>'id' IS DISTINCT FROM p_uid OR
    identity_data->>'tenantId' IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION 'STAFF_IDENTITY_INCONSISTENT' USING ERRCODE = 'P0001';
  END IF;
  IF p_action = 'suspend' AND member.status = 'active' THEN next_status := 'suspended';
  ELSIF p_action = 'deactivate' AND member.status IN ('active','suspended') THEN next_status := 'disabled';
  ELSIF p_action = 'reactivate' AND member.status = 'suspended' THEN
    IF member.status_changed_by IS NULL OR member.status_changed_by = p_actor THEN
      RAISE EXCEPTION 'INDEPENDENT_APPROVER_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF member.mfa_reenrollment_required OR identity_data->>'mfaEnabled' IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'STAFF_MFA_REENROLLMENT_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    next_status := 'active';
  ELSE RAISE EXCEPTION 'STAFF_STATUS_TRANSITION_DENIED' USING ERRCODE = 'P0001';
  END IF;
  -- Revocation is monotonic. Reactivation never restores an existing session.
  UPDATE taxguard_sessions SET revoked = true WHERE tenant_id = p_tenant AND uid = p_uid AND revoked = false;
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  UPDATE taxguard_members SET status = next_status, status_changed_by = p_actor,
    status_changed_at = now(), status_reason = btrim(p_reason), updated_at = now() WHERE tenant_id = p_tenant AND uid = p_uid;
  UPDATE taxguard_identities SET user_data = jsonb_set(user_data, '{status}', to_jsonb(next_status)), updated_at = now()
    WHERE tenant_id = p_tenant AND uid = p_uid;
  INSERT INTO taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES(p_tenant, 'STAFF_MEMBERSHIP_' || upper(p_action), p_actor, actor_role,
      jsonb_build_object('uid', p_uid, 'previousStatus', member.status, 'status', next_status,
        'reason', btrim(p_reason), 'revokedSessions', revoked_count));
  RETURN jsonb_build_object('status', next_status, 'revokedSessions', revoked_count);
END $$;
REVOKE ALL ON FUNCTION taxguard_change_staff_membership_status(text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION taxguard_change_staff_membership_status(text,text,text,text,text) TO service_role;
