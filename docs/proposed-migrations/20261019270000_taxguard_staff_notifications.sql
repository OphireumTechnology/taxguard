-- PROPOSAL (Block 86, staff in-app notifications). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261012250000 (taxguard_practice_tasks, taxguard_practice_actor), 20261018100000 (taxguard_practice_item_scope
-- and the current taxguard_practice_create_task) and 20261019250000 (the current taxguard_practice_reassign_task).
--
-- Staff had no durable notifications: the in-memory /api/operations/notifications held them in a process list (Block 83
-- coverage map). Client notifications already exist (proposals 031 and 20261016040000) and are unchanged.
--   * One kind, TASK_ASSIGNED, written by the database when a task is created with an assignee or reassigned to one,
--     for that assignee, unless the assignee is the actor. Nothing else writes staff notifications: the in-memory route
--     let staff dispatch free-text notifications to anyone, which is staff messaging and waits on the owner's
--     general-record policy (phase14-remaining-domain-access-policy.md). No e-mail or SMS: in-app only, delivery
--     NOT_CONFIGURED, as for client notifications.
--   * A notification stores identifiers only (client, task). Its title is read from the task when listed, and only
--     while the recipient may still see the task (its assignee, its creator, or in scope of its case, engagement and
--     year, owner decision 2026-10-19); otherwise the item reports available = false with no task details. A later
--     revocation therefore hides what the notification points to.
--   * A staff member lists and marks read only their own notifications. Marking read twice changes nothing.
-- Each redefined function is identical to its current definition except for the change named above it.
-- Rollback (development): re-apply the two current definitions, drop the three functions and the table.

