-- PROPOSAL (Block 74, Stage 11 signature package preparation, without signing). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261012270000 (document actor), 20261012340000 (privileged session proof), 20261019115000 (approval
-- authority), 20261019120000 (return versions) and 20261019180000 (Stage 10 final authorization).
--
-- Releasing an authorized return version for client signature is a client-facing material action, taken only by a person:
--   * Stage 10: the version's latest final authorization decision must be AUTHORIZED and still current, recomputed in the
--     same transaction. A package pins that decision and is current only while it stays current.
--   * Authority: the new function RETURN_SIGNATURE_RELEASE. Its policy must require at least a designation. None is seeded:
--     without the owner's policy every release is refused.
--   * Separation: the releaser is not the version's or the case's preparer.
--   * Session: the releaser's live AAL2 session with a recent sign-in (taxguard_privileged_session), in the same transaction.
--   * Consent: the owner's approved signature consent text (versioned, approved by someone other than its author). None is
--     seeded and no RPC writes it. The caller must send the version it displayed.
--   * Signers: one to four distinct active client-portal members of the case's client, chosen by the releaser.
--   * History: packages are immutable and audited; a package only gains its withdrawal, once. One live package per version.
-- Nothing here renders a form, contacts an e-signature provider, invites or verifies a signer, collects a signature, files,
-- transmits or takes payment: returnUse stays BLOCKED and signature reports NOT_AVAILABLE.
-- Supersedes taxguard_tax_return_final_readiness from 20261019180000 (same result, plus the signature package and
-- stage11 SIGNATURE_PACKAGE_RELEASED while a current package exists).
-- Changes the function-code CHECK of taxguard_tax_approval_policies by a new constraint; earlier proposals are not edited.
-- Rollback (development): drop the functions, the guard and the two tables, then restore the function-code CHECK of
-- 20261019180000.

ALTER TABLE public.taxguard_tax_approval_policies DROP CONSTRAINT IF EXISTS taxguard_tax_approval_policies_function_code_v2;
ALTER TABLE public.taxguard_tax_approval_policies DROP CONSTRAINT IF EXISTS taxguard_tax_approval_policies_function_code_v3;
ALTER TABLE public.taxguard_tax_approval_policies ADD CONSTRAINT taxguard_tax_approval_policies_function_code_v3
  CHECK (function_code IN ('RETURN_TEMPLATE_APPROVAL','FORM_RULE_APPROVAL','RETURN_DRAFT_REVIEW','RETURN_QC_REVIEW','RETURN_FINAL_AUTHORIZATION',
    'RETURN_SIGNATURE_RELEASE'));
