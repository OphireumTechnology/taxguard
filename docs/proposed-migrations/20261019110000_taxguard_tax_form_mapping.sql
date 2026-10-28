-- PROPOSAL (Block 67, deterministic form mapping). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 033 (tax sources, rule sets, calculation runs, taxguard_tax_actor), 20261018090000 (live case actor) and
-- 20261019100000 (tax conclusions, their links and staleness, taxguard_tax_form_line_sources).
--
-- A form mapping writes values onto a form deterministically, never by model judgement:
--   APPROVED TAX CONCLUSION -> FORM (id, version) -> SCHEDULE -> LINE -> FIELD
-- through a versioned mapping rule. A mapping rule is tax content: it cites a verified source (the form instructions),
-- is drafted by a content maintainer, approved by a different reviewer (maker-checker), frozen once submitted, and a
-- newer approval supersedes it. Each rule line names the conclusion type it takes, whether the value is the
-- conclusion's amount or one output of its calculation run, the value type (MONEY or INTEGER), whether the line is
-- required, and how several conclusions combine: SINGLE (exactly one) or SUM. A rule names a supported jurisdiction
-- (federal: US; state: one of the 50 states or DC) and the dates it is in effect; it maps only while in effect.
--
-- Mapping a case is a pure derivation from durable records: the case's APPROVED conclusions of the named type, each
-- of which must be current (not stale, Block 66) and carry exactly one approved calculation run. Nothing is guessed:
-- an ambiguous SINGLE line, a stale or calculation-less conclusion, a missing amount or output, a value of the wrong
-- type or a missing required line refuses the whole mapping with the reason. Every stored value records its tax year,
-- form id and version, schedule, line, field, value, value type, and per contributing conclusion: conclusion id and
-- version, calculation run, rule set id, version and hash, and the conclusion's evidence links with their snapshots;
-- plus the mapping rule id, version and hash and the time. A value without at least one source cannot be stored, and
-- no role can write these tables directly.
--
-- Staleness is derived, as for conclusions: the mapping is derived again and compared with what was stored. A revised,
-- withdrawn, stale or newly approved conclusion, a changed calculation output or a superseded mapping rule makes the
-- mapping STALE with the reasons. Nothing is recomputed silently: the preparer maps again, which records a new mapping
-- version and supersedes the old one; history is immutable. Mapping writes taxguard_tax_form_line_sources (Block 66) so
-- the conclusion trace lists the form lines it reached.
-- Access: mapping rules follow the tax-content roles (taxguard_tax_actor); mappings follow the live case actor; the
-- case's preparer maps. Clients have none. returnUse stays BLOCKED: Stage 09 (Block 68) is not implemented.
-- Rollback (development): drop the functions and the three tables.

-- The jurisdictions a mapping rule may name: the federal return (US) and the 50 states and DC.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_jurisdiction_supported(p_jurisdiction text, p_code text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE p_jurisdiction
    WHEN 'federal' THEN p_code = 'US'
    WHEN 'state' THEN p_code = ANY (ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
      'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'])
    ELSE false END IS TRUE $$;

