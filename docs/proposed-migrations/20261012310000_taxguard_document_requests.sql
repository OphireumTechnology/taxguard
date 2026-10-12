-- PROPOSAL 031 ONLY. NOT APPLIED. Requires the actual core schema and proposals 025, 026, 027.
-- Durable document requests and checklists, scoped to (tenant, client, engagement, tax year).
--
--   * Firm-defined checklist templates (titles, categories, required flag). No tax rules are
--     encoded: what to request is the firm's professional decision, recorded per tenant.
--   * Requests carry upload requirements (vault category, accepted file types, minimum number of
--     verified documents) and an optional due date.
--   * Clients link their own vault uploads to their own requests; staff may link any document of
--     the same client, engagement and tax year. A request is FULFILLED only when enough linked
--     documents are VERIFIED by staff review (proposal 027); its status is recomputed by trigger
--     whenever a linked document changes status. Required requests may be waived only by the
--     reviewer or a manager, with a recorded reason; cancelled by a manager.
--   * Missing-document tracking and a request-aware review queue for staff.
--   * Client notifications are an in-app outbox only. No e-mail or SMS provider is configured;
--     every row records delivery 'NOT_CONFIGURED'. Notification text never contains document
--     contents or amounts, only request titles.
--   * Case stage 2 and 3 gates (proposal 026 hook): required requests must be fulfilled or waived,
--     no document of the engagement year may be awaiting scan or review.
-- Every change is audited in taxguard_audit_log with metadata.clientId. Synthetic data only in tests.
-- Rollback (development): drop taxguard_docreq_* and taxguard_client_notification* functions, the
-- trigger, the four tables, and restore taxguard_case_evidence_checks to return '{}'.

CREATE TABLE IF NOT EXISTS public.taxguard_docreq_templates (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE CASCADE,
  template_id VARCHAR(64) NOT NULL CHECK (template_id ~ '^[A-Za-z0-9_-]{3,64}$'),
  name VARCHAR(200) NOT NULL CHECK (length(btrim(name)) >= 3),
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 100),
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RETIRED')),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by VARCHAR(128) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, template_id)
);

