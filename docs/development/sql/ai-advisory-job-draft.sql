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
  evidence_snapshot jsonb NOT NULL CHECK (jsonb_typeof(evidence_snapshot)='array' AND jsonb_array_length(evidence_snapshot) BETWEEN 1 AND 10),
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
  p_tenant text, p_job text, p_worker text, p_lease_token uuid, p_duplicate_group_count integer, p_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE j public.taxguard_durable_jobs;
BEGIN
  j := public.taxguard_job_held(p_tenant, p_job, p_worker, p_lease_token);
  IF j.job_type <> 'AI_PROPOSAL' OR j.client_id IS NULL OR j.case_id IS NULL
    OR j.payload->>'agentId' IS DISTINCT FROM 'A10' THEN
    RAISE EXCEPTION 'JOB_AI_SCOPE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF ARRAY(SELECT selected::uuid FROM jsonb_array_elements_text(j.payload->'sourceIds') selected ORDER BY 1)
     IS DISTINCT FROM ARRAY(SELECT (item->>'source_id')::uuid FROM jsonb_array_elements(p_evidence) item ORDER BY 1) THEN
    RAISE EXCEPTION 'JOB_AI_EVIDENCE_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  IF p_duplicate_group_count IS DISTINCT FROM (
    SELECT count(*) FROM (
      SELECT item->>'source_hash' FROM jsonb_array_elements(p_evidence) AS item
      GROUP BY item->>'source_hash'
      HAVING count(DISTINCT (item->>'document_record_id')::uuid) > 1
    ) AS matching_groups
  ) THEN
    RAISE EXCEPTION 'JOB_AI_SUMMARY_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.taxguard_ai_job_advisories (job_id, tenant_id, agent_id, duplicate_group_count, evidence_snapshot)
    VALUES (j.id, j.tenant_id, 'A10', p_duplicate_group_count, p_evidence);
  RETURN public.taxguard_job_complete_partition(p_tenant, p_job, p_worker, p_lease_token, true);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_job_complete_ai(text,text,text,uuid,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_job_complete_ai(text,text,text,uuid,integer,jsonb) TO service_role;

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
    || jsonb_build_object('jobId',q.id,'createdAt',q.created_at,'decision',q.decision) ORDER BY q.created_at DESC,q.id),'[]'::jsonb)
    INTO result FROM (SELECT j.id,j.created_at,r.decision FROM public.taxguard_durable_jobs j
      JOIN public.taxguard_ai_job_advisories a ON a.tenant_id=j.tenant_id AND a.job_id=j.id
      LEFT JOIN public.taxguard_a10_reviews r ON r.job_id=j.id
      WHERE j.tenant_id=p_tenant AND j.case_id=p_case AND j.status='COMPLETED' AND a.agent_id='A10'
      ORDER BY j.created_at DESC,j.id LIMIT 20) q;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_case_a10_summaries(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_case_a10_summaries(text,text,text) TO service_role;

CREATE TABLE public.taxguard_a10_reviews (
  job_id text PRIMARY KEY REFERENCES public.taxguard_ai_job_advisories(job_id),
  reviewer_uid text NOT NULL, evidence_snapshot jsonb NOT NULL,
  decision text NOT NULL CHECK (decision IN ('ACKNOWLEDGED','RETURNED')),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.taxguard_a10_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_a10_reviews FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.taxguard_a10_review(p_tenant text,p_actor text,p_job text,p_decision text,p_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE j public.taxguard_durable_jobs; a public.taxguard_ai_job_advisories; item jsonb; token text;
BEGIN
  PERFORM public.taxguard_job_read_a10(p_tenant,p_actor,p_job);
  SELECT * INTO STRICT j FROM public.taxguard_durable_jobs WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
  PERFORM 1 FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor AND status='active'
    AND role IN ('reviewer','senior_reviewer') FOR SHARE;
  IF NOT FOUND OR j.created_by=p_actor THEN RAISE EXCEPTION 'PRACTICE_ACCESS_DENIED'; END IF;
  PERFORM 1 FROM public.taxguard_cases c JOIN public.taxguard_case_assignments ca ON ca.tenant_id=c.tenant_id AND ca.case_id=c.case_id
    JOIN public.taxguard_staff_assignments sa ON sa.tenant_id=c.tenant_id AND sa.client_id=c.client_id AND sa.engagement_id=c.engagement_id AND sa.tax_year=c.tax_year
    WHERE c.tenant_id=p_tenant AND c.case_id=j.case_id AND c.client_id=j.client_id AND c.active_stage=3 AND c.status IN ('ACTIVE','READY','IN_REVIEW')
      AND c.reviewer_uid=p_actor AND c.preparer_uid IS DISTINCT FROM p_actor AND ca.active AND ca.uid=p_actor AND ca.role='reviewer'
      AND sa.user_id=p_actor AND sa.role='reviewer' AND sa.status='ACTIVE' AND sa.effective_from<=now()
      AND (sa.effective_to IS NULL OR sa.effective_to>now()) FOR SHARE OF c,ca,sa;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRACTICE_ACCESS_DENIED'; END IF;
  SELECT * INTO STRICT a FROM public.taxguard_ai_job_advisories WHERE job_id=p_job AND tenant_id=p_tenant;
  FOR item IN SELECT value FROM jsonb_array_elements(a.evidence_snapshot) LOOP
    PERFORM 1 FROM public.ai_evidence_sources e JOIN public.taxguard_documents d ON d.id=e.document_record_id
      JOIN public.taxguard_cases c ON c.id=e.case_record_id
      WHERE e.source_id=(item->>'source_id')::uuid AND e.tenant_id=p_tenant AND e.client_id=j.client_id AND e.tax_case_id=j.case_id
      AND c.tenant_id=p_tenant AND c.case_id=j.case_id AND e.tax_year=c.tax_year AND d.tax_year=c.tax_year
      AND d.tenant_id=p_tenant AND d.client_id=j.client_id AND d.case_id=j.case_id AND d.engagement_id=c.engagement_id
      AND d.id=(item->>'document_record_id')::uuid AND e.document_version=d.version AND d.version=(item->>'document_version')::integer
      AND e.source_hash=d.hash AND d.hash=item->>'source_hash' AND d.status=item->>'document_status' AND d.status IN ('VERIFIED','RELEASED') AND d.quarantine_status='CLEAN' FOR SHARE OF e,d;
    IF NOT FOUND THEN RAISE EXCEPTION 'JOB_STATE_INVALID'; END IF;
  END LOOP;
  token := encode(sha256(convert_to(p_job||a.evidence_snapshot::text,'UTF8')),'hex');
  IF p_decision IS NULL THEN
    RETURN (
      WITH documents AS (
        SELECT DISTINCT lower(v->>'document_record_id') AS id, v->'document_version' AS version, v->>'document_status' AS document_status,
          v->>'source_hash' AS hash FROM jsonb_array_elements(a.evidence_snapshot) v
      ), matches AS (
        SELECT hash, row_number() OVER (ORDER BY min(id)) AS group_number
        FROM documents GROUP BY hash HAVING count(DISTINCT id)>1
      )
      SELECT jsonb_build_object('version',token,'documents',jsonb_agg(
        jsonb_build_object('id',id,'version',version,'status',document_status,'duplicateGroup',group_number) ORDER BY id))
      FROM documents LEFT JOIN matches USING (hash)
    );
  END IF;
  IF token IS DISTINCT FROM p_version OR p_decision NOT IN ('ACKNOWLEDGED','RETURNED') THEN RAISE EXCEPTION 'JOB_STATE_INVALID'; END IF;
  INSERT INTO public.taxguard_a10_reviews(job_id,reviewer_uid,evidence_snapshot,decision) VALUES(p_job,p_actor,a.evidence_snapshot,p_decision) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.taxguard_a10_reviews WHERE job_id=p_job AND reviewer_uid=p_actor AND decision=p_decision) THEN RAISE EXCEPTION 'JOB_STATE_INVALID'; END IF;
  RETURN jsonb_build_object('decision',p_decision,'version',token);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_a10_review(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_a10_review(text,text,text,text,text) TO service_role;
