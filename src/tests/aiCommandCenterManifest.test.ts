import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMAND_CENTER_LIFECYCLE, COMMAND_CENTER_MODULES, COMMAND_CENTER_SECTIONS } from '../server/ai/commandCenter/commandCenterManifest';
import { parseKnowledgeStatus, readKnowledgeStatus } from '../server/ai/commandCenter/knowledgeStatus';

// Block 108: the AI Command Center claims only what the repository can show, and its figures survive only strict checks.
const side = { document_recall_at_1: 8, document_recall_at_3: 13, document_recall_at_5: 15, passage_recall_at_1: 1, passage_recall_at_3: 5, passage_recall_at_5: 6, cited_evidence_passage: 9, answered_without_evidence: 8, invented_citations: 0, correctly_refused: 9, search_median_ms: 1.16 };
const valid = () => ({
  schema_version: 1, generated_utc: '2026-11-03T03:46:38.575249+00:00', mode: 'STAGING_ONLY',
  sources: { registered: 11, active: 3, proposed: 6, blocked: 2, named_total: 7, named_staged: 4, named_missing: ['IRS_P17'], categories_without_documents: ['ACCOUNTING'] },
  discovery: { candidates_checked: 73, verified: 44, rejected: 0 }, quarantine: { documents: 38, approved: 0 }, extraction: { documents: 38, pages: 1258, findings: 1079, defect_findings: 542 }, chunks: { total: 3751, held_from_embedding: 0, embeddings: 3658 },
  review: { queue_awaiting: 104, staging: { pending: 3751, approved: 0, rejected: 0 }, production: { pending: 1488, approved: 0, rejected: 0, superseded: 0 } },
  evaluation: { run_id: '20261103T025825Z', recommend_for_human_review: 34, needs_correction: 4, hold: 0 },
  comparison: { outcome: 'RETAIN_BASELINE', questions: 21, refusal_items: 10, baseline: { ...side }, improved: { ...side }, generated_utc: '2026-11-03T02:57:41+00:00' },
  tax_year: { tax_year_editions: 13, revision_editions: 19, dated_publications: 1, undated: 5, conflicts: 2 }, warnings: { integrity_failures: 0, suspicious_documents: 0, active_content_documents: 29 }, scheduler: { tasks_enabled: 0 },
}) as any;

describe('command center manifest', () => {
  it('names real evidence for every status claim', () => {
    for (const module of COMMAND_CENTER_MODULES) for (const file of module.evidence) expect(fs.existsSync(file), `${module.id}: ${file}`).toBe(true);
    for (const stage of COMMAND_CENTER_LIFECYCLE) for (const file of stage.evidence) expect(fs.existsSync(file), `${stage.id}: ${file}`).toBe(true);
  });
  it('never calls a module implemented without evidence, or blocked without a reason', () => {
    for (const module of COMMAND_CENTER_MODULES) {
      if (module.status === 'IMPLEMENTED') expect(module.evidence.length, module.id).toBeGreaterThan(0);
      else expect(module.blocker, module.id).toBeTruthy();
    }
  });
  it('covers the six sections and only those', () => {
    expect(COMMAND_CENTER_SECTIONS.map(s => s.name)).toEqual(['Knowledge Engine', 'AI Inference', 'Tax Preparation', 'Human Governance', 'Evaluation Center', 'System Operations']);
    const ids = new Set(COMMAND_CENTER_SECTIONS.map(s => s.id));
    for (const section of ids) expect(COMMAND_CENTER_MODULES.some(m => m.section === section)).toBe(true);
    for (const module of COMMAND_CENTER_MODULES) expect(ids.has(module.section)).toBe(true);
    expect(new Set(COMMAND_CENTER_MODULES.map(m => m.id)).size).toBe(COMMAND_CENTER_MODULES.length);
  });
  it('keeps the seven lifecycle stages in order and marks none complete', () => {
    expect(COMMAND_CENTER_LIFECYCLE.map(s => s.name)).toEqual(['Plan', 'Develop', 'Test', 'Evaluate', 'Review', 'Deploy', 'Operate and improve']);
    for (const stage of COMMAND_CENTER_LIFECYCLE) { expect(stage.status).not.toMatch(/COMPLETE|DONE|PASS/); expect(stage.blockers.length, stage.id).toBeGreaterThan(0); }
    expect(COMMAND_CENTER_LIFECYCLE.find(s => s.id === 'deploy')!.status).toBe('BLOCKED');
  });
  it('states what is not available, and claims no filing, agents or deployment', () => {
    const status = (id: string) => COMMAND_CENTER_MODULES.find(m => m.id === id)!.status;
    for (const id of ['signing-filing', 'ai-agents', 'deployment', 'scheduled-learning', 'licensed-standards', 'retrieval-hybrid']) expect(status(id), id).toBe('BLOCKED');
    expect(status('knowledge-approval')).toBe('PLANNED');
  });
  it('names no runtime, vendor, address or old product name', () => {
    const text = JSON.stringify([COMMAND_CENTER_SECTIONS, COMMAND_CENTER_MODULES, COMMAND_CENTER_LIFECYCLE]);
    expect(text).not.toMatch(/ollama|qwen|alibaba|11434|127\.0\.0\.1|localhost|ophir(?!eum)|proprietary/i);
  });
});

