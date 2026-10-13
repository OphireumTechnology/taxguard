-- PROPOSAL 029 ONLY. NOT APPLIED. Requires the actual core schema and proposals 024 (ledger),
-- 025, 026 (cases) and 027 (documents).
-- Durable book-to-tax: firm-defined tax categories, versioned account-to-category mappings per
-- client and tax year, reviewable adjustments, and reconciled workpaper snapshots.
--
-- TaxGuard computes NO tax. Categories are the firm's own workpaper groupings (with an optional
-- reference text); no IRS form line, rate or rule is asserted here. Book amounts are posted
-- ledger activity (debits minus credits, in cents) for the tax year; "tax basis" in a
-- workpaper is simply book + approved adjustments, presented for professional review.
--
-- Maker-checker: mapping sets, adjustments and workpapers are approved by a reviewer-role user
-- different from their preparer. A workpaper can be approved only when every account with
-- posted activity is mapped and category totals plus unmapped activity equal the ledger.
-- Rollback (development): drop taxguard_b2t_* functions and the five tables.

CREATE TABLE IF NOT EXISTS public.taxguard_b2t_categories (
  tenant_id VARCHAR(128) NOT NULL, category_code VARCHAR(48) NOT NULL CHECK (category_code ~ '^[A-Z0-9_]{2,48}$'),
  return_family VARCHAR(8) NOT NULL CHECK (return_family IN ('1040','1041','1065','1120','1120S','990','706','709')),
  label VARCHAR(160) NOT NULL, reference_text VARCHAR(255), is_active BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, return_family, category_code)
);
CREATE TABLE IF NOT EXISTS public.taxguard_b2t_mapping_sets (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL, set_id UUID NOT NULL DEFAULT gen_random_uuid(),
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100), return_family VARCHAR(8) NOT NULL, version INTEGER NOT NULL CHECK (version > 0),
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED','SUPERSEDED')),
  prepared_by VARCHAR(128) NOT NULL, reviewed_by VARCHAR(128), reviewed_at TIMESTAMPTZ, review_note VARCHAR(500), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, set_id), UNIQUE (tenant_id, client_id, tax_year, return_family, version),
  CHECK (reviewed_by IS NULL OR reviewed_by <> prepared_by),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_b2t_one_approved_set ON public.taxguard_b2t_mapping_sets(tenant_id, client_id, tax_year, return_family) WHERE status = 'APPROVED';
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_b2t_one_open_set ON public.taxguard_b2t_mapping_sets(tenant_id, client_id, tax_year, return_family) WHERE status IN ('DRAFT','PENDING_REVIEW');
CREATE TABLE IF NOT EXISTS public.taxguard_b2t_mappings (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL, set_id UUID NOT NULL, account_id VARCHAR(160) NOT NULL,
  return_family VARCHAR(8) NOT NULL, category_code VARCHAR(48) NOT NULL,
  PRIMARY KEY (tenant_id, client_id, set_id, account_id),
  FOREIGN KEY (tenant_id, client_id, set_id) REFERENCES public.taxguard_b2t_mapping_sets(tenant_id, client_id, set_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id, account_id) REFERENCES public.taxguard_ledger_accounts(tenant_id, client_id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, return_family, category_code) REFERENCES public.taxguard_b2t_categories(tenant_id, return_family, category_code) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.taxguard_b2t_adjustments (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL, adjustment_id UUID NOT NULL DEFAULT gen_random_uuid(),
  tax_year INTEGER NOT NULL, return_family VARCHAR(8) NOT NULL, category_code VARCHAR(48) NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents <> 0), adjustment_type VARCHAR(16) NOT NULL CHECK (adjustment_type IN ('PERMANENT','TIMING','RECLASSIFICATION')),
  description VARCHAR(500) NOT NULL, evidence_document_id VARCHAR(128),
  status VARCHAR(16) NOT NULL DEFAULT 'PREPARED' CHECK (status IN ('PREPARED','APPROVED','REJECTED')),
  prepared_by VARCHAR(128) NOT NULL, reviewed_by VARCHAR(128), reviewed_at TIMESTAMPTZ, review_note VARCHAR(500), idempotency_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, adjustment_id), UNIQUE (tenant_id, client_id, idempotency_key),
  CHECK (reviewed_by IS NULL OR reviewed_by <> prepared_by),
  FOREIGN KEY (tenant_id, return_family, category_code) REFERENCES public.taxguard_b2t_categories(tenant_id, return_family, category_code) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.taxguard_b2t_workpapers (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL, workpaper_id UUID NOT NULL DEFAULT gen_random_uuid(),
  tax_year INTEGER NOT NULL, return_family VARCHAR(8) NOT NULL, set_id UUID NOT NULL, case_id VARCHAR(128),
  snapshot JSONB NOT NULL, snapshot_sha256 CHAR(64) NOT NULL, reconciled BOOLEAN NOT NULL, unmapped_accounts INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','REJECTED','SUPERSEDED')),
  generated_by VARCHAR(128) NOT NULL, reviewed_by VARCHAR(128), reviewed_at TIMESTAMPTZ, review_note VARCHAR(500), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, workpaper_id), CHECK (reviewed_by IS NULL OR reviewed_by <> generated_by),
  FOREIGN KEY (tenant_id, client_id, set_id) REFERENCES public.taxguard_b2t_mapping_sets(tenant_id, client_id, set_id) ON DELETE RESTRICT
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_b2t_categories','taxguard_b2t_mapping_sets','taxguard_b2t_mappings','taxguard_b2t_adjustments','taxguard_b2t_workpapers'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
-- Approved mappings and workpaper snapshots are frozen.
CREATE OR REPLACE FUNCTION public.taxguard_b2t_mappings_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE st text;
BEGIN
  SELECT status INTO st FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) AND client_id = COALESCE(NEW.client_id, OLD.client_id)
    AND set_id = COALESCE(NEW.set_id, OLD.set_id);
  IF st IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'MAPPING_SET_NOT_EDITABLE' USING ERRCODE = 'P0001'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_b2t_mappings_guard ON public.taxguard_b2t_mappings;
