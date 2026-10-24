-- PROPOSAL (Phase 14, Stage 01 onboarding). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires the core schema, proposal 20261012060000 (atomic client identity), 20261012250000 (practice
-- management: actor, visibility and audit helpers), 20261012270000 (document vault), 20261012310000
-- (client notifications, whose kind list this widens) and 20261012260000 (case workflow, whose Stage 1 system
-- checks gain 'clientOnboardingCompleted').
--
-- Durable, server-authoritative Stage 01 onboarding for a client record:
--   * The client records identity and tax-profile facts (legal name, taxpayer type, address, representative
--     for entities) and the TIN TYPE plus its LAST FOUR digits only. A full TIN is refused; nothing here can
--     store one.
--   * Submission requires every field and an IRC section 7216 consent against an APPROVED consent version of
--     this tenant. Consent versions are rows in taxguard_onb_consent_versions, which no application role can
--     write: wording is approved by counsel/practitioner and recorded by the database owner through a
--     reviewed change. With no approved version (the state of this proposal) nobody can submit.
--   * Approval is a staff decision by a practice manager or administrator, never the client. It requires a
--     staff-VERIFIED vault document of category 'identity' for the client, a server-computed duplicate
--     check (same TIN last four and legal name on another client of the tenant), which needs an explicit,
--     reasoned override, and the consent version still being approved. Browser-supplied readiness or
--     verification flags are never read.
--   * Approval marks the client identity onboarding COMPLETED, which is what unlocks Stage 02 collection
--     (enforced by the API). "Request changes" returns it to the client with a client-safe reason; internal
--     notes and decider identities are never part of the client view.
--   * Every write is versioned (optimistic revision), audited and tenant/client scoped.
-- Rollback (development): drop the taxguard_onb_* functions and both tables. Identities already marked
-- COMPLETED by an approval keep that state; revert them deliberately if required.

