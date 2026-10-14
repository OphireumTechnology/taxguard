-- PROPOSAL 050 ONLY. NOT APPLIED. Depends on 049 and existing taxguard_client_requests.
-- Human portal clarification/amendment requests only; document requests remain in proposal 031.
-- No signing, payment, external transmission or stage advancement. Historical unscoped rows stay unavailable.
-- Rollback: disable collection request APIs, preserve rows/replies/audit, never restore memory success.
ALTER TABLE public.taxguard_client_requests ADD COLUMN IF NOT EXISTS tax_year integer;
ALTER TABLE public.taxguard_client_requests ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;
DO $$ BEGIN ALTER TABLE public.taxguard_client_requests ADD CONSTRAINT collection_request_scope_fk FOREIGN KEY(tenant_id,client_id,engagement_id,tax_year) REFERENCES public.taxguard_tax_years(tenant_id,client_id,engagement_id,tax_year) NOT VALID;EXCEPTION WHEN duplicate_object THEN NULL;END $$;
REVOKE ALL ON public.taxguard_client_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE IF NOT EXISTS public.taxguard_collection_replies (
 request_id varchar(128) NOT NULL REFERENCES public.taxguard_client_requests(id),reply_id varchar(128) NOT NULL,tenant_id varchar(128) NOT NULL,client_id varchar(64) NOT NULL,
 actor_uid varchar(128) NOT NULL,request_input jsonb NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(request_id,reply_id)
);
ALTER TABLE public.taxguard_collection_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_collection_replies FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS collection_replies_immutable ON public.taxguard_collection_replies;
CREATE TRIGGER collection_replies_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.taxguard_collection_replies FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_collection_history_guard();
CREATE INDEX IF NOT EXISTS collection_requests_scope_page ON public.taxguard_client_requests(tenant_id,client_id,engagement_id,tax_year,id);
CREATE OR REPLACE FUNCTION public.taxguard_collection_request_json(r public.taxguard_client_requests) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('requestId',r.id,'tenantId',r.tenant_id,'clientId',r.client_id,'engagementId',r.engagement_id,'taxYear',r.tax_year,'requestType',r.request_type,
  'title',r.title,'message',r.description,'status',CASE WHEN r.status='RESPONDED' THEN 'CLIENT_RESPONDED' ELSE r.status END,'createdByName','Practice team',
  'createdAt',r.created_at,'dueDate',r.due_date,'clientResponse',r.response_text,'rowVersion',r.row_version) $$;
