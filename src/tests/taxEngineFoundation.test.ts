import { describe, expect, it } from 'vitest';
import { canonicalJson, definitionHash, evaluateRuleSet, TAX_ENGINE_VERSION, validateRuleSet, type RuleSetDefinition } from '../server/taxguard/taxEngine/ruleSetDefinition';
import { syntheticRuleSet, SYNTHETIC_SOURCE_ID } from '../server/taxguard/taxEngine/syntheticFixtures';

// Pure engine: rule-agnostic, exact decimals, deterministic, full provenance. Synthetic fixtures only.
const inputs = (a: string, b?: string) => ({ inputs: [{ factPath: 'synthetic.income_a', value: a, evidenceIds: ['doc:synthetic-1'] },
  ...(b === undefined ? [] : [{ factPath: 'synthetic.income_b', value: b, evidenceIds: ['doc:synthetic-2'] }])] });

describe('deterministic evaluation', () => {
  it('computes in exact decimals with a step-by-step provenance trace citing every parameter source', () => {
    const r = evaluateRuleSet(syntheticRuleSet(), inputs('12345.67', '0.10'));
    expect(r.outputs).toEqual({ synthetic_base: '11345.77', synthetic_amount: '822.57' }); // 11345.77 × 0.0725 = 822.568325 → 822.57
    expect(r.engineVersion).toBe(TAX_ENGINE_VERSION);
    expect(r.trace.map(t => [t.stepId, t.result])).toEqual([['total_income', '12345.77'], ['after_allowance', '11345.77'], ['base', '11345.77'], ['synthetic_amount', '822.57']]);
    expect(r.trace[1].args[1]).toEqual({ ref: 'param:synthetic_allowance', value: '1000.00', sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture section 1' });
    expect(evaluateRuleSet(syntheticRuleSet(), inputs('0.1', '0.2')).trace[0].result).toBe('0.3'); // never 0.30000000000000004
  });
  it('is deterministic: identical hashes regardless of input order or evidence order, different when anything changes', () => {
    const a = evaluateRuleSet(syntheticRuleSet(), { inputs: [{ factPath: 'synthetic.income_b', value: '5', evidenceIds: ['e:2', 'e:1'] }, { factPath: 'synthetic.income_a', value: '2000', evidenceIds: ['e:3'] }] });
    const b = evaluateRuleSet(syntheticRuleSet(), { inputs: [{ factPath: 'synthetic.income_a', value: '2000', evidenceIds: ['e:3'] }, { factPath: 'synthetic.income_b', value: '5', evidenceIds: ['e:1', 'e:2'] }] });
    expect([b.inputHash, b.outputHash, b.ruleSetHash]).toEqual([a.inputHash, a.outputHash, a.ruleSetHash]);
    expect(evaluateRuleSet(syntheticRuleSet(), inputs('2000.01', '5')).outputHash).not.toBe(a.outputHash);
    const changed = syntheticRuleSet(2025, { parameters: syntheticRuleSet().parameters.map(p => p.key === 'synthetic_rate' ? { ...p, value: '0.0726' } : p) });
    expect(definitionHash(changed)).not.toBe(a.ruleSetHash);
  });
  it('resolves filing-status parameters exactly, else the general one, and floors at zero', () => {
    expect(evaluateRuleSet(syntheticRuleSet(), { filingStatus: 'synthetic_joint', ...inputs('2500') }).outputs.synthetic_base).toBe('500.00');
    expect(evaluateRuleSet(syntheticRuleSet(), { filingStatus: 'synthetic_other', ...inputs('2500') }).outputs.synthetic_base).toBe('1500.00');
    expect(evaluateRuleSet(syntheticRuleSet(), inputs('10')).outputs).toEqual({ synthetic_base: '0', synthetic_amount: '0.00' });
  });
  it('refuses floats, missing evidence, undeclared facts and missing required inputs', () => {
    expect(() => evaluateRuleSet(syntheticRuleSet(), { inputs: [{ factPath: 'synthetic.income_a', value: 100.5 as any, evidenceIds: ['e:1'] }] })).toThrow('TAX_ENGINE_FLOAT_REJECTED');
    expect(() => evaluateRuleSet(syntheticRuleSet(), { inputs: [{ factPath: 'synthetic.income_a', value: '100', evidenceIds: [] }] })).toThrow('TAX_ENGINE_EVIDENCE_REQUIRED');
    expect(() => evaluateRuleSet(syntheticRuleSet(), { inputs: [{ factPath: 'synthetic.unknown', value: '1', evidenceIds: ['e:1'] }] })).toThrow('TAX_ENGINE_INPUT_INVALID');
    expect(() => evaluateRuleSet(syntheticRuleSet(), { inputs: [{ factPath: 'synthetic.income_b', value: '1', evidenceIds: ['e:1'] }] })).toThrow('TAX_ENGINE_REQUIRED_INPUT_MISSING');
    expect(() => canonicalJson({ a: 1.5 })).toThrow('TAX_ENGINE_FLOAT_REJECTED');
  });
});

describe('rule-set validation', () => {
  const base = syntheticRuleSet();
  it.each<[string, Partial<RuleSetDefinition>]>([
    ['forward step reference', { steps: [{ id: 'a', op: 'sum', args: ['step:b'], explanation: 'Forward reference' }, { id: 'b', op: 'sum', args: ['const:1'], explanation: 'Later step' }], outputs: [{ key: 'o', step: 'a' }] }],
    ['self reference', { steps: [{ id: 'a', op: 'sum', args: ['step:a'], explanation: 'Self reference' }], outputs: [{ key: 'o', step: 'a' }] }],
    ['unknown operation', { steps: [{ id: 'a', op: 'eval' as any, args: ['const:1'], explanation: 'Unknown op' }], outputs: [{ key: 'o', step: 'a' }] }],
    ['parameter without a source', { parameters: [{ key: 'p', value: '1', unit: 'USD', sourceId: '', citation: 'x y z' }] }],
    ['parameter without a citation', { parameters: [{ key: 'p', value: '1', unit: 'USD', sourceId: SYNTHETIC_SOURCE_ID, citation: '' }] }],
    ['float-like parameter value', { parameters: [{ key: 'p', value: '1e5', unit: 'USD', sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic' }] }],
    ['multiply without a scale', { steps: [{ id: 'a', op: 'multiply', args: ['const:1', 'const:2'], explanation: 'No scale' }], outputs: [{ key: 'o', step: 'a' }] }],
    ['output of an unknown step', { outputs: [{ key: 'o', step: 'missing' }] }],
    ['tax year out of range', { taxYear: 1999 }],
  ])('rejects %s', (_label, override) => {
    expect(() => validateRuleSet({ ...base, ...override })).toThrow('TAX_ENGINE_DEFINITION_INVALID');
  });
  it('lists the cited sources for verification', () => { expect(validateRuleSet(base)).toEqual([SYNTHETIC_SOURCE_ID]); });
});
