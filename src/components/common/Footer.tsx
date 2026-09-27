import React from 'react';
import { useApp, PageRoute } from '../../context/AppContext';
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
    <footer className="bg-[#031323] text-slate-300 border-t border-[#1A365D] pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[#1A365D]">
          
          {/* Column 1: Brand & Firm Identity */}
          <div className="lg:col-span-2 space-y-4">
            <BrandLogo size="md" />
            <p className="text-slate-400 text-sm leading-relaxed max-w-md pt-2">
              Preserving Wealth. Building Legacies. Delivering boutique, client-first tax preparation, 
              strategic business tax advisory, and wealth coordination for individuals, entrepreneurs, and families.
            </p>

            <div className="space-y-2.5 pt-2 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-[#C99A32] flex-shrink-0" />
                <span>Columbia, South Carolina, USA</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#C99A32] flex-shrink-0" />
                <a href="tel:678-205-9486" className="hover:text-[#D7AC4A] transition-colors font-medium">
                  678-205-9486
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#C99A32] flex-shrink-0" />
                <a href="mailto:info@artaxservices.com" className="hover:text-[#D7AC4A] transition-colors">
                  info@artaxservices.com
                </a>
              </div>
            </div>

            <div className="pt-3 flex items-center gap-2 text-xs text-[#E8C66A]">
              <ShieldCheck className="w-4 h-4 text-[#C99A32]" />
              <span>Encrypted in Transit &amp; Rest • Access-Controlled Client Vault</span>
            </div>
          </div>

          {/* Column 2: Core Services */}
          <div>
            <h4 className="text-xs font-bold tracking-widest text-[#C99A3D] uppercase mb-4">
              Services
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
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
            <h4 className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase mb-4">
              Navigation & Portals
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <button onClick={() => handleNav('about')} className="hover:text-white transition-colors">
                  About A/R Tax Services
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('founder')} className="hover:text-white transition-colors">
                  Meet Desmond Hinds, Founder
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('industries')} className="hover:text-white transition-colors text-[#C6A15B]">
                  Specialized Industries (8 Sectors)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('tax_strategies')} className="hover:text-white transition-colors text-[#C6A15B]">
                  Tax Strategies Catalog (16 Domains)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('pricing')} className="hover:text-white transition-colors">
                  Pricing & Service Plans
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('book_consultation')} className="hover:text-white transition-colors">
                  Book a Consultation
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('careers')} className="hover:text-white transition-colors">
                  Careers & Recruitment
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('resources')} className="hover:text-white transition-colors">
                  Tax Resources & FAQ
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { window.location.hash = '#/client/login'; }} 
                  className="hover:text-white transition-colors flex items-center gap-1 text-slate-300 font-semibold text-[#C6A15B]"
                >
                  Client Portal <ArrowRight className="w-3 h-3" />
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { window.location.hash = '#/accountant/login'; }} 
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  Staff Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Compliance & Legal */}
          <div>
            <h4 className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase mb-4">
              Legal & Trust
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <button onClick={() => handleNav('privacy')} className="hover:text-white transition-colors">
                  Privacy Policy (GLBA Notice)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('terms')} className="hover:text-white transition-colors">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('security')} className="hover:text-white transition-colors">
                  Security & Data Handling
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('disclaimers')} className="hover:text-white transition-colors">
                  Professional Disclaimers
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('accessibility')} className="hover:text-white transition-colors">
                  Accessibility Statement
                </button>
              </li>
              <li>
                <button onClick={() => setCookieModalOpen(true)} className="hover:text-[#C6A15B] transition-colors text-left">
                  Cookie Preferences
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Professional Disclaimers & Statutory Regulatory Architecture */}
        <div className="py-6 text-xs text-slate-300 leading-relaxed border-b border-[#1A365D] space-y-2.5">
          <p>
            <strong className="text-[#E8C66A]">IRS Non-Affiliation:</strong> A/R Tax Services, LLC is not affiliated with, endorsed by, or sponsored by the Internal Revenue Service.
          </p>
          <p>
            <strong className="text-[#E8C66A]">Professional Credentials:</strong> Tax preparation services are provided by authorized professionals holding active IRS Preparer Tax Identification Numbers (PTIN). Formal CPA attestations and Enrolled Agent representation services are coordinated in compliance with applicable federal and state regulatory standards.
          </p>
          <p>
            <strong className="text-[#E8C66A]">No Guarantee:</strong> Tax outcomes depend on individual taxpayer facts, applicable law, substantiating documentation, and governmental interpretation. No particular tax result, refund, savings amount, audit outcome, or governmental determination is guaranteed.
          </p>
          <p>
            <strong className="text-[#E8C66A]">Financial Privacy (GLBA Notice):</strong> A/R Tax Services, LLC protects nonpublic personal financial information in accordance with the Gramm-Leach-Bliley Act (GLBA) and Internal Revenue Code Section 7216. Review our{' '}
            <button onClick={() => handleNav('privacy')} className="text-[#E8C66A] underline hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D]">
              Privacy Policy
            </button>{' '}
            and{' '}
            <button onClick={() => handleNav('terms')} className="text-[#E8C66A] underline hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D]">
              Terms of Service
            </button>.
          </p>
          <p>
            <strong className="text-[#E8C66A]">Professional Engagement:</strong> Information provided on this public website is for educational and informational purposes only and does not constitute individualized legal, tax, or financial advisory. A professional engagement is established solely through a mutually executed, formal written engagement agreement.
          </p>
        </div>

        {/* Bottom copyright & attribution */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © {new Date().getFullYear()} A/R Tax Services, LLC. All rights reserved.
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <button onClick={() => handleNav('privacy')} className="hover:text-[#E8C66A] transition-colors focus:outline-none focus-visible:underline">Privacy Policy</button>
            <span>•</span>
            <button onClick={() => handleNav('terms')} className="hover:text-[#E8C66A] transition-colors focus:outline-none focus-visible:underline">Terms of Service</button>
            <span>•</span>
            <button onClick={() => handleNav('disclaimers')} className="hover:text-[#E8C66A] transition-colors focus:outline-none focus-visible:underline">Disclaimers</button>
            <span>•</span>
            <span>Columbia, SC</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
