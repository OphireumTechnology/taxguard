-- PROPOSAL ONLY. NOT APPLIED. Requires prior staff invitation and acceptance proposals.
-- Issuance, expiry replacement, revocation, rate limits and audit share a transaction.
CREATE OR REPLACE FUNCTION taxguard_create_staff_invitation(
 p_tenant text, p_actor text, p_id text, p_email text, p_role text, p_first text, p_last text, p_token_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_role text; expiry timestamptz := NOW() + interval '7 days';
BEGIN
 SELECT role INTO actor_role FROM taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor
   AND status='active' AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
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
REVOKE ALL ON FUNCTION taxguard_create_staff_invitation(text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION taxguard_create_staff_invitation(text,text,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION taxguard_revoke_staff_invitation(p_tenant text,p_actor text,p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor_role text; current_status text;
BEGIN
 SELECT role INTO actor_role FROM taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor
   AND status='active' AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
 SELECT status INTO current_status FROM taxguard_staff_invitations WHERE tenant_id=p_tenant AND id=p_id FOR UPDATE;
 IF NOT FOUND OR current_status='accepted' THEN RAISE EXCEPTION 'INVITATION_REVOCATION_DENIED' USING ERRCODE='P0001'; END IF;
 IF current_status='revoked' THEN RETURN jsonb_build_object('status','revoked'); END IF;
 UPDATE taxguard_staff_invitations SET status='revoked',revoked_by=p_actor,revoked_at=NOW() WHERE tenant_id=p_tenant AND id=p_id;
 INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
   VALUES(p_tenant,'STAFF_INVITATION_REVOKED',p_actor,actor_role,jsonb_build_object('invitationId',p_id));
 RETURN jsonb_build_object('status','revoked');
END $$;
REVOKE ALL ON FUNCTION taxguard_revoke_staff_invitation(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION taxguard_revoke_staff_invitation(text,text,text) TO service_role;
