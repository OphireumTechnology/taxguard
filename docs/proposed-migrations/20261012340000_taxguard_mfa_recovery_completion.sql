-- PROPOSAL 034 ONLY. NOT APPLIED. Requires the actual core schema and proposals 000-011 and 023.
-- Completes staff MFA recovery and adds privileged reauthentication (recent sign-in).
--
-- Recovery lifecycle (request and independent approval remain proposal 010):
--   approved  -> job 'pending'  (target suspended, re-enrolment gate set, sessions revoked: 010)
--   pending   -> 'leased'        a worker claims the job under a lease with a monotonically increasing
--                                fence; only the current fence holder may report an outcome
--   leased    -> 'reset_verified' the provider adapter removed every factor AND a fresh provider
--                                inventory shows none of them remain (never assumed from a response)
--   leased    -> 'pending'        retryable failure with exponential back-off, or 'failed' after the
--                                maximum attempts (the member stays suspended and gated)
--   reset_verified -> 'enrollment_verified'  the target proved, through the provider, a fresh primary
--                                sign-in after the reset, AAL2, and a newly created verified factor that
--                                is not one of the removed factors (only hashes of factor IDs are kept)
--   enrollment_verified -> 'completed'  an administrator other than the target, with a RECENT AAL2
--                                sign-in, reactivates: gate cleared, status active, status epoch moved
--                                so every earlier sign-in proof (including the enrolment proof) is
--                                stale; the member must sign in again. Request becomes 'completed'.
--   pending_approval -> 'cancelled' by an administrator (recent sign-in) with a reason.
-- Privileged reauthentication: taxguard_privileged_session(...) is the shared check (live AAL2
-- durable session named by its token hash, identity consistent, sign-in after the status epoch and
-- no older than taxguard_privileged_max_age_seconds()). Recovery actions enforce it in the database;
-- the service calls it before other privileged actions.
-- No authenticator secret, code, seed or raw factor ID is stored or audited.
-- Rollback (development): drop the new functions; restore the 010/011 function definitions; drop the
-- added columns, index and constraints and restore the original CHECK / UNIQUE constraints.

CREATE OR REPLACE FUNCTION public.taxguard_privileged_max_age_seconds() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 900 $$;

