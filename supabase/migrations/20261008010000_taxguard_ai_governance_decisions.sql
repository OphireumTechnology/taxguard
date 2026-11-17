-- AI-2 governance decisions only. No agent activation or authoritative execution.
BEGIN;
CREATE TABLE ai_governance_decisions (
 decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id varchar(128) NOT NULL REFERENCES taxguard_tenants(id), actor_uid varchar(128) NOT NULL,
 request_key text NOT NULL CHECK(request_key ~ '^[a-f0-9]{64}$'), input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 policy_hash text CHECK(policy_hash ~ '^[a-f0-9]{64}$'), policy_snapshot jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(policy_snapshot)='object'),
 agent_id text REFERENCES ai_agents(agent_id), case_record_id uuid REFERENCES taxguard_cases(id),
 client_id varchar(64), tax_case_id varchar(128), tax_year integer,
 outcome text NOT NULL CHECK(outcome IN ('ADVISORY_ALLOWED','REVIEW_REQUIRED','DENIED')),
 reason_code text NOT NULL CHECK(reason_code ~ '^AI_[A-Z_]+$|^ADVISORY_ALLOWED$|^REVIEW_REQUIRED$'),
 action_state text NOT NULL CHECK(action_state IN ('ADVISORY_ONLY','PROPOSED_ACTION','BLOCKED')),
 human_review_required boolean NOT NULL DEFAULT true CHECK(human_review_required),
 action_executed boolean NOT NULL DEFAULT false CHECK(NOT action_executed),
 replay_of uuid REFERENCES ai_governance_decisions(decision_id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(decision_id,tenant_id,actor_uid,request_key),
 FOREIGN KEY(replay_of,tenant_id,actor_uid,request_key) REFERENCES ai_governance_decisions(decision_id,tenant_id,actor_uid,request_key),
 FOREIGN KEY(tenant_id,actor_uid) REFERENCES taxguard_members(tenant_id,uid),
 CHECK(outcome='DENIED' OR (policy_hash IS NOT NULL AND case_record_id IS NOT NULL AND agent_id IS NOT NULL)),
 CHECK((case_record_id IS NULL AND client_id IS NULL AND tax_case_id IS NULL AND tax_year IS NULL)
 OR (case_record_id IS NOT NULL AND client_id IS NOT NULL AND tax_case_id IS NOT NULL AND tax_year IS NOT NULL))
);
CREATE UNIQUE INDEX ai_governance_initial_request ON ai_governance_decisions(tenant_id,actor_uid,request_key) WHERE replay_of IS NULL;
CREATE INDEX ai_governance_history_scope ON ai_governance_decisions(tenant_id,case_record_id,created_at);
CREATE TRIGGER ai_governance_decisions_scope BEFORE INSERT ON ai_governance_decisions FOR EACH ROW EXECUTE FUNCTION ai_validate_case_scope();
CREATE TRIGGER ai_governance_decisions_immutable BEFORE UPDATE OR DELETE ON ai_governance_decisions FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
ALTER TABLE ai_governance_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_governance_decisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_governance_decisions FROM PUBLIC,anon,authenticated;
COMMIT;
