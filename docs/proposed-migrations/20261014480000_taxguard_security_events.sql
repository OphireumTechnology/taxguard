-- TaxGuard proposal 048: durable, bounded security-event recording (Phase 10). REVIEW ONLY; not applied.
--
-- Problem: authentication failures, lockouts, access and isolation denials, MFA requirement
-- failures and similar events from the legacy routes are only kept in the server's memory
-- (db.logSecurityEvent) and are lost on restart; they cannot be reviewed in the audit center.
--
-- Change: one service_role-only ingestion function that writes a redacted row into the existing
-- append-only taxguard_audit_log (action SECURITY_<EVENT>, audit-center category SECURITY). It:
--   * accepts a fixed set of categories and an event code, never free text;
--   * keeps only allow-listed detail keys with short identifier-like values (no messages, no
--     e-mail addresses, no tokens, no passwords, no factor secrets, no taxpayer data);
--   * never stores a network address: the caller passes an HMAC fingerprint (hex) instead;
--   * works for unauthenticated events (actor 'anonymous') but only for an existing, active tenant;
--   * bounds ingestion per minute: 20 rows per (category, fingerprint or actor) and 600 rows per
--     tenant. Excess events are counted, not written; the first excess in a window writes one
--     SECURITY_REPEATED_REQUESTS row, so a flood is visible without growing the log without bound.
-- Reads stay with the administrator-only audit center (041 / 046): this proposal supersedes the
-- audit-center redaction to show the new identifier fields, and adds an administrator-only
-- summary of suppressed counts. Clients and staff other than administrators cannot read events.
--
-- Depends on: core schema (taxguard_audit_log, taxguard_tenants, taxguard_members), 041, 046.
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE.
-- Rollback (development): drop the three new functions and taxguard_security_event_windows, and
-- re-apply taxguard_audit_center_redact from 041. Recorded audit rows are kept (append-only).