-- Requests: completion and cancellation, and one OPEN request per member instead of one ever.
ALTER TABLE public.taxguard_mfa_recovery_requests ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.taxguard_mfa_recovery_requests ADD COLUMN IF NOT EXISTS completed_by varchar(128);
ALTER TABLE public.taxguard_mfa_recovery_requests ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.taxguard_mfa_recovery_requests ADD COLUMN IF NOT EXISTS cancelled_by varchar(128);
ALTER TABLE public.taxguard_mfa_recovery_requests ADD COLUMN IF NOT EXISTS cancel_reason text;
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.taxguard_mfa_recovery_requests'::regclass
      AND ((contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%' AND conname <> 'chk_taxguard_mfa_recovery_lifecycle')
        OR (contype = 'u' AND pg_get_constraintdef(oid) = 'UNIQUE (tenant_id, target_uid)')) LOOP
    EXECUTE format('ALTER TABLE public.taxguard_mfa_recovery_requests DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
DO $$ BEGIN
  ALTER TABLE public.taxguard_mfa_recovery_requests ADD CONSTRAINT chk_taxguard_mfa_recovery_lifecycle CHECK (
    (status = 'pending_approval' AND checker_uid IS NULL AND approved_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL) OR
    (status = 'approved' AND checker_uid IS NOT NULL AND checker_uid <> maker_uid AND checker_uid <> target_uid AND approved_at IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NULL) OR
    (status = 'completed' AND checker_uid IS NOT NULL AND approved_at IS NOT NULL AND completed_at IS NOT NULL AND completed_by IS NOT NULL AND completed_by <> target_uid AND cancelled_at IS NULL) OR
    (status = 'cancelled' AND checker_uid IS NULL AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancelled_by <> target_uid
      AND length(btrim(cancel_reason)) BETWEEN 10 AND 1000 AND cancel_reason !~ '[[:cntrl:]]'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_mfa_recovery_open ON public.taxguard_mfa_recovery_requests (tenant_id, target_uid)
  WHERE status IN ('pending_approval','approved');

-- Jobs: fenced leases, attempts, verified reset and verified re-enrolment.
ALTER TABLE public.taxguard_mfa_reset_jobs ALTER COLUMN status TYPE varchar(32);
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS fence bigint NOT NULL DEFAULT 0;
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS lease_owner varchar(128);
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS last_error_code varchar(64);
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS reset_at timestamptz;
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS removed_factor_hashes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS enrolled_factor_hash char(64);
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS enrollment_verified_at timestamptz;
ALTER TABLE public.taxguard_mfa_reset_jobs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.taxguard_mfa_reset_jobs'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%' AND conname <> 'chk_taxguard_mfa_reset_job_lifecycle' LOOP
    EXECUTE format('ALTER TABLE public.taxguard_mfa_reset_jobs DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
DO $$ BEGIN
  ALTER TABLE public.taxguard_mfa_reset_jobs ADD CONSTRAINT chk_taxguard_mfa_reset_job_lifecycle CHECK (
    status IN ('pending','leased','reset_verified','enrollment_verified','completed','failed') AND attempts >= 0 AND fence >= 0
    AND ((status = 'leased') = (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL))
    AND ((status IN ('reset_verified','enrollment_verified','completed')) = (reset_at IS NOT NULL))
    AND ((status IN ('enrollment_verified','completed')) = (enrolled_factor_hash IS NOT NULL AND enrollment_verified_at IS NOT NULL))
    AND ((status = 'completed') = (completed_at IS NOT NULL))
    AND (enrolled_factor_hash IS NULL OR NOT (enrolled_factor_hash = ANY (removed_factor_hashes))));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_taxguard_mfa_reset_jobs_runnable ON public.taxguard_mfa_reset_jobs (next_attempt_at) WHERE status IN ('pending','leased');

-- ------------------------------------------------------------------------------------------
-- Privileged reauthentication
-- ------------------------------------------------------------------------------------------
-- Raises STAFF_ADMIN_REQUIRED, STAFF_FRESH_SIGN_IN_REQUIRED or STAFF_RECENT_SIGN_IN_REQUIRED.
-- p_roles names the roles allowed for the action. Locks are SHARE NOWAIT (retryable 55P03).
CREATE OR REPLACE FUNCTION public.taxguard_privileged_session(p_tenant text, p_actor text, p_session_hash text, p_roles text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor_role text; actor_epoch timestamptz; actor_auth bigint; actor_i jsonb; now_s bigint := floor(extract(epoch FROM clock_timestamp()))::bigint;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_session_hash IS NULL OR p_session_hash !~ '^[a-f0-9]{64}$' OR p_roles IS NULL OR cardinality(p_roles) = 0 THEN
    RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id = p_tenant AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT role, status_changed_at INTO actor_role, actor_epoch FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active'
    AND NOT mfa_reenrollment_required AND role = ANY (p_roles) FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT user_data INTO actor_i FROM public.taxguard_identities WHERE tenant_id = p_tenant AND uid = p_actor FOR SHARE NOWAIT;
  IF NOT FOUND OR actor_i->>'id' IS DISTINCT FROM p_actor OR actor_i->>'role' IS DISTINCT FROM actor_role OR actor_i->>'status' IS DISTINCT FROM 'active'
     OR (actor_i ? 'tenantId' AND actor_i->>'tenantId' IS DISTINCT FROM p_tenant) THEN
    RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  SELECT auth_time INTO actor_auth FROM public.taxguard_sessions WHERE tenant_id = p_tenant AND uid = p_actor AND session_token_hash = p_session_hash
    AND revoked = false AND aal = 'aal2' AND expires_at > floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF actor_auth IS NULL OR actor_auth <= 0 OR actor_auth > now_s + 30 OR (actor_epoch IS NOT NULL AND to_timestamp(actor_auth) <= actor_epoch) THEN
    RAISE EXCEPTION 'STAFF_FRESH_SIGN_IN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF actor_auth < now_s - public.taxguard_privileged_max_age_seconds() THEN RAISE EXCEPTION 'STAFF_RECENT_SIGN_IN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object('role', actor_role, 'authTime', actor_auth, 'ageSeconds', now_s - actor_auth, 'maxAgeSeconds', public.taxguard_privileged_max_age_seconds());
END $$;

-- ------------------------------------------------------------------------------------------
-- Reset job execution (called by the server-side worker; never by a browser)
-- ------------------------------------------------------------------------------------------
-- Claims the next runnable job (pending and due, or leased with an expired lease) and fences it.
CREATE OR REPLACE FUNCTION public.taxguard_mfa_job_claim(p_tenant text, p_worker text, p_lease_seconds integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_mfa_reset_jobs; stamp timestamptz := clock_timestamp();
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_worker IS NULL OR p_worker !~ '^[A-Za-z0-9_.:-]{3,128}$' OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 10 AND 600 THEN
    RAISE EXCEPTION 'MFA_JOB_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO j FROM public.taxguard_mfa_reset_jobs WHERE tenant_id = p_tenant
    AND ((status = 'pending' AND next_attempt_at <= stamp) OR (status = 'leased' AND lease_expires_at <= stamp))
    ORDER BY next_attempt_at, job_id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- The target must still be suspended and gated by this recovery; otherwise the job cannot run.
  PERFORM 1 FROM public.taxguard_members m JOIN public.taxguard_mfa_recovery_requests r ON r.tenant_id = m.tenant_id AND r.target_uid = m.uid AND r.request_id = j.request_id
    WHERE m.tenant_id = p_tenant AND m.uid = j.target_uid AND m.status = 'suspended' AND m.mfa_reenrollment_required AND r.status = 'approved';
  IF NOT FOUND THEN
    UPDATE public.taxguard_mfa_reset_jobs SET status = 'failed', lease_owner = NULL, lease_expires_at = NULL, last_error_code = 'TARGET_STATE_CHANGED' WHERE job_id = j.job_id;
    INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata) VALUES (p_tenant, 'STAFF_MFA_RESET_JOB_FAILED', p_worker, 'system',
      jsonb_build_object('jobId', j.job_id, 'uid', j.target_uid, 'errorCode', 'TARGET_STATE_CHANGED'));
    RETURN NULL;
  END IF;
  UPDATE public.taxguard_mfa_reset_jobs SET status = 'leased', fence = fence + 1, attempts = attempts + 1, lease_owner = p_worker,
      lease_expires_at = stamp + make_interval(secs => p_lease_seconds) WHERE job_id = j.job_id RETURNING * INTO j;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata) VALUES (p_tenant, 'STAFF_MFA_RESET_JOB_CLAIMED', p_worker, 'system',
    jsonb_build_object('jobId', j.job_id, 'uid', j.target_uid, 'attempt', j.attempts, 'fence', j.fence));
  RETURN jsonb_build_object('jobId', j.job_id, 'targetUid', j.target_uid, 'fence', j.fence, 'attempt', j.attempts, 'leaseExpiresAt', j.lease_expires_at);
END $$;

-- Reports the outcome of a claimed attempt. Only the current fence holder with a live lease may
-- report; a stale worker's report is refused and changes nothing.
CREATE OR REPLACE FUNCTION public.taxguard_mfa_job_report(p_tenant text, p_job text, p_worker text, p_fence bigint, p_outcome jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_mfa_reset_jobs; stamp timestamptz := clock_timestamp(); kind text := p_outcome->>'kind'; code text := p_outcome->>'errorCode';
  hashes text[]; max_attempts integer := 5;
BEGIN
  SELECT * INTO j FROM public.taxguard_mfa_reset_jobs WHERE tenant_id = p_tenant AND job_id = p_job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_JOB_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF j.status <> 'leased' OR j.lease_owner IS DISTINCT FROM p_worker OR j.fence IS DISTINCT FROM p_fence OR j.lease_expires_at <= stamp THEN
    RAISE EXCEPTION 'MFA_JOB_FENCE_LOST' USING ERRCODE = 'P0001';
  END IF;
  IF kind = 'reset_verified' THEN
    BEGIN hashes := ARRAY(SELECT jsonb_array_elements_text(p_outcome->'removedFactorHashes')); EXCEPTION WHEN others THEN RAISE EXCEPTION 'MFA_JOB_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
    IF EXISTS (SELECT 1 FROM unnest(hashes) h WHERE h !~ '^[a-f0-9]{64}$') OR (p_outcome->>'remainingFactors') IS DISTINCT FROM '0' THEN
      RAISE EXCEPTION 'MFA_JOB_INPUT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.taxguard_mfa_reset_jobs SET status = 'reset_verified', lease_owner = NULL, lease_expires_at = NULL, last_error_code = NULL, reset_at = stamp,
      removed_factor_hashes = hashes WHERE job_id = p_job RETURNING * INTO j;
    INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata) VALUES (p_tenant, 'STAFF_MFA_FACTORS_RESET', p_worker, 'system',
      jsonb_build_object('jobId', p_job, 'uid', j.target_uid, 'removedFactors', cardinality(hashes), 'attempt', j.attempts));
  ELSIF kind = 'failed' THEN
    IF code IS NULL OR code !~ '^[A-Z_]{3,64}$' THEN RAISE EXCEPTION 'MFA_JOB_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF COALESCE((p_outcome->>'retryable')::boolean, false) AND j.attempts < max_attempts THEN
      UPDATE public.taxguard_mfa_reset_jobs SET status = 'pending', lease_owner = NULL, lease_expires_at = NULL, last_error_code = code,
        next_attempt_at = stamp + make_interval(secs => least(3600, 30 * (2 ^ (j.attempts - 1))::integer)) WHERE job_id = p_job RETURNING * INTO j;
    ELSE
      UPDATE public.taxguard_mfa_reset_jobs SET status = 'failed', lease_owner = NULL, lease_expires_at = NULL, last_error_code = code WHERE job_id = p_job RETURNING * INTO j;
    END IF;
    INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata) VALUES (p_tenant,
      CASE WHEN j.status = 'failed' THEN 'STAFF_MFA_RESET_JOB_FAILED' ELSE 'STAFF_MFA_RESET_JOB_RETRY_SCHEDULED' END, p_worker, 'system',
      jsonb_build_object('jobId', p_job, 'uid', j.target_uid, 'errorCode', code, 'attempt', j.attempts, 'nextAttemptAt', CASE WHEN j.status = 'pending' THEN j.next_attempt_at END));
  ELSE RAISE EXCEPTION 'MFA_JOB_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('jobId', p_job, 'status', j.status, 'attempts', j.attempts, 'lastErrorCode', j.last_error_code);
END $$;

-- What the re-enrolment step needs to know about the target's open recovery (no secrets).
CREATE OR REPLACE FUNCTION public.taxguard_mfa_job_for_target(p_tenant text, p_uid text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('jobId', j.job_id, 'status', j.status, 'resetAt', j.reset_at, 'removedFactorHashes', to_jsonb(j.removed_factor_hashes))
  FROM public.taxguard_mfa_reset_jobs j JOIN public.taxguard_mfa_recovery_requests r ON r.tenant_id = j.tenant_id AND r.request_id = j.request_id
  WHERE j.tenant_id = p_tenant AND j.target_uid = p_uid AND r.status = 'approved' AND j.status IN ('pending','leased','reset_verified','enrollment_verified','failed') $$;

-- Records the target's provider-verified re-enrolment. The service verified the provider access
-- token; the database checks freshness against the reset and the new factor against removed ones.
CREATE OR REPLACE FUNCTION public.taxguard_mfa_job_enrollment_proof(p_tenant text, p_uid text, p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_mfa_reset_jobs; now_s bigint := floor(extract(epoch FROM clock_timestamp()))::bigint; primary_auth bigint; factor_created timestamptz; factor_hash text;
BEGIN
  BEGIN
    primary_auth := (p_proof->>'primaryAuthTime')::bigint; factor_created := (p_proof->>'factorCreatedAt')::timestamptz; factor_hash := p_proof->>'factorHash';
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'MFA_ENROLLMENT_PROOF_INVALID' USING ERRCODE = 'P0001'; END;
  SELECT j2.* INTO j FROM public.taxguard_mfa_reset_jobs j2 JOIN public.taxguard_mfa_recovery_requests r ON r.tenant_id = j2.tenant_id AND r.request_id = j2.request_id
    WHERE j2.tenant_id = p_tenant AND j2.target_uid = p_uid AND r.status = 'approved' FOR UPDATE OF j2;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF j.status = 'enrollment_verified' AND j.enrolled_factor_hash = factor_hash THEN
    RETURN jsonb_build_object('jobId', j.job_id, 'status', j.status, 'replayed', true);
  END IF;
  IF j.status <> 'reset_verified' THEN RAISE EXCEPTION 'MFA_RECOVERY_NOT_READY_FOR_ENROLLMENT' USING ERRCODE = 'P0001'; END IF;
  IF p_proof->>'aal' IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'MFA_ENROLLMENT_AAL2_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF primary_auth IS NULL OR primary_auth > now_s + 30 OR primary_auth < now_s - public.taxguard_privileged_max_age_seconds() OR to_timestamp(primary_auth) <= j.reset_at THEN
    RAISE EXCEPTION 'MFA_ENROLLMENT_FRESH_SIGN_IN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF factor_hash IS NULL OR factor_hash !~ '^[a-f0-9]{64}$' OR factor_hash = ANY (j.removed_factor_hashes) OR factor_created IS NULL OR factor_created <= j.reset_at THEN
    RAISE EXCEPTION 'MFA_ENROLLMENT_NEW_FACTOR_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.taxguard_mfa_reset_jobs SET status = 'enrollment_verified', enrolled_factor_hash = factor_hash, enrollment_verified_at = clock_timestamp()
    WHERE job_id = j.job_id RETURNING * INTO j;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata) VALUES (p_tenant, 'STAFF_MFA_REENROLLMENT_VERIFIED', p_uid, 'staff',
    jsonb_build_object('jobId', j.job_id, 'uid', p_uid));
  RETURN jsonb_build_object('jobId', j.job_id, 'status', j.status, 'replayed', false);
END $$;

-- Final reactivation by an administrator other than the target with a recent AAL2 sign-in.
CREATE OR REPLACE FUNCTION public.taxguard_complete_mfa_recovery(p_tenant text, p_actor text, p_request_id text, p_actor_session_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE priv jsonb; r public.taxguard_mfa_recovery_requests; j public.taxguard_mfa_reset_jobs; m public.taxguard_members; stamp timestamptz; revoked_count integer;
BEGIN
  IF p_request_id IS NULL OR p_request_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'MFA_RECOVERY_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO r FROM public.taxguard_mfa_recovery_requests WHERE tenant_id = p_tenant AND request_id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_actor = r.target_uid THEN RAISE EXCEPTION 'INDEPENDENT_APPROVER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO m FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = r.target_uid FOR UPDATE NOWAIT;
  priv := public.taxguard_privileged_session(p_tenant, p_actor, p_actor_session_hash, ARRAY['admin','administrator','super_admin','super_administrator']);
  SELECT * INTO r FROM public.taxguard_mfa_recovery_requests WHERE tenant_id = p_tenant AND request_id = p_request_id FOR UPDATE;
  SELECT * INTO j FROM public.taxguard_mfa_reset_jobs WHERE tenant_id = p_tenant AND request_id = p_request_id FOR UPDATE;
  IF r.status = 'completed' AND r.completed_by = p_actor THEN
    RETURN jsonb_build_object('requestId', p_request_id, 'targetUid', r.target_uid, 'status', 'completed', 'resumed', true);
  END IF;
  IF r.status <> 'approved' OR j.status <> 'enrollment_verified' OR m.status <> 'suspended' OR NOT m.mfa_reenrollment_required THEN
    RAISE EXCEPTION 'MFA_RECOVERY_NOT_READY_FOR_COMPLETION' USING ERRCODE = 'P0001';
  END IF;
  stamp := clock_timestamp();
  UPDATE public.taxguard_members SET status = 'active', mfa_reenrollment_required = false, status_changed_by = p_actor, status_changed_at = stamp,
    status_reason = 'MFA recovery completed', updated_at = stamp WHERE tenant_id = p_tenant AND uid = r.target_uid;
  UPDATE public.taxguard_identities SET user_data = jsonb_set(jsonb_set(user_data, '{status}', '"active"'::jsonb), '{mfaEnabled}', 'true'::jsonb), updated_at = stamp
    WHERE tenant_id = p_tenant AND uid = r.target_uid;
  -- No session survives recovery; the member signs in again with the new factor.
  UPDATE public.taxguard_sessions SET revoked = true WHERE tenant_id = p_tenant AND uid = r.target_uid AND revoked = false;
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  UPDATE public.taxguard_mfa_reset_jobs SET status = 'completed', completed_at = stamp WHERE job_id = j.job_id;
  UPDATE public.taxguard_mfa_recovery_requests SET status = 'completed', completed_at = stamp, completed_by = p_actor WHERE request_id = p_request_id;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata) VALUES (p_tenant, 'STAFF_MFA_RECOVERY_COMPLETED', p_actor, priv->>'role',
    jsonb_build_object('requestId', p_request_id, 'jobId', j.job_id, 'uid', r.target_uid, 'status', 'active', 'revokedSessions', revoked_count, 'actorAuthAgeSeconds', priv->'ageSeconds'));
  RETURN jsonb_build_object('requestId', p_request_id, 'targetUid', r.target_uid, 'status', 'completed', 'resumed', false);
END $$;

-- Cancels a request that is still awaiting approval.
CREATE OR REPLACE FUNCTION public.taxguard_cancel_mfa_recovery(p_tenant text, p_actor text, p_request_id text, p_actor_session_hash text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE priv jsonb; r public.taxguard_mfa_recovery_requests;
BEGIN
  IF p_request_id IS NULL OR p_request_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR p_reason IS NULL
     OR length(btrim(p_reason)) NOT BETWEEN 10 AND 1000 OR p_reason ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'MFA_RECOVERY_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  priv := public.taxguard_privileged_session(p_tenant, p_actor, p_actor_session_hash, ARRAY['admin','administrator','super_admin','super_administrator']);
  SELECT * INTO r FROM public.taxguard_mfa_recovery_requests WHERE tenant_id = p_tenant AND request_id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_actor = r.target_uid THEN RAISE EXCEPTION 'INDEPENDENT_ACTOR_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF r.status <> 'pending_approval' THEN RAISE EXCEPTION 'MFA_RECOVERY_STATE_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_mfa_recovery_requests SET status = 'cancelled', cancelled_at = clock_timestamp(), cancelled_by = p_actor, cancel_reason = btrim(p_reason)
    WHERE request_id = p_request_id;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata) VALUES (p_tenant, 'STAFF_MFA_RECOVERY_CANCELLED', p_actor, priv->>'role',
    jsonb_build_object('requestId', p_request_id, 'uid', r.target_uid));
  RETURN jsonb_build_object('requestId', p_request_id, 'targetUid', r.target_uid, 'status', 'cancelled');
END $$;

-- A failed reset never reactivates anyone; an administrator with a recent sign-in may re-queue it.
CREATE OR REPLACE FUNCTION public.taxguard_retry_mfa_reset_job(p_tenant text, p_actor text, p_request_id text, p_actor_session_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE priv jsonb; j public.taxguard_mfa_reset_jobs;
BEGIN
  priv := public.taxguard_privileged_session(p_tenant, p_actor, p_actor_session_hash, ARRAY['admin','administrator','super_admin','super_administrator']);
  SELECT j2.* INTO j FROM public.taxguard_mfa_reset_jobs j2 JOIN public.taxguard_mfa_recovery_requests r ON r.tenant_id = j2.tenant_id AND r.request_id = j2.request_id
    WHERE j2.tenant_id = p_tenant AND j2.request_id = p_request_id AND r.status = 'approved' FOR UPDATE OF j2;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_actor = j.target_uid THEN RAISE EXCEPTION 'INDEPENDENT_ACTOR_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF j.status <> 'failed' THEN RAISE EXCEPTION 'MFA_RECOVERY_STATE_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_mfa_reset_jobs SET status = 'pending', attempts = 0, next_attempt_at = clock_timestamp() WHERE job_id = j.job_id;
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata) VALUES (p_tenant, 'STAFF_MFA_RESET_JOB_REQUEUED', p_actor, priv->>'role',
    jsonb_build_object('jobId', j.job_id, 'uid', j.target_uid, 'previousError', j.last_error_code));
  RETURN jsonb_build_object('jobId', j.job_id, 'status', 'pending');
END $$;
-- ------------------------------------------------------------------------------------------
-- Superseding definitions of proposal 010/011 functions (generated from those files with anchored
-- patches; behaviour otherwise identical):
--   * request/approve: the actor's AAL2 sign-in must be recent (taxguard_privileged_max_age_seconds);
--   * request: "already outstanding" counts only open requests, so a member can be recovered again
--     after a completed or cancelled recovery;
--   * approve: refuses completed or cancelled requests instead of re-approving them;
--   * list: accepts and reports the new statuses and job progress.
-- ------------------------------------------------------------------------------------------
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
  IF actor_auth<floor(extract(epoch FROM clock_timestamp()))::bigint-public.taxguard_privileged_max_age_seconds() THEN
    RAISE EXCEPTION 'STAFF_RECENT_SIGN_IN_REQUIRED' USING ERRCODE='P0001';
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
  IF EXISTS(SELECT 1 FROM public.taxguard_mfa_recovery_requests WHERE tenant_id=p_tenant AND target_uid=p_uid AND status IN ('pending_approval','approved')) THEN
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
  IF actor_auth<floor(extract(epoch FROM clock_timestamp()))::bigint-public.taxguard_privileged_max_age_seconds() THEN
    RAISE EXCEPTION 'STAFF_RECENT_SIGN_IN_REQUIRED' USING ERRCODE='P0001';
  END IF;
  SELECT user_data INTO i FROM public.taxguard_identities WHERE tenant_id=p_tenant AND uid=r.target_uid FOR UPDATE;
  IF NOT FOUND OR i->>'id' IS DISTINCT FROM r.target_uid OR i->>'tenantId' IS DISTINCT FROM p_tenant OR i->>'role' IS DISTINCT FROM m.role OR i->>'status' IS DISTINCT FROM m.status THEN
    RAISE EXCEPTION 'STAFF_IDENTITY_INCONSISTENT' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO r FROM public.taxguard_mfa_recovery_requests WHERE tenant_id=p_tenant AND request_id=p_request_id AND target_uid=m.uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  IF r.status NOT IN ('pending_approval','approved') THEN RAISE EXCEPTION 'MFA_RECOVERY_STATE_CONFLICT' USING ERRCODE='P0001'; END IF;
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

CREATE OR REPLACE FUNCTION public.taxguard_list_mfa_recoveries(
 p_tenant text,p_actor text,p_actor_session_hash text,p_status text,p_page_size integer,p_after_created timestamptz,p_after_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor_role text; actor_epoch timestamptz; actor_auth bigint; actor_i jsonb; result jsonb;
BEGIN
 IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$'
  OR p_actor_session_hash IS NULL OR p_actor_session_hash !~ '^[a-f0-9]{64}$'
  OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 51
  OR (p_status IS NOT NULL AND p_status NOT IN ('pending_approval','approved','completed','cancelled'))
  OR ((p_after_created IS NULL) <> (p_after_id IS NULL)) OR (p_after_created IS NOT NULL AND NOT isfinite(p_after_created))
  OR (p_after_id IS NOT NULL AND p_after_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') THEN
  RAISE EXCEPTION 'STAFF_RECOVERY_INPUT_INVALID' USING ERRCODE='P0001';
 END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id=p_tenant AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MFA_RECOVERY_DENIED' USING ERRCODE='P0001'; END IF;
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

 SELECT COALESCE(jsonb_agg(page.row_data ORDER BY page.created_at DESC,page.row_id COLLATE "C" DESC),'[]'::jsonb) INTO result FROM (
 SELECT r.created_at,r.request_id AS row_id,jsonb_build_object(
  'requestId',r.request_id,'targetUid',r.target_uid,'targetName',i.user_data->>'name','targetRole',m.role,
  'makerUid',r.maker_uid,'checkerUid',r.checker_uid,'reasonCategory',r.reason_category,'reason',r.reason,
  'status',r.status,'createdAt',r.created_at,'approvedAt',r.approved_at,'jobId',j.job_id,'jobStatus',j.status,
  'completedAt',r.completed_at,'completedBy',r.completed_by,'cancelledAt',r.cancelled_at,'jobAttempts',j.attempts,'jobLastError',j.last_error_code,
  'completeEligible',COALESCE(j.status='enrollment_verified' AND p_actor<>r.target_uid,false),'cancelEligible',COALESCE(r.status='pending_approval' AND p_actor<>r.target_uid,false),
  'approveEligible',COALESCE(r.status='pending_approval' AND p_actor<>r.maker_uid AND p_actor<>r.target_uid
   AND m.role IN ('accountant','reviewer','senior_reviewer','bookkeeper','practice_manager','operations','admin','administrator','consultant','managing_consultant','founder','legal_specialist','firm_manager','recruiter')
   AND m.status IN ('active','suspended') AND NOT m.mfa_reenrollment_required
   AND i.user_data->>'id'=m.uid AND i.user_data->>'tenantId'=m.tenant_id AND i.user_data->>'role'=m.role AND i.user_data->>'status'=m.status
   AND maker.status='active' AND NOT maker.mfa_reenrollment_required AND maker.role IN ('admin','administrator','super_admin','super_administrator'),false)
 ) AS row_data
 FROM public.taxguard_mfa_recovery_requests r
 LEFT JOIN public.taxguard_members m ON m.tenant_id=r.tenant_id AND m.uid=r.target_uid
 LEFT JOIN public.taxguard_identities i ON i.tenant_id=r.tenant_id AND i.uid=r.target_uid
 LEFT JOIN public.taxguard_members maker ON maker.tenant_id=r.tenant_id AND maker.uid=r.maker_uid
 LEFT JOIN public.taxguard_mfa_reset_jobs j ON j.tenant_id=r.tenant_id AND j.request_id=r.request_id AND j.target_uid=r.target_uid
 WHERE r.tenant_id=p_tenant AND (p_status IS NULL OR r.status=p_status)
  AND (p_after_created IS NULL OR (r.created_at,r.request_id COLLATE "C") < (p_after_created,p_after_id COLLATE "C"))
 ORDER BY r.created_at DESC,r.request_id COLLATE "C" DESC LIMIT p_page_size
 ) page;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.taxguard_privileged_session(text,text,text,text[]), public.taxguard_mfa_job_claim(text,text,integer),
  public.taxguard_mfa_job_report(text,text,text,bigint,jsonb), public.taxguard_mfa_job_for_target(text,text), public.taxguard_mfa_job_enrollment_proof(text,text,jsonb),
  public.taxguard_complete_mfa_recovery(text,text,text,text), public.taxguard_cancel_mfa_recovery(text,text,text,text,text), public.taxguard_retry_mfa_reset_job(text,text,text,text),
  public.taxguard_request_mfa_recovery(text,text,text,text,text,text,text), public.taxguard_approve_mfa_recovery(text,text,text,text),
  public.taxguard_list_mfa_recoveries(text,text,text,text,integer,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_privileged_session(text,text,text,text[]), public.taxguard_mfa_job_claim(text,text,integer),
  public.taxguard_mfa_job_report(text,text,text,bigint,jsonb), public.taxguard_mfa_job_for_target(text,text), public.taxguard_mfa_job_enrollment_proof(text,text,jsonb),
  public.taxguard_complete_mfa_recovery(text,text,text,text), public.taxguard_cancel_mfa_recovery(text,text,text,text,text), public.taxguard_retry_mfa_reset_job(text,text,text,text),
  public.taxguard_request_mfa_recovery(text,text,text,text,text,text,text), public.taxguard_approve_mfa_recovery(text,text,text,text),
  public.taxguard_list_mfa_recoveries(text,text,text,text,integer,timestamptz,text) TO service_role;