CREATE TABLE IF NOT EXISTS public.taxguard_tax_form_rules (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  rule_id UUID NOT NULL DEFAULT gen_random_uuid(),
  jurisdiction VARCHAR(8) NOT NULL CHECK (jurisdiction IN ('federal','state')),
  jurisdiction_code CHAR(2) NOT NULL CHECK (jurisdiction_code ~ '^[A-Z]{2}$'),
  effective_from DATE NOT NULL,
  effective_to DATE,
  return_family VARCHAR(16) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  form_id VARCHAR(40) NOT NULL CHECK (form_id ~ '^[A-Za-z0-9 _.-]{1,40}$'),
  form_version VARCHAR(40) NOT NULL CHECK (form_version ~ '^[A-Za-z0-9_.-]{1,40}$'),
  version INTEGER NOT NULL CHECK (version BETWEEN 1 AND 1000),
  definition JSONB NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  content_sha256 CHAR(64) NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  source_id VARCHAR(80) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED','SUPERSEDED')),
  prepared_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_by VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  review_note VARCHAR(1000),
  PRIMARY KEY (tenant_id, rule_id),
  UNIQUE (tenant_id, jurisdiction, jurisdiction_code, return_family, tax_year, form_id, form_version, version),
  CHECK (reviewed_by IS NULL OR reviewed_by <> prepared_by),
  CHECK (public.taxguard_tax_form_jurisdiction_supported(jurisdiction, jurisdiction_code)),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_form_mappings (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  mapping_id UUID NOT NULL DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  form_id VARCHAR(40) NOT NULL,
  form_version VARCHAR(40) NOT NULL,
  version INTEGER NOT NULL CHECK (version BETWEEN 1 AND 10000),
  rule_id UUID NOT NULL,
  rule_version INTEGER NOT NULL,
  rule_sha256 CHAR(64) NOT NULL,
  values_sha256 CHAR(64) NOT NULL CHECK (values_sha256 ~ '^[a-f0-9]{64}$'),
  missing JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(missing) = 'array'),
  status VARCHAR(16) NOT NULL DEFAULT 'CURRENT' CHECK (status IN ('CURRENT','SUPERSEDED')),
  mapped_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, mapping_id),
  UNIQUE (tenant_id, case_id, form_id, form_version, version),
  FOREIGN KEY (tenant_id, rule_id) REFERENCES public.taxguard_tax_form_rules(tenant_id, rule_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxguard_tax_form_mappings_current ON public.taxguard_tax_form_mappings(tenant_id, case_id, form_id, form_version) WHERE status = 'CURRENT';

CREATE TABLE IF NOT EXISTS public.taxguard_tax_form_values (
  tenant_id VARCHAR(128) NOT NULL,
  mapping_id UUID NOT NULL,
  tax_year INTEGER NOT NULL,
  form_id VARCHAR(40) NOT NULL,
  form_version VARCHAR(40) NOT NULL,
  schedule VARCHAR(40) NOT NULL,
  line VARCHAR(40) NOT NULL,
  field VARCHAR(80) NOT NULL,
  value_type VARCHAR(8) NOT NULL CHECK (value_type IN ('MONEY','INTEGER')),
  value NUMERIC(17,2) NOT NULL,
  sources JSONB NOT NULL CHECK (jsonb_typeof(sources) = 'array' AND jsonb_array_length(sources) >= 1),
  rule_id UUID NOT NULL,
  rule_version INTEGER NOT NULL,
  rule_sha256 CHAR(64) NOT NULL,
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, mapping_id, schedule, line, field),
  FOREIGN KEY (tenant_id, mapping_id) REFERENCES public.taxguard_tax_form_mappings(tenant_id, mapping_id),
  CHECK (value_type <> 'INTEGER' OR value = trunc(value))
);

ALTER TABLE public.taxguard_tax_form_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_form_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_form_values ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_form_rules, public.taxguard_tax_form_mappings, public.taxguard_tax_form_values FROM PUBLIC, anon, authenticated, service_role;

-- A submitted rule's content never changes; a mapping only moves CURRENT -> SUPERSEDED; stored values never change.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'TAX_FORM_MAPPING_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF TG_TABLE_NAME = 'taxguard_tax_form_rules' THEN
    IF (NEW.tenant_id, NEW.rule_id, NEW.jurisdiction, NEW.jurisdiction_code, NEW.return_family, NEW.tax_year, NEW.form_id, NEW.form_version, NEW.version,
        NEW.effective_from, NEW.effective_to, NEW.prepared_by, NEW.created_at) IS DISTINCT FROM (OLD.tenant_id, OLD.rule_id, OLD.jurisdiction,
        OLD.jurisdiction_code, OLD.return_family, OLD.tax_year, OLD.form_id, OLD.form_version, OLD.version, OLD.effective_from, OLD.effective_to,
        OLD.prepared_by, OLD.created_at)
       OR (OLD.status <> 'DRAFT' AND (NEW.definition, NEW.content_sha256, NEW.source_id) IS DISTINCT FROM (OLD.definition, OLD.content_sha256, OLD.source_id)) THEN
      RAISE EXCEPTION 'TAX_FORM_MAPPING_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'taxguard_tax_form_mappings' THEN
    IF OLD.status <> 'CURRENT' OR NEW.status <> 'SUPERSEDED' OR (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RAISE EXCEPTION 'TAX_FORM_MAPPING_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'TAX_FORM_MAPPING_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_tax_form_rules','taxguard_tax_form_mappings','taxguard_tax_form_values'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_form_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_truncate ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_form_guard()', t, t);
  END LOOP;
END $$;

