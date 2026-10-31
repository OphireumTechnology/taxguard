-- PROPOSAL (Block 85, deadline escalation). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261001000000 (taxguard_deadlines), 20261012250000 (taxguard_practice_actor, taxguard_practice_is_manager)
-- and 20261018100000 (taxguard_practice_item_scope).
--
-- The in-memory /api/operations/deadlines/sweep wrote an escalation level and an OVERDUE status onto each deadline.
-- The durable deadlines are not swept. The durable functions treat status PENDING as an open deadline (the client
-- list's next deadline, the client detail), so a sweep writing OVERDUE would make overdue deadlines disappear from
-- them, and no scheduler is commissioned to run one. Instead, taxguard_practice_deadline_escalations derives the level
-- when it is read, from the due date and the current time, and writes nothing. A derived level cannot be stale.
--
-- Levels and thresholds are the ones the in-memory service used (DeadlineEscalationService.evaluateSingleDeadline),
-- carried over unchanged and returned with the result. They are operational defaults, not a reviewed policy:
--   0 NORMAL      due in more than 168 hours (7 days)
--   1 APPROACHING due within 168 hours
--   2 DUE_SOON    due within 48 hours
--   3 OVERDUE     past due
--   4 CRITICAL    past due by more than 168 hours, or past due with authority_type STATUTORY
-- Only open deadlines (PENDING, and OVERDUE rows written before this proposal) are returned; MET and WAIVED are not.
-- Scope: each deadline by the actor's scope over its case or tax year (taxguard_practice_item_scope, owner decision
-- 2026-10-19); practice managers and administrators see the tenant's. Staff only; clients are refused.
-- Rollback (development): drop the functions.

CREATE OR REPLACE FUNCTION public.taxguard_deadline_level(p_due timestamptz, p_authority text, p_now timestamptz) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_due < p_now THEN CASE WHEN p_now - p_due > interval '168 hours' OR p_authority = 'STATUTORY' THEN 4 ELSE 3 END
    WHEN p_due - p_now <= interval '48 hours' THEN 2 WHEN p_due - p_now <= interval '168 hours' THEN 1 ELSE 0 END $$;
REVOKE ALL ON FUNCTION public.taxguard_deadline_level(timestamptz,text,timestamptz) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_practice_deadline_escalations(p_tenant text, p_actor text, p_client text, p_min_level integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; v_now timestamptz := now();
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF (p_client IS NOT NULL AND p_client !~ '^[A-Za-z0-9_-]{1,64}$') OR p_min_level IS NULL OR p_min_level < 0 OR p_min_level > 4 THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  RETURN (WITH pending AS (
      SELECT d.*, public.taxguard_deadline_level(d.due_date, d.authority_type, v_now) AS level FROM public.taxguard_deadlines d
      WHERE d.tenant_id = p_tenant AND d.status IN ('PENDING','OVERDUE') AND d.client_id IS NOT NULL AND (p_client IS NULL OR d.client_id = p_client)
        AND public.taxguard_practice_item_scope(p_tenant, d.client_id, p_actor, r, d.case_id, NULL, d.tax_year)),
    shown AS (SELECT * FROM pending WHERE level >= p_min_level)
    SELECT jsonb_build_object('evaluatedAt', v_now,
      'deadlines', COALESCE((SELECT jsonb_agg(jsonb_build_object('deadlineId', s.id, 'clientId', s.client_id, 'caseId', s.case_id, 'taxYear', s.tax_year,
          'title', s.title, 'category', s.category, 'authorityType', s.authority_type, 'dueDate', s.due_date, 'level', s.level,
          'levelName', (ARRAY['NORMAL','APPROACHING','DUE_SOON','OVERDUE','CRITICAL'])[s.level + 1],
          'hoursUntilDue', round(extract(epoch FROM s.due_date - v_now) / 3600)) ORDER BY s.level DESC, s.due_date, s.id) FROM shown s), '[]'::jsonb),
      'counts', (SELECT jsonb_build_object('NORMAL', count(*) FILTER (WHERE level = 0), 'APPROACHING', count(*) FILTER (WHERE level = 1),
          'DUE_SOON', count(*) FILTER (WHERE level = 2), 'OVERDUE', count(*) FILTER (WHERE level = 3), 'CRITICAL', count(*) FILTER (WHERE level = 4)) FROM pending),
      'thresholds', jsonb_build_object('approachingHours', 168, 'dueSoonHours', 48, 'criticalOverdueHours', 168, 'statutoryOverdueIsCritical', true,
        'source', 'In-memory DeadlineEscalationService defaults, carried over unchanged; not a reviewed policy.'),
      'definitions', jsonb_build_object(
        'deadlines', 'Open deadlines (PENDING, or OVERDUE from before this view) in your scope at or above the requested level, most urgent first.',
        'level', 'Derived when read from the due date and the current time; nothing is written.',
        'counts', 'Open deadlines in your scope by level, whatever level was requested.')));
END $$;

REVOKE ALL ON FUNCTION public.taxguard_practice_deadline_escalations(text,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_practice_deadline_escalations(text,text,text,integer) TO service_role;
