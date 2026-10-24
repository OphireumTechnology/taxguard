-- PROPOSAL (Phase 14, Package B: engagement-year scope of document requests). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 20261012310000 (document requests), which holds the current definitions below, and
-- 20261018060000 (engagement-scoped access), which defines taxguard_staff_scope.
--
-- Owner decision 2026-10-19: a staff member assigned to one engagement and tax year reaches that client's records
-- for that engagement and year only, unless independently authorized (a client-wide assignment, a practice manager
-- or an administrator). Document requests decided staff visibility per client (taxguard_doc_actor and
-- taxguard_practice_can_see: any active assignment to the client), so an engagement-year assignee could create,
-- list, attach to, waive, cancel and remind requests of every engagement and year of the client, and saw them in the
-- cross-client missing-documents and review queues. Template request ids are deterministic, so applying a template
-- to an out-of-scope year also replayed that year's existing requests.
-- Each function below is identical to its current definition except for the change named above it. Refusals keep
-- the existing codes (ENGAGEMENT_YEAR_NOT_OPEN, DOC_REQUEST_NOT_FOUND), so a request out of scope is
-- indistinguishable from a missing one. Client access is unchanged: a client reaches only its own client's requests
-- (taxguard_doc_actor), never sees cancelled requests, and receives the client projection without staff identities,
-- template ids, resolution notes or reminder times. Firm templates remain manager-only and tenant-wide.
-- Rollback (development): re-apply proposal 20261012310000's definitions.

-- Current definition: 20261012310000. Added (create and apply-template): the requested engagement year, and an existing request replayed by id, must be in the actor's scope; otherwise ENGAGEMENT_YEAR_NOT_OPEN.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_insert(p_tenant text, p_client text, p_actor text, p_role text, p_id text, p_req jsonb, p_template text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE q public.taxguard_doc_requests; eng text := p_req->>'engagementId'; yr integer; types text[]; due date; title text := btrim(COALESCE(p_req->>'title', ''));
BEGIN
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_id;
  IF FOUND AND NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, p_role, q.engagement_id, q.tax_year) THEN RAISE EXCEPTION 'ENGAGEMENT_YEAR_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;
  IF FOUND THEN RETURN public.taxguard_docreq_json(q, true) || jsonb_build_object('created', false); END IF;
  BEGIN
    yr := (p_req->>'taxYear')::integer;
    due := NULLIF(p_req->>'dueDate', '')::date;
    types := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_req->'acceptedTypes')), ARRAY['application/pdf','image/jpeg','image/png']);
    IF cardinality(types) = 0 THEN types := ARRAY['application/pdf','image/jpeg','image/png']; END IF;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  IF eng IS NULL OR yr IS NULL OR length(title) NOT BETWEEN 3 AND 200 OR length(COALESCE(p_req->>'instructions', '')) > 2000 THEN
    RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_engagements e JOIN public.taxguard_tax_years y ON y.tenant_id = e.tenant_id AND y.client_id = e.client_id AND y.engagement_id = e.engagement_id
    WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND e.engagement_id = eng AND e.status IN ('draft','active','on_hold') AND y.tax_year = yr AND y.status = 'active';
  IF NOT FOUND OR NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, p_role, eng, yr) THEN RAISE EXCEPTION 'ENGAGEMENT_YEAR_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    INSERT INTO public.taxguard_doc_requests(tenant_id, client_id, request_id, engagement_id, tax_year, title, instructions, category, accepted_types, min_documents,
        required, due_date, template_id, created_by)
      VALUES (p_tenant, p_client, p_id, eng, yr, title, NULLIF(btrim(COALESCE(p_req->>'instructions', '')), ''), p_req->>'category', types,
        COALESCE((p_req->>'minDocuments')::integer, 1), COALESCE((p_req->>'required')::boolean, true), due, p_template, p_actor)
      RETURNING * INTO q;
  EXCEPTION WHEN check_violation OR invalid_text_representation OR not_null_violation THEN RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  PERFORM public.taxguard_docreq_audit(p_tenant, p_client, p_actor, p_role, 'DOC_REQUEST_CREATED',
    jsonb_build_object('requestId', p_id, 'engagementId', eng, 'taxYear', yr, 'category', q.category, 'required', q.required, 'templateId', p_template));
  PERFORM public.taxguard_docreq_notify(p_tenant, p_client, 'REQUEST_CREATED', p_id, 'Document requested: ' || q.title, p_actor);
  RETURN public.taxguard_docreq_json(q, true) || jsonb_build_object('created', true);
END $$;

