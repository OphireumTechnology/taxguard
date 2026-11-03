import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { MASTER_PLAN_IMAGE } from '../server/ai/commandCenter/commandCenterManifest';

// Block 109: the AI Command Center stays inside the authenticated application. These check what the public can reach
// without a session: public navigation, public files and the bundle's sources. Sessions and roles run in provider suite 16.
const ROUTE = '/admin/master/ai';
const tracked = (...paths: string[]) => execFileSync('git', ['ls-files', ...paths], { encoding: 'utf8' }).split('\n').filter(Boolean);
const source = tracked('src').filter(f => /\.(ts|tsx)$/.test(f) && !f.startsWith('src/tests') && fs.existsSync(f));
const read = (file: string) => fs.readFileSync(file, 'utf8');
const PAGE = 'src/components/admin/commandCenter/AiCommandCenterPage.tsx';

describe('AI Command Center private access', () => {
  it('names its address only in routing and in a console that needs a governance role', () => {
    const naming = source.filter(f => read(f).includes(ROUTE)).sort();
    expect(naming).toEqual(['src/components/admin/AiControlCenterPanel.tsx', 'src/config/canonicalRouting.ts', 'src/context/AppContext.tsx']);
  });

  it('is imported only by the authenticated route', () => {
    const importing = source.filter(f => f !== PAGE && /AiCommandCenterPage/.test(read(f)));
    expect(importing).toEqual(['src/App.tsx']);
    const app = read('src/App.tsx');
    const block = app.slice(app.indexOf("if (currentPage === 'ai_command_center')"), app.indexOf('return <AiCommandCenterPage />'));
    expect(block).toContain("authLifecycleState !== 'AUTHENTICATED'");
    expect(block).toContain("currentUser.status !== 'active'");
    expect(block).toContain('<StaffLoginPage />');
  });

  it('is on no public page, navigation or list of public files', () => {
    const publicSource = source.filter(f => /src\/components\/(public|layout\/Public|common)/.test(f) || /Navbar|Footer|Header/.test(path.basename(f)));
    expect(publicSource.length).toBeGreaterThan(0);
    for (const file of publicSource) {
      expect(read(file), file).not.toContain(ROUTE);
      expect(read(file), file).not.toMatch(/AI Command Center/);
    }
    for (const file of tracked('public')) if (/\.(xml|txt|json|html|webmanifest)$/.test(file)) {
      expect(read(file), file).not.toMatch(/admin\/master|command.?center/i);
    }
  });

  it('keeps the module list and the image out of the browser bundle', () => {
    for (const file of source.filter(f => !f.startsWith('src/server/'))) {
      expect(read(file), file).not.toMatch(/commandCenterManifest|knowledgeStatus['"]/);
    }
    expect(MASTER_PLAN_IMAGE.startsWith('design-reference/')).toBe(true);
    for (const file of [...tracked('public'), ...tracked('src')]) expect(path.basename(file)).not.toBe(path.basename(MASTER_PLAN_IMAGE));
    for (const file of source) expect(read(file).includes('taxguard-ai-web-development-master-plan') && !file.startsWith('src/server/'), file).toBe(false);
    expect(fs.existsSync(MASTER_PLAN_IMAGE)).toBe(true);
  });

  it('never lets a design-reference folder reach the public build', () => {
    expect(fs.existsSync(path.join('public', 'design-reference'))).toBe(false);
    expect(read('vite.config.ts')).not.toContain('design-reference');
  });

  it('asks search engines not to index the page', () => {
    expect(read(PAGE)).toContain("meta.content = 'noindex, nofollow'");
  });
});
