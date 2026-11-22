export type TaxpayerType = 'individual' | 'business' | 'trust' | 'nonprofit' | string;
export type EntityClassification =
  | 'individual'
  | 'sole_proprietorship'
  | 'single_member_llc'
  | 'multi_member_llc'
  | 'partnership'
  | 'scorp'
  | 'ccorp'
  | 'trust'
  | 'nonprofit'
  | string;

export interface SupportingIdDoc {
  id: string;
  name?: string;
  type?: string;
  category?: string;
  fileName?: string;
  sha256Hash?: string;
  fileSize?: number | string;
  uploadedAt?: string;
  verified?: boolean;
  [key: string]: any;
}

export interface DuplicateCheckReport {
  hasPotentialDuplicates: boolean;
  matches: Array<{
    clientId?: string;
    reason?: string;
    score?: number;
    matchedField?: string;
    details?: string;
    confidence?: string;
    [key: string]: any;
  }>;
  checkedAt?: string;
  [key: string]: any;
}

export interface StageOneDossier {
  id?: string;
  clientId: string;
  taxYear?: number;
  taxpayerType?: TaxpayerType;
  entityClassification?: EntityClassification;
  legalName?: string;
  email?: string;
  phone?: string;
  status?: string;
  supportingDocs?: SupportingIdDoc[];
  duplicateCheck?: DuplicateCheckReport;
  [key: string]: any;
}

export const StageOneOnboardingService: any = {
  createEmptyDossier(clientId: string, taxYear = 2025): StageOneDossier {
    return {
      clientId,
      taxYear,
      taxpayerType: 'individual',
      entityClassification: 'individual',
      status: 'draft',
      supportingDocs: [],
    };
  },
  async getDossier(clientId: string): Promise<StageOneDossier | null> {
    return this.createEmptyDossier(clientId);
  },
  async saveDossier(dossier: StageOneDossier): Promise<StageOneDossier> {
    return { ...dossier, updatedAt: new Date().toISOString() };
  },
  async checkDuplicates(): Promise<DuplicateCheckReport> {
    return { hasPotentialDuplicates: false, matches: [], checkedAt: new Date().toISOString() };
  },
  clearCache(): void {
    // no-op
  },
};
