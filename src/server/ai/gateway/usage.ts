import { GovernanceError } from '../governance/contracts';
import type { Pricing,ProviderResponse,UsageAccounting } from './contracts';
export const unknownUsage=():UsageAccounting=>({input_tokens:null,output_tokens:null,total_tokens:null,cost_nanos:null,state:'UNKNOWN'});
export const notSentUsage=():UsageAccounting=>({input_tokens:0,output_tokens:0,total_tokens:0,cost_nanos:'0',state:'KNOWN'});
export function accountUsage(response:ProviderResponse,pricing:Pricing):UsageAccounting{
  const u=response.usage;
  if(!u||![u.input_tokens,u.output_tokens,u.total_tokens].every(v=>Number.isSafeInteger(v)&&v>=0)||u.total_tokens!==u.input_tokens+u.output_tokens)return unknownUsage();
  return {...u,cost_nanos:(BigInt(u.input_tokens)*BigInt(pricing.input_nanos_per_token)+BigInt(u.output_tokens)*BigInt(pricing.output_nanos_per_token)).toString(),state:'KNOWN'};
}
export function dollarsToNanos(value:unknown):bigint{
  const s=String(value);
  if(!/^\d+(\.\d{1,9})?$/.test(s))throw new GovernanceError('AI_PRICING_UNAVAILABLE');
  const [whole,fraction='']=s.split('.');return BigInt(whole)*1000000000n+BigInt(fraction.padEnd(9,'0'));
}
export const nanosToRunCost=(nanos:string)=>{const n=(BigInt(nanos)+9n)/10n;return `${n/100000000n}.${(n%100000000n).toString().padStart(8,'0')}`;};
