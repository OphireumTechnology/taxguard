-- PROPOSAL 040 ONLY. NOT APPLIED. Requires the actual core schema and proposals 025 and 027.
-- Durable appointments and scheduling, replacing the in-memory /api/appointments and
-- /api/calendar stores for authenticated clients and staff.
--
--   * Scope: every appointment belongs to one (tenant, client), optionally to one of that client's
--     engagements (composite foreign key). Access is taxguard_doc_actor (proposal 027): a client
--     member only for their own client; staff with an ACTIVE assignment for the client, or managers.
--   * Responsible staff must be an active staff member who may see the client. A staff member, and
--     a client, can never hold two overlapping active (REQUESTED / CONFIRMED) appointments: each
--     create / reschedule takes transaction-scoped advisory locks (staff key, then client key — a
--     fixed order, so no deadlock) and re-checks overlap inside the same transaction.
--   * Status: REQUESTED -> CONFIRMED | CANCELLED; CONFIRMED -> COMPLETED | NO_SHOW | CANCELLED.
--     COMPLETED and NO_SHOW only once the appointment has started. Terminal states are final.
--     Clients may request (without a staff member) and cancel their own upcoming appointments;
--     everything else is staff work. Confirmation requires a responsible staff member.
--   * Times are timestamptz with the IANA time zone the appointment was booked in (validated);
--     30 minutes notice for client requests, 5 minutes to 8 hours long, at most 2 years ahead.
--   * Meeting links: https only, no credentials, query or fragment allowed only as a path; clients
--     see the link only once the appointment is CONFIRMED. The internal note is staff-only.
--   * Every change bumps the row version (optimistic concurrency), appends an immutable event
--     (fields changed, never note or link contents) and is audited. Every mutation carries an
--     idempotency key: a replay returns the current state without a second change.
-- Synthetic data only in tests. Rollback (development): drop the taxguard_apt_* functions, the two
-- triggers and the two tables (no other object depends on them).

