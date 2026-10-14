-- PROPOSAL 046 ONLY. NOT APPLIED. Requires proposal 041.
-- Security-event view for the administrative audit center: supersedes taxguard_audit_center_list
-- (generated from proposal 041 with anchored patches) to accept an optional list of categories,
-- e.g. SESSION, STAFF, AUTH, AI, KILL. Only events already recorded in taxguard_audit_log are shown;
-- the legacy in-memory security-event list (lost on restart) is not an authoritative source and is
-- not displayed by the durable administrator views. Redaction, range, page and timeout limits and
-- the administrator-only rule are unchanged.
-- Rollback (development): re-run proposal 041's taxguard_audit_center_list.

-- Filter: {from, to, category?, categories?: [up to 10], action?, actorUid?, clientId?, after?: {at, eventId}, limit?}
CREATE OR REPLACE FUNCTION public.taxguard_audit_center_list(p_tenant text, p_actor text, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp SET statement_timeout = '5s' AS $$
DECLARE f timestamptz; t timestamptz; lim integer; cat text; cats text[]; act text; who text; cli text; after_at timestamptz; after_id uuid; rows jsonb;
BEGIN
  PERFORM public.taxguard_audit_center_admin(p_tenant, p_actor);
  IF p_filter IS NULL OR jsonb_typeof(p_filter) <> 'object' THEN RAISE EXCEPTION 'AUDIT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    f := (p_filter->>'from')::timestamptz; t := (p_filter->>'to')::timestamptz;
    lim := COALESCE((p_filter->>'limit')::integer, 50);
    IF p_filter ? 'after' THEN after_at := (p_filter->'after'->>'at')::timestamptz; after_id := (p_filter->'after'->>'eventId')::uuid; END IF;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'AUDIT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  IF f IS NULL OR t IS NULL OR t <= f OR t - f > interval '92 days' THEN RAISE EXCEPTION 'AUDIT_RANGE_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF lim < 1 OR lim > 100 OR ((after_at IS NULL) <> (after_id IS NULL)) THEN RAISE EXCEPTION 'AUDIT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  cat := NULLIF(p_filter->>'category', '');
  IF p_filter ? 'categories' THEN
    IF jsonb_typeof(p_filter->'categories') <> 'array' OR jsonb_array_length(p_filter->'categories') NOT BETWEEN 1 AND 10
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_filter->'categories') c WHERE jsonb_typeof(c) <> 'string' OR (c #>> '{}') !~ '^[A-Z0-9]{2,32}$') THEN
      RAISE EXCEPTION 'AUDIT_INPUT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    cats := ARRAY(SELECT jsonb_array_elements_text(p_filter->'categories'));
  END IF; act := NULLIF(p_filter->>'action', ''); who := NULLIF(p_filter->>'actorUid', ''); cli := NULLIF(p_filter->>'clientId', '');
  IF (cat IS NOT NULL AND cat !~ '^[A-Z0-9]{2,32}$') OR (act IS NOT NULL AND act !~ '^[A-Z0-9_]{2,128}$') OR (who IS NOT NULL AND who !~ '^[A-Za-z0-9_-]{1,128}$')
    OR (cli IS NOT NULL AND cli !~ '^[A-Za-z0-9_-]{1,64}$') THEN
    RAISE EXCEPTION 'AUDIT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(jsonb_agg(public.taxguard_audit_center_row(x) ORDER BY x.timestamp DESC, x.id DESC), '[]'::jsonb) INTO rows FROM (
    SELECT * FROM public.taxguard_audit_log a WHERE a.tenant_id = p_tenant AND a.timestamp >= f AND a.timestamp < t
      AND (cat IS NULL OR split_part(a.action, '_', 1) = cat) AND (cats IS NULL OR split_part(a.action, '_', 1) = ANY (cats)) AND (act IS NULL OR a.action = act) AND (who IS NULL OR a.actor_uid = who)
      AND (cli IS NULL OR a.metadata->>'clientId' = cli)
      AND (after_at IS NULL OR (a.timestamp, a.id) < (after_at, after_id))
    ORDER BY a.timestamp DESC, a.id DESC LIMIT lim + 1) x;
  RETURN jsonb_build_object('items', (SELECT COALESCE(jsonb_agg(e ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(rows) WITH ORDINALITY AS r(e, ord) WHERE ord <= lim),
    'next', CASE WHEN jsonb_array_length(rows) > lim THEN jsonb_build_object('at', rows->(lim - 1)->'at', 'eventId', rows->(lim - 1)->'eventId') END);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'taxguard_audit_center_list' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