CREATE TABLE IF NOT EXISTS public.taxguard_staff_notifications (
  tenant_id VARCHAR(128) NOT NULL,
  notification_id UUID NOT NULL DEFAULT gen_random_uuid(),
  recipient_uid VARCHAR(128) NOT NULL,
  kind VARCHAR(32) NOT NULL CHECK (kind IN ('TASK_ASSIGNED')),
  client_id VARCHAR(64) NOT NULL,
  task_id VARCHAR(128) NOT NULL,
  channel VARCHAR(16) NOT NULL DEFAULT 'IN_APP' CHECK (channel = 'IN_APP'),
  delivery_status VARCHAR(24) NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (delivery_status = 'NOT_CONFIGURED'),
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, notification_id)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_staff_notifications_recipient ON public.taxguard_staff_notifications (tenant_id, recipient_uid, created_at DESC);
ALTER TABLE public.taxguard_staff_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_staff_notifications FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_staff_notify_task(p_tenant text, p_client text, p_task text, p_recipient text, p_actor text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_staff_notifications(tenant_id, recipient_uid, kind, client_id, task_id, created_by)
  SELECT p_tenant, p_recipient, 'TASK_ASSIGNED', p_client, p_task, p_actor WHERE p_recipient IS NOT NULL AND p_recipient <> p_actor $$;
REVOKE ALL ON FUNCTION public.taxguard_staff_notify_task(text,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;

-- Current definition: 20261018100000. Changed: notifies the assignee.
CREATE OR REPLACE FUNCTION public.taxguard_practice_create_task(p_tenant text, p_client text, p_actor text, p_task text, p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; assignee text; dep text; existing record; eng text; due timestamptz;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false);
  IF p_task IS NULL OR p_task !~ '^[A-Za-z0-9_-]{8,128}$' OR p_body IS NULL OR jsonb_typeof(p_body) <> 'object'
     OR COALESCE(p_body->>'priority', 'MEDIUM') NOT IN ('LOW','MEDIUM','HIGH','URGENT')
     OR (p_body ? 'dependencies' AND jsonb_typeof(p_body->'dependencies') <> 'array') OR jsonb_array_length(COALESCE(p_body->'dependencies', '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO existing FROM public.taxguard_practice_tasks WHERE id = p_task;
  IF FOUND AND NOT (existing.created_by = p_actor OR public.taxguard_practice_item_scope(p_tenant, p_client, p_actor, r, existing.case_id, existing.engagement_id, existing.tax_year)) THEN
    RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF FOUND THEN
    IF existing.tenant_id = p_tenant AND existing.client_id = p_client AND existing.title = btrim(p_body->>'title') THEN RETURN jsonb_build_object('taskId', p_task, 'created', false); END IF;
    RAISE EXCEPTION 'PRACTICE_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  assignee := NULLIF(p_body->>'assignedUserId', '');
  IF assignee IS NOT NULL THEN
    PERFORM 1 FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = assignee AND status = 'active' AND role NOT IN ('client','prospective_client','recruiter')
      AND public.taxguard_practice_can_see(p_tenant, p_client, assignee, role);
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK_ASSIGNEE_NOT_AUTHORIZED' USING ERRCODE = 'P0001'; END IF;
  END IF;
  eng := NULLIF(p_body->>'engagementId', '');
  IF eng IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = eng) THEN
    RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(p_body->>'caseId', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND case_id = p_body->>'caseId'
      AND public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, engagement_id, tax_year)) THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(p_body->>'caseId', '') IS NULL AND NOT public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, eng, public.taxguard_practice_year(p_body->>'taxYear')) THEN
    RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  FOR dep IN SELECT value FROM jsonb_array_elements_text(COALESCE(p_body->'dependencies', '[]'::jsonb)) LOOP
    PERFORM 1 FROM public.taxguard_practice_tasks WHERE id = dep AND tenant_id = p_tenant AND client_id = p_client;
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK_DEPENDENCY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  END LOOP;
  BEGIN due := NULLIF(p_body->>'dueDate', '')::timestamptz; EXCEPTION WHEN others THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  INSERT INTO public.taxguard_practice_tasks(id, tenant_id, client_id, engagement_id, tax_year, case_id, task_type, title, description, priority, status, assigned_user_id,
      created_by, due_date, dependencies)
    VALUES (p_task, p_tenant, p_client, eng, NULLIF(p_body->>'taxYear', '')::integer, NULLIF(p_body->>'caseId', ''),
      COALESCE(NULLIF(p_body->>'taskType', ''), 'GENERAL'), public.taxguard_practice_text(p_body->>'title', 3, 255, 'PRACTICE_INPUT_INVALID'),
      public.taxguard_practice_text(p_body->>'description', 0, 2000, 'PRACTICE_INPUT_INVALID'), COALESCE(p_body->>'priority', 'MEDIUM'), 'OPEN', assignee, p_actor, due,
      COALESCE(p_body->'dependencies', '[]'::jsonb));
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_TASK_CREATED', jsonb_build_object('taskId', p_task, 'assignedUserId', assignee));
  PERFORM public.taxguard_staff_notify_task(p_tenant, p_client, p_task, assignee, p_actor);
  RETURN jsonb_build_object('taskId', p_task, 'created', true);
EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
END $$;

-- Current definition: 20261019250000. Changed: notifies the new assignee.
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
  PERFORM public.taxguard_staff_notify_task(p_tenant, p_client, p_task, assignee, p_actor);
  RETURN jsonb_build_object('taskId', p_task, 'assignedUserId', assignee, 'version', t.version + 1, 'changed', true);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_staff_notifications_list(p_tenant text, p_actor text, p_unread_only boolean, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object(
    'unread', (SELECT count(*) FROM public.taxguard_staff_notifications n WHERE n.tenant_id = p_tenant AND n.recipient_uid = p_actor AND n.read_at IS NULL),
    'notifications', COALESCE((SELECT jsonb_agg(item ORDER BY created_at DESC, notification_id) FROM (
      SELECT n.created_at, n.notification_id, jsonb_build_object('notificationId', n.notification_id, 'kind', n.kind, 'clientId', n.client_id, 'taskId', n.task_id,
          'channel', n.channel, 'deliveryStatus', n.delivery_status, 'createdBy', n.created_by, 'createdAt', n.created_at, 'readAt', n.read_at,
          'available', t.id IS NOT NULL,
          'task', CASE WHEN t.id IS NOT NULL THEN jsonb_build_object('title', t.title, 'status', t.status, 'assignedToMe', t.assigned_user_id IS NOT DISTINCT FROM p_actor) END) AS item
      FROM public.taxguard_staff_notifications n
      LEFT JOIN public.taxguard_practice_tasks t ON t.tenant_id = n.tenant_id AND t.client_id = n.client_id AND t.id = n.task_id
        AND (t.assigned_user_id IS NOT DISTINCT FROM p_actor OR t.created_by = p_actor
          OR public.taxguard_practice_item_scope(p_tenant, n.client_id, p_actor, r, t.case_id, t.engagement_id, t.tax_year))
      WHERE n.tenant_id = p_tenant AND n.recipient_uid = p_actor AND (NOT COALESCE(p_unread_only, false) OR n.read_at IS NULL)
      ORDER BY n.created_at DESC, n.notification_id LIMIT p_limit) x), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_staff_notification_mark_read(p_tenant text, p_actor text, p_notification text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; n public.taxguard_staff_notifications;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_notification IS NULL OR p_notification !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'STAFF_NOTIFICATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.taxguard_staff_notifications SET read_at = COALESCE(read_at, now())
    WHERE tenant_id = p_tenant AND notification_id = p_notification::uuid AND recipient_uid = p_actor RETURNING * INTO n;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_NOTIFICATION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object('notificationId', n.notification_id, 'readAt', n.read_at);
END $$;

REVOKE ALL ON FUNCTION public.taxguard_staff_notifications_list(text,text,boolean,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_staff_notifications_list(text,text,boolean,integer) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_staff_notification_mark_read(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_staff_notification_mark_read(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_practice_create_task(text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_practice_create_task(text,text,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_practice_reassign_task(text,text,text,text,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_practice_reassign_task(text,text,text,text,text,integer,text) TO service_role;