CREATE TABLE IF NOT EXISTS public.taxguard_appointments (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id),
  appointment_id VARCHAR(40) NOT NULL CHECK (appointment_id ~ '^apt_[a-f0-9]{32}$'),
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128),
  staff_uid VARCHAR(128),
  category VARCHAR(32) NOT NULL CHECK (category IN ('CONSULTATION','DOCUMENT_REVIEW','TAX_PLANNING','RETURN_REVIEW','SIGNING_MEETING','GENERAL')),
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('REMOTE','IN_PERSON','PHONE')),
  status VARCHAR(16) NOT NULL CHECK (status IN ('REQUESTED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),
  title VARCHAR(200) NOT NULL CHECK (length(btrim(title)) >= 3),
  agenda VARCHAR(2000),
  internal_note VARCHAR(2000),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  meeting_url VARCHAR(500) CHECK (meeting_url IS NULL OR meeting_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{2,5})?(/[A-Za-z0-9._~/%-]*)?$'),
  location VARCHAR(300),
  cancel_reason VARCHAR(500),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by VARCHAR(128) NOT NULL,
  created_by_role VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by VARCHAR(128) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, appointment_id),
  CHECK (ends_at > starts_at AND ends_at - starts_at >= interval '5 minutes' AND ends_at - starts_at <= interval '8 hours'),
  CHECK (status <> 'CONFIRMED' OR staff_uid IS NOT NULL),
  CHECK (status <> 'CANCELLED' OR cancel_reason IS NOT NULL),
  CHECK (mode <> 'IN_PERSON' OR meeting_url IS NULL),
  FOREIGN KEY (tenant_id, client_id, engagement_id) REFERENCES public.taxguard_engagements(tenant_id, client_id, engagement_id)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_apt_staff_time ON public.taxguard_appointments(tenant_id, staff_uid, starts_at) WHERE status IN ('REQUESTED','CONFIRMED');
CREATE INDEX IF NOT EXISTS idx_taxguard_apt_client_time ON public.taxguard_appointments(tenant_id, client_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_taxguard_apt_tenant_time ON public.taxguard_appointments(tenant_id, starts_at);

CREATE TABLE IF NOT EXISTS public.taxguard_appointment_events (
  tenant_id VARCHAR(128) NOT NULL,
  appointment_id VARCHAR(40) NOT NULL,
  seq INTEGER NOT NULL CHECK (seq > 0),
  action VARCHAR(32) NOT NULL,
  actor_uid VARCHAR(128) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  request_key VARCHAR(80) NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, appointment_id, seq),
  UNIQUE (tenant_id, appointment_id, request_key),
  FOREIGN KEY (tenant_id, appointment_id) REFERENCES public.taxguard_appointments(tenant_id, appointment_id)
);
ALTER TABLE public.taxguard_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_appointment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_appointments, public.taxguard_appointment_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_apt_events_append_only() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'APPOINTMENT_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_apt_events_append_only ON public.taxguard_appointment_events;
CREATE TRIGGER trg_taxguard_apt_events_append_only BEFORE UPDATE OR DELETE ON public.taxguard_appointment_events
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_apt_events_append_only();

-- Identity, scope and creation provenance never change; appointments are never deleted.
CREATE OR REPLACE FUNCTION public.taxguard_apt_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'APPOINTMENT_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.version <> OLD.version + 1
    OR OLD.status IN ('COMPLETED','CANCELLED','NO_SHOW') THEN
    RAISE EXCEPTION 'APPOINTMENT_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_apt_guard ON public.taxguard_appointments;
CREATE TRIGGER trg_taxguard_apt_guard BEFORE UPDATE OR DELETE ON public.taxguard_appointments FOR EACH ROW EXECUTE FUNCTION public.taxguard_apt_guard();

-- ------------------------------------------------------------------------------------------
-- Internal helpers
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_apt_fail(p_code text) RETURNS void LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RAISE EXCEPTION '%', p_code USING ERRCODE = 'P0001'; END $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_key(p_key text) RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,80}$' THEN PERFORM public.taxguard_apt_fail('IDEMPOTENCY_KEY_REQUIRED'); END IF;
  RETURN p_key;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_staff(p_role text) RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public, pg_temp AS $$ SELECT p_role NOT IN ('client','prospective_client','recruiter') $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_json(a public.taxguard_appointments, p_staff boolean) RETURNS jsonb LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('appointmentId', a.appointment_id, 'clientId', a.client_id, 'engagementId', a.engagement_id, 'category', a.category, 'mode', a.mode,
    'status', a.status, 'title', a.title, 'agenda', a.agenda, 'startsAt', a.starts_at, 'endsAt', a.ends_at, 'timezone', a.timezone,
    'location', a.location, 'meetingUrl', CASE WHEN p_staff OR a.status = 'CONFIRMED' THEN a.meeting_url END, 'cancelReason', a.cancel_reason,
    'hasStaff', a.staff_uid IS NOT NULL, 'version', a.version, 'createdAt', a.created_at, 'updatedAt', a.updated_at)
  || CASE WHEN p_staff THEN jsonb_build_object('staffUid', a.staff_uid, 'internalNote', a.internal_note, 'createdBy', a.created_by,
       'createdByRole', a.created_by_role, 'updatedBy', a.updated_by) ELSE '{}'::jsonb END $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_event(a public.taxguard_appointments, p_action text, p_actor text, p_role text, p_key text, p_changes jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_appointment_events(tenant_id, appointment_id, seq, action, actor_uid, actor_role, request_key, changes)
  VALUES (a.tenant_id, a.appointment_id, (SELECT COALESCE(max(seq), 0) + 1 FROM public.taxguard_appointment_events WHERE tenant_id = a.tenant_id AND appointment_id = a.appointment_id),
    p_action, p_actor, p_role, p_key, COALESCE(p_changes, '{}'::jsonb));
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (a.tenant_id, 'APPOINTMENT_' || p_action, p_actor, p_role, jsonb_build_object('clientId', a.client_id, 'appointmentId', a.appointment_id,
    'status', a.status, 'version', a.version) || COALESCE(p_changes, '{}'::jsonb)) $$;

-- Validated time window. Clients need 30 minutes notice; nothing more than two years ahead.
CREATE OR REPLACE FUNCTION public.taxguard_apt_window(p_starts text, p_ends text, p_timezone text, p_client boolean) RETURNS tstzrange
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s timestamptz; e timestamptz; notice interval := CASE WHEN p_client THEN interval '30 minutes' ELSE interval '0' END;
BEGIN
  IF p_timezone IS NULL OR length(p_timezone) > 64 OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone) THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_TIMEZONE_INVALID');
  END IF;
  BEGIN s := p_starts::timestamptz; e := p_ends::timestamptz;
  EXCEPTION WHEN others THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID'); END;
  IF s IS NULL OR e IS NULL OR e <= s OR e - s < interval '5 minutes' OR e - s > interval '8 hours' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_TIME_INVALID'); END IF;
  IF s < now() + notice OR s > now() + interval '2 years' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_TIME_INVALID'); END IF;
  RETURN tstzrange(s, e, '[)');
