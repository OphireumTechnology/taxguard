-- AI-4 minimum gateway admission/accounting only; no production commissioning or authoritative actions.
BEGIN;
-- Unknown accounting must be NULL, not fabricated zero. Existing recorded values are unchanged.
ALTER TABLE ai_runs ALTER COLUMN token_usage DROP NOT NULL, ALTER COLUMN token_usage DROP DEFAULT;
ALTER TABLE ai_runs ALTER COLUMN estimated_cost DROP NOT NULL, ALTER COLUMN estimated_cost DROP DEFAULT;
CREATE TABLE ai_model_pricing (
 pricing_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id text NOT NULL, model_version text NOT NULL,
 version text NOT NULL, status ai_registry_status NOT NULL DEFAULT 'DRAFT', currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 input_nanos_per_token bigint NOT NULL CHECK(input_nanos_per_token>=0), output_nanos_per_token bigint NOT NULL CHECK(output_nanos_per_token>=0),
 input_token_limit integer NOT NULL CHECK(input_token_limit BETWEEN 1 AND 1000000), output_token_limit integer NOT NULL CHECK(output_token_limit BETWEEN 1 AND 4096),
 authority_reference text NOT NULL CHECK(length(btrim(authority_reference))>=10), effective_date timestamptz NOT NULL,
 cost_method text NOT NULL DEFAULT 'CONFIGURED_UPPER_BOUND' CHECK(cost_method='CONFIGURED_UPPER_BOUND'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(model_id,model_version,version),
 FOREIGN KEY(model_id,model_version) REFERENCES ai_models(model_id,model_version)
);
CREATE UNIQUE INDEX ai_gateway_active_pricing ON ai_model_pricing(model_id,model_version) WHERE status='ACTIVE';
CREATE TABLE ai_gateway_admissions (
 run_id uuid PRIMARY KEY REFERENCES ai_runs(run_id), root_id uuid NOT NULL, operation_id uuid NOT NULL UNIQUE,
 tenant_id varchar(128) NOT NULL, actor_uid varchar(128) NOT NULL,
 client_id varchar(64) NOT NULL, tax_case_id varchar(128) NOT NULL, tax_year integer NOT NULL,
 decision_id uuid NOT NULL REFERENCES ai_governance_decisions(decision_id), pricing_id uuid NOT NULL REFERENCES ai_model_pricing(pricing_id),
 binding_hash text NOT NULL CHECK(binding_hash ~ '^[a-f0-9]{64}$'), input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 prompt_hash text NOT NULL CHECK(prompt_hash ~ '^[a-f0-9]{64}$'), schema_hash text NOT NULL CHECK(schema_hash ~ '^[a-f0-9]{64}$'),
 pricing_hash text NOT NULL CHECK(pricing_hash ~ '^[a-f0-9]{64}$'),
 reserved_tokens integer NOT NULL CHECK(reserved_tokens>0), reserved_nanos bigint NOT NULL CHECK(reserved_nanos>=0),
 execution_boundary text NOT NULL DEFAULT 'ISOLATED_TEST_ONLY' CHECK(execution_boundary='ISOLATED_TEST_ONLY'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,tenant_id,actor_uid),
 FOREIGN KEY(root_id,tenant_id,actor_uid) REFERENCES ai_orchestration_roots(root_id,tenant_id,actor_uid),
 FOREIGN KEY(run_id,tenant_id,client_id,tax_case_id,tax_year) REFERENCES ai_runs(run_id,tenant_id,client_id,tax_case_id,tax_year)
);
CREATE TABLE ai_gateway_attempts (
 attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL, tenant_id varchar(128) NOT NULL, actor_uid varchar(128) NOT NULL,
 attempt integer NOT NULL CHECK(attempt BETWEEN 0 AND 2), decision_id uuid NOT NULL REFERENCES ai_governance_decisions(decision_id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,attempt), UNIQUE(run_id,attempt_id),
 FOREIGN KEY(run_id,tenant_id,actor_uid) REFERENCES ai_gateway_admissions(run_id,tenant_id,actor_uid)
);
CREATE TABLE ai_gateway_outcomes (
 outcome_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL, attempt_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('NOT_SENT','ACCEPTED','FAILED','CANCELLED')), terminal boolean NOT NULL,
 transport_state text NOT NULL CHECK(transport_state IN ('NOT_SENT','MAY_HAVE_SENT','RESPONDED')),
 reason_code text NOT NULL CHECK(reason_code ~ '^AI_[A-Z_]+$'),
 usage_state text NOT NULL CHECK(usage_state IN ('KNOWN','UNKNOWN')),
 input_tokens integer CHECK(input_tokens>=0), output_tokens integer CHECK(output_tokens>=0), total_tokens integer CHECK(total_tokens>=0),
 cost_nanos bigint CHECK(cost_nanos>=0), output_hash text CHECK(output_hash ~ '^[a-f0-9]{64}$'), decision_id uuid REFERENCES ai_governance_decisions(decision_id),
 human_review_required boolean NOT NULL DEFAULT true CHECK(human_review_required),
 action_executed boolean NOT NULL DEFAULT false CHECK(NOT action_executed), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(attempt_id), FOREIGN KEY(run_id,attempt_id) REFERENCES ai_gateway_attempts(run_id,attempt_id),
 CHECK((usage_state='UNKNOWN' AND input_tokens IS NULL AND output_tokens IS NULL AND total_tokens IS NULL AND cost_nanos IS NULL) OR
       (usage_state='KNOWN' AND input_tokens IS NOT NULL AND output_tokens IS NOT NULL AND total_tokens IS NOT NULL AND total_tokens=input_tokens+output_tokens AND cost_nanos IS NOT NULL)),
 CHECK(status='NOT_SENT' OR terminal),
 CHECK(status<>'NOT_SENT' OR (transport_state='NOT_SENT' AND usage_state='KNOWN' AND total_tokens=0 AND cost_nanos=0)),
 CHECK(status<>'ACCEPTED' OR (usage_state='KNOWN' AND output_hash IS NOT NULL AND decision_id IS NOT NULL AND transport_state='RESPONDED'))
);
CREATE UNIQUE INDEX ai_gateway_terminal_run ON ai_gateway_outcomes(run_id) WHERE terminal;
CREATE INDEX ai_gateway_budget_scope ON ai_gateway_admissions(tenant_id,pricing_id);

