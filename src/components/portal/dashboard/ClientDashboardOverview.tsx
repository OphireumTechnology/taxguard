import React, { useState } from 'react';
import { Archive, Calendar, CheckCircle2, CreditCard, FileQuestion, FileText, MapPin, MessageSquare, ShieldCheck, UploadCloud, User } from 'lucide-react';
import type { User as ClientUser } from '../../../types';
import { ClientDashboardData, ClientScope, DashboardWorkflow, deriveNextAction, projectClientJourney, requirementLabel, scopedWorkflow } from './clientDashboardModel';
import './clientDashboard.css';

interface Props {
  user: ClientUser;
  scope: ClientScope;
  data: ClientDashboardData;
  workflow?: DashboardWorkflow | null;
  onNavigate: (target: string) => void;
  onRefresh: () => void;
  onSelectYear: (year: number) => void;
}
const dateLabel = (date?: string) => date && Number.isFinite(Date.parse(date)) ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
const unavailable = (status: string, empty: string) => status === 'loading' ? 'Loading…' : status === 'unavailable' ? 'Information unavailable' : empty;
function Panel({ title, children, action, className = '' }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <section className={`tg-client-panel ${className}`}><header><h2>{title}</h2>{action}</header><div className="tg-client-panel-body">{children}</div></section>;
}
function Journey({ workflow, scope, complete = false }: { workflow?: DashboardWorkflow | null; scope: ClientScope; complete?: boolean }) {
  return <ol className={`tg-client-journey ${complete ? 'tg-client-journey-full' : ''}`} aria-label={complete ? 'Complete Client Journey' : 'Current client journey'}>
    {projectClientJourney(workflow, scope).map((step, index) => <li key={step.label} data-status={step.status} aria-current={step.status === 'current' ? 'step' : undefined}>
      <span className="tg-journey-number">{step.status === 'completed' ? <CheckCircle2 size={17} aria-label="Completed" /> : index + 1}</span>
      <strong>{step.label}</strong><small>{complete ? step.description : step.status === 'current' ? 'You are here' : step.status === 'unavailable' ? 'Not verified' : step.status === 'completed' ? 'Completed' : 'Upcoming'}</small>
    </li>)}
  </ol>;
}
export function ClientDashboardOverview({ user, scope, data, workflow, onNavigate, onRefresh, onSelectYear }: Props) {
  const [checklistFilter, setChecklistFilter] = useState('All');
  const [recordFilter, setRecordFilter] = useState<number | 'All'>('All');
  const verifiedWorkflow = scopedWorkflow(workflow, scope);
  const journey = projectClientJourney(verifiedWorkflow, scope);
  const currentPhase = journey.find(step => step.status === 'current')?.label || 'Status unavailable';
  const action = deriveNextAction(data, verifiedWorkflow);
  const docs = data.documents.data?.filter(doc => doc.taxYear === scope.taxYear) || [];
  const requirements = data.requirements.data || [];
  const missing = requirements.filter(req => ['Missing', 'Required', 'Requested'].includes(req.status) && req.priority === 'Required').length;
  const replacements = requirements.filter(req => req.status === 'Rejected').length;
  const received = docs.filter(doc => doc.status !== 'requested').length;
  const openRequests = data.requests.data?.filter(req => ['OPEN', 'IN_PROGRESS', 'PENDING', 'REQUESTED', 'AWAITING_CLIENT', 'NEEDS_RESPONSE'].includes(req.status.toUpperCase())) || [];
  const overdue = openRequests.filter(req => req.dueDate && Date.parse(req.dueDate) < Date.now()).length;
  const messages = data.messages.data || [];
  const unread = messages.filter(msg => msg.recipientId === user.id && msg.isRead === false).length;
  const appointment = data.appointments.data?.filter(appt => ['confirmed', 'pending', 'rescheduled'].includes(appt.status) && Date.parse(appt.date) + 86400000 > Date.now()).sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.timeSlot.localeCompare(b.timeSlot))[0];
  const invoices = data.invoices.data || [];
  const payable = invoices.filter(invoice => ['pending', 'overdue', 'unpaid'].includes(invoice.status) && Number.isFinite(invoice.amount));
  const balances = Array.from(new Set(payable.map(invoice => invoice.currency))).map(currency => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(payable.filter(invoice => invoice.currency === currency).reduce((total, invoice) => total + invoice.amount, 0)));
  const answers = data.questionnaire.data?.answers;
  const state = answers?.stateOfResidency || 'Not available';
  const incomeFlags: Array<[keyof NonNullable<typeof answers>, string]> = [['hasW2Employment', 'W-2 wages'], ['hasSelfEmployment', 'Self-employment'], ['hasInterestIncome', 'Interest'], ['hasDividendIncome', 'Dividends'], ['hasCapitalGainsOrLosses', 'Capital gains/losses'], ['hasRentalProperties', 'Rental income'], ['hasRetirementDistributions', 'Retirement'], ['hasSocialSecurityBenefits', 'Social Security'], ['hasForeignIncomeOrAssets', 'Foreign income/assets']];
  const income = answers ? incomeFlags.filter(([key]) => answers[key] === true).map(([, label]) => label).join(', ') || 'No income sources reported' : 'Not available';
  const engagement = data.engagements.data?.find(record => record.taxYear === scope.taxYear);
  const filingStatus = answers?.filingStatus ? answers.filingStatus.replaceAll('_', ' ').replace(/\b\w/g, value => value.toUpperCase()) : 'Not available';
  const stateRequirements = answers?.stateOfResidency ? requirements.filter(req => req.jurisdiction.toUpperCase().split(/[^A-Z]+/).includes(answers.stateOfResidency.toUpperCase()) && req.statutoryBasis) : [];
  const years = Array.from(new Set([...(data.documents.data || []).map(doc => doc.taxYear), ...(data.engagements.data || []).map(record => record.taxYear)])).filter(year => year >= 2022).sort((a, b) => b - a);
  const updates = [
    ...docs.filter(doc => doc.uploadedAt || doc.reviewedAt).map(doc => ({ id: `doc-${doc.id}`, title: doc.reviewedAt ? `${doc.fileName}: ${doc.status.replaceAll('_', ' ')}` : `Uploaded: ${doc.fileName}`, date: doc.reviewedAt || doc.uploadedAt, target: 'documents' })),
    ...(data.requests.data || []).filter(req => req.createdAt).map(req => ({ id: `req-${req.id}`, title: req.title || req.subject || 'Client request', date: req.createdAt!, target: 'requests' })),
    ...(appointment?.createdAt ? [{ id: `appt-${appointment.id}`, title: 'Appointment recorded', date: appointment.createdAt, target: 'appointments' }] : []),
    ...(engagement?.updatedAt ? [{ id: `eng-${engagement.id}`, title: `Return engagement: ${engagement.status.replaceAll('_', ' ')}`, date: engagement.updatedAt, target: 'tax_return' }] : []),
  ].filter(event => Number.isFinite(Date.parse(event.date))).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 4);
  const go = (target: string) => target === 'refresh' ? onRefresh() : onNavigate(target);
  const view = (target: string, label = 'View All') => <button className="tg-client-link" onClick={() => go(target)}>{label}</button>;

  return <div className="tg-client-dashboard" aria-label="Client tax dashboard">
    <div className="tg-client-top-grid"><div className="tg-client-primary">
      <section className="tg-client-welcome" aria-label="Client welcome and tax-year context">
        <div className="tg-welcome-copy"><User size={34} aria-hidden="true" /><div><h1>Welcome back, {user.name || 'Client'}!</h1><p>Your {scope.taxYear} tax-return workspace</p></div></div>
        <dl><div><dt>Client Since</dt><dd>{Number.isFinite(Date.parse(user.createdAt)) ? new Date(user.createdAt).getFullYear() : 'Not available'}</dd></div><div><dt><MapPin size={12} /> Location</dt><dd>{state}</dd></div><div><dt>State Rules Applied</dt><dd>{stateRequirements.length ? `${state}: ${stateRequirements.length} sourced requirements` : 'Not verified'}</dd></div></dl>
        <Journey workflow={verifiedWorkflow} scope={scope} />
      </section>
      <div className="tg-client-status-grid">
        <Panel title="Your Current Status" className="tg-current-status"><div className="tg-status-heading"><FileText size={34} aria-hidden="true" /><div><h3>{currentPhase}</h3><span className={`tg-client-badge ${action.required ? 'tg-badge-warning' : 'tg-badge-info'}`}>{action.required ? 'Client action required' : action.target === 'refresh' ? 'Action status not verified' : 'No client action reported'}</span></div></div><h3>{action.title}</h3><p>{action.explanation}</p><p>{data.requirements.status === 'ready' ? `${received} documents received · ${missing} required items missing · ${replacements} replacements needed` : 'Document completeness has not been verified.'}</p><button className="tg-client-primary-button" onClick={() => go(action.target)}>{action.target === 'refresh' ? 'Refresh status' : action.required ? 'Continue next action' : 'View return status'}</button></Panel>
        <Panel title={`Return Overview — ${scope.taxYear}`}><dl className="tg-return-facts">{[['Filing Status', filingStatus], ['State', state], ['Dependents', answers?.hasDependents === false ? '0' : answers?.dependentCount !== undefined ? String(answers.dependentCount) : 'Not available'], ['Primary Income Types', income], ['Return Status', engagement?.status.replaceAll('_', ' ') || 'Not available']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><small>Facts from your saved tax-year questionnaire and engagement.</small></Panel>
        <Panel title="Quick Actions"><div className="tg-client-actions">{[
          ['Upload Additional Document', 'upload', UploadCloud], ['View Document Checklist', 'checklist', FileText], ['Update Questionnaire', 'questionnaire', FileQuestion], ['Send a Message', 'messages', MessageSquare], ['Schedule an Appointment', 'appointments', Calendar],
        ].map(([label, target, Icon]) => { const ActionIcon = Icon as typeof UploadCloud; return <button key={String(target)} onClick={() => go(String(target))}><ActionIcon size={16} /><span>{String(label)}</span></button>; })}</div></Panel>
      </div>
      <div className="tg-client-summary-grid">
        <button onClick={() => go('documents')}><FileText className="tg-icon-green" /><div><h3>Documents</h3><p>{data.documents.status === 'ready' ? `${received} received` : unavailable(data.documents.status, '')}</p><small>{data.requirements.status === 'ready' ? `${missing} missing · ${replacements} replacement needed` : 'Checklist unavailable'}</small></div></button>
        <button onClick={() => go('requests')}><FileQuestion className="tg-icon-blue" /><div><h3>Requests</h3><p>{data.requests.status === 'ready' ? `${openRequests.length} open` : unavailable(data.requests.status, '')}</p><small>{data.requests.status === 'ready' ? `${overdue} overdue` : 'Status not verified'}</small></div></button>
        <button onClick={() => go('messages')}><MessageSquare className="tg-icon-purple" /><div><h3>Messages</h3><p>{data.messages.status === 'ready' ? `${unread} unread` : unavailable(data.messages.status, '')}</p><small>Selected-year and general conversations</small></div></button>
        <button onClick={() => go('appointments')}><Calendar className="tg-icon-amber" /><div><h3>Appointments</h3><p>{appointment ? dateLabel(appointment.date) : unavailable(data.appointments.status, 'None scheduled')}</p><small>{appointment?.timeSlot || 'Account calendar'}</small></div></button>
        <button onClick={() => go('billing')}><CreditCard className="tg-icon-green" /><div><h3>Payments</h3><p>{data.invoices.status !== 'ready' ? unavailable(data.invoices.status, '') : balances.join(' · ') || (invoices.length ? 'No outstanding invoices' : 'No invoices')}</p><small>Account-wide invoice status</small></div></button>
      </div>
    </div><aside className="tg-client-context" aria-label="Client updates and communication">
      <Panel title="Important Updates" action={<button className="tg-client-link" onClick={onRefresh}>Refresh</button>}>{updates.length ? <ul className="tg-client-list">{updates.map(event => <li key={event.id}><button onClick={() => go(event.target)}><FileText size={18} /><span>{event.title}<small>{dateLabel(event.date)}</small></span></button></li>)}</ul> : <p>{Object.values(data).some(resource => resource.status === 'loading') ? 'Loading updates…' : 'No verified updates available.'}</p>}</Panel>
      <Panel title="Upcoming Appointment" action={view('appointments', 'View Calendar')}>{appointment ? <div className="tg-client-appointment"><Calendar size={26} /><div><h3>{appointment.serviceType || 'Appointment'}</h3><p>{dateLabel(appointment.date)} · {appointment.timeSlot}</p><p>{appointment.type.replaceAll('_', ' ')} · {appointment.status}</p><small>Appointment time as recorded by the firm.</small></div></div> : <p>{unavailable(data.appointments.status, 'No upcoming appointment is scheduled.')}</p>}</Panel>
      <Panel title="Messages" action={view('messages')}>{messages.length ? <ul className="tg-client-list">{messages.slice(0, 3).map(message => <li key={message.id}><button onClick={() => go('messages')}><MessageSquare size={18} /><span><strong>{message.senderId === user.id ? 'You' : message.senderName || 'Your advisor'}</strong><span className="tg-message-snippet">{message.content}</span><small>{dateLabel(message.createdAt || message.timestamp)}</small></span></button></li>)}</ul> : <p>{unavailable(data.messages.status, 'No client conversations to display.')}</p>}</Panel>
    </aside></div>
    <div className="tg-client-lower-grid">
      <Panel title="My Tax Years & Records (2022+)" action={view('records')}><div className="tg-client-filter" aria-label="Tax-year record filter"><button aria-pressed={recordFilter === 'All'} onClick={() => setRecordFilter('All')}>All Years</button>{years.map(year => <button key={year} aria-pressed={recordFilter === year} onClick={() => setRecordFilter(year)}>{year}</button>)}</div>{years.length ? <ul className="tg-client-list">{years.filter(year => recordFilter === 'All' || recordFilter === year).map(year => { const yearEngagement = data.engagements.data?.find(record => record.taxYear === year); const count = data.documents.data?.filter(doc => doc.taxYear === year).length; return <li key={year}><button onClick={() => { onSelectYear(year); go('documents'); }}><Archive size={18} /><span><strong>{year}</strong><small>{yearEngagement?.status.replaceAll('_', ' ') || 'Document records only'} · {count ?? 'Unknown'} documents</small></span><span className="tg-client-link">View</span></button></li>; })}</ul> : <p>{data.engagements.status === 'loading' || data.documents.status === 'loading' ? 'Loading records…' : data.engagements.status === 'unavailable' || data.documents.status === 'unavailable' ? 'Tax-year records are unavailable.' : 'No tax-year records have been recorded.'}</p>}</Panel>
      <Panel title={`Personalized Document Checklist — ${scope.taxYear}`} action={view('checklist')}><div className="tg-client-filter" aria-label="Checklist status filter">{['All', 'Required', 'Received', 'Missing', 'Not Applicable', 'Replacement Required'].map(filter => <button key={filter} aria-pressed={checklistFilter === filter} onClick={() => setChecklistFilter(filter)}>{filter}</button>)}</div>{data.requirements.status === 'ready' ? <ul className="tg-client-list">{requirements.filter(req => checklistFilter === 'All' || requirementLabel(req.status) === checklistFilter).slice(0, 8).map(req => <li key={req.id}><button onClick={() => go('checklist')}><CheckCircle2 size={17} className={['Received', 'Accepted'].includes(req.status) ? 'tg-text-success' : ''} /><span>{req.title}<small>{requirementLabel(req.status)}</small></span></button></li>)}{requirements.filter(req => checklistFilter === 'All' || requirementLabel(req.status) === checklistFilter).length === 0 && <li>No requirements match this filter.</li>}</ul> : <p>{data.requirements.status === 'loading' ? 'Loading checklist…' : 'A verified checklist is unavailable. Save your tax-year questionnaire and open the collection workspace.'}</p>}</Panel>
      <Panel title="State-Specific Requirements"><p className="tg-client-info">{answers?.stateOfResidency ? `Reported residency: ${state}. Sourced document requirements appear below.` : 'State residency has not been verified for this tax year.'}</p>{stateRequirements.length ? <ul className="tg-client-list">{stateRequirements.slice(0, 5).map(req => <li key={req.id}><strong>{req.title}</strong><small>{req.statutoryBasis}</small></li>)}</ul> : <p>No sourced state-rule requirements are available. Your advisor must verify applicable state obligations.</p>}{view('questionnaire', 'Update state information')}</Panel>
    </div>
    <section className="tg-client-complete"><h2>Complete Client Journey</h2><Journey workflow={verifiedWorkflow} scope={scope} complete /></section>
    <section className="tg-client-reliability" aria-label="Security and Reliability"><h2><ShieldCheck size={17} /> Security & Reliability</h2><div><span>Authenticated access</span><span>Private document workspace</span><span>Human review gates</span><span>Responsive access</span></div><p>Jurisdiction coverage, AI-provider availability and record-retention terms are confirmed by your firm; no availability or retention guarantee is implied.</p></section>
  </div>;
}
