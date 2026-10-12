/**
 * Tax engine foundation service over the proposal-033 RPCs. The server validates rule-set
 * definitions and computes their canonical hash; evaluation is the pure engine in
 * ruleSetDefinition.ts; the database enforces maker-checker, verified sources, approval, pinning,
 * idempotency, nondeterminism refusal and immutability. Stages 9-18 stay blocked.
 */
import type { PracticeRpcClient } from '../practice/practiceStore';
import { definitionHash, evaluateRuleSet, TaxEngineError, TAX_ENGINE_VERSION, validateRuleSet, type CalculationRequest, type RuleSetDefinition } from './ruleSetDefinition';
import { TaxDecimal } from '../../../taxguard/calculation/TaxDecimal';

export class TaxEngineStoreError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly detail?: string) { super(code); }
}
const STATUS: Record<string, number> = { TAX_CONTENT_ROLE_REQUIRED: 403, TAX_CONTENT_REVIEWER_REQUIRED: 403, MAKER_CHECKER_VIOLATION: 403, TAX_CALC_REVIEWER_REQUIRED: 403,
  PRACTICE_ACCESS_DENIED: 403, TAX_SOURCE_EXISTS: 409, TAX_SOURCE_NOT_PROPOSED: 409, TAX_RULE_SET_DUPLICATE: 409, TAX_RULE_SET_NOT_DRAFT: 409, TAX_RULE_SET_NOT_PENDING: 409,
  TAX_RULE_SET_NOT_APPROVED: 409, TAX_SOURCE_NOT_VERIFIED: 409, TAX_CALC_ALREADY_REVIEWED: 409, TAX_CALC_TAX_YEAR_MISMATCH: 409, TAX_ENGINE_NONDETERMINISM: 409,
  TAX_RULE_SET_INTEGRITY: 409, TAX_RULE_SET_IMMUTABLE: 409, TAX_CALC_RUN_IMMUTABLE: 409,
  TAX_RULE_SET_TESTS_REQUIRED: 409, TAX_RULE_SET_TESTS_NOT_RUN: 409, TAX_RULE_SET_TESTS_FAILING: 409, TAX_RULE_TESTS_CHANGED: 409, TAX_RULE_TEST_IMMUTABLE: 409 };
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class TaxEngineStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new TaxEngineStoreError('TAX_ENGINE_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message, details } = response.error;
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) throw new TaxEngineStoreError(message, statusOf(message), details ?? undefined);
      throw new TaxEngineStoreError('TAX_ENGINE_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private engine<T>(fn: () => T): T {
    try { return fn(); } catch (e) { if (e instanceof TaxEngineError) throw new TaxEngineStoreError(e.code, 422, e.detail); throw e; }
  }
  private id(v: string) { if (!UUID.test(v)) throw new TaxEngineStoreError('TAX_RULE_SET_NOT_FOUND', 404); return v; }

  sources(tenant: string, actor: string) { return this.call<any[]>('taxguard_tax_source_list', { p_tenant: tenant, p_actor: actor }); }
  registerSource(tenant: string, actor: string, source: Record<string, unknown>) { return this.call('taxguard_tax_source_register', { p_tenant: tenant, p_actor: actor, p_source: source }); }
  verifySource(tenant: string, actor: string, sourceId: string, documentSha256: string) {
    return this.call('taxguard_tax_source_verify', { p_tenant: tenant, p_actor: actor, p_source: sourceId, p_document_sha256: documentSha256 });
  }
  /** Validates and hashes the definition here; the database versions it and records the cited sources. */
  draftRuleSet(tenant: string, actor: string, definition: RuleSetDefinition) {
    const sources = this.engine(() => validateRuleSet(definition));
    return this.call('taxguard_tax_rule_set_draft', { p_tenant: tenant, p_actor: actor, p_definition: definition, p_sha256: definitionHash(definition), p_source_ids: sources });
  }
  transitionRuleSet(tenant: string, actor: string, ruleSetId: string, action: 'submit' | 'approve' | 'reject', note?: string) {
    return this.call('taxguard_tax_rule_set_transition', { p_tenant: tenant, p_actor: actor, p_rule_set: this.id(ruleSetId), p_action: action, p_note: note ?? null });
  }
  ruleSet(tenant: string, actor: string, ruleSetId: string) { return this.call('taxguard_tax_rule_set_get', { p_tenant: tenant, p_actor: actor, p_rule_set: this.id(ruleSetId) }); }
  ruleSets(tenant: string, actor: string, taxYear?: number) { return this.call<any[]>('taxguard_tax_rule_set_list', { p_tenant: tenant, p_actor: actor, p_tax_year: taxYear ?? null }); }

  /** Loads the approved rule set, re-verifies its hash, evaluates deterministically and records the run. */
  async calculate(tenant: string, actor: string, caseId: string, ruleSetId: string, request: CalculationRequest) {
    const rs = await this.ruleSet(tenant, actor, ruleSetId);
    if (rs.status !== 'APPROVED') throw new TaxEngineStoreError('TAX_RULE_SET_NOT_APPROVED', 409);
    const definition = rs.definition as RuleSetDefinition;
    if (this.engine(() => definitionHash(definition)) !== rs.contentSha256) throw new TaxEngineStoreError('TAX_RULE_SET_INTEGRITY', 409);
    const outcome = this.engine(() => evaluateRuleSet(definition, request));
    const recorded = await this.call('taxguard_tax_run_record', { p_tenant: tenant, p_actor: actor, p_case: caseId, p_run: { ruleSetId, ruleSetSha256: outcome.ruleSetHash,
      engineVersion: outcome.engineVersion, inputSha256: outcome.inputHash, outputSha256: outcome.outputHash, filingStatus: outcome.filingStatus,
      inputs: outcome.inputs, outputs: outcome.outputs, trace: outcome.trace } });
    // The database commits an audit row for a nondeterminism refusal, then reports it here.
    if (recorded?.refused) throw new TaxEngineStoreError(recorded.refused, 409);
    return recorded;
  }
  reviewRun(tenant: string, actor: string, runId: string, decision: 'approve' | 'reject', note: string) {
    if (!UUID.test(runId)) throw new TaxEngineStoreError('TAX_CALC_RUN_NOT_FOUND', 404);
    return this.call('taxguard_tax_run_review', { p_tenant: tenant, p_actor: actor, p_run: runId, p_decision: decision, p_note: note ?? null });
  }
  // ---- Source-cited verification cases (proposal 036) -----------------------------------------
  addTest(tenant: string, actor: string, ruleSetId: string, test: Record<string, unknown>) {
    return this.call('taxguard_tax_rule_test_add', { p_tenant: tenant, p_actor: actor, p_rule_set: this.id(ruleSetId), p_test: test });
  }
  removeTest(tenant: string, actor: string, ruleSetId: string, testId: string) {
    if (!UUID.test(testId)) throw new TaxEngineStoreError('TAX_RULE_TEST_NOT_FOUND', 404);
    return this.call('taxguard_tax_rule_test_remove', { p_tenant: tenant, p_actor: actor, p_rule_set: this.id(ruleSetId), p_test: testId });
  }
  tests(tenant: string, actor: string, ruleSetId: string) {
    return this.call<{ testsSha256: string; tests: any[]; latestRun: any }>('taxguard_tax_rule_test_list', { p_tenant: tenant, p_actor: actor, p_rule_set: this.id(ruleSetId) });
  }
  /** Runs every case with the deterministic engine; a case passes only if every expected output matches exactly. */
  async runTests(tenant: string, actor: string, ruleSetId: string) {
    const rs = await this.ruleSet(tenant, actor, ruleSetId);
    const definition = rs.definition as RuleSetDefinition;
    if (this.engine(() => definitionHash(definition)) !== rs.contentSha256) throw new TaxEngineStoreError('TAX_RULE_SET_INTEGRITY', 409);
    const { testsSha256, tests } = await this.tests(tenant, actor, ruleSetId);
    const results = tests.map((t: any) => {
      try {
        const outcome = evaluateRuleSet(definition, { filingStatus: t.filingStatus ?? undefined, inputs: t.inputs });
        const mismatches = Object.entries(t.expected as Record<string, string>).filter(([key, value]) => {
          const actual = outcome.outputs[key];
          return actual === undefined || typeof value !== 'string' || TaxDecimal.parse(actual).compare(TaxDecimal.parse(value)) !== 0;
        }).map(([key, value]) => ({ output: key, expected: value, actual: outcome.outputs[key] ?? null }));
        return { testId: t.testId, passed: mismatches.length === 0 && Object.keys(t.expected).length > 0, mismatches };
      } catch (e) {
        return { testId: t.testId, passed: false, error: e instanceof TaxEngineError ? e.code : 'TAX_ENGINE_EVALUATION_FAILED' };
      }
    });
    return this.call('taxguard_tax_rule_test_run_record', { p_tenant: tenant, p_actor: actor, p_rule_set: this.id(ruleSetId), p_run: { contentSha256: rs.contentSha256,
      testsSha256, engineVersion: TAX_ENGINE_VERSION, testCount: tests.length, passedCount: results.filter((r: any) => r.passed).length, results } });
  }
  runs(tenant: string, actor: string, caseId: string) { return this.call<any[]>('taxguard_tax_run_list', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }
}
