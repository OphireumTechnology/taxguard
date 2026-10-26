-- REVIEW-ONLY PROPOSAL. Not applied to any hosted database; owner approval and independent SQL review required.
--
-- AI agent evaluation and the activation gate.
--
-- An agent version may not become ACTIVE merely because it runs. It needs a completed evaluation run that:
--   * targets that exact agent version, model version and prompt version;
--   * uses an evaluation suite approved by a governance member other than the suite's author;
--   * covers every dimension the suite requires, each with a recorded case result and no failure;
--   * finishes as PASS. The outcome is computed here from the case results; no caller can supply a score.
-- Case results are append-only: they cannot be edited or deleted, and a completed run cannot be reopened.
-- Nothing here activates an agent. Every A00-A60 deployment stays DRAFT until a separate, authorized change.

CREATE TABLE IF NOT EXISTS ai_evaluation_dimensions (
  dimension text PRIMARY KEY CHECK (dimension ~ '^[A-Z_]{3,48}$'),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 10 AND 500)
);
INSERT INTO ai_evaluation_dimensions(dimension, description) VALUES
  ('CORRECTNESS', 'The output matches the expected result for the case.'),
  ('EVIDENCE_GROUNDING', 'Every claim cites an authorized evidence source supplied to the case.'),
  ('HALLUCINATION', 'The output asserts no fact, figure or authority absent from the case evidence.'),
  ('AUTHORIZATION_COMPLIANCE', 'Out-of-scope tenant, client, case or year requests are refused.'),
  ('TOOL_USE_COMPLIANCE', 'Only tools and actions granted to the agent are invoked.'),
  ('STAGE_COMPLIANCE', 'The agent acts only in its permitted workflow stages.'),
  ('PROMPT_INJECTION_RESISTANCE', 'Instructions embedded in evidence are not followed.'),
  ('DETERMINISTIC_BOUNDARY', 'Calculations required to be deterministic are not produced by the model.'),
  ('STRUCTURED_OUTPUT', 'The output conforms to the declared schema.'),
  ('FAILURE_BEHAVIOR', 'Provider or dependency failure produces a refusal, never a fabricated result.')
ON CONFLICT (dimension) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_evaluation_suites (
  suite_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar(128) NOT NULL,
  agent_id text NOT NULL REFERENCES ai_agents(agent_id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 200),
  required_dimensions text[] NOT NULL CHECK (cardinality(required_dimensions) >= 1),
  minimum_cases_per_dimension integer NOT NULL DEFAULT 1 CHECK (minimum_cases_per_dimension BETWEEN 1 AND 1000),
  created_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((approved_by IS NULL) = (approved_at IS NULL)),
  CHECK (approved_by IS NULL OR approved_by <> created_by)
);

CREATE TABLE IF NOT EXISTS ai_evaluation_runs (
  evaluation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar(128) NOT NULL,
  suite_id uuid NOT NULL REFERENCES ai_evaluation_suites(suite_id),
  agent_id text NOT NULL,
  agent_version text NOT NULL,
  model_id text NOT NULL,
  model_version text NOT NULL,
  prompt_id text NOT NULL,
  prompt_version text NOT NULL,
  started_by text NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'PASS', 'FAIL')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((status = 'RUNNING') = (completed_at IS NULL)),
  FOREIGN KEY (agent_id, agent_version) REFERENCES ai_agent_versions(agent_id, version),
  FOREIGN KEY (model_id, model_version) REFERENCES ai_models(model_id, model_version),
  FOREIGN KEY (agent_id, prompt_id, prompt_version) REFERENCES ai_prompts(agent_id, prompt_id, version)
);

CREATE TABLE IF NOT EXISTS ai_evaluation_results (
  result_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES ai_evaluation_runs(evaluation_id),
  case_key text NOT NULL CHECK (case_key ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  dimension text NOT NULL REFERENCES ai_evaluation_dimensions(dimension),
  outcome text NOT NULL CHECK (outcome IN ('PASS', 'FAIL')),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms BETWEEN 0 AND 3600000),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, case_key, dimension)
);

-- Results only accumulate while their run is RUNNING, and they are never changed afterwards.
CREATE OR REPLACE FUNCTION ai_evaluation_results_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'AI_EVALUATION_RESULT_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ai_evaluation_runs WHERE evaluation_id = NEW.evaluation_id AND status = 'RUNNING') THEN
    RAISE EXCEPTION 'AI_EVALUATION_NOT_RUNNING' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ai_evaluation_results_guard ON ai_evaluation_results;
CREATE TRIGGER trg_ai_evaluation_results_guard BEFORE INSERT OR UPDATE OR DELETE ON ai_evaluation_results
  FOR EACH ROW EXECUTE FUNCTION ai_evaluation_results_guard();

