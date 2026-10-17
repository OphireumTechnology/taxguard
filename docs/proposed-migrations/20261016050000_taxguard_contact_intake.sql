-- PROPOSAL (Phase 13A, contract C8). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposal 027 (taxguard_doc_actor / taxguard_practice_is_manager) and the core tenants table.
--
-- Server-backed contact-form intake, PREPARED BUT DISABLED.
--   * Nothing is accepted until the practice records an approved intake policy for the tenant in
--     taxguard_contact_intake_policies: retention period, consent wording version and abuse limits.
--     This proposal inserts NO policy and provides NO function that writes one: recording a policy is
--     an owner decision applied through a separately reviewed change. Without it every submission is
--     refused with CONTACT_INTAKE_NOT_APPROVED.
--   * With a policy: validated name, e-mail, optional phone, topic and message; explicit consent to
--     the policy's consent version; idempotent per submission id; abuse limits from the policy
--     (per e-mail per day, per client fingerprint per hour - an HMAC of the address computed by the
--     server, never the address - and tenant-wide per hour); expiry from the policy's retention.
--   * The response is { received, reference } only. It never echoes stored data and never claims an
--     e-mail was sent or delivered: no e-mail or SMS is sent by TaxGuard.
--   * Practice managers and administrators can list unexpired messages; expired messages are removed
--     by taxguard_contact_purge_expired (scheduling it is an operational decision).
--   * Audit rows hold identifiers only (never name, e-mail, phone or message).
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE.
-- Rollback (development): drop the taxguard_contact_* functions and the two tables.

CREATE TABLE IF NOT EXISTS public.taxguard_contact_intake_policies (
  tenant_id VARCHAR(128) PRIMARY KEY REFERENCES public.taxguard_tenants(id),
  retention_days INTEGER NOT NULL CHECK (retention_days BETWEEN 30 AND 2555),
  consent_version VARCHAR(32) NOT NULL CHECK (consent_version ~ '^[A-Za-z0-9_.-]{1,32}$'),
  per_email_per_day INTEGER NOT NULL CHECK (per_email_per_day BETWEEN 1 AND 10),
  per_fingerprint_per_hour INTEGER NOT NULL CHECK (per_fingerprint_per_hour BETWEEN 1 AND 20),
  tenant_per_hour INTEGER NOT NULL CHECK (tenant_per_hour BETWEEN 1 AND 500),
  approved_by VARCHAR(128) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  decision_reference VARCHAR(200) NOT NULL CHECK (length(btrim(decision_reference)) >= 5)
);

