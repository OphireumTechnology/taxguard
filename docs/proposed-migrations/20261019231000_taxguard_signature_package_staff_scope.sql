-- PROPOSAL (Block 80, engagement scope of the staff path of client signature packages). REVIEW ONLY; NOT APPLIED anywhere
-- external. Requires 20261018060000 (taxguard_staff_scope) and 20261019190000, which holds the current definition below.
--
-- Companion of 20261019230000 (same owner decision of 2026-10-19), kept separate so that only the client-signatures
-- cutover waits for it. taxguard_portal_signature_packages returned, to staff with any active assignment to the client,
-- the status-only packages of every engagement and tax year. Now staff see only packages of engagements and years in
-- their scope; clients keep their rule (packages naming them as a signer); managers and administrators are unchanged.
-- The function is identical to its current definition except for that filter.
-- Rollback (development): re-apply the 20261019190000 definition.

-- Current definition: 20261019190000. Changed: staff path: only packages of engagements and years in scope.
CREATE OR REPLACE FUNCTION public.taxguard_portal_signature_packages(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('packageId', p.package_id, 'taxYear', v.tax_year, 'releasedAt', p.released_at,
      'status', 'AWAITING_SIGNATURE', 'signature', 'NOT_AVAILABLE') ORDER BY p.released_at DESC, p.package_id), '[]'::jsonb)
    FROM public.taxguard_tax_return_signature_packages p
    JOIN public.taxguard_tax_return_versions v ON v.tenant_id = p.tenant_id AND v.return_version_id = p.return_version_id
    JOIN public.taxguard_cases c ON c.tenant_id = v.tenant_id AND c.case_id = v.case_id
    WHERE p.tenant_id = p_tenant AND p.client_id = p_client AND p.withdrawn_at IS NULL
      AND (r <> 'client' OR p_actor = ANY (p.signer_uids))
      AND (r = 'client' OR public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, c.engagement_id, c.tax_year))
      AND (public.taxguard_tax_return_signature_status(p_tenant, p.return_version_id)->>'current')::boolean);
END $$;

REVOKE ALL ON FUNCTION public.taxguard_portal_signature_packages(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_portal_signature_packages(text,text,text) TO service_role;
