import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { User, DocumentItem, Engagement, Message, Appointment, Invoice } from '../types';
import type { GeneratedDocumentRequirement } from '../server/taxguard/taxQuestionnaire';
import { ClientDashboardOverview } from '../components/portal/dashboard/ClientDashboardOverview';
import { ClientDashboardNavigation } from '../components/portal/dashboard/ClientDashboardNavigation';
import { ClientDashboardModule } from '../components/portal/dashboard/ClientDashboardModule';
import { ClientScope, DashboardRequest, deriveNextAction, emptyDashboardData, projectClientJourney, requirementLabel, scopeAppointments, scopeDocuments, scopeEngagements, scopeInvoices, scopeMessages, scopeRequests, scopeRequirements, scopedWorkflow, validClientScope } from '../components/portal/dashboard/clientDashboardModel';

const scope: ClientScope = { userId: 'user-a', clientId: 'client-a', tenantId: 'tenant-a', taxYear: 2024 };
const user = { id: scope.userId, clientId: scope.clientId, tenantId: scope.tenantId, role: 'client', status: 'active', name: 'Fixture Client', email: 'fixture@example.test', createdAt: '2021-04-12' } as User;
const workflow = (activeStage: number) => ({ clientId: scope.clientId, taxYear: scope.taxYear, environment: 'live', activeStage });
const req = (id: string, status = 'Missing') => ({ id, tenantId: scope.tenantId, clientId: scope.clientId, taxYear: scope.taxYear, title: `Requirement ${id}`, status, priority: 'Required', jurisdiction: 'Federal' } as GeneratedDocumentRequirement);
const readyData = () => { const data = emptyDashboardData('ready'); data.documents.data = []; data.engagements.data = []; data.messages.data = []; data.appointments.data = []; data.invoices.data = []; data.requests.data = []; data.requirements.data = []; return data; };

describe('Gate 3 client access and data isolation', () => {
  it('requires an active authenticated client with permanent client and tenant context', () => {
    expect(validClientScope(user, scope.clientId, 2024, 'AUTHENTICATED')).toBe(true);
    expect(validClientScope(user, 'client-b', 2024, 'AUTHENTICATED')).toBe(false);
    expect(validClientScope(user, scope.clientId, 2024, 'INITIALIZING')).toBe(false);
    expect(validClientScope({ ...user, tenantId: undefined }, scope.clientId, 2024, 'AUTHENTICATED')).toBe(false);
    for (const role of ['accountant', 'reviewer', 'admin'] as const) expect(validClientScope({ ...user, role }, scope.clientId, 2024, 'AUTHENTICATED')).toBe(false);
    expect(validClientScope({ ...user, status: 'suspended' }, scope.clientId, 2024, 'AUTHENTICATED')).toBe(false);
  });

  it('filters document and engagement ownership while retaining only real record years', () => {
    const docs = [{ id: 'a', clientId: scope.clientId, taxYear: 2024 }, { id: 'prior', clientId: scope.clientId, taxYear: 2023 }, { id: 'other', clientId: 'client-b', taxYear: 2024 }, { id: 'old', clientId: scope.clientId, taxYear: 2021 }, { id: 'tenant', clientId: scope.clientId, tenantId: 'tenant-b', taxYear: 2024 }] as DocumentItem[];
    expect(scopeDocuments(docs, scope).map(doc => doc.id)).toEqual(['a', 'prior']);
    expect(scopeEngagements(docs as unknown as Engagement[], scope).map(record => record.id)).toEqual(['a', 'prior']);
  });

  it('rejects wrong-tax-year, wrong-client and wrong-tenant checklist/request data', () => {
    const rows = [req('a'), { ...req('year'), taxYear: 2025 }, { ...req('client'), clientId: 'client-b' }, { ...req('tenant'), tenantId: 'tenant-b' }];
    expect(scopeRequirements(rows, scope).map(row => row.id)).toEqual(['a']);
    expect(scopeRequests(rows as unknown as DashboardRequest[], scope).map(row => row.id)).toEqual(['a']);
  });

  it('excludes other conversations, internal notes and prior-year engagement messages', () => {
    const message = { senderId: 'advisor-a', recipientId: scope.userId, content: 'Authorized message', clientId: scope.clientId };
    const rows = [{ ...message, id: 'general' }, { ...message, id: 'current', engagementId: 'eng-a' }, { ...message, id: 'prior', engagementId: 'eng-prior' }, { ...message, id: 'internal', isInternalNote: true }, { ...message, id: 'internal-only', isInternalOnly: true }, { ...message, id: 'other', recipientId: 'user-b' }, { ...message, id: 'spoofed', clientId: 'client-b' }] as Message[];
    expect(scopeMessages(rows, [{ id: 'eng-a', taxYear: 2024 }, { id: 'eng-prior', taxYear: 2023 }] as Engagement[], scope).map(row => row.id)).toEqual(['general', 'current']);
  });

  it('rejects email-only appointments and another client’s invoices', () => {
    const records = [{ id: 'a', clientId: scope.clientId }, { id: 'account', clientId: scope.userId }, { id: 'other', clientId: 'client-b' }, { id: 'email-only', clientEmail: user.email }] as Appointment[];
    expect(scopeAppointments(records, scope).map(row => row.id)).toEqual(['a', 'account']);
    expect(scopeInvoices(records as unknown as Invoice[], scope).map(row => row.id)).toEqual(['a', 'account']);
  });
});

