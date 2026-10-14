import { CaseWorkpaperList } from './CaseWorkpaperList';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlarmClock, ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, FileSearch, FolderOpen, PanelLeftClose,
  PanelLeftOpen, RefreshCw, Search, X, Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { accountantAccess, useAccountantDashboardData } from '../../hooks/useAccountantDashboardData';
import { DashboardApplicationShell } from '../layout/DashboardApplicationShell';
import { useDashboardInspection } from '../layout/dashboardInspection';
import { AccountantNavigation, ACCOUNTANT_NAV_SECTIONS } from './AccountantNavigation';
import {
  ACCOUNTANT_JOURNEY, ACCOUNTANT_STAGES, AccountantCase, confidence, DASHBOARD_KPIS, daysUntil, kpiValue,
  matchesQueue, QueueSortKey, sortCases, stageCounts, upcomingDeadlines, type DashboardDataState,
} from './accountantDashboardModel';
import './accountantDashboard.css';
import { DurableMyWorkPanel } from './DurableMyWorkPanel';
import { CaseWorkflowPanel } from './CaseWorkflowPanel';
import { StaffDocumentReviewPanel } from '../documents/StaffDocumentReviewPanel';
import { StaffMessageInboxPanel } from '../communications/StaffMessageInboxPanel';
import { AppointmentsPanel } from '../appointments/AppointmentsPanel';
import type { TaxWorkpaperEntity, StageStateEntity } from '../../server/taxguard/persistence.types';

const tabs = ['Overview','Client Info','Documents','AI Preparation','Tax Forms','Review & Edit','Workpapers','State Forms','Client Approval','E-File','History'];
const QUEUE_FILTERS = ['Assigned Cases','Needs Attention','Due Today','Overdue','Waiting on Client','Ready for Review','Client Approval'];
const SORT_COLUMNS: Array<{ key: QueueSortKey; label: string }> = [
  { key: 'client', label: 'Client' }, { key: 'taxYear', label: 'Tax Year' }, { key: 'stage', label: 'Stage' },
  { key: 'priority', label: 'Priority' }, { key: 'dueDate', label: 'Due Date' },
];
const NAV_STORAGE_KEY = 'tg.accountant.navigation';
export { accountantAccess };
interface Draft { returnId: string; tenantId: string; clientId: string; engagementId: string; taxYear: number; jurisdiction: string; status: string; returnType: string; version?: number; diagnostics: Array<{ message?: string }>; forms: Array<{ formNumber: string; formName: string; lineItems: Record<string, unknown> }>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="tg-accountant-empty">{children}</p>; }

