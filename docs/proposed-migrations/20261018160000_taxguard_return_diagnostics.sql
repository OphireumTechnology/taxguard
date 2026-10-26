-- REVIEW-ONLY PROPOSAL. Not applied to any hosted database; owner approval and independent SQL review required.
--
-- Case readiness diagnostics: deterministic checks over the durable records of one tax case, persisted with the rule
-- and rule version that produced them. No return exists yet (stages 9-18 are blocked), so these diagnose a case's
-- readiness for return preparation from the records that do exist: case status, calculation runs, ledger review,
-- book-to-tax workpapers and research.
--
--   * Severity comes from the governed rule table (INFO, WARNING, ERROR, BLOCKING), never from the caller or a model.
--     Changing a rule's severity is a reviewed database change: no RPC writes the rule table.
--   * A run records every detection. A diagnostic stays OPEN while it is detected and becomes CLEARED, with the run that
--     cleared it, when the underlying record no longer triggers it. History is never deleted.
--   * Only INFO and WARNING may be acknowledged by a person, with a recorded note. ERROR and BLOCKING clear only when
--     the data changes (DIAGNOSTIC_NOT_WAIVABLE).
--   * taxguard_case_diagnostics_gate reports blocking and error counts for downstream steps; it is not granted to
--     any client role. Access follows the case's live assignment (taxguard_case_actor).

