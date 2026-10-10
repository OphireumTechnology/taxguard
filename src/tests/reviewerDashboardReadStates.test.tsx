import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({status:'ready' as 'loading'|'ready'|'error',selected:false}));
vi.mock('../context/AppContext',()=>({useApp:()=>({currentUser:{id:'reviewer',role:'reviewer',status:'active',tenantId:'tenant-a',name:'Reviewer'},authLifecycleState:'AUTHENTICATED',notifications:[],logout:vi.fn()})}));
vi.mock('../hooks/useReviewerDashboardData',()=>({useReviewerDashboardData:()=>({allowed:true,sessionKey:'test-session',caseKey:'test-case',
  queue:{status:state.status,data:[],error:state.status==='error'?'Queue unavailable':''},
  selected:state.selected?{id:'test-case',scope:{tenantId:'tenant-a',clientId:'client-a',engagementId:'eng-a',taxYear:2024},clientName:'Authorized selected client',preparerName:'Assigned preparer',reviewStatus:'Ready for Review'}:undefined,
  snapshot:{status:state.status,data:null,error:state.status==='error'?'Selected workspace unavailable':''},
})}));
import { ReviewerDashboard } from '../components/workspace/ReviewerDashboard';
beforeEach(()=>{state.status='ready';state.selected=false;});
it('shows an empty authorized queue and requires explicit selection without substituting a taxpayer',()=>{
  const html=renderToStaticMarkup(<ReviewerDashboard/>);expect(html).toContain('No authorized cases match');expect(html).toContain('No default taxpayer is substituted');expect(html).not.toContain('Authorized selected client');
});
it('shows queue failure and unknown KPI values rather than claiming zero verified cases',()=>{
  state.status='error';const html=renderToStaticMarkup(<ReviewerDashboard/>);expect(html).toContain('role="alert"');expect(html).toContain('Queue unavailable');expect(html).toContain('—');expect(html).not.toContain('<strong>0</strong>');
});
it('shows scoped workspace loading without fabricated forms or approval eligibility',()=>{
  state.status='loading';state.selected=true;const html=renderToStaticMarkup(<ReviewerDashboard/>);expect(html).toContain('Loading the authorized case');expect(html).toContain('Decision eligibility has not been verified');expect(html).not.toContain('Form 1040');
});
it('shows selected-case error without falling back to another case workspace',()=>{
  state.status='error';state.selected=true;const html=renderToStaticMarkup(<ReviewerDashboard/>);expect(html).toContain('Selected workspace unavailable');expect(html).not.toContain('Form fields &amp; calculation review');expect(html).not.toContain('Independent approval / return');
});
