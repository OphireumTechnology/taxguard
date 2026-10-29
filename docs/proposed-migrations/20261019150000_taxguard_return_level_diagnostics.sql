-- PROPOSAL (Block 70, return-level diagnostics). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261018160000 (case diagnostics), 20261019120000 (return versions) and 20261019140000 (verifications).
--
-- Extends the governed case diagnostics to draft return versions. New rules in the governed rule table, with severity
-- set here as reviewed content (proposed defaults; the owner may change them by a reviewed database change, never a
-- caller): RETURN_VERSION_STALE and RETURN_VERIFICATION_DISCREPANCY are BLOCKING (integrity); RETURN_AWAITING_VERIFICATION
-- and RETURN_AWAITING_REVIEW are WARNING; RETURN_OPTIONAL_FORM_UNMAPPED is INFO. The diagnostics run detects them on every
-- open version of the case and clears them like other findings; history is kept. INFO and WARNING may be acknowledged;
-- BLOCKING clears only when the version is fixed (re-prepared, re-verified) or superseded.
-- Return-level findings report readiness (and feed Block 72); they do not block preparing a new version, so preparation
-- now counts case-level blocking findings only.
-- Current definitions after this file: taxguard_case_diagnostics_run (previously 20261018160000) and
-- taxguard_tax_return_derive (previously 20261019120000).
-- Rollback (development): restore both functions, delete the five rules, restore the affected_type CHECK.

DO $$ DECLARE k text; BEGIN
  FOR k IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.taxguard_case_diagnostics'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%affected_type%' LOOP
    EXECUTE format('ALTER TABLE public.taxguard_case_diagnostics DROP CONSTRAINT %I', k);
  END LOOP;
END $$;
ALTER TABLE public.taxguard_case_diagnostics ADD CONSTRAINT chk_taxguard_case_diagnostics_affected_type
  CHECK (affected_type IN ('CASE','CALC_RUN','LEDGER','B2T','RESEARCH_MEMO','RETURN_VERSION'));

INSERT INTO public.taxguard_diagnostic_rules(rule_code, rule_version, severity, description) VALUES
  ('RETURN_VERSION_STALE', 1, 'BLOCKING', 'An open draft return version no longer matches its form mappings or template and must be prepared again.'),
  ('RETURN_VERIFICATION_DISCREPANCY', 1, 'BLOCKING', 'The latest calculation verification of a submitted draft return found a discrepancy.'),
  ('RETURN_AWAITING_VERIFICATION', 1, 'WARNING', 'A submitted draft return has no calculation verification since it was submitted.'),
  ('RETURN_AWAITING_REVIEW', 1, 'WARNING', 'A submitted draft return is verified and waiting for the reviewer to approve or return it.'),
  ('RETURN_OPTIONAL_FORM_UNMAPPED', 1, 'INFO', 'An open draft return version has optional forms without a current form mapping.')
ON CONFLICT (rule_code) DO NOTHING;