describe('knowledge status parser', () => {
  it('accepts a valid status and drops unknown fields', () => {
    const raw = valid();
    raw.leak = '/private/path'; raw.quarantine.file_name = 'secret.pdf'; raw.sources.url = 'https://x'; raw.comparison.baseline.reply = 'text';
    const out = parseKnowledgeStatus(raw);
    expect(out.chunks.total).toBe(3751);
    const text = JSON.stringify(out);
    for (const leak of ['leak', 'private', 'secret.pdf', 'https://', 'reply']) expect(text).not.toContain(leak);
  });
  it.each([
    ['wrong version', (r: any) => { r.schema_version = 2; }],
    ['not staging', (r: any) => { r.mode = 'PRODUCTION'; }],
    ['negative count', (r: any) => { r.chunks.total = -1; }],
    ['fractional count', (r: any) => { r.chunks.total = 1.5; }],
    ['text as a count', (r: any) => { r.chunks.total = '3751'; }],
    ['missing section', (r: any) => { delete r.review; }],
    ['missing count', (r: any) => { delete r.review.production.approved; }],
    ['bad time', (r: any) => { r.generated_utc = 'yesterday'; }],
    ['unknown outcome', (r: any) => { r.comparison.outcome = 'APPROVED'; }],
    ['path in an identifier', (r: any) => { r.sources.named_missing = ['D:\\TaxGuard\\x']; }],
    ['bad run id', (r: any) => { r.evaluation.run_id = '<script>'; }],
    ['bad measure', (r: any) => { r.comparison.improved.search_median_ms = 'fast'; }],
    ['array for a section', (r: any) => { r.scheduler = []; }],
  ])('refuses %s', (_name, change) => {
    const raw = valid();
    change(raw);
    expect(() => parseKnowledgeStatus(raw)).toThrow();
  });
  it('keeps an absent report as null, never as zero', () => {
    const raw = valid();
    raw.comparison = null; raw.tax_year = null;
    const out = parseKnowledgeStatus(raw);
    expect(out.comparison).toBeNull();
    expect(out.tax_year).toBeNull();
  });

  const write = (text: string) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-')); const file = path.join(dir, 's.json'); fs.writeFileSync(file, text); return file; };
  it('reads a valid file', async () => {
    const out = await readKnowledgeStatus(write(JSON.stringify(valid())));
    expect(out).toMatchObject({ status: 'AVAILABLE' });
  });
  it('reports a missing, malformed, invalid or oversized file as unavailable, with no figures', async () => {
    expect(await readKnowledgeStatus(path.join(os.tmpdir(), 'no-such-status.json'))).toEqual({ status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_NOT_FOUND' });
    expect(await readKnowledgeStatus(write('{not json'))).toEqual({ status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_INVALID' });
    expect(await readKnowledgeStatus(write(JSON.stringify({ ...valid(), mode: 'X' })))).toEqual({ status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_INVALID' });
    expect(await readKnowledgeStatus(write(' '.repeat(300 * 1024)))).toEqual({ status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_INVALID' });
    expect(await readKnowledgeStatus(os.tmpdir())).toEqual({ status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_NOT_FOUND' });
  });
});
