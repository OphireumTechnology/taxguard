// White-label check of the built browser bundle: what browsers actually receive must name no upstream model, engine or
// provider, no internal endpoint and no local path. Run after `npm run build`. Offline; reads dist only. Fails when dist is
// missing, so an unbuilt tree can never pass. Administrators read provenance from the server, never from the bundle.
import fs from 'node:fs';
import path from 'node:path';

export const FORBIDDEN = /\b(qwen\d*|ollama|llamacpp|alibaba|openai|chatgpt|gpt-\d[\w.-]*|gemini|anthropic|claude)\b|127\.0\.0\.1:11434|localhost:11434|local-ai[\\/]|[A-Z]:[\\/]+TaxGuard/i;
const TEXT = /\.(js|mjs|css|html|json|txt|map|svg|webmanifest)$/i;

export function scanBundle(dir = 'dist') {
  if (!fs.existsSync(dir)) return { status: 'NOT_BUILT', scanned: 0, findings: [] };
  const findings = [];
  let scanned = 0;
  for (const entry of fs.readdirSync(dir, { recursive: true })) {
    const file = path.join(dir, String(entry));
    if (!TEXT.test(file) || !fs.statSync(file).isFile()) continue;
    scanned++;
    const match = fs.readFileSync(file, 'utf8').match(FORBIDDEN);
    if (match) findings.push({ file: file.replace(/\\/g, '/'), match: match[0] });
  }
  return { status: findings.length || !scanned ? 'FAIL' : 'PASS', scanned, findings };
}

if (process.argv[1]?.endsWith('white-label-bundle-scan.mjs')) {
  const result = scanBundle(process.argv[2]);
  console.log(JSON.stringify(result));
  process.exit(result.status === 'PASS' ? 0 : 1);
}
