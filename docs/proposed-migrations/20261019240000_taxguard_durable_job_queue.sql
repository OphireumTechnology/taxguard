-- PROPOSAL (Block 82, durable background job queue). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261001000000 (taxguard_durable_jobs), 20261012250000 (taxguard_practice_actor, taxguard_practice_is_manager)
-- and 20261018100000 (taxguard_practice_item_scope).
--
-- The background job queue behind /api/operations/jobs is an in-memory map (DurableJobQueueService), refused in
-- production (Block 81 inventory: operations-without-durable-adapter). Migration 20261001000000 created the table
-- taxguard_durable_jobs but nothing reads or writes it. This proposal adds the queue's rules to the database:
--   * Staff operations (take p_actor). Only active staff members; clients and recruiters are refused.
--       enqueue  a job for a client (and optionally one of the client's cases) needs the actor's scope over that case,
--                or over the whole client when no case is given (taxguard_practice_item_scope, owner decision
--                2026-10-19). A job with no client is tenant-wide: administrators only.
--       list     the jobs the actor may see, by the same scope; tenant-wide jobs to administrators only.
--       retry    a DEAD_LETTER or FAILED job back to PENDING with three more attempts: administrators only, and in scope.
--       cancel   any job not COMPLETED: administrators and accountants in scope; tenant-wide jobs administrators only.
--     A job out of scope is reported as JOB_NOT_FOUND, like a missing one.
--   * Worker operations (no actor; for a server worker process, none of which is commissioned).
--       claim    the next due job of the tenant with FOR UPDATE SKIP LOCKED, so concurrent workers never claim the same
--                job. Each claim issues a new lease token and expiry. A job whose lease expired is claimed again, unless
--                it has used all its attempts, in which case it moves to DEAD_LETTER (LEASE_EXPIRED) instead.
--       complete and fail need the same worker, the current lease token and an unexpired lease (fencing), so a worker
--                whose lease was taken over cannot overwrite the new claimant's result.
--       fail     moves to DEAD_LETTER when the error is permanent (VALIDATION_*, AUTH_*, INVALID_PAYLOAD or flagged) or
--                the attempts are used up; otherwise RETRY_SCHEDULED after min(3600, 2^(attempt-1) * 30) seconds.
--   * Idempotency: one job per tenant and key. A replay with the same job type, client, case and payload returns the
--     existing job whatever its status; a different request with the same key is JOB_IDEMPOTENCY_CONFLICT. (The
--     in-memory service created a new job when the earlier one was CANCELLED or FAILED; here it does not.)
--   * Every change appends a row to taxguard_durable_job_events, which refuses UPDATE and DELETE.
-- Payloads are limited to 64 KiB. Nothing here runs a job: no worker, provider or AI agent is commissioned.
-- If the hosted table already holds two rows with the same tenant and idempotency key, the unique index fails and the
-- proposal must not be applied until they are reconciled.
-- Rollback (development): drop the functions, the events table and trigger, the index and the added columns.

ALTER TABLE public.taxguard_durable_jobs
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_durable_jobs_idempotency
  ON public.taxguard_durable_jobs (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.taxguard_durable_job_events (
  event_id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  job_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('ENQUEUED','CLAIMED','COMPLETED','RETRY_SCHEDULED','DEAD_LETTERED','LEASE_EXPIRED','RETRIED','CANCELLED')),
  actor text,
  worker text,
  status_after text NOT NULL,
  attempt integer NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_taxguard_durable_job_events_job ON public.taxguard_durable_job_events (tenant_id, job_id, event_id);
ALTER TABLE public.taxguard_durable_job_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_durable_job_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_job_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'JOB_EVENTS_APPEND_ONLY' USING ERRCODE = 'P0001';
END $$;
DROP TRIGGER IF EXISTS taxguard_job_events_append_only ON public.taxguard_durable_job_events;
CREATE TRIGGER taxguard_job_events_append_only BEFORE UPDATE OR DELETE ON public.taxguard_durable_job_events
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_job_events_append_only();
REVOKE ALL ON FUNCTION public.taxguard_job_events_append_only() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_job_is_admin(p_role text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_role IN ('admin','administrator','super_admin','super_administrator'), false) $$;
REVOKE ALL ON FUNCTION public.taxguard_job_is_admin(text) FROM PUBLIC, anon, authenticated, service_role;

-- Whether the actor (role r) may see a job: a client job by the actor's scope over its case or client; a tenant-wide
-- job by administrators only.
CREATE OR REPLACE FUNCTION public.taxguard_job_visible(p_tenant text, p_actor text, p_role text, p_client text, p_case text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE WHEN p_client IS NULL THEN public.taxguard_job_is_admin(p_role)
    ELSE COALESCE(public.taxguard_practice_item_scope(p_tenant, p_client, p_actor, p_role, p_case, NULL, NULL), false) END $$;
REVOKE ALL ON FUNCTION public.taxguard_job_visible(text,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_job_json(j public.taxguard_durable_jobs) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('id', j.id, 'tenantId', j.tenant_id, 'clientId', j.client_id, 'caseId', j.case_id, 'jobType', j.job_type,
    'payload', j.payload, 'status', j.status, 'priority', j.priority, 'attemptCount', j.attempt_count, 'maxAttempts', j.max_attempts,
    'availableAt', j.available_at, 'lockedAt', j.locked_at, 'lockedBy', j.locked_by, 'leaseExpiresAt', j.lease_expires_at,
    'startedAt', j.started_at, 'completedAt', j.completed_at, 'failedAt', j.failed_at, 'lastErrorCode', j.last_error_code,
    'lastErrorMessage', j.last_error_message, 'retryHistory', j.retry_history, 'idempotencyKey', j.idempotency_key,
    'createdBy', j.created_by, 'cancelledBy', j.cancelled_by, 'cancelledAt', j.cancelled_at, 'createdAt', j.created_at, 'updatedAt', j.updated_at) $$;
REVOKE ALL ON FUNCTION public.taxguard_job_json(public.taxguard_durable_jobs) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_job_event(j public.taxguard_durable_jobs, p_action text, p_actor text, p_worker text, p_detail jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_durable_job_events(tenant_id, job_id, action, actor, worker, status_after, attempt, detail)
  VALUES (j.tenant_id, j.id, p_action, p_actor, p_worker, j.status, j.attempt_count, COALESCE(p_detail, '{}'::jsonb)) $$;
REVOKE ALL ON FUNCTION public.taxguard_job_event(public.taxguard_durable_jobs,text,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_job_enqueue(p_tenant text, p_actor text, p_job_type text, p_payload jsonb, p_client text, p_case text,
  p_priority integer, p_max_attempts integer, p_available_at timestamptz, p_idempotency_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; j public.taxguard_durable_jobs;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_job_type IS NULL OR p_job_type NOT IN ('DOCUMENT_PROCESSING','OCR_REQUEST','AI_PROPOSAL','NOTIFICATION_DISPATCH','PROVIDER_SYNCHRONIZATION',
       'ACCOUNTING_IMPORT','REPORT_GENERATION','ARCHIVE_GENERATION','SCHEDULED_COMPLIANCE_CHECK','RENEWAL_GENERATION','RETRYABLE_PROVIDER_OPERATION')
     OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR octet_length(p_payload::text) > 65536
     OR (p_client IS NOT NULL AND p_client !~ '^[A-Za-z0-9_-]{1,64}$') OR (p_case IS NOT NULL AND (p_client IS NULL OR p_case !~ '^[A-Za-z0-9_.:-]{1,128}$'))
     OR (p_priority IS NOT NULL AND (p_priority < 1 OR p_priority > 10)) OR (p_max_attempts IS NOT NULL AND (p_max_attempts < 1 OR p_max_attempts > 100))
     OR (p_idempotency_key IS NOT NULL AND p_idempotency_key !~ '^[A-Za-z0-9_.:-]{8,128}$') THEN
    RAISE EXCEPTION 'JOB_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_client IS NULL THEN
    IF NOT public.taxguard_job_is_admin(r) THEN RAISE EXCEPTION 'JOB_SCOPE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  ELSIF NOT public.taxguard_job_visible(p_tenant, p_actor, r, p_client, p_case)
     OR (p_case IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_cases c WHERE c.tenant_id = p_tenant AND c.client_id = p_client AND c.case_id = p_case)) THEN
    RAISE EXCEPTION 'JOB_CLIENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('taxguard_job|' || p_tenant || '|' || p_idempotency_key, 0));
    SELECT * INTO j FROM public.taxguard_durable_jobs WHERE tenant_id = p_tenant AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF j.job_type IS DISTINCT FROM p_job_type OR j.client_id IS DISTINCT FROM p_client OR j.case_id IS DISTINCT FROM p_case OR j.payload IS DISTINCT FROM p_payload THEN
        RAISE EXCEPTION 'JOB_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
      END IF;
      RETURN public.taxguard_job_json(j) || jsonb_build_object('replayed', true);
    END IF;
  END IF;
  INSERT INTO public.taxguard_durable_jobs(id, tenant_id, client_id, case_id, job_type, payload, status, priority, max_attempts, available_at,
      idempotency_key, created_by)
    VALUES ('job_' || replace(gen_random_uuid()::text, '-', ''), p_tenant, p_client, p_case, p_job_type, p_payload, 'PENDING', COALESCE(p_priority, 5),
      COALESCE(p_max_attempts, 5), COALESCE(p_available_at, now()), p_idempotency_key, p_actor)
    RETURNING * INTO j;
  PERFORM public.taxguard_job_event(j, 'ENQUEUED', p_actor, NULL, '{}'::jsonb);
  RETURN public.taxguard_job_json(j) || jsonb_build_object('replayed', false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_job_list(p_tenant text, p_actor text, p_client text, p_status text, p_job_type text, p_limit integer, p_offset integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 OR p_offset > 10000
     OR (p_status IS NOT NULL AND p_status NOT IN ('PENDING','CLAIMED','RUNNING','RETRY_SCHEDULED','COMPLETED','FAILED','DEAD_LETTER','CANCELLED'))
     OR (p_client IS NOT NULL AND p_client !~ '^[A-Za-z0-9_-]{1,64}$') OR (p_job_type IS NOT NULL AND p_job_type !~ '^[A-Z_]{3,64}$') THEN
    RAISE EXCEPTION 'JOB_QUERY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_client IS NULL AND NOT public.taxguard_job_is_admin(r) THEN RAISE EXCEPTION 'JOB_SCOPE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  RETURN (WITH visible AS (
      SELECT j FROM public.taxguard_durable_jobs j
      WHERE j.tenant_id = p_tenant AND (p_client IS NULL OR j.client_id = p_client)
        AND (p_status IS NULL OR j.status = p_status) AND (p_job_type IS NULL OR j.job_type = p_job_type)
        AND public.taxguard_job_visible(p_tenant, p_actor, r, j.client_id, j.case_id))
    SELECT jsonb_build_object('total', (SELECT count(*) FROM visible),
      'jobs', COALESCE((SELECT jsonb_agg(public.taxguard_job_json(p.j) ORDER BY (p.j).created_at DESC, (p.j).id)
        FROM (SELECT v.j FROM visible v ORDER BY (v.j).created_at DESC, (v.j).id LIMIT p_limit OFFSET p_offset) p), '[]'::jsonb)));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_job_retry(p_tenant text, p_actor text, p_job text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; j public.taxguard_durable_jobs;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO j FROM public.taxguard_durable_jobs WHERE tenant_id = p_tenant AND id = p_job FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_job_visible(p_tenant, p_actor, r, j.client_id, j.case_id) THEN
    RAISE EXCEPTION 'JOB_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.taxguard_job_is_admin(r) THEN RAISE EXCEPTION 'JOB_ADMIN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF j.status NOT IN ('DEAD_LETTER','FAILED') THEN RAISE EXCEPTION 'JOB_STATE_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_durable_jobs SET status = 'PENDING', available_at = now(), max_attempts = max_attempts + 3, locked_at = NULL, locked_by = NULL,
      lease_token = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE tenant_id = p_tenant AND id = p_job RETURNING * INTO j;
  PERFORM public.taxguard_job_event(j, 'RETRIED', p_actor, NULL, '{}'::jsonb);
  RETURN public.taxguard_job_json(j);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_job_cancel(p_tenant text, p_actor text, p_job text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; j public.taxguard_durable_jobs;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO j FROM public.taxguard_durable_jobs WHERE tenant_id = p_tenant AND id = p_job FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_job_visible(p_tenant, p_actor, r, j.client_id, j.case_id) THEN
    RAISE EXCEPTION 'JOB_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.taxguard_job_is_admin(r) OR r = 'accountant') THEN RAISE EXCEPTION 'JOB_CANCEL_NOT_AUTHORIZED' USING ERRCODE = 'P0001'; END IF;
  IF j.status = 'COMPLETED' THEN RAISE EXCEPTION 'JOB_STATE_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF j.status = 'CANCELLED' THEN RETURN public.taxguard_job_json(j); END IF;
  UPDATE public.taxguard_durable_jobs SET status = 'CANCELLED', locked_at = NULL, locked_by = NULL, lease_token = NULL, lease_expires_at = NULL,
      cancelled_by = p_actor, cancelled_at = now(), updated_at = now()
    WHERE tenant_id = p_tenant AND id = p_job RETURNING * INTO j;
  PERFORM public.taxguard_job_event(j, 'CANCELLED', p_actor, NULL, '{}'::jsonb);
  RETURN public.taxguard_job_json(j);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_job_claim(p_tenant text, p_worker text, p_lease_seconds integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_durable_jobs;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_worker IS NULL OR p_worker !~ '^[A-Za-z0-9_.:-]{1,128}$'
     OR p_lease_seconds IS NULL OR p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'JOB_INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;
  LOOP
    SELECT * INTO j FROM public.taxguard_durable_jobs
      WHERE tenant_id = p_tenant AND ((status IN ('PENDING','RETRY_SCHEDULED') AND available_at <= now())
        OR (status IN ('CLAIMED','RUNNING') AND lease_expires_at <= now()))
      ORDER BY priority, available_at, created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN NULL; END IF;
    -- An expired lease with no attempts left is not claimed again: it is dead-lettered and the next job is tried.
    IF j.status IN ('CLAIMED','RUNNING') AND j.attempt_count >= j.max_attempts THEN
      UPDATE public.taxguard_durable_jobs SET status = 'DEAD_LETTER', failed_at = now(), last_error_code = 'LEASE_EXPIRED',
          last_error_message = 'The worker lease expired after the last attempt.', locked_at = NULL, locked_by = NULL, lease_token = NULL,
          lease_expires_at = NULL, retry_history = retry_history || jsonb_build_array(jsonb_build_object('attemptNumber', attempt_count,
            'timestamp', now(), 'errorCode', 'LEASE_EXPIRED', 'errorMessage', 'The worker lease expired after the last attempt.')), updated_at = now()
        WHERE tenant_id = j.tenant_id AND id = j.id RETURNING * INTO j;
      PERFORM public.taxguard_job_event(j, 'LEASE_EXPIRED', NULL, p_worker, '{}'::jsonb);
      CONTINUE;
    END IF;
    UPDATE public.taxguard_durable_jobs SET status = 'CLAIMED', locked_at = now(), locked_by = p_worker, started_at = now(),
        attempt_count = attempt_count + 1, lease_token = gen_random_uuid(), lease_expires_at = now() + make_interval(secs => p_lease_seconds), updated_at = now()
      WHERE tenant_id = j.tenant_id AND id = j.id RETURNING * INTO j;
    PERFORM public.taxguard_job_event(j, 'CLAIMED', NULL, p_worker, '{}'::jsonb);
    RETURN public.taxguard_job_json(j) || jsonb_build_object('leaseToken', j.lease_token);
  END LOOP;
END $$;

-- The worker's claim on a job: same worker, current lease token, lease not expired. Locks the row.
CREATE OR REPLACE FUNCTION public.taxguard_job_held(p_tenant text, p_job text, p_worker text, p_lease_token uuid) RETURNS public.taxguard_durable_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_durable_jobs;
BEGIN
  SELECT * INTO j FROM public.taxguard_durable_jobs WHERE tenant_id = p_tenant AND id = p_job FOR UPDATE;
  IF NOT FOUND OR j.status NOT IN ('CLAIMED','RUNNING') OR j.locked_by IS DISTINCT FROM p_worker OR p_lease_token IS NULL
     OR j.lease_token IS DISTINCT FROM p_lease_token OR j.lease_expires_at IS NULL OR j.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'JOB_WORKER_CLAIM_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_job_held(text,text,text,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_job_complete(p_tenant text, p_job text, p_worker text, p_lease_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_durable_jobs;
BEGIN
  j := public.taxguard_job_held(p_tenant, p_job, p_worker, p_lease_token);
  UPDATE public.taxguard_durable_jobs SET status = 'COMPLETED', completed_at = now(), locked_at = NULL, locked_by = NULL, lease_token = NULL,
      lease_expires_at = NULL, updated_at = now()
    WHERE tenant_id = p_tenant AND id = p_job RETURNING * INTO j;
  PERFORM public.taxguard_job_event(j, 'COMPLETED', NULL, p_worker, '{}'::jsonb);
  RETURN public.taxguard_job_json(j);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_job_fail(p_tenant text, p_job text, p_worker text, p_lease_token uuid, p_error_code text, p_error_message text, p_permanent boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_durable_jobs; permanent boolean; next_at timestamptz; attempt jsonb;
BEGIN
  IF p_error_code IS NULL OR p_error_code !~ '^[A-Z0-9_]{1,64}$' OR p_error_message IS NULL OR length(p_error_message) > 1000 THEN
    RAISE EXCEPTION 'JOB_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  j := public.taxguard_job_held(p_tenant, p_job, p_worker, p_lease_token);
  permanent := COALESCE(p_permanent, false) OR p_error_code LIKE 'VALIDATION\_%' OR p_error_code LIKE 'AUTH\_%' OR p_error_code = 'INVALID_PAYLOAD';
  attempt := jsonb_build_object('attemptNumber', j.attempt_count, 'timestamp', now(), 'errorCode', p_error_code, 'errorMessage', p_error_message);
  IF permanent OR j.attempt_count >= j.max_attempts THEN
    UPDATE public.taxguard_durable_jobs SET status = 'DEAD_LETTER', failed_at = now(), last_error_code = p_error_code, last_error_message = p_error_message,
        locked_at = NULL, locked_by = NULL, lease_token = NULL, lease_expires_at = NULL, retry_history = retry_history || jsonb_build_array(attempt), updated_at = now()
      WHERE tenant_id = p_tenant AND id = p_job RETURNING * INTO j;
    PERFORM public.taxguard_job_event(j, 'DEAD_LETTERED', NULL, p_worker, jsonb_build_object('errorCode', p_error_code, 'permanent', permanent));
  ELSE
    next_at := now() + make_interval(secs => LEAST(3600, power(2, j.attempt_count - 1) * 30));
    UPDATE public.taxguard_durable_jobs SET status = 'RETRY_SCHEDULED', available_at = next_at, last_error_code = p_error_code, last_error_message = p_error_message,
        locked_at = NULL, locked_by = NULL, lease_token = NULL, lease_expires_at = NULL,
        retry_history = retry_history || jsonb_build_array(attempt || jsonb_build_object('nextAvailableAt', next_at)), updated_at = now()
      WHERE tenant_id = p_tenant AND id = p_job RETURNING * INTO j;
    PERFORM public.taxguard_job_event(j, 'RETRY_SCHEDULED', NULL, p_worker, jsonb_build_object('errorCode', p_error_code));
  END IF;
  RETURN public.taxguard_job_json(j);
END $$;

REVOKE ALL ON FUNCTION public.taxguard_job_enqueue(text,text,text,jsonb,text,text,integer,integer,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_enqueue(text,text,text,jsonb,text,text,integer,integer,timestamptz,text) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_job_list(text,text,text,text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_list(text,text,text,text,text,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_job_retry(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_retry(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_job_cancel(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_cancel(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_job_claim(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_claim(text,text,integer) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_job_complete(text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_complete(text,text,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_job_fail(text,text,text,uuid,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_fail(text,text,text,uuid,text,text,boolean) TO service_role;