CREATE TABLE IF NOT EXISTS public.taxguard_contact_messages (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id),
  message_id VARCHAR(40) NOT NULL CHECK (message_id ~ '^ctm_[a-f0-9]{32}$'),
  full_name VARCHAR(120) NOT NULL CHECK (length(btrim(full_name)) >= 2),
  email VARCHAR(254) NOT NULL CHECK (email ~ '^[^@\s]{1,64}@[^@\s]+\.[A-Za-z]{2,}$'),
  phone VARCHAR(32) CHECK (phone IS NULL OR phone ~ '^[0-9+() .-]{7,32}$'),
  topic VARCHAR(32) NOT NULL CHECK (topic IN ('INDIVIDUAL_TAX','BUSINESS_TAX','TAX_PLANNING','BOOKKEEPING','IRS_NOTICE','OTHER')),
  message VARCHAR(2000) NOT NULL CHECK (length(btrim(message)) >= 10),
  consent_version VARCHAR(32) NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  email_hash CHAR(64) NOT NULL,
  client_fingerprint CHAR(64) NOT NULL CHECK (client_fingerprint ~ '^[a-f0-9]{64}$'),
  idempotency_key VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, message_id),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_contact_messages_recent ON public.taxguard_contact_messages (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_taxguard_contact_messages_expiry ON public.taxguard_contact_messages (tenant_id, expires_at);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_contact_intake_policies','taxguard_contact_messages'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_contact_submit(p_tenant text, p_id text, p_key text, p_fingerprint text, p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE pol public.taxguard_contact_intake_policies; m public.taxguard_contact_messages; em text; eh text;
BEGIN
  PERFORM 1 FROM public.taxguard_tenants WHERE id = p_tenant AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTACT_INTAKE_UNAVAILABLE' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO pol FROM public.taxguard_contact_intake_policies WHERE tenant_id = p_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTACT_INTAKE_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  IF p_id IS NULL OR p_id !~ '^ctm_[a-f0-9]{32}$' OR p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,80}$' OR p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'CONTACT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  em := lower(btrim(COALESCE(p_input->>'email', '')));
  eh := encode(sha256(convert_to(p_tenant || '|' || em, 'UTF8')), 'hex');
  -- Replay of the same submission: acknowledged again, nothing new is stored or revealed.
  SELECT * INTO m FROM public.taxguard_contact_messages WHERE tenant_id = p_tenant AND message_id = p_id;
  IF FOUND THEN
    IF m.email_hash <> eh OR m.idempotency_key <> p_key THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001'; END IF;
    RETURN jsonb_build_object('received', true, 'reference', upper(substr(m.message_id, 5, 8)), 'replayed', true);
  END IF;
  IF jsonb_typeof(p_input->'consent') IS DISTINCT FROM 'boolean' OR (p_input->>'consent')::boolean IS NOT TRUE OR p_input->>'consentVersion' IS DISTINCT FROM pol.consent_version THEN
    RAISE EXCEPTION 'CONTACT_CONSENT_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('taxguard_contact|' || p_tenant, 0));
  IF (SELECT count(*) FROM public.taxguard_contact_messages WHERE tenant_id = p_tenant AND email_hash = eh AND created_at > now() - interval '1 day') >= pol.per_email_per_day
    OR (SELECT count(*) FROM public.taxguard_contact_messages WHERE tenant_id = p_tenant AND client_fingerprint = p_fingerprint AND created_at > now() - interval '1 hour') >= pol.per_fingerprint_per_hour
    OR (SELECT count(*) FROM public.taxguard_contact_messages WHERE tenant_id = p_tenant AND created_at > now() - interval '1 hour') >= pol.tenant_per_hour THEN
    RAISE EXCEPTION 'CONTACT_RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    INSERT INTO public.taxguard_contact_messages(tenant_id, message_id, full_name, email, phone, topic, message, consent_version, consented_at, email_hash, client_fingerprint,
      idempotency_key, expires_at)
    VALUES (p_tenant, p_id, btrim(COALESCE(p_input->>'fullName', '')), em, NULLIF(btrim(COALESCE(p_input->>'phone', '')), ''), p_input->>'topic',
      btrim(COALESCE(p_input->>'message', '')), pol.consent_version, now(), eh, p_fingerprint, p_key, now() + make_interval(days => pol.retention_days)) RETURNING * INTO m;
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN RAISE EXCEPTION 'CONTACT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES (p_tenant, 'CONTACT_MESSAGE_RECEIVED', 'public', 'public', jsonb_build_object('messageId', m.message_id, 'topic', m.topic, 'consentVersion', m.consent_version));
  RETURN jsonb_build_object('received', true, 'reference', upper(substr(m.message_id, 5, 8)), 'replayed', false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_contact_list(p_tenant text, p_actor text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  SELECT role INTO r FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active';
  IF r IS NULL OR NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'CONTACT_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'CONTACT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('messageId', m.message_id, 'fullName', m.full_name, 'email', m.email, 'phone', m.phone, 'topic', m.topic,
      'message', m.message, 'createdAt', m.created_at, 'expiresAt', m.expires_at) ORDER BY m.created_at DESC, m.message_id DESC), '[]'::jsonb)
    FROM (SELECT * FROM public.taxguard_contact_messages WHERE tenant_id = p_tenant AND expires_at > now() ORDER BY created_at DESC, message_id DESC LIMIT p_limit) m);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_contact_purge_expired(p_tenant text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.taxguard_contact_messages WHERE tenant_id = p_tenant AND expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata) VALUES (p_tenant, 'CONTACT_MESSAGES_PURGED', 'system', 'system', jsonb_build_object('count', n));
  END IF;
  RETURN n;
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_contact_submit','taxguard_contact_list','taxguard_contact_purge_expired') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
