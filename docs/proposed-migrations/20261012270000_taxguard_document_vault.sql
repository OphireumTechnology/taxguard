-- PROPOSAL 027 ONLY. NOT APPLIED. Requires the actual core schema and proposal 025.
-- Durable, tenant- and client-scoped document vault on the EXISTING taxguard_documents and
-- taxguard_extracted_data tables. Bytes live only in the private 'taxguard-vault' bucket under
-- a path computed here; the browser never chooses a path and the bucket is never public.
--
-- Lifecycle per (document_id, version):
--   UPLOAD_PENDING -> SCAN_PENDING (bytes stored, hash verified by the server)
--   SCAN_PENDING   -> PENDING_REVIEW (scanner CLEAN) | REJECTED_MALWARE (scanner INFECTED)
--   PENDING_REVIEW -> VERIFIED | REJECTED | REPLACEMENT_REQUESTED (staff review)
--   VERIFIED       -> SUPERSEDED (a later version is verified)
-- Downloads: CLEAN and VERIFIED for staff; clients may also fetch their own CLEAN uploads.
-- Without a configured scanner documents stay SCAN_PENDING and are never downloadable.
-- Extracted data is always AI/OCR-proposed until a staff member verifies each field.
--
-- Schema changes to existing tables (NOT VALID / additive; existing rows untouched):
--   taxguard_documents: case_id becomes nullable (engagement-level documents), category,
--     declared size/hash, review fields, uploader role, version uniqueness per document.
--   taxguard_extracted_data: client_id, version, verification decision fields.
-- Rollback (development): drop taxguard_doc_* functions; drop added columns and indexes;
-- restore case_id NOT NULL only if no NULL rows exist.

