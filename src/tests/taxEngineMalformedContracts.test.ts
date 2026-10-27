import { expect, it, vi } from 'vitest';
import { validateRuleSet, evaluateRuleSet } from '../server/taxguard/taxEngine/ruleSetDefinition';
import { syntheticRuleSet } from '../server/taxguard/taxEngine/syntheticFixtures';
import { TaxEngineStore } from '../server/taxguard/taxEngine/taxEngineStore';

it.each(['parameters', 'inputs', 'steps', 'outputs'] as const)('refuses null %s records before persistence', async field => {
  const definition = { ...syntheticRuleSet(), [field]: [null] };
  const rpc = vi.fn();
  await expect(async () => new TaxEngineStore({ rpc }).draftRuleSet('tenant', 'actor', definition as any))
    .rejects.toMatchObject({ code: 'TAX_ENGINE_DEFINITION_INVALID', status: 422 });
  expect(rpc).not.toHaveBeenCalled();
});

it.each([null, 42, {}, false])('refuses non-string step references: %j', arg => {
  const definition = syntheticRuleSet();
  definition.steps[0].args = [arg as any];
  expect(() => validateRuleSet(definition)).toThrow('TAX_ENGINE_DEFINITION_INVALID');
});

it('refuses missing parameter keys rather than coercing undefined into a valid identifier', () => {
  const definition = syntheticRuleSet();
  delete (definition.parameters[0] as any).key;
  expect(() => validateRuleSet(definition)).toThrow('TAX_ENGINE_DEFINITION_INVALID');
});

it.each([null, 42, {}, { factPath: 42 }, { factPath: null }])('refuses malformed calculation records before sorting: %j', input => {
  expect(() => evaluateRuleSet(syntheticRuleSet(), { inputs: [input as any, {
    factPath: 'synthetic.income_a', value: '1', evidenceIds: ['doc:synthetic'],
  }] })).toThrow('TAX_ENGINE_INPUT_INVALID');
});
