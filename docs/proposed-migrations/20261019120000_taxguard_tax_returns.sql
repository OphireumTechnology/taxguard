-- PROPOSAL (Block 68, draft return preparation). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 033 (taxguard_tax_actor, tax sources), 20261018090000 (live case actor), 20261018160000 (case diagnostics),
-- 20261019100000 (tax conclusions) and 20261019110000 (form mapping, taxguard_tax_form_jurisdiction_supported).
--
-- A draft return is an assembly of reviewed inputs, never a calculation and never a model judgement:
--   RETURN TEMPLATE (which forms a return of this jurisdiction, family and year consists of)
--   -> for each form: the case's CURRENT, non-stale form mapping (Block 67)
--   -> RETURN VERSION (forms with mapping id, version and values hash) -> preparer submit -> reviewer approve.
-- A return template is tax content: it cites a verified source, names a supported jurisdiction and the dates it is
-- in effect, is drafted by a content maintainer, approved by a different person (maker-checker), frozen once
-- submitted, and a newer approval supersedes it. Only a designated template approver may approve: the tenant's
-- owner-approved eligibility policy plus an active designation (verified qualification or explicit administrative
-- designation), configured by reviewed database change only. A case assignment or reviewer role alone confers
-- nothing; with nothing configured, template approval fails closed.
--
-- Preparing is refused, with the reasons and nothing written, when a required form has no current mapping, a
-- mapping is stale or its rule no longer approved, the case has blocking diagnostics, or the template is not
-- approved, in effect or in scope. A version never changes after it is written except its status
-- (DRAFT -> SUBMITTED -> APPROVED / RETURNED, any -> SUPERSEDED when a newer version is prepared). Staleness is
-- derived on read by re-deriving the forms: a superseded or stale mapping, a new mapping, a superseded template or
-- new blocking diagnostics make the version STALE; a stale version cannot be submitted or approved.
-- Approval here is the independent Stage 09 draft review by the case's live reviewer (not the preparer). Final
-- professional authorization stays at Stage 10. returnUse stays BLOCKED: nothing here is filed or signed.
-- Access: templates follow the tax-content roles (taxguard_tax_actor); returns follow the live case actor. Clients
-- have none. Rollback (development): drop the functions and the two tables.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_return_templates (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  template_rule_id UUID NOT NULL DEFAULT gen_random_uuid(),
  template_id VARCHAR(40) NOT NULL CHECK (template_id ~ '^[A-Za-z0-9 _.-]{1,40}$'),
  jurisdiction VARCHAR(8) NOT NULL CHECK (jurisdiction IN ('federal','state')),
  jurisdiction_code CHAR(2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  return_family VARCHAR(16) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
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
  -- On approval: who approved, on what basis (designation, policy version) and the source verification relied on.
  approval_basis JSONB CHECK (approval_basis IS NULL OR jsonb_typeof(approval_basis) = 'object'),
  PRIMARY KEY (tenant_id, template_rule_id),
  CHECK ((status IN ('APPROVED','SUPERSEDED') AND reviewed_by IS NOT NULL) = (approval_basis IS NOT NULL)),
  UNIQUE (tenant_id, template_id, jurisdiction, jurisdiction_code, return_family, tax_year, version),
  CHECK (reviewed_by IS NULL OR reviewed_by <> prepared_by),
  CHECK (public.taxguard_tax_form_jurisdiction_supported(jurisdiction, jurisdiction_code)),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_return_versions (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  return_version_id UUID NOT NULL DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  template_id VARCHAR(40) NOT NULL,
  version INTEGER NOT NULL CHECK (version BETWEEN 1 AND 10000),
  template_rule_id UUID NOT NULL,
  template_version INTEGER NOT NULL,
  template_sha256 CHAR(64) NOT NULL,
  forms JSONB NOT NULL CHECK (jsonb_typeof(forms) = 'array' AND jsonb_array_length(forms) >= 1),
  forms_sha256 CHAR(64) NOT NULL CHECK (forms_sha256 ~ '^[a-f0-9]{64}$'),
  missing JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(missing) = 'array'),
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','RETURNED','SUPERSEDED')),
  prepared_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_by VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  review_note VARCHAR(1000),
  PRIMARY KEY (tenant_id, return_version_id),
  UNIQUE (tenant_id, case_id, template_id, version),
  FOREIGN KEY (tenant_id, template_rule_id) REFERENCES public.taxguard_tax_return_templates(tenant_id, template_rule_id),
  CHECK (reviewed_by IS NULL OR reviewed_by <> prepared_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxguard_tax_return_versions_open ON public.taxguard_tax_return_versions(tenant_id, case_id, template_id)
  WHERE status <> 'SUPERSEDED';

-- Who may approve return templates. Approving a template is a professional act, not a case role: a case reviewer
-- assignment, a reviewer or administrator role alone confers nothing. Approval requires (1) the owner-approved
-- professional eligibility policy for the tenant and (2) an active designation of the approver under it, based on a
-- verified qualification or an explicit administrative designation. No RPC writes either table: both are configured
-- only by a reviewed, owner-approved database change. With neither configured, template approval fails closed.
CREATE TABLE IF NOT EXISTS public.taxguard_tax_template_approval_policy (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  policy_version INTEGER NOT NULL CHECK (policy_version BETWEEN 1 AND 1000),
  eligibility VARCHAR(2000) NOT NULL CHECK (length(btrim(eligibility)) >= 20),
  approved_by VARCHAR(128) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, policy_version)
);
CREATE TABLE IF NOT EXISTS public.taxguard_tax_template_approvers (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  designation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  approver_uid VARCHAR(128) NOT NULL,
  policy_version INTEGER NOT NULL,
  basis VARCHAR(32) NOT NULL CHECK (basis IN ('VERIFIED_QUALIFICATION','ADMINISTRATIVE_DESIGNATION')),
  -- The qualification or designation record relied on (credential reference or designation decision), never a secret.
  basis_reference VARCHAR(300) NOT NULL CHECK (length(btrim(basis_reference)) >= 5),
  designated_by VARCHAR(128) NOT NULL,
  designated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by VARCHAR(128),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, designation_id),
  FOREIGN KEY (tenant_id, policy_version) REFERENCES public.taxguard_tax_template_approval_policy(tenant_id, policy_version),
  CHECK (designated_by <> approver_uid),
  CHECK ((revoked_by IS NULL) = (revoked_at IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxguard_tax_template_approvers_active ON public.taxguard_tax_template_approvers(tenant_id, approver_uid)
  WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.taxguard_tax_template_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') OR TG_TABLE_NAME = 'taxguard_tax_template_approval_policy' THEN
    RAISE EXCEPTION 'TAX_TEMPLATE_APPROVAL_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  -- A designation only ever gains its revocation.
  IF OLD.revoked_at IS NOT NULL OR (to_jsonb(NEW) - ARRAY['revoked_by','revoked_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['revoked_by','revoked_at']) THEN
    RAISE EXCEPTION 'TAX_TEMPLATE_APPROVAL_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_tax_template_approval_policy','taxguard_tax_template_approvers'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_template_approval_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_truncate ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_template_approval_guard()', t, t);
  END LOOP;
END $$;
ALTER TABLE public.taxguard_tax_template_approval_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_template_approvers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_template_approval_policy, public.taxguard_tax_template_approvers FROM PUBLIC, anon, authenticated, service_role;

-- The actor's current authority to approve templates, or NULL: the tenant's latest approved eligibility policy and an
-- active designation under that policy version.
CREATE OR REPLACE FUNCTION public.taxguard_tax_template_approver(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('approverUid', a.approver_uid, 'designationId', a.designation_id, 'basis', a.basis, 'basisReference', a.basis_reference,
      'designatedBy', a.designated_by, 'designatedAt', a.designated_at, 'policyVersion', a.policy_version)
  FROM public.taxguard_tax_template_approvers a
  WHERE a.tenant_id = p_tenant AND a.approver_uid = p_actor AND a.revoked_at IS NULL
    AND a.policy_version = (SELECT max(p.policy_version) FROM public.taxguard_tax_template_approval_policy p WHERE p.tenant_id = p_tenant) $$;

ALTER TABLE public.taxguard_tax_return_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_return_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_return_templates, public.taxguard_tax_return_versions FROM PUBLIC, anon, authenticated, service_role;

-- A submitted template's content never changes; a version's content never changes and its status only moves forward.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'TAX_RETURN_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF TG_TABLE_NAME = 'taxguard_tax_return_templates' THEN
    IF (NEW.tenant_id, NEW.template_rule_id, NEW.template_id, NEW.jurisdiction, NEW.jurisdiction_code, NEW.effective_from, NEW.effective_to,
        NEW.return_family, NEW.tax_year, NEW.version, NEW.prepared_by, NEW.created_at) IS DISTINCT FROM (OLD.tenant_id, OLD.template_rule_id,
        OLD.template_id, OLD.jurisdiction, OLD.jurisdiction_code, OLD.effective_from, OLD.effective_to, OLD.return_family, OLD.tax_year, OLD.version,
        OLD.prepared_by, OLD.created_at)
       OR (OLD.status <> 'DRAFT' AND (NEW.definition, NEW.content_sha256, NEW.source_id) IS DISTINCT FROM (OLD.definition, OLD.content_sha256, OLD.source_id))
       OR (OLD.approval_basis IS NOT NULL AND NEW.approval_basis IS DISTINCT FROM OLD.approval_basis) THEN
      RAISE EXCEPTION 'TAX_RETURN_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF (to_jsonb(NEW) - ARRAY['status','submitted_at','reviewed_by','reviewed_at','review_note'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','submitted_at','reviewed_by','reviewed_at','review_note'])
       OR NOT ((OLD.status = 'DRAFT' AND NEW.status IN ('SUBMITTED','SUPERSEDED'))
            OR (OLD.status = 'SUBMITTED' AND NEW.status IN ('APPROVED','RETURNED','SUPERSEDED'))
            OR (OLD.status IN ('APPROVED','RETURNED') AND NEW.status = 'SUPERSEDED'))
       OR (OLD.submitted_at IS NOT NULL AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at)
       OR (OLD.reviewed_by IS NOT NULL AND (NEW.reviewed_by, NEW.reviewed_at, NEW.review_note) IS DISTINCT FROM (OLD.reviewed_by, OLD.reviewed_at, OLD.review_note)) THEN
      RAISE EXCEPTION 'TAX_RETURN_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_tax_return_templates','taxguard_tax_return_versions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_return_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_truncate ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_return_guard()', t, t);
  END LOOP;
END $$;

-- NULL when the template definition is well formed, otherwise the reason.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_template_invalid(p_def jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE f jsonb; keys text[] := '{}'; k text; d_from date; d_to date;
BEGIN
  IF p_def IS NULL OR jsonb_typeof(p_def) <> 'object' THEN RETURN 'DEFINITION'; END IF;
  IF COALESCE(p_def->>'templateId', '') !~ '^[A-Za-z0-9 _.-]{1,40}$' OR COALESCE(p_def->>'jurisdiction', '') NOT IN ('federal','state')
     OR COALESCE(p_def->>'jurisdictionCode', '') !~ '^[A-Z]{2}$' OR COALESCE(p_def->>'returnFamily', '') !~ '^[A-Za-z0-9-]{1,16}$'
     OR jsonb_typeof(p_def->'taxYear') IS DISTINCT FROM 'number' OR (p_def->>'taxYear') !~ '^20[0-9]{2}$'
     OR COALESCE(p_def->>'sourceId', '') !~ '^[A-Za-z0-9_.:-]{3,80}$' THEN
    RETURN 'HEADER';
  END IF;
  IF NOT public.taxguard_tax_form_jurisdiction_supported(p_def->>'jurisdiction', p_def->>'jurisdictionCode') THEN RETURN 'JURISDICTION'; END IF;
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
  IF jsonb_typeof(p_def->'forms') IS DISTINCT FROM 'array' OR jsonb_array_length(p_def->'forms') NOT BETWEEN 1 AND 100 THEN RETURN 'FORMS'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p_def->'forms') LOOP
    IF jsonb_typeof(f) <> 'object' OR COALESCE(f->>'formId', '') !~ '^[A-Za-z0-9 _.-]{1,40}$' OR COALESCE(f->>'formVersion', '') !~ '^[A-Za-z0-9_.-]{1,40}$'
       OR jsonb_typeof(f->'required') IS DISTINCT FROM 'boolean' OR (SELECT count(*) FROM jsonb_object_keys(f)) <> 3 THEN
      RETURN 'FORM';
    END IF;
    k := concat_ws('|', f->>'formId', f->>'formVersion');
    IF k = ANY (keys) THEN RETURN 'DUPLICATE_FORM'; END IF;
    keys := keys || k;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_def->'forms') x WHERE (x.value->>'required')::boolean) THEN RETURN 'NO_REQUIRED_FORM'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_template_json(r public.taxguard_tax_return_templates, p_full boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('templateRuleId', r.template_rule_id, 'templateId', r.template_id, 'jurisdiction', r.jurisdiction,
    'jurisdictionCode', r.jurisdiction_code, 'effectiveFrom', r.effective_from, 'effectiveTo', r.effective_to, 'returnFamily', r.return_family,
    'taxYear', r.tax_year, 'version', r.version, 'contentSha256', r.content_sha256, 'sourceId', r.source_id, 'status', r.status,
    'preparedBy', r.prepared_by, 'createdAt', r.created_at, 'submittedAt', r.submitted_at, 'reviewedBy', r.reviewed_by, 'reviewedAt', r.reviewed_at,
    'reviewNote', r.review_note, 'approvalBasis', r.approval_basis, 'forms', jsonb_array_length(r.definition->'forms'))
  || CASE WHEN p_full THEN jsonb_build_object('definition', r.definition) ELSE '{}'::jsonb END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_template_draft(p_tenant text, p_actor text, p_definition jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE role_ text; r public.taxguard_tax_return_templates; v integer; bad text; sha text;
BEGIN
  role_ := public.taxguard_tax_actor(p_tenant, p_actor, 'maintain');
  bad := public.taxguard_tax_return_template_invalid(p_definition);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_INPUT_INVALID' USING ERRCODE = 'P0001', DETAIL = bad; END IF;
  sha := encode(sha256(convert_to(p_definition::text, 'UTF8')), 'hex');
  IF EXISTS (SELECT 1 FROM public.taxguard_tax_return_templates WHERE tenant_id = p_tenant AND content_sha256 = sha AND status IN ('DRAFT','PENDING_REVIEW','APPROVED')) THEN
    RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_DUPLICATE' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(concat_ws('|', 'return-template', p_tenant, p_definition->>'templateId', p_definition->>'jurisdiction',
    p_definition->>'jurisdictionCode', p_definition->>'returnFamily', p_definition->>'taxYear')));
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM public.taxguard_tax_return_templates WHERE tenant_id = p_tenant AND template_id = p_definition->>'templateId'
    AND jurisdiction = p_definition->>'jurisdiction' AND jurisdiction_code = p_definition->>'jurisdictionCode'
    AND return_family = p_definition->>'returnFamily' AND tax_year = (p_definition->>'taxYear')::integer;
  INSERT INTO public.taxguard_tax_return_templates(tenant_id, template_id, jurisdiction, jurisdiction_code, effective_from, effective_to, return_family,
      tax_year, version, definition, content_sha256, source_id, prepared_by)
    VALUES (p_tenant, p_definition->>'templateId', p_definition->>'jurisdiction', p_definition->>'jurisdictionCode', (p_definition->>'effectiveFrom')::date,
      (p_definition->>'effectiveTo')::date, p_definition->>'returnFamily', (p_definition->>'taxYear')::integer, v, p_definition, sha,
      p_definition->>'sourceId', p_actor) RETURNING * INTO r;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, role_, 'TAX_RETURN_TEMPLATE_DRAFTED',
    jsonb_build_object('templateRuleId', r.template_rule_id, 'templateId', r.template_id, 'version', v, 'sha256', sha));
  RETURN public.taxguard_tax_return_template_json(r, false);