ALTER TABLE public.taxguard_documents ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE public.taxguard_documents ADD COLUMN IF NOT EXISTS category VARCHAR(32);
ALTER TABLE public.taxguard_documents ADD COLUMN IF NOT EXISTS uploader_role VARCHAR(64);
ALTER TABLE public.taxguard_documents ADD COLUMN IF NOT EXISTS declared_size_bytes BIGINT;
ALTER TABLE public.taxguard_documents ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(128);
ALTER TABLE public.taxguard_documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.taxguard_documents ADD COLUMN IF NOT EXISTS review_note VARCHAR(500);
ALTER TABLE public.taxguard_documents ADD COLUMN IF NOT EXISTS scanner VARCHAR(64);
ALTER TABLE public.taxguard_documents ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;
DO $$ BEGIN
  ALTER TABLE public.taxguard_documents ADD CONSTRAINT chk_taxguard_document_category CHECK (category IS NULL OR category IN
    ('income','deductions','identity','prior_return','business_records','bank_statement','correspondence','engagement','other')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.taxguard_documents ADD CONSTRAINT chk_taxguard_document_size CHECK (declared_size_bytes IS NULL OR declared_size_bytes BETWEEN 1 AND 26214400) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_document_version ON public.taxguard_documents(tenant_id, client_id, document_id, version);
CREATE INDEX IF NOT EXISTS idx_taxguard_documents_queue ON public.taxguard_documents(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_taxguard_documents_client ON public.taxguard_documents(tenant_id, client_id, tax_year, created_at DESC);

ALTER TABLE public.taxguard_extracted_data ADD COLUMN IF NOT EXISTS client_id VARCHAR(64);
ALTER TABLE public.taxguard_extracted_data ADD COLUMN IF NOT EXISTS document_version INTEGER;
ALTER TABLE public.taxguard_extracted_data ADD COLUMN IF NOT EXISTS ocr_provider VARCHAR(64);
ALTER TABLE public.taxguard_extracted_data ADD COLUMN IF NOT EXISTS decision VARCHAR(16);
ALTER TABLE public.taxguard_extracted_data ADD COLUMN IF NOT EXISTS verified_value JSONB;
DO $$ BEGIN
  ALTER TABLE public.taxguard_extracted_data ADD CONSTRAINT chk_taxguard_extraction_decision CHECK (decision IS NULL OR decision IN ('ACCEPTED','CORRECTED','REJECTED')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_taxguard_extracted_document ON public.taxguard_extracted_data(tenant_id, client_id, document_id, document_version);

-- ------------------------------------------------------------------------------------------
-- Authority (internal)
-- ------------------------------------------------------------------------------------------
-- Clients: active member whose client_id is the document's client. Staff: practice managers or
-- staff with a current ACTIVE assignment (proposal 025 rules). Returns 'client' or the staff role.
CREATE OR REPLACE FUNCTION public.taxguard_doc_actor(p_tenant text, p_client text, p_actor text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE m record;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_client IS NULL OR p_client !~ '^[A-Za-z0-9_-]{1,64}$' OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id = p_tenant AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_ACCESS_DENIED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.taxguard_clients WHERE tenant_id = p_tenant AND client_id = p_client AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT role, client_id INTO m FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active';
  IF NOT FOUND OR m.role = 'recruiter' THEN RAISE EXCEPTION 'DOCUMENT_ACCESS_DENIED' USING ERRCODE = 'P0001'; END IF;
  IF m.role IN ('client','prospective_client') THEN
    IF m.client_id IS DISTINCT FROM p_client THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RETURN 'client';
  END IF;
  IF NOT public.taxguard_practice_can_see(p_tenant, p_client, p_actor, m.role) THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN m.role;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_doc_audit(p_tenant text, p_client text, p_actor text, p_role text, p_action text, p_meta jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, p_action, p_actor, p_role, jsonb_build_object('clientId', p_client) || COALESCE(p_meta, '{}'::jsonb)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_doc_json(d public.taxguard_documents) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('documentId', d.document_id, 'version', d.version, 'clientId', d.client_id, 'engagementId', d.engagement_id, 'taxYear', d.tax_year,
    'caseId', d.case_id, 'category', d.category, 'fileName', d.file_name, 'mimeType', d.mime_type, 'sizeBytes', d.declared_size_bytes, 'sha256', d.hash,
    'status', d.status, 'quarantineStatus', d.quarantine_status, 'uploadedBy', d.created_by, 'uploaderRole', d.uploader_role, 'reviewedBy', d.reviewed_by,
    'reviewedAt', d.reviewed_at, 'reviewNote', d.review_note, 'scannedAt', d.scanned_at, 'createdAt', d.created_at, 'rowVersion', d.row_version) $$;

-- ------------------------------------------------------------------------------------------
-- Upload, scan, review
-- ------------------------------------------------------------------------------------------
-- Registers an upload. p_document_id NULL = new document; otherwise a new version of an
-- existing document of the same client. Returns the server-computed private storage path.
CREATE OR REPLACE FUNCTION public.taxguard_doc_begin_upload(p_tenant text, p_client text, p_actor text, p_document_id text, p_new_id text, p_meta jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; did text; v integer; prior record; eng text; yr integer; mime text; size bigint; sha text; path text; fname text; cat text; cid text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF p_meta IS NULL OR jsonb_typeof(p_meta) <> 'object' THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  mime := p_meta->>'mimeType'; sha := lower(p_meta->>'sha256'); cat := p_meta->>'category'; fname := btrim(COALESCE(p_meta->>'fileName', ''));
  BEGIN size := (p_meta->>'sizeBytes')::bigint; yr := (p_meta->>'taxYear')::integer; EXCEPTION WHEN others THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  -- Mirrors the private bucket's allowed types and 25 MB limit.
  IF mime NOT IN ('application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv') THEN
    RAISE EXCEPTION 'DOCUMENT_TYPE_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  IF size IS NULL OR size < 1 OR size > 26214400 THEN RAISE EXCEPTION 'DOCUMENT_TOO_LARGE' USING ERRCODE = 'P0001'; END IF;
  IF sha IS NULL OR sha !~ '^[a-f0-9]{64}$' OR length(fname) NOT BETWEEN 1 AND 200 OR fname ~ '[[:cntrl:]/\\]' OR yr IS NULL OR yr NOT BETWEEN 2000 AND 2100
     OR cat NOT IN ('income','deductions','identity','prior_return','business_records','bank_statement','correspondence','engagement','other') THEN
    RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  eng := p_meta->>'engagementId'; cid := NULLIF(p_meta->>'caseId', '');
  PERFORM 1 FROM public.taxguard_tax_years WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = eng AND tax_year = yr AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'ENGAGEMENT_YEAR_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF cid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND case_id = cid AND engagement_id = eng AND tax_year = yr) THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF p_document_id IS NULL THEN
    IF p_new_id IS NULL OR p_new_id !~ '^doc_[a-f0-9]{32}$' THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    -- Idempotent retry of the same upload registration.
    SELECT * INTO prior FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_new_id AND version = 1;
    IF FOUND THEN
      IF prior.hash = sha AND prior.created_by = p_actor THEN RETURN jsonb_build_object('documentId', p_new_id, 'version', 1, 'storagePath', prior.storage_path, 'status', prior.status); END IF;
      RAISE EXCEPTION 'DOCUMENT_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    did := p_new_id; v := 1;
  ELSE
    SELECT * INTO prior FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id ORDER BY version DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    IF prior.status IN ('UPLOAD_PENDING','SCAN_PENDING','PENDING_REVIEW') THEN RAISE EXCEPTION 'DOCUMENT_VERSION_IN_PROGRESS' USING ERRCODE = 'P0001'; END IF;
    did := p_document_id; v := prior.version + 1;
  END IF;
  path := 'tenants/' || p_tenant || '/clients/' || p_client || '/engagements/' || eng || '/' || yr || '/docs/' || did || '_v' || v;
  INSERT INTO public.taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, case_id, version, hash, mime_type, status, provenance, storage_path,
      file_name, file_size_bytes, declared_size_bytes, quarantine_status, category, uploader_role, created_by)
    VALUES (did, p_tenant, p_client, eng, yr, cid, v, sha, mime, 'UPLOAD_PENDING', jsonb_build_object('source', CASE WHEN r = 'client' THEN 'CLIENT_UPLOAD' ELSE 'STAFF_UPLOAD' END),
      path, fname, NULL, size, 'QUARANTINED', cat, r, p_actor);
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, p_actor, r, 'DOCUMENT_UPLOAD_REGISTERED', jsonb_build_object('documentId', did, 'version', v, 'category', cat));
  RETURN jsonb_build_object('documentId', did, 'version', v, 'storagePath', path, 'status', 'UPLOAD_PENDING');
END $$;

-- Called by the server after it stored the bytes and verified their SHA-256 and size.
CREATE OR REPLACE FUNCTION public.taxguard_doc_complete_upload(p_tenant text, p_client text, p_actor text, p_document_id text, p_version integer, p_sha256 text, p_size bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; d public.taxguard_documents;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id AND version = p_version FOR UPDATE;
  IF NOT FOUND OR d.created_by <> p_actor THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF d.status <> 'UPLOAD_PENDING' THEN RAISE EXCEPTION 'DOCUMENT_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF lower(COALESCE(p_sha256, '')) <> d.hash OR p_size IS DISTINCT FROM d.declared_size_bytes THEN RAISE EXCEPTION 'DOCUMENT_INTEGRITY_MISMATCH' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_documents SET status = 'SCAN_PENDING', file_size_bytes = p_size, row_version = row_version + 1, updated_at = now() WHERE id = d.id;
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, p_actor, r, 'DOCUMENT_UPLOADED', jsonb_build_object('documentId', p_document_id, 'version', p_version));
  RETURN jsonb_build_object('documentId', p_document_id, 'version', p_version, 'status', 'SCAN_PENDING');
END $$;

-- Malware scanning boundary: recorded only by the configured scanner integration (service).
CREATE OR REPLACE FUNCTION public.taxguard_doc_record_scan(p_tenant text, p_client text, p_document_id text, p_version integer, p_result text, p_scanner text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE d public.taxguard_documents; next_status text;
BEGIN
  IF p_result NOT IN ('CLEAN','INFECTED') OR p_scanner IS NULL OR p_scanner !~ '^[A-Za-z0-9_.:-]{1,64}$' THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id AND version = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF d.status <> 'SCAN_PENDING' THEN RAISE EXCEPTION 'DOCUMENT_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  next_status := CASE p_result WHEN 'CLEAN' THEN 'PENDING_REVIEW' ELSE 'REJECTED_MALWARE' END;
  UPDATE public.taxguard_documents SET status = next_status, quarantine_status = p_result, scanner = p_scanner, scanned_at = now(), row_version = row_version + 1, updated_at = now()
    WHERE id = d.id;
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, 'system:' || p_scanner, 'system', 'DOCUMENT_SCANNED',
    jsonb_build_object('documentId', p_document_id, 'version', p_version, 'result', p_result));
  RETURN jsonb_build_object('documentId', p_document_id, 'version', p_version, 'status', next_status);
END $$;

-- Staff review. The reviewer must differ from the uploader (a staff member cannot approve their
-- own upload); approving a version supersedes earlier verified versions.
CREATE OR REPLACE FUNCTION public.taxguard_doc_review(p_tenant text, p_client text, p_actor text, p_document_id text, p_version integer, p_decision text, p_note text, p_row_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; d public.taxguard_documents; target text; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'client' THEN RAISE EXCEPTION 'DOCUMENT_REVIEW_REQUIRES_STAFF' USING ERRCODE = 'P0001'; END IF;
  target := CASE p_decision WHEN 'approve' THEN 'VERIFIED' WHEN 'reject' THEN 'REJECTED' WHEN 'request_replacement' THEN 'REPLACEMENT_REQUESTED' END;
  IF target IS NULL OR (target <> 'VERIFIED' AND (note IS NULL OR length(note) NOT BETWEEN 5 AND 500)) OR length(COALESCE(note, '')) > 500 THEN
    RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id AND version = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_row_version IS NULL OR d.row_version <> p_row_version THEN RAISE EXCEPTION 'DOCUMENT_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF d.status <> 'PENDING_REVIEW' OR d.quarantine_status <> 'CLEAN' THEN RAISE EXCEPTION 'DOCUMENT_NOT_PENDING_REVIEW' USING ERRCODE = 'P0001'; END IF;
  IF d.created_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF target = 'VERIFIED' THEN
    UPDATE public.taxguard_documents SET status = 'SUPERSEDED', row_version = row_version + 1, updated_at = now()
      WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id AND version < p_version AND status = 'VERIFIED';
  END IF;
  UPDATE public.taxguard_documents SET status = target, reviewed_by = p_actor, reviewed_at = now(), review_note = note, row_version = row_version + 1, updated_at = now() WHERE id = d.id;
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, p_actor, r, 'DOCUMENT_' || target, jsonb_build_object('documentId', p_document_id, 'version', p_version));
  RETURN jsonb_build_object('documentId', p_document_id, 'version', p_version, 'status', target, 'rowVersion', d.row_version + 1);
END $$;

-- Returns the private storage path for a short-lived signed URL; every grant is audited.
CREATE OR REPLACE FUNCTION public.taxguard_doc_authorize_download(p_tenant text, p_client text, p_actor text, p_document_id text, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; d public.taxguard_documents;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id AND version = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF d.quarantine_status <> 'CLEAN' OR NOT (d.status IN ('VERIFIED','SUPERSEDED') OR (r = 'client' AND d.created_by = p_actor AND d.status IN ('PENDING_REVIEW','REPLACEMENT_REQUESTED','REJECTED'))
      OR (r <> 'client' AND d.status = 'PENDING_REVIEW')) THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_AVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, p_actor, r, 'DOCUMENT_DOWNLOAD_AUTHORIZED', jsonb_build_object('documentId', p_document_id, 'version', p_version));
  RETURN jsonb_build_object('storagePath', d.storage_path, 'fileName', d.file_name, 'mimeType', d.mime_type);
END $$;

-- ------------------------------------------------------------------------------------------
-- OCR proposals and human verification
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_doc_propose_extraction(p_tenant text, p_client text, p_document_id text, p_version integer, p_provider text, p_fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE d public.taxguard_documents; f jsonb; n integer := 0; conf numeric;
BEGIN
  IF p_provider IS NULL OR p_provider !~ '^[A-Za-z0-9_.:-]{1,64}$' OR p_fields IS NULL OR jsonb_typeof(p_fields) <> 'array' OR jsonb_array_length(p_fields) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id AND version = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF d.quarantine_status <> 'CLEAN' THEN RAISE EXCEPTION 'DOCUMENT_NOT_AVAILABLE' USING ERRCODE = 'P0001'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p_fields) LOOP
    IF COALESCE(f->>'fieldKey', '') !~ '^[a-z][a-z0-9_.]{0,127}$' OR NOT (f ? 'value') THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    BEGIN conf := (f->>'confidence')::numeric; EXCEPTION WHEN others THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
    IF conf IS NULL OR conf < 0 OR conf > 1 THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO public.taxguard_extracted_data(document_id, case_id, tenant_id, client_id, document_version, field_key, field_value, confidence, provenance, is_ai_proposed_only, ocr_provider)
      VALUES (p_document_id, COALESCE(d.case_id, ''), p_tenant, p_client, p_version, f->>'fieldKey', f->'value', round(conf, 4),
        jsonb_build_object('provider', p_provider, 'page', f->'page', 'proposedAt', now()), true, p_provider);
    n := n + 1;
  END LOOP;
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, 'system:' || p_provider, 'system', 'DOCUMENT_EXTRACTION_PROPOSED',
    jsonb_build_object('documentId', p_document_id, 'version', p_version, 'fields', n));
  RETURN jsonb_build_object('proposed', n);
END $$;

-- A staff member (not a client) accepts, corrects or rejects one proposed field. Only verified
-- values (ACCEPTED / CORRECTED) may be used downstream.
CREATE OR REPLACE FUNCTION public.taxguard_doc_verify_extraction(p_tenant text, p_client text, p_actor text, p_field uuid, p_decision text, p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; e public.taxguard_extracted_data;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'client' THEN RAISE EXCEPTION 'DOCUMENT_REVIEW_REQUIRES_STAFF' USING ERRCODE = 'P0001'; END IF;
  IF p_decision NOT IN ('ACCEPTED','CORRECTED','REJECTED') OR (p_decision = 'CORRECTED' AND (p_value IS NULL OR jsonb_typeof(p_value) <> 'object' OR NOT (p_value ? 'value'))) THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO e FROM public.taxguard_extracted_data WHERE id = p_field AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXTRACTION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF e.decision IS NOT NULL THEN RAISE EXCEPTION 'EXTRACTION_ALREADY_VERIFIED' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_extracted_data SET decision = p_decision, verified_by = p_actor, verified_at = now(), is_ai_proposed_only = (p_decision = 'REJECTED'),
      verified_value = CASE p_decision WHEN 'ACCEPTED' THEN e.field_value WHEN 'CORRECTED' THEN p_value->'value' END
    WHERE id = e.id;
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, p_actor, r, 'DOCUMENT_EXTRACTION_' || p_decision, jsonb_build_object('documentId', e.document_id, 'fieldKey', e.field_key));
  RETURN jsonb_build_object('fieldId', e.id, 'decision', p_decision);
END $$;

-- ------------------------------------------------------------------------------------------
-- Reads
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_doc_list(p_tenant text, p_client text, p_actor text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_doc_json(d) ORDER BY d.created_at DESC, d.document_id, d.version DESC), '[]'::jsonb)
    FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.client_id = p_client AND (p_tax_year IS NULL OR d.tax_year = p_tax_year)
      AND d.status <> 'UPLOAD_PENDING' AND (r <> 'client' OR d.status <> 'REJECTED_MALWARE' OR d.created_by = p_actor));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_doc_detail(p_tenant text, p_client text, p_actor text, p_document_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF NOT EXISTS (SELECT 1 FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id) THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object(
    'versions', (SELECT jsonb_agg(public.taxguard_doc_json(d) ORDER BY d.version DESC) FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.client_id = p_client AND d.document_id = p_document_id),
    'extractions', CASE WHEN r = 'client' THEN '[]'::jsonb ELSE (SELECT COALESCE(jsonb_agg(jsonb_build_object('fieldId', x.id, 'version', x.document_version, 'fieldKey', x.field_key,
        'proposedValue', x.field_value, 'confidence', x.confidence, 'provider', x.ocr_provider, 'decision', x.decision, 'verifiedValue', x.verified_value,
        'verifiedBy', x.verified_by, 'verifiedAt', x.verified_at) ORDER BY x.field_key), '[]'::jsonb)
      FROM public.taxguard_extracted_data x WHERE x.tenant_id = p_tenant AND x.client_id = p_client AND x.document_id = p_document_id) END,
    'history', (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', a.action, 'actorUid', a.actor_uid, 'actorRole', a.actor_role, 'at', a.timestamp,
        'version', a.metadata->'version') ORDER BY a.timestamp, a.id), '[]'::jsonb)
      FROM public.taxguard_audit_log a WHERE a.tenant_id = p_tenant AND a.metadata->>'clientId' = p_client AND a.metadata->>'documentId' = p_document_id
        AND (r <> 'client' OR a.action NOT LIKE 'DOCUMENT\_EXTRACTION\_%')));
