-- Review draft for disposable PostgreSQL. Requires durable queue proposal 20261019240000.
-- No migration manifest or hosted runtime consumes this draft.
CREATE OR REPLACE FUNCTION public.taxguard_job_claim_partition(p_tenant text, p_worker text, p_lease_seconds integer, p_ai boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_durable_jobs;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_worker IS NULL OR p_worker !~ '^[A-Za-z0-9_.:-]{1,128}$'
     OR p_lease_seconds IS NULL OR p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'JOB_INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;
  LOOP
    SELECT * INTO j FROM public.taxguard_durable_jobs
      WHERE tenant_id = p_tenant AND (job_type = 'AI_PROPOSAL') = p_ai AND ((status IN ('PENDING','RETRY_SCHEDULED') AND available_at <= now())
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

REVOKE ALL ON FUNCTION public.taxguard_job_claim_partition(text,text,integer,boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_job_claim(p_tenant text, p_worker text, p_lease_seconds integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.taxguard_job_claim_partition(p_tenant, p_worker, p_lease_seconds, false)
$$;

CREATE FUNCTION public.taxguard_job_claim_ai(p_tenant text, p_worker text, p_lease_seconds integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.taxguard_job_claim_partition(p_tenant, p_worker, p_lease_seconds, true)
$$;
REVOKE ALL ON FUNCTION public.taxguard_job_claim_ai(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_claim_ai(text,text,integer) TO service_role;

CREATE TABLE public.taxguard_ai_job_advisories (
  job_id varchar(128) PRIMARY KEY REFERENCES public.taxguard_durable_jobs(id),
  tenant_id varchar(128) NOT NULL,
  agent_id text NOT NULL CHECK (agent_id = 'A10'),
  duplicate_group_count integer NOT NULL CHECK (duplicate_group_count BETWEEN 0 AND 5),
  human_review_required boolean NOT NULL DEFAULT true CHECK (human_review_required),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.taxguard_ai_job_advisories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_ai_job_advisories FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.taxguard_job_complete_partition(p_tenant text, p_job text, p_worker text, p_lease_token uuid, p_ai boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_durable_jobs;
BEGIN
  j := public.taxguard_job_held(p_tenant, p_job, p_worker, p_lease_token);
  IF (j.job_type = 'AI_PROPOSAL') IS DISTINCT FROM p_ai THEN
    RAISE EXCEPTION 'JOB_COMPLETION_PATH_INVALID' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.taxguard_durable_jobs SET status = 'COMPLETED', completed_at = now(), locked_at = NULL, locked_by = NULL, lease_token = NULL,
      lease_expires_at = NULL, updated_at = now()
    WHERE tenant_id = p_tenant AND id = p_job RETURNING * INTO j;
  PERFORM public.taxguard_job_event(j, 'COMPLETED', NULL, p_worker, '{}'::jsonb);
  RETURN public.taxguard_job_json(j);
END $$;

REVOKE ALL ON FUNCTION public.taxguard_job_complete_partition(text,text,text,uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_job_complete(p_tenant text, p_job text, p_worker text, p_lease_token uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.taxguard_job_complete_partition(p_tenant, p_job, p_worker, p_lease_token, false)
$$;

CREATE FUNCTION public.taxguard_job_complete_ai(
  p_tenant text, p_job text, p_worker text, p_lease_token uuid, p_duplicate_group_count integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_durable_jobs;
BEGIN
  j := public.taxguard_job_held(p_tenant, p_job, p_worker, p_lease_token);
  IF j.job_type <> 'AI_PROPOSAL' OR j.client_id IS NULL OR j.case_id IS NULL
    OR j.payload->>'agentId' IS DISTINCT FROM 'A10' THEN
    RAISE EXCEPTION 'JOB_AI_SCOPE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.taxguard_ai_job_advisories (job_id, tenant_id, agent_id, duplicate_group_count)
    VALUES (j.id, j.tenant_id, 'A10', p_duplicate_group_count);
  RETURN public.taxguard_job_complete_partition(p_tenant, p_job, p_worker, p_lease_token, true);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_job_complete_ai(text,text,text,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_complete_ai(text,text,text,uuid,integer) TO service_role;
