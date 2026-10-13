-- PROPOSAL 043 ONLY. NOT APPLIED. Requires the actual core schema and proposals 025, 027 and 040.
-- Durable public consultation requests, replacing the in-memory public booking (legacy
-- /api/appointments/book and /api/calendar/* used by the public consultation page).
--
--   * Visitors submit a REQUEST, not a booking: no account is created, no staff calendar is reserved
--     and no appointment exists until an authorized staff member converts the request.
--   * Submission (service role on behalf of the public endpoint): validated contact details, an
--     explicit consent version, at most three preferred windows, idempotent per submission key.
--     Abuse limits in the database: per e-mail (3 a day), per client fingerprint (5 an hour; the
--     server passes an HMAC of the address, never the address) and tenant-wide (60 an hour).
--     The public response never echoes stored data.
--   * Review: practice managers and administrators only. NEW -> IN_REVIEW -> CONVERTED | DECLINED |
--     SPAM (DECLINED / SPAM need a reason). Conversion links an EXISTING active client of the
--     tenant chosen by the reviewer (no identity is inferred from the visitor's e-mail) and creates
--     a real appointment through taxguard_apt_create (proposal 040) in the same transaction, so all
--     appointment rules (staff eligibility, conflicts, versions) apply.
--   * Versions, append-only events and audit entries with identifiers only (never name, e-mail,
--     phone or message). No e-mail or SMS is sent.
-- Retention: requests hold personal data of prospects; a retention period must be decided by the
-- practice before production (not encoded here).
-- Rollback (development): drop the taxguard_consult_* functions, triggers and two tables.

CREATE TABLE IF NOT EXISTS public.taxguard_consultation_requests (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id),
  request_id VARCHAR(40) NOT NULL CHECK (request_id ~ '^csr_[a-f0-9]{32}$'),
  full_name VARCHAR(120) NOT NULL CHECK (length(btrim(full_name)) >= 2),
  email VARCHAR(254) NOT NULL CHECK (email ~ '^[^@\s]{1,64}@[^@\s]+\.[A-Za-z]{2,}$'),
  phone VARCHAR(32) CHECK (phone IS NULL OR phone ~ '^[0-9+() .-]{7,32}$'),
  preferred_contact VARCHAR(8) NOT NULL CHECK (preferred_contact IN ('EMAIL','PHONE')),
  topic VARCHAR(32) NOT NULL CHECK (topic IN ('INDIVIDUAL_TAX','BUSINESS_TAX','TAX_PLANNING','BOOKKEEPING','IRS_NOTICE','OTHER')),
  mode_preference VARCHAR(16) NOT NULL CHECK (mode_preference IN ('REMOTE','IN_PERSON','PHONE')),
  preferred_windows JSONB NOT NULL CHECK (jsonb_typeof(preferred_windows) = 'array' AND jsonb_array_length(preferred_windows) BETWEEN 1 AND 3),
  timezone VARCHAR(64) NOT NULL,
  message VARCHAR(1000),
  consent_version VARCHAR(32) NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  email_hash CHAR(64) NOT NULL,
  client_fingerprint CHAR(64) NOT NULL CHECK (client_fingerprint ~ '^[a-f0-9]{64}$'),
  status VARCHAR(16) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','IN_REVIEW','CONVERTED','DECLINED','SPAM')),
  decision_reason VARCHAR(500),
  reviewed_by VARCHAR(128),
  converted_client_id VARCHAR(64),
  converted_appointment_id VARCHAR(40),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, request_id),
  CHECK (status NOT IN ('DECLINED','SPAM') OR decision_reason IS NOT NULL),
  CHECK (status <> 'CONVERTED' OR (converted_client_id IS NOT NULL AND converted_appointment_id IS NOT NULL)),
  FOREIGN KEY (tenant_id, converted_appointment_id) REFERENCES public.taxguard_appointments(tenant_id, appointment_id)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_consult_status ON public.taxguard_consultation_requests(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_taxguard_consult_email ON public.taxguard_consultation_requests(tenant_id, email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_taxguard_consult_fingerprint ON public.taxguard_consultation_requests(tenant_id, client_fingerprint, created_at DESC);

CREATE TABLE IF NOT EXISTS public.taxguard_consultation_request_events (
  tenant_id VARCHAR(128) NOT NULL,
  request_id VARCHAR(40) NOT NULL,
  seq INTEGER NOT NULL CHECK (seq > 0),
  action VARCHAR(32) NOT NULL,
  actor_uid VARCHAR(128),
  request_key VARCHAR(80) NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, request_id, seq),
  UNIQUE (tenant_id, request_id, request_key),
  FOREIGN KEY (tenant_id, request_id) REFERENCES public.taxguard_consultation_requests(tenant_id, request_id)
);
ALTER TABLE public.taxguard_consultation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_consultation_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_consultation_requests, public.taxguard_consultation_request_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_consult_events_append_only() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RAISE EXCEPTION 'CONSULTATION_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_consult_events_append_only ON public.taxguard_consultation_request_events;
CREATE TRIGGER trg_taxguard_consult_events_append_only BEFORE UPDATE OR DELETE ON public.taxguard_consultation_request_events FOR EACH ROW EXECUTE FUNCTION public.taxguard_consult_events_append_only();

-- Submitted details and consent never change; finished requests are frozen.
CREATE OR REPLACE FUNCTION public.taxguard_consult_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'CONSULTATION_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.full_name IS DISTINCT FROM OLD.full_name
    OR NEW.email IS DISTINCT FROM OLD.email OR NEW.phone IS DISTINCT FROM OLD.phone OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.preferred_windows IS DISTINCT FROM OLD.preferred_windows OR NEW.consent_version IS DISTINCT FROM OLD.consent_version
    OR NEW.consented_at IS DISTINCT FROM OLD.consented_at OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.version <> OLD.version + 1
    OR OLD.status IN ('CONVERTED','DECLINED','SPAM') THEN
    RAISE EXCEPTION 'CONSULTATION_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_consult_guard ON public.taxguard_consultation_requests;
CREATE TRIGGER trg_taxguard_consult_guard BEFORE UPDATE OR DELETE ON public.taxguard_consultation_requests FOR EACH ROW EXECUTE FUNCTION public.taxguard_consult_guard();

CREATE OR REPLACE FUNCTION public.taxguard_consult_fail(p_code text) RETURNS void LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RAISE EXCEPTION '%', p_code USING ERRCODE = 'P0001'; END $$;

CREATE OR REPLACE FUNCTION public.taxguard_consult_reviewer(p_tenant text, p_actor text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN PERFORM public.taxguard_consult_fail('CONSULTATION_REVIEWER_REQUIRED'); END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_consult_event(p_tenant text, p_request text, p_action text, p_actor text, p_role text, p_key text, p_meta jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_consultation_request_events(tenant_id, request_id, seq, action, actor_uid, request_key)
  VALUES (p_tenant, p_request, (SELECT COALESCE(max(seq), 0) + 1 FROM public.taxguard_consultation_request_events WHERE tenant_id = p_tenant AND request_id = p_request),
    p_action, p_actor, p_key);
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, 'CONSULTATION_' || p_action, COALESCE(p_actor, 'public-visitor'), p_role, jsonb_build_object('requestId', p_request) || COALESCE(p_meta, '{}'::jsonb)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_consult_json(q public.taxguard_consultation_requests) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('requestId', q.request_id, 'reference', upper(substr(q.request_id, 5, 8)), 'fullName', q.full_name, 'email', q.email, 'phone', q.phone,
    'preferredContact', q.preferred_contact, 'topic', q.topic, 'modePreference', q.mode_preference, 'preferredWindows', q.preferred_windows, 'timezone', q.timezone,
    'message', q.message, 'consentVersion', q.consent_version, 'consentedAt', q.consented_at, 'status', q.status, 'decisionReason', q.decision_reason,
    'reviewedBy', q.reviewed_by, 'convertedClientId', q.converted_client_id, 'convertedAppointmentId', q.converted_appointment_id, 'version', q.version,
    'createdAt', q.created_at, 'updatedAt', q.updated_at) $$;

-- ------------------------------------------------------------------------------------------
-- Public submission (called by the server's public endpoint with the service role)
-- ------------------------------------------------------------------------------------------
-- Input: {fullName, email, phone?, preferredContact, topic, modePreference, preferredWindows:[{date, partOfDay}], timezone, message?, consentVersion, consent: true}
CREATE OR REPLACE FUNCTION public.taxguard_consult_submit(p_tenant text, p_id text, p_key text, p_fingerprint text, p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE q public.taxguard_consultation_requests; em text; eh text; w jsonb; d date;
BEGIN
  PERFORM 1 FROM public.taxguard_tenants WHERE id = p_tenant AND status = 'active';
  IF NOT FOUND THEN PERFORM public.taxguard_consult_fail('CONSULTATION_UNAVAILABLE'); END IF;
  IF p_id IS NULL OR p_id !~ '^csr_[a-f0-9]{32}$' OR p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,80}$' OR p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    PERFORM public.taxguard_consult_fail('CONSULTATION_INPUT_INVALID');
  END IF;
  em := lower(btrim(COALESCE(p_input->>'email', '')));
  eh := encode(sha256(convert_to(p_tenant || '|' || em, 'UTF8')), 'hex');
  -- Replay of the same submission: acknowledged again, nothing new is stored or revealed.
  SELECT * INTO q FROM public.taxguard_consultation_requests WHERE tenant_id = p_tenant AND request_id = p_id;
  IF FOUND THEN
    IF q.email_hash <> eh THEN PERFORM public.taxguard_consult_fail('IDEMPOTENCY_KEY_REUSED'); END IF;
    RETURN jsonb_build_object('received', true, 'reference', upper(substr(q.request_id, 5, 8)), 'replayed', true);
  END IF;
  IF COALESCE((p_input->>'consent')::boolean, false) IS NOT TRUE OR COALESCE(p_input->>'consentVersion', '') !~ '^[A-Za-z0-9_.-]{1,32}$' THEN
    PERFORM public.taxguard_consult_fail('CONSULTATION_CONSENT_REQUIRED');
  END IF;
  IF p_input->>'timezone' IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_input->>'timezone') THEN
    PERFORM public.taxguard_consult_fail('CONSULTATION_INPUT_INVALID');
  END IF;
  IF jsonb_typeof(p_input->'preferredWindows') <> 'array' OR jsonb_array_length(p_input->'preferredWindows') NOT BETWEEN 1 AND 3 THEN
    PERFORM public.taxguard_consult_fail('CONSULTATION_INPUT_INVALID');
  END IF;
  FOR w IN SELECT value FROM jsonb_array_elements(p_input->'preferredWindows') LOOP
    BEGIN d := (w->>'date')::date; EXCEPTION WHEN others THEN PERFORM public.taxguard_consult_fail('CONSULTATION_INPUT_INVALID'); END;
    IF d IS NULL OR d < current_date OR d > current_date + 120 OR COALESCE(w->>'partOfDay', '') NOT IN ('MORNING','AFTERNOON','EVENING')
      OR (SELECT count(*) FROM jsonb_object_keys(w)) <> 2 THEN
      PERFORM public.taxguard_consult_fail('CONSULTATION_INPUT_INVALID');
    END IF;
  END LOOP;
  -- Abuse limits, serialized per tenant so concurrent bursts are counted exactly.
  PERFORM pg_advisory_xact_lock(hashtextextended('taxguard_consult|' || p_tenant, 0));
  IF (SELECT count(*) FROM public.taxguard_consultation_requests WHERE tenant_id = p_tenant AND email_hash = eh AND created_at > now() - interval '1 day') >= 3
    OR (SELECT count(*) FROM public.taxguard_consultation_requests WHERE tenant_id = p_tenant AND client_fingerprint = p_fingerprint AND created_at > now() - interval '1 hour') >= 5
    OR (SELECT count(*) FROM public.taxguard_consultation_requests WHERE tenant_id = p_tenant AND created_at > now() - interval '1 hour') >= 60 THEN
    PERFORM public.taxguard_consult_fail('CONSULTATION_RATE_LIMITED');
  END IF;
  BEGIN
    INSERT INTO public.taxguard_consultation_requests(tenant_id, request_id, full_name, email, phone, preferred_contact, topic, mode_preference, preferred_windows,
      timezone, message, consent_version, consented_at, email_hash, client_fingerprint)
    VALUES (p_tenant, p_id, btrim(COALESCE(p_input->>'fullName', '')), em, NULLIF(btrim(COALESCE(p_input->>'phone', '')), ''), p_input->>'preferredContact',
      p_input->>'topic', p_input->>'modePreference', p_input->'preferredWindows', p_input->>'timezone', NULLIF(btrim(COALESCE(p_input->>'message', '')), ''),
      p_input->>'consentVersion', now(), eh, p_fingerprint) RETURNING * INTO q;
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN PERFORM public.taxguard_consult_fail('CONSULTATION_INPUT_INVALID');
  END;
  IF q.preferred_contact = 'PHONE' AND q.phone IS NULL THEN PERFORM public.taxguard_consult_fail('CONSULTATION_INPUT_INVALID'); END IF;
  PERFORM public.taxguard_consult_event(p_tenant, q.request_id, 'RECEIVED', NULL, NULL, p_key, jsonb_build_object('topic', q.topic, 'status', q.status));
  RETURN jsonb_build_object('received', true, 'reference', upper(substr(q.request_id, 5, 8)), 'replayed', false);
END $$;

-- ------------------------------------------------------------------------------------------
-- Staff review (practice managers and administrators)
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_consult_list(p_tenant text, p_actor text, p_status text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE lim integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  PERFORM public.taxguard_consult_reviewer(p_tenant, p_actor);
  IF p_status IS NOT NULL AND p_status NOT IN ('NEW','IN_REVIEW','CONVERTED','DECLINED','SPAM') THEN PERFORM public.taxguard_consult_fail('CONSULTATION_INPUT_INVALID'); END IF;
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_consult_json(q) ORDER BY q.created_at DESC), '[]'::jsonb) FROM
    (SELECT * FROM public.taxguard_consultation_requests WHERE tenant_id = p_tenant AND (p_status IS NULL OR status = p_status) ORDER BY created_at DESC LIMIT lim) q);
END $$;

-- action: review | decline | spam (decline / spam need a reason, 5-500 characters)
CREATE OR REPLACE FUNCTION public.taxguard_consult_decide(p_tenant text, p_actor text, p_request text, p_version integer, p_key text, p_action text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_consultation_requests; target text; reason text;
BEGIN
  r := public.taxguard_consult_reviewer(p_tenant, p_actor);
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,80}$' THEN PERFORM public.taxguard_consult_fail('IDEMPOTENCY_KEY_REQUIRED'); END IF;
  SELECT * INTO q FROM public.taxguard_consultation_requests WHERE tenant_id = p_tenant AND request_id = p_request FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.taxguard_consult_fail('CONSULTATION_NOT_FOUND'); END IF;
  IF EXISTS (SELECT 1 FROM public.taxguard_consultation_request_events WHERE tenant_id = p_tenant AND request_id = p_request AND request_key = p_key) THEN
    RETURN public.taxguard_consult_json(q) || jsonb_build_object('replayed', true);
  END IF;
  IF q.version <> p_version THEN PERFORM public.taxguard_consult_fail('CONSULTATION_VERSION_CONFLICT'); END IF;
  target := CASE p_action WHEN 'review' THEN 'IN_REVIEW' WHEN 'decline' THEN 'DECLINED' WHEN 'spam' THEN 'SPAM' END;
  IF target IS NULL THEN PERFORM public.taxguard_consult_fail('CONSULTATION_INPUT_INVALID'); END IF;
  IF NOT ((q.status = 'NEW' AND target IN ('IN_REVIEW','DECLINED','SPAM')) OR (q.status = 'IN_REVIEW' AND target IN ('DECLINED','SPAM'))) THEN
    PERFORM public.taxguard_consult_fail('CONSULTATION_TRANSITION_INVALID');
  END IF;
  reason := btrim(COALESCE(p_reason, ''));
  IF target IN ('DECLINED','SPAM') AND (length(reason) < 5 OR length(reason) > 500) THEN PERFORM public.taxguard_consult_fail('CONSULTATION_REASON_REQUIRED'); END IF;
  UPDATE public.taxguard_consultation_requests SET status = target, decision_reason = CASE WHEN target = 'IN_REVIEW' THEN decision_reason ELSE reason END,
    reviewed_by = p_actor, version = version + 1, updated_at = now() WHERE tenant_id = p_tenant AND request_id = p_request RETURNING * INTO q;
  PERFORM public.taxguard_consult_event(p_tenant, p_request, target, p_actor, r, p_key, jsonb_build_object('status', target));
  RETURN public.taxguard_consult_json(q) || jsonb_build_object('replayed', false);
END $$;

-- Converts an IN_REVIEW request into a real appointment for an EXISTING client (proposal 040 rules).
-- p_appointment: the taxguard_apt_create input ({title, category, mode, startsAt, endsAt, timezone, staffUid, confirm, ...}).
CREATE OR REPLACE FUNCTION public.taxguard_consult_convert(p_tenant text, p_actor text, p_request text, p_version integer, p_key text, p_client text, p_appointment_id text, p_appointment jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_consultation_requests; apt jsonb;
BEGIN
  r := public.taxguard_consult_reviewer(p_tenant, p_actor);
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,80}$' THEN PERFORM public.taxguard_consult_fail('IDEMPOTENCY_KEY_REQUIRED'); END IF;
  SELECT * INTO q FROM public.taxguard_consultation_requests WHERE tenant_id = p_tenant AND request_id = p_request FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.taxguard_consult_fail('CONSULTATION_NOT_FOUND'); END IF;
  IF EXISTS (SELECT 1 FROM public.taxguard_consultation_request_events WHERE tenant_id = p_tenant AND request_id = p_request AND request_key = p_key) THEN
    RETURN public.taxguard_consult_json(q) || jsonb_build_object('replayed', true);
  END IF;
  IF q.version <> p_version THEN PERFORM public.taxguard_consult_fail('CONSULTATION_VERSION_CONFLICT'); END IF;
  IF q.status <> 'IN_REVIEW' THEN PERFORM public.taxguard_consult_fail('CONSULTATION_TRANSITION_INVALID'); END IF;
  PERFORM 1 FROM public.taxguard_clients WHERE tenant_id = p_tenant AND client_id = p_client AND status = 'active';
  IF NOT FOUND THEN PERFORM public.taxguard_consult_fail('CONSULTATION_CLIENT_NOT_FOUND'); END IF;
  -- Every appointment rule (scope, staff eligibility, conflicts, time window) is applied by proposal 040.
  apt := public.taxguard_apt_create(p_tenant, p_client, p_actor, p_appointment_id, p_key, p_appointment);
  UPDATE public.taxguard_consultation_requests SET status = 'CONVERTED', converted_client_id = p_client, converted_appointment_id = apt->>'appointmentId',
    reviewed_by = p_actor, version = version + 1, updated_at = now() WHERE tenant_id = p_tenant AND request_id = p_request RETURNING * INTO q;
  PERFORM public.taxguard_consult_event(p_tenant, p_request, 'CONVERTED', p_actor, r, p_key, jsonb_build_object('status', 'CONVERTED', 'clientId', p_client,
    'appointmentId', apt->>'appointmentId'));
  RETURN public.taxguard_consult_json(q) || jsonb_build_object('replayed', false, 'appointment', apt);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_consult\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_consult_submit','taxguard_consult_list','taxguard_consult_decide','taxguard_consult_convert') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
