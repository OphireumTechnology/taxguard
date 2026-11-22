import { api } from './api';

export async function submitWaiverClaim(...args: any[]) {
  const payload =
    args.length === 1 && typeof args[0] === 'object'
      ? args[0]
      : {
          clientId: args[0],
          taxYear: args[1],
          requirementId: args[2],
          reason: args[3],
          engagementId: args[4],
        };
  return api.request('/api/stage-two-three/waiver', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