CREATE TRIGGER trg_taxguard_b2t_mappings_guard BEFORE INSERT OR UPDATE OR DELETE ON public.taxguard_b2t_mappings FOR EACH ROW EXECUTE FUNCTION public.taxguard_b2t_mappings_guard();
CREATE OR REPLACE FUNCTION public.taxguard_b2t_workpaper_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (NEW.snapshot, NEW.snapshot_sha256, NEW.set_id, NEW.tax_year) IS DISTINCT FROM (OLD.snapshot, OLD.snapshot_sha256, OLD.set_id, OLD.tax_year) THEN
    RAISE EXCEPTION 'WORKPAPER_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_b2t_workpaper_guard ON public.taxguard_b2t_workpapers;
CREATE TRIGGER trg_taxguard_b2t_workpaper_guard BEFORE UPDATE OR DELETE ON public.taxguard_b2t_workpapers FOR EACH ROW EXECUTE FUNCTION public.taxguard_b2t_workpaper_guard();

-- ------------------------------------------------------------------------------------------
-- Helpers (internal)
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_b2t_audit(p_tenant text, p_client text, p_actor text, p_role text, p_action text, p_meta jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, p_action, p_actor, p_role, jsonb_build_object('clientId', p_client) || COALESCE(p_meta, '{}'::jsonb)) $$;
CREATE OR REPLACE FUNCTION public.taxguard_b2t_family(p text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p IS NULL OR p NOT IN ('1040','1041','1065','1120','1120S','990','706','709') THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN p;
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_b2t_set_json(s public.taxguard_b2t_mapping_sets) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('setId', s.set_id, 'taxYear', s.tax_year, 'returnFamily', s.return_family, 'version', s.version, 'status', s.status, 'preparedBy', s.prepared_by,
    'reviewedBy', s.reviewed_by, 'reviewNote', s.review_note, 'createdAt', s.created_at,
    'mappings', (SELECT COALESCE(jsonb_agg(jsonb_build_object('accountId', m.account_id, 'accountNumber', a.account_number, 'accountName', a.account_name, 'categoryCode', m.category_code)
      ORDER BY a.account_number), '[]'::jsonb) FROM public.taxguard_b2t_mappings m JOIN public.taxguard_ledger_accounts a ON a.tenant_id = m.tenant_id AND a.client_id = m.client_id AND a.account_id = m.account_id
      WHERE m.tenant_id = s.tenant_id AND m.client_id = s.client_id AND m.set_id = s.set_id)) $$;

-- ------------------------------------------------------------------------------------------
-- Categories (managers)
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_b2t_upsert_category(p_tenant text, p_actor text, p_family text, p_code text, p_label text, p_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'B2T_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_b2t_family(p_family);
  IF p_code IS NULL OR p_code !~ '^[A-Z0-9_]{2,48}$' OR length(btrim(COALESCE(p_label, ''))) NOT BETWEEN 2 AND 160 OR length(COALESCE(p_reference, '')) > 255 THEN
    RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.taxguard_b2t_categories(tenant_id, category_code, return_family, label, reference_text, created_by)
    VALUES (p_tenant, p_code, p_family, btrim(p_label), NULLIF(btrim(COALESCE(p_reference, '')), ''), p_actor)
    ON CONFLICT (tenant_id, return_family, category_code) DO UPDATE SET label = EXCLUDED.label, reference_text = EXCLUDED.reference_text, is_active = true;
  PERFORM public.taxguard_b2t_audit(p_tenant, NULL, p_actor, r, 'B2T_CATEGORY_SAVED', jsonb_build_object('returnFamily', p_family, 'categoryCode', p_code));
  RETURN jsonb_build_object('categoryCode', p_code, 'returnFamily', p_family);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_b2t_categories_list(p_tenant text, p_actor text, p_family text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('categoryCode', category_code, 'label', label, 'referenceText', reference_text, 'isActive', is_active) ORDER BY category_code), '[]'::jsonb)
    FROM public.taxguard_b2t_categories WHERE tenant_id = p_tenant AND return_family = public.taxguard_b2t_family(p_family));
