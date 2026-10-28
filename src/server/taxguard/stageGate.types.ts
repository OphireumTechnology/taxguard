export interface StageGateEvidence {
  stageNumber: number;
  satisfiedAt: string;
  sourceDocuments: string[];
  assertions: {
    id: string;
    verified: boolean;
    note?: string;
  }[];
  checksum?: string;
}
