import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { executeAcceptancePlan, validationCommands } from './synthetic-acceptance-plan.mjs';
import { stagingAcceptancePlan } from '../qa/staging-acceptance-plan.mjs';
const args = process.argv.slice(2);
if (args.some(arg => !['--execute', '--with-browser-fixture', '--plan'].includes(arg)) || (args.includes('--plan') && args.includes('--execute'))) {
  console.error('Use --plan or --execute [--with-browser-fixture].'); process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!args.includes('--execute')) {
  console.log(JSON.stringify({ commands: validationCommands.map(row => row[1]), fixtureBuildOptional: true,
    browserAcceptance: 'NOT VERIFIED', releaseRecommendation: 'NO-GO', stagingScenarios: stagingAcceptancePlan.scenarios }, null, 2));
} else {
  const report = await executeAcceptancePlan(spec => new Promise(resolve => {
    const child = process.platform === 'win32'
      ? spawn('powershell.exe', ['-NoProfile', '-Command', spec.windowsCommand], { cwd: root, stdio: 'inherit', windowsHide: true })
      : spawn(spec.command, spec.args, { cwd: root, stdio: 'inherit', detached: true });
    let settled = false;
    const finish = result => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
    const timer = setTimeout(() => {
      if (child.pid) {
        if (process.platform === 'win32') spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on('error', () => {});
        else { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already exited */ } }
      }
      finish({ exitCode: null, reason: 'COMMAND_TIMEOUT' });
    }, 600000);
    child.once('error', () => finish({ exitCode: null, reason: 'EXECUTION_UNAVAILABLE' }));
    child.once('close', exitCode => finish({ exitCode }));
  }), args.includes('--with-browser-fixture'));
  const directory = path.join(root, 'qa', 'acceptance-results');
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, `validation-${randomUUID()}.json`);
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(`Synthetic validation evidence: ${destination}`);
  console.log('Browser, infrastructure and governance acceptance remain NOT VERIFIED; release NO-GO.');
  process.exitCode = report.success ? 0 : 1;
}
