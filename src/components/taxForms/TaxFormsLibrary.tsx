import React, { useEffect, useId, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, Library, PanelLeftClose, PanelLeftOpen, Search, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { canReadTaxFormsLibrary } from '../../taxForms/access';
import type { FormView, LibraryCatalog } from '../../taxForms/registry';
import type { Applicability, CapabilityKey, LibraryGroupId, StateJurisdiction, StateTaxCategoryId } from '../../taxForms/types';
import { BLOCKED_LABEL, READINESS_LADDER } from '../../taxForms/types';
import './taxFormsLibrary.css';

/**
 * Tax Forms Library (reference). Data comes from GET /api/tax-forms, which the server restricts to
 * practice staff. Nothing here prepares, calculates, renders or files a return.
 */
const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  dataEntry: 'Data entry', calculation: 'Calculation', validation: 'Validation', pdf: 'PDF generation',
  reviewReady: 'Review ready', efile: 'E-file integration', filingReady: 'Filing ready',
};
const STATUS_TEXT = { available: 'Supported', prototype: 'Prototype only (not authoritative)', not_implemented: 'Not implemented', blocked: 'Blocked' } as const;
const APPLICABILITY_TEXT: Record<Applicability, string> = { applies: 'Applies', limited: 'Limited', 'does-not-apply': 'Does not apply', 'not-confirmed': 'Not confirmed' };
const CORE_GROUPS: LibraryGroupId[] = ['individual-1040', 'estates-trusts-1041', 'partnerships-1065', 'c-corporations-1120', 's-corporations-1120s', 'nonprofits-990', 'estate-tax-706', 'gift-tax-709'];

function applicability(state: StateJurisdiction, category: StateTaxCategoryId, year: number): Applicability {
  const c = state.categories[category];
  return c.byYear?.[year] ?? c.applicability;
}
function readinessClass(label: string) {
  return label === 'Cataloged / Reference Only' ? 'tg-forms-badge--muted' : 'tg-forms-badge--gold';
}

