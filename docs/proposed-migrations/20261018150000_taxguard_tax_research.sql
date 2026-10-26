-- REVIEW-ONLY PROPOSAL. Not applied to any hosted database; owner approval and independent SQL review required.
--
-- Tax research memos: professional-support research for one tax case, never an authoritative position by itself.
--
--   * A memo belongs to one case (tenant, client, engagement, tax year) and is reachable only through the existing case
--     access rule (taxguard_case_actor: a practice manager, or a member with a live assignment to the case). Another
--     client's, year's or tenant's memo is indistinguishable from a missing one (RESEARCH_MEMO_NOT_FOUND).
--   * Every citation states its authority level: AUTHORITATIVE (a VERIFIED source covering the case year),
--     SECONDARY, INTERNAL_GUIDANCE or AI_INFERENCE. AI inference never cites a source and never counts as support.
--   * A memo becomes an approved research conclusion only when the case's reviewer, with a live assignment and not
--     the preparer, approves it, and it has at least one AUTHORITATIVE citation. Approval does not change a return,
--     a calculation or a tax position: returnUse stays BLOCKED.
--   * Approved and rejected memos are immutable; every transition is audited.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_research_memos (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE CASCADE,
  memo_id UUID NOT NULL DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  tax_year INTEGER NOT NULL,
  question VARCHAR(2000) NOT NULL CHECK (length(btrim(question)) >= 10),
  conclusion VARCHAR(8000) CHECK (conclusion IS NULL OR length(btrim(conclusion)) >= 10),
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  prepared_by VARCHAR(128) NOT NULL,
  reviewed_by VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  review_note VARCHAR(2000),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, memo_id),
  CHECK (reviewed_by IS NULL OR reviewed_by <> prepared_by),
  CHECK ((status IN ('APPROVED','REJECTED')) = (reviewed_by IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_research_citations (
  tenant_id VARCHAR(128) NOT NULL,
  memo_id UUID NOT NULL,
  citation_no INTEGER NOT NULL CHECK (citation_no BETWEEN 1 AND 200),
  authority_level VARCHAR(20) NOT NULL CHECK (authority_level IN ('AUTHORITATIVE','SECONDARY','INTERNAL_GUIDANCE','AI_INFERENCE')),
  source_id VARCHAR(80),
  reference VARCHAR(500) CHECK (reference IS NULL OR length(btrim(reference)) >= 3),
  note VARCHAR(2000) NOT NULL CHECK (length(btrim(note)) >= 5),
  added_by VARCHAR(128) NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, memo_id, citation_no),
  FOREIGN KEY (tenant_id, memo_id) REFERENCES public.taxguard_tax_research_memos(tenant_id, memo_id),
  FOREIGN KEY (tenant_id, source_id) REFERENCES public.taxguard_tax_sources(tenant_id, source_id),
  -- Authoritative support names a registered source; AI inference names none; the others name a reference instead.
  CHECK ((authority_level = 'AUTHORITATIVE') = (source_id IS NOT NULL)),
  CHECK (authority_level NOT IN ('SECONDARY','INTERNAL_GUIDANCE') OR reference IS NOT NULL),
  CHECK (authority_level <> 'AI_INFERENCE' OR (source_id IS NULL AND reference IS NULL))
);

ALTER TABLE public.taxguard_tax_research_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_research_citations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_research_memos, public.taxguard_tax_research_citations FROM PUBLIC, anon, authenticated;

-- Decided memos are immutable, and citations change only while their memo is a draft.
CREATE OR REPLACE FUNCTION public.taxguard_tax_research_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE st text;
BEGIN
  IF TG_TABLE_NAME = 'taxguard_tax_research_memos' THEN
    IF TG_OP = 'DELETE' OR OLD.status IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'RESEARCH_MEMO_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
    RETURN NEW;
  END IF;
  SELECT status INTO st FROM public.taxguard_tax_research_memos WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) AND memo_id = COALESCE(NEW.memo_id, OLD.memo_id);
  IF TG_OP <> 'INSERT' OR st IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'RESEARCH_MEMO_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_research_memos_guard ON public.taxguard_tax_research_memos;
CREATE TRIGGER trg_taxguard_tax_research_memos_guard BEFORE UPDATE OR DELETE ON public.taxguard_tax_research_memos FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_research_guard();
DROP TRIGGER IF EXISTS trg_taxguard_tax_research_citations_guard ON public.taxguard_tax_research_citations;
CREATE TRIGGER trg_taxguard_tax_research_citations_guard BEFORE INSERT OR UPDATE OR DELETE ON public.taxguard_tax_research_citations FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_research_guard();