END $$;

-- Serializes bookings for the staff member and the client, then refuses overlaps with other active appointments.
CREATE OR REPLACE FUNCTION public.taxguard_apt_check_conflicts(p_tenant text, p_client text, p_staff text, p_window tstzrange, p_except text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_staff IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('taxguard_apt_staff|' || p_tenant || '|' || p_staff, 0));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('taxguard_apt_client|' || p_tenant || '|' || p_client, 0));
  IF p_staff IS NOT NULL AND EXISTS (SELECT 1 FROM public.taxguard_appointments WHERE tenant_id = p_tenant AND staff_uid = p_staff
      AND status IN ('REQUESTED','CONFIRMED') AND appointment_id IS DISTINCT FROM p_except AND tstzrange(starts_at, ends_at, '[)') && p_window) THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_CONFLICT');
  END IF;
  IF EXISTS (SELECT 1 FROM public.taxguard_appointments WHERE tenant_id = p_tenant AND client_id = p_client
      AND status IN ('REQUESTED','CONFIRMED') AND appointment_id IS DISTINCT FROM p_except AND tstzrange(starts_at, ends_at, '[)') && p_window) THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_CLIENT_CONFLICT');
  END IF;
END $$;

-- A responsible staff member: active, a staff role, and allowed to see the client.
CREATE OR REPLACE FUNCTION public.taxguard_apt_check_staff(p_tenant text, p_client text, p_staff text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  IF p_staff IS NULL THEN RETURN; END IF;
  SELECT role INTO r FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_staff AND status = 'active';
  IF NOT FOUND OR NOT public.taxguard_apt_staff(r) OR r = 'bookkeeper' OR NOT public.taxguard_practice_can_see(p_tenant, p_client, p_staff, r) THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_INVALID');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_text(p_value text, p_max integer) RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN RETURN NULL; END IF;
  IF length(btrim(p_value)) > p_max THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID'); END IF;
  RETURN btrim(p_value);
END $$;

-- The appointment in (tenant, client), locked for update.
CREATE OR REPLACE FUNCTION public.taxguard_apt_locked(p_tenant text, p_client text, p_id text) RETURNS public.taxguard_appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a public.taxguard_appointments;
BEGIN
  IF p_id IS NULL OR p_id !~ '^apt_[a-f0-9]{32}$' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID'); END IF;
  SELECT * INTO a FROM public.taxguard_appointments WHERE tenant_id = p_tenant AND client_id = p_client AND appointment_id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_NOT_FOUND'); END IF;
  RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_replayed(a public.taxguard_appointments, p_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.taxguard_appointment_events WHERE tenant_id = a.tenant_id AND appointment_id = a.appointment_id AND request_key = p_key) $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs
-- ------------------------------------------------------------------------------------------
-- Input: {title, category, mode, startsAt, endsAt, timezone, engagementId?, staffUid?, agenda?, internalNote?, meetingUrl?, location?, confirm?}
CREATE OR REPLACE FUNCTION public.taxguard_apt_create(p_tenant text, p_client text, p_actor text, p_id text, p_key text, p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; staff boolean; a public.taxguard_appointments; w tstzrange; st text; v_staff text; key text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  staff := public.taxguard_apt_staff(r);
  IF r = 'bookkeeper' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED'); END IF;
  key := public.taxguard_apt_key(p_key);
  IF p_id IS NULL OR p_id !~ '^apt_[a-f0-9]{32}$' OR p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID'); END IF;
  SELECT * INTO a FROM public.taxguard_appointments WHERE tenant_id = p_tenant AND appointment_id = p_id;
  IF FOUND THEN
    IF a.client_id <> p_client OR a.created_by <> p_actor OR NOT public.taxguard_apt_replayed(a, key) THEN PERFORM public.taxguard_apt_fail('IDEMPOTENCY_KEY_REUSED'); END IF;
    RETURN public.taxguard_apt_json(a, staff) || jsonb_build_object('replayed', true);
  END IF;
  -- Clients only request; the responsible staff member is chosen by the practice.
  v_staff := CASE WHEN staff THEN NULLIF(p_input->>'staffUid', '') END;
  IF NOT staff AND (NULLIF(p_input->>'staffUid', '') IS NOT NULL OR NULLIF(p_input->>'internalNote', '') IS NOT NULL OR NULLIF(p_input->>'meetingUrl', '') IS NOT NULL
      OR COALESCE((p_input->>'confirm')::boolean, false)) THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED');
  END IF;
  PERFORM public.taxguard_apt_check_staff(p_tenant, p_client, v_staff);
  st := CASE WHEN staff AND COALESCE((p_input->>'confirm')::boolean, false) THEN 'CONFIRMED' ELSE 'REQUESTED' END;
  IF st = 'CONFIRMED' AND v_staff IS NULL THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED'); END IF;
  IF NULLIF(p_input->>'engagementId', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_engagements
      WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_input->>'engagementId') THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_SCOPE_MISMATCH');
  END IF;
  w := public.taxguard_apt_window(p_input->>'startsAt', p_input->>'endsAt', p_input->>'timezone', NOT staff);
  PERFORM public.taxguard_apt_check_conflicts(p_tenant, p_client, v_staff, w, NULL);
  BEGIN
    INSERT INTO public.taxguard_appointments(tenant_id, appointment_id, client_id, engagement_id, staff_uid, category, mode, status, title, agenda, internal_note,
      starts_at, ends_at, timezone, meeting_url, location, created_by, created_by_role, updated_by)
    VALUES (p_tenant, p_id, p_client, NULLIF(p_input->>'engagementId', ''), v_staff, COALESCE(NULLIF(p_input->>'category', ''), 'GENERAL'), p_input->>'mode', st,
      btrim(COALESCE(p_input->>'title', '')), public.taxguard_apt_text(p_input->>'agenda', 2000), public.taxguard_apt_text(p_input->>'internalNote', 2000),
      lower(w), upper(w), p_input->>'timezone', public.taxguard_apt_text(p_input->>'meetingUrl', 500), public.taxguard_apt_text(p_input->>'location', 300), p_actor, r, p_actor)
    RETURNING * INTO a;
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation OR foreign_key_violation THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID');
  END;
  PERFORM public.taxguard_apt_event(a, CASE WHEN st = 'CONFIRMED' THEN 'CREATED_CONFIRMED' ELSE 'REQUESTED' END, p_actor, r, key,
    jsonb_build_object('startsAt', a.starts_at, 'endsAt', a.ends_at, 'staffAssigned', a.staff_uid IS NOT NULL));
  RETURN public.taxguard_apt_json(a, staff) || jsonb_build_object('replayed', false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_get(p_tenant text, p_client text, p_actor text, p_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; a public.taxguard_appointments;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  SELECT * INTO a FROM public.taxguard_appointments WHERE tenant_id = p_tenant AND client_id = p_client AND appointment_id = p_id;
  IF NOT FOUND THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_NOT_FOUND'); END IF;
  RETURN public.taxguard_apt_json(a, public.taxguard_apt_staff(r)) || CASE WHEN public.taxguard_apt_staff(r) THEN jsonb_build_object('history',
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('seq', e.seq, 'action', e.action, 'actorUid', e.actor_uid, 'actorRole', e.actor_role, 'at', e.at, 'changes', e.changes) ORDER BY e.seq), '[]'::jsonb)
      FROM public.taxguard_appointment_events e WHERE e.tenant_id = a.tenant_id AND e.appointment_id = a.appointment_id)) ELSE '{}'::jsonb END;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_list_client(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_apt_json(a, public.taxguard_apt_staff(r)) ORDER BY a.starts_at DESC), '[]'::jsonb) FROM
    (SELECT * FROM public.taxguard_appointments WHERE tenant_id = p_tenant AND client_id = p_client ORDER BY starts_at DESC LIMIT 200) a);
