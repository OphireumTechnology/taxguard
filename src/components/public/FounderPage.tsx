import React from 'react';
import { useApp } from '../../context/AppContext';
import { FounderPortrait } from './images/FounderPortrait';
import { 
  Calendar, 
  Phone, 
  Mail, 
  CheckCircle, 
  ShieldCheck, 
  Clock,
  Compass,
  MapPin
} from 'lucide-react';

export const FounderPage: React.FC = () => {
  const { setCurrentPage } = useApp();

  return (
    <div className="space-y-16 pb-20 text-[#F8F6F1]">
      
      {/* Header Banner */}
      <section className="relative pt-12 pb-14 border-b border-[#0B2748]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B2748] border border-[#C99A3D]/40 text-[#E2BD67] text-xs font-bold tracking-widest uppercase">
            <span>LEADERSHIP SPOTLIGHT</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Meet Desmond Hinds
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Founder &amp; Chief Executive Officer &bull; A/R Tax Services, LLC &bull; Columbia, South Carolina, USA
          </p>
        </div>
      </section>

      {/* Main Profile Layout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          
          {/* Left Column: Executive Portrait & Direct Contact */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Approved Founder Portrait with object-fit: contain */}
            <FounderPortrait
              size="lg"
              priority={true}
              caption="Desmond Hinds • Founder & Chief Executive Officer"
            />

            {/* Quick Direct Contact & Executive Credentials Card */}
            <div className="rounded-3xl bg-[#0B2748]/70 border border-[#C99A3D]/30 p-6 sm:p-8 shadow-xl space-y-6">
              
              {/* Founder Header Block */}
              <div className="text-center pb-4 border-b border-[#0B2748]">
                <h2 className="font-serif text-2xl font-bold text-white">Desmond Hinds</h2>
                <div className="text-xs font-semibold text-[#E2BD67] uppercase tracking-wider mt-1">
                  Founder &amp; Chief Executive Officer
                </div>
                <div className="text-xs text-slate-300 mt-1 flex items-center justify-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#C99A3D]" /> Columbia, South Carolina, USA
                </div>
              </div>

              {/* Direct Inquiries & Contact */}
              <div className="space-y-3 text-xs text-slate-200">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-[#C99A3D]" />
                  <a href="tel:678-205-9486" className="hover:text-white font-medium">
                    Direct Line: 678-205-9486
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#C99A3D]" />
                  <a href="mailto:info@artaxservices.com" className="hover:text-white">
                    info@artaxservices.com
                  </a>
                </div>
              </div>

              <button
                onClick={() => setCurrentPage('book_consultation')}
                className="w-full py-3.5 rounded-xl text-xs font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
              >
                <Calendar className="w-4 h-4" />
                Book One-on-One with Desmond
              </button>
            </div>
          </div>

          {/* Right Column: Leadership Philosophy & Official Bio */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Leadership Headline & Mission */}
            <div className="p-8 rounded-3xl bg-[#0B2748]/70 border border-[#C99A3D]/30 space-y-4">
              <div className="text-xs font-bold tracking-widest text-[#C99A3D] uppercase">
                LEADERSHIP PHILOSOPHY
              </div>
              
              <blockquote className="p-4 rounded-xl bg-[#06172C] border-l-4 border-[#C99A3D] text-[#F8F6F1] font-serif text-xl sm:text-2xl italic leading-snug">
                &ldquo;Your Growth, Our Priority.&rdquo;
              </blockquote>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Desmond established A/R Tax Services, LLC to bring high-touch, executive-tier tax strategy and financial governance to individuals, growing businesses, and families who want more than transactional return preparation.
              </p>
            </div>

            {/* Official Biography */}
            <div className="space-y-4">
              <h3 className="font-serif text-2xl font-bold text-white">
                About Desmond Hinds
              </h3>
              <div className="space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed">
                <p>
                  Desmond Hinds is the Founder and Chief Executive Officer of A/R Tax Services, LLC, a professional firm serving individuals, families, entrepreneurs, and businesses with reliable tax preparation, accounting, financial planning, and business consulting solutions.
                </p>
                <p>
                  Guided by integrity, accuracy, confidentiality, and a client-first approach, Desmond established the company to simplify complex financial responsibilities and help clients make informed decisions with confidence.
                </p>
                <p>
                  His leadership combines technical attention to detail with personalized service. Through A/R Tax Services, LLC, he is committed to protecting each client’s financial interests, identifying opportunities for growth, and building lasting professional relationships based on trust.
                </p>
              </div>
            </div>

            {/* Guiding Principles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-[#0B2748]/50 border border-[#0B2748] hover:border-[#C99A3D]/40 transition-colors space-y-2">
                <div className="text-xs font-bold text-[#E2BD67] flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#C99A3D]" /> Rigorous Accuracy
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every filing undergoes comprehensive multi-point reconciliation to ensure zero compliance exposures and audit readiness.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#0B2748]/50 border border-[#0B2748] hover:border-[#C99A3D]/40 transition-colors space-y-2">
                <div className="text-xs font-bold text-[#E2BD67] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#C99A3D]" /> Client-First Confidentiality
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Client records are safeguarded with strict financial privacy protocols and secure encrypted client vault storage.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#0B2748]/50 border border-[#0B2748] hover:border-[#C99A3D]/40 transition-colors space-y-2">
                <div className="text-xs font-bold text-[#E2BD67] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#C99A3D]" /> Year-Round Accessibility
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Active advisory extends 365 days a year—supporting quarterly planning, life milestones, and sudden business pivots.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#0B2748]/50 border border-[#0B2748] hover:border-[#C99A3D]/40 transition-colors space-y-2">
                <div className="text-xs font-bold text-[#E2BD67] flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#C99A3D]" /> Legacy Engineering
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Structuring capital and succession mechanisms that preserve generational wealth for your family and enterprises.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
};