-- The memo as its readers see it: citations in order, and an explicit statement that it changes no return.
CREATE OR REPLACE FUNCTION public.taxguard_tax_research_json(p_tenant text, p_memo uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT (to_jsonb(m) - 'tenant_id') || jsonb_build_object('returnUse', 'BLOCKED', 'citations', COALESCE((
    SELECT jsonb_agg((to_jsonb(ci) - 'tenant_id' - 'memo_id') ORDER BY ci.citation_no) FROM public.taxguard_tax_research_citations ci
     WHERE ci.tenant_id = m.tenant_id AND ci.memo_id = m.memo_id), '[]'::jsonb))
  FROM public.taxguard_tax_research_memos m WHERE m.tenant_id = p_tenant AND m.memo_id = p_memo $$;

-- Resolves a memo through its case's access rule; anything out of scope reads as not found.
CREATE OR REPLACE FUNCTION public.taxguard_tax_research_scope(p_tenant text, p_actor text, p_memo uuid, OUT actor_role text, OUT m public.taxguard_tax_research_memos, OUT c public.taxguard_cases)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record;
BEGIN
  SELECT * INTO m FROM public.taxguard_tax_research_memos WHERE tenant_id = p_tenant AND memo_id = p_memo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESEARCH_MEMO_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, m.case_id, p_actor);
    actor_role := a.actor_role; c := a.c;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'RESEARCH_MEMO_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_research_open(p_tenant text, p_actor text, p_case text, p_question text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; r text; c public.taxguard_cases; id uuid;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  r := a.actor_role; c := a.c;
  IF p_question IS NULL OR length(btrim(p_question)) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'RESEARCH_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_tax_research_memos(tenant_id, case_id, client_id, tax_year, question, prepared_by)
    VALUES (p_tenant, c.case_id, c.client_id, c.tax_year, btrim(p_question), p_actor) RETURNING memo_id INTO id;
  PERFORM public.taxguard_tax_audit(p_tenant, c.client_id, p_actor, r, 'TAX_RESEARCH_OPENED', jsonb_build_object('memoId', id, 'caseId', c.case_id));
  RETURN public.taxguard_tax_research_json(p_tenant, id);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_research_cite(p_tenant text, p_actor text, p_memo uuid, p_citation jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; level text; src text; ref text; note text; n integer; src_row public.taxguard_tax_sources;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_research_scope(p_tenant, p_actor, p_memo);
  IF (s.m).status <> 'DRAFT' OR p_actor IS DISTINCT FROM (s.m).prepared_by THEN RAISE EXCEPTION 'RESEARCH_MEMO_NOT_EDITABLE' USING ERRCODE = 'P0001'; END IF;
  level := p_citation->>'authorityLevel'; src := NULLIF(btrim(p_citation->>'sourceId'), ''); ref := NULLIF(btrim(p_citation->>'reference'), ''); note := btrim(COALESCE(p_citation->>'note', ''));
  IF level NOT IN ('AUTHORITATIVE','SECONDARY','INTERNAL_GUIDANCE','AI_INFERENCE') OR length(note) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'RESEARCH_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  -- Nothing supplied is silently dropped: AI inference cites nothing, only authoritative support names a registered source,
  -- and secondary or internal support names a reference.
  IF (level = 'AI_INFERENCE' AND (src IS NOT NULL OR ref IS NOT NULL)) OR (level <> 'AUTHORITATIVE' AND src IS NOT NULL)
     OR (level IN ('SECONDARY','INTERNAL_GUIDANCE') AND ref IS NULL) OR (level = 'AUTHORITATIVE' AND src IS NULL) THEN
    RAISE EXCEPTION 'RESEARCH_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF level = 'AUTHORITATIVE' THEN
    SELECT * INTO src_row FROM public.taxguard_tax_sources WHERE tenant_id = p_tenant AND source_id = src;
    -- Authoritative support must be a verified, non-synthetic source that covers the case year.
    IF NOT FOUND OR src_row.status <> 'VERIFIED' OR NOT ((s.m).tax_year = ANY (src_row.tax_years)) THEN
      RAISE EXCEPTION 'RESEARCH_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  SELECT COALESCE(max(citation_no), 0) + 1 INTO n FROM public.taxguard_tax_research_citations WHERE tenant_id = p_tenant AND memo_id = p_memo;
  INSERT INTO public.taxguard_tax_research_citations(tenant_id, memo_id, citation_no, authority_level, source_id, reference, note, added_by)
    VALUES (p_tenant, p_memo, n, level, CASE WHEN level = 'AUTHORITATIVE' THEN src END, CASE WHEN level IN ('SECONDARY','INTERNAL_GUIDANCE') THEN ref END, note, p_actor);
  RETURN public.taxguard_tax_research_json(p_tenant, p_memo);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_research_submit(p_tenant text, p_actor text, p_memo uuid, p_conclusion text, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_research_scope(p_tenant, p_actor, p_memo);
  IF (s.m).status <> 'DRAFT' OR p_actor IS DISTINCT FROM (s.m).prepared_by THEN RAISE EXCEPTION 'RESEARCH_MEMO_NOT_EDITABLE' USING ERRCODE = 'P0001'; END IF;
  IF p_version IS DISTINCT FROM (s.m).version THEN RAISE EXCEPTION 'RESEARCH_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF p_conclusion IS NULL OR length(btrim(p_conclusion)) NOT BETWEEN 10 AND 8000 THEN RAISE EXCEPTION 'RESEARCH_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_tax_research_memos SET status = 'SUBMITTED', conclusion = btrim(p_conclusion), version = version + 1 WHERE tenant_id = p_tenant AND memo_id = p_memo;
  PERFORM public.taxguard_tax_audit(p_tenant, (s.m).client_id, p_actor, s.actor_role, 'TAX_RESEARCH_SUBMITTED', jsonb_build_object('memoId', p_memo, 'caseId', (s.m).case_id));
  RETURN public.taxguard_tax_research_json(p_tenant, p_memo);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_research_review(p_tenant text, p_actor text, p_memo uuid, p_decision text, p_note text, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_research_scope(p_tenant, p_actor, p_memo);
  IF p_actor IS DISTINCT FROM (s.c).reviewer_uid OR NOT public.taxguard_case_slot_live(p_tenant, (s.c).client_id, (s.c).engagement_id, (s.c).tax_year, (s.c).preparer_uid, (s.c).reviewer_uid, p_actor) THEN
    RAISE EXCEPTION 'RESEARCH_REVIEWER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_actor = (s.m).prepared_by THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF (s.m).status <> 'SUBMITTED' THEN RAISE EXCEPTION 'RESEARCH_MEMO_NOT_SUBMITTED' USING ERRCODE = 'P0001'; END IF;
  IF p_version IS DISTINCT FROM (s.m).version THEN RAISE EXCEPTION 'RESEARCH_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF p_decision NOT IN ('approve','reject') OR length(btrim(COALESCE(p_note, ''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'RESEARCH_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  -- AI inference, secondary authority and internal guidance never carry an approval on their own.
  IF p_decision = 'approve' AND NOT EXISTS (SELECT 1 FROM public.taxguard_tax_research_citations ci JOIN public.taxguard_tax_sources so
      ON so.tenant_id = ci.tenant_id AND so.source_id = ci.source_id
     WHERE ci.tenant_id = p_tenant AND ci.memo_id = p_memo AND ci.authority_level = 'AUTHORITATIVE' AND so.status = 'VERIFIED' AND (s.m).tax_year = ANY (so.tax_years)) THEN
    RAISE EXCEPTION 'RESEARCH_AUTHORITY_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.taxguard_tax_research_memos SET status = CASE p_decision WHEN 'approve' THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(),
      review_note = btrim(p_note), version = version + 1 WHERE tenant_id = p_tenant AND memo_id = p_memo;
  PERFORM public.taxguard_tax_audit(p_tenant, (s.m).client_id, p_actor, s.actor_role, 'TAX_RESEARCH_' || upper(p_decision) || 'D', jsonb_build_object('memoId', p_memo, 'caseId', (s.m).case_id));
  RETURN public.taxguard_tax_research_json(p_tenant, p_memo);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_research_list(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  c := a.c;
  RETURN COALESCE((SELECT jsonb_agg(public.taxguard_tax_research_json(p_tenant, m.memo_id) ORDER BY m.created_at DESC)
    FROM public.taxguard_tax_research_memos m WHERE m.tenant_id = p_tenant AND m.case_id = c.case_id), '[]'::jsonb);
END $$;

DO $$
DECLARE f text;
BEGIN
  -- Revoking from PUBLIC alone leaves Supabase's anon and authenticated grants in place, so every function, including
  -- the trigger function, is revoked from all three.
  FOREACH f IN ARRAY ARRAY['taxguard_tax_research_guard()','taxguard_tax_research_json(text,uuid)','taxguard_tax_research_scope(text,text,uuid)','taxguard_tax_research_open(text,text,text,text)',
    'taxguard_tax_research_cite(text,text,uuid,jsonb)','taxguard_tax_research_submit(text,text,uuid,text,integer)',
    'taxguard_tax_research_review(text,text,uuid,text,text,integer)','taxguard_tax_research_list(text,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['taxguard_tax_research_open(text,text,text,text)','taxguard_tax_research_cite(text,text,uuid,jsonb)',
    'taxguard_tax_research_submit(text,text,uuid,text,integer)','taxguard_tax_research_review(text,text,uuid,text,text,integer)','taxguard_tax_research_list(text,text,text)'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
