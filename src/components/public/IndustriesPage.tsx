import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { INDUSTRIES_DATA } from '../../data/industriesData';
import { IndustrySolutionRecord } from '../../types';
import { BRAND_ASSETS } from '../../utils/assets';
import { IndustryImage } from './images';
import { 
  Building2, 
  Briefcase, 
  HardHat, 
  Stethoscope, 
  Scale, 
  Truck, 
  Laptop, 
  Utensils, 
  HeartHandshake, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ShieldCheck, 
  ChevronRight, 
  Layers
} from 'lucide-react';
import { BrandedButton } from '../ui/BrandedButton';

const INDUSTRY_ICONS: Record<string, React.ElementType> = {
  'construction-contractors': HardHat,
  'real-estate-investors': Building2,
  'healthcare-medical-practices': Stethoscope,
  'legal-professional-services': Scale,
  'transportation-trucking-logistics': Truck,
  'technology-saas-ecommerce': Laptop,
  'restaurants-hospitality': Utensils,
  'nonprofits-foundations': HeartHandshake
};

const INDUSTRY_PHOTOS: Record<string, { jpg: string; webp: string; alt: string }> = {
  'construction-contractors': {
    jpg: BRAND_ASSETS.corporateTaxComplianceJpg,
    webp: BRAND_ASSETS.corporateTaxComplianceWebp,
    alt: 'Construction and contractor tax planning and equipment depreciation'
  },
  'real-estate-investors': {
    jpg: BRAND_ASSETS.columbiaSkylineJpg,
    webp: BRAND_ASSETS.columbiaSkylineWebp,
    alt: 'Real estate investment syndication and cost segregation advisory'
  },
  'healthcare-medical-practices': {
    jpg: BRAND_ASSETS.digitalDocumentReviewJpg,
    webp: BRAND_ASSETS.digitalDocumentReviewWebp,
    alt: 'Healthcare and medical practice financial compliance and payroll management'
  },
  'legal-professional-services': {
    jpg: BRAND_ASSETS.taxConsultationJpg,
    webp: BRAND_ASSETS.taxConsultationWebp,
    alt: 'Law firm and professional services partner capital and tax advisory'
  },
  'transportation-trucking-logistics': {
    jpg: BRAND_ASSETS.businessStrategyJpg,
    webp: BRAND_ASSETS.businessStrategyWebp,
    alt: 'Fleet, logistics, and multi-state trucking tax compliance'
  },
  'technology-saas-ecommerce': {
    jpg: BRAND_ASSETS.taxCreditResearchJpg,
    webp: BRAND_ASSETS.taxCreditResearchWebp,
    alt: 'SaaS, e-commerce, and R&D tax credit study and software development deductions'
  },
  'restaurants-hospitality': {
    jpg: BRAND_ASSETS.payrollAdminJpg,
    webp: BRAND_ASSETS.payrollAdminWebp,
    alt: 'Restaurant tip credit, food inventory accounting, and multi-unit payroll'
  },
  'nonprofits-foundations': {
    jpg: BRAND_ASSETS.familyTaxPlanningJpg,
    webp: BRAND_ASSETS.familyTaxPlanningWebp,
    alt: 'Nonprofit Form 990 compliance, endowment reporting, and grant management'
  }
};

