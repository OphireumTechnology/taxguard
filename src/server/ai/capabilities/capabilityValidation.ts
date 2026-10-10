import { GovernanceError } from '../governance/contracts';
import type { ResolvedConfiguration } from '../gateway/contracts';
import type { CapabilityDefinition, CapabilityOutput, CapabilityRequest, EvidenceMetadata } from './contracts';
import { resolveCapability } from './CapabilityRegistry';
import { stable } from '../gateway/structuredOutput';

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const exact = (v: unknown, keys: string): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === keys;
export function parseCapabilityRequest(raw: unknown): {request: CapabilityRequest; definition: CapabilityDefinition} {
  let request: CapabilityRequest;
  try { request = structuredClone(raw) as CapabilityRequest; } catch { throw new GovernanceError('AI_INVALID_CAPABILITY_REQUEST',400); }
  if(!exact(request,'context,proposal') && !exact(request,'context,gateway_correlation,proposal')) throw new GovernanceError('AI_INVALID_CAPABILITY_REQUEST',400);
  if(!exact(request.proposal,'arguments,capability_id,version')) throw new GovernanceError('AI_INVALID_CAPABILITY_REQUEST',400);
  const definition = resolveCapability(request.proposal.capability_id,request.proposal.version);
  if(request.gateway_correlation && (!exact(request.gateway_correlation,'attempt_id,run_id') || !isUuid(request.gateway_correlation.run_id) || !isUuid(request.gateway_correlation.attempt_id))) throw new GovernanceError('AI_INVALID_CAPABILITY_REQUEST',400);
  const args=request.proposal.arguments;
  if(definition.id === 'workflow.read') {
    if(!exact(args,'')) throw new GovernanceError('AI_INVALID_CAPABILITY_ARGUMENTS',400);
  } else {
    const ids=args?.source_ids;
    if(!exact(args,'source_ids') || !Array.isArray(ids) || !ids.length || ids.length>10 || !ids.every(isUuid) || new Set(ids).size!==ids.length) throw new GovernanceError('AI_INVALID_CAPABILITY_ARGUMENTS',400);
    if(!Array.isArray(request.context?.evidence_source_ids) || ids.some(id => !request.context.evidence_source_ids.includes(id))) throw new GovernanceError('AI_CAPABILITY_EVIDENCE_DENIED');
  }
  return {request,definition};
}
export function evidenceMetadata(c: ResolvedConfiguration): EvidenceMetadata[] {
  return c.snapshot.evidence.map(e => ({source_id:e.source_id,document_record_id:e.document_record_id!,document_version:e.document_version!,source_hash:e.source_hash,
    document_status:e.document_status as 'RELEASED'|'VERIFIED',quarantine_status:'CLEAN' as const})).sort((a,b)=>a.source_id.localeCompare(b.source_id));
}
export function validateCapabilityOutput(raw: unknown,d: CapabilityDefinition,c: ResolvedConfiguration,r: CapabilityRequest): CapabilityOutput {
  let output: CapabilityOutput;
  try { output=structuredClone(raw) as CapabilityOutput; if(Buffer.byteLength(JSON.stringify(output),'utf8')>d.maximum_output_bytes) throw new Error(); }
  catch { throw new GovernanceError('AI_INVALID_CAPABILITY_OUTPUT'); }
  if(d.id==='workflow.read') {
    const o=output as Extract<CapabilityOutput,{capability_id:'workflow.read'}>;
    if(!exact(o,'capability_id,stage,status,workflow_version') || o.capability_id!==d.id || o.workflow_version!=='LEGACY_18_V1' || o.stage!==c.snapshot.case.active_stage || o.status!==c.snapshot.case.status) throw new GovernanceError('AI_INVALID_CAPABILITY_OUTPUT');
  } else {
    const o=output as Extract<CapabilityOutput,{capability_id:'document.read'}>;
    const ids=r.proposal.arguments.source_ids as string[];
    const expected=evidenceMetadata(c).filter(e=>ids.includes(e.source_id));
    if(!exact(o,'capability_id,evidence') || o.capability_id!==d.id || !Array.isArray(o.evidence) || o.evidence.length>d.maximum_rows || o.evidence.length!==ids.length || o.evidence.some(e=>!e||typeof e.source_id!=='string') ||
      stable([...o.evidence].sort((a,b)=>a.source_id?.localeCompare(b.source_id)))!==stable(expected)) throw new GovernanceError('AI_INVALID_CAPABILITY_OUTPUT');
  }
  return output;
}
