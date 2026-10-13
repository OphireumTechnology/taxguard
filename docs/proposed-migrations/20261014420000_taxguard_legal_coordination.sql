-- PROPOSAL 042 ONLY. NOT APPLIED. Requires the actual core schema and proposals 025 and 027.
-- Durable legal-coordination matters, replacing the in-memory /api/legal store. A/R Tax Services
-- provides tax and accounting services; legal document preparation and representation are handled
-- by independent licensed attorneys. These records only TRACK a coordination with outside counsel:
-- nothing here signs, files, transmits documents to anyone, or gives legal advice.
--
--   * Scope: one (tenant, client), optional engagement of that client. Access: taxguard_doc_actor —
--     client members for their own client, assigned staff and managers.
--   * Categories and statuses are those of the existing product model: estate_trust,
--     operating_agreement, probate_document, court_pleading, power_of_attorney;
--     INTAKE -> REVIEWING -> TRANSMITTED_TO_COUNSEL -> COUNSEL_REVIEW -> COMPLETED, plus CANCELLED
--     (with a reason) from any non-final status. Transitions are staff-only, one step at a time.
--     TRANSMITTED_TO_COUNSEL records that the referral was made outside this system and requires
--     the external attorney and law firm to be recorded first.
--   * Every matter records the statutory disclaimer version acknowledged at intake (required).
--   * Evidence references: scan-clean vault documents of the same tenant and client (document_id,
--     version), never rejected ones; clients only their own uploads. References are append-only.
--   * Versions (optimistic concurrency), idempotency keys, an append-only event history and audit
--     entries (identifiers and statuses only) on every change. Clients never see staff identities.
-- Not decided by the product and therefore NOT implemented: who must approve a referral to outside
-- counsel (maker-checker), retention periods, and any engagement-letter or signature workflow.
-- Rollback (development): drop the taxguard_legal_* functions, triggers and three tables.

CREATE TABLE IF NOT EXISTS public.taxguard_legal_matters (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id),
  matter_id VARCHAR(40) NOT NULL CHECK (matter_id ~ '^lgl_[a-f0-9]{32}$'),
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128),
  category VARCHAR(32) NOT NULL CHECK (category IN ('estate_trust','operating_agreement','probate_document','court_pleading','power_of_attorney')),
  title VARCHAR(200) NOT NULL CHECK (length(btrim(title)) >= 3),
  summary VARCHAR(2000),
  status VARCHAR(32) NOT NULL CHECK (status IN ('INTAKE','REVIEWING','TRANSMITTED_TO_COUNSEL','COUNSEL_REVIEW','COMPLETED','CANCELLED')),
  external_attorney VARCHAR(200),
  law_firm VARCHAR(200),
  attorney_bar_number VARCHAR(64),
  filing_deadline DATE,
  public_record_reference VARCHAR(200),
  disclaimer_version VARCHAR(32) NOT NULL,
  disclaimer_acknowledged_by VARCHAR(128) NOT NULL,
  disclaimer_acknowledged_at TIMESTAMPTZ NOT NULL,
  cancel_reason VARCHAR(500),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by VARCHAR(128) NOT NULL,
  created_by_role VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by VARCHAR(128) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, matter_id),
  CHECK (status <> 'CANCELLED' OR cancel_reason IS NOT NULL),
  CHECK (status NOT IN ('TRANSMITTED_TO_COUNSEL','COUNSEL_REVIEW','COMPLETED') OR (external_attorney IS NOT NULL AND law_firm IS NOT NULL)),
  FOREIGN KEY (tenant_id, client_id, engagement_id) REFERENCES public.taxguard_engagements(tenant_id, client_id, engagement_id)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_legal_client ON public.taxguard_legal_matters(tenant_id, client_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_taxguard_legal_status ON public.taxguard_legal_matters(tenant_id, status, filing_deadline);

CREATE TABLE IF NOT EXISTS public.taxguard_legal_matter_documents (
  tenant_id VARCHAR(128) NOT NULL,
  matter_id VARCHAR(40) NOT NULL,
  document_id VARCHAR(128) NOT NULL,
  document_version INTEGER NOT NULL,
  linked_by VARCHAR(128) NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, matter_id, document_id, document_version),
  FOREIGN KEY (tenant_id, matter_id) REFERENCES public.taxguard_legal_matters(tenant_id, matter_id)
);
CREATE TABLE IF NOT EXISTS public.taxguard_legal_matter_events (
  tenant_id VARCHAR(128) NOT NULL,
  matter_id VARCHAR(40) NOT NULL,
  seq INTEGER NOT NULL CHECK (seq > 0),
  action VARCHAR(40) NOT NULL,
  actor_uid VARCHAR(128) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  request_key VARCHAR(80) NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, matter_id, seq),
  UNIQUE (tenant_id, matter_id, request_key),
  FOREIGN KEY (tenant_id, matter_id) REFERENCES public.taxguard_legal_matters(tenant_id, matter_id)
);
ALTER TABLE public.taxguard_legal_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_legal_matter_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_legal_matter_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_legal_matters, public.taxguard_legal_matter_documents, public.taxguard_legal_matter_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_legal_append_only() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RAISE EXCEPTION 'LEGAL_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_legal_events_append_only ON public.taxguard_legal_matter_events;
CREATE TRIGGER trg_taxguard_legal_events_append_only BEFORE UPDATE OR DELETE ON public.taxguard_legal_matter_events FOR EACH ROW EXECUTE FUNCTION public.taxguard_legal_append_only();
DROP TRIGGER IF EXISTS trg_taxguard_legal_documents_append_only ON public.taxguard_legal_matter_documents;
CREATE TRIGGER trg_taxguard_legal_documents_append_only BEFORE UPDATE OR DELETE ON public.taxguard_legal_matter_documents FOR EACH ROW EXECUTE FUNCTION public.taxguard_legal_append_only();

