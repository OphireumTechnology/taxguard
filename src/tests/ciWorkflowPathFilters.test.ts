import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('development CI path filters', () => {
  it.each([
    'src/**',
    'tests/**',
    'tools/**',
    'scripts/**',
    'qa/**',
    'supabase/**',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    '.github/workflows/deploy-pages.yml',
    '.github/workflows/taxguard-development-ci.yml',
  ])(
    'runs validation when %s changes',
    file => {
      const workflow = readFileSync('.github/workflows/taxguard-development-ci.yml', 'utf8');
      const pullRequest = workflow.split('  pull_request:\n')[1]?.split('\n  push:\n')[0] ?? '';

      expect(pullRequest).toContain(`      - '${file}'`);
    }
  );
});
