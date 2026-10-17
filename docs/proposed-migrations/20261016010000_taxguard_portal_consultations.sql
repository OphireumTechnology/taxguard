-- PROPOSAL (Phase 13A, contract C1). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 027 (taxguard_doc_actor), 040 (appointments) and 043 (consultation requests).
--
-- Client consultation history. A public consultation request belongs to a client only when an
-- authorized reviewer CONVERTED it for that existing client (converted_client_id, proposal 043); no
-- identity is inferred from a visitor's e-mail, so unconverted prospect requests never appear here.
-- Each item reports the request (topic, request time, conversion time) and the real appointment it
-- created, with that appointment's CURRENT status from proposal 040 (it may since have been
-- cancelled or completed). A request is never presented as an appointment without one.
-- Never returned: the prospect's name, e-mail, phone, message, consent text, fingerprints, the
-- reviewer, decision reasons, the appointment's internal note, cancel reason or staff identity.
-- Scope: taxguard_doc_actor (the client for their own client; assigned staff; managers).
-- Bounded keyset pagination: at most 20 items, newest first, cursor {at, id}.
-- Idempotent: CREATE OR REPLACE only. Rollback: DROP FUNCTION public.taxguard_portal_consultations(text,text,text,integer,jsonb).

CREATE OR REPLACE FUNCTION public.taxguard_portal_consultations(p_tenant text, p_client text, p_actor text, p_limit integer, p_after jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; lim integer := COALESCE(p_limit, 20); after_at timestamptz; after_id text; rows jsonb;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF lim < 1 OR lim > 20 THEN RAISE EXCEPTION 'PORTAL_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF p_after IS NOT NULL THEN
    BEGIN
      after_at := (p_after->>'at')::timestamptz; after_id := p_after->>'id';
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'PORTAL_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
    IF after_at IS NULL OR after_id IS NULL OR after_id !~ '^csr_[a-f0-9]{32}$' THEN RAISE EXCEPTION 'PORTAL_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  END IF;
  SELECT COALESCE(jsonb_agg(item ORDER BY at DESC, id DESC), '[]'::jsonb) INTO rows FROM (
    SELECT q.created_at AS at, q.request_id AS id, jsonb_build_object(
        'requestId', q.request_id, 'topic', q.topic, 'status', q.status, 'createdAt', q.created_at, 'convertedAt', q.updated_at,
        'appointment', CASE WHEN a.appointment_id IS NULL THEN NULL ELSE jsonb_build_object('appointmentId', a.appointment_id, 'title', a.title, 'status', a.status,
          'mode', a.mode, 'startsAt', a.starts_at, 'endsAt', a.ends_at, 'timezone', a.timezone) END) AS item
    FROM public.taxguard_consultation_requests q
    LEFT JOIN public.taxguard_appointments a ON a.tenant_id = q.tenant_id AND a.client_id = q.converted_client_id AND a.appointment_id = q.converted_appointment_id
    WHERE q.tenant_id = p_tenant AND q.converted_client_id = p_client AND q.status = 'CONVERTED'
      AND (after_at IS NULL OR (q.created_at, q.request_id) < (after_at, after_id))
    ORDER BY q.created_at DESC, q.request_id DESC LIMIT lim + 1) page;
  RETURN jsonb_build_object(
    'items', (SELECT COALESCE(jsonb_agg(e ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(rows) WITH ORDINALITY AS t(e, ord) WHERE ord <= lim),
    'next', CASE WHEN jsonb_array_length(rows) > lim THEN jsonb_build_object('at', rows->(lim - 1)->>'createdAt', 'id', rows->(lim - 1)->>'requestId') END);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'taxguard_portal_consultations' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