CREATE TABLE IF NOT EXISTS public.taxguard_diagnostic_rules (
  rule_code VARCHAR(48) PRIMARY KEY CHECK (rule_code ~ '^[A-Z][A-Z0-9_]{2,47}$'),
  rule_version INTEGER NOT NULL CHECK (rule_version >= 1),
  severity VARCHAR(8) NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR','BLOCKING')),
  description VARCHAR(500) NOT NULL CHECK (length(btrim(description)) >= 10),
  active BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO public.taxguard_diagnostic_rules(rule_code, rule_version, severity, description) VALUES
  ('CASE_ON_HOLD', 1, 'BLOCKING', 'The case is on hold; nothing may be finalized until it is resumed.'),
  ('CALC_NO_APPROVED_RUN', 1, 'BLOCKING', 'No calculation run for this case has been approved by its independent reviewer.'),
  ('CALC_RUN_AWAITING_REVIEW', 1, 'WARNING', 'A calculation run is waiting for the case reviewer.'),
  ('CALC_RUN_STALE', 1, 'WARNING', 'The ledger changed after the latest approved calculation run was recorded.'),
  ('LEDGER_ENTRIES_UNREVIEWED', 1, 'ERROR', 'Journal entries for the case year are waiting for independent review.'),
  ('B2T_NO_APPROVED_WORKPAPER', 1, 'ERROR', 'No approved book-to-tax workpaper exists for the case year and return family.'),
  ('RESEARCH_AWAITING_REVIEW', 1, 'WARNING', 'A research memo for the case is waiting for the case reviewer.'),
  ('RESEARCH_DRAFT_OPEN', 1, 'INFO', 'A research memo for the case is still a draft.')
ON CONFLICT (rule_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.taxguard_case_diagnostic_runs (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE CASCADE,
  run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  tax_year INTEGER NOT NULL,
  run_by VARCHAR(128) NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected INTEGER NOT NULL CHECK (detected >= 0),
  PRIMARY KEY (tenant_id, run_id)
);

CREATE TABLE IF NOT EXISTS public.taxguard_case_diagnostics (
  tenant_id VARCHAR(128) NOT NULL,
  diagnostic_id UUID NOT NULL DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  tax_year INTEGER NOT NULL,
  rule_code VARCHAR(48) NOT NULL REFERENCES public.taxguard_diagnostic_rules(rule_code),
  rule_version INTEGER NOT NULL,
  severity VARCHAR(8) NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR','BLOCKING')),
  affected_type VARCHAR(24) NOT NULL CHECK (affected_type IN ('CASE','CALC_RUN','LEDGER','B2T','RESEARCH_MEMO')),
  affected_id VARCHAR(128) NOT NULL,
  message VARCHAR(500) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','CLEARED')),
  detected_run UUID NOT NULL,
  last_detected_run UUID NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleared_run UUID,
  cleared_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(128),
  acknowledged_at TIMESTAMPTZ,
  acknowledgement_note VARCHAR(1000),
  PRIMARY KEY (tenant_id, diagnostic_id),
  FOREIGN KEY (tenant_id, detected_run) REFERENCES public.taxguard_case_diagnostic_runs(tenant_id, run_id),
  CHECK ((status = 'CLEARED') = (cleared_run IS NOT NULL)),
  CHECK ((acknowledged_by IS NULL) = (acknowledged_at IS NULL)),
  CHECK (acknowledged_by IS NULL OR severity IN ('INFO','WARNING'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_case_diagnostic_open ON public.taxguard_case_diagnostics(tenant_id, case_id, rule_code, affected_id)
  WHERE status IN ('OPEN','ACKNOWLEDGED');

ALTER TABLE public.taxguard_diagnostic_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_case_diagnostic_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_case_diagnostics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_diagnostic_rules, public.taxguard_case_diagnostic_runs, public.taxguard_case_diagnostics FROM PUBLIC, anon, authenticated;

-- History is kept: diagnostics and runs are never deleted, and a diagnostic's identity and detection never change.
CREATE OR REPLACE FUNCTION public.taxguard_case_diagnostics_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'DIAGNOSTIC_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF TG_TABLE_NAME = 'taxguard_case_diagnostic_runs' THEN RAISE EXCEPTION 'DIAGNOSTIC_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF OLD.status = 'CLEARED' OR (NEW.tenant_id, NEW.diagnostic_id, NEW.case_id, NEW.client_id, NEW.tax_year, NEW.rule_code, NEW.rule_version, NEW.severity,
      NEW.affected_type, NEW.affected_id, NEW.detected_run, NEW.detected_at) IS DISTINCT FROM (OLD.tenant_id, OLD.diagnostic_id, OLD.case_id, OLD.client_id,
      OLD.tax_year, OLD.rule_code, OLD.rule_version, OLD.severity, OLD.affected_type, OLD.affected_id, OLD.detected_run, OLD.detected_at) THEN
    RAISE EXCEPTION 'DIAGNOSTIC_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_case_diagnostics_guard ON public.taxguard_case_diagnostics;
CREATE TRIGGER trg_taxguard_case_diagnostics_guard BEFORE UPDATE OR DELETE ON public.taxguard_case_diagnostics FOR EACH ROW EXECUTE FUNCTION public.taxguard_case_diagnostics_guard();
DROP TRIGGER IF EXISTS trg_taxguard_case_diagnostic_runs_guard ON public.taxguard_case_diagnostic_runs;
CREATE TRIGGER trg_taxguard_case_diagnostic_runs_guard BEFORE UPDATE OR DELETE ON public.taxguard_case_diagnostic_runs FOR EACH ROW EXECUTE FUNCTION public.taxguard_case_diagnostics_guard();

-- The open diagnostics of a case, most severe first, with the gate summary.
CREATE OR REPLACE FUNCTION public.taxguard_case_diagnostics_json(p_tenant text, p_case text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object(
    'caseId', p_case,
    'blocking', count(*) FILTER (WHERE d.severity = 'BLOCKING' AND d.status <> 'CLEARED'),
    'errors', count(*) FILTER (WHERE d.severity = 'ERROR' AND d.status <> 'CLEARED'),
    'ready', count(*) FILTER (WHERE d.severity IN ('BLOCKING','ERROR') AND d.status <> 'CLEARED') = 0,
    'returnUse', 'BLOCKED',
    'diagnostics', COALESCE(jsonb_agg((to_jsonb(d) - 'tenant_id') ORDER BY array_position(ARRAY['BLOCKING','ERROR','WARNING','INFO'], d.severity::text), d.detected_at)
      FILTER (WHERE d.status <> 'CLEARED'), '[]'::jsonb))
  FROM public.taxguard_case_diagnostics d WHERE d.tenant_id = p_tenant AND d.case_id = p_case $$;

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

CREATE OR REPLACE FUNCTION public.taxguard_case_diagnostics_list(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  RETURN public.taxguard_case_diagnostics_json(p_tenant, (a.c).case_id);
END $$;

-- Only INFO and WARNING can be acknowledged, by the case's reviewer or a manager, with a recorded note.
CREATE OR REPLACE FUNCTION public.taxguard_case_diagnostic_acknowledge(p_tenant text, p_actor text, p_diagnostic uuid, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE d public.taxguard_case_diagnostics; a record;
BEGIN
  SELECT * INTO d FROM public.taxguard_case_diagnostics WHERE tenant_id = p_tenant AND diagnostic_id = p_diagnostic FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DIAGNOSTIC_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, d.case_id, p_actor);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'DIAGNOSTIC_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  IF d.severity NOT IN ('INFO','WARNING') THEN RAISE EXCEPTION 'DIAGNOSTIC_NOT_WAIVABLE' USING ERRCODE = 'P0001'; END IF;
  IF NOT (public.taxguard_practice_is_manager(a.actor_role) OR p_actor = (a.c).reviewer_uid) THEN RAISE EXCEPTION 'DIAGNOSTIC_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF d.status <> 'OPEN' THEN RAISE EXCEPTION 'DIAGNOSTIC_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;
  IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'DIAGNOSTIC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_case_diagnostics SET status = 'ACKNOWLEDGED', acknowledged_by = p_actor, acknowledged_at = now(), acknowledgement_note = btrim(p_note)
   WHERE tenant_id = p_tenant AND diagnostic_id = p_diagnostic;
  PERFORM public.taxguard_tax_audit(p_tenant, d.client_id, p_actor, a.actor_role, 'CASE_DIAGNOSTIC_ACKNOWLEDGED', jsonb_build_object('caseId', d.case_id, 'diagnosticId', p_diagnostic, 'ruleCode', d.rule_code));
  RETURN public.taxguard_case_diagnostics_json(p_tenant, d.case_id);
END $$;

-- For downstream finalization steps: blocking and error counts of a case. Not exposed to any client role.
CREATE OR REPLACE FUNCTION public.taxguard_case_diagnostics_gate(p_tenant text, p_case text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('blocking', count(*) FILTER (WHERE severity = 'BLOCKING'), 'errors', count(*) FILTER (WHERE severity = 'ERROR'),
    'ready', count(*) = 0, 'diagnosedAt', (SELECT max(run_at) FROM public.taxguard_case_diagnostic_runs r WHERE r.tenant_id = p_tenant AND r.case_id = p_case))
  FROM public.taxguard_case_diagnostics WHERE tenant_id = p_tenant AND case_id = p_case AND status <> 'CLEARED' AND severity IN ('BLOCKING','ERROR') $$;

DO $$
DECLARE f text;
BEGIN
  -- Revoking from PUBLIC alone leaves Supabase's anon and authenticated grants, so every function is revoked from all three.
  FOREACH f IN ARRAY ARRAY['taxguard_case_diagnostics_guard()','taxguard_case_diagnostics_json(text,text)','taxguard_case_diagnostics_run(text,text,text)',
    'taxguard_case_diagnostics_list(text,text,text)','taxguard_case_diagnostic_acknowledge(text,text,uuid,text)','taxguard_case_diagnostics_gate(text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['taxguard_case_diagnostics_run(text,text,text)','taxguard_case_diagnostics_list(text,text,text)','taxguard_case_diagnostic_acknowledge(text,text,uuid,text)'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
