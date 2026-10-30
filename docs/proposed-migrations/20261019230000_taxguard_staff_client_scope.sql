-- PROPOSAL (Block 80, engagement scope of five staff paths found by the function access inventory). REVIEW ONLY;
-- NOT APPLIED anywhere external.
-- Requires 20261012250000, 20261012260000, 20261014440000 and 20261016000000, which hold the current definitions below, 20261018060000 (taxguard_staff_scope) and 20261018100000 (taxguard_staff_record_scope and
-- taxguard_practice_item_scope).
--
-- Owner decision 2026-10-19 (as applied by 20261018060000 and 20261018100000): a staff member assigned to one engagement
-- and tax year reaches that client's records for that engagement and year only, unless independently authorized (a
-- client-wide assignment, a practice manager or an administrator). Block 79's inventory found five functions (four here) whose
-- staff path still decided per client (any active assignment to the client):
--   * taxguard_portal_case_stages: case stage, evidence counts and team flags of any engagement and year.
--     Now: a staff member out of scope reads PORTAL_ENGAGEMENT_NOT_FOUND, like a missing engagement.
--   * taxguard_portal_engagements: every engagement and year with its case status. Now: only those in scope.
--   * taxguard_portal_signature_packages: changed in the companion proposal 20261019231000, so that the client-portal
--     cutover does not wait for the signature package proposal 20261019190000.
--   * taxguard_practice_list_clients: per client, the engagement count, the whole team, open tasks and the next deadline
--     of every engagement and year. Now filtered as the practice client detail is (20261018100000): engagements by
--     engagement; team members by their assignment's engagement and year, plus the actor's own assignments; tasks
--     assigned to or created by the actor, or in scope; deadlines in scope.
--   * taxguard_case_create: only the engagement-year preparer (or a manager) could create the case, but the checks before
--     that answered CASE_ALREADY_EXISTS, a replay, ENGAGEMENT_NOT_ACTIVE or TAX_YEAR_NOT_FOUND to anyone with
--     client-level access. Now: out of scope is refused first with CASE_CREATE_NOT_AUTHORIZED.
-- Clients are unchanged: their paths keep their own rules. Managers and administrators are unchanged
-- (taxguard_staff_scope and taxguard_staff_record_scope admit them). Each function is identical to its current
-- definition except for the change named above it.
-- Rollback (development): re-apply the listed proposals' definitions.

-- Current definition: 20261016000000. Changed: staff path: the requested engagement and year must be in scope.
CREATE OR REPLACE FUNCTION public.taxguard_portal_case_stages(p_tenant text, p_client text, p_actor text, p_engagement text, p_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; c public.taxguard_cases; e public.taxguard_engagements; policy jsonb; checks jsonb;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF p_engagement IS NULL OR p_engagement !~ '^[A-Za-z0-9_-]{1,128}$' OR p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'PORTAL_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF r <> 'client' AND NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, p_engagement, p_year) THEN
    RAISE EXCEPTION 'PORTAL_ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO e FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement;
  -- Clients never see draft or cancelled engagements (same rule as proposal 044).
  IF NOT FOUND OR (r = 'client' AND e.status IN ('draft','cancelled')) THEN RAISE EXCEPTION 'PORTAL_ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement AND tax_year = p_year;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('engagementId', p_engagement, 'taxYear', p_year, 'caseExists', false);
  END IF;
  policy := public.taxguard_case_stage_policy(c.active_stage);
  IF c.active_stage <= 8 AND policy->>'evidence' = 'SYSTEM_VERIFIED' THEN
    -- Booleans only: the system checks already contain no amounts; re-filter defensively.
    SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO checks FROM jsonb_each(public.taxguard_case_system_checks(c)) AS x(k, v) WHERE jsonb_typeof(v) = 'boolean';
  END IF;
  RETURN jsonb_build_object(
    'engagementId', p_engagement, 'taxYear', p_year, 'caseExists', true,
    'caseStatus', c.status, 'activeStage', c.active_stage, 'updatedAt', c.updated_at,
    'activeStagePolicy', CASE WHEN c.active_stage <= 8 THEN jsonb_build_object('evidence', policy->>'evidence', 'checklist', COALESCE(policy->'checklist', '[]'::jsonb)) END,
    'activeStageChecks', checks,
    'stages', (SELECT COALESCE(jsonb_agg(jsonb_build_object('stage', s.stage_number, 'status', s.status,
        'completedAt', CASE WHEN s.status = 'COMPLETED' THEN s.approved_at END) ORDER BY s.stage_number), '[]'::jsonb)
      FROM public.taxguard_stage_states s WHERE s.tenant_id = c.tenant_id AND s.case_id = c.case_id AND s.stage_number <= 8),
    'evidence', jsonb_build_object(
      'verifiedDocuments', (SELECT count(*) FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.client_id = p_client AND d.engagement_id = p_engagement AND d.tax_year = p_year AND d.status = 'VERIFIED'),
      'documentsInReview', (SELECT count(*) FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.client_id = p_client AND d.engagement_id = p_engagement AND d.tax_year = p_year AND d.status IN ('SCAN_PENDING','PENDING_REVIEW')),
      'documentsNeedingAction', (SELECT count(*) FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.client_id = p_client AND d.engagement_id = p_engagement AND d.tax_year = p_year AND d.status IN ('REJECTED','REPLACEMENT_REQUESTED','REJECTED_MALWARE')
        AND NOT EXISTS (SELECT 1 FROM public.taxguard_documents n WHERE n.tenant_id = d.tenant_id AND n.client_id = d.client_id AND n.document_id = d.document_id AND n.version > d.version)),
      'openDocumentRequests', (SELECT count(*) FROM public.taxguard_doc_requests q WHERE q.tenant_id = p_tenant AND q.client_id = p_client AND q.engagement_id = p_engagement AND q.tax_year = p_year AND q.status IN ('OPEN','SUBMITTED'))),
    'team', jsonb_build_object(
      'preparerAssigned', EXISTS (SELECT 1 FROM public.taxguard_staff_assignments a WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.engagement_id = p_engagement AND a.tax_year = p_year AND a.role = 'preparer' AND a.status = 'ACTIVE'),
      'reviewerAssigned', EXISTS (SELECT 1 FROM public.taxguard_staff_assignments a WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.engagement_id = p_engagement AND a.tax_year = p_year AND a.role = 'reviewer' AND a.status = 'ACTIVE'),
      'independentReview', c.preparer_uid IS DISTINCT FROM c.reviewer_uid));
END $$;

-- Current definition: 20261014440000. Changed: staff path: only engagements and years in scope.
CREATE OR REPLACE FUNCTION public.taxguard_portal_engagements(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('engagementId', e.engagement_id, 'title', e.title, 'type', e.type, 'engagementStatus', e.status,
      'taxYear', y.tax_year, 'yearStatus', y.status, 'caseStatus', c.status, 'activeStage', c.active_stage,
      'updatedAt', GREATEST(e.updated_at, y.updated_at, COALESCE(c.updated_at, e.updated_at))) ORDER BY y.tax_year DESC, e.created_at DESC), '[]'::jsonb)
    FROM public.taxguard_engagements e
    JOIN public.taxguard_tax_years y ON y.tenant_id = e.tenant_id AND y.client_id = e.client_id AND y.engagement_id = e.engagement_id
    LEFT JOIN public.taxguard_cases c ON c.tenant_id = e.tenant_id AND c.client_id = e.client_id AND c.engagement_id = e.engagement_id AND c.tax_year = y.tax_year
    WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND (r <> 'client' OR e.status NOT IN ('draft','cancelled'))
      AND (r = 'client' OR public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, e.engagement_id, y.tax_year)));
