import React, { useState } from 'react';
import type { ReviewerArtifact, ReviewerSnapshot } from '../../types/reviewerDashboard';
import { CaseWorkpaperList } from './CaseWorkpaperList';
import { REVIEWER_STAGES, recordedExtractionConfidence } from './reviewerDashboardModel';

export function ReviewEmpty({children}: {children: React.ReactNode}) { return <p className="tg-review-empty">{children}</p>; }
function Value({value}: {value: unknown}) { return <>{value === undefined || value === null ? 'Not recorded' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</>; }
export function ReviewerForms({snapshot, jurisdiction}: {snapshot: ReviewerSnapshot; jurisdiction?: 'FEDERAL' | 'STATE'}) {
  const [preview, setPreview] = useState('');
  const forms = snapshot.returns.filter(r => !jurisdiction || (jurisdiction === 'FEDERAL' ? r.jurisdiction === 'FEDERAL' : r.jurisdiction !== 'FEDERAL'))
    .flatMap(r => (r.forms || []).map(f => ({...f,return:r})));
  const selected = forms.find(f => f.return.returnId + ':' + f.formNumber === preview);
  return <div className="tg-review-form-layout"><section><h3>Recorded tax forms</h3><div className="tg-review-scroll"><table><thead><tr><th>Form</th><th>Authority</th><th>Status</th><th>Inspect</th></tr></thead><tbody>{forms.map(f => <tr key={f.return.returnId+':'+f.formNumber}><td>{f.formNumber} · {f.formName}</td><td>{f.return.jurisdiction}</td><td>{f.return.status}</td><td><button onClick={()=>setPreview(f.return.returnId+':'+f.formNumber)}>View fields</button></td></tr>)}</tbody></table></div>{!forms.length && <ReviewEmpty>No recorded forms for this case and tax year.</ReviewEmpty>}</section><section><h3>Form fields & calculation review</h3>{selected ? <><p>{selected.formName} · return {selected.return.returnId}</p><dl>{Object.entries(selected.lineItems).map(([field,value])=><React.Fragment key={field}><dt>{field}</dt><dd><Value value={value}/></dd></React.Fragment>)}</dl><h4>Recorded figures</h4><dl>{Object.entries(selected.return.figures || {}).map(([field,value])=><React.Fragment key={field}><dt>{field}</dt><dd><Value value={value}/></dd></React.Fragment>)}</dl><h4>Diagnostics</h4>{selected.return.diagnostics?.map((d,i)=><p key={i}>{d.severity} · {d.message} · {d.resolved ? 'Resolved' : 'Unresolved'}</p>)}</> : <ReviewEmpty>Select a form to inspect its recorded fields. No private file URLs are exposed.</ReviewEmpty>}</section></div>;
}
export function ReviewerExceptionPanel({snapshot}: {snapshot: ReviewerSnapshot}) {
  const diagnostics = snapshot.returns.flatMap(r=>(r.diagnostics || []).map(d=>({...d,returnId:r.returnId,jurisdiction:r.jurisdiction})));
  return <><h3>Risk & exceptions</h3><p>High-risk queue flags indicate recorded unresolved critical return diagnostics. AI findings remain advisory.</p>
    {snapshot.exceptions.map(e=><details key={e.id}><summary>{e.code || e.id} · {e.status || 'Status not recorded'}</summary><dl>{[['Severity',e.severity],['Source',e.source],['Affected form/document',e.formId || e.documentId],['Explanation',e.explanation || e.message || e.code],['Responsible party',e.assignedTo || e.responsibleParty],['Resolution evidence',e.resolutionEvidenceIds || e.resolution]].map(([label,value])=><React.Fragment key={label}><dt>{label}</dt><dd><Value value={value}/></dd></React.Fragment>)}</dl>{snapshot.resolutions.filter(r=>r.exceptionId===e.id).map(r=><p key={r.id}>{r.reason || r.resolution || r.id} · {r.recordedBy || 'Reviewer not recorded'}</p>)}</details>)}
    {diagnostics.map((d,i)=><p className="tg-review-finding" key={d.returnId+':'+i}>{d.severity} · {d.returnId} · {d.code}: {d.message} · {d.resolved ? 'Resolved' : 'Unresolved'}</p>)}
    {!snapshot.exceptions.length && !diagnostics.length && <ReviewEmpty>No exception or diagnostic artifacts are recorded. This does not establish a completed compliance check.</ReviewEmpty>}
    <p>Authoritative open exception count: {snapshot.case.openExceptions}. Detailed artifact coverage may differ from this count.</p>
  </>;
}
export function ReviewerQualityPanel({snapshot}: {snapshot: ReviewerSnapshot}) {
  return <><h3>Quality review evidence</h3><div className="tg-review-quality">
    <section><h4>Documents</h4><p>{snapshot.documents.length} recorded · {snapshot.documents.filter(d=>d.scanResult?.clean===true && d.scanResult?.verified===true).length} with verified clean-scan evidence</p><small>Completeness against required documents is unavailable.</small></section>
    <section><h4>Reconciliation</h4><p>{snapshot.reconciliations.length} recorded checks</p>{snapshot.reconciliations.map(r=><p key={r.id}>{r.category || r.id} · {r.status || 'Not recorded'}</p>)}</section>
    <section><h4>Calculations & consistency</h4><p>{snapshot.returns.length} recorded return artifacts</p><p>{snapshot.returns.reduce((n,r)=>n+(r.diagnostics?.filter(d=>!d.resolved).length || 0),0)} unresolved recorded diagnostics</p><small>No successful calculation or compliance check is inferred from artifact existence.</small></section>
    <section><h4>Workflow readiness</h4><p>Stage {snapshot.case.activeStage}: {REVIEWER_STAGES[snapshot.case.activeStage-1]}</p><p>{snapshot.case.openExceptions} open exceptions</p>{snapshot.stages.filter(s=>s.stage===snapshot.case.activeStage).map(s=><p key={s.id}>{s.status} · requirements {s.requirementsMet === true ? 'met' : 'not met'}</p>)}</section>
  </div></>;
}
export function ReviewerTraceability({snapshot}: {snapshot: ReviewerSnapshot}) {
  return <><h3>Recorded source traceability</h3>{snapshot.records.map(record=>{
    const sourceId=record.provenance?.sourceDocumentId || record.sourceDocumentId;
    const fieldId=record.provenance?.sourceFieldId || record.sourceFieldId;
    const source=snapshot.documents.find(d=>d.id===sourceId);
    const field=snapshot.extractedFields.find(f=>f.id===fieldId);
    return <details key={record.id}><summary>{record.description || record.category || record.id}</summary><dl>
      <dt>Source document</dt><dd>{source?.fileName || sourceId || 'Source link not recorded'}</dd>
      <dt>Extracted field</dt><dd>{field ? <>{field.field} · <Value value={field.verifiedValue ?? field.correctedValue ?? field.proposedValue}/> · {recordedExtractionConfidence(field.confidence)}</> : fieldId || 'Extraction link not recorded'}</dd>
      <dt>Accounting/tax value</dt><dd><Value value={record.normalizedValue}/></dd>
      <dt>Human verification</dt><dd>{record.provenance?.humanReviewer || 'Not recorded'}</dd>
      <dt>Calculation → tax form field</dt><dd>Field-level lineage is not available in this record contract. Inspect recorded return figures/forms separately.</dd>
    </dl></details>;
  })}{!snapshot.records.length && <ReviewEmpty>No source-linked tax records for this case.</ReviewEmpty>}</>;
}
export function ReviewerHistory({items, notesOnly=false}: {items: ReviewerArtifact[]; notesOnly?: boolean}) {
  const shown=items.filter(r=>!notesOnly || r.notes || r.rationale).sort((a,b)=>String(b.timestamp || b.recordedAt || b.approvedAt || '').localeCompare(String(a.timestamp || a.recordedAt || a.approvedAt || '')));
  return <><h3>{notesOnly ? 'Recorded review notes' : 'Authorized audit & review history'}</h3>{shown.map((r,i)=><article className="tg-review-event" key={r.id+':'+i}><strong>{r.action || r.outcome || r.status || 'Recorded event'}</strong><p>{r.notes || r.rationale || 'No narrative recorded'}</p><small>{r.actorUid || r.reviewer || r.reviewedBy || r.recordedBy || 'Actor not recorded'} · {r.timestamp || r.recordedAt || r.approvedAt || 'Time not recorded'} · revision {r.revision ?? 'not recorded'}</small></article>)}{!shown.length && <ReviewEmpty>No recorded events for this view.</ReviewEmpty>}</>;
}
export function ReviewerReadPanel({tab,snapshot}: {tab:string;snapshot:ReviewerSnapshot}) {
  if(tab==='Overview') return <ReviewerQualityPanel snapshot={snapshot}/>;
  if(['Tax Return','Federal Forms','State Forms'].includes(tab)) return <ReviewerForms snapshot={snapshot} jurisdiction={tab==='Federal Forms'?'FEDERAL':tab==='State Forms'?'STATE':undefined}/>;
  if(tab==='Workpapers') return <><h3>Workpapers</h3>{snapshot.workpapers.length ? <CaseWorkpaperList items={snapshot.workpapers as any}/> : <ReviewEmpty>No recorded workpapers.</ReviewEmpty>}<ReviewerTraceability snapshot={snapshot}/></>;
  if(tab==='Accounting') return <><ReviewerTraceability snapshot={snapshot}/><h3>Recorded reconciliations</h3>{snapshot.reconciliations.map(r=><p key={r.id}>{r.category || r.id} · {r.status} · variance <Value value={r.variance}/></p>)}{!snapshot.reconciliations.length && <ReviewEmpty>No recorded reconciliations.</ReviewEmpty>}</>;
  if(tab==='Exceptions') return <ReviewerExceptionPanel snapshot={snapshot}/>;
  if(tab==='Review Notes' || tab==='Audit / History') return <ReviewerHistory items={snapshot.history} notesOnly={tab==='Review Notes'}/>;
  if(tab==='AI Findings') return <><h3>AI findings · advisory only</h3><p>Human review is required. AI proposals do not approve, reject, sign, file or transition workflow.</p>{snapshot.aiFindings.map(f=><details key={f.id}><summary>{f.proposal?.purpose || f.id}</summary><p><Value value={f.proposal}/></p><p>Evidence reference: {f.evidenceId || 'Not recorded'}</p></details>)}{!snapshot.aiFindings.length && <ReviewEmpty>No recorded AI proposals. No agent execution is simulated.</ReviewEmpty>}</>;
  if(tab==='Documents') return <><h3>Authorized document metadata</h3><div className="tg-review-scroll"><table><thead><tr><th>Document</th><th>Status</th><th>Scan evidence</th><th>Version</th></tr></thead><tbody>{snapshot.documents.map(d=><tr key={d.id}><td>{d.fileName || d.id}</td><td>{d.status}</td><td>{d.scanResult?.verified === true ? d.scanResult.clean === true ? 'Verified clean' : 'Not clean' : 'Unverified'}</td><td>{d.version ?? 'Not recorded'}</td></tr>)}</tbody></table></div>{!snapshot.documents.length && <ReviewEmpty>No document artifacts are recorded.</ReviewEmpty>}<p>Original files remain behind the existing private-storage authorization boundary.</p></>;
  return <ReviewEmpty>No verified integration for this view.</ReviewEmpty>;
}
