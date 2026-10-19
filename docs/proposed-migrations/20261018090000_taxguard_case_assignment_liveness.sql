-- PROPOSAL (Phase 14, case assignment liveness). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 20261012250000 (practice management: staff assignments), 20261012260000 (case workflow),
-- 20261012320000 (role dashboards) and 20261012330000 (tax engine foundation), which hold the current definitions below.
--
-- Defect: a case records its preparer and reviewer when it is created (taxguard_case_create copies the ACTIVE
-- assignments), and taxguard_case_actor then authorized on those recorded names only. Revoking or expiring the
-- assignment (taxguard_practice_unassign, effective_to) did not end access: the former preparer or reviewer could
-- still read the case, add notes, advance stages (including the reviewer's human attestations), return it to an
-- earlier stage, hold it, and see it in the case queue, status counts and dashboard. The tax calculation runs
-- (taxguard_tax_run_list, _record, _review) authorized the same way, so a revoked reviewer could still approve a
-- computed run and a revoked preparer could still record and read runs.
-- Fix: a named preparer or reviewer must also hold, now, an ACTIVE and effective assignment of that role covering
-- the case's client, engagement and tax year (an assignment with no engagement or year covers all, as in
-- taxguard_staff_scope). Managers and administrators are unchanged. The recorded names are unchanged, so the
-- two-person rule and every stage check keep using them. Refusals keep CASE_NOT_FOUND.
-- Not changed: a newly assigned replacement does not become the case's preparer or reviewer; restaffing a case to
-- a different person needs a reviewed case-team operation (recorded as the next package). Until then a manager
-- can act on the case.
-- Each function below is identical to its current definition except for the change named above it.
-- Rollback (development): re-apply the listed proposals' definitions and drop taxguard_case_slot_live.

CREATE OR REPLACE FUNCTION public.taxguard_case_slot_live(p_tenant text, p_client text, p_engagement text, p_year integer, p_preparer text, p_reviewer text,
  p_actor text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT p_actor IS NOT NULL AND EXISTS (SELECT 1 FROM public.taxguard_staff_assignments a
    WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.user_id = p_actor AND a.status = 'ACTIVE'
      AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now())
      AND (a.engagement_id IS NULL OR a.engagement_id = p_engagement) AND (a.tax_year IS NULL OR a.tax_year = p_year)
      AND ((p_actor = p_preparer AND a.role = 'preparer') OR (p_actor = p_reviewer AND a.role = 'reviewer'))) $$;
REVOKE ALL ON FUNCTION public.taxguard_case_slot_live(text,text,text,integer,text,text,text) FROM PUBLIC, anon, authenticated, service_role;

-- Current definition: 20261012260000. Changed: a named preparer or reviewer needs the live assignment for that role (otherwise CASE_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_case_actor(p_tenant text, p_case text, p_actor text, OUT actor_role text, OUT c public.taxguard_cases)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  actor_role := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_case IS NULL OR p_case !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case;
  IF NOT FOUND OR NOT (public.taxguard_practice_is_manager(actor_role) OR public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor)) THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
END $$;

-- Current definition: 20261012260000. Changed: non-managers see only cases where they hold the live assignment for their named role.
CREATE OR REPLACE FUNCTION public.taxguard_case_queue(p_tenant text, p_actor text, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; f jsonb := COALESCE(p_filter, '{}'::jsonb); lim integer; manager boolean;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  manager := public.taxguard_practice_is_manager(r);
  lim := COALESCE((f->>'limit')::integer, 50);
  IF lim NOT BETWEEN 1 AND 200 OR (f->>'role' IS NOT NULL AND f->>'role' NOT IN ('preparer','reviewer')) THEN RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(row_data ORDER BY cid COLLATE "C"), '[]'::jsonb) FROM (
    SELECT c.case_id AS cid, jsonb_build_object('caseId', c.case_id, 'clientId', c.client_id, 'clientName', cl.name, 'engagementId', c.engagement_id, 'taxYear', c.tax_year,
      'returnFamily', c.return_family, 'status', c.status, 'activeStage', c.active_stage, 'preparerUid', c.preparer_uid, 'reviewerUid', c.reviewer_uid, 'version', c.version,
      'myRole', CASE WHEN c.preparer_uid = p_actor THEN 'preparer' WHEN c.reviewer_uid = p_actor THEN 'reviewer' ELSE 'manager' END,
      'awaitingReviewer', public.taxguard_case_stage_policy(c.active_stage)->>'evidence' = 'HUMAN_ATTESTED',
      'blockedDependency', public.taxguard_case_stage_policy(c.active_stage)->>'dependency',
      'nextDeadline', (SELECT min(d.due_date) FROM public.taxguard_deadlines d WHERE d.tenant_id = c.tenant_id AND d.case_id = c.case_id AND d.status = 'PENDING'),
      'openTasks', (SELECT count(*) FROM public.taxguard_practice_tasks t WHERE t.tenant_id = c.tenant_id AND t.case_id = c.case_id AND t.status NOT IN ('COMPLETED','CANCELLED'))) AS row_data
    FROM public.taxguard_cases c JOIN public.taxguard_clients cl ON cl.tenant_id = c.tenant_id AND cl.client_id = c.client_id
    WHERE c.tenant_id = p_tenant AND (manager OR public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor))
      AND (f->>'role' IS NULL OR (f->>'role' = 'preparer' AND c.preparer_uid = p_actor) OR (f->>'role' = 'reviewer' AND c.reviewer_uid = p_actor))
      AND (f->>'stage' IS NULL OR c.active_stage = (f->>'stage')::integer) AND (f->>'status' IS NULL OR c.status = f->>'status')
      AND (f->>'taxYear' IS NULL OR c.tax_year = (f->>'taxYear')::integer) AND (f->>'after' IS NULL OR c.case_id COLLATE "C" > (f->>'after') COLLATE "C")
    ORDER BY c.case_id COLLATE "C" LIMIT lim) q);
EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001';
END $$;

-- Current definition: 20261012260000. Changed: non-managers count only cases where they hold the live assignment for their named role.
CREATE OR REPLACE FUNCTION public.taxguard_case_status_report(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; manager boolean;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  manager := public.taxguard_practice_is_manager(r);
  RETURN jsonb_build_object(
    'byStage', (SELECT COALESCE(jsonb_object_agg(active_stage::text, n), '{}'::jsonb) FROM (SELECT active_stage, count(*) n FROM public.taxguard_cases
      WHERE tenant_id = p_tenant AND status IN ('ACTIVE','ON_HOLD') AND (manager OR public.taxguard_case_slot_live(p_tenant, client_id, engagement_id, tax_year, preparer_uid, reviewer_uid, p_actor)) GROUP BY active_stage) s),
    'byStatus', (SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb) FROM (SELECT status, count(*) n FROM public.taxguard_cases
      WHERE tenant_id = p_tenant AND (manager OR public.taxguard_case_slot_live(p_tenant, client_id, engagement_id, tax_year, preparer_uid, reviewer_uid, p_actor)) GROUP BY status) s));
END $$;

-- Current definition: 20261012320000. Changed: case work lists only cases where the actor holds the live assignment for its named role.
CREATE OR REPLACE FUNCTION public.taxguard_dash_my_work(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF r = 'bookkeeper' THEN RAISE EXCEPTION 'DASHBOARD_ROLE_NOT_SUPPORTED' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object(
    'actorRole', r,
    'cases', (SELECT COALESCE(jsonb_agg(jsonb_build_object('caseId', c.case_id, 'clientId', c.client_id, 'clientName', cl.name, 'taxYear', c.tax_year, 'activeStage', c.active_stage,
        'status', c.status, 'myRole', CASE WHEN c.reviewer_uid = p_actor THEN 'reviewer' ELSE 'preparer' END, 'evidence', public.taxguard_case_stage_policy(c.active_stage)->>'evidence',
        'awaitingMe', c.status = 'ACTIVE' AND CASE public.taxguard_case_stage_policy(c.active_stage)->>'evidence'
          WHEN 'HUMAN_ATTESTED' THEN c.reviewer_uid = p_actor WHEN 'SYSTEM_VERIFIED' THEN c.preparer_uid = p_actor ELSE false END,
        'updatedAt', c.updated_at) ORDER BY c.updated_at DESC), '[]'::jsonb)
      FROM public.taxguard_cases c JOIN public.taxguard_clients cl ON cl.tenant_id = c.tenant_id AND cl.client_id = c.client_id
      WHERE c.tenant_id = p_tenant AND public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor) AND c.status IN ('ACTIVE','ON_HOLD')),
    'documentsToReview', (SELECT COALESCE(jsonb_agg(jsonb_build_object('documentId', d.document_id, 'version', d.version, 'clientId', d.client_id, 'fileName', d.file_name,
        'taxYear', d.tax_year, 'uploadedAt', d.created_at) ORDER BY d.created_at), '[]'::jsonb)
      FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.status = 'PENDING_REVIEW' AND d.quarantine_status = 'CLEAN' AND d.created_by <> p_actor
        AND EXISTS (SELECT 1 FROM public.taxguard_staff_assignments s WHERE s.tenant_id = d.tenant_id AND s.client_id = d.client_id AND s.user_id = p_actor
          AND s.status = 'ACTIVE' AND s.effective_from <= now() AND (s.effective_to IS NULL OR s.effective_to > now()))),
    'requestsOutstanding', (SELECT COALESCE(jsonb_agg(jsonb_build_object('requestId', q.request_id, 'clientId', q.client_id, 'title', q.title, 'taxYear', q.tax_year,
        'status', q.status, 'required', q.required, 'dueDate', q.due_date, 'overdue', q.due_date IS NOT NULL AND q.due_date < current_date) ORDER BY q.due_date NULLS LAST), '[]'::jsonb)
      FROM public.taxguard_doc_requests q WHERE q.tenant_id = p_tenant AND q.status IN ('OPEN','SUBMITTED')
        AND EXISTS (SELECT 1 FROM public.taxguard_staff_assignments s WHERE s.tenant_id = q.tenant_id AND s.client_id = q.client_id AND s.engagement_id = q.engagement_id
          AND s.tax_year = q.tax_year AND s.user_id = p_actor AND s.status = 'ACTIVE')),
    'entriesAwaitingMyReview', (SELECT COALESCE(jsonb_agg(jsonb_build_object('entryId', e.entry_id, 'clientId', e.client_id, 'entryNumber', e.entry_number, 'description', e.description,
        'postingDate', e.posting_date) ORDER BY e.posting_date), '[]'::jsonb)
      FROM public.taxguard_ledger_entries e WHERE e.tenant_id = p_tenant AND e.status = 'PREPARED' AND e.creator_uid <> p_actor
        AND EXISTS (SELECT 1 FROM public.taxguard_staff_assignments s WHERE s.tenant_id = e.tenant_id AND s.client_id = e.client_id AND s.user_id = p_actor
          AND s.role IN ('reviewer','senior_reviewer') AND s.status = 'ACTIVE')),
    'entriesReturnedToMe', (SELECT COALESCE(jsonb_agg(jsonb_build_object('entryId', e.entry_id, 'clientId', e.client_id, 'entryNumber', e.entry_number, 'description', e.description)
        ORDER BY e.posting_date), '[]'::jsonb)
      FROM public.taxguard_ledger_entries e WHERE e.tenant_id = p_tenant AND e.status = 'CORRECTION_REQUIRED' AND e.creator_uid = p_actor),
    'bookToTaxAwaitingReview', (SELECT count(*) FROM (
        SELECT client_id FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND status = 'PENDING_REVIEW' AND prepared_by <> p_actor
        UNION ALL SELECT client_id FROM public.taxguard_b2t_adjustments WHERE tenant_id = p_tenant AND status = 'PREPARED' AND prepared_by <> p_actor) x
      WHERE EXISTS (SELECT 1 FROM public.taxguard_staff_assignments s WHERE s.tenant_id = p_tenant AND s.client_id = x.client_id AND s.user_id = p_actor AND s.role = 'reviewer' AND s.status = 'ACTIVE')),
    'definitions', jsonb_build_object(
      'cases', 'Active or on-hold cases where you are the assigned preparer or reviewer; awaitingMe = the current stage is completed by your role.',
      'documentsToReview', 'Clean documents awaiting staff review for clients you are currently assigned to, excluding your own uploads.',
      'requestsOutstanding', 'Open or submitted document requests for engagement years you are assigned to.',
      'entriesAwaitingMyReview', 'Prepared ledger entries for clients where you are an assigned reviewer, created by someone else.',
      'entriesReturnedToMe', 'Ledger entries you created that a reviewer returned for correction.',
      'bookToTaxAwaitingReview', 'Book-to-tax mapping sets submitted for review and prepared adjustments for clients where you are the assigned reviewer.'));
