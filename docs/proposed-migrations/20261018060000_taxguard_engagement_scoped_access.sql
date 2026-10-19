-- PROPOSAL (Phase 14, engagement-scoped staff access). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 025 (practice management), 027 (document vault), 20261015020000 (collection questionnaires),
-- 20261015060000 (audit custody overlay) and 20261015030851 (document client confidentiality), which runs after
-- 20261015060000 in execution order and holds the current taxguard_doc_list and taxguard_doc_detail.
--
-- Owner decision 2026-10-19: a staff member assigned to one engagement and tax year reaches that client's records
-- for that engagement and year only, unless independently authorized (a client-wide assignment, a practice manager
-- or an administrator). The document vault and Stage 02 collection checked visibility per client only
-- (taxguard_practice_can_see: any active assignment to the client), so an engagement-year assignee could list, read,
-- download, review and upload into every engagement and year of the client, and open another engagement's
-- collection. Each function below is identical to its current definition except for the added scope check against
-- the record's own engagement and tax year. Refusals keep the existing "not found" / "access denied" codes, so a
-- record out of scope is indistinguishable from a missing one. Client access is unchanged.
-- Assignment scope: engagement_id NULL means every engagement and tax_year NULL means every year of the client
-- (so a client-wide assignment has both NULL); otherwise they must match.
-- Rollback (development): re-apply the listed proposals' definitions and drop taxguard_staff_scope.

CREATE OR REPLACE FUNCTION public.taxguard_staff_scope(p_tenant text, p_client text, p_actor text, p_role text, p_engagement text, p_year integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.taxguard_practice_is_manager(p_role) OR EXISTS (SELECT 1 FROM public.taxguard_staff_assignments a
    WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.user_id = p_actor AND a.status = 'ACTIVE'
      AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now())
      AND (a.engagement_id IS NULL OR a.engagement_id = p_engagement) AND (a.tax_year IS NULL OR a.tax_year = p_year)) $$;
REVOKE ALL ON FUNCTION public.taxguard_staff_scope(text,text,text,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;

-- Current definition: 20261015030851. Added: staff rows filtered to the actor's engagement-year scope.
CREATE OR REPLACE FUNCTION public.taxguard_doc_list(p_tenant text,p_client text,p_actor text,p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
 r := public.taxguard_doc_actor(p_tenant,p_client,p_actor);
 RETURN (SELECT COALESCE(jsonb_agg(CASE WHEN r='client' THEN public.taxguard_doc_client_json(d)
   ELSE public.taxguard_doc_json(d)||jsonb_build_object('clientReason',d.client_reason) END
   ORDER BY d.created_at DESC,d.document_id,d.version DESC),'[]'::jsonb)
 FROM public.taxguard_documents d WHERE d.tenant_id=p_tenant AND d.client_id=p_client
 AND (p_tax_year IS NULL OR d.tax_year=p_tax_year) AND d.status<>'UPLOAD_PENDING'
 AND (r<>'client' OR d.status<>'REJECTED_MALWARE' OR d.created_by=p_actor)
 AND (r='client' OR public.taxguard_staff_scope(p_tenant,p_client,p_actor,r,d.engagement_id,d.tax_year)));
END $$;

-- Current definition: 20261015030851 (runs after 20261015060000 in execution order). Added: staff need the latest
-- version to be in scope.
CREATE OR REPLACE FUNCTION public.taxguard_doc_detail(p_tenant text,p_client text,p_actor text,p_document_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
 r := public.taxguard_doc_actor(p_tenant,p_client,p_actor);
 IF NOT EXISTS(SELECT 1 FROM public.taxguard_documents WHERE tenant_id=p_tenant AND client_id=p_client AND document_id=p_document_id
   AND (r<>'client' OR (status<>'UPLOAD_PENDING' AND (status<>'REJECTED_MALWARE' OR created_by=p_actor)))) THEN
  RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE='P0001';
 END IF;
 IF r<>'client' AND NOT EXISTS(SELECT 1 FROM (SELECT engagement_id,tax_year FROM public.taxguard_documents WHERE tenant_id=p_tenant AND client_id=p_client
   AND document_id=p_document_id ORDER BY version DESC LIMIT 1) latest WHERE public.taxguard_staff_scope(p_tenant,p_client,p_actor,r,latest.engagement_id,latest.tax_year)) THEN
  RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE='P0001';
 END IF;
 RETURN jsonb_build_object(
  'versions',(SELECT jsonb_agg(CASE WHEN r='client' THEN public.taxguard_doc_client_json(d)
    ELSE public.taxguard_doc_json(d)||jsonb_build_object('clientReason',d.client_reason) END ORDER BY d.version DESC)
    FROM public.taxguard_documents d WHERE d.tenant_id=p_tenant AND d.client_id=p_client AND d.document_id=p_document_id
    AND (r<>'client' OR (d.status<>'UPLOAD_PENDING' AND (d.status<>'REJECTED_MALWARE' OR d.created_by=p_actor)))),
  'extractions',CASE WHEN r='client' THEN '[]'::jsonb ELSE (SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'fieldId',x.id,'version',x.document_version,'fieldKey',x.field_key,'proposedValue',x.field_value,
    'confidence',x.confidence,'provider',x.ocr_provider,'decision',x.decision,'verifiedValue',x.verified_value,
    'verifiedBy',x.verified_by,'verifiedAt',x.verified_at) ORDER BY x.field_key),'[]'::jsonb)
    FROM public.taxguard_extracted_data x WHERE x.tenant_id=p_tenant AND x.client_id=p_client AND x.document_id=p_document_id) END,
  'history',CASE WHEN r='client' THEN '[]'::jsonb ELSE (SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'action',a.action,'actorUid',a.actor_uid,'actorRole',a.actor_role,'at',a.timestamp,'version',a.metadata->'version')
    ORDER BY a.event_sequence),'[]'::jsonb) FROM public.taxguard_audit_log a WHERE a.tenant_id=p_tenant
    AND a.metadata->>'clientId'=p_client AND a.metadata->>'documentId'=p_document_id) END);
