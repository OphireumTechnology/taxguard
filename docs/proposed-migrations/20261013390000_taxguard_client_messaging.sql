-- PROPOSAL 039 ONLY. NOT APPLIED. Requires the actual core schema and proposals 025 and 027.
-- Durable client / staff messaging on the EXISTING core tables taxguard_communication_threads and
-- taxguard_communication_messages (core migration 20261001000000), replacing the in-memory
-- /api/messages store for durable deployments.
--
--   * Scope: every thread and message belongs to exactly one (tenant, client); the message's tenant
--     and client must equal its thread's (trigger). Access is taxguard_doc_actor (proposal 027):
--     a client member only for their own client, staff only with an ACTIVE assignment for the
--     client or as a practice manager; recruiters and other tenants are refused.
--   * Visibility: CLIENT_VISIBLE or INTERNAL_ONLY. Clients can only post CLIENT_VISIBLE messages
--     and never see INTERNAL_ONLY messages, nor threads that contain no client-visible message.
--   * Messages are immutable records (no UPDATE / DELETE, so a thread or client delete cannot
--     cascade them away). Read state is per participant in taxguard_comm_reads.
--   * Idempotency: the caller supplies thread / message IDs derived from its idempotency key; a
--     replay with the same content returns the recorded row, a different content is refused.
--   * Thread status ACTIVE / RESOLVED / ARCHIVED: staff resolve or reopen; archive is manager-only;
--     posting needs an ACTIVE thread. Thread creation, status changes and every post are audited
--     (identifiers and visibility only, never message content).
--   * No attachments here: files go through the document vault (027). No e-mail / SMS delivery.
-- Synthetic data only in tests. Rollback (development): drop the taxguard_comm_* functions,
-- triggers and taxguard_comm_reads; drop the added constraints and index.

ALTER TABLE public.taxguard_communication_messages DROP CONSTRAINT IF EXISTS ck_taxguard_comm_message_visibility;
ALTER TABLE public.taxguard_communication_messages ADD CONSTRAINT ck_taxguard_comm_message_visibility
  CHECK (visibility IN ('CLIENT_VISIBLE','INTERNAL_ONLY')) NOT VALID;
ALTER TABLE public.taxguard_communication_messages DROP CONSTRAINT IF EXISTS ck_taxguard_comm_message_content;
ALTER TABLE public.taxguard_communication_messages ADD CONSTRAINT ck_taxguard_comm_message_content
  CHECK (length(btrim(content)) BETWEEN 1 AND 5000) NOT VALID;
ALTER TABLE public.taxguard_communication_threads DROP CONSTRAINT IF EXISTS ck_taxguard_comm_thread_status;
ALTER TABLE public.taxguard_communication_threads ADD CONSTRAINT ck_taxguard_comm_thread_status
  CHECK (status IN ('ACTIVE','RESOLVED','ARCHIVED')) NOT VALID;
ALTER TABLE public.taxguard_communication_threads DROP CONSTRAINT IF EXISTS ck_taxguard_comm_thread_category;
ALTER TABLE public.taxguard_communication_threads ADD CONSTRAINT ck_taxguard_comm_thread_category
  CHECK (category IN ('GENERAL','TAX_QUESTION','DOCUMENT_QUERY','INVOICING','ADVISORY')) NOT VALID;
ALTER TABLE public.taxguard_communication_threads ADD COLUMN IF NOT EXISTS status_changed_by VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_taxguard_comm_threads_tenant_activity ON public.taxguard_communication_threads(tenant_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.taxguard_comm_reads (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE CASCADE,
  thread_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_communication_threads(id),
  uid VARCHAR(128) NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, thread_id, uid)
);
ALTER TABLE public.taxguard_comm_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_comm_reads FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_comm_message_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE t public.taxguard_communication_threads;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'COMM_MESSAGE_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO t FROM public.taxguard_communication_threads WHERE id = NEW.thread_id;
  IF NOT FOUND OR t.tenant_id IS DISTINCT FROM NEW.tenant_id OR t.client_id IS DISTINCT FROM NEW.client_id THEN
    RAISE EXCEPTION 'COMM_SCOPE_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_comm_message_guard ON public.taxguard_communication_messages;
