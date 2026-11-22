import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// scripts/integration-guard.mjs on a throwaway git repository (synthetic files only): what a multi-agent update may and
// may not do to recovered TaxGuard source.
const guard = path.resolve('scripts/integration-guard.mjs');
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-guard-'));
  const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 'guard@example.invalid'); git('config', 'user.name', 'Synthetic'); git('config', 'commit.gpgsign', 'false');
  const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
  write('supabase/migrations/20260101000000_core.sql', 'CREATE TABLE t(id int);\n');
  write('src/services/realClient.ts', "export const load = () => fetch(apiEndpoint('/api/x'));\n");
  write('src/server/routes/cases.routes.ts', "router.get('/', async () => store().rpc('fn'));\n");
  write('src/components/Ui.tsx', 'export const Ui = () => null;\n');
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD').trim();
  const commit = (message = 'update') => { git('add', '-A'); git('commit', '-q', '--allow-empty', '-m', message); return git('rev-parse', 'HEAD').trim(); };
  const run = (b = base) => spawnSync(process.execPath, [guard, '--base', b, '--head', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  return { dir, write, commit, run, base, rm: (file: string) => fs.rmSync(path.join(dir, file)) };
}

describe('integration guard', () => {
  it('passes frontend changes, new files and edits that keep real service calls', () => {
    const r = repo();
    r.write('src/components/Ui.tsx', 'export const Ui = () => "new branding";\n');
    r.write('supabase/migrations/20260201000000_next.sql', 'ALTER TABLE t ADD COLUMN v int;\n');
    r.write('src/services/realClient.ts', "export const load = () => fetch(apiEndpoint('/api/x?v=2'));\n");
    r.rm('src/components/Ui.tsx'); // unprotected deletion is allowed
    r.commit();
    const out = r.run();
    expect(out.status, out.stderr).toBe(0);
    expect(out.stdout).toContain('integration-guard: PASS');
  });
  it('rejects a modified or deleted existing migration', () => {
    const r = repo();
    r.write('supabase/migrations/20260101000000_core.sql', 'CREATE TABLE t(id bigint);\n'); r.commit();
    const out = r.run();
    expect(out.status).toBe(1);
    expect(out.stderr).toContain('MIGRATION_IMMUTABLE M supabase/migrations/20260101000000_core.sql');
  });
  it('rejects deletion of protected source unless the exact path is in the reviewed approval file', () => {
    const r = repo();
    r.rm('src/server/routes/cases.routes.ts'); r.commit();
    let out = r.run();
    expect(out.status).toBe(1);
    expect(out.stderr).toContain('PROTECTED_DELETION D src/server/routes/cases.routes.ts');
    r.write('docs/development/approved-deletions.json', JSON.stringify({ paths: [{ path: 'src/server/routes/cases.routes.ts', reason: 'synthetic' }] })); r.commit();
    out = r.run();
    expect(out.status, out.stderr).toBe(0);
  });
  it('rejects a service client or route that stops calling the API or database (replaced by a mock)', () => {
    const r = repo();
    r.write('src/services/realClient.ts', 'const mockList = [{ id: 1 }];\nexport const load = async () => mockList;\n');
    r.write('src/server/routes/cases.routes.ts', "router.get('/', (_q, s) => s.json({ success: true }));\n"); r.commit();
    const out = r.run();
    expect(out.status).toBe(1);
    expect(out.stderr).toContain('SERVICE_STUBBED src/services/realClient.ts');
    expect(out.stderr).toContain('SERVICE_STUBBED src/server/routes/cases.routes.ts');
  });
  it('a client that delegates to a real service client passes; one that returns a constant does not', () => {
    const r = repo();
    r.write('src/services/realClient.ts', "import { vaultService } from './vaultService';\nexport const load = () => vaultService.download('c', 'd', 1);\n"); r.commit();
    expect(r.run().status).toBe(0);
    const r2 = repo();
    r2.write('src/services/realClient.ts', "export const load = async () => ({ url: 'https://example.invalid/fake' });\n"); r2.commit();
    const out = r2.run();
    expect(out.status).toBe(1);
    expect(out.stderr).toContain('SERVICE_STUBBED src/services/realClient.ts');
  });
  it('a first push (all-zero base) compares the head commit with its parent', () => {
    const r = repo();
    r.rm('src/services/realClient.ts'); r.commit();
    const out = r.run('0'.repeat(40));
    expect(out.status).toBe(1);
    expect(out.stderr).toContain('PROTECTED_DELETION D src/services/realClient.ts');
  });
});
