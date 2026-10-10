import { beforeEach, describe, expect, it } from 'vitest';
import { TaxGuardAuthorityRepository, casePath } from '../server/taxguard/authority.repository';
import { TransactionalDocumentDatabase } from '../server/taxguard/transactionalDatabase';
import type { ReviewerDecision } from '../types/reviewerDashboard';

const scope={tenantId:'review-tenant',clientId:'review-client',engagementId:'review-eng',taxYear:2024};
const decision:ReviewerDecision={version:1,operationId:'review_decision',returnId:'return-a',decision:'APPROVE',confirmed:true,reason:'Independent review verified all recorded calculation evidence.'};
let database:TransactionalDocumentDatabase; let repo:TaxGuardAuthorityRepository;
async function seed(tenant=scope.tenantId,client=scope.clientId,eng=scope.engagementId,year=2024,reviewer='reviewer') {
  const s={tenantId:tenant,clientId:client,engagementId:eng,taxYear:year};
  const prefix=`taxguardTenants/${tenant}`;
  for(const [id,member] of Object.entries({admin:{role:'administrator'},owner:{role:'client',clientId:client},preparer:{role:'accountant'},reviewer:{role:'reviewer',credentialVerified:true,credentialType:'CPA',credentialExpiresAt:'2099-12-31'},other:{role:'reviewer',credentialVerified:true,credentialType:'EA',credentialExpiresAt:'2099-12-31'}})) database.records.set(`${prefix}/members/${id}`,{...member,status:'active',name:id});
  database.records.set(`${prefix}/clients/${client}`,{ownerUid:'owner',name:'Scoped client '+client});
  database.records.set(`${prefix}/clients/${client}/engagements/${eng}`,{clientId:client,taxYears:[year],dueDate:'2026-10-15',priority:'high'});
  await repo.createCase(s,'admin',{clientUid:'owner',preparerUid:'preparer',reviewerUid:reviewer});
  const path=casePath(s);database.records.set(path,{...database.records.get(path),activeStage:10});
  database.records.set(`${path}/draftReturns/return-a`,{id:'return-a',returnId:'return-a',...s,caseId:'case_'+year,status:'PREPARER_CERTIFIED',preparerCertifiedBy:'preparer',createdBy:'preparer',forms:[],diagnostics:[],figures:{taxableIncome:100},jurisdiction:'FEDERAL',returnType:'INDIVIDUAL_1040',version:1});
  return s;
}
beforeEach(async()=>{database=new TransactionalDocumentDatabase();repo=new TaxGuardAuthorityRepository(database);await seed();});
describe('reviewer authority read boundaries',()=>{
  it('discovers assigned cases only, including the exact authorized tax year',async()=>{
    await seed(scope.tenantId,'unassigned-client','unassigned-eng',2024,'other');
    await seed('other-tenant','other-client','other-eng',2024);
    await seed(scope.tenantId,scope.clientId,scope.engagementId,2023,'other');
    const rows=await repo.listReviewerQueue(scope.tenantId,'reviewer');
    expect(rows.map(r=>r.scope)).toEqual([scope]); expect(rows[0].reviewStatus).toBe('Awaiting Approval');
    expect(rows[0].decisionAllowed).toBe(true); expect(rows[0].highRisk).toBe(false);
  });
  it('rejects preparer/client reads and unassigned or wrong-year selected workspaces',async()=>{
    await expect(repo.listReviewerQueue(scope.tenantId,'preparer')).rejects.toThrow('REVIEWER_REQUIRED');
    await expect(repo.getReviewerSnapshot(scope,'owner')).rejects.toThrow('REVIEWER_REQUIRED');
    await expect(repo.getReviewerSnapshot(scope,'other')).rejects.toThrow('CASE_ACCESS_DENIED');
    await expect(repo.getReviewerSnapshot({...scope,taxYear:2023},'reviewer')).rejects.toThrow('CASE_ACCESS_DENIED');
  });
  it('excludes private file paths/URLs and sensitive identification extraction',async()=>{
    const root=casePath(scope);
    database.records.set(root+'/documents/doc-a',{id:'doc-a',...scope,fileName:'Authorized tax document',status:'QUARANTINED',storagePath:'PRIVATE_PATH',signedUrl:'PRIVATE_URL',scanResult:{clean:false,verified:false}});
    database.records.set(root+'/extractedFields/ssn',{id:'ssn',...scope,field:'social_security_number',proposedValue:'SENSITIVE_IDENTIFIER'});
    database.records.set(root+'/draftReturns/corrupt',{id:'corrupt',...scope,clientId:'another-client',forms:[{formName:'OTHER_CLIENT_FORM'}]});
    const snapshot=await repo.getReviewerSnapshot(scope,'reviewer');
    expect(snapshot.documents[0].status).toBe('QUARANTINED');
    const output=JSON.stringify(snapshot);expect(output).not.toContain('PRIVATE_');expect(output).not.toContain('SENSITIVE_IDENTIFIER');expect(output).not.toContain('OTHER_CLIENT_FORM');
  });
  it('returns only stored history and advisory AI artifacts',async()=>{
    const root=casePath(scope);database.records.set(root+'/aiProposals/ai-a',{proposal:{summary:'Potential discrepancy'},...scope});
    const snapshot=await repo.getReviewerSnapshot(scope,'reviewer');
    expect(snapshot.aiFindings[0].requiresHumanReview).toBe(true);expect(snapshot.aiFindings[0].externalSubmissionAllowed).toBe(false);
    expect(snapshot.history).toHaveLength(1); // The real create-case bootstrap audit only.
  });
});
describe('reviewer approval and return transactions',()=>{
  it('records independent approval and audit evidence without signing, filing or advancing stages',async()=>{
    const result=await repo.decideReviewerReturn(scope,'reviewer',decision);
    expect(result.version).toBe(2);expect(database.records.get(casePath(scope)).activeStage).toBe(10);
    expect(database.records.get(casePath(scope)).externalSubmissionEnabled).toBe(false);
    const approval=database.records.get(casePath(scope)+'/approvals/'+result.approvalId);
    expect(approval.approvedBy).toBe('reviewer');expect(approval.rationale).toBe(decision.reason);expect(approval.returnHash).toBeTruthy();
    expect(database.records.get(casePath(scope)+'/audit/'+decision.operationId).actorUid).toBe('reviewer');
    expect([...database.records.keys()].some(k=>k.includes('/signatures/')||k.includes('/filings/'))).toBe(false);
  });
  it('requires meaningful reason, correction instructions and explicit confirmation',async()=>{
    await expect(repo.decideReviewerReturn(scope,'reviewer',{...decision,confirmed:false})).rejects.toThrow('REVIEW_CONFIRMATION_REQUIRED');
    await expect(repo.decideReviewerReturn(scope,'reviewer',{...decision,reason:'Looks fine'})).rejects.toThrow('MEANINGFUL_REVIEW_REASON_REQUIRED');
    await expect(repo.decideReviewerReturn(scope,'reviewer',{...decision,decision:'RETURN',corrections:'fix'})).rejects.toThrow('CORRECTION_DETAILS_REQUIRED');
    expect(database.records.get(casePath(scope)).version).toBe(1);
  });
  it('records return reason and corrections atomically, without invented workflow transitions',async()=>{
    const corrections='Reconcile the withholding mismatch against the verified source document.';
    await repo.decideReviewerReturn(scope,'reviewer',{...decision,decision:'RETURN',corrections});
    const root=casePath(scope);expect(database.records.get(root+'/draftReturns/return-a').status).toBe('REJECTED');
    expect(database.records.get(root+'/reviewActions/'+decision.operationId).notes).toContain(corrections);
    expect(database.records.get(root+'/audit/'+decision.operationId).actorUid).toBe('reviewer');
    expect(database.records.get(root).activeStage).toBe(10);
    expect([...database.records.keys()].some(k=>k.includes('/approvals/'))).toBe(false);
  });
  it('rejects preparer self-approval and expired/unverified professional credentials',async()=>{
    await expect(repo.decideReviewerReturn(scope,'preparer',decision)).rejects.toThrow('MAKER_CHECKER_VIOLATION');
    database.records.set(`taxguardTenants/${scope.tenantId}/members/reviewer`,{role:'reviewer',status:'active',credentialVerified:true,credentialType:'CPA',credentialExpiresAt:'2001-01-01'});
    await expect(repo.decideReviewerReturn(scope,'reviewer',decision)).rejects.toThrow('INDEPENDENT_PROFESSIONAL_REQUIRED');
  });
  it.each([9,11,12,13,14,15])('rejects approval at stage %i without changing authority',async stage=>{
    const root=casePath(scope);database.records.set(root,{...database.records.get(root),activeStage:stage});
    await expect(repo.decideReviewerReturn(scope,'reviewer',decision)).rejects.toThrow('REVIEW_APPROVAL_NOT_PERMITTED');
    expect(database.records.get(root).version).toBe(1);
  });
  it('rejects uncertified, blocked, already approved and misidentified returns',async()=>{
    const root=casePath(scope),path=root+'/draftReturns/return-a';const original=database.records.get(path);
    database.records.set(path,{...original,status:'DRAFT'});await expect(repo.decideReviewerReturn(scope,'reviewer',decision)).rejects.toThrow('REVIEW_APPROVAL_NOT_PERMITTED');
    database.records.set(path,{...original,diagnostics:[{severity:'CRITICAL_BLOCKING',resolved:false}]});await expect(repo.decideReviewerReturn(scope,'reviewer',decision)).rejects.toThrow('BLOCKING_DIAGNOSTICS_REMAIN');
    database.records.set(path,{...original,status:'APPROVED'});await expect(repo.decideReviewerReturn(scope,'reviewer',{...decision,decision:'RETURN',corrections:'Correct the recorded source withholding calculation.'})).rejects.toThrow('REVIEW_RETURN_NOT_PERMITTED');
    database.records.set(path,original);await expect(repo.decideReviewerReturn(scope,'reviewer',{...decision,returnId:'return'})).rejects.toThrow('REVIEW_APPROVAL_NOT_PERMITTED');
  });
  it('blocks open exceptions, stale versions and changed idempotent rationale',async()=>{
    const root=casePath(scope),original=database.records.get(root);
    database.records.set(root,{...original,openExceptions:1});await expect(repo.decideReviewerReturn(scope,'reviewer',decision)).rejects.toThrow('UNRESOLVED_EXCEPTIONS');
    database.records.set(root,original);await expect(repo.decideReviewerReturn(scope,'reviewer',{...decision,version:99})).rejects.toThrow('VERSION_CONFLICT');
    await repo.decideReviewerReturn(scope,'reviewer',decision);
    await expect(repo.decideReviewerReturn(scope,'reviewer',{...decision,reason:'A different review reason after the signed audit decision.'})).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect((await repo.decideReviewerReturn(scope,'reviewer',decision)).replayed).toBe(true);
  });
  it('rolls back all decision/audit writes on transaction failure',async()=>{
    database.failCommit=true;await expect(repo.decideReviewerReturn(scope,'reviewer',decision)).rejects.toThrow('Commit unavailable');
    expect(database.records.get(casePath(scope)).version).toBe(1);expect(database.records.get(casePath(scope)+'/audit/'+decision.operationId)).toBeUndefined();
  });
});
