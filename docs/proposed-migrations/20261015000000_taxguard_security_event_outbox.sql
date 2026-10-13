-- PROPOSAL 047 ONLY. NOT APPLIED. Depends on proposal 046 and the actual core schema.
-- Acknowledged enqueue commits a minimal immutable envelope. Delivery is at least once;
-- UUID audit identity plus the same transaction for audit insertion and completion prevents
-- duplicate audit rows. Pending/blocked rows are retained; no retention/deletion policy invented.
-- Rollback: stop producers/dispatchers, preserve all envelopes and audit rows, disable ingestion.
-- Do not drop the outbox or revert confidentiality/immutability during rollback.
CREATE TABLE IF NOT EXISTS public.taxguard_security_outbox (
  event_id uuid PRIMARY KEY, tenant_id varchar(128) NOT NULL REFERENCES public.taxguard_tenants(id),
  actor_uid varchar(128) NOT NULL, actor_role varchar(64) NOT NULL,
  event_code text NOT NULL CHECK (event_code IN ('AUTH_FAILURE','AUTH_LOCKOUT','MFA_DENIAL','AUTHORIZATION_DENIAL','DOCUMENT_DENIAL','MALWARE_DETECTED','ADMIN_DENIAL')),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DELIVERED','BLOCKED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  next_attempt_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz,
  failure_code varchar(64), CHECK ((status = 'DELIVERED') = (delivered_at IS NOT NULL))
);
ALTER TABLE public.taxguard_security_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_security_outbox FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS taxguard_security_outbox_pending ON public.taxguard_security_outbox(tenant_id,next_attempt_at,occurred_at,event_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS taxguard_security_outbox_received ON public.taxguard_security_outbox(tenant_id,occurred_at);

CREATE OR REPLACE FUNCTION public.taxguard_security_enqueue(p_tenant text,p_actor text,p_event uuid,p_code text,p_severity text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp SET statement_timeout='5s' AS $$
DECLARE r text; previous public.taxguard_security_outbox;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_event IS NULL
    OR (p_actor IS NOT NULL AND p_actor !~ '^[A-Za-z0-9_-]{1,128}$') OR p_code IS NULL
    OR p_code NOT IN ('AUTH_FAILURE','AUTH_LOCKOUT','MFA_DENIAL','AUTHORIZATION_DENIAL','DOCUMENT_DENIAL','MALWARE_DETECTED','ADMIN_DENIAL')
    OR p_severity IS NULL OR p_severity NOT IN ('info','warning','critical') THEN RAISE EXCEPTION 'SECURITY_EVENT_INVALID' USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.taxguard_tenants WHERE id=p_tenant AND status='active') THEN RAISE EXCEPTION 'SECURITY_TENANT_DENIED' USING ERRCODE='P0001'; END IF;
  IF p_actor IS NOT NULL THEN
    SELECT role INTO r FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor;
    IF NOT FOUND THEN RAISE EXCEPTION 'SECURITY_ACTOR_DENIED' USING ERRCODE='P0001'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('security-outbox:'||p_tenant,0));
  SELECT * INTO previous FROM public.taxguard_security_outbox WHERE event_id=p_event;
  IF FOUND THEN
    IF previous.tenant_id<>p_tenant OR previous.actor_uid<>COALESCE(p_actor,'security_ingest') OR previous.event_code<>p_code OR previous.severity<>p_severity
      THEN RAISE EXCEPTION 'SECURITY_EVENT_CONFLICT' USING ERRCODE='P0001'; END IF;
    RETURN jsonb_build_object('eventId',p_event,'acknowledged',true,'replayed',true);
  END IF;
  IF (SELECT count(*) FROM public.taxguard_security_outbox WHERE tenant_id=p_tenant AND status<>'DELIVERED') >= 10000
    THEN RAISE EXCEPTION 'SECURITY_OUTBOX_FULL' USING ERRCODE='P0001'; END IF;
  IF (SELECT count(*) FROM public.taxguard_security_outbox WHERE tenant_id=p_tenant AND occurred_at>=date_trunc('minute',clock_timestamp())) >= 1200
    THEN RAISE EXCEPTION 'SECURITY_INGEST_LIMIT' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.taxguard_security_outbox(event_id,tenant_id,actor_uid,actor_role,event_code,severity)
    VALUES(p_event,p_tenant,COALESCE(p_actor,'security_ingest'),COALESCE(r,'system'),p_code,p_severity);
  RETURN jsonb_build_object('eventId',p_event,'acknowledged',true,'replayed',false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_security_dispatch(p_tenant text,p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp SET statement_timeout='5s' AS $$
DECLARE e public.taxguard_security_outbox; prior public.taxguard_audit_log; delivered integer:=0; failed integer:=0;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'SECURITY_EVENT_INVALID' USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.taxguard_tenants WHERE id=p_tenant) THEN RAISE EXCEPTION 'SECURITY_TENANT_DENIED' USING ERRCODE='P0001'; END IF;
  FOR e IN SELECT * FROM public.taxguard_security_outbox WHERE tenant_id=p_tenant AND status='PENDING' AND next_attempt_at<=clock_timestamp()
    ORDER BY occurred_at,event_id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    BEGIN
      INSERT INTO public.taxguard_audit_log(id,tenant_id,action,actor_uid,actor_role,metadata,timestamp)
        VALUES(e.event_id,e.tenant_id,'SECURITY_'||e.event_code,e.actor_uid,e.actor_role,jsonb_build_object('category','SECURITY','severity',e.severity),e.occurred_at)
        ON CONFLICT(id) DO NOTHING;
      SELECT * INTO prior FROM public.taxguard_audit_log WHERE id=e.event_id;
      IF prior.tenant_id<>e.tenant_id OR prior.actor_uid<>e.actor_uid OR prior.actor_role IS DISTINCT FROM e.actor_role OR prior.action<>'SECURITY_'||e.event_code
        OR prior.metadata IS DISTINCT FROM jsonb_build_object('category','SECURITY','severity',e.severity)
        THEN RAISE EXCEPTION 'SECURITY_EVENT_CONFLICT' USING ERRCODE='P0001'; END IF;
      UPDATE public.taxguard_security_outbox SET status='DELIVERED',delivered_at=clock_timestamp(),failure_code=NULL WHERE event_id=e.event_id;
      delivered:=delivered+1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.taxguard_security_outbox SET attempts=attempts+1,status=CASE WHEN attempts+1>=8 THEN 'BLOCKED' ELSE 'PENDING' END,
        next_attempt_at=clock_timestamp()+make_interval(secs=>LEAST(3600,5*(2^attempts)::integer)),failure_code='SECURITY_DELIVERY_FAILED' WHERE event_id=e.event_id;
      failed:=failed+1;
    END;
  END LOOP;
  RETURN jsonb_build_object('delivered',delivered,'failed',failed);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_security_outbox_metrics(p_tenant text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp SET statement_timeout='5s' AS $$
 SELECT jsonb_build_object('pending',count(*) FILTER(WHERE status='PENDING'),'blocked',count(*) FILTER(WHERE status='BLOCKED'),
   'delivered',count(*) FILTER(WHERE status='DELIVERED'),'oldestPendingAt',min(occurred_at) FILTER(WHERE status<>'DELIVERED'))
 FROM public.taxguard_security_outbox WHERE tenant_id=p_tenant $$;
CREATE OR REPLACE FUNCTION public.taxguard_security_outbox_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'SECURITY_OUTBOX_IMMUTABLE' USING ERRCODE='55000'; END IF;
  IF (NEW.event_id,NEW.tenant_id,NEW.actor_uid,NEW.actor_role,NEW.event_code,NEW.severity,NEW.occurred_at)
    IS DISTINCT FROM (OLD.event_id,OLD.tenant_id,OLD.actor_uid,OLD.actor_role,OLD.event_code,OLD.severity,OLD.occurred_at)
    OR OLD.status IN ('DELIVERED','BLOCKED') THEN RAISE EXCEPTION 'SECURITY_OUTBOX_IMMUTABLE' USING ERRCODE='55000'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS taxguard_security_outbox_guard ON public.taxguard_security_outbox;
CREATE TRIGGER taxguard_security_outbox_guard BEFORE UPDATE OR DELETE ON public.taxguard_security_outbox FOR EACH ROW EXECUTE FUNCTION public.taxguard_security_outbox_guard();
DROP TRIGGER IF EXISTS taxguard_security_outbox_no_truncate ON public.taxguard_security_outbox;
CREATE TRIGGER taxguard_security_outbox_no_truncate BEFORE TRUNCATE ON public.taxguard_security_outbox FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_security_outbox_guard();
REVOKE ALL ON FUNCTION public.taxguard_security_outbox_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_security_enqueue(text,text,uuid,text,text),public.taxguard_security_dispatch(text,integer),public.taxguard_security_outbox_metrics(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_security_enqueue(text,text,uuid,text,text),public.taxguard_security_dispatch(text,integer),public.taxguard_security_outbox_metrics(text) TO service_role;
