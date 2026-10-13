-- PROPOSAL 035 ONLY. NOT APPLIED. Requires the actual core schema and proposals 000-004 and 034.
-- Hardens staff invitations, activation and membership changes (proposals 002-004 files unchanged):
--   * search_path: the five functions pinned only 'public', which lets a session's temporary schema
--     shadow tables inside SECURITY DEFINER code; they now pin pg_catalog, public, pg_temp.
--   * actors: every administrator action also requires the actor not to be under MFA re-enrolment
--     and to have a consistent identity record (as the recovery functions already did).
--   * membership: changes to administrators are serialized per tenant; the last active
--     administrator cannot be suspended or deactivated (also not by two administrators suspending
--     each other at the same time). Super administrators remain outside this RPC entirely (002/004).
--   * activation: the pending member's identity record must be consistent and not gated.
--   * invitations: acceptance requires the issuing administrator to still hold that authority, so
--     invitations issued by a since-suspended, deactivated or gated administrator are dead.
-- The service additionally requires a recent AAL2 sign-in for these actions (proposal 034).
-- Rollback (development): re-apply proposals 002-004 function definitions.
-- ------------------------------------------------------------------------------------------
-- Superseding definitions of proposal 002/003/004 functions, generated from those files with
-- anchored patches (each anchor must match exactly once); behaviour otherwise identical.
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION taxguard_change_staff_membership_status(
  p_tenant text, p_actor text, p_uid text, p_action text, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
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
  -- Administrator membership changes are serialized per tenant so concurrent mutual suspensions
  -- cannot leave the tenant without an active administrator.
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant || ':staff-admin-membership'));
  SELECT role INTO actor_role FROM taxguard_members
    WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active'
      AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND mfa_reenrollment_required;
  IF FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM taxguard_identities WHERE tenant_id = p_tenant AND uid = p_actor AND user_data->>'id' = p_actor
    AND user_data->>'role' = actor_role AND user_data->>'status' = 'active' AND (NOT (user_data ? 'tenantId') OR user_data->>'tenantId' = p_tenant);
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
  IF p_action IN ('suspend','deactivate') AND member.status = 'active' AND member.role IN ('admin','administrator','super_admin','super_administrator')
     AND NOT EXISTS (SELECT 1 FROM taxguard_members o WHERE o.tenant_id = p_tenant AND o.uid <> p_uid AND o.status = 'active'
       AND NOT o.mfa_reenrollment_required AND o.role IN ('admin','administrator','super_admin','super_administrator')) THEN
    RAISE EXCEPTION 'LAST_ACTIVE_ADMINISTRATOR' USING ERRCODE = 'P0001';
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

