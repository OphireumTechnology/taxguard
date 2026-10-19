-- PROPOSAL (Phase 14, case-team restaffing). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 20261012250000 (practice management: staff assignments, actor, manager role), 20261012260000
-- (case workflow: cases, case assignments, case audit), 20261012330000 (tax calculation runs) and 20261018090000
-- (case access follows the live assignment).
--
-- Since 20261018090000 a case's recorded preparer and reviewer count only while they hold the live assignment, so a
-- replacement assignee could not act on an existing case and only a manager could. taxguard_case_restaff is the
-- reviewed operation that moves the case's preparer or reviewer to another person:
--   * practice managers and administrators of the tenant only (PRACTICE_MANAGER_REQUIRED), with a reason (10-500
--     characters) and the case's current version (CASE_VERSION_CONFLICT); the case must be ACTIVE or ON_HOLD;
--   * the new person must hold, now, an ACTIVE and effective assignment of that role covering the case's client,
--     engagement and year (CASE_ASSIGNEE_NOT_ASSIGNED), so restaffing never grants access by itself;
--   * segregation of duties (ASSIGNMENT_SEGREGATION_OF_DUTIES): the reviewer is never the current preparer, anyone
--     who was ever this case's preparer, or the requester of a tax calculation run still awaiting review; the
--     preparer is never the current reviewer;
--   * the case's stage history, attestations, notes and runs are untouched; the case version advances; the previous
--     person's case-assignment row is deactivated (kept, not deleted) and the new person's is activated; one
--     CASE_TEAM_CHANGED audit row records the role, previous and new person and the reason.
-- Rollback (development): drop taxguard_case_restaff. Restaffing already performed is a recorded, audited state.
-- Synthetic data only in tests.

CREATE OR REPLACE FUNCTION public.taxguard_case_restaff(p_tenant text, p_case text, p_actor text, p_role text, p_user text, p_version integer, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; c public.taxguard_cases; reason text := btrim(COALESCE(p_reason, '')); previous text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_case IS NULL OR p_case !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'PRACTICE_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_role NOT IN ('preparer','reviewer') OR p_user IS NULL OR p_user !~ '^[A-Za-z0-9_-]{1,128}$' OR length(reason) NOT BETWEEN 10 AND 500
     OR reason ~ '[[:cntrl:]]' OR p_version IS NULL THEN
    RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF c.version <> p_version THEN RAISE EXCEPTION 'CASE_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF c.status NOT IN ('ACTIVE','ON_HOLD') THEN RAISE EXCEPTION 'CASE_NOT_ACTIVE' USING ERRCODE = 'P0001'; END IF;
  previous := CASE p_role WHEN 'preparer' THEN c.preparer_uid ELSE c.reviewer_uid END;
  IF previous = p_user THEN RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  -- The new person must already hold the live assignment; locked so a concurrent revocation is ordered with this.
  PERFORM 1 FROM public.taxguard_staff_assignments a JOIN public.taxguard_members m ON m.tenant_id = a.tenant_id AND m.uid = a.user_id AND m.status = 'active'
    WHERE a.tenant_id = p_tenant AND a.client_id = c.client_id AND a.user_id = p_user AND a.role = p_role AND a.status = 'ACTIVE'
      AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now())
      AND (a.engagement_id IS NULL OR a.engagement_id = c.engagement_id) AND (a.tax_year IS NULL OR a.tax_year = c.tax_year)
    FOR SHARE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASE_ASSIGNEE_NOT_ASSIGNED' USING ERRCODE = 'P0001'; END IF;
  IF p_role = 'preparer' AND p_user = c.reviewer_uid THEN RAISE EXCEPTION 'ASSIGNMENT_SEGREGATION_OF_DUTIES' USING ERRCODE = 'P0001'; END IF;
  IF p_role = 'reviewer' AND (p_user = c.preparer_uid
      OR EXISTS (SELECT 1 FROM public.taxguard_case_assignments WHERE tenant_id = p_tenant AND case_id = p_case AND uid = p_user AND role = 'preparer')
      OR EXISTS (SELECT 1 FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND case_id = p_case AND requested_by = p_user AND status = 'COMPUTED')) THEN
    RAISE EXCEPTION 'ASSIGNMENT_SEGREGATION_OF_DUTIES' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.taxguard_cases SET preparer_uid = CASE WHEN p_role = 'preparer' THEN p_user ELSE preparer_uid END,
      reviewer_uid = CASE WHEN p_role = 'reviewer' THEN p_user ELSE reviewer_uid END, version = version + 1, updated_at = now(), updated_by = p_actor
    WHERE tenant_id = p_tenant AND case_id = p_case RETURNING * INTO c;
  UPDATE public.taxguard_case_assignments SET active = false WHERE tenant_id = p_tenant AND case_id = p_case AND uid = previous AND role = p_role;
  INSERT INTO public.taxguard_case_assignments(case_id, tenant_id, uid, role, assigned_by) VALUES (p_case, p_tenant, p_user, p_role, p_actor)
    ON CONFLICT (case_id, uid) DO UPDATE SET role = EXCLUDED.role, active = true, assigned_at = now(), assigned_by = EXCLUDED.assigned_by;
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, p_case, p_actor, r, 'CASE_TEAM_CHANGED',
    jsonb_build_object('role', p_role, 'previousUid', previous, 'newUid', p_user, 'reason', reason, 'version', c.version));
  RETURN jsonb_build_object('caseId', p_case, 'role', p_role, 'previousUid', previous, 'newUid', p_user, 'version', c.version);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_case_restaff(text,text,text,text,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_case_restaff(text,text,text,text,text,integer,text) TO service_role;
