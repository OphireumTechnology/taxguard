import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(process.cwd(), 'src');

function collect(dir: string): string[] {
  const result: string[] = [];

  for (const entry of fs.readdirSync(dir, {
    withFileTypes: true,
  })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === 'demo' ||
        entry.name === 'tests'
      ) {
        continue;
      }

      result.push(...collect(full));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name)
    ) {
      result.push(full);
    }
  }

  return result;
}

const files = collect(ROOT);

function violations(
  predicate: (source: string) => boolean
): string[] {
  return files
    .filter((file) =>
      predicate(
        fs.readFileSync(file, 'utf8')
      )
    )
    .map((file) =>
      path.relative(process.cwd(), file)
    );
}

describe(
  'TaxGuard production authority',
  () => {
    it(
      'contains no LIVE imports from demo modules',
      () => {
        expect(
          violations((source) =>
            /from\s+['"][^'"]*\/demo\//i.test(
              source
            )
          )
        ).toEqual([]);
      }
    );

    it(
      'contains no demoDataStore production authority',
      () => {
        expect(
          violations((source) =>
            /\bdemoDataStore\b/.test(source)
          )
        ).toEqual([]);
      }
    );

    it(
      'contains no DemoVaultService production authority',
      () => {
        expect(
          violations((source) =>
            /\bDemoVaultService\b/.test(source)
          )
        ).toEqual([]);
      }
    );

    it(
      'contains no INITIAL_DEMO_CLIENTS production authority',
      () => {
        expect(
          violations((source) =>
            /\bINITIAL_DEMO_CLIENTS\b/.test(
              source
            )
          )
        ).toEqual([]);
      }
    );

    it(
      'never exposes OpenAI credentials through Vite',
      () => {
        expect(
          violations((source) =>
            /VITE_[A-Z0-9_]*OPENAI[A-Z0-9_]*/.test(
              source
            )
          )
        ).toEqual([]);
      }
    );

    it(
      'does not contain hard-coded Summit engagement authority',
      () => {
        expect(
          violations((source) =>
            /\beng_2025_summit\b/.test(source)
          )
        ).toEqual([]);
      }
    );
  }
);
