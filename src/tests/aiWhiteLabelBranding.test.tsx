import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../server/auth', async original => ({ ...await original<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => { const token = req.get('x-test-token'); if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' }); req.token = token; next(); } }));
import { AI_BRAND } from '../config/aiBranding';
import { GovernanceError } from '../server/ai/governance/contracts';
import { LOCAL_MODEL_ID, LOCAL_MODEL_PROVENANCE } from '../server/ai/localModelProvenance';
import { createAiGovernanceRouter } from '../server/routes/ai-governance.routes';
import { LocalModelReportView, type LocalModelReport } from '../components/admin/AiLocalModelView';
// @ts-ignore -- plain ESM script without type declarations
import { scanBundle } from '../../scripts/frontend/white-label-bundle-scan.mjs';

// White-label branding. Ordinary users see only the brand; the true provenance stays available to authorized
// administrators and is never replaced by a claim of ownership. Synthetic identities only.
const UPSTREAM = /\b(qwen\d*|ollama|llama|alibaba|openai|chatgpt|gemini|anthropic|claude|llamacpp)\b/i;
const INTERNAL = /127\.0\.0\.1:11434|localhost:11434|local-ai[\\/]|D:[\\/]TaxGuard/i;

/** Files that ship: followed from the entry through value imports only. A type-only import is erased from the bundle. */
function shippedFiles(entry = 'src/main.tsx') {
  const seen = new Set<string>(), queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    const specs = [...text.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)|^\s*import\s*['"](\.[^'"]+)['"]/gm)].map(m => m[1] || m[2] || m[3]);
    for (const spec of specs) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      const found = [base + '.tsx', base + '.ts', base + '/index.tsx', base + '/index.ts', base].find(f => /\.tsx?$/.test(f) && fs.existsSync(f));
      if (found) queue.push(found);
    }
  }
  return [...seen];
}

describe('browser-facing content', () => {
  // Screens and what they call. Type declarations and unmounted modules are removed from the build by tree-shaking, which a
  // source trace cannot see; scripts/frontend/white-label-bundle-scan.mjs checks the built bundle itself after each build.
  const files = shippedFiles().filter(f => /^src\/(components|services|hooks|context|config)\/|^src\/App\.tsx$/.test(f));
  const offenders = (pattern: RegExp) => files.flatMap(f => fs.readFileSync(f, 'utf8').split(/\r?\n/).flatMap((line, i) => {
    const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '');
    return pattern.test(code) ? [`${f}:${i + 1}`] : [];
  }));
  it('reads the code that ships', () => { expect(files.length).toBeGreaterThan(100); expect(files).toContain('src/config/aiBranding.ts'); });
  it('names no upstream model, engine or provider in any screen, service, hook or context', () => { expect(offenders(UPSTREAM)).toEqual([]); });
  it('names no internal endpoint or file path', () => { expect(offenders(INTERNAL)).toEqual([]); });
  it('the bundle scan flags an upstream name, an endpoint or a path, and does not pass an unbuilt tree', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'white-label-'));
    try {
      expect(scanBundle(path.join(dir, 'missing')).status).toBe('NOT_BUILT');
      expect(scanBundle(dir).status).toBe('FAIL'); // nothing scanned
      fs.writeFileSync(path.join(dir, 'a.js'), 'const note="philanthropic giving; TaxGuard AI; Ophireum Technology";');
      expect(scanBundle(dir)).toMatchObject({ status: 'PASS', scanned: 1, findings: [] });
      for (const leak of ['Ophir AI', 'ophir-model:8b', 'Qwen3 8B', 'qwen3:8b', 'ollama', 'gemini-flash', 'gpt-4o', 'http://127.0.0.1:11434', 'local-ai/models', 'D:\\TaxGuard\\x']) {
        fs.writeFileSync(path.join(dir, 'b.js'), `const x=${JSON.stringify(leak)};`);
        expect(scanBundle(dir).status, leak).toBe('FAIL');
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  it('the shared brand module holds only the brand', () => {
    expect(AI_BRAND).toEqual({ assistant: 'TaxGuard AI', model: 'TaxGuard Model', operator: 'Ophireum Technology', privateNetwork: 'LDL Dhenze Residential Building Private Network' });
    expect(Object.isFrozen(AI_BRAND)).toBe(true);
  });
  it('the accountant workspace labels the assistant with the brand', () => {
    expect(fs.readFileSync('src/components/workspace/AccountantNavigation.tsx', 'utf8')).toContain('label: AI_BRAND.assistant');
    expect(fs.readFileSync('src/components/workspace/AccountantDashboard.tsx', 'utf8')).toContain('<h3>{AI_BRAND.assistant}</h3>');
  });
});

