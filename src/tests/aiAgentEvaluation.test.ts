import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGovernanceFixture } from './aiGovernanceFixture';

// Proposal 20261018140000 (review only): an agent version becomes ACTIVE only after a passing evaluation of that exact
// agent, model and prompt version against a suite approved by someone other than its author. Outcomes are derived by
// the database from append-only case results. Synthetic governance state on disposable PGlite only.
const PROPOSAL = 'docs/proposed-migrations/20261018140000_taxguard_ai_agent_evaluation.sql';
const sha = (c: string) => c.repeat(64);
let fx: Awaited<ReturnType<typeof createGovernanceFixture>>;
let version = '';
let dimensions: string[] = [];

const q = (sql: string, params: unknown[] = []) => fx.pg.query<any>(sql, params);
const activateVersion = (extra = '') => q(`UPDATE ai_agent_versions SET status='ACTIVE',default_model='isolated-model',default_model_version='1',
  prompt_id='isolated-prompt',prompt_version='1'${extra} WHERE agent_id='A34' AND version=$1`, [version]);
const suite = async (opts: { approvedBy?: string | null; dims?: string[]; minimum?: number } = {}) => (await q(
  `INSERT INTO ai_evaluation_suites(tenant_id,agent_id,name,required_dimensions,minimum_cases_per_dimension,created_by,approved_by,approved_at)
   VALUES('tenantA','A34','Synthetic A34 suite',$1,$2,'compliance',$3,CASE WHEN $3::text IS NULL THEN NULL ELSE now() END) RETURNING suite_id`,
  [opts.dims ?? dimensions, opts.minimum ?? 1, opts.approvedBy === undefined ? 'admin' : opts.approvedBy])).rows[0].suite_id as string;
const run = async (suiteId: string, promptVersion = '1') => (await q(
  `INSERT INTO ai_evaluation_runs(tenant_id,suite_id,agent_id,agent_version,model_id,model_version,prompt_id,prompt_version,started_by)
   VALUES('tenantA',$1,'A34',$2,'isolated-model','1','isolated-prompt',$3,'compliance') RETURNING evaluation_id`, [suiteId, version, promptVersion])).rows[0].evaluation_id as string;
const result = (evaluation: string, dimension: string, outcome: 'PASS' | 'FAIL', caseKey = `case-${dimension}`) => q(
  `INSERT INTO ai_evaluation_results(evaluation_id,case_key,dimension,outcome,evidence_sha256,latency_ms) VALUES($1,$2,$3,$4,$5,120)`,
  [evaluation, caseKey, dimension, outcome, sha('b')]);
const complete = async (evaluation: string) => (await q('SELECT ai_evaluation_complete($1) AS outcome', [evaluation])).rows[0].outcome as string;
const passingEvaluation = async (suiteId: string) => { const e = await run(suiteId); for (const d of dimensions) await result(e, d, 'PASS'); expect(await complete(e)).toBe('PASS'); return e; };

beforeEach(async () => {
  fx = await createGovernanceFixture();
  version = (await q(`SELECT version FROM ai_agent_versions WHERE agent_id='A34'`)).rows[0].version;
  await fx.pg.exec(fs.readFileSync(PROPOSAL, 'utf8'));
  dimensions = (await q('SELECT dimension FROM ai_evaluation_dimensions ORDER BY dimension')).rows.map((r: any) => r.dimension);
});

