import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const session=vi.hoisted(()=>({user:{id:'reviewer',role:'reviewer',status:'active',tenantId:'tenant-a',name:'AUTHORIZED-REVIEWER'},auth:'AUTHENTICATED'}));
vi.mock('../context/AppContext',()=>({useApp:()=>({currentUser:session.user,authLifecycleState:session.auth,logout:vi.fn(),notifications:[]})}));
import { ReviewerDashboard } from '../components/workspace/ReviewerDashboard';
import { ReviewerQualityPanel, ReviewerExceptionPanel, ReviewerForms, ReviewerHistory } from '../components/workspace/ReviewerCasePanels';
import { REVIEWER_STAGES, recordedExtractionConfidence, reviewFilter, reviewerAccess, reviewerDecisionBlock, safeReviewQueue, sameReviewScope } from '../components/workspace/reviewerDashboardModel';
import type { ReviewerQueueCase, ReviewerReturn, ReviewerSnapshot } from '../types/reviewerDashboard';
const scope={tenantId:'tenant-a',clientId:'client-a',engagementId:'eng-a',taxYear:2024};
const row:ReviewerQueueCase={id:'case-a',scope,clientName:'Scoped client',preparerId:'maker',preparerName:'Maker',activeStage:10,caseStatus:'ACTIVE',reviewStatus:'Awaiting Approval',highRisk:false,openExceptions:0,reviewerUid:'reviewer',decisionAllowed:true,dueDate:'2026-10-15'};
const snapshot:ReviewerSnapshot={scope,case:{activeStage:10,revision:1,version:1,preparerUid:'maker',reviewerUid:'reviewer',openExceptions:0,status:'ACTIVE'},independentReviewer:true,decisionsAvailable:true,documents:[],returns:[],workpapers:[],records:[],reconciliations:[],exceptions:[],resolutions:[],aiFindings:[],history:[],stages:[],extractedFields:[],provenance:[]};
const ret={...scope,returnId:'return-a',status:'PREPARER_CERTIFIED',preparerCertifiedBy:'maker',diagnostics:[]} as ReviewerReturn;
beforeEach(()=>{session.user.role='reviewer';session.user.status='active';session.auth='AUTHENTICATED';});
describe('reviewer actual rendered session boundary',()=>{
  it.each(['reviewer','senior_reviewer'])('renders shared shell and controlled loading for %s',role=>{
    session.user.role=role;const html=renderToStaticMarkup(<ReviewerDashboard/>);
    expect(html).toContain('TAXGUARD');expect(html).toContain('AUTHORIZED-REVIEWER');expect(html).toContain('Loading authorized review');
    expect(html).not.toContain('Daniel Henze');expect(html).not.toContain('34120');expect(html).not.toContain('case_rev_001');
  });
  it.each(['client','accountant','admin','operations','billing','preparer'])('rejects %s without rendering identity or workspace',role=>{
    session.user.role=role;const html=renderToStaticMarkup(<ReviewerDashboard/>);expect(html).toContain('access with tenant context is required');expect(html).not.toContain('TAXGUARD');expect(html).not.toContain('AUTHORIZED-REVIEWER');
  });
  it('rejects inactive, tenantless and initializing sessions',()=>{
    expect(reviewerAccess({...session.user,status:'suspended'},session.auth)).toBe(false);
    expect(reviewerAccess({...session.user,tenantId:undefined},session.auth)).toBe(false);
    session.auth='INITIALIZING';expect(renderToStaticMarkup(<ReviewerDashboard/>)).not.toContain('TAXGUARD');
  });
});
describe('reviewer queue and workflow projection',()=>{
  it('rejects mismatched tenant, reviewer, tax year and stage',()=>{
    const rows=safeReviewQueue([row,{...row,scope:{...scope,tenantId:'other'}},{...row,reviewerUid:'other'},{...row,scope:{...scope,taxYear:2021}},{...row,activeStage:19}],scope.tenantId,'reviewer');expect(rows).toEqual([row]);
    expect(sameReviewScope(scope,{...scope,taxYear:2023})).toBe(false);expect(sameReviewScope(scope,{...scope,clientId:'other'})).toBe(false);
  });
  it('derives filters from recorded readiness, exception counts, critical diagnostics and commitments',()=>{
    expect(reviewFilter(row,'Ready for Review','2026-10-15')).toBe(true);expect(reviewFilter(row,'Awaiting Approval','2026-10-15')).toBe(true);
    expect(reviewFilter(row,'High Risk','2026-10-15')).toBe(false);expect(reviewFilter({...row,highRisk:true},'High Risk','2026-10-15')).toBe(true);
    expect(reviewFilter({...row,openExceptions:2},'Exceptions','2026-10-15')).toBe(true);expect(reviewFilter({...row,reviewStatus:'Returned'},'Returned','2026-10-15')).toBe(true);
    expect(reviewFilter(row,'Due Today','2026-10-15')).toBe(true);expect(reviewFilter(row,'Overdue','2026-10-16')).toBe(true);expect(reviewFilter({...row,caseStatus:'CLOSED'},'Overdue','2026-10-16')).toBe(false);
  });
  it.each(Array.from({length:18},(_,i)=>i+1))('projects engine stage %i without reference-image renumbering',stage=>{expect(REVIEWER_STAGES[stage-1]).toBeTruthy();});
  it('keeps existing approval/sign/file authority names',()=>{expect(REVIEWER_STAGES[8]).toBe('Prepare Taxes');expect(REVIEWER_STAGES[9]).toBe('Approve');expect(REVIEWER_STAGES[10]).toBe('Sign');expect(REVIEWER_STAGES[11]).toBe('File');});
});
describe('reviewer presentation and human decision boundaries',()=>{
  it('preserves actual provider confidence units without treating fractional scores as percentages',()=>{
    expect(recordedExtractionConfidence(0.99)).toBe('0.99 (provider value; human review required)');
    expect(recordedExtractionConfidence(0.99)).not.toContain('0.99%');
    expect(recordedExtractionConfidence(undefined)).toBe('Not reported');
  });
  it('does not invent quality successes, missing tax forms or history',()=>{
    const html=renderToStaticMarkup(<><ReviewerQualityPanel snapshot={snapshot}/><ReviewerExceptionPanel snapshot={snapshot}/><ReviewerForms snapshot={snapshot}/><ReviewerHistory items={[]}/></>);
    expect(html).toContain('Completeness against required documents is unavailable');expect(html).toContain('No recorded forms');expect(html).toContain('No recorded events');expect(html).toContain('does not establish a completed compliance check');
  });
  it('disables cross-scope, self/credential-ineligible, uncertified and blocking approvals',()=>{
    expect(reviewerDecisionBlock(snapshot,ret,'APPROVE')).toBe('');
    expect(reviewerDecisionBlock({...snapshot,decisionsAvailable:false},ret,'APPROVE')).toContain('Durable');
    expect(reviewerDecisionBlock(snapshot,{...ret,clientId:'other'},'APPROVE')).toContain('scope');
    expect(reviewerDecisionBlock({...snapshot,independentReviewer:false},ret,'APPROVE')).toContain('Independent');
    expect(reviewerDecisionBlock(snapshot,{...ret,createdBy:'reviewer'},'APPROVE')).toContain('Maker-checker');
    expect(reviewerDecisionBlock(snapshot,{...ret,status:'DRAFT'},'APPROVE')).toContain('certification');
    expect(reviewerDecisionBlock({...snapshot,case:{...snapshot.case,openExceptions:1}},ret,'APPROVE')).toContain('exceptions');
    expect(reviewerDecisionBlock(snapshot,{...ret,diagnostics:[{severity:'CRITICAL_BLOCKING',resolved:false,code:'missing',message:'Missing evidence'}]},'APPROVE')).toContain('diagnostics');
    expect(reviewerDecisionBlock({...snapshot,case:{...snapshot.case,activeStage:11}},ret,'APPROVE')).toContain('Stage 10');
    expect(reviewerDecisionBlock(snapshot,{...ret,status:'APPROVED'},'RETURN')).toContain('cannot be returned');
  });
});
