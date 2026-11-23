import React from 'react';
import { useApp, PageRoute } from '../../context/AppContext';
import { COMPANY_BRANDING, COMPANY_CONTACT, COMPANY_MAILTO_HREF } from '../../config/companyBranding';
import { BrandLogo } from './BrandLogo';
import { 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Lock, 
  FileText, 
  HelpCircle, 
  ExternalLink,
  ArrowRight
} from 'lucide-react';

export const Footer: React.FC = () => {
  const { setCurrentPage, setCookieModalOpen } = useApp();

  const handleNav = (page: PageRoute) => {
    setCurrentPage(page);
  };

  return (
    <footer className="relative bg-[#04101F] text-[#CBD6E4] border-t border-[#132F52] pt-16 pb-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/45 to-transparent"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[#132F52]">
          
          {/* Column 1: Brand & Firm Identity */}
          <div className="lg:col-span-2 space-y-4">
            <BrandLogo size="md" />
            <p className="text-[#A8B8CC] text-sm leading-relaxed max-w-md pt-2">
              Intelligent Tax Preparation, Advisory &amp; Wealth Planning. Combining elite human CPA expertise 
              with advanced AI financial intelligence for individuals, entrepreneurs, and forward-thinking enterprises.
            </p>

            <div className="space-y-2.5 pt-2 text-sm text-[#CBD6E4]">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                <span>Columbia, South Carolina, USA</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                <a href={COMPANY_CONTACT.phoneHref} className="hover:text-[#D4AF37] transition-colors font-medium whitespace-nowrap">
                  {COMPANY_CONTACT.phoneDisplay}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                <a href={COMPANY_MAILTO_HREF} className="hover:text-[#D4AF37] transition-colors">
                  {COMPANY_BRANDING.email}
                </a>
              </div>
            </div>

            <div className="pt-3 flex items-center gap-2 text-xs text-[#E4C567]">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>Encrypted in Transit &amp; Rest • Access-Controlled Client Vault</span>
            </div>
          </div>

          {/* Column 2: Core Services */}
          <div>
            <h4 className="text-xs font-bold tracking-[0.16em] text-[#D4AF37] uppercase mb-4">
              Services
            </h4>
            <ul className="space-y-2.5 text-xs text-[#A8B8CC]">
              <li>
                <button onClick={() => handleNav('services')} className="hover:text-white transition-colors text-left">
                  Individual Tax Preparation (1040)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('services')} className="hover:text-white transition-colors text-left">
                  Prior-Year & Amended Returns (1040X)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('services')} className="hover:text-white transition-colors text-left">
                  LLC, S-Corp & Partnership Returns
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('services')} className="hover:text-white transition-colors text-left">
                  Monthly & Quarterly Bookkeeping
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('services')} className="hover:text-white transition-colors text-left">
                  Estate Planning Coordination
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('services')} className="hover:text-white transition-colors text-left">
                  Credit Restoration & Consulting
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('services')} className="hover:text-white transition-colors text-left">
                  IRS Transcript Review & Analysis
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Corporate & Portals */}
          <div>
            <h4 className="text-xs font-bold tracking-[0.16em] text-[#D4AF37] uppercase mb-4">
              Navigation & Portals
            </h4>
            <ul className="space-y-2.5 text-xs text-[#A8B8CC]">
              <li>
                <button onClick={() => handleNav('about')} className="hover:text-white transition-colors text-left">
                  About {COMPANY_BRANDING.displayName}
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('founder')} className="hover:text-white transition-colors text-left">
                  Meet Desmond Hinds, Founder
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('industries')} className="hover:text-white transition-colors text-[#E4C567] text-left">
                  Specialized Industries (8 Sectors)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('tax_strategies')} className="hover:text-white transition-colors text-[#E4C567] text-left">
                  Tax Strategies Catalog (16 Domains)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('pricing')} className="hover:text-white transition-colors text-left">
                  Pricing & Service Plans
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('book_consultation')} className="hover:text-white transition-colors text-left">
                  Book a Consultation
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('careers')} className="hover:text-white transition-colors text-left">
                  Careers & Recruitment
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('resources')} className="hover:text-white transition-colors text-left">
                  Tax Resources & FAQ
                </button>
              </li>
              <li>
                <a 
                  href="/portal"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav('portal');
                  }} 
                  className="hover:text-white transition-colors flex items-center gap-1 font-semibold text-[#D4AF37]"
                >
                  Client Portal <ArrowRight className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a 
                  href="/staff"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav('staff');
                  }} 
                  className="hover:text-[#D4AF37] transition-colors flex items-center gap-1 text-[#CBD6E4]"
                >
                  Staff Portal
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Compliance & Legal */}
          <div>
            <h4 className="text-xs font-bold tracking-[0.16em] text-[#D4AF37] uppercase mb-4">
              Legal & Trust
            </h4>
            <ul className="space-y-2.5 text-xs text-[#A8B8CC]">
              <li>
                <button onClick={() => handleNav('privacy')} className="hover:text-white transition-colors text-left">
                  Privacy Policy (GLBA Notice)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('terms')} className="hover:text-white transition-colors text-left">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('security')} className="hover:text-white transition-colors text-left">
                  Security & Data Handling
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('disclaimers')} className="hover:text-white transition-colors text-left">
                  Professional Disclaimers
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('accessibility')} className="hover:text-white transition-colors text-left">
                  Accessibility Statement
                </button>
              </li>
              <li>
                <button onClick={() => setCookieModalOpen(true)} className="hover:text-[#D4AF37] transition-colors text-left">
                  Cookie Preferences
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Professional Disclaimers & Statutory Regulatory Architecture */}
        <div className="py-6 text-xs text-[#CBD6E4] leading-relaxed border-b border-[#132F52] space-y-2.5">
          <p>
            <strong className="text-[#E4C567]">IRS Non-Affiliation:</strong> {COMPANY_BRANDING.legalName} is not affiliated with, endorsed by, or sponsored by the Internal Revenue Service.
          </p>
          <p>
            <strong className="text-[#E4C567]">Professional Credentials:</strong> Tax preparation and advisory services are provided by authorized professionals holding active IRS Preparer Tax Identification Numbers (PTIN). Formal CPA attestations and representation services are coordinated in strict compliance with Circular 230 and applicable state board standards.
          </p>
          <p>
            <strong className="text-[#E4C567]">No Guarantee:</strong> Tax outcomes depend on individual taxpayer facts, applicable law, substantiating documentation, and governmental interpretation. No particular tax result, refund, savings amount, audit outcome, or governmental determination is guaranteed.
          </p>
          <p>
            <strong className="text-[#E4C567]">Financial Privacy (GLBA Notice):</strong> {COMPANY_BRANDING.legalName} protects nonpublic personal financial information in accordance with the Gramm-Leach-Bliley Act (GLBA) and Internal Revenue Code Section 7216. Review our{' '}
            <button onClick={() => handleNav('privacy')} className="text-[#E4C567] underline hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]">
              Privacy Policy
            </button>{' '}
            and{' '}
            <button onClick={() => handleNav('terms')} className="text-[#E4C567] underline hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]">
              Terms of Service
            </button>.
          </p>
          <p>
            <strong className="text-[#E4C567]">Professional Engagement:</strong> Information provided on this public website is for educational and informational purposes only and does not constitute individualized legal, tax, or financial advisory. A professional engagement is established solely through a mutually executed, formal written engagement agreement.
          </p>
        </div>

        {/* Bottom copyright & attribution */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A8B8CC]">
          <div>
            © {new Date().getFullYear()} {COMPANY_BRANDING.legalName}. All rights reserved.
          </div>
          <div className="flex items-center gap-3 text-[#A8B8CC]">
            <button onClick={() => handleNav('privacy')} className="hover:text-[#D4AF37] transition-colors focus:outline-none focus-visible:underline">Privacy Policy</button>
            <span aria-hidden="true">•</span>
            <button onClick={() => handleNav('terms')} className="hover:text-[#D4AF37] transition-colors focus:outline-none focus-visible:underline">Terms of Service</button>
            <span aria-hidden="true">•</span>
            <button onClick={() => handleNav('disclaimers')} className="hover:text-[#D4AF37] transition-colors focus:outline-none focus-visible:underline">Disclaimers</button>
            <span aria-hidden="true">•</span>
            <span>Columbia, SC</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
