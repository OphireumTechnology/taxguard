import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// Block 112: TaxGuard AI stays independent of the sibling project on this machine. This asks Git about every tracked file.
// The names are split so this file does not count as a match. Two dated records of earlier clean scans stay, as history;
// words like "donor" and "nonprofit" are not checked, because they are ordinary tax terms (Form 990, Form 709, charitable giving).
const SIBLING = ['Phum' + 'ulani', 'ORG' + '-AI', 'FUND' + '-AI', 'VA' + 'WA', 'Comfort ' + 'Dondo', 'fundraising ' + 'agent', 'survivor ' + 'services', 'donor ' + 'pipeline', 'phase' + '29_'];
const HISTORICAL_RECORDS = ['docs/development/local-consolidation-20261027.md', 'docs/development/phase15-integration-20261027.md'];
const grep = (args: string[]) => {
  const run = spawnSync('git', ['grep', '-I', '-i', '-l', ...args], { encoding: 'utf8' });
  return run.stdout.split('\n').filter(Boolean);
};

describe('project isolation', () => {
  it('finds the sibling project only in dated historical records', () => {
    const found = grep(SIBLING.flatMap(term => ['-e', term]));
    expect(found.sort()).toEqual(HISTORICAL_RECORDS);
  });

  it('has no source import, endpoint, database or path pointing at the sibling project', () => {
    const name = SIBLING[0].toLowerCase();
    for (const folder of ['src', 'scripts', 'supabase', 'docs/proposed-migrations', '.github']) expect(grep(['-e', name, '--', folder]), folder).toEqual([]);
    for (const file of ['package.json', 'vite.config.ts', 'server.ts', '.env.example', '.gitignore', '.claude/launch.json']) expect(fs.readFileSync(file, 'utf8').toLowerCase(), file).not.toContain(name);
  });

  it('tracks no file named after the sibling project', () => {
    const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).toLowerCase();
    for (const term of SIBLING) expect(files, term).not.toContain(term.toLowerCase());
  });

  it('has only the TaxGuard repository as a remote', () => {
    const remotes = execFileSync('git', ['remote', '-v'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    for (const remote of remotes) expect(remote).toMatch(/OphireumTechnology\/taxguard/);
  });

  it('keeps the master directive TaxGuard-only', () => {
    const directive = fs.readFileSync('docs/development/TAXGUARD_AI_MASTER_DEVELOPMENT_DIRECTIVE.md', 'utf8');
    for (const term of SIBLING) expect(directive.toLowerCase(), term).not.toContain(term.toLowerCase());
    expect(directive).toContain('developed and operated by Ophireum Technology');
    expect(directive).toContain('staging no-go, production no-go');
  });

  it('keeps ordinary tax wording that only resembles the other project', () => {
    expect(fs.readFileSync('src/data/taxStrategiesData.ts', 'utf8')).toContain('Donor-Advised Fund');
    expect(fs.readFileSync('src/taxForms/federalForms.ts', 'utf8')).toContain("form('F-709'");
  });
});
