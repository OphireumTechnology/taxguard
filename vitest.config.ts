import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // SQL/WASM fixtures are resource-heavy; bound suite fan-out without changing test assertions.
    // Individual concurrency/replay tests still run their own concurrent operations.
    maxWorkers: 2,

    // Unit and integration suites only. The PostgreSQL suite (src/tests-db) runs under vitest.db.config.ts
    // (`npm run test:db`) and the browser suite (src/tests-e2e) under scripts/e2e/run-e2e.mjs (`npm run test:e2e`);
    // each needs its own harness and fails when collected here.
    include: [
      'src/tests/**/*.test.ts',
      'src/tests/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/qa/**',
      '**/backups/**',
      '**/backup/**',
      '**/.git/**',
      '**/coverage/**',
      '**/.cache/**',
    ],
  },
});
