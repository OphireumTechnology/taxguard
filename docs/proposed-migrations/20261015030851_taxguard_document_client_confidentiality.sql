-- C9 REVIEW-ONLY PROPOSAL. NOT APPLIED externally. Generated with Supabase CLI migration new.
-- Depends on document vault, audit custody overlay and Data API lockdown.
-- Rollback: disable client document readers; never restore the leaking serializer to clients.
-- Legacy review_note is ambiguous internal text: do not backfill client_reason from it.
ALTER TABLE public.taxguard_documents ADD COLUMN IF NOT EXISTS client_reason varchar(500);
COMMENT ON COLUMN public.taxguard_documents.client_reason IS 'Explicit staff-authorized client rejection/replacement reason; never inferred from review_note.';

-- Invoker-only pure projection. No role flag supplied by a caller can enable staff fields.
CREATE OR REPLACE FUNCTION public.taxguard_doc_client_json(d public.taxguard_documents) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT jsonb_build_object('documentId',d.document_id,'version',d.version,'clientId',d.client_id,
  'engagementId',d.engagement_id,'taxYear',d.tax_year,'caseId',d.case_id,'category',d.category,
  'fileName',d.file_name,'mimeType',d.mime_type,'sizeBytes',d.declared_size_bytes,'status',d.status,
  'quarantineStatus',d.quarantine_status,'createdAt',d.created_at,'rowVersion',d.row_version)
  || CASE WHEN d.status IN ('REJECTED','REPLACEMENT_REQUESTED') THEN jsonb_build_object('clientReason',d.client_reason) ELSE '{}'::jsonb END
$$;

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
 AND (r<>'client' OR d.status<>'REJECTED_MALWARE' OR d.created_by=p_actor));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_doc_detail(p_tenant text,p_client text,p_actor text,p_document_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
 r := public.taxguard_doc_actor(p_tenant,p_client,p_actor);
 IF NOT EXISTS(SELECT 1 FROM public.taxguard_documents WHERE tenant_id=p_tenant AND client_id=p_client AND document_id=p_document_id
   AND (r<>'client' OR (status<>'UPLOAD_PENDING' AND (status<>'REJECTED_MALWARE' OR created_by=p_actor)))) THEN
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

-- Explicit new API separates outward reasons from internal notes. Legacy RPC stays private-note
-- only and cannot accidentally publish old notes. Existing maker/checker, status and version
-- checks are delegated to the unchanged review function in this same transaction.
CREATE OR REPLACE FUNCTION public.taxguard_doc_review_with_reason(p_tenant text,p_client text,p_actor text,
 p_document_id text,p_version integer,p_decision text,p_note text,p_row_version integer,p_client_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE reason text:=NULLIF(btrim(COALESCE(p_client_reason,'')),'');
 note text:=NULLIF(btrim(COALESCE(p_note,'')),''); result jsonb;
BEGIN
 IF length(COALESCE(note,''))>500 OR length(COALESCE(reason,''))>500 OR (reason IS NOT NULL AND
   (p_decision NOT IN ('reject','request_replacement') OR length(reason)<5)) THEN
  RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE='P0001';
 END IF;
 result:=public.taxguard_doc_review(p_tenant,p_client,p_actor,p_document_id,p_version,p_decision,
   COALESCE(reason,note),p_row_version);
 UPDATE public.taxguard_documents SET client_reason=reason,review_note=note
  WHERE tenant_id=p_tenant AND client_id=p_client AND document_id=p_document_id AND version=p_version;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.taxguard_doc_client_json(public.taxguard_documents) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_doc_review_with_reason(text,text,text,text,integer,text,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_doc_review_with_reason(text,text,text,text,integer,text,text,integer,text) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_doc_list(text,text,text,integer),public.taxguard_doc_detail(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_doc_list(text,text,text,integer),public.taxguard_doc_detail(text,text,text,text) TO service_role;
