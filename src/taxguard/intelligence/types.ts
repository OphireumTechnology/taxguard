export interface EvidencePackage {
  id: string;
  sourceDocuments: string[];
  findings: Array<{ category: string; summary: string }>;
  timestamp: string;
}