CREATE TABLE IF NOT EXISTS public.taxguard_onb_consent_versions (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  version VARCHAR(64) NOT NULL CHECK (version ~ '^[A-Za-z0-9._-]{3,64}$'),
  consent_text TEXT NOT NULL CHECK (length(btrim(consent_text)) BETWEEN 50 AND 20000),
  approved_by VARCHAR(255) NOT NULL CHECK (length(btrim(approved_by)) BETWEEN 3 AND 255),
  approved_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('APPROVED','RETIRED')),
  PRIMARY KEY (tenant_id, version)
);
ALTER TABLE public.taxguard_onb_consent_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_onb_consent_versions FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.taxguard_client_onboarding (
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  owner_uid VARCHAR(128) NOT NULL,
  status VARCHAR(24) NOT NULL CHECK (status IN ('DRAFT','SUBMITTED','CHANGES_REQUESTED','APPROVED')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  taxpayer_type VARCHAR(16) CHECK (taxpayer_type IN ('individual','entity')),
  legal_name VARCHAR(255),
  street VARCHAR(255), city VARCHAR(128), state_code VARCHAR(2) CHECK (state_code ~ '^[A-Z]{2}$'), postal_code VARCHAR(10) CHECK (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  rep_name VARCHAR(255), rep_title VARCHAR(128),
  tin_type VARCHAR(8) CHECK (tin_type IN ('SSN','ITIN','EIN')),
  tin_last4 CHAR(4) CHECK (tin_last4 ~ '^[0-9]{4}$' AND tin_last4 <> '0000'),
  consent_version VARCHAR(64), consent_text_sha256 CHAR(64), consent_signer VARCHAR(255), consent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  decided_by VARCHAR(128), decided_at TIMESTAMPTZ,
  client_reason VARCHAR(500),
  internal_note VARCHAR(1000),
  duplicate_decision VARCHAR(24) CHECK (duplicate_decision IN ('NONE_FOUND','OVERRIDE_APPROVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id) ON DELETE RESTRICT,
  CHECK (status = 'DRAFT' OR status = 'CHANGES_REQUESTED' OR (consent_version IS NOT NULL AND consent_at IS NOT NULL AND submitted_at IS NOT NULL)),
  CHECK (status <> 'APPROVED' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND duplicate_decision IS NOT NULL)),
  CHECK (status <> 'CHANGES_REQUESTED' OR client_reason IS NOT NULL)
);
ALTER TABLE public.taxguard_client_onboarding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_client_onboarding FROM PUBLIC, anon, authenticated, service_role;

-- Onboarding decisions notify the client in the portal (in-app only, like proposal 031's notices; no e-mail or SMS).
-- The kind list is widened, never narrowed: every existing kind stays valid, so existing rows satisfy it.
ALTER TABLE public.taxguard_client_notifications DROP CONSTRAINT IF EXISTS taxguard_client_notifications_kind_check;
ALTER TABLE public.taxguard_client_notifications ADD CONSTRAINT taxguard_client_notifications_kind_check CHECK (kind IN
  ('REQUEST_CREATED','REQUEST_REMINDER','REQUEST_FULFILLED','REQUEST_WAIVED','REQUEST_CANCELLED','REPLACEMENT_REQUESTED','DOCUMENT_REJECTED',
   'ONBOARDING_CHANGES_REQUESTED','ONBOARDING_APPROVED'));

-- The client who owns p_client (active client membership and client record), or NULL.
CREATE OR REPLACE FUNCTION public.taxguard_onb_client_owner(p_tenant text, p_client text, p_actor text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.taxguard_members m JOIN public.taxguard_clients c ON c.tenant_id = m.tenant_id AND c.client_id = m.client_id
    WHERE m.tenant_id = p_tenant AND m.uid = p_actor AND m.status = 'active' AND m.role IN ('client','prospective_client')
      AND m.client_id = p_client AND c.owner_uid = p_actor AND c.status = 'active') $$;

-- Other active clients of the tenant with the same TIN last four and the same normalized legal name.
CREATE OR REPLACE FUNCTION public.taxguard_onb_duplicates(p_tenant text, p_client text) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(array_agg(o.client_id ORDER BY o.client_id), '{}') FROM public.taxguard_client_onboarding me
    JOIN public.taxguard_client_onboarding o ON o.tenant_id = me.tenant_id AND o.client_id <> me.client_id
     AND o.tin_last4 = me.tin_last4 AND lower(regexp_replace(btrim(o.legal_name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(me.legal_name), '\s+', ' ', 'g'))
  WHERE me.tenant_id = p_tenant AND me.client_id = p_client AND me.tin_last4 IS NOT NULL AND me.legal_name IS NOT NULL $$;

CREATE OR REPLACE FUNCTION public.taxguard_onb_identity_verified(p_tenant text, p_client text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND category = 'identity' AND status = 'VERIFIED') $$;

CREATE OR REPLACE FUNCTION public.taxguard_onb_current_consent(p_tenant text) RETURNS public.taxguard_onb_consent_versions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT * FROM public.taxguard_onb_consent_versions WHERE tenant_id = p_tenant AND status = 'APPROVED' ORDER BY approved_at DESC, version DESC LIMIT 1 $$;

-- Server-derived checklist; the same rules gate submission and approval.
CREATE OR REPLACE FUNCTION public.taxguard_onb_requirements(o public.taxguard_client_onboarding) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  -- Every flag is a strict boolean: an unset field is false, never NULL.
  SELECT jsonb_build_object(
    'profile', COALESCE(o.taxpayer_type IS NOT NULL AND o.legal_name IS NOT NULL, false),
    'tin', COALESCE(o.tin_type IS NOT NULL AND o.tin_last4 IS NOT NULL, false),
    'address', COALESCE(o.street IS NOT NULL AND o.city IS NOT NULL AND o.state_code IS NOT NULL AND o.postal_code IS NOT NULL, false),
    'representative', COALESCE(o.taxpayer_type = 'individual' OR (o.taxpayer_type = 'entity' AND o.rep_name IS NOT NULL AND o.rep_title IS NOT NULL), false),
    'identityDocument', COALESCE(public.taxguard_onb_identity_verified(o.tenant_id, o.client_id), false),
    'consentAvailable', (public.taxguard_onb_current_consent(o.tenant_id)).version IS NOT NULL) $$;

CREATE OR REPLACE FUNCTION public.taxguard_onb_view(o public.taxguard_client_onboarding, p_staff boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE consent public.taxguard_onb_consent_versions := public.taxguard_onb_current_consent(o.tenant_id); v jsonb;
BEGIN
  v := jsonb_build_object('clientId', o.client_id, 'status', o.status, 'revision', o.revision,
    'taxpayerType', o.taxpayer_type, 'legalName', o.legal_name,
    'address', jsonb_build_object('street', o.street, 'city', o.city, 'state', o.state_code, 'postalCode', o.postal_code),
    'representative', CASE WHEN o.rep_name IS NULL THEN NULL ELSE jsonb_build_object('fullName', o.rep_name, 'title', o.rep_title) END,
    'tinType', o.tin_type, 'tinMasked', CASE WHEN o.tin_last4 IS NULL THEN NULL ELSE '***-**-' || o.tin_last4 END,
    'consentVersion', o.consent_version, 'consentSigner', o.consent_signer, 'consentAt', o.consent_at, 'submittedAt', o.submitted_at,
    'decidedAt', o.decided_at, 'clientReason', o.client_reason,
    'requirements', public.taxguard_onb_requirements(o),
    'consent', CASE WHEN consent.version IS NULL THEN NULL ELSE jsonb_build_object('version', consent.version, 'text', consent.consent_text) END);
  IF p_staff THEN
    v := v || jsonb_build_object('ownerUid', o.owner_uid, 'decidedBy', o.decided_by, 'internalNote', o.internal_note,
      'duplicateDecision', o.duplicate_decision, 'possibleDuplicates', to_jsonb(public.taxguard_onb_duplicates(o.tenant_id, o.client_id)),
      'consentTextSha256', o.consent_text_sha256);
  END IF;
  RETURN v;
END $$;

-- A not-yet-started record for display (never stored by a read).
CREATE OR REPLACE FUNCTION public.taxguard_onb_blank(p_tenant text, p_client text, p_owner text) RETURNS public.taxguard_client_onboarding
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE o public.taxguard_client_onboarding;
BEGIN
  o.tenant_id := p_tenant; o.client_id := p_client; o.owner_uid := p_owner; o.status := 'DRAFT'; o.revision := 0;
  o.created_at := now(); o.updated_at := now();
  RETURN o;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_onb_get(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE o public.taxguard_client_onboarding; owner text; staff boolean := false; r text;
BEGIN
  IF p_client IS NULL OR p_client !~ '^[A-Za-z0-9_-]{1,64}$' THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF NOT public.taxguard_onb_client_owner(p_tenant, p_client, p_actor) THEN
    r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false, false);
    staff := true;
  END IF;
  SELECT owner_uid INTO owner FROM public.taxguard_clients WHERE tenant_id = p_tenant AND client_id = p_client;
  SELECT * INTO o FROM public.taxguard_client_onboarding WHERE tenant_id = p_tenant AND client_id = p_client;
  IF NOT FOUND THEN o := public.taxguard_onb_blank(p_tenant, p_client, owner); END IF;
  RETURN public.taxguard_onb_view(o, staff);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_onb_text(p jsonb, p_key text, p_min integer, p_max integer) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v text;
BEGIN
  IF NOT p ? p_key OR p->p_key = 'null'::jsonb THEN RETURN NULL; END IF;
  IF jsonb_typeof(p->p_key) <> 'string' THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  v := btrim(p->>p_key);
  IF v = '' THEN RETURN NULL; END IF;
  IF length(v) < p_min OR length(v) > p_max OR v ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'ONBOARDING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN v;
END $$;

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

CREATE OR REPLACE FUNCTION public.taxguard_onb_queue(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'PRACTICE_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('clientId', o.client_id, 'legalName', o.legal_name, 'submittedAt', o.submitted_at, 'revision', o.revision,
      'possibleDuplicates', cardinality(public.taxguard_onb_duplicates(o.tenant_id, o.client_id)),
      'identityDocument', public.taxguard_onb_identity_verified(o.tenant_id, o.client_id)) ORDER BY o.submitted_at, o.client_id), '[]'::jsonb)
    FROM public.taxguard_client_onboarding o WHERE o.tenant_id = p_tenant AND o.status = 'SUBMITTED');
END $$;

-- Stage 02 gate: true only when the server recorded the client's onboarding as completed.
CREATE OR REPLACE FUNCTION public.taxguard_onb_client_ready(p_tenant text, p_client text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.taxguard_clients c JOIN public.taxguard_identities i ON i.uid = c.owner_uid AND i.tenant_id = c.tenant_id
    WHERE c.tenant_id = p_tenant AND c.client_id = p_client AND c.status = 'active' AND upper(i.user_data->>'onboardingStatus') = 'COMPLETED') $$;

-- Case continuity: the case workflow's own "Onboard" stage (proposal 026) must not complete for a client whose
-- Stage 01 onboarding the practice has not approved. Identical to proposal 026's function except for the added
-- 'clientOnboardingCompleted' check; every other stage's checks are unchanged. CREATE OR REPLACE keeps grants.
CREATE OR REPLACE FUNCTION public.taxguard_case_system_checks(p_case public.taxguard_cases) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; y_start date := make_date(p_case.tax_year, 1, 1); y_end date := make_date(p_case.tax_year, 12, 31);
  posted integer; prepared integer; debits bigint; credits bigint; closed integer; open_recons integer; unposted integer;
BEGIN
  IF c.active_stage = 1 THEN
    RETURN jsonb_build_object(
      'clientActive', EXISTS (SELECT 1 FROM public.taxguard_clients WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND status = 'active'),
      'engagementActive', EXISTS (SELECT 1 FROM public.taxguard_engagements WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id AND status = 'active'),
      'taxYearActive', EXISTS (SELECT 1 FROM public.taxguard_tax_years WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id AND tax_year = c.tax_year AND status = 'active'),
      'preparerAssigned', EXISTS (SELECT 1 FROM public.taxguard_staff_assignments WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
        AND tax_year = c.tax_year AND role = 'preparer' AND user_id = c.preparer_uid AND status = 'ACTIVE'),
      'reviewerAssigned', EXISTS (SELECT 1 FROM public.taxguard_staff_assignments WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
        AND tax_year = c.tax_year AND role = 'reviewer' AND user_id = c.reviewer_uid AND status = 'ACTIVE'),
      'independentReviewer', c.preparer_uid <> c.reviewer_uid,
      'clientOnboardingCompleted', public.taxguard_onb_client_ready(c.tenant_id, c.client_id));
  END IF;
  SELECT count(*) FILTER (WHERE status = 'POSTED'), count(*) FILTER (WHERE status = 'PREPARED') INTO posted, prepared
    FROM public.taxguard_ledger_entries WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND posting_date BETWEEN y_start AND y_end;
  SELECT COALESCE(sum(l.debit_cents), 0), COALESCE(sum(l.credit_cents), 0) INTO debits, credits FROM public.taxguard_ledger_lines l
    JOIN public.taxguard_ledger_entries e ON e.tenant_id = l.tenant_id AND e.client_id = l.client_id AND e.entry_id = l.entry_id
    WHERE l.tenant_id = c.tenant_id AND l.client_id = c.client_id AND e.status = 'POSTED' AND e.posting_date BETWEEN y_start AND y_end;
  IF c.active_stage = 4 THEN
    RETURN jsonb_build_object('postedEntries', posted > 0, 'noEntriesAwaitingReview', prepared = 0, 'ledgerBalanced', debits = credits);
  END IF;
  SELECT count(*) FILTER (WHERE status = 'CLOSED'), count(*) FILTER (WHERE status = 'IN_PROGRESS') INTO closed, open_recons
    FROM public.taxguard_ledger_reconciliations WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND tax_year = c.tax_year;
  SELECT count(*) INTO unposted FROM public.taxguard_ledger_bank_transactions WHERE tenant_id = c.tenant_id AND client_id = c.client_id
    AND transaction_date BETWEEN y_start AND y_end AND journal_entry_id IS NULL;
  RETURN jsonb_build_object('closedReconciliation', closed > 0, 'noReconciliationInProgress', open_recons = 0, 'allBankTransactionsPosted', unposted = 0,
    'noEntriesAwaitingReview', prepared = 0);
END $$;

DO $$ DECLARE fn text; BEGIN
  FOREACH fn IN ARRAY ARRAY['taxguard_onb_client_owner(text,text,text)', 'taxguard_onb_duplicates(text,text)', 'taxguard_onb_identity_verified(text,text)',
    'taxguard_onb_current_consent(text)', 'taxguard_onb_requirements(public.taxguard_client_onboarding)', 'taxguard_onb_view(public.taxguard_client_onboarding,boolean)',
    'taxguard_onb_blank(text,text,text)', 'taxguard_onb_text(jsonb,text,integer,integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated, service_role', fn);
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['taxguard_onb_get(text,text,text)', 'taxguard_onb_save(text,text,text,integer,jsonb)', 'taxguard_onb_submit(text,text,text,integer,text,text)',
    'taxguard_onb_decide(text,text,text,integer,text,text,text,boolean)', 'taxguard_onb_queue(text,text)', 'taxguard_onb_client_ready(text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;
