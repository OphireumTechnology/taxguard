-- PROPOSAL (Phase 13A, contract C3). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 025 (practice), 026 (case workflow), 027 (document vault), 031 (document requests).
--
-- Client-facing read of the canonical 18-stage case for one engagement tax year. The browser never
-- infers progression: every value here is read from durable case, stage, document and request rows.
-- Scope: taxguard_doc_actor (a client only for their own client; assigned staff; managers).
--
-- A client sees, per case:
--   * case status (ACTIVE / ON_HOLD / CLOSED / CANCELLED) and the active stage; never the hold reason;
--   * stages 01-08: status (LOCKED / IN_PROGRESS / COMPLETED) and completion time; never who approved,
--     attestation statements, events, notes, tasks or internal reasons;
--   * for the active stage, the server's own evidence policy: SYSTEM_VERIFIED checks as booleans only
--     (no ledger amounts, account names or counts of entries) and the HUMAN_ATTESTED checklist codes;
--   * evidence availability for the engagement year: counts of verified, in-review and actionable
--     documents and of open document requests (no file names of other years, no staff fields);
--   * whether an independent preparer and reviewer are assigned (booleans; no staff identities).
-- Stages 09-18 are never returned: they remain blocked by policy and the client portal shows the
-- canonical blocked explanation. No tax figure exists in this read.
--
-- Idempotent: CREATE OR REPLACE only. Rollback: DROP FUNCTION public.taxguard_portal_case_stages(text,text,text,text,integer).

CREATE OR REPLACE FUNCTION public.taxguard_portal_case_stages(p_tenant text, p_client text, p_actor text, p_engagement text, p_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; c public.taxguard_cases; e public.taxguard_engagements; policy jsonb; checks jsonb;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF p_engagement IS NULL OR p_engagement !~ '^[A-Za-z0-9_-]{1,128}$' OR p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'PORTAL_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO e FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement;
  -- Clients never see draft or cancelled engagements (same rule as proposal 044).
  IF NOT FOUND OR (r = 'client' AND e.status IN ('draft','cancelled')) THEN RAISE EXCEPTION 'PORTAL_ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement AND tax_year = p_year;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('engagementId', p_engagement, 'taxYear', p_year, 'caseExists', false);
  END IF;
  policy := public.taxguard_case_stage_policy(c.active_stage);
  IF c.active_stage <= 8 AND policy->>'evidence' = 'SYSTEM_VERIFIED' THEN
    -- Booleans only: the system checks already contain no amounts; re-filter defensively.
    SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO checks FROM jsonb_each(public.taxguard_case_system_checks(c)) AS x(k, v) WHERE jsonb_typeof(v) = 'boolean';
  END IF;
  RETURN jsonb_build_object(
    'engagementId', p_engagement, 'taxYear', p_year, 'caseExists', true,
    'caseStatus', c.status, 'activeStage', c.active_stage, 'updatedAt', c.updated_at,
    'activeStagePolicy', CASE WHEN c.active_stage <= 8 THEN jsonb_build_object('evidence', policy->>'evidence', 'checklist', COALESCE(policy->'checklist', '[]'::jsonb)) END,
    'activeStageChecks', checks,
    'stages', (SELECT COALESCE(jsonb_agg(jsonb_build_object('stage', s.stage_number, 'status', s.status,
        'completedAt', CASE WHEN s.status = 'COMPLETED' THEN s.approved_at END) ORDER BY s.stage_number), '[]'::jsonb)
      FROM public.taxguard_stage_states s WHERE s.tenant_id = c.tenant_id AND s.case_id = c.case_id AND s.stage_number <= 8),
    'evidence', jsonb_build_object(
      'verifiedDocuments', (SELECT count(*) FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.client_id = p_client AND d.engagement_id = p_engagement AND d.tax_year = p_year AND d.status = 'VERIFIED'),
      'documentsInReview', (SELECT count(*) FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.client_id = p_client AND d.engagement_id = p_engagement AND d.tax_year = p_year AND d.status IN ('SCAN_PENDING','PENDING_REVIEW')),
      'documentsNeedingAction', (SELECT count(*) FROM public.taxguard_documents d WHERE d.tenant_id = p_tenant AND d.client_id = p_client AND d.engagement_id = p_engagement AND d.tax_year = p_year AND d.status IN ('REJECTED','REPLACEMENT_REQUESTED','REJECTED_MALWARE')
        AND NOT EXISTS (SELECT 1 FROM public.taxguard_documents n WHERE n.tenant_id = d.tenant_id AND n.client_id = d.client_id AND n.document_id = d.document_id AND n.version > d.version)),
      'openDocumentRequests', (SELECT count(*) FROM public.taxguard_doc_requests q WHERE q.tenant_id = p_tenant AND q.client_id = p_client AND q.engagement_id = p_engagement AND q.tax_year = p_year AND q.status IN ('OPEN','SUBMITTED'))),
    'team', jsonb_build_object(
      'preparerAssigned', EXISTS (SELECT 1 FROM public.taxguard_staff_assignments a WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.engagement_id = p_engagement AND a.tax_year = p_year AND a.role = 'preparer' AND a.status = 'ACTIVE'),
      'reviewerAssigned', EXISTS (SELECT 1 FROM public.taxguard_staff_assignments a WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.engagement_id = p_engagement AND a.tax_year = p_year AND a.role = 'reviewer' AND a.status = 'ACTIVE'),
      'independentReview', c.preparer_uid IS DISTINCT FROM c.reviewer_uid));
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'taxguard_portal_case_stages' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
