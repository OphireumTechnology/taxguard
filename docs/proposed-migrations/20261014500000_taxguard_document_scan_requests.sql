-- TaxGuard proposal 050: asynchronous malware-scan requests and single-use verdicts (Phase 10).
-- REVIEW ONLY; not applied. No scanning provider is connected by this proposal.
--
-- 027 records a verdict for a SCAN_PENDING document version through taxguard_doc_record_scan,
-- which suits an in-process scanner. A hosted scanner answers later through a callback, so the
-- verdict must be bound to a request the server issued:
--   * taxguard_doc_scan_request issues (or returns the open) request for a SCAN_PENDING version,
--     with an expiry and at most 5 attempts per version; an expired request is closed and a new
--     one issued. The document stays quarantined throughout.
--   * taxguard_doc_scan_complete accepts one verdict per request: unknown, expired, already
--     answered (replay) or wrong-provider verdicts are refused; ERROR closes the request as FAILED
--     and the document stays SCAN_PENDING (never downloadable); CLEAN / INFECTED are recorded through
--     taxguard_doc_record_scan (027), so the release rules are unchanged.
--   * taxguard_doc_scan_backlog reports counts only (open, expired, failed) for monitoring.
-- The callback's authenticity (HMAC over the verdict with a configured secret, timestamp window) is
-- checked by the server before this function is called; the database adds single use and expiry.
-- Every step writes an audit row with identifiers only. service_role only.
--
-- Depends on: 027 (taxguard_documents with versions, taxguard_doc_record_scan, taxguard_doc_audit).
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE.
-- Rollback (development): drop the three functions and taxguard_doc_scan_requests; documents keep
-- their status (open requests simply stop being answerable; documents stay SCAN_PENDING).