CREATE TABLE IF NOT EXISTS public.taxguard_security_event_windows (
  tenant_id varchar(128) NOT NULL,
  scope_key varchar(200) NOT NULL,
  window_start timestamptz NOT NULL,
  category varchar(16) NOT NULL,
  recorded integer NOT NULL DEFAULT 0 CHECK (recorded >= 0),
  suppressed integer NOT NULL DEFAULT 0 CHECK (suppressed >= 0),
  PRIMARY KEY (tenant_id, scope_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_security_event_windows_age ON public.taxguard_security_event_windows (tenant_id, window_start);
ALTER TABLE public.taxguard_security_event_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.taxguard_security_event_windows FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_security_event_detail(p_detail jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  WITH kv AS (SELECT key, value FROM jsonb_each(CASE WHEN jsonb_typeof(p_detail) = 'object' THEN p_detail ELSE '{}'::jsonb END)),
  kept AS (SELECT key, value FROM kv WHERE key IN ('resourceType','route','method','status','reason','requestId','clientId','authorizationResult')
    AND ((jsonb_typeof(value) = 'string' AND (value #>> '{}') ~ '^[A-Za-z0-9_./:-]{1,96}$') OR (jsonb_typeof(value) = 'number' AND (value #>> '{}') ~ '^[0-9]{1,6}$')))
  SELECT COALESCE((SELECT jsonb_object_agg(key, value) FROM kept), '{}'::jsonb)
    || jsonb_build_object('droppedFields', (SELECT count(*) FROM kv) - (SELECT count(*) FROM kept)) $$;

-- Returns {result: RECORDED | SUPPRESSED | REJECTED}. Never raises for well-formed calls, so a
-- failed recording can never turn into a failed (or differently timed) user request.
CREATE OR REPLACE FUNCTION public.taxguard_security_event_record(p_tenant text, p_category text, p_event text, p_severity text, p_actor text, p_fingerprint text, p_detail jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp SET statement_timeout = '2s' AS $$
DECLARE win timestamptz := date_trunc('minute', now()); actor text; scope text; w public.taxguard_security_event_windows; tenant_total integer;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_category IS NULL
    OR p_category NOT IN ('AUTH','SESSION','MFA','MEMBERSHIP','PRIVILEGE','ACCESS','ABUSE','ADMIN','AI','INTEGRITY','MALWARE')
    OR p_event IS NULL OR p_event !~ '^[A-Z][A-Z0-9_]{2,63}$' OR COALESCE(p_severity, 'info') NOT IN ('info','warning','critical')
    OR (p_actor IS NOT NULL AND p_actor !~ '^[A-Za-z0-9_-]{1,128}$') OR (p_fingerprint IS NOT NULL AND p_fingerprint !~ '^[0-9a-f]{16,64}$') THEN
    RETURN jsonb_build_object('result', 'REJECTED');
  END IF;
  PERFORM 1 FROM public.taxguard_tenants t WHERE t.id = p_tenant AND t.status = 'active';
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'REJECTED'); END IF;
  actor := COALESCE(p_actor, 'anonymous');
  scope := p_category || ':' || COALESCE(left(p_fingerprint, 32), 'u:' || actor);

  -- Tenant-wide bound first, then the per-source bound.
  INSERT INTO public.taxguard_security_event_windows AS x (tenant_id, scope_key, window_start, category, recorded) VALUES (p_tenant, '*', win, 'ALL', 1)
    ON CONFLICT (tenant_id, scope_key, window_start) DO UPDATE SET recorded = x.recorded + 1 RETURNING x.recorded INTO tenant_total;
  INSERT INTO public.taxguard_security_event_windows AS x (tenant_id, scope_key, window_start, category, recorded) VALUES (p_tenant, scope, win, p_category, 1)
    ON CONFLICT (tenant_id, scope_key, window_start) DO UPDATE SET recorded = x.recorded + 1 RETURNING x.* INTO w;
  IF tenant_total > 600 OR w.recorded > 20 THEN
    UPDATE public.taxguard_security_event_windows SET suppressed = suppressed + 1, recorded = recorded - 1
      WHERE tenant_id = p_tenant AND scope_key = scope AND window_start = win RETURNING * INTO w;
    UPDATE public.taxguard_security_event_windows SET recorded = recorded - 1 WHERE tenant_id = p_tenant AND scope_key = '*' AND window_start = win;
    -- One marker per source and window, and only while the tenant-wide bound allows it.
    IF w.suppressed = 1 AND tenant_total <= 600 THEN
      INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
        VALUES (p_tenant, 'SECURITY_REPEATED_REQUESTS', actor, 'system', jsonb_build_object('category', 'ABUSE', 'sourceCategory', p_category, 'event', p_event,
          'severity', 'warning', 'fingerprint', left(p_fingerprint, 16), 'windowStart', to_char(win AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"')));
    END IF;
    RETURN jsonb_build_object('result', 'SUPPRESSED');
  END IF;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES (p_tenant, left('SECURITY_' || p_event, 128), actor, CASE WHEN p_actor IS NULL THEN 'anonymous' ELSE 'subject' END,
      jsonb_build_object('category', p_category, 'event', p_event, 'severity', COALESCE(p_severity, 'info'), 'fingerprint', left(p_fingerprint, 16))
        || public.taxguard_security_event_detail(p_detail));
  -- Opportunistic, bounded clean-up of old counters (never audit rows).
  DELETE FROM public.taxguard_security_event_windows WHERE ctid IN (SELECT ctid FROM public.taxguard_security_event_windows
    WHERE tenant_id = p_tenant AND window_start < now() - interval '2 days' LIMIT 50);
  RETURN jsonb_build_object('result', 'RECORDED');
END $$;

-- Administrator-only: suppressed and recorded counts per category for a range of at most 31 days.
CREATE OR REPLACE FUNCTION public.taxguard_security_event_summary(p_tenant text, p_actor text, p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp SET statement_timeout = '5s' AS $$
BEGIN
  PERFORM public.taxguard_audit_center_admin(p_tenant, p_actor);
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '31 days' THEN RAISE EXCEPTION 'AUDIT_RANGE_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object('categories', (SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'recorded', rec, 'suppressed', sup) ORDER BY category), '[]'::jsonb) FROM (
    SELECT category, sum(recorded) AS rec, sum(suppressed) AS sup FROM public.taxguard_security_event_windows
      WHERE tenant_id = p_tenant AND scope_key <> '*' AND window_start >= p_from AND window_start < p_to GROUP BY category) s));
END $$;

-- Supersedes 041: also shows the identifier-only fields written by security events.
CREATE OR REPLACE FUNCTION public.taxguard_audit_center_redact(p_meta jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  WITH kv AS (SELECT key, value FROM jsonb_each(CASE WHEN jsonb_typeof(p_meta) = 'object' THEN p_meta ELSE '{}'::jsonb END)),
  kept AS (SELECT key, value FROM kv WHERE key IN ('clientId','caseId','engagementId','appointmentId','threadId','messageId','requestId','jobId','documentId',
      'invoiceId','ruleSetId','sourceId','testId','uid','targetUid','sessionId','status','visibility','category','version','taxYear','stage','action','decision',
      'removedFactors','revokedSessions','event','severity','fingerprint','resourceType','route','method','reason','authorizationResult','sourceCategory','windowStart','droppedFields')
    AND ((jsonb_typeof(value) = 'string' AND (value #>> '{}') ~ '^[A-Za-z0-9_.:/-]{1,128}$') OR jsonb_typeof(value) IN ('number','boolean')))
  SELECT jsonb_build_object('fields', COALESCE((SELECT jsonb_object_agg(key, value) FROM kept), '{}'::jsonb),
    'redactedFields', (SELECT count(*) FROM kv) - (SELECT count(*) FROM kept)) $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_security_event_detail','taxguard_security_event_record','taxguard_security_event_summary','taxguard_audit_center_redact') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_security_event_record','taxguard_security_event_summary') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
