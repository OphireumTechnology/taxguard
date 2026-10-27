-- PROPOSAL (Block 66, evidence-to-conclusion traceability). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 026 (case workflow and taxguard_case_audit), 027 (document vault), 029 (book-to-tax workpapers),
-- 033 (calculation runs), 20261018090000 (live case actor), 20261018150000 (tax research memos and citations) and
-- 20261018190000 (evidence resolver and calculation-input lineage; current definition of taxguard_tax_evidence_resolve).
--
-- A tax conclusion is a governed determination for a case (an income inclusion, a deduction, a credit, a filing
-- status...), prepared by the case's preparer and decided by its independent reviewer. It is never model output: an
-- AI proposal can only be the preparer's draft. Each conclusion links, many-to-many, to what supports it:
--   EVIDENCE  extraction:<field id> (a staff-decided extracted value) or document:<id> (a reviewed document)
--   CALCULATION  a calculation run of the same case (rule set and hash pinned in the run)
--   RESEARCH  an approved research memo of the same case (its citations carry the authority levels)
--   WORKPAPER  an approved book-to-tax workpaper of the same client and tax year
-- and records, per link, a snapshot of what the source was when linked (document version and hash, decided value,
-- run status and output hash, memo version, workpaper hash). At least one evidence link is required.
--
-- Staleness is derived, never stored as a flag that can drift: each link is resolved again and compared with its
-- snapshot. A changed or replaced document, a changed decision, a rejected run, a run whose own input evidence no
-- longer resolves, a rejected memo or a superseded workpaper makes the conclusion stale, with the reasons. Nothing is
-- recomputed or replaced automatically: a stale conclusion cannot be submitted or approved, and the readiness check
-- reports it as blocking. The preparer revises it into a new version (the old one becomes SUPERSEDED, read-only,
-- with its links), which the reviewer decides again.
--
-- taxguard_tax_form_line_sources is the lineage foundation for Block 67 (form mapping): it binds a form line to an
-- APPROVED conclusion. No mapping is created here and no form is assumed.
-- Access: the case's live preparer and reviewer, and managers for reads (taxguard_case_actor); clients have none.
-- Rollback (development): drop the functions and the three tables; re-apply the 20261018190000 evidence resolver.

