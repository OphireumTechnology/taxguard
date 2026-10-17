-- PROPOSAL (Phase 13A, contract C6). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 027 (taxguard_doc_actor) and 031 (client notifications).
--
-- Durable per-user notification preferences for client portal users.
--   * Only the in-app channel exists. E-mail and SMS are reported as NOT_COMMISSIONED and cannot be
--     stored or enabled: no transport, channel-consent wording or retention policy is approved.
--   * Categories:
--       DOCUMENT_REQUESTS   - requests, fulfilment, waivers, cancellations, replacements, rejections.
--                             Action-required service notices: MANDATORY, cannot be turned off.
--       ACCOUNT_SECURITY_LEGAL - security and legal notices: MANDATORY, cannot be turned off.
--       DOCUMENT_REMINDERS  - repeat reminders for an open request (kind REQUEST_REMINDER): OPTIONAL.
--     Turning reminders off hides reminder notifications for that user only. The request itself and
--     its original notification stay visible; the list reports how many reminders are hidden.
--   * Only the client user may change their own preferences (staff and managers cannot), with an
--     optimistic version; repeating the current value changes nothing. Each change writes an audit
--     row of identifiers only. At most 200 changes per preference.
-- A separate table: the legacy base-schema taxguard_notification_preferences (unused; its e-mail flag
-- defaults to TRUE without any transport or consent) is deliberately not used or changed.
-- Redefines taxguard_client_notifications_list (proposal 031) to apply the preference and report
-- `hidden`; the response is otherwise unchanged.
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE.
-- Rollback (development): re-apply proposal 031's taxguard_client_notifications_list, then drop the
-- two preference functions and the table.

CREATE TABLE IF NOT EXISTS public.taxguard_client_notification_prefs (
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  uid VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('DOCUMENT_REMINDERS')),
  channel VARCHAR(16) NOT NULL DEFAULT 'IN_APP' CHECK (channel = 'IN_APP'),
  enabled BOOLEAN NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 200),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, uid, category, channel),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id)
);
ALTER TABLE public.taxguard_client_notification_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.taxguard_client_notification_prefs FROM PUBLIC, anon, authenticated;

