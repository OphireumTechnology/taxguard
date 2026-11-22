import heroIndividualJpg from '../../../assets/images/svc_hero_individual_1795330307114.jpg';
import heroIndividualWebp from '../../../assets/images/svc_hero_individual_1795330307114.webp';
import heroBusinessJpg from '../../../assets/images/svc_hero_business_1795330361881.jpg';
import heroBusinessWebp from '../../../assets/images/svc_hero_business_1795330361881.webp';
import heroEstateJpg from '../../../assets/images/svc_hero_estate_1795330307651.jpg';
import heroEstateWebp from '../../../assets/images/svc_hero_estate_1795330307651.webp';
import heroCreditJpg from '../../../assets/images/svc_hero_credit_1795330307648.jpg';
import heroCreditWebp from '../../../assets/images/svc_hero_credit_1795330307648.webp';
import auditDefenseJpg from '../../../assets/images/svc_audit_defense_1795330308028.jpg';
import auditDefenseWebp from '../../../assets/images/svc_audit_defense_1795330308028.webp';

import indFedStateJpg from '../../../assets/images/svc_ind_fed_state_1795330306576.jpg';
import indFedStateWebp from '../../../assets/images/svc_ind_fed_state_1795330306576.webp';
import indAmendedJpg from '../../../assets/images/svc_ind_amended_1795330306737.jpg';
import indAmendedWebp from '../../../assets/images/svc_ind_amended_1795330306737.webp';
import indPlanningJpg from '../../../assets/images/svc_ind_planning_1795330307282.jpg';
import indPlanningWebp from '../../../assets/images/svc_ind_planning_1795330307282.webp';
import indW21099Jpg from '../../../assets/images/svc_ind_w2_1099_1795330309326.jpg';
import indW21099Webp from '../../../assets/images/svc_ind_w2_1099_1795330309326.webp';
import indTranscriptJpg from '../../../assets/images/svc_ind_transcript_1795330306850.jpg';
import indTranscriptWebp from '../../../assets/images/svc_ind_transcript_1795330306850.webp';
import indAcaJpg from '../../../assets/images/svc_ind_aca_1795330361589.jpg';
import indAcaWebp from '../../../assets/images/svc_ind_aca_1795330361589.webp';

import bizEntitiesJpg from '../../../assets/images/svc_biz_entities_1795330307189.jpg';
import bizEntitiesWebp from '../../../assets/images/svc_biz_entities_1795330307189.webp';
import bizQuarterlyJpg from '../../../assets/images/strat_year_end_1795328202868.jpg';
import bizQuarterlyWebp from '../../../assets/images/strat_year_end_1795328202868.webp';
import bizStartupJpg from '../../../assets/images/svc_biz_startup_1795330306897.jpg';
import bizStartupWebp from '../../../assets/images/svc_biz_startup_1795330306897.webp';
import bizBookkeepingJpg from '../../../assets/images/svc_biz_bookkeeping_1795330306610.jpg';
import bizBookkeepingWebp from '../../../assets/images/svc_biz_bookkeeping_1795330306610.webp';
import bizMultistateJpg from '../../../assets/images/svc_biz_multistate_1795330307320.jpg';
import bizMultistateWebp from '../../../assets/images/svc_biz_multistate_1795330307320.webp';
import bizPayrollJpg from '../../../assets/images/svc_biz_payroll_1795330307027.jpg';
import bizPayrollWebp from '../../../assets/images/svc_biz_payroll_1795330307027.webp';

import estWillJpg from '../../../assets/images/svc_est_will_1795330306737.jpg';
import estWillWebp from '../../../assets/images/svc_est_will_1795330306737.webp';
import estTrustJpg from '../../../assets/images/svc_est_trust_1795330306534.jpg';
import estTrustWebp from '../../../assets/images/svc_est_trust_1795330306534.webp';
import estPoaJpg from '../../../assets/images/svc_est_poa_1795330306811.jpg';
import estPoaWebp from '../../../assets/images/svc_est_poa_1795330306811.webp';
import estAssetJpg from '../../../assets/images/svc_est_asset_1795330304975.jpg';
import estAssetWebp from '../../../assets/images/svc_est_asset_1795330304975.webp';

import crdIdentityJpg from '../../../assets/images/cap_secure_vault_1795326147903.jpg';
import crdIdentityWebp from '../../../assets/images/cap_secure_vault_1795326147903.webp';
import crdRestorationJpg from '../../../assets/images/svc_crd_restoration_1795330306123.jpg';
import crdRestorationWebp from '../../../assets/images/svc_crd_restoration_1795330306123.webp';
import crdBusinessJpg from '../../../assets/images/strat_small_business_1795328203183.jpg';
import crdBusinessWebp from '../../../assets/images/strat_small_business_1795328203183.webp';

export type ServiceOverlayMotif =
  | 'pathway'
  | 'timeline'
  | 'trajectory'
  | 'scan'
  | 'compare'
  | 'shield';

export interface ServiceImageAsset {
  jpg: string;
  webp: string;
  alt: string;
  motif: ServiceOverlayMotif;
}

