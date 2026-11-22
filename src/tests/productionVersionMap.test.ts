import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// docs/development/production-migration-version-map.json: valid, strictly increasing migration versions in the tested
// dependency (DAG) order, with every SQL hash taken from the verified manifest. Review artifact; nothing is applied.
const map = JSON.parse(fs.readFileSync('docs/development/production-migration-version-map.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('docs/development/staging-migration-manifest.json', 'utf8'));
const valid = (v: string) => { const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(v)!; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return d.toISOString().replace(/[-:T]/g, '').slice(0, 14) === v; };

describe('production migration version map', () => {
  it('is current: regenerating it from the manifest gives the committed file', () => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tg-map-')), 'map.json');
    execFileSync(process.execPath, ['scripts/staging/production-version-map.mjs', '--write', out], { stdio: 'pipe' });
    expect(JSON.parse(fs.readFileSync(out, 'utf8'))).toEqual(map);
  });
  it('covers every manifest entry in DAG order with the same SQL hash, and never allows execution', () => {
    expect(map.executionAllowed).toBe(false);
    expect(map.entries.map((e: any) => [e.order, e.file, e.sha256])).toEqual(manifest.entries.map((e: any) => [e.order, e.file, e.sha256]));
  });
  it('uses only valid, strictly increasing versions', () => {
    const versions: string[] = map.entries.map((e: any) => e.proposedVersion);
    for (const v of versions) expect(valid(v), v).toBe(true);
    versions.forEach((v, i) => { if (i) expect(v > versions[i - 1], `${versions[i - 1]} -> ${v}`).toBe(true); });
  });
  it('keeps every core migration version, and orders the audit custody overlay before the security event outbox', () => {
    for (const e of map.entries.filter((x: any) => x.kind === 'core')) expect(e.proposedVersion, e.file).toBe(e.originalVersion);
    const at = (needle: string) => map.entries.find((e: any) => e.file.includes(needle));
    const custody = at('audit_custody_overlay'), outbox = at('security_event_outbox');
    expect(custody.order).toBeLessThan(outbox.order);
    expect(custody.proposedVersion < outbox.proposedVersion).toBe(true);
    expect(outbox.dependsOn.some((d: string) => d.includes('audit_custody_overlay'))).toBe(true);
  });
  it('records why each remapped entry moved', () => {
    expect(map.counts.remapped).toBe(map.entries.filter((e: any) => e.remapped).length);
    for (const e of map.entries) expect(e.remapped ? ['INVALID_TIMESTAMP', 'OUT_OF_DAG_ORDER'].includes(e.reason) : e.reason === null, e.file).toBe(true);
  });
});
