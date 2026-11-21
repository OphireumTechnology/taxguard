import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Production release contract (GitHub Pages). Guards the root causes found on 2026-11-22: a deploy workflow that only
// ran when its own file changed, built a pinned historical commit, wrote the retired artaxserv.com CNAME, and a
// development CI that never validated direct pushes to main.
const deploy = fs.readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
const ci = fs.readFileSync('.github/workflows/taxguard-development-ci.yml', 'utf8');
const section = (text: string, start: string, end?: string) => { const i = text.indexOf(start); const j = end ? text.indexOf(end, i + 1) : -1; return text.slice(i, j < 0 ? undefined : j); };

describe('deploy-pages.yml', () => {
  it('runs after Development CI on main or by explicit dispatch, never on a file-path push', () => {
    expect(deploy).toMatch(/workflow_run:\s*\n\s*workflows: \['TaxGuard Development CI'\]\s*\n\s*types: \[completed\]\s*\n\s*branches: \[main\]/);
    expect(deploy).toContain('workflow_dispatch:');
    expect(section(deploy, 'on:', 'permissions:')).not.toMatch(/\bpush:|paths:/);
  });
  it('accepts only a successful CI push run of main in this repository', () => {
    const gate = section(deploy, 'resolve:', 'permissions:');
    for (const condition of ["github.event.workflow_run.conclusion == 'success'", "github.event.workflow_run.event == 'push'",
      "github.event.workflow_run.head_branch == 'main'", 'github.event.workflow_run.head_repository.full_name == github.repository'])
      expect(gate).toContain(condition);
  });
  it('builds the exact resolved commit: no pinned SHA, ancestry on main and a successful CI run are required', () => {
    expect(deploy.match(/\b[0-9a-f]{40}\b/g)).toBeNull();
    expect(deploy).toContain('ref: ${{ needs.resolve.outputs.sha }}');
    expect(deploy).toContain('test "$(git rev-parse HEAD)" = "$SHA"');
    expect(deploy).toContain('git merge-base --is-ancestor "$SHA" origin/main');
    expect(deploy).toContain('actions/workflows/taxguard-development-ci.yml/runs?head_sha=${SHA}&event=push&status=success');
    expect(deploy).toMatch(/\^\[0-9a-f\]\{40\}\$/);
  });
  it('validates before building and deploys only after the build succeeds, and only when approved', () => {
    const build = section(deploy, '  build:', '  deploy:');
    for (const step of ['npm run typecheck', 'npm test -- --run', 'node scripts/verify-branding.mjs', 'npm run build', 'node scripts/stamp-release.mjs'])
      expect(build).toContain(step);
    const deployJob = section(deploy, '  deploy:');
    expect(deployJob).toContain('needs: [resolve, build]');
    expect(deployJob).toContain("if: needs.resolve.outputs.deploy == 'true'");
    expect(deployJob).toContain('name: github-pages');
    // automatic deployment is off unless the owner sets the repository variable
    expect(deploy).toContain('DEPLOY="${AUTO_DEPLOY:-false}"');
  });
  it('publishes destriataxservices.com and records the published commit', () => {
    expect(deploy).toContain('PAGES_DOMAIN: destriataxservices.com');
    expect(deploy).not.toContain('artaxserv.com');
    expect(deploy).toContain('test "$(cat dist/CNAME)" = "$PAGES_DOMAIN"');
    expect(deploy).toContain("v.commit !== process.env.SHA");
  });
  it('passes user input to shell steps through environment variables only (no expression injection in run scripts)', () => {
    // Collect the text of every run: step (inline or block scalar, until the indentation returns to the key's level).
    const lines = deploy.split('\n'); const scripts: string[] = [];
    lines.forEach((line, i) => {
      const m = /^(\s*)(?:- )?run:\s*(.*)$/.exec(line);
      if (!m) return;
      const indent = m[1].length; scripts.push(m[2]);
      for (let j = i + 1; j < lines.length && (lines[j].trim() === '' || lines[j].search(/\S/) > indent); j++) scripts.push(lines[j]);
    });
    expect(scripts.length).toBeGreaterThan(20);
    expect(scripts.filter(l => l.includes('${{ inputs.') || l.includes('${{ github.event.workflow_run.') || l.includes('${{ github.head_ref'))).toEqual([]);
  });
});

