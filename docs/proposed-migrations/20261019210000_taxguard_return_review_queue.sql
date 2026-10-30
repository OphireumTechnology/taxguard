-- PROPOSAL (Block 78, Stage 09 draft return review queue). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261018090000 (case slot liveness), 20261019120000 (return versions), 20261019140000 (verifications) and
-- 20261019160000 (risk assessments).
--
-- The reviewer's queue of return versions waiting for the independent Stage 09 review: SUBMITTED versions of cases where
-- the actor holds the live reviewer assignment. Each item carries what the reviewer must know before deciding:
--   * whether the version is stale (it cannot be approved);
--   * the latest calculation verification (approval needs a current VERIFIED one);
--   * the latest risk assessment, its outcome and reason codes. A BLOCKED assessment is the escalation Block 71 left
--     out: it is shown, never acted on.
-- Ordered by submission time, oldest first; no priority is computed (prioritisation is a practice decision).
-- Read only: nothing is approved, returned, assigned or recorded. Practice managers see every SUBMITTED version of the
-- tenant. Rollback (development): drop the function.

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_review_queue(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('returnVersionId', v.return_version_id, 'caseId', v.case_id, 'clientId', v.client_id,
      'taxYear', v.tax_year, 'templateId', v.template_id, 'version', v.version, 'status', v.status, 'preparedBy', v.prepared_by,
      'submittedAt', v.submitted_at, 'stale', jsonb_array_length(public.taxguard_tax_return_stale(v.tenant_id, v.return_version_id)) > 0,
      'verification', (SELECT jsonb_build_object('verificationId', x.verification_id, 'result', x.result, 'verifiedAt', x.verified_at)
        FROM public.taxguard_tax_return_verifications x WHERE x.tenant_id = v.tenant_id AND x.return_version_id = v.return_version_id
        ORDER BY x.verified_at DESC, x.verification_id LIMIT 1),
      'risk', (SELECT jsonb_build_object('assessmentId', a.assessment_id, 'outcome', a.outcome, 'reasonCodes', to_jsonb(a.reason_codes), 'assessedAt', a.assessed_at)
        FROM public.taxguard_tax_return_risk_assessments a WHERE a.tenant_id = v.tenant_id AND a.return_version_id = v.return_version_id
        ORDER BY a.assessed_at DESC, a.assessment_id LIMIT 1),
      'returnUse', 'BLOCKED') ORDER BY v.submitted_at, v.return_version_id), '[]'::jsonb)
    FROM public.taxguard_tax_return_versions v JOIN public.taxguard_cases c ON c.tenant_id = v.tenant_id AND c.case_id = v.case_id
    WHERE v.tenant_id = p_tenant AND v.status = 'SUBMITTED'
      AND (public.taxguard_practice_is_manager(r)
        OR (c.reviewer_uid = p_actor AND public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor))));
END $$;

REVOKE ALL ON FUNCTION public.taxguard_tax_return_review_queue(text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_tax_return_review_queue(text,text) TO service_role;
