-- PROPOSAL (approval authority for tax-content and return decisions). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 033 (taxguard_tax_actor) and 20261019110000 (taxguard_tax_form_jurisdiction_supported).
--
-- Three separate facts, never inferred from a role or from one another:
--   1. Verified professional eligibility: a credential (CPA, EA, attorney) of one person, verified by someone else,
--      with its reference, issuing jurisdiction, the jurisdictions it may be relied on for, validity dates and an
--      optional revocation.
--   2. Function designation: an explicit decision that one person may perform one approval function, made by someone
--      else under a specific policy version, with an optional revocation.
--   3. Case-specific reviewer authorization: the person's live reviewer assignment on the case (checked by the caller
--      for case decisions; templates and mapping rules are not case decisions).
-- An owner-approved, versioned policy per function states which of the three are required and which credential types
-- are accepted. Approval is refused, with the missing element as the reason, unless every required element is present
-- and current under the latest policy version. With no policy, nothing is approved (fail closed).
--
-- No RPC writes these tables. Policies, eligibility records and designations are recorded only by a reviewed,
-- owner-approved database change until a dedicated maker-checker administration workflow is approved. History is
-- immutable: eligibility and designations only ever gain a revocation; policies change by a new version. Nobody is
-- authorized by this proposal: existing administrators, preparers, reviewers and users receive nothing.
-- Rollback (development): drop the function and the three tables.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_approval_policies (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  function_code VARCHAR(32) NOT NULL CHECK (function_code IN ('RETURN_TEMPLATE_APPROVAL','FORM_RULE_APPROVAL','RETURN_DRAFT_REVIEW','RETURN_QC_REVIEW')),
  policy_version INTEGER NOT NULL CHECK (policy_version BETWEEN 1 AND 1000),
  requires_eligibility BOOLEAN NOT NULL,
  requires_designation BOOLEAN NOT NULL,
  requires_case_assignment BOOLEAN NOT NULL,
  accepted_credentials TEXT[] NOT NULL DEFAULT '{}' CHECK (accepted_credentials <@ ARRAY['CPA','EA','ATTORNEY']::text[]),
  eligibility_text VARCHAR(2000) NOT NULL CHECK (length(btrim(eligibility_text)) >= 20),
  approved_by VARCHAR(128) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, function_code, policy_version),
  CHECK (requires_eligibility OR requires_designation OR requires_case_assignment),
  CHECK (NOT requires_eligibility OR cardinality(accepted_credentials) > 0),
  -- Content approvals are professional acts: a role or a case cannot stand in for eligibility and designation.
  CHECK (function_code NOT IN ('RETURN_TEMPLATE_APPROVAL','FORM_RULE_APPROVAL') OR (requires_eligibility AND requires_designation)),
  -- Case decisions always need the case assignment.
  CHECK (function_code NOT IN ('RETURN_DRAFT_REVIEW','RETURN_QC_REVIEW') OR requires_case_assignment)
);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_professional_eligibility (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  eligibility_id UUID NOT NULL DEFAULT gen_random_uuid(),
  person_uid VARCHAR(128) NOT NULL,
  credential_type VARCHAR(16) NOT NULL CHECK (credential_type IN ('CPA','EA','ATTORNEY')),
  -- Credential and verification references (licence number record, registry lookup record): references, never secrets.
  credential_reference VARCHAR(300) NOT NULL CHECK (length(btrim(credential_reference)) >= 5),
  issuing_jurisdiction CHAR(2) NOT NULL CHECK (issuing_jurisdiction ~ '^[A-Z]{2}$'),
  scope_jurisdictions TEXT[] NOT NULL CHECK (cardinality(scope_jurisdictions) BETWEEN 1 AND 60),
  valid_from DATE NOT NULL,
  expires_on DATE NOT NULL,
  verified_by VARCHAR(128) NOT NULL,
  verification_reference VARCHAR(300) NOT NULL CHECK (length(btrim(verification_reference)) >= 5),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by VARCHAR(128),
  revoked_at TIMESTAMPTZ,
  revocation_reason VARCHAR(500),
  PRIMARY KEY (tenant_id, eligibility_id),
  CHECK (verified_by <> person_uid),
  CHECK (expires_on >= valid_from),
  CHECK ((revoked_by IS NULL) = (revoked_at IS NULL) AND (revoked_at IS NULL) = (revocation_reason IS NULL))
);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_function_designations (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  designation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  person_uid VARCHAR(128) NOT NULL,
  function_code VARCHAR(32) NOT NULL,
  policy_version INTEGER NOT NULL,
  designation_reference VARCHAR(300) NOT NULL CHECK (length(btrim(designation_reference)) >= 5),
  designated_by VARCHAR(128) NOT NULL,
  designated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by VARCHAR(128),
  revoked_at TIMESTAMPTZ,
  revocation_reason VARCHAR(500),
  PRIMARY KEY (tenant_id, designation_id),
  FOREIGN KEY (tenant_id, function_code, policy_version) REFERENCES public.taxguard_tax_approval_policies(tenant_id, function_code, policy_version),
  CHECK (designated_by <> person_uid),
  CHECK ((revoked_by IS NULL) = (revoked_at IS NULL) AND (revoked_at IS NULL) = (revocation_reason IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxguard_tax_function_designations_active ON public.taxguard_tax_function_designations(tenant_id, person_uid, function_code)
  WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.taxguard_tax_approval_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') OR TG_TABLE_NAME = 'taxguard_tax_approval_policies' THEN
    RAISE EXCEPTION 'TAX_APPROVAL_AUTHORITY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  -- Eligibility and designations only ever gain their revocation.
  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
     OR (to_jsonb(NEW) - ARRAY['revoked_by','revoked_at','revocation_reason']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['revoked_by','revoked_at','revocation_reason']) THEN
    RAISE EXCEPTION 'TAX_APPROVAL_AUTHORITY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_tax_approval_policies','taxguard_tax_professional_eligibility','taxguard_tax_function_designations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_approval_history_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_truncate ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_approval_history_guard()', t, t);
  END LOOP;
END $$;

-- The actor's authority to perform p_function for a decision in p_jurisdiction (US or a state code) today:
-- {"authorized": true, "basis": {...}} or {"authorized": false, "reason": "..."}. p_case_reviewer is the caller's own
-- check of the live case reviewer assignment (ignored when the policy does not require it). Reasons, in order:
-- NO_POLICY, NOT_CASE_REVIEWER, NO_DESIGNATION, DESIGNATION_UNDER_OLD_POLICY, NO_ELIGIBILITY, ELIGIBILITY_REVOKED,
-- ELIGIBILITY_NOT_YET_VALID, ELIGIBILITY_EXPIRED, CREDENTIAL_NOT_ACCEPTED, OUTSIDE_ELIGIBILITY_SCOPE.
CREATE OR REPLACE FUNCTION public.taxguard_tax_approval_authority(p_tenant text, p_actor text, p_function text, p_jurisdiction text, p_case_reviewer boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE pol public.taxguard_tax_approval_policies; des public.taxguard_tax_function_designations; e public.taxguard_tax_professional_eligibility;
  basis jsonb; usable boolean := false; any_ boolean := false; reason text;
BEGIN
  SELECT * INTO pol FROM public.taxguard_tax_approval_policies WHERE tenant_id = p_tenant AND function_code = p_function ORDER BY policy_version DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('authorized', false, 'reason', 'NO_POLICY'); END IF;
  basis := jsonb_build_object('function', p_function, 'policyVersion', pol.policy_version, 'jurisdiction', p_jurisdiction);
  IF pol.requires_case_assignment THEN
    IF NOT COALESCE(p_case_reviewer, false) THEN RETURN jsonb_build_object('authorized', false, 'reason', 'NOT_CASE_REVIEWER'); END IF;
    basis := basis || jsonb_build_object('caseReviewer', true);
  END IF;
  IF pol.requires_designation THEN
    SELECT * INTO des FROM public.taxguard_tax_function_designations WHERE tenant_id = p_tenant AND person_uid = p_actor AND function_code = p_function
      AND revoked_at IS NULL;
    IF NOT FOUND THEN RETURN jsonb_build_object('authorized', false, 'reason', 'NO_DESIGNATION'); END IF;
    IF des.policy_version <> pol.policy_version THEN RETURN jsonb_build_object('authorized', false, 'reason', 'DESIGNATION_UNDER_OLD_POLICY'); END IF;
    basis := basis || jsonb_build_object('designationId', des.designation_id, 'designationReference', des.designation_reference,
      'designatedBy', des.designated_by, 'designatedAt', des.designated_at);
  END IF;
  IF pol.requires_eligibility THEN
    -- The first usable record authorizes; otherwise the refusal names what is wrong with the most recently verified one.
    FOR e IN SELECT * FROM public.taxguard_tax_professional_eligibility WHERE tenant_id = p_tenant AND person_uid = p_actor ORDER BY verified_at DESC, eligibility_id LOOP
      any_ := true;
      IF e.revoked_at IS NOT NULL THEN reason := COALESCE(reason, 'ELIGIBILITY_REVOKED'); CONTINUE; END IF;
      IF current_date < e.valid_from THEN reason := COALESCE(reason, 'ELIGIBILITY_NOT_YET_VALID'); CONTINUE; END IF;
      IF current_date > e.expires_on THEN reason := COALESCE(reason, 'ELIGIBILITY_EXPIRED'); CONTINUE; END IF;
      IF NOT (e.credential_type = ANY (pol.accepted_credentials)) THEN reason := COALESCE(reason, 'CREDENTIAL_NOT_ACCEPTED'); CONTINUE; END IF;
      IF NOT (p_jurisdiction = ANY (e.scope_jurisdictions)) THEN reason := COALESCE(reason, 'OUTSIDE_ELIGIBILITY_SCOPE'); CONTINUE; END IF;
      usable := true;
      basis := basis || jsonb_build_object('eligibilityId', e.eligibility_id, 'credentialType', e.credential_type,
        'credentialReference', e.credential_reference, 'issuingJurisdiction', e.issuing_jurisdiction, 'expiresOn', e.expires_on,
        'verifiedBy', e.verified_by, 'verificationReference', e.verification_reference);
      EXIT;
    END LOOP;
    IF NOT usable THEN RETURN jsonb_build_object('authorized', false, 'reason', CASE WHEN any_ THEN reason ELSE 'NO_ELIGIBILITY' END); END IF;
  END IF;
  RETURN jsonb_build_object('authorized', true, 'basis', basis);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_tax_approval_authority','taxguard_tax_approval_history_guard') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
  END LOOP;
END $$;
