-- PROPOSAL (Phase 13A, contract C5). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 027 (taxguard_doc_actor) and 040 (appointments).
--
-- Durable consultation rooms, derived from the authoritative appointment (proposal 040) instead of
-- the legacy in-memory /api/consultation-rooms state (which fabricated participant names).
--   * Participants: the client of the appointment's client, the appointment's assigned staff member
--     (host) and practice managers / administrators. Other staff, other clients and other tenants
--     are refused (APPOINTMENT_NOT_FOUND, no existence disclosure).
--   * Room state is computed, never stored: NOT_REMOTE, NOT_CONFIRMED, CANCELLED, ENDED, NOT_YET_OPEN
--     or OPEN. The access window opens 15 minutes before the start and closes 15 minutes after the end.
--   * The appointment's meeting link is returned only while the room is OPEN for a confirmed remote
--     appointment. No video transport is provided or implied: videoProvider is 'NOT_COMMISSIONED'.
--   * Join / leave events are durable and append-only (taxguard_appointment_room_events) with an audit
--     row of identifiers only. Joining is allowed only while OPEN; repeating a join or a leave is
--     idempotent; at most 50 events per participant per appointment. Nothing is recorded about audio,
--     video, chat or content: recording requires an approved provider, consent policy and retention.
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE.
-- Rollback (development): drop the two functions and the events table (events are history only).

CREATE TABLE IF NOT EXISTS public.taxguard_appointment_room_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  appointment_id VARCHAR(40) NOT NULL,
  actor_uid VARCHAR(128) NOT NULL,
  participant VARCHAR(16) NOT NULL CHECK (participant IN ('CLIENT','HOST','MANAGER')),
  event VARCHAR(8) NOT NULL CHECK (event IN ('JOINED','LEFT')),
  at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_taxguard_room_events ON public.taxguard_appointment_room_events (tenant_id, appointment_id, actor_uid, at);
ALTER TABLE public.taxguard_appointment_room_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.taxguard_appointment_room_events FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.taxguard_room_events_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'ROOM_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_room_events_append_only ON public.taxguard_appointment_room_events;
CREATE TRIGGER trg_taxguard_room_events_append_only BEFORE UPDATE OR DELETE ON public.taxguard_appointment_room_events
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_room_events_append_only();

