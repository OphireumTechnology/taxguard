-- PROPOSAL 052 ONLY. NOT APPLIED. Depends on 027. Provider commissioning remains blocked.
-- Durable one-use correlation, exact bytes/version/path binding and a 60-second deadline.
-- Transport authentication/signature verification remains the trusted adapter's responsibility.
-- Timeout or conflicting verdict leaves quarantine closed. Rescan needs a new upload version.
-- Rollback: disable scanning, preserve jobs, do not restore the unbound service grant.
CREATE TABLE IF NOT EXISTS public.taxguard_document_scan_jobs(
 document_row uuid PRIMARY KEY REFERENCES public.taxguard_documents(id),request_id uuid UNIQUE NOT NULL,
 tenant_id varchar(128) NOT NULL,client_id varchar(64) NOT NULL,document_id text NOT NULL,version integer NOT NULL,
 digest char(64) NOT NULL,storage_path text NOT NULL,scanner varchar(64) NOT NULL,
 issued_at bigint NOT NULL,expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '60 seconds',
 consumed_at timestamptz,result varchar(16),CHECK ((consumed_at IS NULL)=(result IS NULL)),CHECK(result IS NULL OR result IN('CLEAN','INFECTED'))
);
ALTER TABLE public.taxguard_document_scan_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_document_scan_jobs FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.taxguard_doc_scan_job(p_tenant text,p_client text,p_document text,p_version integer,p_request uuid,p_digest text,p_scanner text,p_issued bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.taxguard_documents;j public.taxguard_document_scan_jobs;
BEGIN
 IF p_request IS NULL OR p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$' OR p_scanner IS NULL OR p_scanner !~ '^[A-Za-z0-9_.:-]{1,64}$'
  OR p_issued IS NULL OR abs(extract(epoch FROM clock_timestamp())*1000-p_issued)>30000 THEN RAISE EXCEPTION 'DOCUMENT_SCAN_JOB_INVALID' USING ERRCODE='P0001';END IF;
 SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id=p_tenant AND client_id=p_client AND document_id=p_document AND version=p_version FOR UPDATE;
 IF NOT FOUND OR d.status<>'SCAN_PENDING' OR d.hash<>p_digest THEN RAISE EXCEPTION 'DOCUMENT_SCAN_JOB_INVALID' USING ERRCODE='P0001';END IF;
 SELECT * INTO j FROM public.taxguard_document_scan_jobs WHERE document_row=d.id;
 IF FOUND THEN
  IF j.request_id<>p_request OR j.digest<>p_digest OR j.scanner<>p_scanner OR j.issued_at<>p_issued OR j.consumed_at IS NOT NULL OR j.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'DOCUMENT_SCAN_JOB_CONFLICT' USING ERRCODE='P0001';END IF;
 ELSE INSERT INTO public.taxguard_document_scan_jobs(document_row,request_id,tenant_id,client_id,document_id,version,digest,storage_path,scanner,issued_at)
  VALUES(d.id,p_request,p_tenant,p_client,p_document,p_version,p_digest,d.storage_path,p_scanner,p_issued) RETURNING * INTO j;
 END IF;
 RETURN jsonb_build_object('requestId',j.request_id,'expiresAt',j.expires_at);
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_doc_scan_verdict(p_tenant text,p_client text,p_document text,p_version integer,p_request uuid,p_digest text,p_scanner text,p_issued bigint,p_result text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.taxguard_documents;j public.taxguard_document_scan_jobs;answer jsonb;
BEGIN
 SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id=p_tenant AND client_id=p_client AND document_id=p_document AND version=p_version FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_SCAN_JOB_INVALID' USING ERRCODE='P0001';END IF;
 SELECT * INTO j FROM public.taxguard_document_scan_jobs WHERE document_row=d.id FOR UPDATE;
 IF NOT FOUND OR p_request IS NULL OR j.request_id<>p_request OR p_digest IS DISTINCT FROM j.digest OR p_scanner IS DISTINCT FROM j.scanner
  OR p_issued IS DISTINCT FROM j.issued_at OR d.hash<>j.digest OR d.storage_path<>j.storage_path OR p_result IS NULL OR p_result NOT IN('CLEAN','INFECTED')
  THEN RAISE EXCEPTION 'DOCUMENT_SCAN_JOB_INVALID' USING ERRCODE='P0001';END IF;
 IF j.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'DOCUMENT_SCAN_REPLAY_DENIED' USING ERRCODE='P0001';END IF;
 IF j.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'DOCUMENT_SCAN_EXPIRED' USING ERRCODE='P0001';END IF;
 answer:=public.taxguard_doc_record_scan(p_tenant,p_client,p_document,p_version,p_result,p_scanner);
 UPDATE public.taxguard_document_scan_jobs SET consumed_at=clock_timestamp(),result=p_result WHERE document_row=d.id;
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_doc_record_scan(text,text,text,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_doc_scan_job(text,text,text,integer,uuid,text,text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.taxguard_doc_scan_verdict(text,text,text,integer,uuid,text,text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_doc_scan_job(text,text,text,integer,uuid,text,text,bigint),public.taxguard_doc_scan_verdict(text,text,text,integer,uuid,text,text,bigint,text) TO service_role;