CREATE TABLE IF NOT EXISTS public.taxguard_doc_scan_requests (
  scan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar(128) NOT NULL,
  client_id varchar(64) NOT NULL,
  document_id varchar(128) NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  provider varchar(64) NOT NULL CHECK (provider ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 5),
  status varchar(16) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','COMPLETED','FAILED','EXPIRED')),
  verdict varchar(16) CHECK (verdict IN ('CLEAN','INFECTED','ERROR')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  CHECK ((status = 'REQUESTED') = (completed_at IS NULL) OR status = 'EXPIRED'),
  CHECK (expires_at > requested_at)
);
-- At most one open request per document version.
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_doc_scan_open ON public.taxguard_doc_scan_requests (tenant_id, document_id, version) WHERE status = 'REQUESTED';
CREATE INDEX IF NOT EXISTS idx_taxguard_doc_scan_tenant ON public.taxguard_doc_scan_requests (tenant_id, status, expires_at);
ALTER TABLE public.taxguard_doc_scan_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.taxguard_doc_scan_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_doc_scan_request(p_tenant text, p_client text, p_document_id text, p_version integer, p_provider text, p_ttl_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE d public.taxguard_documents; r public.taxguard_doc_scan_requests; attempts integer;
BEGIN
  IF p_provider IS NULL OR p_provider !~ '^[A-Za-z0-9_.:-]{1,64}$' OR p_ttl_seconds IS NULL OR p_ttl_seconds NOT BETWEEN 60 AND 86400 THEN
    RAISE EXCEPTION 'SCAN_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id AND version = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF d.status <> 'SCAN_PENDING' THEN RAISE EXCEPTION 'DOCUMENT_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO r FROM public.taxguard_doc_scan_requests WHERE tenant_id = p_tenant AND document_id = p_document_id AND version = p_version AND status = 'REQUESTED' FOR UPDATE;
  IF FOUND THEN
    IF r.expires_at > now() AND r.provider = p_provider THEN
      RETURN jsonb_build_object('scanId', r.scan_id, 'attempt', r.attempt, 'expiresAt', r.expires_at, 'created', false);
    END IF;
    UPDATE public.taxguard_doc_scan_requests SET status = 'EXPIRED' WHERE scan_id = r.scan_id;
  END IF;
  SELECT count(*) INTO attempts FROM public.taxguard_doc_scan_requests WHERE tenant_id = p_tenant AND document_id = p_document_id AND version = p_version;
  IF attempts >= 5 THEN
    PERFORM public.taxguard_doc_audit(p_tenant, p_client, 'system:' || p_provider, 'system', 'DOCUMENT_SCAN_ATTEMPTS_EXHAUSTED',
      jsonb_build_object('documentId', p_document_id, 'version', p_version));
    RAISE EXCEPTION 'SCAN_ATTEMPTS_EXHAUSTED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.taxguard_doc_scan_requests(tenant_id, client_id, document_id, version, provider, attempt, expires_at)
    VALUES (p_tenant, p_client, p_document_id, p_version, p_provider, attempts + 1, now() + make_interval(secs => p_ttl_seconds)) RETURNING * INTO r;
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, 'system:' || p_provider, 'system', 'DOCUMENT_SCAN_REQUESTED',
    jsonb_build_object('documentId', p_document_id, 'version', p_version, 'requestId', r.scan_id::text, 'status', 'REQUESTED'));
  RETURN jsonb_build_object('scanId', r.scan_id, 'attempt', r.attempt, 'expiresAt', r.expires_at, 'created', true);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_doc_scan_complete(p_tenant text, p_scan_id uuid, p_verdict text, p_provider text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r public.taxguard_doc_scan_requests; state jsonb;
BEGIN
  IF p_verdict IS NULL OR p_verdict NOT IN ('CLEAN','INFECTED','ERROR') OR p_provider IS NULL OR p_provider !~ '^[A-Za-z0-9_.:-]{1,64}$' THEN
    RAISE EXCEPTION 'SCAN_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO r FROM public.taxguard_doc_scan_requests WHERE scan_id = p_scan_id AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SCAN_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF r.status IN ('COMPLETED','FAILED') THEN RAISE EXCEPTION 'SCAN_VERDICT_REPLAYED' USING ERRCODE = 'P0001'; END IF;
  IF r.provider <> p_provider THEN RAISE EXCEPTION 'SCAN_PROVIDER_MISMATCH' USING ERRCODE = 'P0001'; END IF;
  -- An expired request is closed by the next taxguard_doc_scan_request; a late verdict is refused.
  IF r.status = 'EXPIRED' OR r.expires_at <= now() THEN RAISE EXCEPTION 'SCAN_REQUEST_EXPIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_verdict = 'ERROR' THEN
    UPDATE public.taxguard_doc_scan_requests SET status = 'FAILED', verdict = 'ERROR', completed_at = now() WHERE scan_id = r.scan_id;
    PERFORM public.taxguard_doc_audit(r.tenant_id, r.client_id, 'system:' || p_provider, 'system', 'DOCUMENT_SCAN_FAILED',
      jsonb_build_object('documentId', r.document_id, 'version', r.version, 'requestId', r.scan_id::text));
    RETURN jsonb_build_object('documentId', r.document_id, 'version', r.version, 'status', 'SCAN_PENDING');
  END IF;
  UPDATE public.taxguard_doc_scan_requests SET status = 'COMPLETED', verdict = p_verdict, completed_at = now() WHERE scan_id = r.scan_id;
  state := public.taxguard_doc_record_scan(r.tenant_id, r.client_id, r.document_id, r.version, p_verdict, p_provider);
  RETURN state;
END $$;

-- Monitoring: counts only, no identifiers.
CREATE OR REPLACE FUNCTION public.taxguard_doc_scan_backlog(p_tenant text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('open', count(*) FILTER (WHERE status = 'REQUESTED' AND expires_at > now()),
    'overdue', count(*) FILTER (WHERE status = 'REQUESTED' AND expires_at <= now()),
    'failed24h', count(*) FILTER (WHERE status = 'FAILED' AND completed_at > now() - interval '24 hours'),
    'pendingDocuments', (SELECT count(*) FROM public.taxguard_documents WHERE tenant_id = p_tenant AND status = 'SCAN_PENDING'))
  FROM public.taxguard_doc_scan_requests WHERE tenant_id = p_tenant $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_doc_scan_request','taxguard_doc_scan_complete','taxguard_doc_scan_backlog') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
