import React from 'react';
import { ShieldCheck, Lock, UserCheck, CalendarCheck, Sparkles, MapPin, Phone, Mail } from 'lucide-react';
import { ConsultationRequestForm } from './ConsultationRequestForm';
import { FounderPortrait } from './images';
import { COMPANY_BRANDING, COMPANY_CONTACT, COMPANY_MAILTO_HREF } from '../../config/companyBranding';

/**
 * Public consultation page. Visitors submit a durable consultation REQUEST (proposal 043): no
 * account is created and no staff calendar is reserved; the practice reviews the request and books
 * a real appointment. The former in-memory live calendar and express booking were removed in Phase 9.
 */
export const BookConsultationPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#06182B] text-[#F8FAFC] pb-24 font-sans selection:bg-[#D4A843]/20 selection:text-[#F8FAFC]">
      {/* A. HERO SECTION WITH CINEMATIC PHOTOGRAPHIC BACKGROUND & READABILITY OVERLAYS */}
      <section 
        className="relative overflow-hidden"
        style={{
          backgroundImage: `url('/images/consultation/consultation-hero.webp')`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Readability Overlays: Deep navy gradient protecting text contrast on desktop, high opacity on mobile */}
        <div 
          className="absolute inset-0 bg-[#06182B]/92 sm:bg-transparent"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(6,24,43,0.96) 0%, rgba(6,24,43,0.88) 40%, rgba(6,24,43,0.66) 72%, rgba(6,24,43,0.76) 100%)`,
          }}
        />
        {/* Vignette merging top with navigation header and bottom with trust strip */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#071A2E]/80 via-transparent to-[#071A2E] pointer-events-none" />

        <div className="relative max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 lg:py-20 min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] flex flex-col justify-center">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(212,168,67,0.12)] border border-[rgba(212,168,67,0.30)] text-[#D4A843] text-[11px] sm:text-xs font-semibold tracking-[0.18em] uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PRIVATE TAX &amp; ADVISORY SERVICES</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F8FAFC] tracking-tight leading-tight">
              Request a Consultation
            </h1>

            {/* Restrained gold divider */}
            <div className="w-16 h-1 bg-[#D4A843] rounded-full my-3" />

            <p className="text-sm sm:text-base text-[#A9B7C8] max-w-xl leading-relaxed">
              Request a consultation with our tax team. Tell us when you are generally available; we review every request and contact you to confirm a time.
            </p>
          </div>
        </div>
      </section>

      {/* TRUST STRIP (Between hero and booking workspace) */}
      <section className="border-b border-[rgba(148,163,184,0.12)] bg-[#071A2E] py-4">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2.5 text-[#A9B7C8]">
              <ShieldCheck className="w-4 h-4 text-[#D4A843] shrink-0" />
              <span className="font-medium text-[#F8FAFC]">Expert Guidance</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#A9B7C8]">
              <Lock className="w-4 h-4 text-[#D4A843] shrink-0" />
              <span className="font-medium text-[#F8FAFC]">Secure Process</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#A9B7C8]">
              <UserCheck className="w-4 h-4 text-[#D4A843] shrink-0" />
              <span className="font-medium text-[#F8FAFC]">Personalized Service</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#A9B7C8]">
              <CalendarCheck className="w-4 h-4 text-[#D4A843] shrink-0" />
              <span className="font-medium text-[#F8FAFC]">Clear Next Steps</span>
            </div>
          </div>
        </div>
      </section>

      {/* CONSULTATION WORKSPACE & EXECUTIVE LEADERSHIP OVERSIGHT */}
      <section className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 xl:col-span-8">
            <ConsultationRequestForm />
          </div>

          <aside className="lg:col-span-5 xl:col-span-4 space-y-5">
            <div className="rounded-3xl bg-[#0A213C] border border-[#D4A843]/35 p-5 sm:p-6 shadow-xl space-y-5">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E5B552]">
                  Executive Practice Leadership
                </p>
                <h2 className="font-serif text-xl font-bold text-white">
                  Desmond Hinds
                </h2>
                <p className="text-xs font-medium text-[#E5B552]">
                  Founder &amp; Chief Executive Officer
                </p>
              </div>

              <FounderPortrait
                size="full"
                priority={false}
                showBadge={false}
                className="mx-auto max-w-[360px] lg:max-w-none"
              />

              <p className="text-xs text-slate-300 leading-relaxed">
                Every consultation request is reviewed by our advisory practice in Columbia, South Carolina so we can match your tax preparation, accounting, or wealth planning goals with the right specialist.
              </p>

              <div className="pt-4 border-t border-slate-700/80 space-y-2 text-xs text-slate-300">
                <div className="font-semibold text-white">{COMPANY_BRANDING.displayName}</div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#D4A843] shrink-0" />
                  <span>{COMPANY_CONTACT.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#D4A843] shrink-0" />
                  <a href={COMPANY_CONTACT.phoneHref} className="hover:text-[#E5B552] transition-colors">
                    {COMPANY_CONTACT.phoneDisplay}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#D4A843] shrink-0" />
                  <a href={COMPANY_MAILTO_HREF} className="hover:text-[#E5B552] transition-colors">
                    {COMPANY_CONTACT.email}
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};
