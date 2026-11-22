import { StrategyCategory } from '../../../types';

import heroTaxStrategyJpg from '../../../assets/images/hero_tax_strategy_1795328203434.jpg';
import heroTaxStrategyWebp from '../../../assets/images/hero_tax_strategy_1795328203434.webp';

import stratIndividualsJpg from '../../../assets/images/strat_individuals_1795328202738.jpg';
import stratIndividualsWebp from '../../../assets/images/strat_individuals_1795328202738.webp';

import stratFamiliesJpg from '../../../assets/images/strat_families_1795328202574.jpg';
import stratFamiliesWebp from '../../../assets/images/strat_families_1795328202574.webp';

import stratSelfEmployedJpg from '../../../assets/images/strat_self_employed_1795328202605.jpg';
import stratSelfEmployedWebp from '../../../assets/images/strat_self_employed_1795328202605.webp';

import stratSmallBusinessJpg from '../../../assets/images/strat_small_business_1795328203183.jpg';
import stratSmallBusinessWebp from '../../../assets/images/strat_small_business_1795328203183.webp';

import stratSCorpJpg from '../../../assets/images/strat_s_corp_1795328202140.jpg';
import stratSCorpWebp from '../../../assets/images/strat_s_corp_1795328202140.webp';

import stratCCorpJpg from '../../../assets/images/strat_c_corp_1795328203083.jpg';
import stratCCorpWebp from '../../../assets/images/strat_c_corp_1795328203083.webp';

import stratPartnershipsJpg from '../../../assets/images/strat_partnerships_1795328203355.jpg';
import stratPartnershipsWebp from '../../../assets/images/strat_partnerships_1795328203355.webp';

import stratRealEstateJpg from '../../../assets/images/strat_real_estate_1795328203853.jpg';
import stratRealEstateWebp from '../../../assets/images/strat_real_estate_1795328203853.webp';

import stratRetirementJpg from '../../../assets/images/strat_retirement_1795328203079.jpg';
import stratRetirementWebp from '../../../assets/images/strat_retirement_1795328203079.webp';

import stratEstatesTrustsJpg from '../../../assets/images/strat_estates_trusts_1795328202542.jpg';
import stratEstatesTrustsWebp from '../../../assets/images/strat_estates_trusts_1795328202542.webp';

import stratCharitableJpg from '../../../assets/images/strat_charitable_1795328201723.jpg';
import stratCharitableWebp from '../../../assets/images/strat_charitable_1795328201723.webp';

import stratPayrollBenefitsJpg from '../../../assets/images/strat_payroll_benefits_1795328202543.jpg';
import stratPayrollBenefitsWebp from '../../../assets/images/strat_payroll_benefits_1795328202543.webp';

import stratCreditsIncentivesJpg from '../../../assets/images/strat_credits_incentives_1795328203356.jpg';
import stratCreditsIncentivesWebp from '../../../assets/images/strat_credits_incentives_1795328203356.webp';

import stratStateLocalJpg from '../../../assets/images/strat_state_local_1795328202866.jpg';
import stratStateLocalWebp from '../../../assets/images/strat_state_local_1795328202866.webp';

import stratInternationalJpg from '../../../assets/images/strat_international_1795328202610.jpg';
import stratInternationalWebp from '../../../assets/images/strat_international_1795328202610.webp';

import stratYearEndJpg from '../../../assets/images/strat_year_end_1795328202868.jpg';
import stratYearEndWebp from '../../../assets/images/strat_year_end_1795328202868.webp';

export interface StrategyVisualAsset {
  jpg: string;
  webp: string;
  alt: string;
  pathwayVariant: 'ascending' | 'dual' | 'orbital' | 'grid';
}

export const HERO_TAX_STRATEGY_ASSET = {
  jpg: heroTaxStrategyJpg,
  webp: heroTaxStrategyWebp,
  alt: 'Conceptual enterprise financial technology visualization showing layered digital tax intelligence dashboards, structured document slabs, and gold verification pathways',
};