-- Evidence resolution without a value comparison. Block 65 passes every calculation input's value; a conclusion's
-- evidence is cited for identity, not for one amount, so a NULL value now skips the comparison. Otherwise identical
-- to 20261018190000.
CREATE OR REPLACE FUNCTION public.taxguard_tax_evidence_resolve(p_case public.taxguard_cases, p_ref text, p_value text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; e public.taxguard_extracted_data; d public.taxguard_documents; decided text; current_version integer;
BEGIN
  IF p_ref ~ '^extraction:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO e FROM public.taxguard_extracted_data WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND id = substr(p_ref, 12)::uuid;
    IF NOT FOUND THEN RETURN jsonb_build_object('unresolved', 'NOT_FOUND'); END IF;
    SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND document_id = e.document_id AND version = e.document_version;
    IF NOT FOUND OR d.engagement_id IS DISTINCT FROM c.engagement_id OR d.tax_year IS DISTINCT FROM c.tax_year THEN RETURN jsonb_build_object('unresolved', 'OUT_OF_SCOPE'); END IF;
    IF e.decision IS NULL THEN RETURN jsonb_build_object('unresolved', 'NOT_DECIDED'); END IF;
    IF e.decision = 'REJECTED' THEN RETURN jsonb_build_object('unresolved', 'VALUE_REJECTED'); END IF;
  ELSIF p_ref ~ '^document:[A-Za-z0-9_-]{1,119}$' THEN
    SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND document_id = substr(p_ref, 10)
      ORDER BY version DESC LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('unresolved', 'NOT_FOUND'); END IF;
    IF d.engagement_id IS DISTINCT FROM c.engagement_id OR d.tax_year IS DISTINCT FROM c.tax_year THEN RETURN jsonb_build_object('unresolved', 'OUT_OF_SCOPE'); END IF;
  ELSE
    RETURN jsonb_build_object('unresolved', 'UNRECOGNISED_REFERENCE');
  END IF;
  SELECT max(version) INTO current_version FROM public.taxguard_documents WHERE tenant_id = d.tenant_id AND client_id = d.client_id AND document_id = d.document_id;
  IF d.version <> current_version THEN RETURN jsonb_build_object('unresolved', 'DOCUMENT_SUPERSEDED'); END IF;
  IF d.status <> 'VERIFIED' OR d.quarantine_status <> 'CLEAN' THEN RETURN jsonb_build_object('unresolved', 'DOCUMENT_NOT_REVIEWED'); END IF;
  IF e.id IS NULL THEN
    RETURN jsonb_build_object('kind', 'DOCUMENT', 'documentId', d.document_id, 'documentVersion', d.version, 'documentSha256', d.hash);
  END IF;
  decided := e.verified_value #>> '{}';
  IF p_value IS NOT NULL AND (decided IS NULL OR decided !~ '^-?[0-9]{1,15}(\.[0-9]{1,10})?$' OR p_value !~ '^-?[0-9]{1,15}(\.[0-9]{1,10})?$'
      OR decided::numeric <> p_value::numeric) THEN
    RETURN jsonb_build_object('unresolved', 'VALUE_MISMATCH');
  END IF;
  RETURN jsonb_build_object('kind', 'EXTRACTION', 'fieldId', e.id, 'fieldKey', e.field_key, 'decision', e.decision, 'decidedValue', decided,
    'decidedBy', e.verified_by, 'documentId', d.document_id, 'documentVersion', d.version, 'documentSha256', d.hash);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_tax_evidence_resolve(public.taxguard_cases, text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.taxguard_tax_conclusions (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  conclusion_id UUID NOT NULL DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  lineage_id UUID NOT NULL,
  version INTEGER NOT NULL CHECK (version BETWEEN 1 AND 1000),
  supersedes_id UUID,
  conclusion_type VARCHAR(32) NOT NULL CHECK (conclusion_type IN ('INCOME_INCLUSION','DEDUCTION','DEPRECIATION','CREDIT_ELIGIBILITY','FILING_STATUS',
    'ENTITY_CLASSIFICATION','BASIS','CAPITAL_GAIN_LOSS','CARRYFORWARD','STATE_ALLOCATION','BOOK_TO_TAX_ADJUSTMENT','OTHER')),
  statement VARCHAR(4000) NOT NULL CHECK (length(btrim(statement)) BETWEEN 10 AND 4000),
  amount NUMERIC(15,2),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','READY_FOR_REVIEW','APPROVED','RETURNED','REJECTED','SUPERSEDED')),
  prepared_by VARCHAR(128) NOT NULL,
  submitted_at TIMESTAMPTZ,
  reviewed_by VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  review_note VARCHAR(2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, conclusion_id),
  UNIQUE (tenant_id, lineage_id, version),
  FOREIGN KEY (tenant_id, supersedes_id) REFERENCES public.taxguard_tax_conclusions(tenant_id, conclusion_id),
  CHECK (reviewed_by IS NULL OR reviewed_by <> prepared_by),
  CHECK ((status IN ('APPROVED','RETURNED','REJECTED')) = (reviewed_by IS NOT NULL) OR status = 'SUPERSEDED')
);
CREATE INDEX IF NOT EXISTS idx_taxguard_tax_conclusions_case ON public.taxguard_tax_conclusions(tenant_id, case_id, created_at);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_conclusion_links (
  tenant_id VARCHAR(128) NOT NULL,
  conclusion_id UUID NOT NULL,
  link_type VARCHAR(16) NOT NULL CHECK (link_type IN ('EVIDENCE','CALCULATION','RESEARCH','WORKPAPER')),
  ref VARCHAR(160) NOT NULL,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, conclusion_id, link_type, ref),
  FOREIGN KEY (tenant_id, conclusion_id) REFERENCES public.taxguard_tax_conclusions(tenant_id, conclusion_id)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_tax_conclusion_links_ref ON public.taxguard_tax_conclusion_links(tenant_id, link_type, ref);

-- Block 67 foundation: a form line bound to an approved conclusion. No row is written by this proposal.
CREATE TABLE IF NOT EXISTS public.taxguard_tax_form_line_sources (
  tenant_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  form_id VARCHAR(40) NOT NULL CHECK (form_id ~ '^[A-Za-z0-9 _.-]{1,40}$'),
  form_version VARCHAR(40) NOT NULL,
  line VARCHAR(40) NOT NULL,
  conclusion_id UUID NOT NULL,
  mapped_by VARCHAR(128) NOT NULL,
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, case_id, form_id, form_version, line, conclusion_id),
  FOREIGN KEY (tenant_id, conclusion_id) REFERENCES public.taxguard_tax_conclusions(tenant_id, conclusion_id)
);

ALTER TABLE public.taxguard_tax_conclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_conclusion_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_form_line_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_conclusions, public.taxguard_tax_conclusion_links, public.taxguard_tax_form_line_sources FROM PUBLIC, anon, authenticated, service_role;

-- History is never rewritten: identity, content and links are immutable; only the review fields move forward.
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME <> 'taxguard_tax_conclusions' OR TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'TAX_CONCLUSION_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF (NEW.tenant_id, NEW.conclusion_id, NEW.case_id, NEW.client_id, NEW.engagement_id, NEW.tax_year, NEW.lineage_id, NEW.version, NEW.supersedes_id,
      NEW.conclusion_type, NEW.statement, NEW.amount, NEW.prepared_by, NEW.created_at)
     IS DISTINCT FROM (OLD.tenant_id, OLD.conclusion_id, OLD.case_id, OLD.client_id, OLD.engagement_id, OLD.tax_year, OLD.lineage_id, OLD.version, OLD.supersedes_id,
      OLD.conclusion_type, OLD.statement, OLD.amount, OLD.prepared_by, OLD.created_at)
     OR OLD.status IN ('APPROVED','REJECTED','SUPERSEDED') AND NOT (OLD.status = 'APPROVED' AND NEW.status = 'SUPERSEDED')
     OR (NEW.status = 'SUPERSEDED' AND OLD.status NOT IN ('DRAFT','RETURNED','APPROVED')) THEN
    RAISE EXCEPTION 'TAX_CONCLUSION_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_conclusions_guard ON public.taxguard_tax_conclusions;
