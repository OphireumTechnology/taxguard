-- PROPOSAL 010 ONLY. NOT APPLIED. Requires core and proposals 000-009.
-- Partial recovery foundation: service must verify fresh durable AAL2 administrator proof.
-- No provider operation, job runner, factor identifier, enrollment, gate clearing or completion.
-- The pending reset job is UNAVAILABLE until a separately commissioned fenced adapter exists.
-- Locks: target member -> administrator members SHARE -> actor session SHARE NOWAIT
-- -> target identity -> request -> target sessions. Actor session is disjoint from target.
-- Member locks use NOWAIT so cross-admin requests and legacy actor-first lifecycle cannot
-- form a wait cycle. SQLSTATE 55P03 is a retryable conflict, never recovery authorization.
-- Real PostgreSQL overlapping transactions remain a commissioning requirement.
CREATE TABLE public.taxguard_mfa_recovery_requests (
  request_id varchar(36) PRIMARY KEY CHECK (request_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  tenant_id varchar(128) NOT NULL REFERENCES public.taxguard_tenants(id),
  target_uid varchar(128) NOT NULL,
  maker_uid varchar(128) NOT NULL,
  reason_category varchar(32) NOT NULL CHECK (reason_category IN ('lost_authenticator','compromised_factor','device_replacement')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000 AND reason=btrim(reason) AND reason !~ '[[:cntrl:]]' AND reason !~ ('['||chr(127)||'-'||chr(159)||']')),
  status varchar(32) NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved')),
  checker_uid varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  FOREIGN KEY(tenant_id,target_uid) REFERENCES public.taxguard_members(tenant_id,uid),
  CHECK (maker_uid<>target_uid),
  CHECK ((status='pending_approval' AND checker_uid IS NULL AND approved_at IS NULL) OR
    (status='approved' AND checker_uid IS NOT NULL AND checker_uid<>maker_uid AND checker_uid<>target_uid AND approved_at IS NOT NULL)),
  UNIQUE(tenant_id,target_uid), UNIQUE(tenant_id,request_id)
);
CREATE TABLE public.taxguard_mfa_reset_jobs (
  job_id varchar(36) PRIMARY KEY,
  tenant_id varchar(128) NOT NULL,
  request_id varchar(36) NOT NULL UNIQUE,
  target_uid varchar(128) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status='pending'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,request_id) REFERENCES public.taxguard_mfa_recovery_requests(tenant_id,request_id),
  FOREIGN KEY(tenant_id,target_uid) REFERENCES public.taxguard_members(tenant_id,uid),
  CHECK(job_id=request_id)
);
ALTER TABLE public.taxguard_mfa_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_mfa_reset_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_mfa_recovery_requests,public.taxguard_mfa_reset_jobs FROM PUBLIC,anon,authenticated,service_role;
-- The service invokes audited RPCs; even service-role callers cannot directly mutate jobs.
CREATE OR REPLACE FUNCTION public.taxguard_request_mfa_recovery(
  p_tenant text,p_actor text,p_uid text,p_request_id text,p_reason_category text,p_reason text,p_actor_session_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE m public.taxguard_members%ROWTYPE; i jsonb; r public.taxguard_mfa_recovery_requests%ROWTYPE; actor_role text; actor_epoch timestamptz; actor_auth bigint; actor_i jsonb;
BEGIN
  IF p_actor_session_hash IS NULL OR p_actor_session_hash !~ '^[a-f0-9]{64}$' OR p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' OR
    p_uid IS NULL OR p_uid !~ '^[A-Za-z0-9_-]{1,128}$' OR p_request_id IS NULL OR p_request_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR
    p_reason_category IS NULL OR p_reason_category NOT IN ('lost_authenticator','compromised_factor','device_replacement') OR
    p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 OR p_reason ~ '[[:cntrl:]]' OR p_reason ~ ('['||chr(127)||'-'||chr(159)||']') THEN
    RAISE EXCEPTION 'MFA_RECOVERY_INPUT_INVALID' USING ERRCODE='P0001';
  END IF;
  IF p_actor=p_uid THEN RAISE EXCEPTION 'INDEPENDENT_ACTOR_REQUIRED' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id=p_tenant AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_DENIED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO m FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_uid FOR UPDATE NOWAIT;
  IF NOT FOUND OR m.role NOT IN ('accountant','reviewer','senior_reviewer','bookkeeper','practice_manager','operations','admin','administrator','consultant','managing_consultant','founder','legal_specialist','firm_manager','recruiter') OR m.status NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'STAFF_TARGET_DENIED' USING ERRCODE='P0001';
  END IF;
  SELECT role,status_changed_at INTO actor_role,actor_epoch FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor AND status='active'
    AND NOT mfa_reenrollment_required AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
  SELECT user_data INTO actor_i FROM public.taxguard_identities WHERE tenant_id=p_tenant AND uid=p_actor FOR SHARE NOWAIT;
  IF NOT FOUND OR actor_i->>'id' IS DISTINCT FROM p_actor OR actor_i->>'role' IS DISTINCT FROM actor_role
    OR actor_i->>'status' IS DISTINCT FROM 'active' OR (actor_i ? 'tenantId' AND actor_i->>'tenantId' IS DISTINCT FROM p_tenant) THEN
    RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001';
  END IF;
  -- Proof must still name a live durable administrator session inside this transaction.
  -- NOWAIT prevents actor-session locks from cycling with existing lifecycle transactions.
  SELECT auth_time INTO actor_auth FROM public.taxguard_sessions WHERE tenant_id=p_tenant AND uid=p_actor
    AND session_token_hash=p_actor_session_hash AND revoked=false AND aal='aal2'
    AND expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF actor_auth IS NULL OR actor_auth<=0 OR actor_auth>floor(extract(epoch FROM clock_timestamp()))::bigint+30 THEN
    RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE='P0001';
  END IF;
  IF actor_epoch IS NOT NULL AND to_timestamp(actor_auth)<=actor_epoch THEN
    RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE='P0001';
  END IF;
  SELECT user_data INTO i FROM public.taxguard_identities WHERE tenant_id=p_tenant AND uid=p_uid FOR UPDATE;
  IF NOT FOUND OR i->>'id' IS DISTINCT FROM p_uid OR i->>'tenantId' IS DISTINCT FROM p_tenant OR i->>'role' IS DISTINCT FROM m.role OR i->>'status' IS DISTINCT FROM m.status THEN
    RAISE EXCEPTION 'STAFF_IDENTITY_INCONSISTENT' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO r FROM public.taxguard_mfa_recovery_requests WHERE request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF r.tenant_id<>p_tenant OR r.target_uid<>p_uid OR r.maker_uid<>p_actor OR r.reason_category<>p_reason_category OR r.reason<>btrim(p_reason) THEN
      RAISE EXCEPTION 'MFA_RECOVERY_REQUEST_CONFLICT' USING ERRCODE='P0001';
    END IF;
    IF (r.status='pending_approval' AND m.mfa_reenrollment_required) OR
       (r.status='approved' AND (m.status<>'suspended' OR NOT m.mfa_reenrollment_required OR i->>'mfaEnabled' IS DISTINCT FROM 'false' OR NOT EXISTS(SELECT 1 FROM public.taxguard_mfa_reset_jobs WHERE request_id=r.request_id AND tenant_id=p_tenant AND target_uid=p_uid AND status='pending'))) THEN
      RAISE EXCEPTION 'MFA_RECOVERY_STATE_CONFLICT' USING ERRCODE='P0001';
    END IF;
    RETURN jsonb_build_object('requestId',r.request_id,'targetUid',p_uid,'status',r.status,'resumed',true) || CASE WHEN r.status='approved' THEN jsonb_build_object('jobId',r.request_id) ELSE '{}'::jsonb END;
  END IF;
  IF m.mfa_reenrollment_required THEN RAISE EXCEPTION 'STAFF_MFA_REENROLLMENT_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF EXISTS(SELECT 1 FROM public.taxguard_mfa_recovery_requests WHERE tenant_id=p_tenant AND target_uid=p_uid) THEN
    RAISE EXCEPTION 'MFA_RECOVERY_ALREADY_OUTSTANDING' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.taxguard_mfa_recovery_requests(request_id,tenant_id,target_uid,maker_uid,reason_category,reason)
    VALUES(p_request_id,p_tenant,p_uid,p_actor,p_reason_category,btrim(p_reason));
  INSERT INTO public.taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata) VALUES(p_tenant,'STAFF_MFA_RECOVERY_REQUESTED',p_actor,actor_role,
    jsonb_build_object('requestId',p_request_id,'uid',p_uid,'reasonCategory',p_reason_category));
  RETURN jsonb_build_object('requestId',p_request_id,'targetUid',p_uid,'status','pending_approval','resumed',false);
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_approve_mfa_recovery(p_tenant text,p_actor text,p_request_id text,p_actor_session_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.taxguard_mfa_recovery_requests%ROWTYPE; m public.taxguard_members%ROWTYPE; i jsonb; actor_role text; actor_epoch timestamptz; actor_auth bigint; actor_i jsonb; revoked_count integer; stamp timestamptz;
BEGIN
  IF p_actor_session_hash IS NULL OR p_actor_session_hash !~ '^[a-f0-9]{64}$' OR p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' OR
    p_request_id IS NULL OR p_request_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
    RAISE EXCEPTION 'MFA_RECOVERY_INPUT_INVALID' USING ERRCODE='P0001';
  END IF;
  -- Unlocked scoped discovery; all values are rechecked after authority locks.
  SELECT * INTO r FROM public.taxguard_mfa_recovery_requests WHERE tenant_id=p_tenant AND request_id=p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  IF p_actor IN (r.maker_uid,r.target_uid) THEN RAISE EXCEPTION 'INDEPENDENT_APPROVER_REQUIRED' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id=p_tenant AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_DENIED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO m FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=r.target_uid FOR UPDATE NOWAIT;
  IF NOT FOUND OR m.role NOT IN ('accountant','reviewer','senior_reviewer','bookkeeper','practice_manager','operations','admin','administrator','consultant','managing_consultant','founder','legal_specialist','firm_manager','recruiter') OR m.status NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'STAFF_TARGET_DENIED' USING ERRCODE='P0001';
  END IF;
  SELECT role,status_changed_at INTO actor_role,actor_epoch FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor AND status='active' AND NOT mfa_reenrollment_required
    AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=r.maker_uid AND status='active' AND NOT mfa_reenrollment_required
    AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
  SELECT user_data INTO actor_i FROM public.taxguard_identities WHERE tenant_id=p_tenant AND uid=p_actor FOR SHARE NOWAIT;
  IF NOT FOUND OR actor_i->>'id' IS DISTINCT FROM p_actor OR actor_i->>'role' IS DISTINCT FROM actor_role
    OR actor_i->>'status' IS DISTINCT FROM 'active' OR (actor_i ? 'tenantId' AND actor_i->>'tenantId' IS DISTINCT FROM p_tenant) THEN
    RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001';
  END IF;
  -- Proof must still name a live durable administrator session inside this transaction.
  -- NOWAIT prevents actor-session locks from cycling with existing lifecycle transactions.
  SELECT auth_time INTO actor_auth FROM public.taxguard_sessions WHERE tenant_id=p_tenant AND uid=p_actor
    AND session_token_hash=p_actor_session_hash AND revoked=false AND aal='aal2'
    AND expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF actor_auth IS NULL OR actor_auth<=0 OR actor_auth>floor(extract(epoch FROM clock_timestamp()))::bigint+30 THEN
    RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE='P0001';
  END IF;
  IF actor_epoch IS NOT NULL AND to_timestamp(actor_auth)<=actor_epoch THEN
    RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE='P0001';
  END IF;
  SELECT user_data INTO i FROM public.taxguard_identities WHERE tenant_id=p_tenant AND uid=r.target_uid FOR UPDATE;
  IF NOT FOUND OR i->>'id' IS DISTINCT FROM r.target_uid OR i->>'tenantId' IS DISTINCT FROM p_tenant OR i->>'role' IS DISTINCT FROM m.role OR i->>'status' IS DISTINCT FROM m.status THEN
    RAISE EXCEPTION 'STAFF_IDENTITY_INCONSISTENT' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO r FROM public.taxguard_mfa_recovery_requests WHERE tenant_id=p_tenant AND request_id=p_request_id AND target_uid=m.uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  IF r.status='approved' THEN
    IF r.checker_uid<>p_actor OR m.status<>'suspended' OR NOT m.mfa_reenrollment_required OR i->>'mfaEnabled' IS DISTINCT FROM 'false' OR
       NOT EXISTS(SELECT 1 FROM public.taxguard_mfa_reset_jobs WHERE tenant_id=p_tenant AND request_id=p_request_id AND target_uid=m.uid AND status='pending') THEN
      RAISE EXCEPTION 'MFA_RECOVERY_STATE_CONFLICT' USING ERRCODE='P0001';
    END IF;
    RETURN jsonb_build_object('requestId',p_request_id,'targetUid',m.uid,'status','approved','jobId',p_request_id,'resumed',true);
  END IF;
  IF m.mfa_reenrollment_required THEN RAISE EXCEPTION 'STAFF_MFA_REENROLLMENT_REQUIRED' USING ERRCODE='P0001'; END IF;
  stamp:=clock_timestamp();
  UPDATE public.taxguard_members SET status='suspended',mfa_reenrollment_required=true,status_changed_by=p_actor,status_changed_at=stamp,status_reason=r.reason,updated_at=stamp
    WHERE tenant_id=p_tenant AND uid=m.uid;
  UPDATE public.taxguard_identities SET user_data=jsonb_set(jsonb_set(user_data,'{status}','"suspended"'::jsonb),'{mfaEnabled}','false'::jsonb),updated_at=stamp
    WHERE tenant_id=p_tenant AND uid=m.uid;
  UPDATE public.taxguard_sessions SET revoked=true WHERE tenant_id=p_tenant AND uid=m.uid AND revoked=false;
  GET DIAGNOSTICS revoked_count=ROW_COUNT;
  UPDATE public.taxguard_mfa_recovery_requests SET status='approved',checker_uid=p_actor,approved_at=stamp WHERE request_id=p_request_id;
  INSERT INTO public.taxguard_mfa_reset_jobs(job_id,tenant_id,request_id,target_uid) VALUES(p_request_id,p_tenant,p_request_id,m.uid);
  INSERT INTO public.taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata) VALUES(p_tenant,'STAFF_MFA_RECOVERY_APPROVED',p_actor,actor_role,
    jsonb_build_object('requestId',p_request_id,'jobId',p_request_id,'uid',m.uid,'reasonCategory',r.reason_category,'previousStatus',m.status,'status','suspended','revokedSessions',revoked_count));
  RETURN jsonb_build_object('requestId',p_request_id,'targetUid',m.uid,'status','approved','jobId',p_request_id,'resumed',false);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_request_mfa_recovery(text,text,text,text,text,text,text),public.taxguard_approve_mfa_recovery(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_request_mfa_recovery(text,text,text,text,text,text,text),public.taxguard_approve_mfa_recovery(text,text,text,text) TO service_role;