END $$;

-- Staff schedule (own appointments) or, for managers, the practice calendar (all, or one staff member).
CREATE OR REPLACE FUNCTION public.taxguard_apt_schedule(p_tenant text, p_actor text, p_from text, p_to text, p_staff text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; f timestamptz; t timestamptz; manager boolean;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_apt_staff(r) OR r = 'bookkeeper' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED'); END IF;
  BEGIN f := p_from::timestamptz; t := p_to::timestamptz;
  EXCEPTION WHEN others THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID'); END;
  IF f IS NULL OR t IS NULL OR t <= f OR t - f > interval '62 days' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_RANGE_INVALID'); END IF;
  manager := public.taxguard_practice_is_manager(r);
  IF NOT manager AND p_staff IS NOT NULL AND p_staff <> p_actor THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_MANAGER_REQUIRED'); END IF;
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_apt_json(a, true) || jsonb_build_object('clientName', c.name) ORDER BY a.starts_at, a.appointment_id), '[]'::jsonb)
    FROM public.taxguard_appointments a JOIN public.taxguard_clients c ON c.tenant_id = a.tenant_id AND c.client_id = a.client_id
    WHERE a.tenant_id = p_tenant AND a.starts_at < t AND a.ends_at > f
      AND (CASE WHEN manager THEN (p_staff IS NULL OR a.staff_uid = p_staff) ELSE a.staff_uid = p_actor END));
