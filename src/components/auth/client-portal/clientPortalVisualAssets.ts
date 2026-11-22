import secureVaultWebp from '../../../assets/images/cap_secure_vault_1795326147903.webp';
import secureVaultJpg from '../../../assets/images/cap_secure_vault_1795326147903.jpg';

export interface PortalVaultVisualAsset {
  readonly webp: string;
  readonly jpg: string;
  readonly alt: string;
}

export interface TransparencyStageItem {
  readonly id: string;
  readonly step: string;
  readonly label: string;
  readonly summary: string;
}

export interface ClientConfidenceItem {
  readonly id: 'confidentiality' | 'access' | 'oversight' | 'handling';
  readonly title: string;
  readonly description: string;
}

export const CLIENT_PORTAL_VAULT_ASSET: PortalVaultVisualAsset = {
  webp: secureVaultWebp,
  jpg: secureVaultJpg,
  alt: 'Enterprise midnight-navy and metallic-gold digital financial vault protecting structured client tax documents'
};

export const TRANSPARENCY_NETWORK_STAGES: readonly TransparencyStageItem[] = [
  {
    id: 'client-identity',
    step: '01',
    label: 'Client Identity',
    summary: 'Registered client credentials establish an individual account boundary prior to portal entry.'
  },
  {
    id: 'authorized-access',
    step: '02',
    label: 'Authorized Access',
    summary: 'Account-scoped authentication and optional authenticator verification help govern portal sessions.'
  },
  {
    id: 'protected-records',
    step: '03',
    label: 'Protected Financial Records',
    summary: 'Tax returns, source statements, and advisory files remain organized within your dedicated client workspace.'
  },
  {
    id: 'document-verification',
    step: '04',
    label: 'Document Verification',
    summary: 'Structured intake checkpoints help ensure supporting financial forms are complete and traceable.'
  },
  {
    id: 'professional-review',
    step: '05',
    label: 'Professional Review',
    summary: 'Experienced Destria tax professionals oversee filings, calculations, and client communications.'
  },
  {
    id: 'client-reporting',
    step: '06',
    label: 'Client Reporting',
    summary: 'Clear filing milestones, finalized returns, and CPA messages remain accessible when you need them.'
  }
];

export const CLIENT_CONFIDENCE_INDICATORS: readonly ClientConfidenceItem[] = [
  {
    id: 'confidentiality',
    title: 'Confidential Financial Information',
    description: 'Dedicated client workspace built for private tax documentation and advisory records.'
  },
  {
    id: 'access',
    title: 'Authorized Client Access',
    description: 'Password authentication with optional authenticator verification for registered account holders.'
  },
  {
    id: 'oversight',
    title: 'Professional Financial Oversight',
    description: 'Every filing milestone and tax strategy remains guided by Destria professionals.'
  },
  {
    id: 'handling',
    title: 'Responsible Data Handling',
    description: 'Structured digital intake and documented review workflows built for clarity and accountability.'
  }
];