-- Current definition: 20261012310000. Added: staff see only requests of engagement years in scope.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_list(p_tenant text, p_client text, p_actor text, p_engagement text, p_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_docreq_json(q, r <> 'client') ORDER BY q.tax_year DESC, q.required DESC, q.due_date NULLS LAST, q.created_at), '[]'::jsonb)
    FROM public.taxguard_doc_requests q WHERE q.tenant_id = p_tenant AND q.client_id = p_client
      AND (p_engagement IS NULL OR q.engagement_id = p_engagement) AND (p_year IS NULL OR q.tax_year = p_year)
      AND (r <> 'client' OR q.status <> 'CANCELLED')
      AND (r = 'client' OR public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, q.engagement_id, q.tax_year)));
END $$;

-- Current definition: 20261012310000. Added: staff may attach only to a request in scope (otherwise DOC_REQUEST_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_docreq_link(p_tenant text, p_client text, p_actor text, p_request text, p_document_id text, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_doc_requests; d public.taxguard_documents;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'bookkeeper' THEN RAISE EXCEPTION 'DOC_REQUEST_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request FOR UPDATE;
  IF NOT FOUND OR (r = 'client' AND q.status = 'CANCELLED') OR (r <> 'client' AND NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, q.engagement_id, q.tax_year)) THEN RAISE EXCEPTION 'DOC_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF q.status IN ('FULFILLED','WAIVED','CANCELLED') THEN RAISE EXCEPTION 'DOC_REQUEST_CLOSED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document_id AND version = p_version;
  IF NOT FOUND OR (r = 'client' AND d.created_by <> p_actor) THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF d.engagement_id IS DISTINCT FROM q.engagement_id OR d.tax_year IS DISTINCT FROM q.tax_year THEN RAISE EXCEPTION 'DOC_REQUEST_SCOPE_MISMATCH' USING ERRCODE = 'P0001'; END IF;
  IF d.category IS DISTINCT FROM q.category OR NOT (d.mime_type = ANY (q.accepted_types)) THEN RAISE EXCEPTION 'DOC_REQUEST_REQUIREMENT_NOT_MET' USING ERRCODE = 'P0001'; END IF;
  IF d.status IN ('REJECTED_MALWARE','REJECTED','REPLACEMENT_REQUESTED','SUPERSEDED') THEN RAISE EXCEPTION 'DOCUMENT_NOT_ELIGIBLE' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_doc_request_links(tenant_id, client_id, request_id, document_id, version, linked_by)
    VALUES (p_tenant, p_client, p_request, p_document_id, p_version, p_actor) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    PERFORM public.taxguard_docreq_audit(p_tenant, p_client, p_actor, r, 'DOC_REQUEST_DOCUMENT_LINKED',
      jsonb_build_object('requestId', p_request, 'documentId', p_document_id, 'version', p_version));
  END IF;
  PERFORM public.taxguard_docreq_refresh(p_tenant, p_client, p_request, p_actor);
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request;
  RETURN public.taxguard_docreq_json(q, r <> 'client');
END $$;

-- Current definition: 20261012310000. Added: the request must be in the actor's scope (otherwise DOC_REQUEST_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_docreq_resolve(p_tenant text, p_client text, p_actor text, p_request text, p_action text, p_reason text, p_row_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_doc_requests; target text; is_reviewer boolean;
BEGIN
  r := public.taxguard_docreq_staff(p_tenant, p_client, p_actor);
  IF p_action NOT IN ('waive','cancel') OR length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, q.engagement_id, q.tax_year) THEN RAISE EXCEPTION 'DOC_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_row_version IS NULL OR q.row_version <> p_row_version THEN RAISE EXCEPTION 'DOC_REQUEST_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF q.status IN ('FULFILLED','WAIVED','CANCELLED') THEN RAISE EXCEPTION 'DOC_REQUEST_CLOSED' USING ERRCODE = 'P0001'; END IF;
  is_reviewer := EXISTS (SELECT 1 FROM public.taxguard_staff_assignments WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = q.engagement_id
    AND tax_year = q.tax_year AND role = 'reviewer' AND user_id = p_actor AND status = 'ACTIVE');
  IF p_action = 'cancel' AND NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'DOC_REQUEST_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_action = 'waive' AND q.required AND NOT (is_reviewer OR public.taxguard_practice_is_manager(r)) THEN
    RAISE EXCEPTION 'DOC_REQUEST_WAIVER_REQUIRES_REVIEWER' USING ERRCODE = 'P0001';
  END IF;
  target := CASE p_action WHEN 'waive' THEN 'WAIVED' ELSE 'CANCELLED' END;
  UPDATE public.taxguard_doc_requests SET status = target, resolution_reason = btrim(p_reason), resolved_by = p_actor, resolved_at = now(),
      row_version = row_version + 1, updated_at = now()
    WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request RETURNING * INTO q;
  PERFORM public.taxguard_docreq_audit(p_tenant, p_client, p_actor, r, 'DOC_REQUEST_' || target, jsonb_build_object('requestId', p_request, 'required', q.required));
  PERFORM public.taxguard_docreq_notify(p_tenant, p_client, 'REQUEST_' || target, p_request,
    CASE target WHEN 'WAIVED' THEN 'No longer needed: ' ELSE 'Request withdrawn: ' END || q.title, p_actor);
  RETURN public.taxguard_docreq_json(q, true);