-- In-app reminders are shown unless this user turned them off.
CREATE OR REPLACE FUNCTION public.taxguard_reminders_enabled(p_tenant text, p_client text, p_actor text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE((SELECT p.enabled FROM public.taxguard_client_notification_prefs p WHERE p.tenant_id = p_tenant AND p.client_id = p_client AND p.uid = p_actor
    AND p.category = 'DOCUMENT_REMINDERS' AND p.channel = 'IN_APP'), true) $$;

CREATE OR REPLACE FUNCTION public.taxguard_notification_prefs(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text := public.taxguard_doc_actor(p_tenant, p_client, p_actor); v integer;
BEGIN
  IF r <> 'client' THEN RAISE EXCEPTION 'NOTIFICATION_CLIENT_ONLY' USING ERRCODE = 'P0001'; END IF;
  SELECT p.version INTO v FROM public.taxguard_client_notification_prefs p WHERE p.tenant_id = p_tenant AND p.client_id = p_client AND p.uid = p_actor
    AND p.category = 'DOCUMENT_REMINDERS' AND p.channel = 'IN_APP';
  RETURN jsonb_build_object(
    'channels', jsonb_build_object('IN_APP', 'AVAILABLE', 'EMAIL', 'NOT_COMMISSIONED', 'SMS', 'NOT_COMMISSIONED'),
    'categories', jsonb_build_array(
      jsonb_build_object('category', 'DOCUMENT_REQUESTS', 'mandatory', true, 'inApp', true, 'version', 0),
      jsonb_build_object('category', 'DOCUMENT_REMINDERS', 'mandatory', false, 'inApp', public.taxguard_reminders_enabled(p_tenant, p_client, p_actor), 'version', COALESCE(v, 0)),
      jsonb_build_object('category', 'ACCOUNT_SECURITY_LEGAL', 'mandatory', true, 'inApp', true, 'version', 0)));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_notification_pref_set(p_tenant text, p_client text, p_actor text, p_category text, p_channel text, p_enabled boolean, p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text := public.taxguard_doc_actor(p_tenant, p_client, p_actor); cur public.taxguard_client_notification_prefs;
BEGIN
  IF r <> 'client' THEN RAISE EXCEPTION 'NOTIFICATION_CLIENT_ONLY' USING ERRCODE = 'P0001'; END IF;
  IF p_category IS NULL OR p_channel IS NULL OR p_enabled IS NULL OR p_version IS NULL OR p_version < 0
     OR p_category NOT IN ('DOCUMENT_REQUESTS','DOCUMENT_REMINDERS','ACCOUNT_SECURITY_LEGAL') OR p_channel NOT IN ('IN_APP','EMAIL','SMS') THEN
    RAISE EXCEPTION 'NOTIFICATION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_channel <> 'IN_APP' THEN RAISE EXCEPTION 'NOTIFICATION_CHANNEL_UNAVAILABLE' USING ERRCODE = 'P0001'; END IF;
  IF p_category <> 'DOCUMENT_REMINDERS' THEN RAISE EXCEPTION 'NOTIFICATION_CATEGORY_MANDATORY' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO cur FROM public.taxguard_client_notification_prefs p WHERE p.tenant_id = p_tenant AND p.client_id = p_client AND p.uid = p_actor
    AND p.category = p_category AND p.channel = p_channel FOR UPDATE;
  IF COALESCE(cur.version, 0) <> p_version THEN RAISE EXCEPTION 'NOTIFICATION_PREF_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF COALESCE(cur.enabled, true) = p_enabled THEN
    RETURN public.taxguard_notification_prefs(p_tenant, p_client, p_actor) || jsonb_build_object('changed', false);
  END IF;
  IF cur.version >= 200 THEN RAISE EXCEPTION 'NOTIFICATION_PREF_LIMIT' USING ERRCODE = 'P0001'; END IF;
  IF cur.uid IS NULL THEN
    -- A concurrent first write for the same preference fails the primary key and is reported as a conflict.
    BEGIN
      INSERT INTO public.taxguard_client_notification_prefs(tenant_id, client_id, uid, category, channel, enabled) VALUES (p_tenant, p_client, p_actor, p_category, p_channel, p_enabled);
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'NOTIFICATION_PREF_VERSION_CONFLICT' USING ERRCODE = 'P0001';
    END;
  ELSE
    UPDATE public.taxguard_client_notification_prefs SET enabled = p_enabled, version = version + 1, updated_at = now()
      WHERE tenant_id = p_tenant AND client_id = p_client AND uid = p_actor AND category = p_category AND channel = p_channel;
  END IF;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES (p_tenant, 'NOTIFICATION_PREFERENCE_CHANGED', p_actor, r, jsonb_build_object('clientId', p_client, 'category', p_category, 'channel', p_channel, 'enabled', p_enabled));
  RETURN public.taxguard_notification_prefs(p_tenant, p_client, p_actor) || jsonb_build_object('changed', true);
END $$;

-- Proposal 031's list, with this user's reminder preference applied and the hidden count reported.
CREATE OR REPLACE FUNCTION public.taxguard_client_notifications_list(p_tenant text, p_client text, p_actor text, p_unread_only boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; show_reminders boolean;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  -- Preferences belong to the client user; staff always see every notification.
  show_reminders := r <> 'client' OR public.taxguard_reminders_enabled(p_tenant, p_client, p_actor);
  RETURN jsonb_build_object('unread', (SELECT count(*) FROM public.taxguard_client_notifications WHERE tenant_id = p_tenant AND client_id = p_client AND read_at IS NULL
        AND (show_reminders OR kind <> 'REQUEST_REMINDER')),
    'hidden', CASE WHEN show_reminders THEN 0 ELSE (SELECT count(*) FROM public.taxguard_client_notifications WHERE tenant_id = p_tenant AND client_id = p_client
        AND kind = 'REQUEST_REMINDER' AND (NOT COALESCE(p_unread_only, false) OR read_at IS NULL)) END,
    'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object('notificationId', n.notification_id, 'kind', n.kind, 'requestId', n.request_id, 'title', n.title,
        'channel', n.channel, 'deliveryStatus', n.delivery_status, 'createdAt', n.created_at, 'readAt', n.read_at) ORDER BY n.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.taxguard_client_notifications WHERE tenant_id = p_tenant AND client_id = p_client AND (NOT COALESCE(p_unread_only, false) OR read_at IS NULL)
        AND (show_reminders OR kind <> 'REQUEST_REMINDER') ORDER BY created_at DESC LIMIT 100) n));
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_reminders_enabled','taxguard_notification_prefs','taxguard_notification_pref_set','taxguard_client_notifications_list') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname <> 'taxguard_reminders_enabled' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
