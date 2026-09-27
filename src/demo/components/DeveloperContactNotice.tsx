import React from 'react';
import { Phone, ShieldAlert } from 'lucide-react';

interface DeveloperContactNoticeProps {
  reason?: string;
  className?: string;
  variant?: 'light' | 'navy';
}

export const DeveloperContactNotice: React.FC<DeveloperContactNoticeProps> = ({ 
  reason, 
  className = '', 
  variant = 'navy' 
}) => {
  const isNavy = variant === 'navy';

  return (
    <div className={`border p-4 text-xs transition-colors rounded-xl ${
      isNavy 
        ? 'border-[#C99A32]/30 bg-[#07182E] text-slate-200' 
        : 'border-neutral-300 bg-white text-black'
    } ${className}`}>
      <div className="flex items-start gap-2.5">
        <ShieldAlert className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isNavy ? 'text-[#C99A32]' : 'text-black'}`} />
        <div className="space-y-1.5 leading-relaxed">
          {reason && (
            <p className={`font-semibold border-b pb-1 mb-1 ${isNavy ? 'text-white border-[#1E3A5F]' : 'text-black border-neutral-200'}`}>
              Notice: {reason}
            </p>
          )}
          <div className={`font-bold uppercase tracking-wider text-[11px] ${isNavy ? 'text-[#E8C66A]' : 'text-black'}`}>
            Contact the Developer
          </div>
          <div className={isNavy ? 'text-slate-300' : 'text-black'}>
            <span className={`font-medium ${isNavy ? 'text-white' : 'text-black'}`}>Developed by:</span> Ophireum Multimedia Production
          </div>
          <div className={`flex items-center gap-1.5 ${isNavy ? 'text-slate-300' : 'text-black'}`}>
            <Phone className={`w-3.5 h-3.5 ${isNavy ? 'text-[#C99A32]' : 'text-black'}`} />
            <span className={`font-medium ${isNavy ? 'text-white' : 'text-black'}`}>Mobile Phone:</span>
            <a 
              href="tel:+639179668814" 
              className={`font-bold underline px-1 py-0.5 transition-colors ${
                isNavy ? 'text-[#E8C66A] hover:text-white' : 'hover:bg-black hover:text-white text-black'
              }`}
            >
              +63 917 966 8814
            </a>
          </div>
          <div className={`pt-2 border-t text-[11px] space-y-1 ${isNavy ? 'border-[#1E3A5F] text-slate-400' : 'border-neutral-200 text-neutral-700'}`}>
            <p><strong className={isNavy ? 'text-slate-200' : 'text-black'}>Compliance-supporting technology.</strong> Final legal, regulatory, accounting, and tax requirements must be validated by qualified U.S. professionals.</p>
            <p className={`text-[10px] font-mono ${isNavy ? 'text-slate-500' : 'text-neutral-500'}`}>Demonstration Environment – No Live Filing, Payment, Signature, Banking Connection, or Government Submission</p>
          </div>
        </div>
      </div>
    </div>
  );
};
