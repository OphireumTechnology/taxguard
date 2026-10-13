-- PROPOSAL 032 ONLY. NOT APPLIED. Requires the actual core schema and proposals 024-031.
-- Read-only role dashboard projections. Every figure is a count or sum of recorded rows, returned
-- with the definition used to compute it. Nothing is estimated, forecast or scored: there is no
-- capacity, SLA or productivity metric here because no authoritative policy defines one.
--
--   taxguard_dash_my_work         staff: cases where the actor is preparer or reviewer (and whether
--                                 the next step is theirs), documents awaiting their review,
--                                 outstanding document requests, ledger entries awaiting their
--                                 review, entries returned to them, book-to-tax items awaiting review.
--   taxguard_dash_practice_summary managers: active cases by stage, holds, recorded deadlines due and
--                                 overdue, open and overdue tasks, document requests outstanding,
--                                 documents awaiting review, issued invoices with balances, and
--                                 active case counts per assigned staff member.
-- Tenant and client visibility reuse taxguard_practice_can_see (assignment or manager).
-- Rollback (development): drop the two functions.

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
      WHERE c.tenant_id = p_tenant AND p_actor IN (c.preparer_uid, c.reviewer_uid) AND c.status IN ('ACTIVE','ON_HOLD')),
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

CREATE OR REPLACE FUNCTION public.taxguard_dash_practice_summary(p_tenant text, p_actor text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; week_end date := current_date + 6;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'DASHBOARD_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_tax_year IS NOT NULL AND p_tax_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'DASHBOARD_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object(
    'taxYear', p_tax_year, 'asOf', current_date,
    'casesByStage', (SELECT COALESCE(jsonb_agg(jsonb_build_object('stage', s.active_stage, 'active', s.active, 'onHold', s.on_hold) ORDER BY s.active_stage), '[]'::jsonb)
      FROM (SELECT active_stage, count(*) FILTER (WHERE status = 'ACTIVE') AS active, count(*) FILTER (WHERE status = 'ON_HOLD') AS on_hold FROM public.taxguard_cases
        WHERE tenant_id = p_tenant AND status IN ('ACTIVE','ON_HOLD') AND (p_tax_year IS NULL OR tax_year = p_tax_year) GROUP BY active_stage) s),
    'deadlines', (SELECT jsonb_build_object('dueThisWeek', count(*) FILTER (WHERE due_date BETWEEN current_date AND week_end), 'overdue', count(*) FILTER (WHERE due_date < current_date))
      FROM public.taxguard_deadlines WHERE tenant_id = p_tenant AND status = 'PENDING' AND (p_tax_year IS NULL OR tax_year = p_tax_year)),
    'tasks', (SELECT jsonb_build_object('open', count(*), 'overdue', count(*) FILTER (WHERE due_date < current_date), 'waitingOnClient', count(*) FILTER (WHERE status = 'WAITING_ON_CLIENT'),
        'readyForReview', count(*) FILTER (WHERE status = 'READY_FOR_REVIEW'))
      FROM public.taxguard_practice_tasks WHERE tenant_id = p_tenant AND status NOT IN ('COMPLETED','CANCELLED') AND (p_tax_year IS NULL OR tax_year = p_tax_year)),
    'documentRequests', (SELECT jsonb_build_object('open', count(*) FILTER (WHERE status = 'OPEN'), 'submitted', count(*) FILTER (WHERE status = 'SUBMITTED'),
        'overdue', count(*) FILTER (WHERE due_date < current_date), 'requiredOutstanding', count(*) FILTER (WHERE required))
      FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND status IN ('OPEN','SUBMITTED') AND (p_tax_year IS NULL OR tax_year = p_tax_year)),
    'documentsAwaitingReview', (SELECT count(*) FROM public.taxguard_documents WHERE tenant_id = p_tenant AND status = 'PENDING_REVIEW' AND quarantine_status = 'CLEAN'
      AND (p_tax_year IS NULL OR tax_year = p_tax_year)),
    'documentsAwaitingScan', (SELECT count(*) FROM public.taxguard_documents WHERE tenant_id = p_tenant AND status IN ('UPLOAD_PENDING','SCAN_PENDING')
      AND (p_tax_year IS NULL OR tax_year = p_tax_year)),
    'receivables', (SELECT jsonb_build_object('openInvoices', count(*), 'balanceDue', to_char(COALESCE(sum(balance_due), 0), 'FM999999999990.00'),
        'pastDue', count(*) FILTER (WHERE due_date < current_date), 'awaitingApproval', (SELECT count(*) FROM public.taxguard_invoices WHERE tenant_id = p_tenant AND status = 'PENDING_APPROVAL'))
      FROM public.taxguard_invoices WHERE tenant_id = p_tenant AND status IN ('ISSUED','PARTIALLY_PAID') AND balance_due > 0),
    'staffCaseCounts', (SELECT COALESCE(jsonb_agg(jsonb_build_object('userId', x.uid, 'asPreparer', x.prep, 'asReviewer', x.rev) ORDER BY x.uid), '[]'::jsonb)
      FROM (SELECT y.uid, count(*) FILTER (WHERE y.kind = 'p') AS prep, count(*) FILTER (WHERE y.kind = 'r') AS rev FROM (
          SELECT preparer_uid AS uid, 'p' AS kind FROM public.taxguard_cases WHERE tenant_id = p_tenant AND status = 'ACTIVE' AND (p_tax_year IS NULL OR tax_year = p_tax_year)
          UNION ALL SELECT reviewer_uid, 'r' FROM public.taxguard_cases WHERE tenant_id = p_tenant AND status = 'ACTIVE' AND (p_tax_year IS NULL OR tax_year = p_tax_year)) y
        JOIN public.taxguard_members m ON m.tenant_id = p_tenant AND m.uid = y.uid AND m.status = 'active' GROUP BY y.uid) x),
    'definitions', jsonb_build_object(
      'casesByStage', 'Cases with status ACTIVE or ON_HOLD by current stage.',
      'deadlines', 'Recorded PENDING deadlines due today through the next six days, and before today.',
      'tasks', 'Tasks not completed or cancelled; overdue = due date before today.',
      'documentRequests', 'Requests still OPEN or SUBMITTED; overdue = due date before today.',
      'documentsAwaitingReview', 'Clean document versions waiting for staff review.',
      'documentsAwaitingScan', 'Document versions not yet cleared by the malware scanner.',
      'receivables', 'Issued or partially paid invoices with a balance; past due = due date before today. Amounts are recorded balances, not forecasts.',
      'staffCaseCounts', 'ACTIVE cases per active staff member as preparer and as reviewer. No capacity target is defined.'));
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_dash_my_work','taxguard_dash_practice_summary') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