export function TaxFormsLibrary({ catalog: provided }: { catalog?: LibraryCatalog }) {
  const { currentUser, authLifecycleState, setCurrentPage } = useApp();
  const idp = useId();
  const allowed = canReadTaxFormsLibrary(currentUser, authLifecycleState);
  const [catalog, setCatalog] = useState<LibraryCatalog | null>(provided ?? null);
  const [loadError, setLoadError] = useState('');
  const [group, setGroup] = useState<LibraryGroupId>('individual-1040');
  const [navOpen, setNavOpen] = useState(true);
  const [coreOpen, setCoreOpen] = useState(true);
  const [text, setText] = useState('');
  const [year, setYear] = useState(2025);
  const [readiness, setReadiness] = useState('');
  const [selectedForm, setSelectedForm] = useState('');
  const [stateCategory, setStateCategory] = useState<StateTaxCategoryId>('individual-income');
  const [onlyApplicable, setOnlyApplicable] = useState(false);
  const [selectedState, setSelectedState] = useState('');

  useEffect(() => {
    if (provided || !allowed) return;
    const controller = new AbortController();
    api.taxForms.getCatalog(controller.signal).then(setCatalog).catch(() => { if (!controller.signal.aborted) setLoadError('The forms library could not be loaded. Your role may not have access, or the server is unavailable.'); });
    return () => controller.abort();
  }, [allowed, provided]);

  const forms = useMemo(() => {
    if (!catalog) return [] as FormView[];
    const q = text.trim().toLowerCase();
    return catalog.federalForms.filter(f =>
      (group === 'search-reference' || f.groups.includes(group)) && f.taxYears.includes(year) &&
      (!readiness || f.readiness === readiness) &&
      (!q || [f.formNumber, f.officialName, ...f.schedules].join(' ').toLowerCase().includes(q)));
  }, [catalog, group, year, readiness, text]);
  const states = useMemo(() => {
    if (!catalog) return [] as StateJurisdiction[];
    const q = text.trim().toLowerCase();
    return catalog.states.filter(s => (!q || `${s.code} ${s.name} ${s.agencyName}`.toLowerCase().includes(q))
      && (!onlyApplicable || ['applies', 'limited'].includes(applicability(s, stateCategory, year))));
  }, [catalog, text, onlyApplicable, stateCategory, year]);

  if (!allowed) return <p role="alert" className="tg-forms-denied">The Tax Forms Library is available to authorized practice staff only.</p>;

  const counts = (id: LibraryGroupId) => id === 'state-local' ? catalog?.states.length ?? 0
    : id === 'search-reference' ? catalog?.federalForms.length ?? 0
    : catalog?.federalForms.filter(f => f.groups.includes(id)).length ?? 0;
  const core = catalog?.coreCategories.find(c => c.id === group);
  const form = catalog?.federalForms.find(f => f.id === selectedForm);
  const state = catalog?.states.find(s => s.code === selectedState);
  const choose = (g: LibraryGroupId) => { setGroup(g); setSelectedForm(''); setSelectedState(''); };
  const groupLabel = catalog?.groups.find(g => g.id === group)?.label ?? '';

  return (
    <div className="tg-forms">
      <header className="tg-forms-header">
        <div>
          <p className="tg-forms-eyebrow"><Library size={14} aria-hidden="true" /> Reference</p>
          <h1>Tax Forms Library</h1>
          <p className="tg-forms-subtle">Federal forms, the eight primary return categories, and state and local coverage for all 50 states and Washington, D.C.</p>
        </div>
        <div className="tg-forms-header-actions">
          <button type="button" className="tg-forms-button tg-forms-button--ghost" onClick={() => setNavOpen(v => !v)} aria-expanded={navOpen} aria-controls={`${idp}-nav`}>
            {navOpen ? <PanelLeftClose size={16} aria-hidden="true" /> : <PanelLeftOpen size={16} aria-hidden="true" />} {navOpen ? 'Hide' : 'Show'} navigation
          </button>
          <button type="button" className="tg-forms-button" onClick={() => setCurrentPage('staff')}>Back to workspace</button>
        </div>
      </header>

      <p className="tg-forms-disclaimer" role="note"><ShieldAlert size={16} aria-hidden="true" /> {catalog?.disclaimer ?? 'Reference catalog. Listing a form does not mean TaxGuard can prepare or file it.'}</p>
      {loadError && <p role="alert" className="tg-forms-error">{loadError}</p>}

      <div className={`tg-forms-layout${navOpen ? '' : ' tg-forms-layout--wide'}`}>
        <nav id={`${idp}-nav`} className="tg-forms-nav" aria-label="Tax forms library sections" hidden={!navOpen}>
          <button type="button" className="tg-forms-nav-heading" aria-expanded={coreOpen} aria-controls={`${idp}-core`} onClick={() => setCoreOpen(v => !v)}>
            {coreOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />} Primary return categories
          </button>
          <ul id={`${idp}-core`} hidden={!coreOpen}>
            {catalog?.groups.filter(g => CORE_GROUPS.includes(g.id)).map(g => <li key={g.id}><button type="button" aria-current={group === g.id ? 'page' : undefined} onClick={() => choose(g.id)}><span>{g.label}</span><span className="tg-forms-count">{counts(g.id)}</span></button></li>)}
          </ul>
          <p className="tg-forms-nav-label">Other federal and state</p>
          <ul>
            {catalog?.groups.filter(g => !CORE_GROUPS.includes(g.id)).map(g => <li key={g.id}><button type="button" aria-current={group === g.id ? 'page' : undefined} onClick={() => choose(g.id)}><span>{g.label}</span><span className="tg-forms-count">{counts(g.id)}</span></button></li>)}
          </ul>
        </nav>

        <main className="tg-forms-main" aria-labelledby={`${idp}-title`}>
          <h2 id={`${idp}-title`} className="tg-forms-section-title">{groupLabel || 'Loading library…'}</h2>
          {core && <section className="tg-forms-card tg-forms-core" aria-label="Category scope"><h3>{core.title}</h3><p>{core.scope}</p></section>}

          <div className="tg-forms-toolbar">
            <label className="tg-forms-search"><Search size={15} aria-hidden="true" /><span className="tg-forms-sr">Search forms and jurisdictions</span>
              <input type="search" value={text} onChange={e => setText(e.target.value)} placeholder={group === 'state-local' ? 'Search state, code or agency' : 'Search form number, name or schedule'} /></label>
            <label>Tax year<select value={year} onChange={e => setYear(Number(e.target.value))}>{(catalog?.catalogTaxYears ?? [2025]).map(y => <option key={y} value={y}>{y}</option>)}</select></label>
            {group !== 'state-local' && <label>Readiness<select value={readiness} onChange={e => setReadiness(e.target.value)}><option value="">All</option>{READINESS_LADDER.map(r => <option key={r} value={r}>{r}</option>)}</select></label>}
            {group === 'state-local' && <>
              <label>Tax category<select value={stateCategory} onChange={e => setStateCategory(e.target.value as StateTaxCategoryId)}>{catalog?.stateCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
              <label className="tg-forms-check"><input type="checkbox" checked={onlyApplicable} onChange={e => setOnlyApplicable(e.target.checked)} /> Only where it applies</label>
            </>}
          </div>

          {!catalog && !loadError && <p role="status" className="tg-forms-empty">Loading the forms library…</p>}

          {catalog && group !== 'state-local' && <>
            <p className="tg-forms-subtle" aria-live="polite">{forms.length} form{forms.length === 1 ? '' : 's'} for tax year {year}</p>
            <div className="tg-forms-table"><table>
              <caption className="tg-forms-sr">Federal forms</caption>
              <thead><tr><th scope="col">Form</th><th scope="col">Official name</th><th scope="col">Type</th><th scope="col">Readiness</th><th scope="col">Preparation</th></tr></thead>
              <tbody>{forms.map(f => <tr key={f.id} aria-selected={selectedForm === f.id}>
                <td><button type="button" className="tg-forms-link" onClick={() => setSelectedForm(f.id)}>{f.formNumber}</button></td>
                <td>{f.officialName}</td><td className="tg-forms-cap">{f.classification}</td>
                <td><span className={`tg-forms-badge ${readinessClass(f.readiness)}`}>{f.readiness}</span></td>
                <td><span className={`tg-forms-badge ${f.preparation === BLOCKED_LABEL ? 'tg-forms-badge--blocked' : 'tg-forms-badge--amber'}`}>{f.preparation}</span></td>
              </tr>)}</tbody>
            </table></div>
            {!forms.length && <p className="tg-forms-empty">No forms match these filters.</p>}
          </>}

          {form && <section className="tg-forms-card tg-forms-detail" aria-label={`Form ${form.formNumber} details`}>
            <h3>{form.formNumber} · {form.officialName}</h3>
            <dl className="tg-forms-facts">
              <dt>Jurisdiction</dt><dd>Federal (IRS)</dd>
              <dt>Tax years cataloged</dt><dd>{form.taxYears.join(', ')}</dd>
              <dt>Taxpayer / entity</dt><dd className="tg-forms-cap">{form.entityCategory.replace(/-/g, ' ')}</dd>
              <dt>Classification</dt><dd className="tg-forms-cap">{form.classification}</dd>
              <dt>Official source</dt><dd><a href={form.officialSourceUrl} target="_blank" rel="noreferrer noopener">{form.officialSourceUrl.replace('https://www.', '')} <ExternalLink size={12} aria-hidden="true" /></a><small>{form.instructionsNote}</small></dd>
              <dt>Source verification</dt><dd><span className={`tg-forms-badge ${form.source.status === 'verified' ? 'tg-forms-badge--gold' : 'tg-forms-badge--muted'}`}>{form.source.status.replace('_', ' ')}</span><small>{form.source.method}{form.source.checkedOn ? ` Last checked ${form.source.checkedOn}.` : ''}</small></dd>
              <dt>Readiness</dt><dd>{form.readiness} · Preparation: {form.preparation}</dd>
              <dt>Applicable schedules</dt><dd>{form.schedules.length ? form.schedules.join(', ') : 'None cataloged'}</dd>
              <dt>Required documents</dt><dd><ul>{form.requiredDocuments.map(d => <li key={d}>{d}</li>)}</ul><small>TaxGuard checklist, not an IRS publication.</small></dd>
              {form.notes && <><dt>Notes</dt><dd>{form.notes}</dd></>}
            </dl>
            <h4>Capabilities</h4>
            <ul className="tg-forms-capabilities">{(Object.keys(CAPABILITY_LABELS) as CapabilityKey[]).map(k => <li key={k} data-status={form.capabilities[k].status}>
              <strong>{CAPABILITY_LABELS[k]}</strong><span>{STATUS_TEXT[form.capabilities[k].status]}</span><small>{form.capabilities[k].note}</small></li>)}</ul>
            <h4>Version history</h4>
            <table className="tg-forms-mini"><thead><tr><th scope="col">Tax year</th><th scope="col">Revision</th><th scope="col">Note</th></tr></thead>
              <tbody>{form.versionHistory.map(v => <tr key={v.taxYear}><td>{v.taxYear}</td><td>{v.revision ?? 'Not verified'}</td><td>{v.note}</td></tr>)}</tbody></table>
          </section>}

          {catalog && group === 'state-local' && <>
            <p className="tg-forms-subtle">Applicability by tax category (tax year {year}). No state form numbers are listed: entries are reference information pending verification with each agency.</p>
            <div className="tg-forms-table"><table>
              <caption className="tg-forms-sr">States and Washington, D.C.</caption>
              <thead><tr><th scope="col">Jurisdiction</th><th scope="col">{catalog.stateCategories.find(c => c.id === stateCategory)?.label}</th><th scope="col">Revenue agency</th></tr></thead>
              <tbody>{states.map(s => { const a = applicability(s, stateCategory, year); return <tr key={s.code} aria-selected={selectedState === s.code}>
                <td><button type="button" className="tg-forms-link" onClick={() => setSelectedState(s.code)}>{s.name} ({s.code})</button></td>
                <td><span className={`tg-forms-badge tg-forms-app--${a}`}>{APPLICABILITY_TEXT[a]}</span>{s.categories[stateCategory].note && <small className="tg-forms-note">{s.categories[stateCategory].note}</small>}</td>
                <td>{s.agencyName}</td>
              </tr>; })}</tbody>
            </table></div>
            {!states.length && <p className="tg-forms-empty">No jurisdictions match these filters.</p>}
          </>}

          {state && group === 'state-local' && <section className="tg-forms-card tg-forms-detail" aria-label={`${state.name} details`}>
            <h3>{state.name} ({state.code})</h3>
            <p><a href={state.agencyUrl} target="_blank" rel="noreferrer noopener">{state.agencyName} <ExternalLink size={12} aria-hidden="true" /></a>
              <small> Agency site check ({state.agencyCheck.checkedOn}): {state.agencyCheck.result.replace(/-/g, ' ')}. Reachability does not verify content.</small></p>
            <p><span className="tg-forms-badge tg-forms-badge--muted">Unverified</span> <small>{state.verification.method}</small></p>
            <table className="tg-forms-mini"><thead><tr><th scope="col">Tax category</th><th scope="col">{year}</th><th scope="col">Note</th><th scope="col">Preparation</th></tr></thead>
              <tbody>{catalog!.stateCategories.map(c => { const a = applicability(state, c.id, year); return <tr key={c.id}><td>{c.label}</td><td><span className={`tg-forms-badge tg-forms-app--${a}`}>{APPLICABILITY_TEXT[a]}</span></td><td>{state.categories[c.id].note ?? ''}</td><td>{a === 'does-not-apply' ? '—' : 'Cataloged / Reference Only'}</td></tr>; })}</tbody></table>
          </section>}

          {catalog && group === 'search-reference' && <>
            <section className="tg-forms-card" aria-labelledby={`${idp}-ladder`}>
              <h3 id={`${idp}-ladder`}><BookOpen size={16} aria-hidden="true" /> Readiness states</h3>
              <ol className="tg-forms-ladder">{READINESS_LADDER.map(r => <li key={r}>{r}</li>)}<li>{BLOCKED_LABEL}</li></ol>
              <p className="tg-forms-subtle">A form reaches a step only when that capability and every earlier one are operational. Prototype code never counts as support.</p>
            </section>
            <section className="tg-forms-card" aria-labelledby={`${idp}-pipeline`}>
              <h3 id={`${idp}-pipeline`}>Preparation architecture and the 18-stage workflow</h3>
              <div className="tg-forms-table"><table><thead><tr><th scope="col">Capability</th><th scope="col">Workflow stages</th><th scope="col">Status</th><th scope="col">Evidence</th></tr></thead>
                <tbody>{catalog.preparationPipeline.map(p => <tr key={p.id}><td>{p.label}</td><td>{p.workflowStages.map(s => String(s).padStart(2, '0')).join(', ')}</td><td><span className={`tg-forms-badge tg-forms-pipe--${p.status}`}>{p.status.replace('_', ' ')}</span></td><td>{p.evidence}</td></tr>)}</tbody></table></div>
            </section>
          </>}
        </main>
      </div>
    </div>
  );
}
