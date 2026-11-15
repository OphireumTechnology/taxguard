import type { ChecklistRequirement } from './stageTwoCollectionService';

export interface ReconciledRequirementCard extends ChecklistRequirement {
  matchedDocumentIds: string[];
  completenessPercent: number;
  [key: string]: any;
}

export interface StageTwoAuthoritativeSnapshot {
  clientId: string;
  engagementId: string;
  taxYear: number;
  readinessScore: number;
  totalRequired: number;
  receivedCount: number;
  acceptedCount: number;
  missingCount: number;
  cards: ReconciledRequirementCard[];
  lastUpdatedAt: string;
  [key: string]: any;
}

export class StageTwoReconciliationService {
  static buildSnapshot(
    clientId: string,
    engagementId: string,
    taxYear: number,
    requirements: ChecklistRequirement[] = [],
  ): StageTwoAuthoritativeSnapshot {
    const cards: ReconciledRequirementCard[] = requirements.map(r => ({
      ...r,
      matchedDocumentIds: [],
      completenessPercent: r.status === 'Accepted' || r.status === 'Verified' ? 100 : r.status === 'Received' ? 50 : 0,
    }));
    const acceptedCount = cards.filter(c => c.status === 'Accepted' || c.status === 'Verified').length;
    const receivedCount = cards.filter(c => c.status === 'Received' || c.status === 'Accepted' || c.status === 'Verified').length;
    const totalRequired = cards.length;
    const readinessScore = totalRequired > 0 ? Math.round((acceptedCount / totalRequired) * 100) : 100;
    return {
      clientId,
      engagementId,
      taxYear,
      readinessScore,
      totalRequired,
      receivedCount,
      acceptedCount,
      missingCount: Math.max(0, totalRequired - receivedCount),
      cards,
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}