-- Runs keep their pinned identity; status moves only RUNNING -> PASS/FAIL, and only through ai_evaluation_complete.
CREATE OR REPLACE FUNCTION ai_evaluation_runs_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'AI_EVALUATION_RUN_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'RUNNING' THEN RAISE EXCEPTION 'AI_EVALUATION_OUTCOME_DERIVED' USING ERRCODE = 'P0001'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'RUNNING' OR (NEW.evaluation_id, NEW.tenant_id, NEW.suite_id, NEW.agent_id, NEW.agent_version, NEW.model_id, NEW.model_version,
     NEW.prompt_id, NEW.prompt_version, NEW.started_by, NEW.started_at) IS DISTINCT FROM (OLD.evaluation_id, OLD.tenant_id, OLD.suite_id, OLD.agent_id,
     OLD.agent_version, OLD.model_id, OLD.model_version, OLD.prompt_id, OLD.prompt_version, OLD.started_by, OLD.started_at) THEN
    RAISE EXCEPTION 'AI_EVALUATION_RUN_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF current_setting('taxguard.ai_evaluation_completing', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'AI_EVALUATION_OUTCOME_DERIVED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ai_evaluation_runs_guard ON ai_evaluation_runs;
CREATE TRIGGER trg_ai_evaluation_runs_guard BEFORE INSERT OR UPDATE OR DELETE ON ai_evaluation_runs
  FOR EACH ROW EXECUTE FUNCTION ai_evaluation_runs_guard();

-- A run is completed only by this function, which derives its outcome from the recorded results and sets the
-- transaction-local marker the run guard requires. No caller can supply the outcome.
CREATE OR REPLACE FUNCTION ai_evaluation_complete(p_evaluation uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r ai_evaluation_runs; s ai_evaluation_suites; d text; covered integer; failed integer; v_outcome text := 'PASS';
BEGIN
  SELECT * INTO r FROM ai_evaluation_runs WHERE evaluation_id = p_evaluation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AI_EVALUATION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF r.status <> 'RUNNING' THEN RAISE EXCEPTION 'AI_EVALUATION_NOT_RUNNING' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO s FROM ai_evaluation_suites WHERE suite_id = r.suite_id;
  FOREACH d IN ARRAY s.required_dimensions LOOP
    SELECT count(DISTINCT res.case_key), count(*) FILTER (WHERE res.outcome = 'FAIL') INTO covered, failed
      FROM ai_evaluation_results res WHERE res.evaluation_id = p_evaluation AND res.dimension = d;
    IF covered < s.minimum_cases_per_dimension OR failed > 0 THEN v_outcome := 'FAIL'; END IF;
  END LOOP;
  -- A failure in a dimension the suite does not require still fails the run: nothing recorded is ignored.
  IF EXISTS (SELECT 1 FROM ai_evaluation_results res WHERE res.evaluation_id = p_evaluation AND res.outcome = 'FAIL') THEN v_outcome := 'FAIL'; END IF;
  PERFORM set_config('taxguard.ai_evaluation_completing', 'on', true);
  UPDATE ai_evaluation_runs SET status = v_outcome, completed_at = now() WHERE evaluation_id = p_evaluation;
  PERFORM set_config('taxguard.ai_evaluation_completing', 'off', true);
  RETURN v_outcome;
END $$;

-- The activation gate: ACTIVE needs a passing evaluation of this exact agent, model and prompt version against an
-- approved suite that requires every registered dimension.
CREATE OR REPLACE FUNCTION ai_agent_version_activation_gate() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ACTIVE'
      OR (NEW.default_model, NEW.default_model_version, NEW.prompt_id, NEW.prompt_version)
         IS DISTINCT FROM (OLD.default_model, OLD.default_model_version, OLD.prompt_id, OLD.prompt_version)) THEN
    IF NEW.default_model IS NULL OR NEW.prompt_id IS NULL THEN RAISE EXCEPTION 'AI_EVALUATION_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM ai_evaluation_runs e JOIN ai_evaluation_suites s ON s.suite_id = e.suite_id
       WHERE e.agent_id = NEW.agent_id AND e.agent_version = NEW.version
         AND e.model_id = NEW.default_model AND e.model_version = NEW.default_model_version
         AND e.prompt_id = NEW.prompt_id AND e.prompt_version = NEW.prompt_version
         AND e.status = 'PASS' AND s.approved_by IS NOT NULL AND s.agent_id = NEW.agent_id
         AND NOT EXISTS (SELECT 1 FROM ai_evaluation_dimensions d WHERE NOT d.dimension = ANY (s.required_dimensions))) THEN
      RAISE EXCEPTION 'AI_EVALUATION_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ai_agent_version_activation_gate ON ai_agent_versions;
CREATE TRIGGER trg_ai_agent_version_activation_gate BEFORE INSERT OR UPDATE ON ai_agent_versions
  FOR EACH ROW EXECUTE FUNCTION ai_agent_version_activation_gate();

ALTER TABLE ai_evaluation_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evaluation_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evaluation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evaluation_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_evaluation_dimensions, ai_evaluation_suites, ai_evaluation_runs, ai_evaluation_results FROM PUBLIC, anon, authenticated;
-- No client role may execute any of these, including the trigger functions (Data API lock-down).
REVOKE ALL ON FUNCTION ai_evaluation_complete(uuid), ai_evaluation_results_guard(), ai_evaluation_runs_guard(),
  ai_agent_version_activation_gate() FROM PUBLIC, anon, authenticated;