CREATE TRIGGER trg_taxguard_comm_message_guard BEFORE INSERT OR UPDATE OR DELETE ON public.taxguard_communication_messages
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_comm_message_guard();

CREATE OR REPLACE FUNCTION public.taxguard_comm_thread_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'COMM_THREAD_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'COMM_THREAD_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_comm_thread_guard ON public.taxguard_communication_threads;
CREATE TRIGGER trg_taxguard_comm_thread_guard BEFORE UPDATE OR DELETE ON public.taxguard_communication_threads
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_comm_thread_guard();

-- ------------------------------------------------------------------------------------------
-- Internal helpers
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_comm_audit(p_tenant text, p_client text, p_actor text, p_role text, p_action text, p_meta jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, p_action, p_actor, p_role, jsonb_build_object('clientId', p_client) || COALESCE(p_meta, '{}'::jsonb)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_comm_body(p_body text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_body IS NULL OR length(btrim(p_body)) < 1 OR length(btrim(p_body)) > 5000 THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN btrim(p_body);
END $$;

-- Visibility the actor may post: clients CLIENT_VISIBLE only.
CREATE OR REPLACE FUNCTION public.taxguard_comm_visibility(p_role text, p_visibility text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v text := COALESCE(NULLIF(p_visibility, ''), 'CLIENT_VISIBLE');
BEGIN
  IF v NOT IN ('CLIENT_VISIBLE','INTERNAL_ONLY') THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF p_role = 'client' AND v <> 'CLIENT_VISIBLE' THEN RAISE EXCEPTION 'COMM_INTERNAL_STAFF_ONLY' USING ERRCODE = 'P0001'; END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_comm_message_json(m public.taxguard_communication_messages, p_actor text, p_staff boolean) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('messageId', m.id, 'threadId', m.thread_id, 'senderRole', m.sender_role,
    'senderKind', CASE WHEN m.sender_role IN ('client','prospective_client') THEN 'client' ELSE 'staff' END,
    'own', m.sender_id = p_actor, 'body', m.content, 'visibility', m.visibility, 'createdAt', m.created_at)
    || CASE WHEN p_staff THEN jsonb_build_object('senderUid', m.sender_id) ELSE '{}'::jsonb END $$;

-- A thread as the actor may see it (NULL when a client may not see it at all).
CREATE OR REPLACE FUNCTION public.taxguard_comm_thread_json(t public.taxguard_communication_threads, p_actor text, p_staff boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  WITH visible AS (
    SELECT m.* FROM public.taxguard_communication_messages m WHERE m.thread_id = t.id AND (p_staff OR m.visibility = 'CLIENT_VISIBLE')
  ), seen AS (
    SELECT last_read_at FROM public.taxguard_comm_reads WHERE tenant_id = t.tenant_id AND thread_id = t.id AND uid = p_actor
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM visible) THEN NULL ELSE
    jsonb_build_object('threadId', t.id, 'clientId', t.client_id, 'engagementId', t.engagement_id, 'subject', t.subject, 'category', t.category,
      'status', t.status, 'createdAt', t.created_at, 'lastMessageAt', (SELECT max(created_at) FROM visible), 'messageCount', (SELECT count(*) FROM visible),
      'unread', (SELECT count(*) FROM visible v WHERE v.sender_id <> p_actor AND (NOT EXISTS (SELECT 1 FROM seen) OR v.created_at > (SELECT last_read_at FROM seen))),
      'awaitingStaffReply', COALESCE((SELECT v.sender_role IN ('client','prospective_client') FROM visible v WHERE v.visibility = 'CLIENT_VISIBLE'
        ORDER BY v.created_at DESC, v.id DESC LIMIT 1), false))
    || CASE WHEN p_staff THEN jsonb_build_object('createdBy', t.created_by) ELSE '{}'::jsonb END END $$;

-- Inserts one message or returns the recorded one on an identical replay.
CREATE OR REPLACE FUNCTION public.taxguard_comm_insert(p_tenant text, p_client text, p_actor text, p_role text, p_thread text, p_message text, p_body text, p_visibility text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE existing public.taxguard_communication_messages; m public.taxguard_communication_messages;
BEGIN
  IF p_message IS NULL OR p_message !~ '^msg_[a-f0-9]{32}$' THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO existing FROM public.taxguard_communication_messages WHERE id = p_message;
  IF FOUND THEN
    IF existing.tenant_id = p_tenant AND existing.client_id = p_client AND existing.thread_id = p_thread AND existing.sender_id = p_actor
      AND existing.content = p_body AND existing.visibility = p_visibility THEN
      RETURN public.taxguard_comm_message_json(existing, p_actor, p_role <> 'client') || jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.taxguard_communication_messages(id, thread_id, tenant_id, client_id, sender_id, sender_role, visibility, content)
  VALUES (p_message, p_thread, p_tenant, p_client, p_actor, p_role, p_visibility, p_body) RETURNING * INTO m;
  UPDATE public.taxguard_communication_threads SET last_message_at = m.created_at, updated_at = now() WHERE id = p_thread;
  INSERT INTO public.taxguard_comm_reads(tenant_id, thread_id, uid, last_read_at) VALUES (p_tenant, p_thread, p_actor, m.created_at)
    ON CONFLICT (tenant_id, thread_id, uid) DO UPDATE SET last_read_at = GREATEST(public.taxguard_comm_reads.last_read_at, EXCLUDED.last_read_at);
  PERFORM public.taxguard_comm_audit(p_tenant, p_client, p_actor, p_role, CASE WHEN p_visibility = 'INTERNAL_ONLY' THEN 'COMM_INTERNAL_NOTE_POSTED' ELSE 'COMM_MESSAGE_POSTED' END,
    jsonb_build_object('threadId', p_thread, 'messageId', p_message, 'visibility', p_visibility));
  RETURN public.taxguard_comm_message_json(m, p_actor, p_role <> 'client') || jsonb_build_object('replayed', false);
END $$;

-- The thread, locked, if it belongs to (tenant, client) and the actor may see it.
CREATE OR REPLACE FUNCTION public.taxguard_comm_thread_for(p_tenant text, p_client text, p_actor text, p_role text, p_thread text) RETURNS public.taxguard_communication_threads
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE t public.taxguard_communication_threads;
BEGIN
  IF p_thread IS NULL OR p_thread !~ '^thr_[a-f0-9]{32}$' THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO t FROM public.taxguard_communication_threads WHERE id = p_thread AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND OR (p_role = 'client' AND public.taxguard_comm_thread_json(t, p_actor, false) IS NULL) THEN
    RAISE EXCEPTION 'COMM_THREAD_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  RETURN t;
END $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_comm_thread_create(p_tenant text, p_client text, p_actor text, p_thread text, p_message text, p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; t public.taxguard_communication_threads; subj text; cat text; eng text; vis text; body text; msg jsonb;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF p_thread IS NULL OR p_thread !~ '^thr_[a-f0-9]{32}$' OR p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  subj := btrim(COALESCE(p_input->>'subject', ''));
  IF length(subj) < 3 OR length(subj) > 200 THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  cat := COALESCE(NULLIF(p_input->>'category', ''), 'GENERAL');
  IF cat NOT IN ('GENERAL','TAX_QUESTION','DOCUMENT_QUERY','INVOICING','ADVISORY') THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  eng := NULLIF(p_input->>'engagementId', '');
  IF eng IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = eng) THEN
    RAISE EXCEPTION 'COMM_SCOPE_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  vis := public.taxguard_comm_visibility(r, p_input->>'visibility');
  body := public.taxguard_comm_body(p_input->>'body');
  SELECT * INTO t FROM public.taxguard_communication_threads WHERE id = p_thread;
  IF FOUND THEN
    IF t.tenant_id <> p_tenant OR t.client_id <> p_client OR t.created_by <> p_actor OR t.subject <> subj OR t.category <> cat OR t.engagement_id IS DISTINCT FROM eng THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    INSERT INTO public.taxguard_communication_threads(id, tenant_id, client_id, engagement_id, subject, category, status, created_by)
    VALUES (p_thread, p_tenant, p_client, eng, subj, cat, 'ACTIVE', p_actor) RETURNING * INTO t;
    PERFORM public.taxguard_comm_audit(p_tenant, p_client, p_actor, r, 'COMM_THREAD_CREATED', jsonb_build_object('threadId', p_thread, 'category', cat, 'engagementId', eng));
  END IF;
  msg := public.taxguard_comm_insert(p_tenant, p_client, p_actor, r, p_thread, p_message, body, vis);
  SELECT * INTO t FROM public.taxguard_communication_threads WHERE id = p_thread;
  RETURN jsonb_build_object('thread', public.taxguard_comm_thread_json(t, p_actor, r <> 'client'), 'message', msg);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_comm_post(p_tenant text, p_client text, p_actor text, p_thread text, p_message text, p_body text, p_visibility text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; t public.taxguard_communication_threads; vis text; body text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  t := public.taxguard_comm_thread_for(p_tenant, p_client, p_actor, r, p_thread);
  vis := public.taxguard_comm_visibility(r, p_visibility);
  body := public.taxguard_comm_body(p_body);
  -- An identical replay is answered even if the thread was resolved in the meantime.
  IF EXISTS (SELECT 1 FROM public.taxguard_communication_messages WHERE id = p_message) THEN
    RETURN public.taxguard_comm_insert(p_tenant, p_client, p_actor, r, p_thread, p_message, body, vis);
  END IF;
  IF t.status <> 'ACTIVE' THEN RAISE EXCEPTION 'COMM_THREAD_CLOSED' USING ERRCODE = 'P0001'; END IF;
  RETURN public.taxguard_comm_insert(p_tenant, p_client, p_actor, r, p_thread, p_message, body, vis);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_comm_threads(p_tenant text, p_client text, p_actor text, p_status text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF p_status IS NOT NULL AND p_status NOT IN ('ACTIVE','RESOLVED','ARCHIVED') THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(j ORDER BY j->>'lastMessageAt' DESC, j->>'threadId'), '[]'::jsonb) FROM (
    SELECT public.taxguard_comm_thread_json(t, p_actor, r <> 'client') AS j FROM public.taxguard_communication_threads t
    WHERE t.tenant_id = p_tenant AND t.client_id = p_client AND (p_status IS NULL OR t.status = p_status)
      AND (r <> 'client' OR t.status <> 'ARCHIVED') ORDER BY t.last_message_at DESC LIMIT 200) x WHERE j IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_comm_messages(p_tenant text, p_client text, p_actor text, p_thread text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; t public.taxguard_communication_threads;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF p_thread IS NULL OR p_thread !~ '^thr_[a-f0-9]{32}$' THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO t FROM public.taxguard_communication_threads WHERE id = p_thread AND tenant_id = p_tenant AND client_id = p_client;
  IF NOT FOUND OR public.taxguard_comm_thread_json(t, p_actor, r <> 'client') IS NULL OR (r = 'client' AND t.status = 'ARCHIVED') THEN
    RAISE EXCEPTION 'COMM_THREAD_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('thread', public.taxguard_comm_thread_json(t, p_actor, r <> 'client'),
    'messages', (SELECT COALESCE(jsonb_agg(public.taxguard_comm_message_json(m, p_actor, r <> 'client') ORDER BY m.created_at, m.id), '[]'::jsonb)
      FROM public.taxguard_communication_messages m WHERE m.thread_id = t.id AND (r <> 'client' OR m.visibility = 'CLIENT_VISIBLE')));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_comm_mark_read(p_tenant text, p_client text, p_actor text, p_thread text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; t public.taxguard_communication_threads; latest timestamptz;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  t := public.taxguard_comm_thread_for(p_tenant, p_client, p_actor, r, p_thread);
  SELECT max(created_at) INTO latest FROM public.taxguard_communication_messages WHERE thread_id = t.id AND (r <> 'client' OR visibility = 'CLIENT_VISIBLE');
  INSERT INTO public.taxguard_comm_reads(tenant_id, thread_id, uid, last_read_at) VALUES (p_tenant, t.id, p_actor, COALESCE(latest, now()))
    ON CONFLICT (tenant_id, thread_id, uid) DO UPDATE SET last_read_at = GREATEST(public.taxguard_comm_reads.last_read_at, EXCLUDED.last_read_at);
  RETURN jsonb_build_object('threadId', t.id, 'unread', 0);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_comm_set_status(p_tenant text, p_client text, p_actor text, p_thread text, p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; t public.taxguard_communication_threads;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'client' THEN RAISE EXCEPTION 'COMM_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_status NOT IN ('ACTIVE','RESOLVED','ARCHIVED') THEN RAISE EXCEPTION 'COMM_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  t := public.taxguard_comm_thread_for(p_tenant, p_client, p_actor, r, p_thread);
  IF p_status = 'ARCHIVED' AND NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'COMM_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF t.status = 'ARCHIVED' THEN RAISE EXCEPTION 'COMM_THREAD_CLOSED' USING ERRCODE = 'P0001'; END IF;
  IF t.status = p_status THEN RETURN public.taxguard_comm_thread_json(t, p_actor, true) || jsonb_build_object('changed', false); END IF;
  UPDATE public.taxguard_communication_threads SET status = p_status, status_changed_by = p_actor, updated_at = now() WHERE id = t.id RETURNING * INTO t;
  PERFORM public.taxguard_comm_audit(p_tenant, p_client, p_actor, r, 'COMM_THREAD_STATUS_CHANGED', jsonb_build_object('threadId', t.id, 'status', p_status));
  RETURN public.taxguard_comm_thread_json(t, p_actor, true) || jsonb_build_object('changed', true);
END $$;

-- Staff inbox: threads on the actor's visible clients whose latest client-visible message is from
-- the client (awaiting a staff reply), newest first. Managers see the tenant; others their clients.
CREATE OR REPLACE FUNCTION public.taxguard_comm_staff_inbox(p_tenant text, p_actor text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; lim integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF r IN ('client','prospective_client','recruiter') THEN RAISE EXCEPTION 'COMM_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(j ORDER BY j->>'lastMessageAt' DESC, j->>'threadId'), '[]'::jsonb) FROM (
    SELECT public.taxguard_comm_thread_json(t, p_actor, true) AS j FROM public.taxguard_communication_threads t
    JOIN public.taxguard_clients c ON c.tenant_id = t.tenant_id AND c.client_id = t.client_id AND c.status = 'active'
    WHERE t.tenant_id = p_tenant AND t.status = 'ACTIVE' AND public.taxguard_practice_can_see(p_tenant, t.client_id, p_actor, r)
    ORDER BY t.last_message_at DESC LIMIT lim) x WHERE (j->>'awaitingStaffReply')::boolean);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_comm\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_comm_thread_create','taxguard_comm_post','taxguard_comm_threads','taxguard_comm_messages','taxguard_comm_mark_read',
        'taxguard_comm_set_status','taxguard_comm_staff_inbox') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