ALTER TABLE public.taxguard_tax_approval_policies DROP CONSTRAINT IF EXISTS taxguard_tax_approval_policies_signature_release;
ALTER TABLE public.taxguard_tax_approval_policies ADD CONSTRAINT taxguard_tax_approval_policies_signature_release
  CHECK (function_code <> 'RETURN_SIGNATURE_RELEASE' OR requires_designation);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_signature_consents (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  consent_version INTEGER NOT NULL CHECK (consent_version BETWEEN 1 AND 1000),
  consent_text VARCHAR(4000) NOT NULL CHECK (length(btrim(consent_text)) >= 40),
  rationale VARCHAR(2000) NOT NULL CHECK (length(btrim(rationale)) >= 20),
  created_by VARCHAR(128) NOT NULL,
  approved_by VARCHAR(128) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, consent_version),
  CHECK (approved_by <> created_by)
);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_return_signature_packages (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  package_id UUID NOT NULL DEFAULT gen_random_uuid(),
  return_version_id UUID NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  forms_sha256 CHAR(64) NOT NULL,
  -- The Stage 10 decision carries no foreign key: decisions are immutable and never deleted, and a reference would make
  -- TRUNCATE on them fail before their own no-truncate guard reports it.
  authorization_id UUID NOT NULL,
  consent_version INTEGER NOT NULL,
  signer_uids TEXT[] NOT NULL CHECK (cardinality(signer_uids) BETWEEN 1 AND 4 AND array_position(signer_uids, NULL) IS NULL),
  authority_basis JSONB NOT NULL CHECK (jsonb_typeof(authority_basis) = 'object'),
  session_auth_time BIGINT NOT NULL,
  released_by VARCHAR(128) NOT NULL,
  released_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  withdrawn_by VARCHAR(128),
  withdrawn_at TIMESTAMPTZ,
  withdraw_reason VARCHAR(500),
  PRIMARY KEY (tenant_id, package_id),
  FOREIGN KEY (tenant_id, return_version_id) REFERENCES public.taxguard_tax_return_versions(tenant_id, return_version_id),
  FOREIGN KEY (tenant_id, consent_version) REFERENCES public.taxguard_tax_signature_consents(tenant_id, consent_version),
  CHECK ((withdrawn_at IS NULL) = (withdrawn_by IS NULL) AND (withdrawn_at IS NULL) = (withdraw_reason IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxguard_tax_return_signature_packages_live ON public.taxguard_tax_return_signature_packages(tenant_id, return_version_id)
  WHERE withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_taxguard_tax_return_signature_packages_client ON public.taxguard_tax_return_signature_packages(tenant_id, client_id)
  WHERE withdrawn_at IS NULL;

ALTER TABLE public.taxguard_tax_signature_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_return_signature_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_signature_consents, public.taxguard_tax_return_signature_packages FROM PUBLIC, anon, authenticated, service_role;

-- Consent texts never change; a package only gains its withdrawal, once.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Nested: the package columns are referenced only for the package table.
  IF TG_TABLE_NAME = 'taxguard_tax_return_signature_packages' AND TG_OP = 'UPDATE' THEN
    IF OLD.withdrawn_at IS NULL AND NEW.withdrawn_at IS NOT NULL
       AND (NEW.tenant_id, NEW.package_id, NEW.return_version_id, NEW.case_id, NEW.client_id, NEW.forms_sha256, NEW.authorization_id, NEW.consent_version,
            NEW.signer_uids, NEW.authority_basis, NEW.session_auth_time, NEW.released_by, NEW.released_at)
         IS NOT DISTINCT FROM (OLD.tenant_id, OLD.package_id, OLD.return_version_id, OLD.case_id, OLD.client_id, OLD.forms_sha256, OLD.authorization_id,
            OLD.consent_version, OLD.signer_uids, OLD.authority_basis, OLD.session_auth_time, OLD.released_by, OLD.released_at) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001';
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_tax_signature_consents','taxguard_tax_return_signature_packages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_return_signature_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_truncate ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_return_signature_guard()', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_signature_consent_current(p_tenant text) RETURNS public.taxguard_tax_signature_consents
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT c.* FROM public.taxguard_tax_signature_consents c WHERE c.tenant_id = p_tenant ORDER BY c.consent_version DESC LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_live(p_tenant text, p_version uuid) RETURNS public.taxguard_tax_return_signature_packages
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT * FROM public.taxguard_tax_return_signature_packages WHERE tenant_id = p_tenant AND return_version_id = p_version AND withdrawn_at IS NULL $$;

-- Whether the version's latest Stage 10 decision can be released: {releasable, reasons}.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_authorized(p_tenant text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE st jsonb := public.taxguard_tax_return_final_status(p_tenant, p_version);
BEGIN
  IF st->'decision' IS NULL OR jsonb_typeof(st->'decision') = 'null' THEN RETURN jsonb_build_object('releasable', false, 'reasons', '["NO_DECISION"]'::jsonb); END IF;
  IF st->'decision'->>'outcome' <> 'AUTHORIZED' THEN RETURN jsonb_build_object('releasable', false, 'reasons', '["DECLINED"]'::jsonb); END IF;
  IF NOT (st->>'current')::boolean THEN RETURN jsonb_build_object('releasable', false, 'reasons', st->'reasons'); END IF;
  RETURN jsonb_build_object('releasable', true, 'reasons', '[]'::jsonb, 'authorizationId', st->'decision'->'authorizationId');
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_json(p public.taxguard_tax_return_signature_packages) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('packageId', p.package_id, 'returnVersionId', p.return_version_id, 'authorizationId', p.authorization_id,
    'consentVersion', p.consent_version, 'signerUids', to_jsonb(p.signer_uids), 'releasedBy', p.released_by, 'releasedAt', p.released_at,
    'withdrawnBy', p.withdrawn_by, 'withdrawnAt', p.withdrawn_at, 'withdrawReason', p.withdraw_reason) $$;

-- The live package of a version and whether it is still current: {package, current, reasons}.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_status(p_tenant text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE p public.taxguard_tax_return_signature_packages; r jsonb; k public.taxguard_tax_signature_consents; reasons text[] := '{}';
BEGIN
  p := public.taxguard_tax_return_signature_live(p_tenant, p_version);
  IF p.package_id IS NULL THEN RETURN jsonb_build_object('package', NULL, 'current', false, 'reasons', '[]'::jsonb); END IF;
  r := public.taxguard_tax_return_signature_authorized(p_tenant, p_version);
  k := public.taxguard_tax_signature_consent_current(p_tenant);
  IF NOT (r->>'releasable')::boolean THEN reasons := reasons || 'FINAL_AUTHORIZATION_NOT_CURRENT'::text;
  ELSIF r->>'authorizationId' IS DISTINCT FROM p.authorization_id::text THEN reasons := reasons || 'FINAL_AUTHORIZATION_CHANGED'::text; END IF;
  IF k.consent_version IS DISTINCT FROM p.consent_version THEN reasons := reasons || 'CONSENT_CHANGED'::text; END IF;
  RETURN jsonb_build_object('package', public.taxguard_tax_return_signature_json(p), 'current', cardinality(reasons) = 0, 'reasons', to_jsonb(reasons));
END $$;

-- Supersedes 20261019180000: the same readiness and Stage 10 decision, with the signature package.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_readiness(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE e jsonb; st jsonb; sg jsonb; authorized boolean;
BEGIN
  PERFORM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  e := public.taxguard_tax_return_readiness_eval(p_tenant, p_version);
  st := public.taxguard_tax_return_final_status(p_tenant, p_version);
  sg := public.taxguard_tax_return_signature_status(p_tenant, p_version);
  authorized := (st->>'current')::boolean AND st->'decision'->>'outcome' = 'AUTHORIZED';
  RETURN jsonb_build_object('returnVersionId', p_version, 'ready', e->'ready', 'reasons', e->'reasons',
    'riskAssessmentId', e->'riskAssessmentId', 'qcReviewId', e->'qcReviewId', 'finalAuthorization', st, 'signaturePackage', sg,
    'stage10', CASE WHEN authorized THEN 'AUTHORIZED' ELSE 'FINAL_AUTHORIZATION_REQUIRED' END,
    'stage11', CASE WHEN authorized AND (sg->>'current')::boolean THEN 'SIGNATURE_PACKAGE_RELEASED'
      WHEN authorized THEN 'CLIENT_SIGNATURE_REQUIRED' ELSE 'NOT_STARTED' END,
    'signature', 'NOT_AVAILABLE', 'returnUse', 'BLOCKED');
END $$;

-- The active client-portal members of the case's client: the people a package may name as signers.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_candidates(p_tenant text, p_client text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('uid', m.uid, 'name', i.user_data->>'name') ORDER BY m.uid), '[]'::jsonb)
  FROM public.taxguard_members m LEFT JOIN public.taxguard_identities i ON i.tenant_id = m.tenant_id AND i.uid = m.uid
  WHERE m.tenant_id = p_tenant AND m.client_id = p_client AND m.role = 'client' AND m.status = 'active' $$;

-- What the releaser reviews: the readiness (with Stage 10 and the package), the consent text and the possible signers.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_context(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; k public.taxguard_tax_signature_consents;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  k := public.taxguard_tax_signature_consent_current(p_tenant);
  RETURN jsonb_build_object('readiness', public.taxguard_tax_return_final_readiness(p_tenant, p_actor, p_version),
    'releasable', public.taxguard_tax_return_signature_authorized(p_tenant, p_version),
    'consent', CASE WHEN k.consent_version IS NULL THEN NULL ELSE jsonb_build_object('consentVersion', k.consent_version, 'text', k.consent_text) END,
    'candidates', public.taxguard_tax_return_signature_candidates(p_tenant, (s.c).client_id), 'signature', 'NOT_AVAILABLE', 'returnUse', 'BLOCKED');
END $$;

-- Releases the version for client signature. p_input = {consentVersion, acknowledged: true, signers: [uid, ...]}.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_release(p_tenant text, p_actor text, p_session_hash text, p_version uuid, p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE sess jsonb; s record; r jsonb; auth jsonb; k public.taxguard_tax_signature_consents; signers text[]; row_ public.taxguard_tax_return_signature_packages;
BEGIN
  PERFORM 1 FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version FOR UPDATE;
  BEGIN
    sess := public.taxguard_privileged_session(p_tenant, p_actor, p_session_hash,
      ARRAY['accountant','reviewer','senior_reviewer','bookkeeper','practice_manager','operations','admin']);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'STAFF_ADMIN_REQUIRED' THEN RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_SESSION_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  SELECT * INTO s FROM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  IF p_actor = (s.v).prepared_by OR p_actor IS NOT DISTINCT FROM (s.c).preparer_uid THEN
    RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_NOT_INDEPENDENT' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_input) x WHERE x NOT IN ('consentVersion','acknowledged','signers'))
     OR p_input->'acknowledged' IS DISTINCT FROM 'true'::jsonb
     OR jsonb_typeof(p_input->'consentVersion') IS DISTINCT FROM 'number' OR COALESCE(p_input->>'consentVersion', '') !~ '^[0-9]{1,4}$'
     OR jsonb_typeof(p_input->'signers') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'signers') NOT BETWEEN 1 AND 4
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_input->'signers') AS t(x) WHERE jsonb_typeof(x) <> 'string' OR x #>> '{}' !~ '^[A-Za-z0-9_-]{1,128}$') THEN
    RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT array_agg(x ORDER BY ord) INTO signers FROM jsonb_array_elements_text(p_input->'signers') WITH ORDINALITY AS t(x, ord);
  IF (SELECT count(DISTINCT x) FROM unnest(signers) x) <> cardinality(signers) THEN RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  r := public.taxguard_tax_return_signature_authorized(p_tenant, p_version);
  IF NOT (r->>'releasable')::boolean THEN RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_NOT_AUTHORIZED' USING ERRCODE = 'P0001', DETAIL = (r->'reasons')::text; END IF;
  -- The case-specific part of the authority, if the owner's policy requires it: the case reviewer or the final authorizer of record.
  auth := public.taxguard_tax_approval_authority(p_tenant, p_actor, 'RETURN_SIGNATURE_RELEASE',
    (SELECT t.jurisdiction_code FROM public.taxguard_tax_return_templates t WHERE t.tenant_id = p_tenant AND t.template_rule_id = (s.v).template_rule_id),
    s.is_authorizer OR p_actor IS NOT DISTINCT FROM (s.c).reviewer_uid);
  IF NOT (auth->>'authorized')::boolean THEN RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_AUTHORITY_REQUIRED' USING ERRCODE = 'P0001', DETAIL = auth->>'reason'; END IF;
  k := public.taxguard_tax_signature_consent_current(p_tenant);
  IF k.consent_version IS NULL THEN RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_CONSENT_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF k.consent_version <> (p_input->>'consentVersion')::integer THEN RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_CONSENT_CHANGED' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(signers) x WHERE NOT EXISTS (SELECT 1 FROM public.taxguard_members m WHERE m.tenant_id = p_tenant AND m.uid = x
       AND m.client_id = (s.c).client_id AND m.role = 'client' AND m.status = 'active')) THEN
    RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_SIGNER_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF (public.taxguard_tax_return_signature_live(p_tenant, p_version)).package_id IS NOT NULL THEN
    RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_ALREADY_RELEASED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.taxguard_tax_return_signature_packages(tenant_id, return_version_id, case_id, client_id, forms_sha256, authorization_id, consent_version,
      signer_uids, authority_basis, session_auth_time, released_by)
    VALUES (p_tenant, p_version, (s.v).case_id, (s.c).client_id, (s.v).forms_sha256, (r->>'authorizationId')::uuid, k.consent_version, signers,
      (auth->'basis') || jsonb_build_object('releasedBy', p_actor), (sess->>'authTime')::bigint, p_actor)
    RETURNING * INTO row_;
  PERFORM public.taxguard_case_audit(p_tenant, (s.c).client_id, (s.c).case_id, p_actor, s.actor_role, 'TAX_RETURN_SIGNATURE_PACKAGE_RELEASED',
    jsonb_build_object('packageId', row_.package_id, 'returnVersionId', p_version, 'authorizationId', row_.authorization_id,
      'consentVersion', row_.consent_version, 'signerCount', cardinality(signers), 'authorityBasis', row_.authority_basis));
  RETURN public.taxguard_tax_return_signature_json(row_) || jsonb_build_object('stage11', 'SIGNATURE_PACKAGE_RELEASED', 'signature', 'NOT_AVAILABLE',
    'returnUse', 'BLOCKED');
END $$;

-- The releaser or a practice manager withdraws the live package, with a reason. Nothing is deleted.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_withdraw(p_tenant text, p_actor text, p_version uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; p public.taxguard_tax_return_signature_packages; reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  PERFORM 1 FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version FOR UPDATE;
  SELECT * INTO s FROM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  p := public.taxguard_tax_return_signature_live(p_tenant, p_version);
  IF p.package_id IS NULL THEN RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_NOT_RELEASED' USING ERRCODE = 'P0001'; END IF;
  IF p_actor <> p.released_by AND NOT public.taxguard_practice_is_manager(s.actor_role) THEN
    RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_WITHDRAWER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF length(reason) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'TAX_RETURN_SIGNATURE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_tax_return_signature_packages SET withdrawn_by = p_actor, withdrawn_at = clock_timestamp(), withdraw_reason = reason
    WHERE tenant_id = p_tenant AND package_id = p.package_id RETURNING * INTO p;
  PERFORM public.taxguard_case_audit(p_tenant, (s.c).client_id, (s.c).case_id, p_actor, s.actor_role, 'TAX_RETURN_SIGNATURE_PACKAGE_WITHDRAWN',
    jsonb_build_object('packageId', p.package_id, 'returnVersionId', p_version));
  RETURN public.taxguard_tax_return_signature_json(p);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_signature_list(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_tax_return_signature_json(p) ORDER BY p.released_at DESC, p.package_id), '[]'::jsonb)
    FROM public.taxguard_tax_return_signature_packages p WHERE p.tenant_id = p_tenant AND p.return_version_id = p_version);
END $$;

-- Client portal: the client's current packages, status only. A client sees only packages that name them as a signer;
-- staff in scope of the client see all current packages. No figures, forms or signing action.
CREATE OR REPLACE FUNCTION public.taxguard_portal_signature_packages(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('packageId', p.package_id, 'taxYear', v.tax_year, 'releasedAt', p.released_at,
      'status', 'AWAITING_SIGNATURE', 'signature', 'NOT_AVAILABLE') ORDER BY p.released_at DESC, p.package_id), '[]'::jsonb)
    FROM public.taxguard_tax_return_signature_packages p
    JOIN public.taxguard_tax_return_versions v ON v.tenant_id = p.tenant_id AND v.return_version_id = p.return_version_id
    WHERE p.tenant_id = p_tenant AND p.client_id = p_client AND p.withdrawn_at IS NULL
      AND (r <> 'client' OR p_actor = ANY (p.signer_uids))
      AND (public.taxguard_tax_return_signature_status(p_tenant, p.return_version_id)->>'current')::boolean);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_tax_return_signature_guard','taxguard_tax_signature_consent_current',
        'taxguard_tax_return_signature_live','taxguard_tax_return_signature_authorized','taxguard_tax_return_signature_json',
        'taxguard_tax_return_signature_status','taxguard_tax_return_final_readiness','taxguard_tax_return_signature_candidates',
        'taxguard_tax_return_signature_context','taxguard_tax_return_signature_release','taxguard_tax_return_signature_withdraw',
        'taxguard_tax_return_signature_list','taxguard_portal_signature_packages') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_return_final_readiness','taxguard_tax_return_signature_context','taxguard_tax_return_signature_release',
        'taxguard_tax_return_signature_withdraw','taxguard_tax_return_signature_list','taxguard_portal_signature_packages') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