END $$;

-- submit (maintainer), approve / reject (a content reviewer other than the preparer). Approving also requires a designated
-- template approver under the tenant's approved eligibility policy (taxguard_tax_template_approver); with none it
-- fails closed. The cited source must be verified for the template's tax year; the approval records its basis, and
-- approving supersedes the previously approved template of the same family. Rejecting grants nothing and needs a note.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_template_transition(p_tenant text, p_actor text, p_template uuid, p_action text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE role_ text; r public.taxguard_tax_return_templates; missing text[]; note text := NULLIF(btrim(COALESCE(p_note, '')), ''); basis jsonb;
BEGIN
  IF p_action NOT IN ('submit','approve','reject') THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  role_ := public.taxguard_tax_actor(p_tenant, p_actor, CASE WHEN p_action = 'submit' THEN 'maintain' ELSE 'review' END);
  SELECT * INTO r FROM public.taxguard_tax_return_templates WHERE tenant_id = p_tenant AND template_rule_id = p_template FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  missing := public.taxguard_tax_unverified_sources(p_tenant, ARRAY[r.source_id::text], r.tax_year);
  IF p_action = 'submit' THEN
    IF r.status <> 'DRAFT' THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_NOT_DRAFT' USING ERRCODE = 'P0001'; END IF;
    IF r.prepared_by <> p_actor AND NOT public.taxguard_practice_is_manager(role_) THEN RAISE EXCEPTION 'TAX_CONTENT_ROLE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = array_to_string(missing, ','); END IF;
    UPDATE public.taxguard_tax_return_templates SET status = 'PENDING_REVIEW', submitted_at = now()
      WHERE tenant_id = p_tenant AND template_rule_id = p_template RETURNING * INTO r;
  ELSE
    IF r.status <> 'PENDING_REVIEW' THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;
    IF r.prepared_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'reject' AND length(COALESCE(note, '')) < 10 THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'approve' THEN
      basis := public.taxguard_tax_template_approver(p_tenant, p_actor);
      IF basis IS NULL THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_APPROVER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
      IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = array_to_string(missing, ','); END IF;
      basis := basis || jsonb_build_object('templateVersion', r.version, 'contentSha256', r.content_sha256, 'sourceId', r.source_id,
        'sourceVerifiedForTaxYear', r.tax_year, 'approvedAt', now());
      UPDATE public.taxguard_tax_return_templates SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND template_id = r.template_id
        AND jurisdiction = r.jurisdiction AND jurisdiction_code = r.jurisdiction_code AND return_family = r.return_family AND tax_year = r.tax_year
        AND status = 'APPROVED';
    END IF;
    UPDATE public.taxguard_tax_return_templates SET status = CASE p_action WHEN 'approve' THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor,
      reviewed_at = now(), review_note = note, approval_basis = basis WHERE tenant_id = p_tenant AND template_rule_id = p_template RETURNING * INTO r;
  END IF;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, role_, 'TAX_RETURN_TEMPLATE_' || CASE p_action WHEN 'submit' THEN 'SUBMITTED' WHEN 'approve' THEN 'APPROVED' ELSE 'REJECTED' END,
    jsonb_build_object('templateRuleId', p_template, 'version', r.version, 'sha256', r.content_sha256)
    || CASE WHEN basis IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('approvalBasis', basis) END);
  RETURN public.taxguard_tax_return_template_json(r, false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_template_get(p_tenant text, p_actor text, p_template uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r public.taxguard_tax_return_templates;
BEGIN
  PERFORM public.taxguard_tax_actor(p_tenant, p_actor, 'read');
  SELECT * INTO r FROM public.taxguard_tax_return_templates WHERE tenant_id = p_tenant AND template_rule_id = p_template;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN public.taxguard_tax_return_template_json(r, true);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_template_list(p_tenant text, p_actor text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_tax_actor(p_tenant, p_actor, 'read');
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_tax_return_template_json(r, false) ORDER BY r.tax_year DESC, r.template_id, r.version DESC), '[]'::jsonb)
    FROM public.taxguard_tax_return_templates r WHERE r.tenant_id = p_tenant AND (p_tax_year IS NULL OR r.tax_year = p_tax_year));
