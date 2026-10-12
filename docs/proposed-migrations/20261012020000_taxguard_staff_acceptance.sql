-- PROPOSAL ONLY. NOT APPLIED. Follows staff invitations and session assurance proposals.
-- Service role RPC only; external identity, email and MFA are verified by the server.
ALTER TABLE taxguard_staff_invitations ADD CONSTRAINT chk_taxguard_invitation_email_normalized
  CHECK (email = lower(trim(email)));
CREATE OR REPLACE FUNCTION taxguard_accept_staff_invitation(
  p_tenant text, p_token_hash text, p_uid text, p_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE invitation taxguard_staff_invitations%ROWTYPE; result jsonb;
BEGIN
  SELECT * INTO invitation FROM taxguard_staff_invitations
    WHERE tenant_id = p_tenant AND token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR invitation.status <> 'pending' OR invitation.expires_at <= NOW()
    OR lower(invitation.email) <> lower(trim(p_email)) THEN
    RAISE EXCEPTION 'INVITATION_INVALID' USING ERRCODE = 'P0001';
  END IF;
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
REVOKE ALL ON FUNCTION taxguard_accept_staff_invitation(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION taxguard_accept_staff_invitation(text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION taxguard_approve_staff_activation(p_tenant text, p_actor text, p_uid text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE member taxguard_members%ROWTYPE; actor_role text;
BEGIN
  SELECT role INTO actor_role FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor
    AND status = 'active' AND role IN ('admin', 'administrator', 'super_admin', 'super_administrator') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO member FROM taxguard_members WHERE tenant_id = p_tenant AND uid = p_uid FOR UPDATE;
  IF NOT FOUND OR member.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'ACTIVATION_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;
  IF member.invited_by IS NULL OR member.invited_by = p_actor OR p_actor = p_uid THEN
    RAISE EXCEPTION 'INDEPENDENT_APPROVER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  UPDATE taxguard_members SET status = 'active', approved_by = p_actor, approved_at = NOW(), updated_at = NOW()
    WHERE tenant_id = p_tenant AND uid = p_uid;
  UPDATE taxguard_identities SET user_data = jsonb_set(user_data, '{status}', '"active"')
    WHERE tenant_id = p_tenant AND uid = p_uid;
  INSERT INTO taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES(p_tenant, 'STAFF_ACTIVATION_APPROVED', p_actor, actor_role, jsonb_build_object('uid', p_uid));
  RETURN jsonb_build_object('status', 'active');
END $$;
REVOKE ALL ON FUNCTION taxguard_approve_staff_activation(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION taxguard_approve_staff_activation(text,text,text) TO service_role;
