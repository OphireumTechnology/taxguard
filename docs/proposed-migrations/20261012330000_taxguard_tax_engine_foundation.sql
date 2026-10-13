-- PROPOSAL 033 ONLY. NOT APPLIED. Requires the actual core schema and proposals 025 and 026.
-- Tax engine FOUNDATION. TaxGuard ships no tax rules: sources, rule sets and their parameter values
-- are entered by the firm, verified and approved by a different person, and pinned by hash.
--
--   taxguard_tax_sources      source-of-law records (statute, regulation, IRS/state instructions,
--                             publications, rulings...). PROPOSED -> VERIFIED by a reviewer other
--                             than the registrant, against the SHA-256 of the document they read.
--                             'synthetic_test' sources are flagged and taint everything they touch.
--   taxguard_tax_rule_sets    versioned per (jurisdiction, code, return family, tax year).
--                             DRAFT -> PENDING_REVIEW -> APPROVED | REJECTED; approving supersedes
--                             the previous APPROVED version. The definition and its hash are frozen
--                             once submitted. Every cited source must be VERIFIED to submit/approve.
--   taxguard_tax_calc_runs    a deterministic evaluation pinned to rule-set id + hash + engine
--                             version + input hash, with outputs and the full provenance trace.
--                             Idempotent per (case, rule set, input hash); a different output for the
--                             same pinned inputs is refused as nondeterminism. COMPUTED -> REVIEWED
--                             (approved / rejected) by the case reviewer, never the requester.
-- Stage 09-18 remain BLOCKED (proposal 026 policy unchanged). Every run states returnUse = BLOCKED:
-- a reviewed foundation run is evidence for review, not a return.
-- Rollback (development): drop taxguard_tax_* functions, triggers and the three tables.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_sources (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE CASCADE,
  source_id VARCHAR(80) NOT NULL CHECK (source_id ~ '^[A-Za-z0-9_.:-]{3,80}$'),
  jurisdiction VARCHAR(8) NOT NULL CHECK (jurisdiction IN ('federal','state')),
  jurisdiction_code CHAR(2) NOT NULL CHECK (jurisdiction_code ~ '^[A-Z]{2}$'),
  authority_type VARCHAR(32) NOT NULL CHECK (authority_type IN ('statute','regulation','form_instructions','publication','revenue_procedure',
    'revenue_ruling','notice','state_statute','state_regulation','state_guidance','synthetic_test')),
  title VARCHAR(300) NOT NULL CHECK (length(btrim(title)) >= 3),
  issuer VARCHAR(200) NOT NULL,
  citation VARCHAR(300) NOT NULL,
  url VARCHAR(500) CHECK (url IS NULL OR url ~ '^https://'),
  tax_years INTEGER[] NOT NULL CHECK (cardinality(tax_years) BETWEEN 1 AND 10),
  synthetic BOOLEAN GENERATED ALWAYS AS (authority_type = 'synthetic_test') STORED,
  document_sha256 CHAR(64) CHECK (document_sha256 IS NULL OR document_sha256 ~ '^[a-f0-9]{64}$'),
  status VARCHAR(16) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED','VERIFIED','RETIRED')),
  registered_by VARCHAR(128) NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by VARCHAR(128),
  verified_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, source_id),
  CHECK (verified_by IS NULL OR verified_by <> registered_by),
  CHECK ((status = 'VERIFIED') <= (verified_by IS NOT NULL AND document_sha256 IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_rule_sets (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE CASCADE,
  rule_set_id UUID NOT NULL DEFAULT gen_random_uuid(),
  jurisdiction VARCHAR(8) NOT NULL CHECK (jurisdiction IN ('federal','state')),
  jurisdiction_code CHAR(2) NOT NULL,
  return_family VARCHAR(16) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  version INTEGER NOT NULL CHECK (version > 0),
  definition JSONB NOT NULL,
  content_sha256 CHAR(64) NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  source_ids TEXT[] NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED','SUPERSEDED')),
  prepared_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_by VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  review_note VARCHAR(1000),
  PRIMARY KEY (tenant_id, rule_set_id),
  UNIQUE (tenant_id, jurisdiction, jurisdiction_code, return_family, tax_year, version),
  CHECK (reviewed_by IS NULL OR reviewed_by <> prepared_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_tax_rule_set_approved ON public.taxguard_tax_rule_sets (tenant_id, jurisdiction, jurisdiction_code, return_family, tax_year)
  WHERE status = 'APPROVED';

CREATE TABLE IF NOT EXISTS public.taxguard_tax_calc_runs (
  tenant_id VARCHAR(128) NOT NULL,
  run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  client_id VARCHAR(64) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  rule_set_id UUID NOT NULL,
  rule_set_sha256 CHAR(64) NOT NULL,
  engine_version VARCHAR(40) NOT NULL,
  input_sha256 CHAR(64) NOT NULL,
  output_sha256 CHAR(64) NOT NULL,
  filing_status VARCHAR(40),
  inputs JSONB NOT NULL,
  outputs JSONB NOT NULL,
  trace JSONB NOT NULL,
  synthetic BOOLEAN NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'COMPUTED' CHECK (status IN ('COMPUTED','REVIEW_APPROVED','REVIEW_REJECTED')),
  requested_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  review_note VARCHAR(1000),
  PRIMARY KEY (tenant_id, run_id),
  UNIQUE (tenant_id, case_id, rule_set_id, input_sha256),
  FOREIGN KEY (tenant_id, rule_set_id) REFERENCES public.taxguard_tax_rule_sets(tenant_id, rule_set_id),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id),
  CHECK (reviewed_by IS NULL OR reviewed_by <> requested_by)
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_tax_sources','taxguard_tax_rule_sets','taxguard_tax_calc_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Frozen content: a submitted rule set's definition, hash and identity never change; a run's pinned
-- inputs, outputs and trace never change; only status/review fields move forward. No deletes.
CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_sets_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'TAX_RULE_SET_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF OLD.status <> 'DRAFT' AND (NEW.definition IS DISTINCT FROM OLD.definition OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
     OR NEW.source_ids IS DISTINCT FROM OLD.source_ids OR NEW.synthetic IS DISTINCT FROM OLD.synthetic) THEN
    RAISE EXCEPTION 'TAX_RULE_SET_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.tenant_id, NEW.rule_set_id, NEW.jurisdiction, NEW.jurisdiction_code, NEW.return_family, NEW.tax_year, NEW.version, NEW.prepared_by)
     IS DISTINCT FROM (OLD.tenant_id, OLD.rule_set_id, OLD.jurisdiction, OLD.jurisdiction_code, OLD.return_family, OLD.tax_year, OLD.version, OLD.prepared_by) THEN
    RAISE EXCEPTION 'TAX_RULE_SET_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_rule_sets_guard ON public.taxguard_tax_rule_sets;
CREATE TRIGGER trg_taxguard_tax_rule_sets_guard BEFORE UPDATE OR DELETE ON public.taxguard_tax_rule_sets FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_rule_sets_guard();

CREATE OR REPLACE FUNCTION public.taxguard_tax_calc_runs_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status <> 'COMPUTED'
     OR (NEW.tenant_id, NEW.run_id, NEW.client_id, NEW.case_id, NEW.tax_year, NEW.rule_set_id, NEW.rule_set_sha256, NEW.engine_version, NEW.input_sha256,
         NEW.output_sha256, NEW.filing_status, NEW.inputs, NEW.outputs, NEW.trace, NEW.synthetic, NEW.requested_by, NEW.created_at)
     IS DISTINCT FROM (OLD.tenant_id, OLD.run_id, OLD.client_id, OLD.case_id, OLD.tax_year, OLD.rule_set_id, OLD.rule_set_sha256, OLD.engine_version, OLD.input_sha256,
         OLD.output_sha256, OLD.filing_status, OLD.inputs, OLD.outputs, OLD.trace, OLD.synthetic, OLD.requested_by, OLD.created_at) THEN
    RAISE EXCEPTION 'TAX_CALC_RUN_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_calc_runs_guard ON public.taxguard_tax_calc_runs;
CREATE TRIGGER trg_taxguard_tax_calc_runs_guard BEFORE UPDATE OR DELETE ON public.taxguard_tax_calc_runs FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_calc_runs_guard();

-- ------------------------------------------------------------------------------------------
-- Internal helpers
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_tax_audit(p_tenant text, p_client text, p_actor text, p_role text, p_action text, p_meta jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, p_action, p_actor, p_role, jsonb_build_object('clientId', COALESCE(p_client, '')) || COALESCE(p_meta, '{}'::jsonb)) $$;

-- Content maintainers register sources and draft rule sets; reviewers verify and approve.
CREATE OR REPLACE FUNCTION public.taxguard_tax_actor(p_tenant text, p_actor text, p_need text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_need = 'maintain' AND r NOT IN ('admin','administrator','super_admin','super_administrator','practice_manager','senior_reviewer','reviewer','accountant') THEN
    RAISE EXCEPTION 'TAX_CONTENT_ROLE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_need = 'review' AND r NOT IN ('senior_reviewer','reviewer','admin','administrator') THEN
    RAISE EXCEPTION 'TAX_CONTENT_REVIEWER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF r = 'bookkeeper' THEN RAISE EXCEPTION 'TAX_CONTENT_ROLE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_set_json(s public.taxguard_tax_rule_sets, p_full boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('ruleSetId', s.rule_set_id, 'jurisdiction', s.jurisdiction, 'jurisdictionCode', s.jurisdiction_code, 'returnFamily', s.return_family,
    'taxYear', s.tax_year, 'version', s.version, 'contentSha256', s.content_sha256, 'sourceIds', to_jsonb(s.source_ids), 'synthetic', s.synthetic, 'status', s.status,
    'preparedBy', s.prepared_by, 'createdAt', s.created_at, 'submittedAt', s.submitted_at, 'reviewedBy', s.reviewed_by, 'reviewedAt', s.reviewed_at, 'reviewNote', s.review_note)
  || CASE WHEN p_full THEN jsonb_build_object('definition', s.definition) ELSE '{}'::jsonb END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_unverified_sources(p_tenant text, p_ids text[], p_year integer) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(array_agg(id ORDER BY id), '{}') FROM unnest(p_ids) id
  WHERE NOT EXISTS (SELECT 1 FROM public.taxguard_tax_sources s WHERE s.tenant_id = p_tenant AND s.source_id = id AND s.status = 'VERIFIED' AND p_year = ANY (s.tax_years)) $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs: sources
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_tax_source_register(p_tenant text, p_actor text, p_source jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_tax_sources;
BEGIN
  r := public.taxguard_tax_actor(p_tenant, p_actor, 'maintain');
  BEGIN
    INSERT INTO public.taxguard_tax_sources(tenant_id, source_id, jurisdiction, jurisdiction_code, authority_type, title, issuer, citation, url, tax_years, registered_by)
    VALUES (p_tenant, p_source->>'sourceId', p_source->>'jurisdiction', p_source->>'jurisdictionCode', p_source->>'authorityType', btrim(p_source->>'title'),
      btrim(p_source->>'issuer'), btrim(p_source->>'citation'), NULLIF(p_source->>'url', ''), ARRAY(SELECT jsonb_array_elements_text(p_source->'taxYears'))::integer[], p_actor)
    RETURNING * INTO s;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'TAX_SOURCE_EXISTS' USING ERRCODE = 'P0001';
    WHEN check_violation OR not_null_violation OR invalid_text_representation OR string_data_right_truncation THEN RAISE EXCEPTION 'TAX_SOURCE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, r, 'TAX_SOURCE_REGISTERED', jsonb_build_object('sourceId', s.source_id, 'authorityType', s.authority_type, 'synthetic', s.synthetic));
  RETURN to_jsonb(s) - 'tenant_id';
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_source_verify(p_tenant text, p_actor text, p_source text, p_document_sha256 text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_tax_sources;
BEGIN
  r := public.taxguard_tax_actor(p_tenant, p_actor, 'review');
  IF p_document_sha256 IS NULL OR p_document_sha256 !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'TAX_SOURCE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO s FROM public.taxguard_tax_sources WHERE tenant_id = p_tenant AND source_id = p_source FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF s.status <> 'PROPOSED' THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_PROPOSED' USING ERRCODE = 'P0001'; END IF;
  IF s.registered_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_tax_sources SET status = 'VERIFIED', verified_by = p_actor, verified_at = now(), document_sha256 = p_document_sha256
    WHERE tenant_id = p_tenant AND source_id = p_source RETURNING * INTO s;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, r, 'TAX_SOURCE_VERIFIED', jsonb_build_object('sourceId', p_source, 'documentSha256', p_document_sha256));
  RETURN to_jsonb(s) - 'tenant_id';
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_source_list(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_tax_actor(p_tenant, p_actor, 'read');
  RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(s) - 'tenant_id' ORDER BY s.source_id), '[]'::jsonb) FROM public.taxguard_tax_sources s WHERE s.tenant_id = p_tenant);
END $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs: rule sets (the server validates the definition and computes its hash)
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_set_draft(p_tenant text, p_actor text, p_definition jsonb, p_sha256 text, p_source_ids text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_tax_rule_sets; v integer; synth boolean;
BEGIN
  r := public.taxguard_tax_actor(p_tenant, p_actor, 'maintain');
  IF p_definition IS NULL OR jsonb_typeof(p_definition) <> 'object' OR p_sha256 IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$' OR cardinality(COALESCE(p_source_ids, '{}')) = 0 THEN
    RAISE EXCEPTION 'TAX_RULE_SET_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND content_sha256 = p_sha256 AND status IN ('DRAFT','PENDING_REVIEW','APPROVED');
  IF FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_DUPLICATE' USING ERRCODE = 'P0001'; END IF;
  -- Serialize versioning per rule-set key.
  PERFORM pg_advisory_xact_lock(hashtext(concat_ws('|', p_tenant, p_definition->>'jurisdiction', p_definition->>'jurisdictionCode', p_definition->>'returnFamily', p_definition->>'taxYear')));
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND jurisdiction = p_definition->>'jurisdiction'
    AND jurisdiction_code = p_definition->>'jurisdictionCode' AND return_family = p_definition->>'returnFamily' AND tax_year = (p_definition->>'taxYear')::integer;
  synth := EXISTS (SELECT 1 FROM public.taxguard_tax_sources WHERE tenant_id = p_tenant AND source_id = ANY (p_source_ids) AND synthetic);
  BEGIN
    INSERT INTO public.taxguard_tax_rule_sets(tenant_id, jurisdiction, jurisdiction_code, return_family, tax_year, version, definition, content_sha256, source_ids, synthetic, prepared_by)
    VALUES (p_tenant, p_definition->>'jurisdiction', p_definition->>'jurisdictionCode', p_definition->>'returnFamily', (p_definition->>'taxYear')::integer, v,
      p_definition, p_sha256, p_source_ids, synth, p_actor) RETURNING * INTO s;
  EXCEPTION WHEN check_violation OR not_null_violation OR invalid_text_representation OR string_data_right_truncation THEN
    RAISE EXCEPTION 'TAX_RULE_SET_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, r, 'TAX_RULE_SET_DRAFTED', jsonb_build_object('ruleSetId', s.rule_set_id, 'version', v, 'taxYear', s.tax_year, 'sha256', p_sha256));
  RETURN public.taxguard_tax_rule_set_json(s, false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_set_transition(p_tenant text, p_actor text, p_rule_set uuid, p_action text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_tax_rule_sets; missing text[];
BEGIN
  r := public.taxguard_tax_actor(p_tenant, p_actor, CASE WHEN p_action = 'submit' THEN 'maintain' ELSE 'review' END);
  SELECT * INTO s FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  missing := public.taxguard_tax_unverified_sources(p_tenant, s.source_ids, s.tax_year);
  IF p_action = 'submit' THEN
    IF s.status <> 'DRAFT' THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_DRAFT' USING ERRCODE = 'P0001'; END IF;
    IF s.prepared_by <> p_actor AND NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'TAX_CONTENT_ROLE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = array_to_string(missing, ','); END IF;
    UPDATE public.taxguard_tax_rule_sets SET status = 'PENDING_REVIEW', submitted_at = now() WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set RETURNING * INTO s;
  ELSIF p_action IN ('approve','reject') THEN
    IF s.status <> 'PENDING_REVIEW' THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;
    IF s.prepared_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'reject' AND length(btrim(COALESCE(p_note, ''))) < 10 THEN RAISE EXCEPTION 'TAX_RULE_SET_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'approve' THEN
      IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = array_to_string(missing, ','); END IF;
      UPDATE public.taxguard_tax_rule_sets SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND jurisdiction = s.jurisdiction AND jurisdiction_code = s.jurisdiction_code
        AND return_family = s.return_family AND tax_year = s.tax_year AND status = 'APPROVED';
    END IF;
    UPDATE public.taxguard_tax_rule_sets SET status = CASE p_action WHEN 'approve' THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(),
      review_note = NULLIF(btrim(COALESCE(p_note, '')), '') WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set RETURNING * INTO s;
  ELSE RAISE EXCEPTION 'TAX_RULE_SET_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, r, 'TAX_RULE_SET_' || upper(p_action) || CASE WHEN p_action = 'submit' THEN 'TED' ELSE 'D' END,
    jsonb_build_object('ruleSetId', p_rule_set, 'version', s.version, 'sha256', s.content_sha256));
  RETURN public.taxguard_tax_rule_set_json(s, false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_set_get(p_tenant text, p_actor text, p_rule_set uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s public.taxguard_tax_rule_sets;
BEGIN
  PERFORM public.taxguard_tax_actor(p_tenant, p_actor, 'read');
  SELECT * INTO s FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN public.taxguard_tax_rule_set_json(s, true);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_set_list(p_tenant text, p_actor text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_tax_actor(p_tenant, p_actor, 'read');
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_tax_rule_set_json(s, false) ORDER BY s.tax_year DESC, s.jurisdiction, s.jurisdiction_code, s.return_family, s.version DESC), '[]'::jsonb)
    FROM public.taxguard_tax_rule_sets s WHERE s.tenant_id = p_tenant AND (p_tax_year IS NULL OR s.tax_year = p_tax_year));
END $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs: calculation runs
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_record(p_tenant text, p_actor text, p_case text, p_run jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; c public.taxguard_cases; s public.taxguard_tax_rule_sets; existing public.taxguard_tax_calc_runs; run public.taxguard_tax_calc_runs;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case;
  IF NOT FOUND OR NOT (p_actor IN (c.preparer_uid, c.reviewer_uid)) THEN RAISE EXCEPTION 'TAX_CALC_CASE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO s FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = (p_run->>'ruleSetId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF s.status <> 'APPROVED' THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  IF s.content_sha256 <> p_run->>'ruleSetSha256' THEN RAISE EXCEPTION 'TAX_RULE_SET_INTEGRITY' USING ERRCODE = 'P0001'; END IF;
  IF s.tax_year <> c.tax_year THEN RAISE EXCEPTION 'TAX_CALC_TAX_YEAR_MISMATCH' USING ERRCODE = 'P0001'; END IF;
  IF COALESCE(p_run->>'inputSha256', '') !~ '^[a-f0-9]{64}$' OR COALESCE(p_run->>'outputSha256', '') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'TAX_CALC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO existing FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND case_id = p_case AND rule_set_id = s.rule_set_id AND input_sha256 = p_run->>'inputSha256';
  IF FOUND THEN
    IF existing.output_sha256 <> p_run->>'outputSha256' OR existing.engine_version <> p_run->>'engineVersion' THEN
      -- Returned (not raised) so the refusal's audit row is committed; nothing else changes.
      PERFORM public.taxguard_tax_audit(p_tenant, c.client_id, p_actor, r, 'TAX_CALC_NONDETERMINISM_REFUSED', jsonb_build_object('runId', existing.run_id, 'caseId', p_case,
        'recordedOutputSha256', existing.output_sha256, 'offeredOutputSha256', p_run->>'outputSha256'));
      RETURN jsonb_build_object('refused', 'TAX_ENGINE_NONDETERMINISM', 'runId', existing.run_id);
    END IF;
    RETURN (to_jsonb(existing) - 'tenant_id') || jsonb_build_object('replayed', true, 'returnUse', 'BLOCKED');
  END IF;
  INSERT INTO public.taxguard_tax_calc_runs(tenant_id, client_id, case_id, tax_year, rule_set_id, rule_set_sha256, engine_version, input_sha256, output_sha256, filing_status,
      inputs, outputs, trace, synthetic, requested_by)
    VALUES (p_tenant, c.client_id, p_case, c.tax_year, s.rule_set_id, s.content_sha256, p_run->>'engineVersion', p_run->>'inputSha256', p_run->>'outputSha256',
      NULLIF(p_run->>'filingStatus', ''), p_run->'inputs', p_run->'outputs', p_run->'trace', s.synthetic, p_actor) RETURNING * INTO run;
  PERFORM public.taxguard_tax_audit(p_tenant, c.client_id, p_actor, r, 'TAX_CALC_RECORDED', jsonb_build_object('runId', run.run_id, 'caseId', p_case,
    'ruleSetId', s.rule_set_id, 'ruleSetVersion', s.version, 'inputSha256', run.input_sha256, 'outputSha256', run.output_sha256, 'synthetic', s.synthetic));
  RETURN (to_jsonb(run) - 'tenant_id') || jsonb_build_object('replayed', false, 'returnUse', 'BLOCKED');
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_run_review(p_tenant text, p_actor text, p_run uuid, p_decision text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; run public.taxguard_tax_calc_runs; c public.taxguard_cases;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO run FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND run_id = p_run FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_CALC_RUN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = run.case_id;
  IF p_actor <> c.reviewer_uid THEN RAISE EXCEPTION 'TAX_CALC_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_actor = run.requested_by THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF run.status <> 'COMPUTED' THEN RAISE EXCEPTION 'TAX_CALC_ALREADY_REVIEWED' USING ERRCODE = 'P0001'; END IF;
  IF p_decision NOT IN ('approve','reject') OR length(btrim(COALESCE(p_note, ''))) < 10 THEN RAISE EXCEPTION 'TAX_CALC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_tax_calc_runs SET status = CASE p_decision WHEN 'approve' THEN 'REVIEW_APPROVED' ELSE 'REVIEW_REJECTED' END, reviewed_by = p_actor, reviewed_at = now(),
      review_note = btrim(p_note) WHERE tenant_id = p_tenant AND run_id = p_run RETURNING * INTO run;
  PERFORM public.taxguard_tax_audit(p_tenant, run.client_id, p_actor, r, 'TAX_CALC_' || upper(p_decision) || 'D', jsonb_build_object('runId', p_run, 'caseId', run.case_id));
  RETURN (to_jsonb(run) - 'tenant_id') || jsonb_build_object('returnUse', 'BLOCKED');
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_run_list(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; c public.taxguard_cases;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case;
  IF NOT FOUND OR NOT (p_actor IN (c.preparer_uid, c.reviewer_uid) OR public.taxguard_practice_is_manager(r)) THEN RAISE EXCEPTION 'TAX_CALC_CASE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg((to_jsonb(x) - 'tenant_id') || jsonb_build_object('returnUse', 'BLOCKED') ORDER BY x.created_at DESC), '[]'::jsonb)
    FROM public.taxguard_tax_calc_runs x WHERE x.tenant_id = p_tenant AND x.case_id = p_case);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_tax\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_source_register','taxguard_tax_source_verify','taxguard_tax_source_list','taxguard_tax_rule_set_draft','taxguard_tax_rule_set_transition',
        'taxguard_tax_rule_set_get','taxguard_tax_rule_set_list','taxguard_tax_run_record','taxguard_tax_run_review','taxguard_tax_run_list') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
