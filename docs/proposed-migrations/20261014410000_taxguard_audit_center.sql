-- PROPOSAL 041 ONLY. NOT APPLIED. Requires the actual core schema.
-- Read-only administrative audit center over taxguard_audit_log.
--
--   * Administrators only (admin, administrator, super_admin, super_administrator, active member of
--     the tenant). Rows of other tenants are never read.
--   * Redaction by allow-list: only these metadata keys are returned, and only when the value is a
--     short scalar of safe characters: identifiers (clientId, caseId, engagementId, appointmentId,
--     threadId, messageId, requestId, jobId, documentId, invoiceId, ruleSetId, sourceId, testId,
--     uid, targetUid, sessionId) and codes (status, visibility, category, version, taxYear, stage,
--     action, decision, removedFactors, revokedSessions). Everything else — reasons, notes, message or
--     document content, amounts, e-mail addresses, IP addresses, hashes, tokens, factor or secret
--     material, and any key not listed — is withheld and only counted (redactedFields).
--   * Filters: time range (at most 92 days), category (the action's first word), exact action, actor,
--     client; keyset pagination on (timestamp, id); at most 100 rows a page; statement timeout 5 s.
--   * Historical rows are only read here. Append-only protection of taxguard_audit_log itself is
--     the separate proposal docs/sql/taxguard-audit-append-only.proposal.sql.
-- Rollback (development): drop the taxguard_audit_center_* functions and the two indexes.

CREATE INDEX IF NOT EXISTS idx_taxguard_audit_tenant_actor ON public.taxguard_audit_log(tenant_id, actor_uid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_taxguard_audit_tenant_client ON public.taxguard_audit_log(tenant_id, (metadata->>'clientId'), timestamp DESC);

CREATE OR REPLACE FUNCTION public.taxguard_audit_center_admin(p_tenant text, p_actor text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RAISE EXCEPTION 'AUDIT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT m.role INTO r FROM public.taxguard_members m JOIN public.taxguard_tenants t ON t.id = m.tenant_id AND t.status = 'active'
    WHERE m.tenant_id = p_tenant AND m.uid = p_actor AND m.status = 'active';
  IF NOT FOUND OR r NOT IN ('admin','administrator','super_admin','super_administrator') THEN RAISE EXCEPTION 'AUDIT_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_audit_center_redact(p_meta jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  WITH kv AS (SELECT key, value FROM jsonb_each(CASE WHEN jsonb_typeof(p_meta) = 'object' THEN p_meta ELSE '{}'::jsonb END)),
  kept AS (SELECT key, value FROM kv WHERE key IN ('clientId','caseId','engagementId','appointmentId','threadId','messageId','requestId','jobId','documentId',
      'invoiceId','ruleSetId','sourceId','testId','uid','targetUid','sessionId','status','visibility','category','version','taxYear','stage','action','decision',
      'removedFactors','revokedSessions')
    AND ((jsonb_typeof(value) = 'string' AND (value #>> '{}') ~ '^[A-Za-z0-9_.:-]{1,128}$') OR jsonb_typeof(value) IN ('number','boolean')))
  SELECT jsonb_build_object('fields', COALESCE((SELECT jsonb_object_agg(key, value) FROM kept), '{}'::jsonb),
    'redactedFields', (SELECT count(*) FROM kv) - (SELECT count(*) FROM kept)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_audit_center_row(a public.taxguard_audit_log) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('eventId', a.id, 'at', a.timestamp, 'action', a.action, 'category', split_part(a.action, '_', 1), 'actorUid', a.actor_uid,
    'actorRole', a.actor_role, 'caseId', a.case_id, 'clientId', CASE WHEN (a.metadata->>'clientId') ~ '^[A-Za-z0-9_-]{1,64}$' THEN a.metadata->>'clientId' END)
  || public.taxguard_audit_center_redact(a.metadata) $$;

-- Filter: {from, to, category?, action?, actorUid?, clientId?, after?: {at, eventId}, limit?}
CREATE OR REPLACE FUNCTION public.taxguard_audit_center_list(p_tenant text, p_actor text, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp SET statement_timeout = '5s' AS $$
DECLARE f timestamptz; t timestamptz; lim integer; cat text; act text; who text; cli text; after_at timestamptz; after_id uuid; rows jsonb;
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
  cat := NULLIF(p_filter->>'category', ''); act := NULLIF(p_filter->>'action', ''); who := NULLIF(p_filter->>'actorUid', ''); cli := NULLIF(p_filter->>'clientId', '');
  IF (cat IS NOT NULL AND cat !~ '^[A-Z0-9]{2,32}$') OR (act IS NOT NULL AND act !~ '^[A-Z0-9_]{2,128}$') OR (who IS NOT NULL AND who !~ '^[A-Za-z0-9_-]{1,128}$')
    OR (cli IS NOT NULL AND cli !~ '^[A-Za-z0-9_-]{1,64}$') THEN
    RAISE EXCEPTION 'AUDIT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(jsonb_agg(public.taxguard_audit_center_row(x) ORDER BY x.timestamp DESC, x.id DESC), '[]'::jsonb) INTO rows FROM (
    SELECT * FROM public.taxguard_audit_log a WHERE a.tenant_id = p_tenant AND a.timestamp >= f AND a.timestamp < t
      AND (cat IS NULL OR split_part(a.action, '_', 1) = cat) AND (act IS NULL OR a.action = act) AND (who IS NULL OR a.actor_uid = who)
      AND (cli IS NULL OR a.metadata->>'clientId' = cli)
      AND (after_at IS NULL OR (a.timestamp, a.id) < (after_at, after_id))
    ORDER BY a.timestamp DESC, a.id DESC LIMIT lim + 1) x;
  RETURN jsonb_build_object('items', (SELECT COALESCE(jsonb_agg(e ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(rows) WITH ORDINALITY AS r(e, ord) WHERE ord <= lim),
    'next', CASE WHEN jsonb_array_length(rows) > lim THEN jsonb_build_object('at', rows->(lim - 1)->'at', 'eventId', rows->(lim - 1)->'eventId') END);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_audit_center_event(p_tenant text, p_actor text, p_event uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp SET statement_timeout = '5s' AS $$
DECLARE a public.taxguard_audit_log;
BEGIN
  PERFORM public.taxguard_audit_center_admin(p_tenant, p_actor);
  SELECT * INTO a FROM public.taxguard_audit_log WHERE tenant_id = p_tenant AND id = p_event;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUDIT_EVENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN public.taxguard_audit_center_row(a);
END $$;

-- Categories present in a period, with counts (for the filter control).
CREATE OR REPLACE FUNCTION public.taxguard_audit_center_categories(p_tenant text, p_actor text, p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp SET statement_timeout = '5s' AS $$
BEGIN
  PERFORM public.taxguard_audit_center_admin(p_tenant, p_actor);
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '92 days' THEN RAISE EXCEPTION 'AUDIT_RANGE_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('category', c, 'count', n) ORDER BY c), '[]'::jsonb) FROM (
    SELECT split_part(action, '_', 1) AS c, count(*) AS n FROM public.taxguard_audit_log WHERE tenant_id = p_tenant AND timestamp >= p_from AND timestamp < p_to GROUP BY 1) x);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_audit\_center\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_audit_center_list','taxguard_audit_center_event','taxguard_audit_center_categories') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
