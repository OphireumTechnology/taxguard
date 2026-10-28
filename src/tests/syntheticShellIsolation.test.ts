import { expect, it } from 'vitest';
import { assertSyntheticModuleIsolation } from '../../qa/synthetic-shell/isolation';
it.each([
  'D:/workspace/src/context/AppContext.tsx', 'D:/workspace/src/services/api.ts',
  'D:/workspace/src/server/auth.ts', 'D:/workspace/src/supabase/config.ts',
  'D:\\workspace\\src\\server\\supabase.ts',
])('refuses a live session/provider dependency in the standalone fixture: %s', module => {
  expect(() => assertSyntheticModuleIsolation([module])).toThrow('SYNTHETIC_FIXTURE_LIVE_DEPENDENCY_DENIED');
});
it('permits the isolated provider and real shared presentation modules', () => {
  expect(() => assertSyntheticModuleIsolation(['D:/workspace/qa/synthetic-shell/context.tsx', 'D:/workspace/src/components/layout/DashboardApplicationShell.tsx', 'D:/workspace/src/theme/tokens.ts'])).not.toThrow();
});
