-- PROPOSAL (Block 96, active clients in the practice summary). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261012320000, which holds the current taxguard_dash_practice_summary, and 20261012250000
-- (taxguard_clients status, taxguard_tax_years).
--
-- The in-memory practice analytics reported an active-client count that the durable practice summary did not
-- (Block 89 coverage map, operations-analytics). The summary now adds activeClients: clients with status active, and
-- for a requested tax year those with an engagement covering that year, with its definition. Manager-only, as before.
-- Identical to the current definition except for the activeClients figure and its definition.
-- Rollback (development): re-apply 20261012320000's taxguard_dash_practice_summary.

-- Current definition: 20261012320000. Changed: adds activeClients and its definition.
CREATE OR REPLACE FUNCTION public.taxguard_dash_practice_summary(p_tenant text, p_actor text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; week_end date := current_date + 6;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'DASHBOARD_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_tax_year IS NOT NULL AND p_tax_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'DASHBOARD_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object(
    'taxYear', p_tax_year, 'asOf', current_date,
    'activeClients', (SELECT count(*) FROM public.taxguard_clients cl WHERE cl.tenant_id = p_tenant AND cl.status = 'active'
      AND (p_tax_year IS NULL OR EXISTS (SELECT 1 FROM public.taxguard_tax_years ty WHERE ty.tenant_id = cl.tenant_id AND ty.client_id = cl.client_id AND ty.tax_year = p_tax_year))),
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
      'activeClients', 'Clients with status active; for a tax year, those with an engagement covering that year.',
      'casesByStage', 'Cases with status ACTIVE or ON_HOLD by current stage.',
      'deadlines', 'Recorded PENDING deadlines due today through the next six days, and before today.',
      'tasks', 'Tasks not completed or cancelled; overdue = due date before today.',
      'documentRequests', 'Requests still OPEN or SUBMITTED; overdue = due date before today.',
      'documentsAwaitingReview', 'Clean document versions waiting for staff review.',
      'documentsAwaitingScan', 'Document versions not yet cleared by the malware scanner.',
      'receivables', 'Issued or partially paid invoices with a balance; past due = due date before today. Amounts are recorded balances, not forecasts.',
      'staffCaseCounts', 'ACTIVE cases per active staff member as preparer and as reviewer. No capacity target is defined.'));
END $$;

REVOKE ALL ON FUNCTION public.taxguard_dash_practice_summary(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_dash_practice_summary(text,text,integer) TO service_role;
