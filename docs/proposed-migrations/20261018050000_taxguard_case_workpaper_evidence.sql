-- PROPOSAL (Phase 14, stages 01-08 evidence). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 026 (case workflow), 029 (book-to-tax workpapers), 031 (document requests) and
-- 20261018000000 (current definition of taxguard_case_evidence_checks).
--
-- Stage 06 (Review) is a professional attestation by the case's independent reviewer ("workpapers reviewed",
-- "no unresolved blocking exceptions"). The attestation was accepted even when no book-to-tax workpaper had been
-- recorded at all, so a case could pass Review with nothing reviewed. Stage 06 now also requires that an APPROVED
-- book-to-tax workpaper exists for the case's client, tax year and return family. Its approval is itself a
-- maker-checker decision recorded by proposal 029 (reviewer differs from the preparer). Draft, rejected and
-- superseded workpapers, and workpapers of another year, return family or client, do not count.
-- Who may attest, the attestation checklist and every other stage are unchanged. Stages 02 and 03 are
-- identical to 20261018000000. The check is server-derived; the caller never supplies it.
-- FOR OWNER REVIEW: this adds a recorded-evidence precondition to an existing attestation; it does not change
-- who approves.
-- Rollback (development): re-apply the 20261018000000 definition.

CREATE OR REPLACE FUNCTION public.taxguard_case_evidence_checks(p_case public.taxguard_cases) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; outstanding boolean; unscanned boolean; unreviewed boolean; replacement_pending boolean;
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
  RETURN jsonb_build_object('requiredDocumentRequestsResolved', NOT outstanding, 'noDocumentsAwaitingReview', NOT unreviewed, 'noDocumentsAwaitingScan', NOT unscanned,
    'noOutstandingReplacementRequests', NOT replacement_pending);
END $$;

-- Internal helper of the case transition RPC: not callable by any API role (as in proposals 031 and 20261018000000).
REVOKE ALL ON FUNCTION public.taxguard_case_evidence_checks(public.taxguard_cases) FROM PUBLIC, anon, authenticated, service_role;