END $$;

-- Engagement years a client or staff member may file documents against (titles and years only).
CREATE OR REPLACE FUNCTION public.taxguard_doc_upload_targets(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('engagementId', e.engagement_id, 'title', e.title, 'taxYear', y.tax_year) ORDER BY y.tax_year DESC, e.title), '[]'::jsonb)
    FROM public.taxguard_engagements e JOIN public.taxguard_tax_years y ON y.tenant_id = e.tenant_id AND y.client_id = e.client_id AND y.engagement_id = e.engagement_id AND y.status = 'active'
    WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND e.status IN ('draft','active','on_hold'));
END $$;

-- Staff review queue across the clients the actor may see.
CREATE OR REPLACE FUNCTION public.taxguard_doc_review_queue(p_tenant text, p_actor text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at), '[]'::jsonb) FROM (
    SELECT d.created_at, public.taxguard_doc_json(d) || jsonb_build_object('clientName', c.name, 'canReview', d.created_by <> p_actor) AS row_data
    FROM public.taxguard_documents d JOIN public.taxguard_clients c ON c.tenant_id = d.tenant_id AND c.client_id = d.client_id AND c.status = 'active'
    WHERE d.tenant_id = p_tenant AND d.status = 'PENDING_REVIEW' AND d.quarantine_status = 'CLEAN' AND public.taxguard_practice_can_see(p_tenant, d.client_id, p_actor, r)
    ORDER BY d.created_at LIMIT p_limit) q);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_doc\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_doc_begin_upload','taxguard_doc_complete_upload','taxguard_doc_record_scan','taxguard_doc_review','taxguard_doc_authorize_download',
        'taxguard_doc_propose_extraction','taxguard_doc_verify_extraction','taxguard_doc_list','taxguard_doc_detail','taxguard_doc_review_queue','taxguard_doc_upload_targets') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