END $$;

-- Current definition: 20261012310000. Added: the request must be in the actor's scope (otherwise DOC_REQUEST_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_docreq_remind(p_tenant text, p_client text, p_actor text, p_request text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_doc_requests;
BEGIN
  r := public.taxguard_docreq_staff(p_tenant, p_client, p_actor);
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_staff_scope(p_tenant, p_client, p_actor, r, q.engagement_id, q.tax_year) THEN RAISE EXCEPTION 'DOC_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF q.status NOT IN ('OPEN','SUBMITTED') THEN RAISE EXCEPTION 'DOC_REQUEST_CLOSED' USING ERRCODE = 'P0001'; END IF;
  IF q.last_reminded_at IS NOT NULL AND q.last_reminded_at > now() - interval '24 hours' THEN RAISE EXCEPTION 'DOC_REQUEST_REMINDER_TOO_SOON' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_doc_requests SET last_reminded_at = now(), updated_at = now() WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request;
  PERFORM public.taxguard_docreq_notify(p_tenant, p_client, 'REQUEST_REMINDER', p_request, 'Reminder: ' || q.title, p_actor);
  PERFORM public.taxguard_docreq_audit(p_tenant, p_client, p_actor, r, 'DOC_REQUEST_REMINDED', jsonb_build_object('requestId', p_request));
  RETURN jsonb_build_object('requestId', p_request, 'remindedAt', now(), 'delivery', 'IN_APP_ONLY');
END $$;

-- Current definition: 20261012310000. Added: items and summary are limited to engagement years in the actor's scope.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_missing(p_tenant text, p_actor text, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; yr integer; only_overdue boolean; lim integer;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF r = 'bookkeeper' THEN RAISE EXCEPTION 'DOC_REQUEST_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    yr := NULLIF(p_filter->>'taxYear', '')::integer; only_overdue := COALESCE((p_filter->>'overdueOnly')::boolean, false); lim := COALESCE((p_filter->>'limit')::integer, 100);
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  IF lim NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object(
    'items', (SELECT COALESCE(jsonb_agg(x.j ORDER BY x.overdue DESC, x.due_date NULLS LAST, x.created_at), '[]'::jsonb) FROM (
      SELECT public.taxguard_docreq_json(q, true) || jsonb_build_object('clientName', c.name) AS j, q.due_date, q.created_at,
        (q.due_date IS NOT NULL AND q.due_date < current_date) AS overdue
      FROM public.taxguard_doc_requests q JOIN public.taxguard_clients c ON c.tenant_id = q.tenant_id AND c.client_id = q.client_id AND c.status = 'active'
      WHERE q.tenant_id = p_tenant AND q.status IN ('OPEN','SUBMITTED') AND (yr IS NULL OR q.tax_year = yr)
        AND (NOT only_overdue OR (q.due_date IS NOT NULL AND q.due_date < current_date)) AND public.taxguard_practice_can_see(p_tenant, q.client_id, p_actor, r)
          AND public.taxguard_staff_scope(p_tenant, q.client_id, p_actor, r, q.engagement_id, q.tax_year)
      ORDER BY (q.due_date IS NOT NULL AND q.due_date < current_date) DESC, q.due_date NULLS LAST, q.created_at LIMIT lim) x),
    'summary', (SELECT COALESCE(jsonb_agg(jsonb_build_object('clientId', s.client_id, 'engagementId', s.engagement_id, 'taxYear', s.tax_year,
        'open', s.open, 'submitted', s.submitted, 'overdue', s.overdue, 'requiredOutstanding', s.required_outstanding) ORDER BY s.client_id, s.tax_year), '[]'::jsonb)
      FROM (SELECT q.client_id, q.engagement_id, q.tax_year, count(*) FILTER (WHERE q.status = 'OPEN') AS open, count(*) FILTER (WHERE q.status = 'SUBMITTED') AS submitted,
          count(*) FILTER (WHERE q.due_date < current_date) AS overdue, count(*) FILTER (WHERE q.required) AS required_outstanding
        FROM public.taxguard_doc_requests q JOIN public.taxguard_clients c ON c.tenant_id = q.tenant_id AND c.client_id = q.client_id AND c.status = 'active'
        WHERE q.tenant_id = p_tenant AND q.status IN ('OPEN','SUBMITTED') AND (yr IS NULL OR q.tax_year = yr) AND public.taxguard_practice_can_see(p_tenant, q.client_id, p_actor, r)
          AND public.taxguard_staff_scope(p_tenant, q.client_id, p_actor, r, q.engagement_id, q.tax_year)
        GROUP BY q.client_id, q.engagement_id, q.tax_year) s));
