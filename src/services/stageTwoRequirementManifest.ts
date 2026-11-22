export type StageTwoRequirementStatus =
  | 'REQUIRED'
  | 'REQUESTED'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'RECEIVED'
  | 'COLLECTION_ACCEPTED'
  | 'NEEDS_REVIEW'
  | 'REJECTED'
  | 'WAIVED'
  | 'NOT_APPLICABLE'
  | 'OPTIONAL'
  | string;

export type TaxRequirementPriority =
  | 'Required'
  | 'Required if applicable'
  | 'Recommended'
  | 'Optional';

export interface TaxRequirementItem {
  requirementId: string;
  id?: string;
  title: string;
  category?: string;
  documentType?: string;
  expectedDocumentTypes?: string[];
  required: boolean;
  optional?: boolean;
  priority: TaxRequirementPriority;
  status: StageTwoRequirementStatus;
  requestStatus?: string;
  reason?: string;
  issuerName?: string;
  employerName?: string;
  payerName?: string;
  taxYear?: number;
  jurisdiction?: string;
  matchedDocumentIds?: string[];
  uploadedDocumentIds?: string[];
  notes?: string;
  discoveredFromDocumentId?: string;
  [key: string]: any;
}

export interface StageTwoCollectionException {
  id: string;
  exceptionId?: string;
  code?: string;
  category?: string;
  type?: string;
  severity: string;
  status: string;
  title: string;
  description?: string;
  message?: string;
  documentId?: string;
  requirementId?: string;
  taxYear?: number;
  detectedAt?: string;
  createdAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  [key: string]: any;
}

export interface TaxRequirementManifest {
  manifestId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  taxpayerName: string;
  filingStatus: string;
  returnType: string;
  primaryJurisdiction: string;
  additionalJurisdictions: string[];
  jurisdictions: string[];
  requirements: TaxRequirementItem[];
  exceptions: StageTwoCollectionException[];
  version: number;
  updatedAt: string;
  createdAt: string;
  [key: string]: any;
}

const manifests = new Map<string, TaxRequirementManifest>();

function manifestKey(clientId: string, taxYear: number): string {
  return `${clientId}::${taxYear}`;
}

export const TaxRequirementManifestEngine = {
  getOrCreateManifest(
    clientId: string,
    taxYear: number,
    engagementId = `eng_${clientId}_${taxYear}`
  ): TaxRequirementManifest {
    const key = manifestKey(clientId, taxYear);
    const existing = manifests.get(key);
    if (existing) return existing;
    const now = new Date().toISOString();
    const created: TaxRequirementManifest = {
      manifestId: `man_${clientId}_${taxYear}`,
      clientId,
      engagementId,
      taxYear,
      taxpayerName: 'Client Taxpayer',
      filingStatus: 'single',
      returnType: '1040',
      primaryJurisdiction: 'SC',
      additionalJurisdictions: [],
      jurisdictions: ['US-FED', 'SC'],
      requirements: [],
      exceptions: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    manifests.set(key, created);
    return created;
  },

  saveManifest(manifest: TaxRequirementManifest): TaxRequirementManifest {
    manifest.version = (manifest.version || 0) + 1;
    manifest.updatedAt = new Date().toISOString();
    manifests.set(manifestKey(manifest.clientId, manifest.taxYear), manifest);
    return manifest;
  },

  addDiscoveredRequirement(
    clientId: string,
    taxYear: number,
    item: Partial<TaxRequirementItem> & { requirementId: string; title?: string }
  ): TaxRequirementItem {
    const manifest = this.getOrCreateManifest(clientId, taxYear);
    const existing = manifest.requirements.find((r) => r.requirementId === item.requirementId);
    if (existing) return existing;
    const created: TaxRequirementItem = {
      title: item.title || item.requirementId,
      required: item.required ?? true,
      priority: item.priority || 'Required',
      status: item.status || 'REQUIRED',
      matchedDocumentIds: [],
      ...item,
    };
    manifest.requirements.push(created);
    this.saveManifest(manifest);
    return created;
  },

  resetForTesting(): void {
    manifests.clear();
  },
};
