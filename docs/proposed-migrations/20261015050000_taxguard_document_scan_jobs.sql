-- PROPOSAL 056 ONLY. NOT APPLIED. Depends on merged 050/027; no parallel job table.
-- Persist exact document UUID/version/hash/path binding in the existing scan requests.
-- Legacy unbound requests cannot release documents; existing expiry/five-attempt retry remains.
-- Rollback: disable scanner integrations, preserve history, never restore unbound service grants.
ALTER TABLE public.taxguard_doc_scan_requests ADD COLUMN IF NOT EXISTS document_row uuid REFERENCES public.taxguard_documents(id);
ALTER TABLE public.taxguard_doc_scan_requests ADD COLUMN IF NOT EXISTS digest char(64);
ALTER TABLE public.taxguard_doc_scan_requests ADD COLUMN IF NOT EXISTS storage_path text;
REVOKE ALL ON public.taxguard_doc_scan_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.taxguard_doc_scan_envelope_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.taxguard_documents;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id=NEW.tenant_id AND client_id=NEW.client_id AND document_id=NEW.document_id AND version=NEW.version FOR UPDATE;
  IF NOT FOUND OR d.status IS DISTINCT FROM 'SCAN_PENDING' OR d.hash IS NULL OR d.hash !~ '^[a-f0-9]{64}$' OR d.storage_path IS NULL THEN RAISE EXCEPTION 'SCAN_DOCUMENT_BINDING_INVALID' USING ERRCODE='P0001';END IF;
  NEW.document_row:=d.id;NEW.digest:=d.hash;NEW.storage_path:=d.storage_path;RETURN NEW;
 END IF;
 IF TG_OP IN('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'SCAN_HISTORY_IMMUTABLE' USING ERRCODE='P0001';END IF;
 IF ROW(NEW.scan_id,NEW.tenant_id,NEW.client_id,NEW.document_id,NEW.version,NEW.provider,NEW.attempt,NEW.requested_at,NEW.expires_at,NEW.document_row,NEW.digest,NEW.storage_path)
  IS DISTINCT FROM ROW(OLD.scan_id,OLD.tenant_id,OLD.client_id,OLD.document_id,OLD.version,OLD.provider,OLD.attempt,OLD.requested_at,OLD.expires_at,OLD.document_row,OLD.digest,OLD.storage_path)
  OR OLD.status IN('COMPLETED','FAILED','EXPIRED') THEN RAISE EXCEPTION 'SCAN_HISTORY_IMMUTABLE' USING ERRCODE='P0001';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS scan_envelope_immutable ON public.taxguard_doc_scan_requests;
CREATE TRIGGER scan_envelope_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.taxguard_doc_scan_requests FOR EACH ROW EXECUTE FUNCTION public.taxguard_doc_scan_envelope_guard();
DROP TRIGGER IF EXISTS scan_history_no_truncate ON public.taxguard_doc_scan_requests;
CREATE TRIGGER scan_history_no_truncate BEFORE TRUNCATE ON public.taxguard_doc_scan_requests FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_doc_scan_envelope_guard();
CREATE OR REPLACE FUNCTION public.taxguard_doc_scan_complete(p_tenant text,p_scan_id uuid,p_verdict text,p_provider text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.taxguard_doc_scan_requests;d public.taxguard_documents;answer jsonb;
BEGIN
 IF p_verdict IS NULL OR p_verdict NOT IN('CLEAN','INFECTED','ERROR') OR p_provider IS NULL OR p_provider !~ '^[A-Za-z0-9_.:-]{1,64}$' THEN RAISE EXCEPTION 'SCAN_INPUT_INVALID' USING ERRCODE='P0001';END IF;
 SELECT * INTO r FROM public.taxguard_doc_scan_requests WHERE scan_id=p_scan_id AND tenant_id=p_tenant;
 IF NOT FOUND THEN RAISE EXCEPTION 'SCAN_REQUEST_NOT_FOUND' USING ERRCODE='P0001';END IF;
 -- Consistent request/callback lock order: document before request.
 SELECT * INTO d FROM public.taxguard_documents WHERE id=r.document_row AND tenant_id=p_tenant AND client_id=r.client_id AND document_id=r.document_id AND version=r.version FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SCAN_DOCUMENT_BINDING_INVALID' USING ERRCODE='P0001';END IF;
 SELECT * INTO r FROM public.taxguard_doc_scan_requests WHERE scan_id=p_scan_id AND tenant_id=p_tenant FOR UPDATE;
 IF r.status IN('COMPLETED','FAILED') THEN RAISE EXCEPTION 'SCAN_VERDICT_REPLAYED' USING ERRCODE='P0001';END IF;
 IF r.provider<>p_provider THEN RAISE EXCEPTION 'SCAN_PROVIDER_MISMATCH' USING ERRCODE='P0001';END IF;
 IF r.status='EXPIRED' OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'SCAN_REQUEST_EXPIRED' USING ERRCODE='P0001';END IF;
 IF d.hash IS DISTINCT FROM r.digest OR d.storage_path IS DISTINCT FROM r.storage_path OR d.status IS DISTINCT FROM 'SCAN_PENDING' THEN RAISE EXCEPTION 'SCAN_DOCUMENT_BINDING_INVALID' USING ERRCODE='P0001';END IF;
 IF p_verdict='ERROR' THEN
  UPDATE public.taxguard_doc_scan_requests SET status='FAILED',verdict='ERROR',completed_at=clock_timestamp() WHERE scan_id=r.scan_id;
  answer:=jsonb_build_object('documentId',r.document_id,'version',r.version,'status','SCAN_PENDING');
 ELSE
  answer:=public.taxguard_doc_record_scan(r.tenant_id,r.client_id,r.document_id,r.version,p_verdict,p_provider);
  UPDATE public.taxguard_doc_scan_requests SET status='COMPLETED',verdict=p_verdict,completed_at=clock_timestamp() WHERE scan_id=r.scan_id;
 END IF;
 PERFORM public.taxguard_doc_audit(r.tenant_id,r.client_id,'system:'||p_provider,'system','DOCUMENT_SCAN_VERDICT',jsonb_build_object('documentId',r.document_id,'version',r.version,'requestId',r.scan_id::text,'result',p_verdict));
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_doc_record_scan(text,text,text,integer,text,text),public.taxguard_doc_scan_envelope_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_doc_scan_complete(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_doc_scan_complete(text,uuid,text,text) TO service_role;
