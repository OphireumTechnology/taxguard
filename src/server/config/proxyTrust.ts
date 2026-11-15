/** Direct hosting is the safe default. Positive hop counts require a reviewed edge topology. */
export function proxyTrustHops(value=process.env.TAXGUARD_TRUST_PROXY_HOPS):number{
 if(value===undefined||value==='')return 0;
 if(!/^[0-2]$/.test(value))throw new Error('PROXY_TRUST_CONFIGURATION_INVALID');
 return Number(value);
}