END $$;

-- Current definition: 027. Added: staff need the version to be in scope (checked before any audit row is written).
CREATE OR REPLACE FUNCTION public.taxguard_doc_authorize_download(p_tenant text, p_client text, p_actor text, p_document_id text, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; d public.taxguard_documents;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id AND version = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF r <> 'client' AND NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, d.engagement_id, d.tax_year) THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF d.quarantine_status <> 'CLEAN' OR NOT (d.status IN ('VERIFIED','SUPERSEDED') OR (r = 'client' AND d.created_by = p_actor AND d.status IN ('PENDING_REVIEW','REPLACEMENT_REQUESTED','REJECTED'))
      OR (r <> 'client' AND d.status = 'PENDING_REVIEW')) THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_AVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, p_actor, r, 'DOCUMENT_DOWNLOAD_AUTHORIZED', jsonb_build_object('documentId', p_document_id, 'version', p_version));
  RETURN jsonb_build_object('storagePath', d.storage_path, 'fileName', d.file_name, 'mimeType', d.mime_type);
END $$;

-- Current definition: 027 (taxguard_doc_review_with_reason delegates here). Added: the version must be in scope.
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
  IF NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, d.engagement_id, d.tax_year) THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

-- Current definition: 027. Changed: per-client visibility replaced by the row's engagement-year scope.
CREATE OR REPLACE FUNCTION public.taxguard_doc_review_queue(p_tenant text, p_actor text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at), '[]'::jsonb) FROM (
    SELECT d.created_at, public.taxguard_doc_json(d) || jsonb_build_object('clientName', c.name, 'canReview', d.created_by <> p_actor) AS row_data
    FROM public.taxguard_documents d JOIN public.taxguard_clients c ON c.tenant_id = d.tenant_id AND c.client_id = d.client_id AND c.status = 'active'
    WHERE d.tenant_id = p_tenant AND d.status = 'PENDING_REVIEW' AND d.quarantine_status = 'CLEAN'
      AND public.taxguard_staff_scope(p_tenant, d.client_id, p_actor, r, d.engagement_id, d.tax_year)
    ORDER BY d.created_at LIMIT p_limit) q);
END $$;

-- Current definition: 027. Added: staff are offered only engagement years in scope.
CREATE OR REPLACE FUNCTION public.taxguard_doc_upload_targets(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('engagementId', e.engagement_id, 'title', e.title, 'taxYear', y.tax_year) ORDER BY y.tax_year DESC, e.title), '[]'::jsonb)
    FROM public.taxguard_engagements e JOIN public.taxguard_tax_years y ON y.tenant_id = e.tenant_id AND y.client_id = e.client_id AND y.engagement_id = e.engagement_id AND y.status = 'active'
    WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND e.status IN ('draft','active','on_hold')
      AND (r = 'client' OR public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, e.engagement_id, y.tax_year)));