describe('true provenance', () => {
  it('states the real creators and licences, and the operator only as operator', () => {
    expect(LOCAL_MODEL_ID).toBe('taxguard-model:8b');
    expect(LOCAL_MODEL_PROVENANCE.baseModel).toMatchObject({ identifier: 'qwen3:8b', creator: 'Qwen team, Alibaba Cloud', licence: 'Apache License 2.0' });
    expect(LOCAL_MODEL_PROVENANCE.inferenceEngine).toMatchObject({ name: 'Ollama', licence: 'MIT License' });
    expect(LOCAL_MODEL_PROVENANCE.operatorRole).toMatch(/Did not create the underlying weights or software and does not exclusively own them/);
  });
  it('the notices file keeps the required disclosures', () => {
    const notices = fs.readFileSync('docs/THIRD_PARTY_AI_NOTICES.md', 'utf8');
    for (const text of ['did not create or train', 'does not exclusively own', 'Qwen team, Alibaba Cloud', 'Apache License 2.0', 'Ollama Inc.', 'MIT License']) expect(notices).toContain(text);
  });
  it('the administrator view shows provenance, and says plainly when the runtime is down', () => {
    const report: LocalModelReport = { branding: AI_BRAND, provenance: LOCAL_MODEL_PROVENANCE as any, runtime: { status: 'UNAVAILABLE', endpoint: 'http://127.0.0.1:11434' } };
    const html = renderToStaticMarkup(<LocalModelReportView report={report} />);
    for (const text of ['Qwen3 8B', 'Alibaba Cloud', 'Apache License 2.0', 'Ollama', 'does not exclusively own', 'Nothing is sent to any other provider']) expect(html).toContain(text);
    const up = renderToStaticMarkup(<LocalModelReportView report={{ ...report, runtime: { status: 'AVAILABLE', endpoint: 'http://127.0.0.1:11434', version: '0.0', models: [{ name: LOCAL_MODEL_ID, sizeBytes: 1 }], loaded: [] } }} />);
    expect(up).toContain('taxguard-model:8b: installed'); expect(up).toContain('No model is loaded in memory');
  });
});

describe('administrator diagnostics route', () => {
  let server: Server, origin = '';
  const localModel = vi.fn(async (token: string) => {
    if (token !== 'governance') throw new GovernanceError('AI_CONTROL_CENTER_DENIED', 403);
    return { provenance: LOCAL_MODEL_PROVENANCE };
  });
  beforeAll(async () => {
    const app = express();
    app.use('/api/ai-governance', createAiGovernanceRouter(undefined as any, undefined as any, (() => ({ localModel })) as any));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/ai-governance/control-center/local-model';
  });
  afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
  it('needs a session, and passes the verified token to the role check', async () => {
    expect((await fetch(origin)).status).toBe(401);
    expect(localModel).not.toHaveBeenCalled();
  });
  it('refuses a non-governance role with no technical detail in the answer', async () => {
    const r = await fetch(origin, { headers: { 'x-test-token': 'client' } });
    const text = await r.text();
    expect(r.status).toBe(403);
    expect(UPSTREAM.test(text) || INTERNAL.test(text)).toBe(false);
  });
  it('gives a governance role the provenance, uncached', async () => {
    const r = await fetch(origin, { headers: { 'x-test-token': 'governance' } });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect((await r.json()).provenance.baseModel.identifier).toBe('qwen3:8b');
  });
});

describe('legacy AI route', () => {
  const src = fs.readFileSync('src/server/routes/taxguard-ai.routes.ts', 'utf8');
  it('filters model text for ordinary users', () => { expect(src).toContain("proposal: filterModelText(proposal.proposal, 'USER').text"); });
  it('shows provider and model only to administrators, and keeps them in the audit record', () => {
    expect(src).toContain("...(technicalDetails(req) ? { provider: 'GOOGLE_GEMINI', model: TaxGuardGeminiGateway.model } : {})");
    expect(src).toContain('proposal: technicalDetails(req as AuthenticatedRequest) ? proposal : withoutTechnicalDetails(proposal)');
    expect(src).toMatch(/provider:\s+proposal\.provider/);
  });
});
