import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

// Files share one server and database per run, so they run one at a time in name order.
class NameOrder extends BaseSequencer {
  async sort(files: TestSpecification[]) { return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId)); }
  async shard(files: TestSpecification[]) { return files; }
}

// Opt-in browser E2E suite (npm run test:e2e). Started only by scripts/e2e/run-e2e.mjs, which boots
// the real server on 127.0.0.1 with a local PostgreSQL and synthetic users. Never part of `vitest run`.
// Profile 'provider' (browser signs in through the provider emulation) runs src/tests-e2e/provider.
const provider = process.env.E2E_PROFILE === 'provider';
export default defineConfig({
  test: {
    environment: 'node',
    include: provider ? ['src/tests-e2e/provider/**/*.e2e.test.ts'] : ['src/tests-e2e/*.e2e.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { shuffle: false, sequencer: NameOrder },
    testTimeout: 180000,
    hookTimeout: 180000,
  },
});