CREATE TRIGGER trg_taxguard_tax_conclusions_guard BEFORE UPDATE OR DELETE ON public.taxguard_tax_conclusions FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_conclusion_guard();
DROP TRIGGER IF EXISTS trg_taxguard_tax_conclusion_links_guard ON public.taxguard_tax_conclusion_links;
CREATE TRIGGER trg_taxguard_tax_conclusion_links_guard BEFORE UPDATE OR DELETE ON public.taxguard_tax_conclusion_links FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_conclusion_guard();
DROP TRIGGER IF EXISTS trg_taxguard_tax_conclusions_no_truncate ON public.taxguard_tax_conclusions;
CREATE TRIGGER trg_taxguard_tax_conclusions_no_truncate BEFORE TRUNCATE ON public.taxguard_tax_conclusions FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_conclusion_guard();
DROP TRIGGER IF EXISTS trg_taxguard_tax_conclusion_links_no_truncate ON public.taxguard_tax_conclusion_links;
CREATE TRIGGER trg_taxguard_tax_conclusion_links_no_truncate BEFORE TRUNCATE ON public.taxguard_tax_conclusion_links FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_conclusion_guard();

-- What one link resolves to now, for the conclusion's case: a snapshot-comparable object or {"unresolved": reason}.
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_source(p_case public.taxguard_cases, p_type text, p_ref text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; run public.taxguard_tax_calc_runs; m public.taxguard_tax_research_memos; w public.taxguard_b2t_workpapers; rid uuid;
BEGIN
  IF p_type = 'EVIDENCE' THEN RETURN public.taxguard_tax_evidence_resolve(c, p_ref, NULL); END IF;
  BEGIN rid := p_ref::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('unresolved', 'NOT_FOUND'); END;
  IF p_type = 'CALCULATION' THEN
    SELECT * INTO run FROM public.taxguard_tax_calc_runs WHERE tenant_id = c.tenant_id AND run_id = rid AND case_id = c.case_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('unresolved', 'NOT_FOUND'); END IF;
    IF run.status = 'REVIEW_REJECTED' THEN RETURN jsonb_build_object('unresolved', 'CALCULATION_REJECTED'); END IF;
    IF public.taxguard_tax_unresolved_citations(public.taxguard_tax_run_citations(c, run.inputs)) IS NOT NULL THEN
      RETURN jsonb_build_object('unresolved', 'CALCULATION_EVIDENCE_STALE');
    END IF;
    RETURN jsonb_build_object('runId', run.run_id, 'status', run.status, 'ruleSetId', run.rule_set_id, 'ruleSetSha256', run.rule_set_sha256,
      'engineVersion', run.engine_version, 'inputSha256', run.input_sha256, 'outputSha256', run.output_sha256);
  ELSIF p_type = 'RESEARCH' THEN
    SELECT * INTO m FROM public.taxguard_tax_research_memos WHERE tenant_id = c.tenant_id AND memo_id = rid AND case_id = c.case_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('unresolved', 'NOT_FOUND'); END IF;
    IF m.status = 'REJECTED' THEN RETURN jsonb_build_object('unresolved', 'RESEARCH_REJECTED'); END IF;
    RETURN jsonb_build_object('memoId', m.memo_id, 'status', m.status, 'version', m.version,
      'authorityLevels', (SELECT COALESCE(jsonb_agg(DISTINCT x.authority_level), '[]'::jsonb) FROM public.taxguard_tax_research_citations x
        WHERE x.tenant_id = m.tenant_id AND x.memo_id = m.memo_id));
  ELSIF p_type = 'WORKPAPER' THEN
    SELECT * INTO w FROM public.taxguard_b2t_workpapers WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND workpaper_id = rid
      AND tax_year = c.tax_year AND (case_id IS NULL OR case_id = c.case_id);
    IF NOT FOUND THEN RETURN jsonb_build_object('unresolved', 'NOT_FOUND'); END IF;
    IF w.status IN ('REJECTED','SUPERSEDED') THEN RETURN jsonb_build_object('unresolved', 'WORKPAPER_' || w.status); END IF;
    RETURN jsonb_build_object('workpaperId', w.workpaper_id, 'status', w.status, 'snapshotSha256', w.snapshot_sha256, 'returnFamily', w.return_family);
  END IF;
  RETURN jsonb_build_object('unresolved', 'UNRECOGNISED_REFERENCE');
END $$;

-- The identity part of a resolution: what must not change after linking (status may move forward).
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_identity(p_type text, p_resolution jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE p_type
    WHEN 'EVIDENCE' THEN p_resolution - 'decidedBy'
    WHEN 'CALCULATION' THEN p_resolution - 'status'
    WHEN 'RESEARCH' THEN p_resolution - 'status' - 'authorityLevels'
    WHEN 'WORKPAPER' THEN p_resolution - 'status'
  END $$;

-- [{type, ref, reason}] for every link whose source no longer matches its snapshot.
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_stale(p_tenant text, p_conclusion uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k public.taxguard_tax_conclusions; c public.taxguard_cases; l record; now_ jsonb; out jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO k FROM public.taxguard_tax_conclusions WHERE tenant_id = p_tenant AND conclusion_id = p_conclusion;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = k.case_id;
  FOR l IN SELECT * FROM public.taxguard_tax_conclusion_links WHERE tenant_id = p_tenant AND conclusion_id = p_conclusion ORDER BY link_type COLLATE "C", ref COLLATE "C" LOOP
    now_ := public.taxguard_tax_conclusion_source(c, l.link_type, l.ref);
    IF now_ ? 'unresolved' THEN
      out := out || jsonb_build_object('type', l.link_type, 'ref', l.ref, 'reason', now_->>'unresolved');
    ELSIF public.taxguard_tax_conclusion_identity(l.link_type, now_) IS DISTINCT FROM public.taxguard_tax_conclusion_identity(l.link_type, l.snapshot) THEN
      out := out || jsonb_build_object('type', l.link_type, 'ref', l.ref, 'reason', 'SOURCE_CHANGED');
    END IF;
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_json(p_tenant text, p_conclusion uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('conclusionId', k.conclusion_id, 'lineageId', k.lineage_id, 'version', k.version, 'supersedesId', k.supersedes_id,
    'caseId', k.case_id, 'clientId', k.client_id, 'engagementId', k.engagement_id, 'taxYear', k.tax_year, 'type', k.conclusion_type,
    'statement', k.statement, 'amount', CASE WHEN k.amount IS NULL THEN NULL ELSE k.amount::text END, 'status', k.status,
    'preparedBy', k.prepared_by, 'submittedAt', k.submitted_at, 'reviewedBy', k.reviewed_by, 'reviewedAt', k.reviewed_at, 'reviewNote', k.review_note,
    'createdAt', k.created_at, 'stale', CASE WHEN k.status = 'SUPERSEDED' THEN '[]'::jsonb ELSE public.taxguard_tax_conclusion_stale(k.tenant_id, k.conclusion_id) END,
    'links', (SELECT COALESCE(jsonb_agg(jsonb_build_object('type', l.link_type, 'ref', l.ref, 'snapshot', l.snapshot) ORDER BY l.link_type COLLATE "C", l.ref COLLATE "C"), '[]'::jsonb)
      FROM public.taxguard_tax_conclusion_links l WHERE l.tenant_id = k.tenant_id AND l.conclusion_id = k.conclusion_id),
    'returnUse', 'BLOCKED')
  FROM public.taxguard_tax_conclusions k WHERE k.tenant_id = p_tenant AND k.conclusion_id = p_conclusion $$;

-- Loads a conclusion for an actor of its case; anything else reads as not found.
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_scope(p_tenant text, p_actor text, p_conclusion uuid, p_lock boolean,
  OUT actor_role text, OUT k public.taxguard_tax_conclusions, OUT c public.taxguard_cases)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record;
BEGIN
  IF p_lock THEN SELECT * INTO k FROM public.taxguard_tax_conclusions WHERE tenant_id = p_tenant AND conclusion_id = p_conclusion FOR UPDATE;
  ELSE SELECT * INTO k FROM public.taxguard_tax_conclusions WHERE tenant_id = p_tenant AND conclusion_id = p_conclusion; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_CONCLUSION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, k.case_id, p_actor);
    actor_role := a.actor_role; c := a.c;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'TAX_CONCLUSION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
END $$;

-- Validates and records the links of a new conclusion version.
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_link_all(p_case public.taxguard_cases, p_conclusion uuid, p_links jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE l jsonb; res jsonb; evidence integer := 0; n integer := 0;
BEGIN
  IF p_links IS NULL OR jsonb_typeof(p_links) <> 'array' OR jsonb_array_length(p_links) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'TAX_CONCLUSION_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  FOR l IN SELECT value FROM jsonb_array_elements(p_links) LOOP
    IF jsonb_typeof(l) <> 'object' OR COALESCE(l->>'type', '') NOT IN ('EVIDENCE','CALCULATION','RESEARCH','WORKPAPER') OR COALESCE(l->>'ref', '') !~ '^[A-Za-z0-9_.:-]{3,160}$' THEN
      RAISE EXCEPTION 'TAX_CONCLUSION_INPUT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    res := public.taxguard_tax_conclusion_source(p_case, l->>'type', l->>'ref');
    IF res ? 'unresolved' THEN
      RAISE EXCEPTION 'TAX_CONCLUSION_SOURCE_UNRESOLVED' USING ERRCODE = 'P0001', DETAIL = (l->>'type') || '|' || (l->>'ref') || '|' || (res->>'unresolved');
    END IF;
    BEGIN
      INSERT INTO public.taxguard_tax_conclusion_links(tenant_id, conclusion_id, link_type, ref, snapshot) VALUES (p_case.tenant_id, p_conclusion, l->>'type', l->>'ref', res);
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'TAX_CONCLUSION_INPUT_INVALID' USING ERRCODE = 'P0001';
    END;
    IF l->>'type' = 'EVIDENCE' THEN evidence := evidence + 1; END IF;
    n := n + 1;
  END LOOP;
  IF evidence = 0 THEN RAISE EXCEPTION 'TAX_CONCLUSION_EVIDENCE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
END $$;

-- The case's live preparer proposes a conclusion (version 1 of a new lineage).
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_propose(p_tenant text, p_actor text, p_case text, p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; id uuid := gen_random_uuid(); amt numeric;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor); c := a.c;
  IF p_actor IS DISTINCT FROM c.preparer_uid THEN RAISE EXCEPTION 'TAX_CONCLUSION_PREPARER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_body IS NULL OR jsonb_typeof(p_body) <> 'object' OR (p_body ? 'amount' AND p_body->'amount' <> 'null'::jsonb
      AND (jsonb_typeof(p_body->'amount') <> 'string' OR (p_body->>'amount') !~ '^-?[0-9]{1,13}(\.[0-9]{1,2})?$')) THEN
    RAISE EXCEPTION 'TAX_CONCLUSION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  amt := NULLIF(p_body->>'amount', '')::numeric;
  BEGIN
    INSERT INTO public.taxguard_tax_conclusions(tenant_id, conclusion_id, case_id, client_id, engagement_id, tax_year, lineage_id, version, conclusion_type, statement, amount, prepared_by)
      VALUES (p_tenant, id, c.case_id, c.client_id, c.engagement_id, c.tax_year, id, 1, p_body->>'type', btrim(COALESCE(p_body->>'statement', '')), amt, p_actor);
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN RAISE EXCEPTION 'TAX_CONCLUSION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_tax_conclusion_link_all(c, id, p_body->'links');
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, c.case_id, p_actor, a.actor_role, 'TAX_CONCLUSION_PROPOSED',
    jsonb_build_object('conclusionId', id, 'version', 1, 'type', p_body->>'type', 'links', jsonb_array_length(p_body->'links')));
  RETURN public.taxguard_tax_conclusion_json(p_tenant, id);
END $$;

-- The preparer revises a draft, returned, rejected or approved (for example stale) conclusion into a new version. A draft,
-- returned or approved predecessor becomes SUPERSEDED; a rejected one stays rejected. History and links of every version remain.
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_revise(p_tenant text, p_actor text, p_conclusion uuid, p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; k public.taxguard_tax_conclusions; c public.taxguard_cases; id uuid := gen_random_uuid(); amt numeric;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_conclusion_scope(p_tenant, p_actor, p_conclusion, true); k := s.k; c := s.c;
  IF p_actor IS DISTINCT FROM c.preparer_uid THEN RAISE EXCEPTION 'TAX_CONCLUSION_PREPARER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF k.status IN ('READY_FOR_REVIEW','SUPERSEDED') THEN RAISE EXCEPTION 'TAX_CONCLUSION_NOT_REVISABLE' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.taxguard_tax_conclusions WHERE tenant_id = p_tenant AND supersedes_id = p_conclusion) THEN
    RAISE EXCEPTION 'TAX_CONCLUSION_NOT_REVISABLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_body IS NULL OR jsonb_typeof(p_body) <> 'object' OR (p_body ? 'amount' AND p_body->'amount' <> 'null'::jsonb
      AND (jsonb_typeof(p_body->'amount') <> 'string' OR (p_body->>'amount') !~ '^-?[0-9]{1,13}(\.[0-9]{1,2})?$')) THEN
    RAISE EXCEPTION 'TAX_CONCLUSION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  amt := NULLIF(p_body->>'amount', '')::numeric;
  IF k.status IN ('DRAFT','RETURNED','APPROVED') THEN UPDATE public.taxguard_tax_conclusions SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND conclusion_id = p_conclusion; END IF;
  BEGIN
    INSERT INTO public.taxguard_tax_conclusions(tenant_id, conclusion_id, case_id, client_id, engagement_id, tax_year, lineage_id, version, supersedes_id, conclusion_type, statement, amount, prepared_by)
      VALUES (p_tenant, id, k.case_id, k.client_id, k.engagement_id, k.tax_year, k.lineage_id, k.version + 1, p_conclusion,
        COALESCE(p_body->>'type', k.conclusion_type), btrim(COALESCE(p_body->>'statement', k.statement)), CASE WHEN p_body ? 'amount' THEN amt ELSE k.amount END, p_actor);
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN RAISE EXCEPTION 'TAX_CONCLUSION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_tax_conclusion_link_all(c, id, p_body->'links');
  PERFORM public.taxguard_case_audit(p_tenant, k.client_id, k.case_id, p_actor, s.actor_role, 'TAX_CONCLUSION_REVISED',
    jsonb_build_object('conclusionId', id, 'version', k.version + 1, 'supersedes', p_conclusion, 'previousStatus', k.status));
  RETURN public.taxguard_tax_conclusion_json(p_tenant, id);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_submit(p_tenant text, p_actor text, p_conclusion uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; k public.taxguard_tax_conclusions; c public.taxguard_cases; stale jsonb;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_conclusion_scope(p_tenant, p_actor, p_conclusion, true); k := s.k; c := s.c;
  IF p_actor IS DISTINCT FROM c.preparer_uid THEN RAISE EXCEPTION 'TAX_CONCLUSION_PREPARER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF k.status <> 'DRAFT' THEN RAISE EXCEPTION 'TAX_CONCLUSION_NOT_DRAFT' USING ERRCODE = 'P0001'; END IF;
  stale := public.taxguard_tax_conclusion_stale(p_tenant, p_conclusion);
  IF jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_CONCLUSION_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
  UPDATE public.taxguard_tax_conclusions SET status = 'READY_FOR_REVIEW', submitted_at = now() WHERE tenant_id = p_tenant AND conclusion_id = p_conclusion;
  PERFORM public.taxguard_case_audit(p_tenant, k.client_id, k.case_id, p_actor, s.actor_role, 'TAX_CONCLUSION_SUBMITTED',
    jsonb_build_object('conclusionId', p_conclusion, 'version', k.version, 'previousStatus', 'DRAFT', 'status', 'READY_FOR_REVIEW'));
  RETURN public.taxguard_tax_conclusion_json(p_tenant, p_conclusion);
END $$;

-- The case's live, independent reviewer decides. Approval needs current (not stale) sources, approved calculation
-- runs, approved research and approved workpapers. Return and reject need a note.
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_review(p_tenant text, p_actor text, p_conclusion uuid, p_decision text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; k public.taxguard_tax_conclusions; c public.taxguard_cases; stale jsonb; pending text; note text := btrim(COALESCE(p_note, '')); next_status text;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_conclusion_scope(p_tenant, p_actor, p_conclusion, true); k := s.k; c := s.c;
  IF p_actor IS DISTINCT FROM c.reviewer_uid OR NOT public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor) THEN
    RAISE EXCEPTION 'TAX_CONCLUSION_REVIEWER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_actor = k.prepared_by THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF k.status <> 'READY_FOR_REVIEW' THEN RAISE EXCEPTION 'TAX_CONCLUSION_NOT_SUBMITTED' USING ERRCODE = 'P0001'; END IF;
  IF p_decision NOT IN ('approve','return','reject') OR (p_decision <> 'approve' AND length(note) < 10) OR length(note) > 2000 THEN
    RAISE EXCEPTION 'TAX_CONCLUSION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_decision = 'approve' THEN
    stale := public.taxguard_tax_conclusion_stale(p_tenant, p_conclusion);
    IF jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_CONCLUSION_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
    SELECT string_agg(l.link_type || '|' || l.ref, ',' ORDER BY l.link_type COLLATE "C", l.ref COLLATE "C") INTO pending
      FROM public.taxguard_tax_conclusion_links l
      LEFT JOIN public.taxguard_tax_calc_runs r ON l.link_type = 'CALCULATION' AND r.tenant_id = l.tenant_id AND r.run_id::text = l.ref
      LEFT JOIN public.taxguard_tax_research_memos m ON l.link_type = 'RESEARCH' AND m.tenant_id = l.tenant_id AND m.memo_id::text = l.ref
      LEFT JOIN public.taxguard_b2t_workpapers w ON l.link_type = 'WORKPAPER' AND w.tenant_id = l.tenant_id AND w.client_id = k.client_id AND w.workpaper_id::text = l.ref
      WHERE l.tenant_id = p_tenant AND l.conclusion_id = p_conclusion
        AND ((l.link_type = 'CALCULATION' AND r.status IS DISTINCT FROM 'REVIEW_APPROVED') OR (l.link_type = 'RESEARCH' AND m.status IS DISTINCT FROM 'APPROVED')
          OR (l.link_type = 'WORKPAPER' AND w.status IS DISTINCT FROM 'APPROVED'));
    IF pending IS NOT NULL THEN RAISE EXCEPTION 'TAX_CONCLUSION_SOURCES_NOT_APPROVED' USING ERRCODE = 'P0001', DETAIL = pending; END IF;
  END IF;
  next_status := CASE p_decision WHEN 'approve' THEN 'APPROVED' WHEN 'return' THEN 'RETURNED' ELSE 'REJECTED' END;
  UPDATE public.taxguard_tax_conclusions SET status = next_status, reviewed_by = p_actor, reviewed_at = now(), review_note = NULLIF(note, '')
    WHERE tenant_id = p_tenant AND conclusion_id = p_conclusion;
  PERFORM public.taxguard_case_audit(p_tenant, k.client_id, k.case_id, p_actor, s.actor_role, 'TAX_CONCLUSION_' || next_status,
    jsonb_build_object('conclusionId', p_conclusion, 'version', k.version, 'previousStatus', 'READY_FOR_REVIEW', 'status', next_status));
  RETURN public.taxguard_tax_conclusion_json(p_tenant, p_conclusion);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_list(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_tax_conclusion_json(p_tenant, k.conclusion_id) ORDER BY k.created_at DESC, k.version DESC), '[]'::jsonb)
    FROM public.taxguard_tax_conclusions k WHERE k.tenant_id = p_tenant AND k.case_id = p_case);
END $$;

-- Backward trace: the conclusion, every version of its lineage, and for each link the snapshot, the source as it is
-- now and its own lineage (calculation inputs; research citations; the evidence's document).
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_trace(p_tenant text, p_actor text, p_conclusion uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; k public.taxguard_tax_conclusions; c public.taxguard_cases;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_conclusion_scope(p_tenant, p_actor, p_conclusion, false); k := s.k; c := s.c;
  RETURN jsonb_build_object('conclusion', public.taxguard_tax_conclusion_json(p_tenant, p_conclusion),
    'sources', (SELECT COALESCE(jsonb_agg(jsonb_build_object('type', l.link_type, 'ref', l.ref, 'snapshot', l.snapshot,
        'current', public.taxguard_tax_conclusion_source(c, l.link_type, l.ref),
        'detail', CASE l.link_type
          WHEN 'CALCULATION' THEN (SELECT jsonb_build_object('inputs', public.taxguard_tax_run_citations(c, r.inputs), 'outputs', r.outputs)
            FROM public.taxguard_tax_calc_runs r WHERE r.tenant_id = p_tenant AND r.run_id::text = l.ref)
          WHEN 'RESEARCH' THEN (SELECT jsonb_build_object('question', m.question, 'conclusion', m.conclusion,
              'citations', (SELECT COALESCE(jsonb_agg(jsonb_build_object('authorityLevel', x.authority_level, 'sourceId', x.source_id, 'reference', x.reference) ORDER BY x.citation_no), '[]'::jsonb)
                FROM public.taxguard_tax_research_citations x WHERE x.tenant_id = m.tenant_id AND x.memo_id = m.memo_id))
            FROM public.taxguard_tax_research_memos m WHERE m.tenant_id = p_tenant AND m.memo_id::text = l.ref)
          ELSE NULL END) ORDER BY l.link_type COLLATE "C", l.ref COLLATE "C"), '[]'::jsonb)
      FROM public.taxguard_tax_conclusion_links l WHERE l.tenant_id = p_tenant AND l.conclusion_id = p_conclusion),
    'versions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('conclusionId', v.conclusion_id, 'version', v.version, 'status', v.status, 'reviewedBy', v.reviewed_by,
        'reviewedAt', v.reviewed_at, 'createdAt', v.created_at) ORDER BY v.version), '[]'::jsonb)
      FROM public.taxguard_tax_conclusions v WHERE v.tenant_id = p_tenant AND v.lineage_id = k.lineage_id),
    'formLines', (SELECT COALESCE(jsonb_agg(jsonb_build_object('formId', f.form_id, 'formVersion', f.form_version, 'line', f.line) ORDER BY f.form_id, f.line), '[]'::jsonb)
      FROM public.taxguard_tax_form_line_sources f WHERE f.tenant_id = p_tenant AND f.conclusion_id = p_conclusion),
    'audit', (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', g.action, 'actorUid', g.actor_uid, 'actorRole', g.actor_role, 'at', g."timestamp",
        'version', g.metadata->'version') ORDER BY g."timestamp", g.action), '[]'::jsonb)
      FROM public.taxguard_audit_log g WHERE g.tenant_id = p_tenant AND g.case_id = k.case_id AND g.action LIKE 'TAX_CONCLUSION_%'
        AND (g.metadata->>'conclusionId') IN (SELECT v.conclusion_id::text FROM public.taxguard_tax_conclusions v WHERE v.tenant_id = p_tenant AND v.lineage_id = k.lineage_id)),
    'returnUse', 'BLOCKED');
