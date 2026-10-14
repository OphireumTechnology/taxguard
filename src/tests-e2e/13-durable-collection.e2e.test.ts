import {beforeAll,afterAll,it,expect} from 'vitest';
import {api,apiLogin,C,closeBrowser,ensureStaffed,openModule,sees,sessionWithToken,staffLogin,type Session} from './helpers';
let manager:Session,client:Session,managerToken='',clientToken='',engagement='';
beforeAll(async()=>{manager=await staffLogin('e2e-mgr');managerToken=(await manager.page.evaluate(()=>localStorage.getItem('artax_session_token')))!;engagement=await ensureStaffed(managerToken);clientToken=await apiLogin('e2e-client');client=await sessionWithToken(clientToken,'/portal/collection');});
afterAll(async()=>{await closeBrowser();});
it('saves a client-reported questionnaire draft through the real UI and restores it after refresh',async()=>{
 await sees(client.page,'Document collection · 2025');await client.page.getByRole('button',{name:'Start questionnaire draft',exact:true}).click();
 const dialog=client.page.getByRole('dialog');await dialog.getByLabel('State of Primary Residency').fill('SC');await dialog.getByText('Earned wages reported on Form W-2',{exact:true}).click();
 await dialog.getByRole('button',{name:'Save & Update Checklist',exact:true}).click();await sees(client.page,'Edit questionnaire draft');
 const stored=await api(clientToken,'GET','/api/stage-two-three/questionnaire/2025?engagementId='+encodeURIComponent(engagement));expect(stored.status).toBe(200);expect(stored.body.questionnaire).toMatchObject({version:1,source:'CLIENT_REPORTED',professionalReviewRequired:true,answers:{hasW2Employment:true,stateOfResidency:'SC'}});
 expect(stored.body.requirements.find((r:any)=>r.requirementCode==='W2-WAGE').status).toBe('Required');
 await client.page.reload();await sees(client.page,'Edit questionnaire draft');
 expect((await api(clientToken,'GET','/api/stage-two-three/questionnaire/2025?clientId=foreign')).status).toBe(403);
});
it('persists staff clarification, client reply and staff resolution without professional certification',async()=>{
 await openModule(manager.page,'Clients & Engagements');await manager.page.getByRole('button',{name:/Synthetic Client One/}).click();
 const panel=manager.page.getByRole('region',{name:'Client clarification requests'});await panel.getByLabel('Collection engagement and year').selectOption(engagement+'|2025');
 await panel.getByLabel('Clarification title').fill('Synthetic Phase 11 question');await panel.getByLabel('Clarification message').fill('Please clarify this synthetic evidence only');await panel.getByRole('button',{name:'Create clarification request'}).click();await sees(manager.page,'Clarification request recorded.');
 await client.page.reload();await sees(client.page,'Synthetic Phase 11 question');client.page.once('dialog',dialog=>void dialog.accept('Synthetic Phase 11 response'));
 await client.page.getByRole('button',{name:'Reply',exact:true}).click();await sees(client.page,'Reply recorded.');await client.page.reload();await sees(client.page,'Your reply: Synthetic Phase 11 response');
 await manager.page.reload();await openModule(manager.page,'Clients & Engagements');await manager.page.getByRole('button',{name:/Synthetic Client One/}).click();const refreshed=manager.page.getByRole('region',{name:'Client clarification requests'});await refreshed.getByLabel('Collection engagement and year').selectOption(engagement+'|2025');await sees(manager.page,'Client reply: Synthetic Phase 11 response');await refreshed.getByRole('button',{name:'Resolve clarification'}).click();await sees(manager.page,'Clarification request resolved.');
 const requests=await api(clientToken,'GET','/api/stage-two-three/requests/2025?engagementId='+encodeURIComponent(engagement));const record=requests.body.requests.find((r:any)=>r.title==='Synthetic Phase 11 question');expect(record).toMatchObject({status:'RESOLVED',rowVersion:3});
 expect((await api(clientToken,'POST','/api/stage-two-three/requests/2025',{clientId:C,engagementId:engagement,title:'Forged staff',message:'Synthetic rejected',requestType:'CLARIFICATION'})).status).toBe(403);
});