-- Participant role of the actor for this appointment, or a refusal.
CREATE OR REPLACE FUNCTION public.taxguard_room_participant(p_tenant text, p_client text, p_actor text, a public.taxguard_appointments) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
BEGIN
  IF r IN ('client', 'prospective_client') THEN RETURN 'CLIENT'; END IF;
  IF a.staff_uid IS NOT DISTINCT FROM p_actor THEN RETURN 'HOST'; END IF;
  IF public.taxguard_practice_is_manager(r) THEN RETURN 'MANAGER'; END IF;
  RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING ERRCODE = 'P0001';
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_room_state(a public.taxguard_appointments) RETURNS text LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE WHEN a.status = 'CANCELLED' THEN 'CANCELLED'
    WHEN a.mode <> 'REMOTE' THEN 'NOT_REMOTE'
    WHEN a.status IN ('COMPLETED', 'NO_SHOW') OR now() > a.ends_at + interval '15 minutes' THEN 'ENDED'
    WHEN a.status <> 'CONFIRMED' THEN 'NOT_CONFIRMED'
    WHEN now() < a.starts_at - interval '15 minutes' THEN 'NOT_YET_OPEN'
    ELSE 'OPEN' END $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_room(p_tenant text, p_client text, p_actor text, p_appointment text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a public.taxguard_appointments; who text; state text; last_event text;
BEGIN
  IF p_appointment IS NULL OR p_appointment !~ '^apt_[a-f0-9]{32}$' THEN RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO a FROM public.taxguard_appointments WHERE tenant_id = p_tenant AND client_id = p_client AND appointment_id = p_appointment;
  IF NOT FOUND THEN PERFORM public.taxguard_doc_actor(p_tenant, p_client, p_actor); RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  who := public.taxguard_room_participant(p_tenant, p_client, p_actor, a);
  state := public.taxguard_room_state(a);
  SELECT e.event INTO last_event FROM public.taxguard_appointment_room_events e WHERE e.tenant_id = p_tenant AND e.appointment_id = p_appointment AND e.actor_uid = p_actor
    ORDER BY e.at DESC, e.event_id DESC LIMIT 1;
  RETURN jsonb_build_object('appointmentId', a.appointment_id, 'title', a.title, 'mode', a.mode, 'appointmentStatus', a.status,
    'startsAt', a.starts_at, 'endsAt', a.ends_at, 'timezone', a.timezone, 'participant', who, 'roomState', state,
    'accessWindow', jsonb_build_object('opensAt', a.starts_at - interval '15 minutes', 'closesAt', a.ends_at + interval '15 minutes'),
    'host', jsonb_build_object('assigned', a.staff_uid IS NOT NULL, 'displayName', (SELECT NULLIF(btrim(i.user_data->>'name'), '') FROM public.taxguard_identities i WHERE i.tenant_id = p_tenant AND i.uid = a.staff_uid)),
    'clientName', (SELECT c.name FROM public.taxguard_clients c WHERE c.tenant_id = p_tenant AND c.client_id = p_client),
    'meetingUrl', CASE WHEN state = 'OPEN' THEN a.meeting_url END,
    'videoProvider', 'NOT_COMMISSIONED',
    'joined', last_event IS NOT DISTINCT FROM 'JOINED',
    'hostPresent', EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (e.actor_uid) e.event FROM public.taxguard_appointment_room_events e
       WHERE e.tenant_id = p_tenant AND e.appointment_id = p_appointment AND e.participant = 'HOST' ORDER BY e.actor_uid, e.at DESC, e.event_id DESC) x WHERE x.event = 'JOINED'),
    'clientPresent', EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (e.actor_uid) e.event FROM public.taxguard_appointment_room_events e
       WHERE e.tenant_id = p_tenant AND e.appointment_id = p_appointment AND e.participant = 'CLIENT' ORDER BY e.actor_uid, e.at DESC, e.event_id DESC) x WHERE x.event = 'JOINED'));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_apt_room_event(p_tenant text, p_client text, p_actor text, p_appointment text, p_event text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a public.taxguard_appointments; who text; last_event text; n integer;
BEGIN
  IF p_event IS NULL OR p_event NOT IN ('JOINED','LEFT') OR p_appointment IS NULL OR p_appointment !~ '^apt_[a-f0-9]{32}$' THEN
    RAISE EXCEPTION 'ROOM_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO a FROM public.taxguard_appointments WHERE tenant_id = p_tenant AND client_id = p_client AND appointment_id = p_appointment FOR SHARE;
  IF NOT FOUND THEN PERFORM public.taxguard_doc_actor(p_tenant, p_client, p_actor); RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  who := public.taxguard_room_participant(p_tenant, p_client, p_actor, a);
  -- Serialize one participant's events for this appointment.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant || '|' || p_appointment || '|' || p_actor, 0));
  SELECT e.event INTO last_event FROM public.taxguard_appointment_room_events e WHERE e.tenant_id = p_tenant AND e.appointment_id = p_appointment AND e.actor_uid = p_actor
    ORDER BY e.at DESC, e.event_id DESC LIMIT 1;
  IF last_event IS NOT DISTINCT FROM p_event OR (p_event = 'LEFT' AND last_event IS NULL) THEN
    RETURN public.taxguard_apt_room(p_tenant, p_client, p_actor, p_appointment) || jsonb_build_object('recorded', false);
  END IF;
  IF p_event = 'JOINED' AND public.taxguard_room_state(a) <> 'OPEN' THEN RAISE EXCEPTION 'ROOM_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;
  SELECT count(*) INTO n FROM public.taxguard_appointment_room_events e WHERE e.tenant_id = p_tenant AND e.appointment_id = p_appointment AND e.actor_uid = p_actor;
  IF n >= 50 THEN RAISE EXCEPTION 'ROOM_EVENT_LIMIT' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_appointment_room_events(tenant_id, appointment_id, actor_uid, participant, event) VALUES (p_tenant, p_appointment, p_actor, who, p_event);
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES (p_tenant, 'APPOINTMENT_ROOM_' || p_event, p_actor, lower(who), jsonb_build_object('clientId', p_client, 'appointmentId', p_appointment));
  RETURN public.taxguard_apt_room(p_tenant, p_client, p_actor, p_appointment) || jsonb_build_object('recorded', true);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_room_participant','taxguard_room_state','taxguard_apt_room','taxguard_apt_room_event','taxguard_room_events_append_only') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_apt_room','taxguard_apt_room_event') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