CREATE OR REPLACE FUNCTION public.taxguard_legal_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'LEGAL_MATTER_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.matter_id IS DISTINCT FROM OLD.matter_id OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.disclaimer_version IS DISTINCT FROM OLD.disclaimer_version
    OR NEW.disclaimer_acknowledged_by IS DISTINCT FROM OLD.disclaimer_acknowledged_by OR NEW.disclaimer_acknowledged_at IS DISTINCT FROM OLD.disclaimer_acknowledged_at
    OR NEW.version <> OLD.version + 1 OR OLD.status IN ('COMPLETED','CANCELLED') THEN
    RAISE EXCEPTION 'LEGAL_MATTER_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_legal_guard ON public.taxguard_legal_matters;
CREATE TRIGGER trg_taxguard_legal_guard BEFORE UPDATE OR DELETE ON public.taxguard_legal_matters FOR EACH ROW EXECUTE FUNCTION public.taxguard_legal_guard();

-- ------------------------------------------------------------------------------------------
-- Internal helpers
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_legal_fail(p_code text) RETURNS void LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RAISE EXCEPTION '%', p_code USING ERRCODE = 'P0001'; END $$;

CREATE OR REPLACE FUNCTION public.taxguard_legal_text(p_value text, p_max integer) RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN RETURN NULL; END IF;
  IF length(btrim(p_value)) > p_max THEN PERFORM public.taxguard_legal_fail('LEGAL_INPUT_INVALID'); END IF;
  RETURN btrim(p_value);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_legal_json(m public.taxguard_legal_matters, p_staff boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('matterId', m.matter_id, 'clientId', m.client_id, 'engagementId', m.engagement_id, 'category', m.category, 'title', m.title,
    'summary', m.summary, 'status', m.status, 'externalAttorney', m.external_attorney, 'lawFirm', m.law_firm, 'attorneyBarNumber', m.attorney_bar_number,
    'filingDeadline', m.filing_deadline, 'publicRecordReference', m.public_record_reference, 'disclaimerVersion', m.disclaimer_version,
    'disclaimerAcknowledgedAt', m.disclaimer_acknowledged_at, 'cancelReason', m.cancel_reason, 'version', m.version, 'createdAt', m.created_at, 'updatedAt', m.updated_at,
    'documents', (SELECT COALESCE(jsonb_agg(jsonb_build_object('documentId', l.document_id, 'version', l.document_version, 'fileName', d.file_name, 'linkedAt', l.linked_at)
        ORDER BY l.linked_at), '[]'::jsonb)
      FROM public.taxguard_legal_matter_documents l LEFT JOIN public.taxguard_documents d ON d.tenant_id = l.tenant_id AND d.client_id = m.client_id
        AND d.document_id = l.document_id AND d.version = l.document_version
      WHERE l.tenant_id = m.tenant_id AND l.matter_id = m.matter_id))
  || CASE WHEN p_staff THEN jsonb_build_object('createdBy', m.created_by, 'createdByRole', m.created_by_role, 'updatedBy', m.updated_by,
    'history', (SELECT COALESCE(jsonb_agg(jsonb_build_object('seq', e.seq, 'action', e.action, 'actorUid', e.actor_uid, 'actorRole', e.actor_role, 'at', e.at, 'changes', e.changes) ORDER BY e.seq), '[]'::jsonb)
      FROM public.taxguard_legal_matter_events e WHERE e.tenant_id = m.tenant_id AND e.matter_id = m.matter_id)) ELSE '{}'::jsonb END $$;

CREATE OR REPLACE FUNCTION public.taxguard_legal_event(m public.taxguard_legal_matters, p_action text, p_actor text, p_role text, p_key text, p_changes jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_legal_matter_events(tenant_id, matter_id, seq, action, actor_uid, actor_role, request_key, changes)
  VALUES (m.tenant_id, m.matter_id, (SELECT COALESCE(max(seq), 0) + 1 FROM public.taxguard_legal_matter_events WHERE tenant_id = m.tenant_id AND matter_id = m.matter_id),
    p_action, p_actor, p_role, p_key, COALESCE(p_changes, '{}'::jsonb));
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (m.tenant_id, 'LEGAL_' || p_action, p_actor, p_role, jsonb_build_object('clientId', m.client_id, 'matterId', m.matter_id, 'status', m.status, 'version', m.version)
    || COALESCE(p_changes, '{}'::jsonb)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_legal_key(p_key text) RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,80}$' THEN PERFORM public.taxguard_legal_fail('IDEMPOTENCY_KEY_REQUIRED'); END IF;
  RETURN p_key;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_legal_staff_actor(p_tenant text, p_client text, p_actor text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r IN ('client','bookkeeper') THEN PERFORM public.taxguard_legal_fail('LEGAL_STAFF_REQUIRED'); END IF;
  RETURN r;
END $$;

-- Locked matter of (tenant, client); a replayed request key is reported through the result flag.
CREATE OR REPLACE FUNCTION public.taxguard_legal_locked(p_tenant text, p_client text, p_id text) RETURNS public.taxguard_legal_matters
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE m public.taxguard_legal_matters;
BEGIN
  IF p_id IS NULL OR p_id !~ '^lgl_[a-f0-9]{32}$' THEN PERFORM public.taxguard_legal_fail('LEGAL_MATTER_NOT_FOUND'); END IF;
  SELECT * INTO m FROM public.taxguard_legal_matters WHERE tenant_id = p_tenant AND client_id = p_client AND matter_id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.taxguard_legal_fail('LEGAL_MATTER_NOT_FOUND'); END IF;
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_legal_replayed(m public.taxguard_legal_matters, p_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.taxguard_legal_matter_events WHERE tenant_id = m.tenant_id AND matter_id = m.matter_id AND request_key = p_key) $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs
-- ------------------------------------------------------------------------------------------
-- Input: {category, title, summary?, engagementId?, filingDeadline?, publicRecordReference?, disclaimerVersion, disclaimerAcknowledged: true}
CREATE OR REPLACE FUNCTION public.taxguard_legal_create(p_tenant text, p_client text, p_actor text, p_id text, p_key text, p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; m public.taxguard_legal_matters; key text; deadline date;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'bookkeeper' THEN PERFORM public.taxguard_legal_fail('LEGAL_STAFF_REQUIRED'); END IF;
  key := public.taxguard_legal_key(p_key);
  IF p_id IS NULL OR p_id !~ '^lgl_[a-f0-9]{32}$' OR p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN PERFORM public.taxguard_legal_fail('LEGAL_INPUT_INVALID'); END IF;
  SELECT * INTO m FROM public.taxguard_legal_matters WHERE tenant_id = p_tenant AND matter_id = p_id;
  IF FOUND THEN
    IF m.client_id <> p_client OR m.created_by <> p_actor OR NOT public.taxguard_legal_replayed(m, key) THEN PERFORM public.taxguard_legal_fail('IDEMPOTENCY_KEY_REUSED'); END IF;
    RETURN public.taxguard_legal_json(m, r <> 'client') || jsonb_build_object('replayed', true);
  END IF;
  IF COALESCE((p_input->>'disclaimerAcknowledged')::boolean, false) IS NOT TRUE OR COALESCE(p_input->>'disclaimerVersion', '') !~ '^[A-Za-z0-9_.-]{1,32}$' THEN
    PERFORM public.taxguard_legal_fail('LEGAL_DISCLAIMER_REQUIRED');
  END IF;
  IF NULLIF(p_input->>'engagementId', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_engagements
      WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_input->>'engagementId') THEN
    PERFORM public.taxguard_legal_fail('LEGAL_SCOPE_MISMATCH');
  END IF;
  BEGIN deadline := NULLIF(p_input->>'filingDeadline', '')::date;
  EXCEPTION WHEN others THEN PERFORM public.taxguard_legal_fail('LEGAL_INPUT_INVALID'); END;
  BEGIN
    INSERT INTO public.taxguard_legal_matters(tenant_id, matter_id, client_id, engagement_id, category, title, summary, status, filing_deadline, public_record_reference,
      disclaimer_version, disclaimer_acknowledged_by, disclaimer_acknowledged_at, created_by, created_by_role, updated_by)
    VALUES (p_tenant, p_id, p_client, NULLIF(p_input->>'engagementId', ''), p_input->>'category', btrim(COALESCE(p_input->>'title', '')),
      public.taxguard_legal_text(p_input->>'summary', 2000), 'INTAKE', deadline, public.taxguard_legal_text(p_input->>'publicRecordReference', 200),
      p_input->>'disclaimerVersion', p_actor, now(), p_actor, r, p_actor) RETURNING * INTO m;
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation OR foreign_key_violation THEN
    PERFORM public.taxguard_legal_fail('LEGAL_INPUT_INVALID');
  END;
  PERFORM public.taxguard_legal_event(m, 'MATTER_OPENED', p_actor, r, key, jsonb_build_object('category', m.category));
  RETURN public.taxguard_legal_json(m, r <> 'client') || jsonb_build_object('replayed', false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_legal_list(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'bookkeeper' THEN PERFORM public.taxguard_legal_fail('LEGAL_STAFF_REQUIRED'); END IF;
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_legal_json(m, r <> 'client') ORDER BY m.updated_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM public.taxguard_legal_matters WHERE tenant_id = p_tenant AND client_id = p_client ORDER BY updated_at DESC LIMIT 200) m);
END $$;

-- Staff edits of descriptive and counsel fields: {title?, summary?, externalAttorney?, lawFirm?, attorneyBarNumber?, filingDeadline?, publicRecordReference?}
CREATE OR REPLACE FUNCTION public.taxguard_legal_update(p_tenant text, p_client text, p_actor text, p_id text, p_version integer, p_key text, p_fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; m public.taxguard_legal_matters; key text; k text; changed text[] := '{}'; deadline date;
BEGIN
  r := public.taxguard_legal_staff_actor(p_tenant, p_client, p_actor);
  key := public.taxguard_legal_key(p_key);
  m := public.taxguard_legal_locked(p_tenant, p_client, p_id);
  IF public.taxguard_legal_replayed(m, key) THEN RETURN public.taxguard_legal_json(m, true) || jsonb_build_object('replayed', true); END IF;
  IF m.version <> p_version THEN PERFORM public.taxguard_legal_fail('LEGAL_VERSION_CONFLICT'); END IF;
  IF m.status IN ('COMPLETED','CANCELLED') THEN PERFORM public.taxguard_legal_fail('LEGAL_MATTER_CLOSED'); END IF;
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' THEN PERFORM public.taxguard_legal_fail('LEGAL_INPUT_INVALID'); END IF;
  FOR k IN SELECT jsonb_object_keys(p_fields) LOOP
    IF k NOT IN ('title','summary','externalAttorney','lawFirm','attorneyBarNumber','filingDeadline','publicRecordReference') THEN PERFORM public.taxguard_legal_fail('LEGAL_FIELD_NOT_EDITABLE'); END IF;
    changed := changed || k;
  END LOOP;
  IF cardinality(changed) = 0 THEN PERFORM public.taxguard_legal_fail('LEGAL_INPUT_INVALID'); END IF;
  BEGIN deadline := CASE WHEN p_fields ? 'filingDeadline' THEN NULLIF(p_fields->>'filingDeadline', '')::date ELSE m.filing_deadline END;
  EXCEPTION WHEN others THEN PERFORM public.taxguard_legal_fail('LEGAL_INPUT_INVALID'); END;
  BEGIN
    UPDATE public.taxguard_legal_matters SET
      title = CASE WHEN p_fields ? 'title' THEN btrim(COALESCE(p_fields->>'title', '')) ELSE title END,
      summary = CASE WHEN p_fields ? 'summary' THEN public.taxguard_legal_text(p_fields->>'summary', 2000) ELSE summary END,
      external_attorney = CASE WHEN p_fields ? 'externalAttorney' THEN public.taxguard_legal_text(p_fields->>'externalAttorney', 200) ELSE external_attorney END,
      law_firm = CASE WHEN p_fields ? 'lawFirm' THEN public.taxguard_legal_text(p_fields->>'lawFirm', 200) ELSE law_firm END,
      attorney_bar_number = CASE WHEN p_fields ? 'attorneyBarNumber' THEN public.taxguard_legal_text(p_fields->>'attorneyBarNumber', 64) ELSE attorney_bar_number END,
      filing_deadline = deadline,
      public_record_reference = CASE WHEN p_fields ? 'publicRecordReference' THEN public.taxguard_legal_text(p_fields->>'publicRecordReference', 200) ELSE public_record_reference END,
      version = version + 1, updated_by = p_actor, updated_at = now()
    WHERE tenant_id = p_tenant AND matter_id = p_id RETURNING * INTO m;
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN PERFORM public.taxguard_legal_fail('LEGAL_INPUT_INVALID');
  END;
  PERFORM public.taxguard_legal_event(m, 'UPDATED', p_actor, r, key, jsonb_build_object('fields', to_jsonb(changed)));
  RETURN public.taxguard_legal_json(m, true) || jsonb_build_object('replayed', false);
END $$;

-- Staff-only status steps: advance (next status in the defined order) or cancel (reason 5-500).
CREATE OR REPLACE FUNCTION public.taxguard_legal_transition(p_tenant text, p_client text, p_actor text, p_id text, p_version integer, p_key text, p_action text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; m public.taxguard_legal_matters; key text; target text; reason text;
BEGIN
  r := public.taxguard_legal_staff_actor(p_tenant, p_client, p_actor);
  key := public.taxguard_legal_key(p_key);
  m := public.taxguard_legal_locked(p_tenant, p_client, p_id);
  IF public.taxguard_legal_replayed(m, key) THEN RETURN public.taxguard_legal_json(m, true) || jsonb_build_object('replayed', true); END IF;
  IF m.version <> p_version THEN PERFORM public.taxguard_legal_fail('LEGAL_VERSION_CONFLICT'); END IF;
  IF m.status IN ('COMPLETED','CANCELLED') THEN PERFORM public.taxguard_legal_fail('LEGAL_MATTER_CLOSED'); END IF;
  IF p_action = 'advance' THEN
    target := CASE m.status WHEN 'INTAKE' THEN 'REVIEWING' WHEN 'REVIEWING' THEN 'TRANSMITTED_TO_COUNSEL' WHEN 'TRANSMITTED_TO_COUNSEL' THEN 'COUNSEL_REVIEW'
      WHEN 'COUNSEL_REVIEW' THEN 'COMPLETED' END;
    IF target = 'TRANSMITTED_TO_COUNSEL' AND (m.external_attorney IS NULL OR m.law_firm IS NULL) THEN PERFORM public.taxguard_legal_fail('LEGAL_COUNSEL_REQUIRED'); END IF;
  ELSIF p_action = 'cancel' THEN
    target := 'CANCELLED'; reason := btrim(COALESCE(p_reason, ''));
    IF length(reason) < 5 OR length(reason) > 500 THEN PERFORM public.taxguard_legal_fail('LEGAL_REASON_REQUIRED'); END IF;
  ELSE PERFORM public.taxguard_legal_fail('LEGAL_INPUT_INVALID');
  END IF;
  UPDATE public.taxguard_legal_matters SET status = target, cancel_reason = CASE WHEN target = 'CANCELLED' THEN reason ELSE cancel_reason END,
    version = version + 1, updated_by = p_actor, updated_at = now()
  WHERE tenant_id = p_tenant AND matter_id = p_id RETURNING * INTO m;
  PERFORM public.taxguard_legal_event(m, CASE WHEN target = 'CANCELLED' THEN 'CANCELLED' ELSE 'STATUS_' || target END, p_actor, r, key, '{}'::jsonb);
  RETURN public.taxguard_legal_json(m, true) || jsonb_build_object('replayed', false);
END $$;

-- Evidence reference to a vault document version of the same client. Clients: their own uploads only.
CREATE OR REPLACE FUNCTION public.taxguard_legal_link_document(p_tenant text, p_client text, p_actor text, p_id text, p_document text, p_document_version integer, p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; m public.taxguard_legal_matters; key text; d record;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'bookkeeper' THEN PERFORM public.taxguard_legal_fail('LEGAL_STAFF_REQUIRED'); END IF;
  key := public.taxguard_legal_key(p_key);
  m := public.taxguard_legal_locked(p_tenant, p_client, p_id);
  IF public.taxguard_legal_replayed(m, key) THEN RETURN public.taxguard_legal_json(m, r <> 'client') || jsonb_build_object('replayed', true); END IF;
  IF m.status IN ('COMPLETED','CANCELLED') THEN PERFORM public.taxguard_legal_fail('LEGAL_MATTER_CLOSED'); END IF;
  SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = p_document AND version = p_document_version;
  IF NOT FOUND THEN PERFORM public.taxguard_legal_fail('LEGAL_DOCUMENT_NOT_FOUND'); END IF;
  IF d.quarantine_status <> 'CLEAN' OR d.status IN ('REJECTED','REJECTED_MALWARE') OR (r = 'client' AND d.created_by IS DISTINCT FROM p_actor) THEN PERFORM public.taxguard_legal_fail('LEGAL_DOCUMENT_NOT_ELIGIBLE'); END IF;
  INSERT INTO public.taxguard_legal_matter_documents(tenant_id, matter_id, document_id, document_version, linked_by) VALUES (p_tenant, p_id, p_document, p_document_version, p_actor)
    ON CONFLICT DO NOTHING;
  UPDATE public.taxguard_legal_matters SET version = version + 1, updated_by = p_actor, updated_at = now() WHERE tenant_id = p_tenant AND matter_id = p_id RETURNING * INTO m;
  PERFORM public.taxguard_legal_event(m, 'DOCUMENT_LINKED', p_actor, r, key, jsonb_build_object('documentId', p_document, 'documentVersion', p_document_version));
  RETURN public.taxguard_legal_json(m, r <> 'client') || jsonb_build_object('replayed', false);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_legal\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_legal_create','taxguard_legal_list','taxguard_legal_update','taxguard_legal_transition','taxguard_legal_link_document') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
