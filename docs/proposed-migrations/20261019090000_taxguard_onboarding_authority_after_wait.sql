-- PROPOSAL (Phase 14 continuation, client onboarding). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261018030000 (client onboarding; the current definitions of the three functions replaced here).
--
-- Save, submit and decide checked the actor's authority, then waited on the per-client onboarding lock. A client or
-- manager suspended (or whose access ended) while the request waited still completed the write, its audit and the
-- client notification. Found by Codex's uncommitted onboardingAuthorizationWait test (Phase 14 continuation
-- worktree); reproduced on the integration branch. Each function now repeats its own authority check after the
-- lock, with the same refusal codes (ONBOARDING_CLIENT_REQUIRED; PRACTICE_ACCESS_DENIED from
-- taxguard_practice_client_access). Bodies are otherwise identical to 20261018030000.
-- Rollback (development): re-apply the 20261018030000 definitions.

CREATE OR REPLACE FUNCTION public.taxguard_onb_save(p_tenant text, p_client text, p_actor text, p_revision integer, p_fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE o public.taxguard_client_onboarding; f jsonb := COALESCE(p_fields, '{}'::jsonb); allowed text[] := ARRAY['taxpayerType','legalName','street','city','state','postalCode','repName','repTitle','tinType','tinLast4'];
  k text; v text;
BEGIN
  IF NOT public.taxguard_onb_client_owner(p_tenant, p_client, p_actor) THEN RAISE EXCEPTION 'ONBOARDING_CLIENT_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF jsonb_typeof(f) <> 'object' OR octet_length(f::text) > 8192 THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  FOR k IN SELECT jsonb_object_keys(f) LOOP
    IF NOT k = ANY(allowed) THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  END LOOP;
  -- Only the last four digits are accepted; anything that looks like a full identifier is refused unread.
  IF f ? 'tinLast4' AND f->'tinLast4' <> 'null'::jsonb AND (jsonb_typeof(f->'tinLast4') <> 'string' OR (f->>'tinLast4') !~ '^[0-9]{4}$') THEN
    RAISE EXCEPTION 'ONBOARDING_FULL_TIN_REFUSED' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('taxguard:onboarding:' || p_tenant || ':' || p_client));
  -- Authority may have ended while waiting for the lock.
  IF NOT public.taxguard_onb_client_owner(p_tenant, p_client, p_actor) THEN RAISE EXCEPTION 'ONBOARDING_CLIENT_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO o FROM public.taxguard_client_onboarding WHERE tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND THEN
    IF p_revision IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'ONBOARDING_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
    o := public.taxguard_onb_blank(p_tenant, p_client, p_actor);
  ELSE
    IF p_revision IS DISTINCT FROM o.revision THEN RAISE EXCEPTION 'ONBOARDING_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
    IF o.status NOT IN ('DRAFT','CHANGES_REQUESTED') THEN RAISE EXCEPTION 'ONBOARDING_NOT_EDITABLE' USING ERRCODE = 'P0001'; END IF;
  END IF;
  IF f ? 'taxpayerType' THEN v := public.taxguard_onb_text(f, 'taxpayerType', 1, 16);
    IF v IS NOT NULL AND v NOT IN ('individual','entity') THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF; o.taxpayer_type := v; END IF;
  IF f ? 'legalName' THEN o.legal_name := public.taxguard_onb_text(f, 'legalName', 2, 255); END IF;
  IF f ? 'street' THEN o.street := public.taxguard_onb_text(f, 'street', 3, 255); END IF;
  IF f ? 'city' THEN o.city := public.taxguard_onb_text(f, 'city', 2, 128); END IF;
  IF f ? 'state' THEN v := upper(public.taxguard_onb_text(f, 'state', 2, 2));
    IF v IS NOT NULL AND v !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF; o.state_code := v; END IF;
  IF f ? 'postalCode' THEN v := public.taxguard_onb_text(f, 'postalCode', 5, 10);
    IF v IS NOT NULL AND v !~ '^[0-9]{5}(-[0-9]{4})?$' THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF; o.postal_code := v; END IF;
  IF f ? 'repName' THEN o.rep_name := public.taxguard_onb_text(f, 'repName', 3, 255); END IF;
  IF f ? 'repTitle' THEN o.rep_title := public.taxguard_onb_text(f, 'repTitle', 2, 128); END IF;
  IF f ? 'tinType' THEN v := public.taxguard_onb_text(f, 'tinType', 3, 4);
    IF v IS NOT NULL AND v NOT IN ('SSN','ITIN','EIN') THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF; o.tin_type := v; END IF;
  IF f ? 'tinLast4' THEN v := public.taxguard_onb_text(f, 'tinLast4', 4, 4);
    IF v = '0000' THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF; o.tin_last4 := v; END IF;
  o.revision := o.revision + 1; o.updated_at := now();
  INSERT INTO public.taxguard_client_onboarding VALUES (o.*)
    ON CONFLICT (tenant_id, client_id) DO UPDATE SET taxpayer_type = EXCLUDED.taxpayer_type, legal_name = EXCLUDED.legal_name, street = EXCLUDED.street,
      city = EXCLUDED.city, state_code = EXCLUDED.state_code, postal_code = EXCLUDED.postal_code, rep_name = EXCLUDED.rep_name, rep_title = EXCLUDED.rep_title,
      tin_type = EXCLUDED.tin_type, tin_last4 = EXCLUDED.tin_last4, revision = EXCLUDED.revision, updated_at = EXCLUDED.updated_at;
  SELECT * INTO o FROM public.taxguard_client_onboarding WHERE tenant_id = p_tenant AND client_id = p_client;
  RETURN public.taxguard_onb_view(o, false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_onb_submit(p_tenant text, p_client text, p_actor text, p_revision integer, p_consent_version text, p_signer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE o public.taxguard_client_onboarding; req jsonb; consent public.taxguard_onb_consent_versions; signer text := btrim(COALESCE(p_signer, ''));
BEGIN
  IF NOT public.taxguard_onb_client_owner(p_tenant, p_client, p_actor) THEN RAISE EXCEPTION 'ONBOARDING_CLIENT_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('taxguard:onboarding:' || p_tenant || ':' || p_client));
  -- Authority may have ended while waiting for the lock.
  IF NOT public.taxguard_onb_client_owner(p_tenant, p_client, p_actor) THEN RAISE EXCEPTION 'ONBOARDING_CLIENT_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO o FROM public.taxguard_client_onboarding WHERE tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND OR p_revision IS DISTINCT FROM o.revision THEN RAISE EXCEPTION 'ONBOARDING_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF o.status NOT IN ('DRAFT','CHANGES_REQUESTED') THEN RAISE EXCEPTION 'ONBOARDING_NOT_EDITABLE' USING ERRCODE = 'P0001'; END IF;
  req := public.taxguard_onb_requirements(o);
  IF NOT ((req->>'profile')::boolean AND (req->>'tin')::boolean AND (req->>'address')::boolean AND (req->>'representative')::boolean) THEN
    RAISE EXCEPTION 'ONBOARDING_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO consent FROM public.taxguard_onb_consent_versions WHERE tenant_id = p_tenant AND version = p_consent_version AND status = 'APPROVED';
  IF NOT FOUND THEN RAISE EXCEPTION 'ONBOARDING_CONSENT_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  IF length(signer) NOT BETWEEN 3 AND 255 OR signer ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_client_onboarding SET status = 'SUBMITTED', consent_version = consent.version,
    consent_text_sha256 = encode(sha256(convert_to(consent.consent_text, 'UTF8')), 'hex'), consent_signer = signer, consent_at = now(),
    submitted_at = now(), client_reason = NULL, revision = revision + 1, updated_at = now()
    WHERE tenant_id = p_tenant AND client_id = p_client RETURNING * INTO o;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, 'client', 'ONBOARDING_SUBMITTED',
    jsonb_build_object('consentVersion', consent.version, 'consentTextSha256', o.consent_text_sha256, 'revision', o.revision));
  RETURN public.taxguard_onb_view(o, false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_onb_decide(p_tenant text, p_client text, p_actor text, p_revision integer, p_decision text,
  p_client_reason text, p_internal_note text, p_duplicate_override boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; o public.taxguard_client_onboarding; dups text[]; reason text := btrim(COALESCE(p_client_reason, '')); note text := btrim(COALESCE(p_internal_note, ''));
  completed text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, true, true);
  IF p_decision NOT IN ('approve','request_changes') OR length(note) > 1000 OR note ~ '[[:cntrl:]]' OR length(reason) > 500 OR reason ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('taxguard:onboarding:' || p_tenant || ':' || p_client));
  -- Authority may have ended while waiting for the lock.
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, true, true);
  SELECT * INTO o FROM public.taxguard_client_onboarding WHERE tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND OR p_revision IS DISTINCT FROM o.revision THEN RAISE EXCEPTION 'ONBOARDING_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF o.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'ONBOARDING_NOT_SUBMITTED' USING ERRCODE = 'P0001'; END IF;
  IF o.owner_uid = p_actor THEN RAISE EXCEPTION 'ONBOARDING_SELF_DECISION' USING ERRCODE = 'P0001'; END IF;
  IF p_decision = 'request_changes' THEN
    IF length(reason) < 5 THEN RAISE EXCEPTION 'ONBOARDING_REASON_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.taxguard_client_onboarding SET status = 'CHANGES_REQUESTED', client_reason = reason, internal_note = NULLIF(note, ''),
      decided_by = p_actor, decided_at = now(), revision = revision + 1, updated_at = now()
      WHERE tenant_id = p_tenant AND client_id = p_client RETURNING * INTO o;
    PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'ONBOARDING_CHANGES_REQUESTED', jsonb_build_object('revision', o.revision));
    -- The notice carries no reason or staff detail; the client reads the reason in the onboarding view.
    INSERT INTO public.taxguard_client_notifications(tenant_id, client_id, kind, request_id, title, created_by)
      VALUES (p_tenant, p_client, 'ONBOARDING_CHANGES_REQUESTED', NULL, 'Your onboarding needs changes', p_actor);
    RETURN public.taxguard_onb_view(o, true);
  END IF;
  IF NOT public.taxguard_onb_identity_verified(p_tenant, p_client) THEN RAISE EXCEPTION 'ONBOARDING_IDENTITY_DOCUMENT_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.taxguard_onb_consent_versions WHERE tenant_id = p_tenant AND version = o.consent_version AND status = 'APPROVED';
  IF NOT FOUND THEN RAISE EXCEPTION 'ONBOARDING_CONSENT_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  dups := public.taxguard_onb_duplicates(p_tenant, p_client);
  IF cardinality(dups) > 0 AND (p_duplicate_override IS NOT TRUE OR length(note) < 10) THEN
    RAISE EXCEPTION 'ONBOARDING_DUPLICATE_REVIEW_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.taxguard_client_onboarding SET status = 'APPROVED', client_reason = NULL, internal_note = NULLIF(note, ''), decided_by = p_actor, decided_at = now(),
    duplicate_decision = CASE WHEN cardinality(dups) > 0 THEN 'OVERRIDE_APPROVED' ELSE 'NONE_FOUND' END, revision = revision + 1, updated_at = now()
    WHERE tenant_id = p_tenant AND client_id = p_client RETURNING * INTO o;
  -- The identity's onboarding state is what the API reads to unlock Stage 02.
  UPDATE public.taxguard_identities SET user_data = user_data || jsonb_build_object('onboardingStatus', 'COMPLETED', 'onboardingCompletedAt', completed)
    WHERE uid = o.owner_uid AND tenant_id = p_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'ONBOARDING_IDENTITY_MISSING' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'ONBOARDING_APPROVED',
    jsonb_build_object('revision', o.revision, 'duplicateDecision', o.duplicate_decision, 'possibleDuplicates', to_jsonb(dups), 'consentVersion', o.consent_version));
  INSERT INTO public.taxguard_client_notifications(tenant_id, client_id, kind, request_id, title, created_by)
    VALUES (p_tenant, p_client, 'ONBOARDING_APPROVED', NULL, 'Your onboarding was approved', p_actor);
  RETURN public.taxguard_onb_view(o, true);
END $$;