export const STRATEGY_CATEGORY_VISUALS: Record<StrategyCategory, StrategyVisualAsset> = {
  individuals: {
    jpg: stratIndividualsJpg,
    webp: stratIndividualsWebp,
    alt: 'Digital personal financial planning interface with structured glass allocation bars and secure record layers',
    pathwayVariant: 'ascending',
  },
  families: {
    jpg: stratFamiliesJpg,
    webp: stratFamiliesWebp,
    alt: 'Connected household financial intelligence panels linked by warm gold and sapphire pathways',
    pathwayVariant: 'dual',
  },
  self_employed: {
    jpg: stratSelfEmployedJpg,
    webp: stratSelfEmployedWebp,
    alt: 'Intelligent independent business expense tracking dashboard and modular financial ledger cards',
    pathwayVariant: 'grid',
  },
  small_businesses: {
    jpg: stratSmallBusinessJpg,
    webp: stratSmallBusinessWebp,
    alt: 'Enterprise capital asset optimization tiers connected by glowing metallic gold growth curves',
    pathwayVariant: 'ascending',
  },
  s_corporations: {
    jpg: stratSCorpJpg,
    webp: stratSCorpWebp,
    alt: 'Balanced dual-channel compensation analytics prism splitting into transparent distribution pathways',
    pathwayVariant: 'dual',
  },
  c_corporations: {
    jpg: stratCCorpJpg,
    webp: stratCCorpWebp,
    alt: 'Corporate equity glass monoliths connected to institutional investment network nodes',
    pathwayVariant: 'grid',
  },
  partnerships: {
    jpg: stratPartnershipsJpg,
    webp: stratPartnershipsWebp,
    alt: 'Interconnected partnership ownership structure rings and multi-node capital allocation prisms',
    pathwayVariant: 'orbital',
  },
  real_estate: {
    jpg: stratRealEstateJpg,
    webp: stratRealEstateWebp,
    alt: 'Contemporary architectural glass smart-building skyline with subtle gold depreciation tiers and property analytics grids',
    pathwayVariant: 'grid',
  },
  retirement: {
    jpg: stratRetirementJpg,
    webp: stratRetirementWebp,
    alt: 'Ascending multi-decade wealth accumulation horizon and brushed metallic gold compounding curve',
    pathwayVariant: 'ascending',
  },
  estates_trusts: {
    jpg: stratEstatesTrustsJpg,
    webp: stratEstatesTrustsWebp,
    alt: 'Protected digital asset succession vault framed by concentric gold fiduciary rings and generational pathways',
    pathwayVariant: 'orbital',
  },
  charitable_planning: {
    jpg: stratCharitableJpg,
    webp: stratCharitableWebp,
    alt: 'Central metallic gold philanthropic reservoir radiating transparent glass impact rings and contribution pathways',
    pathwayVariant: 'orbital',
  },
  payroll_benefits: {
    jpg: stratPayrollBenefitsJpg,
    webp: stratPayrollBenefitsWebp,
    alt: 'Structured horizontal payroll distribution network with metallic gold compensation conduits and benefit modules',
    pathwayVariant: 'dual',
  },
  credits_incentives: {
    jpg: stratCreditsIncentivesJpg,
    webp: stratCreditsIncentivesWebp,
    alt: 'Optical eligibility matrix crystal prism refracting analytical beams into gold opportunity verification nodes',
    pathwayVariant: 'grid',
  },
  state_local_tax: {
    jpg: stratStateLocalJpg,
    webp: stratStateLocalWebp,
    alt: 'Dark glass United States jurisdictional relief plane with sapphire geographic grids and metallic gold regional tax nodes',
    pathwayVariant: 'dual',
  },
  international: {
    jpg: stratInternationalJpg,
    webp: stratInternationalWebp,
    alt: 'Translucent smoked-glass terrestrial globe encircled by brushed gold cross-border financial arcs and regulatory nodes',
    pathwayVariant: 'orbital',
  },
  year_end_planning: {
    jpg: stratYearEndJpg,
    webp: stratYearEndWebp,
    alt: 'Precision architectural chronometer rings aligned with quarterly financial forecasting planes and year-end pathways',
    pathwayVariant: 'ascending',
  },
};
