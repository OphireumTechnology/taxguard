import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AUTHORITY_TYPES, isSha256, parseAssignments, taxEngineMessage, taxEngineService, type RuleSetCoverage, type RuleSetDetail, type RuleSetSummary,
  type RuleSetTests, type TaxSource } from '../../services/taxEngineService';

type Load<T> = { status: 'loading' | 'ready' | 'error'; value: T; message?: string };
const blankSource = { sourceId: '', jurisdiction: 'federal' as 'federal' | 'state', jurisdictionCode: 'US', authorityType: 'publication', title: '', issuer: '', citation: '', url: '', taxYears: '' };

/** Source-of-law records and versioned rule sets. Every decision is made and recorded by the server: reviewers verify
 * sources and approve rule sets, nobody checks their own work, and approval needs passing, covering tests. */
export function TaxRulesPanel() {
  const [sources, setSources] = useState<Load<TaxSource[]>>({ status: 'loading', value: [] });
  const [ruleSets, setRuleSets] = useState<Load<RuleSetSummary[]>>({ status: 'loading', value: [] });
  const [year, setYear] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ ruleSet: RuleSetDetail; coverage: RuleSetCoverage | null; tests: RuleSetTests | null } | null>(null);
  const [form, setForm] = useState(blankSource);
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [draftJson, setDraftJson] = useState('');
  const blankTest = { name: '', sourceId: '', citation: '', filingStatus: '', inputs: '', evidence: '', expected: '' };
  const [testForm, setTestForm] = useState(blankTest);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedRef = useRef(selected); selectedRef.current = selected;

  const loadSources = useCallback(() => {
    setSources(s => ({ ...s, status: 'loading' }));
    taxEngineService.sources().then(v => setSources({ status: 'ready', value: v })).catch(e => setSources({ status: 'error', value: [], message: taxEngineMessage(e) }));
  }, []);
  const loadRuleSets = useCallback(() => {
    setRuleSets(s => ({ ...s, status: 'loading' }));
    taxEngineService.ruleSets(year ? Number(year) : undefined).then(v => setRuleSets({ status: 'ready', value: v }))
      .catch(e => setRuleSets({ status: 'error', value: [], message: taxEngineMessage(e) }));
  }, [year]);
  const loadDetail = useCallback((ruleSetId: string) => {
    setDetail(null);
    Promise.all([taxEngineService.ruleSet(ruleSetId), taxEngineService.coverage(ruleSetId).catch(() => null), taxEngineService.tests(ruleSetId).catch(() => null)])
      .then(([ruleSet, coverage, tests]) => { if (selectedRef.current === ruleSetId) setDetail({ ruleSet, coverage, tests }); })
      .catch(e => { if (selectedRef.current === ruleSetId) setNotice({ error: true, text: taxEngineMessage(e) }); });
  }, []);
  useEffect(() => { loadSources(); }, [loadSources]);
  useEffect(() => { loadRuleSets(); }, [loadRuleSets]);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected, loadDetail]);

  /** Runs one server action; on refusal the entered values stay so the person can correct and retry. */
  const run = async (op: () => Promise<unknown>, success: string, after: () => void) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try { await op(); setNotice({ error: false, text: success }); after(); }
    catch (e) { setNotice({ error: true, text: taxEngineMessage(e) }); }
    finally { setBusy(false); }
  };
  const years = form.taxYears.split(',').map(s => s.trim()).filter(Boolean);
  const formValid = form.sourceId.trim().length >= 3 && form.title.trim().length >= 3 && form.issuer.trim() && form.citation.trim()
    && /^[A-Z]{2}$/.test(form.jurisdictionCode) && years.length >= 1 && years.length <= 10 && years.every(y => /^\d{4}$/.test(y)) && (!form.url || form.url.startsWith('https://'));
  const rs = detail?.ruleSet;
  let draftParsed: unknown = null;
  try { draftParsed = draftJson.trim() ? JSON.parse(draftJson) : null; } catch { draftParsed = null; }
  const draftInvalid = draftJson.trim() !== '' && (draftParsed === null || typeof draftParsed !== 'object' || Array.isArray(draftParsed));
  const testInputs = parseAssignments(testForm.inputs), testExpected = parseAssignments(testForm.expected);
  const verifiedSources = sources.value.filter(s => s.status === 'VERIFIED' && (!rs || s.tax_years.includes(rs.taxYear)));
  const testValid = testForm.name.trim().length >= 3 && !!testForm.sourceId && testForm.citation.trim().length >= 3 && !!testInputs && !!testExpected
    && /^[A-Za-z0-9_.:-]{3,128}$/.test(testForm.evidence.trim()) && (!testForm.filingStatus || /^[a-z_]{2,40}$/.test(testForm.filingStatus));

  return <section aria-labelledby="tax-rules-heading" className="tg-manager-card">
    <h2 id="tax-rules-heading">Tax Rules</h2>
    <p>Source-of-law records and versioned rule sets. A rule set is used for calculations only after an independent reviewer approves it with
      passing, covering tests; synthetic test content is always labelled and never treated as authority.</p>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}

    <h3>Sources of law</h3>
    <button type="button" onClick={loadSources} disabled={sources.status === 'loading'}>Refresh sources</button>
    {sources.status === 'loading' && <p role="status">Loading sources…</p>}
    {sources.status === 'error' && <p role="alert">{sources.message}</p>}
    {sources.status === 'ready' && sources.value.length === 0 && <p role="status">No sources are registered.</p>}
    {sources.value.length > 0 && <div className="tg-manager-scroll max-w-full overflow-x-auto"><table><caption className="sr-only">Registered sources of law</caption>
      <thead><tr>{['Source', 'Title and citation', 'Authority', 'Years', 'Status', 'Registered / verified by', 'Verify'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{sources.value.map(s => <tr key={s.source_id}>
        <td>{s.source_id}{s.synthetic ? ' (synthetic test)' : ''}</td>
        <td>{s.title}<br /><small>{s.citation}{s.url ? <> · <a href={s.url} target="_blank" rel="noreferrer noopener">source</a></> : null}</small></td>
        <td>{s.jurisdiction} {s.jurisdiction_code} · {s.authority_type.replace(/_/g, ' ')}</td>
        <td>{s.tax_years.join(', ')}</td>
        <td>{s.status}</td>
        <td>{s.registered_by}{s.verified_by ? ` / ${s.verified_by}` : ''}</td>
        <td>{s.status === 'PROPOSED' && <form aria-label={`Verify ${s.source_id}`} onSubmit={e => { e.preventDefault();
            void run(() => taxEngineService.verifySource(s.source_id, (hashes[s.source_id] ?? '').trim()), `Source ${s.source_id} verified.`, () => { setHashes(h => ({ ...h, [s.source_id]: '' })); loadSources(); }); }}>
          <label>Document SHA-256<input value={hashes[s.source_id] ?? ''} maxLength={64} onChange={e => setHashes(h => ({ ...h, [s.source_id]: e.target.value }))} /></label>
          <button disabled={busy || !isSha256(hashes[s.source_id] ?? '')}>Verify</button></form>}</td>
      </tr>)}</tbody></table></div>}

    <details><summary>Register a source</summary>
      <form aria-label="Register a source" onSubmit={e => { e.preventDefault();
        void run(() => taxEngineService.registerSource({ sourceId: form.sourceId.trim(), jurisdiction: form.jurisdiction, jurisdictionCode: form.jurisdictionCode,
          authorityType: form.authorityType, title: form.title.trim(), issuer: form.issuer.trim(), citation: form.citation.trim(), ...(form.url ? { url: form.url.trim() } : {}),
          taxYears: years.map(Number) }), 'Source registered; it needs verification by a different reviewer.', () => { setForm(blankSource); loadSources(); }); }}>
        <label>Identifier<input value={form.sourceId} maxLength={80} onChange={e => setForm({ ...form, sourceId: e.target.value })} /></label>
        <label>Jurisdiction level<select value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value as 'federal' | 'state' })}>
          <option value="federal">Federal</option><option value="state">State</option></select></label>
        <label>Jurisdiction code<input value={form.jurisdictionCode} maxLength={2} onChange={e => setForm({ ...form, jurisdictionCode: e.target.value.toUpperCase() })} /></label>
        <label>Authority type<select value={form.authorityType} onChange={e => setForm({ ...form, authorityType: e.target.value })}>
          {AUTHORITY_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</select></label>
        <label>Title<input value={form.title} maxLength={300} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <label>Issuer<input value={form.issuer} maxLength={200} onChange={e => setForm({ ...form, issuer: e.target.value })} /></label>
        <label>Citation<input value={form.citation} maxLength={300} onChange={e => setForm({ ...form, citation: e.target.value })} /></label>
        <label>Link (https, optional)<input value={form.url} maxLength={500} onChange={e => setForm({ ...form, url: e.target.value })} /></label>
        <label>Tax years (comma-separated)<input value={form.taxYears} onChange={e => setForm({ ...form, taxYears: e.target.value })} /></label>
        <button disabled={busy || !formValid}>Register source</button>
      </form></details>

    <h3>Rule sets</h3>
    <div className="tg-manager-controls"><label>Tax year<input value={year} inputMode="numeric" maxLength={4} placeholder="All" onChange={e => setYear(e.target.value.replace(/\D/g, ''))} /></label>
      <button type="button" onClick={loadRuleSets} disabled={ruleSets.status === 'loading'}>Refresh rule sets</button></div>
    <details><summary>Draft a rule set</summary>
      <form aria-label="Draft a rule set" onSubmit={e => { e.preventDefault(); if (!draftParsed || draftInvalid) return;
        void run(() => taxEngineService.draftRuleSet(draftParsed), 'Rule set drafted; add source-cited tests, run them, then submit it for review.', () => { setDraftJson(''); loadRuleSets(); }); }}>
        <p>Paste the rule set definition (JSON). The server validates its structure, steps, outputs and cited sources, then hashes and versions it.</p>
        <label>Definition (JSON)<textarea value={draftJson} rows={8} onChange={e => setDraftJson(e.target.value)} /></label>
        {draftInvalid && <p role="alert">The definition is not a JSON object.</p>}
        <button disabled={busy || !draftParsed || draftInvalid}>Draft rule set</button>
      </form></details>
    {ruleSets.status === 'loading' && <p role="status">Loading rule sets…</p>}
    {ruleSets.status === 'error' && <p role="alert">{ruleSets.message}</p>}
    {ruleSets.status === 'ready' && ruleSets.value.length === 0 && <p role="status">No rule sets for this selection.</p>}
    {ruleSets.value.length > 0 && <div className="tg-manager-scroll max-w-full overflow-x-auto"><table><caption className="sr-only">Versioned rule sets</caption>
      <thead><tr>{['Rule set', 'Year', 'Version', 'Status', 'Prepared / reviewed by'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{ruleSets.value.map(r => <tr key={r.ruleSetId}>
        <td><button type="button" aria-pressed={selected === r.ruleSetId} onClick={() => { setSelected(r.ruleSetId); setNotice(null); setNote(''); }}>
          {r.jurisdiction} {r.jurisdictionCode} {r.returnFamily}{r.synthetic ? ' (synthetic)' : ''}</button></td>
        <td>{r.taxYear}</td><td>{r.version}</td><td>{r.status}</td><td>{r.preparedBy}{r.reviewedBy ? ` / ${r.reviewedBy}` : ''}</td></tr>)}</tbody></table></div>}

    {selected && <div aria-live="polite">
      {!rs && <p role="status">Loading rule set…</p>}
      {rs && <>
        <h4>{rs.jurisdiction} {rs.jurisdictionCode} {rs.returnFamily} {rs.taxYear} · version {rs.version} · {rs.status}</h4>
        <p>Content SHA-256 <code>{rs.contentSha256}</code> · sources {rs.sourceIds.join(', ') || 'none'}{rs.reviewNote ? ` · review note: ${rs.reviewNote}` : ''}</p>
        <table><caption>Parameters</caption><thead><tr>{['Key', 'Filing status', 'Value', 'Source and citation'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{(rs.definition.parameters ?? []).map((p, i) => <tr key={p.key + '-' + i}><td>{p.key}</td><td>{p.filingStatus ?? 'All'}</td><td>{p.value}{p.unit ? ' ' + p.unit : ''}</td>
            <td>{p.sourceId ?? ''}{p.citation ? ' · ' + p.citation : ''}</td></tr>)}</tbody></table>
        {detail?.coverage && <p role="status">{detail.coverage.missingOutputs.length || detail.coverage.missingFilingStatuses.length
          ? `Test coverage incomplete: outputs ${detail.coverage.missingOutputs.join(', ') || 'covered'}; filing statuses ${detail.coverage.missingFilingStatuses.join(', ') || 'covered'}.`
          : 'Tests cover every output and filing status.'}</p>}
        {detail?.tests && <>
          <h5>Verification tests</h5>
          {detail.tests.tests.length === 0 ? <p role="status">No source-cited tests are recorded for this rule set.</p> :
            <table><caption>Source-cited tests</caption><thead><tr>{['Test', 'Filing status', 'Expected outputs', 'Source and citation', 'Result'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{detail.tests.tests.map(test => { const result = detail.tests!.latestRun?.results.find(r => r.testId === test.testId);
                return <tr key={test.testId}><td>{test.name}</td><td>{test.filingStatus ?? 'All'}</td><td>{Object.entries(test.expected).map(([k, v]) => k + ' = ' + v).join('; ')}</td>
                  <td>{test.sourceId} · {test.citation}</td>
                  <td>{!result ? 'Not run' : result.passed ? 'Passed' : result.error ? 'Failed: ' + result.error.replace(/_/g, ' ').toLowerCase()
                    : 'Failed: ' + (result.mismatches ?? []).map(m => m.output + ' expected ' + m.expected + ', got ' + (m.actual ?? 'nothing')).join('; ')}
                    {rs.status === 'DRAFT' && <button type="button" disabled={busy} aria-label={`Remove test ${test.name}`} onClick={() => run(() => taxEngineService.removeTest(rs.ruleSetId, test.testId),
                      'Test removed.', () => loadDetail(rs.ruleSetId))}>Remove</button>}</td></tr>; })}</tbody></table>}
          <p role="status">{detail.tests.latestRun ? `Latest run: ${detail.tests.latestRun.passedCount} of ${detail.tests.latestRun.testCount} passed`
              + (detail.tests.latestRun.testsSha256 === detail.tests.testsSha256 ? '' : ' (the tests have changed since; run them again)')
              + ` · engine ${detail.tests.latestRun.engineVersion} · by ${detail.tests.latestRun.runBy} · ${new Date(detail.tests.latestRun.runAt).toLocaleString()}`
            : 'The tests have not been run.'}</p>
          {rs.status === 'DRAFT' && detail.tests.tests.length > 0 && <button type="button" disabled={busy} onClick={() => run(() => taxEngineService.runTests(rs.ruleSetId),
            'Tests run and recorded by the server.', () => loadDetail(rs.ruleSetId))}>Run tests</button>}
          {rs.status === 'DRAFT' && <form aria-label="Add a test" onSubmit={e => { e.preventDefault(); if (!testValid) return;
              void run(() => taxEngineService.addTest(rs.ruleSetId, { name: testForm.name.trim(), sourceId: testForm.sourceId, citation: testForm.citation.trim(),
                ...(testForm.filingStatus ? { filingStatus: testForm.filingStatus } : {}),
                inputs: testInputs!.map(([factPath, value]) => ({ factPath, value, evidenceIds: [testForm.evidence.trim()] })),
                expected: Object.fromEntries(testExpected!) }), 'Test added; run the tests again before submitting.', () => { setTestForm(blankTest); loadDetail(rs.ruleSetId); }); }}>
            <h5>Add a source-cited test</h5>
            <label>Test name<input value={testForm.name} maxLength={200} onChange={e => setTestForm({ ...testForm, name: e.target.value })} /></label>
            <label>Source (verified for {rs.taxYear})<select value={testForm.sourceId} onChange={e => setTestForm({ ...testForm, sourceId: e.target.value })}>
              <option value="">Select a verified source</option>{verifiedSources.map(s => <option key={s.source_id} value={s.source_id}>{s.source_id}{s.synthetic ? ' (synthetic)' : ''}</option>)}</select></label>
            <label>Citation for the expected result<input value={testForm.citation} maxLength={300} onChange={e => setTestForm({ ...testForm, citation: e.target.value })} /></label>
            <label>Filing status (optional)<input value={testForm.filingStatus} maxLength={40} onChange={e => setTestForm({ ...testForm, filingStatus: e.target.value.toLowerCase() })} /></label>
            <label>Inputs, one "fact.path = amount" per line<textarea value={testForm.inputs} rows={3} onChange={e => setTestForm({ ...testForm, inputs: e.target.value })} /></label>
            <label>Evidence reference for the inputs<input value={testForm.evidence} maxLength={128} onChange={e => setTestForm({ ...testForm, evidence: e.target.value })} /></label>
            <label>Expected outputs, one "output = amount" per line<textarea value={testForm.expected} rows={3} onChange={e => setTestForm({ ...testForm, expected: e.target.value })} /></label>
            {(testForm.inputs.trim() && !testInputs) || (testForm.expected.trim() && !testExpected) ? <p role="alert">Each line must read "name = amount", with no repeated names.</p> : null}
            <button disabled={busy || !testValid}>Add test</button>
          </form>}
        </>}
        {rs.status === 'DRAFT' && <button type="button" disabled={busy} onClick={() => run(() => taxEngineService.transition(rs.ruleSetId, 'submit'),
          'Submitted for independent review.', () => { loadDetail(rs.ruleSetId); loadRuleSets(); })}>Submit for review</button>}
        {rs.status === 'PENDING_REVIEW' && <form aria-label="Review decision" onSubmit={e => e.preventDefault()}>
          <label>Review note (required to reject)<textarea value={note} maxLength={1000} onChange={e => setNote(e.target.value)} /></label>
          <button type="button" disabled={busy} onClick={() => run(() => taxEngineService.transition(rs.ruleSetId, 'approve', note.trim() || undefined),
            'Rule set approved.', () => { setNote(''); loadDetail(rs.ruleSetId); loadRuleSets(); })}>Approve</button>
          <button type="button" disabled={busy || note.trim().length < 10} onClick={() => run(() => taxEngineService.transition(rs.ruleSetId, 'reject', note.trim()),
            'Rule set rejected.', () => { setNote(''); loadDetail(rs.ruleSetId); loadRuleSets(); })}>Reject</button>
        </form>}
      </>}
    </div>}
  </section>;
}
