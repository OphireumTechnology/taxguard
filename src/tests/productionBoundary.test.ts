import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = path.resolve(process.cwd(), 'src');

function collectProductionSource(
  directory: string
): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    if (
      entry.isDirectory() &&
      (entry.name === 'demo' ||
        entry.name === 'tests')
    ) {
      continue;
    }

    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectProductionSource(full));
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name)
    ) {
      files.push(full);
    }
  }

  return files;
}

describe('TaxGuard LIVE production boundary', () => {
  it('contains zero imports from the demo application', () => {
    const violations = collectProductionSource(
      SOURCE_ROOT
    )
      .filter((file) => {
        const source = fs.readFileSync(
          file,
          'utf8'
        );

        return (
          /from\s+['"][^'"]*\/demo\//i.test(
            source
          ) ||
          /\bdemoDataStore\b/.test(source) ||
          /\bDemoVaultService\b/.test(source)
        );
      })
      .map((file) =>
        path.relative(process.cwd(), file)
      );

    expect(violations).toEqual([]);
  });

  it('does not expose an OpenAI key through Vite environment variables', () => {
    const violations = collectProductionSource(
      SOURCE_ROOT
    ).filter((file) => {
      const source = fs.readFileSync(
        file,
        'utf8'
      );

      return /VITE_OPENAI_API_KEY/.test(source);
    });

    expect(violations).toEqual([]);
  });
});
