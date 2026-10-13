/** UI coordination only: server membership, invitation and AAL2 policy remain authoritative. */
let activeFlows = 0;
export function providerOnlyIdentityFlowActive(): boolean { return activeFlows > 0; }
export function beginProviderOnlyIdentityFlow(): () => void {
  activeFlows++;
  let ended = false;
  return () => { if (!ended) { ended = true; activeFlows--; } };
}