export const IndustriesPage: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [selectedIndustry, setSelectedIndustry] = useState<IndustrySolutionRecord>(INDUSTRIES_DATA[0]);

  return (
    <div className="min-h-screen bg-[#07172B] text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="space-y-4 border-b border-[#1E3A5F] pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>Specialized Commercial Practice Sectors</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Industry-Specific Tax & Accounting Solutions
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
            Every commercial sector operates under distinct regulatory pressures, statutory depreciation rules, and revenue recognition standards. A/R Tax Services provides bespoke advisory frameworks tailored to the unique economic realities of your trade.
          </p>
        </div>

        {/* Sector Navigation Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {INDUSTRIES_DATA.map((ind) => {
            const Icon = INDUSTRY_ICONS[ind.slug] || Briefcase;
            const isSelected = selectedIndustry.id === ind.id;
            return (
              <button
                key={ind.id}
                onClick={() => setSelectedIndustry(ind)}
                className={`p-4 rounded-xl text-left border transition flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#0D2340] border-[#C6A15B] shadow-lg ring-1 ring-[#C6A15B]/30'
                    : 'bg-[#0B1E36] border-[#1E3A5F] hover:border-slate-500 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#C6A15B] text-[#07172B]' : 'bg-[#07172B] text-[#C6A15B]'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[#C6A15B]" />
                  )}
                </div>
                <div>
                  <span className={`block text-xs sm:text-sm font-bold leading-snug ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {ind.name.split(',')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                    {ind.applicableForms.slice(0, 2).join(' • ')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Sector Comprehensive Dossier */}
        <div className="bg-[#0B1E36] border border-[#C6A15B]/40 rounded-2xl p-6 sm:p-10 space-y-8 shadow-xl">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#1E3A5F] pb-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C6A15B] bg-[#0D2340] px-3 py-1 rounded-full border border-[#C6A15B]/30">
                Strategic Sector Spotlight
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-extrabold text-white">
                {selectedIndustry.name}
              </h2>
              <p className="text-sm font-medium text-[#C6A15B] leading-snug max-w-2xl">
                {selectedIndustry.tagline}
              </p>
            </div>

            <div className="flex-shrink-0">
              <button
                onClick={() => setCurrentPage('book_consultation')}
                className="px-5 py-3 rounded-xl bg-[#C6A15B] text-[#07172B] font-bold text-xs sm:text-sm hover:bg-[#D4AF37] transition shadow flex items-center gap-2"
              >
                <span>Consult on {selectedIndustry.name.split(',')[0]}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sector Visual & Overview Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
                {selectedIndustry.description}
              </p>
              <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F]/60 text-xs text-slate-300">
                <span className="font-semibold text-[#C6A15B]">Core Regulatory Standard: </span>
                <span>Tailored adherence to South Carolina Department of Revenue statutory reporting and IRS Industry Specialization Program guidelines.</span>
              </div>
            </div>

            <div className="lg:col-span-5">
              {(() => {
                const photo = INDUSTRY_PHOTOS[selectedIndustry.slug] || {
                  jpg: BRAND_ASSETS.corporateTaxComplianceJpg,
                  webp: BRAND_ASSETS.corporateTaxComplianceWebp,
                  alt: selectedIndustry.name
                };
                return (
                  <IndustryImage
                    srcJpg={photo.jpg}
                    srcWebp={photo.webp}
                    alt={photo.alt}
                    industryName={selectedIndustry.name.split(',')[0]}
                    formsTag={selectedIndustry.applicableForms[0]}
                  />
                );
              })()}
            </div>
          </div>

          {/* Two-Column Grid: Challenges vs Solutions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Key Challenges */}
            <div className="p-6 rounded-2xl bg-[#07172B] border border-[#1E3A5F] space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Critical Industry Challenges We Solve</span>
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                {selectedIndustry.keyChallenges.map((ch, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">•</span>
                    <span>{ch}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Strategic Solutions */}
            <div className="p-6 rounded-2xl bg-[#07172B] border border-[#C6A15B]/30 space-y-4">
              <div className="flex items-center gap-2 text-[#C6A15B] font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#C6A15B]" />
                <span>Our Bespoke Practice Architecture</span>
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                {selectedIndustry.strategicSolutions.map((sol, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#C6A15B] font-bold mt-0.5">•</span>
                    <span>{sol}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Applicable Forms & Service Plan Alignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-[#0D2340] border border-[#1E3A5F] space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Primary Federal & State Return Filings
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedIndustry.applicableForms.map((form, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded bg-[#07172B] border border-[#1E3A5F] text-xs font-mono text-white">
                    {form}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0D2340] border border-[#1E3A5F] space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Recommended Service Alignment
              </span>
              <p className="text-xs sm:text-sm font-semibold text-[#C6A15B]">
                {selectedIndustry.recommendedServicePlan}
              </p>
              <button
                onClick={() => setCurrentPage('pricing')}
                className="text-xs text-slate-300 hover:text-white underline inline-flex items-center gap-1"
              >
                <span>View Plan Pricing & Retainers</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Case Study Example */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#07172B] to-[#0D2340] border border-[#C6A15B]/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#C6A15B] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Proven Client Impact Example</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
              "{selectedIndustry.clientCaseExample}"
            </p>
          </div>

        </div>

        {/* Global CTA */}
        <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] p-8 text-center space-y-4">
          <h3 className="font-serif text-2xl font-bold text-white">
            Operate in a Unique Commercial Sector?
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Our principal executive, Desmond Hinds, provides custom accounting consultations to design specialized chart-of-accounts hierarchies, tax elections, and compliance workflows tailored to your operational model.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setCurrentPage('book_consultation')}
              className="px-6 py-3 rounded-xl bg-[#C6A15B] text-[#07172B] font-bold text-xs sm:text-sm hover:bg-[#D4AF37] transition shadow"
            >
              Book Sector Discovery Consultation
            </button>
            <button
              onClick={() => setCurrentPage('tax_strategies')}
              className="px-6 py-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-slate-200 font-semibold text-xs sm:text-sm hover:bg-[#1E3A5F] transition"
            >
              Explore 16 Tax Strategy Domains
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