describe('taxguard-development-ci.yml', () => {
  it('validates every push to main with no path filter, and branding changes in pull requests', () => {
    const push = section(ci, '  push:', 'workflow_dispatch:');
    expect(push).toMatch(/branches:[\s\S]*- main\b/);
    expect(push).not.toContain('paths:');
    for (const p of ["'public/**'", "'index.html'", "'vite.config.ts'", "'CNAME'"]) expect(section(ci, 'pull_request:', '  push:')).toContain(p);
    expect(ci).toContain('node scripts/verify-branding.mjs');
  });
  it('runs the integration guard against the update base with full history, on every agent branch', () => {
    expect(ci).toContain('fetch-depth: 0');
    expect(ci).toContain('node scripts/integration-guard.mjs --base "$GUARD_BASE" --head HEAD');
    expect(ci).toContain("github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event.before");
    const push = section(ci, '  push:', 'workflow_dispatch:');
    for (const b of ["'aistudio/**'", "'claude/**'", "'chatgpt/**'", "'integration/**'", "'rc/**'"]) expect(push).toContain(b);
    // no agent or release-candidate branch can trigger a production deployment
    expect(section(deploy, 'on:', 'permissions:')).toContain('branches: [main]');
  });
});

describe('repository domain configuration', () => {
  it('the repository CNAME files name destriataxservices.com', () => {
    for (const f of ['CNAME', 'public/CNAME']) expect(fs.readFileSync(f, 'utf8').trim()).toBe('destriataxservices.com');
  });
});

describe('scripts/stamp-release.mjs', () => {
  const commit = 'a'.repeat(40);
  const run = (dist: string, sha = commit) => execFileSync(process.execPath, ['scripts/stamp-release.mjs', '--commit', sha, '--dist', dist], { encoding: 'utf8', stdio: 'pipe' });
  const fixture = () => {
    const token = /BRAND_ASSET_VERSION = '([^']+)'/.exec(fs.readFileSync('src/utils/assets.ts', 'utf8'))![1];
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-stamp-'));
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'index.html'), ['favicon.png', 'favicon.ico', 'apple-touch-icon.png'].map(a => `<link href="/${a}?v=${token}">`).join('\n') + `\n<img src="/x.png?v=${token}-other">`);
    fs.writeFileSync(path.join(dist, 'assets', 'index-abc.js'), `const BRAND_ASSET_VERSION="${token}";`);
    return { dist, token };
  };
  it('stamps every asset version with the commit, writes CNAME and version.json', () => {
    const { dist, token } = fixture();
    expect(run(dist)).toContain('Stamped 4 asset version references (3 in index.html)');
    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    expect(html.match(new RegExp(`\\?v=${token}-aaaaaaaaaaaa"`, 'g'))).toHaveLength(3);
    expect(html).toContain(`?v=${token}-other`); // a different version value is left alone
    expect(fs.readFileSync(path.join(dist, 'assets', 'index-abc.js'), 'utf8')).toContain(`"${token}-aaaaaaaaaaaa"`);
    expect(fs.readFileSync(path.join(dist, 'CNAME'), 'utf8')).toBe('destriataxservices.com\n');
    expect(JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8'))).toMatchObject({ commit, shortCommit: 'aaaaaaaaaaaa', customDomain: 'destriataxservices.com' });
  });
  it('fails on a malformed commit, a build without versioned icons, or a second stamping', () => {
    const { dist } = fixture();
    expect(() => run(dist, 'abc')).toThrow();
    run(dist);
    expect(() => run(dist, 'b'.repeat(40))).toThrow(); // already stamped: nothing left to stamp in index.html
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-stamp-'));
    fs.writeFileSync(path.join(empty, 'index.html'), '<html></html>');
    expect(() => run(empty)).toThrow();
  });
});