END $$;

-- Current definition: 20261012250000. Changed: per-client counts and team limited to the actor's scope, as in the client detail.
CREATE OR REPLACE FUNCTION public.taxguard_practice_list_clients(p_tenant text, p_actor text, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; f jsonb := COALESCE(p_filter, '{}'::jsonb); lim integer; q text; after text; st text; ty text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  lim := COALESCE((f->>'limit')::integer, 25); q := NULLIF(lower(btrim(f->>'q')), ''); after := NULLIF(f->>'after', '');
  st := NULLIF(f->>'status', ''); ty := NULLIF(f->>'clientType', '');
  IF lim NOT BETWEEN 1 AND 100 OR length(COALESCE(q, '')) > 100 OR (st IS NOT NULL AND st NOT IN ('active','archived')) THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  RETURN (SELECT COALESCE(jsonb_agg(row_data ORDER BY cid COLLATE "C"), '[]'::jsonb) FROM (
    SELECT c.client_id AS cid, jsonb_build_object('clientId', c.client_id, 'name', c.name, 'email', c.email, 'clientType', c.client_type, 'status', c.status,
      'engagements', (SELECT count(*) FROM public.taxguard_engagements e WHERE e.tenant_id = c.tenant_id AND e.client_id = c.client_id AND e.status IN ('draft','active','on_hold')
        AND public.taxguard_staff_record_scope(p_tenant, c.client_id, p_actor, r, e.engagement_id, NULL)),
      'team', (SELECT COALESCE(jsonb_agg(jsonb_build_object('role', s.role, 'userId', s.user_id, 'engagementId', s.engagement_id, 'taxYear', s.tax_year) ORDER BY s.role, s.user_id), '[]'::jsonb)
        FROM public.taxguard_staff_assignments s WHERE s.tenant_id = c.tenant_id AND s.client_id = c.client_id AND s.status = 'ACTIVE'
          AND (s.user_id = p_actor OR public.taxguard_staff_record_scope(p_tenant, c.client_id, p_actor, r, s.engagement_id, s.tax_year))),
      'openTasks', (SELECT count(*) FROM public.taxguard_practice_tasks t WHERE t.tenant_id = c.tenant_id AND t.client_id = c.client_id AND t.status NOT IN ('COMPLETED','CANCELLED')
        AND (t.assigned_user_id = p_actor OR t.created_by = p_actor
          OR public.taxguard_practice_item_scope(p_tenant, c.client_id, p_actor, r, t.case_id, t.engagement_id, t.tax_year))),
      'nextDeadline', (SELECT min(d.due_date) FROM public.taxguard_deadlines d WHERE d.tenant_id = c.tenant_id AND d.client_id = c.client_id AND d.status = 'PENDING'
        AND public.taxguard_practice_item_scope(p_tenant, c.client_id, p_actor, r, d.case_id, NULL, d.tax_year))) AS row_data
    FROM public.taxguard_clients c
    WHERE c.tenant_id = p_tenant AND public.taxguard_practice_can_see(p_tenant, c.client_id, p_actor, r)
      AND (st IS NULL OR c.status = st) AND (ty IS NULL OR c.client_type = ty)
      AND (q IS NULL OR position(q IN lower(c.client_id || ' ' || COALESCE(c.name, '') || ' ' || COALESCE(c.email, ''))) > 0)
      AND (after IS NULL OR c.client_id COLLATE "C" > after COLLATE "C")
    ORDER BY c.client_id COLLATE "C" LIMIT lim) page);
EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
END $$;

-- Current definition: 20261012260000. Changed: the engagement and year must be in scope before anything about them is answered.
CREATE OR REPLACE FUNCTION public.taxguard_case_create(p_tenant text, p_client text, p_actor text, p_engagement text, p_year integer, p_case text, p_family text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; prep text; rev text; owner_uid text; existing record; s integer;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false);
  IF p_case IS NULL OR p_case !~ '^[A-Za-z0-9_-]{8,128}$' OR p_year IS NULL OR p_family NOT IN ('1040','1041','1065','1120','1120S','990','706','709') THEN
    RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, p_engagement, p_year) THEN
    RAISE EXCEPTION 'CASE_CREATE_NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO existing FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement AND tax_year = p_year;
  IF FOUND THEN
    IF existing.case_id = p_case THEN RETURN jsonb_build_object('caseId', p_case, 'created', false); END IF;
    RAISE EXCEPTION 'CASE_ALREADY_EXISTS' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENGAGEMENT_NOT_ACTIVE' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.taxguard_tax_years WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement AND tax_year = p_year AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_YEAR_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT user_id INTO prep FROM public.taxguard_staff_assignments WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement
    AND tax_year = p_year AND role = 'preparer' AND status = 'ACTIVE' FOR SHARE;
  SELECT user_id INTO rev FROM public.taxguard_staff_assignments WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement
    AND tax_year = p_year AND role = 'reviewer' AND status = 'ACTIVE' FOR SHARE;
  IF prep IS NULL OR rev IS NULL THEN RAISE EXCEPTION 'CASE_TEAM_INCOMPLETE' USING ERRCODE = 'P0001'; END IF;
  IF prep = rev THEN RAISE EXCEPTION 'ASSIGNMENT_SEGREGATION_OF_DUTIES' USING ERRCODE = 'P0001'; END IF;
  IF NOT public.taxguard_practice_is_manager(r) AND p_actor <> prep THEN RAISE EXCEPTION 'CASE_CREATE_NOT_AUTHORIZED' USING ERRCODE = 'P0001'; END IF;
  SELECT c.owner_uid INTO owner_uid FROM public.taxguard_clients c WHERE c.tenant_id = p_tenant AND c.client_id = p_client;
  BEGIN
    INSERT INTO public.taxguard_cases(case_id, tenant_id, client_id, engagement_id, tax_year, status, active_stage, client_uid, preparer_uid, reviewer_uid, return_family, created_by, updated_by)
      VALUES (p_case, p_tenant, p_client, p_engagement, p_year, 'ACTIVE', 1, owner_uid, prep, rev, p_family, p_actor, p_actor);
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'CASE_ALREADY_EXISTS' USING ERRCODE = 'P0001';
  END;
  INSERT INTO public.taxguard_case_assignments(case_id, tenant_id, uid, role, assigned_by) VALUES (p_case, p_tenant, prep, 'preparer', p_actor), (p_case, p_tenant, rev, 'reviewer', p_actor);
  FOR s IN 1..18 LOOP
    INSERT INTO public.taxguard_stage_states(case_id, tenant_id, stage_number, status) VALUES (p_case, p_tenant, s, CASE WHEN s = 1 THEN 'IN_PROGRESS' ELSE 'LOCKED' END);
  END LOOP;
  INSERT INTO public.taxguard_case_stage_events(tenant_id, case_id, action, to_stage, actor_uid, actor_role) VALUES (p_tenant, p_case, 'CREATED', 1, p_actor, r);
  PERFORM public.taxguard_case_audit(p_tenant, p_client, p_case, p_actor, r, 'CASE_CREATED', jsonb_build_object('engagementId', p_engagement, 'taxYear', p_year, 'returnFamily', p_family));
  RETURN jsonb_build_object('caseId', p_case, 'created', true);
END $$;

REVOKE ALL ON FUNCTION public.taxguard_portal_case_stages(text,text,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_portal_case_stages(text,text,text,text,integer) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_portal_engagements(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_portal_engagements(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_practice_list_clients(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_practice_list_clients(text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_case_create(text,text,text,text,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_case_create(text,text,text,text,integer,text,text) TO service_role;
