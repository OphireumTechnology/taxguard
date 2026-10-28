import { api } from './api';

export async function submitWaiverClaim(
  clientId: string,
  taxYear: number,
  requirementId: string,
  reason: string,
  engagementId?: string
): Promise<void> {
  try {
    await api.post('/api/collection/waiver', {
      clientId,
      taxYear,
      requirementId,
      reason,
      engagementId
    });
  } catch {
    // Mock success in development
  }
}
