import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// High-confidence patterns only. Never print matched credential values or file contents.
const root = fs.realpathSync(process.cwd());
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
const patterns = {
  awsAccessKey: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  githubToken: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{80,255})\b/g,
  providerSecret: /\b(?:sk-proj-[A-Za-z0-9_-]{40,}|sk_(?:live|test)_[A-Za-z0-9]{24,}|sb_secret_[A-Za-z0-9_-]{30,})\b/g,
  privateKey: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\r\n]{64,}/g,
};
const findings = [];
let scanned = 0, binarySkipped = 0;
for (const file of files) {
  const absolute = fs.realpathSync(path.join(root, file));
  if (!absolute.startsWith(root + path.sep)) throw new Error('SECRET_SCAN_PATH_DENIED');
  const bytes = fs.readFileSync(absolute);
  if (bytes.subarray(0, 8192).includes(0)) { binarySkipped++; continue; }
  const source = bytes.toString('utf8'); scanned++;
  for (const [pattern, regex] of Object.entries(patterns)) {
    regex.lastIndex = 0;
    for (const match of source.matchAll(regex)) findings.push({ file, line: source.slice(0, match.index).split('\n').length, pattern });
  }
  for (const match of source.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16,}\b/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') findings.push({ file, line: source.slice(0, match.index).split('\n').length, pattern: 'supabaseServiceRoleJwt' });
    } catch { /* not a decodable credential */ }
  }
}
console.log(JSON.stringify({ status: findings.length ? 'FAIL' : 'PASS', scanned, binarySkipped, findings, scope: 'tracked and nonignored untracked workspace files; high-confidence patterns' }));
process.exitCode = findings.length ? 1 : 0;
