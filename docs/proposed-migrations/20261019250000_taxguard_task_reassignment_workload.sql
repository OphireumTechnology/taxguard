-- PROPOSAL (Block 84, task reassignment and staff workload). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261012250000 (taxguard_practice_tasks, taxguard_practice_client_access, taxguard_practice_actor,
-- taxguard_practice_can_see, taxguard_practice_is_manager, taxguard_practice_audit) and 20261018100000
-- (taxguard_practice_item_scope).
--
-- Block 83 found two practice operations with no durable route: reassigning a task, and the staff workload view. Both
-- exist only in the in-memory /api/operations routes, refused in production.
--   * taxguard_practice_reassign_task changes, or clears, a task's assignee. The authority is the same as for a task
--     status change (20261012250000): a practice manager or administrator, the task's creator, or its current
--     assignee. The actor must also be in scope of the task's case, engagement and year (owner decision 2026-10-19);
--     a task out of scope is TASK_NOT_FOUND, like a missing one. The new assignee must pass the same check as at task
--     creation (an active staff member who can see the client, taxguard_practice_can_see). The version must match;
--     COMPLETED and CANCELLED tasks are not reassigned; an unchanged assignee changes nothing and writes no audit row.
--     Every change is audited (PRACTICE_TASK_REASSIGNED, with the previous and new assignee and the reason).
--   * taxguard_dash_workload counts a staff member's assigned, unfinished tasks by status, how many are overdue, and
--     their current client and engagement assignments. An actor reads their own workload; reading another staff
--     member's needs a practice manager or administrator. (The in-memory route let any accountant read anyone's.)
--     Counts are computed only from recorded rows and returned with their definitions; nothing is scored or ranked.
-- Rollback (development): drop both functions.

CREATE OR REPLACE FUNCTION public.taxguard_practice_reassign_task(p_tenant text, p_client text, p_actor text, p_task text, p_assignee text, p_version integer, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; t record; assignee text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false, false);
  assignee := NULLIF(btrim(COALESCE(p_assignee, '')), '');
  IF p_task IS NULL OR p_version IS NULL OR (assignee IS NOT NULL AND assignee !~ '^[A-Za-z0-9_-]{1,128}$')
     OR (p_reason IS NOT NULL AND length(p_reason) > 500) THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO t FROM public.taxguard_practice_tasks WHERE id = p_task AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_practice_item_scope(p_tenant, p_client, p_actor, r, t.case_id, t.engagement_id, t.tax_year) THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.taxguard_practice_is_manager(r) AND p_actor IS DISTINCT FROM t.assigned_user_id AND p_actor <> t.created_by THEN
    RAISE EXCEPTION 'TASK_ACTION_NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF t.version <> p_version THEN RAISE EXCEPTION 'PRACTICE_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF t.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'TASK_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF assignee IS NOT DISTINCT FROM t.assigned_user_id THEN
    RETURN jsonb_build_object('taskId', p_task, 'assignedUserId', assignee, 'version', t.version, 'changed', false);
  END IF;
  IF assignee IS NOT NULL THEN
    PERFORM 1 FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = assignee AND status = 'active' AND role NOT IN ('client','prospective_client','recruiter')
      AND public.taxguard_practice_can_see(p_tenant, p_client, assignee, role);
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK_ASSIGNEE_NOT_AUTHORIZED' USING ERRCODE = 'P0001'; END IF;
  END IF;
  UPDATE public.taxguard_practice_tasks SET assigned_user_id = assignee, version = version + 1, updated_at = now() WHERE id = p_task;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_TASK_REASSIGNED',
    jsonb_build_object('taskId', p_task, 'from', t.assigned_user_id, 'to', assignee, 'reason', NULLIF(btrim(COALESCE(p_reason, '')), '')));
  RETURN jsonb_build_object('taskId', p_task, 'assignedUserId', assignee, 'version', t.version + 1, 'changed', true);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_dash_workload(p_tenant text, p_actor text, p_user text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; target text; target_role text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  target := COALESCE(NULLIF(btrim(COALESCE(p_user, '')), ''), p_actor);
  IF target !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF target <> p_actor AND NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'WORKLOAD_NOT_AUTHORIZED' USING ERRCODE = 'P0001'; END IF;
  SELECT role INTO target_role FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = target AND status = 'active'
    AND role NOT IN ('client','prospective_client','recruiter');
  IF NOT FOUND THEN RAISE EXCEPTION 'WORKLOAD_USER_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN (WITH open_tasks AS (
      SELECT t.status, t.due_date FROM public.taxguard_practice_tasks t
      WHERE t.tenant_id = p_tenant AND t.assigned_user_id = target AND t.status NOT IN ('COMPLETED','CANCELLED')),
    live AS (
      SELECT a.client_id, a.engagement_id FROM public.taxguard_staff_assignments a
      WHERE a.tenant_id = p_tenant AND a.user_id = target AND a.status = 'ACTIVE' AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now()))
    SELECT jsonb_build_object('userId', target, 'role', target_role,
      'assignedClients', (SELECT count(DISTINCT client_id) FROM live),
      'assignedEngagements', (SELECT count(DISTINCT (client_id, engagement_id)) FROM live WHERE engagement_id IS NOT NULL),
      'clientWideAssignments', (SELECT count(DISTINCT client_id) FROM live WHERE engagement_id IS NULL),
      'openTasks', (SELECT count(*) FROM open_tasks),
      'overdueTasks', (SELECT count(*) FROM open_tasks WHERE due_date IS NOT NULL AND due_date < now()),
      'byStatus', (SELECT jsonb_build_object('OPEN', count(*) FILTER (WHERE status = 'OPEN'), 'IN_PROGRESS', count(*) FILTER (WHERE status = 'IN_PROGRESS'),
          'WAITING_ON_CLIENT', count(*) FILTER (WHERE status = 'WAITING_ON_CLIENT'), 'WAITING_ON_PROVIDER', count(*) FILTER (WHERE status = 'WAITING_ON_PROVIDER'),
          'READY_FOR_REVIEW', count(*) FILTER (WHERE status = 'READY_FOR_REVIEW'), 'BLOCKED', count(*) FILTER (WHERE status = 'BLOCKED')) FROM open_tasks),
      'definitions', jsonb_build_object(
        'assignedClients', 'Clients where the staff member holds a current ACTIVE assignment of any scope.',
        'assignedEngagements', 'Distinct engagements of those assignments; client-wide assignments are counted separately.',
        'clientWideAssignments', 'Clients where the staff member holds a current assignment covering every engagement and year.',
        'openTasks', 'Practice tasks assigned to the staff member that are not COMPLETED or CANCELLED.',
        'overdueTasks', 'Open tasks whose due date has passed.',
        'byStatus', 'Open tasks by their recorded status.')));
END $$;

REVOKE ALL ON FUNCTION public.taxguard_practice_reassign_task(text,text,text,text,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_practice_reassign_task(text,text,text,text,text,integer,text) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_dash_workload(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_dash_workload(text,text,text) TO service_role;
