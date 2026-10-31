-- PROPOSAL (Block 88, practice search). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261012250000 (taxguard_practice_actor, taxguard_practice_can_see, taxguard_practice_tasks), 20261012260000
-- (taxguard_cases), 20261012310000 (taxguard_doc_requests) and 20261018100000 (taxguard_staff_record_scope,
-- taxguard_practice_item_scope).
--
-- The in-memory /api/operations/search searched clients, cases, requests, tasks and invoices in process memory (Block
-- 83 and 87 coverage map). taxguard_practice_search searches the durable records, each by the rule that already
-- decides whether the actor may see it (owner decision 2026-10-19):
--   client           name or id; a client the actor can see (taxguard_practice_can_see, as the client list)
--   case             case id or the client's name; the actor's scope over the case's engagement and year
--   task             title; the task's assignee or creator, or the actor's scope over its case, engagement and year
--   document_request title; the actor's scope over the request's engagement and year
-- Invoices are not searched: the billing functions are redefined by Codex's Phase 15 work (CODEX_HANDOFF).
-- The query is 2 to 100 characters, matched case-insensitively as a literal substring (LIKE wildcards in it are
-- escaped). At most p_limit matches (1 to 50) are returned, ordered by entity type and label. Staff only; read only.
-- Rollback (development): drop the function.

CREATE OR REPLACE FUNCTION public.taxguard_practice_search(p_tenant text, p_actor text, p_q text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q text; pattern text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  q := btrim(COALESCE(p_q, ''));
  IF length(q) < 2 OR length(q) > 100 OR p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  pattern := '%' || replace(replace(replace(lower(q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  RETURN (WITH matches AS (
      SELECT 1 AS ord, 'client' AS entity_type, c.client_id AS id, c.client_id, COALESCE(c.name, c.client_id) AS label, NULL::integer AS tax_year, c.status::text AS status
        FROM public.taxguard_clients c
        WHERE c.tenant_id = p_tenant AND (lower(COALESCE(c.name, '')) LIKE pattern OR lower(c.client_id) LIKE pattern)
          AND public.taxguard_practice_can_see(p_tenant, c.client_id, p_actor, r)
      UNION ALL
      SELECT 2, 'case', k.case_id, k.client_id, COALESCE(cl.name, cl.client_id) || ' ' || k.tax_year, k.tax_year, k.status::text
        FROM public.taxguard_cases k JOIN public.taxguard_clients cl ON cl.tenant_id = k.tenant_id AND cl.client_id = k.client_id
        WHERE k.tenant_id = p_tenant AND (lower(k.case_id) LIKE pattern OR lower(COALESCE(cl.name, '')) LIKE pattern)
          AND public.taxguard_staff_record_scope(p_tenant, k.client_id, p_actor, r, k.engagement_id, k.tax_year)
      UNION ALL
      SELECT 3, 'task', t.id, t.client_id, t.title, t.tax_year, t.status::text
        FROM public.taxguard_practice_tasks t
        WHERE t.tenant_id = p_tenant AND lower(t.title) LIKE pattern
          AND (t.assigned_user_id IS NOT DISTINCT FROM p_actor OR t.created_by = p_actor
            OR public.taxguard_practice_item_scope(p_tenant, t.client_id, p_actor, r, t.case_id, t.engagement_id, t.tax_year))
      UNION ALL
      SELECT 4, 'document_request', d.request_id, d.client_id, d.title, d.tax_year, d.status::text
        FROM public.taxguard_doc_requests d
        WHERE d.tenant_id = p_tenant AND lower(d.title) LIKE pattern
          AND public.taxguard_staff_record_scope(p_tenant, d.client_id, p_actor, r, d.engagement_id, d.tax_year)),
    shown AS (SELECT * FROM matches ORDER BY ord, label, id LIMIT p_limit)
    SELECT jsonb_build_object('query', q, 'totalMatches', (SELECT count(*) FROM matches),
      'matches', COALESCE((SELECT jsonb_agg(jsonb_build_object('entityType', s.entity_type, 'id', s.id, 'clientId', s.client_id, 'label', s.label,
          'taxYear', s.tax_year, 'status', s.status) ORDER BY s.ord, s.label, s.id) FROM shown s), '[]'::jsonb),
      'searched', jsonb_build_array('client', 'case', 'task', 'document_request')));
END $$;

REVOKE ALL ON FUNCTION public.taxguard_practice_search(text,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_practice_search(text,text,text,integer) TO service_role;
