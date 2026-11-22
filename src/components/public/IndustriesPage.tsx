import React, { useRef, useState } from 'react';
import {
  Briefcase,
  Building2,
  HardHat,
  HeartHandshake,
  Laptop,
  Scale,
  Stethoscope,
  Truck,
  Utensils,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { INDUSTRIES_DATA } from '../../data/industriesData';
import type { IndustrySolutionRecord } from '../../types';
import { useInViewMotion } from './home/useInViewMotion';
import { IndustriesHeroSection } from './industries/IndustriesHeroSection';
import { IndustrySelectionCard } from './industries/IndustrySelectionCard';
import { IndustryDetailPanel } from './industries/IndustryDetailPanel';
import { IndustriesClosingCta } from './industries/IndustriesClosingCta';

const INDUSTRY_ICONS: Record<string, React.ElementType> = {
  'construction-contractors': HardHat,
  'real-estate-investors': Building2,
  'healthcare-medical-practices': Stethoscope,
  'legal-professional-services': Scale,
  'transportation-trucking-logistics': Truck,
  'technology-saas-ecommerce': Laptop,
  'restaurants-hospitality': Utensils,
  'nonprofits-foundations': HeartHandshake,
};

export const IndustriesPage: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [selectedIndustry, setSelectedIndustry] = useState<IndustrySolutionRecord>(
    INDUSTRIES_DATA[0]
  );

  const heroRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  const { shouldAnimate: heroAnimate } = useInViewMotion(heroRef);
  const { shouldAnimate: gridAnimate } = useInViewMotion(gridRef);
  const { shouldAnimate: detailAnimate } = useInViewMotion(detailRef);
  const { shouldAnimate: ctaAnimate } = useInViewMotion(ctaRef);

  const handleJumpToSectors = () => {
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectIndustry = (industry: IndustrySolutionRecord) => {
    setSelectedIndustry(industry);
  };

  const SelectedIcon = INDUSTRY_ICONS[selectedIndustry.slug] || Briefcase;

  return (
    <div className="min-h-screen bg-[#06182B] text-slate-100 pb-24 space-y-14 sm:space-y-16 lg:space-y-20 overflow-x-clip">
      {/* Immersive Enterprise Industries Hero */}
      <div ref={heroRef}>
        <IndustriesHeroSection
          onBookConsultation={() => setCurrentPage('book_consultation')}
          onJumpToSectors={handleJumpToSectors}
          shouldAnimate={heroAnimate}
        />
      </div>

      {/* Eight Commercial Sector Selection Grid */}
      <section
        ref={gridRef}
        aria-labelledby="sector-selection-heading"
        className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8 space-y-7 scroll-mt-24"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-bold tracking-[0.18em] uppercase text-[#E1BB60]">
              Interactive Sector Directory
            </div>
            <h2
              id="sector-selection-heading"
              className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight"
            >
              Select Your Commercial Industry
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed">
            Choose any of our eight practice verticals below to inspect sector-specific financial
            architecture, compliance filings, and advisory governance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {INDUSTRIES_DATA.map((industry) => {
            const Icon = INDUSTRY_ICONS[industry.slug] || Briefcase;
            return (
              <IndustrySelectionCard
                key={industry.id}
                industry={industry}
                icon={Icon}
                isSelected={selectedIndustry.id === industry.id}
                onSelect={() => handleSelectIndustry(industry)}
                shouldAnimate={gridAnimate}
              />
            );
          })}
        </div>
      </section>

      {/* Selected Industry Comprehensive Detail Panel */}
      <div ref={detailRef}>
        <IndustryDetailPanel
          industry={selectedIndustry}
          icon={SelectedIcon}
          onBookConsultation={() => setCurrentPage('book_consultation')}
          onViewPricing={() => setCurrentPage('pricing')}
          onViewStrategies={() => setCurrentPage('tax_strategies')}
          shouldAnimate={detailAnimate}
        />
      </div>

      {/* Closing Executive Consultation Banner */}
      <div ref={ctaRef}>
        <IndustriesClosingCta
          onBookConsultation={() => setCurrentPage('book_consultation')}
          onExploreStrategies={() => setCurrentPage('tax_strategies')}
          shouldAnimate={ctaAnimate}
        />
      </div>
    </div>
  );
};