describe('AI agent evaluation and the activation gate (proposal 20261018140000)', () => {
  it('registers the evaluation dimensions and leaves every agent version as it was', async () => {
    expect(dimensions).toEqual(['AUTHORIZATION_COMPLIANCE', 'CORRECTNESS', 'DETERMINISTIC_BOUNDARY', 'EVIDENCE_GROUNDING', 'FAILURE_BEHAVIOR',
      'HALLUCINATION', 'PROMPT_INJECTION_RESISTANCE', 'STAGE_COMPLIANCE', 'STRUCTURED_OUTPUT', 'TOOL_USE_COMPLIANCE']);
    expect((await q(`SELECT count(*)::int AS n FROM ai_agent_versions WHERE status='ACTIVE'`)).rows[0].n).toBe(0);
    // Reapplying is safe and changes nothing.
    await fx.pg.exec(fs.readFileSync(PROPOSAL, 'utf8'));
    expect((await q('SELECT count(*)::int AS n FROM ai_evaluation_dimensions')).rows[0].n).toBe(10);
  });

  it('refuses activation with no evaluation, including the direct shortcut the fixtures use', async () => {
    await expect(activateVersion()).rejects.toThrow('AI_EVALUATION_REQUIRED');
    await expect(fx.activateA34()).rejects.toThrow('AI_EVALUATION_REQUIRED');
    expect((await q(`SELECT status FROM ai_agent_versions WHERE agent_id='A34'`)).rows[0].status).toBe('DRAFT');
  });

  it('derives outcomes: a run cannot be created or set as passed by a caller', async () => {
    const s = await suite();
    await expect(q(`INSERT INTO ai_evaluation_runs(tenant_id,suite_id,agent_id,agent_version,model_id,model_version,prompt_id,prompt_version,started_by,status,completed_at)
      VALUES('tenantA',$1,'A34',$2,'isolated-model','1','isolated-prompt','1','compliance','PASS',now())`, [s, version])).rejects.toThrow('AI_EVALUATION_OUTCOME_DERIVED');
    const e = await run(s);
    await expect(q(`UPDATE ai_evaluation_runs SET status='PASS',completed_at=now() WHERE evaluation_id=$1`, [e])).rejects.toThrow('AI_EVALUATION_OUTCOME_DERIVED');
  });

  it('activates only after a passing evaluation of the exact versions against an independently approved suite', async () => {
    await passingEvaluation(await suite());
    await activateVersion();
    expect((await q(`SELECT status FROM ai_agent_versions WHERE agent_id='A34'`)).rows[0].status).toBe('ACTIVE');
  });

  it('fails a run with any failing case, or with too few cases for a required dimension, and then refuses activation', async () => {
    const s = await suite({ minimum: 2 });
    const failing = await run(s);
    for (const d of dimensions) { await result(failing, d, 'PASS', `a-${d}`); await result(failing, d, d === 'PROMPT_INJECTION_RESISTANCE' ? 'FAIL' : 'PASS', `b-${d}`); }
    expect(await complete(failing)).toBe('FAIL');
    const thin = await run(s);
    for (const d of dimensions) await result(thin, d, 'PASS');
    expect(await complete(thin)).toBe('FAIL');
    await expect(activateVersion()).rejects.toThrow('AI_EVALUATION_REQUIRED');
  });

  it('refuses activation for an unapproved suite, a suite missing a dimension, or a different prompt version', async () => {
    await passingEvaluation(await suite({ approvedBy: null }));
    await expect(activateVersion()).rejects.toThrow('AI_EVALUATION_REQUIRED');
    const partialSuite = await suite({ dims: dimensions.filter(d => d !== 'HALLUCINATION') });
    const partial = await run(partialSuite);
    for (const d of dimensions.filter(x => x !== 'HALLUCINATION')) await result(partial, d, 'PASS');
    expect(await complete(partial)).toBe('PASS');
    await expect(activateVersion()).rejects.toThrow('AI_EVALUATION_REQUIRED');
    await q(`INSERT INTO ai_prompts(agent_id,prompt_id,version,system_instructions,expected_output_schema,effective_date)VALUES('A34','isolated-prompt','2','Synthetic tests only','{"type":"object"}',now())`);
    const other = await run(await suite(), '2');
    for (const d of dimensions) await result(other, d, 'PASS');
    expect(await complete(other)).toBe('PASS');
    await expect(activateVersion()).rejects.toThrow('AI_EVALUATION_REQUIRED');
  });

  it('does not let a suite author approve their own suite', async () => {
    await expect(q(`INSERT INTO ai_evaluation_suites(tenant_id,agent_id,name,required_dimensions,created_by,approved_by,approved_at)
      VALUES('tenantA','A34','Self-approved',$1,'compliance','compliance',now())`, [dimensions])).rejects.toThrow(/check/i);
  });

  it('keeps results append-only and closes a completed run to new results', async () => {
    const e = await passingEvaluation(await suite());
    await expect(q(`UPDATE ai_evaluation_results SET outcome='FAIL' WHERE evaluation_id=$1`, [e])).rejects.toThrow('AI_EVALUATION_RESULT_IMMUTABLE');
    await expect(q(`DELETE FROM ai_evaluation_results WHERE evaluation_id=$1`, [e])).rejects.toThrow('AI_EVALUATION_RESULT_IMMUTABLE');
    await expect(result(e, 'CORRECTNESS', 'PASS', 'late-case')).rejects.toThrow('AI_EVALUATION_NOT_RUNNING');
    await expect(q(`DELETE FROM ai_evaluation_runs WHERE evaluation_id=$1`, [e])).rejects.toThrow('AI_EVALUATION_RUN_IMMUTABLE');
    await expect(complete(e)).rejects.toThrow('AI_EVALUATION_NOT_RUNNING');
  });

  it('requires a new evaluation when an active version changes model', async () => {
    await passingEvaluation(await suite());
    await activateVersion();
    await q(`INSERT INTO ai_models(model_id,model_version,provider,effective_date,approved_use_cases)VALUES('isolated-model','2','TEST',now(),ARRAY['IDENTIFY_REVIEW_QUESTIONS'])`);
    await expect(q(`UPDATE ai_agent_versions SET default_model_version='2' WHERE agent_id='A34' AND version=$1`, [version])).rejects.toThrow('AI_EVALUATION_REQUIRED');
  });
});