/** Per-viewer convenience only: remembered sidebar layout. Storage may be unavailable. */
function readNavPreferences(): { iconOnly: boolean; expanded: Record<string, boolean> } {
  try {
    const parsed = JSON.parse(localStorage.getItem(NAV_STORAGE_KEY) || '{}');
    return { iconOnly: parsed.iconOnly === true, expanded: typeof parsed.expanded === 'object' && parsed.expanded ? parsed.expanded : {} };
  } catch { return { iconOnly: false, expanded: {} }; }
}
function writeNavPreferences(value: { iconOnly: boolean; expanded: Record<string, boolean> }) {
  try { localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(value)); } catch { /* optional */ }
}
function stageLabel(stage?: number) {
  return stage ? `${String(stage).padStart(2, '0')} ${ACCOUNTANT_STAGES[stage - 1]}` : 'Stage not verified';
}
function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function AccountantDashboard() {
  const { currentUser, authLifecycleState, setCurrentPage } = useApp();
  const idPrefix = useId();
  const [refresh, setRefresh] = useState(0);
  const { allowed, session, rows, loading, error, unavailableFields } = useAccountantDashboardData(currentUser, authLifecycleState, refresh);
  const dueDatesUnavailable = unavailableFields.includes('dueDate');
  // Inspection: no data is requested, so figures stay "unavailable" rather than showing zero.
  const inspecting = useDashboardInspection();
  const [selected, setSelected] = useState(''); const [filter, setFilter] = useState('Assigned Cases'); const [query, setQuery] = useState(''); const [year, setYear] = useState('All');
  const [stageFilter, setStageFilter] = useState(0);
  const [sort, setSort] = useState<{ key: QueueSortKey; direction: 'asc' | 'desc' }>({ key: 'dueDate', direction: 'asc' });
  const [tab, setTab] = useState('AI Preparation');
  const [navPrefs, setNavPrefs] = useState(readNavPreferences);
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [drafts, setDrafts] = useState<{ key: string; rows: Draft[]; error: string }>({key: '', rows: [], error: ''});
  const [preview, setPreview] = useState('');
  const [workpapers, setWorkpapers] = useState<{ key: string; rows: TaxWorkpaperEntity[]; error: string }>({key:'', rows:[], error:''});
  const [states, setStates] = useState<{ key: string; rows: StageStateEntity[]; error: string }>({key:'', rows:[], error:''});
  const searchRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<HTMLElement>(null);
  const caseRef = useRef<HTMLElement>(null);
  const item = rows.find(r => r.id === selected);
  const key = item ? JSON.stringify([session, item.id, item.tenantId, item.authorityClientId, item.engagementId, item.taxYear, refresh]) : '';
  useEffect(() => {
    setPreview('');
    setDrafts({key:'', rows:[], error:''}); setWorkpapers({key:'', rows:[], error:''}); setStates({key:'', rows:[], error:''});
    if (!allowed || !item) return;
    let live = true;
    const owns = (d: { tenantId: string; clientId: string; engagementId: string; taxYear: number }) => d.tenantId === item.tenantId && d.clientId === item.authorityClientId && d.engagementId === item.engagementId && d.taxYear === item.taxYear;
    api.caseAuthority.listWorkpapers(item.tenantId, item.authorityClientId, item.engagementId, item.taxYear).then(data => { if(live) setWorkpapers({key, rows:data.filter(owns), error:''}); }).catch(()=>{if(live)setWorkpapers({key, rows:[], error:'Scoped workpaper service unavailable.'});});
    api.caseAuthority.getStages(item.tenantId, item.authorityClientId, item.engagementId, item.taxYear).then(data => { if(live) setStates({key, rows:data.filter(owns), error:''}); }).catch(()=>{if(live)setStates({key, rows:[], error:'Scoped stage service unavailable.'});});
    api.caseAuthority.listDraftReturns(item.tenantId, item.authorityClientId, item.engagementId, item.taxYear).then(data => {
      const verified = data.filter((d: Draft) => d.tenantId === item.tenantId && d.clientId === item.authorityClientId && d.engagementId === item.engagementId && d.taxYear === item.taxYear);
      if (live) setDrafts({ key, rows: verified, error: '' });
    }).catch(() => { if (live) setDrafts({key, rows: [], error: 'Draft return service unavailable for this case.'}); });
    return () => { live = false; };
  }, [key, allowed]);

  const now = new Date(); const today = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  const dataState: DashboardDataState = inspecting && !allowed ? 'inspection' : loading ? 'loading' : error ? 'error' : 'ready';
  const ready = dataState === 'ready';
  const visible = useMemo(() => sortCases(rows.filter(r => matchesQueue(r, filter, today)
    && (year === 'All' || String(r.taxYear) === year)
    && (!stageFilter || r.activeStage === stageFilter)
    && (r.clientName + ' ' + r.taxYear).toLowerCase().includes(query.trim().toLowerCase())), sort.key, sort.direction),
    [rows, filter, today, year, stageFilter, query, sort]);
  const pipeline = useMemo(() => stageCounts(rows), [rows]);
  // Stage counts are only meaningful when at least one case has a verified workflow stage.
  const stagesKnown = ready && (rows.length === 0 || pipeline.unverified < rows.length);
  const deadlines = useMemo(() => upcomingDeadlines(rows, today), [rows, today]);
  const filtersActive = filter !== 'Assigned Cases' || year !== 'All' || stageFilter !== 0 || query.trim() !== '';

  if (!allowed && !inspecting) return <div role="alert">Authenticated accountant access is required.</div>;

  const returns = drafts.key === key ? drafts.rows : [];
  const forms = returns.flatMap(d => (d.forms || []).map(f => ({ ...f, draft: d })));
  const shown = forms.find(f => f.draft.returnId + ':' + f.formNumber === preview);
  const choose = (r: AccountantCase) => { setSelected(r.id); setTab('AI Preparation'); setTimeout(() => caseRef.current?.focus(), 0); };
  const clearFilters = () => { setFilter('Assigned Cases'); setYear('All'); setStageFilter(0); setQuery(''); };
  const showQueue = (f: string) => { setFilter(f); setStageFilter(0); queueRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const updateNav = (next: typeof navPrefs) => { setNavPrefs(next); writeNavPreferences(next); };
  const toggleSection = (id: string) => updateNav({ ...navPrefs, expanded: { ...navPrefs.expanded, [id]: navPrefs.expanded[id] === false } });
  const onNavigate = (label: string) => {
    setActiveNav(label);
    if (label === 'Dashboard') { clearFilters(); setSelected(''); return; }
    if (label === 'Search Clients') { searchRef.current?.focus(); return; }
    if (label === 'Form Library') { setCurrentPage('tax_forms_library'); return; }
    if (label === 'Account Security') { setCurrentPage('staff_account_security'); return; }
    const destinations: Record<string,string> = {'Document Review':'Documents','AI Document Prep':'AI Preparation','Tax Return (Draft)':'Tax Forms','E-Signature':'Client Approval','File to IRS/State':'E-File','Track Status':'History','Checklists':'Documents','State Tax Rules':'State Forms','AI Assistant':'AI Preparation'};
    if (destinations[label] || tabs.includes(label)) { setTab(destinations[label] || label); (item ? caseRef : queueRef).current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    showQueue(['My Cases','All Clients'].includes(label) ? 'Assigned Cases' : label);
  };
  const toggleSort = (k: QueueSortKey) => setSort(s => s.key === k ? { key: k, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { key: k, direction: 'asc' });
  const navFor = (iconOnly: boolean) => <AccountantNavigation idPrefix={`${idPrefix}${iconOnly ? 'i' : 'f'}`} iconOnly={iconOnly} expanded={navPrefs.expanded} activeLabel={activeNav} onToggleSection={toggleSection} onSelect={onNavigate} />;
  const firstName = currentUser?.name?.split(' ')[0];
  const nextDeadline = deadlines[0];

  return <DashboardApplicationShell id="accountant-dashboard-shell" workspace="accountant" title="Accountant Dashboard"
    navigation={navFor(navPrefs.iconOnly)} mobileNavigation={navFor(false)} navigationCollapsed={navPrefs.iconOnly}
    onSearch={() => searchRef.current?.focus()}
    headerTools={<button type="button" className="tg-shell-icon tg-acct-collapse" onClick={() => updateNav({ ...navPrefs, iconOnly: !navPrefs.iconOnly })}
      aria-label={navPrefs.iconOnly ? 'Expand navigation' : 'Collapse navigation to icons'} aria-pressed={navPrefs.iconOnly} title={navPrefs.iconOnly ? 'Expand navigation' : 'Collapse navigation'}>
      {navPrefs.iconOnly ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}</button>}>
    <div className="tg-accountant">
      <header className="tg-acct-welcome">
        <div>
          <p className="tg-acct-eyebrow">My work</p>
          <h1>{greeting(now)}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="tg-acct-subtle">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <button type="button" className="tg-acct-button" onClick={() => setRefresh(n => n + 1)} disabled={!allowed || loading}>
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
      </header>

      {dataState === 'inspection' && <p className="tg-acct-banner" role="note">Inspection mode: this layout is shown without case data. Figures are unavailable, not zero.</p>}
      {error && <p className="tg-acct-banner tg-acct-banner--error" role="alert">{error} <button type="button" className="tg-acct-link" onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
      {loading && !inspecting && <p className="tg-acct-sr-status" role="status">Loading authorized cases and workflow…</p>}

      {!inspecting && <DurableMyWorkPanel />}
      {/* Durable case workflow and document review, limited by the server to this preparer's assignments. */}
      {!inspecting && <CaseWorkflowPanel />}
      {!inspecting && <StaffDocumentReviewPanel />}
      {!inspecting && <StaffMessageInboxPanel />}
      {!inspecting && <AppointmentsPanel mode={{ kind: 'staff' }} actorId={currentUser?.id} />}
      <section className="tg-acct-kpis" aria-label="Key metrics">
        {DASHBOARD_KPIS.map(kpi => {
          const value = kpiValue(kpi.label, rows, today, dataState, unavailableFields);
          const usable = value.state === 'value';
          return <button type="button" key={kpi.label} className={`tg-acct-kpi${value.state !== 'value' ? ' tg-acct-kpi--muted' : ''}`}
            disabled={!usable} aria-pressed={usable ? filter === kpi.label : undefined} onClick={() => showQueue(kpi.label)}
            aria-label={`${kpi.label}: ${value.state === 'value' ? value.count : value.state === 'loading' ? 'loading' : `unavailable, ${value.reason}`}`}>
            <span className="tg-acct-kpi-label">{kpi.label}</span>
            <strong>{value.state === 'value' ? value.count : '—'}</strong>
            <small>{value.state === 'value' ? kpi.hint : value.state === 'loading' ? 'Loading…' : value.reason}</small>
          </button>;
        })}
      </section>

      <section className="tg-acct-card tg-acct-pipeline" aria-labelledby={`${idPrefix}-pipeline`}>
        <div className="tg-acct-card-head">
          <h2 id={`${idPrefix}-pipeline`}>Workflow pipeline</h2>
          <p className="tg-acct-subtle">Authoritative 18-stage workflow · select a stage to filter your queue</p>
        </div>
        <ol className="tg-acct-stages">
          {ACCOUNTANT_STAGES.map((name, i) => {
            const count = stagesKnown ? pipeline.counts[i] : null;
            const stage = i + 1;
            return <li key={name}>
              <button type="button" disabled={!stagesKnown || !count} aria-pressed={stageFilter === stage}
                onClick={() => { setStageFilter(stageFilter === stage ? 0 : stage); setFilter('Assigned Cases'); }}
                aria-label={`Stage ${String(stage).padStart(2, '0')} ${name}: ${count === null ? 'unavailable' : `${count} case${count === 1 ? '' : 's'}`}`}>
                <strong>{count === null ? '—' : count}</strong>
                <span><abbr title={name}>{String(stage).padStart(2, '0')}</abbr> {name}</span>
              </button>
            </li>;
          })}
        </ol>
        <p className="tg-acct-subtle">{!ready ? 'Stage counts are unavailable until authorized case data loads.'
          : !stagesKnown ? `Workflow stage data is not available for your ${rows.length} case${rows.length === 1 ? '' : 's'}, so stage counts are shown as unavailable rather than zero.`
          : `${pipeline.unverified} case${pipeline.unverified === 1 ? '' : 's'} without a verified workflow stage. Counts reflect accessible engagements only.`}</p>
      </section>

      <div className="tg-acct-grid">
        <section ref={queueRef} className="tg-acct-card tg-acct-queue" aria-labelledby={`${idPrefix}-queue`}>
          <div className="tg-acct-card-head">
            <h2 id={`${idPrefix}-queue`}>My Work Queue</h2>
            {ready && <p className="tg-acct-subtle" aria-live="polite">Showing {visible.length} of {rows.length}</p>}
          </div>
          <div className="tg-acct-toolbar">
            <label className="tg-acct-search">
              <Search size={15} aria-hidden="true" />
              <span className="tg-acct-visually-hidden">Search clients</span>
              <input ref={searchRef} type="search" placeholder="Search clients or tax year" value={query} onChange={e => setQuery(e.target.value)} />
            </label>
            <label className="tg-acct-select">Tax year
              <select value={year} onChange={e => setYear(e.target.value)}>
                <option>All</option>{[...new Set(rows.map(r => r.taxYear))].sort((a, b) => b - a).map(y => <option key={y}>{y}</option>)}
              </select>
            </label>
            <label className="tg-acct-select">Stage
              <select value={stageFilter} onChange={e => setStageFilter(Number(e.target.value))}>
                <option value={0}>All stages</option>{ACCOUNTANT_STAGES.map((s, i) => <option key={s} value={i + 1}>{stageLabel(i + 1)}</option>)}
              </select>
            </label>
            {filtersActive && <button type="button" className="tg-acct-link" onClick={clearFilters}><X size={14} aria-hidden="true" /> Clear filters</button>}
          </div>
          <div className="tg-acct-chips" role="group" aria-label="Queue filter">
            {QUEUE_FILTERS.map(f => <button type="button" key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'Assigned Cases' ? 'All' : f}</button>)}
          </div>
          <div className="tg-acct-table">
            <table>
              <caption className="tg-acct-visually-hidden">Authorized cases, sortable by column</caption>
              <thead><tr>{SORT_COLUMNS.map(c => <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" onClick={() => toggleSort(c.key)}>{c.label}{sort.key === c.key ? (sort.direction === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />) : <ArrowUpDown size={12} aria-hidden="true" />}</button>
              </th>)}</tr></thead>
              <tbody>{visible.map(r => {
                const overdue = r.dueDate && r.dueDate.slice(0, 10) < today && !['filed','completed','closed','archived'].includes(r.status);
                return <tr key={r.id} aria-selected={selected === r.id}>
                  <td><button type="button" className="tg-acct-case-link" onClick={() => choose(r)}>{r.clientName}</button></td>
                  <td>{r.taxYear}</td>
                  <td>{stageLabel(r.activeStage)}</td>
                  <td>{r.priority ? <span className={`tg-acct-priority tg-acct-priority--${r.priority}`}>{r.priority}</span> : 'Not recorded'}</td>
                  <td>{r.dueDate ? <span className={overdue ? 'tg-acct-overdue' : undefined}>{r.dueDate.slice(0, 10)}{overdue ? ' · overdue' : ''}</span> : 'Not recorded'}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {dataState === 'inspection' ? <Empty>Case data is not loaded in inspection mode.</Empty>
            : loading ? <Empty>Loading authorized cases…</Empty>
            : error ? <Empty>The work queue is unavailable. Use Retry above to try again.</Empty>
            : !rows.length ? <Empty>No cases are assigned to you yet. New assignments appear here automatically.</Empty>
            : !visible.length ? <div className="tg-accountant-empty">No authorized cases match these filters. <button type="button" className="tg-acct-link" onClick={clearFilters}>Clear filters</button></div>
            : null}
        </section>

        <div className="tg-acct-side">
          <section className="tg-acct-card" aria-labelledby={`${idPrefix}-deadlines`}>
            <div className="tg-acct-card-head"><h2 id={`${idPrefix}-deadlines`}><CalendarDays size={16} aria-hidden="true" /> Upcoming Deadlines</h2></div>
            {!ready ? <Empty>{dataState === 'loading' ? 'Loading deadlines…' : 'Deadlines are unavailable.'}</Empty>
              : dueDatesUnavailable ? <Empty>Due dates are not recorded in the case store, so deadlines are unavailable.</Empty>
              : !deadlines.length ? <Empty>No recorded upcoming engagement deadlines.</Empty>
              : <ul className="tg-acct-deadlines">{deadlines.map(r => {
                  const days = daysUntil(r.dueDate!, today);
                  return <li key={r.id}><button type="button" onClick={() => choose(r)}>
                    <span className={`tg-acct-due${days <= 2 ? ' tg-acct-due--soon' : ''}`}>{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}</span>
                    <span className="tg-acct-deadline-name">{r.clientName}</span>
                    <small>{r.dueDate!.slice(0, 10)} · Tax year {r.taxYear}</small>
                  </button></li>;
                })}</ul>}
            <p className="tg-acct-subtle">Recorded engagement commitments. Statutory deadlines are not inferred.</p>
          </section>

          <section className="tg-acct-card" aria-labelledby={`${idPrefix}-actions`}>
            <div className="tg-acct-card-head"><h2 id={`${idPrefix}-actions`}><Zap size={16} aria-hidden="true" /> Quick Actions</h2></div>
            <div className="tg-acct-actions">
              <button type="button" disabled={!nextDeadline} onClick={() => nextDeadline && choose(nextDeadline)}><FolderOpen size={16} aria-hidden="true" /><span>Open next deadline case<small>{nextDeadline ? `${nextDeadline.clientName} · ${nextDeadline.dueDate!.slice(0, 10)}` : 'No recorded upcoming deadline'}</small></span></button>
              <button type="button" disabled={!ready} onClick={() => showQueue('Overdue')}><AlarmClock size={16} aria-hidden="true" /><span>Show overdue cases<small>Filter the work queue</small></span></button>
              <button type="button" onClick={() => searchRef.current?.focus()}><Search size={16} aria-hidden="true" /><span>Search clients<small>Name or tax year</small></span></button>
              <button type="button" disabled={!item} onClick={() => { setTab('Documents'); caseRef.current?.focus(); }}><FileSearch size={16} aria-hidden="true" /><span>Review case documents<small>{item ? `${item.clientName} · ${item.taxYear}` : 'Select a case first'}</small></span></button>
            </div>
          </section>
        </div>
      </div>

      {!item ? <section ref={caseRef} tabIndex={-1} className="tg-accountant-case"><Empty>Select an authorized case to open its tax-year workspace.</Empty></section> : <div className="tg-accountant-body"><section ref={caseRef} tabIndex={-1} className="tg-accountant-case" aria-label={`Case workspace: ${item.clientName} ${item.taxYear}`}><h2>{item.clientName} <small>{item.taxYear} · {item.status} · {item.serviceTitle}</small></h2><div className="tg-accountant-tabs" role="tablist" aria-label="Selected case workspace">{tabs.map(t=><button role="tab" tabIndex={tab===t ? 0 : -1} onKeyDown={e => { const next = e.key==='ArrowRight' ? (tabs.indexOf(t)+1)%tabs.length : e.key==='ArrowLeft' ? (tabs.indexOf(t)+tabs.length-1)%tabs.length : e.key==='Home' ? 0 : e.key==='End' ? tabs.length-1 : -1; if(next>=0){e.preventDefault(); setTab(tabs[next]); document.getElementById('accountant-tab-'+tabs[next].replaceAll(' ','-'))?.focus();} }} aria-selected={tab===t} aria-controls="accountant-case-panel" id={'accountant-tab-'+t.replaceAll(' ','-')} key={t} onClick={()=>setTab(t)}>{t}</button>)}</div><div role="tabpanel" id="accountant-case-panel" aria-labelledby={'accountant-tab-'+tab.replaceAll(' ','-')}>
      {['AI Preparation','Tax Forms','State Forms','Overview'].includes(tab) ? <div className="tg-accountant-preparation"><section><h3>AI Preparation Progress</h3>{['Profile & questionnaire analysis','Federal form identification','State form identification','Uploaded document matching','Extracted data validation','Tax calculations','Draft return preparation','Supporting schedules','Compliance checks','Federal / state validation'].map(task=><p key={task}><span aria-hidden="true">○</span> {task}<small>Execution evidence not available</small></p>)}<h3>AI Confidence</h3><Empty>No verified AI confidence output. Draft existence does not verify agent execution.</Empty></section><section><h3>Generated Tax Documents</h3>{drafts.key!==key ? <Empty>Loading authorized drafts…</Empty> : drafts.error ? <Empty>{drafts.error}</Empty> : null}<div className="tg-accountant-table"><table><thead><tr><th>Form / Document</th><th>Authority</th><th>Status</th><th>AI Confidence</th><th>Actions</th></tr></thead><tbody>{forms.filter(f=>tab!=='State Forms'||f.draft.jurisdiction!=='FEDERAL').map(f=><tr key={f.draft.returnId+':'+f.formNumber}><td>{f.formNumber} · {f.formName}</td><td>{f.draft.jurisdiction}</td><td>{f.draft.status}</td><td>{confidence(undefined)}</td><td><button onClick={()=>setPreview(f.draft.returnId+':'+f.formNumber)}>View</button></td></tr>)}</tbody></table></div>{!forms.length && <Empty>No verified generated forms for this tax year.</Empty>}</section><section><h3>Document / Form Preview</h3>{shown ? <><p>{shown.formName} · version {shown.draft.version ?? 'not reported'}</p><dl>{Object.entries(shown.lineItems).map(([line,value])=><React.Fragment key={line}><dt>{line}</dt><dd>{typeof value==='object' ? JSON.stringify(value) : String(value)}</dd></React.Fragment>)}</dl><h3>Validation notes</h3>{shown.draft.diagnostics?.map((d,i)=><p key={i}>{d.message || 'Diagnostic recorded'}</p>)}</> : <Empty>Select a generated form to inspect its authoritative line items. Private source files are not made public.</Empty>}</section></div> : tab==='Documents' ? <><h3>Authorized Documents · {item.taxYear}</h3><table><thead><tr><th>Document</th><th>Status</th><th>OCR Confidence</th><th>Version</th></tr></thead><tbody>{item.documents.map(d=><tr key={d.id}><td>{d.fileName}</td><td>{d.status}</td><td>{confidence(d.ocrConfidence)}</td><td>{d.version}</td></tr>)}</tbody></table>{!item.documents.length && <Empty>No documents for this case and tax year.</Empty>}</> : ['Workpapers','Review & Edit'].includes(tab) ? <><h3>Authorized Workpapers</h3>{workpapers.key!==key ? <Empty>Loading scoped workpapers…</Empty> : workpapers.error ? <Empty>{workpapers.error}</Empty> : !workpapers.rows.length ? <Empty>No recorded workpapers for this case and tax year.</Empty> : <CaseWorkpaperList items={workpapers.rows}/>}<p>Read-only traceability. Protected review decisions continue to require the existing server maker-checker controls.</p></> : ['Client Approval','E-File'].includes(tab) ? <><h3>{tab} · Authoritative Gate State</h3>{states.key!==key ? <Empty>Loading scoped stage state…</Empty> : states.error ? <Empty>{states.error}</Empty> : states.rows.filter(state=>(tab==='Client Approval' ? [10,11] : [12,13,14]).includes(state.stage)).map(state=><p key={state.id}>{String(state.stage).padStart(2,'0')} {state.stageName} · {state.status} · Requirements {state.requirementsMet ? 'met' : 'not met'}</p>)}<p>Reported gate state does not authorize approval, signature or submission. Human approval controls remain authoritative.</p></> : tab==='Client Info' ? <dl><dt>Filing Status</dt><dd>{item.context?.filingStatus || 'Not recorded for this tax year'}</dd><dt>State</dt><dd>{item.context?.state || 'Not recorded'}</dd><dt>Dependents</dt><dd>{item.context?.dependents ?? 'Not recorded'}</dd><dt>Source</dt><dd>Recorded onboarding context matching this tax year; subject to preparer verification.</dd></dl> : tab==='History' ? <>{rows.filter(r=>r.clientId===item.clientId).map(r=><button key={r.id} onClick={()=>choose(r)}>{r.taxYear} · {r.status}</button>)}</> : <Empty>{tab} requires a verified scoped integration. No approvals, signatures, edits or filing actions are simulated here.</Empty>}
      </div></section><aside><section className="tg-accountant-case"><h3>Client Information</h3><dl><dt>Client</dt><dd>{item.clientName}</dd><dt>Tax Year</dt><dd>{item.taxYear}</dd><dt>Engagement</dt><dd>{item.serviceTitle}</dd><dt>Filing Status</dt><dd>{item.context?.filingStatus || 'Not recorded'}</dd><dt>State</dt><dd>{item.context?.state || 'Not recorded'}</dd><dt>Dependents</dt><dd>{item.context?.dependents ?? 'Not recorded'}</dd><dt>Risk</dt><dd>Not reported</dd></dl></section><section className="tg-accountant-case"><h3>AI Assistant</h3><Empty>Scoped advisory assistant integration is unavailable in this dashboard.</Empty><p>AI output requires human review. Approval, signature, senior review and filing remain protected by server controls.</p></section><section className="tg-accountant-case"><h3>Client History (2022+)</h3>{rows.filter(r=>r.clientId===item.clientId).sort((a,b)=>b.taxYear-a.taxYear).map(r=><button key={r.id} onClick={()=>choose(r)}>{r.taxYear} · {r.status}</button>)}</section></aside></div>}
      <ol className="tg-accountant-journey" aria-label="Accountant workflow projection">{ACCOUNTANT_JOURNEY.map((step,i)=><li key={step.label} aria-current={item?.activeStage && step.stages.includes(item.activeStage) ? 'step' : undefined}><strong>{i+1}</strong>{step.label}<small>Engine stages {step.stages.join(', ')}</small></li>)}</ol>
    </div>
  </DashboardApplicationShell>;
}

/** Exposed for tests: the sidebar section ids, in order. */
export const ACCOUNTANT_SIDEBAR_SECTIONS = ACCOUNTANT_NAV_SECTIONS.map(s => s.label);