-- NULL when the definition is well formed, otherwise the reason.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_rule_invalid(p_def jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE l jsonb; keys text[] := '{}'; k text; d_from date; d_to date;
BEGIN
  IF p_def IS NULL OR jsonb_typeof(p_def) <> 'object' THEN RETURN 'DEFINITION'; END IF;
  IF COALESCE(p_def->>'jurisdiction', '') NOT IN ('federal','state') OR COALESCE(p_def->>'jurisdictionCode', '') !~ '^[A-Z]{2}$'
     OR COALESCE(p_def->>'returnFamily', '') !~ '^[A-Za-z0-9-]{1,16}$' OR jsonb_typeof(p_def->'taxYear') IS DISTINCT FROM 'number'
     OR (p_def->>'taxYear') !~ '^20[0-9]{2}$' OR COALESCE(p_def->>'formId', '') !~ '^[A-Za-z0-9 _.-]{1,40}$'
     OR COALESCE(p_def->>'formVersion', '') !~ '^[A-Za-z0-9_.-]{1,40}$' OR COALESCE(p_def->>'sourceId', '') !~ '^[A-Za-z0-9_.:-]{3,80}$' THEN
    RETURN 'HEADER';
  END IF;
  IF NOT public.taxguard_tax_form_jurisdiction_supported(p_def->>'jurisdiction', p_def->>'jurisdictionCode') THEN RETURN 'JURISDICTION'; END IF;
  -- effectiveFrom is required; effectiveTo is absent, null or a date not before it.
  IF jsonb_typeof(p_def->'effectiveFrom') IS DISTINCT FROM 'string' OR (p_def->>'effectiveFrom') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR (p_def ? 'effectiveTo' AND jsonb_typeof(p_def->'effectiveTo') <> 'null'
         AND (jsonb_typeof(p_def->'effectiveTo') <> 'string' OR (p_def->>'effectiveTo') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) THEN
    RETURN 'EFFECTIVE_DATES';
  END IF;
  BEGIN
    d_from := (p_def->>'effectiveFrom')::date;
    d_to := (p_def->>'effectiveTo')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN 'EFFECTIVE_DATES';
  END;
  IF to_char(d_from, 'YYYY-MM-DD') <> p_def->>'effectiveFrom' OR (d_to IS NOT NULL AND (to_char(d_to, 'YYYY-MM-DD') <> p_def->>'effectiveTo' OR d_to < d_from)) THEN
    RETURN 'EFFECTIVE_DATES';
  END IF;
  IF jsonb_typeof(p_def->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_def->'lines') NOT BETWEEN 1 AND 200 THEN RETURN 'LINES'; END IF;
  FOR l IN SELECT value FROM jsonb_array_elements(p_def->'lines') LOOP
    IF jsonb_typeof(l) <> 'object' OR COALESCE(l->>'schedule', '') !~ '^[A-Za-z0-9 _.-]{1,40}$' OR COALESCE(l->>'line', '') !~ '^[A-Za-z0-9_.-]{1,40}$'
       OR COALESCE(l->>'field', '') !~ '^[A-Za-z0-9_.\[\]-]{1,80}$' OR COALESCE(l->>'valueType', '') NOT IN ('MONEY','INTEGER')
       OR jsonb_typeof(l->'required') IS DISTINCT FROM 'boolean' OR COALESCE(l->>'aggregate', '') NOT IN ('SINGLE','SUM')
       OR jsonb_typeof(l->'source') IS DISTINCT FROM 'object'
       OR COALESCE(l#>>'{source,conclusionType}', '') NOT IN ('INCOME_INCLUSION','DEDUCTION','DEPRECIATION','CREDIT_ELIGIBILITY','FILING_STATUS',
         'ENTITY_CLASSIFICATION','BASIS','CAPITAL_GAIN_LOSS','CARRYFORWARD','STATE_ALLOCATION','BOOK_TO_TAX_ADJUSTMENT','OTHER')
       OR COALESCE(l#>>'{source,value}', '') NOT IN ('AMOUNT','OUTPUT')
       OR ((l#>>'{source,value}') = 'OUTPUT') <> (COALESCE(l#>>'{source,outputKey}', '') ~ '^[a-z][a-z0-9_]{0,63}$')
       OR ((l#>>'{source,value}') = 'AMOUNT' AND l->'source' ? 'outputKey') THEN
      RETURN 'LINE';
    END IF;
    k := concat_ws('|', l->>'schedule', l->>'line', l->>'field');
    IF k = ANY (keys) THEN RETURN 'DUPLICATE_LINE'; END IF;
    keys := keys || k;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_form_rule_json(r public.taxguard_tax_form_rules, p_full boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('ruleId', r.rule_id, 'jurisdiction', r.jurisdiction, 'jurisdictionCode', r.jurisdiction_code, 'returnFamily', r.return_family,
    'effectiveFrom', r.effective_from, 'effectiveTo', r.effective_to, 'taxYear', r.tax_year, 'formId', r.form_id, 'formVersion', r.form_version, 'version', r.version, 'contentSha256', r.content_sha256, 'sourceId', r.source_id,
    'status', r.status, 'preparedBy', r.prepared_by, 'createdAt', r.created_at, 'submittedAt', r.submitted_at, 'reviewedBy', r.reviewed_by,
    'reviewedAt', r.reviewed_at, 'reviewNote', r.review_note, 'lines', jsonb_array_length(r.definition->'lines'))
  || CASE WHEN p_full THEN jsonb_build_object('definition', r.definition) ELSE '{}'::jsonb END $$;

-- A content maintainer drafts a mapping rule; the database validates it, hashes it and versions it per form.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_rule_draft(p_tenant text, p_actor text, p_definition jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE role_ text; r public.taxguard_tax_form_rules; v integer; bad text; sha text;
BEGIN
  role_ := public.taxguard_tax_actor(p_tenant, p_actor, 'maintain');
  bad := public.taxguard_tax_form_rule_invalid(p_definition);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'TAX_FORM_RULE_INPUT_INVALID' USING ERRCODE = 'P0001', DETAIL = bad; END IF;
  sha := encode(sha256(convert_to(p_definition::text, 'UTF8')), 'hex');
  IF EXISTS (SELECT 1 FROM public.taxguard_tax_form_rules WHERE tenant_id = p_tenant AND content_sha256 = sha AND status IN ('DRAFT','PENDING_REVIEW','APPROVED')) THEN
    RAISE EXCEPTION 'TAX_FORM_RULE_DUPLICATE' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(concat_ws('|', 'form-rule', p_tenant, p_definition->>'jurisdiction', p_definition->>'jurisdictionCode',
    p_definition->>'returnFamily', p_definition->>'taxYear', p_definition->>'formId', p_definition->>'formVersion')));
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM public.taxguard_tax_form_rules WHERE tenant_id = p_tenant AND jurisdiction = p_definition->>'jurisdiction'
    AND jurisdiction_code = p_definition->>'jurisdictionCode' AND return_family = p_definition->>'returnFamily' AND tax_year = (p_definition->>'taxYear')::integer
    AND form_id = p_definition->>'formId' AND form_version = p_definition->>'formVersion';
  INSERT INTO public.taxguard_tax_form_rules(tenant_id, jurisdiction, jurisdiction_code, effective_from, effective_to, return_family, tax_year, form_id,
      form_version, version, definition, content_sha256, source_id, prepared_by)
    VALUES (p_tenant, p_definition->>'jurisdiction', p_definition->>'jurisdictionCode', (p_definition->>'effectiveFrom')::date,
      (p_definition->>'effectiveTo')::date, p_definition->>'returnFamily', (p_definition->>'taxYear')::integer,
      p_definition->>'formId', p_definition->>'formVersion', v, p_definition, sha, p_definition->>'sourceId', p_actor) RETURNING * INTO r;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, role_, 'TAX_FORM_RULE_DRAFTED',
    jsonb_build_object('ruleId', r.rule_id, 'formId', r.form_id, 'formVersion', r.form_version, 'version', v, 'sha256', sha));
  RETURN public.taxguard_tax_form_rule_json(r, false);
END $$;

-- submit (maintainer), approve / reject (a reviewer other than the preparer). The cited source must be verified for the
-- rule's tax year; approving supersedes the form's previously approved rule.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_rule_transition(p_tenant text, p_actor text, p_rule uuid, p_action text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE role_ text; r public.taxguard_tax_form_rules; missing text[]; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF p_action NOT IN ('submit','approve','reject') THEN RAISE EXCEPTION 'TAX_FORM_RULE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  role_ := public.taxguard_tax_actor(p_tenant, p_actor, CASE WHEN p_action = 'submit' THEN 'maintain' ELSE 'review' END);
  SELECT * INTO r FROM public.taxguard_tax_form_rules WHERE tenant_id = p_tenant AND rule_id = p_rule FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_FORM_RULE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  missing := public.taxguard_tax_unverified_sources(p_tenant, ARRAY[r.source_id::text], r.tax_year);
  IF p_action = 'submit' THEN
    IF r.status <> 'DRAFT' THEN RAISE EXCEPTION 'TAX_FORM_RULE_NOT_DRAFT' USING ERRCODE = 'P0001'; END IF;
    IF r.prepared_by <> p_actor AND NOT public.taxguard_practice_is_manager(role_) THEN RAISE EXCEPTION 'TAX_CONTENT_ROLE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = array_to_string(missing, ','); END IF;
    UPDATE public.taxguard_tax_form_rules SET status = 'PENDING_REVIEW', submitted_at = now() WHERE tenant_id = p_tenant AND rule_id = p_rule RETURNING * INTO r;
  ELSE
    IF r.status <> 'PENDING_REVIEW' THEN RAISE EXCEPTION 'TAX_FORM_RULE_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;
    IF r.prepared_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'reject' AND length(COALESCE(note, '')) < 10 THEN RAISE EXCEPTION 'TAX_FORM_RULE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'approve' THEN
      IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = array_to_string(missing, ','); END IF;
      UPDATE public.taxguard_tax_form_rules SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND jurisdiction = r.jurisdiction AND jurisdiction_code = r.jurisdiction_code
        AND return_family = r.return_family AND tax_year = r.tax_year AND form_id = r.form_id AND form_version = r.form_version AND status = 'APPROVED';
    END IF;
    UPDATE public.taxguard_tax_form_rules SET status = CASE p_action WHEN 'approve' THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(),
      review_note = note WHERE tenant_id = p_tenant AND rule_id = p_rule RETURNING * INTO r;
  END IF;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, role_, 'TAX_FORM_RULE_' || CASE p_action WHEN 'submit' THEN 'SUBMITTED' WHEN 'approve' THEN 'APPROVED' ELSE 'REJECTED' END,
    jsonb_build_object('ruleId', p_rule, 'version', r.version, 'sha256', r.content_sha256));
  RETURN public.taxguard_tax_form_rule_json(r, false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_form_rule_get(p_tenant text, p_actor text, p_rule uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r public.taxguard_tax_form_rules;
BEGIN
  PERFORM public.taxguard_tax_actor(p_tenant, p_actor, 'read');
  SELECT * INTO r FROM public.taxguard_tax_form_rules WHERE tenant_id = p_tenant AND rule_id = p_rule;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_FORM_RULE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN public.taxguard_tax_form_rule_json(r, true);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_form_rule_list(p_tenant text, p_actor text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_tax_actor(p_tenant, p_actor, 'read');
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_tax_form_rule_json(r, false) ORDER BY r.tax_year DESC, r.form_id, r.form_version, r.version DESC), '[]'::jsonb)
    FROM public.taxguard_tax_form_rules r WHERE r.tenant_id = p_tenant AND (p_tax_year IS NULL OR r.tax_year = p_tax_year));
END $$;

-- The deterministic derivation of a rule for a case: {values, missing, problems}. Pure over durable records; it never
-- writes. values: [{schedule, line, field, valueType, value, sources}] in (schedule, line, field) order; missing:
-- optional lines without a source; problems: [{schedule, line, field, reason, conclusionId?}] for every line that
-- cannot be filled deterministically, including required lines without a source.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_derive(p_case public.taxguard_cases, p_rule public.taxguard_tax_form_rules) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; l jsonb; k public.taxguard_tax_conclusions; run public.taxguard_tax_calc_runs; rs public.taxguard_tax_rule_sets;
  vals jsonb := '[]'::jsonb; missing jsonb := '[]'::jsonb; problems jsonb := '[]'::jsonb; srcs jsonb; total numeric; v numeric; n integer; calc integer;
  run_ref text; raw text; at_ jsonb; bad text;
BEGIN
  FOR l IN SELECT value FROM jsonb_array_elements(p_rule.definition->'lines') ORDER BY value->>'schedule' COLLATE "C", value->>'line' COLLATE "C", value->>'field' COLLATE "C" LOOP
    at_ := jsonb_build_object('schedule', l->>'schedule', 'line', l->>'line', 'field', l->>'field');
    srcs := '[]'::jsonb; total := 0; n := 0; bad := NULL;
    FOR k IN SELECT * FROM public.taxguard_tax_conclusions WHERE tenant_id = c.tenant_id AND case_id = c.case_id AND status = 'APPROVED'
        AND conclusion_type = l#>>'{source,conclusionType}' ORDER BY conclusion_id LOOP
      n := n + 1;
      IF jsonb_array_length(public.taxguard_tax_conclusion_stale(c.tenant_id, k.conclusion_id)) > 0 THEN
        problems := problems || (at_ || jsonb_build_object('reason', 'SOURCE_STALE', 'conclusionId', k.conclusion_id)); bad := 'x'; CONTINUE;
      END IF;
      SELECT count(*), min(ref) INTO calc, run_ref FROM public.taxguard_tax_conclusion_links WHERE tenant_id = c.tenant_id AND conclusion_id = k.conclusion_id AND link_type = 'CALCULATION';
      IF calc <> 1 THEN problems := problems || (at_ || jsonb_build_object('reason', 'CALCULATION_SOURCE_REQUIRED', 'conclusionId', k.conclusion_id)); bad := 'x'; CONTINUE; END IF;
      SELECT * INTO run FROM public.taxguard_tax_calc_runs WHERE tenant_id = c.tenant_id AND case_id = c.case_id AND run_id = run_ref::uuid;
      IF NOT FOUND OR run.status <> 'REVIEW_APPROVED' THEN
        problems := problems || (at_ || jsonb_build_object('reason', 'CALCULATION_NOT_APPROVED', 'conclusionId', k.conclusion_id)); bad := 'x'; CONTINUE;
      END IF;
      SELECT * INTO rs FROM public.taxguard_tax_rule_sets WHERE tenant_id = c.tenant_id AND rule_set_id = run.rule_set_id;
      raw := CASE WHEN l#>>'{source,value}' = 'AMOUNT' THEN k.amount::text ELSE run.outputs->>(l#>>'{source,outputKey}') END;
      IF raw IS NULL OR raw !~ '^-?[0-9]{1,15}(\.[0-9]{1,2})?$' THEN
        problems := problems || (at_ || jsonb_build_object('reason', 'VALUE_MISSING', 'conclusionId', k.conclusion_id)); bad := 'x'; CONTINUE;
      END IF;
      v := raw::numeric;
      IF l->>'valueType' = 'INTEGER' AND v <> trunc(v) THEN
        problems := problems || (at_ || jsonb_build_object('reason', 'VALUE_TYPE', 'conclusionId', k.conclusion_id)); bad := 'x'; CONTINUE;
      END IF;
      total := total + v;
      srcs := srcs || jsonb_build_object('conclusionId', k.conclusion_id, 'conclusionVersion', k.version, 'conclusionType', k.conclusion_type,
        'value', to_char(v, 'FM9999999999999990.00'), 'runId', run.run_id, 'runOutputSha256', run.output_sha256, 'ruleSetId', run.rule_set_id,
        'ruleSetVersion', rs.version, 'ruleSetSha256', run.rule_set_sha256,
        'evidence', (SELECT COALESCE(jsonb_agg(jsonb_build_object('ref', x.ref, 'snapshot', x.snapshot) ORDER BY x.ref COLLATE "C"), '[]'::jsonb)
          FROM public.taxguard_tax_conclusion_links x WHERE x.tenant_id = c.tenant_id AND x.conclusion_id = k.conclusion_id AND x.link_type = 'EVIDENCE'));
    END LOOP;
    IF bad IS NOT NULL THEN CONTINUE; END IF;
    IF n = 0 THEN
      IF (l->>'required')::boolean THEN problems := problems || (at_ || jsonb_build_object('reason', 'SOURCE_MISSING')); ELSE missing := missing || at_; END IF;
    ELSIF n > 1 AND l->>'aggregate' = 'SINGLE' THEN
      problems := problems || (at_ || jsonb_build_object('reason', 'AMBIGUOUS_SOURCE', 'candidates', n));
    ELSE
      vals := vals || (at_ || jsonb_build_object('valueType', l->>'valueType', 'value', to_char(total, 'FM9999999999999990.00'), 'sources', srcs));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('values', vals, 'missing', missing, 'problems', problems);
END $$;

-- The identity of a value set, for idempotency and staleness: line, value and the exact sources (conclusion version, run
-- output, rule set hash and evidence snapshots).
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_values_sha(p_values jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT encode(sha256(convert_to(COALESCE(p_values, '[]'::jsonb)::text, 'UTF8')), 'hex') $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_form_stored(p_tenant text, p_mapping uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('schedule', v.schedule, 'line', v.line, 'field', v.field, 'valueType', v.value_type,
      'value', to_char(v.value, 'FM9999999999999990.00'), 'sources', v.sources) ORDER BY v.schedule COLLATE "C", v.line COLLATE "C", v.field COLLATE "C"), '[]'::jsonb)
  FROM public.taxguard_tax_form_values v WHERE v.tenant_id = p_tenant AND v.mapping_id = p_mapping $$;

-- [{reason, schedule?, line?, field?, conclusionId?}] when the stored mapping no longer equals its derivation.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_mapping_stale(p_tenant text, p_mapping uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE m public.taxguard_tax_form_mappings; r public.taxguard_tax_form_rules; c public.taxguard_cases; d jsonb; stored jsonb; out jsonb := '[]'::jsonb; s jsonb; now_ jsonb;
BEGIN
  SELECT * INTO m FROM public.taxguard_tax_form_mappings WHERE tenant_id = p_tenant AND mapping_id = p_mapping;
  IF m.status = 'SUPERSEDED' THEN RETURN '[]'::jsonb; END IF;
  SELECT * INTO r FROM public.taxguard_tax_form_rules WHERE tenant_id = p_tenant AND rule_id = m.rule_id;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = m.case_id;
  IF r.status <> 'APPROVED' THEN out := out || jsonb_build_object('reason', 'MAPPING_RULE_' || r.status); END IF;
  d := public.taxguard_tax_form_derive(c, r);
  out := out || (d->'problems');
  stored := public.taxguard_tax_form_stored(p_tenant, p_mapping);
  FOR s IN SELECT value FROM jsonb_array_elements(stored) LOOP
    SELECT value INTO now_ FROM jsonb_array_elements(d->'values') x WHERE x.value->>'schedule' = s->>'schedule' AND x.value->>'line' = s->>'line' AND x.value->>'field' = s->>'field';
    IF now_ IS NULL THEN
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d->'problems') p WHERE p.value->>'schedule' = s->>'schedule' AND p.value->>'line' = s->>'line' AND p.value->>'field' = s->>'field') THEN
        out := out || jsonb_build_object('reason', 'SOURCE_WITHDRAWN', 'schedule', s->>'schedule', 'line', s->>'line', 'field', s->>'field');
      END IF;
    ELSIF now_ IS DISTINCT FROM s THEN
      out := out || jsonb_build_object('reason', 'SOURCE_CHANGED', 'schedule', s->>'schedule', 'line', s->>'line', 'field', s->>'field');
    END IF;
    now_ := NULL;
  END LOOP;
  FOR s IN SELECT value FROM jsonb_array_elements(d->'values') LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(stored) x WHERE x.value->>'schedule' = s->>'schedule' AND x.value->>'line' = s->>'line' AND x.value->>'field' = s->>'field') THEN
      out := out || jsonb_build_object('reason', 'SOURCE_ADDED', 'schedule', s->>'schedule', 'line', s->>'line', 'field', s->>'field');
    END IF;
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_form_mapping_json(p_tenant text, p_mapping uuid, p_values boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('mappingId', m.mapping_id, 'caseId', m.case_id, 'clientId', m.client_id, 'taxYear', m.tax_year, 'formId', m.form_id,
    'formVersion', m.form_version, 'version', m.version, 'status', m.status, 'ruleId', m.rule_id, 'ruleVersion', m.rule_version, 'ruleSha256', m.rule_sha256,
    'valuesSha256', m.values_sha256, 'missing', m.missing, 'mappedBy', m.mapped_by, 'createdAt', m.created_at,
    'stale', public.taxguard_tax_form_mapping_stale(m.tenant_id, m.mapping_id), 'returnUse', 'BLOCKED')
  || CASE WHEN p_values THEN jsonb_build_object('values', public.taxguard_tax_form_stored(m.tenant_id, m.mapping_id)) ELSE '{}'::jsonb END
  FROM public.taxguard_tax_form_mappings m WHERE m.tenant_id = p_tenant AND m.mapping_id = p_mapping $$;

-- The case's live preparer maps the case with an approved rule of the case's tax year and return family. Refused with
-- the reasons when any line cannot be filled deterministically. Re-mapping identical values returns the current mapping;
-- otherwise a new mapping version supersedes it.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_map(p_tenant text, p_actor text, p_case text, p_rule uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; r public.taxguard_tax_form_rules; d jsonb; sha text; cur public.taxguard_tax_form_mappings; id uuid := gen_random_uuid();
  v integer; x jsonb; src jsonb;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor); c := a.c;
  IF p_actor IS DISTINCT FROM c.preparer_uid THEN RAISE EXCEPTION 'TAX_FORM_MAPPING_PREPARER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO r FROM public.taxguard_tax_form_rules WHERE tenant_id = p_tenant AND rule_id = p_rule;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_FORM_RULE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF r.status <> 'APPROVED' THEN RAISE EXCEPTION 'TAX_FORM_RULE_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  IF r.tax_year <> c.tax_year OR r.return_family <> c.return_family THEN RAISE EXCEPTION 'TAX_FORM_RULE_SCOPE_MISMATCH' USING ERRCODE = 'P0001'; END IF;
  IF current_date < r.effective_from OR current_date > r.effective_to THEN
    RAISE EXCEPTION 'TAX_FORM_RULE_NOT_EFFECTIVE' USING ERRCODE = 'P0001',
      DETAIL = concat_ws(' to ', r.effective_from::text, COALESCE(r.effective_to::text, 'open'));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(concat_ws('|', 'form-map', p_tenant, c.case_id, r.form_id, r.form_version)));
  d := public.taxguard_tax_form_derive(c, r);
  IF jsonb_array_length(d->'problems') > 0 THEN RAISE EXCEPTION 'TAX_FORM_MAPPING_REFUSED' USING ERRCODE = 'P0001', DETAIL = (d->'problems')::text; END IF;
  IF jsonb_array_length(d->'values') = 0 THEN RAISE EXCEPTION 'TAX_FORM_MAPPING_EMPTY' USING ERRCODE = 'P0001'; END IF;
  sha := public.taxguard_tax_form_values_sha(d->'values');
  SELECT * INTO cur FROM public.taxguard_tax_form_mappings WHERE tenant_id = p_tenant AND case_id = c.case_id AND form_id = r.form_id AND form_version = r.form_version
    AND status = 'CURRENT' FOR UPDATE;
  IF FOUND AND cur.rule_id = r.rule_id AND cur.values_sha256 = sha THEN
    RETURN public.taxguard_tax_form_mapping_json(p_tenant, cur.mapping_id, true) || jsonb_build_object('replayed', true);
  END IF;
  IF FOUND THEN UPDATE public.taxguard_tax_form_mappings SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND mapping_id = cur.mapping_id; END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM public.taxguard_tax_form_mappings WHERE tenant_id = p_tenant AND case_id = c.case_id AND form_id = r.form_id AND form_version = r.form_version;
  INSERT INTO public.taxguard_tax_form_mappings(tenant_id, mapping_id, case_id, client_id, engagement_id, tax_year, form_id, form_version, version, rule_id, rule_version,
      rule_sha256, values_sha256, missing, mapped_by)
    VALUES (p_tenant, id, c.case_id, c.client_id, c.engagement_id, c.tax_year, r.form_id, r.form_version, v, r.rule_id, r.version, r.content_sha256, sha, d->'missing', p_actor);
  FOR x IN SELECT value FROM jsonb_array_elements(d->'values') LOOP
    INSERT INTO public.taxguard_tax_form_values(tenant_id, mapping_id, tax_year, form_id, form_version, schedule, line, field, value_type, value, sources, rule_id, rule_version, rule_sha256)
      VALUES (p_tenant, id, c.tax_year, r.form_id, r.form_version, x->>'schedule', x->>'line', x->>'field', x->>'valueType', (x->>'value')::numeric, x->'sources',
        r.rule_id, r.version, r.content_sha256);
    FOR src IN SELECT value FROM jsonb_array_elements(x->'sources') LOOP
      INSERT INTO public.taxguard_tax_form_line_sources(tenant_id, case_id, form_id, form_version, line, conclusion_id, mapped_by)
        VALUES (p_tenant, c.case_id, r.form_id, r.form_version, left(x->>'line', 40), (src->>'conclusionId')::uuid, p_actor) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, c.case_id, p_actor, a.actor_role, 'TAX_FORM_MAPPED',
    jsonb_build_object('mappingId', id, 'formId', r.form_id, 'formVersion', r.form_version, 'version', v, 'ruleId', r.rule_id, 'ruleVersion', r.version,
      'valuesSha256', sha, 'lines', jsonb_array_length(d->'values'), 'supersedes', cur.mapping_id));
  RETURN public.taxguard_tax_form_mapping_json(p_tenant, id, true);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_form_mapping_list(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_tax_form_mapping_json(p_tenant, m.mapping_id, false) ORDER BY m.form_id, m.form_version, m.version DESC), '[]'::jsonb)
    FROM public.taxguard_tax_form_mappings m WHERE m.tenant_id = p_tenant AND m.case_id = p_case);
END $$;

-- One mapping with its values and their provenance, for an actor of its case; anything else reads as not found.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_mapping_get(p_tenant text, p_actor text, p_mapping uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE m public.taxguard_tax_form_mappings;
BEGIN
  SELECT * INTO m FROM public.taxguard_tax_form_mappings WHERE tenant_id = p_tenant AND mapping_id = p_mapping;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_FORM_MAPPING_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    PERFORM public.taxguard_case_actor(p_tenant, m.case_id, p_actor);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'TAX_FORM_MAPPING_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  RETURN public.taxguard_tax_form_mapping_json(p_tenant, p_mapping, true);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_tax\_form\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_form_rule_draft','taxguard_tax_form_rule_transition','taxguard_tax_form_rule_get','taxguard_tax_form_rule_list',
        'taxguard_tax_form_map','taxguard_tax_form_mapping_list','taxguard_tax_form_mapping_get') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
