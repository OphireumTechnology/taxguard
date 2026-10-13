import { defineConfig } from 'vitest/config';

// Opt-in non-production database suite (npm run test:db): a local throw-away PostgreSQL server per
// file. Never part of the default `vitest run` (its include list does not reach src/tests-db).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests-db/**/*.db.test.ts'],
    maxWorkers: 1,
    testTimeout: 60000,
    hookTimeout: 300000,
  },
});