END $$;

-- Staff edits of descriptive fields: {title?, category?, mode?, agenda?, internalNote?, meetingUrl?, location?, engagementId?}
CREATE OR REPLACE FUNCTION public.taxguard_apt_update(p_tenant text, p_client text, p_actor text, p_id text, p_version integer, p_key text, p_fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; a public.taxguard_appointments; key text; changed text[] := '{}'; k text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_apt_staff(r) OR r = 'bookkeeper' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED'); END IF;
  key := public.taxguard_apt_key(p_key);
  a := public.taxguard_apt_locked(p_tenant, p_client, p_id);
  IF public.taxguard_apt_replayed(a, key) THEN RETURN public.taxguard_apt_json(a, true) || jsonb_build_object('replayed', true); END IF;
  IF a.version <> p_version THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_VERSION_CONFLICT'); END IF;
  IF a.status NOT IN ('REQUESTED','CONFIRMED') THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_CLOSED'); END IF;
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID'); END IF;
  FOR k IN SELECT jsonb_object_keys(p_fields) LOOP
    IF k NOT IN ('title','category','mode','agenda','internalNote','meetingUrl','location','engagementId') THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_FIELD_NOT_EDITABLE'); END IF;
    changed := changed || k;
  END LOOP;
  IF cardinality(changed) = 0 THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID'); END IF;
  IF p_fields ? 'engagementId' AND NULLIF(p_fields->>'engagementId', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_engagements
      WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_fields->>'engagementId') THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_SCOPE_MISMATCH');
  END IF;
  BEGIN
    UPDATE public.taxguard_appointments SET
      title = CASE WHEN p_fields ? 'title' THEN btrim(COALESCE(p_fields->>'title', '')) ELSE title END,
      category = CASE WHEN p_fields ? 'category' THEN p_fields->>'category' ELSE category END,
      mode = CASE WHEN p_fields ? 'mode' THEN p_fields->>'mode' ELSE mode END,
      agenda = CASE WHEN p_fields ? 'agenda' THEN public.taxguard_apt_text(p_fields->>'agenda', 2000) ELSE agenda END,
      internal_note = CASE WHEN p_fields ? 'internalNote' THEN public.taxguard_apt_text(p_fields->>'internalNote', 2000) ELSE internal_note END,
      meeting_url = CASE WHEN p_fields ? 'meetingUrl' THEN public.taxguard_apt_text(p_fields->>'meetingUrl', 500) ELSE meeting_url END,
      location = CASE WHEN p_fields ? 'location' THEN public.taxguard_apt_text(p_fields->>'location', 300) ELSE location END,
      engagement_id = CASE WHEN p_fields ? 'engagementId' THEN NULLIF(p_fields->>'engagementId', '') ELSE engagement_id END,
      version = version + 1, updated_by = p_actor, updated_at = now()
    WHERE tenant_id = p_tenant AND appointment_id = p_id RETURNING * INTO a;
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation OR foreign_key_violation THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID');
  END;
  PERFORM public.taxguard_apt_event(a, 'UPDATED', p_actor, r, key, jsonb_build_object('fields', to_jsonb(changed)));
  RETURN public.taxguard_apt_json(a, true) || jsonb_build_object('replayed', false);
END $$;

-- Staff reschedule (and optionally reassign): {startsAt, endsAt, timezone, staffUid?}
CREATE OR REPLACE FUNCTION public.taxguard_apt_reschedule(p_tenant text, p_client text, p_actor text, p_id text, p_version integer, p_key text, p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; a public.taxguard_appointments; key text; w tstzrange; v_staff text; prev tstzrange; prev_staff text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_apt_staff(r) OR r = 'bookkeeper' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED'); END IF;
  key := public.taxguard_apt_key(p_key);
  a := public.taxguard_apt_locked(p_tenant, p_client, p_id);
  IF public.taxguard_apt_replayed(a, key) THEN RETURN public.taxguard_apt_json(a, true) || jsonb_build_object('replayed', true); END IF;
  IF a.version <> p_version THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_VERSION_CONFLICT'); END IF;
  IF a.status NOT IN ('REQUESTED','CONFIRMED') THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_CLOSED'); END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID'); END IF;
  v_staff := CASE WHEN p_input ? 'staffUid' THEN NULLIF(p_input->>'staffUid', '') ELSE a.staff_uid END;
  IF a.status = 'CONFIRMED' AND v_staff IS NULL THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED'); END IF;
  PERFORM public.taxguard_apt_check_staff(p_tenant, p_client, v_staff);
  w := public.taxguard_apt_window(p_input->>'startsAt', p_input->>'endsAt', p_input->>'timezone', false);
  PERFORM public.taxguard_apt_check_conflicts(p_tenant, p_client, v_staff, w, a.appointment_id);
  prev := tstzrange(a.starts_at, a.ends_at, '[)'); prev_staff := a.staff_uid;
  UPDATE public.taxguard_appointments SET starts_at = lower(w), ends_at = upper(w), timezone = p_input->>'timezone', staff_uid = v_staff,
    version = version + 1, updated_by = p_actor, updated_at = now()
  WHERE tenant_id = p_tenant AND appointment_id = p_id RETURNING * INTO a;
  PERFORM public.taxguard_apt_event(a, 'RESCHEDULED', p_actor, r, key, jsonb_build_object('fromStartsAt', lower(prev), 'startsAt', a.starts_at, 'endsAt', a.ends_at,
    'staffChanged', v_staff IS DISTINCT FROM prev_staff));
  RETURN public.taxguard_apt_json(a, true) || jsonb_build_object('replayed', false);
END $$;

-- Status transitions: confirm | complete | no_show | cancel (cancel needs a reason, 5-500 characters).
CREATE OR REPLACE FUNCTION public.taxguard_apt_transition(p_tenant text, p_client text, p_actor text, p_id text, p_version integer, p_key text, p_action text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; staff boolean; a public.taxguard_appointments; key text; target text; reason text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  staff := public.taxguard_apt_staff(r);
  IF r = 'bookkeeper' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED'); END IF;
  key := public.taxguard_apt_key(p_key);
  a := public.taxguard_apt_locked(p_tenant, p_client, p_id);
  IF public.taxguard_apt_replayed(a, key) THEN RETURN public.taxguard_apt_json(a, staff) || jsonb_build_object('replayed', true); END IF;
  IF a.version <> p_version THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_VERSION_CONFLICT'); END IF;
  target := CASE p_action WHEN 'confirm' THEN 'CONFIRMED' WHEN 'complete' THEN 'COMPLETED' WHEN 'no_show' THEN 'NO_SHOW' WHEN 'cancel' THEN 'CANCELLED' END;
  IF target IS NULL THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_INPUT_INVALID'); END IF;
  IF NOT staff AND target <> 'CANCELLED' THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED'); END IF;
  IF NOT ((a.status = 'REQUESTED' AND target IN ('CONFIRMED','CANCELLED')) OR (a.status = 'CONFIRMED' AND target IN ('COMPLETED','NO_SHOW','CANCELLED'))) THEN
    PERFORM public.taxguard_apt_fail('APPOINTMENT_TRANSITION_INVALID');
  END IF;
  IF target = 'CONFIRMED' AND a.staff_uid IS NULL THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_STAFF_REQUIRED'); END IF;
  IF target IN ('COMPLETED','NO_SHOW') AND a.starts_at > now() THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_NOT_STARTED'); END IF;
  IF target = 'CANCELLED' AND NOT staff AND a.starts_at <= now() THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_TRANSITION_INVALID'); END IF;
  reason := btrim(COALESCE(p_reason, ''));
  IF target = 'CANCELLED' AND (length(reason) < 5 OR length(reason) > 500) THEN PERFORM public.taxguard_apt_fail('APPOINTMENT_REASON_REQUIRED'); END IF;
  UPDATE public.taxguard_appointments SET status = target, cancel_reason = CASE WHEN target = 'CANCELLED' THEN reason ELSE cancel_reason END,
    version = version + 1, updated_by = p_actor, updated_at = now()
  WHERE tenant_id = p_tenant AND appointment_id = p_id RETURNING * INTO a;
  PERFORM public.taxguard_apt_event(a, target, p_actor, r, key, '{}'::jsonb);
  RETURN public.taxguard_apt_json(a, staff) || jsonb_build_object('replayed', false);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_apt\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_apt_create','taxguard_apt_get','taxguard_apt_list_client','taxguard_apt_schedule','taxguard_apt_update',
        'taxguard_apt_reschedule','taxguard_apt_transition') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