END $$;

-- Current definition: 20261012310000. Added: linked documents are limited to engagement years in the actor's scope.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_review_queue(p_tenant text, p_actor text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF r = 'bookkeeper' THEN RAISE EXCEPTION 'DOC_REQUEST_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(x.j ORDER BY x.created_at), '[]'::jsonb) FROM (
    SELECT d.created_at, public.taxguard_doc_json(d) || jsonb_build_object('clientName', c.name, 'canReview', d.created_by <> p_actor, 'requestId', q.request_id,
      'requestTitle', q.title, 'requestRequired', q.required, 'requestDueDate', q.due_date) AS j
    FROM public.taxguard_doc_request_links l
      JOIN public.taxguard_documents d ON d.tenant_id = l.tenant_id AND d.client_id = l.client_id AND d.document_id = l.document_id AND d.version = l.version
      JOIN public.taxguard_doc_requests q ON q.tenant_id = l.tenant_id AND q.client_id = l.client_id AND q.request_id = l.request_id
      JOIN public.taxguard_clients c ON c.tenant_id = d.tenant_id AND c.client_id = d.client_id AND c.status = 'active'
    WHERE l.tenant_id = p_tenant AND d.status = 'PENDING_REVIEW' AND d.quarantine_status = 'CLEAN' AND public.taxguard_practice_can_see(p_tenant, d.client_id, p_actor, r)
      AND public.taxguard_staff_scope(p_tenant, d.client_id, p_actor, r, d.engagement_id, d.tax_year)
    ORDER BY d.created_at LIMIT p_limit) x);
END $$;

-- Current definition: 20261012310000. Added: the client projection omits a document rejected as malware unless a client user of this client uploaded it, as the vault list does.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_json(q public.taxguard_doc_requests, p_staff boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('requestId', q.request_id, 'clientId', q.client_id, 'engagementId', q.engagement_id, 'taxYear', q.tax_year, 'title', q.title,
    'instructions', q.instructions, 'category', q.category, 'acceptedTypes', to_jsonb(q.accepted_types), 'minDocuments', q.min_documents, 'required', q.required,
    'dueDate', q.due_date, 'overdue', q.due_date IS NOT NULL AND q.due_date < current_date AND q.status IN ('OPEN','SUBMITTED'), 'status', q.status,
    'rowVersion', q.row_version, 'createdAt', q.created_at, 'resolvedAt', q.resolved_at,
    'documents', (SELECT COALESCE(jsonb_agg(jsonb_build_object('documentId', d.document_id, 'version', d.version, 'fileName', d.file_name, 'status', d.status)
        ORDER BY l.linked_at), '[]'::jsonb)
      FROM public.taxguard_doc_request_links l JOIN public.taxguard_documents d ON d.tenant_id = l.tenant_id AND d.client_id = l.client_id
        AND d.document_id = l.document_id AND d.version = l.version
      WHERE l.tenant_id = q.tenant_id AND l.client_id = q.client_id AND l.request_id = q.request_id
        AND (p_staff OR d.status <> 'REJECTED_MALWARE' OR EXISTS (SELECT 1 FROM public.taxguard_members m WHERE m.tenant_id = q.tenant_id AND m.uid = d.created_by
          AND m.client_id = q.client_id AND m.role IN ('client','prospective_client')))))
  || CASE WHEN p_staff THEN jsonb_build_object('createdBy', q.created_by, 'templateId', q.template_id, 'resolutionReason', q.resolution_reason,
       'resolvedBy', q.resolved_by, 'lastRemindedAt', q.last_reminded_at) ELSE '{}'::jsonb END $$;
