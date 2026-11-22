import { createServiceUnavailableRouter } from './_durableFallback';
export function createAiGovernanceRouter() {
  return createServiceUnavailableRouter('AI_GOVERNANCE_STORE');
}
