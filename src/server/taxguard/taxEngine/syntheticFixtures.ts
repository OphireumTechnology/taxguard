import type { RuleSetDefinition } from './ruleSetDefinition';

/**
 * SYNTHETIC TEST FIXTURES ONLY. These are not tax law, not IRS or state values and must never be
 * used for a return. Parameter values are deliberately arbitrary, every source is a
 * 'synthetic_test' authority, and the jurisdiction code 'ZZ' does not exist.
 */
export const SYNTHETIC_SOURCE_ID = 'SYNTHETIC-SOURCE-1';
export function syntheticRuleSet(taxYear = 2025, overrides: Partial<RuleSetDefinition> = {}): RuleSetDefinition {
  return {
    jurisdiction: 'state', jurisdictionCode: 'ZZ', returnFamily: 'SYN-1', taxYear, title: 'Synthetic test rule set (not tax law)',
    parameters: [
      { key: 'synthetic_allowance', value: '1000.00', unit: 'USD', sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture section 1' },
      { key: 'synthetic_allowance', value: '2000.00', unit: 'USD', sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture section 1(b)', filingStatus: 'synthetic_joint' },
      { key: 'synthetic_rate', value: '0.0725', unit: 'RATE', sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture section 2' },
    ],
    inputs: [
      { factPath: 'synthetic.income_a', unit: 'USD', required: true },
      { factPath: 'synthetic.income_b', unit: 'USD', required: false },
    ],
    steps: [
      { id: 'total_income', op: 'sum', args: ['input:synthetic.income_a', 'input:synthetic.income_b'], explanation: 'Add the synthetic income facts.' },
      { id: 'after_allowance', op: 'subtract', args: ['step:total_income', 'param:synthetic_allowance'], explanation: 'Subtract the synthetic allowance.' },
      { id: 'base', op: 'floor_zero', args: ['step:after_allowance'], explanation: 'A synthetic base is never negative.' },
      { id: 'synthetic_amount', op: 'multiply', args: ['step:base', 'param:synthetic_rate'], scale: 2, rounding: 'HALF_UP', explanation: 'Apply the synthetic rate, rounded to cents.' },
    ],
    outputs: [{ key: 'synthetic_base', step: 'base' }, { key: 'synthetic_amount', step: 'synthetic_amount' }],
    ...overrides,
  };
}
