import { GovernanceError } from '../governance/contracts';
import type { EvidenceMetadata } from '../capabilities/contracts';
import type { GovernedCapabilityExecutor } from '../capabilities/GovernedCapabilityExecutor';
import type { AdvisoryHandler } from '../orchestration/contracts';

/** Equal hashes indicate equal recorded bytes, never fraud, classification or verified tax facts. */
export function inspectSelectedDocumentDuplicates(evidence: readonly EvidenceMetadata[]) {
  if(!Array.isArray(evidence)||!evidence.length||evidence.length>10)throw new GovernanceError('AI_DOCUMENT_METADATA_INVALID');
  const groups = new Map<string, Set<string>>();
  const sources = new Set<string>();
  const documents = new Map<string,string>();
  for(const row of evidence) {
    if(!row||Object.keys(row).sort().join(',')!=='document_record_id,document_status,document_version,quarantine_status,source_hash,source_id'||
      !/^[a-f0-9]{64}$/.test(row.source_hash)||!Number.isInteger(row.document_version)||row.document_version<1||
      !['RELEASED','VERIFIED'].includes(row.document_status)||row.quarantine_status!=='CLEAN'||
      ![row.source_id,row.document_record_id].every(id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))||sources.has(row.source_id))throw new GovernanceError('AI_DOCUMENT_METADATA_INVALID');
    sources.add(row.source_id);
    const previous=documents.get(row.document_record_id);
    if(previous && previous!==row.source_hash)throw new GovernanceError('AI_DOCUMENT_METADATA_INVALID');
    documents.set(row.document_record_id,row.source_hash);
    const group=groups.get(row.source_hash)??new Set<string>();
    group.add(row.document_record_id);groups.set(row.source_hash,group);
  }
  return {status:'ADVISORY' as const,coverage:'SELECTED_AUTHORIZED_DOCUMENTS_ONLY' as const,
    human_review_required:true as const,fraud_assessed:false as const,authoritative_mutation:false as const,
    duplicate_groups:[...groups].filter(([,ids])=>ids.size>1).map(([hash,ids])=>({source_hash:hash,document_record_ids:[...ids].sort()})).sort((a,b)=>a.source_hash.localeCompare(b.source_hash))};
}

/** Fixed server-owned operation; no model-selected handler, provider, content export or deletion. */
export function createDocumentDuplicateHandler(executor:GovernedCapabilityExecutor,token:string):AdvisoryHandler {
  return async(context,signal)=>{
    if(context.agent_id!=='A10'||context.purpose!=='DOCUMENT_DUPLICATE_CHECK'||context.workflow_stage!==3)throw new GovernanceError('AI_AGENT_MAPPING_DENIED');
    const result=await executor.execute(token,{context,proposal:{capability_id:'document.read',version:'1',arguments:{source_ids:[...context.evidence_source_ids]}}},signal);
    if(result.output.capability_id!=='document.read')throw new GovernanceError('AI_INVALID_STRUCTURED_OUTPUT');
    const report=inspectSelectedDocumentDuplicates(result.output.evidence);
    return {operation_id:context.operation_id,agent_id:'A10',status:'ADVISORY',human_review_required:true,action_executed:false,
      evidence_source_ids:[...context.evidence_source_ids],finding_codes:report.duplicate_groups.length?['EVIDENCE_REQUIRED']:['REVIEW_REQUIRED']};
  };
}