CREATE OR REPLACE FUNCTION public.taxguard_collection_request_operation(p_tenant text,p_client text,p_actor text,p_year integer,p_engagement text,p_action text,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp SET statement_timeout='5s' AS $$
DECLARE eng text;k text;request_key text;r public.taxguard_client_requests;prior public.taxguard_collection_replies;rows jsonb;rev integer;
BEGIN
 eng:=public.taxguard_collection_scope(p_tenant,p_client,p_actor,p_year,p_engagement);k:=public.taxguard_doc_actor(p_tenant,p_client,p_actor);
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR octet_length(p_input::text)>8192 OR p_action IS NULL OR p_action NOT IN('LIST','CREATE','RESPOND','RESOLVE') THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001';END IF;
 IF p_action='LIST' THEN
  SELECT COALESCE(jsonb_agg(public.taxguard_collection_request_json(q) ORDER BY q.id),'[]'::jsonb) INTO rows FROM(SELECT * FROM public.taxguard_client_requests
   WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=eng AND tax_year=p_year AND (p_input->>'after' IS NULL OR id>p_input->>'after') ORDER BY id LIMIT 101)q;
  RETURN jsonb_build_object('tenantId',p_tenant,'clientId',p_client,'taxYear',p_year,'requests',(SELECT COALESCE(jsonb_agg(value ORDER BY ord),'[]'::jsonb) FROM jsonb_array_elements(rows) WITH ORDINALITY e(value,ord) WHERE ord<=100),
   'nextCursor',CASE WHEN jsonb_array_length(rows)>100 THEN rows->99->>'requestId' END);
 END IF;
 IF p_action='CREATE' THEN
  IF k='client' THEN RAISE EXCEPTION 'COLLECTION_STAFF_REQUIRED' USING ERRCODE='P0001';END IF;
  IF COALESCE(p_input->>'requestType','') NOT IN('CLARIFICATION','AMENDMENT') OR COALESCE(p_input->>'key','') !~ '^[A-Za-z0-9_-]{8,128}$'
   OR length(btrim(COALESCE(p_input->>'title',''))) NOT BETWEEN 2 AND 255 OR length(btrim(COALESCE(p_input->>'message',''))) NOT BETWEEN 2 AND 4000 THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001';END IF;
  request_key:='collect_'||encode(sha256(convert_to(p_tenant||'|'||p_client||'|'||eng||'|'||p_year||'|'||p_actor||'|'||(p_input->>'key'),'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('collection-request:'||request_key,0));
  SELECT * INTO r FROM public.taxguard_client_requests WHERE taxguard_client_requests.id=request_key;
  IF FOUND THEN IF r.title<>btrim(p_input->>'title') OR r.description<>btrim(p_input->>'message') OR r.request_type<>p_input->>'requestType' THEN RAISE EXCEPTION 'COLLECTION_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001';END IF;RETURN public.taxguard_collection_request_json(r);END IF;
  INSERT INTO public.taxguard_client_requests(id,tenant_id,client_id,engagement_id,tax_year,request_type,title,description,created_by,assigned_to_client_id)
   VALUES(request_key,p_tenant,p_client,eng,p_year,p_input->>'requestType',btrim(p_input->>'title'),btrim(p_input->>'message'),p_actor,p_client) RETURNING * INTO r;
  INSERT INTO public.taxguard_audit_log(tenant_id,action,actor_uid,metadata)VALUES(p_tenant,'COLLECTION_REQUEST_CREATED',p_actor,jsonb_build_object('clientId',p_client,'requestId',request_key));
  RETURN public.taxguard_collection_request_json(r);
 END IF;
 SELECT * INTO r FROM public.taxguard_client_requests WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=eng AND tax_year=p_year AND taxguard_client_requests.id=p_input->>'requestId' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_REQUEST_NOT_FOUND' USING ERRCODE='P0001';END IF;
 IF p_action='RESPOND' THEN
  IF k<>'client' OR COALESCE(p_input->>'replyId','') !~ '^[A-Za-z0-9_-]{8,128}$' OR length(btrim(COALESCE(p_input->>'message',''))) NOT BETWEEN 2 AND 4000 THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001';END IF;
  SELECT * INTO prior FROM public.taxguard_collection_replies WHERE request_id=r.id AND reply_id=p_input->>'replyId';
  IF FOUND THEN IF prior.tenant_id<>p_tenant OR prior.client_id<>p_client OR prior.actor_uid<>p_actor OR prior.request_input<>p_input THEN RAISE EXCEPTION 'COLLECTION_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001';END IF;RETURN prior.response;END IF;
 ELSE IF k='client' THEN RAISE EXCEPTION 'COLLECTION_STAFF_REQUIRED' USING ERRCODE='P0001';END IF;END IF;
 BEGIN rev:=(p_input->>'rowVersion')::integer;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001';END;
 IF rev IS NULL OR rev<>r.row_version THEN RAISE EXCEPTION 'COLLECTION_VERSION_CONFLICT' USING ERRCODE='P0001';END IF;
 IF r.status IN('RESOLVED','CLOSED') THEN RAISE EXCEPTION 'COLLECTION_REQUEST_CLOSED' USING ERRCODE='P0001';END IF;
 IF p_action='RESPOND' THEN
  UPDATE public.taxguard_client_requests SET response_text=btrim(p_input->>'message'),status='RESPONDED',row_version=row_version+1,updated_at=clock_timestamp() WHERE taxguard_client_requests.id=r.id RETURNING * INTO r;
  INSERT INTO public.taxguard_collection_replies(request_id,reply_id,tenant_id,client_id,actor_uid,request_input,response)VALUES(r.id,p_input->>'replyId',p_tenant,p_client,p_actor,p_input,public.taxguard_collection_request_json(r));
 ELSE
  UPDATE public.taxguard_client_requests SET status='RESOLVED',resolved_by=p_actor,resolved_at=clock_timestamp(),row_version=row_version+1,updated_at=clock_timestamp() WHERE taxguard_client_requests.id=r.id RETURNING * INTO r;
 END IF;
 INSERT INTO public.taxguard_audit_log(tenant_id,action,actor_uid,metadata)VALUES(p_tenant,'COLLECTION_REQUEST_'||p_action,p_actor,jsonb_build_object('clientId',p_client,'requestId',r.id));
 RETURN public.taxguard_collection_request_json(r);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_collection_request_json(public.taxguard_client_requests) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_collection_request_operation(text,text,text,integer,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_collection_request_operation(text,text,text,integer,text,text,jsonb) TO service_role;
