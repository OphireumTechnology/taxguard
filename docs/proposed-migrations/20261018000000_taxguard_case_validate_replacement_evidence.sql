-- PROPOSAL (Phase 14, stages 01-08 evidence). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 026 (case workflow) and 031 (document requests; current definition of
-- taxguard_case_evidence_checks).
--
-- Stage 03 (Validate) could pass while the latest version of a document for the engagement year
-- was REPLACEMENT_REQUESTED: the reviewer had asked the client for a replacement that had not
-- arrived, yet the case moved on to Record. Stage 03 now also requires that no document's latest
-- version (per tenant, client, document) is awaiting a requested replacement. Rejected documents are
-- final decisions and do not block. Stage 02 is unchanged. The checks stay server-derived; the
-- caller never supplies them. Everything else is identical to proposal 031.
-- Re-applying 031 after this proposal restores the previous definition: apply in name order.
-- Rollback (development): re-apply the proposal 031 definition.

CREATE OR REPLACE FUNCTION public.taxguard_case_evidence_checks(p_case public.taxguard_cases) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; outstanding boolean; unscanned boolean; unreviewed boolean; replacement_pending boolean;
BEGIN
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
  RETURN jsonb_build_object('requiredDocumentRequestsResolved', NOT outstanding, 'noDocumentsAwaitingReview', NOT unreviewed, 'noDocumentsAwaitingScan', NOT unscanned,
    'noOutstandingReplacementRequests', NOT replacement_pending);
END $$;

-- Internal helper of the case transition RPC: not callable by any API role (as in proposal 031).
REVOKE ALL ON FUNCTION public.taxguard_case_evidence_checks(public.taxguard_cases) FROM PUBLIC, anon, authenticated, service_role;