describe('authoritative workflow projection', () => {
  it.each(Array.from({ length: 18 }, (_, index) => index + 1))('projects stage %i to exactly one client-facing phase', stage => {
    const journey = projectClientJourney(workflow(stage), scope);
    expect(journey.filter(step => step.status === 'current')).toHaveLength(1);
    expect(journey.find(step => step.status === 'current')?.stages).toContain(stage);
    expect(journey.filter(step => step.status === 'completed').every(step => Math.max(...step.stages) < stage)).toBe(true);
  });
  it('does not fabricate Stage 02 or completion when workflow is unavailable or scoped elsewhere', () => {
    for (const state of [null, { ...workflow(2), clientId: 'client-b' }, { ...workflow(2), taxYear: 2025 }, { ...workflow(2), environment: 'demo' }, workflow(19)]) {
      expect(scopedWorkflow(state, scope)).toBeNull();
      expect(projectClientJourney(state, scope).every(step => step.status === 'unavailable')).toBe(true);
    }
  });
});

describe('dashboard next action and truthful presentation', () => {
  const render = (data = readyData()) => renderToStaticMarkup(<ClientDashboardOverview user={user} scope={scope} data={data} workflow={workflow(2)} onNavigate={() => {}} onRefresh={() => {}} onSelectYear={() => {}} />);
  it('prioritizes one request before document uploads', () => {
    const data = readyData(); data.requests.data = [{ id: 'r', status: 'OPEN', title: 'Advisor clarification' } as DashboardRequest]; data.requirements.data = [req('a')];
    expect(deriveNextAction(data, workflow(2)).target).toBe('requests');
    data.requests.data = []; expect(deriveNextAction(data, workflow(2)).target).toBe('checklist');
  });
  it('does not claim no action or paid status when data is unavailable', () => {
    const data = emptyDashboardData('unavailable');
    expect(deriveNextAction(data, workflow(2)).target).toBe('refresh');
    expect(render(data)).toContain('Action status not verified');
    expect(render(data)).not.toContain('Paid in Full');
    expect(render(data)).not.toContain('All Requested Documents Received');
  });
  it('distinguishes empty from unavailable data and never invents history, location or taxpayer identity', () => {
    const html = render();
    expect(html).toContain('Welcome back, Fixture Client!');
    expect(html).toContain('2024 tax-return workspace');
    expect(html).toContain('No tax-year records have been recorded.');
    expect(html).toContain('No upcoming appointment is scheduled.');
    expect(html).toContain('No client conversations to display.');
    expect(html).toContain('Not verified');
    for (const fabricated of ['John Doe', 'Texas', 'Elena Rostova', 'bank-level', '2025 tax-return workspace']) expect(html).not.toContain(fabricated);
  });
  it('renders every masterplan area and all ten accessible navigation items', () => {
    const html = render();
    for (const title of ['Your Current Status', 'Return Overview', 'Quick Actions', 'My Tax Years', 'Personalized Document Checklist', 'State-Specific Requirements', 'Important Updates', 'Upcoming Appointment', 'Complete Client Journey', 'Security &amp; Reliability']) expect(html).toContain(title);
    const nav = renderToStaticMarkup(<ClientDashboardNavigation active="home" collapsed onNavigate={() => {}} />);
    expect(nav.match(/aria-label=/g)).toHaveLength(10);
    expect(nav).toContain('aria-current="page"');
  });
  it('does not expose sensitive questionnaire fields in overview markup', () => {
    const data = readyData(); data.questionnaire.data = { answers: { stateOfResidency: 'NY', filingStatus: 'single', hasDependents: false, rawSSN: 'SENSITIVE-SSN', bankAccount: 'SENSITIVE-BANK' } } as unknown as NonNullable<typeof data.questionnaire.data>;
    const html = render(data);
    expect(html).toContain('NY'); expect(html).not.toContain('SENSITIVE-SSN'); expect(html).not.toContain('SENSITIVE-BANK');
  });
  it('never simulates payment settlement or historical return milestones', () => {
    const data = readyData(); data.invoices.data = [{ id: 'invoice-a', invoiceNumber: 'INV-A', amount: 150, currency: 'USD', status: 'unpaid', description: 'Authorized invoice' }] as Invoice[];
    const html = renderToStaticMarkup(<ClientDashboardModule module="billing" data={data} user={user} taxYear={2024} onRefresh={() => {}} onBack={() => {}} onSelectYear={() => {}} />);
    expect(html).toContain('unpaid'); expect(html).not.toContain('processed successfully'); expect(html).not.toContain('OFFICIAL PAYMENT RECEIPT');
    expect(requirementLabel('Rejected')).toBe('Replacement Required'); expect(requirementLabel('Superseded')).toBe('Superseded');
  });
});
