import { GovernanceError } from '../governance/contracts';
import type { CountsReviewOutput } from './contracts';

/** Deliberately narrow first gateway profile: counts cannot establish taxpayer facts. */
export const COUNTS_REVIEW_SCHEMA={type:'object',additionalProperties:false,required:['status','confidence','finding_codes'],properties:{status:{type:'string',enum:['ADVISORY']},confidence:{type:'string',enum:['UNVERIFIED']},finding_codes:{type:'array',minItems:1,maxItems:10,items:{type:'string',enum:['REVIEW_REQUIRED','EVIDENCE_REQUIRED']}}}} as const;
export const stable=(value:unknown):string=>{
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
};
export function assertTrustedSchema(schema:unknown) {
  if(stable(schema)!==stable(COUNTS_REVIEW_SCHEMA))throw new GovernanceError('AI_OUTPUT_SCHEMA_UNSUPPORTED');
}
export function validateStructuredOutput(text:unknown,schema:unknown):CountsReviewOutput {
  assertTrustedSchema(schema);
  if(typeof text!=='string'||text.length>4096)throw new GovernanceError('AI_INVALID_STRUCTURED_OUTPUT');
  let r:CountsReviewOutput;
  try{r=JSON.parse(text);}catch{throw new GovernanceError('AI_INVALID_STRUCTURED_OUTPUT');}
  if(!r||Array.isArray(r)||Object.keys(r).sort().join(',')!=='confidence,finding_codes,status'||r.status!=='ADVISORY'||r.confidence!=='UNVERIFIED'||
    !Array.isArray(r.finding_codes)||r.finding_codes.length<1||r.finding_codes.length>10||r.finding_codes.some(c=>!['REVIEW_REQUIRED','EVIDENCE_REQUIRED'].includes(c)))throw new GovernanceError('AI_INVALID_STRUCTURED_OUTPUT');
  return r;
}
