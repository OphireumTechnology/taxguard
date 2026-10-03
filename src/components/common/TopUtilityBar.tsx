import React from 'react';
import { 
  Lock, 
  Phone, 
  MapPin, 
  Clock,
  Briefcase
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopUtilityBar: React.FC = () => {
  const { setCurrentPage } = useApp();

  const handleClientPortalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setCurrentPage('portal');
  };

  const handleStaffPortalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setCurrentPage('staff');
  };

  return (
    <div 
      className="bg-[#050E1A] border-b border-[#0B2748] text-xs text-slate-300 py-1.5 sm:py-2 relative z-50 select-none min-h-[38px] flex items-center"
      role="region"
      aria-label="Firm Quick Links & Utility Bar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-4 min-w-0 w-full">
        
        {/* LEFT: Verified Firm Information (Location, Phone, Business Hours) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 text-[11px] sm:text-xs">
          {/* Location */}
          <div className="flex items-center gap-1.5 text-slate-300 whitespace-nowrap">
            <MapPin className="w-3.5 h-3.5 text-[#C99A3D] flex-shrink-0" />
            <span className="text-slate-300 font-medium">Columbia, SC</span>
          </div>

          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">|</span>

          {/* Direct Phone */}
          <a 
            href="tel:678-205-9486" 
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-[#E2BD67] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D] rounded px-1 py-0.5 whitespace-nowrap"
            aria-label="Direct Telephone: 678-205-9486"
          >
            <Phone className="w-3.5 h-3.5 text-[#C99A3D] flex-shrink-0" />
            <span className="font-mono">678-205-9486</span>
          </a>

          <span className="text-slate-600 hidden md:inline" aria-hidden="true">|</span>

          {/* Business Hours */}
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 whitespace-nowrap text-[11px]">
            <Clock className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span>Mon–Fri 9:00 AM – 6:00 PM EST</span>
          </div>
        </div>

        {/* RIGHT: Strict Public Identity Separation */}
        {/* Public marketing pages show ONLY clean public links. Never authenticated state, names, or session controls. */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 justify-end flex-shrink-0 text-[11px] sm:text-xs">
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/portal"
              onClick={handleClientPortalClick}
              className="text-slate-300 hover:text-[#E2BD67] font-medium transition-colors inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D]"
              aria-label="Access Client Portal"
              role="link"
            >
              <Lock className="w-3 h-3 text-[#C99A3D]" />
              <span>Client Portal</span>
            </a>

            <span className="text-slate-600 inline" aria-hidden="true">&bull;</span>

            <a
              href="/staff"
              onClick={handleStaffPortalClick}
              className="text-slate-400 hover:text-[#E2BD67] font-medium transition-colors inline-flex items-center gap-1 px-1.5 py-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D]"
              aria-label="Access Staff Portal"
              role="link"
            >
              <Briefcase className="w-3 h-3 text-slate-400" />
              <span>Staff Portal</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