END $$;

-- The deterministic assembly of a template for a case: {forms, missing, problems}. Pure over durable records; it never
-- writes. forms: [{formId, formVersion, mappingId, mappingVersion, valuesSha256}] in template order; missing: optional
-- forms without a current mapping; problems: [{reason, formId?, formVersion?, mappingId?, blocking?}].
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_derive(p_case public.taxguard_cases, p_template public.taxguard_tax_return_templates) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; f jsonb; m public.taxguard_tax_form_mappings; mr public.taxguard_tax_form_rules; at_ jsonb;
  forms jsonb := '[]'::jsonb; missing jsonb := '[]'::jsonb; problems jsonb := '[]'::jsonb; gate jsonb;
BEGIN
  FOR f IN SELECT value FROM jsonb_array_elements(p_template.definition->'forms') LOOP
    at_ := jsonb_build_object('formId', f->>'formId', 'formVersion', f->>'formVersion');
    SELECT * INTO m FROM public.taxguard_tax_form_mappings WHERE tenant_id = c.tenant_id AND case_id = c.case_id AND form_id = f->>'formId'
      AND form_version = f->>'formVersion' AND status = 'CURRENT';
    IF NOT FOUND THEN
      IF (f->>'required')::boolean THEN problems := problems || (at_ || jsonb_build_object('reason', 'RETURN_FORM_MISSING'));
      ELSE missing := missing || at_; END IF;
      CONTINUE;
    END IF;
    SELECT * INTO mr FROM public.taxguard_tax_form_rules WHERE tenant_id = c.tenant_id AND rule_id = m.rule_id;
    IF mr.status <> 'APPROVED' THEN
      problems := problems || (at_ || jsonb_build_object('reason', 'RETURN_MAPPING_RULE_NOT_APPROVED', 'mappingId', m.mapping_id));
    ELSIF jsonb_array_length(public.taxguard_tax_form_mapping_stale(c.tenant_id, m.mapping_id)) > 0 THEN
      problems := problems || (at_ || jsonb_build_object('reason', 'RETURN_MAPPING_STALE', 'mappingId', m.mapping_id));
    ELSE
      forms := forms || (at_ || jsonb_build_object('mappingId', m.mapping_id, 'mappingVersion', m.version, 'valuesSha256', m.values_sha256));
    END IF;
  END LOOP;
  gate := public.taxguard_case_diagnostics_gate(c.tenant_id, c.case_id);
  IF COALESCE((gate->>'blocking')::integer, 0) > 0 THEN
    problems := problems || jsonb_build_object('reason', 'RETURN_BLOCKING_DIAGNOSTICS', 'blocking', (gate->>'blocking')::integer);
  END IF;
  RETURN jsonb_build_object('forms', forms, 'missing', missing, 'problems', problems);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_forms_sha(p_forms jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT encode(sha256(convert_to(COALESCE(p_forms, '[]'::jsonb)::text, 'UTF8')), 'hex') $$;

-- [{reason, formId?, formVersion?, mappingId?}] when a non-superseded version no longer equals its derivation.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_stale(p_tenant text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v public.taxguard_tax_return_versions; t public.taxguard_tax_return_templates; c public.taxguard_cases; d jsonb; out jsonb := '[]'::jsonb;
  s jsonb; now_ jsonb;
BEGIN
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version;
  IF NOT FOUND OR v.status = 'SUPERSEDED' THEN RETURN '[]'::jsonb; END IF;
  SELECT * INTO t FROM public.taxguard_tax_return_templates WHERE tenant_id = p_tenant AND template_rule_id = v.template_rule_id;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = v.case_id;
  IF t.status <> 'APPROVED' THEN out := out || jsonb_build_object('reason', 'RETURN_TEMPLATE_' || t.status); END IF;
  d := public.taxguard_tax_return_derive(c, t);
  out := out || (d->'problems');
  FOR s IN SELECT value FROM jsonb_array_elements(v.forms) LOOP
    SELECT value INTO now_ FROM jsonb_array_elements(d->'forms') x WHERE x.value->>'formId' = s->>'formId' AND x.value->>'formVersion' = s->>'formVersion';
    IF now_ IS NULL THEN
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d->'problems') p WHERE p.value->>'formId' = s->>'formId' AND p.value->>'formVersion' = s->>'formVersion') THEN
        out := out || jsonb_build_object('reason', 'RETURN_FORM_WITHDRAWN', 'formId', s->>'formId', 'formVersion', s->>'formVersion');
      END IF;
    ELSIF now_ IS DISTINCT FROM s THEN
      out := out || jsonb_build_object('reason', 'RETURN_MAPPING_CHANGED', 'formId', s->>'formId', 'formVersion', s->>'formVersion');
    END IF;
    now_ := NULL;
  END LOOP;
  FOR s IN SELECT value FROM jsonb_array_elements(d->'forms') LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v.forms) x WHERE x.value->>'formId' = s->>'formId' AND x.value->>'formVersion' = s->>'formVersion') THEN
      out := out || jsonb_build_object('reason', 'RETURN_FORM_ADDED', 'formId', s->>'formId', 'formVersion', s->>'formVersion');
    END IF;
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_json(p_tenant text, p_version uuid, p_lineage boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('returnVersionId', v.return_version_id, 'caseId', v.case_id, 'clientId', v.client_id, 'taxYear', v.tax_year,
    'templateId', v.template_id, 'version', v.version, 'status', v.status, 'templateRuleId', v.template_rule_id, 'templateVersion', v.template_version,
    'templateSha256', v.template_sha256, 'forms', v.forms, 'formsSha256', v.forms_sha256, 'missing', v.missing, 'preparedBy', v.prepared_by,
    'createdAt', v.created_at, 'submittedAt', v.submitted_at, 'reviewedBy', v.reviewed_by, 'reviewedAt', v.reviewed_at, 'reviewNote', v.review_note,
    'stale', public.taxguard_tax_return_stale(v.tenant_id, v.return_version_id), 'returnUse', 'BLOCKED')
  || CASE WHEN p_lineage THEN jsonb_build_object('lineage', (SELECT COALESCE(jsonb_agg(public.taxguard_tax_form_mapping_json(v.tenant_id, (f.value->>'mappingId')::uuid, true)
       ORDER BY f.ordinality), '[]'::jsonb) FROM jsonb_array_elements(v.forms) WITH ORDINALITY f)) ELSE '{}'::jsonb END
  FROM public.taxguard_tax_return_versions v WHERE v.tenant_id = p_tenant AND v.return_version_id = p_version $$;

-- The case's live preparer prepares a draft return from an approved, in-effect template of the case's tax year and
-- return family. Refused with the reasons when any required form cannot be assembled from a current mapping.
-- Preparing identical forms again returns the open version; otherwise a new version supersedes it.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_prepare(p_tenant text, p_actor text, p_case text, p_template uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; t public.taxguard_tax_return_templates; d jsonb; sha text; cur public.taxguard_tax_return_versions;
  id uuid := gen_random_uuid(); v integer;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor); c := a.c;
  IF p_actor IS DISTINCT FROM c.preparer_uid THEN RAISE EXCEPTION 'TAX_RETURN_PREPARER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO t FROM public.taxguard_tax_return_templates WHERE tenant_id = p_tenant AND template_rule_id = p_template;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF t.status <> 'APPROVED' THEN RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  IF t.tax_year <> c.tax_year OR t.return_family <> c.return_family THEN RAISE EXCEPTION 'TAX_RETURN_SCOPE_MISMATCH' USING ERRCODE = 'P0001'; END IF;
  IF current_date < t.effective_from OR current_date > t.effective_to THEN
    RAISE EXCEPTION 'TAX_RETURN_TEMPLATE_NOT_EFFECTIVE' USING ERRCODE = 'P0001',
      DETAIL = concat_ws(' to ', t.effective_from::text, COALESCE(t.effective_to::text, 'open'));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(concat_ws('|', 'return-prepare', p_tenant, c.case_id, t.template_id)));
  d := public.taxguard_tax_return_derive(c, t);
  IF jsonb_array_length(d->'problems') > 0 THEN RAISE EXCEPTION 'TAX_RETURN_PREPARATION_REFUSED' USING ERRCODE = 'P0001', DETAIL = (d->'problems')::text; END IF;
  sha := public.taxguard_tax_return_forms_sha(d->'forms');
  SELECT * INTO cur FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND case_id = c.case_id AND template_id = t.template_id
    AND status <> 'SUPERSEDED' FOR UPDATE;
  IF FOUND AND cur.template_rule_id = t.template_rule_id AND cur.forms_sha256 = sha AND cur.status <> 'RETURNED' THEN
    RETURN public.taxguard_tax_return_json(p_tenant, cur.return_version_id, false) || jsonb_build_object('replayed', true);
  END IF;
  IF FOUND THEN UPDATE public.taxguard_tax_return_versions SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND return_version_id = cur.return_version_id; END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND case_id = c.case_id AND template_id = t.template_id;
  INSERT INTO public.taxguard_tax_return_versions(tenant_id, return_version_id, case_id, client_id, engagement_id, tax_year, template_id, version,
      template_rule_id, template_version, template_sha256, forms, forms_sha256, missing, prepared_by)
    VALUES (p_tenant, id, c.case_id, c.client_id, c.engagement_id, c.tax_year, t.template_id, v, t.template_rule_id, t.version, t.content_sha256,
      d->'forms', sha, d->'missing', p_actor);
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, c.case_id, p_actor, a.actor_role, 'TAX_RETURN_PREPARED',
    jsonb_build_object('returnVersionId', id, 'templateId', t.template_id, 'version', v, 'templateRuleId', t.template_rule_id,
      'templateVersion', t.version, 'formsSha256', sha, 'forms', jsonb_array_length(d->'forms'), 'supersedes', cur.return_version_id));
  RETURN public.taxguard_tax_return_json(p_tenant, id, false);
