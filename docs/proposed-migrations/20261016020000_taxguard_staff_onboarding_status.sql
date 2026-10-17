-- PROPOSAL (Phase 13A, contract C4). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 008-012 (staff invitations, acceptance, membership lifecycle) and 025 (assignments).
--
-- Durable staff onboarding status for the SIGNED-IN staff member only. The server passes the uid of
-- a verified provider identity; no caller can ask about another person. Works before activation
-- (membership pending_approval) so a newly invited professional can see what is outstanding.
-- Returned: membership status and role, invitation acceptance time, the counts of active
-- assignments and distinct assigned clients. Never returned: who invited or approved, other
-- members, invitation tokens or e-mail addresses, client identities or names.
-- MFA state is NOT stored here: the server adds it from the verified token (assurance level and
-- verified factor count) and from taxguard_mfa_recovery_step. No credential or factor is created,
-- read or reset by this function. A professional dossier (credentials, PTIN/EFIN, jurisdictions)
-- is out of scope until the owner approves its data, verification and retention model.
-- Idempotent: CREATE OR REPLACE only. Rollback: DROP FUNCTION public.taxguard_staff_onboarding_status(text,text).

CREATE OR REPLACE FUNCTION public.taxguard_staff_onboarding_status(p_tenant text, p_uid text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE m public.taxguard_members; accepted timestamptz;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_uid IS NULL OR p_uid !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RAISE EXCEPTION 'STAFF_ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id = p_tenant AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ONBOARDING_TENANT_UNAVAILABLE' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO m FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('membershipStatus', 'NONE'); END IF;
  -- Clients and prospects are not staff: they have no staff onboarding.
  IF m.role IN ('client', 'prospective_client') THEN RETURN jsonb_build_object('membershipStatus', 'NOT_STAFF'); END IF;
  SELECT max(accepted_at) INTO accepted FROM public.taxguard_staff_invitations WHERE tenant_id = p_tenant AND accepted_uid = p_uid AND status = 'accepted';
  RETURN jsonb_build_object(
    'membershipStatus', m.status, 'role', m.role, 'memberSince', m.created_at, 'invitationAcceptedAt', accepted,
    'activeAssignments', (SELECT count(*) FROM public.taxguard_staff_assignments a WHERE a.tenant_id = p_tenant AND a.user_id = p_uid AND a.status = 'ACTIVE'),
    'assignedClients', (SELECT count(DISTINCT a.client_id) FROM public.taxguard_staff_assignments a WHERE a.tenant_id = p_tenant AND a.user_id = p_uid AND a.status = 'ACTIVE'));
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'taxguard_staff_onboarding_status' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