CREATE TABLE IF NOT EXISTS public.taxguard_doc_requests (
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  request_id VARCHAR(64) NOT NULL CHECK (request_id ~ '^req_[a-f0-9]{32}$'),
  engagement_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL CHECK (length(btrim(title)) >= 3),
  instructions VARCHAR(2000),
  category VARCHAR(32) NOT NULL CHECK (category IN ('income','deductions','identity','prior_return','business_records','bank_statement','correspondence','engagement','other')),
  accepted_types TEXT[] NOT NULL CHECK (cardinality(accepted_types) BETWEEN 1 AND 5 AND accepted_types <@ ARRAY['application/pdf','image/jpeg','image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv']::text[]),
  min_documents INTEGER NOT NULL DEFAULT 1 CHECK (min_documents BETWEEN 1 AND 20),
  required BOOLEAN NOT NULL DEFAULT true,
  due_date DATE,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SUBMITTED','FULFILLED','WAIVED','CANCELLED')),
  template_id VARCHAR(64),
  resolution_reason VARCHAR(1000),
  resolved_by VARCHAR(128),
  resolved_at TIMESTAMPTZ,
  last_reminded_at TIMESTAMPTZ,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, client_id, request_id),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id),
  FOREIGN KEY (tenant_id, client_id, engagement_id, tax_year) REFERENCES public.taxguard_tax_years(tenant_id, client_id, engagement_id, tax_year),
  CHECK ((status IN ('WAIVED','CANCELLED')) = (resolution_reason IS NOT NULL AND resolved_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_taxguard_doc_requests_year ON public.taxguard_doc_requests (tenant_id, client_id, engagement_id, tax_year, status);

CREATE TABLE IF NOT EXISTS public.taxguard_doc_request_links (
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  document_id VARCHAR(128) NOT NULL,
  version INTEGER NOT NULL,
  linked_by VARCHAR(128) NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, request_id, document_id, version),
  FOREIGN KEY (tenant_id, client_id, request_id) REFERENCES public.taxguard_doc_requests(tenant_id, client_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_doc_request_links_doc ON public.taxguard_doc_request_links (tenant_id, client_id, document_id, version);

CREATE TABLE IF NOT EXISTS public.taxguard_client_notifications (
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  notification_id UUID NOT NULL DEFAULT gen_random_uuid(),
  kind VARCHAR(32) NOT NULL CHECK (kind IN ('REQUEST_CREATED','REQUEST_REMINDER','REQUEST_FULFILLED','REQUEST_WAIVED','REQUEST_CANCELLED','REPLACEMENT_REQUESTED','DOCUMENT_REJECTED')),
  request_id VARCHAR(64),
  title VARCHAR(300) NOT NULL,
  channel VARCHAR(16) NOT NULL DEFAULT 'IN_APP' CHECK (channel = 'IN_APP'),
  delivery_status VARCHAR(24) NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (delivery_status = 'NOT_CONFIGURED'),
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, client_id, notification_id),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_client_notifications_unread ON public.taxguard_client_notifications (tenant_id, client_id, created_at DESC) WHERE read_at IS NULL;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_docreq_templates','taxguard_doc_requests','taxguard_doc_request_links','taxguard_client_notifications'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Links are append-only; notifications only change by being read.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_links_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'DOC_REQUEST_LINK_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_doc_request_links_immutable ON public.taxguard_doc_request_links;
CREATE TRIGGER trg_taxguard_doc_request_links_immutable BEFORE UPDATE OR DELETE ON public.taxguard_doc_request_links
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_docreq_links_append_only();
CREATE OR REPLACE FUNCTION public.taxguard_client_notifications_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (NEW.tenant_id, NEW.client_id, NEW.notification_id, NEW.kind, NEW.request_id, NEW.title, NEW.channel, NEW.delivery_status, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM (OLD.tenant_id, OLD.client_id, OLD.notification_id, OLD.kind, OLD.request_id, OLD.title, OLD.channel, OLD.delivery_status, OLD.created_by, OLD.created_at)
     OR OLD.read_at IS NOT NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_client_notifications_guard ON public.taxguard_client_notifications;
CREATE TRIGGER trg_taxguard_client_notifications_guard BEFORE UPDATE OR DELETE ON public.taxguard_client_notifications
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_client_notifications_guard();

-- ------------------------------------------------------------------------------------------
-- Internal helpers (not executable by any API role)
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_docreq_audit(p_tenant text, p_client text, p_actor text, p_role text, p_action text, p_meta jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, p_action, p_actor, p_role, jsonb_build_object('clientId', p_client) || COALESCE(p_meta, '{}'::jsonb)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_docreq_notify(p_tenant text, p_client text, p_kind text, p_request text, p_title text, p_actor text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_client_notifications(tenant_id, client_id, kind, request_id, title, created_by)
  VALUES (p_tenant, p_client, p_kind, p_request, left(p_title, 300), p_actor) $$;

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
      WHERE l.tenant_id = q.tenant_id AND l.client_id = q.client_id AND l.request_id = q.request_id))
  || CASE WHEN p_staff THEN jsonb_build_object('createdBy', q.created_by, 'templateId', q.template_id, 'resolutionReason', q.resolution_reason,
       'resolvedBy', q.resolved_by, 'lastRemindedAt', q.last_reminded_at) ELSE '{}'::jsonb END $$;

-- Recomputes OPEN / SUBMITTED / FULFILLED from linked documents (WAIVED and CANCELLED are final).
CREATE OR REPLACE FUNCTION public.taxguard_docreq_refresh(p_tenant text, p_client text, p_request text, p_actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE q public.taxguard_doc_requests; verified integer; pending integer; next_status text;
BEGIN
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request FOR UPDATE;
  IF NOT FOUND OR q.status IN ('WAIVED','CANCELLED') THEN RETURN; END IF;
  SELECT count(*) FILTER (WHERE d.status IN ('VERIFIED','SUPERSEDED')), count(*) FILTER (WHERE d.status IN ('UPLOAD_PENDING','SCAN_PENDING','PENDING_REVIEW'))
    INTO verified, pending
    FROM public.taxguard_doc_request_links l JOIN public.taxguard_documents d ON d.tenant_id = l.tenant_id AND d.client_id = l.client_id
      AND d.document_id = l.document_id AND d.version = l.version
    WHERE l.tenant_id = p_tenant AND l.client_id = p_client AND l.request_id = p_request;
  next_status := CASE WHEN verified >= q.min_documents THEN 'FULFILLED' WHEN pending > 0 THEN 'SUBMITTED' ELSE 'OPEN' END;
  IF next_status <> q.status THEN
    UPDATE public.taxguard_doc_requests SET status = next_status, row_version = row_version + 1, updated_at = now(),
        resolved_at = CASE WHEN next_status = 'FULFILLED' THEN now() ELSE NULL END
      WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request;
    PERFORM public.taxguard_docreq_audit(p_tenant, p_client, p_actor, 'system', 'DOC_REQUEST_STATUS_CHANGED',
      jsonb_build_object('requestId', p_request, 'from', q.status, 'to', next_status));
    IF next_status = 'FULFILLED' THEN PERFORM public.taxguard_docreq_notify(p_tenant, p_client, 'REQUEST_FULFILLED', p_request, 'Received: ' || q.title, p_actor); END IF;
  END IF;
END $$;

-- When a linked document changes status (scan, review, supersede), refresh its requests and tell
-- the client when staff ask for a replacement or reject it.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_document_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE l record; t text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  FOR l IN SELECT DISTINCT request_id FROM public.taxguard_doc_request_links WHERE tenant_id = NEW.tenant_id AND client_id = NEW.client_id
      AND document_id = NEW.document_id AND version = NEW.version LOOP
    PERFORM public.taxguard_docreq_refresh(NEW.tenant_id, NEW.client_id, l.request_id, COALESCE(NEW.reviewed_by, 'system'));
    IF NEW.status IN ('REPLACEMENT_REQUESTED','REJECTED') THEN
      SELECT title INTO t FROM public.taxguard_doc_requests WHERE tenant_id = NEW.tenant_id AND client_id = NEW.client_id AND request_id = l.request_id;
      PERFORM public.taxguard_docreq_notify(NEW.tenant_id, NEW.client_id, CASE WHEN NEW.status = 'REJECTED' THEN 'DOCUMENT_REJECTED' ELSE 'REPLACEMENT_REQUESTED' END,
        l.request_id, CASE WHEN NEW.status = 'REJECTED' THEN 'Please upload again: ' ELSE 'Replacement needed: ' END || t, COALESCE(NEW.reviewed_by, 'system'));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_docreq_document_changed ON public.taxguard_documents;
CREATE TRIGGER trg_taxguard_docreq_document_changed AFTER UPDATE OF status ON public.taxguard_documents
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_docreq_document_changed();

-- Creates one request (idempotent on the derived id). Staff other than bookkeepers only.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_insert(p_tenant text, p_client text, p_actor text, p_role text, p_id text, p_req jsonb, p_template text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE q public.taxguard_doc_requests; eng text := p_req->>'engagementId'; yr integer; types text[]; due date; title text := btrim(COALESCE(p_req->>'title', ''));
BEGIN
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_id;
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
  IF NOT FOUND THEN RAISE EXCEPTION 'ENGAGEMENT_YEAR_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;
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

CREATE OR REPLACE FUNCTION public.taxguard_docreq_staff(p_tenant text, p_client text, p_actor text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'client' OR r = 'bookkeeper' THEN RAISE EXCEPTION 'DOC_REQUEST_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  RETURN r;
END $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_docreq_create(p_tenant text, p_client text, p_actor text, p_id text, p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_docreq_staff(p_tenant, p_client, p_actor);
  IF p_id IS NULL OR p_id !~ '^req_[a-f0-9]{32}$' OR p_request IS NULL OR jsonb_typeof(p_request) <> 'object' THEN RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN public.taxguard_docreq_insert(p_tenant, p_client, p_actor, r, p_id, p_request, NULL);
END $$;

-- Firm checklist templates: managers only. Items: [{title, category, required, instructions?, acceptedTypes?, minDocuments?}].
CREATE OR REPLACE FUNCTION public.taxguard_docreq_template_upsert(p_tenant text, p_actor text, p_template jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; tid text := p_template->>'templateId'; item jsonb; existing public.taxguard_docreq_templates;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'DOC_REQUEST_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF tid IS NULL OR tid !~ '^[A-Za-z0-9_-]{3,64}$' OR jsonb_typeof(p_template->'items') <> 'array' OR jsonb_array_length(p_template->'items') NOT BETWEEN 1 AND 100
     OR length(btrim(COALESCE(p_template->>'name', ''))) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_template->'items') LOOP
    IF jsonb_typeof(item) <> 'object' OR length(btrim(COALESCE(item->>'title', ''))) NOT BETWEEN 3 AND 200 OR COALESCE(item->>'category', '') NOT IN
        ('income','deductions','identity','prior_return','business_records','bank_statement','correspondence','engagement','other') THEN
      RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  SELECT * INTO existing FROM public.taxguard_docreq_templates WHERE tenant_id = p_tenant AND template_id = tid FOR UPDATE;
  INSERT INTO public.taxguard_docreq_templates(tenant_id, template_id, name, items, status, updated_by)
    VALUES (p_tenant, tid, btrim(p_template->>'name'), p_template->'items', COALESCE(p_template->>'status', 'ACTIVE'), p_actor)
    ON CONFLICT (tenant_id, template_id) DO UPDATE SET name = EXCLUDED.name, items = EXCLUDED.items, status = EXCLUDED.status,
      version = taxguard_docreq_templates.version + 1, updated_by = p_actor, updated_at = now();
  PERFORM public.taxguard_docreq_audit(p_tenant, '', p_actor, r, 'DOC_REQUEST_TEMPLATE_SAVED',
    jsonb_build_object('templateId', tid, 'items', jsonb_array_length(p_template->'items'), 'previousVersion', existing.version));
  RETURN (SELECT jsonb_build_object('templateId', template_id, 'name', name, 'items', items, 'status', status, 'version', version)
    FROM public.taxguard_docreq_templates WHERE tenant_id = p_tenant AND template_id = tid);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_docreq_template_list(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_practice_actor(p_tenant, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('templateId', template_id, 'name', name, 'items', items, 'status', status, 'version', version) ORDER BY name), '[]'::jsonb)
    FROM public.taxguard_docreq_templates WHERE tenant_id = p_tenant);
END $$;

-- Applies an ACTIVE template to an engagement year; re-applying never duplicates an item.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_apply_template(p_tenant text, p_client text, p_actor text, p_template text, p_engagement text, p_year integer, p_due date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; tpl public.taxguard_docreq_templates; item jsonb; i integer := 0; rid text; created integer := 0; res jsonb; out jsonb := '[]'::jsonb;
BEGIN
  r := public.taxguard_docreq_staff(p_tenant, p_client, p_actor);
  SELECT * INTO tpl FROM public.taxguard_docreq_templates WHERE tenant_id = p_tenant AND template_id = p_template AND status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'DOC_REQUEST_TEMPLATE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(tpl.items) LOOP
    i := i + 1;
    rid := 'req_' || substr(encode(sha256(convert_to(concat_ws('|', p_tenant, p_client, p_engagement, p_year, p_template, i), 'UTF8')), 'hex'), 1, 32);
    res := public.taxguard_docreq_insert(p_tenant, p_client, p_actor, r, rid, item || jsonb_build_object('engagementId', p_engagement, 'taxYear', p_year,
      'dueDate', COALESCE(item->>'dueDate', p_due::text)), p_template);
    IF (res->>'created')::boolean THEN created := created + 1; END IF;
    out := out || jsonb_build_array(res);
  END LOOP;
  RETURN jsonb_build_object('templateId', p_template, 'created', created, 'requests', out);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_docreq_list(p_tenant text, p_client text, p_actor text, p_engagement text, p_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_docreq_json(q, r <> 'client') ORDER BY q.tax_year DESC, q.required DESC, q.due_date NULLS LAST, q.created_at), '[]'::jsonb)
    FROM public.taxguard_doc_requests q WHERE q.tenant_id = p_tenant AND q.client_id = p_client
      AND (p_engagement IS NULL OR q.engagement_id = p_engagement) AND (p_year IS NULL OR q.tax_year = p_year)
      AND (r <> 'client' OR q.status <> 'CANCELLED'));
END $$;

-- Links a vault document version to a request. Clients: own uploads only. The document must belong
-- to the same engagement year, match the request's category and accepted types, and not be
-- infected or rejected.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_link(p_tenant text, p_client text, p_actor text, p_request text, p_document_id text, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_doc_requests; d public.taxguard_documents;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'bookkeeper' THEN RAISE EXCEPTION 'DOC_REQUEST_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request FOR UPDATE;
  IF NOT FOUND OR (r = 'client' AND q.status = 'CANCELLED') THEN RAISE EXCEPTION 'DOC_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

-- Waive (required requests: the engagement year's reviewer or a manager) or cancel (manager).
CREATE OR REPLACE FUNCTION public.taxguard_docreq_resolve(p_tenant text, p_client text, p_actor text, p_request text, p_action text, p_reason text, p_row_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_doc_requests; target text; is_reviewer boolean;
BEGIN
  r := public.taxguard_docreq_staff(p_tenant, p_client, p_actor);
  IF p_action NOT IN ('waive','cancel') OR length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'DOC_REQUEST_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOC_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

-- Staff reminder to the client (in-app outbox), at most one per request per 24 hours.
CREATE OR REPLACE FUNCTION public.taxguard_docreq_remind(p_tenant text, p_client text, p_actor text, p_request text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_doc_requests;
BEGIN
  r := public.taxguard_docreq_staff(p_tenant, p_client, p_actor);
  SELECT * INTO q FROM public.taxguard_doc_requests WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOC_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF q.status NOT IN ('OPEN','SUBMITTED') THEN RAISE EXCEPTION 'DOC_REQUEST_CLOSED' USING ERRCODE = 'P0001'; END IF;
  IF q.last_reminded_at IS NOT NULL AND q.last_reminded_at > now() - interval '24 hours' THEN RAISE EXCEPTION 'DOC_REQUEST_REMINDER_TOO_SOON' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_doc_requests SET last_reminded_at = now(), updated_at = now() WHERE tenant_id = p_tenant AND client_id = p_client AND request_id = p_request;
  PERFORM public.taxguard_docreq_notify(p_tenant, p_client, 'REQUEST_REMINDER', p_request, 'Reminder: ' || q.title, p_actor);
  PERFORM public.taxguard_docreq_audit(p_tenant, p_client, p_actor, r, 'DOC_REQUEST_REMINDED', jsonb_build_object('requestId', p_request));
  RETURN jsonb_build_object('requestId', p_request, 'remindedAt', now(), 'delivery', 'IN_APP_ONLY');
END $$;

-- Missing-document tracking across the clients the actor may see: open or submitted requests,
-- with overdue flags and per engagement-year counts.
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
      ORDER BY (q.due_date IS NOT NULL AND q.due_date < current_date) DESC, q.due_date NULLS LAST, q.created_at LIMIT lim) x),
    'summary', (SELECT COALESCE(jsonb_agg(jsonb_build_object('clientId', s.client_id, 'engagementId', s.engagement_id, 'taxYear', s.tax_year,
        'open', s.open, 'submitted', s.submitted, 'overdue', s.overdue, 'requiredOutstanding', s.required_outstanding) ORDER BY s.client_id, s.tax_year), '[]'::jsonb)
      FROM (SELECT q.client_id, q.engagement_id, q.tax_year, count(*) FILTER (WHERE q.status = 'OPEN') AS open, count(*) FILTER (WHERE q.status = 'SUBMITTED') AS submitted,
          count(*) FILTER (WHERE q.due_date < current_date) AS overdue, count(*) FILTER (WHERE q.required) AS required_outstanding
        FROM public.taxguard_doc_requests q JOIN public.taxguard_clients c ON c.tenant_id = q.tenant_id AND c.client_id = q.client_id AND c.status = 'active'
        WHERE q.tenant_id = p_tenant AND q.status IN ('OPEN','SUBMITTED') AND (yr IS NULL OR q.tax_year = yr) AND public.taxguard_practice_can_see(p_tenant, q.client_id, p_actor, r)
        GROUP BY q.client_id, q.engagement_id, q.tax_year) s));
END $$;

-- Documents submitted against requests and awaiting staff review, with the request they answer.
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
    ORDER BY d.created_at LIMIT p_limit) x);
END $$;

-- Client notification interface: the client reads and acknowledges their own in-app notices;
-- staff with access may view the outbox for the client.
CREATE OR REPLACE FUNCTION public.taxguard_client_notifications_list(p_tenant text, p_client text, p_actor text, p_unread_only boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN jsonb_build_object('unread', (SELECT count(*) FROM public.taxguard_client_notifications WHERE tenant_id = p_tenant AND client_id = p_client AND read_at IS NULL),
    'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object('notificationId', n.notification_id, 'kind', n.kind, 'requestId', n.request_id, 'title', n.title,
        'channel', n.channel, 'deliveryStatus', n.delivery_status, 'createdAt', n.created_at, 'readAt', n.read_at) ORDER BY n.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.taxguard_client_notifications WHERE tenant_id = p_tenant AND client_id = p_client AND (NOT COALESCE(p_unread_only, false) OR read_at IS NULL)
        ORDER BY created_at DESC LIMIT 100) n));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_client_notification_mark_read(p_tenant text, p_client text, p_actor text, p_notification uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r <> 'client' THEN RAISE EXCEPTION 'NOTIFICATION_CLIENT_ONLY' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_client_notifications SET read_at = now() WHERE tenant_id = p_tenant AND client_id = p_client AND notification_id = p_notification AND read_at IS NULL;
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.taxguard_client_notifications WHERE tenant_id = p_tenant AND client_id = p_client AND notification_id = p_notification) THEN
    RAISE EXCEPTION 'NOTIFICATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('notificationId', p_notification, 'read', true);
END $$;

-- Stage 2 / 3 evidence (hook declared by proposal 026): computed facts added to the reviewer's
-- attestation; the attestation cannot complete the stage while any is false.
CREATE OR REPLACE FUNCTION public.taxguard_case_evidence_checks(p_case public.taxguard_cases) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; outstanding boolean; unscanned boolean; unreviewed boolean;
BEGIN
  IF c.active_stage NOT IN (2, 3) THEN RETURN '{}'::jsonb; END IF;
  outstanding := EXISTS (SELECT 1 FROM public.taxguard_doc_requests WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
    AND tax_year = c.tax_year AND required AND status IN ('OPEN','SUBMITTED'));
  unscanned := EXISTS (SELECT 1 FROM public.taxguard_documents WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
    AND tax_year = c.tax_year AND status IN ('UPLOAD_PENDING','SCAN_PENDING'));
  unreviewed := EXISTS (SELECT 1 FROM public.taxguard_documents WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
    AND tax_year = c.tax_year AND status = 'PENDING_REVIEW');
  IF c.active_stage = 2 THEN RETURN jsonb_build_object('requiredDocumentRequestsResolved', NOT outstanding, 'noDocumentsAwaitingScan', NOT unscanned); END IF;
  RETURN jsonb_build_object('requiredDocumentRequestsResolved', NOT outstanding, 'noDocumentsAwaitingReview', NOT unreviewed, 'noDocumentsAwaitingScan', NOT unscanned);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND (p.proname LIKE 'taxguard\_docreq\_%' OR p.proname LIKE 'taxguard\_client\_notification%' OR p.proname = 'taxguard_case_evidence_checks') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_docreq_create','taxguard_docreq_template_upsert','taxguard_docreq_template_list','taxguard_docreq_apply_template','taxguard_docreq_list',
        'taxguard_docreq_link','taxguard_docreq_resolve','taxguard_docreq_remind','taxguard_docreq_missing','taxguard_docreq_review_queue',
        'taxguard_client_notifications_list','taxguard_client_notification_mark_read') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
