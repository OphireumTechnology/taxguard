import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // SQL/WASM fixtures are resource-heavy; bound suite fan-out without changing test assertions.
    // Individual concurrency/replay tests still run their own concurrent operations.
    maxWorkers: 2,

    include: [
      'src/tests/**/*.test.ts',
      'src/tests/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/backups/**',
      '**/backup/**',
      '**/.git/**',
      '**/coverage/**',
      '**/.cache/**',
    ],
  },
});