END $$;

-- Forward trace: every conclusion of the case that depends on a piece of evidence, directly or through a calculation
-- run whose inputs cite it, with its current staleness.
CREATE OR REPLACE FUNCTION public.taxguard_tax_evidence_trace(p_tenant text, p_actor text, p_case text, p_ref text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  IF p_ref IS NULL OR p_ref !~ '^(extraction|document):[A-Za-z0-9_-]{1,119}$' THEN RAISE EXCEPTION 'TAX_CONCLUSION_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object('ref', p_ref, 'current', public.taxguard_tax_evidence_resolve(a.c, p_ref, NULL),
    'calculationRuns', (SELECT COALESCE(jsonb_agg(r.run_id ORDER BY r.created_at), '[]'::jsonb) FROM public.taxguard_tax_calc_runs r
      WHERE r.tenant_id = p_tenant AND r.case_id = p_case AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.inputs) i WHERE i->'evidenceIds' ? p_ref)),
    'conclusions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('conclusionId', k.conclusion_id, 'version', k.version, 'status', k.status, 'type', k.conclusion_type,
        'via', CASE WHEN EXISTS (SELECT 1 FROM public.taxguard_tax_conclusion_links l WHERE l.tenant_id = k.tenant_id AND l.conclusion_id = k.conclusion_id AND l.link_type = 'EVIDENCE' AND l.ref = p_ref)
          THEN 'EVIDENCE' ELSE 'CALCULATION' END,
        'stale', CASE WHEN k.status = 'SUPERSEDED' THEN '[]'::jsonb ELSE public.taxguard_tax_conclusion_stale(p_tenant, k.conclusion_id) END) ORDER BY k.created_at, k.version), '[]'::jsonb)
      FROM public.taxguard_tax_conclusions k WHERE k.tenant_id = p_tenant AND k.case_id = p_case AND EXISTS (
        SELECT 1 FROM public.taxguard_tax_conclusion_links l WHERE l.tenant_id = k.tenant_id AND l.conclusion_id = k.conclusion_id
          AND ((l.link_type = 'EVIDENCE' AND l.ref = p_ref) OR (l.link_type = 'CALCULATION' AND EXISTS (SELECT 1 FROM public.taxguard_tax_calc_runs r
            WHERE r.tenant_id = l.tenant_id AND r.run_id::text = l.ref AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.inputs) i WHERE i->'evidenceIds' ? p_ref)))))),
    'returnUse', 'BLOCKED');
