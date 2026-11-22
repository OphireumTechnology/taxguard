import heroOfficeWebp from '../../../assets/images/about_hero_fintech_office_1795332026236.webp';
import heroOfficeJpg from '../../../assets/images/about_hero_fintech_office_1795332026236.jpg';

import missionAdvisoryWebp from '../../../assets/images/about_mission_advisory_1795332026736.webp';
import missionAdvisoryJpg from '../../../assets/images/about_mission_advisory_1795332026736.jpg';

import visionEnterpriseWebp from '../../../assets/images/about_vision_enterprise_1795332025936.webp';
import visionEnterpriseJpg from '../../../assets/images/about_vision_enterprise_1795332025936.jpg';

import valAccuracyWebp from '../../../assets/images/about_val_accuracy_1795332025532.webp';
import valAccuracyJpg from '../../../assets/images/about_val_accuracy_1795332025532.jpg';

import valIntegrityWebp from '../../../assets/images/about_val_integrity_1795332026076.webp';
import valIntegrityJpg from '../../../assets/images/about_val_integrity_1795332026076.jpg';

import valTransparencyWebp from '../../../assets/images/about_val_transparency_1795332026232.webp';
import valTransparencyJpg from '../../../assets/images/about_val_transparency_1795332026232.jpg';

import valClientFirstWebp from '../../../assets/images/about_val_client_first_1795332025435.webp';
import valClientFirstJpg from '../../../assets/images/about_val_client_first_1795332025435.jpg';

import valEducationWebp from '../../../assets/images/about_val_education_1795332025703.webp';
import valEducationJpg from '../../../assets/images/about_val_education_1795332025703.jpg';

import valRelationshipsWebp from '../../../assets/images/strat_families_1795328202574.webp';
import valRelationshipsJpg from '../../../assets/images/strat_families_1795328202574.jpg';

import valCommunityWebp from '../../../assets/images/about_val_community_1795332025870.webp';
import valCommunityJpg from '../../../assets/images/about_val_community_1795332025870.jpg';

import partnershipsNetworkWebp from '../../../assets/images/strat_partnerships_1795328203355.webp';
import partnershipsNetworkJpg from '../../../assets/images/strat_partnerships_1795328203355.jpg';

export interface AboutVisualAsset {
  webp: string;
  jpg: string;
  alt: string;
}

export type CoreValueAssetId =
  | 'accuracy'
  | 'integrity'
  | 'transparency'
  | 'client_first'
  | 'education'
  | 'relationships'
  | 'community';

export const ABOUT_HERO_VISUAL: AboutVisualAsset = {
  webp: heroOfficeWebp,
  jpg: heroOfficeJpg,
  alt: 'DESTRIA TAX SERVICES, LLC modern executive financial advisory headquarters with glass architecture and structured analytical layers',
};

export const ABOUT_MISSION_VISUAL: AboutVisualAsset = {
  webp: missionAdvisoryWebp,
  jpg: missionAdvisoryJpg,
  alt: 'Executive tax advisor reviewing structured client financial dossiers alongside intelligent verification overlays',
};

export const ABOUT_VISION_VISUAL: AboutVisualAsset = {
  webp: visionEnterpriseWebp,
  jpg: visionEnterpriseJpg,
  alt: 'Forward-looking corporate financial intelligence center with interconnected gold knowledge pathways overlooking a twilight skyline',
};

export const ABOUT_PARTNERSHIPS_VISUAL: AboutVisualAsset = {
  webp: partnershipsNetworkWebp,
  jpg: partnershipsNetworkJpg,
  alt: 'Collaborative enterprise advisory network connecting tax specialists, legal counsel, and financial partners',
};

export const CORE_VALUE_ASSETS: Record<CoreValueAssetId, AboutVisualAsset> = {
  accuracy: {
    webp: valAccuracyWebp,
    jpg: valAccuracyJpg,
    alt: 'Calibrated sapphire glass financial analytics and metallic gold precision verification axes representing accounting accuracy',
  },
  integrity: {
    webp: valIntegrityWebp,
    jpg: valIntegrityJpg,
    alt: 'Protected institutional financial environment with brushed navy and champagne gold security vault architecture representing integrity',
  },
  transparency: {
    webp: valTransparencyWebp,
    jpg: valTransparencyJpg,
    alt: 'Interconnected translucent architectural glass ledger blocks linked by fine champagne gold verification pathways representing transparency',
  },
  client_first: {
    webp: valClientFirstWebp,
    jpg: valClientFirstJpg,
    alt: 'Senior American financial advisor consulting attentively with clients around a modern glass conference table representing client-first service',
  },
  education: {
    webp: valEducationWebp,
    jpg: valEducationJpg,
    alt: 'Financial specialist guiding structured tax strategy diagrams on a translucent glass briefing display representing client education',
  },
  relationships: {
    webp: valRelationshipsWebp,
    jpg: valRelationshipsJpg,
    alt: 'Enduring multi-generational financial continuity architecture representing long-term advisory relationships',
  },
  community: {
    webp: valCommunityWebp,
    jpg: valCommunityJpg,
    alt: 'Twilight aerial view of a thriving Southern metropolitan business district and neighborhoods connected by subtle golden civic arcs representing community impact',
  },
};