CREATE FUNCTION ai_gateway_validate_link() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r ai_runs; d ai_governance_decisions; p ai_model_pricing; root ai_orchestration_roots; a ai_gateway_admissions;
BEGIN
 SELECT * INTO r FROM ai_runs WHERE run_id=NEW.run_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'AI_GATEWAY_RUN_REQUIRED'; END IF;
 IF TG_TABLE_NAME='ai_gateway_admissions' THEN
   SELECT * INTO root FROM ai_orchestration_roots WHERE root_id=NEW.root_id;
   SELECT * INTO p FROM ai_model_pricing WHERE pricing_id=NEW.pricing_id;
   IF r.requested_by IS DISTINCT FROM NEW.actor_uid OR r.case_record_id IS DISTINCT FROM root.case_record_id OR
      r.workflow_stage IS DISTINCT FROM root.workflow_stage OR p.model_id IS DISTINCT FROM r.model_id OR p.model_version IS DISTINCT FROM r.model_version OR p.status<>'ACTIVE' OR p.effective_date>now() OR
      NEW.reserved_tokens<>(p.input_token_limit+p.output_token_limit) OR NEW.reserved_nanos<>(p.input_token_limit::bigint*p.input_nanos_per_token+p.output_token_limit::bigint*p.output_nanos_per_token) OR
      NOT EXISTS(SELECT 1 FROM ai_orchestration_events e WHERE e.root_id=NEW.root_id AND e.operation_id=NEW.operation_id AND e.agent_id=r.agent_id AND e.status='RUNNING') OR
      EXISTS(SELECT 1 FROM ai_orchestration_events e WHERE e.root_id=NEW.root_id AND e.operation_id IS NULL AND e.status IN ('FAILED','COMPLETED')) THEN
      RAISE EXCEPTION 'AI_GATEWAY_CORRELATION_REQUIRED';
   END IF;
 ELSE
   SELECT * INTO a FROM ai_gateway_admissions WHERE run_id=NEW.run_id;
   IF TG_TABLE_NAME='ai_gateway_attempts' THEN
     IF EXISTS(SELECT 1 FROM ai_gateway_outcomes WHERE run_id=NEW.run_id AND terminal) OR
        NEW.attempt<>(SELECT count(*) FROM ai_gateway_attempts WHERE run_id=NEW.run_id) OR
        (NEW.attempt>0 AND NOT EXISTS(SELECT 1 FROM ai_gateway_attempts t JOIN ai_gateway_outcomes o ON o.attempt_id=t.attempt_id WHERE t.run_id=NEW.run_id AND t.attempt=NEW.attempt-1 AND o.status='NOT_SENT' AND NOT o.terminal)) THEN
       RAISE EXCEPTION 'AI_GATEWAY_ATTEMPT_DENIED';
     END IF;
   ELSIF EXISTS(SELECT 1 FROM ai_gateway_outcomes WHERE run_id=NEW.run_id AND terminal) THEN RAISE EXCEPTION 'AI_GATEWAY_TERMINAL_HISTORY'; END IF;
 END IF;
 IF NEW.decision_id IS NOT NULL THEN
   SELECT * INTO d FROM ai_governance_decisions WHERE decision_id=NEW.decision_id;
   IF d.tenant_id IS DISTINCT FROM r.tenant_id OR d.actor_uid IS DISTINCT FROM r.requested_by OR d.agent_id IS DISTINCT FROM r.agent_id OR
      d.case_record_id IS DISTINCT FROM r.case_record_id OR d.outcome NOT IN ('ADVISORY_ALLOWED','REVIEW_REQUIRED') OR
      (d.policy_snapshot->'stage_permission'->>'stage') IS DISTINCT FROM r.workflow_stage::text THEN
      RAISE EXCEPTION 'AI_GATEWAY_DECISION_DENIED';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION ai_gateway_protect_pricing() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM ai_gateway_admissions WHERE pricing_id=OLD.pricing_id) THEN RAISE EXCEPTION 'AI_PRICING_VERSION_IN_USE'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER ai_model_pricing_guard BEFORE UPDATE OR DELETE ON ai_model_pricing FOR EACH ROW EXECUTE FUNCTION ai_gateway_protect_pricing();
CREATE TRIGGER ai_gateway_admissions_link BEFORE INSERT ON ai_gateway_admissions FOR EACH ROW EXECUTE FUNCTION ai_gateway_validate_link();
CREATE TRIGGER ai_gateway_attempts_link BEFORE INSERT ON ai_gateway_attempts FOR EACH ROW EXECUTE FUNCTION ai_gateway_validate_link();
CREATE TRIGGER ai_gateway_outcomes_link BEFORE INSERT ON ai_gateway_outcomes FOR EACH ROW EXECUTE FUNCTION ai_gateway_validate_link();
CREATE TRIGGER ai_gateway_admissions_immutable BEFORE UPDATE OR DELETE ON ai_gateway_admissions FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_gateway_attempts_immutable BEFORE UPDATE OR DELETE ON ai_gateway_attempts FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_gateway_outcomes_immutable BEFORE UPDATE OR DELETE ON ai_gateway_outcomes FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
ALTER TABLE ai_model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_pricing FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_gateway_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_gateway_admissions FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_gateway_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_gateway_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_gateway_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_gateway_outcomes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_model_pricing,ai_gateway_admissions,ai_gateway_attempts,ai_gateway_outcomes FROM PUBLIC,anon,authenticated;
COMMIT;