END $$;

-- submit (the case's preparer), approve / return (the case's live reviewer, never the preparer). A stale version can
-- be neither submitted nor approved; returning needs a note.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_transition(p_tenant text, p_actor text, p_version uuid, p_action text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; v public.taxguard_tax_return_versions; stale jsonb; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF p_action NOT IN ('submit','approve','return') THEN RAISE EXCEPTION 'TAX_RETURN_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, v.case_id, p_actor);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  c := a.c;
  stale := public.taxguard_tax_return_stale(p_tenant, p_version);
  IF p_action = 'submit' THEN
    IF p_actor IS DISTINCT FROM c.preparer_uid THEN RAISE EXCEPTION 'TAX_RETURN_PREPARER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF v.status <> 'DRAFT' THEN RAISE EXCEPTION 'TAX_RETURN_NOT_DRAFT' USING ERRCODE = 'P0001'; END IF;
    IF jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_RETURN_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
    UPDATE public.taxguard_tax_return_versions SET status = 'SUBMITTED', submitted_at = now() WHERE tenant_id = p_tenant AND return_version_id = p_version RETURNING * INTO v;
  ELSE
    IF p_actor IS DISTINCT FROM c.reviewer_uid OR NOT public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor) THEN
      RAISE EXCEPTION 'TAX_RETURN_REVIEWER_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF p_actor = v.prepared_by THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
    IF v.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'TAX_RETURN_NOT_SUBMITTED' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'return' AND length(COALESCE(note, '')) < 10 THEN RAISE EXCEPTION 'TAX_RETURN_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'approve' AND jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_RETURN_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
    UPDATE public.taxguard_tax_return_versions SET status = CASE p_action WHEN 'approve' THEN 'APPROVED' ELSE 'RETURNED' END, reviewed_by = p_actor,
      reviewed_at = now(), review_note = note WHERE tenant_id = p_tenant AND return_version_id = p_version RETURNING * INTO v;
  END IF;
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, c.case_id, p_actor, a.actor_role,
    'TAX_RETURN_' || CASE p_action WHEN 'submit' THEN 'SUBMITTED' WHEN 'approve' THEN 'APPROVED' ELSE 'RETURNED' END,
    jsonb_build_object('returnVersionId', p_version, 'templateId', v.template_id, 'version', v.version, 'formsSha256', v.forms_sha256));
  RETURN public.taxguard_tax_return_json(p_tenant, p_version, false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_list(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_tax_return_json(p_tenant, v.return_version_id, false) ORDER BY v.template_id, v.version DESC), '[]'::jsonb)
    FROM public.taxguard_tax_return_versions v WHERE v.tenant_id = p_tenant AND v.case_id = p_case);