END $$;

-- ------------------------------------------------------------------------------------------
-- Mapping sets
-- ------------------------------------------------------------------------------------------
-- Opens a new DRAFT version, copying the latest approved mappings (if any).
CREATE OR REPLACE FUNCTION public.taxguard_b2t_open_set(p_tenant text, p_client text, p_actor text, p_year integer, p_family text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; v integer; prior uuid; sid uuid; s public.taxguard_b2t_mapping_sets;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_b2t_family(p_family);
  IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year AND return_family = p_family AND status IN ('DRAFT','PENDING_REVIEW');
  IF FOUND THEN RETURN public.taxguard_b2t_set_json(s); END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year AND return_family = p_family;
  SELECT set_id INTO prior FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year AND return_family = p_family AND status = 'APPROVED';
  BEGIN
    INSERT INTO public.taxguard_b2t_mapping_sets(tenant_id, client_id, tax_year, return_family, version, prepared_by) VALUES (p_tenant, p_client, p_year, p_family, v, p_actor) RETURNING set_id INTO sid;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'B2T_CONCURRENT_UPDATE' USING ERRCODE = 'P0001';
  END;
  IF prior IS NOT NULL THEN
    INSERT INTO public.taxguard_b2t_mappings(tenant_id, client_id, set_id, account_id, return_family, category_code)
      SELECT tenant_id, client_id, sid, account_id, return_family, category_code FROM public.taxguard_b2t_mappings WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = prior;
  END IF;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, 'B2T_MAPPING_SET_OPENED', jsonb_build_object('setId', sid, 'taxYear', p_year, 'version', v));
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = sid;
  RETURN public.taxguard_b2t_set_json(s);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_b2t_set_mapping(p_tenant text, p_client text, p_actor text, p_set uuid, p_account text, p_category text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_b2t_mapping_sets;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = p_set FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAPPING_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF s.status <> 'DRAFT' THEN RAISE EXCEPTION 'MAPPING_SET_NOT_EDITABLE' USING ERRCODE = 'P0001'; END IF;
  IF p_category IS NULL THEN
    DELETE FROM public.taxguard_b2t_mappings WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = p_set AND account_id = p_account;
  ELSE
    PERFORM 1 FROM public.taxguard_b2t_categories WHERE tenant_id = p_tenant AND return_family = s.return_family AND category_code = p_category AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'CATEGORY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    PERFORM 1 FROM public.taxguard_ledger_accounts WHERE tenant_id = p_tenant AND client_id = p_client AND account_id = p_account;
    IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO public.taxguard_b2t_mappings(tenant_id, client_id, set_id, account_id, return_family, category_code) VALUES (p_tenant, p_client, p_set, p_account, s.return_family, p_category)
      ON CONFLICT (tenant_id, client_id, set_id, account_id) DO UPDATE SET category_code = EXCLUDED.category_code;
  END IF;
  RETURN public.taxguard_b2t_set_json(s);
END $$;

-- submit (preparer) / approve | reject (a different reviewer-role user). Approval supersedes the prior approved set.
CREATE OR REPLACE FUNCTION public.taxguard_b2t_review_set(p_tenant text, p_client text, p_actor text, p_set uuid, p_action text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_b2t_mapping_sets; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = p_set FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAPPING_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_action = 'submit' THEN
    IF s.status <> 'DRAFT' THEN RAISE EXCEPTION 'B2T_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.taxguard_b2t_mapping_sets SET status = 'PENDING_REVIEW' WHERE set_id = s.set_id AND tenant_id = p_tenant;
  ELSIF p_action IN ('approve','reject') THEN
    IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'B2T_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF s.status <> 'PENDING_REVIEW' THEN RAISE EXCEPTION 'B2T_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF s.prepared_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'reject' AND (note IS NULL OR length(note) NOT BETWEEN 5 AND 500) THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'approve' THEN
      UPDATE public.taxguard_b2t_mapping_sets SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = s.tax_year AND return_family = s.return_family AND status = 'APPROVED';
    END IF;
    UPDATE public.taxguard_b2t_mapping_sets SET status = CASE WHEN p_action = 'approve' THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(), review_note = note
      WHERE set_id = s.set_id AND tenant_id = p_tenant;
  ELSE RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, 'B2T_MAPPING_SET_' || upper(p_action), jsonb_build_object('setId', s.set_id, 'version', s.version));
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = p_set;
  RETURN public.taxguard_b2t_set_json(s);
END $$;

-- ------------------------------------------------------------------------------------------
-- Adjustments
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_b2t_prepare_adjustment(p_tenant text, p_client text, p_actor text, p_key text, p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; fam text; yr integer; amt bigint; existing record; id uuid; doc text;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' OR p_body IS NULL OR jsonb_typeof(p_body) <> 'object' OR jsonb_typeof(p_body->'amountCents') <> 'number' THEN
    RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO existing FROM public.taxguard_b2t_adjustments WHERE tenant_id = p_tenant AND client_id = p_client AND idempotency_key = p_key;
  IF FOUND THEN RETURN jsonb_build_object('adjustmentId', existing.adjustment_id, 'replayed', true); END IF;
  fam := public.taxguard_b2t_family(p_body->>'returnFamily');
  BEGIN yr := (p_body->>'taxYear')::integer; amt := (p_body->>'amountCents')::bigint; EXCEPTION WHEN others THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  IF (p_body->>'amountCents')::numeric <> amt OR amt = 0 OR abs(amt) > 100000000000000 OR length(btrim(COALESCE(p_body->>'description', ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  doc := NULLIF(p_body->>'evidenceDocumentId', '');
  -- Evidence, when cited, must be a verified document of the same client.
  IF doc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_documents WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = doc AND status = 'VERIFIED'
      AND quarantine_status = 'CLEAN') THEN
    RAISE EXCEPTION 'EVIDENCE_DOCUMENT_NOT_VERIFIED' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    INSERT INTO public.taxguard_b2t_adjustments(tenant_id, client_id, tax_year, return_family, category_code, amount_cents, adjustment_type, description, evidence_document_id, prepared_by, idempotency_key)
      VALUES (p_tenant, p_client, yr, fam, p_body->>'categoryCode', amt, p_body->>'adjustmentType', btrim(p_body->>'description'), doc, p_actor, p_key) RETURNING adjustment_id INTO id;
  EXCEPTION WHEN foreign_key_violation THEN RAISE EXCEPTION 'CATEGORY_NOT_FOUND' USING ERRCODE = 'P0001';
    WHEN check_violation THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, 'B2T_ADJUSTMENT_PREPARED', jsonb_build_object('adjustmentId', id, 'categoryCode', p_body->>'categoryCode'));
  RETURN jsonb_build_object('adjustmentId', id, 'replayed', false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_b2t_review_adjustment(p_tenant text, p_client text, p_actor text, p_adjustment uuid, p_approve boolean, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; a record; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'B2T_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO a FROM public.taxguard_b2t_adjustments WHERE tenant_id = p_tenant AND client_id = p_client AND adjustment_id = p_adjustment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADJUSTMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF a.status <> 'PREPARED' THEN RAISE EXCEPTION 'B2T_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF a.prepared_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF NOT p_approve AND (note IS NULL OR length(note) NOT BETWEEN 5 AND 500) THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_b2t_adjustments SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(), review_note = note
    WHERE tenant_id = p_tenant AND client_id = p_client AND adjustment_id = p_adjustment;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, CASE WHEN p_approve THEN 'B2T_ADJUSTMENT_APPROVED' ELSE 'B2T_ADJUSTMENT_REJECTED' END, jsonb_build_object('adjustmentId', p_adjustment));
  RETURN jsonb_build_object('adjustmentId', p_adjustment, 'status', CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END);
END $$;

-- ------------------------------------------------------------------------------------------
-- Workpapers
-- ------------------------------------------------------------------------------------------
-- Snapshot from posted ledger activity in the tax year, the approved mapping set and approved
-- adjustments. Reconciliation: sum(category book) + unmapped activity = total posted activity.
CREATE OR REPLACE FUNCTION public.taxguard_b2t_generate_workpaper(p_tenant text, p_client text, p_actor text, p_year integer, p_family text, p_case text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_b2t_mapping_sets; snap jsonb; total bigint; mapped bigint; unmapped_amt bigint; unmapped_n integer; id uuid; recon boolean;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_b2t_family(p_family);
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year AND return_family = p_family AND status = 'APPROVED';
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVED_MAPPING_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_case IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND case_id = p_case AND tax_year = p_year) THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  WITH activity AS (
    SELECT l.account_id, sum(l.debit_cents - l.credit_cents) AS net FROM public.taxguard_ledger_lines l
      JOIN public.taxguard_ledger_entries e ON e.tenant_id = l.tenant_id AND e.client_id = l.client_id AND e.entry_id = l.entry_id
      WHERE l.tenant_id = p_tenant AND l.client_id = p_client AND e.status = 'POSTED' AND e.posting_date BETWEEN make_date(p_year, 1, 1) AND make_date(p_year, 12, 31)
      GROUP BY l.account_id),
  mapped_rows AS (SELECT m.category_code, a.account_id, a.net FROM activity a JOIN public.taxguard_b2t_mappings m ON m.tenant_id = p_tenant AND m.client_id = p_client AND m.set_id = s.set_id AND m.account_id = a.account_id),
  adj AS (SELECT category_code, sum(amount_cents) AS amt FROM public.taxguard_b2t_adjustments WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year
      AND return_family = p_family AND status = 'APPROVED' GROUP BY category_code),
  cats AS (SELECT c.category_code, c.label, c.reference_text, COALESCE((SELECT sum(net) FROM mapped_rows mr WHERE mr.category_code = c.category_code), 0) AS book,
      COALESCE((SELECT amt FROM adj WHERE adj.category_code = c.category_code), 0) AS adjustments
    FROM public.taxguard_b2t_categories c WHERE c.tenant_id = p_tenant AND c.return_family = p_family)
  SELECT jsonb_build_object('categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('categoryCode', category_code, 'label', label, 'referenceText', reference_text,
        'bookCents', book, 'adjustmentCents', adjustments, 'taxBasisCents', book + adjustments) ORDER BY category_code) FROM cats WHERE book <> 0 OR adjustments <> 0), '[]'::jsonb),
      'unmapped', COALESCE((SELECT jsonb_agg(jsonb_build_object('accountId', a.account_id, 'accountNumber', la.account_number, 'accountName', la.account_name, 'netCents', a.net) ORDER BY la.account_number)
        FROM activity a JOIN public.taxguard_ledger_accounts la ON la.tenant_id = p_tenant AND la.client_id = p_client AND la.account_id = a.account_id
        WHERE a.net <> 0 AND NOT EXISTS (SELECT 1 FROM mapped_rows mr WHERE mr.account_id = a.account_id)), '[]'::jsonb)),
    COALESCE((SELECT sum(net) FROM activity), 0), COALESCE((SELECT sum(net) FROM mapped_rows), 0)
    INTO snap, total, mapped;
  SELECT COALESCE(sum((u->>'netCents')::bigint), 0), count(*) INTO unmapped_amt, unmapped_n FROM jsonb_array_elements(snap->'unmapped') u;
  recon := mapped + unmapped_amt = total;
  snap := snap || jsonb_build_object('taxYear', p_year, 'returnFamily', p_family, 'mappingSetId', s.set_id, 'mappingVersion', s.version,
    'reconciliation', jsonb_build_object('ledgerActivityCents', total, 'mappedCents', mapped, 'unmappedCents', unmapped_amt, 'differenceCents', total - mapped - unmapped_amt),
    'notice', 'Workpaper groupings and adjustments for professional review. TaxGuard computes no tax and asserts no form line or rule.');
  INSERT INTO public.taxguard_b2t_workpapers(tenant_id, client_id, tax_year, return_family, set_id, case_id, snapshot, snapshot_sha256, reconciled, unmapped_accounts, generated_by)
    VALUES (p_tenant, p_client, p_year, p_family, s.set_id, p_case, snap, encode(sha256(convert_to(snap::text, 'UTF8')), 'hex'), recon, unmapped_n, p_actor) RETURNING workpaper_id INTO id;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, 'B2T_WORKPAPER_GENERATED', jsonb_build_object('workpaperId', id, 'taxYear', p_year, 'caseId', p_case));
  RETURN jsonb_build_object('workpaperId', id, 'reconciled', recon, 'unmappedAccounts', unmapped_n, 'snapshot', snap);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_b2t_review_workpaper(p_tenant text, p_client text, p_actor text, p_workpaper uuid, p_approve boolean, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; w record; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'B2T_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO w FROM public.taxguard_b2t_workpapers WHERE tenant_id = p_tenant AND client_id = p_client AND workpaper_id = p_workpaper FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WORKPAPER_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF w.status <> 'DRAFT' THEN RAISE EXCEPTION 'B2T_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF w.generated_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF p_approve AND (NOT w.reconciled OR w.unmapped_accounts > 0) THEN RAISE EXCEPTION 'WORKPAPER_NOT_RECONCILED' USING ERRCODE = 'P0001'; END IF;
  IF NOT p_approve AND (note IS NULL OR length(note) NOT BETWEEN 5 AND 500) THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  -- The mapping set must still be the approved one (a newer approval makes this workpaper stale).
  IF p_approve AND NOT EXISTS (SELECT 1 FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = w.set_id AND status = 'APPROVED') THEN
    RAISE EXCEPTION 'WORKPAPER_STALE' USING ERRCODE = 'P0001';
  END IF;
  IF p_approve THEN
    UPDATE public.taxguard_b2t_workpapers SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = w.tax_year AND return_family = w.return_family AND status = 'APPROVED';
  END IF;
  UPDATE public.taxguard_b2t_workpapers SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(), review_note = note
    WHERE tenant_id = p_tenant AND client_id = p_client AND workpaper_id = p_workpaper;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, CASE WHEN p_approve THEN 'B2T_WORKPAPER_APPROVED' ELSE 'B2T_WORKPAPER_REJECTED' END, jsonb_build_object('workpaperId', p_workpaper));
  RETURN jsonb_build_object('workpaperId', p_workpaper, 'status', CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_b2t_overview(p_tenant text, p_client text, p_actor text, p_year integer, p_family text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_b2t_family(p_family);
  RETURN jsonb_build_object(
    'mappingSets', (SELECT COALESCE(jsonb_agg(public.taxguard_b2t_set_json(s) ORDER BY s.version DESC), '[]'::jsonb) FROM public.taxguard_b2t_mapping_sets s
      WHERE s.tenant_id = p_tenant AND s.client_id = p_client AND s.tax_year = p_year AND s.return_family = p_family),
    'adjustments', (SELECT COALESCE(jsonb_agg(jsonb_build_object('adjustmentId', a.adjustment_id, 'categoryCode', a.category_code, 'amountCents', a.amount_cents, 'adjustmentType', a.adjustment_type,
        'description', a.description, 'evidenceDocumentId', a.evidence_document_id, 'status', a.status, 'preparedBy', a.prepared_by, 'reviewedBy', a.reviewed_by, 'reviewNote', a.review_note)
        ORDER BY a.created_at), '[]'::jsonb) FROM public.taxguard_b2t_adjustments a WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.tax_year = p_year AND a.return_family = p_family),
    'workpapers', (SELECT COALESCE(jsonb_agg(jsonb_build_object('workpaperId', w.workpaper_id, 'status', w.status, 'reconciled', w.reconciled, 'unmappedAccounts', w.unmapped_accounts,
        'caseId', w.case_id, 'generatedBy', w.generated_by, 'reviewedBy', w.reviewed_by, 'snapshotSha256', w.snapshot_sha256, 'snapshot', w.snapshot, 'createdAt', w.created_at) ORDER BY w.created_at DESC), '[]'::jsonb)
      FROM public.taxguard_b2t_workpapers w WHERE w.tenant_id = p_tenant AND w.client_id = p_client AND w.tax_year = p_year AND w.return_family = p_family));
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_b2t\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_b2t_upsert_category','taxguard_b2t_categories_list','taxguard_b2t_open_set','taxguard_b2t_set_mapping','taxguard_b2t_review_set',
        'taxguard_b2t_prepare_adjustment','taxguard_b2t_review_adjustment','taxguard_b2t_generate_workpaper','taxguard_b2t_review_workpaper','taxguard_b2t_overview') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