END $$;

-- Current definition: 20261012330000. Changed: a named preparer or reviewer needs the live assignment for that role (otherwise TAX_CALC_CASE_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_list(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; c public.taxguard_cases;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case;
  IF NOT FOUND OR NOT (public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor) OR public.taxguard_practice_is_manager(r)) THEN RAISE EXCEPTION 'TAX_CALC_CASE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg((to_jsonb(x) - 'tenant_id') || jsonb_build_object('returnUse', 'BLOCKED') ORDER BY x.created_at DESC), '[]'::jsonb)
    FROM public.taxguard_tax_calc_runs x WHERE x.tenant_id = p_tenant AND x.case_id = p_case);
END $$;

-- Current definition: 20261012330000. Changed: a named preparer or reviewer needs the live assignment for that role (otherwise TAX_CALC_CASE_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_record(p_tenant text, p_actor text, p_case text, p_run jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; c public.taxguard_cases; s public.taxguard_tax_rule_sets; existing public.taxguard_tax_calc_runs; run public.taxguard_tax_calc_runs;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case;
  IF NOT FOUND OR NOT (public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor)) THEN RAISE EXCEPTION 'TAX_CALC_CASE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO s FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = (p_run->>'ruleSetId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF s.status <> 'APPROVED' THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  IF s.content_sha256 <> p_run->>'ruleSetSha256' THEN RAISE EXCEPTION 'TAX_RULE_SET_INTEGRITY' USING ERRCODE = 'P0001'; END IF;
  IF s.tax_year <> c.tax_year THEN RAISE EXCEPTION 'TAX_CALC_TAX_YEAR_MISMATCH' USING ERRCODE = 'P0001'; END IF;
  IF COALESCE(p_run->>'inputSha256', '') !~ '^[a-f0-9]{64}$' OR COALESCE(p_run->>'outputSha256', '') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'TAX_CALC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO existing FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND case_id = p_case AND rule_set_id = s.rule_set_id AND input_sha256 = p_run->>'inputSha256';
  IF FOUND THEN
    IF existing.output_sha256 <> p_run->>'outputSha256' OR existing.engine_version <> p_run->>'engineVersion' THEN
      -- Returned (not raised) so the refusal's audit row is committed; nothing else changes.
      PERFORM public.taxguard_tax_audit(p_tenant, c.client_id, p_actor, r, 'TAX_CALC_NONDETERMINISM_REFUSED', jsonb_build_object('runId', existing.run_id, 'caseId', p_case,
        'recordedOutputSha256', existing.output_sha256, 'offeredOutputSha256', p_run->>'outputSha256'));
      RETURN jsonb_build_object('refused', 'TAX_ENGINE_NONDETERMINISM', 'runId', existing.run_id);
    END IF;
    RETURN (to_jsonb(existing) - 'tenant_id') || jsonb_build_object('replayed', true, 'returnUse', 'BLOCKED');
  END IF;
  INSERT INTO public.taxguard_tax_calc_runs(tenant_id, client_id, case_id, tax_year, rule_set_id, rule_set_sha256, engine_version, input_sha256, output_sha256, filing_status,
      inputs, outputs, trace, synthetic, requested_by)
    VALUES (p_tenant, c.client_id, p_case, c.tax_year, s.rule_set_id, s.content_sha256, p_run->>'engineVersion', p_run->>'inputSha256', p_run->>'outputSha256',
      NULLIF(p_run->>'filingStatus', ''), p_run->'inputs', p_run->'outputs', p_run->'trace', s.synthetic, p_actor) RETURNING * INTO run;
  PERFORM public.taxguard_tax_audit(p_tenant, c.client_id, p_actor, r, 'TAX_CALC_RECORDED', jsonb_build_object('runId', run.run_id, 'caseId', p_case,
    'ruleSetId', s.rule_set_id, 'ruleSetVersion', s.version, 'inputSha256', run.input_sha256, 'outputSha256', run.output_sha256, 'synthetic', s.synthetic));
  RETURN (to_jsonb(run) - 'tenant_id') || jsonb_build_object('replayed', false, 'returnUse', 'BLOCKED');
END $$;

-- Current definition: 20261012330000. Changed: the named reviewer needs the live reviewer assignment (otherwise TAX_CALC_REVIEWER_REQUIRED).
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_review(p_tenant text, p_actor text, p_run uuid, p_decision text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; run public.taxguard_tax_calc_runs; c public.taxguard_cases;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO run FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND run_id = p_run FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_CALC_RUN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = run.case_id;
  IF p_actor IS DISTINCT FROM c.reviewer_uid OR NOT public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor) THEN RAISE EXCEPTION 'TAX_CALC_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_actor = run.requested_by THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF run.status <> 'COMPUTED' THEN RAISE EXCEPTION 'TAX_CALC_ALREADY_REVIEWED' USING ERRCODE = 'P0001'; END IF;
  IF p_decision NOT IN ('approve','reject') OR length(btrim(COALESCE(p_note, ''))) < 10 THEN RAISE EXCEPTION 'TAX_CALC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_tax_calc_runs SET status = CASE p_decision WHEN 'approve' THEN 'REVIEW_APPROVED' ELSE 'REVIEW_REJECTED' END, reviewed_by = p_actor, reviewed_at = now(),
      review_note = btrim(p_note) WHERE tenant_id = p_tenant AND run_id = p_run RETURNING * INTO run;
  PERFORM public.taxguard_tax_audit(p_tenant, run.client_id, p_actor, r, 'TAX_CALC_' || upper(p_decision) || 'D', jsonb_build_object('runId', p_run, 'caseId', run.case_id));
  RETURN (to_jsonb(run) - 'tenant_id') || jsonb_build_object('returnUse', 'BLOCKED');
END $$;