END $$;

-- One return version with its lineage, for an actor of its case; anything else reads as not found.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_get(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v public.taxguard_tax_return_versions;
BEGIN
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    PERFORM public.taxguard_case_actor(p_tenant, v.case_id, p_actor);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  RETURN public.taxguard_tax_return_json(p_tenant, p_version, true);
END $$;

-- The Stage 09 facts this block can establish from durable records, for an actor of the case. draftReturnGenerated:
-- at least one version is APPROVED and not stale, and no template of the case has an open version that is not;
-- preparerReviewComplete: those versions were submitted by the preparer and approved by a different reviewer;
-- provenanceComplete: every referenced mapping value has at least one source (Block 67 CHECK).
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_stage_facts(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; open_ integer; good integer;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  SELECT count(*), count(*) FILTER (WHERE status = 'APPROVED' AND jsonb_array_length(public.taxguard_tax_return_stale(p_tenant, return_version_id)) = 0
      AND submitted_at IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_by <> prepared_by)
    INTO open_, good FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND case_id = p_case AND status <> 'SUPERSEDED';
  RETURN jsonb_build_object('draftReturnGenerated', open_ > 0 AND good = open_, 'preparerReviewComplete', open_ > 0 AND good = open_,
    'provenanceComplete', open_ > 0 AND NOT EXISTS (SELECT 1 FROM public.taxguard_tax_return_versions v, jsonb_array_elements(v.forms) f,
      public.taxguard_tax_form_values fv WHERE v.tenant_id = p_tenant AND v.case_id = p_case AND v.status <> 'SUPERSEDED' AND fv.tenant_id = v.tenant_id
      AND fv.mapping_id = (f.value->>'mappingId')::uuid AND jsonb_array_length(fv.sources) = 0),
    'openReturns', open_, 'approvedCurrentReturns', good, 'returnUse', 'BLOCKED');
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND (p.proname LIKE 'taxguard\_tax\_return\_%' OR p.proname LIKE 'taxguard\_tax\_template\_%') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_return_template_draft','taxguard_tax_return_template_transition','taxguard_tax_return_template_get',
        'taxguard_tax_return_template_list','taxguard_tax_return_prepare','taxguard_tax_return_transition','taxguard_tax_return_list',
        'taxguard_tax_return_get','taxguard_tax_return_stage_facts') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
