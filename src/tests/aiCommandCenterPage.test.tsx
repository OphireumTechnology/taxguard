import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../services/api', () => ({ api: { caseAuthority: { getAiControlCenter: vi.fn(() => new Promise(() => {})) } } }));
import { AiCommandCenterPage, CommandCenterView, ModuleCard, commandCenterError, type CommandCenterReport } from '../components/admin/commandCenter/AiCommandCenterPage';
import { resolveCanonicalPageRoute } from '../config/canonicalRouting';
import { COMMAND_CENTER_LIFECYCLE, COMMAND_CENTER_MODULES, COMMAND_CENTER_SECTIONS } from '../server/ai/commandCenter/commandCenterManifest';

// Block 108: what the Command Center renders from a server report. Clicks, keyboard use and layout run in a real browser
// in src/tests-e2e/19-ai-command-center.e2e.test.ts.
const side = { document_recall_at_1: 8, document_recall_at_3: 13, document_recall_at_5: 15, passage_recall_at_1: 1, passage_recall_at_3: 5, passage_recall_at_5: 6, cited_evidence_passage: 9, answered_without_evidence: 8, invented_citations: 0, correctly_refused: 9, search_median_ms: 1.16 };
const snapshot = {
  generated_utc: '2026-11-03T03:46:38.000Z', sources: { registered: 11, active: 3, proposed: 6, blocked: 2, named_total: 7, named_staged: 4, named_missing: ['IRS_P17'], categories_without_documents: ['ACCOUNTING'] },
  discovery: { candidates_checked: 73, verified: 44, rejected: 0 }, quarantine: { documents: 38, approved: 0 }, extraction: { documents: 38, pages: 1258, findings: 1079, defect_findings: 542 }, chunks: { total: 3751, held_from_embedding: 0, embeddings: 3658 },
  review: { queue_awaiting: 104, staging: { pending: 3751, approved: 0, rejected: 0 }, production: { pending: 1488, approved: 0, rejected: 0, superseded: 0 } }, evaluation: { run_id: '20261103T025825Z', recommend_for_human_review: 34, needs_correction: 4, hold: 0 },
  comparison: { outcome: 'RETAIN_BASELINE', questions: 21, refusal_items: 10, baseline: side, improved: { ...side, passage_recall_at_5: 2 }, generated_utc: '2026-11-03T02:57:41.000Z' },
  tax_year: { tax_year_editions: 13, revision_editions: 19, dated_publications: 1, undated: 5, conflicts: 2 }, warnings: { integrity_failures: 0, suspicious_documents: 0, active_content_documents: 29 }, scheduler: { tasks_enabled: 0 },
};
const report = (patch: Partial<CommandCenterReport> = {}): CommandCenterReport => ({
  checked_at: '2026-11-03T04:00:00.000Z', sections: COMMAND_CENTER_SECTIONS, modules: COMMAND_CENTER_MODULES, lifecycle: COMMAND_CENTER_LIFECYCLE,
  governance: { agents_by_status: { DRAFT: 61 }, runs_by_status: { REVIEW_REQUIRED: 2 }, global_stop: false, active_stops: 1, security_events_24h: 3 },
  knowledge: { status: 'AVAILABLE', snapshot }, inference: { status: 'AVAILABLE', model_installed: true, model_loaded: false }, ...patch,
});
const VIEWS = ['architecture', 'knowledge', 'inference', 'tax_preparation', 'governance', 'evaluation', 'operations', 'lifecycle'];
const show = (initialView: string, value = report()) => renderToStaticMarkup(<CommandCenterView report={value} onRefresh={() => undefined} initialView={initialView} />);
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const metric = (html: string, label: string) => html.match(new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>([^<]*)</dd>`))?.[1];
const module = (id: string) => COMMAND_CENTER_MODULES.find(m => m.id === id)!;

describe('AI Command Center page', () => {
  it('shows a loading state, and no figure, before the server answers', () => {
    const html = renderToStaticMarkup(<AiCommandCenterPage />);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('ai-command-center');
  });

  it('gives a reason on refusal and promises no stale figures on failure', () => {
    expect(commandCenterError({ code: 'AI_CONTROL_CENTER_ROLE_DENIED' })).toBe('Your role is not authorized to view the AI Command Center.');
    expect(commandCenterError({ code: 'ANYTHING' })).toContain('No figures are shown');
    expect(commandCenterError(null)).toContain('No figures are shown');
  });

  it('has no control that approves, grants or activates anything, on any view', () => {
    for (const view of VIEWS) {
      const labels = [...show(view).matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, ' ').trim());
      expect(labels.length, view).toBeGreaterThan(0);
      for (const label of labels) expect(label, view).not.toMatch(/^(approve|reject|activate|enable|grant|commission|sign|file|submit|promote|deploy)\b/i);
    }
  });

  it('names no runtime, vendor, address or old product name, on any view', () => {
    for (const view of VIEWS) expect(show(view), view).not.toMatch(/ollama|qwen|alibaba|11434|127\.0\.0\.1|ophir(?!eum)|proprietary/i);
  });

  it('states the product identity and that it is read-only', () => {
    expect(text(show('architecture'))).toContain('TaxGuard AI, developed and operated by Ophireum Technology. Read-only.');
  });

  it('tells implemented, planned, unavailable and blocked apart in words, with true counts', () => {
    const html = show('architecture');
    for (const status of ['IMPLEMENTED', 'PLANNED', 'UNAVAILABLE', 'BLOCKED'] as const) {
      const label = status[0] + status.slice(1).toLowerCase();
      expect(html).toContain(`${label}: ${COMMAND_CENTER_MODULES.filter(m => m.status === status).length}`);
    }
    expect(text(html)).toMatch(/Implemented means built and tested locally\. Nothing here is deployed\./);
  });

  it('lists every module on the master plan, in the six sections', () => {
    const html = show('architecture');
    for (const section of COMMAND_CENTER_SECTIONS) expect(html).toContain(section.name);
    for (const m of COMMAND_CENTER_MODULES) expect(text(html)).toContain(m.name.replace(/&/g, '&amp;'));
  });

  it('collapses a module until it is opened, using a real button', () => {
    const closed = renderToStaticMarkup(<ModuleCard module={module('source-registry')} report={report()} />);
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain('<button');
    expect(closed).not.toContain('test_research_foundation.py');
  });

  it('shows evidence, gate and live source when a module is open', () => {
    const open = text(renderToStaticMarkup(<ModuleCard module={module('source-registry')} report={report()} initialOpen />));
    expect(open).toContain('test_research_foundation.py');
    expect(open).toContain('Approval gate: The owner approves any new source.');
    expect(open).toContain('Status file from');
    const blocked = text(renderToStaticMarkup(<ModuleCard module={module('scheduled-learning')} report={report()} initialOpen />));
    expect(blocked).toContain('Blocker: Stays disabled until the owner separately authorizes it.');
    expect(blocked).toContain('Evidence: None yet.');
  });

  it('only claims a live reading the report supports', () => {
    const noKnowledge = report({ knowledge: { status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_NOT_FOUND' } });
    expect(text(renderToStaticMarkup(<ModuleCard module={module('quarantine')} report={noKnowledge} initialOpen />))).toContain('Live status: unavailable');
    const down = report({ inference: { status: 'UNAVAILABLE' } });
    expect(text(renderToStaticMarkup(<ModuleCard module={module('inference-service')} report={down} initialOpen />))).toContain('Live: engine not responding');
    expect(text(renderToStaticMarkup(<ModuleCard module={module('case-workflow')} report={report()} initialOpen />))).not.toMatch(/Live/);
  });

  it('shows pipeline figures exactly as the server gave them', () => {
    const html = show('knowledge');
    expect(metric(html, 'Documents in quarantine')).toBe('38');
    expect(metric(html, 'Embeddings')).toBe('3,658');
    expect(metric(html, 'Memory chunks approved')).toBe('0');
    expect(metric(html, 'Memory chunks pending')).toBe('1,488');
    expect(metric(html, 'Queue items awaiting a person')).toBe('104');
    expect(metric(html, 'Date conflicts for review')).toBe('2');
    expect(metric(html, 'Documents with active content')).toBe('29');
    expect(text(html)).toContain('Named documents not staged: IRS_P17.');
    expect(text(html)).toContain('Scheduled learning tasks enabled: 0.');
  });

  it('shows no invented figure when the knowledge status is unavailable', () => {
    const value = report({ knowledge: { status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_NOT_FOUND' } });
    const html = show('knowledge', value);
    expect(text(html)).toContain('The knowledge status is unavailable on this server, so no figures are shown.');
    expect(html).not.toContain('Embeddings</dt>');
    expect(text(show('evaluation', value))).toContain('The evaluation status is unavailable');
  });

  it('reports a missing tax-year or comparison report as unavailable, not as zero', () => {
    const value = report({ knowledge: { status: 'AVAILABLE', snapshot: { ...snapshot, tax_year: null, comparison: null } } });
    expect(text(show('knowledge', value))).toContain('Tax-year coverage is unavailable');
    expect(text(show('evaluation', value))).toContain('The retrieval comparison is unavailable');
  });

  it('states a failed comparison plainly, with both columns', () => {
    const html = show('evaluation');
    expect(text(html)).toContain('the baseline stays');
    expect(html).toMatch(/Right passage, top 5<\/th><td[^>]*>6<\/td><td[^>]*>2<\/td>/);
    expect(text(html)).toContain('A recommendation is not an approval. Not validated by a tax professional.');
  });

  it('shows a confirmed comparison only when the server says so', () => {
    const value = report({ knowledge: { status: 'AVAILABLE', snapshot: { ...snapshot, comparison: { ...snapshot.comparison, outcome: 'HELD_OUT_IMPROVEMENT_CONFIRMED' } } } });
    expect(text(show('evaluation', value))).toContain('the improvement was confirmed on held-out questions');
  });

  it('shows inference health without details, and a down engine plainly', () => {
    const up = show('inference');
    expect(metric(up, 'TaxGuard AI Inference Engine')).toBe('Responding');
    expect(metric(up, 'Model installed')).toBe('Yes');
    expect(metric(up, 'Model in memory')).toBe('No');
    expect(metric(up, 'Agents commissioned')).toBe('0');
    const down = show('inference', report({ inference: { status: 'UNAVAILABLE' } }));
    expect(metric(down, 'TaxGuard AI Inference Engine')).toBe('Not responding');
    expect(metric(down, 'Model installed')).toBe('Not reported');
  });

  it('shows governance figures and offers the existing control center view', () => {
    const html = show('governance');
    expect(metric(html, 'Agents recorded')).toBe('61');
    expect(metric(html, 'Runs awaiting human review')).toBe('2');
    expect(metric(html, 'Global emergency stop')).toBe('Not active');
    expect(html).toContain('Show governance decisions');
    expect(metric(show('governance', report({ governance: { agents_by_status: {}, runs_by_status: {}, global_stop: true, active_stops: 1, security_events_24h: 0 } })), 'Global emergency stop')).toBe('Active');
  });

  it('shows the lifecycle in order with evidence and blockers, none complete', () => {
    const html = show('lifecycle');
    const headings = [...html.matchAll(/<h3[^>]*>([^<]*(?:<!-- -->[^<]*)*)<\/h3>/g)].map(m => m[1].replace(/<!-- -->/g, ''));
    expect(headings).toEqual(['1. Plan', '2. Develop', '3. Test', '4. Evaluate', '5. Review', '6. Deploy', '7. Operate and improve']);
    expect(text(html)).not.toMatch(/\bComplete\b/);
    expect(html.match(/Blockers:/g)).toHaveLength(7);
    expect(html.match(/Approval gates:/g)).toHaveLength(7);
  });

  it('marks the current view for assistive technology', () => {
    expect(show('evaluation')).toMatch(/aria-current="page"[^>]*>Evaluation Center</);
    expect(show('evaluation').match(/aria-current="page"/g)).toHaveLength(1);
    expect(show('evaluation')).toContain('aria-label="Collapse navigation"');
  });

  it('has its own clean path', () => {
    expect(resolveCanonicalPageRoute('/admin/master/ai')).toBe('ai_command_center');
  });
});
