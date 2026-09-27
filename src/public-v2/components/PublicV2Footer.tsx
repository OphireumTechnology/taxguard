import React from 'react';
import { PublicV2Logo } from './PublicV2Logo';
import { Mail, Phone, MapPin, ArrowUpRight } from 'lucide-react';

interface PublicV2FooterProps {
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2Footer: React.FC<PublicV2FooterProps> = ({
  onNavigate,
  onOpenConsultation
}) => {
  return (
    <footer className="w-full bg-white border-t border-black text-black">
      {/* Top Banner Notice */}
      <div className="border-b border-neutral-200 py-3 bg-neutral-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-600">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-black"></span>
            <span className="font-mono uppercase tracking-wider text-[11px] font-semibold text-black">Public Page 2 Preview Environment</span>
            <span>— Alternative Minimalist Presentation</span>
          </div>
          <button
            onClick={() => onNavigate('/')}
            className="text-black hover:underline font-medium text-xs inline-flex items-center gap-1"
          >
            <span>Return to Primary Website</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Col 1: Identity & Statement */}
          <div className="md:col-span-1 space-y-4">
            <PublicV2Logo size="md" onClick={() => onNavigate('/public-v2')} />
            <p className="text-xs text-neutral-600 leading-relaxed">
              U.S.-focused accounting, tax preparation, bookkeeping, payroll support, and advisory services for individuals and business entities.
            </p>
            <div className="pt-2 text-[11px] font-mono text-neutral-500 space-y-1">
              <div>Principal Office: San Ramon, California</div>
              <div>Operating Jurisdiction: Federal & 50 States</div>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black border-b border-neutral-200 pb-1.5">
              Public Page 2
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onNavigate('/public-v2')} className="text-neutral-700 hover:text-black hover:underline">
                  Home (Overview)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/public-v2/about')} className="text-neutral-700 hover:text-black hover:underline">
                  About the Practice
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/public-v2/services')} className="text-neutral-700 hover:text-black hover:underline">
                  Accounting & Tax Services
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/public-v2/industries')} className="text-neutral-700 hover:text-black hover:underline">
                  Industry Focus
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/public-v2/resources')} className="text-neutral-700 hover:text-black hover:underline">
                  Tax Calendar & Resources
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/public-v2/accounting-assistant')} className="text-black font-semibold hover:underline inline-flex items-center gap-1">
                  <span>Accounting Assistant</span>
                  <span className="px-1 py-0.2 bg-black text-white text-[9px] font-mono">DEMO</span>
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/public-v2/contact')} className="text-neutral-700 hover:text-black hover:underline">
                  Contact & Inquiries
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Portals & Operations */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black border-b border-neutral-200 pb-1.5">
              Portals & Practice
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onNavigate('/public-v2/portals')} className="text-neutral-700 hover:text-black hover:underline">
                  Portal Directory (29 Roles)
                </button>
              </li>
              <li>
                <a href="#/client/login" className="text-neutral-700 hover:text-black hover:underline">
                  Secure Client Portal Login
                </a>
              </li>
              <li>
                <a href="#/accountant/login" className="text-neutral-700 hover:text-black hover:underline">
                  Staff & Accountant Workspace
                </a>
              </li>
              <li>
                <a href="#/reviewer/login" className="text-neutral-700 hover:text-black hover:underline">
                  Reviewer Workspace
                </a>
              </li>
              <li>
                <a href="#/admin/login" className="text-neutral-700 hover:text-black hover:underline">
                  Administrative Practice Console
                </a>
              </li>
            </ul>
            <div className="pt-2">
              <button
                onClick={onOpenConsultation}
                className="w-full py-2 px-3 bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-colors text-center"
              >
                Book Consultation
              </button>
            </div>
          </div>

          {/* Col 4: Contact & Office */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black border-b border-neutral-200 pb-1.5">
              Contact & Location
            </h3>
            <div className="space-y-2.5 text-xs text-neutral-700">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-black flex-shrink-0 mt-0.5" />
                <span>
                  2603 Camino Ramon, Suite 200<br />
                  San Ramon, CA 94583
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-black flex-shrink-0" />
                <a href="tel:+19253971040" className="hover:underline text-black">
                  (925) 397-1040
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-black flex-shrink-0" />
                <a href="mailto:contact@artaxserv.com" className="hover:underline text-black">
                  contact@artaxserv.com
                </a>
              </div>
            </div>
            <div className="pt-3 border-t border-neutral-200 text-[11px] text-neutral-500">
              Developer Support:{' '}
              <a href="tel:+639179668814" className="text-black font-medium hover:underline">
                +63 917 966 8814
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Disclaimers */}
        <div className="mt-12 pt-6 border-t border-neutral-300 space-y-3 text-[11px] text-neutral-600 leading-relaxed">
          <p>
            <strong>Professional Practice Notice:</strong> A/R Tax Services, LLC provides professional accounting, tax preparation, bookkeeping, and business consulting services. This website and its interactive demonstration components (including the A/R Accounting Guidance Assistant and sample portal environments) are presented for educational and demonstration purposes. Information provided on this site does not constitute formal tax, legal, or investment advice and does not establish a confidential CPA-client or accountant-client relationship until an engagement letter is countersigned.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-neutral-500 font-mono text-[10px] pt-2">
            <span>© {new Date().getFullYear()} A/R Tax Services, LLC. All rights reserved.</span>
            <span>Monochrome Public Page 2 Edition</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
