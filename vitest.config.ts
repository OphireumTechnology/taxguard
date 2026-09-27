import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',

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
      '**/.firebase/**',
      '**/coverage/**',
      '**/.cache/**',
    ],
  },
});
