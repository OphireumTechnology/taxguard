import fs from 'node:fs';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalTextHash } from '../../scripts/staging/migration-manifest.mjs';

describe('canonical staging migration manifest', () => {
  it('covers every core and proposed SQL file in tested composition order with exact hashes', () => {
    const manifest = JSON.parse(fs.readFileSync('docs/development/staging-migration-manifest.json', 'utf8'));
    const files = ['supabase/migrations', 'docs/proposed-migrations'].flatMap(dir => fs.readdirSync(dir).filter(n => n.endsWith('.sql')).sort().map(n => `${dir}/${n}`));
    expect(manifest.executionAllowed).toBe(false);
    expect(manifest.entries.map((e: any) => e.file)).toEqual(files);
    for (const [index, entry] of manifest.entries.entries()) {
      expect(entry.order).toBe(index + 1);
      expect(entry.sha256).toBe(crypto.createHash('sha256').update(fs.readFileSync(entry.file, 'utf8').replace(/\r\n/g, '\n')).digest('hex'));
      expect(entry.requiresOwnerReview).toBe(true);
      expect(entry.externalApplicationStatus).toBe('NOT_VERIFIED');
      expect(entry.dependsOn).toEqual(index ? [files[index - 1]] : []);
      for (const dependency of entry.referencedDependencies) expect(files.indexOf(dependency)).toBeLessThan(index);
    }
    expect(new Set(manifest.entries.map((e: any) => e.version)).size).toBe(files.length);
  });
  it('preserves content identity across Windows and Linux while detecting changed SQL', () => {
    const sql = 'SELECT 1;\nSELECT 2;\n';
    expect(canonicalTextHash(sql)).toBe(canonicalTextHash(sql.replace(/\n/g, '\r\n')));
    expect(canonicalTextHash(sql)).not.toBe(canonicalTextHash(sql + 'SELECT 3;\n'));
  });
});
