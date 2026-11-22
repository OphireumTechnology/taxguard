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

-- Assigned staff can inspect the summary. Decision authority is a separate grant.
CREATE OR REPLACE FUNCTION public.taxguard_job_read_a10(p_tenant text, p_actor text, p_job text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor_role text; summary jsonb;
BEGIN
  actor_role := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT jsonb_build_object('agentId', a.agent_id, 'duplicateGroupCount', a.duplicate_group_count,
                            'humanReviewRequired', a.human_review_required)
    INTO summary FROM public.taxguard_ai_job_advisories a
    JOIN public.taxguard_durable_jobs j ON j.tenant_id=a.tenant_id AND j.id=a.job_id
    WHERE j.tenant_id=p_tenant AND j.id=p_job AND j.status='COMPLETED' AND a.agent_id='A10'
      AND public.taxguard_job_visible(p_tenant,p_actor,actor_role,j.client_id,j.case_id)
      AND EXISTS (SELECT 1 FROM public.taxguard_case_assignments ca WHERE ca.tenant_id=j.tenant_id
                  AND ca.case_id=j.case_id AND ca.uid=p_actor AND ca.active);
  IF summary IS NULL THEN RAISE EXCEPTION 'JOB_ADVISORY_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  RETURN summary;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_job_read_a10(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_read_a10(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.taxguard_case_a10_summaries(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; result jsonb;
BEGIN
  r := public.taxguard_practice_actor(p_tenant,p_actor);
  IF NOT EXISTS (SELECT 1 FROM public.taxguard_cases c JOIN public.taxguard_case_assignments ca
    ON ca.tenant_id=c.tenant_id AND ca.case_id=c.case_id
    WHERE c.tenant_id=p_tenant AND c.case_id=p_case AND ca.uid=p_actor AND ca.active
      AND public.taxguard_job_visible(p_tenant,p_actor,r,c.client_id,c.case_id))
  THEN RAISE EXCEPTION 'JOB_ADVISORY_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  SELECT coalesce(jsonb_agg(public.taxguard_job_read_a10(p_tenant,p_actor,q.id)
    || jsonb_build_object('jobId',q.id,'createdAt',q.created_at) ORDER BY q.created_at DESC,q.id),'[]'::jsonb)
    INTO result FROM (SELECT j.id,j.created_at FROM public.taxguard_durable_jobs j
      JOIN public.taxguard_ai_job_advisories a ON a.tenant_id=j.tenant_id AND a.job_id=j.id
      WHERE j.tenant_id=p_tenant AND j.case_id=p_case AND j.status='COMPLETED' AND a.agent_id='A10'
      ORDER BY j.created_at DESC,j.id LIMIT 20) q;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_case_a10_summaries(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_case_a10_summaries(text,text,text) TO service_role;
