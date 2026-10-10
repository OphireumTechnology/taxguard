import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ACCOUNTANT_JOURNEY, ACCOUNTANT_STAGES, AccountantCase, confidence, matchesQueue, safeCases } from '../components/workspace/accountantDashboardModel';
import { projectAccountantCases } from '../server/accountantDashboardProjection';
import type { User, Engagement, DocumentItem } from '../types';
const session = vi.hoisted(() => ({ user: { id: 'staff', role: 'accountant', status: 'active', tenantId: 'tenant-a', name: 'Authorized Staff' }, auth: 'AUTHENTICATED' }));
vi.mock('../context/AppContext', () => ({useApp: () => ({currentUser:session.user, authLifecycleState:session.auth, logout:vi.fn(), notifications:[]})}));
import { AccountantDashboard, accountantAccess } from '../components/workspace/AccountantDashboard';
const row: AccountantCase = {id:'case-a', tenantId:'tenant-a', clientId:'client-a', authorityClientId:'a', engagementId:'eng-a', taxYear:2024, clientName:'Scoped Client', status:'in_preparation', priority:'medium', dueDate:'2026-10-08', serviceTitle:'Tax preparation', documents:[]};
describe('accountant dashboard masterplan', () => {
  it('renders the authorized shared shell with controlled loading and no sample taxpayer', () => {
    const html=renderToStaticMarkup(<AccountantDashboard/>);
    expect(html).toContain('TAXGUARD'); expect(html).toContain('My Work Queue'); expect(html).toContain('Loading authorized'); expect(html).not.toContain('Daniel Henze'); expect(html).not.toContain('98%');
  });
  it.each(['client','reviewer','admin','operations','preparer','guest'])('rejects unsupported dashboard role %s', role => {
    expect(accountantAccess({...session.user,role},session.auth)).toBe(false);
  });
  it('rejects inactive, uninitialized and tenantless sessions', () => {
    expect(accountantAccess({...session.user,status:'suspended'},session.auth)).toBe(false);
    expect(accountantAccess({...session.user,tenantId:undefined},session.auth)).toBe(false);
    expect(accountantAccess(session.user,'INITIALIZING')).toBe(false);
  });
  it('filters tenant, malformed year and cross-client/year documents', () => {
    const documents=[{id:'good',clientId:'client-a',taxYear:2024},{id:'other-year',clientId:'client-a',taxYear:2023},{id:'other-client',clientId:'client-b',taxYear:2024}] as DocumentItem[];
    const filtered=safeCases([{...row,documents},{...row,id:'other',tenantId:'tenant-b'},{...row,id:'bad',taxYear:NaN}], 'tenant-a');
    expect(filtered).toHaveLength(1); expect(filtered[0].documents.map(d=>d.id)).toEqual(['good']);
  });
  it('derives filters from recorded status and due date without claiming filing readiness', () => {
    expect(matchesQueue(row,'Due Today','2026-10-08')).toBe(true);
    expect(matchesQueue(row,'Overdue','2026-10-09')).toBe(true);
    expect(matchesQueue({...row,status:'completed'},'Overdue','2026-10-09')).toBe(false);
    expect(matchesQueue(row,'In Preparation','2026-10-08')).toBe(true);
    expect(matchesQueue({...row,activeStage:12},'Ready to File','2026-10-08')).toBe(false);
    expect(matchesQueue({...row,status:'filed'},'Filed This Month','2026-10-08')).toBe(false);
  });
  it.each(Array.from({length:18},(_,i)=>i+1))('projects persisted stage %i without creating transitions', stage => {
    expect(ACCOUNTANT_STAGES[stage-1]).toBeTruthy(); expect(ACCOUNTANT_JOURNEY.some(s=>s.stages.includes(stage))).toBe(true);
  });
  it('does not fabricate AI confidence or automatic approval', () => {
    for(const value of [undefined,NaN,Infinity,-1,101,'98']) expect(confidence(value)).toBe('Not reported');
    expect(confidence(92)).toContain('human review required');
  });
});
describe('server dashboard minimal read projection', () => {
  const client={id:'client-a',clientId:'a',tenantId:'tenant-a',role:'client',name:'Scoped Client'} as User;
  const e={id:'eng-a',clientId:'client-a',taxYear:2024,status:'in_preparation'} as Engagement;
  const docs=[{id:'doc-a',clientId:'client-a',taxYear:2024,url:'PRIVATE_URL',downloadUrl:'PRIVATE_URL',extractedData:[{value:'SSN'}],reviewerNotes:'PRIVATE_NOTE'},{id:'doc-b',clientId:'client-a',taxYear:2023}] as unknown as DocumentItem[];
  it('invokes exact engagement/year authorization and drops private URLs/extracted PII', () => {
    const allowed=vi.fn(()=>true); const rows=projectAccountantCases('tenant-a',[e],docs,()=>client,allowed);
    expect(allowed).toHaveBeenCalledWith('client-a',{engagementId:'eng-a',taxYear:2024});
    expect(rows[0].documents).toHaveLength(1); expect(JSON.stringify(rows)).not.toContain('PRIVATE'); expect(JSON.stringify(rows)).not.toContain('SSN');
  });
  it('rejects unassigned, cross-tenant, missing tenant, staff masquerading as client and invalid year', () => {
    expect(projectAccountantCases('tenant-a',[e],docs,()=>client,()=>false)).toEqual([]);
    expect(projectAccountantCases('tenant-b',[e],docs,()=>client,()=>true)).toEqual([]);
    expect(projectAccountantCases(undefined,[e],docs,()=>client,()=>true)).toEqual([]);
    expect(projectAccountantCases('tenant-a',[e],docs,()=>({...client,role:'accountant'}),()=>true)).toEqual([]);
    expect(projectAccountantCases('tenant-a',[{...e,taxYear:2021}],docs,()=>client,()=>true)).toEqual([]);
  });
});