CREATE OR REPLACE FUNCTION taxguard_approve_staff_activation(p_tenant text, p_actor text, p_uid text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE member taxguard_members%ROWTYPE; actor_role text;
BEGIN
  SELECT role INTO actor_role FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor
    AND status = 'active' AND role IN ('admin', 'administrator', 'super_admin', 'super_administrator') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND mfa_reenrollment_required;
  IF FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM taxguard_identities WHERE tenant_id = p_tenant AND uid = p_actor AND user_data->>'id' = p_actor
    AND user_data->>'role' = actor_role AND user_data->>'status' = 'active' AND (NOT (user_data ? 'tenantId') OR user_data->>'tenantId' = p_tenant);
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO member FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_uid FOR UPDATE;
  IF NOT FOUND OR member.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'ACTIVATION_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;
  IF member.invited_by IS NULL OR member.invited_by = p_actor OR p_actor = p_uid THEN
    RAISE EXCEPTION 'INDEPENDENT_APPROVER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM taxguard_identities WHERE tenant_id = p_tenant AND uid = p_uid AND user_data->>'id' = p_uid AND user_data->>'role' = member.role
    AND user_data->>'status' = 'pending_approval' AND user_data->>'tenantId' = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_IDENTITY_INCONSISTENT' USING ERRCODE = 'P0001'; END IF;
  IF member.mfa_reenrollment_required THEN RAISE EXCEPTION 'STAFF_MFA_REENROLLMENT_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  UPDATE taxguard_members SET status = 'active', approved_by = p_actor, approved_at = NOW(), updated_at = NOW()
    WHERE tenant_id = p_tenant AND uid = p_uid;
  UPDATE taxguard_identities SET user_data = jsonb_set(user_data, '{status}', '"active"')
    WHERE tenant_id = p_tenant AND uid = p_uid;
  INSERT INTO taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES(p_tenant, 'STAFF_ACTIVATION_APPROVED', p_actor, actor_role, jsonb_build_object('uid', p_uid));
  RETURN jsonb_build_object('status', 'active');
END $$;

CREATE OR REPLACE FUNCTION taxguard_accept_staff_invitation(
  p_tenant text, p_token_hash text, p_uid text, p_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE invitation taxguard_staff_invitations%ROWTYPE; result jsonb;
BEGIN
  SELECT * INTO invitation FROM taxguard_staff_invitations
    WHERE tenant_id = p_tenant AND token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR invitation.status <> 'pending' OR invitation.expires_at <= NOW()
    OR lower(invitation.email) <> lower(trim(p_email)) THEN
    RAISE EXCEPTION 'INVITATION_INVALID' USING ERRCODE = 'P0001';
  END IF;
  -- An invitation is only as valid as its issuer's current authority.
  PERFORM 1 FROM taxguard_members WHERE tenant_id = p_tenant AND uid = invitation.invited_by AND status = 'active'
    AND NOT mfa_reenrollment_required AND role IN ('admin','administrator','super_admin','super_administrator');
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_INVALID' USING ERRCODE = 'P0001'; END IF;
  -- Serialize competing invitations for the same external identity across all tenants.
  PERFORM pg_advisory_xact_lock(hashtext(p_uid));
  IF EXISTS (SELECT 1 FROM taxguard_identities WHERE uid = p_uid)
    OR EXISTS (SELECT 1 FROM taxguard_members WHERE uid = p_uid) THEN
    RAISE EXCEPTION 'IDENTITY_ALREADY_PROVISIONED' USING ERRCODE = 'P0001';
  END IF;
  result := jsonb_build_object('id', p_uid, 'tenantId', p_tenant, 'email', lower(trim(p_email)),
    'name', invitation.legal_first_name || ' ' || invitation.legal_last_name,
    'role', invitation.role, 'status', 'pending_approval', 'isVerified', true, 'mfaEnabled', true);
  INSERT INTO taxguard_identities(uid, tenant_id, user_data) VALUES(p_uid, p_tenant, result);
  INSERT INTO taxguard_members(tenant_id, uid, role, status, invited_by)
    VALUES(p_tenant, p_uid, invitation.role, 'pending_approval', invitation.invited_by);
  UPDATE taxguard_staff_invitations SET status = 'accepted', accepted_uid = p_uid, accepted_at = NOW()
    WHERE id = invitation.id;
  INSERT INTO taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES(p_tenant, 'STAFF_INVITATION_ACCEPTED', p_uid, invitation.role,
      jsonb_build_object('invitationId', invitation.id, 'status', 'pending_approval'));
  RETURN jsonb_build_object('status', 'pending_approval');
END $$;

CREATE OR REPLACE FUNCTION taxguard_create_staff_invitation(
 p_tenant text, p_actor text, p_id text, p_email text, p_role text, p_first text, p_last text, p_token_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor_role text; expiry timestamptz := NOW() + interval '7 days';
BEGIN
 SELECT role INTO actor_role FROM taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor
   AND status='active' AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND mfa_reenrollment_required;
  IF FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM taxguard_identities WHERE tenant_id = p_tenant AND uid = p_actor AND user_data->>'id' = p_actor
    AND user_data->>'role' = actor_role AND user_data->>'status' = 'active' AND (NOT (user_data ? 'tenantId') OR user_data->>'tenantId' = p_tenant);
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
 IF p_email IS NULL OR p_email <> lower(trim(p_email)) OR length(p_email) > 255
   OR p_first IS NULL OR length(trim(p_first)) NOT BETWEEN 1 AND 128
   OR p_last IS NULL OR length(trim(p_last)) NOT BETWEEN 1 AND 128
   OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
   OR p_role IS NULL OR p_role NOT IN ('accountant','reviewer','senior_reviewer','bookkeeper','practice_manager','operations','admin') THEN
   RAISE EXCEPTION 'INVITATION_INPUT_INVALID' USING ERRCODE='P0001';
 END IF;
 -- Bound issuance across server processes and prevent simultaneous duplicates/expiry replacement.
 PERFORM pg_advisory_xact_lock(hashtext(p_tenant || ':staff-invite-actor:' || p_actor));
 PERFORM pg_advisory_xact_lock(hashtext(p_tenant || ':staff-invite-email:' || p_email));
 IF (SELECT count(*) FROM taxguard_staff_invitations WHERE tenant_id=p_tenant AND invited_by=p_actor
   AND created_at > NOW()-interval '1 hour') >= 10 THEN
   RAISE EXCEPTION 'INVITATION_RATE_LIMITED' USING ERRCODE='P0001';
 END IF;
 IF EXISTS (SELECT 1 FROM taxguard_identities WHERE lower(user_data->>'email')=p_email) THEN
   RAISE EXCEPTION 'IDENTITY_ALREADY_PROVISIONED' USING ERRCODE='P0001';
 END IF;
 -- Expired invitations remain historical, revoked records; only new issuance returns a new secret.
 WITH expired AS (
   UPDATE taxguard_staff_invitations SET status='revoked', revoked_by=p_actor, revoked_at=NOW()
     WHERE tenant_id=p_tenant AND email=p_email AND status='pending' AND expires_at<=NOW() RETURNING id
 ) INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
   SELECT p_tenant,'STAFF_INVITATION_EXPIRED',p_actor,actor_role,jsonb_build_object('invitationId',id) FROM expired;
 INSERT INTO taxguard_staff_invitations(id,tenant_id,email,role,legal_first_name,legal_last_name,token_hash,expires_at,invited_by)
   VALUES(p_id,p_tenant,p_email,p_role,trim(p_first),trim(p_last),p_token_hash,expiry,p_actor);
 INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
   VALUES(p_tenant,'STAFF_INVITATION_CREATED',p_actor,actor_role,jsonb_build_object('invitationId',p_id,'role',p_role,'expiresAt',expiry));
 RETURN jsonb_build_object('id',p_id,'expiresAt',expiry);
END $$;

CREATE OR REPLACE FUNCTION taxguard_revoke_staff_invitation(p_tenant text,p_actor text,p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor_role text; current_status text;
BEGIN
 SELECT role INTO actor_role FROM taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor
   AND status='active' AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND mfa_reenrollment_required;
  IF FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM taxguard_identities WHERE tenant_id = p_tenant AND uid = p_actor AND user_data->>'id' = p_actor
    AND user_data->>'role' = actor_role AND user_data->>'status' = 'active' AND (NOT (user_data ? 'tenantId') OR user_data->>'tenantId' = p_tenant);
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
 SELECT status INTO current_status FROM taxguard_staff_invitations WHERE tenant_id=p_tenant AND id=p_id FOR UPDATE;
 IF NOT FOUND OR current_status='accepted' THEN RAISE EXCEPTION 'INVITATION_REVOCATION_DENIED' USING ERRCODE='P0001'; END IF;
 IF current_status='revoked' THEN RETURN jsonb_build_object('status','revoked'); END IF;
 UPDATE taxguard_staff_invitations SET status='revoked',revoked_by=p_actor,revoked_at=NOW() WHERE tenant_id=p_tenant AND id=p_id;
 INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
   VALUES(p_tenant,'STAFF_INVITATION_REVOKED',p_actor,actor_role,jsonb_build_object('invitationId',p_id));
 RETURN jsonb_build_object('status','revoked');
END $$;

REVOKE ALL ON FUNCTION taxguard_change_staff_membership_status(text,text,text,text,text), taxguard_approve_staff_activation(text,text,text),
  taxguard_accept_staff_invitation(text,text,text,text), taxguard_create_staff_invitation(text,text,text,text,text,text,text,text),
  taxguard_revoke_staff_invitation(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION taxguard_change_staff_membership_status(text,text,text,text,text), taxguard_approve_staff_activation(text,text,text),
  taxguard_accept_staff_invitation(text,text,text,text), taxguard_create_staff_invitation(text,text,text,text,text,text,text,text),
  taxguard_revoke_staff_invitation(text,text,text) TO service_role;
