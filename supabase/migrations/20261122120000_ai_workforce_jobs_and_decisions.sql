-- Strictly additive migration for TaxGuard 61-Agent Application Workforce (A00–A60).
-- Preserves all historical migrations untouched.
-- Enforces tenant isolation, metadata-only job payloads, human-review-only advisories,
-- idempotent job submission, and atomic single-decision concurrency protection.

CREATE TABLE IF NOT EXISTS public.ai_workforce_jobs (
  job_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  tenant_id text NOT NULL,
  client_id text NOT NULL,
  tax_case_id text NOT NULL,
  tax_year integer NOT NULL CHECK (tax_year BETWEEN 2000 AND 2200),
  case_record_id text NOT NULL,
  agent_id text NOT NULL CHECK (agent_id ~ '^A(?:[0-5][0-9]|60)$' AND agent_id <> 'A39'),
  workflow_stage integer NOT NULL CHECK (workflow_stage BETWEEN 1 AND 18),
  requested_by text NOT NULL,
  evidence_source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DENIED', 'STALE')),
  advisory_id uuid NULL,
  error_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_workforce_jobs_idempotency_uniq UNIQUE (tenant_id, agent_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ai_workforce_jobs_tenant_case_idx
  ON public.ai_workforce_jobs (tenant_id, tax_case_id, agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_workforce_advisories (
  advisory_id uuid PRIMARY KEY,
  job_id uuid NULL REFERENCES public.ai_workforce_jobs(job_id) ON DELETE RESTRICT,
  tenant_id text NOT NULL,
  client_id text NOT NULL,
  tax_case_id text NOT NULL,
  tax_year integer NOT NULL CHECK (tax_year BETWEEN 2000 AND 2200),
  agent_id text NOT NULL CHECK (agent_id ~ '^A(?:[0-5][0-9]|60)$' AND agent_id <> 'A39'),
  agent_name text NOT NULL,
  batch_id text NOT NULL,
  workflow_stage integer NOT NULL CHECK (workflow_stage BETWEEN 1 AND 18),
  status text NOT NULL CHECK (status IN ('ADVISORY', 'REVIEW_REQUIRED', 'EVIDENCE_REQUIRED', 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED')),
  summary text NOT NULL,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  structured_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_pins jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_fingerprint text NOT NULL CHECK (evidence_fingerprint ~ '^[a-f0-9]{64}$'),
  authority_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_reviewer_role text NOT NULL CHECK (required_reviewer_role IN ('PREPARER', 'REVIEWER', 'CPA_EA', 'PENDING_OWNER_APPROVAL')),
  permitted_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_audience text NOT NULL,
  human_review_required boolean NOT NULL DEFAULT true CHECK (human_review_required = true),
  authoritative_mutation boolean NOT NULL DEFAULT false CHECK (authoritative_mutation = false),
  external_submission_allowed boolean NOT NULL DEFAULT false CHECK (external_submission_allowed = false),
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_workforce_advisories_tenant_case_idx
  ON public.ai_workforce_advisories (tenant_id, tax_case_id, agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_workforce_decisions (
  decision_id uuid PRIMARY KEY,
  advisory_id uuid NOT NULL REFERENCES public.ai_workforce_advisories(advisory_id) ON DELETE RESTRICT,
  tenant_id text NOT NULL,
  client_id text NOT NULL,
  tax_case_id text NOT NULL,
  tax_year integer NOT NULL CHECK (tax_year BETWEEN 2000 AND 2200),
  agent_id text NOT NULL CHECK (agent_id ~ '^A(?:[0-5][0-9]|60)$' AND agent_id <> 'A39'),
  bound_evidence_fingerprint text NOT NULL CHECK (bound_evidence_fingerprint ~ '^[a-f0-9]{64}$'),
  bound_evidence_versions jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_uid text NOT NULL,
  reviewer_role text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('ACKNOWLEDGE', 'ESCALATE', 'DISMISS', 'RETURN_FOR_CORRECTION', 'APPROVE_PROPOSAL', 'REJECT_PROPOSAL')),
  rationale text NOT NULL CHECK (char_length(trim(rationale)) >= 10 AND char_length(rationale) <= 2000),
  synthetic_staging_gate_used boolean NOT NULL DEFAULT false,
  authoritative_mutation boolean NOT NULL DEFAULT false CHECK (authoritative_mutation = false),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_workforce_decisions_single_per_advisory_uniq UNIQUE (tenant_id, advisory_id)
);

CREATE INDEX IF NOT EXISTS ai_workforce_decisions_tenant_case_idx
  ON public.ai_workforce_decisions (tenant_id, tax_case_id, recorded_at DESC);

ALTER TABLE public.ai_workforce_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workforce_advisories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workforce_decisions ENABLE ROW LEVEL SECURITY;