export const CATEGORY_HERO_ASSETS = {
  individual: {
    jpg: heroIndividualJpg,
    webp: heroIndividualWebp,
    alt: 'Senior tax specialist analyzing structured digital tax documents and connected financial records on a glass workstation',
  },
  business: {
    jpg: heroBusinessJpg,
    webp: heroBusinessWebp,
    alt: 'Corporate accounting advisors reviewing transparent financial analytics and digital ledger reconciliation structures',
  },
  estate: {
    jpg: heroEstateJpg,
    webp: heroEstateWebp,
    alt: 'Private wealth advisor reviewing structured digital estate continuity frameworks and protected custody dossiers',
  },
  credit: {
    jpg: heroCreditJpg,
    webp: heroCreditWebp,
    alt: 'Financial analyst evaluating structured credit health trajectories and transparent financial assessment panels',
  },
  auditDefense: {
    jpg: auditDefenseJpg,
    webp: auditDefenseWebp,
    alt: 'Senior CPA specialist reviewing organized tax notice evidence alongside a digital case management interface with protective shield traceability pathways',
  },
};

export const SERVICE_CARD_ASSETS: Record<string, ServiceImageAsset> = {
  // Individual Tax Services (6)
  ind_fed_state: {
    jpg: indFedStateJpg,
    webp: indFedStateWebp,
    alt: 'Structured federal and state digital tax compliance layers linked by champagne gold verification pathways',
    motif: 'pathway',
  },
  ind_amended: {
    jpg: indAmendedJpg,
    webp: indAmendedWebp,
    alt: 'Chronological sequence of historical annual tax record slabs arranged along a traceable gold revision timeline',
    motif: 'timeline',
  },
  ind_planning: {
    jpg: indPlanningJpg,
    webp: indPlanningWebp,
    alt: 'Forward-looking financial scenario projection planes with sculpted metallic gold trajectory curves',
    motif: 'trajectory',
  },
  ind_w2_1099: {
    jpg: indW21099Jpg,
    webp: indW21099Webp,
    alt: 'Optical recognition beam sorting structured income document plates into categorized digital trays',
    motif: 'scan',
  },
  ind_transcript: {
    jpg: indTranscriptJpg,
    webp: indTranscriptWebp,
    alt: 'Side-by-side historical record matrices aligned through a metallic gold optical comparison lens',
    motif: 'compare',
  },
  ind_aca: {
    jpg: indAcaJpg,
    webp: indAcaWebp,
    alt: 'Healthcare tax documentation plates paired with a geometric metallic gold protective emblem and reconciliation line',
    motif: 'shield',
  },

  // Business Tax & Accounting (6)
  biz_entities: {
    jpg: bizEntitiesJpg,
    webp: bizEntitiesWebp,
    alt: 'Multi-tiered corporate entity architecture connected by symmetrical gold stakeholder distribution pathways',
    motif: 'pathway',
  },
  biz_quarterly: {
    jpg: bizQuarterlyJpg,
    webp: bizQuarterlyWebp,
    alt: 'Precision quarterly architectural rings aligned with cash-flow forecasting planes and gold timing pathways',
    motif: 'timeline',
  },
  biz_startup: {
    jpg: bizStartupJpg,
    webp: bizStartupWebp,
    alt: 'Illuminated glass corporate blueprint rising into gold-edged foundational entity pillars and account grids',
    motif: 'trajectory',
  },
  biz_bookkeeping: {
    jpg: bizBookkeepingJpg,
    webp: bizBookkeepingWebp,
    alt: 'Parallel digital ledger columns converging through a metallic gold reconciliation filter into balanced statements',
    motif: 'compare',
  },
  biz_multistate: {
    jpg: bizMultistateJpg,
    webp: bizMultistateWebp,
    alt: 'Dark smoked-glass United States jurisdictional relief plane with interconnected gold commercial nexus hubs',
    motif: 'pathway',
  },
  biz_payroll: {
    jpg: bizPayrollJpg,
    webp: bizPayrollWebp,
    alt: 'Multi-lane digital payroll disbursement channels flowing through gold compliance verification gates',
    motif: 'scan',
  },

  // Financial Protection & Estate Coordination (4)
  est_will: {
    jpg: estWillJpg,
    webp: estWillWebp,
    alt: 'Protected smoked-glass family legacy dossier framed inside a brushed gold custody structure',
    motif: 'shield',
  },
  est_trust: {
    jpg: estTrustJpg,
    webp: estTrustWebp,
    alt: 'Concentric brushed metallic gold fiduciary trust rings protecting a faceted glass wealth core',
    motif: 'shield',
  },
  est_poa: {
    jpg: estPoaJpg,
    webp: estPoaWebp,
    alt: 'Twin aligned translucent glass continuity panels linked by a brushed gold fiduciary authorization seal',
    motif: 'compare',
  },
  est_asset: {
    jpg: estAssetJpg,
    webp: estAssetWebp,
    alt: 'Architectural smoked-glass protective dome reinforced by interlocking metallic gold structural arches',
    motif: 'shield',
  },

  // Credit & Financial Solutions (3)
  crd_identity: {
    jpg: crdIdentityJpg,
    webp: crdIdentityWebp,
    alt: 'Geometric enterprise digital identity vault encircled by concentric gold rings and security monitoring lattice',
    motif: 'shield',
  },
  crd_restoration: {
    jpg: crdRestorationJpg,
    webp: crdRestorationWebp,
    alt: 'Three synchronized credit report analysis layers converging into an ascending metallic gold trajectory curve',
    motif: 'trajectory',
  },
  crd_business: {
    jpg: crdBusinessJpg,
    webp: crdBusinessWebp,
    alt: 'Stepped executive commercial credit architecture blocks linked by luminous metallic gold lending pathways',
    motif: 'pathway',
  },
};