END $$;

-- Finalization readiness: every current (non-superseded, non-rejected) conclusion must be approved and not stale.
-- Stages 09-18 remain blocked; this is the check they will require.
CREATE OR REPLACE FUNCTION public.taxguard_tax_conclusion_readiness(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; blockers jsonb;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'conclusionId'), '[]'::jsonb) INTO blockers FROM (
    SELECT jsonb_build_object('conclusionId', k.conclusion_id, 'version', k.version, 'status', k.status,
      'reasons', (CASE WHEN k.status <> 'APPROVED' THEN jsonb_build_array('NOT_APPROVED') ELSE '[]'::jsonb END)
        || (CASE WHEN jsonb_array_length(public.taxguard_tax_conclusion_stale(p_tenant, k.conclusion_id)) > 0 THEN jsonb_build_array('STALE') ELSE '[]'::jsonb END)) AS x
    FROM public.taxguard_tax_conclusions k WHERE k.tenant_id = p_tenant AND k.case_id = p_case AND k.status NOT IN ('SUPERSEDED','REJECTED')) q
  WHERE jsonb_array_length(q.x->'reasons') > 0;
  RETURN jsonb_build_object('caseId', p_case, 'ready', jsonb_array_length(blockers) = 0 AND EXISTS (SELECT 1 FROM public.taxguard_tax_conclusions k
      WHERE k.tenant_id = p_tenant AND k.case_id = p_case AND k.status = 'APPROVED'),
    'conclusions', (SELECT count(*) FROM public.taxguard_tax_conclusions k WHERE k.tenant_id = p_tenant AND k.case_id = p_case AND k.status NOT IN ('SUPERSEDED','REJECTED')),
    'blockers', blockers, 'returnUse', 'BLOCKED');
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND (p.proname LIKE 'taxguard\_tax\_conclusion%' OR p.proname = 'taxguard_tax_evidence_trace') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_conclusion_propose','taxguard_tax_conclusion_revise','taxguard_tax_conclusion_submit','taxguard_tax_conclusion_review',
        'taxguard_tax_conclusion_list','taxguard_tax_conclusion_trace','taxguard_tax_evidence_trace','taxguard_tax_conclusion_readiness') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
