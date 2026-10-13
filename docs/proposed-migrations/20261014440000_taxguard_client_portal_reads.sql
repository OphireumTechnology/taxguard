-- PROPOSAL 044 ONLY. NOT APPLIED. Requires the actual core schema and proposals 025, 026, 027, 042.
-- Client-portal reads that replace the remaining legacy in-memory engagement loads, and a narrower
-- client view of legal-coordination matters.
--
--   * taxguard_portal_engagements: one row per (engagement, tax year) of the client, with the case
--     status and active stage when a case exists. Scope: taxguard_doc_actor (client member for their
--     own client; assigned staff; managers). Clients never see DRAFT or CANCELLED engagements, and see
--     no staff identities, notes or internal reasons.
--   * Supersedes taxguard_legal_json (proposal 042, same signature): clients see the recorded
--     external attorney, law firm and bar number only once the referral was recorded
--     (TRANSMITTED_TO_COUNSEL or later) — a counsel choice made during review is an internal,
--     unapproved decision. Staff output is unchanged.
-- Rollback (development): drop taxguard_portal_engagements; re-run proposal 042's taxguard_legal_json.

CREATE OR REPLACE FUNCTION public.taxguard_portal_engagements(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('engagementId', e.engagement_id, 'title', e.title, 'type', e.type, 'engagementStatus', e.status,
      'taxYear', y.tax_year, 'yearStatus', y.status, 'caseStatus', c.status, 'activeStage', c.active_stage,
      'updatedAt', GREATEST(e.updated_at, y.updated_at, COALESCE(c.updated_at, e.updated_at))) ORDER BY y.tax_year DESC, e.created_at DESC), '[]'::jsonb)
    FROM public.taxguard_engagements e
    JOIN public.taxguard_tax_years y ON y.tenant_id = e.tenant_id AND y.client_id = e.client_id AND y.engagement_id = e.engagement_id
    LEFT JOIN public.taxguard_cases c ON c.tenant_id = e.tenant_id AND c.client_id = e.client_id AND c.engagement_id = e.engagement_id AND c.tax_year = y.tax_year
    WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND (r <> 'client' OR e.status NOT IN ('draft','cancelled')));
END $$;

-- Superseding definition of the proposal-042 projection (identical for staff).
CREATE OR REPLACE FUNCTION public.taxguard_legal_json(m public.taxguard_legal_matters, p_staff boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('matterId', m.matter_id, 'clientId', m.client_id, 'engagementId', m.engagement_id, 'category', m.category, 'title', m.title,
    'summary', m.summary, 'status', m.status,
    'externalAttorney', CASE WHEN p_staff OR m.status IN ('TRANSMITTED_TO_COUNSEL','COUNSEL_REVIEW','COMPLETED') THEN m.external_attorney END,
    'lawFirm', CASE WHEN p_staff OR m.status IN ('TRANSMITTED_TO_COUNSEL','COUNSEL_REVIEW','COMPLETED') THEN m.law_firm END,
    'attorneyBarNumber', CASE WHEN p_staff OR m.status IN ('TRANSMITTED_TO_COUNSEL','COUNSEL_REVIEW','COMPLETED') THEN m.attorney_bar_number END,
    'filingDeadline', m.filing_deadline, 'publicRecordReference', m.public_record_reference, 'disclaimerVersion', m.disclaimer_version,
    'disclaimerAcknowledgedAt', m.disclaimer_acknowledged_at, 'cancelReason', m.cancel_reason, 'version', m.version, 'createdAt', m.created_at, 'updatedAt', m.updated_at,
    'documents', (SELECT COALESCE(jsonb_agg(jsonb_build_object('documentId', l.document_id, 'version', l.document_version, 'fileName', d.file_name, 'linkedAt', l.linked_at)
        ORDER BY l.linked_at), '[]'::jsonb)
      FROM public.taxguard_legal_matter_documents l LEFT JOIN public.taxguard_documents d ON d.tenant_id = l.tenant_id AND d.client_id = m.client_id
        AND d.document_id = l.document_id AND d.version = l.document_version
      WHERE l.tenant_id = m.tenant_id AND l.matter_id = m.matter_id))
  || CASE WHEN p_staff THEN jsonb_build_object('createdBy', m.created_by, 'createdByRole', m.created_by_role, 'updatedBy', m.updated_by,
    'history', (SELECT COALESCE(jsonb_agg(jsonb_build_object('seq', e.seq, 'action', e.action, 'actorUid', e.actor_uid, 'actorRole', e.actor_role, 'at', e.at, 'changes', e.changes) ORDER BY e.seq), '[]'::jsonb)
      FROM public.taxguard_legal_matter_events e WHERE e.tenant_id = m.tenant_id AND e.matter_id = m.matter_id))
    ELSE jsonb_build_object('progress', (SELECT COALESCE(jsonb_agg(jsonb_build_object('step', e.action, 'at', e.at) ORDER BY e.seq), '[]'::jsonb)
      FROM public.taxguard_legal_matter_events e WHERE e.tenant_id = m.tenant_id AND e.matter_id = m.matter_id AND (e.action LIKE 'STATUS\_%' OR e.action IN ('MATTER_OPENED','CANCELLED')))) END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_portal_engagements','taxguard_legal_json') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname = 'taxguard_portal_engagements' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
