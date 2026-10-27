-- PROPOSAL (Phase 14, Stage 03 validation evidence). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 026 (case workflow), 027 (document vault: taxguard_extracted_data and its decision columns),
-- 031 (document requests), 20261018050000 (current definition of taxguard_case_evidence_checks) and 20261018060000
-- (current definition of taxguard_doc_review_queue).
--
-- OCR proposals are candidates, never values: the vault records them with is_ai_proposed_only and only a staff
-- decision (ACCEPTED, CORRECTED or REJECTED) settles them. Stage 03 (Validate) checked that every document was reviewed
-- but not that its proposed values were, so a case could be validated while machine-proposed values on its current
-- documents were still undecided. Stage 03 now also requires that no proposal on the current version of a document
-- for the case's client, engagement and tax year is undecided. Superseded versions and rejected documents do not
-- count: their proposals can no longer be used. The check is server-derived; the caller never supplies it.
-- Stages 02 and 06 and every other stage are identical to 20261018050000; who may attest is unchanged.
-- FOR OWNER REVIEW: this adds a recorded-evidence precondition to Stage 03; it does not change who approves. The
-- Stage 02 workspace states that AI extractions must be decided "before Gate 2 clearance"; this proposal places the
-- requirement at Validate, where review completeness is already checked. Confirm the stage.
-- Rollback (development): re-apply the 20261018050000 definition.

CREATE OR REPLACE FUNCTION public.taxguard_case_evidence_checks(p_case public.taxguard_cases) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; outstanding boolean; unscanned boolean; unreviewed boolean; replacement_pending boolean; undecided boolean;
BEGIN
  IF c.active_stage = 6 THEN
    RETURN jsonb_build_object('approvedWorkpaperRecorded', EXISTS (SELECT 1 FROM public.taxguard_b2t_workpapers w
      WHERE w.tenant_id = c.tenant_id AND w.client_id = c.client_id AND w.tax_year = c.tax_year
        AND w.return_family IS NOT DISTINCT FROM c.return_family AND w.status = 'APPROVED'));
  END IF;
  IF c.active_stage NOT IN (2, 3) THEN RETURN '{}'::jsonb; END IF;
  outstanding := EXISTS (SELECT 1 FROM public.taxguard_doc_requests WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
    AND tax_year = c.tax_year AND required AND status IN ('OPEN','SUBMITTED'));
  unscanned := EXISTS (SELECT 1 FROM public.taxguard_documents WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
    AND tax_year = c.tax_year AND status IN ('UPLOAD_PENDING','SCAN_PENDING'));
  unreviewed := EXISTS (SELECT 1 FROM public.taxguard_documents WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
    AND tax_year = c.tax_year AND status = 'PENDING_REVIEW');
  IF c.active_stage = 2 THEN RETURN jsonb_build_object('requiredDocumentRequestsResolved', NOT outstanding, 'noDocumentsAwaitingScan', NOT unscanned); END IF;
  replacement_pending := EXISTS (SELECT 1 FROM public.taxguard_documents d WHERE d.tenant_id = c.tenant_id AND d.client_id = c.client_id
    AND d.engagement_id = c.engagement_id AND d.tax_year = c.tax_year AND d.status = 'REPLACEMENT_REQUESTED'
    AND NOT EXISTS (SELECT 1 FROM public.taxguard_documents later WHERE later.tenant_id = d.tenant_id AND later.client_id = d.client_id
      AND later.document_id = d.document_id AND later.version > d.version));
  -- Undecided proposals on the current version of a usable document.
  undecided := EXISTS (SELECT 1 FROM public.taxguard_extracted_data e JOIN public.taxguard_documents d
      ON d.tenant_id = e.tenant_id AND d.client_id = e.client_id AND d.document_id = e.document_id AND d.version = e.document_version
    WHERE e.tenant_id = c.tenant_id AND e.client_id = c.client_id AND d.engagement_id = c.engagement_id AND d.tax_year = c.tax_year
      AND e.decision IS NULL AND d.status <> 'REJECTED'
      AND NOT EXISTS (SELECT 1 FROM public.taxguard_documents later WHERE later.tenant_id = d.tenant_id AND later.client_id = d.client_id
        AND later.document_id = d.document_id AND later.version > d.version));
  RETURN jsonb_build_object('requiredDocumentRequestsResolved', NOT outstanding, 'noDocumentsAwaitingReview', NOT unreviewed, 'noDocumentsAwaitingScan', NOT unscanned,
    'noOutstandingReplacementRequests', NOT replacement_pending, 'noUndecidedExtractionProposals', NOT undecided);
END $$;

-- Internal helper of the case transition RPC: not callable by any API role (as in proposals 031, 20261018000000 and 20261018050000).
REVOKE ALL ON FUNCTION public.taxguard_case_evidence_checks(public.taxguard_cases) FROM PUBLIC, anon, authenticated, service_role;

-- The staff review queue listed only documents awaiting review. A document accepted while one of its proposals was
-- still undecided then disappeared from the queue, leaving no screen on which staff could decide the proposal that now
-- blocks Validate. The queue also lists the current version of a reviewed (VERIFIED) document that still has undecided
-- proposals, with their count, so the decision can be made. Scope, ordering and the limit are unchanged from
-- 20261018060000 (the current definition); a listed reviewed document grants no new document action.
CREATE OR REPLACE FUNCTION public.taxguard_doc_review_queue(p_tenant text, p_actor text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'DOCUMENT_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at), '[]'::jsonb) FROM (
    SELECT d.created_at, public.taxguard_doc_json(d) || jsonb_build_object('clientName', c.name, 'canReview', d.created_by <> p_actor,
        'undecidedProposals', (SELECT count(*) FROM public.taxguard_extracted_data e WHERE e.tenant_id = d.tenant_id AND e.client_id = d.client_id
          AND e.document_id = d.document_id AND e.document_version = d.version AND e.decision IS NULL)) AS row_data
    FROM public.taxguard_documents d JOIN public.taxguard_clients c ON c.tenant_id = d.tenant_id AND c.client_id = d.client_id AND c.status = 'active'
    WHERE d.tenant_id = p_tenant AND d.quarantine_status = 'CLEAN'
      AND (d.status = 'PENDING_REVIEW' OR (d.status = 'VERIFIED'
        AND EXISTS (SELECT 1 FROM public.taxguard_extracted_data e WHERE e.tenant_id = d.tenant_id AND e.client_id = d.client_id
          AND e.document_id = d.document_id AND e.document_version = d.version AND e.decision IS NULL)
        AND NOT EXISTS (SELECT 1 FROM public.taxguard_documents later WHERE later.tenant_id = d.tenant_id AND later.client_id = d.client_id
          AND later.document_id = d.document_id AND later.version > d.version)))
      AND public.taxguard_staff_scope(p_tenant, d.client_id, p_actor, r, d.engagement_id, d.tax_year)
    ORDER BY d.created_at LIMIT p_limit) q);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_doc_review_queue(text, text, integer) FROM PUBLIC, anon, authenticated;
