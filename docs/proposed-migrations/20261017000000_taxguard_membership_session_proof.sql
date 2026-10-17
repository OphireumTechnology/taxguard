-- PROPOSAL (Phase 13B, staff identity). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 034 (taxguard_privileged_session) and 035 (hardened membership functions).
--
-- Closes the remaining gap recorded in mfa-recovery-completion.md: invitation create / revoke,
-- activation approval and membership status changes required a recent AAL2 sign-in only in the
-- service, checked in a separate transaction before the database function ran. A session revoked
-- or an administrator gated between the two could still complete the change.
--
-- Each wrapper below verifies the actor's live durable AAL2 session (named by its token hash, signed
-- in after the actor's status epoch and within taxguard_privileged_max_age_seconds()) in the SAME
-- transaction as the change. taxguard_privileged_session takes FOR SHARE NOWAIT locks on the actor's
-- member, identity and session rows, so a concurrent revocation or suspension either commits first
-- (the change is refused) or waits until the change commits; contention is a retryable 55P03.
-- The 035 functions are unchanged but no longer executable by service_role: the wrappers are the
-- only entry points. Error codes are the existing ones (STAFF_ADMIN_REQUIRED,
-- STAFF_FRESH_SIGN_IN_REQUIRED, STAFF_RECENT_SIGN_IN_REQUIRED, then the 035 codes).
-- Rollback (development): drop the four wrappers and re-grant the 035 functions to service_role.

CREATE OR REPLACE FUNCTION public.taxguard_create_staff_invitation_proven(
  p_tenant text, p_actor text, p_actor_session_hash text, p_id text, p_email text, p_role text, p_first text, p_last text, p_token_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_privileged_session(p_tenant, p_actor, p_actor_session_hash, ARRAY['admin','administrator','super_admin','super_administrator']);
  RETURN public.taxguard_create_staff_invitation(p_tenant, p_actor, p_id, p_email, p_role, p_first, p_last, p_token_hash);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_revoke_staff_invitation_proven(
  p_tenant text, p_actor text, p_actor_session_hash text, p_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_privileged_session(p_tenant, p_actor, p_actor_session_hash, ARRAY['admin','administrator','super_admin','super_administrator']);
  RETURN public.taxguard_revoke_staff_invitation(p_tenant, p_actor, p_id);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_approve_staff_activation_proven(
  p_tenant text, p_actor text, p_actor_session_hash text, p_uid text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_privileged_session(p_tenant, p_actor, p_actor_session_hash, ARRAY['admin','administrator','super_admin','super_administrator']);
  RETURN public.taxguard_approve_staff_activation(p_tenant, p_actor, p_uid);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_change_staff_membership_status_proven(
  p_tenant text, p_actor text, p_actor_session_hash text, p_uid text, p_action text, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_privileged_session(p_tenant, p_actor, p_actor_session_hash, ARRAY['admin','administrator','super_admin','super_administrator']);
  RETURN public.taxguard_change_staff_membership_status(p_tenant, p_actor, p_uid, p_action, p_reason);
END $$;

REVOKE ALL ON FUNCTION public.taxguard_create_staff_invitation(text,text,text,text,text,text,text,text), public.taxguard_revoke_staff_invitation(text,text,text),
  public.taxguard_approve_staff_activation(text,text,text), public.taxguard_change_staff_membership_status(text,text,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.taxguard_create_staff_invitation_proven(text,text,text,text,text,text,text,text,text), public.taxguard_revoke_staff_invitation_proven(text,text,text,text),
  public.taxguard_approve_staff_activation_proven(text,text,text,text), public.taxguard_change_staff_membership_status_proven(text,text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_create_staff_invitation_proven(text,text,text,text,text,text,text,text,text), public.taxguard_revoke_staff_invitation_proven(text,text,text,text),
  public.taxguard_approve_staff_activation_proven(text,text,text,text), public.taxguard_change_staff_membership_status_proven(text,text,text,text,text,text)
  TO service_role;
