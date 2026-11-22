import { apiRequest } from './api';

export async function submitWaiverClaim(...args: any[]): Promise<any> {
  const payload = args.length === 1 && typeof args[0] === 'object' ? args[0] : { args };
  return apiRequest('/api/stage-two-three/waiver', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
