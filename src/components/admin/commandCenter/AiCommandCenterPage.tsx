import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';
import { api } from '../../../services/api';

const AiControlCenterPanel = lazy(() => import('../AiControlCenterPanel').then(m => ({ default: m.AiControlCenterPanel })));

/**
 * The TaxGuard AI Command Center. Everything shown comes from one server read that re-verifies the governance role: on
 * refusal or failure the page shows the reason and no figures. It has no action of its own and calls nothing that writes.
 * A figure the server does not report is shown as not reported, never as zero.
 */
type ModuleStatus = 'IMPLEMENTED' | 'PLANNED' | 'UNAVAILABLE' | 'BLOCKED';
type LifecycleStatus = 'IN_PROGRESS' | 'BLOCKED' | 'NOT_STARTED';
type LiveSource = 'knowledge' | 'inference' | 'governance';
export interface CommandCenterModule { id: string; section: string; name: string; status: ModuleStatus; description: string; evidence: string[]; blocker?: string; gate?: string; link?: { label: string; href: string }; live?: LiveSource }
export interface LifecycleStage { id: string; name: string; status: LifecycleStatus; evidence: string[]; blockers: string[]; gates: string[] }
type Side = Record<'document_recall_at_1' | 'document_recall_at_3' | 'document_recall_at_5' | 'passage_recall_at_1' | 'passage_recall_at_3' | 'passage_recall_at_5' | 'cited_evidence_passage' | 'answered_without_evidence' | 'invented_citations' | 'correctly_refused' | 'search_median_ms', number>;
export interface KnowledgeSnapshot {
  generated_utc: string;
  sources: { registered: number; active: number; proposed: number; blocked: number; named_total: number; named_staged: number; named_missing: string[]; categories_without_documents: string[] };
  discovery: { candidates_checked: number; verified: number; rejected: number };
  quarantine: { documents: number; approved: number };
  extraction: { documents: number; pages: number; findings: number; defect_findings: number };
  chunks: { total: number; held_from_embedding: number; embeddings: number };
  review: { queue_awaiting: number; staging: { pending: number; approved: number; rejected: number }; production: { pending: number; approved: number; rejected: number; superseded: number } };
  evaluation: { run_id: string | null; recommend_for_human_review: number; needs_correction: number; hold: number };
  comparison: { outcome: string; questions: number; refusal_items: number; baseline: Side; improved: Side; generated_utc: string } | null;
  tax_year: { tax_year_editions: number; revision_editions: number; dated_publications: number; undated: number; conflicts: number } | null;
  warnings: { integrity_failures: number; suspicious_documents: number; active_content_documents: number };
  scheduler: { tasks_enabled: number };
}
export interface CommandCenterReport {
  checked_at: string;
  sections: { id: string; name: string; summary: string }[];
  modules: CommandCenterModule[];
  lifecycle: LifecycleStage[];
  governance: { agents_by_status: Record<string, number>; runs_by_status: Record<string, number>; global_stop: boolean; active_stops: number; security_events_24h: number };
  knowledge: { status: 'AVAILABLE'; snapshot: KnowledgeSnapshot } | { status: 'UNAVAILABLE'; code: string };
  inference: { status: 'AVAILABLE'; model_installed: boolean; model_loaded: boolean } | { status: 'UNAVAILABLE' };
}

const STATUS_LABEL: Record<ModuleStatus, string> = { IMPLEMENTED: 'Implemented', PLANNED: 'Planned', UNAVAILABLE: 'Unavailable', BLOCKED: 'Blocked' };
const STATUS_STYLE: Record<ModuleStatus, string> = {
  IMPLEMENTED: 'bg-teal-50 text-teal-900 border-teal-700', PLANNED: 'bg-slate-100 text-slate-800 border-slate-500',
  UNAVAILABLE: 'bg-amber-50 text-amber-900 border-amber-700', BLOCKED: 'bg-red-50 text-red-900 border-red-700',
};
const STAGE_LABEL: Record<LifecycleStatus, string> = { IN_PROGRESS: 'In progress', BLOCKED: 'Blocked', NOT_STARTED: 'Not started' };
const STAGE_STYLE: Record<LifecycleStatus, ModuleStatus> = { IN_PROGRESS: 'IMPLEMENTED', BLOCKED: 'BLOCKED', NOT_STARTED: 'PLANNED' };
const DENIED: Record<string, string> = {
  AI_CONTROL_CENTER_ROLE_DENIED: 'Your role is not authorized to view the AI Command Center.',
  AI_AUTH_REQUIRED: 'Your session could not be verified. Sign in again.',
};
export const commandCenterError = (error: { code?: string } | null | undefined): string => DENIED[error?.code ?? ''] ?? 'The AI Command Center service is unavailable. No figures are shown rather than stale or estimated ones.';
const when = (value: string) => new Date(value).toLocaleString();
const sum = (values: Record<string, number>) => Object.values(values).reduce((total, value) => total + value, 0);