END $$;

-- Current definition: 027. Added: a staff upload needs the target engagement year, and for a new version of an
-- existing document also that document's latest engagement year, to be in scope.
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
  IF r <> 'client' AND NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, eng, yr) THEN RAISE EXCEPTION 'ENGAGEMENT_YEAR_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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
    IF r <> 'client' AND NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, prior.engagement_id, prior.tax_year) THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

-- Current definition: 027. Added: the extraction's document version must be in scope.
CREATE OR REPLACE FUNCTION public.taxguard_doc_verify_extraction(p_tenant text, p_client text, p_actor text, p_field uuid, p_decision text, p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; e public.taxguard_extracted_data;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'client' THEN RAISE EXCEPTION 'DOCUMENT_REVIEW_REQUIRES_STAFF' USING ERRCODE = 'P0001'; END IF;
  IF p_decision NOT IN ('ACCEPTED','CORRECTED','REJECTED') OR (p_decision = 'CORRECTED' AND (p_value IS NULL OR jsonb_typeof(p_value) <> 'object' OR NOT (p_value ? 'value'))) THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO e FROM public.taxguard_extracted_data WHERE id = p_field AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXTRACTION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.client_id = p_client AND d.document_id = e.document_id AND d.version = e.document_version
      AND public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, d.engagement_id, d.tax_year)) THEN
    RAISE EXCEPTION 'EXTRACTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF e.decision IS NOT NULL THEN RAISE EXCEPTION 'EXTRACTION_ALREADY_VERIFIED' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_extracted_data SET decision = p_decision, verified_by = p_actor, verified_at = now(), is_ai_proposed_only = (p_decision = 'REJECTED'),
      verified_value = CASE p_decision WHEN 'ACCEPTED' THEN e.field_value WHEN 'CORRECTED' THEN p_value->'value' END
    WHERE id = e.id;
  PERFORM public.taxguard_doc_audit(p_tenant, p_client, p_actor, r, 'DOCUMENT_EXTRACTION_' || p_decision, jsonb_build_object('documentId', e.document_id, 'fieldKey', e.field_key));
  RETURN jsonb_build_object('fieldId', e.id, 'decision', p_decision);
END $$;

-- Current definition: 20261015020000. Added: staff need the resolved engagement and the tax year to be in scope.
CREATE OR REPLACE FUNCTION public.taxguard_collection_scope(p_tenant text,p_client text,p_actor text,p_year integer,p_engagement text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE k text; ids text[]:=ARRAY[]::text[]; e record;
BEGIN
 IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2200 THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
 PERFORM 1 FROM public.taxguard_tenants WHERE id=p_tenant FOR SHARE;
 PERFORM 1 FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor FOR SHARE;
 PERFORM 1 FROM public.taxguard_clients WHERE tenant_id=p_tenant AND client_id=p_client FOR SHARE;
 PERFORM 1 FROM public.taxguard_staff_assignments WHERE tenant_id=p_tenant AND client_id=p_client AND user_id=p_actor FOR SHARE;
 k:=public.taxguard_doc_actor(p_tenant,p_client,p_actor);
 IF k='client' AND NOT EXISTS(SELECT 1 FROM public.taxguard_clients WHERE tenant_id=p_tenant AND client_id=p_client AND owner_uid=p_actor) THEN RAISE EXCEPTION 'COLLECTION_ACCESS_DENIED' USING ERRCODE='P0001'; END IF;
 FOR e IN SELECT y.engagement_id FROM public.taxguard_tax_years y JOIN public.taxguard_engagements g ON g.tenant_id=y.tenant_id AND g.client_id=y.client_id AND g.engagement_id=y.engagement_id
  WHERE y.tenant_id=p_tenant AND y.client_id=p_client AND y.tax_year=p_year AND y.status='active' AND g.status='active'
   AND (p_engagement IS NULL OR y.engagement_id=p_engagement) LIMIT 2 FOR SHARE OF y,g LOOP ids:=array_append(ids,e.engagement_id);END LOOP;
 IF cardinality(ids)<>1 THEN RAISE EXCEPTION 'COLLECTION_SCOPE_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF k<>'client' AND NOT public.taxguard_staff_scope(p_tenant,p_client,p_actor,k,ids[1],p_year) THEN RAISE EXCEPTION 'COLLECTION_ACCESS_DENIED' USING ERRCODE='P0001'; END IF;
 RETURN ids[1];
END $$;
