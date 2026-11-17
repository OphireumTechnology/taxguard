import { afterEach, expect, it } from 'vitest';
import { EnvironmentConfigService as Environment } from '../config/environmentConfig';
afterEach(() => { Environment.setEnvironment('demo'); });
it.each(['demo', 'uat_staging', 'production'] as const)('keeps %s configuration immutable and live filing denied', name => {
  const config = Environment.setEnvironment(name);
  expect(Object.isFrozen(config)).toBe(true);
  expect(Reflect.set(config, 'allowLiveFilings', true)).toBe(false);
  expect(Reflect.set(config, 'enableAuditLogging', false)).toBe(false);
  expect(Environment.isLiveFilingsAllowed()).toBe(false);
});
it.each(['unknown', '__proto__', 'constructor', '', null, undefined])('rejects invalid runtime environment %j without changing selection', name => {
  Environment.setEnvironment('uat_staging');
  expect(() => Environment.setEnvironment(name as never)).toThrow('UNKNOWN_APPLICATION_ENVIRONMENT');
  expect(Environment.getEnvironment()).toBe('uat_staging');
});
it('does not certify production compliance or share the environment list array', () => {
  const list = Environment.getAllEnvironments(); list.length = 0;
  expect(Environment.getAllEnvironments()).toHaveLength(3);
  expect(Environment.setEnvironment('production').description).not.toContain('compliant');
});