function Badge({ status, label }: { status: ModuleStatus; label?: string }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>{label ?? STATUS_LABEL[status]}</span>;
}

function Metric({ label, value }: { label: string; value: number | string | null | undefined }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3"><dt className="text-xs text-slate-600">{label}</dt><dd className="text-xl font-bold text-[#0B1F3A]">{value === null || value === undefined ? 'Not reported' : typeof value === 'number' ? value.toLocaleString() : value}</dd></div>;
}

function Metrics({ label, items }: { label: string; items: [string, number | string | null | undefined][] }) {
  return <dl aria-label={label} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{items.map(([name, value]) => <Metric key={name} label={name} value={value} />)}</dl>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const id = 'cc-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return <section aria-labelledby={id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 id={id} className="font-bold text-[#0B1F3A]">{title}</h3>{children}</section>;
}

function liveText(module: CommandCenterModule, report: CommandCenterReport): string | null {
  if (module.live === 'knowledge') return report.knowledge.status === 'AVAILABLE' ? `Status file from ${when(report.knowledge.snapshot.generated_utc)}` : 'Live status: unavailable';
  if (module.live === 'inference') return report.inference.status === 'AVAILABLE' ? (report.inference.model_installed ? 'Live: engine responding, model installed' : 'Live: engine responding, model not installed') : 'Live: engine not responding';
  if (module.live === 'governance') return report.governance.global_stop ? 'Live: global emergency stop active' : `Live: ${report.governance.active_stops.toLocaleString()} active stops`;
  return null;
}

export function ModuleCard({ module, report, initialOpen = false }: { module: CommandCenterModule; report: CommandCenterReport; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const panel = 'cc-module-' + module.id;
  const live = liveText(module, report);
  return <li className="rounded-lg border border-slate-200 bg-white">
    <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(value => !value)} className="flex w-full items-start gap-2 p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
      {open ? <ChevronDown aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" /> : <ChevronRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />}
      <span className="min-w-0 flex-1 font-semibold text-[#0B1F3A]">{module.name}</span>
      <Badge status={module.status} />
    </button>
    {open && <div id={panel} className="space-y-2 border-t border-slate-200 p-3 text-sm text-slate-800">
      <p>{module.description}</p>
      {live && <p className="font-medium text-teal-900">{live}</p>}
      {module.blocker && <p><strong>Blocker:</strong> {module.blocker}</p>}
      {module.gate && <p><strong>Approval gate:</strong> {module.gate}</p>}
      <div><strong>Evidence:</strong> {module.evidence.length ? <ul className="list-disc pl-5">{module.evidence.map(path => <li key={path} className="break-words font-mono text-xs">{path}</li>)}</ul> : ' None yet.'}</div>
      {module.link && <a href={module.link.href} className="inline-block font-semibold text-teal-800 underline">{module.link.label}</a>}
    </div>}
  </li>;
}

function ModuleList({ section, report }: { section: string; report: CommandCenterReport }) {
  return <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">{report.modules.filter(m => m.section === section).map(m => <ModuleCard key={m.id} module={m} report={report} />)}</ul>;
}

/** An existing Control Center view, kept in its own dark frame so it is reused rather than rebuilt. */
function ExistingView({ view, label }: { view: 'registry' | 'evaluations' | 'local-model' | 'decisions' | 'security-events'; label: string }) {
  const [open, setOpen] = useState(false);
  return <div>
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="rounded-lg border border-[#0B1F3A] px-3 py-1.5 text-sm font-semibold text-[#0B1F3A] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">{open ? 'Hide' : 'Show'} {label}</button>
    {open && <div className="mt-3 rounded-xl bg-[#0D2745] p-4"><Suspense fallback={<p role="status" className="text-white">Loading…</p>}><AiControlCenterPanel initialView={view} /></Suspense></div>}
  </div>;
}

function Unavailable({ what }: { what: string }) {
  return <p role="status" className="rounded-lg border border-amber-700 bg-amber-50 p-3 text-sm text-amber-900">{what} is unavailable on this server, so no figures are shown.</p>;
}

function KnowledgeSection({ report }: { report: CommandCenterReport }) {
  if (report.knowledge.status !== 'AVAILABLE') return <Unavailable what="The knowledge status" />;
  const s = report.knowledge.snapshot;
  return <div className="space-y-4">
    <p className="text-sm text-slate-700">Staging counts from the knowledge status file written {when(s.generated_utc)}. Staging only.</p>
    <Card title="Research pipeline"><Metrics label="Research pipeline" items={[['Sources registered', s.sources.registered], ['Sources active', s.sources.active], ['Candidates checked', s.discovery.candidates_checked], ['Candidates verified', s.discovery.verified], ['Documents in quarantine', s.quarantine.documents], ['Documents extracted', s.extraction.documents], ['Pages', s.extraction.pages], ['Chunks', s.chunks.total], ['Embeddings', s.chunks.embeddings], ['Chunks held from embedding', s.chunks.held_from_embedding]]} /></Card>
    <Card title="Human review"><Metrics label="Human review" items={[['Queue items awaiting a person', s.review.queue_awaiting], ['Staged chunks pending', s.review.staging.pending], ['Staged chunks approved', s.review.staging.approved], ['Staged chunks rejected', s.review.staging.rejected], ['Memory chunks pending', s.review.production.pending], ['Memory chunks approved', s.review.production.approved], ['Memory chunks rejected', s.review.production.rejected]]} /></Card>
    <Card title="Tax-year coverage">{s.tax_year ? <Metrics label="Tax-year coverage" items={[['Tied to a stated tax year', s.tax_year.tax_year_editions], ['Tied to a revision date', s.tax_year.revision_editions], ['Dated publications', s.tax_year.dated_publications], ['No date found', s.tax_year.undated], ['Date conflicts for review', s.tax_year.conflicts]]} /> : <Unavailable what="Tax-year coverage" />}</Card>
    <Card title="Source and quality warnings"><Metrics label="Source and quality warnings" items={[['Source integrity failures', s.warnings.integrity_failures], ['Suspicious documents', s.warnings.suspicious_documents], ['Documents with active content', s.warnings.active_content_documents], ['Extraction findings', s.extraction.findings], ['Extraction defects', s.extraction.defect_findings], ['Named documents staged', `${s.sources.named_staged} of ${s.sources.named_total}`]]} />
      {s.sources.named_missing.length > 0 && <p className="text-sm text-slate-800">Named documents not staged: {s.sources.named_missing.join(', ')}.</p>}
      {s.sources.categories_without_documents.length > 0 && <p className="text-sm text-slate-800">Categories with no documents: {s.sources.categories_without_documents.join(', ')}.</p>}
      <p className="text-sm text-slate-800">Scheduled learning tasks enabled: {s.scheduler.tasks_enabled}.</p>
    </Card>
  </div>;
}

const COMPARISON_ROWS: [keyof Side, string][] = [['document_recall_at_1', 'Right document, top 1'], ['document_recall_at_3', 'Right document, top 3'], ['document_recall_at_5', 'Right document, top 5'], ['passage_recall_at_1', 'Right passage, top 1'], ['passage_recall_at_3', 'Right passage, top 3'], ['passage_recall_at_5', 'Right passage, top 5'], ['cited_evidence_passage', 'Cited the passage holding the evidence'], ['answered_without_evidence', 'Answered when the evidence was not retrieved'], ['invented_citations', 'Invented citations'], ['correctly_refused', 'Correct refusals'], ['search_median_ms', 'Search time, median (ms)']];

function EvaluationSection({ report }: { report: CommandCenterReport }) {
  if (report.knowledge.status !== 'AVAILABLE') return <Unavailable what="The evaluation status" />;
  const { evaluation, comparison } = report.knowledge.snapshot;
  return <div className="space-y-4">
    <Card title="Latest knowledge evaluation"><Metrics label="Latest knowledge evaluation" items={[['Recommended for human review', evaluation.recommend_for_human_review], ['Needs correction first', evaluation.needs_correction], ['On hold', evaluation.hold]]} /><p className="text-sm text-slate-800">A recommendation is not an approval. Not validated by a tax professional.</p></Card>
    <Card title="Retrieval comparison, held-out questions">{comparison ? <>
      <p className="text-sm font-semibold text-slate-900">{comparison.outcome === 'RETAIN_BASELINE' ? 'Result: the baseline stays. The improved retriever did not pass.' : 'Result: the improvement was confirmed on held-out questions.'} {comparison.questions} questions and {comparison.refusal_items} refusal tests, {when(comparison.generated_utc)}.</p>
      <div className="overflow-x-auto"><table className="w-full bg-white text-left text-sm"><caption className="sr-only">Baseline and improved retrieval on held-out questions</caption>
        <thead><tr className="text-[#0B1F3A]"><th scope="col" className="p-2">Measure</th><th scope="col" className="p-2">Baseline</th><th scope="col" className="p-2">Improved</th></tr></thead>
        <tbody>{COMPARISON_ROWS.map(([key, label]) => <tr key={key} className="border-t border-slate-200"><th scope="row" className="p-2 font-normal">{label}</th><td className="p-2">{comparison.baseline[key]}</td><td className="p-2">{comparison.improved[key]}</td></tr>)}</tbody>
      </table></div></> : <Unavailable what="The retrieval comparison" />}</Card>
  </div>;
}

function InferenceSection({ report }: { report: CommandCenterReport }) {
  const { inference } = report;
  return <Metrics label="Inference engine" items={[['TaxGuard AI Inference Engine', inference.status === 'AVAILABLE' ? 'Responding' : 'Not responding'], ['Model installed', inference.status === 'AVAILABLE' ? (inference.model_installed ? 'Yes' : 'No') : null], ['Model in memory', inference.status === 'AVAILABLE' ? (inference.model_loaded ? 'Yes' : 'No') : null], ['Agents commissioned', report.governance.agents_by_status.ACTIVE ?? 0]]} />;
}

function GovernanceSection({ report }: { report: CommandCenterReport }) {
  const { governance } = report;
  return <Metrics label="AI governance" items={[['Agents recorded', sum(governance.agents_by_status)], ['Runs awaiting human review', governance.runs_by_status.REVIEW_REQUIRED ?? 0], ['Failed runs', governance.runs_by_status.FAILED ?? 0], ['Security events, last 24 hours', governance.security_events_24h], ['Global emergency stop', governance.global_stop ? 'Active' : 'Not active'], ['Active stops', governance.active_stops]]} />;
}

function Architecture({ report }: { report: CommandCenterReport }) {
  return <div className="space-y-4">
    <p className="text-sm text-slate-700">Select a module for its description, status, evidence and approval gate. Implemented means built and tested locally. Nothing here is deployed.</p>
    <ul aria-label="Status key" className="flex flex-wrap gap-2">{(Object.keys(STATUS_LABEL) as ModuleStatus[]).map(s => <li key={s}><Badge status={s} label={`${STATUS_LABEL[s]}: ${report.modules.filter(m => m.status === s).length}`} /></li>)}</ul>
    {report.sections.map(section => <Card key={section.id} title={section.name}><p className="text-sm text-slate-700">{section.summary}</p><ModuleList section={section.id} report={report} /></Card>)}
  </div>;
}

function Lifecycle({ report }: { report: CommandCenterReport }) {
  return <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{report.lifecycle.map((stage, index) => <li key={stage.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
    <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-[#0B1F3A]">{index + 1}. {stage.name}</h3><Badge status={STAGE_STYLE[stage.status]} label={STAGE_LABEL[stage.status]} /></div>
    <div><strong>Evidence:</strong> {stage.evidence.length ? <ul className="list-disc pl-5">{stage.evidence.map(path => <li key={path} className="break-words font-mono text-xs">{path}</li>)}</ul> : ' None yet.'}</div>
    <div><strong>Blockers:</strong> {stage.blockers.length ? <ul className="list-disc pl-5">{stage.blockers.map(item => <li key={item}>{item}</li>)}</ul> : ' None recorded.'}</div>
    <div><strong>Approval gates:</strong> {stage.gates.join('; ') || 'None recorded.'}</div>
  </li>)}</ol>;
}

const VIEWS: { id: string; name: string }[] = [{ id: 'architecture', name: 'Master plan' }, { id: 'knowledge', name: 'Knowledge Engine' }, { id: 'inference', name: 'AI Inference' }, { id: 'tax_preparation', name: 'Tax Preparation' }, { id: 'governance', name: 'Human Governance' }, { id: 'evaluation', name: 'Evaluation Center' }, { id: 'operations', name: 'System Operations' }, { id: 'lifecycle', name: 'Development lifecycle' }];

export function CommandCenterView({ report, onRefresh, initialView = 'architecture' }: { report: CommandCenterReport; onRefresh: () => void; initialView?: string }) {
  const [view, setView] = useState(initialView);
  const [navOpen, setNavOpen] = useState(true);
  const current = VIEWS.find(v => v.id === view)!;
  const section = report.sections.find(s => s.id === view);
  return <div className="flex min-h-full flex-col bg-white text-slate-900 md:flex-row" data-testid="ai-command-center">
    <nav aria-label="AI Command Center" className={`shrink-0 border-b border-slate-200 bg-white p-3 md:border-b-0 md:border-r ${navOpen ? 'md:w-60' : 'md:w-14'}`}>
      <button type="button" aria-expanded={navOpen} aria-controls="cc-nav-list" aria-label={navOpen ? 'Collapse navigation' : 'Expand navigation'} onClick={() => setNavOpen(value => !value)} className="rounded p-1.5 text-[#0B1F3A] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
        {navOpen ? <PanelLeftClose aria-hidden="true" className="h-5 w-5" /> : <PanelLeftOpen aria-hidden="true" className="h-5 w-5" />}
      </button>
      {navOpen && <ul id="cc-nav-list" className="mt-2 grid grid-cols-2 gap-1 md:grid-cols-1">{VIEWS.map(v => <li key={v.id}>
        <button type="button" aria-current={view === v.id ? 'page' : undefined} onClick={() => setView(v.id)} className={`w-full rounded-lg border-l-4 px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${view === v.id ? 'border-[#B8902F] bg-slate-100 font-bold text-[#0B1F3A]' : 'border-transparent text-slate-700 hover:bg-slate-50'}`}>{v.name}</button>
      </li>)}</ul>}
    </nav>
    <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div><h1 className="text-xl font-bold text-[#0B1F3A]">TaxGuard AI Command Center</h1>
          <p className="text-sm text-slate-700">TaxGuard AI, developed and operated by Ophireum Technology. Read-only. Checked {when(report.checked_at)}.</p></div>
        <button type="button" onClick={onRefresh} className="flex items-center gap-1 rounded-lg border border-slate-400 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</button>
      </header>
      <h2 className="text-lg font-bold text-[#0B1F3A]">{current.name}</h2>
      {section && <p className="text-sm text-slate-700">{section.summary}</p>}
      {view === 'architecture' && <Architecture report={report} />}
      {view === 'lifecycle' && <Lifecycle report={report} />}
      {view === 'knowledge' && <KnowledgeSection report={report} />}
      {view === 'inference' && <><InferenceSection report={report} /><ExistingView view="local-model" label="restricted model diagnostics" /></>}
      {view === 'governance' && <><GovernanceSection report={report} /><ExistingView view="decisions" label="governance decisions" /></>}
      {view === 'evaluation' && <><EvaluationSection report={report} /><ExistingView view="evaluations" label="agent evaluation records" /></>}
      {view === 'operations' && <ExistingView view="security-events" label="AI security events" />}
      {section && <ModuleList section={section.id} report={report} />}
    </main>
  </div>;
}

export function AiCommandCenterPage() {
  const [state, setState] = useState<{ report?: CommandCenterReport; message?: string }>({});
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setState({});
    api.caseAuthority.getAiControlCenter('command-center', {}, abort.signal)
      .then(report => { if (!abort.signal.aborted) setState({ report: report as unknown as CommandCenterReport }); })
      .catch(error => { if (!abort.signal.aborted) setState({ message: commandCenterError(error) }); });
    return () => abort.abort();
  }, [refresh]);
  if (state.message) return <div className="bg-white p-6"><h1 className="text-xl font-bold text-[#0B1F3A]">TaxGuard AI Command Center</h1><p role="alert" className="mt-2 text-slate-900">{state.message}</p></div>;
  if (!state.report) return <div className="bg-white p-6"><p role="status" className="text-slate-900">Loading the AI Command Center…</p></div>;
  return <CommandCenterView report={state.report} onRefresh={() => setRefresh(value => value + 1)} />;
}
