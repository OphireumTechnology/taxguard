-- PROPOSAL (Block 67 security enhancement: designated approval of form-mapping rules). REVIEW ONLY; NOT APPLIED anywhere.
-- Requires 20261019110000 (form mapping) and 20261019115000 (approval authority).
--
-- Block 67 lets any content reviewer other than the drafter approve a form-mapping rule. A mapping rule decides which
-- reviewed value lands on which form line, so approving one is a professional act like approving a return template.
-- This proposal makes approval also require the FORM_RULE_APPROVAL authority (20261019115000): the owner-approved
-- policy, a function designation and verified professional eligibility in scope for the rule's jurisdiction. With
-- nothing configured, approving a mapping rule fails closed (TAX_FORM_RULE_APPROVER_REQUIRED, DETAIL = the missing
-- element). Submission, rejection, maker-checker, source verification and supersession are unchanged.
--
-- Compatibility: additive column only; rules approved before this change stay APPROVED and keep a NULL basis; no
-- record is rewritten. Each new approval records its basis, frozen once set.
-- Current definitions after this file: taxguard_tax_form_guard, taxguard_tax_form_rule_json and
-- taxguard_tax_form_rule_transition (previously 20261019110000).
-- Rollback (development): restore the three functions from 20261019110000 and drop the column.

ALTER TABLE public.taxguard_tax_form_rules ADD COLUMN IF NOT EXISTS approval_basis JSONB
  CHECK (approval_basis IS NULL OR jsonb_typeof(approval_basis) = 'object');

-- As 20261019110000, plus: a rule's approval basis, once recorded, never changes.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'TAX_FORM_MAPPING_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF TG_TABLE_NAME = 'taxguard_tax_form_rules' THEN
    IF (NEW.tenant_id, NEW.rule_id, NEW.jurisdiction, NEW.jurisdiction_code, NEW.return_family, NEW.tax_year, NEW.form_id, NEW.form_version, NEW.version,
        NEW.effective_from, NEW.effective_to, NEW.prepared_by, NEW.created_at) IS DISTINCT FROM (OLD.tenant_id, OLD.rule_id, OLD.jurisdiction,
        OLD.jurisdiction_code, OLD.return_family, OLD.tax_year, OLD.form_id, OLD.form_version, OLD.version, OLD.effective_from, OLD.effective_to,
        OLD.prepared_by, OLD.created_at)
       OR (OLD.status <> 'DRAFT' AND (NEW.definition, NEW.content_sha256, NEW.source_id) IS DISTINCT FROM (OLD.definition, OLD.content_sha256, OLD.source_id))
       OR (OLD.approval_basis IS NOT NULL AND NEW.approval_basis IS DISTINCT FROM OLD.approval_basis)
       OR (OLD.approval_basis IS NULL AND NEW.approval_basis IS NOT NULL AND NOT (OLD.status = 'PENDING_REVIEW' AND NEW.status = 'APPROVED')) THEN
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

-- As 20261019110000, plus the approval basis.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_rule_json(r public.taxguard_tax_form_rules, p_full boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('ruleId', r.rule_id, 'jurisdiction', r.jurisdiction, 'jurisdictionCode', r.jurisdiction_code, 'returnFamily', r.return_family,
    'effectiveFrom', r.effective_from, 'effectiveTo', r.effective_to, 'taxYear', r.tax_year,
    'formId', r.form_id, 'formVersion', r.form_version, 'version', r.version, 'contentSha256', r.content_sha256, 'sourceId', r.source_id,
    'status', r.status, 'preparedBy', r.prepared_by, 'createdAt', r.created_at, 'submittedAt', r.submitted_at, 'reviewedBy', r.reviewed_by,
    'reviewedAt', r.reviewed_at, 'reviewNote', r.review_note, 'approvalBasis', r.approval_basis, 'lines', jsonb_array_length(r.definition->'lines'))
  || CASE WHEN p_full THEN jsonb_build_object('definition', r.definition) ELSE '{}'::jsonb END $$;

-- As 20261019110000, plus: approving needs the FORM_RULE_APPROVAL authority for the rule's jurisdiction and records it.
CREATE OR REPLACE FUNCTION public.taxguard_tax_form_rule_transition(p_tenant text, p_actor text, p_rule uuid, p_action text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE role_ text; r public.taxguard_tax_form_rules; missing text[]; note text := NULLIF(btrim(COALESCE(p_note, '')), ''); auth jsonb; basis jsonb;
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
      auth := public.taxguard_tax_approval_authority(p_tenant, p_actor, 'FORM_RULE_APPROVAL', r.jurisdiction_code, NULL);
      IF NOT (auth->>'authorized')::boolean THEN RAISE EXCEPTION 'TAX_FORM_RULE_APPROVER_REQUIRED' USING ERRCODE = 'P0001', DETAIL = auth->>'reason'; END IF;
      IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = array_to_string(missing, ','); END IF;
      basis := (auth->'basis') || jsonb_build_object('approverUid', p_actor, 'ruleVersion', r.version, 'contentSha256', r.content_sha256,
        'sourceId', r.source_id, 'sourceVerifiedForTaxYear', r.tax_year, 'approvedAt', now());
      UPDATE public.taxguard_tax_form_rules SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND jurisdiction = r.jurisdiction AND jurisdiction_code = r.jurisdiction_code
        AND return_family = r.return_family AND tax_year = r.tax_year AND form_id = r.form_id AND form_version = r.form_version AND status = 'APPROVED';
    END IF;
    UPDATE public.taxguard_tax_form_rules SET status = CASE p_action WHEN 'approve' THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(),
      review_note = note, approval_basis = basis WHERE tenant_id = p_tenant AND rule_id = p_rule RETURNING * INTO r;
  END IF;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, role_, 'TAX_FORM_RULE_' || CASE p_action WHEN 'submit' THEN 'SUBMITTED' WHEN 'approve' THEN 'APPROVED' ELSE 'REJECTED' END,
    jsonb_build_object('ruleId', p_rule, 'version', r.version, 'sha256', r.content_sha256)
    || CASE WHEN basis IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('approvalBasis', basis) END);
  RETURN public.taxguard_tax_form_rule_json(r, false);
END $$;