-- As 20261018160000, plus the return-level detections.
CREATE OR REPLACE FUNCTION public.taxguard_case_diagnostics_run(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; run uuid; det record; rule public.taxguard_diagnostic_rules; n integer := 0; seen text[] := '{}'; latest_posting timestamptz; latest_approved timestamptz;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  c := a.c;
  INSERT INTO public.taxguard_case_diagnostic_runs(tenant_id, case_id, client_id, tax_year, run_by, detected)
    VALUES (p_tenant, c.case_id, c.client_id, c.tax_year, p_actor, 0) RETURNING run_id INTO run;
  SELECT max(posted_at) INTO latest_posting FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = c.client_id AND tax_year = c.tax_year AND status = 'POSTED';
  SELECT max(created_at) INTO latest_approved FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND case_id = c.case_id AND status = 'REVIEW_APPROVED';
  FOR det IN
    SELECT 'CASE_ON_HOLD' AS code, 'CASE' AS kind, c.case_id AS id, 'The case is on hold' || COALESCE(': ' || c.hold_reason, '.') AS msg WHERE c.status = 'ON_HOLD'
    UNION ALL SELECT 'CALC_NO_APPROVED_RUN', 'CASE', c.case_id, 'No approved calculation run for this case.' WHERE latest_approved IS NULL
    UNION ALL SELECT 'CALC_RUN_AWAITING_REVIEW', 'CALC_RUN', r.run_id::text, 'Calculation run awaiting review.'
      FROM public.taxguard_tax_calc_runs r WHERE r.tenant_id = p_tenant AND r.case_id = c.case_id AND r.status = 'COMPUTED'
    UNION ALL SELECT 'CALC_RUN_STALE', 'CASE', c.case_id, 'The ledger changed after the latest approved calculation run.'
      WHERE latest_approved IS NOT NULL AND latest_posting IS NOT NULL AND latest_posting > latest_approved
    UNION ALL SELECT 'LEDGER_ENTRIES_UNREVIEWED', 'LEDGER', e.entry_number::text, 'Journal entry ' || e.entry_number || ' is waiting for review.'
      FROM public.taxguard_ledger_entries e WHERE e.tenant_id = p_tenant AND e.client_id = c.client_id AND e.tax_year = c.tax_year AND e.status = 'PREPARED'
    UNION ALL SELECT 'B2T_NO_APPROVED_WORKPAPER', 'B2T', COALESCE(c.return_family, 'UNSET'), 'No approved book-to-tax workpaper for ' || c.tax_year || ' ' || COALESCE(c.return_family, '(return family not set)') || '.'
      WHERE NOT EXISTS (SELECT 1 FROM public.taxguard_b2t_workpapers w WHERE w.tenant_id = p_tenant AND w.client_id = c.client_id AND w.tax_year = c.tax_year
        AND w.return_family = c.return_family AND w.status = 'APPROVED')
    UNION ALL SELECT CASE m.status WHEN 'SUBMITTED' THEN 'RESEARCH_AWAITING_REVIEW' ELSE 'RESEARCH_DRAFT_OPEN' END, 'RESEARCH_MEMO', m.memo_id::text,
        'Research memo ' || CASE m.status WHEN 'SUBMITTED' THEN 'awaiting review' ELSE 'still a draft' END || ': ' || left(m.question, 120)
      FROM public.taxguard_tax_research_memos m WHERE m.tenant_id = p_tenant AND m.case_id = c.case_id AND m.status IN ('DRAFT','SUBMITTED')
    -- Block 70: return-level findings on every open (not superseded) draft return version of the case.
    UNION ALL SELECT 'RETURN_VERSION_STALE', 'RETURN_VERSION', v.return_version_id::text,
        'Draft return ' || v.template_id || ' version ' || v.version || ' no longer matches its sources and must be prepared again.'
      FROM public.taxguard_tax_return_versions v WHERE v.tenant_id = p_tenant AND v.case_id = c.case_id AND v.status <> 'SUPERSEDED'
        AND jsonb_array_length(public.taxguard_tax_return_stale(p_tenant, v.return_version_id)) > 0
    UNION ALL SELECT CASE x.result WHEN 'DISCREPANCY' THEN 'RETURN_VERIFICATION_DISCREPANCY' WHEN 'VERIFIED' THEN 'RETURN_AWAITING_REVIEW'
        ELSE 'RETURN_AWAITING_VERIFICATION' END, 'RETURN_VERSION', v.return_version_id::text,
        'Draft return ' || v.template_id || ' version ' || v.version || CASE x.result WHEN 'DISCREPANCY' THEN ': the latest calculation verification found a discrepancy.'
          WHEN 'VERIFIED' THEN ': calculations verified, awaiting the reviewer''s decision.' ELSE ': submitted, calculations not verified yet.' END
      FROM public.taxguard_tax_return_versions v
      LEFT JOIN LATERAL (SELECT r.result FROM public.taxguard_tax_return_verifications r WHERE r.tenant_id = v.tenant_id AND r.return_version_id = v.return_version_id
        AND r.verified_at >= v.submitted_at ORDER BY r.verified_at DESC, r.verification_id LIMIT 1) x ON true
      WHERE v.tenant_id = p_tenant AND v.case_id = c.case_id AND v.status = 'SUBMITTED'
    UNION ALL SELECT 'RETURN_OPTIONAL_FORM_UNMAPPED', 'RETURN_VERSION', v.return_version_id::text,
        'Draft return ' || v.template_id || ' version ' || v.version || ' has optional forms without a mapping: '
          || (SELECT string_agg(f.value->>'formId', ', ' ORDER BY f.value->>'formId') FROM jsonb_array_elements(v.missing) f) || '.'
      FROM public.taxguard_tax_return_versions v WHERE v.tenant_id = p_tenant AND v.case_id = c.case_id AND v.status <> 'SUPERSEDED' AND jsonb_array_length(v.missing) > 0
  LOOP
    SELECT * INTO rule FROM public.taxguard_diagnostic_rules WHERE rule_code = det.code AND active;
    CONTINUE WHEN NOT FOUND;
    n := n + 1; seen := seen || (det.code || '|' || det.id);
    UPDATE public.taxguard_case_diagnostics SET last_detected_run = run
     WHERE tenant_id = p_tenant AND case_id = c.case_id AND rule_code = det.code AND affected_id = det.id AND status IN ('OPEN','ACKNOWLEDGED');
    IF NOT FOUND THEN
      INSERT INTO public.taxguard_case_diagnostics(tenant_id, case_id, client_id, tax_year, rule_code, rule_version, severity, affected_type, affected_id, message, detected_run, last_detected_run)
        VALUES (p_tenant, c.case_id, c.client_id, c.tax_year, rule.rule_code, rule.rule_version, rule.severity, det.kind, det.id, det.msg, run, run);
    END IF;
  END LOOP;
  -- Anything no longer detected is cleared by this run; its history stays.
  UPDATE public.taxguard_case_diagnostics SET status = 'CLEARED', cleared_run = run, cleared_at = now()
   WHERE tenant_id = p_tenant AND case_id = c.case_id AND status IN ('OPEN','ACKNOWLEDGED') AND (rule_code || '|' || affected_id) <> ALL (seen);
  PERFORM public.taxguard_tax_audit(p_tenant, c.client_id, p_actor, a.actor_role, 'CASE_DIAGNOSTICS_RUN', jsonb_build_object('caseId', c.case_id, 'runId', run, 'detected', n));
  RETURN public.taxguard_case_diagnostics_json(p_tenant, c.case_id) || jsonb_build_object('runId', run, 'detected', n);
END $$;

-- As 20261019120000, but counting case-level blocking findings only.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_derive(p_case public.taxguard_cases, p_template public.taxguard_tax_return_templates) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; f jsonb; m public.taxguard_tax_form_mappings; mr public.taxguard_tax_form_rules; at_ jsonb;
  forms jsonb := '[]'::jsonb; missing jsonb := '[]'::jsonb; problems jsonb := '[]'::jsonb; blocking_ integer;
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
  -- Case-level blocking findings only: a return-level finding (Block 70) never blocks preparing the version that fixes it.
  SELECT count(*) INTO blocking_ FROM public.taxguard_case_diagnostics d WHERE d.tenant_id = c.tenant_id AND d.case_id = c.case_id
    AND d.status <> 'CLEARED' AND d.severity = 'BLOCKING' AND d.affected_type <> 'RETURN_VERSION';
  IF blocking_ > 0 THEN
    problems := problems || jsonb_build_object('reason', 'RETURN_BLOCKING_DIAGNOSTICS', 'blocking', blocking_);
  END IF;
  RETURN jsonb_build_object('forms', forms, 'missing', missing, 'problems', problems);
END $$;
