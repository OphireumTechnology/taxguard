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
  TAX_RULE_SET_TESTS_REQUIRED: 409, TAX_RULE_SET_TESTS_NOT_RUN: 409, TAX_RULE_SET_TESTS_FAILING: 409, TAX_RULE_TESTS_CHANGED: 409, TAX_RULE_TEST_IMMUTABLE: 409,
  TAX_RULE_SET_COVERAGE_INCOMPLETE: 409,
  // Evidence lineage of calculation inputs (proposal 20261018190000).
  TAX_CALC_EVIDENCE_UNRESOLVED: 409, TAX_CALC_LINEAGE_IMMUTABLE: 409,
  // Tax conclusions (proposal 20261019100000).
  TAX_CONCLUSION_PREPARER_REQUIRED: 403, TAX_CONCLUSION_REVIEWER_REQUIRED: 403, TAX_CONCLUSION_EVIDENCE_REQUIRED: 409, TAX_CONCLUSION_SOURCE_UNRESOLVED: 409,
  TAX_CONCLUSION_STALE: 409, TAX_CONCLUSION_SOURCES_NOT_APPROVED: 409, TAX_CONCLUSION_NOT_DRAFT: 409, TAX_CONCLUSION_NOT_SUBMITTED: 409,
  TAX_CONCLUSION_NOT_REVISABLE: 409, TAX_CONCLUSION_HISTORY_IMMUTABLE: 409,
  // Deterministic form mapping (proposal 20261019110000).
  TAX_FORM_RULE_DUPLICATE: 409, TAX_FORM_RULE_NOT_DRAFT: 409, TAX_FORM_RULE_NOT_PENDING: 409, TAX_FORM_RULE_NOT_APPROVED: 409, TAX_FORM_RULE_SCOPE_MISMATCH: 409,
  TAX_FORM_RULE_NOT_EFFECTIVE: 409,
  // Draft return preparation (proposal 20261019120000).
  TAX_RETURN_TEMPLATE_DUPLICATE: 409, TAX_RETURN_TEMPLATE_NOT_DRAFT: 409, TAX_RETURN_TEMPLATE_NOT_PENDING: 409, TAX_RETURN_TEMPLATE_NOT_APPROVED: 409,
  TAX_RETURN_TEMPLATE_NOT_EFFECTIVE: 409, TAX_RETURN_SCOPE_MISMATCH: 409, TAX_RETURN_PREPARER_REQUIRED: 403, TAX_RETURN_REVIEWER_REQUIRED: 403, TAX_RETURN_TEMPLATE_APPROVER_REQUIRED: 403, TAX_RETURN_REVIEW_AUTHORITY_REQUIRED: 403,
  TAX_RETURN_PREPARATION_REFUSED: 409, TAX_RETURN_NOT_DRAFT: 409, TAX_RETURN_NOT_SUBMITTED: 409, TAX_RETURN_STALE: 409, TAX_RETURN_IMMUTABLE: 409,
  TAX_FORM_MAPPING_PREPARER_REQUIRED: 403, TAX_FORM_MAPPING_REFUSED: 409, TAX_FORM_MAPPING_EMPTY: 409, TAX_FORM_MAPPING_IMMUTABLE: 409,
  // Tax research memos (proposal 20261018150000).
  RESEARCH_REVIEWER_REQUIRED: 403, RESEARCH_MEMO_NOT_EDITABLE: 409, RESEARCH_MEMO_NOT_SUBMITTED: 409, RESEARCH_VERSION_CONFLICT: 409,
  RESEARCH_AUTHORITY_REQUIRED: 409, RESEARCH_SOURCE_NOT_VERIFIED: 409, RESEARCH_MEMO_IMMUTABLE: 409,
  // Case readiness diagnostics and risk assessments (proposals 20261018160000 and 20261018170000).
  DIAGNOSTIC_REVIEWER_REQUIRED: 403, DIAGNOSTIC_NOT_WAIVABLE: 409, DIAGNOSTIC_NOT_OPEN: 409, DIAGNOSTIC_HISTORY_IMMUTABLE: 409, RISK_ASSESSMENT_IMMUTABLE: 409 };
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
  /** The evidence behind each input: recorded at approval, otherwise resolved now (proposal 20261018190000). */
  runLineage(tenant: string, actor: string, runId: string) {
    if (!UUID.test(runId)) throw new TaxEngineStoreError('TAX_CALC_RUN_NOT_FOUND', 404);
    return this.call('taxguard_tax_run_lineage', { p_tenant: tenant, p_actor: actor, p_run: runId });
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
  /** Outputs and filing-status variants not yet exercised by a verification case (proposal 038). */
  coverage(tenant: string, actor: string, ruleSetId: string) {
    return this.call<{ ruleSetId: string; contentSha256: string; missingOutputs: string[]; missingFilingStatuses: string[] }>('taxguard_tax_rule_coverage_get', { p_tenant: tenant, p_actor: actor, p_rule_set: this.id(ruleSetId) });
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

  // Tax research memos: case-scoped professional support. The database enforces scope, authority levels, maker-checker
  // and immutability; every memo states returnUse BLOCKED. A malformed memo id reads as not found.
  private memo(v: string) { if (!UUID.test(v)) throw new TaxEngineStoreError('RESEARCH_MEMO_NOT_FOUND', 404); return v; }
  research(tenant: string, actor: string, caseId: string) { return this.call<any[]>('taxguard_tax_research_list', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }
  openResearch(tenant: string, actor: string, caseId: string, question: string) {
    return this.call('taxguard_tax_research_open', { p_tenant: tenant, p_actor: actor, p_case: caseId, p_question: question });
  }
  citeResearch(tenant: string, actor: string, memoId: string, citation: { authorityLevel?: unknown; sourceId?: unknown; reference?: unknown; note?: unknown }) {
    const text = (v: unknown) => typeof v === 'string' ? v : undefined;
    return this.call('taxguard_tax_research_cite', { p_tenant: tenant, p_actor: actor, p_memo: this.memo(memoId), p_citation: {
      authorityLevel: text(citation.authorityLevel), sourceId: text(citation.sourceId), reference: text(citation.reference), note: text(citation.note) } });
  }
  submitResearch(tenant: string, actor: string, memoId: string, conclusion: string, version: number) {
    return this.call('taxguard_tax_research_submit', { p_tenant: tenant, p_actor: actor, p_memo: this.memo(memoId), p_conclusion: conclusion, p_version: version });
  }
  reviewResearch(tenant: string, actor: string, memoId: string, decision: 'approve' | 'reject', note: string, version: number) {
    return this.call('taxguard_tax_research_review', { p_tenant: tenant, p_actor: actor, p_memo: this.memo(memoId), p_decision: decision, p_note: note, p_version: version });
  }

  // Case readiness diagnostics: deterministic checks over the case's durable records. Severities come from the governed
  // rule table; only INFO and WARNING can be acknowledged, by the case reviewer or a manager. A malformed id reads as not found.
  diagnostics(tenant: string, actor: string, caseId: string) { return this.call('taxguard_case_diagnostics_list', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }
  runDiagnostics(tenant: string, actor: string, caseId: string) { return this.call('taxguard_case_diagnostics_run', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }
  acknowledgeDiagnostic(tenant: string, actor: string, diagnosticId: string, note: string) {
    if (!UUID.test(diagnosticId)) throw new TaxEngineStoreError('DIAGNOSTIC_NOT_FOUND', 404);
    return this.call('taxguard_case_diagnostic_acknowledge', { p_tenant: tenant, p_actor: actor, p_diagnostic: diagnosticId, p_note: note });
  }

  // Risk and materiality: thresholds come only from an approved practice policy. A person states the amount at stake and
  // whether a position lacks support; AI confidence is never taken from a request, because it may only come from a
  // governed AI run, and no agent runs.
  riskAssessments(tenant: string, actor: string, caseId: string) { return this.call<any[]>('taxguard_case_risk_list', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }
  assessRisk(tenant: string, actor: string, caseId: string, signals: { amountCents?: unknown; unsupportedPosition?: unknown }) {
    return this.call('taxguard_case_risk_assess', { p_tenant: tenant, p_actor: actor, p_case: caseId, p_signals: {
      amountCents: signals.amountCents ?? null, ...(signals.unsupportedPosition === undefined ? {} : { unsupportedPosition: signals.unsupportedPosition }) } });
  }

  // Tax conclusions with durable evidence-to-conclusion lineage (proposal 20261019100000). The database resolves every
  // link, derives staleness from the link snapshots and enforces preparer/reviewer separation; returnUse stays BLOCKED.
  private conclusion(v: string) { if (!UUID.test(v)) throw new TaxEngineStoreError('TAX_CONCLUSION_NOT_FOUND', 404); return v; }
  conclusions(tenant: string, actor: string, caseId: string) { return this.call<any[]>('taxguard_tax_conclusion_list', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }
  proposeConclusion(tenant: string, actor: string, caseId: string, body: unknown) {
    return this.call('taxguard_tax_conclusion_propose', { p_tenant: tenant, p_actor: actor, p_case: caseId, p_body: conclusionBody(body) });
  }
  reviseConclusion(tenant: string, actor: string, conclusionId: string, body: unknown) {
    return this.call('taxguard_tax_conclusion_revise', { p_tenant: tenant, p_actor: actor, p_conclusion: this.conclusion(conclusionId), p_body: conclusionBody(body) });
  }
  submitConclusion(tenant: string, actor: string, conclusionId: string) {
    return this.call('taxguard_tax_conclusion_submit', { p_tenant: tenant, p_actor: actor, p_conclusion: this.conclusion(conclusionId) });
  }
  reviewConclusion(tenant: string, actor: string, conclusionId: string, decision: 'approve' | 'return' | 'reject', note: string) {
    return this.call('taxguard_tax_conclusion_review', { p_tenant: tenant, p_actor: actor, p_conclusion: this.conclusion(conclusionId), p_decision: decision, p_note: note });
  }
  traceConclusion(tenant: string, actor: string, conclusionId: string) {
    return this.call('taxguard_tax_conclusion_trace', { p_tenant: tenant, p_actor: actor, p_conclusion: this.conclusion(conclusionId) });
  }
  traceEvidence(tenant: string, actor: string, caseId: string, ref: string) { return this.call('taxguard_tax_evidence_trace', { p_tenant: tenant, p_actor: actor, p_case: caseId, p_ref: ref }); }
  conclusionReadiness(tenant: string, actor: string, caseId: string) { return this.call('taxguard_tax_conclusion_readiness', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }

  // Deterministic form mapping (proposal 20261019110000). The database validates and hashes mapping rules, derives every
  // value from approved, current conclusions with its provenance, refuses anything ambiguous and derives staleness.
  private formRule(v: string) { if (!UUID.test(v)) throw new TaxEngineStoreError('TAX_FORM_RULE_NOT_FOUND', 404); return v; }
  private formMapping(v: string) { if (!UUID.test(v)) throw new TaxEngineStoreError('TAX_FORM_MAPPING_NOT_FOUND', 404); return v; }
  formRules(tenant: string, actor: string, taxYear?: number) { return this.call<any[]>('taxguard_tax_form_rule_list', { p_tenant: tenant, p_actor: actor, p_tax_year: taxYear ?? null }); }
  formRuleDetail(tenant: string, actor: string, ruleId: string) { return this.call('taxguard_tax_form_rule_get', { p_tenant: tenant, p_actor: actor, p_rule: this.formRule(ruleId) }); }
  draftFormRule(tenant: string, actor: string, definition: unknown) {
    return this.call('taxguard_tax_form_rule_draft', { p_tenant: tenant, p_actor: actor, p_definition: definition && typeof definition === 'object' && !Array.isArray(definition) ? definition : null });
  }
  transitionFormRule(tenant: string, actor: string, ruleId: string, action: 'submit' | 'approve' | 'reject', note?: string) {
    return this.call('taxguard_tax_form_rule_transition', { p_tenant: tenant, p_actor: actor, p_rule: this.formRule(ruleId), p_action: action, p_note: note ?? null });
  }
  formMappings(tenant: string, actor: string, caseId: string) { return this.call<any[]>('taxguard_tax_form_mapping_list', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }
  mapForm(tenant: string, actor: string, caseId: string, ruleId: string) {
    return this.call('taxguard_tax_form_map', { p_tenant: tenant, p_actor: actor, p_case: caseId, p_rule: this.formRule(ruleId) });
  }
  formMappingDetail(tenant: string, actor: string, mappingId: string) {
    return this.call('taxguard_tax_form_mapping_get', { p_tenant: tenant, p_actor: actor, p_mapping: this.formMapping(mappingId) });
  }

  // Draft return preparation (proposal 20261019120000). The database assembles a return only from current, non-stale
  // form mappings through an approved template, enforces preparer submit and independent reviewer approval and
  // derives staleness; nothing here computes a value.
  private returnTemplate(v: string) { if (!UUID.test(v)) throw new TaxEngineStoreError('TAX_RETURN_TEMPLATE_NOT_FOUND', 404); return v; }
  private returnVersion(v: string) { if (!UUID.test(v)) throw new TaxEngineStoreError('TAX_RETURN_NOT_FOUND', 404); return v; }
  returnTemplates(tenant: string, actor: string, taxYear?: number) { return this.call<any[]>('taxguard_tax_return_template_list', { p_tenant: tenant, p_actor: actor, p_tax_year: taxYear ?? null }); }
  returnTemplateDetail(tenant: string, actor: string, templateRuleId: string) {
    return this.call('taxguard_tax_return_template_get', { p_tenant: tenant, p_actor: actor, p_template: this.returnTemplate(templateRuleId) });
  }
  draftReturnTemplate(tenant: string, actor: string, definition: unknown) {
    return this.call('taxguard_tax_return_template_draft', { p_tenant: tenant, p_actor: actor, p_definition: definition && typeof definition === 'object' && !Array.isArray(definition) ? definition : null });
  }
  transitionReturnTemplate(tenant: string, actor: string, templateRuleId: string, action: 'submit' | 'approve' | 'reject', note?: string) {
    return this.call('taxguard_tax_return_template_transition', { p_tenant: tenant, p_actor: actor, p_template: this.returnTemplate(templateRuleId), p_action: action, p_note: note ?? null });
  }
  caseReturns(tenant: string, actor: string, caseId: string) { return this.call<any[]>('taxguard_tax_return_list', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }
  prepareReturn(tenant: string, actor: string, caseId: string, templateRuleId: string) {
    return this.call('taxguard_tax_return_prepare', { p_tenant: tenant, p_actor: actor, p_case: caseId, p_template: this.returnTemplate(templateRuleId) });
  }
  returnDetail(tenant: string, actor: string, returnVersionId: string) {
    return this.call('taxguard_tax_return_get', { p_tenant: tenant, p_actor: actor, p_version: this.returnVersion(returnVersionId) });
  }
  transitionReturn(tenant: string, actor: string, returnVersionId: string, action: 'submit' | 'approve' | 'return', note?: string) {
    return this.call('taxguard_tax_return_transition', { p_tenant: tenant, p_actor: actor, p_version: this.returnVersion(returnVersionId), p_action: action, p_note: note ?? null });
  }
  returnStageFacts(tenant: string, actor: string, caseId: string) { return this.call('taxguard_tax_return_stage_facts', { p_tenant: tenant, p_actor: actor, p_case: caseId }); }
}

/** Only the documented fields reach the database; links are type and reference pairs. */
function conclusionBody(body: unknown) {
  const b = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const text = (v: unknown) => typeof v === 'string' ? v : undefined;
  const links = Array.isArray(b.links) ? b.links.slice(0, 101).map(l => (l && typeof l === 'object' ? { type: text((l as any).type), ref: text((l as any).ref) } : {})) : undefined;
  return { type: text(b.type), statement: text(b.statement), ...(b.amount === undefined ? {} : { amount: b.amount === null ? null : text(b.amount) ?? 'invalid' }), links };
}
